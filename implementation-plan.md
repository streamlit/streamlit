# Implementation Plan: `on_dismiss` Parameter for `st.dialog`

## Overview

This plan implements the `on_dismiss` parameter for `st.dialog` that allows developers to react when a dialog is dismissed (by clicking X, clicking background, or pressing Escape). The parameter supports three modes:

- `"ignore"` (default): No reaction to dismiss events (current behavior)
- `"rerun"`: Trigger a rerun when dialog is dismissed
- `callback`: Execute a callback function and trigger a rerun when dialog is dismissed

## Architecture Changes

The key challenge is that dialogs are currently **not widgets** - they don't have widget IDs, don't register with the widget system, and don't send widget events. To implement `on_dismiss`, we need to make dialogs behave as widgets when `on_dismiss != "ignore"`.

**Simplified Approach**: Instead of sending the `on_dismiss` mode to the frontend via protobuf, we only set the dialog's `id` field when `on_dismiss != "ignore"`. The frontend can then determine that dismiss functionality is active by checking if the `id` field is present, eliminating the need for an additional protobuf enum.

**Form Compatibility**: Dialogs exist outside the normal form flow and are not compatible with forms. When registering dialogs as widgets, we always use an empty string for `form_id`.

**Trigger Value Design**: Dialog dismiss events use the simple `trigger_value` type instead of complex state serialization. When dismissed, the frontend sends `true` to trigger the callback/rerun, eliminating the need for JSON serialization/deserialization.

## Implementation Order

Following the new feature implementation guide, we'll implement in this order:

### 1. Protobuf Changes (`proto/`)

**File: `proto/streamlit/proto/Block.proto`**

Add `on_dismiss` related fields to the `Dialog` message:

```protobuf
message Dialog {
  enum DialogWidth {
    SMALL = 0;
    LARGE = 1;
  }

  string title = 1;
  bool dismissible = 2;
  DialogWidth width = 3;
  optional bool is_open = 4;

  // New fields for on_dismiss functionality
  // If id is set, dismiss events will trigger widget updates
  string id = 5;  // Widget ID when used as widget
}

```

**Run:** `make protobuf`

### 2. Backend Implementation (`lib/streamlit/`)

### 2.1 Dialog State Management

**File: `lib/streamlit/elements/lib/dialog.py`**

Dialog dismiss events use a simple trigger value approach - no complex state management needed since we just need to know when the dialog was dismissed.

### 2.2 Dialog Class Updates

**File: `lib/streamlit/elements/lib/dialog.py`**

Update the `Dialog` class to support widget registration:

```python
class Dialog(DeltaGenerator):
    @staticmethod
    def _create(
        parent: DeltaGenerator,
        title: str,
        *,
        dismissible: bool = True,
        width: DialogWidth = "small",
        on_dismiss: Literal["ignore", "rerun"] | WidgetCallback = "ignore",
        key: Key | None = None,
    ) -> Dialog:
        # Existing dialog creation logic...

        block_proto = BlockProto()
        block_proto.dialog.title = title
        block_proto.dialog.dismissible = dismissible
        block_proto.dialog.width = _process_dialog_width_input(width)

        # New: Handle on_dismiss functionality
        is_dismiss_activated = on_dismiss != "ignore"
        if is_dismiss_activated:
            # Register as widget
            from streamlit.elements.lib.utils import compute_and_register_element_id
            from streamlit.runtime.state import register_widget
            from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx

            ctx = get_script_run_ctx()

            element_id = compute_and_register_element_id(
                "dialog",
                user_key=key,
                form_id="",  # Dialogs are not compatible with forms
                dg=parent,
                title=title,
                dismissible=dismissible,
                width=width,
                on_dismiss=on_dismiss,
            )
            block_proto.dialog.id = element_id

        dialog = cast("Dialog", parent._block(block_proto=block_proto, dg_type=Dialog))
        dialog._delta_path = parent._active_dg._cursor.delta_path if parent._active_dg._cursor else []
        dialog._current_proto = block_proto
        dialog._is_dismiss_activated = is_dismiss_activated
        dialog._on_dismiss_callback = on_dismiss if callable(on_dismiss) else None
        dialog._element_id = element_id if is_dismiss_activated else None

        # Register widget state if needed
        if is_dismiss_activated:
            dialog._widget_state = register_widget(
                element_id,
                on_change_handler=on_dismiss if callable(on_dismiss) else None,
                deserializer=lambda x: x,  # Simple passthrough for trigger values
                serializer=lambda x: x,    # Simple passthrough for trigger values
                ctx=ctx,
                value_type="trigger_value",
            )

        return dialog

```

