---
author: lukasmasuch
created: 2026-08-19
---

# Markdown in `st.selectbox` and `st.multiselect` options

## Summary

Render option labels in `st.selectbox` and `st.multiselect` with the same inline
markdown subset already used for widget labels, `st.radio` options, and
`st.menu_button` options (bold, italics, icons, colors, badges, and similar).
No new parameters. Filtering matches the visible text, not the markdown source.

## Problem

Widget **labels** on selectbox and multiselect already support markdown. **Options**
do not — they render as literal strings. That is inconsistent with `st.radio`,
`st.menu_button`, and `st.select_slider`, and it blocks the most requested use
case: material icons (and color) in a compact choice list.

```python
st.selectbox(
    "How would you like to be contacted?",
    [
        ":material/mail: Email",
        ":material/call: Phone",
        ":material/chat: Chat",
    ],
)
# Today: the user sees ":material/mail: Email"
```

Workarounds are emoji (inconsistent with the rest of the app) or custom
components.

**Requests:**

- [#7466](https://github.com/streamlit/streamlit/issues/7466) — Support markdown
  in the options of `st.selectbox` and `st.multiselect`
- [#12151](https://github.com/streamlit/streamlit/issues/12151) — Support
  material icons in `st.selectbox` (closed as duplicate of #7466)
- [#1140](https://github.com/streamlit/streamlit/issues/1140) — earlier request,
  incorrectly closed as a duplicate of label markdown (#863)

**Use cases:**

- Icons that categorize options (priority, status, contact method)
- Emphasis and color for status (`:red[Error]`, `:green-badge[Active]`)
- `format_func` that adds icons or color without changing the return value

The original issue also asked for HTML, LaTeX blocks, images-as-content, and
multiline option cards. Those do not fit a virtualized, single-line dropdown
and are out of scope (see below).

## Proposal

### API

No new parameters. Option strings — including the output of `format_func` — are
interpreted as **label markdown**, the same subset documented on the `label`
parameter today.

Docstring addition on `options` (match `st.radio` / `st.menu_button`):

> Labels can include markdown as described in the `label` parameter. Links are
> unwrapped to their link text (options are selectable, so they must not
> contain nested interactive elements).

Return values, widget state, `format_func`, `key`, and identity are unchanged.
The user still gets the original option object, not the formatted markdown
string.

### Markdown subset

Use `StreamlitMarkdown` with `isLabel`, `disableLinks`, and `truncate`. That is
the button / menu-item subset, not full `st.markdown`.

| Syntax | In options |
| ------ | ---------- |
| Bold, italic, strikethrough, inline code | Yes |
| Emoji, `:streamlit:`, `:material/icon:` | Yes |
| `:red[text]`, `:blue-background[text]`, `:green-badge[text]`, custom `:color[]` | Yes |
| `:small[]`, `:shimmer[]` | Yes (allowed because labels allow them) |
| Inline images | Yes, as icons (`max-height: 1em`) |
| Inline `$LaTeX$` | Yes, same as labels (see tech spec for risk) |
| Links | Text only — unwrap `[Docs](url)` to `Docs` |
| HTML | No (`allowHTML=false`) |
| Headings, lists, blockquotes, tables, hr, fenced code, `$$LaTeX$$` | No — escaped or unwrapped; display as literal / inner text |

Options stay **single line**. Dropdown rows are a fixed height and virtualized.
`isLabel` already unwraps block elements; the row also uses nowrap + ellipsis
(`truncate`) so leftover paragraph breaks from `\n\n` clip instead of wrapping.

Color directives are inline spans, so they need no extra API. Hover/focus on a
row tints the row background only — colored text, backgrounds, and badges keep
their own color (do not copy tertiary-button hover, which forces colored spans
to `inherit`).

### Where markdown renders

| Surface | Behavior |
| ------- | -------- |
| Dropdown rows (both widgets) | Rendered markdown, truncated with ellipsis |
| Multiselect chips | Rendered markdown inside the chip |
| Selectbox, idle (value committed) | Rendered markdown overlay on the closed control |
| Selectbox, while typing | Native input shows the **filter query as plain text** |
| Screen readers / `title` tooltips | Visible plaintext, not raw `**` / `:material/…:` |

The overlay is required: React Aria ComboBox uses a native `<input>` for both
the committed value and the filter query, and an input cannot render markdown.
Without it, `:material/mail: Email` would still show as raw syntax when the
dropdown is closed.

### Filtering

Users type what they see. Existing `filter_mode` values (`"fuzzy"`,
`"contains"`, `"prefix"`, `None`) are unchanged, but they match **visible
plaintext**, not markdown source.

| Option source | User types | Match |
| ------------- | ---------- | ----- |
| `**Apple** pie` | `Apple pie` or `App` | Yes |
| `:material/mail: Email` | `Email` or `mail` | Yes (`mail` is the icon name) |
| `:red[Error]` | `Error` | Yes |
| `:red[Error]` | `red` | No — color is visual-only |
| `**Bold** text` | `**` | No — punctuation is not indexed |

If an app wants color (or other directives) to be searchable, put that word in
the visible label (`:red[red: Error]`).

`filter_mode=None` is unchanged: typing is blocked, markdown still renders in
the list and on the closed control.

### `accept_new_options`

- Creating a value compares the typed query to both visible plaintext and the
  original option string, so typing `Apple pie` does not offer “Add: Apple pie”
  next to `**Apple** pie`.
- A newly created option is stored as whatever the user typed. If they type
  markdown, it will render as markdown on the next display.

### Compatibility

Interpreting options as markdown is a **visual** change, not an API change.
Apps whose option strings already contain `**`, `_`, `` ` ``, `:joy:`, or
`:material/…:` will start rendering that syntax. `st.radio` already made this
tradeoff.

To show markdown characters literally, backslash-escape them (same as labels)
or strip them in `format_func`.

Options loaded from a database are the main risk ([comment on
#7466](https://github.com/streamlit/streamlit/issues/7466#issuecomment-1782385358)).
No opt-in flag in v1 — that would diverge from radio / labels / “markdown
everywhere.” Revisit only if this causes real breakage.

### Examples

**Icons:**

```python
import streamlit as st

contact = st.selectbox(
    "How would you like to be contacted?",
    [
        ":material/mail: Email",
        ":material/call: Phone",
        ":material/chat: Chat",
    ],
)
```

**Color and badges:**

```python
status = st.selectbox(
    "Status",
    [
        ":green-badge[Active] Production",
        ":orange-badge[Paused] Staging",
        ":red[Disabled] Legacy",
    ],
)
```

**`format_func` (return value stays the raw option):**

```python
priorities = ["p0", "p1", "p2"]
choice = st.selectbox(
    "Priority",
    priorities,
    format_func=lambda p: {
        "p0": ":red[:material/error: P0]",
        "p1": ":orange[:material/warning: P1]",
        "p2": ":material/info: P2",
    }[p],
)
st.write(choice)  # "p0", not the markdown string
```

**Multiselect:**

```python
labels = st.multiselect(
    "Labels",
    [
        ":material/bug_report: Bug",
        ":material/lightbulb: Feature",
        ":material/description: Docs",
    ],
)
```

## Alternatives considered

### Opt-in parameter (`markdown=True` / `unsafe_allow_markdown`)

**Pros:** No surprise formatting for DB-backed option lists.

**Cons:** New parameter on two widgets; radio, menu button, and labels have no
such flag; fights principle 24 (markdown everywhere).

**Decision:** Always on. Escape hatch is backslash-escaping or `format_func`.

### Full markdown (HTML, multiline, tables, clickable links)

This is what #7466 asked for.

**Cons:** Breaks the fixed-height virtualizer; HTML is an XSS surface; links
inside a selectable row fight click-to-select; radio/buttons already reject
this subset.

**Decision:** Label subset only.

### Markdown in the dropdown only (plain source in the closed selectbox)

**Pros:** Avoids the input overlay.

**Cons:** The common case (icons in the selected value) still looks broken when
the dropdown is closed.

**Decision:** Overlay for idle selectbox. Multiselect chips already can render
markdown without an overlay.

## Out of scope (future work)

- HTML, multiline option cards, variable-height rows
- Clickable links inside options
- DataFrame `SelectboxColumn` / `MultiselectColumn`
- Opt-in / opt-out flag for markdown in options
- Highlighting the matched query inside markdown
- Server-side or callable filters
- Special-casing `:shimmer[]` / `:help[]` in options (allowed because labels
  allow them; revisit if they are noisy in a list)

## Checklist

| Item | ✅ or comment |
| ---- | ------------- |
| Works on SiS, Cloud, etc? | ✅ frontend-only rendering and filtering |
| No breaking API changes | ✅ no new params; mild visual change for option strings that already contain markdown |
| No new dependencies | ✅ existing `StreamlitMarkdown` + `filterSelectOptions` |
| Metrics collected | N/A — no new parameter |
| Any security/legal impact? | Same as widget labels: `allowHTML=false`, links disabled |
| Any docs changes needed? | ✅ document markdown on `options` for both widgets |
