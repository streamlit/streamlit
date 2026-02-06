# Table Sizing Implementation Notes

This document captures learnings from implementing `width` and `height` parameters for `st.table`.

## Overview

The `st.table` component now supports:
- `width`: `"content"` | `"stretch"` | `int` (pixels)
- `height`: `"content"` | `"stretch"` | `int` (pixels)

When a fixed pixel dimension is specified, scrolling is enabled with sticky headers/index columns.

## CSS Table Sizing Challenges

### Column Width Behavior

Tables have unique CSS behavior compared to block elements. Key learnings:

1. **`white-space: nowrap` prevents ALL wrapping** - You can't use this and still expect text to wrap at a max-width. It's all or nothing.

2. **`table-layout: auto` (default) expands columns to fit content** - Unlike block elements, table columns naturally grow to accommodate their content. This means `max-width` behaves as a "soft cap" rather than a hard constraint.

3. **`max-content` is blocked by ESLint** - The `streamlit-custom/no-hardcoded-theme-values` rule rejects `max-content`. Use `fit-content` instead.

4. **Table minimum width** - Use `minWidth: "100%"` on the `<table>` element to make it fill the container when content is smaller. Disable this for `width="content"` mode.

### The Column Sizing Solution

```typescript
const styleCellFunction = (theme, border) => ({
  // ... other styles ...
  maxWidth: "20rem",         // Cap at ~320px, wrap after this
})
```

This simple approach:
- Short text: Displays on single line (columns expand to fit content)
- Long text with spaces: Wraps at word boundaries when exceeding ~320px
- Long unbreakable text (URLs, single words): May exceed max-width (tables prioritize fitting content)

### Text Wrapping Behavior by Content Type

| Content Type | Behavior |
|--------------|----------|
| Short text (< 320px) | Single line, no wrapping |
| Long text with spaces | Wraps at word boundaries when exceeding ~320px |
| Very long single word | Extends beyond 320px (table prioritizes fitting content) |
| URLs/paths | Extends beyond 320px (unbreakable content) |

### What Doesn't Work

1. **`white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis`**
   - Truncates long text with "..." but prevents ANY wrapping
   - Not ideal for data tables where users want to see full content

2. **`width: fit-content` + `maxWidth`**
   - Was initially thought to be the solution, but testing showed it's not needed
   - `fit-content` doesn't help with forcing word breaks in table cells

3. **`width: 1px` + `maxWidth` + `overflow-wrap: anywhere`**
   - Forces ALL content to wrap, including numbers and short text
   - Causes single characters to wrap ("10" becomes "1" and "0" on separate lines)
   - Too aggressive for general use

4. **`width: 100%` + `maxWidth`**
   - Similar problem - causes aggressive wrapping of all content
   - Each cell tries to take 100% of available width

5. **`min-width: 0` alone**
   - Allows columns to shrink but doesn't force them to
   - In `table-layout: auto`, columns still expand to fit content

6. **`overflow-wrap: anywhere` or `word-break: break-word` alone**
   - Without constraining width, these have no effect
   - Table columns still expand to fit the unbroken content

7. **`table-layout: fixed`**
   - Requires explicit column widths
   - Doesn't work well with dynamic content
   - Would force equal column widths unless explicitly specified

### Key Insight: Tables vs Block Elements

The fundamental difference is that **CSS tables prioritize fitting content over respecting max-width constraints**. In `table-layout: auto`:

- Block elements: `max-width` is a hard constraint, content wraps or overflows
- Table cells: `max-width` is a soft cap, columns can still expand for unbreakable content

This is actually desirable for data tables - users typically want to see full content (URLs, identifiers) rather than have it forcibly broken mid-word.

## Additional Learnings (Wrapping Regression Follow-up)

Recent regressions showed that table sizing is not only controlled by `td/th` styles, but also by nested markdown defaults.

1. **`StreamlitMarkdown` can silently force early wrapping inside table cells.**
`StyledStreamlitMarkdown` defaults include `width: 100%` and paragraph-level `wordBreak/overflowWrap` behavior. Inside table cells, this can make headers and values wrap much earlier than expected, even when table cell sizing looks correct.

2. **For table cells, override nested markdown behavior explicitly.**
The robust pattern was:
- Keep `td/th` as content-sized (`whiteSpace: "nowrap"` in non-truncate mode).
- Override nested markdown container (`[data-testid="stMarkdownContainer"]`) to:
  - `display: inline-block`
  - `width: fit-content`
  - `maxWidth: <column max width>`
  - `whiteSpace: normal`
  - `overflowWrap: normal`
  - `wordBreak: normal`
- Also override nested paragraphs (`[data-testid="stMarkdownContainer"] p`) with normal wrap settings, otherwise paragraph defaults can still reintroduce aggressive wrapping.

