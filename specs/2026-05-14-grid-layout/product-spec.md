---
author: lukasmasuch
created: 2026-05-14
---

# Grid Layout

## Summary

Add `st.grid`, a responsive multi-element layout container for repeated cards, metric
walls, galleries, and dashboard panels. The primary API auto-places each direct child into
the next grid cell, wraps based on available container width, and makes it easy to keep
cell/card heights visually aligned. `wrap=False` opts out of that wrapping and keeps the
declared column count, matching `st.columns(wrap=False)` and
`st.container(horizontal=True, wrap=False)`.

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
    min_column_width: Literal["auto"] | int = "auto",
    wrap: bool = True,
    gap: Gap | None | tuple[Gap | None, Gap | None] = "small",
    vertical_alignment: Literal["top", "center", "bottom"] = "top",
    border: bool = False,
    row_height: Literal["content", "equal"] | int = "content",
    width: WidthWithoutContent = "stretch",
    dense: bool = True,
) -> GridContainer
```

Both type aliases are the shared ones already used by `st.columns` and `st.container`
(`lib/streamlit/elements/lib/layout_utils.py`):

- `Gap = int | Literal["xxsmall", "xsmall", "small", "medium", "large", "xlarge", "xxlarge"]`,
  so a gap is either one of the named scale steps or a non-negative pixel count. `None` is not
  part of `Gap` itself; like `st.columns`, the parameter widens it to `Gap | None`, where `None`
  means "no gap".
- `WidthWithoutContent = int | Literal["stretch"]`. The `"content"` width option is
  intentionally not supported for grids, since cells already size to equal tracks.

**On the name `st.grid`:** `specs/AGENTS.md` Principle 8 (Semantic Names Over Geeky Names) uses
`st.grid(cols=3)` as an anti-example, but the geeky part of that example is the CSS-style `cols=`
abbreviation, which this API avoids by using a positional integer and a spelled-out `columns=`.
"Grid" itself is everyday English ("a grid of cards"), is the word users reach for in
[#11101](https://github.com/streamlit/streamlit/issues/11101), and is the shared name across
MUI, Mantine, Chakra, and Bootstrap. Narrower alternatives (`st.cards`, `st.gallery`) each cover
only one of the gallery, dashboard, and control-grid use cases. If the name is approved, the
Principle 8 example should be updated to `st.grid(cols=3)` → `st.grid(columns=3)` so the
principle keeps illustrating the abbreviation rather than the command.

### Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `columns` | `"auto"` or `int` | `"auto"` | Maximum number of equal-width columns. `"auto"` creates as many columns as fit the available container width. An integer caps the grid at that many columns and, when `wrap=True`, wraps to fewer columns when cells would become narrower than `min_column_width`. Must be `>= 1`. |
| `min_column_width` | `"auto"` or `int` | `"auto"` | Minimum preferred cell width. `"auto"` (the default) is resolved on the frontend in rem and grows when `border=True` so cell padding does not eat the content floor (see [Auto minimum width](#auto-minimum-width)). A positive integer is an explicit outer cell width in pixels and is *not* padded on top of — same as `width=200`. When `wrap=True`, the grid wraps to fewer columns before cells would become narrower than this. When `wrap=False`, cells shrink until this width, then the grid scrolls horizontally (see [No-wrap behavior](#no-wrap-behavior)). |
| `wrap` | `bool` | `True` | Whether the grid may wrap to fewer columns when the container is too narrow. Same name and layout-container default as [`st.container` / `st.columns`](../2026-07-23-horizontal-wrap-control/product-spec.md): `True` allows wrapping (today's behavior); `False` keeps the declared column count and scrolls locally. Invalid with `columns="auto"`. Not an adaptive `None` default — grid is a layout container, not a control. |
| `gap` | gap size, `None`, or `(row_gap, column_gap)` | `"small"` | Space between cells. Accepts exactly what `st.columns` / `st.container` accept: the named scale (`"xxsmall"`, `"xsmall"`, `"small"`, `"medium"`, `"large"`, `"xlarge"`, `"xxlarge"`), a non-negative pixel integer such as `gap=20`, or `None` for no gap. A single value sets both row and column gaps; the optional `(row_gap, column_gap)` tuple is an additive grid-specific extension for asymmetric spacing (see note below). |
| `vertical_alignment` | `"top"`, `"center"`, or `"bottom"` | `"top"` | Vertical alignment of a direct child inside its grid cell when the cell is taller than the child. Uses CSS "safe" alignment so oversized content stays reachable instead of overflowing past the cell's start edge (see [Risks](#risks) for the browser-support fallback). |
| `border` | `bool` | `False` | Whether to show a border and padding around each grid cell, matching the visual language of `st.columns(border=True)` and `st.container(border=True)`. |
| `row_height` | `"content"`, `"equal"`, or `int` | `"content"` | Height of each grid row. `"content"` sizes each row to its tallest cell while cell chrome stretches within that row. `"equal"` gives every row the same height, based on the tallest row in the grid. A positive integer fixes every row to that pixel height and enables overflow handling inside the cell, so a `span(rows=2)` cell is `2 * row_height + row_gap` tall. |
| `width` | `"stretch"` or `int` | `"stretch"` | Width of the grid container, matching `st.columns`. |
| `dense` | `bool` | `True` | Whether to use dense packing mode. When `True`, the grid fills gaps by reordering smaller cells to fill empty spaces left by spanning cells. When `False`, cells are placed in strict DOM order, which may leave gaps. |

Invalid arguments fail immediately with an actionable `StreamlitAPIException` subclass rather
than being silently coerced (Principle 23):

| Invalid input | Error |
| --- | --- |
| `columns` is an integer `< 1` | `StreamlitValueBelowMinError` |
| `min_column_width` is an integer `< 1`, or a string other than `"auto"` | `StreamlitValueBelowMinError` / `StreamlitValueError` |
| `columns="auto"` with `wrap=False` | `StreamlitAPIException` explaining that auto mode is defined by wrapping, and suggesting either `wrap=True` or an integer `columns` |
| `row_height` is an integer `< 1`, or a string other than `"content"` / `"equal"` | `StreamlitValueBelowMinError` / `StreamlitValueError` |
| `gap` outside the shared scale, or a tuple with the wrong length | The same errors `st.columns` already raises for `gap` |

**Note on `dense` staying a boolean (Principle 16):** CSS `grid-auto-flow` also has `row` and
`column` values, but those select the auto-placement axis, which `st.grid` fixes to row-major
order as part of the "direct children fill left-to-right, top-to-bottom" contract. That leaves
exactly two user-meaningful states — backfill gaps or don't — so a boolean does not foreclose a
future axis parameter, which would be a separate concept and a separate parameter.

**Note on `row_height` rather than `cell_height`:** This parameter sizes rows, not cells.
`"content"` and `"equal"` already operate per row, and a pixel value has to as well once
`span(rows=2)` exists — that cell is two rows tall, not `N` pixels. `row_height` makes that
math obvious (`2 * row_height + row_gap`) and reuses the `st.dataframe` / `st.data_editor`
name for the integer case: each row is `N` pixels. The `"content"` and `"equal"` modes are
grid-specific extras; dataframes have no analog because their rows are already equal-height.
A container-level `height` is a different parameter (`st.container(height=...)`) and would
size the grid as a whole, not its rows.

#### Wrapping: `wrap` Plus `min_column_width`

The [horizontal wrap-control spec](../2026-07-23-horizontal-wrap-control/product-spec.md) adds
`wrap` to `st.container` and `st.columns` with a shared promise: `wrap=False` keeps the
controlled horizontal collection in one row and scrolls locally instead of moving items onto
another row. `st.grid` is the same kind of layout container, so it takes the same parameter
rather than encoding "never wrap" as a `None` sentinel on a different knob (Principles 10 and
11).

The two parameters are not alternatives; they answer different questions:

| Parameter | Question it answers |
| --- | --- |
| `wrap` | May the column count decrease when the container narrows? |
| `min_column_width` | How narrow may a cell get? Wrap threshold when `wrap=True`; shrink-then-scroll floor when `wrap=False`. |

**Option 1: Both `wrap` and `min_column_width`** ✅ PREFERRED

- Pros: `wrap=False` is the same spelling as `st.columns(wrap=False)` and
  `st.container(horizontal=True, wrap=False)`; `min_column_width` remains the grid-specific
  threshold that columns do not have, which is what makes `st.grid` the right tool for
  [#6592](https://github.com/streamlit/streamlit/issues/6592); the combination
  `st.grid(4, wrap=False, min_column_width=280)` is coherent, not contradictory — keep four
  columns, don't shrink cells below 280px, then scroll.
- Cons: Two parameters that both mention wrapping, so docs must state which knob does what.

**Option 2: Only `min_column_width=None` means no-wrap**

- Pros: One parameter; wrapping is modeled as a threshold rather than a boolean.
- Cons: Breaks the shared `wrap` vocabulary the moment that parameter ships on columns and
  containers; `None` is an implicit "off" rather than the explicit `wrap=False` users will
  already know.

**Option 3: Only `wrap`, drop `min_column_width`**

- Pros: Smallest API; identical surface to `st.columns`.
- Cons: Loses the configurable wrap threshold that is the grid's main advantage over
  `st.columns`; `wrap=True` would then wrap at an opaque implementation-defined width, which is
  exactly the `st.columns` limitation this feature exists to fix.

**Recommendation:** Ship both. `wrap` is the on/off shared with other layout containers;
`min_column_width` is the grid-specific threshold. Its default is `"auto"`, not a Python pixel
literal and not `None` (`None` reads as "no minimum," which is `wrap=False`).

Like `st.container` and `st.columns`, `st.grid` does **not** use the adaptive `wrap: bool | None
= None` default that the wrap spec gives to controls. A grid is a layout container, so
`wrap=True` is the fixed default (responsive wrapping, today's intended behavior) and a single
row of column tracks is requested only with an explicit `wrap=False`. Nested widgets inside a
grid cell also do not inherit a no-wrap auto default: a grid cell is a vertical region, like a
column, not a horizontal toolbar. A button or pill inside a cell still wraps unless it is
placed in `st.container(horizontal=True)` or passed `wrap=False` itself.

#### Auto Minimum Width

A Python default of `200` would be a magic pixel number: it would not scale with the root font
size, and `border=True` would silently steal ~2rem of content width (the same
`theme.spacing.lg` padding bordered `st.container` / `st.columns` cells use). Layout sizes
belong on the frontend in rem.

`"auto"` is preferred over `None`. `None` reads as "no minimum," which is `wrap=False`.
`"auto"` matches `columns="auto"` and `width="auto"`: Streamlit picks. The two `"auto"` values
on this command compose rather than collide — `st.grid()` means "as many columns as fit at the
theme's comfortable cell width."

**Resolution (frontend):**

- Unbordered: a theme token (target ~`12.5rem`, the prototype's 200px at a 16px root).
- Bordered: that token plus `2 * theme.spacing.lg`, so the *content* floor stays the same
  after the per-side `calc(spacing.lg - borderWidth)` padding and the border itself. Do not
  use a hand-tuned "add 50px" fudge in Python.
- An explicit pixel int is the outer cell/track width, matching `width=200`, and does **not**
  get extra border padding added on top. Pass an int only to opt out of the theme default
  (compact chip galleries, extra-wide charts).

Most apps should omit `min_column_width` entirely. `st.grid(4, border=True)` and
`st.grid(4)` then wrap at equivalent *content* widths.

#### Asymmetric Gaps: Tuple Versus Explicit Parameters

Grids are the first Streamlit layout where row and column spacing plausibly differ, so the
asymmetric form needs an explicit decision rather than a default.

**Option 1: `gap=("medium", "small")` 2-tuple** ✅ PREFERRED

- Pros: One parameter to learn; a single value still behaves exactly as in `st.columns` and
  `st.container` (Principle 10), so the tuple is purely additive; mirrors the CSS `gap`
  shorthand that the grid is built on.
- Cons: The order is only self-evident to readers who know the CSS shorthand —
  `gap=("medium", "small")` gives no in-code hint which value is the row gap (Principle 35).

**Option 2: Explicit `row_gap` / `column_gap` parameters**

- Pros: Unambiguous at the call site (Principles 6 and 35); composes naturally with a plain
  `gap` default.
- Cons: Two more parameters on a container that already has nine, for a case most apps never
  need (Principle 4); creates three overlapping ways to spell the same spacing.

**Recommendation:** Ship the tuple. It keeps the MVP parameter list small and stays additive
over the existing `gap` contract. Because a single `gap` value keeps working unchanged, explicit
`row_gap` / `column_gap` parameters remain a non-breaking follow-up if the tuple order proves
confusing in practice. Docs should always show the tuple next to a comment naming the axes.

Inside the tuple, `None` means "no gap on that axis" — the same thing scalar `gap=None` means —
rather than "fall back to the default." So `gap=(None, "small")` is no row gap with a small
column gap, and `gap=(None, None)` is equivalent to `gap=None`.

### GridContainer Methods

`st.grid` returns a `GridContainer`, a thin `DeltaGenerator` subclass. In addition to the
standard container methods, it exposes a spanning helper:

```python
grid.span(columns: int = 1, rows: int = 1) -> DeltaGenerator
```

`span()` creates the next auto-placed cell and asks it to span `columns` column tracks and
`rows` row tracks. Both default to `1`, so `grid.span()` behaves like a normal single cell. Like
other containers, the returned object works with `with` notation or method chaining.

Both arguments must be integers `>= 1`; `0`, negative values, and non-integers raise
`StreamlitValueBelowMinError` / `StreamlitValueError` at call time rather than being clamped,
matching how `st.columns` validates its spec (Principle 23).

A column span is capped at the number of columns the grid actually resolved to, so
`grid.span(columns=4)` renders two columns wide on a viewport where only two columns fit, and
one column wide on a phone that collapses to a single column. A spanning cell never widens the
grid or overflows it. This cap is a frontend layout behavior, not Python validation: Python
cannot know the resolved track count, so passing a `columns` value larger than the maximum
column count is legal and simply means "as wide as the grid gets." CSS Grid does not do this
capping on its own, so the frontend must clamp the emitted `grid-column: span N` to the resolved
track count. With `wrap=False` the resolved count is always the declared `columns` value, so the
cap is constant.

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
grid = st.grid(4, border=True, row_height=140)

for item in metrics:
    with grid.container():
        st.metric(item.label, item.value, item.delta)
        st.caption(item.caption)
```

