---
author: lukasmasuch
created: 2026-03-26
status: implemented
---

# ButtonColumn Technical Specification

## Summary

This document describes the technical implementation of `st.column_config.ButtonColumn`,
a new column type that renders clickable buttons in `st.dataframe` cells and triggers
Python callbacks when clicked.

## Problem

Adding interactive button actions to dataframe rows requires a new callback registration
pattern. Unlike existing column types (which are purely display-oriented) or selection
events (which use a single event handler), ButtonColumn needs to:

1. Register column-specific callbacks that work per-cell
2. Send click events with row/column/label context back to Python
3. Handle both single buttons and multi-action dropdown menus
4. Render custom button cells on the canvas (glide-data-grid)

The existing `on_select` pattern on `st.dataframe` provides a template, but ButtonColumn
requires extending the widget state to include a "click" trigger value.

## Proposal

### Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Python API    │────▶│    Protobuf      │────▶│    Frontend     │
│  ButtonColumn   │     │   column_config  │     │   ButtonCell    │
│  on_click       │     │   (JSON blob)    │     │   renderer      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                                 ┌─────────────────┐
                                                 │  BackMsg with   │
                                                 │  click trigger  │
                                                 └─────────────────┘
```

### Backend Implementation

#### 1. Column Type Definition

Add `ButtonColumnConfig`, `ButtonColumnResult`, and `ButtonColumn` to
`lib/streamlit/elements/lib/column_types.py`.

Since `ButtonColumn` needs to hold callback references (which can't be serialized to JSON),
it returns a wrapper class when `key` is specified:

```python
from dataclasses import dataclass

ButtonType = Literal["primary", "secondary", "tertiary"]


class ButtonColumnConfig(TypedDict):
    type: Literal["button"]
    button_type: NotRequired[ButtonType | None]


@dataclass(frozen=True)
class ButtonColumnResult:
    """Wrapper holding serializable config and callback references for ButtonColumn."""
    config: ColumnConfig
    on_click: WidgetCallback | None = None
    args: WidgetArgs | None = None
    kwargs: WidgetKwargs | None = None
    key: str | None = None


@gather_metrics("column_config.ButtonColumn")
def ButtonColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    pinned: bool | None = None,
    type: ButtonType = "secondary",
    on_click: WidgetCallback | None = None,
    args: WidgetArgs | None = None,
    kwargs: WidgetKwargs | None = None,
    key: str | None = None,
) -> ButtonColumnResult | ColumnConfig:
    """Configure a button column in ``st.dataframe``."""
    config = ColumnConfig(
        label=label,
        width=width,
        help=help,
        pinned=pinned,
        disabled=True,  # Button columns are always read-only
        type_config=ButtonColumnConfig(
            type="button",
            button_type=type,
        ),
    )

    # If key specified, return wrapper with callback refs; otherwise plain config
    if key is not None:
        return ButtonColumnResult(
            config=config,
            on_click=on_click,
            args=args,
            kwargs=kwargs,
            key=key,
        )

    # Raise an error if callbacks are provided without a key
    if on_click is not None or args is not None or kwargs is not None:
        raise StreamlitAPIException(
            "The `key` parameter is required when using `on_click`, `args`, or `kwargs` "
            "with `ButtonColumn`."
        )

    return config
```

#### 2. Processing ButtonColumn in st.dataframe

In `lib/streamlit/elements/arrow.py`, st.dataframe processes column_config to:
1. Extract serializable configs for the proto
2. Register widgets for ButtonColumns with keys

The processing happens inline in the `_dataframe` method. For each ButtonColumn with a key:

```python
# In _dataframe method, after processing column configs:
for col_name, col_config in column_config.items():
    if isinstance(col_config, ButtonColumnResult) and col_config.key is not None:
        # Register widget with unique ID
        widget_id = compute_and_register_element_id(
            "dataframe_button",
            user_key=col_config.key,
            key_as_main_identity=True,
            form_id=form_id,
        )

        button_serde = ButtonClickSerde()
        register_widget(
            widget_id,
            on_change_handler=col_config.on_click,
            args=col_config.args,
            kwargs=col_config.kwargs,
            deserializer=button_serde.deserialize,
            serializer=button_serde.serialize,
            ctx=ctx,
            value_type="string_trigger_value",
        )

        # Store widget ID in proto for frontend lookup
        proto.button_click_widgets[col_name] = widget_id
```

#### 3. Click State Serde

The `ButtonClickSerde` class handles serialization/deserialization of button click values
using the `StringTriggerValue` pattern (value resets after each run):

```python
import json
from streamlit.proto.Common_pb2 import StringTriggerValue


