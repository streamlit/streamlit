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
| Chart types     | 9 core types               | 40+ types                  | Grammar-based (unlimited)  |
| Python library  | None required              | `plotly` required          | `altair` required          |
| Selection API   | None (future work)         | Points, box, lasso         | Named parameters           |

## Proposal

### API

```python
st.chartjs_chart(
    spec: dict[str, Any],
    *,
    width: Width = "stretch",
    height: Height = "content",
    theme: Literal["streamlit"] | None = "streamlit",
) -> DeltaGenerator
```

### Parameters

| Parameter | Type                                              | Default       | Description                                                                                                  |
| --------- | ------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------ |
| `spec`    | `dict[str, Any]`                                  | required      | Chart.js configuration object containing `type`, `data`, and `options`. See Chart.js documentation.          |
| `width`   | `"stretch" \| "content" \| int`                   | `"stretch"`   | Element width. `"stretch"`: full container. `"content"`: fit content. `int`: fixed pixels.                   |
| `height`  | `"content" \| "stretch" \| int`                   | `"content"`   | Element height. `"content"`: fit content. `"stretch"`: fill container. `int`: fixed pixels.                  |
| `theme`   | `Literal["streamlit"] \| None`                    | `"streamlit"` | Theme for the chart. `"streamlit"`: use Streamlit theme colors. `None`: use Chart.js defaults.               |

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

Supported chart types (from Chart.js 4.x):

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

Theme colors can be customized via `.streamlit/config.toml`:

```toml
[theme]
primaryColor = "#FF4B4B"
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

- **Invalid spec**: Raises `StreamlitAPIException` with Chart.js error message
- **Unknown chart type**: Raises `StreamlitAPIException` listing valid types
- **Empty data**: Displays empty chart with axes (consistent with Chart.js behavior)
- **Missing labels**: Chart.js uses indices as labels
- **Very large datasets**: Consider using `options.plugins.decimation` for performance

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
| No new dependencies        | ✅ Chart.js bundled in frontend, no Python dep required                      |
| Metrics collected          | ✅ `chartjs_chart` metric                                                    |
| Any security/legal impact? | ⚠️ Chart.js is MIT licensed, must be bundled properly                       |
| Any docs changes needed?   | ✅ New API reference page, consider gallery examples                         |