### 2.3 Dialog Decorator Updates

**File: `lib/streamlit/elements/dialog_decorator.py`**

Update the decorator to accept `on_dismiss` parameter:

```python
def _dialog_decorator(
    non_optional_func: F,
    title: str,
    *,
    width: DialogWidth = "small",
    dismissible: bool = True,
    on_dismiss: Literal["ignore", "rerun"] | WidgetCallback = "ignore",
    key: Key | None = None,
    should_show_deprecation_warning: bool = False,
) -> F:
    # Validation for on_dismiss parameter
    if on_dismiss not in ["ignore", "rerun"] and not callable(on_dismiss):
        raise StreamlitAPIException(
            f"You have passed {on_dismiss} to `on_dismiss`. But only 'ignore', "
            "'rerun', or a callable is supported."
        )

    @wraps(non_optional_func)
    def wrap(*args: Any, **kwargs: Any) -> None:
        _assert_no_nested_dialogs()

        dialog = get_dg_singleton_instance().event_dg._dialog(
            title=title,
            dismissible=dismissible,
            width=width,
            on_dismiss=on_dismiss,
            key=key,
        )
        dialog.open()

        # Rest of existing logic...

        with dialog:
            fragmented_dialog_content()
            return

    return cast("F", wrap)

# Update decorator overloads to include on_dismiss
@overload
def dialog_decorator(
    title: str,
    *,
    width: DialogWidth = "small",
    dismissible: bool = True,
    on_dismiss: Literal["ignore", "rerun"] | WidgetCallback = "ignore",
    key: Key | None = None,
) -> Callable[[F], F]: ...

```

### 2.4 Element Mocks for Testing

**File: `lib/tests/streamlit/element_mocks.py`**

Add dialog mock for testing:

```python
def dialog(
    self,
    title: str,
    *,
    width: DialogWidth = "small",
    dismissible: bool = True,
    on_dismiss: Literal["ignore", "rerun"] | WidgetCallback = "ignore",
    key: Key | None = None,
) -> Dialog:
    return self._mock_dialog(
        title, width=width, dismissible=dismissible, on_dismiss=on_dismiss, key=key
    )

def _mock_dialog(self, title: str, **kwargs) -> Dialog:
    # Mock implementation for testing
    pass

```

### 3. Python Unit Tests (`lib/tests/`)

**File: `lib/tests/streamlit/dialog_test.py`**

Create comprehensive unit tests:

```python
import pytest
from unittest.mock import patch, MagicMock
from streamlit.elements.dialog_decorator import dialog_decorator
from streamlit.elements.lib.dialog import Dialog
from streamlit.errors import StreamlitAPIException

class TestDialogOnDismiss:
    def test_on_dismiss_ignore_default(self):
        """Test that on_dismiss defaults to 'ignore'"""
        pass

    def test_on_dismiss_rerun(self):
        """Test on_dismiss='rerun' functionality"""
        pass

    def test_on_dismiss_callback(self):
        """Test on_dismiss with callback function"""
        pass

    def test_invalid_on_dismiss_value(self):
        """Test invalid on_dismiss parameter raises error"""
        with pytest.raises(StreamlitAPIException):
            @dialog_decorator("test", on_dismiss="invalid")
            def test_dialog():
                pass

    def test_dialog_widget_registration(self):
        """Test dialog widget registration when on_dismiss is activated"""
        # Test that widget is registered with trigger_value type
        # when on_dismiss != "ignore"
        pass

```

