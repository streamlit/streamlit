---
author: lukasmasuch
created: 2026-07-06
---

# Native Apache ECharts Support — Tech Spec

## Summary

Technical design for `st.echarts_chart` (see
[`product-spec.md`](./product-spec.md) for the user-facing API). The implementation
closely follows the existing `st.plotly_chart` architecture: a JSON option object serialized in
a new `EChartsChart` protobuf message, a lazy-loaded frontend component that renders via the
`echarts` npm package, frontend-side theming derived from the Emotion theme, and selection state
serialized back through the standard widget-state mechanism.

## Problem

ECharts has no native Streamlit integration. We need to render arbitrary ECharts option objects
with (a) Streamlit theming that adapts to light/dark and honors the shared chart color palettes,
(b) selection events wired into Streamlit's widget/rerun model, and (c) the shared chart chrome
(fullscreen, download, resize) — without introducing a backend dependency and without executing
arbitrary JavaScript.

Prior art in this repo:
- `st.plotly_chart` — closest analog: JSON `spec` + `config`, `theme` string, `selection_mode`
  enum, widget-state serialization of selections
  (`lib/streamlit/elements/plotly_chart.py`, `frontend/lib/src/components/elements/PlotlyChart/`).
- `st.vega_lite_chart` / `st.altair_chart` — JSON spec + Arrow data, named-parameter selections.
  Both live in `lib/streamlit/elements/vega_charts.py` (`VegaChartsMixin`) and share the same
  `VegaLiteChart` proto, the `ArrowVegaLiteChart/` frontend component, and the `VegaLiteState`
  return type — `st.altair_chart` just compiles an Altair chart object down to a Vega-Lite spec
  first. This "one backend/frontend, multiple Python entry points" split is a useful precedent.
- `st.mermaid_chart` — precedent for a lazy-loaded, browser-bundled JS charting dependency
  (`lib/streamlit/elements/mermaid_chart.py`).

## Proposal

### Protobuf: `EChartsChart.proto`

New message modeled on `PlotlyChart.proto`. The full option object travels as a JSON string.

```proto
syntax = "proto3";

message EChartsChart {
  // JSON-serialized ECharts option object.
  string spec = 1;

  // Theme override; currently only "streamlit" or "" (None).
  string theme = 2;

  // Widget/element ID. Populated only when selections are active.
  string id = 3;

  // Activated selection modes (empty = display only).
  repeated SelectionMode selection_mode = 4;

  // Form ID, set when selections are activated inside a form.
  string form_id = 5;

  // Renderer passed to echarts.init.
  Renderer renderer = 6;

  enum SelectionMode {
    POINTS = 0;  // Click selection.
    BOX = 1;     // Rectangle brush.
    LASSO = 2;   // Polygon brush.
  }

  enum Renderer {
    CANVAS = 0;
    SVG = 1;
  }
}
```

Registration:
- Add `import "streamlit/proto/EChartsChart.proto";` and a field to `Element.proto`
  (`EChartsChart echarts_chart = <next_free_index>;`).
- Run `make protobuf` to regenerate Python + TS bindings.

Note: unlike `VegaLiteChart`, ECharts data lives inline in the option object, so there is **no
Arrow data field** — the entire spec (including data) is JSON. This is the same as `PlotlyChart`.

### Backend: `lib/streamlit/elements/echarts_chart.py`

A new `EChartsMixin` added to `DeltaGenerator` (register in `delta_generator.py` next to
`PlotlyMixin`/`MermaidChartMixin`). Structure mirrors `PlotlyMixin.plotly_chart`:

1. **Overloads** for the return type based on `on_select` (`DeltaGenerator` vs `EChartsState`),
   exactly like `plotly_chart`'s two `@overload`s.
2. **Validation** (*Fail Fast*):
   - `validate_width(width, allow_content=True)` / `validate_height(height, allow_content=True)`.
   - `theme` must be `"streamlit"` or `None`.
   - `renderer` must be `"canvas"` or `"svg"`.
   - `on_select` must be `"ignore"`, `"rerun"`, or callable.
   - `selection_mode` parsed/validated via a helper analogous to `parse_selection_mode`.