3. **Use theme tokens for max width in styled components.**
Hardcoded values in new sizing rules can fail lint (`streamlit-custom/no-hardcoded-theme-values`). Prefer theme-backed values (e.g. `theme.sizes.appStatusMaxWidth`) when adding or changing max-width constraints.

4. **Prefer styled-component overrides over inline style hacks for sizing behavior.**
Inline `style` on `StreamlitMarkdown` is tempting but easy to break policy/lint and can be brittle. Locating the behavior in table styled-components is easier to reason about and test.

5. **Validate behavior with computed styles, not only inline style assertions.**
Emotion/generated CSS often does not appear as inline style values. Regression tests should inspect `getComputedStyle(...)` for display/wrapping behavior where possible.

## Height and Scrolling

### Enabling Vertical Scroll

For vertical scrolling to work:

1. **Container must have constrained height** - The parent needs `height: 100%` or a fixed pixel height
2. **Remove from overflow override list** - Table was in `VISIBLE_OVERFLOW_OVERRIDE` array which prevented scrolling
3. **Height propagation** - Use `display: block` and `height: 100%` on container elements to propagate height constraints

### Key Style Changes

```typescript
// StyledTableContainer
export const StyledTableContainer = styled.div(({ theme }) => ({
  height: "100%",      // Inherit height constraints
  display: "block",    // Allow natural expansion
}))

// StyledTableBorder (scrollable wrapper)
export const StyledTableBorder = styled.div(({ hasScrollableHeight }) => ({
  overflow: "auto",
  height: hasScrollableHeight ? "100%" : undefined,
}))
```

## Sticky Headers and Index Columns

### When to Enable

- **Sticky headers**: When `heightConfig.pixelHeight` is set (vertical scrolling)
- **Sticky index**: When `widthConfig.pixelWidth` is set AND table has index columns

### Z-Index Layering

Corner cells (intersection of header row and index column) need highest z-index:

```typescript
if (stickyType === "corner") {
  stickyStyles.zIndex = 3    // Highest - stays above everything
} else if (stickyType === "header") {
  stickyStyles.zIndex = 2    // Above index cells
} else if (stickyType === "index") {
  stickyStyles.zIndex = 1    // Above regular cells
}
```

### Sticky Styles

```typescript
const stickyStyles = {
  position: "sticky",
  backgroundColor: theme.colors.bgColor,  // Opaque background required
  top: 0,     // For header cells
  left: 0,    // For index cells
}
```

## Layout Integration

### useLayoutStyles Hook

The `useLayoutStyles` hook in `useLayoutStyles.ts` handles dimension config:

- `widthConfig.useStretch` -> `width: "100%"`
- `widthConfig.useContent` -> `width: "fit-content"`
- `widthConfig.pixelWidth` -> `width: "${pixels}px"`
- `heightConfig.pixelHeight` -> `height: "${pixels}px"` + `overflow: "auto"`

### StyledElementContainerLayoutWrapper

- Added `"table"` to `LARGE_STRETCH_BEHAVIOR` for proper flex sizing
- Removed `"table"` from `VISIBLE_OVERFLOW_OVERRIDE` to allow scrolling

## Backend API

```python
def table(
    self,
    data: Data = None,
    *,
    border: bool | Literal["horizontal"] = True,
    width: Width = "stretch",      # "content" | "stretch" | int
    height: Height = "content",    # "content" | "stretch" | int
) -> DeltaGenerator:
```

Width and height values are validated using `validate_width()` and `validate_height()` from `layout_utils.py`.

## Testing Considerations

- Test with both short and long text content
- Verify scrolling works with fixed pixel dimensions
- Check sticky behavior during diagonal scrolling (both horizontal + vertical)
- Test `width="content"` doesn't stretch unnecessarily
- Test `width="stretch"` fills available container width
- Test with very long unbreakable content (URLs, long identifiers) - should extend column, not break
- Test numbers and short text don't wrap unnecessarily

## Common Pitfalls

1. **Forgetting opaque backgrounds for sticky cells** - Without `backgroundColor`, content shows through during scroll
2. **Not propagating height constraints** - Every container in the chain needs proper height handling
3. **Over-constraining with `white-space: nowrap`** - Prevents all wrapping, even desired wrapping
4. **Missing `overflow: auto`** - Required on the scrollable container
5. **Table in overflow override list** - Check `VISIBLE_OVERFLOW_OVERRIDE` in layout wrapper
6. **Trying to force word breaks in tables** - Using `width: 1px` or `width: 100%` causes ALL content to wrap aggressively
7. **Expecting `max-width` to be a hard constraint** - In tables, it's a soft cap; unbreakable content can still expand columns
8. **Using `overflow-wrap` without constraining width** - Has no effect since table columns expand to fit content