**Run tests:** `PYTHONPATH=lib pytest lib/tests/streamlit/dialog_test.py`

### 4. Frontend Implementation (`frontend/`)

### 4.1 Dialog Component Updates

**File: `frontend/lib/src/components/elements/Dialog/Dialog.tsx`**

Update Dialog component to send widget events on dismiss:

```tsx
import { WidgetStateManager } from "~lib/WidgetStateManager"

export interface Props {
  element: BlockProto.Dialog
  deltaMsgReceivedAt?: number
  widgetMgr?: WidgetStateManager  // Add widget manager
  fragmentId?: string            // Add fragment ID
}

const Dialog: React.FC<React.PropsWithChildren<Props>> = ({
  element,
  deltaMsgReceivedAt,
  children,
  widgetMgr,
  fragmentId,
}): ReactElement => {
  const { title, dismissible, width, isOpen: initialIsOpen, id } = element
  const [isOpen, setIsOpen] = useState<boolean>(false)

  // Handle dialog dismiss with widget event
  const handleClose = useCallback(() => {
    setIsOpen(false)

    // Send widget event if on_dismiss is activated (indicated by presence of id)
    if (id && widgetMgr) {
      widgetMgr.setTriggerValue(
        {
          id,
          formId: ""  // Dialogs are not compatible with forms
        },
        true,  // Simple boolean trigger for dismiss event
        { fromUi: true },
        fragmentId
      )
    }
  }, [id, widgetMgr, fragmentId])

  // Rest of existing component logic...

  return (
    <Modal
      isOpen
      closeable={dismissible}
      onClose={handleClose}  // Use new handler
      size={width === BlockProto.Dialog.DialogWidth.LARGE ? "full" : "default"}
    >
      {/* Existing modal content */}
    </Modal>
  )
}

```

### 4.2 Block Renderer Updates

**File: `frontend/lib/src/components/core/Block/Block.tsx`**

Update dialog rendering to pass widget manager:

```tsx
if (node.deltaBlock.dialog) {
  return (
    <Dialog
      element={node.deltaBlock.dialog as BlockProto.Dialog}
      deltaMsgReceivedAt={node.deltaMsgReceivedAt}
      widgetMgr={props.widgetMgr}  // Pass widget manager
      fragmentId={node.fragmentId} // Pass fragment ID
    >
      {child}
    </Dialog>
  )
}

```

### 5. Frontend Unit Tests

**File: `frontend/lib/src/components/elements/Dialog/Dialog.test.tsx`**

Create Vitest unit tests:

```tsx
import { render, screen, fireEvent } from "@testing-library/react"
import { vi } from "vitest"
import Dialog from "./Dialog"
import { BlockProto } from "@streamlit/protobuf"

describe("Dialog on_dismiss functionality", () => {
  it("does not send widget event when id is not set", () => {
    const mockWidgetMgr = {
      setTriggerValue: vi.fn()
    }

    const element = {
      title: "Test Dialog",
      id: "", // No id means on_dismiss="ignore"
      // other props...
    }

    render(<Dialog element={element} widgetMgr={mockWidgetMgr} />)

    // Simulate dismiss action
    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(mockWidgetMgr.setTriggerValue).not.toHaveBeenCalled()
  })

  it("sends widget event when id is set", () => {
    const mockWidgetMgr = {
      setTriggerValue: vi.fn()
    }

    const element = {
      title: "Test Dialog",
      id: "test-dialog-id", // id present means on_dismiss is activated
    }

    render(<Dialog element={element} widgetMgr={mockWidgetMgr} />)

    // Simulate dismiss action
    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(mockWidgetMgr.setTriggerValue).toHaveBeenCalledWith(
      { id: "test-dialog-id", formId: "" },
      true,
      { fromUi: true },
      undefined
    )
  })
})

```

