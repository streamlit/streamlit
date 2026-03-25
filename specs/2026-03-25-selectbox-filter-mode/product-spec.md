---
author: lukasmasuch
created: 2026-03-25
---

# Selectbox & Multiselect Filter Mode

## Summary

Add a `filter_mode` parameter to `st.selectbox` and `st.multiselect` to control how user input filters the dropdown options. This enables prefix-only matching, substring matching, and the ability to disable filtering entirely.

## Problem

### Current Behavior

`st.selectbox` and `st.multiselect` use fuzzy matching to filter options when users type. While fuzzy matching works well for general use cases (e.g., searching countries), it causes problems for users working with IDs, codes, or other precise data:

```python
# User types "A123" expecting exact match
options = ["A123", "A1234", "A12345", "BA123", "CA123"]
st.selectbox("Part ID", options)
# Fuzzy matching may rank "A1234" above "A123" or show unrelated matches like "BA123"
```

### User Pain Points

1. **ID Matching:** Users working with part numbers, SKUs, commit hashes, or database IDs get incorrect fuzzy matches that can lead to costly errors
2. **Similar Options:** When options differ by a single character, fuzzy matching makes it easy to accidentally select the wrong item
3. **Unwanted Keyboard Input:** For short option lists (Yes/No, On/Off), any typing ability feels unnecessary and potentially confusing
4. **Mobile UX:** While current selectbox behavior already hides the keyboard on mobile for short option lists, developers have no explicit control over this behavior for larger lists where they want to prevent filtering

### User Requests

**Primary GitHub Issues:**

- [#7238](https://github.com/streamlit/streamlit/issues/7238) - st.selectbox and st.multiselect strict matching to user input
- [#6160](https://github.com/streamlit/streamlit/issues/6160) - Add parameter to enable/disable text search in st.selectbox

## Proposal

### API Design

Add a new `filter_mode` parameter to `st.selectbox` and `st.multiselect`:

```python
st.selectbox(
    label,
    options,
    ...,
    filter_mode: Literal["fuzzy", "contains", "prefix"] | None = "fuzzy",
)

st.multiselect(
    label,
    options,
    ...,
    filter_mode: Literal["fuzzy", "contains", "prefix"] | None = "fuzzy",
)
```

### Parameter: `filter_mode`

- **Type:** `Literal["fuzzy", "contains", "prefix"] | None`
- **Default:** `"fuzzy"` (current behavior)
- **Values:**

| Value | Behavior | Use Case |
|-------|----------|----------|
| `"fuzzy"` | Fuzzy matching (current behavior). Matches characters as an in-order subsequence (they can be non-contiguous, but order is preserved). Results sorted by match score. | General text search, country/city names |
| `"contains"` | Case-insensitive substring match. Option must contain the typed text as a contiguous substring. | Simple text filtering |
| `"prefix"` | Case-insensitive prefix match. Option must start with the typed text. | Autocomplete-style UX, alphabetically organized lists |
| `None` | Disable filtering entirely. Typing has no effect. | Short lists (Yes/No), preventing accidental input |

### Examples

**Example 1: Prefix matching for autocomplete**

```python
import streamlit as st

# Countries sorted alphabetically
countries = ["Argentina", "Armenia", "Australia", "Austria", ...]
selected = st.selectbox(
    "Select Country",
    countries,
    filter_mode="prefix",
)
# Typing "Aus" shows "Australia" and "Austria", not "Belarus"
```

**Example 2: Disable filtering for short lists**

```python
import streamlit as st

# Simple Yes/No doesn't need filtering
answer = st.selectbox(
    "Do you agree?",
    ["Yes", "No"],
    filter_mode=None,
)
# No keyboard input accepted, prevents accidental filtering
```

**Example 3: Contains matching**

```python
import streamlit as st

# Search anywhere in the string
emails = ["alice@example.com", "bob@company.com", "carol@example.com"]
selected = st.selectbox(
    "Select email",
    emails,
    filter_mode="contains",
)
# Typing "example" shows all @example.com addresses
```

### Behavior Details

**Matching behavior by mode:**

| Input | Option | fuzzy | contains | prefix |
|-------|--------|-------|----------|--------|
| "abc" | "abc" | Yes | Yes | Yes |
| "abc" | "ABC" | Yes | Yes | Yes |
| "abc" | "abcdef" | Yes | Yes | Yes |
| "abc" | "xabcx" | Yes | Yes | No |
| "abc" | "aXbXc" | Yes | No | No |
| "ABC" | "abc" | Yes | Yes | Yes |

**Sorting:** For `"fuzzy"` mode, results are sorted by match score (best match first). For other modes, results maintain their original order from the `options` list.

**Empty input:** All modes show all options when the input is empty.

**`filter_mode=None`:**
- Input field is read-only (user cannot type)
- On mobile, keyboard does not appear
- Arrow keys still work for navigation
- Dropdown opens on click/focus

### Interaction with `accept_new_options`

When `accept_new_options=True`:
- `filter_mode` still controls how existing options are filtered
- User-entered text that is not an exact string match for any existing option label can still be submitted as a new value, even if it appears among filtered results
- `filter_mode=None` is incompatible with `accept_new_options=True` (raises `StreamlitAPIException`)

## Alternatives Considered

### Alternative Parameter Names

| Name | Pros | Cons |
|------|------|------|
| `filter_mode` (selected) | Clear purpose, matches `selection_mode` pattern | - |
| `search_mode` | Intuitive | Implies search feature, not filtering |
| `match_mode` | Clear | Less common terminology |
| `filter` | Concise | Too generic, could be confused with callable |
| `search` | Concise | Same as `search_mode` |

**Selected: `filter_mode`** — Clear, descriptive, matches existing Streamlit patterns (`selection_mode` in dataframes).

### Alternative: Case Sensitivity as Separate Parameter

```python
st.selectbox(..., filter_mode="contains", case_sensitive=True)
```

**Pros:** More flexible, composable

**Cons:**
- Adds complexity with two parameters to understand
- `filter_mode=None` + `case_sensitive=True` is meaningless
- Fuzzy matching case sensitivity is implementation-dependent

**Decision:** Leave case sensitivity for future work. All modes are case-insensitive for now. A case-sensitive prefix mode (`"exact"`) could be added later if there's user demand for ID/code workflows.

### Alternative: Callable Filter Function

```python
st.selectbox(..., filter=lambda option, query: query.lower() in option.lower())
```

**Pros:** Maximum flexibility

**Cons:**
- Runs on frontend, would require sending Python function to browser (not feasible)
- Complex for simple use cases
- Security concerns with arbitrary code

**Decision:** Not feasible for frontend filtering. Could be a future enhancement for server-side filtering with large option sets.

## Out of Scope (Future Work)

- **`"exact"` filter mode (case-sensitive prefix):** Could be added later for ID/code workflows where case matters
- **Custom filter function:** Would require server-side filtering architecture
- **Highlight matched text:** Visual enhancement that could be added independently
- **Min characters before filtering:** Could be added as `filter_min_chars` parameter later
- **Server-side filtering for large datasets:** Different architectural approach needed

## Checklist

| Item                         | ✅ or comment          |
|------------------------------|------------------------|
| Works on SiS, Cloud, etc?    | ✅ filtering is frontend-only |
| No breaking API changes      | ✅ new optional parameter with backward-compatible default |
| No new dependencies          | ✅ uses existing filtering infrastructure |
| Metrics collected            | ✅ track `filter_mode` usage |
| Any security/legal impact?   | No impact |
| Any docs changes needed?     | ✅ document new parameter and modes |
