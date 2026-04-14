---
author: lukasmasuch
created: 2026-04-14
---

# Callback modes for `on_change` parameter

## Summary

Extend stateful widget `on_change` parameter to accept `Literal["rerun", "ignore"]` in addition to
`WidgetCallback`, enabling users to control whether a widget interaction triggers a rerun. This
unifies the existing `on_select` pattern already implemented in `st.dataframe` and chart elements
with the remaining stateful widgets, and reuses the `ignore_rerun` proto field from `st.link_button`
and `st.download_button`.

Note: The `on_select` parameter in `st.dataframe`/charts already supports this pattern. This spec
focuses on bringing the same capability to the `on_change` parameter across all stateful widgets.

## Problem

Streamlit's core architecture reruns the entire script whenever a widget value changes. While this
model is simple and powerful, it causes performance problems in several scenarios:

- **Heavy computations**: Apps with expensive data loading or rendering operations restart
  unnecessarily when users interact with unrelated widgets
- **Async workflows**: Long-running processes (e.g., AI agents, data pipelines) restart when users
  interact with progress/status widgets
- **Multi-widget forms**: Users building custom form-like UIs outside `st.form` cannot batch widget
  interactions

**GitHub Issue:** [#5827](https://github.com/streamlit/streamlit/issues/5827) - 94+ upvotes

Current workarounds have limitations:

- `st.form`: Batches widget changes but requires specific UI patterns; widgets can't be updated
  individually
- `st.fragment`: Scopes reruns to a function but creates isolated contexts; can't prevent reruns
  entirely
- `st.cache_data`: Caches expensive computations but still reruns the script

### Existing Pattern

Streamlit already implements callback modes in several elements:

| Element              | Parameter                                                         | Default     |
| -------------------- | ----------------------------------------------------------------- | ----------- |
| `st.download_button` | `on_click: WidgetCallback \| Literal["rerun", "ignore"] \| None`  | `"rerun"`   |
| `st.link_button`     | `on_click: WidgetCallback \| Literal["rerun", "ignore"]`          | `"ignore"`  |
| `st.dataframe`       | `on_select: Literal["ignore", "rerun"] \| WidgetCallback`         | `"ignore"`  |
| `st.plotly_chart`    | `on_select: Literal["rerun", "ignore"] \| WidgetCallback`         | `"ignore"`  |
| `st.altair_chart`    | `on_select: Literal["rerun", "ignore"] \| WidgetCallback`         | `"ignore"`  |
| `st.pydeck_chart`    | `on_select: Literal["rerun", "ignore"] \| WidgetCallback`         | `"ignore"`  |

The proposed change extends this pattern to all remaining widgets.

## Proposal

### Affected Widgets

Widgets with `on_change: WidgetCallback | None` (stateful widgets):

- `st.slider`
- `st.select_slider`
- `st.selectbox`
- `st.multiselect`
- `st.radio`
- `st.checkbox` / `st.toggle`
- `st.text_input`
- `st.text_area`
- `st.number_input`
- `st.date_input`
- `st.time_input`
- `st.file_uploader`
- `st.color_picker`
- `st.camera_input`
- `st.audio_input`
- `st.data_editor`
- `st.feedback`

### Excluded: Trigger-Based Widgets

The following widgets use trigger values and are **not** candidates for `on_x="ignore"`:

- `st.button` (`on_click`)
- `st.form_submit_button` (`on_click`)
- `st.menu_button` (`on_click`)
- `st.chat_input` (`on_submit`)

**Rationale:** Trigger widgets return meaningful values only when activated (e.g., `st.button()`
returns `True` only on click). Without a rerun, the Python code never receives the trigger value.
The `"ignore"` mode is designed for stateful widgets where the value persists in session state and
can be read on a subsequent manual rerun.

### API Change

Update the callback parameter type from:

```python
on_change: WidgetCallback | None = None
```

To:

```python
on_change: WidgetCallback | Literal["rerun", "ignore"] | None = "rerun"
```

### Behavior

| Value                | Triggers Rerun | Executes Callback |
| -------------------- | -------------- | ----------------- |
| `"rerun"` (default)  | Yes            | No                |
| `None`               | Yes            | No                |
| `"ignore"`           | No             | No                |
| `callable`           | Yes            | Yes               |

**Note:** `None` is kept as an alias for `"rerun"` for backwards compatibility. The default is
`"rerun"` to be explicit about the behavior.

### Backwards Compatibility

Changing the default from `None` to `"rerun"` requires updating internal code:

1. **Internal `if on_change is None:` guards**: All 17 affected widget implementations currently
   check `if on_change is None` or use truthiness checks. These must be updated to handle
   `on_change == "rerun"` equivalently to `None`. A helper function (see Backend Changes section)
   ensures consistent handling across all widgets.

2. **Type stubs**: Third-party libraries or apps with custom type stubs pinning
   `on_change: WidgetCallback | None = None` will see type errors after the change. This is
   expected as the signature changes, but runtime behavior remains compatible since `None` is
   still accepted.

### Example Usage

```python
import streamlit as st

# Prevent rerun when slider changes - useful when the app has heavy computations
threshold = st.slider("Threshold", 0, 100, 50, on_change="ignore")

# Only rerun when explicitly requested
if st.button("Apply"):
    st.write(f"Using threshold: {threshold}")
```

### Special Case: `st.file_uploader`

`st.file_uploader` with `on_change="ignore"` is safe because:

1. **File upload** happens via HTTP POST (independent of rerun mechanism)
2. **File storage** is session-scoped, not script-run-scoped
3. Files persist until the session ends

Example workflow:
```python
# User uploads file → stored server-side, no rerun
uploaded = st.file_uploader("Upload", on_change="ignore")

# User clicks button → rerun triggered
if st.button("Process"):
    if uploaded:
        st.write(f"Processing {uploaded.name}")  # File is available
```

For `accept_multiple_files=True`, each file upload stores the file server-side via HTTP POST
without triggering a rerun. On the next manual rerun, all uploaded files are available in the
returned list.

### Implementation Strategy

#### Option 1: Proto-Level `ignore_rerun` Flag (PREFERRED)

Add a boolean field to each widget proto to indicate whether reruns should be suppressed. This
field already exists in `LinkButton` and `DownloadButton` protos:

```protobuf
message Slider {
  // ... existing fields ...
  bool ignore_rerun = 20;  // If true, widget value changes don't trigger reruns
}
```

**Frontend changes:**

1. **WidgetStateManager**: Check `ignoreRerun` in `onWidgetValueChanged()`. If true, skip calling
   `scheduleFlush()` (which triggers the rerun).

2. **Individual widgets**: Pass the `ignoreRerun` value from proto to WidgetStateManager hooks.

**Note on pattern divergence from `DownloadButton`:** The existing `DownloadButton.tsx`
implementation handles `ignoreRerun` by skipping the `setTriggerValue()` call entirely when
`ignoreRerun` is true. However, stateful widgets must use a different approach: they still call
`setValue` methods (so the value is stored in `WidgetStateManager` for transmission on the next
rerun), but suppress `scheduleFlush()` in `onWidgetValueChanged`. This distinction is important
because stateful widgets need their value persisted in frontend state even when the rerun is
suppressed.

**Backend changes:**

1. Update each widget's element function to:
   - Accept the new callback type
   - Set `proto.ignore_rerun = True` when `on_change == "ignore"`
   - Continue to register callbacks when a callable is provided

**Pros:**

- Clear separation of concerns
- Frontend can handle rerun suppression without knowing about callbacks
- Single point of control per widget

**Cons:**

- Requires proto changes for each widget (one-time migration)
- Proto field names must be consistent across widgets

#### Option 2: Frontend-Only via `formId` Trick

Reuse the existing form mechanism. When `on_change="ignore"`, set a synthetic `form_id` that is
never submitted.

**Pros:**

- No proto changes required
- Reuses existing frontend logic

**Cons:**

- Abuses form semantics for unrelated purpose
- May have unintended side effects (form validation, submit button states)
- Widget states would accumulate without cleanup

#### Option 3: Backend-Only Filtering

Backend filters out rerun requests for widgets with `on_change="ignore"`.

**Pros:**

- All logic in one place

**Cons:**

- Rerun request is still sent from frontend, adding latency
- Backend needs to track which widgets should suppress reruns

### Recommended Approach

**Option 1** is preferred because:

1. It's explicit and self-documenting (proto field clearly states intent)
2. It aligns with how `form_id` already works (frontend-controlled rerun decisions)
3. It's a one-time migration that establishes a consistent pattern

### Proto Changes

Add `ignore_rerun` field to all affected widget protos (matching existing `LinkButton` and
`DownloadButton` pattern):

```protobuf
// In each widget proto (Slider.proto, Selectbox.proto, etc.)
message Slider {
  // ... existing fields ...
  bool ignore_rerun = N;  // Next available field number
}
```

### Frontend Changes

Update `WidgetStateManager.ts`:

```typescript
// In onWidgetValueChanged()
private onWidgetValueChanged(
  formId: string | undefined,
  source: Source,
  fragmentId: string | undefined,
  ignoreRerun: boolean = false  // NEW parameter
): void {
  if (isValidFormId(formId)) {
    this.syncFormsWithPendingChanges()
  } else if (source.fromUi && !ignoreRerun) {  // Check ignoreRerun
    this.scheduleFlush(fragmentId)
  }
}
```

**Fragment interaction:** When `ignoreRerun=true` inside a fragment, the condition
`source.fromUi && !ignoreRerun` will skip `scheduleFlush(fragmentId)`, suppressing both fragment
and full-page reruns. This is the desired behavior—the feature suppresses any rerun triggered by
the widget interaction, regardless of context. On the next rerun (fragment or full-page), the
pending widget value will be sent to the backend.

**Text input debounce:** `st.text_input` and `st.text_area` have special debounce behavior where
the rerun triggers on Enter/blur rather than per-keystroke. The `ignoreRerun` flag will be
respected at the debounce-flush point (the `onWidgetValueChanged` call), ensuring the rerun is
suppressed when the user finishes editing, not just on individual keystrokes.

Widget hooks (e.g., `useBasicWidgetState`) need to pass through the `ignoreRerun` value from the
widget proto.

### Backend Changes

Update each widget's element function signature and implementation. Since all 17 widgets need
identical `on_change` parsing logic, a shared helper ensures consistent behavior:

```python
def parse_on_change(
    on_change: WidgetCallback | Literal["rerun", "ignore"] | None
) -> tuple[bool, WidgetCallback | None]:
    """Extract ignore_rerun flag and actual callback from on_change parameter."""
    ignore_rerun = on_change == "ignore"
    callback = on_change if callable(on_change) else None
    return ignore_rerun, callback
```

**Note on form callback policies:** Existing callback policies treat any non-`None` `on_change`
value as a callback and will error inside `st.form`. Since the proposal makes the default a string
(`"rerun"`), implementations must extract `actual_callback` (callable or `None`) using the helper
above and pass only the callable into `check_widget_policies` / `register_widget`. This ensures
`on_change="rerun"` and `on_change="ignore"` don't trigger form callback errors.

Example widget implementation:

```python
def slider(
    self,
    label: str,
    # ... existing params ...
    on_change: WidgetCallback | Literal["rerun", "ignore"] | None = "rerun",
    # ...
) -> T:
    # ... existing logic ...

    # Determine rerun behavior
    ignore_rerun, actual_callback = parse_on_change(on_change)

    slider_proto.ignore_rerun = ignore_rerun

    register_widget(
        # ...
        on_change_handler=actual_callback,  # Pass callable or None, not string modes
        # ...
    )
```

### Migration Path

1. **Phase 1**: Add `ignore_rerun` field to all widget protos (backwards compatible - defaults to
   `false`)
2. **Phase 2**: Update backend to accept `Literal["rerun", "ignore"]` and set proto field
3. **Phase 3**: Update frontend to respect `ignore_rerun` field
4. **Phase 4**: Update documentation and release

## Alternatives Considered

### Alternative: Add a Separate `rerun` Parameter

```python
st.slider("Value", on_change=my_callback, rerun=False)
```

**Rejected because:**

- Adds a new parameter to every widget
- Inconsistent with existing `on_click`/`on_select` pattern that already accepts modes
- More complex type checking (what if `rerun=True` but no callback?)

### Alternative: Global `st.no_rerun()` Context Manager

```python
with st.no_rerun():
    value = st.slider("Value")
```

**Rejected because:**

- Implicit behavior is harder to reason about
- Context managers don't compose well with fragments
- Doesn't allow per-widget control

## Out of Scope

- **Fragment-level rerun control**: This proposal focuses on widget-level control. Fragment reruns
  are a separate concern addressed by `st.fragment`. Note that widgets with `on_change="ignore"`
  inside fragments will suppress both fragment and full-page reruns (see Frontend Changes section).
- **Debouncing/throttling**: Rate-limiting widget updates is a different feature request.
- **Batch updates**: Batching multiple widget changes into a single rerun is handled by `st.form`.