**Run tests:** `cd frontend && yarn test lib/src/components/elements/Dialog/Dialog.test.tsx`

### 6. E2E Playwright Tests

**File: `e2e_playwright/st_dialog_on_dismiss_test.py`**

Create end-to-end tests:

```python
import streamlit as st
from e2e_playwright.shared.app_utils import AppTest

def test_dialog_on_dismiss_rerun():
    """Test dialog on_dismiss='rerun' triggers rerun"""

    @st.dialog("Test Dialog", on_dismiss="rerun")
    def test_dialog():
        st.write("Dialog content")

    if st.button("Open Dialog"):
        test_dialog()

    # Use a counter to detect reruns caused by dialog dismiss
    if "rerun_count" not in st.session_state:
        st.session_state.rerun_count = 0

    st.session_state.rerun_count += 1
    st.write(f"Rerun count: {st.session_state.rerun_count}")

    # This will show an increasing count when dialog is dismissed

def test_dialog_on_dismiss_callback():
    """Test dialog on_dismiss with callback function"""

    def on_dialog_dismiss():
        st.session_state.callback_executed = True
        st.session_state.dismiss_count = st.session_state.get("dismiss_count", 0) + 1

    @st.dialog("Test Dialog", on_dismiss=on_dialog_dismiss)
    def test_dialog():
        st.write("Dialog content")

    if st.button("Open Dialog"):
        test_dialog()

    if st.session_state.get("callback_executed"):
        st.success(f"Callback executed {st.session_state.get('dismiss_count', 0)} times!")

class TestDialogOnDismiss(AppTest):
    def test_dialog_dismiss_rerun(self):
        """Test that dismissing dialog with on_dismiss='rerun' triggers rerun"""
        # Implementation of E2E test
        pass

    def test_dialog_dismiss_callback(self):
        """Test that dismissing dialog with callback executes callback"""
        # Implementation of E2E test
        pass

```

**Run tests:** `make run-e2e-test e2e_playwright/st_dialog_on_dismiss_test.py`

### 7. Final Steps

1. **Run autofix:** `make autofix`
2. **Update documentation** (if requested)
3. **Manual testing** of all dismiss methods:
    - Clicking X button
    - Clicking background
    - Pressing Escape key

## Key Implementation Challenges

1. **Widget Registration Timing**: Dialog registration needs to happen during decorator execution, not when dialog is opened
2. **Simple State Management**: Using `trigger_value` type for simple boolean dismiss events instead of complex state serialization
3. **Event Handling**: All three dismiss methods (X, background, Escape) need to trigger the same widget event
4. **Backward Compatibility**: Default behavior must remain unchanged (`on_dismiss="ignore"`)
5. **Frontend Activation Logic**: Frontend determines dismiss functionality is active by checking if `id` field is present
6. **Form Compatibility**: Dialogs are not compatible with forms, so `form_id` is always empty string

## Testing Strategy

1. **Unit Tests**: Test parameter validation, state serialization, widget registration
2. **Integration Tests**: Test dialog-as-widget functionality with widget manager
3. **E2E Tests**: Test actual user interactions and rerun behavior
4. **Manual Testing**: Verify all dismiss methods work correctly

## Success Criteria

- ✅ `@st.dialog("title", on_dismiss="ignore")` - No behavior change (default)
- ✅ `@st.dialog("title", on_dismiss="rerun")` - Triggers rerun on dismiss
- ✅ `@st.dialog("title", on_dismiss=callback)` - Executes callback and triggers rerun
- ✅ All dismiss methods (X, background, Escape) trigger the event
- ✅ No breaking changes to existing dialog functionality
- ✅ Proper error handling for invalid `on_dismiss` values