3. **Options normalization** (`_normalize_options`) — input type is
   `Mapping[str, Any] | str | EChartsCompatible`, where `EChartsCompatible` is a `Protocol` with
   `dump_options() -> str`:
   - If `options` is a `Mapping`, deep-copy before any mutation.
   - If `options` is a `str`, `json.loads` it into a dict.
   - If `options` has a callable `dump_options` attribute (duck-typed `pyecharts` chart), call it
     and `json.loads` the result. Detected without importing `pyecharts` (no hard dependency).
   - Otherwise raise `StreamlitAPIException`.
   - **`dataset.source` dataframes**: recursively inspect `dataset` entries (either
     `{"dataset": {"source": df}}` or a list of datasets) and convert dataframe-like sources
     (pandas/Polars/PyArrow/…) to object-array records using the existing dataframe utilities
     (`type_util`/`dataframe_util`), setting `dataset.dimensions` from the column order when the
     user hasn't supplied it. This mirrors how `st.vega_lite_chart` ingests dataframes.
   - Serialize with a strict JSON helper that uses `allow_nan=False` and does **not** use
     `default=str` as a blanket fallback. Known JSON-adjacent values produced by dataframe
     conversion can be normalized before serialization, but arbitrary objects, callables,
     `JsCode`-like wrappers, and NaN/Infinity should raise a helpful `StreamlitAPIException`
     explaining that JS callbacks aren't supported natively in v1.
4. **Proto assembly**: set `spec`, `theme`, and `renderer`. Only compute `id` and `form_id` when
   `on_select` is active. In that mode, compute `id` via
   `compute_and_register_element_id("echarts_chart", user_key=key,
   key_as_main_identity={"selection_mode", "renderer"}, ..., spec=..., selection_mode=...,
   theme=..., renderer=..., width=..., height=...)`.
   When no user key is provided, the normalized option payload should participate in the ID. When
   `on_select="ignore"`, leave `id` empty and treat the chart as a display element. This follows
   the Vega-Lite chart pattern; Plotly's always-compute-ID behavior is a special case for Plotly's
   mutable browser-side figure state.
5. **Selections**: when activated, `selection_mode.extend(parse_selection_mode(...))`, register a
   widget with an `EChartsChartSelectionSerde` (JSON string ⇄ `EChartsState` via
   `AttributeDictionary`), and return `widget_state.value`. Otherwise `_enqueue` and return the
   `DeltaGenerator`. This follows the existing chart widget registration pattern.

**State types** (mirroring `PlotlySelectionState`/`PlotlyState`):

```python
class EChartsSelectionState(TypedDict, total=False):
    points: Required[list[dict[str, Any]]]      # rich items incl. series_index/data_index
    point_indices: Required[list[int]]          # flat data indices (Plotly parity)
    box: Required[list[dict[str, Any]]]
    lasso: Required[list[dict[str, Any]]]

class EChartsState(TypedDict, total=False):
    selection: Required[EChartsSelectionState]
```

The serde's `deserialize(None)` returns the empty selection
(`{"selection": {"points": [], "point_indices": [], "box": [], "lasso": []}}`), matching
`PlotlyChartSelectionSerde`. (`streamlit-echarts` additionally exposes a `series_point_indices`
map; we fold per-series info into each `points` item instead to keep the schema Plotly-shaped.)

No theme work happens in Python (per repo rule: *theming/layout is computed in the frontend*).
The backend only forwards the `theme` string.

### Frontend: `frontend/lib/src/components/elements/EChartsChart/`

New lazy-loaded component registered in `ElementNodeRenderer.tsx`:

```ts
const EChartsChart = lazy(
  () => import("~lib/components/elements/EChartsChart/EChartsChart")
)
```

and a render branch for `node.element.echartsChart` wrapped with `withFullScreenWrapper`
(mirroring the `PlotlyChart` branch).

**Dependencies.** Add `echarts` to `frontend/lib/package.json` (Apache-2.0; latest is the 6.x
line). Import the **full** bundle (`import * as echarts from "echarts"`), *not* the tree-shakable
`echarts/core` registry. Tree-shaking requires statically selecting the series/components at build
time, which is impossible for an API that accepts arbitrary user options — a chart type the user
picks at runtime would silently fail to render. Because the component is lazy-loaded, ECharts lives
in the `EChartsChart` chunk and is only fetched on first use (same strategy as `mermaid`), so the
initial app bundle is unaffected. Tree-shaking could be revisited only if we later constrain the
supported chart types.

**Component responsibilities** (`EChartsChart.tsx`):
- Parse `element.spec` (`JSON.parse`) into an ECharts `EChartsOption`, memoized on the spec string
  rather than `element.id` because display-only charts intentionally do not have an ID.