class ButtonClickSerde:
    """Serializer/deserializer for ButtonColumn click values."""

    def serialize(self, v: dict | None) -> StringTriggerValue:
        if v is None:
            return StringTriggerValue()
        return StringTriggerValue(data=json.dumps(v))

    def deserialize(self, ui_value: StringTriggerValue | None, _: str) -> dict | None:
        if ui_value is None or not ui_value.data:
            return None
        return json.loads(ui_value.data)
```

The click state is simple:
```python
{"row": 2, "label": ":material/delete: Delete"}
```

### Frontend Implementation

#### 1. ButtonColumn Type

Create `frontend/lib/src/components/widgets/DataFrame/columns/ButtonColumn.ts`:

```typescript
interface ButtonColumnParams {
  readonly button_type?: "primary" | "secondary" | "tertiary"
}

export type ButtonCellData = string | string[] | null

function ButtonColumn(props: BaseColumnProps): BaseColumn {
  const parameters = (props.columnTypeOptions as ButtonColumnParams) || {}
  const buttonType = parameters.button_type ?? "secondary"

  const cellTemplate: ButtonCell = {
    kind: GridCellKind.Custom,
    allowOverlay: false,
    copyData: "",
    readonly: true,
    data: {
      kind: "button-cell",
      data: null,
      buttonType,
    },
  }

  return {
    ...props,
    kind: "button",
    typeIcon: ":material/smart_button:",
    sortMode: "default",
    isEditable: false,
    getCell(data?: unknown): GridCell {
      // Handle null/undefined
      if (isNullOrUndefined(data)) {
        return cellTemplate with data: null
      }

      let buttonData: ButtonCellData
      // Strings become single buttons; arrays become multi-action menus
      if (typeof data === "string" && !looksLikeArray(data)) {
        buttonData = data
      } else {
        const arr = toSafeArray(data).map(item => toSafeString(item))
        buttonData = arr.length === 1 ? arr[0] : arr
      }

      return { ...cellTemplate, data: { ...cellTemplate.data, data: buttonData } }
    },
    getCellValue(cell: ButtonCell): ButtonCellData {
      return cell.data.data
    },
  }
}

ButtonColumn.isEditableType = false
```

#### 2. Custom Button Cell Renderer

Create `frontend/lib/src/components/widgets/DataFrame/columns/cells/ButtonCell.tsx`:

The button cell renderer uses glide-data-grid's custom cell pattern:

```typescript
/** Internal button padding (horizontal). */
const BUTTON_PADDING = 8

/** Gap between icon and text in button labels. */
const ICON_TEXT_GAP = 4

/** Tolerance margin for click detection to account for estimation errors. */
const CLICK_TOLERANCE = 8

interface ButtonCellProps {
  readonly kind: "button-cell"
  readonly data: ButtonCellData
  readonly buttonType: "primary" | "secondary" | "tertiary"
  readonly rowIndex?: number
  readonly onClick?: (rowIndex: number, label: string) => void
  readonly onOpenMenu?: (rowIndex: number, actions: string[], bounds: MenuBounds) => void
}

export type ButtonCell = CustomCell<ButtonCellProps>
```

**Key implementation details:**

1. **Icon parsing**: Uses `parseButtonLabel()` to extract leading Material icons from labels
   (`:material/icon_name:` syntax), leveraging existing `isMaterialIcon` and `parseIconPackEntry`
   utilities.

2. **Button bounds calculation**: `getButtonBounds()` calculates the centered button position
   within the cell based on content width and padding.

3. **Click detection with tolerance**: The `onClick` handler uses estimated content width
   (7px per character heuristic) since it doesn't have access to the canvas context. A
   `CLICK_TOLERANCE` margin (8px) compensates for the estimation mismatch with precise
   draw-time bounds.

4. **Hover and cursor**: Uses `needsHover: true` and `needsHoverPosition: true` to track
   hover state and show pointer cursor when over the button.

**Button styling by type:**

```typescript
switch (buttonType) {
  case "primary":
    bgColor = isHovered ? darken(accentColor, 0.15) : accentColor
    textColor = readableColor(accentColor)
    break
  case "secondary":
    bgColor = isHovered ? bgHeaderHovered : "transparent"
    borderColor = borderColor  // Outlined style
    textColor = textDark
    break
  case "tertiary":
    bgColor = "transparent"
    textColor = isHovered ? accentColor : textDark
    break
}
```

**Multi-action menu icon**: For cells with 2+ actions, draws `more_vert` icon using the
Material Symbols font.

#### 3. Button Action Menu Component

Create `frontend/lib/src/components/widgets/DataFrame/menus/ButtonActionMenu.tsx`:

The menu uses BaseUI's `Popover` component with a virtual anchor:

```typescript
interface ButtonActionMenuProps {
  top: number      // Viewport Y position
  left: number     // Viewport X position
  actions: string[]
  onSelectAction: (label: string) => void
  onCloseMenu: () => void
}

