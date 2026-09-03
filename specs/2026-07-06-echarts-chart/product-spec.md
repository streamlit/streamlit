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
ECharts is the de-facto standard in many data-viz ecosystems (including the Python `pyecharts`
library). Native support gives those users Streamlit theming and `on_select` without rewriting
charts for Plotly or Vega-Lite, and it covers ECharts-native types such as graph/network diagrams
and gauges without a third-party component.

Today, Streamlit users who want ECharts must:

1. Install and rely on a best-effort third-party component (`streamlit-echarts`), which
   ships its own bundled ECharts version and must maintain Streamlit-like theming, selection,
   and event behavior outside Streamlit's native chart plumbing.
2. Hand-roll a custom component or embed an `<iframe>` with raw HTML/JS.
3. Fall back to Plotly or Vega-Lite. Those libraries overlap many chart types (gauges, sunbursts,
   treemaps, Sankey, heatmaps, candlesticks), but they are a different API: there is no first-class
   path for an existing ECharts / `pyecharts` spec, and Streamlit does not theme or select on a
   community ECharts component.

None of these give a first-class, themed, selection-aware ECharts experience.

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

`st.echarts_chart` follows existing chart commands: `theme` / `on_select` / toolbar like
`st.plotly_chart`, and a declarative `spec` like `st.vega_lite_chart` (principle: *Consistency
Over Novelty*).

```python
st.echarts_chart(
    spec: Mapping[str, Any] | str | EChartsCompatible,  # option dict, JSON string, or pyecharts chart
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
| `spec` | `dict`, JSON `str`, or `pyecharts` chart | The ECharts option object as a Python dictionary (passed to `echartsInstance.setOption`), a JSON string, or a `pyecharts` chart instance (auto-converted via its `.dump_options()` method). See [Spec input](#spec-input). |
| `width` | `"stretch"`, `"content"`, or `int` | Element width. Same semantics as `st.plotly_chart` (default `"stretch"`). `"content"` is **700px**, not the `defaultChartWidth` theme token. See [Sizing](#sizing). |
| `height` | `"content"`, `"stretch"`, or `int` | Element height. Because ECharts has no intrinsic height, `"content"` resolves to **350px** (the `defaultChartHeight` theme token, matching the Vega-based charts) unless a `pyecharts` chart sets an explicit pixel height. `"stretch"` uses Streamlit's standard height semantics (see [Sizing](#sizing)). |
| `theme` | `"streamlit"` or `None` | `"streamlit"` (default) applies the Streamlit theme (colors, fonts, dark/light). `None` uses ECharts' built-in default theme. Accessibility defaults are independent of `theme`. |
| `key` | `str`, `int`, or `None` | Optional stable identity. When provided, Streamlit emits a `st-key-<key>` CSS class even if `on_select="ignore"`. When selections are active, the selection state is also readable from `st.session_state[key]`, and the selection survives changes to `spec`, `theme`, and `renderer`. Display-only charts without a `key` skip the element ID entirely. |
| `on_select` | `"ignore"`, `"rerun"`, or `callable` | Whether the chart behaves like an input widget. `"ignore"` (default) = display only; `"rerun"` = rerun on selection and return selection state; a callable = rerun and invoke it as a callback. See [Selections](#selections). |
| `renderer` | `"canvas"` or `"svg"` | Renderer passed to `echarts.init`. `"canvas"` (default) is best for large datasets; `"svg"` produces real DOM nodes that are better for printing, sharp scaling, and accessibility. |

> **No `selection_mode` in v1.** Unlike `st.plotly_chart`, v1 intentionally omits a
> `selection_mode` parameter. Because an ECharts spec is a full, user-authored chart definition, selection is
> enabled *in the spec* (see [Selections](#selections)) and Streamlit returns whatever the user
> configured. A `selection_mode` convenience that auto-enables/themes point/box/lasso is
> [future work](#out-of-scope-future-work); adding it later is non-breaking.

> **Parameter name.** We use `spec`, matching `st.vega_lite_chart(data, spec)` — the other
> Streamlit chart command that takes a declarative dict — and the `spec` field already used in the
> proto and the frontend. See [Parameter name](#parameter-name-spec-vs-options-vs-option) for why
> `options` and `option` were rejected.

**Return value** — Identical contract to `st.plotly_chart`:

- `on_select="ignore"` → returns a `DeltaGenerator` (internal element handle).
- `on_select="rerun"` or a callable → returns an `EChartsState` dict-like object whose
  `selection` attribute holds the current selection (see [Selection state schema](#selection-state-schema)).
  `EChartsState` is importable from `streamlit.typing` for annotations, alongside `PlotlyState`
  and `VegaLiteState`. `EChartsCompatible` stays internal — it only exists to type the duck-typed
  `pyecharts` input.

#### Spec input

The primary input is a plain Python `dict` matching the ECharts option object structure —
the same JSON you'd pass to `chart.setOption(...)` in JavaScript:

```python
import streamlit as st

