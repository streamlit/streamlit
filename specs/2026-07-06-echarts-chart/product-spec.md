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
| `key` | `str`, `int`, or `None` | Optional stable identity for the element when selections are active. In that mode, the selection state is also readable from `st.session_state[key]`, and the key is emitted as a `st-key-<key>` CSS class. Display-only charts do not compute an element ID, so `key` is ignored when `on_select="ignore"`. |
| `on_select` | `"ignore"`, `"rerun"`, or `callable` | Whether the chart behaves like an input widget. `"ignore"` (default) = display only; `"rerun"` = rerun on selection and return selection state; a callable = rerun and invoke it as a callback. See [Selections](#selections). |
| `renderer` | `"canvas"` or `"svg"` | Renderer passed to `echarts.init`. `"canvas"` (default) is best for large datasets; `"svg"` produces real DOM nodes that are better for printing, sharp scaling, and accessibility. |

> **No `selection_mode` in v1.** Unlike `st.plotly_chart`, v1 intentionally omits a
> `selection_mode` parameter. Because ECharts options are full, user-authored specs, selection is
> enabled *in the spec* (see [Selections](#selections)) and Streamlit returns whatever the user
> configured. A `selection_mode` convenience that auto-enables/themes point/box/lasso is
> [future work](#out-of-scope-future-work); adding it later is non-breaking.

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
    {
        "product": ["Matcha", "Milk Tea", "Cocoa"],
        "2015": [43.3, 83.1, 86.4],
        "2016": [85.8, 73.4, 65.2],
    }
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

**Unsupported chart families in v1.** Streamlit raises a `StreamlitAPIException` for `custom`
series (which require a JavaScript `renderItem` callback), map or geo charts (which require
registered GeoJSON map data), and 3D or WebGL series from the separate ECharts GL extension.
These features fail late or silently in ECharts without their required callback, registration,
or extension, so Streamlit rejects them in Python with an actionable error instead.

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
values). `theme=None` disables these theme defaults and renders with ECharts' built-in default
theme. Independently of theming, display-only charts set a missing `series.cursor` to `"default"`
so they do not misleadingly appear clickable; an explicitly configured cursor is preserved.

#### Selections

Setting `on_select` to `"rerun"` or a callable turns the chart into a widget that returns an
`EChartsState`. Following the `on_select` model of `st.plotly_chart` keeps the widget contract
familiar.

**Enabling selection is done in the spec.** Because ECharts options are full, user-authored specs
(and because which interactions make sense depends on the chart type), Streamlit does **not** inject
any selection configuration. Instead, you enable selection with ECharts' own option keys, and
Streamlit listens and returns whatever fires:

| Interaction | Enable it in `options` by… | ECharts event Streamlit listens to |
|-------------|---------------------------|-------------------------------------|
| Point selection | Setting `selectedMode` on a series (`"single"`, `"multiple"`, or `"series"`) | `selectchanged` |
| Box / axis-range / lasso | Adding a [`brush`](https://echarts.apache.org/en/option.html#brush) component (with `rect`, `lineX`, `lineY`, or `polygon`) | `brushSelected` / `brushEnd` |

```python
options = {
    "xAxis": {"type": "category", "data": ["Mon", "Tue", "Wed", "Thu", "Fri"]},
    "yAxis": {"type": "value"},
    # Enable point selection by setting selectedMode on the series:
    "series": [
        {"type": "bar", "selectedMode": "multiple", "data": [120, 200, 150, 80, 70]}
    ],
}
event = st.echarts_chart(options, key="sales", on_select="rerun")
```

ECharts renders the selected/brushed state itself (the native `select` visual and the brush
overlay), and any `select` styling the user adds to their series is honored. Streamlit **restores
the visible selection after reruns** (re-applying the selected points and drawn regions) so the
on-screen state always matches the returned `EChartsState` (see
[Reruns & state persistence](#reruns--state-persistence)). Double-click clears the selection.

This "listen to what you configure" model means selection coverage exactly matches what each chart
type supports (e.g. `selectedMode` works on most series but not `gauge`/`funnel`; `brush` works on
cartesian `grid` coordinate systems) — there is no phantom UI for interactions a chart can't
perform. A `selection_mode` convenience that auto-enables and themes these interactions for you is
[future work](#out-of-scope-future-work).

##### Selection state schema

The widget envelope matches other Streamlit chart events, while the nested payload follows
ECharts' grouped, series-local selection model:

```python
{
    "selection": {
        # Union of native and brushed data, grouped by series and data type.
        "selected": [
            {
                "series_index": 0,
                "series_id": "sales",  # None when not explicitly configured
                "series_name": "Sales",
                "data_type": "main",
                "data_indices": [1, 2, 3],
            },
        ],
        # One entry per active brush area.
        "areas": [
            {
                "brush_index": 0,
                "brush_type": "rect",
                "coord_range": [[0, 2], [10, 20]],
            },
        ],
    }
}
```

- `selected` — the de-duplicated union of native (`selectedMode`) and brush selections, grouped
  by `series_index` and `data_type`. `data_indices` is sorted and series-local; a missing ECharts
  `dataType` is reported as `"main"` so graph nodes and edges remain distinct. Empty groups that
  ECharts emits for untouched series are omitted. `series_id` and `series_name` are always
  present and are `None` unless explicitly set in the series option.
- `areas` — one entry per active brush region. `brush_index` identifies the brush component, and
  `brush_type` preserves ECharts' value (`"rect"`, `"lineX"`, `"lineY"`, or `"polygon"`).
  `coord_range` contains the primary data-space geometry, or `None` when ECharts only has
  pixel-space geometry. Its shape depends on `brush_type`: `rect` uses
  `[[x0, x1], [y0, y1]]`; `lineX`/`lineY` use `[start, end]`; and `polygon` uses
  `[[x, y], ...]`. Category-axis coordinates are ordinal positions and can include half-indices
  such as `[0.5, 3.5]`.

Both lists are always present and deterministically ordered. `selected` is sorted by series and
data type (`main`, `node`, `edge`), and `areas` is sorted by brush component while preserving the
area order within that component. A drawn area remains in `areas` even when it selects no data.
Clearing one ECharts selection channel preserves the other; double-click and form clear reset both.

For the common single-series, `data_type="main"` case, use:

```python
rows = (
    event.selection.selected[0]["data_indices"]
    if event.selection.selected
    else []
)
filtered_df = df.iloc[rows]
```

For multiple series or graph data, iterate the groups:

```python
selected_nodes = []
selected_links = []
for item in event.selection.selected:
    series = options["series"][item["series_index"]]
    if item["data_type"] == "edge":
        selected_links += [series["links"][i] for i in item["data_indices"]]
    else:
        selected_nodes += [series["data"][i] for i in item["data_indices"]]
```

`data_indices` addresses the immediate ECharts source: inline `series.data`, graph `data` or
`links`, or `dataset.source` rows when no transform is present. DataZoom preserves this raw index
space. A dataset transform creates a new source, so its indices address transformed output rows;
apps that need to map them back should perform the transform in Python or preserve a source-row ID.

Streamlit does not expose ECharts' pixel `range` or internal `panelId`. For dual-axis charts,
ECharts may calculate additional coordinate ranges for one area; v1 reports only its primary
`coord_range`. `brush_index` links an area to the user's brush configuration, and
`selected[].data_indices` remains authoritative.

Selection state is **read-only** and cannot be set through Session State (same as Plotly/Vega).

> **Why not the `streamlit-echarts` `events=` + `JsCode` model?** The community component surfaces
> interactions through a `dict` of ECharts event names → **JavaScript handler strings** (wrapped in
> `JsCode`). That's powerful but non-idiomatic for Streamlit (JS in Python), harder to type-check,
> and executes arbitrary JS. We instead mirror `st.plotly_chart`'s structured `on_select` model
> (activating selection via `on_select` and reading whatever the user enabled in their spec). Raw JS
> event handlers are documented as [out of scope](#out-of-scope-future-work).

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
Plotly's mutable browser-side figure state. Because a deterministic `setOption({ notMerge: true })`
clears ECharts' native `select`/`brush` state, the frontend **re-applies the visible selection**
(re-dispatching a `select` action for selected data and re-drawing brush areas) after
each in-place option update and on remount, keeping the on-screen highlight in sync with the
persisted state.

Because there is no `selection_mode` parameter, the widget identity depends only on the option
payload and `renderer` (plus `theme`/dimensions when no `key` is set). As with
`st.plotly_chart`/`st.vega_lite_chart`, **any change to the chart's data or options resets the
selection state** without an explicit `key` (the widget is treated as a new element); pass a fixed
`key` so the identity does not depend on the payload and the selection stays stable across data
updates.

#### Loading & error handling

- **Loading** — while the ECharts library (lazy-loaded) initializes, a skeleton loader reserves
  the chart area to avoid layout shift, consistent with other charts.
- **Invalid options** — if `options` is not a dict (or convertible object) or is not
  JSON-serializable, `st.echarts_chart` raises a `StreamlitAPIException` with a clear message
  (*Fail Fast, Fail Helpfully*). Unsupported `custom`, map/geo, and ECharts GL chart families are
  rejected with similarly targeted errors. Runtime rendering errors from ECharts are surfaced as
  a styled error message in the chart area rather than crashing the app.

### Toolbar actions

The rendered chart includes the standard Streamlit chart hover toolbar (consistent with Plotly,
Vega-Lite, and Mermaid):

| Action | Description |
|--------|-------------|
| Fullscreen | Expand the chart to fullscreen. |
| Download | Export a canvas-rendered chart as PNG or an SVG-rendered chart as SVG (ECharts `getDataURL`), using a timestamped filename. |

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

Enable point selection in the spec via `selectedMode`, then set `on_select="rerun"`.

```python
import streamlit as st

options = {
    "xAxis": {"type": "category", "data": ["Mon", "Tue", "Wed", "Thu", "Fri"]},
    "yAxis": {"type": "value"},
    "series": [
        {"type": "bar", "selectedMode": "multiple", "data": [120, 200, 150, 80, 70]}
    ],
}

event = st.echarts_chart(options, key="sales", on_select="rerun")

rows = (
    event.selection.selected[0]["data_indices"]
    if event.selection.selected
    else []
)
st.write("You selected:", [options["series"][0]["data"][i] for i in rows])
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
  `theme=None` does not inject an ARIA configuration, so ARIA is only enabled if the user sets it.
- The chart container uses an appropriate `role`/`aria-label`, and the loading state uses
  `aria-busy`, consistent with other Streamlit charts.
- Toolbar buttons (fullscreen, download) have accessible labels.

## Tradeoffs

- **Wheel/bundle size.** Bundling ECharts increases the Streamlit wheel size and adds a new
  frontend chunk. Like `mermaid.js`, ECharts is **lazy-loaded in the browser** — it is only
  fetched when the first ECharts chart renders, so app startup bundle size is unaffected. The
  on-disk wheel grows (one-time cost for all users). We bundle the **full** ECharts library
  (not a tree-shaken subset): because the API accepts arbitrary supported core option objects,
  the set of series/components needed is only known at runtime, so tree-shaking would break
  charts whose types weren't statically included. ECharts GL and other third-party extensions
  remain separate and are not bundled.
- **JSON-only options.** Power users who rely on JS `formatter`/`renderItem` callbacks are not
  served in v1 (see [Out of Scope](#out-of-scope-future-work)). String-template formatters cover
  the large majority of cases.

## Out of Scope (Future Work)

- **`selection_mode` parameter** — a `st.plotly_chart`-style `selection_mode=("points","box","lasso")`
  that *auto-enables and themes* those interactions (injecting `selectedMode`/`select` and a
  brush/toolbox for you) so `on_select="rerun"` works with zero spec changes. v1 instead activates
  selection via `on_select` and returns whatever the user enabled in their spec. Adding
  `selection_mode` later is purely additive (its absence is the "listen to what you configure"
  default, so it wouldn't change existing behavior).
- **JavaScript callback support** — `formatter`/`renderItem`/event-handler functions. `streamlit-echarts`
  solves this with a `JsCode` wrapper (a placeholder-encoded JS string the frontend `eval`s) and an
  `events={...}` dict. A native version needs a security-reviewed opt-in (e.g. a `JsCode`-style
  wrapper) before we execute app-provided JS. Revisit based on demand.
- **`setOption` merge control** — `streamlit-echarts` exposes `replace_merge` to opt into ECharts'
  `universalTransition` animations between data shapes. v1 uses deterministic full replacement
  (`notMerge`); smooth cross-update transitions can be added later.
- **Geo/map registration and extension-backed charts** — registering custom GeoJSON maps
  (`streamlit-echarts`' `map=` / `Map(map_name, geo_json, special_areas)`), and ECharts GL / other
  third-party extensions (extra bundles + extension lifecycle). Map/geo and ECharts GL options are
  rejected in Python in v1 rather than being sent to ECharts to fail late or render an empty chart.
  These capabilities can be added as follow-ups.
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

**Selection payload: grouped ECharts state** ✅ PREFERRED
- Pros: One filtering path for native and brush selections; unambiguous series/data-type-local
  indices; preserves ECharts brush types; avoids renderer-specific enrichment and coordinate
  conversion.
- Cons: The common single-series path is slightly more verbose than a flat index list. Native
  versus brush provenance and secondary dual-axis geometry are deferred, but can be added later.

**Selection payload: Plotly-shaped `points`/`point_indices`/`box`/`lasso`** ❌
- Pros: Familiar to `st.plotly_chart` users and the third-party `streamlit-echarts` component.
- Cons: A flat index list is incorrect for multiple series and graph node/edge data; `lineX` and
  `lineY` are not boxes; point enrichment is unavailable for dataset-driven series; and mapping
  ECharts areas to Plotly geometry requires fragile pixel and panel conversion.

**Selection payload: raw ECharts events or separate native/brush channels** ❌
- Pros: Preserves event provenance and all upstream fields.
- Cons: ECharts emits independent transient events rather than one state snapshot, and raw
  payloads contain generated identifiers and internal geometry. Separate channels also make the
  common filtering path unnecessarily nested. Channel details can be added later without changing
  the grouped union.

## Learnings Adopted from `streamlit-echarts`

Reviewing the current [`streamlit-echarts`](https://github.com/andfanilo/streamlit-echarts)
implementation informed several decisions:

- **`on_select` shape** — it recently added a `plotly_chart`-like `on_select`
  (`"ignore"`/`"rerun"`/callable). We adopt the same widget contract. (It also has a
  `selection_mode` that auto-enables interactions; we defer that convenience — see
  [Out of Scope](#out-of-scope-future-work) — and instead read whatever selection the user enables
  in their spec.)
- **ECharts-native selection schema** — its `EMPTY_SELECTION` exposes Plotly-shaped `points`,
  `point_indices`, `series_point_indices`, `box`, and `lasso`. Native support instead keeps the
  familiar `on_select` envelope but returns grouped `selected` data plus ECharts brush `areas`.
  This avoids ambiguous flat indices and preserves `lineX`/`lineY`/`polygon` semantics.
- **`pyecharts` via duck typing** — it converts a `pyecharts` chart with `chart.dump_options()`
  behind an optional extra. We accept `pyecharts` objects the same way, with no hard dependency.
- **`renderer="canvas"|"svg"`** — adopted into the MVP (cheap `echarts.init` passthrough; SVG
  helps print/accessibility).
- **Point selection via native `selectedMode`** — `streamlit-echarts` reports point clicks via a
  raw `click` event with no visible selected state. A click that leaves no highlight behaves like a
  one-shot event, not a *stateful* selection: nothing shows as selected and the state isn't
  reflected after a rerun. We instead listen to ECharts' **native selection** (`selectchanged`),
  which the user enables with `selectedMode` in their spec, giving a persistent, restorable selected
  highlight and multi-select. Streamlit re-applies the selection after reruns.
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
