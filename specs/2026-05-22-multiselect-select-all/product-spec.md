---
author: lukasmasuch
created: 2026-05-22
---

# Multiselect `select_all` Parameter

## Summary

Add a `select_all` parameter to `st.multiselect` that allows users to control the "Select all" and "Select X matches" dropdown options. The parameter accepts `True` (always show), `False` (never show), or an integer threshold (show only when the number of selectable options is at or below the threshold).

## Problem

### Current Behavior

`st.multiselect` shows a "Select all" option at the top of the dropdown when there are 2 or more selectable (unselected) options. When the user is typing a search query, this becomes "Select X matches" to select all filtered results.

This feature was added in PR [#13015](https://github.com/streamlit/streamlit/pull/13015). PR [#15301](https://github.com/streamlit/streamlit/pull/15301) later hid both bulk actions when the widget has 1000 or more **total** options, to prevent browser freezes. That gate is a hardcoded frontend constant (`SELECT_ALL_THRESHOLD = 1000` in `useMultiselectFiltering.ts`). There is still no public API to disable "Select all" for smaller lists, enable it for larger lists, or choose a different threshold.

The 1000-option gate is static: it uses `len(options)`, not the number of currently selectable or filtered options. Filtering a 1000+ option widget down to a handful of matches still does not show "Select X matches".

The widget was later migrated from BaseWeb to React Aria Components (PR [#16175](https://github.com/streamlit/streamlit/pull/16175)). "Select all" / "Select X matches" remain custom bulk-action rows at the top of the dropdown with the same visibility rules, labels, 2+ selectable minimum, and `max_selections` behavior. The migration did not change the product behavior this spec covers.

### User Pain Points

1. **No way to disable "Select all" for typical lists:** Apps with fewer than 1000 options still always show "Select all". Some workflows require deliberate individual selections (for example picking 2–3 clients from ~500), and the shortcut undermines that. Users still resort to workarounds (below).

2. **Search-then-Enter bulk-selects instead of adding the first match:** The bulk-action row is injected as the first dropdown item whenever two or more selectable options are visible. Typing a query and pressing Enter therefore activates "Select X matches" rather than adding the first match. A single-match search already behaves as users expect, because the 2+ selectable minimum hides the bulk action.

3. **No way to enable "Select all" for large lists:** Apps with 1000+ options cannot opt back in, even when bulk-select is intentional and the list is not large enough to freeze the browser.

4. **Cluttered UI with Many Selections:** For use cases like plotting, selecting 1000+ options creates unusable visualizations with cluttered charts and excessive rendering time.

5. **Confusing Interaction with `max_selections`:** When `max_selections` is set, clicking "Select all" only selects up to the limit. Users see "Select all" but not all options get selected, which is confusing.

The original freeze from clicking "Select all" on 100k+ options ([#15299](https://github.com/streamlit/streamlit/issues/15299)) is already mitigated by hiding the action at 1000+ total options. Selecting that many values would still be expensive (`select_all=True` would re-expose it), because the widget must serialize all selected values, re-render a tag per selection, and send the data to the backend.

### User Requests

**Primary GitHub Issues:**

- [#16537](https://github.com/streamlit/streamlit/issues/16537) — Allow disabling "Select All" / "Select N matches"; search-then-Enter currently bulk-selects instead of adding the first match (open tracking issue)
- [#14918](https://github.com/streamlit/streamlit/issues/14918) — Option to enable/disable the select all option on `st.multiselect` (closed when this spec was drafted; disabling for lists under 1000 is still unresolved)
- [#15299](https://github.com/streamlit/streamlit/issues/15299) — Multi Select "Select all" performance bottleneck on large datasets (addressed by the hardcoded 1000 threshold)

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

> **Implementation note:** Bulk-action visibility currently lives in `frontend/lib/src/hooks/useMultiselectFiltering.ts` (`SELECT_ALL_THRESHOLD`). The new parameter should replace that constant and be plumbed through the Python API and protobuf. React Aria's `ComboBox` has no built-in select-all; keep the existing custom bulk-action rows (`SELECT_ALL_ID` / `SELECT_MATCHES_ID`).

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

# Prevent bulk-select; search-then-Enter adds the first match instead of
# "Select X matches"
clients = [f"Client {i}" for i in range(500)]
selected = st.multiselect(
    "Clients",
    clients,
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

# Override the default threshold to always show, including 1000+ option lists
options = ["Red", "Green", "Blue", "Yellow", "Orange", "Purple"]
selected = st.multiselect(
    "Pick colors",
    options,
    select_all=True,
)
```

### Behavior Details

**Threshold evaluation:**

The threshold is evaluated dynamically against the number of currently selectable options:

- When no search query: threshold compared against `len(options) - len(selected)`
- When search query is active: threshold compared against `len(filtered_matches) - len(selected_in_filtered)`, where `selected_in_filtered` is the count of already-selected options that appear in the filtered results

This means "Select all" may appear or disappear as the user selects/deselects options or types a search query. Note: This dynamic behavior is intentional—it ensures users don't accidentally bulk-select large result sets when filtering narrows the view.

This is a change from today's hardcoded gate, which uses total `len(options)` only. With the proposed parameter, `select_all=1000` on a 10,000-option widget would still hide "Select all" when unfiltered, but would show "Select X matches" if a search narrows the selectable matches to 1000 or fewer. That is useful and avoids the freeze, because only the filtered subset is selected.

**Interaction with "Select X matches":**

Both "Select all" and "Select X matches" are controlled by the same parameter. When `select_all=False`, neither option appears. When `select_all=100`, "Select X matches" only appears when the filtered match count is at or below 100.

**Keyboard / Enter:**

When the bulk-action row is visible, it is the first dropdown item, so Enter activates "Select all" / "Select X matches". That is current shipped behavior and stays when the action is shown.

When the bulk action is hidden (`select_all=False`, the threshold is not met, or fewer than 2 selectable options), Enter selects the first matching option. That is the supported way to restore the search-then-Enter workflow from [#16537](https://github.com/streamlit/streamlit/issues/16537). Changing Enter to skip a *visible* bulk-action row is out of scope.

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

1. **Matches current behavior:** PR [#15301](https://github.com/streamlit/streamlit/pull/15301) already hides bulk actions at 1000+ total options. Defaulting the new parameter to `1000` keeps today's shipped behavior for unfiltered lists.
2. **Performance safety:** Prevents browser freezes for very large option sets while still allowing the feature for typical use cases
3. **Reasonable UX:** Users rarely need to select more than 1000 items at once; beyond that, server-side filtering or pagination is usually more appropriate

> **Note:** Set `select_all=True` to show "Select all" even for lists of 1000+ options. Set `select_all=False` to hide it for smaller lists. Apps that already have 1000+ options will not see a change to unfiltered "Select all" visibility.

## Alternatives Considered

### Alternative 1: Boolean-only parameter

```python
st.multiselect(..., select_all=True)  # Default True
```

**Pros:** Simpler API

**Cons:**
- Default `True` would regress the existing 1000-option performance gate
- No middle ground for "enable for small lists only"

### Alternative 2: Different default (e.g., `True` or a higher threshold)

**Decision:** A threshold default of `1000` matches the existing hardcoded gate and addresses both use cases—users who want "Select all" for small lists get it automatically, while users with large datasets are protected from performance issues.

### Alternative 3: Separate parameter names

| Name | Pros | Cons |
|------|------|------|
| `select_all` (chosen) | Clear, matches feature name | - |
| `enable_select_all` | Explicit about enabling/disabling | Verbose, less natural with threshold values |
| `show_select_all` | More explicit about visibility | Verbose |
| `allow_select_all` | Matches [#16537](https://github.com/streamlit/streamlit/issues/16537) | Boolean-only feel; awkward with integer thresholds |
| `select_all_threshold` | Clear about threshold behavior | Doesn't work well with `False` |
| `bulk_select` | Avoids "all" confusion | Less intuitive |

**Selected: `select_all`** — Directly names the feature being controlled.

### Alternative 4: Automatic threshold based on client performance

The frontend could measure device capabilities and auto-adjust the threshold.

**Decision:** Too complex and unpredictable. An explicit parameter gives developers control.

## Out of Scope (Future Work)

- **Custom "Select all" label:** Users might want to customize "Select all" to "Add all to cart" etc.
- **"Select none" / "Clear all" option:** A separate dropdown option to deselect everything. The widget already has a clear-all button on the trigger; this would be a dropdown counterpart.
- **Enter skips a visible bulk-action row:** Always add the first real option on Enter even when "Select all" / "Select X matches" is shown. Overlaps with keyboard-nav requests such as [#15697](https://github.com/streamlit/streamlit/issues/15697). `select_all=False` is the supported way to get search-then-Enter-selects-first-match.
- **Confirmation dialog for large selections:** Warn users before selecting many options
- **Server-side selection for very large datasets:** Would require architectural changes to stream selections

## Checklist

| Item                         | ✅ or comment |
|------------------------------|---------------|
| Works on SiS, Cloud, etc?    | ✅ Yes, full-stack change (Python + proto + frontend) |
| No breaking API changes      | ✅ Yes, new optional parameter; default matches the existing 1000-option gate |
| No new dependencies          | ✅ Yes |
| Metrics collected            | ✅ Track `select_all` parameter usage |
| Any security/legal impact?   | ✅ No impact |
| Any docs changes needed?     | ✅ Yes, document new parameter |