spec = {
    "xAxis": {"type": "category", "data": ["Mon", "Tue", "Wed", "Thu", "Fri"]},
    "yAxis": {"type": "value"},
    "series": [{"data": [120, 200, 150, 80, 70], "type": "bar"}],
}

st.echarts_chart(spec)
```

`spec` also accepts a **JSON string** (handy for copy-pasting an option straight from the
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
accepts a dataframe-like object (pandas, Polars, PyArrow, …) as `dataset.source` — on a single
dataset object **or** on every entry of a dataset list (`[{"source": df1}, {"source": df2}]`) —
and converts each to JSON-compatible rows (preserving column order via `dataset.dimensions` when
the user hasn't set it) — the same spirit as `st.vega_lite_chart` accepting a `data` argument.
A dataframe-like object anywhere else (`series.data`, `xAxis.data`, …) is **not** converted; it
fails the JSON-serializability check with an error that points the user at `dataset.source`:

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

**Unsupported chart families in v1.** Streamlit raises a `StreamlitAPIException` when the
normalized option uses any of these keys (walked through `series` and top-level components,
across `baseOption` and each timeline `options` entry):

| Family | Rejected keys |
|--------|----------------|
| Custom series | `series.type` `"custom"` (needs a JS `renderItem`) |
| Map / geo | `"map"`, `"geo"` (need registered GeoJSON; includes `geo` / `map` components) |
| ECharts GL | `"scatter3D"`, `"bar3D"`, `"line3D"`, `"lines3D"`, `"polygons3D"`, `"surface"`, `"map3D"`, `"scatterGL"`, `"linesGL"`, `"flowGL"`, `"graphGL"`, `"grid3D"`, `"geo3D"`, `"globe"` |

JSON-serializable `pyecharts` charts that still need an **unbundled** extension are rejected the
same way, since they serialize cleanly and would otherwise render empty: `wordCloud`
(`echarts-wordcloud`) and `liquidFill` (`echarts-liquidfill`). That list is **best-effort**, not a
guarantee — the third-party ECharts series ecosystem is open-ended (`echarts-stat`,
`echarts-graph-modularity`, arbitrary third-party series), and a denylist always lags. Other
core series types are passed through even if they are not named in this spec, so an
unrecognized third-party series still renders as an empty chart rather than raising. We cannot
invert this to an allowlist without breaking that pass-through promise.

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
- **Plot margins** — for cartesian charts, Streamlit fills in a default `grid` (tighter side
  margins than ECharts' percentage-based defaults, and axis labels and names kept inside them) so
  the plot fills its container like other Streamlit charts. Margins on a side that carries a
  title, legend, or bottom-anchored `dataZoom`/`visualMap`/`timeline` are left to ECharts so those
  components aren't clipped.
- **Dark / light mode** — the chart re-themes automatically when the user toggles the theme
  (via ECharts' `darkMode` plus themed colors), with no Python rerun required. Light/dark
  re-theming uses `chart.setTheme(...)` on the bundled ECharts `^6.1.0`, which preserves the
  current option. A `renderer` change still disposes and re-initializes (renderer is fixed at
  `init`).

These defaults (`grid`, colors, fonts, `aria`, `series.cursor`) are merged **in the frontend**
before `setOption`. The wire payload stays the user's spec verbatim — the backend does not
deep-walk or re-serialize the option for theming (*Theming and Layout* lives in the frontend
because it cannot reliably know the active theme).

Any color/style the user explicitly sets in `spec` is **preserved** and takes precedence
over the Streamlit theme defaults (the theme fills in gaps; it does not override explicit
values). `theme=None` disables these theme defaults and renders with ECharts' built-in default
theme. Independently of theming, display-only charts set a missing `series.cursor` to `"default"`
so they do not misleadingly appear clickable; an explicitly configured cursor is preserved.

#### Selections

Setting `on_select` to `"rerun"` or a callable turns the chart into a widget that returns an
`EChartsState`. Following the `on_select` model of `st.plotly_chart` keeps the widget contract
familiar.

**Enabling selection is done in the spec.** Streamlit does **not** inject `selectedMode` or
`brush`. You enable selection with ECharts' own option keys:

| Interaction | Enable it in `spec` by… | Widget-updating event | Visual-only |
|-------------|---------------------------|------------------------|-------------|
| Point selection | Setting a truthy `selectedMode` on a series (`"single"`, `"multiple"`, or `"series"`) | `selectchanged` | — |
| Box / axis-range / lasso | Adding a [`brush`](https://echarts.apache.org/en/option.html#brush) component (`rect`, `lineX`, `lineY`, or `polygon`) | `brushEnd` | `brushSelected` (during drag) |

If `on_select` is `"rerun"` or a callable and the spec has neither a series `selectedMode` nor a
`brush` component (or a `toolbox` brush feature), the chart still renders but can never return a
selection, so Streamlit **logs a warning** naming those option keys. It deliberately does not
raise: unlike Vega-Lite's declarative `params` block, ECharts' `selectedMode` lives on each
individual series, and series are routinely generated from data — a filtered dataframe that
yields `series: []` would turn a hard check into a crash on an ordinary rerun. `st.pydeck_chart`
takes the same position for its `pickable=True` requirement. See
[Selection-less specs](#selection-less-specs-warn-vs-raise).

The warning is **structural only** (those keys are present). It does not ask whether a given
series type will actually fire — `selectedMode` on `gauge`/`funnel` still "enables" the widget
and then never updates it. That empty-widget case is accepted in v1; a runtime "this series
cannot select" check is future work.

**One rerun per gesture.** `brushSelected` updates the overlay while the pointer is down; it
must not enqueue a widget value. Streamlit records a widget update only on `selectchanged` and
on **commit** of a completed brush. `brushEnd` is the commit signal but does not carry selected
indices (those arrive on separately throttled `brushSelected` events, which can land after
`brushEnd` and have no shared gesture ID). The frontend therefore caches the latest
`brushSelected` snapshot — honoring the user's `brush.throttleDelay` — and flushes one widget
update once it holds the `brushSelected` snapshot correlated with that `brushEnd`. Waiting for
the correlated snapshot rather than a fixed grace period is deliberate: any fixed wait shorter
than a user-configured `brush.throttleDelay` would flush the stale cache and defeat the throttle.
The wait is unbounded — a snapshot that never arrives never flushes — but ECharts always emits
one; a timeout would reintroduce the stale-flush risk. Either event order yields exactly one
rerun with the final indices.

```python
spec = {
    "xAxis": {"type": "category", "data": ["Mon", "Tue", "Wed", "Thu", "Fri"]},
    "yAxis": {"type": "value"},
    # Enable point selection by setting selectedMode on the series:
    "series": [
        {"type": "bar", "selectedMode": "multiple", "data": [120, 200, 150, 80, 70]}
    ],
}
event = st.echarts_chart(spec, key="sales", on_select="rerun")
```

ECharts renders the selected/brushed state itself (the native `select` visual and the brush
overlay), and any `select` styling the user adds to their series is honored. Streamlit **restores
the visible selection after reruns** from privately persisted native and brush channels (see
[Reruns & state persistence](#reruns--state-persistence)). Double-click clears the selection.

**Option-defined selection is not seeded in v1.** Marks the user pre-selects in the option
(`data[].selected`) are visible but are not reflected in the initial `EChartsState`, so the
widget starts empty until the first pointer gesture — the same as `st.plotly_chart` and
`st.vega_lite_chart`. Seeding them is [future work](#out-of-scope-future-work).

v1 selection is **pointer-first**, matching `st.plotly_chart`: ECharts has no built-in keyboard
navigation for data points or brushes, and double-click clear has no keyboard equivalent.

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

- `selected` — the de-duplicated **public union** of native (`selectedMode`) and brush selections,
  grouped by `series_index` and `data_type`. `data_indices` is sorted and series-local; a missing
  ECharts `dataType` is reported as `"main"` so graph nodes and edges remain distinct. Empty groups
  that ECharts emits for untouched series are omitted. `series_id` and `series_name` are always
  present and are `None` unless explicitly set in the series option.
- `areas` — one **public** entry per restorably-targeted brush region (a region that has a
  `coord_range`). `brush_index` identifies the brush component, and `brush_type` preserves
  ECharts' value (`"rect"`, `"lineX"`, `"lineY"`, or `"polygon"`). `coord_range` contains the
  primary data-space geometry. Its shape depends on `brush_type`: `rect` uses `[[x0, x1], [y0, y1]]`;
  `lineX`/`lineY` use `[start, end]`; and `polygon` uses `[[x, y], ...]`. Category-axis coordinates
  are ordinal positions and can include half-indices such as `[0.5, 3.5]`. Pixel-only regions
  (ECharts has no data-space geometry) are omitted from public `areas`.

Both lists are always present and deterministically ordered. `selected` is sorted by series and
data type (`main`, `node`, `edge`), and `areas` is sorted by brush component while preserving the
area order within that component. A drawn area with a `coord_range` remains in `areas` even when it
selects no data.

The public `selected` list is a union and does not record native-vs-brush provenance. Streamlit
**persists both channels privately** (native indices vs brush indices, plus complete brush
geometry: `panelId`, axis/grid selectors, and pixel `range` when present). Restore re-dispatches
native `select` only for the native channel and redraws brush areas from that private geometry,
so clearing the brush cannot leave brush-only points highlighted as native `select`. Clearing
one channel preserves the other; double-click and form clear reset both.

The on-screen restore guarantee applies to native selections and to public `areas` (regions with
a `coord_range`). Multi-panel brushes are retargeted using private `panelId` / axis selectors.
Pixel-only overlays restore only while the chart size is unchanged; after a resize they are
dropped from the overlay and from private state.

For the common single-series, `data_type="main"` case, use:

```python
rows = event.selection.selected[0]["data_indices"] if event.selection.selected else []
filtered_df = df.iloc[rows]
```

For multiple series or graph data, iterate the groups:

```python
selected_nodes = []
selected_links = []
for item in event.selection.selected:
    series = spec["series"][item["series_index"]]
    if item["data_type"] == "edge":
        selected_links += [series["links"][i] for i in item["data_indices"]]
    else:
        selected_nodes += [series["data"][i] for i in item["data_indices"]]
