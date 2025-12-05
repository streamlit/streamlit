---
Author(s): @sfc-gh-lwilby
Status: Draft
---

# st.Tab class for stable tab identity

## Summary

Introduce `st.Tab` as a class to configure individual tabs with stable keys, enabling dynamic tab labels (badges, counts, status indicators) without losing the user's tab selection. This follows the pattern established by `st.Page` and addresses the most common complaint about `st.tabs` behavior.

## Problem

### Current Behavior

`st.tabs` uses **name-based matching** to preserve tab selection across reruns. When the number or names of tabs change, the frontend tries to find the previously selected tab by its label:

```python
tab1, tab2 = st.tabs(["Home", "Settings"])
# User selects "Settings" tab
# On rerun, frontend searches for "Settings" in the new tab labels
```

### The Problem

This breaks when users update tab labels dynamically—a common use case:

```python
# User wants to show a badge/count in the tab label
tabs = st.tabs([f"Inbox ({unread_count})", "Sent", "Drafts"])
# When unread_count changes: "Inbox (5)" → "Inbox (6)"
# Frontend can't find "Inbox (5)", selection resets to first tab!
```

### User Impact

- **[#12342](https://github.com/streamlit/streamlit/issues/12342)** (1 👍): "Add support for dynamic tab badges or persistent tab keys"
- **[#7435](https://github.com/streamlit/streamlit/issues/7435)** (closed → #8239): "Changing name to a tab after a rerun, switch to the first tab" — User wanted checkmarks to indicate completion
- **[#8239](https://github.com/streamlit/streamlit/issues/8239)** (83 👍): Meta-issue for improving st.tabs frontend state handling

The current behavior was introduced in [PR #7287](https://github.com/streamlit/streamlit/pull/7287) to fix "invisible tabs" ([#5454](https://github.com/streamlit/streamlit/issues/5454)) when tabs are added/removed conditionally. However, it broke the dynamic labels use case, and jrieke acknowledged this trade-off:

> "When the number or names of the tabs change, we're now looking for the name of the active tab in the list of new tabs... **This has the advantage that you can insert tabs and still keep the current tab active. But it comes at the cost of tabs switching when you simply rename them.**"

### Root Cause

The fundamental issue is that **tab identity is conflated with tab display text**. Users need a way to provide a stable identifier separate from the visible label.

## Scope & Limitations

### What This Spec Addresses

This spec introduces **stable tab identity** via the `key` parameter. It solves:

- ✅ Tab selection lost when labels change (badges, counts, completion markers)
- ✅ Tab selection lost when tabs are reordered
- ✅ Providing stable identifiers decoupled from display text

### What This Spec Does NOT Address

Tab state remains **frontend-only**. Users will still lose their tab selection in these scenarios:

| Scenario                   | Selection Lost? | Why                       |
| -------------------------- | --------------- | ------------------------- |
| Page refresh (F5)          | ✅ Yes          | Frontend state resets     |
| New browser tab/window     | ✅ Yes          | No shared state           |
| Component remount          | ✅ Yes          | React component recreated |
| Elements added before tabs | ✅ Yes          | Can cause remount         |
| App deployment restart     | ✅ Yes          | Fresh frontend            |

### Complementary Work: Full State Tracking

The broader solution for **backend state tracking and lazy execution** is being addressed in [STEP #3: Dynamic tabs/expander/popover](https://github.com/streamlit/streamlit-enhancement-proposals/pull/3). That proposal introduces:

- `on_change="rerun"` parameter to trigger reruns on tab change
- Exposing tab state via `tab.open` attribute or session state
- Lazy execution (only run content of active tab)

The `st.Tab(key=...)` pattern from this spec will be **complementary** to STEP #3—stable keys ensure consistent identity when sending state to the backend.

## Proposal

### API Design

Introduce `st.Tab` as a class (following the `st.Page` pattern from [#12953](https://github.com/streamlit/streamlit/issues/12953)):

```python
# New: st.Tab class for explicit configuration
tab1, tab2, tab3 = st.tabs([
    st.Tab("Inbox (5)", key="inbox"),      # key provides stable identity
    st.Tab("Sent", key="sent"),
    st.Tab("Drafts", key="drafts"),
])

# Backwards compatible: list of strings still works
tab1, tab2 = st.tabs(["Home", "Settings"])  # Uses label as implicit key
```

### st.Tab Parameters

| Parameter | Type          | Default    | Description                                                                                                     |
| --------- | ------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| `label`   | `str`         | (required) | Display text for the tab. Supports GitHub-flavored Markdown. Can change without affecting selection.            |
| `key`     | `str \| None` | `None`     | Stable identifier. If `None`, uses `label` as key. Must be unique within a `st.tabs` call. Exposed as property. |

### Updated st.tabs Signature

```python
def tabs(
    tabs: Sequence[str | Tab],
    *,
    width: WidthWithoutContent = "stretch",
    default: str | Tab | None = None,
) -> Sequence[DeltaGenerator]:
```

| Parameter | Type                   | Default    | Description                                                                                                                          |
| --------- | ---------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `tabs`    | `Sequence[str \| Tab]` | (required) | The tabs to display. Each item can be a string (used as both label and key) or an `st.Tab` object (provides explicit label and key). |
| `default` | `str \| Tab \| None`   | `None`     | The default tab to select. Can be a label string or an `st.Tab` object. If `None`, the first tab is selected.                        |

### Behavior

#### Key-Based Matching (New)

When tabs have explicit keys (via `st.Tab`), the frontend uses **key-based matching**:

```python
# Initial render
tabs = st.tabs([
    st.Tab("Todo (3)", key="todo"),
    st.Tab("Done", key="done"),
])
# User selects "Done" → activeTabKey = "done"

# After rerun with label change
tabs = st.tabs([
    st.Tab("Todo (2)", key="todo"),  # Label changed
    st.Tab("Done ✓", key="done"),    # Label changed
])
# Frontend finds key="done" → selection preserved!
```

#### Fallback to Name-Based (Backwards Compatible)

When tabs are provided as strings (no explicit keys), the current name-based matching is preserved:

```python
# Current behavior unchanged
tabs = st.tabs(["Home", "Settings"])
# Uses labels as implicit keys
```

#### Mixed Usage

Tabs can mix strings and `st.Tab` objects:

```python
tab1, tab2, tab3 = st.tabs([
    "Static Tab",                           # Key = "Static Tab"
    st.Tab("Dynamic (5)", key="dynamic"),   # Key = "dynamic"
    "Another Static",                       # Key = "Another Static"
])
```

### Examples

#### Dynamic Badges/Counts

```python
import streamlit as st

# Counts from session state
inbox_count = st.session_state.get("inbox", 5)
sent_count = st.session_state.get("sent", 12)

tab1, tab2 = st.tabs([
    st.Tab(f"📥 Inbox ({inbox_count})", key="inbox"),
    st.Tab(f"📤 Sent ({sent_count})", key="sent"),
])

with tab1:
    st.write("Inbox content")
    if st.button("Mark all read"):
        st.session_state.inbox = 0
        st.rerun()  # Stays on inbox tab!

with tab2:
    st.write("Sent content")
```

#### Completion Indicators

```python
import streamlit as st

steps = ["Details", "Payment", "Confirm"]
completed = st.session_state.get("completed", set())

tab_configs = []
for step in steps:
    label = f"{step} ✓" if step in completed else step
    tab_configs.append(st.Tab(label, key=step.lower()))

tabs = st.tabs(tab_configs)

for i, tab in enumerate(tabs):
    with tab:
        st.write(f"Step {i+1}: {steps[i]}")
        if st.button("Complete", key=f"complete_{i}"):
            completed.add(steps[i])
            st.session_state.completed = completed
            st.rerun()  # Tab selection preserved!
```

### Edge Cases

| Scenario                         | Behavior                                             |
| -------------------------------- | ---------------------------------------------------- |
| Duplicate keys                   | Raise `StreamlitAPIException`                        |
| Key not found (tab removed)      | Fall back to index bounds check, clamp to last valid |
| Mix of strings and `st.Tab`      | Both work, strings use label as key                  |
| Empty key string                 | Use label as key (same as `key=None`)                |
| `default` references removed tab | Fall back to first tab                               |

### Consistency with st.Page

This design follows the pattern used by `st.Page`:

| Aspect                         | st.Page                          | st.Tab (proposed)     |
| ------------------------------ | -------------------------------- | --------------------- |
| Factory function returns class | `st.Page(...)` → `StreamlitPage` | `st.Tab(...)` → `Tab` |
| Stable identifier              | `url_path`                       | `key`                 |
| Display text                   | `title`                          | `label`               |
| Used in container              | `st.navigation([...])`           | `st.tabs([...])`      |

> **Note:** [#12953](https://github.com/streamlit/streamlit/issues/12953) proposes changes to `st.Page`'s class design. The `st.Tab` implementation should align with whatever pattern is finalized for `st.Page` to ensure consistency across the API.

### Future Extensions

The `st.Tab` class pattern can be extended for future features:

```python
# Potential future parameters
st.Tab(
    "Settings",
    key="settings",
    icon=":material/settings:",  # Icon next to label
    badge=5,                     # Badge count
    disabled=False,              # Disable tab
    tooltip="App settings",      # Hover tooltip
)
```

## Checklist

- [x] Will this work on all deployment platforms (e.g. Streamlit Community Cloud, Streamlit in Snowflake, Hugging Face Spaces)?
  - Yes, no platform-specific features used.
- [x] No breaking API changes?
  - Yes, fully backwards compatible. Existing `st.tabs(["A", "B"])` works unchanged.
- [x] No new dependencies?
  - Yes, no new dependencies.
- [x] Metrics collected?
  - Yes, `@gather_metrics("Tab")` on the `st.Tab` function.
- [x] Any security or legal implications?
  - No.
- [x] Anything to keep in mind for docs?
  - Update `st.tabs` docs to show `st.Tab` usage.
  - Add migration guide for users experiencing tab selection issues.
- [x] Any other risks?
  - Users relying on name-based matching for tab reordering may see different behavior, but this is an edge case and the new behavior is more predictable.

## Related Issues & Proposals

### Streamlit Enhancement Proposals (STEPs)

- [STEP #3: Dynamic tabs/expander/popover](https://github.com/streamlit/streamlit-enhancement-proposals/pull/3) - Full state tracking with `on_change` and lazy execution (complementary to this spec)

### GitHub Issues

- [#12342](https://github.com/streamlit/streamlit/issues/12342) - Dynamic tab badges or persistent tab keys
- [#8239](https://github.com/streamlit/streamlit/issues/8239) - Improve handling of frontend state/mount (83 👍)
- [#6004](https://github.com/streamlit/streamlit/issues/6004) - st.tabs: know and control state (238 👍)
- [#7435](https://github.com/streamlit/streamlit/issues/7435) - Changing tab name switches to first tab
- [#5454](https://github.com/streamlit/streamlit/issues/5454) - Invisible tabs (fixed by PR #7287)
- [#12953](https://github.com/streamlit/streamlit/issues/12953) - Turn st.Page into a proper class (related pattern)