- Hold an `echarts` instance in a ref bound to a container `div`. Use
  `echarts.init(dom, themeObj, { renderer: element.renderer === SVG ? "svg" : "canvas", width, height })`
  and `chart.setOption(option, { notMerge: true })`.
  - Only initialize once the container has valid positive dimensions (ECharts renders incorrectly
    into zero-sized/hidden containers); otherwise defer init rather than throw.
  - On renderer **or** theme change, dispose and recreate the instance (both are fixed at `init`),
    then reset the option/selection memoization so the fresh instance isn't left blank by a stale
    "option unchanged" cache.
  - **Merge behavior**: default to `notMerge: true` for deterministic reruns (the new option fully
    replaces the previous one, matching Streamlit's "same inputs → same UI" principle). This mirrors
    `st.plotly_chart` re-rendering from the full spec. `streamlit-echarts` exposes a `replace_merge`
    option to opt into partial replacement + `universalTransition` animations; that is deferred to
    future work (see product spec).
- Recompute the merged option = `mergeStreamlitTheme(userOption, emotionTheme, element.theme)`
  (see [Theming](#theming-frontend)) and re-`setOption` when the option or theme changes.
- **Avoid unnecessary re-init while mounted**: keep the ECharts instance in a ref and call
  `setOption` on reruns only when the prepared option actually changed. Skip no-op `setOption`
  calls so unrelated widget reruns do not replay ECharts update animations. Do not require
  display-only charts to persist browser-only state through `widgetMgr.setElementState`; if the
  element is truly unmounted, ECharts can be recreated from the declarative option. When
  selections are active and `element.id` is populated, restore the persisted widget
  selection/brush state after chart recreation.
- **Remount validation**: add focused manual/e2e coverage for unrelated widget reruns, fullscreen,
  tabs, and expanders. If display-only charts are commonly unmounted/remounted in those paths and
  replay visible entry animations, switch to computing a stable non-widget element ID for all
  ECharts charts, following Plotly's special-case state-preservation approach.
- **Resize**: on container size changes (via `useCalculatedDimensions`/resize observer, as
  `PlotlyChart` does) call `chart.resize()`. Respect fullscreen dimensions from
  `ElementFullscreenContext`.
- **Toolbar**: reuse the shared chart toolbar (fullscreen via `ElementFullscreenContext`;
  download via `chart.getDataURL({ pixelRatio: 2 })`).
- **Dispose** the ECharts instance on unmount (`chart.dispose()`), and clean up listeners.
- **Errors**: wrap `setOption` in try/catch and render a styled error (`StyledEChartsError`)
  instead of throwing, so a bad option doesn't break the app.

Styled components live in `EChartsChart/styled-components.ts` (`StyledEChartsChartContainer`,
`StyledEChartsError`), following `PlotlyChart/styled-components.ts`.

#### Theming (frontend)

Implement `EChartsChart/CustomTheme.ts` analogous to `PlotlyChart/CustomTheme.tsx`. Build an
ECharts **theme object** from the Emotion theme (`useEmotionTheme()`) and pass it to
`echarts.init(dom, themeObject)` (ECharts accepts a theme object directly, not just a registered
name). The theme object sets:

- `color`: `theme.colors.chartCategoricalColors` (series palette).
- `backgroundColor`: `"transparent"` (app background shows through).
- `textStyle`: `{ fontFamily: genericFonts.bodyFont, color: getGray70(theme), fontSize: ... }`.
- `title.textStyle` / `title.subtextStyle`: heading font + `colors.headingColor`.
- `legend.textStyle`, `tooltip` (`backgroundColor: colors.bgColor`, `borderColor:
  colors.borderColor`, text color), and per-axis defaults
  (`categoryAxis`/`valueAxis`/`logAxis`/`timeAxis`): `axisLine`, `axisTick`, `axisLabel`,
  `splitLine` colored from the gray scale (`getGray30`/`getGray70`).
- `visualMap.inRange.color`: seed from `theme.colors.chartSequentialColors` for continuous scales.
- Interaction components that show up frequently: `dataZoom` (track/filler/handle), `brush`,
  `toolbox.iconStyle`, and `darkMode` (from the active theme type).

Two layers, because the ECharts init theme doesn't reliably cover everything:

1. `buildStreamlitEChartsTheme(emotionTheme)` → the object passed to `echarts.init`.
2. `applyStreamlitOptionDefaults(option, emotionTheme)` → a light, non-destructive pass that fills
   a few option-level gaps themes miss (e.g. `grid.containLabel` default, `visualMap`/`dataZoom`
   colors) **only when the user hasn't set them**.

Precedence: the user's explicit `options` values must always win. The init theme applies
*underneath* the option passed to `setOption`, and `applyStreamlitOptionDefaults` only writes keys
that are absent — so we **never** clobber explicit values (e.g. `series[0].itemStyle.color` or a
top-level `color`). We do **not** deep-merge the theme into the user option. This is cleaner than
Plotly's placeholder-replacement approach because ECharts has first-class theme support.

Dark/light switching: because the theme object is derived from the Emotion theme, when the theme
changes we re-create the instance (ECharts theme is fixed at `init` time) — dispose + `init` with
the new theme object + `setOption`, preserving current option/selection state.

Config-driven palette overrides (`theme.chartCategoricalColors`, `theme.chartSequentialColors`)
already flow into `theme.colors.chart*Colors`, so they are picked up automatically — no extra
work, consistent with Plotly/Vega.

#### Selections (frontend)

Add a `useEChartsSelections` hook (analogous to `useVegaLiteSelections`) that, given `element`
(`selectionMode`, `id`, `formId`) and the `widgetMgr`:

- **Points**: register `chart.on("click", handler)`. The handler builds a point from the event
  `params` (`{ component_type, series_type, series_index, series_name, data_index, name, value,
  data }`) and writes `points` + `point_indices`. We use `click` rather than mutating every
  series' `selectedMode` (the approach `streamlit-echarts` also takes) because it **does not
  modify the user's option** and works across chart types that lack a `select` state (funnel,
  gauge, etc.). Trade-off: no built-in "selected/faded" visual state — if we want Plotly-like
  visual feedback later, we can *optionally* layer `selectedMode` + `selectchanged` for series
  that support it, but that is not required for v1.
- **Box/Lasso**: merge default `brush` + `toolbox.feature.brush` **only when absent** (preserving
  any user-defined brush/toolbox), enabling `rect` (box) and/or `polygon` (lasso) per
  `selectionMode`, and register both `chart.on("brushSelected", …)` and
  `chart.on("brushEnd", …)`.
  - `brushSelected` yields `params.batch[].selected` (series → `dataIndex` arrays) → resolve into
    the shared `points`/`point_indices`.
  - `brushEnd` yields the final brush *areas* → convert pixel ranges to axis coordinates with
    `chart.convertFromPixel(...)`, storing `box`/`lasso` as
    `{ x: [...], y: [...], grid_index }`; if a coordinate system can't be converted, fall back to
    raw pixel coordinates with a `coordinate_system` marker so the state stays inspectable.
  - **Event-ordering guard**: `brushSelected` and `brushEnd` can fire in either order, so cache
    the latest batch *and* the latest areas and emit **exactly one** widget-state update per
    completed gesture. An empty batch/areas (brush "clear") emits the empty selection.
- Debounce writes (~150ms, as Vega does), compare against the current JSON state to **skip no-op
  updates** (avoids needless reruns), and serialize the combined
  `{ selection: { points, point_indices, box, lasso } }` via
  `widgetMgr.setStringValue(widgetInfo, json, { fromUi: true }, fragmentId)`.
- **Reset**: on double-click and on form-clear (`FormClearHelper.manageFormClearListener`), clear
  the ECharts selection (`chart.dispatchAction({ type: "brush", areas: [] })`) and write an empty
  selection — mirroring `PlotlyChart`.
- **State restore**: when `element.id` is populated, restore selection-related view state on
  remount/fullscreen (re-dispatch prior `brush` areas). Display-only charts should not depend on
  `widgetMgr.setElementState`.
- **Disabled**: when `disabled`, do not bind selection handlers or emit updates.

The serialized JSON structure is the single source of truth shared with the Python serde (same
contract as `VegaLiteState`/`PlotlyState`).

### Security

- Bundle ECharts from npm (no CDN script loading); parse option **strings as JSON**, never as JS
  object literals; and use **no** `eval`/`new Function`/script injection. JSON-only options mean no
  app-provided JavaScript executes (the differentiator from `streamlit-echarts`' `JsCode`/`events`).
- **Tooltip/label content (review item).** ECharts tooltips and rich labels can render
  app-provided strings, and ECharts has had tooltip XSS advisories. Implementation must confirm
  ECharts escapes tooltip/label content by default and/or set safe tooltip defaults under
  `theme="streamlit"` (e.g. avoid enabling raw-HTML tooltip rendering). Chart data/text is
  app-author-provided (same trust model as Plotly/Vega), but escaping behavior should be verified.

### Testing

- **Python unit tests** (`lib/tests/streamlit/elements/echarts_chart_test.py`): dict input, JSON
  string input, `pyecharts` duck-typed input (via a fake object exposing `dump_options`),
  `dataset.source` dataframe → records/dimensions conversion, non-serializable/JS-callback input
  raises a helpful error, arbitrary objects are not silently stringified, `theme`/`renderer`/
  `on_select`/`selection_mode` validation, proto fields set correctly (incl. `renderer`), selection
  serde round-trip, no ID for display-only charts, and active-selection ID changes when
  `selection_mode`/`renderer` change.
- **Typing tests** (`lib/tests/streamlit/typing/echarts_chart_types.py`): `assert_type` that
  `on_select="ignore"` → `DeltaGenerator` and `on_select="rerun"` → `EChartsState`.
- **Frontend unit tests** (`EChartsChart.test.tsx`, `CustomTheme.test.ts`,
  `useEChartsSelections.test.ts`): theme-object construction maps Emotion colors/fonts; user option
  values survive default merging; canvas default vs `renderer="svg"`; `setOption`/`resize`/`dispose`
  lifecycle; display-only charts work with an empty proto ID; theme/renderer change recreates the
  instance; `click` → point widget state;
  `brushSelected` + `brushEnd` (both orderings) → single box/lasso update; brush clear → empty
  state; no-op selections skip `setStringValue`; form clear + `disabled` behavior; error rendering.
  Mock `echarts.init` where a real canvas isn't needed.
- **E2E** (`e2e_playwright/st_echarts_chart.py` + `_test.py`): basic + mixed (dataZoom) charts,
  light/dark theme snapshots, custom colors not overwritten, width/height + fullscreen,
  `on_select="rerun"` point/box/lasso selection, SVG renderer, `pyecharts` object, download
  toolbar. Run via `make run-e2e-test st_echarts_chart_test.py`.

### Rollout

- Guard nothing behind a feature flag — it's an additive command.
- Add docs: API reference page, charts overview entry, and a tutorial. Update
  `lib/streamlit/__init__.py` `st` namespace export and `e2e_playwright` if listing exists.

## Alternatives Considered

**Deep-merge Streamlit theme into the option (Plotly placeholder approach)** — rejected. ECharts
has native `init(dom, themeObject)` support, so passing a theme object is simpler, avoids the
fragile placeholder-color string replacement Plotly needs, and naturally lets explicit user values
win. Downside: re-`init` on theme toggle (acceptable; theme toggles are rare).

**Register the theme once via `echarts.registerTheme("streamlit", …)`** — rejected as the default.
A registered name is global and static, but our theme is dynamic (light/dark, config overrides).
Passing a freshly-built theme object per instance keeps it reactive to the Emotion theme.

**Send data separately as Arrow (like Vega-Lite)** — rejected for v1. ECharts option objects
embed data inline and support many non-tabular structures (graph nodes/links, tree, sankey). A
single JSON `spec` (like Plotly) is simpler and fully general. We still meet Pythonic-data
expectations by converting dataframes found in `dataset.source` to JSON records on the backend
(see the backend Input Normalization step); Arrow-based transport for very large tabular datasets
can be a later optimization.

**Support JS callbacks via an `unsafe_allow_js`/`JsCode` mechanism now** — deferred. It adds an
arbitrary-JS-execution surface that needs a dedicated security review and API design; not required
for the common cases (string-template formatters). Listed as future work in the product spec.
`streamlit-echarts` implements this by wrapping JS in a `JsCode` object that encodes the source
between placeholder sentinels (`--x_x--0_0--`), recursively substituting them into the options
JSON, and `eval`-ing them on the frontend — plus an `events={name: JsCode}` dict (with a `zr:`
prefix for canvas-wide zrender events, and reruns skipped when a handler returns `undefined`). If
we add native JS support, this placeholder-encoding approach is the reference design, but it must
be gated behind an explicit, security-reviewed opt-in.