```

`data_indices` addresses the immediate ECharts source: inline `series.data`, graph `data` or
`links`, or `dataset.source` rows when no transform is present. DataZoom preserves this raw index
space. A dataset transform creates a new source, so its indices address transformed output rows;
apps that need to map them back should perform the transform in Python or preserve a source-row ID.

Streamlit does not expose ECharts' pixel `range` or internal `panelId` on the **public** payload
(those fields live only in private restore geometry). For dual-axis charts, ECharts may calculate
additional coordinate ranges for one area; v1 reports only its primary `coord_range`.
`brush_index` links an area to the user's brush configuration, and `selected[].data_indices`
remains authoritative.

Selection state is **read-only** and cannot be set through Session State (same as Plotly/Vega).
The `EChartsState` envelope and its `selection` payload are attribute dictionaries, so both
`event.selection.selected` and `event["selection"]["selected"]` work. The entries *inside*
`selected` and `areas` are plain dicts read by key (`item["series_index"]`), matching
`st.plotly_chart`'s `selection.points` — the shared attribute-dictionary wrapper descends into
nested dicts but not into lists.

> **Why not the `streamlit-echarts` `events=` + `JsCode` model?** The community component surfaces
> interactions through a `dict` of ECharts event names → **JavaScript handler strings** (wrapped in
> `JsCode`). That's powerful but non-idiomatic for Streamlit (JS in Python), harder to type-check,
> and executes arbitrary JS. We instead mirror `st.plotly_chart`'s structured `on_select` model
> (activating selection via `on_select` and reading whatever the user enabled in their spec). Raw JS
> event handlers are documented as [out of scope](#out-of-scope-future-work).

#### Sizing

ECharts renders into a container that needs an explicit height (unlike an auto-sizing SVG
diagram). Therefore:

- `width` behaves like `st.plotly_chart` (`"stretch"` by default). `width="content"` uses a
  **700px** fallback because an ECharts spec has no intrinsic width. There is deliberately no
  token for this: the `defaultChartWidth` token is a Vega *view* dimension, and a Vega chart at
  `width="content"` actually collapses to roughly 180px, so there is no rendered width to match.
- `height="content"` (default) resolves to **350px**, the frontend's `defaultChartHeight` theme
  token. That token is what the Vega-based charts (`st.line_chart`, `st.bar_chart`,
  `st.area_chart`, `st.scatter_chart`, `st.vega_lite_chart`, `st.altair_chart`) actually render
  at, so an ECharts chart lines up with them pixel-for-pixel beside one another in columns.
  Chart types that benefit from more room (sunburst and treemap labels, most visibly) are what
  the `height` parameter is for.
  `height="stretch"` uses Streamlit's standard height semantics: the greater of content
  height (350px, or an explicit pyecharts pixel height) and parent height, falling back to
  content height when there is no sized parent. An `int` sets a fixed pixel height.
- **`pyecharts` InitOpts.** pyecharts always writes `InitOpts` width/height, using library
  defaults `"900px"` / `"500px"` even when the author never set them. Streamlit therefore
  treats those two default strings as unspecified so a dict spec and an equivalent pyecharts
  chart get the same 700×350 content size. A user who actually wants 500px (or 900px) should
  pass Streamlit `height=500` / `width=900` — `InitOpts(height="500px")` cannot be distinguished
  from the library default. Any other **pixel** value is honored. `"100%"` maps to `"stretch"`.
  Any other CSS unit falls back to the Streamlit default and logs a warning rather than
  raising, since pyecharts may have set it without the app author choosing it.
- The chart auto-resizes with its container (via a resize observer), matching Plotly behavior.

#### Reruns & state persistence

ECharts plays entry animations when a browser instance is initialized. During ordinary reruns, the
frontend keeps the existing ECharts instance mounted and updates it in place — `setOption` when
the option changed, `resize` when only dimensions changed — avoiding unnecessary re-initialization
and repeated entry animations for the common "unrelated widget reran the app" case.
`renderer` is fixed at `init` time, so a renderer change still requires disposing and
re-initializing the instance. Light/dark re-theming uses `setTheme` (see [Theming](#theming))
and does not dispose the instance.

If Streamlit does unmount and remount the element (for example, opening an expander that was
collapsed on first render), ECharts is recreated from the declarative option object and the entry
animation replays. Display-only charts without a `key` keep no element ID and no browser-side
state, so unlike `st.plotly_chart` they have nothing to restore — the declarative option is the
whole state. An explicit `key` still emits `st-key-<key>` for CSS. Unrelated widget reruns and
fullscreen toggles do not remount the chart, so those common paths are animation-free.

When `on_select` is active, `st.echarts_chart` becomes a widget. In that mode, Streamlit computes
a widget ID, persists the read-only selection state, and makes it available as the return value
and through `st.session_state[key]` when a key is provided. This follows the Vega-Lite selection
pattern more closely than Plotly's always-compute-ID behavior, which is a special case for
Plotly's mutable browser-side figure state. Because a deterministic `setOption({ notMerge: true })`
clears ECharts' native `select`/`brush` state, the frontend **re-applies the visible selection**
(re-dispatching native `select` from the private native channel and re-drawing brush areas from
private geometry) after each in-place option update and on remount, keeping the on-screen
highlight in sync with the persisted state.

Without a `key`, the widget identity is derived from the option payload plus `theme`, `renderer`,
and the dimensions — so, as with `st.plotly_chart`/`st.vega_lite_chart`, **any change to the
chart's data or spec resets the selection state**. Pass a fixed `key` so identity is the key
alone: the selection stays stable across data updates **and**
across `"canvas"` / `"svg"` switches. `renderer` is not in the keyed identity because it does
not change `EChartsState`; the frontend re-applies the selection after the dispose/re-init a
renderer switch requires, just as it does after a `setTheme`.

#### Loading & error handling

- **Loading** — while the ECharts library (lazy-loaded) initializes, a skeleton loader reserves
  the chart area to avoid layout shift, consistent with other charts.
- **Invalid spec** — if `spec` is not a dict (or convertible object) or is not
  JSON-serializable, `st.echarts_chart` raises a `StreamlitAPIException` with a clear message
  (*Fail Fast, Fail Helpfully*). Unsupported `custom`, map/geo, and ECharts GL chart families,
  detected JavaScript callbacks, non-finite numbers (`NaN`/`Infinity`), and a `dataset.source`
  dataframe whose column labels collide once stringified are rejected with similarly targeted
  errors. Note that `NaN`/`NaT` *inside* a `dataset.source` dataframe is converted to `null`
  (ECharts' own "no value" marker) rather than rejected; only non-finite floats the user writes
  directly into the option raise.
- **Runtime errors** — rendering errors from ECharts are surfaced as a styled error message in the
  chart area rather than crashing the app.

### Toolbar actions

The rendered chart includes the standard Streamlit chart hover toolbar (consistent with Plotly,
Vega-Lite, and Mermaid):

| Action | Description |
|--------|-------------|
| Fullscreen | Expand the chart to fullscreen. |
| Download | Export a canvas-rendered chart as PNG or an SVG-rendered chart as SVG (ECharts `getDataURL`), using a timestamped filename. Because the themed chart background is transparent, PNG export composites the app background color so the file isn't transparent (unless the spec sets its own `backgroundColor`). |

ECharts' own `toolbox` feature (if present in `spec`) is respected and rendered by ECharts.

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

spec = {
    "xAxis": {"type": "category", "data": ["Mon", "Tue", "Wed", "Thu", "Fri"]},
    "yAxis": {"type": "value"},
    "series": [
        {"type": "bar", "selectedMode": "multiple", "data": [120, 200, 150, 80, 70]}
    ],
}

event = st.echarts_chart(spec, key="sales", on_select="rerun")

rows = event.selection.selected[0]["data_indices"] if event.selection.selected else []
st.write("You selected:", [spec["series"][0]["data"][i] for i in rows])
```

