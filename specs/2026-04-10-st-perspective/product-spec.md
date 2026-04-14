---
author: lukasmasuch
created: 2026-04-10
---

# `st.perspective` - Interactive analytics explorer for tabular data

## Summary

Add `st.perspective` as a built-in Streamlit element for interactive exploration of
tabular data with pivots, filters, sorts, expressions, and chart switching. The
initial release should use Perspective's client-side WebAssembly runtime in the
browser and Streamlit's existing Arrow transport, avoiding a second server protocol
and avoiding a Python dependency on `perspective-python`.

This ships the most valuable part of Perspective quickly: a user-configurable,
high-performance data explorer that feels native in Streamlit. Server-backed
Perspective sessions for extremely large datasets, distributed editing, and virtual
servers remain follow-up work.

## Problem

### Current State

Streamlit has strong primitives for showing data, but no built-in element that lets
the *viewer* reconfigure a dataset into a pivot-style analysis surface:

- `st.dataframe` is excellent for grid inspection, but it does not offer built-in
  group-by, pivot, expression authoring, or chart switching.
- `st.plotly_chart`, `st.altair_chart`, and `st.vega_lite_chart` are great when the
  app author defines the visualization upfront, but ad hoc exploration requires the
  app author to build a separate control surface and rerun logic around them.
- Custom components or iframes can embed Perspective today, but they have poor
  discoverability, require bespoke packaging and asset hosting, and do not benefit
  from a supported first-class Streamlit API.

### Why Perspective

Perspective is a good fit for this gap because it already provides:

- A framework-agnostic `<perspective-viewer>` custom element.
- A high-performance columnar engine with Arrow support.
- A rich interactive model: `group_by`, `split_by`, sorting, filtering,
  expressions, and plugin-based visualizations.
- A save/restore API for viewer configuration.
- Multiple operating modes:
  client-only WebAssembly, client/server replicated, and server-only.

Relevant prior art and reference material:

- Perspective guide: https://perspective-dev.github.io/guide/
- Perspective Python widget docs:
  https://perspective-dev.github.io/python/perspective/widget.html
- Perspective Starlette example:
  https://github.com/perspective-dev/perspective/blob/41250b2d7c4dbf2af0cef09b7aba813a47cffe9e/examples/python-starlette/server.py

Perspective's existing Python/Jupyter integration is useful prior art, but it is
not a direct template for Streamlit. The Jupyter widget defaults to
`binding_mode="server"` because notebooks already have a long-lived Python kernel
transport. Streamlit's rerun architecture and existing Arrow snapshot transport
make a browser-local first release the better fit.

### User Scenarios

1. **Self-serve analysis inside an app**

   A Streamlit app author wants to hand a large dataframe to the user and let them
   decide whether they want a grid, a grouped summary, a split/pivoted view, or a
   chart.

2. **Operations dashboards with rapidly changing snapshots**

   An app reruns every few seconds or inside a fragment. The user wants their
   current chart type, filters, and pivots to remain intact while the underlying
   data refreshes.

3. **Exploration-first internal tools**

   Teams often want a lightweight BI-like surface inside Streamlit without sending
   users to a separate dashboarding product.

Representative domains include finance dashboards, log or telemetry exploration,
and internal BI tools, but the common need is the same: let the viewer reshape a
table interactively without the app author prebuilding every control.

### Demand Signals

This proposal sits at the intersection of several recurring asks in Streamlit:

- pivot-style grouped analysis directly inside an app
- better exploration ergonomics for large tables
- dashboards that refresh frequently without discarding the user's current view

Those signals matter, but they should not be conflated. The initial release mainly
addresses pivot-style exploration and rerun-friendly state retention. Truly
server-backed streaming or "data too large for browser memory" use cases remain
follow-up work.

## Proposal

### Public API

```python
PerspectiveConfig = TypedDict(
    "PerspectiveConfig",
    {
        "plugin": str,
        "columns": Sequence[str],
        "group_by": Sequence[str],
        "split_by": Sequence[str],
        "sort": Sequence[tuple[str, str]],
        "filter": Sequence[tuple[str, str, Any]],
        "aggregates": Mapping[str, str],
        "expressions": Mapping[str, str],
        "settings": bool,
    },
    total=False,
)

st.perspective(
    data: Data,
    *,
    default_config: PerspectiveConfig | None = None,
    theme: str = "streamlit",
    key: str | None = None,
    width: Width = "stretch",
    height: int = 500,
) -> DeltaGenerator
```

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `data` | Anything supported by `st.dataframe` | required | Tabular data to explore. Streamlit serializes it to Arrow and loads it into Perspective in the browser. |
| `default_config` | `PerspectiveConfig \| None` | `None` | Initial Perspective viewer configuration. This seeds the viewer on first load or after reset. |
| `theme` | `str` | `"streamlit"` | `"streamlit"` uses a Streamlit-generated Perspective theme. Other strings are passed through as Perspective theme names if they are bundled. |
| `key` | `str \| None` | `None` | Optional stable identity. Needed to preserve viewer state across data refreshes when row values change. |
| `width` | `Width` | `"stretch"` | Standard Streamlit width behavior. |
| `height` | `int` | `500` | Fixed viewport height in pixels. |

