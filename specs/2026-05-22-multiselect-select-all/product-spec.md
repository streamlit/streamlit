---
author: lukasmasuch
created: 2026-05-22
---

# Multiselect `select_all` Parameter

## Summary

Add a `select_all` parameter to `st.multiselect` that allows users to control the "Select all" and "Select X matches" dropdown options. The parameter accepts `True` (always show), `False` (never show), or an integer threshold (show only when the number of selectable options is at or below the threshold).

## Problem

### Current Behavior

`st.multiselect` automatically shows a "Select all" option at the top of the dropdown when there are multiple selectable options. When the user is typing a search query, this becomes "Select X matches" to select all filtered results.

This feature was added in PR [#13015](https://github.com/streamlit/streamlit/pull/13015) and is always enabled with no way to disable or limit it.

### User Pain Points

1. **Performance Issues with Large Option Sets:** Clicking "Select all" with very large option lists (100k+ items) causes the browser to freeze. The widget must serialize all selected values, re-render tags for each selection, and send the data to the backend—all of which become prohibitively expensive at scale.

   ```python
   # Clicking "Select all" freezes the browser
   items = [f"Item_{i}" for i in range(165000)]
   st.multiselect("Select items", items)
   ```

2. **Cluttered UI with Many Selections:** For use cases like plotting, selecting 1000+ options creates unusable visualizations with cluttered charts and excessive rendering time.

3. **Confusing Interaction with `max_selections`:** When `max_selections` is set, clicking "Select all" only selects up to the limit. Users see "Select all" but not all options get selected, which is confusing.

4. **Unnecessary Feature for Some Workflows:** Some apps intentionally require users to make deliberate individual selections. The "Select all" shortcut undermines this design intent.

### User Requests

**Primary GitHub Issues:**

- [#14918](https://github.com/streamlit/streamlit/issues/14918) — Option to enable/disable the select all option on `st.multiselect`
- [#15299](https://github.com/streamlit/streamlit/issues/15299) — Multi Select "Select all" performance bottleneck on large datasets

**User Workarounds:**

Users currently resort to hacky workarounds like detecting "Select all" and forcing a clear:

```python
selected = st.multiselect(label, options=options, key=key)

# Workaround: treat "Select all" as "Clear all"
if len(options) > 1 and len(selected) == len(options):
    del st.session_state[key]
    st.rerun()
```

### Scope Clarification

The GitHub issue title (#14918) mentions both `st.multiselect` and `st.selectbox`, but `st.selectbox` is a single-select widget that does not have a "Select all" feature. This spec applies only to `st.multiselect`.

## Proposal

### API Design

Add a new `select_all` parameter to `st.multiselect`:

```python
st.multiselect(
    label,
    options,
    ...,
    select_all: bool | int = 1000,
)
```

> **Implementation note:** In Python, `bool` is a subclass of `int` (`True == 1`, `False == 0`). Implementations must check `isinstance(value, bool)` before `isinstance(value, int)` to avoid treating `True` as threshold `1` and `False` as threshold `0`.

### Parameter: `select_all`

- **Type:** `bool | int`
- **Default:** `1000`
- **Values:**

| Value | Behavior |
|-------|----------|
| `True` | Always show "Select all" (subject to the 2+ selectable options minimum) |
| `False` | Never show "Select all" |
| `0` | Never show "Select all" (same as `False`) |
| Integer > 0 | Show "Select all" only when there are 2 or more selectable options AND the count is at or below the threshold |

> **Note:** The 2+ selectable options requirement is an underlying constraint that applies to all modes, including `select_all=True`. A "Select all" option with only one selectable item provides no value over simply clicking that item.

The term "selectable options" refers to the options currently available for selection in the dropdown. For "Select all" (no search query), this is the total number of options minus already-selected options. For "Select X matches" (with search query), this is the number of filtered matches minus already-selected options.

### Examples

**Example 1: Disable "Select all" entirely**

```python
import streamlit as st

# Prevent users from bulk-selecting all options
options = [f"Series {i}" for i in range(1000)]
selected = st.multiselect(
    "Select series to plot",
    options,
    select_all=False,
)
```

**Example 2: Use a custom threshold**

```python
import streamlit as st

# Show "Select all" only for small datasets
items = get_items_from_database()  # Could be 10 or 10,000 items
selected = st.multiselect(
    "Select items",
    items,
    select_all=50,  # Only show for 50 or fewer options
)
```

**Example 3: Always enable "Select all"**

```python
import streamlit as st

# Override the default threshold to always show
options = ["Red", "Green", "Blue", "Yellow", "Orange", "Purple"]
selected = st.multiselect(
    "Pick colors",
    options,
    select_all=True,  # Always show, even with default
)
```

### Behavior Details

**Threshold evaluation:**

The threshold is evaluated dynamically against the number of currently selectable options:

- When no search query: threshold compared against `len(options) - len(selected)`
- When search query is active: threshold compared against `len(filtered_matches) - len(selected_in_filtered)`, where `selected_in_filtered` is the count of already-selected options that appear in the filtered results

This means "Select all" may appear or disappear as the user selects/deselects options or types a search query. Note: This dynamic behavior is intentional—it ensures users don't accidentally bulk-select large result sets when filtering narrows the view.

**Interaction with "Select X matches":**

Both "Select all" and "Select X matches" are controlled by the same parameter. When `select_all=False`, neither option appears. When `select_all=100`, "Select X matches" only appears when the filtered match count is at or below 100.

**Interaction with `max_selections`:**

The `select_all` threshold is evaluated against the number of unselected options, independent of `max_selections`. If `max_selections=5` and `select_all=True`, "Select all" still appears but only selects up to 5 options. The existing behavior where `max_selections` limits how many get selected remains unchanged.

For threshold evaluation purposes, "selectable options" means options that are currently unselected, regardless of whether `max_selections` would prevent selecting all of them. This keeps the threshold calculation simple and predictable.

When `max_selections` is already reached (i.e., `len(selected) >= max_selections`), "Select all" is hidden since no additional selections can be made.

**Edge cases:**

| Scenario | Behavior |
|----------|----------|
| `select_all=0` | Same as `select_all=False` |
| `select_all < 0` (any negative integer) | Raises `StreamlitAPIException` |
| Single option remaining | "Select all" never shown (requires 2+ selectable options, even with `select_all=True`) |
| All options selected | "Select all" not shown (no selectable options) |
| `max_selections` reached | "Select all" not shown (no additional selections can be made) |

### Default Value Rationale

The default of `1000` was chosen because:

1. **Performance safety:** Prevents browser freezes for very large option sets while still allowing the feature for typical use cases
2. **Reasonable UX:** Users rarely need to select more than 1000 items at once; beyond that, server-side filtering or pagination is usually more appropriate
3. **Compatibility for typical use cases:** Most `st.multiselect` uses have fewer than 1000 options, so existing apps won't notice a change

> **Note:** Apps with more than 1000 options will no longer show "Select all" by default after this change. Set `select_all=True` to restore the previous behavior.

## Alternatives Considered

### Alternative 1: Boolean-only parameter

```python
st.multiselect(..., select_all=True)  # Default True
```

**Pros:** Simpler API

**Cons:**
- Doesn't address performance issue by default (users must explicitly disable)
- No middle ground for "enable for small lists only"

### Alternative 2: Different default (e.g., `True` or a higher threshold)

**Decision:** A threshold default better addresses both use cases—users who want "Select all" for small lists get it automatically, while users with large datasets are protected from performance issues.

### Alternative 3: Separate parameter names

| Name | Pros | Cons |
|------|------|------|
| `select_all` (chosen) | Clear, matches feature name | - |
| `show_select_all` | More explicit about visibility | Verbose |
| `select_all_threshold` | Clear about threshold behavior | Doesn't work well with `False` |
| `bulk_select` | Avoids "all" confusion | Less intuitive |

**Selected: `select_all`** — Directly names the feature being controlled.

### Alternative 4: Automatic threshold based on client performance

The frontend could measure device capabilities and auto-adjust the threshold.

**Decision:** Too complex and unpredictable. An explicit parameter gives developers control.

## Out of Scope (Future Work)

- **Custom "Select all" label:** Users might want to customize "Select all" to "Add all to cart" etc.
- **"Select none" / "Clear all" option:** A separate dropdown option to deselect everything
- **Confirmation dialog for large selections:** Warn users before selecting many options
- **Server-side selection for very large datasets:** Would require architectural changes to stream selections

## Checklist

| Item                         | ✅ or comment |
|------------------------------|---------------|
| Works on SiS, Cloud, etc?    | Yes, full-stack change (Python + proto + frontend) |
| No breaking API changes      | Yes, new optional parameter with sensible default |
| No new dependencies          | Yes |
| Metrics collected            | Track `select_all` parameter usage |
| Any security/legal impact?   | No impact |
| Any docs changes needed?     | Yes, document new parameter |
