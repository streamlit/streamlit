# Implementation Plan: Width and Height Support for st.table

## Overview

Add support for configuring `width` and `height` parameters in `st.table` to allow users to control table dimensions and enable scrolling for larger tables while keeping headers and index columns fixed (sticky).

## User Requirements

Based on feature requests (#10775, #10820):
1. **Width control**: `width: "content" | "stretch" | int` - ability to size the table to content, stretch to container, or use fixed pixel width
2. **Height control**: `height: "content" | "stretch" | int` - ability to size the table to content, stretch to container, or use fixed pixel height
3. **Scrolling**: When content exceeds the specified dimensions, the table should scroll with sticky headers and index columns

## Current State Analysis

### Backend (Python)
- `st.table` is implemented in `lib/streamlit/elements/arrow.py`
- Currently uses `LayoutConfig(width="stretch", height="content")` hardcoded
- Layout utilities already exist in `lib/streamlit/elements/lib/layout_utils.py` with validators for width/height

### Frontend (TypeScript)
- `ArrowTable` component in `frontend/lib/src/components/elements/ArrowTable/`
- Currently renders a basic HTML table with overflow on the border wrapper
- No support for sticky headers/index during scroll
- Layout is handled by `StyledElementContainerLayoutWrapper` using `useLayoutStyles`

### Proto
- `Table.proto` only has `arrow_data` and `border_mode`
- Layout config is passed separately via the element's `widthConfig` and `heightConfig`

## Implementation Plan

### Phase 1: Backend Changes

#### 1.1 Update `st.table` API (lib/streamlit/elements/arrow.py)

Add `width` and `height` parameters to `st.table`:

```python
def table(
    self,
    data: Data = None,
    *,
    border: bool | Literal["horizontal"] = True,
    width: Width = "stretch",  # NEW
    height: Height = "content",  # NEW
) -> DeltaGenerator:
```

Changes:
- Add `width` and `height` parameters with sensible defaults
- Validate using existing `validate_width()` and `validate_height()` from `layout_utils.py`
- Pass width/height through `LayoutConfig` (already done for dataframe)

#### 1.2 Update docstrings

Add documentation for the new parameters following the same pattern as `st.dataframe`.

### Phase 2: Frontend Changes

#### 2.1 Update ArrowTable Component (ArrowTable.tsx)

Add props for width/height configs:

```typescript
export interface TableProps {
  element: TableProto
  data: Quiver
  widthConfig?: streamlit.IWidthConfig | null  // NEW
  heightConfig?: streamlit.IHeightConfig | null  // NEW
}
```

Pass these to the styled components for proper sizing.

#### 2.2 Update Styled Components (styled-components.ts)

Create new scrollable table container with sticky header/index support:

```typescript
export const StyledScrollableTableContainer = styled.div<{
  hasFixedHeight: boolean
}>(({ hasFixedHeight }) => ({
  overflow: hasFixedHeight ? "auto" : "visible",
  position: "relative",
  maxHeight: "100%",
  maxWidth: "100%",
}))
```

Add sticky positioning to header and index cells:

```typescript
export const StyledTableCellHeader = styled.th<{
  borderMode: Table.BorderMode
  isSticky?: boolean  // NEW
}>(({ theme, borderMode, isSticky }) => ({
  ...styleCellFunction(theme, borderMode),
  position: isSticky ? "sticky" : undefined,
  top: isSticky ? 0 : undefined,
  left: isSticky ? 0 : undefined,  // For index column
  backgroundColor: isSticky ? theme.colors.bgColor : undefined,
  zIndex: isSticky ? 1 : undefined,
}))
```

#### 2.3 Update ElementNodeRenderer (ElementNodeRenderer.tsx)

Pass widthConfig and heightConfig to ArrowTable:

```typescript
case "table": {
  const tableProto = node.element.table as TableProto
  return (
    <ArrowTable
      element={tableProto}
      data={node.quiverElement}
      widthConfig={node.element.widthConfig}  // NEW
      heightConfig={node.element.heightConfig}  // NEW
      {...elementProps}
    />
  )
}
```

#### 2.4 Update StyledElementContainerLayoutWrapper

Add "table" to LARGE_STRETCH_BEHAVIOR array to use 14rem minimum width for stretch behavior.

### Phase 3: CSS Sticky Header/Index Implementation

The key challenge is implementing sticky headers and index columns for scrolling tables.

#### Approach:
1. Use CSS `position: sticky` for header (`<th>` in `<thead>`) and index cells
2. Header cells get `position: sticky; top: 0`
3. Index cells (first column, type INDEX) get `position: sticky; left: 0`
4. Corner cell (header + index intersection) gets `position: sticky; top: 0; left: 0; z-index: 2`
5. Ensure proper z-index stacking (corner > header/index > content)
6. Set background color on sticky cells to prevent content showing through

### Phase 4: Testing

#### 4.1 Unit Tests

**Frontend (ArrowTable.test.tsx):**
- Test that widthConfig/heightConfig props are passed correctly
- Test sticky header rendering when height is fixed
- Test sticky index rendering when width is fixed
- Test scrolling behavior

**Backend (Python):**
- Test width/height validation in st.table
- Test LayoutConfig is created correctly

#### 4.2 E2E Tests (e2e_playwright/st_table_test.py)

Add tests for:
- `st.table(df, width=500)` - fixed pixel width
- `st.table(df, height=300)` - fixed pixel height with scrolling
- `st.table(df, width="content")` - content-based width
- `st.table(df, height="stretch")` - stretch height in container
- Verify sticky headers work during vertical scroll
- Verify sticky index works during horizontal scroll

### Phase 5: Documentation

Update docstrings with examples similar to st.dataframe documentation.

## Files to Modify

### Backend
1. `lib/streamlit/elements/arrow.py` - Add width/height parameters to st.table

### Frontend
1. `frontend/lib/src/components/elements/ArrowTable/ArrowTable.tsx` - Add props and sticky logic
2. `frontend/lib/src/components/elements/ArrowTable/styled-components.ts` - Add sticky styles
3. `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx` - Pass configs to ArrowTable
4. `frontend/lib/src/components/core/Block/StyledElementContainerLayoutWrapper.tsx` - Add table to stretch behavior

### Tests
1. `frontend/lib/src/components/elements/ArrowTable/ArrowTable.test.tsx` - Frontend unit tests
2. `e2e_playwright/st_table.py` - Update test app
3. `e2e_playwright/st_table_test.py` - Add E2E tests

## Default Behavior

- **width**: `"stretch"` (current behavior - table stretches to container width)
- **height**: `"content"` (current behavior - table shows all rows)

This maintains backward compatibility while enabling new features.

## Technical Considerations

1. **Sticky positioning limitations**: CSS sticky only works when the parent has a defined scrolling context (overflow: auto/scroll)
2. **Z-index management**: Need careful layering - corner cell > header cells > index cells > data cells
3. **Background colors**: Sticky cells need opaque backgrounds to hide content scrolling underneath
4. **Border handling**: Border mode interactions with sticky positioning need to be tested
5. **Performance**: Large tables with many sticky cells could impact scroll performance

## Implementation Order

1. Backend: Add width/height parameters to st.table API
2. Frontend: Pass widthConfig/heightConfig to ArrowTable component
3. Frontend: Update styled components with scrollable container
4. Frontend: Implement sticky headers for vertical scroll
5. Frontend: Implement sticky index column for horizontal scroll
6. Testing: Add unit tests
7. Testing: Add E2E tests
8. Documentation: Update docstrings