This follows existing container composition instead of introducing a separate card API. A
future `grid.cell()` helper could make this pattern more explicit, but it is not required for
the minimal API.

The main way "direct child equals one cell" surprises people coming from `with st.container():`
is section headers: a bare `st.header(...)` written inside the grid takes one cell, producing a
ragged first row instead of a title above the cards. Docs should call this out, with the two
fixes: keep the heading outside the grid, or give it its own full-width cell via
`grid.span(columns=...)`.

#### Responsive Placement

`st.grid(4)` means "use up to four columns, but wrap earlier if four columns would make cells
narrower than the auto minimum." With an explicit `min_column_width=200` at default font size
that looks like:

- 1100px available width: 4 columns
- 700px available width: 3 columns
- 440px available width: 2 columns
- 320px available width: 1 column

The exact thresholds account for the configured gap and, when `min_column_width="auto"`, for
root font size and `border`. The calculation happens on the frontend from the actual container
width, so Python does not need to know the browser size.

`st.grid("auto")` creates as many columns as fit, with no explicit max. This is useful for
galleries. Most dashboard apps should pass an integer max column count.

When `wrap=True` and the container itself is narrower than the resolved minimum (for example a
180px sidebar against a ~12.5rem auto floor), the grid renders a single column at the
container's width. The minimum is a wrapping threshold, not a floor that forces horizontal
overflow.

