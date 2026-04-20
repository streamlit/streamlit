---
author: lukasmasuch
created: 2026-04-20
---

# Copy-to-Clipboard Button for `st.markdown`

## Summary

Add a `copy_to_clipboard: bool = False` parameter to `st.markdown` that displays a toolbar
with a copy icon on hover, allowing users to copy the raw Markdown text to the clipboard.
This provides a consistent way for users to make text content easily shareable and reusable,
following patterns established by `st.code`.

## Problem

Users want to display Markdown content that viewers can easily copy. Currently, copying
Markdown text requires selecting and copying manually, which is cumbersome for:

- Code snippets formatted with Markdown
- API documentation or configuration examples
- JSON/YAML snippets displayed as formatted text
- Reusable text templates or prompts

**User request:**

- [#6726](https://github.com/streamlit/streamlit/issues/6726) - Add Copy to Clipboard
  feature to Markdown and other fields
- [#6921](https://github.com/streamlit/streamlit/issues/6921) - Add a "Copy to Clipboard"
  button in `st.chat()` elements

**Existing pattern:**

Streamlit already has copy-to-clipboard functionality in `st.code`, which unconditionally
shows a copy button for all code blocks. This proposal brings the same capability to
`st.markdown` but makes it opt-in (default `False`) to avoid visual clutter on general prose
content where copying is less common. The `st.code` always-on approach is appropriate for code
blocks (which users frequently need to copy), while markdown content is more varied in purpose.

## Proposal

### API

```python
st.markdown(
    body,
    ...,
    copy_to_clipboard: bool = False,  # NEW
)
```

### Parameter

| Parameter           | Type   | Default | Description                                                                                                                                    |
| ------------------- | ------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `copy_to_clipboard` | `bool` | `False` | Whether to display a copy-to-clipboard button. If `True`, a toolbar with a copy icon appears on hover, allowing users to copy the raw text. |

### Behavior

**`copy_to_clipboard=False` (default):**

- Standard Markdown rendering without any toolbar
- Preserves current behavior

**`copy_to_clipboard=True`:**

- A toolbar with a copy icon appears when hovering over the Markdown element
- Clicking the copy icon copies the cleaned/normalized Markdown source (after `clean_text()`
  processing) to the clipboard. This is the raw markdown text before rendering, preserving
  all markdown syntax, HTML tags, LaTeX expressions, and emoji shortcodes. Note that
  `clean_text()` performs minimal normalization (e.g., dedent for multi-line strings).
- The icon briefly changes to a checkmark to confirm the copy succeeded
- The toolbar follows the same visual pattern as other elements (appears at top-right on hover)
- **Mobile/touch behavior:** On touch devices (where hover is not available), the copy button
  appears on tap and remains visible for a few seconds, matching `st.code` behavior. This
  ensures the feature is usable on mobile devices and tablets.

### Alternative Parameter Names Considered

Several alternative names were considered for this parameter:

**Option 1: `copy_to_clipboard`** (preferred)

- Pros: Descriptive, clear about functionality, matches browser API naming (`navigator.clipboard`)
- Cons: Verbose (17 characters)

**Option 2: `show_copy_button`**

- Pros: Describes the UI element directly, clear intent
- Cons: Focuses on the button rather than the action; doesn't match existing patterns

**Option 3: `copyable`**

- Pros: Very concise (8 characters), reads naturally ("make this copyable")
- Cons: Could be confused with whether content CAN be copied vs whether a button is shown;
  ambiguous semantics

**Option 4: `enable_copy`**

- Pros: Concise, action-oriented
- Cons: Could imply enabling/disabling copy behavior entirely (not just the button)

**Option 5: `copy`**

- Pros: Extremely concise (4 characters)
- Cons: Too terse, ambiguous (copy what? where?), doesn't follow Streamlit naming patterns

**Recommendation:** Use `copy_to_clipboard` for consistency with browser APIs and clarity.
The verbosity is acceptable since this is a keyword-only optional parameter users won't
type frequently.

### Examples

**Basic usage:**

```python
import streamlit as st

# Show copy button on hover
st.markdown("**API Key:** `sk-12345`", copy_to_clipboard=True)

# Without copy button (default)
st.markdown("Regular markdown content")
```

**Documentation template:**

```python
import streamlit as st

template = """
## API Endpoint

**URL:** `https://api.example.com/v1/users`
**Method:** `GET`
**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`
"""

st.markdown(template, copy_to_clipboard=True, width="content")
```

### Edge Cases

- **Empty body**: Copy button still appears and copies empty string. Rationale: This matches
  `st.code` behavior and keeps the API predictable. If a developer sets `copy_to_clipboard=True`,
  they explicitly want the button shown regardless of content length. Hiding the button
  conditionally would introduce unexpected behavior when content is dynamically generated.
- **HTML content (`unsafe_allow_html=True`)**: Copies the raw string including HTML tags,
  not the rendered output
- **LaTeX expressions**: Copies the raw LaTeX syntax (e.g., `$E = mc^2$`)
- **Emoji shortcodes**: Copies the shortcode syntax (e.g., `:wave:`)
- **Very long content**: Works normally; user gets entire content on clipboard
- **Multiple `st.markdown` calls**: Each instance has its own independent copy button

### Visual Design

The toolbar follows existing Streamlit patterns:

- Positioned at top-right of the element
- Appears on hover over the Markdown content area
- Uses the same icon and animation as other copy buttons in Streamlit
- Checkmark confirmation animation on successful copy
- Semi-transparent background to avoid obscuring content

## Out of Scope (Future Work)

- **Copy button for other text elements** (`st.text`, `st.caption`, `st.title`): Could be
  added later using the same pattern. The parameter name should be consistent across elements.
- **Custom copy content**: Allowing users to specify different text to copy than what's
  displayed. This would add complexity for a niche use case.
- **Copy format options** (plain text vs. rendered): Always copies raw Markdown; rendered
  output copying would require different implementation.

## Checklist

| Item                         | ✅ or comment                                                        |
|------------------------------|----------------------------------------------------------------------|
| Works on SiS, Cloud, etc?    | ✅ Yes - Uses standard clipboard API                                 |
| No breaking API changes      | ✅ Yes - New optional parameter with `False` default                 |
| No new dependencies          | ✅ Yes - Uses existing `useCopyToClipboard` hook                     |
| Metrics collected            | ✅ Yes - Automatically tracked via `gather_metrics`                  |
| Any security/legal impact?   | ✅ None - just clipboard write, no data exfiltration                 |
| Any docs changes needed?     | ✅ Yes - Document `copy_to_clipboard` parameter                      |
