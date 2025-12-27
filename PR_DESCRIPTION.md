## Summary

Fixes #11109

This PR adds opt-in validation to detect and prevent cross-fragment session state modifications that can cause frontend/backend state desynchronization.

### The Problem

When a fragment rerun modifies `st.session_state` for a widget that belongs to a *different* fragment, the modification succeeds on the backend but the frontend UI doesn't update (since only the current fragment is re-rendered). This creates a silent desync between what the user sees and what the backend believes is the current state.

**Example of the problematic pattern:**
```python
@st.fragment
def fragment_a():
    st.number_input("Counter", key="counter")  # Widget belongs to fragment_a

@st.fragment
def fragment_b():
    if st.button("Increment"):
        st.session_state.counter += 1  # Modifies fragment_a's widget - CAUSES DESYNC!

fragment_a()
fragment_b()
```

When the button in `fragment_b` is clicked, only `fragment_b` reruns. The backend updates `counter` to the new value, but `fragment_a`'s number input doesn't re-render, so the user still sees the old value.

### The Solution

This PR adds a new config option `runner.enforceFragmentStateIsolation` (default: `false`). When enabled:

- **`__setitem__`**: Raises `StreamlitAPIException` if a fragment attempts to modify session state for a widget belonging to a different fragment
- **`__delitem__`**: Raises `StreamlitAPIException` if a fragment attempts to delete session state for a widget belonging to a different fragment

### Why Opt-In (Default: False)?

Making this opt-in is **critical for backward compatibility**. Many existing Streamlit apps legitimately share state between fragments:

```python
# Common pattern that would break if we raised errors by default
@st.fragment
def increment_button():
    if st.button("Add 1"):
        st.session_state.counter += 1  # Modifying shared state

st.number_input("Counter", key="counter")
increment_button()
```

By making this opt-in, developers can:
1. Enable it for new projects to catch potential bugs early
2. Gradually migrate existing apps
3. Choose their own tradeoff between strictness and flexibility

This follows the same pattern as the existing `runner.enforceSerializableSessionState` option.

---

## Files Changed

### 1. `lib/streamlit/config.py`
Added new config option:
```python
_create_option(
    "runner.enforceFragmentStateIsolation",
    description="""
        Raise an exception when a fragment attempts to modify session state
        for widgets that belong to a different fragment.
        ...
    """,
    default_val=False,
    type_=bool,
)
```

### 2. `lib/streamlit/runtime/state/session_state.py`

**`__setitem__` method** - Added validation after existing widget/form checks:
- Gets the widget_id for the key being modified
- Looks up the widget's metadata to find its `fragment_id`
- If the widget belongs to a different fragment than the one currently running, raises `StreamlitAPIException`

**`__delitem__` method** - Added same validation logic for deletions

### 3. `lib/tests/streamlit/runtime/state/session_state_test.py`

Added 7 comprehensive test cases covering all edge cases.

---

## Test Cases Added

1. **`test_setitem_disallows_cross_fragment_modification_when_enforced`**
   - Modify widget from different fragment with config ON
   - Expected: Raises `StreamlitAPIException`

2. **`test_setitem_allows_cross_fragment_modification_when_not_enforced`**
   - Modify widget from different fragment with config OFF
   - Expected: Succeeds (backward compat)

3. **`test_setitem_allows_same_fragment_modification`**
   - Modify widget from same fragment with config ON
   - Expected: Succeeds

4. **`test_setitem_allows_modification_of_pre_fragment_widget`**
   - Modify widget with `fragment_id=None`
   - Expected: Succeeds (pre-fragment widgets are always modifiable)

5. **`test_setitem_allows_modification_during_full_app_run`**
   - Modify any widget during full app run
   - Expected: Succeeds (`fragment_ids_this_run=None` means full run)

6. **`test_delitem_disallows_cross_fragment_deletion_when_enforced`**
   - Delete widget from different fragment with config ON
   - Expected: Raises `StreamlitAPIException`

7. **`test_delitem_allows_cross_fragment_deletion_when_not_enforced`**
   - Delete widget from different fragment with config OFF
   - Expected: Succeeds (backward compat)

---

## Edge Cases Handled

1. **Nested fragments** - Checks if widget's `fragment_id` is in `ctx.fragment_ids_this_run` (list of all fragments in current rerun)

2. **Pre-fragment widgets** - Widgets with `fragment_id=None` (created before any fragment) are always modifiable

3. **Full app run** - When `fragment_ids_this_run=None`, validation is skipped entirely

4. **Non-widget keys** - Only validated when `widget_id` is not None (regular session state keys are unaffected)

5. **Missing metadata** - If widget metadata doesn't exist, validation is skipped

---

## How to Test

1. Enable the config option:
```toml
# .streamlit/config.toml
[runner]
enforceFragmentStateIsolation = true
```

2. Run this test app:
```python
import streamlit as st

@st.fragment
def fragment_a():
    st.number_input("Counter", key="counter", value=0)

@st.fragment
def fragment_b():
    if st.button("Try to modify counter"):
        st.session_state.counter += 1  # Should raise error

fragment_a()
fragment_b()
```

3. Click the button - you should see a `StreamlitAPIException` explaining that cross-fragment modification is not allowed.

---

## Future Considerations

In a future major version, the default could be flipped to `true` to enforce fragment isolation by default, with the option to opt-out for apps that need cross-fragment state sharing.
