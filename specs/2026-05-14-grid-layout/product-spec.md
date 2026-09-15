---
author: lukasmasuch
created: 2026-05-14
---

# Grid Layout

## Summary

Add `st.grid`, a responsive layout container for repeated cards, metric walls, galleries,
and dashboard panels. Direct children auto-place into equal-width cells and wrap from
**container width**, not the viewport. `wrap=False` keeps the declared column count, matching
`st.columns` and `st.container(horizontal=True)`.

This sits next to the other layout primitives: `st.columns` for a known row of regions,
`st.container(horizontal=True)` for natural-width toolbars, `st.grid` for repeated
equal-track items. The problem is **width** — how many tracks fit, and when to reflow.
Dashboards scroll vertically like any other Streamlit page. `row_height="equal"` aligns a
card wall; `height` exists for consistency and for the minority of bounded regions, not to
divide the viewport.

`grid.cell()` is the one constructor for grouping elements or spanning tracks. Panel chrome
(title, icon, background, header actions) belongs to a separate `st.card`, not the grid.

## Problem

### User Requests

- [#11101](https://github.com/streamlit/streamlit/issues/11101) - Grid layout
- [#5353](https://github.com/streamlit/streamlit/issues/5353) - Wrap columns/grids on
  different screen sizes
- [#6592](https://github.com/streamlit/streamlit/issues/6592) - Configurable column
  responsiveness width threshold
- [#3052](https://github.com/streamlit/streamlit/issues/3052) - Vertical alignment for
  columns

Issue #11101 describes two needs: a gallery of similar items, each in one cell; and more
complex dashboards where charts, metrics, and dataframes occupy aligned regions. The first
is still awkward after flex layout and is the MVP. The second is partly possible with
`st.columns` and nested containers; the grid adds equal tracks, container-width wrapping,
and cursor-based spans, and leaves named mosaics as a follow-up.

### Current Workarounds

Users fake a grid by repeating `st.columns`:

```python
for row in range(3):
    cols = st.columns(4)
    for col in cols:
        with col:
            st.metric(...)
```

That fails in several ways: each row is independent, so items cannot reflow as one grid;
`st.columns` wraps only at a narrow viewport threshold, which makes charts and cards too
narrow on laptops; empty cells in the last row leave stray spacing; dynamic lists need
chunking; equal-looking cards need nested containers and hand-coordinated heights.

`st.container(horizontal=True)` is a flex row: good for toolbars, not for equal-width
tracks or a column cap. Custom CSS, custom components, and
[`streamlit-extras` grid](https://arnaudmiribel.github.io/streamlit-extras/extras/grid/)
exist, but they are not a core dashboard-building workflow.

### Use Cases

1. **Metric card wall**: 8–20 KPIs, 4 columns on a wide screen, 2–3 on a laptop, 1 on a phone.
2. **Gallery / listing**: A dynamic catalog of uniformly sized cards.
3. **Dashboard cards**: Charts, tables, and filters that align and wrap without becoming
   unreadable.
4. **Control grids**: Many buttons or chips filling width without chunking.
5. **Fixed-region dashboard** (minority): A print/PDF report, wall display, or grid nested
   in a height-bounded container, where height is divided between rows instead of accumulating.
   Most dashboards scroll, like Grafana, Datadog, Metabase, and Superset.
6. **Future advanced dashboards**: Explicit spans or named regions, similar to Matplotlib
   GridSpec or `subplot_mosaic`.

## Prior Art

UI libraries split a simple responsive grid for repeated items from an explicit grid for
spans and regions:

| Source | Relevant pattern | Takeaway |
| --- | --- | --- |
| [CSS Grid](https://developer.mozilla.org/en-US/docs/Web/CSS/minmax) | `minmax()`, named areas, `span N` | Native tracks map well, but `auto-fit` is not enough once last-row width and span clamping matter. |
| [Chakra SimpleGrid](https://chakra-ui.com/docs/components/simple-grid) | `columns` or `minChildWidth` | `min_column_width` is a better dashboard default than viewport breakpoints. |
| [Mantine SimpleGrid](https://v3.mantine.dev/core/simple-grid/) / [Grid](https://mantine.dev/core/grid/) | Simple `cols` vs 12-column spans | Keep the common case simple; span APIs are verbose for Streamlit's gallery use. |
| [MUI Grid](https://mui.com/material-ui/react-grid/) / [Bootstrap](https://getbootstrap.com/docs/5.0/layout/grid/) | Breakpoint maps, 12-column systems | Familiar to frontend developers, heavy and un-Pythonic as the first API. |
| [Elastic UI FlexGrid](https://eui.elastic.co/docs/components/layout/flex/grid/) | Repeated same-width items | First-class pattern for dashboard cards. |
| [Grafana panels](https://grafana.com/docs/grafana/latest/panels-visualizations/) | Scrollable 24-column grid; each panel has its own header | Dashboards scroll; panel chrome is not the track model. |
| [Gradio Row](https://www.gradio.app/docs/gradio/row) | `scale`, `min_width` | Minimum child width is an understandable Python-facing control. |
| [Matplotlib GridSpec](https://matplotlib.org/3.5.0/tutorials/intermediate/gridspec.html) / [subplot_mosaic](https://matplotlib.org/stable/api/_as_gen/matplotlib.pyplot.subplot_mosaic.html) | Slices, named regions | Powerful follow-ups; indexing is less friendly for dynamic apps. |
| [React Grid Layout](https://github.com/react-grid-layout/react-grid-layout) | Draggable/resizable dashboards | Too interactive and dependency-heavy for the first primitive. |

## Proposal

Ship `st.grid` as a **responsive auto-placement container**.

```python
st.grid(
    columns: Literal["auto"] | int = "auto",
    *,
    min_column_width: Literal["auto"] | int = "auto",
    wrap: bool = True,
    gap: Gap | tuple[Gap | None, Gap | None] | None = "small",
    vertical_alignment: Literal["top", "center", "bottom"] = "top",
    border: bool = False,
    row_height: Literal["content", "equal"] | int = "content",
    width: WidthWithoutContent = "stretch",
    height: Height = "content",
    key: Key | None = None,
    dense: bool = False,
) -> GridContainer
```

Type aliases are the shared ones from `st.columns` / `st.container`
(`lib/streamlit/elements/lib/layout_utils.py`):

- `Gap` is a named scale step or a non-negative pixel int. `None` means no gap.
  `st.grid` also accepts a 2-tuple or 2-list `(row_gap, column_gap)`; a single value
  still sets both axes.
- `WidthWithoutContent` is `int | Literal["stretch"]`. `"content"` width is omitted
  because cells already size to equal tracks.
- `Height` and `Key` match `st.container`. `"stretch"` still needs a height-bounded
  ancestor.

**On the name `st.grid`:** Principle 8 uses `st.grid(cols=3)` as an anti-example, but the
geeky part is the CSS-style `cols=` abbreviation, which this API avoids. "Grid" is everyday
English, the word in [#11101](https://github.com/streamlit/streamlit/issues/11101), and the
shared name across MUI, Mantine, Chakra, and Bootstrap. Narrower names (`st.cards`,
`st.gallery`) cover only one use case. If the name is approved, update the Principle 8
example to `st.grid(cols=3)` → `st.grid(columns=3)` so it still illustrates the abbreviation.

### Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `columns` | `"auto"` or `int >= 1` | `"auto"` | Max equal-width columns. `"auto"` fits as many as the container allows. An integer caps the count and, with `wrap=True`, wraps earlier when cells would fall below `min_column_width`. |
| `min_column_width` | `"auto"` or `int >= 1` | `"auto"` | Preferred cell floor. `"auto"` is a frontend rem token, padded when `border=True`. An explicit int is the outer cell width (like `width=200`) and is not padded on top. Wrap threshold when `wrap=True`; shrink-then-scroll floor when `wrap=False`. See [Auto minimum width](#auto-minimum-width). |
| `wrap` | `bool` | `True` | Whether the column count may decrease. Same name and layout-container default as [`st.container` / `st.columns`](../2026-07-23-horizontal-wrap-control/product-spec.md). `False` keeps the declared count and scrolls locally. Invalid with `columns="auto"`. Not an adaptive `None` default. |
| `gap` | gap size, `(row_gap, column_gap)`, or `None` | `"small"` | Space between cells. A scalar matches `st.columns`. A 2-tuple or 2-list is `(row_gap, column_gap)`, matching CSS `gap`. See [Asymmetric gaps](#asymmetric-gaps-tuple-versus-explicit-parameters). |
| `vertical_alignment` | `"top"`, `"center"`, `"bottom"` | `"top"` | Placement of a child when its cell is taller. Uses CSS `safe` alignment so oversized content stays reachable ([Risks](#risks)). |
| `border` | `bool` | `False` | Border and padding around each cell, matching `st.columns` / `st.container`. |
| `row_height` | `"content"`, `"equal"`, or `int >= 1` | `"content"` | Height of each **row**, not each cell. `"content"` sizes to the row's tallest cell. `"equal"` makes every row the same height. An integer is pixels, so `cell(row_span=2)` is `2 * row_height + row_gap`. See [Height and space division](#height-and-space-division). |
| `width` | `"stretch"` or `int` | `"stretch"` | Grid container width, matching `st.columns`. |
| `height` | `"content"`, `"stretch"`, or `int` | `"content"` | Grid container height, matching `st.container`. `"content"` grows and the page scrolls. An integer or `"stretch"` bounds the grid; `"equal"` rows then divide that height. |
| `key` | `str` or `None` | `None` | Stable identity (`st-key-<key>`), matching `st.container`. Also used by [layout container state persistence](../2026-02-26-layout-container-state-persistence/tech-spec.md). |
| `dense` | `bool` | `False` | When `True`, backfill gaps left by spanning cells, which can reorder visual vs DOM order. Default keeps source order. See [Accessibility](#accessibility). |

Invalid arguments fail immediately (Principle 23):

| Invalid input | Error |
| --- | --- |
| `columns` integer `< 1` | `StreamlitValueBelowMinError` |
| `min_column_width` integer `< 1`, or a string other than `"auto"` | `StreamlitValueBelowMinError` / `StreamlitValueError` |
| `columns="auto"` with `wrap=False` | `StreamlitAPIException`: auto mode is defined by wrapping; use `wrap=True` or an integer `columns` |
| `row_height` integer `< 1`, or a string other than `"content"` / `"equal"` | `StreamlitValueBelowMinError` / `StreamlitValueError` |
| `height` outside the shared `Height` contract | Same errors as `st.container` |
| `gap` outside the shared scale | Same errors as `st.columns` |
| `gap` sequence whose length is not 2 | `StreamlitValueError`: a pair must be `(row_gap, column_gap)` |
| Either slot of a `gap` pair is invalid | Same errors as `st.columns`, naming the slot |

`height` and `row_height` never conflict. `row_height="equal"` with default
`height="content"` is the card-wall case and is not gated behind a bounded height.

`dense` stays a boolean (Principle 16). CSS `grid-auto-flow` also has `row` / `column`, but
those pick the auto-placement *axis*, which `st.grid` fixes to row-major. The user-facing
choice is only whether to backfill gaps. A future axis parameter would be a separate concept.

`row_height` is not `cell_height` because `"content"` / `"equal"` / pixel values all size
**rows**. A `cell(row_span=2)` cell is two rows tall, so the math is
`2 * row_height + row_gap`. The integer case reuses the `st.dataframe` /
`st.data_editor` name. `height` sizes the grid; `row_height` sizes its rows.

### GridContainer Methods

`st.grid` returns a `GridContainer` (`DeltaGenerator` subclass) with one extra constructor:

```python
grid.cell(*, column_span: int = 1, row_span: int = 1) -> DeltaGenerator
```

`grid.cell()` creates the next auto-placed cell. With no arguments it groups multiple
elements into one cell. `column_span` / `row_span` occupy more tracks. The returned object
works with `with` or method chaining.

The span arguments are keyword-only (Principle 17): spanning is an enhancement, and
positional slots stay reserved. The names keep `st.grid(columns=…)` meaning "how many
tracks" rather than overloading `columns` as "tracks this cell occupies."

Both arguments must be integers `>= 1`; `0`, negatives, and non-integers raise
`StreamlitValueBelowMinError` / `StreamlitValueError` at call time, matching `st.columns`
(Principle 23).

A column span is **clamped to the resolved column count** by the frontend, so
`grid.cell(column_span=4)` is two columns wide when only two tracks fit, and one column
wide on a phone. Python cannot know that count, so a span larger than `columns` is legal
and means "as wide as the grid gets." CSS `grid-column: span 4` on a two-track grid
creates implicit columns and overflows, so this clamp is real work and shares the
[resolved column count](#responsive-placement) wrapping already needs. With `wrap=False`
the count is the declared `columns`, so the cap is constant.

`grid.container()` still works: a nested container is one cell when it is a direct child.
Docs recommend `grid.cell()` for placement, especially multi-element or spanning cells.
Use `grid.container(...)` when you need container parameters `cell()` does not have
(horizontal layout, its own height, its own border).

Do not ship `grid.span()`. A span is still a cell, so two constructors would overlap
(Principle 11), and `span(columns=…)` would reuse `columns` for a different meaning
(Principle 35). Do not ship `grid.cells(n)`: a predeclared count reintroduces
[Fixed Cell List](#alternative-api-fixed-cell-list).

### Behavior

#### Direct Children Become Cells

Every direct child occupies one cell. Users can write into the returned container or use
`with`:

```python
grid = st.grid(4)

grid.metric("Revenue", "$1.2M", "+8%")
grid.metric("Conversion", "12.4%", "+1.1%")

with grid:
    st.line_chart(df)
    st.dataframe(df)  # two cells
```

Group multiple elements with an explicit cell:

```python
grid = st.grid(4, border=True, row_height=140)

for item in metrics:
    with grid.cell():
        st.metric(item.label, item.value, item.delta)
        st.caption(item.caption)
```

The surprising case, coming from `with st.container():`, is a section header: a bare
`st.header(...)` inside the grid takes one cell and leaves a ragged first row. Keep the
heading outside the grid, or give it a full-width `grid.cell(column_span=...)`.

#### Panel Chrome Comes From `st.card`

A BI panel (title, icon, background, later header actions) is useful in a column, the
sidebar, or on its own, so it is its own container rather than a grid parameter
(Principle 19). This spec assumes a separate `st.card`, specced independently, roughly
`st.card(title=None, *, icon=None, width="stretch", height="content", key=None)`. `title`
follows `st.dialog` (a header, not a control) rather than `st.expander`'s `label`.

Placement and chrome stay separate: `with grid.cell():` for a multi-element cell,
`with grid.cell().card("Revenue"):` or `grid.cell(column_span=2).card("Revenue")` for a
titled panel. `st.card` does not obsolete `grid.cell()`.

The chained spanning panel is the clunkiest dashboard line. `grid.card(..., column_span=2)`
is worse: it leaks grid tracks into a container that must work anywhere. Keep the chain.

`st.grid(border=True)` stays: cheapest aligned metric wall when no cell needs a title, and
grid-owned borders stretch to the row height. Docs: `border=True` for uniform bordered
cells, `st.card` when a panel needs a title, icon, or background.

#### Wrapping: `wrap` Plus `min_column_width`

The [wrap spec](../2026-07-23-horizontal-wrap-control/product-spec.md) gives layout
containers a shared promise: `wrap=False` keeps the collection in one row and scrolls
locally. `st.grid` is the same kind of container, so it takes the same parameter instead of
encoding "never wrap" as `None` on a different knob (Principles 10 and 11).

The two parameters answer different questions:

| Parameter | Question |
| --- | --- |
| `wrap` | May the column count decrease when the container narrows? |
| `min_column_width` | How narrow may a cell get? |

**Option 1: Both** ✅ PREFERRED. `wrap=False` matches columns and flex containers;
`min_column_width` is the grid-specific threshold that fixes
[#6592](https://github.com/streamlit/streamlit/issues/6592).
`st.grid(4, wrap=False, min_column_width=280)` is coherent: keep four columns, don't
shrink below 280px, then scroll. Cost: docs must say which knob does what.

**Option 2: Only `min_column_width=None` means no-wrap.** One parameter, but it breaks the
shared `wrap` vocabulary and uses `None` as an implicit off.

**Option 3: Only `wrap`, drop `min_column_width`.** Smallest API, but wrapping would then
happen at an opaque width — the `st.columns` limitation this feature exists to fix.

**Recommendation:** Ship both. `wrap` is the on/off; `min_column_width` is the threshold.
Default `"auto"`, not a Python pixel literal and not `None` (`None` reads as "no minimum,"
which is `wrap=False`).

Like other layout containers, `st.grid` does **not** use the adaptive
`wrap: bool | None = None` default that the wrap spec gives to controls. `wrap=True` is
the fixed default; a single row of tracks needs an explicit `wrap=False`. Nested widgets
inside a cell also do not inherit a no-wrap auto default: a grid cell is a vertical
region, like a column. A button or pill inside a cell still wraps unless it is in
`st.container(horizontal=True)` or passed `wrap=False` itself.

#### Auto Minimum Width

A Python default of `200` would be a magic pixel number: it would not scale with the root
font, and `border=True` would silently steal ~2rem of content width (the same
`theme.spacing.lg` padding bordered containers use). Layout sizes belong on the frontend
in rem.

`"auto"` is preferred over `None`. `None` reads as "no minimum." `"auto"` matches
`columns="auto"`: Streamlit picks. `st.grid()` then means "as many columns as fit at the
theme's comfortable cell width."

**Resolution (frontend):**

- Unbordered: a theme token (target ~`12.5rem`, the prototype's 200px at a 16px root).
- Bordered: that token plus `2 * theme.spacing.lg`, so the *content* floor stays the same
  after padding and the border. No hand-tuned "add 50px" in Python.
- An explicit pixel int is the outer track width and does **not** get extra border padding.
  Pass an int only to opt out of the theme default (compact chips, extra-wide charts).

Most apps should omit `min_column_width`. `st.grid(4)` and `st.grid(4, border=True)` then
wrap at equivalent *content* widths. Do not document a parallel "use 250 when bordered"
rule.

#### Responsive Placement

`st.grid(4)` means "up to four columns, wrap earlier if four would make cells narrower
than the auto minimum." With an explicit `min_column_width=200` at default font size:

- 1100px available: 4 columns
- 700px: 3
- 440px: 2
- 320px: 1

Thresholds account for the **column** gap and, when `"auto"`, for root font size and
`border`. The calculation uses actual container width — sidebar, nested container, or
embed — not the `st.columns` 640px viewport breakpoint.

That **resolved column count** `N` is shared by wrapping, last-row track reservation, and
span clamping. CSS `auto-fit` / `minmax` can wrap without measuring, but it collapses
empty last-row tracks (leftover items stretch) and cannot clamp `span N`. The MVP computes
`N` with the same resize-observer pattern other layout containers use, then sets
`repeat(N, …)`.

`st.grid("auto")` fits as many columns as possible, with no max. Useful for galleries;
most dashboards should pass an integer cap.

When `wrap=True` and the container is itself narrower than the minimum (a 180px sidebar
against a ~12.5rem floor), the grid renders one column at the container's width. The
minimum is a wrapping threshold, not a floor that forces horizontal overflow.

**Last row:** no placeholder cells, so no stray borders where the row runs out. Unused
tracks still reserve width, so leftover items stay the same width as the rows above.
That is why wrapping uses an explicit track template rather than `auto-fit`.

#### No-Wrap Behavior

`wrap=False` with an integer `columns` keeps that column count at every width. Cells still
fill multiple *grid rows* — twelve items in `st.grid(4, wrap=False)` is three rows of four,
not one row of twelve. What stays in one row is the *column tracks*:

| Command | `wrap=False` keeps in one row | Overflow |
| --- | --- | --- |
| `st.container(horizontal=True)` | Direct child elements | Scroll the container |
| `st.columns` | Column containers | Shrink, then scroll the group |
| `st.grid` | Declared column tracks (cells still wrap onto additional grid rows) | Shrink cells to `min_column_width`, then scroll the grid |

Flattening into a single row of cells is `st.container(horizontal=True, wrap=False)` or
`st.columns(n, wrap=False)`, not a grid.

Overflow matches the wrap spec: contained by the grid, never the page; native scrolling
when tracks cannot shrink enough; keyboard focus scrolls an off-screen cell into view;
changing `wrap` does not reset widget state. Grid-specific: tracks may shrink to
`min_column_width` even if a child (chart, dataframe) is intrinsically wider — overflow
is then inside the cell.

So `st.grid(4, wrap=False)` on a 320px phone keeps four columns and scrolls, rather than
~70px cells or a collapse to one column. `st.grid("auto", wrap=False)` raises.

`min_column_width` is the shrink-then-scroll floor when `wrap=False`.
`st.grid(4, wrap=False)` uses the auto rem floor (plus padding when bordered);
`st.grid(4, wrap=False, min_column_width=280)` starts scrolling once cells would drop
below 280px.

**Open decision: the auto floor and high track counts.** The auto floor is tuned for
galleries and makes a 12-track dashboard unusable: `st.grid(12, wrap=False)` demands
~2400px plus gaps. The only workaround is `min_column_width=1`, which reads like a bug
(Principle 35). A 12-track grid is the familiar way to express asymmetric regions with
spans.

**Option 1: Keep the auto floor; small track counts are the dashboard shape** ✅ PREFERRED.
One rule for both wrap modes; unreadably narrow cells never render; `st.grid(4)` with
`cell(column_span=2)` already expresses 50/25/25. Cost: [weighted tracks](#compatible-extension-weighted-columns-and-rows)
become the real answer for asymmetric regions, so the MVP's dashboard story is spans
within small track counts.

**Option 2: `"auto"` means no floor when `wrap=False`.** Unblocks 12-track recipes, but
`st.grid(3, wrap=False)` on a phone would render ~100px charts instead of scrolling —
the outcome `wrap=False` exists to avoid.

**Option 3: Document `min_column_width=1` as the high-track recipe.** No semantic change;
the main dashboard recipe is then a magic "ignore this parameter" argument.

#### Height And Space Division

**Grids scroll by default.** Rows accumulate and the page grows, like every other
Streamlit block and like Grafana / Datadog / Metabase / Superset. The vertical need is
consistency within a row and a scroll boundary inside a panel that holds a long table —
already `row_height` and the `height` parameters elements already have.

| `row_height` | Rows |
| --- | --- |
| `"content"` (default) | Each row is as tall as its tallest cell. Borders stretch to that row, so cards in a row still align. |
| `"equal"` | Every row has the same height. In a scrolling grid that height is the tallest row, **measured from content**. In a bounded grid the same name divides the definite height. The card-wall case is the scrolling one. |
| `<int>` | Every row is that many pixels. `cell(row_span=2)` is `2 * row_height + row_gap`. Overflow scrolls inside the cell. |

`"equal"` is **not** free CSS in a scrolling grid. CSS `1fr` only divides leftover space;
in `height="content"` there is none, so `1fr` rows size to their own content — which is
`"content"` behavior. Cross-row equalization needs a measurement of the tallest row. In a
height-bounded grid, `1fr` *does* divide leftover space (CSS-only). Stretch children must
not feed the measurement, or a `height="stretch"` chart would circularly size the row. A
first-paint frame may show content-sized rows; after that, `"equal"` must not silently
fall back to `"content"`.

Row spans work under all three modes. With `"equal"`, `cell(row_span=2)` is twice the
common row height plus the gap, which is predictable without pinning pixels. Row spans
read best paired with `"equal"` or an integer; with default `"content"` they cross two
rows of potentially different heights.

**`row_height="equal"` vs `"stretch"`:**

**Option 1: `"equal"`, including on scrolling grids** ✅ PREFERRED. Names the card-wall
case (Principle 8); `st.grid(4, row_height="equal")` works without a pixel height. Cost:
measurement, and the name is slightly off in a bounded grid (rows divide space rather
than matching content).

**Option 2: `"stretch"`.** Shared `Height` vocabulary, but inaccurate for the common
scrolling case — rows match the tallest row, they do not fill the page.

**Option 3: `"equal"` only on bounded grids.** CSS-only, but the documented card wall
would be a silent no-op or an error (Principle 23).

**Recommendation:** Ship `"equal"` for both scrolling and bounded grids. Document the
card wall as `st.grid(4, row_height="equal")`, and note that a bounded grid divides height
between equal rows instead of matching the tallest one.

`height` is included for consistency (`st.container` already has it; omitting it would
make the new container the odd one out) and so `row_height` can be documented against
both scrolling and bounded grids from day one. When the grid is bounded,
`row_height="equal"` divides that height and `row_height=<int>` keeps pixel rows and
scrolls if they overflow. The fixed-region dashboard is
`st.grid(2, height=720, row_height="equal")`. `"stretch"` on the grid itself follows the
shared `Height` rule ([Risks](#risks)).

`vertical_alignment` places a child in leftover vertical space — most noticeable for mixed
widgets in fixed-height or equalized rows.

#### Filling A Definite-Height Cell

Whenever a row has a definite height (`row_height=<int>`, `"equal"` after measurement, or
`"equal"` inside a bounded grid), the cell is height-bounded and content can resolve
`height="stretch"`:

```python
grid = st.grid(3, row_height=260, border=True)

with grid.cell():
    st.subheader("Revenue")
    st.line_chart(df, height="stretch")
```

Content does **not** stretch automatically. That matches `st.container(height=300)`
(Principle 10) and `vertical_alignment="top"`. Auto-stretching a lone child would be
convenient for panels, but it would need those two parameters reconciled first.

Docs should show `height="stretch"` on the chart or dataframe in every definite-height
example meant to fill the cell. The failure mode is silent (whitespace or an inner
scrollbar). This is a real implementation commitment: `height="stretch"` is `height: 100%`
today, so the cell and every ancestor down to the element need a definite height.
Dataframe, Vega, DeckGL, and nested containers already honor stretch. Plotly currently
does not — a [known gap](#risks), not a grid ship gate.

#### Asymmetric Gaps: Tuple Versus Explicit Parameters

Grids are the first Streamlit layout where row and column spacing often should differ
(more space between rows than columns).

**Option 1: Scalar `gap` only.** Matches `st.columns`; smallest signature. Apps that want
asymmetric spacing wait, then `gap`'s type has to widen later.

**Option 2: `gap=(row_gap, column_gap)`** ✅ PREFERRED. One parameter; a scalar still
matches `st.columns`; mirrors CSS `gap: <row-gap> <column-gap>`. Cost: the order is not
`(x, y)`. Docs, the canonical example, and the length-error message must say
`(row_gap, column_gap)` (Principle 35).

**Option 3: `row_gap` / `column_gap` parameters.** Unambiguous at the call site, but two
more parameters, and three overlapping spellings if a tuple also exists (Principle 11).

**Recommendation:** Ship Option 2. Accept a tuple or list of length 2. Do not also add
`row_gap` / `column_gap`. The grid proto carries two `GapConfig`s; the frontend maps them
to CSS `row-gap` / `column-gap`.

```python
st.grid(3, gap=("medium", "small"))  # (row_gap, column_gap)
```

#### Nesting

Grid cells nest like any other container: `st.container`, `st.container(horizontal=True)`,
`st.columns`, nested `st.grid`. Docs should recommend keeping nested layout shallow. No
CSS `subgrid` in the MVP.

#### Fragments

`st.grid` works inside `@st.fragment`. Widget and fragment behavior follow existing
container semantics.

A fragment that writes into the grid through a layout-transparent wrapper has no extra
DOM node, so the fragment's direct children become cells. Several metrics from one
fragment are several cells. To keep fragment output in one cell, wrap it in
`grid.cell()` inside the fragment.

#### Accessibility

Wrapping changes only the column count, not source/DOM order, so keyboard and
screen-reader order follow write order (WCAG 2.1 SC 1.3.2 and SC 2.4.3). `wrap=False`
also leaves source order unchanged; keyboard focus must scroll a horizontally off-screen
cell into view, as in the wrap spec.

`dense=False` is the default. Dense packing has no effect on uniform unspanned cells —
the primary use — but that would choose the default by the case where it does not matter.
Once `grid.cell(column_span=…)` produces uneven cells, dense packing moves items out of
DOM order, and on a dashboard that order *is* the information hierarchy. The safe
accessible behavior is the default (Principle 36); backfilling is an opt-in for galleries
where position carries no meaning. Document that `dense=True` is safe when cells are
uniform, and verify keyboard/reading order with spanning cells under both settings before
ship.

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
    with grid.cell():
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

with grid.cell():
    st.subheader("Revenue")
    st.line_chart(revenue_df, height=220)

with grid.cell():
    st.subheader("Pipeline")
    st.bar_chart(pipeline_df, height=220)

with grid.cell():
    st.subheader("Open Accounts")
    st.dataframe(accounts_df, height=220)
```

#### Fixed-Region Dashboard

Most dashboards should scroll and can skip this. It is for a bounded region, such as a
report sized for print.

```python
import streamlit as st

grid = st.grid(2, height=720, row_height="equal", border=True)

with grid.cell(column_span=2):
    st.line_chart(revenue_df, height="stretch")

with grid.cell():
    st.bar_chart(pipeline_df, height="stretch")

with grid.cell():
    st.dataframe(accounts_df, height="stretch")
```

`height="stretch"` on the grid itself works only inside an already height-bounded
container, not at the top level of a page ([Risks](#risks)).

#### Composition With Flex Controls

```python
import streamlit as st

grid = st.grid(2, min_column_width=360, border=True)

with grid.cell():
    controls = st.container(horizontal=True, vertical_alignment="bottom")
    controls.selectbox("Region", regions)
    controls.selectbox("Segment", segments)
    st.area_chart(region_df)

with grid.cell():
    st.dataframe(detail_df, height=300)
```

#### Fixed Column Count (No Wrap)

```python
import streamlit as st

# Three charts stay side by side. On a phone the grid scrolls horizontally
# instead of stacking into unreadably tall single-column charts.
grid = st.grid(3, wrap=False, border=True)

with grid.cell():
    st.subheader("Revenue")
    st.line_chart(revenue_df, height=220)

with grid.cell():
    st.subheader("Pipeline")
    st.bar_chart(pipeline_df, height=220)

with grid.cell():
    st.subheader("Open Accounts")
    st.dataframe(accounts_df, height=220)
```

## API Evaluation

The MVP is the signature and `grid.cell()` above. This section records alternatives and
follow-ups; `grid.span()` and `grid.cells(n)` are rejected in
[GridContainer Methods](#gridcontainer-methods).

| Idea | Verdict | Why |
| --- | --- | --- |
| Auto-placement + `grid.cell()` | **MVP** | Dynamic lists, grouping, and spans without a second constructor. |
| `key` | **MVP** | Every other container has it; cheaper to ship than to explain its absence. |
| `gap=(row_gap, column_gap)` | **MVP** | One parameter; scalar still matches `st.columns`. |
| `grid.span()` | Reject | Same object as `cell()`; `columns` would mean two things. |
| `grid.cells(n)` | Reject | Predeclared count; see [Fixed Cell List](#alternative-api-fixed-cell-list). |
| Weighted tracks `columns=[2, 1, 1]` | **Top follow-up**, `wrap=False` only | Asymmetric dashboards and the 12-track floor problem. |
| Named mosaic templates | Follow-up after ship | Best for hand-designed dashboards; second mental model. |
| Slice-addressed cells `grid[r, c]` | Compatible extension | Expressive, but needs explicit dimensions and must not mix with auto-placement. |
| Breakpoint maps `{"sm": 1, "md": 4}` | Defer | Viewport breakpoints fail in sidebars, nests, and embeds. |
| `streamlit-extras`-style row specs | Not in MVP | Unclear how varying row specs collapse when wrapping. |
| Fixed cell list `st.grid(num_cells=20)` | Reject | Users must know the count; empty cells return. |
| Separate `st.auto_grid` | Reject | One command; `columns="auto"` is the auto mode. |

### Compatible Extension: Weighted Columns And Rows

```python
grid = st.grid(columns=[2, 1, 1], wrap=False)
```

Mirrors `st.columns([2, 1, 1])`. Useful for fixed dashboards; pairs poorly with wrapping
because `[2, 1, 1]` changes meaning when the grid collapses — hence `wrap=False` only,
which is how weighted `st.columns` is expected to behave once wrap-control ships.

Treat this as the **top follow-up**, not a distant one. It is the direct answer to the
asymmetric big-chart-plus-rail layout, and the escape hatch for the
[high-track-count floor problem](#no-wrap-behavior).

### Compatible Extension: Slice-Addressed Cells

```python
grid = st.grid(12, rows=4, wrap=False)

with grid[0, :]:
    st.title("Quarterly Overview")

with grid[1:3, :8]:
    st.line_chart(df)
```

Matplotlib GridSpec indexing: `[row, column]`, zero-based, exclusive slice stops.
Integer indices target one track; slices target spans.

If pursued: explicit-placement mode only; do not mix with auto-insertion
(`grid.metric(...)`) in the same grid; rectangular non-overlapping areas. Less friendly
for dynamic lists than `grid.cell()`. Keep as an advanced extension;
cursor-based `grid.cell()` remains the spanning API for the first release.

### Compatible Extension: Responsive Breakpoint Map

```python
grid = st.grid(columns={"sm": 1, "md": 2, "lg": 4})
```

Familiar to frontend developers, but viewport breakpoints are less robust than
container-width when grids are nested, in a sidebar, or embedded. Defer unless
`min_column_width` proves insufficient.

### Alternative API: Streamlit-Extras-Style Row Specs

```python
grid = st.grid(2, [2, 1], 1, gap="small")
```

Each positional argument describes one row's cell count or relative widths, repeating.
Familiar and already used in `streamlit-extras`, but once row specs vary it is unclear
how the browser should collapse from 4 to 3 to 2 columns. Do not include in the MVP.

### Alternative API: Fixed Cell List

```python
cells = st.grid(num_cells=20, columns=4)

with cells[0]:
    render_card(items[0])
```

Close to `st.columns`, with easy random access. Users must know the count up front;
dynamic lists and "add another card" are awkward; empty cells recreate a core
`st.columns` pain; wrapping then makes index-based code less intuitive. Do not pursue
unless a later selectable-grid feature needs random access.

### Alternative API: Named Mosaic / Template Grid

```python
layout = """
summary summary filters
chart   chart   table
kpi1    kpi2    table
"""
grid = st.grid_template(layout)

with grid["chart"]:
    st.line_chart(df)
```

CSS `grid-template-areas` / Matplotlib `subplot_mosaic`. Excellent for complex
dashboards; the layout is visible in code. Not ideal for dynamic lists; needs validation
for rectangular areas, empties, duplicates, and responsive variants. Likely follow-up
after the simple grid has shipped — and the only place where responsive reflow *order*
(not just count) can be expressed. Ranked above slice indexing for hand-designed
dashboards.

### Alternative API: Separate `st.auto_grid`

```python
grid = st.auto_grid(columns=4, row_height="equal")
```

The name communicates browser-responsive columns, but it adds a second command for
behavior already covered by `st.grid(columns="auto", ...)`. Keep one command.

## Recommendation

Ship the proposed `st.grid` + `grid.cell(*, column_span, row_span)`. That is the
highest-confidence need — dynamic, responsive, equal-track cards — and CSS Grid from the
start is a foundation for later mosaic APIs.

### Dashboard Follow-Ups, In Priority Order

The grid is necessary but not sufficient for BI dashboards. Width-first, because that is
where the demand is:

1. **Weighted tracks** (`columns=[2, 1, 1]` with `wrap=False`).
2. **`st.card`** for panel chrome, then header actions and per-panel fullscreen.
3. **Sticky regions** for a filter bar that survives scrolling. `st.bottom` is already
   sticky; a symmetric top/pinned container is the obvious shape. Nothing in `specs/`
   covers this today.
4. **Named mosaic templates** with per-breakpoint variants.
5. **Aspect-ratio rows**, so gallery and chart tiles keep proportions as columns reflow.
   This, not `height`, is the responsive-height need in a scrolling grid.
6. **CSS subgrid**, so panels in one column align with panels in the next.
7. **A bounded height at the app level**, so root-level `height="stretch"` fills the
   viewport. Last on purpose: minority case, and not a grid feature.

These are layout follow-ups only. The non-layout dashboard story already has its own
specs — [parallel fragments](../2026-03-05-parallel-fragments/product-spec.md),
[event-scoped fragment reruns](../2026-06-23-event-scoped-fragment-reruns/product-spec.md),
[`on_change` modes](../2026-04-14-on-change-modes/product-spec.md),
[`st.skeleton`](../2026-05-13-st-skeleton/product-spec.md), and
[query param binding](../2026-01-06-query-param-binding-state-persistence/product-spec.md)
— and none of it should influence the grid's scope.

## Risks

- **`"equal"` on a scrolling grid needs a measurement.** CSS `1fr` does not equalize
  content-height rows. Measure the tallest row from intrinsic content; stretch children
  must not feed that measurement. After the first paint, `"equal"` must not degrade to
  `"content"`. The value stays in the public `Literal` either way.
- **`height="stretch"` has no bounded ancestor at the app root.** `shouldUseStretchHeight`
  in `frontend/lib/src/components/widgets/DataFrame/dimensionUtils.ts` returns `false` at
  the app root, so `st.grid(height="stretch")` at page top behaves like `"content"`.
  Documentation, not a blocker: the default is `"content"`, and a fixed region can pass
  an integer. Match `st.container(height="stretch")`; do not invent a grid-specific rule.
- **Not every element honors stretch.** Vega, DeckGL, dataframe, and nested containers
  do. `PlotlyChart.tsx` ignores `shouldHeightStretch` and uses
  `DEFAULT_PLOTLY_HEIGHT = 450`, so a Plotly chart in a `row_height=200` cell gets an
  inner scrollbar. Chart bug, not a grid ship gate. Fix Plotly (and audit other holdouts)
  with or immediately after the grid.
- **CSS `safe` alignment.** Unused in `frontend/` today and unsupported on part of the
  `>0.2%, not dead` browserslist. An unknown keyword drops the whole declaration, which
  would silently turn `"center"` / `"bottom"` back into stretch. Emit the two-declaration
  fallback (`align-items: center; align-items: safe center;`) so unsupporting browsers
  keep plain alignment and only lose overflow protection.

## Out Of Scope

- Draggable, resizable, or user-persisted layouts; masonry packing; selectable cells as
  a layout primitive; Python APIs that expose browser width or active column count;
  arbitrary CSS grid strings.
- Weighted tracks, breakpoint maps, slice indexing, named mosaics, `st.auto_grid`,
  `subgrid`, sticky/pinned regions, and a viewport-height page mode — follow-ups above,
  not MVP.
- Panel chrome — that is `st.card`.

## Docs

| Need | Recommended API |
| --- | --- |
| Fixed side-by-side regions | `st.columns` |
| Fixed side-by-side regions that must not stack | `st.columns(..., wrap=False)` |
| Toolbar, chips, or natural-width wrapped controls | `st.container(horizontal=True)` |
| Repeated cards / gallery / dashboard tiles | `st.grid` |
| Multiple elements or a span in one grid cell | `grid.cell(...)` |
| Repeated tiles that must keep a column count | `st.grid(n, wrap=False)` |
| Tiles of equal height | `st.grid(n, row_height="equal")` |
| A dashboard that must fit a fixed region | `st.grid(n, height=…, row_height="equal")` |
| One bordered multi-element region | `st.container(border=True)` |
| A panel with a title, icon, or background | `st.card` |

Lead with scrolling grids. Include examples for metric cards, galleries, dashboard cards,
nested flex controls, and a no-wrap dashboard. Cross-link `wrap` on container/columns, and
spell out that `st.grid(wrap=False)` keeps column *tracks* in one row.

Three support questions, answered in Behavior: headings consume a cell unless placed
outside the grid or in `grid.cell(column_span=...)`; content does not fill a definite-height
cell unless it passes `height="stretch"`; `height="stretch"` on the grid does nothing at
page top — use `height=<int>` there.

## Checklist

| Item | ✅ or comment |
| --- | --- |
| Works on SiS, Cloud, etc? | Yes. Frontend CSS Grid and existing block protocol patterns should work in all runtimes. |
| No breaking API changes | Yes. New command only. |
| No new dependencies | Yes. Use native CSS Grid. |
| Metrics collected | Yes. Add `gather_metrics("grid")`; optionally track coarse non-content options such as `columns` mode, `wrap`, `border`, `dense`, and `height` / `row_height` mode. Height modes tell us whether the dashboard use case is being adopted. |
| Any security/legal impact? | None expected. Layout-only feature; no new content execution path. |
| Any docs changes needed? | Yes. Add API docs and update layout guide/examples. |
| Accessibility verified? | Before ship: keyboard tab order and screen-reader reading order on a grid with spanning cells under both `dense=False` (default) and `dense=True` (WCAG 2.1 SC 1.3.2 and SC 2.4.3). |
| Depends on other work? | `st.card` is a separate spec and not a blocker. Plotly ignoring `height="stretch"` is a known chart gap, not a grid ship gate; dataframe/Vega/DeckGL already fill a definite cell. |
