---
author: lukasmasuch
created: 2026-04-14
---

# Chart.js chart element

## Summary

Add a new `st.chartjs_chart` element to display charts using the
[Chart.js](https://www.chartjs.org/) library. Chart.js is one of the most popular JavaScript
charting libraries, known for its simplicity, lightweight footprint (~60KB gzipped), and
beautiful out-of-the-box charts with smooth animations.

## Problem

Streamlit currently supports charting via Altair/Vega-Lite (built-in charts, `st.altair_chart`,
`st.vega_lite_chart`), Plotly (`st.plotly_chart`), and other libraries. However, many developers
prefer Chart.js for its simplicity, performance, and familiar JSON-based configuration.

**Use cases:**

- Developers familiar with Chart.js who want to use their existing configurations
- Applications requiring lightweight charts with minimal JavaScript overhead
- Teams with existing Chart.js chart definitions they want to reuse
- Simple, animated charts without the complexity of Vega-Lite grammar

**Comparison with existing chart commands:**

| Aspect          | `st.chartjs_chart`         | `st.plotly_chart`          | `st.altair_chart`          |
| --------------- | -------------------------- | -------------------------- | -------------------------- |
| Library size    | ~60KB gzipped              | ~1MB+ gzipped              | ~400KB gzipped             |
| Configuration   | JSON config dict           | Python Figure object       | Altair Chart object        |
| Animation       | Built-in, smooth           | Limited                    | Limited                    |
| Chart types     | 8 core types               | 40+ types                  | Grammar-based (unlimited)  |
| Python library  | None required              | `plotly` required          | `altair` required          |
| Selection API   | None (future work)         | Points, box, lasso         | Named parameters           |

## Proposal

### API

```python
st.chartjs_chart(
    spec: dict[str, Any],
    *,
    width: Width = "stretch",
    height: Height = 400,
    theme: Literal["streamlit"] | None = "streamlit",
    key: Key | None = None,
) -> DeltaGenerator
```

### Parameters

| Parameter | Type                                              | Default       | Description                                                                                                  |
| --------- | ------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------ |
| `spec`    | `dict[str, Any]`                                  | required      | Chart.js configuration object containing `type` and `data` (required), and optionally `options`. Only JSON-serializable values are supported (JavaScript callbacks are not). See Chart.js documentation. |
| `width`   | `"stretch" \| "content" \| int`                   | `"stretch"`   | Element width. `"stretch"`: full container. `"content"`: fit content. `int`: fixed pixels.                   |
| `height`  | `"content" \| "stretch" \| int`                   | `400`         | Element height. `int`: fixed pixels. `"stretch"`: fill container. `"content"`: delegates to Chart.js aspect ratio logic (width / 2 by default). |
| `theme`   | `Literal["streamlit"] \| None`                    | `"streamlit"` | Theme for the chart. `"streamlit"`: use Streamlit theme colors. `None`: use Chart.js defaults.               |
| `key`     | `Key \| None`                                     | `None`        | Unique key for element identification. Useful for testing and required if interactivity is added later.      |

### Return Value

Returns `DeltaGenerator` for method chaining (consistent with other display elements).

### Chart.js Configuration Spec

The `spec` parameter accepts a standard Chart.js configuration object:

```python
spec = {
    "type": "bar",  # Chart type: bar, line, pie, doughnut, radar, polarArea, bubble, scatter
    "data": {
        "labels": ["Red", "Blue", "Yellow"],
        "datasets": [{
            "label": "My Dataset",
            "data": [12, 19, 3],
            "backgroundColor": ["#ff6384", "#36a2eb", "#ffce56"]
        }]
    },
    "options": {
        "responsive": True,
        "plugins": {
            "legend": {"display": True},
            "title": {"display": True, "text": "My Chart"}
        }
    }
}
```

Supported chart types (Chart.js 4.4.x):

- `bar` — Vertical or horizontal bar charts
- `line` — Line charts with optional area fill
- `pie` — Pie charts
- `doughnut` — Doughnut charts
- `radar` — Radar/spider charts
- `polarArea` — Polar area charts
- `bubble` — Bubble charts (x, y, r)
- `scatter` — Scatter plots

### Streamlit Theme Integration

When `theme="streamlit"`, the chart inherits Streamlit's theme colors:

- **Colors**: Uses `theme.primaryColor` and `theme.chartCategoricalColors` for datasets
- **Fonts**: Uses Streamlit's default font family
- **Background**: Transparent to match Streamlit containers
- **Grid lines**: Styled to match Streamlit's visual language

**Note on `chartCategoricalColors`:** This is a **new config key** introduced alongside `st.chartjs_chart`. It provides a categorical color palette for multi-dataset charts. If not specified, a default palette derived from `primaryColor` is used. This config key may also be used by future charting elements.

Theme colors can be customized via `.streamlit/config.toml`:

```toml
[theme]
primaryColor = "#FF4B4B"
# New config key (introduced with st.chartjs_chart)
chartCategoricalColors = ["#FF4B4B", "#1C83E1", "#00C4B4", "#FA8C16", "#9254DE"]
```

### Examples

**Example 1: Basic bar chart**

```python
import streamlit as st

spec = {
    "type": "bar",
    "data": {
        "labels": ["January", "February", "March", "April", "May"],
        "datasets": [{
            "label": "Sales",
            "data": [65, 59, 80, 81, 56]
        }]
    }
}

st.chartjs_chart(spec)
```

**Example 2: Multi-dataset line chart**

```python
import streamlit as st

spec = {
    "type": "line",
    "data": {
        "labels": ["Q1", "Q2", "Q3", "Q4"],
        "datasets": [
            {"label": "2024", "data": [10, 20, 15, 25]},
            {"label": "2025", "data": [15, 25, 20, 30]}
        ]
    },
    "options": {
        "plugins": {
            "title": {"display": True, "text": "Quarterly Revenue"}
        }
    }
}

st.chartjs_chart(spec)
```

**Example 3: Pie chart with data from DataFrame**

```python
import streamlit as st
import pandas as pd

df = pd.DataFrame({
    "category": ["A", "B", "C", "D"],
    "value": [30, 25, 20, 25]
})

spec = {
    "type": "pie",
    "data": {
        "labels": df["category"].tolist(),
        "datasets": [{
            "data": df["value"].tolist()
        }]
    }
}

st.chartjs_chart(spec)
```

**Example 4: Radar chart**

```python
import streamlit as st

spec = {
    "type": "radar",
    "data": {
        "labels": ["Speed", "Reliability", "Comfort", "Safety", "Efficiency"],
        "datasets": [
            {"label": "Car A", "data": [65, 59, 90, 81, 56]},
            {"label": "Car B", "data": [28, 48, 40, 19, 96]}
        ]
    }
}

st.chartjs_chart(spec)
```

### Behavior

- **Responsive by default**: Charts resize to fit the container (controlled by `width`/`height`)
- **Animations enabled**: Chart.js default animations are preserved unless disabled in `options`
- **Canvas rendering**: Uses HTML5 Canvas (not SVG like Vega-Lite) for better performance with
  large datasets
- **No Python dependency**: Unlike Plotly/Altair, no additional Python package is required

### Edge Cases

**Python-side validation (raises `StreamlitAPIException`):**
- **Unknown chart type**: Python validates `type` against a hardcoded allowlist (`bar`, `line`, `pie`, `doughnut`, `radar`, `polarArea`, `bubble`, `scatter`). Invalid types raise `StreamlitAPIException` before sending to frontend.
- **Missing required keys**: If `spec` is missing `type` or `data`, raises `StreamlitAPIException`.

**Frontend error display (inline error in UI):**
- **Invalid spec structure**: Malformed dataset configurations or invalid Chart.js options are caught in the frontend and displayed as an inline error message. These cannot be surfaced as Python exceptions since Chart.js runs entirely in the browser.
- **JavaScript callback values**: If the spec contains function/callback values (e.g., `onClick`, `onHover`, tooltip callbacks), they are stripped/ignored since only JSON-serializable values can be transmitted to the frontend.

**Normal behavior:**
- **Empty data**: Displays an empty chart (with axes when applicable, consistent with Chart.js behavior for the specific chart type).
- **Missing labels**: Chart.js uses indices as labels.
- **Very large datasets**: Consider using `options.plugins.decimation` for performance.

## Selections: Analysis

### Chart.js Click Events vs. True Selections

Unlike Plotly and Vega-Lite, Chart.js does not have a native "selection" concept with built-in
visual feedback (highlighting, multi-select, box/lasso selection). Chart.js provides:

1. **Click events** via `onClick` callback — identifies which element was clicked
2. **Hover events** via `onHover` callback — identifies hovered elements

These return element metadata (`datasetIndex`, `index`) but don't maintain selection state or
provide visual selection feedback automatically.

### Options for Future Implementation

**Option 1: Click events**

Expose click events via `on_click` parameter. Single-click returns the clicked element's data.
No persistent selection state, no multi-select, no visual highlight.

- Pros: Simple, matches Chart.js capabilities, clear semantics
- Cons: Less powerful than Plotly/Altair selections

**Option 2: Managed selection state**

Build selection state on top of click events: maintain a list of selected indices, render
visual highlighting via dataset styling, support multi-select with shift-click.

- Pros: Feature parity with other charts
- Cons: Complex implementation, diverges from Chart.js behavior, requires custom highlighting
  logic per chart type

**Option 3: Full selection modes**

Implement box/lasso selection via custom canvas interaction layer, similar to Plotly.

- Pros: Full feature parity
- Cons: Significant engineering effort, potential performance impact, not native to Chart.js

### Recommendation

**Defer interactivity to a future release.** The initial implementation focuses on displaying
Chart.js charts. If user demand warrants it, Option 1 (click events) would be the recommended
first step for adding interactivity, as it aligns with Chart.js's native capabilities.

Users needing selection features today should use `st.plotly_chart` or `st.altair_chart`.

## Design Consideration: DataFrame Support

### Current Approach (Spec-Only)

The initial API accepts only a Chart.js spec dict. Users convert their data manually:

```python
df = pd.DataFrame({"category": ["A", "B", "C"], "value": [10, 20, 30]})

spec = {
    "type": "bar",
    "data": {
        "labels": df["category"].tolist(),
        "datasets": [{"label": "Values", "data": df["value"].tolist()}]
    }
}
st.chartjs_chart(spec)
```

**Pros:**
- Simple, predictable implementation
- Full control over Chart.js configuration
- Aligns with how Chart.js works natively (JSON config)
- No ambiguity about how data maps to chart elements

**Cons:**
- More verbose for simple cases
- Users must understand Chart.js data structure
- Less "Streamlit-like" compared to `st.line_chart(df)`

### Alternative: Add `data` Parameter

Streamlit's `dataframe_util.py` provides conversion utilities supporting many data types:
DataFrame, Series, numpy arrays, dicts, lists, Polars, PyArrow, etc. A future enhancement
could add a `data` parameter:

```python
st.chartjs_chart(
    spec: dict[str, Any],
    data: Data | None = None,  # DataFrame, array, dict, etc.
    *,
    x: str | None = None,      # Column for labels
    y: str | Sequence[str] | None = None,  # Column(s) for datasets
    ...
)
```

**Example with data parameter:**
```python
df = pd.DataFrame({"category": ["A", "B", "C"], "value": [10, 20, 30]})
st.chartjs_chart({"type": "bar"}, data=df, x="category", y="value")
```

**Considerations:**
- Chart.js has diverse data shapes per chart type (e.g., bubble charts need `{x, y, r}` objects,
  scatter needs `{x, y}`, bar/line need arrays)
- Mapping conventions would need to handle: labels vs x-axis, multiple y columns as datasets,
  color/size columns for bubble charts, etc.
- Risk of API complexity similar to `st.altair_chart` vs simpler `st.line_chart`

### Recommendation

**Start with spec-only for simplicity.** The spec-dict approach is explicit and covers all
Chart.js features without ambiguity. DataFrame support can be added later if user feedback
indicates demand, potentially as a separate convenience function (e.g., `st.chartjs`) similar
to `st.line_chart` vs `st.altair_chart`.

## Out of Scope (Future Work)

- **DataFrame/data parameter**: Automatic conversion from DataFrame/arrays to Chart.js format
  (see design consideration above)
- **Click events**: Exposing `onClick` callbacks via `on_click` parameter (see analysis above)
- **Hover events**: Exposing `onHover` callbacks
- **Multi-select mode**: Selecting multiple data points with visual highlighting
- **Box/lasso selection**: Drawing selection regions on the chart
- **Plugin system**: Custom Chart.js plugins (would require executing user JavaScript)
- **Mixed chart types**: Charts with multiple types (e.g., bar + line) — supported in spec but
  not explicitly documented/tested
- **Streaming data**: Real-time chart updates via `add_rows` pattern

## Checklist

| Item                       | ✅ or comment                                                                 |
| -------------------------- | ---------------------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ✅ Client-side JS only                                                       |
| No breaking API changes    | ✅ New command                                                               |
| No new Python dependencies | ✅ No Python package required                                                |
| New frontend dependency    | ⚠️ Chart.js (~60KB gzipped) bundled in frontend, MIT licensed               |
| Metrics collected          | ✅ `chartjs_chart` metric                                                    |
| Any security/legal impact? | ⚠️ Chart.js is MIT licensed, must be bundled properly                       |
| Any docs changes needed?   | ✅ New API reference page, consider gallery examples                         |