function ButtonActionMenu({ top, left, actions, onSelectAction, onCloseMenu }) {
  // Close menu when user scrolls (fixed position would become misaligned)
  useEffect(() => {
    function handleScroll() { onCloseMenu() }
    document.addEventListener("scroll", handleScroll, { capture: true })
    document.addEventListener("wheel", handleScroll, { passive: true })
    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true })
      document.removeEventListener("wheel", handleScroll)
    }
  }, [onCloseMenu])

  return (
    <Popover
      autoFocus
      isOpen
      placement={PLACEMENT.bottomRight}
      onClickOutside={onCloseMenu}
      onEsc={onCloseMenu}
      content={
        <StyledMenuList role="menu">
          {actions.map((label, index) => {
            const { icon, text } = extractLeadingMaterialIcon(label)
            return (
              <StyledMenuListItem onClick={() => onSelectAction(label)}>
                {icon && <DynamicIcon iconValue={icon} />}
                <StreamlitMarkdown source={text} isLabel />
              </StyledMenuListItem>
            )
          })}
        </StyledMenuList>
      }
    >
      {/* Invisible anchor positioned at click location */}
      <div style={{ position: "fixed", top, left, visibility: "hidden" }} />
    </Popover>
  )
}
```

**Key design decisions:**

- Uses `extractLeadingMaterialIcon` (shared utility) for icon parsing in menu items
- Renders label text with `StreamlitMarkdown` for markdown support
- Closes on scroll to prevent misalignment with the cell
- Positioned using fixed coordinates from the click event

#### 4. Click Event Wiring in DataFrame Component

In `DataFrame.tsx`, the click handlers are wired up:

```typescript
// Handle single button clicks
const handleButtonClick = useCallback(
  (columnName: string, rowIndex: number, label: string) => {
    if (!widgetMgr) return
    const widgetId = element.buttonClickWidgets[columnName]
    if (!widgetId) return

    const clickState = JSON.stringify({ row: rowIndex, label })
    widgetMgr.setStringTriggerValue(
      { id: widgetId, formId: element.formId },
      clickState,
      { fromUi: true },
      fragmentId
    )
  },
  [widgetMgr, element.buttonClickWidgets, element.formId, fragmentId]
)

// Handle multi-action menu opening
const handleOpenButtonMenu = useCallback(
  (columnName: string, rowIndex: number, actions: string[], bounds: MenuBounds) => {
    setButtonActionMenu({
      columnName,
      rowIndex,
      actions,
      screenTop: bounds.clickY,
      screenLeft: bounds.clickX,
    })
  },
  []
)
```

The callbacks are injected into button cells during cell content retrieval:

```typescript
const getCellContent = useCallback(([col, row]: Item): GridCell => {
  const cell = getSortedCellContent([col, row])

  if (cell.kind === GridCellKind.Custom && cell.data?.kind === "button-cell") {
    const column = columns[col]
    const originalRowIndex = getOriginalIndex(row)

    // Inject click handlers and row index
    return {
      ...cell,
      data: {
        ...cell.data,
        rowIndex: originalRowIndex,
        onClick: (rowIdx, label) => handleButtonClick(column.name, rowIdx, label),
        onOpenMenu: (rowIdx, actions, bounds) =>
          handleOpenButtonMenu(column.name, rowIdx, actions, bounds),
      },
    }
  }

  return cell
}, [/* deps */])
```

#### 5. CSV Export Exclusion

Button columns are excluded from CSV export since button labels are not meaningful data.
The `isEditableType = false` flag on ButtonColumn ensures button columns are never included
in editable data exports.

#### 6. Register Column Type

In `frontend/lib/src/components/widgets/DataFrame/columns/index.ts`:

```typescript
import ButtonColumn from "./ButtonColumn"
import ButtonCellRenderer from "./cells/ButtonCell"

export const ColumnTypes = new Map<string, ColumnCreator>(
  Object.entries({
    // ... existing types ...
    button: ButtonColumn,
  })
)

