---
author: lukasmasuch
created: 2026-07-06
---

# Native Apache ECharts Support (`st.echarts_chart`)

## Summary

Add native support for rendering [Apache ECharts](https://echarts.apache.org/) charts in
Streamlit via a new `st.echarts_chart` command. Users pass an ECharts
[option object](https://echarts.apache.org/en/option.html) (a Python `dict`) and get an
interactive, themeable chart that supports Streamlit's automatic theming and
selection events, matching the look and behavior of `st.plotly_chart`,
`st.vega_lite_chart`, and `st.altair_chart`.

## Problem

### User Requests

- [GitHub Issue #12302](https://github.com/streamlit/streamlit/issues/12302) — Support Apache
  ECharts natively.

### Pain Points

The community [`streamlit-echarts`](https://github.com/andfanilo/streamlit-echarts) custom
component is popular but is on **best-effort maintenance** — its author still occasionally adds
features but, per its README, is "not actively reviewing larger issues or pull requests from the
community" and points users to Streamlit issue
[#1564](https://github.com/streamlit/streamlit/issues/1564) for a natively maintained version.
ECharts offers a large catalog of chart types that complement Plotly and Vega-Lite (candlestick,
gauge, sunburst, treemap, sankey, graph/network, radar, heatmap, parallel coordinates, geo/map,
3D via GL, and more), and it is the de-facto standard in many data-viz ecosystems (including the
Python `pyecharts` library).

Today, Streamlit users who want ECharts must:

1. Install and rely on a best-effort third-party component (`streamlit-echarts`), which
   ships its own bundled ECharts version and must maintain Streamlit-like theming, selection,
   and event behavior outside Streamlit's native chart plumbing.
2. Hand-roll a custom component or embed an `<iframe>` with raw HTML/JS.
3. Fall back to `st.plotly_chart`/`st.vega_lite_chart`/`st.altair_chart`, which don't cover
   several ECharts chart types (e.g. gauges, sunbursts, sankey, graph/network diagrams).

None of these give a first-class, themed, selection-aware experience.

### Use Cases

1. **Financial dashboards** — candlestick + volume charts, gauges for KPIs.
2. **Relationship/network analysis** — graph/network and sankey diagrams.
3. **Hierarchical data** — sunburst and treemap charts.
4. **Rich statistical charts** — boxplots, parallel coordinates, heatmaps, radar.
5. **`pyecharts` users** — render existing `pyecharts` charts without a third-party component.
6. **Interactive filtering** — select points/regions in a chart to drive the rest of the app
   (same pattern as `st.plotly_chart(..., on_select="rerun")`).

## Proposal

### API

`st.echarts_chart` mirrors `st.plotly_chart` as closely as possible so that the two feel
interchangeable (principle: *Consistency Over Novelty*).

```python
st.echarts_chart(
    options: Mapping[str, Any] | str | EChartsCompatible,  # option dict, JSON string, or pyecharts chart
    *,
    width: "stretch" | "content" | int = "stretch",
    height: "content" | "stretch" | int = "content",
    theme: Literal["streamlit"] | None = "streamlit",
    key: str | int | None = None,
    on_select: Literal["ignore", "rerun"] | Callable[..., None] = "ignore",
    selection_mode: SelectionMode | Iterable[SelectionMode] = ("points", "box", "lasso"),
    renderer: Literal["canvas", "svg"] = "canvas",
) -> DeltaGenerator | EChartsState
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `dict`, JSON `str`, or `pyecharts` chart | The ECharts option object as a Python dictionary (passed to `echartsInstance.setOption`), a JSON string, or a `pyecharts` chart instance (auto-converted via its `.dump_options()` method). See [Options input](#options-input). |
| `width` | `"stretch"`, `"content"`, or `int` | Element width. Same semantics as `st.plotly_chart` (default `"stretch"`). |
| `height` | `"content"`, `"stretch"`, or `int` | Element height. Because ECharts has no intrinsic height, `"content"` resolves to a default of **400px** (or a `pyecharts` chart's own height, if set). See [Sizing](#sizing). |
| `theme` | `"streamlit"` or `None` | `"streamlit"` (default) applies the Streamlit theme (colors, fonts, dark/light). `None` uses ECharts' built-in default theme. |
| `key` | `str`, `int`, or `None` | Optional stable identity for the element. When selections are active and a `key` is provided, the selection state is also readable from `st.session_state[key]`; it is not required for display-only charts or for reading the return value. Also emitted as a `st-key-<key>` CSS class. |
| `on_select` | `"ignore"`, `"rerun"`, or `callable` | Whether the chart behaves like an input widget. `"ignore"` (default) = display only; `"rerun"` = rerun on selection and return selection state; a callable = rerun and invoke it as a callback. |
| `selection_mode` | `"points"`, `"box"`, `"lasso"`, or an iterable | Which selection interactions are enabled when `on_select` is active. Defaults to all three. |
| `renderer` | `"canvas"` or `"svg"` | Renderer passed to `echarts.init`. `"canvas"` (default) is best for large datasets; `"svg"` produces real DOM nodes that are better for printing, sharp scaling, and accessibility. |

> **Parameter name.** We use `options` (plural) for continuity with the `streamlit-echarts`
> component (`st_echarts(options=...)`), easing migration. ECharts' own docs use `option`
> (singular, matching `setOption`); this is a deliberate, minor divergence for migration parity.

**Return value** — Identical contract to `st.plotly_chart`:

- `on_select="ignore"` → returns a `DeltaGenerator` (internal element handle).
- `on_select="rerun"` or a callable → returns an `EChartsState` dict-like object whose
  `selection` attribute holds the current selection (see [Selection state schema](#selection-state-schema)).

#### Options input

The primary input is a plain Python `dict` matching the ECharts option object structure —
the same JSON you'd pass to `chart.setOption(...)` in JavaScript:

```python
import streamlit as st

options = {
    "xAxis": {"type": "category", "data": ["Mon", "Tue", "Wed", "Thu", "Fri"]},
    "yAxis": {"type": "value"},
    "series": [{"data": [120, 200, 150, 80, 70], "type": "bar"}],
}

st.echarts_chart(options)
```

`options` also accepts a **JSON string** (handy for copy-pasting an option straight from the
[ECharts examples gallery](https://echarts.apache.org/examples/)) and a **`pyecharts` chart
instance** (the most popular Python API for ECharts). `pyecharts` charts are detected via duck
typing (presence of a `.dump_options()` method) and converted automatically; `pyecharts` is
*not* a Streamlit dependency and is only imported if the user passes such an object. As with dict
input, v1 supports only **JSON-compatible** `pyecharts` charts: charts that embed
`JsCode`/JavaScript callbacks are rejected with a helpful error (JS callbacks are
[out of scope](#out-of-scope-future-work) for v1).

```python
from pyecharts.charts import Bar
from pyecharts import options as opts

bar = (
    Bar()
    .add_xaxis(["Mon", "Tue", "Wed", "Thu", "Fri"])
    .add_yaxis("Sales", [120, 200, 150, 80, 70])
    .set_global_opts(title_opts=opts.TitleOpts(title="Weekly Sales"))
)

st.echarts_chart(bar)
```

**DataFrames in `dataset.source`.** ECharts' [`dataset`](https://echarts.apache.org/handbook/en/concepts/dataset/)
API lets multiple series share one data source. To *Embrace the Python Ecosystem*, Streamlit
accepts a dataframe-like object (pandas, Polars, PyArrow, …) directly as `dataset.source` and
converts it to JSON-compatible rows (preserving column order via `dataset.dimensions` when the
user hasn't set it) — the same spirit as `st.vega_lite_chart` accepting a `data` argument:

```python
import pandas as pd
import streamlit as st

df = pd.DataFrame(
    {"product": ["Matcha", "Milk Tea", "Cocoa"], "2015": [43.3, 83.1, 86.4], "2016": [85.8, 73.4, 65.2]}
)

st.echarts_chart(
    {
        "legend": {},
        "tooltip": {},
        "dataset": {"source": df},
        "xAxis": {"type": "category"},
        "yAxis": {},
        "series": [{"type": "bar"}, {"type": "bar"}],
    }
)
```

**JSON-only in v1.** The option object must be JSON-serializable. ECharts supports embedding
raw JavaScript callbacks (e.g. `formatter` functions, `renderItem` for custom series). To keep
parity with `st.plotly_chart`/`st.vega_lite_chart`/`st.altair_chart` (which are pure-JSON specs) and to avoid
executing arbitrary JS, **v1 does not support JavaScript function values**. Most formatting
needs are covered by ECharts' [string templates](https://echarts.apache.org/en/option.html#series-bar.label.formatter)
(e.g. `"formatter": "{b}: {c}"`). JS callbacks are documented as [out of scope](#out-of-scope-future-work).

### Behavior

#### Theming

When `theme="streamlit"` (default), the chart automatically matches the active Streamlit theme:

- **Colors** — series use `theme.chartCategoricalColors`; continuous scales (`visualMap`) use
  `theme.chartSequentialColors`. These are the same palettes used by `st.plotly_chart`,
  `st.vega_lite_chart`, and `st.altair_chart`, and they are partially customizable through the
  config options `theme.chartCategoricalColors` and `theme.chartSequentialColors`.
- **Typography** — title, axis labels, legend, and tooltip use Streamlit's font family and sizes.
- **Backgrounds / axes / grid** — transparent chart background over the app background, with
  gridlines, axis lines, and tick labels colored from the Streamlit gray scale. Interaction
  components (`tooltip`, `legend`, `dataZoom`, `brush`, `toolbox`) also get themed defaults.
- **Dark / light mode** — the chart re-themes automatically when the user toggles the theme
  (via ECharts' `darkMode` plus themed colors), with no Python rerun required. Because an ECharts
  theme is fixed at `init` time, re-theming re-initializes the instance (see the tech spec), so a
  brief re-initialization flash (and a possible entry-animation replay) may occur on toggle.

Any color/style the user explicitly sets in `options` is **preserved** and takes precedence
over the Streamlit theme defaults (the theme fills in gaps; it does not override explicit
values). `theme=None` disables all of this and renders with ECharts' built-in default theme.

#### Selections

Selections follow the exact `on_select` / `selection_mode` model of `st.plotly_chart`, so users
who know one know both. When `on_select` is `"rerun"` or a callable, the chart becomes a widget
and returns an `EChartsState`.

`selection_mode` maps to ECharts' native selection mechanisms:

| Mode | Interaction | ECharts mechanism |
|------|-------------|-------------------|
| `"points"` | Click individual data items | ECharts `click` event (no mutation of the user's option) |
| `"box"` | Drag a rectangular region | `brush` component (rectangle) + `brushSelected`/`brushEnd` events |
| `"lasso"` | Draw a freeform region | `brush` component (polygon) + `brushSelected`/`brushEnd` events |

When selections are enabled, a small brush/selection toolbar is added for the box/lasso modes
(analogous to Plotly's modebar). Double-click clears the selection.

##### Selection state schema

`EChartsState` deliberately mirrors `PlotlyState` so the two are learnable together:

```python
{
    "selection": {
        # Every selected data item across all selection modes.
        "points": [
            {
                "component_type": "series",
                "series_type": "bar",
                "series_index": 0,
                "series_name": "Sales",
                "data_index": 3,
                "name": "Thu",
                "value": 80,
                "data": 80,
            },
            ...
        ],
        # Flat list of selected data indices (convenient for single-series charts).
        "point_indices": [3, ...],
        # Metadata about box (rectangle) selections, if any.
        "box": [ ... ],
        # Metadata about lasso (polygon) selections, if any.
        "lasso": [ ... ],
    }
}
```

- `points` — flat list of all selected data items (from point, box, and lasso selections),
  each identifying its series (`series_index`/`series_name`) and `data_index` plus the item's
  `name`/`value`. The per-item `series_index` disambiguates multi-series charts.
- `point_indices` — flat list of selected `data_index` values, for parity with
  `PlotlyState` and convenient access in the common single-series case. **Reliable only for
  single-series charts**: ECharts `data_index` is series-local, so in multi-series charts the
  same index can refer to different points across series (and may appear more than once). For
  multi-series charts, use `points[].series_index` + `points[].data_index` (or `series_name`)
  to disambiguate.
- `box` / `lasso` — coordinate metadata for the drawn regions (parallel to Plotly's `box`/`lasso`).

Selection state is **read-only** and cannot be set through Session State (same as Plotly/Vega).

> **Why not the `streamlit-echarts` `events=` + `JsCode` model?** The community component surfaces
> interactions through a `dict` of ECharts event names → **JavaScript handler strings** (wrapped in
> `JsCode`). That's powerful but non-idiomatic for Streamlit (JS in Python), harder to type-check,
> and executes arbitrary JS. We instead mirror `st.plotly_chart`'s structured `on_select` /
> `selection_mode` model. Raw JS event handlers are documented as [out of scope](#out-of-scope-future-work).

#### Sizing

ECharts renders into a container that needs an explicit height (unlike an auto-sizing SVG
diagram). Therefore:

- `width` behaves like `st.plotly_chart` (`"stretch"` by default). For `width="content"`,
  Streamlit uses a pyecharts chart's own width when available; raw ECharts options otherwise
  resolve to a fixed default of **700px** because ECharts options do not have intrinsic width.
- `height="content"` (default) resolves to **400px** unless a pyecharts chart exposes its own
  height. Raw ECharts options otherwise use the default. `height="stretch"` fills the parent
  container; an `int` sets a fixed pixel height.
- The chart auto-resizes with its container (via a resize observer), matching Plotly behavior.

#### Reruns & state persistence

ECharts plays entry animations when a browser instance is initialized. During ordinary reruns, the
frontend must keep the existing ECharts instance mounted and update it in place — `setOption` when
the option changed, `resize` when only dimensions changed — avoiding unnecessary re-initialization
and repeated entry animations for the common "unrelated widget reran the app" case. Because ECharts
fixes the **theme** and **renderer** at `init` time, a change to `theme` or `renderer` (e.g. a
light/dark toggle) cannot be applied via `setOption`; it instead requires disposing and
re-initializing the instance (see the tech spec and [Theming](#theming)), which is why those
specific changes can briefly re-initialize and replay entry animations.

If Streamlit truly unmounts and remounts the element, ECharts can be recreated from the
declarative option object; in that case, entry animation may replay. Preserving browser-only
figure state for display-only charts is not an MVP requirement, but implementation testing should
verify common interactions such as fullscreen, tabs, expanders, and unrelated widget reruns. If
those paths commonly remount display-only ECharts charts and produce visible animation replay, the
implementation should compute a stable non-widget element ID for all ECharts charts, similar to
Plotly's special-case behavior.

When `on_select` is active, `st.echarts_chart` becomes a widget. In that mode, Streamlit computes
a widget ID, persists the read-only selection state, and makes it available as the return value
and through `st.session_state[key]` when a key is provided. This follows the Vega-Lite selection
pattern more closely than Plotly's always-compute-ID behavior, which is a special case for
Plotly's mutable browser-side figure state.

Because the widget ID incorporates the normalized option payload when no explicit `key` is provided,
**any change to the chart's data or options resets the selection state** (the widget is treated as a
new element). This matches `st.vega_lite_chart`/`st.plotly_chart` behavior. To keep a selection
stable across data updates, pass a fixed `key` so the widget identity does not depend on the payload.

#### Loading & error handling

- **Loading** — while the ECharts library (lazy-loaded) initializes, a skeleton loader reserves
  the chart area to avoid layout shift, consistent with other charts.
- **Invalid options** — if `options` is not a dict (or convertible object) or is not
  JSON-serializable, `st.echarts_chart` raises a `StreamlitAPIException` with a clear message
  (*Fail Fast, Fail Helpfully*). Runtime rendering errors from ECharts are surfaced as a styled
  error message in the chart area rather than crashing the app.

### Toolbar actions

The rendered chart includes the standard Streamlit chart hover toolbar (consistent with Plotly,
Vega-Lite, and Mermaid):

| Action | Description |
|--------|-------------|
| Fullscreen | Expand the chart to fullscreen. |
| Download | Export the chart as a PNG image (ECharts `getDataURL`). |

ECharts' own `toolbox` feature (if present in `options`) is respected and rendered by ECharts.

### Design

The visual target: a chart that is visually indistinguishable in "theme quality" from
`st.plotly_chart`/`st.vega_lite_chart` — Streamlit color palette, Streamlit fonts, transparent
background, subtle gridlines, and the shared hover toolbar. Both light and dark themes must look
first-class out of the box.

### Examples

#### Basic bar chart (display only)

```python
import streamlit as st

st.echarts_chart(
    {
        "xAxis": {"type": "category", "data": ["A", "B", "C", "D", "E"]},
        "yAxis": {"type": "value"},
        "series": [{"type": "bar", "data": [5, 20, 36, 10, 10]}],
    }
)
```

#### Line chart with tooltip and legend

```python
import streamlit as st

st.echarts_chart(
    {
        "tooltip": {"trigger": "axis"},
        "legend": {"data": ["Revenue", "Cost"]},
        "xAxis": {"type": "category", "data": ["Q1", "Q2", "Q3", "Q4"]},
        "yAxis": {"type": "value"},
        "series": [
            {"name": "Revenue", "type": "line", "data": [820, 932, 901, 934]},
            {"name": "Cost", "type": "line", "data": [500, 610, 550, 700]},
        ],
    }
)
```

#### Selections (point selection driving the app)

```python
import streamlit as st

options = {
    "xAxis": {"type": "category", "data": ["Mon", "Tue", "Wed", "Thu", "Fri"]},
    "yAxis": {"type": "value"},
    "series": [{"type": "bar", "data": [120, 200, 150, 80, 70]}],
}

event = st.echarts_chart(options, key="sales", on_select="rerun")

st.write("You selected:", event.selection.points)
```

#### Chart type not available in Plotly/Vega (gauge)

```python
import streamlit as st

st.echarts_chart(
    {
        "series": [
            {
                "type": "gauge",
                "progress": {"show": True},
                "detail": {"formatter": "{value}%"},
                "data": [{"value": 72, "name": "Utilization"}],
            }
        ]
    }
)
```

#### `pyecharts` chart

```python
import streamlit as st
from pyecharts.charts import Pie

pie = Pie().add(
    "",
    [("Shirts", 40), ("Cardigans", 30), ("Chiffon", 20), ("Pants", 10)],
    radius=["40%", "70%"],
)

st.echarts_chart(pie)
```

### Security

- **No JS execution (v1).** Because only JSON-serializable options are accepted (no JS function
  values), there is no arbitrary-code-execution surface beyond what data the app author already
  controls — the same posture as `st.plotly_chart`, `st.vega_lite_chart`, and `st.altair_chart`.
- **Same-origin rendering.** ECharts renders into a canvas/SVG within the app DOM (no iframe,
  no blob URLs), so there are no additional CSP requirements.
- **Tooltip/label HTML.** ECharts tooltips and rich labels can render app-provided strings, and
  ECharts has historically had tooltip XSS advisories. The MVP posture is defined up front (see the
  tech spec's Security section): Streamlit depends on a patched ECharts version, never turns on
  raw-HTML tooltip rendering on the user's behalf under `theme="streamlit"`, and a regression test
  asserts that HTML/script payloads in tooltip/label content render as escaped text. This is
  app-author-provided content (same trust model as other charts).
- **License.** Apache ECharts is Apache-2.0 licensed — the same license as Streamlit — so there
  is no new licensing concern for bundling it.

### Accessibility

- ECharts supports ARIA descriptions generated from the option (`options["aria"] = {"enabled": True}`).
  Under `theme="streamlit"` (default), Streamlit enables this by default (when not already set) so
  charts expose a description to screen readers. Consistent with the theme opt-out semantics,
  `theme=None` leaves the user's `options` untouched, so ARIA is only enabled if the user sets it.
- The chart container uses an appropriate `role`/`aria-label`, and the loading state uses
  `aria-busy`, consistent with other Streamlit charts.
- Toolbar buttons (fullscreen, download) have accessible labels.

## Tradeoffs

- **Wheel/bundle size.** Bundling ECharts increases the Streamlit wheel size and adds a new
  frontend chunk. Like `mermaid.js`, ECharts is **lazy-loaded in the browser** — it is only
  fetched when the first ECharts chart renders, so app startup bundle size is unaffected. The
  on-disk wheel grows (one-time cost for all users). We bundle the **full** ECharts library
  (not a tree-shaken subset): because the API accepts *arbitrary* option objects, the set of
  series/components needed is only known at runtime, so tree-shaking would break charts whose
  types weren't statically included. Tree-shaking could be revisited only if we later constrain
  the supported chart types.
- **JSON-only options.** Power users who rely on JS `formatter`/`renderItem` callbacks are not
  served in v1 (see [Out of Scope](#out-of-scope-future-work)). String-template formatters cover
  the large majority of cases.

## Out of Scope (Future Work)

- **JavaScript callback support** — `formatter`/`renderItem`/event-handler functions. `streamlit-echarts`
  solves this with a `JsCode` wrapper (a placeholder-encoded JS string the frontend `eval`s) and an
  `events={...}` dict. A native version needs a security-reviewed opt-in (e.g. a `JsCode`-style
  wrapper) before we execute app-provided JS. Revisit based on demand.
- **`setOption` merge control** — `streamlit-echarts` exposes `replace_merge` to opt into ECharts'
  `universalTransition` animations between data shapes. v1 uses deterministic full replacement
  (`notMerge`); smooth cross-update transitions can be added later.
- **Geo/map registration** — registering custom GeoJSON maps (`streamlit-echarts`' `map=` /
  `Map(map_name, geo_json, special_areas)`), and ECharts GL / third-party extensions (extra
  bundles + extension lifecycle). Can be added as follow-ups.
- **Custom theme objects / `registerTheme` / `registerMap` / `connect` / arbitrary
  `dispatchAction`** — deferred until native usage shows demand.
- **Legend / dataZoom / timeline as first-class Streamlit events** — v1 focuses on data-point
  and region selections to match Plotly. Other ECharts events can be surfaced later.
- **`st.write` auto-detection of `pyecharts` objects** — users call `st.echarts_chart(...)`
  explicitly in v1.
- **`config`-style passthrough for `echarts.init` options** — deferred until needed.
- **`disabled` parameter** — `st.echarts_chart` mirrors `st.plotly_chart`, which does not expose a
  `disabled` parameter, so v1 omits it too. Selection handlers are simply not bound when the chart is
  display-only (`on_select="ignore"`). Can be revisited if selection-capable charts adopt `disabled`
  broadly.

## Alternatives Considered

**Option 1: Keep relying on the third-party `streamlit-echarts` component** ❌
- Pros: Zero maintenance for Streamlit; already feature-rich.
- Cons: Explicitly **best-effort maintenance** (its author still ships occasional features but
  isn't actively reviewing community issues/PRs, and points users to Streamlit issue
  [#1564](https://github.com/streamlit/streamlit/issues/1564) for a native version), ships a
  duplicate ECharts bundle, and its interaction model relies on app-authored JavaScript
  (`events` + `JsCode`) rather than a structured Streamlit API. Directly the motivation for #12302.

**Option 2: `st.echarts_chart(options=dict)` mirroring `st.plotly_chart`** ✅ PREFERRED
- Pros: Consistent with existing chart commands; discoverable; supports theming + selections;
  familiar return-value/`on_select` contract; accepts `pyecharts` objects for the Python-first crowd.
- Cons: New frontend dependency (bundle size); JSON-only in v1.

**Option 3: Support ECharts only through `st.pyecharts_chart` (pyecharts objects only)** ❌
- Pros: Fully Pythonic, no raw JSON dicts.
- Cons: Forces a dependency/mental model on users who just have an ECharts JSON option;
  diverges from the `dict`-spec pattern of `st.vega_lite_chart`/`st.plotly_chart`. (Note the
  existing split: `st.vega_lite_chart` takes a `dict` spec while `st.altair_chart` takes a Python
  chart object — both render through the same backend/frontend. We follow the same idea by
  accepting `pyecharts` objects *within* `st.echarts_chart` rather than adding a separate command.)

## Learnings Adopted from `streamlit-echarts`

Reviewing the current [`streamlit-echarts`](https://github.com/andfanilo/streamlit-echarts)
implementation informed several decisions:

- **`on_select` / `selection_mode` shape** — it recently added a `plotly_chart`-like
  `on_select` (`"ignore"`/`"rerun"`/callable) + `selection_mode` (`"points"`/`"box"`/`"lasso"`)
  API. We adopt the same shape (and it confirms this maps cleanly onto ECharts events + `brush`).
- **Richer selection schema** — its `EMPTY_SELECTION` exposes `points`, `point_indices`,
  `series_point_indices`, `box`, and `lasso`. We adopt `points` + `point_indices` (folding
  per-series info into each point) for Plotly parity.
- **`pyecharts` via duck typing** — it converts a `pyecharts` chart with `chart.dump_options()`
  behind an optional extra. We accept `pyecharts` objects the same way, with no hard dependency.
- **`renderer="canvas"|"svg"`** — adopted into the MVP (cheap `echarts.init` passthrough; SVG
  helps print/accessibility).
- **Point selection via `click`** — implemented from ECharts `click` events rather than mutating
  every series' `selectedMode`, which avoids changing the user's option and supports more chart
  types (see tech spec).
- **Selection API parity** — it requires a `key` for persistent selection access in
  `st.session_state`; native support should rely on Streamlit's widget state when selections are
  active and avoid adding a Plotly-style always-on element ID for display-only charts.
- **Deliberately *not* adopted**: the `events=` + `JsCode` JavaScript-handler model (non-idiomatic
  and executes arbitrary JS) and CSS-string `height`/`width` (we use Streamlit's `width`/`height`
  conventions). Its `replace_merge` and `map`/`registerMap` features are logged as future work.

## Checklist

| Item | ✅ or comment |
|------|---------------|
| Works on SiS, Cloud, etc? | ✅ Client-side rendering, no server dependencies; JSON-only spec. |
| No breaking API changes | ✅ New command; no changes to existing commands. |
| No new dependencies | ⚠️ No new **backend** (Python) dependency. `echarts` is a new **frontend** dependency (lazy-loaded). `pyecharts` remains optional/user-provided. |
| Metrics collected | ✅ `st.echarts_chart` tracked via `gather_metrics`. |
| Any security/legal impact? | ✅ Apache-2.0 (same as Streamlit); JSON-only options → no JS execution. |
| Any docs changes needed? | ✅ New API reference page + tutorial; add to charts overview. |