#### Gauge (ECharts-native styling)

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

- **No JS execution (v1).** Because only a JSON-serializable spec is accepted (no JS function
  values), there is no arbitrary-code-execution surface beyond what data the app author already
  controls — the same posture as `st.plotly_chart`, `st.vega_lite_chart`, and `st.altair_chart`.
- **Same-origin rendering.** ECharts renders into a canvas/SVG within the app DOM (no iframe,
  no blob URLs), so there are no additional CSP requirements.
- **Tooltip/label HTML.** ECharts tooltips and rich labels can render app-provided strings.
  [CVE-2026-45249](https://github.com/advisories/ghsa-fgmj-fm8m-jvvx) (Lines series tooltip XSS)
  is fixed in ECharts **6.1.0**. Streamlit bundles `echarts` at `^6.1.0`, does **not** enable
  raw-HTML tooltip rendering on the user's behalf (no HTML formatter injection; do not change
  `tooltip.renderMode`), and a required regression test asserts that HTML/script payloads in
  tooltip/label content render as escaped text. An app author who sets an HTML formatter in
  `spec` is opting into the same trust model as Plotly/Vega.
- **Other JSON-reachable sinks.** Tooltip escaping is not the whole boundary. ECharts'
  [security guide](https://echarts.apache.org/handbook/en/best-practices/security/) also lists
  HTML/URL fields that a JSON spec can set (`toolbox.feature.dataView.title` / `lang`,
  `title.link`, treemap/sunburst `data.link`) and a ReDoS-capable `dataset.transform` filter
  `reg`. Built-in and string-template formatters are documented as injection-safe; those other
  fields are not. v1 does not sanitize them — they are app-author-controlled, the same Plotly/
  Vega trust model. Implementers should not treat the tooltip regression test as coverage for
  these sinks.
- **License.** Apache ECharts is Apache-2.0 licensed — the same license as Streamlit — so there
  is no new licensing concern for bundling it.

### Accessibility

- Streamlit sets `spec["aria"] = {"enabled": True}` when the user has not already set `aria`,
  **regardless of `theme`**. `theme=None` only skips visual theming; it does not drop the
  screen-reader description. When ARIA is enabled, ECharts sets `role="img"` and an
  `aria-label` (or the user's `aria.label.description`) on `zr.dom` — which is the very
  container Streamlit passes to `echarts.init`, not a nested child.
- Because ECharts writes the role onto that same element, the Streamlit wrapper does **not**
  declare `role="img"` itself. It only sets `aria-busy` while the library loads. Declaring the
  role would otherwise strand an image with no accessible name for users who opt out with
  `aria: {"enabled": False}`, since ECharts then sets neither the role nor a label
  (WCAG 1.1.1).
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
- **JSON-only spec.** Power users who rely on JS `formatter`/`renderItem` callbacks are not
  served in v1 (see [Out of Scope](#out-of-scope-future-work)). String-template formatters cover
  the large majority of cases.

## Out of Scope (Future Work)

- **Seeding option-defined selection into `EChartsState`** — reflecting marks pre-selected via
  `data[].selected` in the initial widget value. It reads like a one-line read but is a state
  machine: seed only when there is no persisted widget state, don't re-seed after the user clears
  the selection, and decide what a changed pre-selection means for a keyed chart whose whole point
  is that its selection survives spec changes. Neither `st.plotly_chart` nor `st.vega_lite_chart`
  seeds pre-selected marks, so there is no pattern to borrow. Revisit if users ask for it.
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
  third-party extensions (extra bundles + extension lifecycle). Map/geo and ECharts GL specs are
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
- **Resolve content size from the frontend theme token** — v1's 350px content-height fallback
  lives as a Python constant that mirrors `defaultChartHeight`. Retuning that token would
  silently desync `st.echarts_chart`. Moving the resolution into the frontend component, where
  `theme.sizes` is available, matches the repo's "sizing belongs in the frontend" rule, but it
  is a real refactor against the zero-size init latch and is deferred.

## Alternatives Considered

**Option 1: Keep relying on the third-party `streamlit-echarts` component** ❌
- Pros: Zero maintenance for Streamlit; already feature-rich.
- Cons: Explicitly **best-effort maintenance** (its author still ships occasional features but
  isn't actively reviewing community issues/PRs, and points users to Streamlit issue
  [#1564](https://github.com/streamlit/streamlit/issues/1564) for a native version), ships a
  duplicate ECharts bundle, and its interaction model relies on app-authored JavaScript
  (`events` + `JsCode`) rather than a structured Streamlit API. Directly the motivation for #12302.

**Option 2: `st.echarts_chart(spec=dict)` mirroring `st.plotly_chart`** ✅ PREFERRED
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

### Parameter name: `spec` vs `options` vs `option`

**`spec`** ✅ PREFERRED
- Pros: Matches `st.vega_lite_chart(data, spec)`, the other chart command whose input is a
  declarative dict, and `st.columns(spec)` — in Streamlit, `spec` consistently means "the
  declarative definition of this element." Already the name of the proto field, the frontend's
  `element.spec`, and the element-ID parameter, so the public API agrees with its own wire format.
  Reads naturally across all three accepted input forms (dict, JSON string, `pyecharts` chart).
- Cons: Not ECharts' own word, so the docstring has to bridge the two (it opens with "The ECharts
  option object to render" and links to `option.html`).

**`options`** ❌
- Pros: Matches `st_echarts(options=...)`, easing migration from the community component.
- Cons: `options` is Streamlit's word for *the sequence of choices a user picks from*
  (`st.selectbox`, `st.multiselect`, `st.radio`, `st.select_slider`, `st.pills`,
  `st.segmented_control`, `st.feedback`, `st.menu_button`, `SelectboxColumn`), so it violates
  *Same Name, Same Behavior* — and most confusingly in the `on_select="rerun"` case, where the
  chart *is* a selection widget but its selectable data lives inside `series.data`, not in
  `options`. It is also not ECharts' term (that is singular `option`), and ECharts already uses a
  nested `options` key for timeline variants. The migration argument is weak: moving off
  `streamlit-echarts` already means changing the function name, the `width`/`height` format, and
  the `events`/`JsCode` model, and the argument is almost always passed positionally anyway.

**`option`** ❌
- Pros: Exactly ECharts' own term (`setOption(option)`, gallery snippets, `option.html`), which
  follows Streamlit's habit of borrowing the upstream library's noun (`figure_or_dot`,
  `pydeck_obj`, `altair_chart`). Pairs cleanly with a future `config=` passthrough for
  `echarts.init`.
- Cons: One character away from `options`, so it inherits most of the confusion without the
  migration benefit, and a singular "option" reads to a Python user like a single choice.

Also rejected: `chart_obj`/`echarts_obj` (object-shaped names for what is primarily a dict, and
"obj" is geeky), `chart` (redundant with the command name), `config` (overloaded with Streamlit's
`config.toml`, and reserved for the possible `echarts.init` passthrough), and `figure` (Plotly and
Matplotlib vocabulary; ECharts has no figure).

### Selection-less specs: warn vs. raise

**Log a warning** ✅ PREFERRED
- Pros: Surfaces the mistake where developers and coding agents actually see it (the console),
  without a false positive being able to break a running app. Detection is a few lines on the
  normalized spec, reusing the traversal already written for the unsupported-feature checks.
- Cons: Silent in the browser, so a developer who only reads the app UI still sees a chart that
  quietly swallows clicks.

**Raise a `StreamlitAPIException`** ❌
- Pros: Impossible to miss, and matches `st.vega_lite_chart`, which raises
  `vega-on-select-without-spec-selections` when a spec declares no selection params.
- Cons: The Vega analogy doesn't survive contact with ECharts. Vega-Lite selections are a closed
  declarative `params` block that is enumerable and effectively static; ECharts' `selectedMode`
  sits on each individual series, and series are commonly built from data. A spec whose series
  list is momentarily empty (filtered dataframe, data still loading) would raise on an otherwise
  ordinary rerun. Detection also has to guess about `toolbox.feature.brush`. `st.pydeck_chart`
  faces the same per-layer situation with `pickable=True` and chooses not to enforce it.

**Stay silent** ❌
- Pros: Zero risk of noise; the chart simply never returns a selection.
- Cons: A chart that looks interactive and does nothing gives the developer no thread to pull on,
  in the one place where an actionable message is nearly free.

**Selection payload: grouped ECharts state** ✅ PREFERRED
- Pros: One filtering path for native and brush selections; unambiguous series/data-type-local
  indices; preserves ECharts brush types; avoids renderer-specific enrichment and coordinate
  conversion.
- Cons: The common single-series path is slightly more verbose than a flat index list. Native
  versus brush provenance is private (not in the public union); secondary dual-axis geometry
  stays out of the public schema.

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
  active and avoid Plotly's always-on element ID: an unkeyed display-only chart computes no ID
  at all, while an explicit `key` opts into one.
- **Deliberately *not* adopted**: the `events=` + `JsCode` JavaScript-handler model (non-idiomatic
  and executes arbitrary JS) and CSS-string `height`/`width` (we use Streamlit's `width`/`height`
  conventions). Its `replace_merge` and `map`/`registerMap` features are logged as future work.

## Testing (implementation PR)

Required coverage for the implementation PR (not this spec-only diff):

- Selection-less specs: `on_select` with neither `selectedMode` nor `brush` (nor a toolbox
  brush) logs a warning; a spec that enables selection does not.
- Brush: `brushSelected` during drag does not rerun; a completed gesture (`brushEnd` + the
  latest `brushSelected` snapshot) reruns once with final indices.
- Restore/clear: native and brush channels restore independently; clearing brush does not leave
  native highlights of brush-only points; remount in tabs/expanders restores selection.
- Re-theming: a light/dark switch calls `setTheme` and does not dispose the instance; a
  `renderer` switch still disposes and re-initializes.
- Tooltip XSS: HTML/script payloads in tooltip/label content render as escaped text.
- `pyecharts` `JsCode` / non-JSON charts raise; library-default InitOpts size is ignored;
  unsupported CSS units warn and fall back.
- Display-only `key` still emits `st-key-*`; keyed `renderer` switch does not reset selection.
- Typing: `lib/tests/streamlit/typing/echarts_chart_types.py` covers `on_select` overloads
  (`DeltaGenerator` vs `EChartsState`) and attribute/bracket access on the state
  (`event.selection.selected` and `event["selection"]["selected"]`).
- Dataframes: pandas/Polars/PyArrow `dataset.source` conversion, including a dataset list.
- Theme fidelity: light/dark snapshots of the default Streamlit theme.

## Checklist

| Item | ✅ or comment |
|------|---------------|
| Works on SiS, Cloud, etc? | ✅ Client-side rendering, no server dependencies; JSON-only spec. |
| No breaking API changes | ✅ New command; no changes to existing commands. |
| No new dependencies | ⚠️ No new **backend** (Python) dependency. `echarts` is a new **frontend** dependency (lazy-loaded). `pyecharts` remains optional/user-provided. |
| Metrics collected | ✅ `st.echarts_chart` tracked via `gather_metrics`. |
| Any security/legal impact? | ✅ Apache-2.0 (same as Streamlit); JSON-only spec → no JS execution. |
| Any docs changes needed? | ✅ New API reference page + tutorial; add to charts overview. |