export const CustomCells = [
  // ... existing renderers ...
  ButtonCellRenderer,
]
```

### Protocol / Serialization

**Protobuf changes:**

Add a map field to `Dataframe.proto` to communicate widget IDs for each ButtonColumn:

```protobuf
message Dataframe {
  // ... existing fields ...

  // Map of column name → widget ID for button click events
  map<string, string> button_click_widgets = 13;
}
```

**Column configuration (JSON blob in `Dataframe.columns`):**

```json
{
  "view": {
    "label": "",
    "disabled": true,
    "type_config": {
      "type": "button",
      "button_type": "tertiary"
    }
  },
  "actions": {
    "label": "Actions",
    "disabled": true,
    "type_config": {
      "type": "button",
      "button_type": "secondary"
    }
  }
}
```

**Click state (sent as StringTriggerValue to the column's widget ID):**

```json
{"row": 2, "label": ":material/delete: Delete"}
```

The frontend looks up the widget ID for the clicked column in `button_click_widgets`
and sends the click state via `setStringTriggerValue`.

### State Management

**Click as trigger value (like st.menu_button):**

Each ButtonColumn with `key` gets its own widget using `StringTriggerValue`:

1. Value exists only when a button in that column was clicked
2. Automatically resets to `None` on subsequent reruns
3. Accessed via `st.session_state[key]`
4. If `on_click` is provided, callback runs before the rest of the script

**Per-column widget registration:**

Each ButtonColumn with `key` is registered as a separate widget:

```python
# User code:
st.dataframe(df, column_config={
    "view": st.column_config.ButtonColumn(on_click=h1, key="k1"),
    "edit": st.column_config.ButtonColumn(on_click=h2, key="k2"),
})

# Results in two widgets:
# - Widget "k1" for "view" column → callback h1, st.session_state.k1
# - Widget "k2" for "edit" column → callback h2, st.session_state.k2
```

**Interaction with selection:**

- Button clicks do NOT clear selection state (different widgets)
- Selection changes do NOT affect button click state

### Testing Strategy

**Python unit tests** (in `lib/tests/streamlit/elements/lib/column_types_test.py`):

- `ButtonColumn` returns `ButtonColumnResult` when `key` specified
- `ButtonColumn` returns plain `ColumnConfig` when no key
- Error raised when `on_click`/`args`/`kwargs` provided without `key`
- Click state serialization/deserialization with `StringTriggerValue`

**Python type tests** (in `lib/tests/streamlit/typing/button_column_types.py`):

- Type checking for `ButtonColumn` parameters and return types
- `ButtonColumnResult` vs `ColumnConfig` return type based on `key`

**Frontend unit tests**:

- `ButtonColumn.test.ts`: Column type creates correct cell types for various inputs
- `ButtonCell.test.tsx`: Cell renderer draws correctly and handles clicks

**E2E tests** (in `e2e_playwright/st_dataframe_config_test.py`):

- `test_button_column_click`: Single button click stores trigger value in session state
- `test_button_column_multi_action_menu`: Multi-action dropdown opens and selection triggers callback
- Snapshot test for button column rendering (primary, secondary, tertiary styles)

## Alternatives Considered

### Alternative 1: Callback on st.dataframe

Add `on_button_click` parameter to `st.dataframe` instead of per-column callbacks:

```python
st.dataframe(
    df,
    on_button_click=handle_click,  # Single handler for all button columns
    column_config={...},
)
```

**Rejected because:**
- Single callback must dispatch based on column name (less intuitive)
- Inconsistent with per-column configuration pattern
- Users want different callbacks for different actions (view vs delete)
- Per-column callbacks using `ButtonColumnResult` wrapper works well

### Alternative 2: Return click info instead of trigger

Instead of storing click in session state, return it from `st.dataframe`:

```python
result = st.dataframe(df, ...)
if result.click:
    handle_click(result.click)
```

**Rejected because:**
- Doesn't support callbacks with `args`/`kwargs`
- Inconsistent with widget callback pattern
- Click info would be lost on next interaction without storing anyway

### Alternative 3: Use fragment/partial rerun

Button clicks could trigger a fragment rerun instead of full rerun:

```python
@st.fragment
def my_table():
    st.dataframe(df, on_click=handle_click)
```

**Not rejected, but orthogonal:**
- Users can wrap in fragment if they want partial rerun
- Default should be full rerun for consistency with other widgets

### Alternative 4: Dedicated widget state key for clicks

Instead of extending DataframeState, use a separate session state key:

```python
# Click stored at: st.session_state["my_table_click"]
# Selection at: st.session_state["my_table"]
```

**Rejected because:**
- Fragments user's mental model
- Harder to access related state together
- Inconsistent with how selection state works

## Implementation Plan

All items are complete:

1. ✅ **Protobuf** - Added `button_click_widgets` map field to `Dataframe.proto`
2. ✅ **Backend: Column type** - Added `ButtonColumnResult` class and `ButtonColumn` function
3. ✅ **Backend: Processing** - Integrated button column processing in `arrow.py`
4. ✅ **Backend: Serde** - Implemented `ButtonClickSerde` with `StringTriggerValue`
5. ✅ **Frontend: ButtonColumn** - Implemented column type with icon parsing
6. ✅ **Frontend: ButtonCell** - Custom cell renderer with button/menu drawing
7. ✅ **Frontend: ButtonActionMenu** - Dropdown menu component for multi-actions
8. ✅ **Frontend: Click events** - Wired up click handlers in DataFrame component
9. ✅ **Testing** - Unit and E2E tests complete
10. 🔲 **Documentation** - API docs and examples (pending release)
