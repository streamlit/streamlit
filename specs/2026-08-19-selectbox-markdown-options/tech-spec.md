---
author: lukasmasuch
created: 2026-08-19
---

# Markdown in `st.selectbox` and `st.multiselect` options

## Summary

Frontend-only change. Option strings are already on the wire; interpret them as
label markdown in the dropdown, multiselect chips, and an idle overlay on the
selectbox input. Split each option into stored value vs visible plaintext so
existing `filterSelectOptions` / `filter_mode` keep working.

See the [product spec](./product-spec.md) for user-facing behavior.

## Problem

`st.radio` and `st.menu_button` pass option strings to `StreamlitMarkdown`
(`isLabel`). Selectbox and multiselect pass the same proto field
(`repeated string options`) but render it as a text node inside a React Aria
ComboBox.

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
   compare the input string to the option string.

No proto, backend mapping, or widget-identity change is required.
`format_func` already produces the display string the frontend receives.

## Proposal

### Option model

Today both widgets build `{ id, label, value }` with `label === value === opt`.
Split that:

| Field | Content | Used for |
| ----- | ------- | -------- |
| `value` | Original formatted option string | Widget state, backend `formatted_option_to_option_index`, creatable identity |
| `label` | Visible plaintext (markdown stripped) | `filterSelectOptions`, `textValue`, selectbox input, exact match |
| `markdown` | Same as `value` | `StreamlitMarkdown` in list / overlay / chips |

Precompute `label` once in the existing `useMemo` over `options`, not per
keystroke. `filterSelectOptions` stays unchanged: it already filters on
`label`.

Plaintext rules:

- Unwrap emphasis, code, links (`[text](url)` → `text`), images (alt text)
- Unwrap color / badge / background / small / shimmer to **inner text only**
  (`:red[Error]` → `Error`, not `red Error`)
- Include material icon names (`:material/mail: Email` → `mail Email`) so
  typing the icon still matches
- Do not index leftover punctuation (`*`, `_`, `` ` ``)

Creatable “already exists” must compare the typed query to **both** `label`
and `value`.

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

Keep the existing nowrap/overflow on `StyledItemHighlight`. Virtualizer row
size stays `dropdownItemHeight`.

**Multiselect chips:** render `StreamlitMarkdown` inside `StyledTagText`. Set
`aria-label` / `title` to plaintext. Bulk-action and creatable rows
(`Select all`, `Add: …`) stay plain text.

**Selectbox idle overlay:** when `!filterActive` and a value is committed,
paint markdown over the input and make the input text transparent. On first
keystroke (`filterActive`), hide the overlay and show the query. On blur /
commit / Escape, restore. `filter_mode=None` keeps the overlay whenever a
value exists.

Do not change row/`<input>` `color` on hover. Tertiary buttons force
`span.stMarkdownColoredText { color: inherit !important }` so hover can
recolor the label; doing that here would wash out `:red[]` / `:rainbow[]`.
The ComboBox hover already only sets background on `[data-item-hl]`.

`isLabel` unwraps headings/lists/tables/blockquotes but still allows `<p>`.
`truncate` + nowrap is what keeps `\n\n` from breaking the virtualizer.

### Files

| Area | Files |
| ---- | ----- |
| Plaintext helper + tests | new util next to `fuzzyFilterSelectOptions.ts` |
| Selectbox ComboBox | `frontend/lib/src/components/shared/Dropdown/Selectbox.tsx` (+ styled) |
| Multiselect filter list | `frontend/lib/src/hooks/useMultiselectFiltering.ts` |
| Multiselect chips / rows | `frontend/lib/src/components/widgets/Multiselect/Multiselect.tsx` (+ styled) |
| Docs | `lib/streamlit/elements/widgets/selectbox.py`, `multiselect.py` |
| Tests | unit tests for plaintext + filter; e2e snapshots for closed value, open dropdown, chips, filter query, creatable |

Backend/proto unchanged.

### Implementation order

1. Plaintext helper + filter unit tests (locks matching before UI changes)
2. Split `value` / `label` / `markdown` on both widgets (equality, creatable,
   `getInsertedText`)
3. Markdown in dropdown rows
4. Markdown in multiselect chips
5. Selectbox idle overlay
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

### Skip KaTeX in options

Inline `$…$` is allowed in labels and will work, but rehype-katex is
lazy-loaded and shows a skeleton. That can flicker inside a virtual list.
Ship it (consistent with labels); drop it only if snapshots/flicker are
bad.

## Testing

- Plaintext helper: emphasis, links, icons, color/badge/background, images
- Filter: `contains` / `prefix` / `fuzzy` against `**Apple** pie` and
  `:material/mail: Email`; `**` does not match; `:red[Error]` does not match
  `red`
- Creatable: typing the visible text of a markdown option does not create a
  duplicate
- Selectbox: overlay when idle, plaintext query while typing, overlay restored
  on blur/Escape
- E2E snapshots: closed selectbox, open dropdown, multiselect chips, long
  option ellipsis (the failure mode on #10086)