For the initial release, `data` should follow Streamlit's normal dataframe-like
inputs rather than also accepting `perspective.Table` / `perspective.AsyncTable`.
That interop is reasonable future work, but it would otherwise force Streamlit to
take on the `perspective-python` dependency and lifecycle model on day one.

### Why `default_config` Instead of `config`

Perspective's browser API uses `restore()` as a full state-setting primitive, but that
maps poorly to Streamlit's rerun model if we do not also expose Python callbacks for
reading the current viewer state.

**Option 1: `config=` as a controlled prop**

- Pros: mirrors Perspective terminology; easy to understand from JS docs.
- Cons: every rerun would overwrite the user's in-browser changes unless the app
  manually round-trips config through Python, which we are not proposing for v1.

**Option 2: `default_config=`** ✅ PREFERRED

- Pros: matches the intended v1 behavior. The app author can seed a starting layout,
  and the user can keep interacting with it across reruns.
- Cons: slightly less direct than Perspective's own `restore()` API.

**Option 3: expose many top-level config parameters**

- Pros: stronger typing and discoverability.
- Cons: large API surface on day one, high maintenance cost, and duplicates
  Perspective's existing vocabulary.

### Examples

#### Simplest usage

```python
import streamlit as st
import pandas as pd

df = pd.read_parquet("sales.parquet")

st.perspective(df)
```

#### Seed an initial grouped chart

```python
st.perspective(
    df,
    key="sales-explorer",
    height=620,
    default_config={
        "plugin": "Y Line",
        "columns": ["Sales"],
        "group_by": ["Region"],
        "split_by": ["Segment"],
        "sort": [("Sales", "desc")],
    },
)
```

#### Start with the settings panel open

```python
st.perspective(
    df,
    default_config={
        "settings": True,
        "plugin": "Datagrid",
    },
)
```

### Behavior

#### Initial release scope

The initial release is intentionally narrow:

- Perspective runs **client-side** in the browser via WebAssembly.
- Streamlit sends the current dataset snapshot via its existing protobuf + Arrow path.
- The bundled plugins are:
  - Datagrid
  - D3FC chart plugins
- The element is **read-only from Python's perspective**. Users can interact in the
  browser, but those edits and selections are not surfaced back to Python in v1.

This intentionally diverges from Perspective's Jupyter widget default, which is
server-backed. For Streamlit, client-only mode is the smallest release that still
delivers the core interactive analysis value.

#### State persistence

- If `key` is provided, Streamlit preserves the user's Perspective layout across
  reruns as long as the dataset schema remains compatible.
- `default_config` seeds the initial viewer state. After the user changes the view,
  reruns should preserve the interactive state rather than reapplying `default_config`
  on every script execution.
- Changing `key` resets the viewer to `default_config`.
- If the schema changes incompatibly, Streamlit resets the viewer and reapplies
  `default_config`.

#### Data refresh behavior

- Each rerun sends the current full snapshot of the table.
- On the frontend, same-schema updates replace the existing browser-local table
  contents while preserving viewer configuration when possible.
- This is sufficient for many real-world apps, but it is **not** the same as
  Perspective's replicated or server-only transport modes. Incremental update
  streams are future work.
- Because v1 still ships the full dataset snapshot to the browser, it should not be
  positioned as the answer for unbounded streams or datasets that are too large to
  fit comfortably in browser memory.

#### Theme behavior

- `theme="streamlit"` maps Streamlit's theme tokens into a Perspective-compatible
  theme so the element feels native inside Streamlit.
- Other theme names may be supported if their CSS is bundled with Streamlit.

### Out of Scope (Initial Release)

- Perspective server-backed modes:
  - client/server replicated
  - server-only
- A dedicated Perspective WebSocket channel
- Direct `perspective-python` object interop such as accepting
  `perspective.Table` / `perspective.AsyncTable` as a public `data=` type
- Python callbacks for:
  - config changes
  - click events
  - selection events
  - If Streamlit adds these later, they should align with existing chart/widget
    conventions such as `on_select="ignore" | "rerun" | callback`, rather than
    exposing raw Perspective DOM events directly.
- Editing that round-trips user changes back into Python data structures
- Virtual servers such as DuckDB, ClickHouse, or Polars-backed Perspective servers
- Bundling every optional Perspective plugin, such as OpenLayers
- Built-in title/header chrome, fullscreen mode, and other Streamlit-specific
  controls beyond standard element layout. Users can compose those around the
  element with existing Streamlit primitives.

## Checklist

| Item                         | ✅ or comment                                                                 |
|------------------------------|-------------------------------------------------------------------------------|
| Works on SiS, Cloud, etc?    | ✅ Yes for the initial client-side design; it uses the standard Streamlit runtime and transport. |
| No breaking API changes      | ✅ New command only.                                                          |
| No new dependencies          | No. Adds frontend JS/WASM dependencies for Perspective packages.              |
| Metrics collected            | ✅ Reuse normal Streamlit command metrics for the new element.                |
| Any security/legal impact?   | Needs dependency/license review and CSP review for bundled JS/WASM assets.    |
| Any docs changes needed?     | ✅ API docs, examples, theming notes, and migration guidance vs custom components. |
