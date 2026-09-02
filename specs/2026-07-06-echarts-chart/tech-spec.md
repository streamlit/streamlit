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

  // Widget/element ID. Populated only when selections are active
  // (on_select != "ignore").
  string id = 3;

  // Field 4 is reserved for a future `selection_mode` (v1 activates selection
  // via `on_select` and returns whatever the user configured in the spec).
  reserved 4;
  reserved "selection_mode";

  // Form ID, set when selections are activated inside a form.
  string form_id = 5;

  // Renderer passed to echarts.init.
  Renderer renderer = 6;

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

Note: the message intentionally has **no `width`/`height` fields**. Element dimensions are handled
by the standard element-container sizing mechanism (the shared `width`/`height` config carried
outside this message, as with other chart elements), so they are not duplicated in the proto.

### Backend: `lib/streamlit/elements/echarts_chart.py`

A new `EChartsMixin` added to `DeltaGenerator` (register in `delta_generator.py` next to
`PlotlyMixin`/`MermaidChartMixin`). Structure mirrors `PlotlyMixin.plotly_chart`:

1. **Overloads** for the return type based on `on_select` (`DeltaGenerator` vs `EChartsState`),
   exactly like `plotly_chart`'s two `@overload`s.
2. **Validation** (_Fail Fast_):
   - `validate_width(width, allow_content=True)` / `validate_height(height, allow_content=True)`.
   - `theme` must be `"streamlit"` or `None`.
   - `renderer` must be `"canvas"` or `"svg"`.
   - `on_select` must be `"ignore"`, `"rerun"`, or callable.
3. **Spec normalization** (`_normalize_spec`) — the `spec` parameter is typed as
   `EChartsSpec = Mapping[str, Any] | str | EChartsCompatible`, where `EChartsCompatible` is a
   `Protocol` with `dump_options() -> str`:
   - If `spec` is a `Mapping`, deep-copy before any mutation.
   - If `spec` is a `str`, `json.loads` it into a dict.
   - If `spec` has a callable `dump_options` attribute (duck-typed `pyecharts` chart), call it
     and `json.loads` the result. Detected without importing `pyecharts` (no hard dependency).
     Note: `pyecharts`' `dump_options()` emits **raw, unquoted** `function () { … }` values for any
     `JsCode` options, which makes `json.loads` fail with a cryptic `JSONDecodeError`. Wrap the
     `json.loads` of any string/`dump_options` input in a `try/except` that re-raises a helpful
     `StreamlitAPIException` pointing at the JSON-only-in-v1 constraint (and, when a
     `--x_x--`-style `JsCode` sentinel or a bare `function`/`=>` token is detected, name JS
     callbacks explicitly as the unsupported cause).
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
key_as_main_identity={"renderer"}, ..., spec=..., theme=..., renderer=..., width=...,
height=...)`.
   When no user key is provided, the normalized option payload should participate in the ID. When
   `on_select="ignore"`, leave `id` empty and treat the chart as a display element. This follows
   the Vega-Lite chart pattern; Plotly's always-compute-ID behavior is a special case for Plotly's
   mutable browser-side figure state.
5. **Selections**: when activated, register a widget with an `EChartsChartSelectionSerde` (JSON
   string ⇄ `EChartsState` via `AttributeDictionary`), and return `widget_state.value`. Otherwise
   `_enqueue` and return the
   `DeltaGenerator`. This follows the existing chart widget registration pattern.

**State types** (using the shared Streamlit event envelope with an ECharts-native payload):

```python
class EChartsSelectionState(TypedDict, total=False):
    selected: Required[list[dict[str, Any]]]
    areas: Required[list[dict[str, Any]]]


class EChartsState(TypedDict, total=False):
    selection: Required[EChartsSelectionState]