#### No-Wrap Behavior

`wrap=False` with an integer `columns` keeps the declared column count at every container
width. Cells still fill multiple rows — a 12-item `st.grid(4, wrap=False)` is three rows of
four, not one row of twelve. What stays in one row is the *column tracks*, the same thing
`st.columns(4, wrap=False)` keeps in one row:

| Command | `wrap=False` keeps in one row | Overflow |
| --- | --- | --- |
| `st.container(horizontal=True)` | Direct child elements | Scroll the container |
| `st.columns` | Column containers | Shrink, then scroll the group |
| `st.grid` | The declared column tracks (cells still wrap onto additional *grid rows*) | Shrink cells to `min_column_width`, then scroll the grid |

`wrap=False` does **not** flatten the grid into a single row of cells. That layout is
`st.container(horizontal=True, wrap=False)` or `st.columns(n, wrap=False)`, not a grid.

The overflow contract matches the wrap spec's shared no-wrap behavior for collections:

- Overflow is contained by the grid, never by the full app page.
- Cells may shrink with the group until they reach `min_column_width`. Once they would go
  below that width and still do not fit, the grid scrolls horizontally rather than overflowing
  the page or wrapping to fewer columns.
- Native horizontal scrolling is enabled only when the tracks cannot shrink enough to fit.
- Touch, trackpad, mouse shift-wheel, and keyboard scrolling use browser-native behavior.
- Keyboard focus automatically scrolls an off-screen cell into view.
- No content is removed from the DOM, so accessible names and keyboard order are unchanged.
- `wrap` is layout-only: changing it must not reset a widget's value or session state.

