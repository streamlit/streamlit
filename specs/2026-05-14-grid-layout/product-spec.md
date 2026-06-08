---
author: lukasmasuch
created: 2026-05-14
---

# Grid Layout

## Summary

Add `st.grid`, a responsive multi-element layout container for repeated cards, metric
walls, galleries, and dashboard panels. The primary API auto-places each direct child into
the next grid cell, wraps based on available container width, and makes it easy to keep
cell/card heights visually aligned.

This complements `st.columns` and `st.container(horizontal=True)`: columns remain the right
tool for a fixed row of known regions, flex containers remain the right tool for wrapping
natural-width controls, and grid becomes the tool for repeated equal-track layout.

## Problem

### User Requests

- [#11101](https://github.com/streamlit/streamlit/issues/11101) - Grid layout
- [#5353](https://github.com/streamlit/streamlit/issues/5353) - Wrap columns/grids on
  different screen sizes
- [#6592](https://github.com/streamlit/streamlit/issues/6592) - Configurable column
  responsiveness width threshold
- [#3052](https://github.com/streamlit/streamlit/issues/3052) - Vertical alignment for
  columns

Issue #11101 describes two needs:

1. Showing similar elements, such as cards, in a grid/gallery view where each item occupies
   one cell.
2. Creating more complex dashboard layouts where charts, metrics, and dataframes can occupy
   visually aligned regions.

The first need is more common and is still awkward after flex layout. The second need is
important, but many dashboards can already be composed with `st.columns`,
`st.container(horizontal=True)`, and nested containers. The grid MVP focuses on the first
need, and additionally ships a lightweight, cursor-based `grid.span(columns, rows)` helper for
the most common dashboard case ("make the next chart wider/taller"). Spanning is included on
day one because it is nearly free on top of CSS Grid (`grid-column/row: span N`), does not
introduce a new mental model, and avoids a near-term breaking change to the returned container
type once users depend on it. More advanced explicit-placement and named-region APIs remain a
clear follow-up path.

### Current Workarounds

Users create grids by repeating `st.columns`:

```python
for row in range(3):
    cols = st.columns(4)
    for col in cols:
        with col:
            st.metric(...)
```

This has several problems:

- Each row is independent, so responsive wrapping cannot reflow all items as one grid.
- `st.columns` wraps only at a narrow screen threshold, which can make tables, charts, and
  cards too narrow on laptop-sized windows.
- Empty cells in the last row create visible spacing when columns collapse.
- Dynamic lists require boilerplate row/chunking code.
- Equal-looking cards require nesting containers and manually coordinating heights.

Users can also use `st.container(horizontal=True)`, but this is a flex row. It is good for
toolbars and wrapping controls, not for equal-width repeated dashboard cards. It does not cap
the number of columns, create consistent grid tracks, or provide per-cell card chrome.

Some users rely on custom CSS, custom components, or
[`streamlit-extras` grid](https://arnaudmiribel.github.io/streamlit-extras/extras/grid/).
Those workarounds are not discoverable enough for a core dashboard-building workflow.

### Use Cases

1. **Metric card wall**: A dashboard has 8-20 KPI cards that should show 4 columns on wide
   screens, 2-3 on laptops, and 1 on phones.
2. **Gallery/listing view**: A component catalog, emoji selector, model catalog, or data
   catalog needs a dynamic number of uniformly sized cards.
3. **Dashboard card layout**: A data app has charts, tables, and filters that should align
   cleanly as cards and wrap without becoming unreadable.
4. **Control grids**: Many small buttons, chips, or form controls should fill available
   width without manually chunking lists.
5. **Future advanced dashboards**: Some apps need explicit column/row spans or named regions,
   similar to Matplotlib's GridSpec or `subplot_mosaic`.

## Prior Art

The recurring pattern across UI libraries is a split between a simple responsive grid for
repeated items and a more explicit grid for spans/regions:

| Source | Relevant Pattern | Takeaway |
| --- | --- | --- |
| [CSS Grid](https://developer.mozilla.org/en-US/docs/Web/CSS/minmax) | `auto-fit` with `minmax()`, named grid areas | Browser-native responsive tracks and named areas map well to Streamlit's frontend. |
| [Chakra SimpleGrid](https://chakra-ui.com/docs/components/simple-grid) | `columns` or `minChildWidth` | `min_column_width` is a better dashboard default than viewport-only breakpoints. |
| [Mantine SimpleGrid](https://v3.mantine.dev/core/simple-grid/) | `cols`, spacing, breakpoints | Simple repeated-item grids are separate from span-based grids. |
| [Mantine Grid](https://mantine.dev/core/grid/) | 12-column spans, responsive span objects, row/column gaps | Span APIs are powerful but verbose for Streamlit's common use case. |
| [MUI Grid](https://mui.com/material-ui/react-grid/) | Responsive columns, item sizes, row/column spacing | Responsive props are useful, but exposing many breakpoint knobs up front is heavy. |
| [Bootstrap Grid](https://getbootstrap.com/docs/5.0/layout/grid/) | Mobile-first 12-column system | 12-column thinking is familiar, but class-like breakpoint APIs do not feel Pythonic. |
| [Elastic UI FlexGrid](https://eui.elastic.co/docs/components/layout/flex/grid/) | Rigid repeated rows of same-width items | Repeated same-width dashboard cards are a first-class pattern. |
| [Gradio Row](https://www.gradio.app/docs/gradio/row) | `scale` and `min_width` | Minimum child width is an understandable Python-facing responsive control. |
| [Matplotlib GridSpec](https://matplotlib.org/3.5.0/tutorials/intermediate/gridspec.html) | Slice-based placement and width/height ratios | Powerful for advanced users, but indexing is less friendly for dynamic Streamlit apps. |
| [Matplotlib subplot_mosaic](https://matplotlib.org/stable/api/_as_gen/matplotlib.pyplot.subplot_mosaic.html) | ASCII/nested-list named regions | Excellent for complex dashboards; likely better as a follow-up API than the MVP. |
| [React Grid Layout](https://github.com/react-grid-layout/react-grid-layout) | Draggable/resizable responsive dashboards | Too interactive and dependency-heavy for the first core layout primitive. |

## Proposal

Ship `st.grid` as a **responsive auto-placement container**.

```python
st.grid(
    columns: Literal["auto"] | int = "auto",
    *,
    min_column_width: int | None = 200,
    gap: Gap | tuple[Gap | None, Gap | None] = "small",
    vertical_alignment: Literal["top", "center", "bottom"] = "top",
    border: bool = False,
    cell_height: Literal["content", "equal"] | int = "content",
    width: WidthWithoutContent = "stretch",
    dense: bool = True,
) -> GridContainer
```

In the signature above, `Gap` is the existing Streamlit gap scale
(`"xxsmall" | "xsmall" | "small" | "medium" | "large" | "xlarge" | "xxlarge" | None`), reused
from `st.columns` / `st.container`. `WidthWithoutContent` is the shared width type that accepts
`"stretch"` or an integer pixel value (the `"content"` width option is intentionally not
supported for grids, since cells already size to equal tracks).

### Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `columns` | `"auto"` or `int` | `"auto"` | Maximum number of equal-width columns. `"auto"` creates as many columns as fit the available container width. An integer caps the grid at that many columns and wraps to fewer columns when cells would become narrower than `min_column_width`. |
| `min_column_width` | `int` or `None` | `200` | Minimum preferred cell width in pixels before wrapping to fewer columns. If `columns` is an integer, `None` disables early min-width-based wrapping. If `columns="auto"`, `min_column_width` must be an integer; passing `min_column_width=None` together with `columns="auto"` raises `StreamlitAPIException` (auto mode needs a width to decide how many columns fit). Note: when `border=True`, cell padding reduces effective content width by ~32px, so prefer 250px+ for bordered cells. |
| `gap` | gap size or `(row_gap, column_gap)` | `"small"` | Space between cells. Reuses the existing Streamlit gap scale: `"xxsmall"`, `"xsmall"`, `"small"`, `"medium"`, `"large"`, `"xlarge"`, `"xxlarge"`, or `None`. A single value sets both row and column gaps (identical to `st.columns` / `st.container`); the optional `(row_gap, column_gap)` tuple is an additive grid-specific extension for asymmetric spacing (see note below). |
| `vertical_alignment` | `"top"`, `"center"`, or `"bottom"` | `"top"` | Vertical alignment of a direct child inside its grid cell when the cell is taller than the child. Uses CSS "safe" alignment to prevent content overflow when content is larger than the cell. |
| `border` | `bool` | `False` | Whether to show a border and padding around each grid cell, matching the visual language of `st.columns(border=True)` and `st.container(border=True)`. |
| `cell_height` | `"content"`, `"equal"`, or `int` | `"content"` | Cell height behavior. `"content"` lets each row size to its tallest cell while cell chrome stretches within that row. `"equal"` makes all grid rows use one shared height based on the tallest row/cell. An integer fixes every cell to that pixel height and enables overflow handling inside the cell. |
| `width` | `"stretch"` or `int` | `"stretch"` | Width of the grid container, matching `st.columns`. |
| `dense` | `bool` | `True` | Whether to use dense packing mode. When `True`, the grid fills gaps by reordering smaller cells to fill empty spaces left by spanning cells. When `False`, cells are placed in strict DOM order, which may leave gaps. |

> **Note on `gap` consistency (Principle 10):** In `st.columns` and `st.container`, `gap` is a
> single shared spacing token. Accepting a `(row_gap, column_gap)` tuple here _extends_ that
> meaning rather than changing it — a single value still behaves identically to the existing
> parameter, and the tuple form is purely additive for the asymmetric row/column spacing that
> grids commonly need. If the tuple form proves confusing, it can be superseded by explicit
> `row_gap` / `column_gap` parameters in a follow-up without breaking single-value usage.

### GridContainer Methods

`st.grid` returns a `GridContainer`, a thin `DeltaGenerator` subclass. In addition to the
standard container methods, it exposes a spanning helper:

```python
grid.span(columns: int = 1, rows: int = 1) -> DeltaGenerator
```

`span()` creates the next auto-placed cell and asks it to span `columns` column tracks and
`rows` row tracks. Both default to `1`, so `grid.span()` behaves like a normal single cell.
Values are clamped to a minimum of `1`, and `columns` is effectively capped at the current
resolved column count (a cell cannot span more columns than exist after responsive wrapping).
Like other containers, the returned object works with `with` notation or method chaining.

### Behavior

#### Direct Children Become Cells

Every direct child of the grid occupies one grid cell. Users can write into the returned
container directly or use `with` notation:

```python
grid = st.grid(4)

grid.metric("Revenue", "$1.2M", "+8%")
grid.metric("Conversion", "12.4%", "+1.1%")

with grid:
    st.line_chart(df)
    st.dataframe(df)
```

To put multiple Streamlit elements into one grid cell, create a direct child container:

```python
grid = st.grid(4, border=True, cell_height=140)

for item in metrics:
    with grid.container():
        st.metric(item.label, item.value, item.delta)
        st.caption(item.caption)
```

This follows existing container composition instead of introducing a separate card API. A
future `grid.cell()` helper could make this pattern more explicit, but it is not required for
the minimal API.

#### Responsive Placement

`st.grid(4, min_column_width=220)` means "use up to four columns, but wrap earlier if four
columns would make cells narrower than 220px." For example:

- 1100px available width: 4 columns
- 760px available width: 3 columns
- 480px available width: 2 columns
- 320px available width: 1 column

The exact thresholds account for the configured gap. The calculation happens on the frontend
from the actual container width, so Python does not need to know the browser size.

`st.grid("auto", min_column_width=220)` creates as many columns as fit, with no explicit max.
This is useful for galleries. Most dashboard apps should pass an integer max column count.

#### Height And Alignment

With `cell_height="content"`, each row's height is the height of the tallest cell in that
row. Borders and backgrounds stretch to that row height, so cards in a row align cleanly.
Rows can still have different heights.

With `cell_height="equal"`, all rows share the same height, based on the tallest row/cell in
the grid. This is useful for gallery/card walls where users want the grid to look uniform
across rows without choosing a fixed pixel height. `"equal"` is part of the MVP and is
implemented with CSS only (equal-height row tracks, e.g. `grid-auto-rows: 1fr` within an
equal-track context), with no JavaScript measurement in the initial release. The fallback
contract if a pure-CSS approach proves unreliable on a supported browser is defined in the
[Risks](#risks) section: `"equal"` stays in the public API and degrades gracefully to
`"content"` behavior rather than being removed or shipping broken layout.

With `cell_height=160`, all cells have the same fixed height. If content exceeds the fixed
height, the cell scrolls using the same design constraints as fixed-height containers.

`vertical_alignment` controls how a child is placed within extra vertical space. This is most
noticeable for mixed widgets, buttons, metrics, and charts in fixed-height or row-stretched
cells.

#### Last Row

The last row contains only the remaining items. The grid does not create placeholder cells, so
there is no empty cell space when the final row is incomplete.

#### Nesting

Grid cells can contain `st.container`, `st.container(horizontal=True)`, `st.columns`, or
another `st.grid`. Nesting should work, but docs should recommend keeping nested layout simple.
There is no CSS `subgrid` support in the MVP.

#### Fragments

`st.grid` should work inside `@st.fragment`, and a grid cell can contain fragment-rendered
content just like any other container. The grid itself does not introduce new state; widget and
fragment behavior should follow existing container semantics.

#### Accessibility

Responsive wrapping changes only the number of columns, not the source/DOM order of cells, so
keyboard tab order and screen-reader reading order continue to follow the order in which
elements are written. This keeps the common gallery/repeated-card MVP aligned with WCAG 2.1
SC 1.3.2 (Meaningful Sequence) and SC 2.4.3 (Focus Order).

`dense=True` is the default because, for the primary use case (uniform, unspanned cells), dense
packing has no observable effect: every cell is the same size, so there are no gaps to backfill
and visual order always matches DOM order. The visual-vs-DOM-order divergence that dense packing
can introduce only occurs once `grid.span()` is used to create differently sized cells. For that
case, the spec commits to:

- Documenting the tradeoff in the `dense` parameter docs and the layout guide.
- Recommending `dense=False` (strict order) when source order must match reading order.
- Adding explicit accessibility acceptance coverage (keyboard navigation and reading order with
  spanning cells) before the feature ships.

If review during implementation shows the default is surprising for spanned grids, flipping the
default to `dense=False` remains a low-cost option, since `dense` is a behavioral flag rather
than a structural one.

### Examples

#### Metric Cards

```python
import streamlit as st

metrics = [
    ("Revenue", "$1.2M", "+8%", "Trailing 30 days"),
    ("Pipeline", "$4.8M", "+12%", "Weighted"),
    ("Conversion", "12.4%", "+1.1%", "Lead to opportunity"),
    ("Retention", "96%", "-0.4%", "Monthly"),
]

grid = st.grid(4, min_column_width=250, border=True, cell_height="equal")

for label, value, delta, caption in metrics:
    with grid.container():
        st.metric(label, value, delta)
        st.caption(caption)
```

#### Responsive Gallery

```python
import streamlit as st

items = ["Apple", "Lemon", "Grape", "Kiwi", "Peach", "Cherry", "Coconut", "Pineapple"]

with st.grid("auto", min_column_width=72, gap="xsmall"):
    for item in items:
        st.button(item, key=f"item-{item}", width="stretch")
```

#### Dashboard Cards

```python
import streamlit as st

grid = st.grid(3, min_column_width=320, gap=("medium", "small"), border=True)

with grid.container():
    st.subheader("Revenue")
    st.line_chart(revenue_df, height=220)

with grid.container():
    st.subheader("Pipeline")
    st.bar_chart(pipeline_df, height=220)

with grid.container():
    st.subheader("Open Accounts")
    st.dataframe(accounts_df, height=220)
```

#### Composition With Flex Controls

```python
import streamlit as st

grid = st.grid(2, min_column_width=360, border=True)

with grid.container():
    controls = st.container(horizontal=True, vertical_alignment="bottom")
    controls.selectbox("Region", regions)
    controls.selectbox("Segment", segments)
    st.area_chart(region_df)

with grid.container():
    st.dataframe(detail_df, height=300)
```

## API Evaluation

The options below are grouped by how they relate to the proposed API:

- **Core proposed API:** the recommended MVP shape of `st.grid`.
- **Included grid-object helpers:** methods that ship with the proposed `GridContainer`
  because they are needed for common dashboard layouts.
- **Compatible extensions:** features that can be added later to the same returned
  grid container or to the same `st.grid(...)` parameters without changing the core mental
  model.
- **Alternative APIs considered:** separate API shapes or top-level commands that were
  evaluated but should not be part of the recommended MVP.

### Core Proposed API: Responsive Auto-Placement Container

```python
grid = st.grid(4, min_column_width=200, border=True)

for item in items:
    with grid.container():
        render_card(item)

with grid.span(columns=2):
    render_feature_chart()
```

**Pros:**

- Handles dynamic lists without predeclaring cells.
- Solves the most common gallery/card use case directly.
- Uses actual container width, not Python-side viewport guesses.
- Keeps multi-element cards as normal `st.container` composition.
- Supports common dashboard spans through `grid.span(...)` without switching layout models.
- Can be implemented with native CSS Grid and no dependency.

**Cons:**

- Direct children as cells is a new layout rule that must be documented clearly.
- Dense packing can make visual order differ from DOM/focus order; users can set
  `dense=False` when strict order is more important than filling gaps.
- Weighted column ratios are intentionally deferred because they interact poorly with
  automatic wrapping.

### Compatible Extension: Semantic Cell Helpers

```python
grid = st.grid(3, border=True)

for item in items:
    with grid.cell():  # Alias for a direct child container.
        render_card(item)

for cell, item in zip(grid.cells(6), items):
    with cell:
        render_card(item)
```

`grid.cell()` and `grid.cells(n)` are convenience helpers, not a separate layout model. They
make it explicit when a multi-element card should occupy one grid cell.

**Pros:**

- Makes the "one container equals one grid cell" pattern more readable.
- Creates a natural place for future per-cell options without overloading `grid.container()`.
- Avoids adding another top-level command.

**Cons:**

- Adds a small amount of API surface for something users can already do with `grid.container()`.

**Recommendation:** Treat as a compatible extension, not part of the minimal API. The MVP can
use normal `grid.container()` composition.

### Compatible Extension: `key` For CSS Targeting

```python
grid = st.grid(4, key="sales-cards")
```

Like `st.container(key=...)`, this would expose a stable CSS class such as
`st-key-sales-cards` for user styling and test targeting.

**Pros:**

- Consistent with `st.container`.
- Useful for custom CSS targeting.

**Cons:**

- Not required for the grid's stable layout identity in the MVP.
- Adds another parameter before there is strong evidence users need custom targeting for grids.

**Recommendation:** Treat as a compatible extension. Add it later if users need CSS targeting
or if consistency with keyed containers becomes important.

### Included Grid-Object Helper: Cursor-Based Span Cells

```python
grid = st.grid(4, min_column_width=260, border=True)

with grid.span(columns=2):
    st.line_chart(df)

with grid.span(rows=2):
    st.dataframe(summary_df)

with grid.span(rows=2, columns=2):
    st.metric("Revenue", "$1.2M")
```

This extends auto-placement instead of replacing it. `grid.span(rows=2, columns=3)` creates
the next grid cell at the current auto-placement cursor and asks that cell to span two row
tracks and three column tracks.

**Implementation notes from prototype:**

- Returns `GridContainer` (extends `DeltaGenerator`) to provide the `span()` method
  with proper typing.
- `dense=True` is the default, which uses `grid-auto-flow: dense` to fill gaps automatically.
  This provides better visual layouts for most use cases.
- Column spans are not explicitly clamped in CSS, but setting `gridAutoColumns` to a small
  value was found to cause bugs. The current implementation relies on CSS Grid's natural
  handling.
- Row spans work best with `cell_height=<int>` for predictable heights.

**Pros:**

- Keeps the grid primarily dynamic and auto-placed.
- Supports common "make the next chart wider/taller" dashboard cases without absolute
  coordinates.
- Avoids predeclaring every cell or using placeholder cells.
- Can be implemented directly with CSS Grid `grid-column: span N` and `grid-row: span N`.
- Dense packing by default provides better layouts without manual cell ordering.

**Cons:**

- Requires a thin `GridContainer` subclass rather than returning the exact base
  `DeltaGenerator` type.
- Dense packing can visually reorder cells differently from DOM order, which may affect
  keyboard/screen-reader navigation. Users can set `dense=False` to preserve strict order.
- Row spans are only visually meaningful when row tracks have a predictable height.

### Compatible Extension: Slice-Addressed Cells

```python
grid = st.grid(12, rows=4, min_column_width=None)

with grid[0, :]:
    st.title("Quarterly Overview")

with grid[1:3, :8]:
    st.line_chart(df)

with grid[1:3, 8:]:
    st.dataframe(summary_df)

with grid[3, 0:4]:
    st.metric("Revenue", "$1.2M")
```

This mirrors Python/NumPy and Matplotlib GridSpec indexing. The first coordinate is the row,
the second coordinate is the column. Integer indices target one track; slices target spans.

**Pros:**

- Very expressive for users who already know Python slicing.
- Naturally supports row spans, column spans, and full-row/full-column regions.
- More compact than a named mosaic for small dashboards.
- Aligns with the Matplotlib GridSpec prior art referenced in issue #11101.

**Cons:**

- Requires explicit grid dimensions, including row count or row auto-expansion rules.
- It is less friendly for dynamic lists than auto-placement.
- Negative indices, open-ended slices, overlapping cells, and mixing with auto-placement need
  strict semantics.
- Slice access adds a second placement mode to `GridContainer`, so it needs stricter
  validation than cursor-based spans.

**Recommended semantics if pursued:**

- Treat slice access as an explicit-placement mode.
- Do not allow mixing automatic insertion (`grid.metric(...)`) with explicit indexed writes in
  the same grid, at least for the first release.
- Require targeted areas to be rectangular and non-overlapping.
- Use zero-based indexing with `[row, column]`, matching Matplotlib GridSpec.
- Interpret slice stops as exclusive, matching normal Python slicing.

**Recommendation:** Keep this as an advanced compatible extension to the same `GridContainer`.
Cursor-based spans should remain the included spanning API for the first release.

### Compatible Extension: Responsive Breakpoint Map

```python
grid = st.grid(columns={"sm": 1, "md": 2, "lg": 4})
```

This mirrors MUI, Mantine, and Bootstrap-style breakpoint APIs.

**Pros:**

- Gives designers exact control over column count at known screen sizes.
- Familiar to frontend developers.
- Can express layouts that `min_column_width` cannot.

**Cons:**

- Introduces breakpoint vocabulary into a Python API.
- Viewport breakpoints are less robust than container-width behavior when grids are nested,
  placed in sidebars, or used inside future embedded contexts.
- The common card-gallery case is simpler with `min_column_width`.

**Recommendation:** Defer. Prefer container-width responsiveness first. Add breakpoint maps
later only if `min_column_width` proves insufficient.

### Compatible Extension: Weighted Columns And Rows

```python
grid = st.grid(columns=[2, 1, 1], min_column_width=None)
```

This mirrors `st.columns([2, 1, 1])` and Matplotlib GridSpec width/height ratios.

**Pros:**

- Familiar from `st.columns`.
- Useful for fixed dashboard layouts.
- Could pair with slice-addressed or mosaic APIs.

**Cons:**

- Weighted tracks interact poorly with automatic responsive wrapping because the meaning of
  `[2, 1, 1]` changes when the grid collapses to fewer columns.
- It is less useful for repeated equal-card layouts, which are the MVP target.

**Recommendation:** Defer weighted tracks to explicit-placement or mosaic follow-ups. Keep the
MVP equal-track grid.

### Alternative API: Streamlit-Extras-Style Row Specs

```python
grid = st.grid(2, [2, 1], 1, gap="small", vertical_alignment="bottom")

grid.dataframe(df)
grid.line_chart(df)
grid.selectbox("Country", countries)
grid.button("Apply", width="stretch")
```

This extends the `st.columns` spec idea: each positional argument describes one row's cell
count or relative widths, and the row specs repeat.

**Pros:**

- Familiar to users who know `st.columns`.
- Already validated by `streamlit-extras` usage.
- Useful for repeating non-uniform row patterns.

**Cons:**

- Does not naturally solve responsive wrapping. Once row specs vary, it is unclear how the
  browser should collapse from 4 to 3 to 2 columns.
- Generated apps can be harder to reason about because the implicit row pattern changes
  placement.
- It optimizes for layout cleverness over the core repeated-card need.

**Recommendation:** Do not include in the MVP. Consider later if user feedback shows strong
demand for repeating weighted row patterns.

### Alternative API: Fixed Cell List

```python
cells = st.grid(num_cells=20, columns=4)

with cells[0]:
    render_card(items[0])
```

**Pros:**

- Very close to `st.columns`.
- Random access is straightforward.
- Multiple elements per cell are natural.

**Cons:**

- Users must know the number of cells up front.
- Dynamic lists and "add another card" flows are awkward.
- Empty cells recreate one of the core `st.columns` pain points.
- Browser wrapping changes visual positions, making index-based code less intuitive.

**Recommendation:** Do not pursue unless we need random access for a later selectable-grid
feature.

### Alternative API: Named Mosaic / Template Grid

```python
layout = """
summary summary filters
chart   chart   table
kpi1    kpi2    table
"""

grid = st.grid_template(layout, gap="small")

with grid["summary"]:
    render_summary()

with grid["chart"]:
    st.line_chart(df)
```

This mirrors CSS `grid-template-areas` and Matplotlib `subplot_mosaic`.

**Pros:**

- Excellent for complex dashboards with spans.
- The layout is visible in code.
- Named regions are more semantic than numeric indices.

**Cons:**

- Not ideal for dynamic lists/galleries.
- Requires validation for rectangular named areas, empty cells, duplicate names, and
  responsive variants.
- Adds a second mental model beyond regular Streamlit containers.

**Recommendation:** Keep as the likely follow-up for advanced dashboards after the simple
grid has shipped and we have usage data.

### Alternative API: Separate `st.auto_grid`

```python
with st.auto_grid(min_width=250, max_columns=4, cell_height="equal") as grid:
    for product in products:
        with grid.container():
            render_product_card(product)
```

This names the responsive gallery mode directly and separates it from fixed-column grids.

**Pros:**

- The command name communicates that the column count is browser-responsive.
- Parameters like `min_width` and `max_columns` are compact for galleries.
- Avoids overloading `columns="auto"` in `st.grid`.

**Cons:**

- Adds another top-level layout command for behavior that is already covered by
  `st.grid(columns="auto", min_column_width=...)`.
- Users then need to choose between `grid` and `auto_grid` before they understand the layout
  model.
- Future span and cell helpers would either be duplicated or unavailable in one command.

**Recommendation:** Do not add a separate command. Keep one `st.grid` container and make
`columns="auto"` the auto-responsive mode.

## Recommendation

Ship the core proposed API with spanning support:

```python
st.grid(columns="auto", *, min_column_width=200, gap="small",
        vertical_alignment="top", border=False, cell_height="content",
        width="stretch", dense=True) -> GridContainer
```

The returned `GridContainer` extends `DeltaGenerator` and provides a `span(columns, rows)`
method for creating cells that span multiple grid tracks.

This solves the highest-confidence need: dynamic, responsive, equal-track cards and galleries.
It also creates a natural foundation for later mosaic APIs because the frontend block is backed
by CSS Grid from the start.

**Key implementation learnings:**

- `dense=True` by default provides better visual layouts by filling gaps automatically.
- `min_column_width=200` works well for most content; 220px was too restrictive.
- CSS "safe" alignment keywords prevent content overflow with center/bottom alignment.
- Cell border padding (~32px total) significantly reduces effective content width.
- CSS Grid doesn't auto-detect content overflow; users must set `min_column_width` appropriately
  for their content (e.g., 250px+ for metrics with borders).

## Risks

- **`cell_height="equal"` cross-browser reliability.** The MVP commits to a CSS-only
  implementation of equal row heights. If equal-height tracks prove unreliable on a supported
  browser, the fallback contract is that `cell_height="equal"` degrades gracefully to
  `cell_height="content"` behavior (rows size to their tallest cell) rather than being removed
  from the public API or silently shipping broken layout. The value stays in the public
  `Literal` either way, so apps never need to change to upgrade safely.
- **Dense packing and reading order.** `dense=True` only diverges visual order from DOM/focus
  order when `grid.span()` produces differently sized cells (see the Accessibility section).
  The default is revisitable during implementation, and strict order is always available via
  `dense=False`.
- **`columns="auto"` with `min_column_width=None`.** This combination is invalid (auto mode
  needs a width). It raises `StreamlitAPIException` with an actionable message rather than
  guessing a column count.

## Out Of Scope

- Draggable, resizable, or user-persisted dashboard layouts.
- Masonry/Pinterest-style packing. That optimizes for uneven heights, while this feature
  intentionally optimizes for aligned dashboard rows and cards.
- Selectable/clickable grid cells as a layout primitive. Users can place buttons or widgets
  inside cells. A selectable grid can be considered separately.
- Python APIs that expose the current browser width or active column count.
- Arbitrary CSS grid strings in the public API.
- Full explicit dashboard mosaic/template and absolute-placement support in the MVP.
- Separate `st.auto_grid` command; use `st.grid(columns="auto", ...)`.
- Weighted column/row ratios and breakpoint maps in the MVP.

## Docs

Docs should explain when to use each layout primitive:

| Need | Recommended API |
| --- | --- |
| Fixed side-by-side regions | `st.columns` |
| Toolbar, chips, or natural-width wrapped controls | `st.container(horizontal=True)` |
| Repeated cards/gallery/dashboard tiles | `st.grid` |
| One bordered multi-element region | `st.container(border=True)` |

The `st.grid` docs should include examples for metric cards, image/component galleries,
dashboard cards, and nested flex controls.

## Checklist

| Item | ✅ or comment |
| --- | --- |
| Works on SiS, Cloud, etc? | Yes. Frontend CSS Grid and existing block protocol patterns should work in all runtimes. |
| No breaking API changes | Yes. New command only. |
| No new dependencies | Yes. Use native CSS Grid. |
| Metrics collected | Yes. Add `gather_metrics("grid")`; optionally track coarse non-content options such as `columns` mode, `border`, and `cell_height` mode. |
| Any security/legal impact? | None expected. Layout-only feature; no new content execution path. |
| Any docs changes needed? | Yes. Add API docs and update layout guide/examples. |