```

The serde's `deserialize(None)` returns the empty selection
(`{"selection": {"selected": [], "areas": []}}`). Each `selected` entry always contains
`series_index`, nullable `series_id`/`series_name`, `data_type`, and `data_indices`. Each `areas`
entry always contains `brush_index`, `brush_type`, and nullable `coord_range`.

No theme work happens in Python (per repo rule: _theming/layout is computed in the frontend_).
The backend only forwards the `theme` string.

### Frontend: `frontend/lib/src/components/elements/EChartsChart/`

New lazy-loaded component registered in `ElementNodeRenderer.tsx`:

```ts
const EChartsChart = lazy(
  () => import("~lib/components/elements/EChartsChart/EChartsChart"),
);
```

and a render branch for `node.element.echartsChart` wrapped with `withFullScreenWrapper`
(mirroring the `PlotlyChart` branch).

**Dependencies.** Add `echarts` to `frontend/lib/package.json` (Apache-2.0), pinning a minimum of
`^6.1.0`. This is a **hard requirement, not an implementation-time detail**: the `6.0.x` line is
still affected by a tooltip XSS advisory (`series.type="lines"`), so `^6.1.0` is the safe minimum
whose API this design relies on. At implementation time, **confirm `6.1.0` is actually released and
contains the fix** — ECharts' release cadence is irregular — and cite the upstream advisory/fix
notes (link the GitHub Security Advisory in `package.json` and the PR description). If a patched
`6.1.x` is not yet available, pin the specific patched `6.0.x` release that contains the fix instead
and record the reasoning. Import the **full** bundle (`import * as echarts from "echarts"`), _not_ the tree-shakable
`echarts/core` registry. Tree-shaking requires statically selecting the series/components at build
time, which is impossible for an API that accepts an arbitrary user spec — a chart type the user
picks at runtime would silently fail to render. Because the component is lazy-loaded, ECharts lives
in the `EChartsChart` chunk and is only fetched on first use (same strategy as `mermaid`), so the
initial app bundle is unaffected. Tree-shaking could be revisited only if we later constrain the
supported chart types.

**Component responsibilities** (`EChartsChart.tsx`):

- Parse `element.spec` (`JSON.parse`) into an ECharts `EChartsOption`, memoized on the spec string
  rather than `element.id` because display-only charts intentionally do not have an ID.
- Hold an `echarts` instance in a ref bound to a container `div`. Use
  `echarts.init(dom, themeArg, { renderer: element.renderer === SVG ? "svg" : "canvas", width, height })`
  and `chart.setOption(option, { notMerge: true })`. `themeArg` is the Streamlit-built theme object
  **only when `element.theme === "streamlit"`**; when `theme=None` it is `undefined` so ECharts uses
  its built-in default theme and the user's `spec` stays untouched (see [Theming](#theming-frontend)).
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
  selections are active and `element.id` is populated, restore the persisted selection after chart
  recreation **and after any in-place `setOption({ notMerge: true })`** — full replacement clears
  both the native `select` state and drawn `brush` areas, so `restoreSelection` re-dispatches the
  persisted selected points _and_ brush areas (see the Selections "State restore" step) whenever
  the option is replaced, keeping the visible selection in sync with the persisted widget state.
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

Two layers, because the ECharts init theme doesn't reliably cover everything. **Both layers run
only when `theme="streamlit"`**; when `theme=None` neither is applied, so the user's `spec` is
left untouched (matching the product spec's opt-out semantics, including ARIA only being enabled if
the user sets it):

1. `buildStreamlitEChartsTheme(emotionTheme)` → the object passed to `echarts.init`.
2. `applyStreamlitOptionDefaults(option, emotionTheme)` → a light, non-destructive pass that fills
   a few option-level gaps themes miss (e.g. `grid.containLabel` default, `visualMap`/`dataZoom`
   colors, and `aria.enabled` — see the product spec's Accessibility section) **only when the user
   hasn't set them**.

Precedence: the user's explicit `spec` values must always win. The init theme applies
_underneath_ the option passed to `setOption`, and `applyStreamlitOptionDefaults` only writes keys
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
(`id`, `formId`) and the `widgetMgr`. **Streamlit injects no selection config** — the hook only
_listens_ for whatever selection the user enabled in their spec. `configureSelectionOption`
therefore returns the option unchanged for selection widgets (it only resets the misleading
`"pointer"` cursor for display-only charts). Selection is active whenever the chart has an
`element.id` (i.e. `on_select != "ignore"`), and all handlers below are bound unconditionally in
that case — unused ones simply never fire.

- **Native selection**: register `chart.on("selectchanged", handler)`. This fires only if a series
  sets `selectedMode` (`"single"`/`"multiple"`/`"series"`). Its `selected` array is the
  authoritative full native-selection snapshot, grouped by `seriesIndex` and optional `dataType`.
  Normalize a missing `dataType` to `"main"`; retain only `seriesIndex` and `dataIndex[]`.
- **Brush selection**: register `chart.on("brushSelected", …)` and
  `chart.on("brushEnd", …)`. `brushSelected.batch` is the authoritative full brush snapshot: one
  entry per brush component containing its `brushIndex`, active `areas`, and selected indices for
  every series. Omit empty series and component placeholders.
  - Cache exact raw areas per `brushIndex` for restoration. Build public areas from
    `brushType` and the primary `coordRange`; use `null` when no data-space range exists. Do not
    expose pixel `range`, internal `panelId`, or secondary `coordRanges`.
  - `brushEnd` reports only the component whose gesture ended, so use it only as a commit signal;
    never replace the component cache from `brushEnd.areas`. A delayed `brushSelected` after
    `brushEnd` completes the pending commit. Toolbox clear emits only `brushSelected`, so an
    all-empty-area snapshot commits immediately.
- **Grouped union**: native and brush channels coexist and are cached independently. Merge their
  indices by `(series_index, data_type)`, normalize brush entries to `data_type="main"`, de-duplicate
  and numerically sort `data_indices`, and omit empty groups. Sort groups by series and the fixed
  type rank `main`, `node`, `edge`; sort areas by `brush_index` while retaining per-component area
  order. Resolve `series_id`/`series_name` from the top-level resolved series option, mapping
  missing, empty, or NUL-containing values to `null`; never inspect a data item.
- **Channel-preserving clears**: native unselection preserves brush state, and brush clear
  preserves native state. Double-click and form clear explicitly clear both channels.
- Debounce writes (~150ms, as Vega does), compare against the current JSON state to **skip no-op
  updates** (avoids needless reruns), and serialize via
  `widgetMgr.setStringValue(widgetInfo, json, { fromUi: true }, fragmentId)`.
- **Reset**: on double-click and on form-clear (`FormClearHelper.manageFormClearListener`), clear
  the ECharts selection — `dispatchAction({ type: "brush", areas: [] })` **and**
  `dispatchAction({ type: "unselect", … })` for the persisted selected points — and write an empty
  selection — mirroring `PlotlyChart`.
- **State restore**: persist exact raw native entries and component-grouped brush areas to frontend
  element state. When `element.id` is populated, `restoreSelection` re-applies **both** on
  remount/fullscreen **and after each option-replacing `setOption({ notMerge: true })`**:
  `dispatchAction({ type: "select", seriesIndex, dataIndex })` per persisted point and
  a targeted `dispatchAction({ type: "brush", brushIndex, areas })` per brush component. Otherwise,
  a full option replacement clears native and brush state and desyncs the chart from the widget
  value. This restore runs before handlers are bound on instance recreation; the restoring guard
  suppresses events when handlers are already active. Display-only charts do not use element state.
- **Display-only**: when selections are inactive (`on_select="ignore"`, i.e. no `element.id`), do not
  bind selection handlers or emit updates. (v1 does not expose a `disabled` parameter, mirroring
  `st.plotly_chart`; see the product spec's Out of Scope.)

The serialized JSON structure is the single source of truth shared with the Python serde (same
contract as `VegaLiteState`/`PlotlyState`).

### Security

- Bundle ECharts from npm (no CDN script loading); parse option **strings as JSON**, never as JS
  object literals; and use **no** `eval`/`new Function`/script injection. A JSON-only spec means no
  app-provided JavaScript executes (the differentiator from `streamlit-echarts`' `JsCode`/`events`).
- **Tooltip/label content (MVP-safe behavior, not a deferred review item).** ECharts tooltips and
  rich labels can render app-provided strings, and ECharts has had tooltip XSS advisories. The MVP
  posture is defined here as a hard requirement:
  - Depend on ECharts `^6.1.0`, which resolves the known tooltip XSS advisory (`series.type="lines"`);
    the version floor is enforced in `package.json` (see [Dependencies](#dependencies)).
  - Under `theme="streamlit"`, `applyStreamlitOptionDefaults` **never injects a tooltip/label
    `formatter`** (or any other option) that emits raw HTML on the user's behalf, and it does **not**
    change `tooltip.renderMode`. It relies on ECharts' built-in escaping of tooltip/label _values_ in
    the default formatter, so app-provided strings render as text rather than markup. (Note: ECharts'
    `tooltip.renderMode = "html"` is the default DOM tooltip mode and is safe by itself — the risk
    comes only from a `formatter` that returns unescaped HTML, which Streamlit's defaults never add.)
    If the user explicitly supplies an HTML-emitting `formatter`, their value wins (same app-author
    trust model as Plotly/Vega), but Streamlit's own defaults never widen the surface.
  - This behavior is covered by a **required regression test** (see [Testing](#testing)): a tooltip/
    label containing an HTML/script payload must render as escaped text under `theme="streamlit"`.

### Testing

- **Python unit tests** (`lib/tests/streamlit/elements/echarts_chart_test.py`): dict input, JSON
  string input, `pyecharts` duck-typed input (via a fake object exposing `dump_options`),
  `dataset.source` dataframe → records/dimensions conversion, non-serializable/JS-callback input
  raises a helpful error, arbitrary objects are not silently stringified, `theme`/`renderer`/
  `on_select` validation, proto fields set correctly (incl. `renderer`), selection serde
  round-trip, no ID for display-only charts, and active-selection ID changes when `renderer`/spec
  change (and is stable with a `key`).
- **Typing tests** (`lib/tests/streamlit/typing/echarts_chart_types.py`): `assert_type` that
  `on_select="ignore"` → `DeltaGenerator` and `on_select="rerun"` → `EChartsState`.
- **Frontend unit tests** (`EChartsChart.test.tsx`, `CustomTheme.test.ts`,
  `useEChartsSelections.test.ts`): theme-object construction maps Emotion colors/fonts; user option
  values survive default merging; canvas default vs `renderer="svg"`; `setOption`/`resize`/`dispose`
  lifecycle; display-only charts work with an empty proto ID; theme/renderer change recreates the
  instance; **the option is left untouched for selection widgets** (no injection); a widget binds
  all selection listeners; grouped native/brush union with deterministic ordering; empty ECharts
  placeholders are omitted; graph `dataType` stays distinct; brush areas retain component identity
  and primary coordinate geometry; `brushSelected` + `brushEnd` work in both orderings and across
  multiple brush components; clearing one channel preserves the other; `restoreSelection`
  re-dispatches persisted `select` + targeted `brush`; no-op selections skip `setStringValue`;
  double-click/form-clear reset behavior; display-only charts bind no selection handlers; error
  rendering. Include a focused real-ECharts contract test for raw indices across DataZoom and
  dataset transforms; mock `echarts.init`/`getOption` where a real instance isn't needed.
- **Security regression test (required).** A tooltip/label whose content contains an HTML/script
  payload (e.g. `"<img src=x onerror=alert(1)>"`) must render as **escaped text** under
  `theme="streamlit"` and must not execute. Cover this in the frontend unit tests and assert it in
  e2e (see below) so the MVP-safe tooltip posture cannot regress silently.
- **Remount / state-persistence coverage (required, not just prose).** Explicitly cover unrelated
  widget reruns, fullscreen, tabs, and expanders to confirm display-only charts do not replay entry
  animations on remount and that active selections restore correctly; promote these from the
  narrative in [Reruns & state persistence](./product-spec.md#reruns--state-persistence) into
  required e2e/manual assertions.
- **E2E** (`e2e_playwright/st_echarts_chart.py` + `_test.py`): basic + mixed (dataZoom) charts,
  light/dark theme snapshots, custom colors not overwritten, width/height + fullscreen,
  `on_select="rerun"` point selection (enabled via `selectedMode` in the spec, with a `select`
  style so the highlight is visible), SVG renderer, `pyecharts` object, download toolbar, the
  tooltip-escaping security regression, and the remount/state-persistence scenarios above. Point
  selection specifically asserts the selected point stays **visibly highlighted** (snapshot),
  **persists across an unrelated rerun**, and **toggles off** on re-click. Run via
  `make run-e2e-test st_echarts_chart_test.py`.

### Rollout

- Guard nothing behind a feature flag — it's an additive command.
- Add docs: API reference page, charts overview entry, and a tutorial. Update
  `lib/streamlit/__init__.py` `st` namespace export and `e2e_playwright` if listing exists.
- **Phasing (display vs. selections).** The primary value of native ECharts is the _display_ of
  chart types Plotly/Vega don't cover (gauge, sunburst, sankey, graph, radar, …) — that is the
  core of #12302. v1 ships display **and** selections, but keeps the selection surface minimal:
  `on_select` activates the widget and Streamlit returns whatever selection the user enabled in
  their spec (`selectedMode`, `brush`), with no injected config or `selection_mode` parameter. This
  avoids the mismatch/mutation issues of auto-enabling and works uniformly across chart types. The
  ergonomic `selection_mode` convenience (auto-enable + theme points/box/lasso, à la
  `st.plotly_chart`) is deferred to a follow-up and is purely additive when added.

## Alternatives Considered

**Inject selection config from a `selection_mode` parameter (Plotly-style)** — deferred to a
follow-up. Streamlit could take `selection_mode=("points","box","lasso")` and auto-enable each mode
by injecting `selectedMode`/`select` into every series and a `brush` + `toolbox` component (and
theming them). This gives zero-config selections, but: (a) it mutates the user's option, (b) it
must guess which modes a chart supports — a brush toolbar on a `gauge`/pie is dead UI — and (c) it
duplicates config ECharts users already know how to write. v1 instead **listens** to whatever the
user enabled in the spec (`on_select` only decides _whether_ to listen), which keeps the option
untouched, avoids the mismatch, and matches ECharts' catalog exactly. The convenience layer can be
added later as a pure superset (a `selection_mode` that injects on top of the listen-only base).

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
between placeholder sentinels (`--x_x--0_0--`), recursively substituting them into the spec
JSON, and `eval`-ing them on the frontend — plus an `events={name: JsCode}` dict (with a `zr:`
prefix for canvas-wide zrender events, and reruns skipped when a handler returns `undefined`). If
we add native JS support, this placeholder-encoding approach is the reference design, but it must
be gated behind an explicit, security-reviewed opt-in.
