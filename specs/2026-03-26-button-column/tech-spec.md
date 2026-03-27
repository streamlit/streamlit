---
author: lukasmasuch
created: 2026-03-26
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

Add `ButtonColumnConfig` and `ButtonColumn` to `lib/streamlit/elements/lib/column_types.py`.

Since `ButtonColumn` needs to hold callback references (which can't be serialized to JSON),
it returns a wrapper class when `key` is specified:

```python
from dataclasses import dataclass

@dataclass
class ButtonColumnResult:
    """Wrapper holding serializable config and callback references."""
    config: ColumnConfig  # JSON-serializable part
    on_click: WidgetCallback | None = None
    args: WidgetArgs | None = None
    kwargs: WidgetKwargs | None = None
    key: str | None = None


class ButtonColumnConfig(TypedDict):
    type: Literal["button"]
    button_type: NotRequired[Literal["primary", "secondary", "tertiary"] | None]


@gather_metrics("column_config.ButtonColumn")
def ButtonColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    pinned: bool | None = None,
    type: Literal["primary", "secondary", "tertiary"] = "secondary",
    on_click: WidgetCallback | None = None,
    args: WidgetArgs | None = None,
    kwargs: WidgetKwargs | None = None,
    key: str | None = None,
) -> ButtonColumnResult | ColumnConfig:
    """Configure a button column in ``st.dataframe``."""
    config: ColumnConfig = {
        "label": label,
        "width": width,
        "help": help,
        "pinned": pinned,
        "disabled": True,  # Button columns are always read-only
        "type_config": {
            "type": "button",
            "button_type": type,
        },
    }

    # If key specified, return wrapper with callback refs; otherwise plain config
    if key is not None:
        return ButtonColumnResult(
            config=config,
            on_click=on_click,
            args=args,
            kwargs=kwargs,
            key=key,
        )
    return config
```

#### 2. Processing ButtonColumn in st.dataframe

In `lib/streamlit/elements/arrow.py`, st.dataframe processes column_config to:
1. Extract serializable configs for the proto
2. Register widgets for ButtonColumns with keys

```python
def _process_button_columns(
    column_config: ColumnConfigMappingInput,
    proto: DataframeProto,
    ctx: ScriptRunContext | None,
    dg: DeltaGenerator,
) -> tuple[dict[str, str], dict[str, ColumnConfig]]:
    """Process ButtonColumns, register widgets, return column→widget_id mapping."""
    button_widgets: dict[str, str] = {}
    processed_config: dict[str, ColumnConfig] = {}

    for col_name, config in (column_config or {}).items():
        if isinstance(config, ButtonColumnResult):
            # Extract serializable config
            processed_config[col_name] = config.config

            # Register widget if key specified
            if config.key is not None:
                widget_id = compute_and_register_element_id(
                    "dataframe_button",
                    user_key=config.key,
                    key_as_main_identity=True,
                    dg=dg,
                    dataframe_id=proto.id,
                    column=col_name,
                )

                serde = ButtonClickSerde()
                register_widget(
                    widget_id,
                    on_change_handler=config.on_click,
                    args=config.args,
                    kwargs=config.kwargs,
                    deserializer=serde.deserialize,
                    serializer=serde.serialize,
                    ctx=ctx,
                    value_type="string_trigger_value",
                )

                button_widgets[col_name] = widget_id
        else:
            processed_config[col_name] = config

    return button_widgets, processed_config
```

#### 3. Click State Serde

Simple serde for button click trigger values:

```python
import json
from streamlit.proto.Common_pb2 import StringTriggerValue

class ButtonClickSerde:
    """Serialize/deserialize button click trigger values."""

    def serialize(self, v: dict | None) -> StringTriggerValue:
        if v is None:
            return StringTriggerValue()
        return StringTriggerValue(data=json.dumps(v))

    def deserialize(self, ui_value: str | None) -> dict | None:
        if ui_value is None:
            return None
        return json.loads(ui_value)
```

The click state is simple:
```python
{"row": 2, "label": ":material/delete: Delete"}
```

### Frontend Implementation

#### 1. ButtonColumn Type

Create `frontend/lib/src/components/widgets/DataFrame/columns/ButtonColumn.ts`:

```typescript
export interface ButtonColumnParams {
  readonly button_type?: "primary" | "secondary" | "tertiary"
}

function ButtonColumn(props: BaseColumnProps): BaseColumn {
  const parameters = (props.columnTypeOptions as ButtonColumnParams) || {}
  const buttonType = parameters.button_type ?? "secondary"

  return {
    ...props,
    kind: "button",
    typeIcon: ":material/smart_button:",
    sortMode: "default",
    getCell(data?: unknown): GridCell {
      // Return custom ButtonCell
    },
    getCellValue(cell: ButtonCell): string | string[] | null {
      return cell.data
    },
  }
}
```

#### 2. Custom Button Cell

Create `frontend/lib/src/components/widgets/DataFrame/columns/cells/ButtonCell.tsx`:

The button cell renderer is inspired by glide-data-grid's button-cell pattern:

```typescript
interface ButtonCellProps {
  readonly kind: "button-cell"
  readonly data: string | string[] | null
  readonly buttonType: "primary" | "secondary" | "tertiary"
  readonly onClick?: (label: string) => void
}

const ButtonCellRenderer: CustomRenderer<ButtonCellProps> = {
  kind: GridCellKind.Custom,
  isMatch: (cell): cell is ButtonCellProps => cell.kind === "button-cell",

  draw: (args, cell) => {
    const { ctx, rect, theme, hoverAmount } = args
    const { data, buttonType } = cell

    if (!data) return true

    if (typeof data === "string") {
      // Single button
      drawButton(ctx, rect, data, buttonType, theme, hoverAmount)
    } else if (Array.isArray(data) && data.length > 1) {
      // Multiple actions - draw three-dot menu icon
      drawMenuIcon(ctx, rect, theme, hoverAmount)
    } else if (Array.isArray(data) && data.length === 1) {
      // Single item in array - draw as single button
      drawButton(ctx, rect, data[0], buttonType, theme, hoverAmount)
    }

    return true
  },

  onClick: (args) => {
    const { cell, bounds, posX, posY, theme } = args

    if (isHovered(bounds, posX, posY, theme)) {
      if (typeof cell.data === "string") {
        cell.onClick?.(cell.data)
      } else if (Array.isArray(cell.data) && cell.data.length > 1) {
        // Open dropdown menu
        return {
          // Return menu config to open dropdown
          menu: cell.data,
        }
      } else if (Array.isArray(cell.data) && cell.data.length === 1) {
        cell.onClick?.(cell.data[0])
      }
    }

    return undefined
  },
}
```

**Button rendering:**

- Draw rounded rectangle background with appropriate color based on `buttonType`
- Use minimal horizontal padding (4px) for a compact appearance
- Center text within the button bounds
- Handle hover state with color transition (200ms animation)
- Use theme colors for consistency

```typescript
// Button sizing constants - keep padding minimal for compact cells
const BUTTON_PADDING_X = 4   // Horizontal padding inside button
const BUTTON_PADDING_Y = 2   // Vertical padding inside button
const CELL_PADDING_X = 4     // Padding between cell edge and button
const CELL_PADDING_Y = 4     // Padding between cell edge and button

interface ButtonBounds {
  x: number
  y: number
  width: number
  height: number
}

function calculateButtonBounds(cellRect: Rectangle, contentWidth: number): ButtonBounds {
  // Button width: content + minimal padding, constrained to cell
  const buttonWidth = Math.min(
    contentWidth + BUTTON_PADDING_X * 2,
    cellRect.width - CELL_PADDING_X * 2
  )
  const buttonHeight = cellRect.height - CELL_PADDING_Y * 2

  return {
    x: cellRect.x + (cellRect.width - buttonWidth) / 2,  // Center horizontally
    y: cellRect.y + CELL_PADDING_Y,
    width: buttonWidth,
    height: buttonHeight,
  }
}
```

**Material icon support in labels:**

Labels can include a leading Material icon (`:material/icon_name: Text` or just `:material/icon_name:`).
Following the pattern from `LinkColumn.ts`:

```typescript
import {
  isMaterialIcon,
  parseIconPackEntry,
} from "~lib/components/shared/Icon/DynamicIcon"
import { genericFonts } from "~lib/theme/primitives/typography"

interface ParsedLabel {
  icon: string | null    // Icon name (e.g., "delete") or null
  text: string           // Remaining text after icon
}

function parseButtonLabel(label: string): ParsedLabel {
  // Match leading :material/icon_name: pattern
  const iconMatch = label.match(/^:material\/([^:]+):(.*)$/)

  if (iconMatch && isMaterialIcon(`:material/${iconMatch[1]}:`)) {
    return {
      icon: parseIconPackEntry(`:material/${iconMatch[1]}:`).icon,
      text: iconMatch[2].trim(),
    }
  }

  return { icon: null, text: label }
}

function drawButton(
  ctx: CanvasRenderingContext2D,
  cellRect: Rectangle,
  label: string,
  buttonType: ButtonType,
  theme: Theme,
  hoverAmount: number
) {
  const { icon, text } = parseButtonLabel(label)

  // Calculate content width first
  const iconWidth = icon ? theme.baseFontSize : 0
  const gap = icon && text ? 4 : 0
  ctx.font = `${theme.baseFontSize}px ${theme.fontFamily}`
  const textWidth = text ? ctx.measureText(text).width : 0
  const contentWidth = iconWidth + gap + textWidth

  // Calculate tight button bounds with minimal padding
  const bounds = calculateButtonBounds(cellRect, contentWidth)

  // Draw button background within calculated bounds
  drawButtonBackground(ctx, bounds, buttonType, theme, hoverAmount)

  const centerY = bounds.y + bounds.height / 2

  if (icon && text) {
    // Icon + text: draw icon left, text right
    const totalWidth = iconWidth + gap + textWidth
    const startX = bounds.x + (bounds.width - totalWidth) / 2

    // Draw icon
    ctx.font = `${theme.baseFontSize}px '${genericFonts.iconFont}'`
    ctx.fillText(icon, startX, centerY)

    // Draw text
    ctx.font = `${theme.baseFontSize}px ${theme.fontFamily}`
    ctx.fillText(text, startX + iconWidth + gap, centerY)

  } else if (icon) {
    // Icon-only button
    ctx.font = `${theme.baseFontSize}px '${genericFonts.iconFont}'`
    ctx.textAlign = "center"
    ctx.fillText(icon, bounds.x + bounds.width / 2, centerY)

  } else {
    // Text-only button
    ctx.font = `${theme.baseFontSize}px ${theme.fontFamily}`
    ctx.textAlign = "center"
    ctx.fillText(text, bounds.x + bounds.width / 2, centerY)
  }
}
```

**Menu icon rendering:**

For multi-action cells, render a compact button with `:material/more_vert:` icon:

```typescript
function drawMenuIcon(
  ctx: CanvasRenderingContext2D,
  cellRect: Rectangle,
  theme: Theme,
  hoverAmount: number
) {
  // Menu icon button is square, sized to icon + minimal padding
  const iconSize = theme.baseFontSize
  const buttonSize = iconSize + BUTTON_PADDING_X * 2

  const bounds: ButtonBounds = {
    x: cellRect.x + (cellRect.width - buttonSize) / 2,
    y: cellRect.y + (cellRect.height - buttonSize) / 2,
    width: buttonSize,
    height: buttonSize,
  }

  // Draw subtle background on hover
  if (hoverAmount > 0) {
    drawButtonBackground(ctx, bounds, "tertiary", theme, hoverAmount)
  }

  ctx.font = `${theme.baseFontSize}px 'Material Symbols Rounded'`
  ctx.fillStyle = interpolateColors(
    theme.textDark,
    theme.accentColor,
    hoverAmount
  )
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("more_vert", bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}
```

#### 3. Dropdown Menu for Multi-Actions

When a multi-action cell is clicked, display a dropdown menu. Reuse the pattern from
`MenuButton.tsx` which uses BaseUI's `Popover` and `StatefulMenu`.

**Menu positioning:**

The menu must be anchored to the actual click location, not calculated from cell bounds.
Cell bounds from glide-data-grid use internal grid coordinates that don't reliably map to
viewport coordinates when columns are resized or the grid is scrolled.

**Use click event coordinates directly:**

```typescript
interface MenuAnchor {
  x: number      // Viewport X position
  y: number      // Viewport Y position
  width: number  // Anchor width (for popover alignment)
  height: number // Anchor height
}

// In the cell click handler, capture the click position
function handleCellClick(args: GridMouseCellEventArgs): MenuState | undefined {
  const { cell, bounds, localEventX, localEventY, ...rest } = args

  if (cell.kind !== "button-cell" || !Array.isArray(cell.data) || cell.data.length <= 1) {
    return undefined
  }

  // Get the grid container's position
  const gridRect = gridRef.current?.getBoundingClientRect()
  if (!gridRect) return undefined

  // Use the click position directly - it's already relative to the grid
  // Convert to viewport coordinates
  const clickX = gridRect.left + bounds.x + localEventX
  const clickY = gridRect.top + bounds.y + localEventY

  // Menu icon button size (same as rendering)
  const iconSize = theme.baseFontSize
  const buttonSize = iconSize + BUTTON_PADDING_X * 2

  return {
    isOpen: true,
    actions: cell.data,
    anchor: {
      // Center the anchor on the click point, offset up/left by half button size
      x: clickX - buttonSize / 2,
      y: clickY - buttonSize / 2,
      width: buttonSize,
      height: buttonSize,
    },
    row: args.location[1],
  }
}
```

**Why click coordinates work better:**
- `localEventX`/`localEventY` are the click position within the cell bounds
- Combined with `bounds.x`/`bounds.y` and `gridRect`, this gives accurate viewport position
- No dependency on column width calculations or scroll offset tracking
- The click is guaranteed to be on the button (since that's what triggered the event)

The virtual anchor is rendered as an invisible positioned `<div>` that the Popover
attaches to:

```typescript
// Virtual anchor element positioned at button center
const VirtualAnchor = styled.div<{ $anchor: MenuAnchor }>`
  position: fixed;
  pointer-events: none;
  left: ${({ $anchor }) => $anchor.x}px;
  top: ${({ $anchor }) => $anchor.y}px;
  width: ${({ $anchor }) => $anchor.width}px;
  height: ${({ $anchor }) => $anchor.height}px;
`

// Menu option component (same pattern as MenuButton)
const ButtonCellMenuOption = memo(function ButtonCellMenuOption({
  item,
  $isHighlighted,
  onClick,
  ...props
}: MenuOptionProps) {
  const { icon, text } = extractLeadingMaterialIcon(item.label)
  return (
    <StyledMenuItem {...props} onClick={onClick}>
      <StyledHighlightWrapper $isHighlighted={$isHighlighted}>
        <StyledMenuOptionLabel>
          {icon && (
            <StyledMenuOptionIcon aria-hidden="true">
              <DynamicIcon iconValue={icon} size="md" />
            </StyledMenuOptionIcon>
          )}
          <StreamlitMarkdown
            source={text}
            allowHTML={false}
            isLabel
            largerLabel={false}
            disableLinks
          />
        </StyledMenuOptionLabel>
      </StyledHighlightWrapper>
    </StyledMenuItem>
  )
})

// Dropdown menu component
function ButtonCellMenu({
  actions,
  anchor,
  isOpen,
  onClose,
  onSelect,
}: ButtonCellMenuProps) {
  const theme = useEmotionTheme()

  const menuItems = useMemo(
    () => actions.map(label => ({ label, value: label })),
    [actions]
  )

  return (
    <UIPopover
      triggerType={TRIGGER_TYPE.click}
      placement={PLACEMENT.bottom}  // Center below the button
      isOpen={isOpen}
      onClickOutside={onClose}
      onEsc={onClose}
      popoverMargin={convertRemToPx(theme.spacing.twoXS)}
      content={() => (
        <StatefulMenu
          items={menuItems}
          onItemSelect={({ item }) => onSelect(item.value)}
          overrides={{
            List: {
              style: {
                backgroundColor: theme.colors.bgColor,
                paddingTop: theme.spacing.threeXS,
                paddingBottom: theme.spacing.threeXS,
                // ... same styling as MenuButton
              },
            },
            Option: { component: ButtonCellMenuOption },
          }}
        />
      )}
      // ... same Body overrides as MenuButton
    >
      <VirtualAnchor $anchor={anchor} />
    </UIPopover>
  )
}
```

Key benefits of reusing the MenuButton pattern:
- Consistent look and feel with `st.menu_button`
- Built-in keyboard navigation (arrow keys, Enter, Escape)
- Proper focus management and accessibility
- `extractLeadingMaterialIcon` already handles icon parsing
- `StreamlitMarkdown` renders any markdown in labels

#### 4. Click Event Propagation

When a button is clicked, look up the widget ID for that column and send the event:

```typescript
// In useWidgetState.ts or similar hook
const handleButtonClick = useCallback(
  (row: number, column: string, label: string) => {
    // Look up widget ID for this column
    const widgetId = element.buttonClickWidgets[column]
    if (!widgetId) {
      // No callback registered for this column
      return
    }

    const clickState = JSON.stringify({ row, label })
    widgetMgr.setStringTriggerValue(
      widgetId,
      clickState,
      { fromUi: true }
    )
  },
  [element.buttonClickWidgets, widgetMgr]
)
```

The `buttonClickWidgets` map comes from `proto.button_click_widgets` and maps
column names to their corresponding widget IDs.
```

The click uses `setStringTriggerValue` which corresponds to `value_type="string_trigger_value"`
on the backend. The widget manager automatically resets trigger values after each run.

#### 5. CSV Export Exclusion

Button columns should be excluded from CSV export since button labels are not meaningful data:

```typescript
// In the CSV export logic (e.g., DataFrameToolbar or export utilities)
function getExportableColumns(columns: BaseColumn[]): BaseColumn[] {
  return columns.filter(col => col.kind !== "button")
}
```

The backend also sets `disabled: true` on ButtonColumn configs, ensuring they're always read-only
even if used in `st.data_editor`.

#### 6. Register Column Type

Add to `frontend/lib/src/components/widgets/DataFrame/columns/index.ts`:

```typescript
import ButtonColumn from "./ButtonColumn"

export const ColumnTypes = new Map<string, ColumnCreator>(
  Object.entries({
    // ... existing types ...
    button: ButtonColumn,
  })
)

// Register custom cell renderer
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

**Python unit tests:**

- `ButtonColumn` returns `ButtonColumnResult` when `key` specified
- `ButtonColumn` returns plain `ColumnConfig` when no key
- Widget registration for each ButtonColumn with key
- Click state serialization/deserialization with `StringTriggerValue`
- Multiple ButtonColumns register separate widgets

**Frontend unit tests:**

- ButtonColumn creates correct cell types
- ButtonCell renders single button correctly
- ButtonCell renders menu icon for multi-action
- Click events use correct widget ID from `buttonClickWidgets` map
- Menu opens on multi-action click

**E2E tests:**

- Single button click stores trigger value in session state
- Multi-action dropdown opens on click
- Menu selection triggers callback with correct label
- Click state available in session state
- Different button types render correctly

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

1. **Protobuf** - Add `button_click_widgets` map field to `Dataframe.proto`
2. **Backend: Column type** - Add `ButtonColumnResult` class and `ButtonColumn` function
3. **Backend: Processing** - Add `_process_button_columns` to extract callbacks and register widgets
4. **Backend: Serde** - Implement `ButtonClickSerde` with `StringTriggerValue`
5. **Frontend: ButtonColumn** - Implement column type with icon parsing
6. **Frontend: ButtonCell** - Custom cell renderer with button/menu
7. **Frontend: Click events** - Wire up click handlers using `buttonClickWidgets` map
8. **Testing** - Unit and E2E tests
9. **Documentation** - API docs and examples
