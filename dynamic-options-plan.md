# Dynamic Options Support for Selection Widgets

## Executive Summary

This document outlines a plan to enable dynamic updates to options lists in selection widgets (`st.selectbox`, `st.multiselect`, `st.radio`, `st.segmented_control`, `st.pills`, `st.select_slider`) without causing unexpected state resets or side-effects.

### Key Insight

The fix is **backend-only**. By removing `options` from the element ID computation when a user-provided `key` is present, the element ID becomes stable. Since the frontend uses the element ID as the React component key, this automatically prevents component remounts and state loss. No frontend changes are required.

### Related Issues
- [#4854](https://github.com/streamlit/streamlit/issues/4854): Selection flips back to previous selection on click
- [#6352](https://github.com/streamlit/streamlit/issues/6352): Selectbox resets selection on visible name change
- [#7855](https://github.com/streamlit/streamlit/issues/7855): Multiselect reset in forms
- [#8496](https://github.com/streamlit/streamlit/issues/8496): Dynamic options issues
- [#12392](https://github.com/streamlit/streamlit/issues/12392): Related dynamic option issues

---

## Current Architecture Analysis

### Widget Identity System

Streamlit computes a unique **element ID** for each widget using `compute_and_register_element_id()` in `lib/streamlit/elements/lib/utils.py`. The ID is a hash of:

1. Element type (e.g., "selectbox")
2. User-provided key (if any)
3. Various parameters depending on `key_as_main_identity` setting
4. Active script hash (for multi-page apps)
5. Form ID and container context (when key is not main identity)

### Current `key_as_main_identity` Settings

| Widget | `key_as_main_identity` Value |
|--------|------------------------------|
| `selectbox` | `{"options", "accept_new_options"}` |
| `multiselect` | `{"options", "max_selections", "accept_new_options", "format_func"}` |
| `radio` | `{"options"}` |
| `pills` | `{"options", "click_mode"}` |
| `segmented_control` | `{"options", "click_mode"}` |
| `select_slider` | `{"options", "format_func"}` |

When a user provides a `key`, only the whitelisted parameters (in the set) are included in the element ID computation. This means:

- **With key:** Element ID = hash(type, key, active_script, options, ...)
- **Without key:** Element ID = hash(type, label, all_params, ...)

### The Core Problem

When `options` are included in the element ID computation (even with `key_as_main_identity`), **any change to options creates a new element ID**, which:

1. **Breaks widget identity**: The frontend sees a "new" widget
2. **Loses state**: Previous selection is not transferred to the new widget
3. **Causes UI flicker**: Widget briefly shows old value, then resets
4. **Triggers unexpected reruns**: Selection reset triggers `on_change` callbacks

### Data Flow for Selection Widgets

**Current behavior (problematic):**
```
┌─────────────────────────────────────────────────────────────────────┐
│                          BACKEND (Python)                            │
├─────────────────────────────────────────────────────────────────────┤
│  1. User calls st.selectbox(label, options, key="my_key")           │
│  2. compute_and_register_element_id() includes options in hash      │
│     → element_id = hash(type, key, OPTIONS, ...)                    │
│  3. Options change → element_id changes                              │
│  4. New element_id not found in session_state → reset to default    │
└─────────────────────────────────────────────────────────────────────┘
                        ↓ WebSocket
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                             │
├─────────────────────────────────────────────────────────────────────┤
│  5. element.id changed → React key changed → component remounts     │
│  6. Component initializes with new default value → state lost!      │
└─────────────────────────────────────────────────────────────────────┘
```

**Proposed behavior (fixed):**
```
┌─────────────────────────────────────────────────────────────────────┐
│                          BACKEND (Python)                            │
├─────────────────────────────────────────────────────────────────────┤
│  1. User calls st.selectbox(label, options, key="my_key")           │
│  2. compute_and_register_element_id() excludes options from hash    │
│     → element_id = hash(type, key, ...) [stable!]                   │
│  3. Options change → element_id stays the same                       │
│  4. Retrieve existing value from session_state by key               │
│  5. Validate value against new options, update if invalid           │
└─────────────────────────────────────────────────────────────────────┘
                        ↓ WebSocket
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                             │
├─────────────────────────────────────────────────────────────────────┤
│  6. element.id unchanged → React key unchanged → no remount         │
│  7. Component receives updated options, keeps valid selection ✓     │
│  8. If backend validated/reset value, setValue=true triggers update │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Problem Scenarios

### Scenario 1: Cascading Dropdowns (Most Common)

```python
category = st.selectbox("Category", ["Electronics", "Clothing"], key="cat")

if category == "Electronics":
    subcategory = st.selectbox("Subcategory", ["Phones", "Laptops"], key="sub")
else:
    subcategory = st.selectbox("Subcategory", ["Shirts", "Pants"], key="sub")
```

**Current behavior:** When user switches category, the subcategory widget gets a new element ID because options changed, causing selection reset.

**Expected behavior:** Widget identity should remain stable; selection should reset only because the old value is no longer valid.

### Scenario 2: Filtered Options

```python
search = st.text_input("Search")
all_items = ["Apple", "Banana", "Cherry", "Date"]
filtered = [i for i in all_items if search.lower() in i.lower()]
selected = st.selectbox("Select item", filtered, key="item")
```

**Current behavior:** Each keystroke in search creates new options list → new element ID → selection lost.

**Expected behavior:** If the previously selected item is still in the filtered list, it should remain selected.

### Scenario 3: Format Function Changes

```python
# User toggles between showing full name vs abbreviation
show_full = st.checkbox("Show full names")
options = ["NY", "CA", "TX"]

if show_full:
    selected = st.selectbox("State", options,
                            format_func=lambda x: {"NY": "New York", "CA": "California", "TX": "Texas"}[x],
                            key="state")
else:
    selected = st.selectbox("State", options, key="state")
```

**Current behavior:** Changing format_func can change element ID (for multiselect/select_slider).

**Expected behavior:** Selection should be preserved since the underlying options haven't changed.

### Scenario 4: Options Order Changes

```python
# User can sort options
sort_order = st.radio("Sort by", ["Name", "Price"])
products = get_products()  # Returns list of product names
sorted_products = sorted(products) if sort_order == "Name" else sorted(products, key=get_price)
selected = st.selectbox("Product", sorted_products, key="product")
```

**Current behavior:** Reordering options changes the options list → new element ID → selection lost.

**Expected behavior:** Selection should be preserved since the selected item is still in the list.

---

## Proposed Solution

### Design Principles

1. **Widget identity should be stable when key is provided** - The element ID should not change when only cosmetic properties (options list, format_func) change.

2. **Value validation should be separate from identity** - The widget should validate its current value against the new options and handle mismatches gracefully.

3. **Backward compatibility** - Existing apps should continue to work without changes.

4. **Predictable behavior** - Users should understand when and why selections reset.

### Solution Components

#### Component 1: Remove Options from Identity Computation (Backend)

**Change:** When a user-provided `key` is present, exclude `options` (and related parameters) from the element ID computation entirely.

**Modified `key_as_main_identity` values:**

| Widget | Current | Proposed |
|--------|---------|----------|
| `selectbox` | `{"options", "accept_new_options"}` | `{"accept_new_options"}` |
| `multiselect` | `{"options", "max_selections", "accept_new_options", "format_func"}` | `{"max_selections", "accept_new_options"}` |
| `radio` | `{"options"}` | `{}` (empty set) or `True` |
| `pills` | `{"options", "click_mode"}` | `{"click_mode"}` |
| `segmented_control` | `{"options", "click_mode"}` | `{"click_mode"}` |
| `select_slider` | `{"options", "format_func"}` | `{}` (empty set) or `True` |

**Files to modify:**
- `lib/streamlit/elements/widgets/selectbox.py`
- `lib/streamlit/elements/widgets/multiselect.py`
- `lib/streamlit/elements/widgets/radio.py`
- `lib/streamlit/elements/widgets/button_group.py`
- `lib/streamlit/elements/widgets/select_slider.py`

#### Component 2: Value Validation and Reset Logic (Backend)

When the user-selected value is no longer in the new options list, we **reset to the default value** and communicate this to the frontend via `set_value=True`.

##### Validation Flow

```
User triggers rerun → options change → current value "B" no longer in options
                                              ↓
                        ┌─────────────────────────────────────────┐
                        │         VALIDATION DECISION              │
                        ├─────────────────────────────────────────┤
                        │ Is "B" in new options?                   │
                        │   YES → keep "B"                         │
                        │   NO  → Is accept_new_options=True?      │
                        │           YES → keep "B" (user-entered)  │
                        │           NO  → reset to default         │
                        └─────────────────────────────────────────┘
                                              ↓
                        ┌─────────────────────────────────────────┐
                        │         DEFAULT DETERMINATION            │
                        ├─────────────────────────────────────────┤
                        │ If index param specified → options[index]│
                        │ If index=None specified → None           │
                        │ Else → options[0] (first option)         │
                        └─────────────────────────────────────────┘
```

##### When Does Validation Happen?

**During widget command execution**, before `register_widget()` is called:

```python
def _selectbox(self, label, options, index=0, key=None, accept_new_options=False, ...):
    opt = convert_anything_to_list(options)

    # Step 1: Get current value from session_state
    session_state = get_session_state().filtered_state
    current_value = session_state.get(key) if key else None
    value_was_reset = False

    # Step 2: Validate current value against new options
    if current_value is not None and current_value not in opt:
        if accept_new_options:
            # Keep user-entered value even if not in predefined options
            pass
        else:
            # Value no longer valid → reset
            current_value = None
            value_was_reset = True

    # Step 3: Determine the actual value to use
    if current_value is None:
        if index is not None and len(opt) > 0:
            actual_value = opt[index]
        else:
            actual_value = None  # Empty selection (index=None case)
    else:
        actual_value = current_value

    # Step 4: Update session_state with validated value
    if value_was_reset and key:
        # Update session_state so subsequent accesses see the reset value
        session_state[key] = actual_value

    # Step 5: Build proto
    proto.raw_value = format_func(actual_value) if actual_value else None
    proto.set_value = value_was_reset  # Tell frontend to update its display

    # Step 6: Return the validated value
    return actual_value
```

##### Communication to Frontend

When validation resets the value, the proto includes:
- `raw_value` = the new (reset) value
- `set_value = True` = flag telling frontend to update its display

The frontend's `useBasicWidgetState` hook already watches for `set_value=True`:

```typescript
// In useBasicWidgetState.ts (existing code)
useEffect(() => {
  if (!element.setValue) return
  element.setValue = false  // Clear the flag

  // Update local state to match backend's value
  setNextValueWithSource({
    value: getCurrStateFromProto(element),
    fromUi: false,  // Not from user interaction
  })
}, [element, getCurrStateFromProto, setNextValueWithSource])
```

##### What About `on_change` Callbacks?

**Auto-validation resets should NOT trigger `on_change`** because:
1. It wasn't a user action
2. Could cause infinite loops if the callback modifies options
3. The user didn't explicitly make a choice

The reset is communicated via `set_value=True` with `fromUi=false`, which bypasses the `on_change` callback in the existing implementation.

##### Validation Rules Summary

| Widget | Scenario | Behavior |
|--------|----------|----------|
| selectbox | Value in options | Keep value |
| selectbox | Value NOT in options, `accept_new_options=True` | Keep value |
| selectbox | Value NOT in options | Reset to `options[index]` or `options[0]` |
| multiselect | Some values in options | Keep valid values, drop invalid ones |
| multiselect | No values in options | Reset to `default` or `[]` |
| radio | Value in options | Keep value (update index if position changed) |
| radio | Value NOT in options | Reset to `options[index]` or `options[0]` |
| pills/segmented | Value(s) in options | Keep value(s) |
| pills/segmented | Value(s) NOT in options | Reset to default or None/[] |
| select_slider | Value in options | Keep value |
| select_slider | Value NOT in options | Reset to `options[0]` or first in range |

##### Multiselect-Specific Logic

For multiselect, we do **partial preservation** - keep valid selections, drop invalid ones:

```python
def validate_multiselect(current_values, options, accept_new_options):
    """Keep values that are still valid, drop ones that aren't."""
    validated = []
    any_dropped = False

    for val in current_values:
        if val in options:
            validated.append(val)
        elif accept_new_options:
            validated.append(val)  # Keep user-entered values
        else:
            any_dropped = True  # This value will be dropped

    return validated, any_dropped
```

Example:
```python
# Run 1: User selects ["A", "B"]
st.multiselect("Pick", ["A", "B", "C"], key="pick")

# Run 2: Options change, "B" is gone
st.multiselect("Pick", ["A", "C", "D"], key="pick")
# Returns ["A"] - kept "A", dropped "B"
```

#### Why No Frontend Changes Are Required

Once `options` is removed from the element ID computation (Component 1), the element ID remains stable when options change. Since the element ID is used as the React component key in `ElementNodeRenderer.tsx`, **the frontend automatically maintains state** - no component remount occurs.

```
Before (options in identity):
  options change → element_id changes → React key changes → component remounts → state lost

After (options removed from identity):
  options change → element_id stays same → React key stays same → no remount → state preserved ✓
```

The frontend will simply receive updated `options` in the proto, and the existing `useBasicWidgetState` hook will continue working correctly since:
1. The widget manager state is keyed by the stable element ID
2. The backend sends `setValue=true` when it needs to update the frontend value (e.g., after validation)

#### Component 3: Proto Enhancement (Optional, Future)

Consider adding a field to the proto to communicate validation intent:

```protobuf
message Selectbox {
  // ... existing fields ...

  // NEW: Indicates the widget's value validation behavior
  enum ValueValidation {
    RESET_ON_INVALID = 0;  // Default: reset to default if value not in options
    PRESERVE_IF_VALID = 1; // Keep value if still valid in new options
    ALWAYS_PRESERVE = 2;   // Never auto-reset (for accept_new_options)
  }
  ValueValidation value_validation = 15;
}
```

---

## Implementation Plan

### Phase 1: Backend Identity Stabilization & Value Validation (Priority: High)

**Goal:** Ensure widget identity remains stable when key is provided, and handle value validation gracefully.

**Tasks:**

1. **Audit current `key_as_main_identity` usage** across all selection widgets
2. **Remove `options` from identity computation** when key is provided
3. **Add value validation logic** in each widget's `_<widget>()` method
4. **Update session_state handling** to preserve values across options changes
5. **Add unit tests** for identity stability and value validation

**Estimated effort:** 2-3 days

**Note:** No frontend changes are required. Once the backend produces stable element IDs, the frontend automatically maintains state because the element ID is used as the React component key. When options change but the element ID stays the same, React doesn't remount the component.

### Phase 2: Edge Case Handling (Priority: Medium)

**Goal:** Handle complex scenarios gracefully.

**Tasks:**

1. **Handle index-based widgets** (radio, select_slider) - these use indices, not values
2. **Handle format_func changes** - value might match by formatted string
3. **Handle accept_new_options** - user-entered values should be preserved
4. **Add E2E tests** for cascading dropdowns, filtered options, etc.

**Estimated effort:** 2-3 days

### Phase 3: Documentation & Migration (Priority: Medium)

**Goal:** Document new behavior and provide migration guidance.

**Tasks:**

1. **Update API documentation** with new behavior
2. **Add changelog entry** explaining the change
3. **Create migration guide** for any breaking changes
4. **Add examples** demonstrating dynamic options patterns

**Estimated effort:** 1 day

---

## Detailed Implementation

### Backend Changes

#### 1. `lib/streamlit/elements/widgets/selectbox.py`

```python
def _selectbox(
    self,
    label: str,
    options: OptionSequence[T],
    index: int | None = 0,
    format_func: Callable[[Any], Any] = str,
    key: Key | None = None,
    accept_new_options: bool = False,
    ...
) -> T | str | None:
    key = to_key(key)
    opt = convert_anything_to_list(options)

    # ... validation checks ...

    formatted_options, formatted_option_to_option_index = create_mappings(opt, format_func)

    # CHANGE 1: Remove "options" from identity computation
    element_id = compute_and_register_element_id(
        "selectbox",
        user_key=key,
        # Only accept_new_options affects identity (not options!)
        key_as_main_identity={"accept_new_options"},
        dg=self.dg,
        label=label,
        options=formatted_options,  # Still passed but not used in hash when key provided
        ...
    )

    # CHANGE 2: Validate current value and reset if invalid
    session_state = get_session_state().filtered_state
    current_value = session_state.get(key) if key else None
    value_needs_reset = False

    if current_value is not None:
        # Check if current value is still valid
        try:
            index_(opt, current_value)
        except ValueError:
            # Value not in options
            if not accept_new_options:
                value_needs_reset = True
                current_value = None

    # Determine the default/reset value
    default_value = opt[index] if index is not None and len(opt) > 0 else None
    actual_value = current_value if current_value is not None else default_value

    # Build proto
    selectbox_proto = SelectboxProto()
    selectbox_proto.id = element_id
    selectbox_proto.options[:] = formatted_options

    # ... rest of proto setup ...

    serde = SelectboxSerde(opt, formatted_options=formatted_options, ...)

    widget_state = register_widget(
        selectbox_proto.id,
        deserializer=serde.deserialize,
        serializer=serde.serialize,
        ...
    )

    # CHANGE 3: Signal frontend to update if value was reset
    if value_needs_reset or widget_state.value_changed:
        selectbox_proto.raw_value = serde.serialize(actual_value)
        selectbox_proto.set_value = True

    self.dg._enqueue("selectbox", selectbox_proto, ...)
    return actual_value  # Return the validated value
```

#### 2. `lib/streamlit/elements/widgets/multiselect.py`

```python
def _multiselect(self, ..., options, key, accept_new_options, ...):
    opt = convert_anything_to_list(options)

    # CHANGE 1: Remove "options" from identity
    element_id = compute_and_register_element_id(
        "multiselect",
        user_key=key,
        key_as_main_identity={"max_selections", "accept_new_options"},  # No "options"!
        ...
    )

    # CHANGE 2: Validate and filter current selections
    session_state = get_session_state().filtered_state
    current_values = session_state.get(key, []) if key else []

    validated_values = []
    any_dropped = False
    for val in current_values:
        if val in opt:
            validated_values.append(val)
        elif accept_new_options:
            validated_values.append(val)
        else:
            any_dropped = True

    # CHANGE 3: Update proto with validated values and set_value flag
    proto.raw_values[:] = [serde.serialize(v) for v in validated_values]
    if any_dropped:
        proto.set_value = True  # Tell frontend to update

    return validated_values
```

#### 3. `lib/streamlit/elements/widgets/radio.py`

```python
def _radio(self, ..., options, index, key, ...):
    opt = convert_anything_to_list(options)

    # CHANGE 1: Full key-based identity (no options in hash)
    element_id = compute_and_register_element_id(
        "radio",
        user_key=key,
        key_as_main_identity=True,  # Complete key-based identity
        ...
    )

    # CHANGE 2: Validate current selection
    session_state = get_session_state().filtered_state
    current_value = session_state.get(key) if key else None
    value_needs_reset = False

    if current_value is not None:
        try:
            # Value exists - find its new index (position may have changed)
            new_index = index_(opt, current_value)
        except ValueError:
            # Value no longer in options - reset
            value_needs_reset = True
            current_value = None

    # Determine default
    default_value = opt[index] if index is not None and len(opt) > 0 else None
    actual_value = current_value if current_value is not None else default_value

    # CHANGE 3: Signal frontend if reset occurred
    if value_needs_reset:
        radio_proto.value = index_(opt, actual_value) if actual_value else None
        radio_proto.set_value = True

    return actual_value
```

#### 4. `lib/streamlit/elements/widgets/button_group.py` (pills, segmented_control)

```python
def _button_group(self, ..., options, key, selection_mode, ...):
    # CHANGE 1: Remove "options" from identity
    element_id = compute_and_register_element_id(
        "pills" if style == "pills" else "segmented_control",
        user_key=key,
        key_as_main_identity={"click_mode"},  # No "options"!
        ...
    )

    # CHANGE 2: Validate selections
    # Similar pattern - validate against new options, reset invalid ones
    ...
```

#### 5. `lib/streamlit/elements/widgets/select_slider.py`

```python
def _select_slider(self, ..., options, key, ...):
    # CHANGE 1: Full key-based identity
    element_id = compute_and_register_element_id(
        "select_slider",
        user_key=key,
        key_as_main_identity=True,  # No options in hash
        ...
    )

    # CHANGE 2: Validate slider value(s) against new options
    # Reset to first option(s) if invalid
    ...
```

### Frontend Changes

**No frontend changes required.**

Once the backend produces stable element IDs (by removing `options` from the identity computation), the frontend automatically maintains state:

1. The element ID is used as the React component key in `ElementNodeRenderer.tsx`
2. When element ID stays stable, React doesn't remount the component
3. The `WidgetStateManager` continues to use the same key for state storage
4. When the backend needs to update the value (after validation), it sends `setValue=true` in the proto

The existing `useBasicWidgetState` hook already handles `setValue` correctly - it watches for the flag and updates local state accordingly.

---

## Testing Strategy

### Unit Tests (Python)

```python
# test_selectbox.py

def test_selectbox_preserves_selection_when_options_expand():
    """Selection should be preserved when new options are added."""
    with st.session_state:
        st.selectbox("test", ["A", "B"], key="sel")
        st.session_state["sel"] = "A"

        # Add option C
        result = st.selectbox("test", ["A", "B", "C"], key="sel")
        assert result == "A"  # Selection preserved

def test_selectbox_resets_when_selection_removed():
    """Selection should reset when selected option is removed."""
    with st.session_state:
        st.selectbox("test", ["A", "B", "C"], key="sel")
        st.session_state["sel"] = "B"

        # Remove option B
        result = st.selectbox("test", ["A", "C"], key="sel")
        assert result == "A"  # Reset to default (first option)

def test_selectbox_preserves_with_accept_new_options():
    """User-entered values should be preserved."""
    with st.session_state:
        st.selectbox("test", ["A", "B"], key="sel", accept_new_options=True)
        st.session_state["sel"] = "Custom"  # User entered value

        # Change options
        result = st.selectbox("test", ["X", "Y"], key="sel", accept_new_options=True)
        assert result == "Custom"  # Preserved

def test_multiselect_partial_preservation():
    """Valid selections should be kept, invalid ones dropped."""
    with st.session_state:
        st.multiselect("test", ["A", "B", "C"], key="multi")
        st.session_state["multi"] = ["A", "B"]

        # Remove option B
        result = st.multiselect("test", ["A", "C", "D"], key="multi")
        assert result == ["A"]  # Only A preserved
```

### E2E Tests (Playwright)

```python
# e2e_playwright/st_selectbox_dynamic_test.py

def test_cascading_selectbox_preserves_parent():
    """Parent selectbox value should be stable across child rerenders."""
    app.get_by_test_id("stSelectbox").first.click()
    app.get_by_text("Electronics").click()

    # Child options appear
    app.get_by_test_id("stSelectbox").nth(1).click()
    app.get_by_text("Phones").click()

    # Parent should still show "Electronics"
    expect(app.get_by_test_id("stSelectbox").first).to_contain_text("Electronics")

def test_filtered_options_preserve_selection():
    """Selection should persist when filtering options."""
    # Select "Banana"
    app.get_by_test_id("stSelectbox").click()
    app.get_by_text("Banana").click()

    # Type filter that still includes Banana
    app.get_by_test_id("stTextInput").fill("an")

    # Selection should still be "Banana"
    expect(app.get_by_test_id("stSelectbox")).to_contain_text("Banana")
```

---

## Risk Assessment

### Breaking Changes

| Change | Risk Level | Mitigation |
|--------|------------|------------|
| Stable identity when key provided | Low | Expected behavior for most users |
| Auto-validation of selections | Medium | Document clearly, add escape hatch |

**Note:** No frontend changes required, which significantly reduces implementation risk.

### Edge Cases to Consider

1. **Empty options list** - How to handle when options become empty?
2. **Type changes** - What if option types change (e.g., int → str)?
3. **Duplicate options** - How to handle duplicate formatted values?
4. **Performance** - Validation shouldn't add significant overhead
5. **Forms** - Special handling needed for form widgets

---

## Success Criteria

1. **Identity Stability:** Widget with key maintains same element ID across options changes
2. **Value Preservation:** Valid selections are preserved when options change
3. **Graceful Reset:** Invalid selections reset to default without errors
4. **No Regression:** Existing apps without keys work unchanged
5. **Performance:** No measurable performance degradation
6. **Documentation:** Clear documentation of new behavior

---

## Open Questions

1. **Should we add a parameter to control validation behavior?**
   - e.g., `preserve_selection=True` to explicitly opt-in
   - Or make it automatic based on presence of `key`?
   - **Recommendation:** Automatic when `key` is provided - this is the expected behavior

2. **How to handle index-based widgets (radio, select_slider)?**
   - These store indices in the proto but values in session_state
   - **Recommendation:** Always validate by value, convert to index for proto

3. **What about `on_change` callbacks?**
   - Should callback fire when selection is auto-validated/reset?
   - **Recommendation:** NO - use `fromUi=false` to skip callbacks
   - This prevents infinite loops when callbacks modify options

4. **Forms with dynamic options?**
   - When should validation happen?
   - **Recommendation:** Validate immediately when widget renders, not on form submit
   - Form submission uses the already-validated value

5. **What if ALL options are removed (empty list)?**
   - Current behavior: Some widgets raise error, some allow empty
   - **Recommendation:** Keep current per-widget behavior for empty options
   - Validation only applies when there ARE options but selection isn't in them

6. **Should we update session_state immediately or defer?**
   - If we reset "B" to "A", when does `st.session_state["key"]` reflect "A"?
   - **Recommendation:** Update immediately during widget execution
   - This ensures consistent state if user accesses session_state later in script

7. **What about `format_func` changes?**
   - User changes how options are displayed but underlying values are same
   - **Recommendation:** Identity should be stable (format_func not in hash)
   - Validation uses actual values, not formatted strings

---

## Appendix: Code References

### Current Element ID Computation

```153:182:lib/streamlit/elements/lib/utils.py
def _compute_element_id(
    element_type: str,
    user_key: str | None = None,
    **kwargs: SAFE_VALUES | Iterable[SAFE_VALUES],
) -> str:
    h = hashlib.new("md5", usedforsecurity=False)
    h.update(element_type.encode("utf-8"))
    if user_key:
        h.update(user_key.encode("utf-8"))
    for k, v in kwargs.items():
        h.update(str(k).encode("utf-8"))
        h.update(str(v).encode("utf-8"))
    return f"{GENERATED_ELEMENT_ID_PREFIX}-{h.hexdigest()}-{user_key}"
```

### Current Selectbox Identity Settings

```542:558:lib/streamlit/elements/widgets/selectbox.py
element_id = compute_and_register_element_id(
    "selectbox",
    user_key=key,
    # Treat the provided key as the main identity. Only include
    # the options and accept_new_options in the identity computation
    # as those can invalidate the current selection.
    key_as_main_identity={"options", "accept_new_options"},
    dg=self.dg,
    label=label,
    options=formatted_options,
    ...
)
```

### Session State Widget Registration

```890:927:lib/streamlit/runtime/state/session_state.py
def register_widget(
    self, metadata: WidgetMetadata[T], user_key: str | None
) -> RegisterWidgetResult[T]:
    widget_id = metadata.id

    self._set_widget_metadata(metadata)
    if user_key is not None:
        self._set_key_widget_mapping(widget_id, user_key)

    if widget_id not in self and (user_key is None or user_key not in self):
        # First time widget is registered
        deserializer = metadata.deserializer
        initial_widget_value = deepcopy(deserializer(None))
        self._new_widget_state.set_from_value(widget_id, initial_widget_value)

    widget_value = cast("T", self[widget_id])
    widget_value = deepcopy(widget_value)

    widget_value_changed = user_key is not None and self.is_new_state_value(user_key)

    return RegisterWidgetResult(widget_value, widget_value_changed)
```