So `st.grid(4, wrap=False)` on a 320px phone keeps four columns and scrolls, rather than
rendering unreadable ~70px cells or collapsing to one column. `st.grid("auto", wrap=False)`
raises, because auto mode has no declared column count to keep.

`min_column_width` still applies when `wrap=False`: it is the shrink-then-scroll floor instead
of a wrap threshold. `st.grid(4, wrap=False)` therefore uses the auto rem floor (plus cell
padding when bordered); `st.grid(4, wrap=False, min_column_width=280)` keeps four columns and
starts scrolling once cells would drop below 280px.

#### Height And Alignment

With `row_height="content"`, each row's height is the height of the tallest cell in that
row. Borders and backgrounds stretch to that row height, so cards in a row align cleanly.
Rows can still have different heights.

With `row_height="equal"`, all rows share the same height, based on the tallest row/cell in
the grid. This is useful for gallery/card walls where users want the grid to look uniform
across rows without choosing a fixed pixel height. `"equal"` is part of the MVP and is
implemented with CSS only (equal-height row tracks, e.g. `grid-auto-rows: 1fr` within an
equal-track context), with no JavaScript measurement in the initial release. The fallback
contract if a pure-CSS approach proves unreliable on a supported browser is defined in the
[Risks](#risks) section: `"equal"` stays in the public API and degrades gracefully to
`"content"` behavior rather than being removed or shipping broken layout.

With `row_height=160`, every row is 160px tall, so an ordinary cell is 160px and a
`grid.span(rows=2)` cell is `2 * 160 + row_gap`. Sizing rows rather than cells is what makes
row spans predictable, which is why a fixed `row_height` (or `"equal"`) is the recommended
pairing for `span(rows=…)`. If content exceeds the row height, the cell scrolls using the same
design constraints as fixed-height containers.

`vertical_alignment` controls how a child is placed within extra vertical space. This is most
noticeable for mixed widgets, buttons, metrics, and charts in fixed-height or row-stretched
cells.

#### Last Row

The last row contains only the remaining items: the grid never emits placeholder cells, so
there are no stray borders or backgrounds where the row runs out of content. With a fixed
column count the unused tracks still reserve their share of the width, so the final items keep
the same width as the rows above them rather than stretching to fill the row.

#### Nesting

Grid cells support the same nesting as any other container: `st.container`,
`st.container(horizontal=True)`, `st.columns`, and nested `st.grid`. Docs recommend keeping
nested layout shallow. There is no CSS `subgrid` support in the MVP.

#### Fragments

`st.grid` works inside `@st.fragment`, and a grid cell can contain fragment-rendered content
just like any other container. The grid introduces no new state, so widget and fragment
behavior follow existing container semantics.

#### Accessibility

Responsive wrapping changes only the number of columns, not the source/DOM order of cells, so
keyboard tab order and screen-reader reading order continue to follow the order in which
elements are written. `wrap=False` also leaves source order unchanged; the extra accessibility
requirement is that keyboard focus scrolls a horizontally off-screen cell into view, as in the
wrap spec. This keeps the common gallery/repeated-card MVP aligned with WCAG 2.1
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

**Open decision:** several reviewers have argued for `dense=False` as the default on the grounds
that accessibility should be the safe default (Principle 36) and that the value of dense packing
only appears in the spanning case, which is not the MVP's primary use case. The counter-argument
is above. The default is a behavioral flag rather than a structural one, so it is cheap to flip
either way, but it should be signed off explicitly rather than inherited from the prototype.

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

grid = st.grid(4, border=True, row_height="equal")

for label, value, delta, caption in metrics:
    with grid.container():
        st.metric(label, value, delta)
        st.caption(caption)
```

#### Responsive Gallery

```python
import streamlit as st

items = ["Apple", "Lemon", "Grape", "Kiwi", "Peach", "Cherry", "Coconut", "Pineapple"]

with st.grid("auto", min_column_width=72, gap="xsmall"):  # compact chips; override auto
    for item in items:
        st.button(item, key=f"item-{item}", width="stretch")
```

#### Dashboard Cards

```python
import streamlit as st

grid = st.grid(3, min_column_width=320, gap=("medium", "small"), border=True)  # charts need room

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

#### Fixed Column Count (No Wrap)

```python
import streamlit as st

# Three charts stay side by side on every viewport. On a phone the grid
# scrolls horizontally instead of stacking into unreadably tall single-column charts.
grid = st.grid(3, wrap=False, border=True)

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
grid = st.grid(4, border=True)

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
- Overlaps with `span()`: shipping both leaves the grid with two cell constructors, unless
  `cell()` absorbs spanning via `column_span` / `row_span` parameters.

**Recommendation:** Treat as a compatible extension, not part of the minimal API. The MVP can
use normal `grid.container()` composition. See the open question under
[Cursor-Based Span Cells](#included-grid-object-helper-cursor-based-span-cells) for the
`span()`-versus-`cell()` decision.

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
grid = st.grid(4, border=True)

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

**Constraints learned from the prototype:**

- Column spans must be capped to the resolved column count by the frontend. CSS Grid does not
  do this on its own, and the naive workarounds produce layout bugs, so this is real
  implementation work rather than a free property of the CSS. See the linked tech spec for the
  CSS-level details.
- Row spans are only visually meaningful when row tracks have a predictable height, so
  `row_height=<int>` (or `"equal"`) is the recommended pairing for `span(rows=…)`.

**Overlap with `grid.cell()` (open question):** `span()` reuses the name `columns` for a
per-cell span while `st.grid(columns=…)` means the track count, and a later `grid.cell()` helper
would give the grid two cell constructors. A single
`grid.cell(*, column_span: int = 1, row_span: int = 1)` covering both cases is a plausible
alternative that keeps `grid.cells(n)` as a natural follow-up. This spec keeps `span()` for the
MVP because it reads well at the call site for the common "make the next chart wider" case, but
the choice between the two shapes is a deliberate API decision that should be settled in review
before implementation.

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
- Overlaps with a future `grid.cell()` helper, and reuses `columns` for a per-cell span.

### Compatible Extension: Slice-Addressed Cells

```python
grid = st.grid(12, rows=4, wrap=False)

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
grid = st.grid(columns=[2, 1, 1], wrap=False)
```

This mirrors `st.columns([2, 1, 1])` and Matplotlib GridSpec width/height ratios.

**Pros:**

- Familiar from `st.columns`.
- Useful for fixed dashboard layouts.
- Could pair with slice-addressed or mosaic APIs.

**Cons:**

- Weighted tracks interact poorly with automatic responsive wrapping because the meaning of
  `[2, 1, 1]` changes when the grid collapses to fewer columns. They would pair naturally with
  `wrap=False` (fixed tracks, shrink-then-scroll), which is how `st.columns([2, 1, 1])` is
  expected to behave once wrap-control ships.
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
grid = st.auto_grid(columns=4, row_height="equal")

for product in products:
    with grid.container():
        render_product_card(product)
```

This names the responsive gallery mode directly and separates it from fixed-column grids. The
parameter names are kept identical to the proposal so the comparison is about the command
split, not about naming.

**Pros:**

- The command name communicates that the column count is browser-responsive.
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
st.grid(columns="auto", *, min_column_width="auto", wrap=True, gap="small",
        vertical_alignment="top", border=False, row_height="content",
        width="stretch", dense=True) -> GridContainer
```

The returned `GridContainer` extends `DeltaGenerator` and provides a
`span(columns: int = 1, rows: int = 1)` method for creating cells that span multiple grid
tracks.

This solves the highest-confidence need: dynamic, responsive, equal-track cards and galleries.
It also creates a natural foundation for later mosaic APIs because the frontend block is backed
by CSS Grid from the start.

**Guidance validated by the prototype:**

- Most apps should omit `min_column_width` and use `"auto"`. The frontend default of ~`12.5rem`
  matches the prototype's 200px at a 16px root, and bordered cells add `2 * theme.spacing.lg`
  so padding does not shrink the content floor. Do not document a parallel "use 250 when
  bordered" rule.
- Pass an explicit pixel int when the content needs a different floor: compact chip galleries
  (`min_column_width=72`) or charts with axis labels (`min_column_width=320`). Explicit ints
  are the outer cell width and do not get border padding added on top.
- `wrap=False` is the lever for content that must keep a column count (side-by-side charts
  that should scroll on a phone rather than stack).

## Risks

- **`row_height="equal"` cross-browser reliability.** The MVP commits to a CSS-only
  implementation of equal row heights. If equal-height tracks prove unreliable on a supported
  browser, the fallback contract is that `row_height="equal"` degrades gracefully to
  `row_height="content"` behavior (rows size to their tallest cell) rather than being removed
  from the public API or silently shipping broken layout. The value stays in the public
  `Literal` either way, so apps never need to change to upgrade safely.
- **CSS `safe` alignment support.** `safe` alignment keywords are not used anywhere in
  `frontend/` today and are unsupported on part of our `>0.2%, not dead` browserslist target.
  A browser that does not understand the keyword drops the whole declaration, which would
  silently turn `vertical_alignment="center"` / `"bottom"` back into stretch. The MVP therefore
  emits the two-declaration fallback (`align-items: center; align-items: safe center;`) so
  unsupporting browsers keep the plain alignment and only lose overflow protection.
- **Dense packing and reading order.** `dense=True` only diverges visual order from DOM/focus
  order when `grid.span()` produces differently sized cells (see the Accessibility section).
  The default is revisitable during implementation, and strict order is always available via
  `dense=False`.
- **`columns="auto"` with `wrap=False`.** This combination is invalid (auto mode is defined by
  wrapping). It raises `StreamlitAPIException` with an actionable message rather than guessing
  a column count.

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
| Fixed side-by-side regions that must not stack | `st.columns(..., wrap=False)` |
| Toolbar, chips, or natural-width wrapped controls | `st.container(horizontal=True)` |
| Repeated cards/gallery/dashboard tiles | `st.grid` |
| Repeated tiles that must keep a column count | `st.grid(n, wrap=False)` |
| One bordered multi-element region | `st.container(border=True)` |

The `st.grid` docs should include examples for metric cards, image/component galleries,
dashboard cards, nested flex controls, and a no-wrap dashboard that scrolls horizontally.
They should also cross-link the `wrap` parameter on `st.container` / `st.columns` and spell
out that `st.grid(wrap=False)` keeps column *tracks* in one row rather than flattening cells
into a single row.

## Checklist

| Item | ✅ or comment |
| --- | --- |
| Works on SiS, Cloud, etc? | Yes. Frontend CSS Grid and existing block protocol patterns should work in all runtimes. |
| No breaking API changes | Yes. New command only. |
| No new dependencies | Yes. Use native CSS Grid. |
| Metrics collected | Yes. Add `gather_metrics("grid")`; optionally track coarse non-content options such as `columns` mode, `wrap`, `border`, and `row_height` mode. |
| Any security/legal impact? | None expected. Layout-only feature; no new content execution path. |
| Any docs changes needed? | Yes. Add API docs and update layout guide/examples. |
| Accessibility verified? | Before ship: keyboard tab order and screen-reader reading order checked on a grid with spanning cells under both `dense=True` and `dense=False` (WCAG 2.1 SC 1.3.2 and SC 2.4.3), per the Accessibility section. |
