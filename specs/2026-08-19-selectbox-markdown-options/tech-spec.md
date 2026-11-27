---
author: lukasmasuch
created: 2026-08-19
---

# Markdown in `st.selectbox` and `st.multiselect` options

## Summary

Frontend-only change. Option strings are already on the wire; interpret them as
label markdown in the dropdown, multiselect chips, and an idle overlay on the
selectbox input. Split each option into stored `value`, visible `label`,
filter `search`, and render `markdown` so existing `filterSelectOptions` /
`filter_mode` keep working.

See the [product spec](./product-spec.md) for user-facing behavior.

## Problem

`st.radio` and `st.menu_button` pass option strings to `StreamlitMarkdown`
(`isLabel`; menu button also `disableLinks`). Selectbox and multiselect pass
the same proto field (`repeated string options`) but render it as a text node
inside a React Aria ComboBox.

Three constraints the radio path does not have:

1. **Native `<input>`.** ComboBox uses one input for the committed value and
   the filter query. Markdown cannot render inside it. The pre-1.59 BaseWeb
   Select had a `SingleValue` slot ([PR #10086](https://github.com/streamlit/streamlit/pull/10086));
   that PR is stale after the RAC rewrite.
2. **Fixed-height virtualization.** Rows are `theme.sizes.dropdownItemHeight`
   (`2.5rem`) via RAC `ListLayout`. Block / multiline markdown would desync
   the virtualizer.
3. **Client-side filtering.** `filterSelectOptions` matches `opt.label`.
   Prefix/contains against markdown source miss once a label starts with `**`
   or `:material/…:`. Creatable / Enter-to-select / `getInsertedText` all
   compare the input string to the option string. After the split, filter
   uses `search` (icon names appended); the input and idle detection use
   display `label`.

No proto, backend mapping, or widget-identity change is required.
`format_func` already produces the display string the frontend receives.

## Proposal

### Option model

Today both widgets build `{ id, label, value }` with `label === value === opt`.
Split that:

| Field | Content | Used for |
| ----- | ------- | -------- |
| `value` | Original formatted option string | Widget state, backend `formatted_option_to_option_index`, creatable identity, bind |
| `label` | Visible plaintext (no icon names, no color tokens) | Native input, `textValue`, `title`, `aria-label`, `getInsertedText`, idle / `filterActive`, blur / Escape restore |
| `search` | Visible plaintext with material icon names **appended** (`Email mail`) | `filterSelectOptions` only |
| `markdown` | Same as `value` | `StreamlitMarkdown` in list / overlay / chips |

Precompute `label` and `search` once in the existing `useMemo` over
`options`, not per keystroke. Call `filterSelectOptions` with `label` bound
to `search` (the helper stays unchanged). ComboBox `textValue` uses display
`label`.

Icon-only options (`:material/error:`): `label` and `search` are both the
icon name, so the accessible name is not empty.

**Committed display label.** While a value is committed, the input holds
`label`, not `value`. Derive `committedLabel` whenever comparing to input
text:

```ts
const committedLabel =
  selectOptions.find(o => o.value === value)?.label ?? value ?? ""
```

Creatable values that are not in `options` fall back to `value` (the typed
string). Every site in `Selectbox.tsx` that today compares input text to
`value` / `valueRef` must use `committedLabel` instead:

| Site | Today | After |
| ---- | ----- | ----- |
| `commitSelection` | `setInputValue(newValue)` | `setInputValue(label for newValue)` |
| `getInsertedText(committed, text)` | `committed = valueRef` | `committed = committedLabel` |
| `handleInputChange` `isEdit` | `text !== valueRef` | `text !== committedLabel` |
| `handleSelectionChange` RAC revert | `setInputValue(valueRef)` | `setInputValue(committedLabel)` |
| `handleBlur` / Escape restore | `setInputValue(valueRef)` | `setInputValue(committedLabel)` |
| Enter exact match | `o.value === inputValue` | `o.label === inputValue` (also allow `o.value` so typing the raw markdown still selects) |
| `useExecuteWhenChanged` / prop sync | `setInputValue(propValue)` | map `propValue` through options to `label` |

If this mapping is skipped, `filterActive` stays true after commit (plaintext
≠ markdown `value`), the idle overlay never shows, and restore paths write
raw markdown into the input.

Creatable “already exists” must compare the typed query to **both** display
`label` and `value`.

### Plaintext helper

Do **not** implement a regex unwrapper. GFM emphasis, nested
`:red[:blue[…]]`, links, and images are exactly what a markdown parser
already handles, and a hand-rolled stripper will drift from
`StreamlitMarkdown`.

Reuse the remark stack already in `@streamlit/lib` (`unified`, `remark-gfm`,
`remark-directive`, `remark-math`, `unist-util-visit`). Flatten with
`mdast-util-to-string` (already in `yarn.lock` as a transitive dep of the
remark packages — promote it, and `remark-parse`, to **direct** dependencies).
Do not add [`strip-markdown`](https://github.com/remarkjs/strip-markdown): it
produces a stripped tree, which we do not need; `toString` is the string we
filter on.

Build **one** processor at module scope and parse with the same micromark
extensions as labels. `.parse()` is enough; do not `.run()` the Streamlit
remark plugins (coloring, logo, help icon, emoji). Those attach theme / hast
data, lazy-load emoji, and replace `:streamlit:` with `""`.

The helper returns **two** strings:

```ts
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkMath)

function markdownToOptionText(source: string): { label: string; search: string } {
  const tree = processor.parse(
    source.replaceAll(":material/", ":material_"), // same preprocess as StreamlitMarkdown
  )
  visit(tree, "textDirective", (node, index, parent) => {
    // :red[Error] / badges / backgrounds / :help[] → inner text only
    if (parent && index !== undefined) {
      parent.children.splice(index, 1, ...node.children)
    }
  })
  const iconNames: string[] = []
  visit(tree, "text", node => {
    node.value = node.value.replace(/:material_(\w+):/g, (_m, name) => {
      iconNames.push(name)
      return ""
    })
    if (node.value.includes(":streamlit:")) {
      iconNames.push("streamlit")
      node.value = node.value.replace(/:streamlit:/g, "")
    }
  })
  const label = toString(tree).replace(/\s+/g, " ").trim()
  const icons = iconNames.join(" ")
  return {
    label: label || icons, // icon-only: accessible name is the icon id
    search: [label, icons].filter(Boolean).join(" "),
  }
}
```

The `:material_` / `:streamlit:` replaces after parse are the only
Streamlit-specific piece: those tokens are **not** GFM. Skip `remark-emoji`
on this path (it is lazy-loaded at render time); leaving `:joy:` as text
means typing `joy` still matches.

Rules this must satisfy:

- Unwrap emphasis, code, links (`[text](url)` → `text`), images (alt text),
  `:help[]` (inner text, no button)
- Unwrap color / badge / background / small / shimmer to **inner text only**
  (`:red[Error]` → `Error`, not `red Error`)
- `label` is visible text only (`:material/mail: Email` → `Email`)
- `search` appends icon names (`Email mail`) so `"prefix"` matches `Email`
  and `"contains"` / `"fuzzy"` still match `mail`
- Do not index leftover punctuation (`*`, `_`, `` ` ``)

Selectbox commit: store `value`, put `label` in the input so
`getInsertedText` diffs against what the user sees (plaintext), not
`**Apple** pie`.

### Rendering

**Dropdown rows** (shared `renderOption` in
`frontend/lib/src/components/shared/Dropdown/Selectbox.tsx` and
`frontend/lib/src/components/widgets/Multiselect/Multiselect.tsx`):

```tsx
<StyledListBoxItem id={option.id} textValue={option.label} …>
  <StyledItemHighlight data-item-hl="">
    <StreamlitMarkdown
      source={option.markdown}
      allowHTML={false}
      isLabel
      disableLinks
      truncate
    />
  </StyledItemHighlight>
</StyledListBoxItem>
```

Also unwrap `:help[]` to inner text (no `InlineTooltipIcon` button) — same
nested-interactivity rule as links. Implementation can strip the help
remark plugin for this surface or treat `textDirective` name `help` like a
link unwrap.

Keep the existing nowrap/overflow on `StyledItemHighlight`. Virtualizer row
size stays `dropdownItemHeight`.

**Multiselect chips:** render `StreamlitMarkdown` inside the chip with
`isLabel`, `disableLinks`, `truncate`, and `:help[]` unwrapped.

Three chip constraints:

- **Contrast:** `StyledTag` is `theme.colors.primary` on `theme.colors.white`.
  Markdown color/badge/background sets inline `color` / fill, which would
  fail contrast (e.g. `:red[Disabled]` on a primary chip). Force colored
  spans and badge/background chrome inside chips to `color: inherit` (chip
  foreground). Do not restyle chip chrome in v1. Dropdown rows keep real
  colors.
- **DOM:** `StreamlitMarkdown` currently roots on a `<div>`; `StyledTagText`
  is a `<span>`. Use an inline markdown root or change `StyledTagText` to a
  `div`. No `div` inside `span`.
- **Height:** `truncate` + the chip's existing nowrap so badges, inline
  images, or a plugin placeholder cannot overflow `elementHighlightHeight`.
  `aria-label` / `title` use display `label`.

Bulk-action and creatable rows (`Select all`, `Add: …`) stay plain text.

**Selectbox idle overlay:** when `!filterActive` and a value is committed,
paint markdown over the input and make the input text transparent. On first
keystroke (`filterActive`), hide the overlay and show the query. On blur /
commit / Escape, restore. `filter_mode=None` keeps the overlay whenever a
value exists. Tab into the control without typing stays idle (`!filterActive`)
— overlay on, no visible caret on invisible text.

Overlay constraints (easy to get wrong on a focusable `<input>`):

- `aria-hidden="true"` so the value is not announced twice (the input
  already exposes `label`).
- `pointer-events: none` so click-to-place-caret and drag-select still hit
  the input.
- Input `label` remains the only exposed selection text (copy/paste and
  `getInsertedText`).
- Keep an explicit `caret-color` when input text is transparent; otherwise
  the caret vanishes under `filter_mode=None`.
- `forced-colors` / Windows High Contrast: `color: transparent` can hide
  the caret or value — provide a fallback (e.g. hide the overlay and show
  plaintext).
- Truncate the overlay with ellipsis when the committed option is wider
  than the control (same as `truncate` on rows).
- Invisible text behind an opaque overlay may still be Ctrl+A-selected;
  accept that, or suppress selection while idle. Pick one in
  implementation and cover it with an e2e test.

Do not change row/`<input>` `color` on hover. Tertiary buttons force
`span.stMarkdownColoredText { color: inherit !important }` so hover can
recolor the label; doing that here would wash out `:red[]` / `:rainbow[]`.
The ComboBox hover already only sets background on `[data-item-hl]`.

`isLabel` unwraps headings/lists/tables/blockquotes but still allows `<p>`.
`truncate` + nowrap is what keeps `\n\n` from breaking the virtualizer.

While KaTeX or `remark-emoji` chunks are loading, **do not** show
`SquareSkeleton` in option rows, chips, or the overlay (it is full-size and
would grid-skeleton a list of `:joy:` options). Render the option without
the pending plugin, or show display `label`, until the chunk arrives.

### Performance

This is a real concern for large option lists, not a non-issue. The ComboBox
already virtualizes rendering (the unit test uses **16k** rows and only
mounts a window). Multiselect already disables “Select all” above **1000**
options (`SELECT_ALL_THRESHOLD`) to avoid freezes. Filtering still walks
**every** option on each keystroke today. Markdown must not make the
construction path as expensive as rendering every row.

| Work | When | Cost |
| ---- | ---- | ---- |
| `StreamlitMarkdown` (full remark → rehype → React, emoji/KaTeX lazy-load) | Visible virtualizer window only (~tens of rows) | Already paid today for labels; keep it off-screen for the rest of the list |
| `markdownToOptionText` (parse + `toString`, no rehype / no React) | Once per `options` identity change, in the existing `useMemo` | New. O(n × option length). Must not run per keystroke |
| `filterSelectOptions` | Every keystroke | Unchanged: string match on precomputed `search` |

**Why parse still matters:** micromark is fast on short strings, but 16k
parses on every widget remount (Streamlit reruns typically pass a new
`options` array) can hitch. Most large lists are **plain** (`"Option 1234"`,
DB keys). Those should not hit the parser.

Mitigations (required, not later polish):

1. **Once per options change**, never per keystroke.
2. **Module-scoped processor** — do not `unified()` per option.
3. **Fast path:** if the string cannot contain markdown / Streamlit
   directives, return it unchanged. Scan for
   `` : * _ ` [ ] $ ! ~ < ``. Include `_` so `_italic_` is never skipped;
   `foo_bar` is a false positive and still parses (one text node — cheap).
   False negatives are not allowed.
4. **Do not** run `BASE_REMARK_PLUGINS`, `remark-emoji`, coloring, or
   rehype-katex on the strip path.
5. **Do not** mount hidden `StreamlitMarkdown` and read `textContent`
   (`useLabelTitleTooltip` does this for button titles). The virtualizer
   never mounts all rows, and emoji plugins are async.

**Budget:** typical widgets (tens to low hundreds of options, mixed
markdown) should be lost in rerun noise. A 16k-row all-plain list should
stay in the fast path and match today’s construction cost. A 16k-row list
where **every** option is `:material/…: …` will pay for 16k parses on each
options update — acceptable if it stays well under a frame or two; if
profiles show otherwise, the next lever is still an mdast visitor or a
worker, **not** a regex stripper. Add a unit test that builds labels for
the 16k plain list so the fast path cannot regress.

### Files

| Area | Files |
| ---- | ----- |
| Plaintext helper + tests | new util next to `fuzzyFilterSelectOptions.ts` |
| Selectbox ComboBox | `frontend/lib/src/components/shared/Dropdown/Selectbox.tsx` (+ styled) |
| Multiselect filter list | `frontend/lib/src/hooks/useMultiselectFiltering.ts` |
| Multiselect chips / rows | `frontend/lib/src/components/widgets/Multiselect/Multiselect.tsx` (+ styled) |
| Docs | `lib/streamlit/elements/widgets/selectbox.py`, `multiselect.py` |
| Tests | unit tests for plaintext + filter; e2e snapshots for closed value, open dropdown, chips, filter query, creatable |

Backend/proto unchanged. `bind="query-params"` and `persist_state` need no
code changes: the frontend already writes `string_value` /
`string_array_value` from the formatted option string, and
`_seed_widget_from_url` already validates against `formatted_options`.
Markdown is display-only on top of that string. Radio already round-trips
markdown option strings through bind.

Do not bind the plaintext filter label. A URL of `?contact=Email` must not
match `:material/mail: Email`.

### Implementation order

1. Plaintext helper + filter unit tests (locks matching before UI changes)
2. Split `value` / `label` / `search` / `markdown` on both widgets; convert
   every input-vs-value site to `committedLabel` (table above)
3. Markdown in dropdown rows (no plugin-load skeleton)
4. Markdown in multiselect chips (inherit color, inline root, `truncate`)
5. Selectbox idle overlay (constraints above)
6. Docstrings + e2e snapshots

## Alternatives considered

### Revive PR #10086 (BaseWeb `SingleValue` / `VirtualDropdown`)

Those components no longer exist. The RAC ComboBox always shows an `<input>`.

### Contenteditable combobox

Would render markdown in the focused value, but throws away RAC ComboBox
keyboard/a11y behavior and is far larger than a papercut.

### Filter on markdown source (or source + plaintext)

Prefix/contains break for leading `**` / `:material/`. Dual-matching
reintroduces hits on `*` / `:red`. Plaintext only.

### Collapse newlines to spaces in option source

More aggressive than radio. CSS nowrap + `truncate` is enough for v1.

### Regex plaintext stripper

Faster on paper and has no extra imports. It will miss nested directives,
GFM edge cases, and future Streamlit markdown syntax, and it will disagree
with `StreamlitMarkdown` whenever the two drift. Not worth it.

### `strip-markdown` remark plugin

Official, small, designed to remove markup. Redundant with
`mdast-util-to-string` for a filter corpus, still ignorant of
`:red[]` / `:material/` unless we add the same visits, and it is a new
package. Flatten the tree we already parse.

### DOM `textContent` after render

`useLabelTitleTooltip` already does this for widget-label tooltips. Wrong
for filtering: we need a sync string before rows mount, the virtualizer
does not mount all options, and emoji is async.

### Run the full `StreamlitMarkdown` / `BASE_REMARK_PLUGINS` pipeline to strip

Would include icon names and colors “for free,” but pulls in theme, hast,
logo (which deletes `:streamlit:` from the string), and lazy emoji. Too
heavy for n options. Parse + unwrap directives is enough.

### Skip KaTeX / emoji skeletons in options

`remark-emoji` and rehype-katex are lazy-loaded. While a needed plugin is
pending, `RenderedMarkdown` returns a full-size `SquareSkeleton`. Emoji
shortcodes are far more common in existing option lists than inline LaTeX;
a list of `:joy:` options would skeleton-grid on first open.

**Decision:** do not show `SquareSkeleton` on option surfaces. Render without
the pending plugin, or show display `label`, until the chunk loads. Cover
emoji and `$…$` in e2e snapshots.

### Prepend icon names (`mail Email`)

Breaks `"prefix"` for the flagship “type what you see” case (`Email`).
Append instead. See product spec.

## Testing

- Plaintext helper: emphasis, links, `:help[]`, icons, color/badge/background,
  images; nested `:red[:material/error: P0]` → label `P0`, search `P0 error`;
  fast path leaves plain `"Option 12"` unchanged; golden fixtures for those
  cases so the helper cannot drift from the renderer
- Fast path / construction: 16k plain options do not invoke `processor.parse`
- Filter: `contains` / `prefix` / `fuzzy` against `**Apple** pie` and
  `:material/mail: Email` (`Email` matches all modes; `mail` matches
  contains/fuzzy only; `**` does not match; `:red[Error]` does not match
  `red`)
- Input vs value: after commit, input equals `label`; `filterActive` is false;
  overlay shows; blur/Escape restore `label` not markdown source
- Creatable: typing the visible text of a markdown option does not create a
  duplicate
- Selectbox: overlay when idle (including Tab-focus), plaintext query while
  typing, overlay restored on blur/Escape
- Chips: no div-in-span; colored markdown inherits chip foreground; truncate
- E2E snapshots: closed selectbox, open dropdown, `:joy:` options (no
  skeleton grid), `$…$`, multiselect chips, long option ellipsis (the failure
  mode on #10086)
