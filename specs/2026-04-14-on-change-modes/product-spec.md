---
author: lukasmasuch
created: 2026-04-14
---

# `on_change="ignore"` mode for stateful widgets

## Summary

Allow users to suppress automatic reruns when widget values change by passing `on_change="ignore"`
to stateful widgets. This gives developers fine-grained control over when their app reruns,
improving performance for apps with expensive computations or complex multi-widget workflows.

## Problem

Streamlit reruns the entire script whenever a user interacts with any widget. While this model is
simple and intuitive, it creates performance issues in common scenarios:

**GitHub Issue:** [#5827](https://github.com/streamlit/streamlit/issues/5827) - 94+ upvotes

### Use Cases

1. **Heavy computation apps**: A data science app loads a large dataset and runs ML inference.
   Every slider adjustment triggers a full reload, even when the user just wants to tweak multiple
   parameters before seeing results.

   ```python
   # Current: Each slider change triggers expensive reload
   threshold = st.slider("Threshold", 0.0, 1.0, 0.5)
   min_samples = st.slider("Min samples", 1, 100, 10)
   data = load_large_dataset()  # Runs on every interaction
   results = run_inference(data, threshold, min_samples)  # Runs on every interaction
   ```

2. **Multi-step forms outside `st.form`**: Users building custom form UIs with conditional logic
   can't batch widget interactions without using `st.form`, which has its own constraints.

3. **Dashboard with many filters**: A dashboard with 10+ filter widgets becomes sluggish because
   each filter change triggers a full rerun and re-render of all charts.

4. **Long-running background tasks**: Apps running async operations (AI agents, data pipelines)
   restart when users interact with unrelated status/progress widgets.

### Current Workarounds

| Workaround       | Limitation                                                       |
| ---------------- | ---------------------------------------------------------------- |
| `st.form`        | Batches changes but constrains UI; widgets can't update independently |
| `st.fragment`    | Scopes reruns but can't prevent them entirely                    |
| `st.cache_data`  | Caches computations but script still reruns                      |

### Existing Pattern

Streamlit already supports this pattern in several elements:

```python
# These already work today
st.download_button("Download", data, on_click="ignore")  # No rerun on click
st.dataframe(df, on_select="ignore")  # No rerun on selection
st.plotly_chart(fig, on_select="ignore")  # No rerun on selection
```

The proposal extends this to all stateful widgets with `on_change` callbacks.

## Proposal

### API

Extend the `on_change` parameter type for all stateful widgets:

```python
# Current type
on_change: WidgetCallback | None = None

# Proposed type
on_change: WidgetCallback | Literal["rerun", "ignore"] | None = "rerun"
```

The default changes from `None` to `"rerun"` for clarity. `None` remains supported as an alias for
backwards compatibility.

### Parameters

| Value            | Triggers Rerun | Executes Callback | Description                          |
| ---------------- | -------------- | ----------------- | ------------------------------------ |
| `"rerun"` (default) | Yes         | No                | Trigger rerun on value change        |
| `None`           | Yes            | No                | Alias for `"rerun"` (backwards compat) |
| `"ignore"`       | No             | No                | Suppress rerun, value stored in frontend |
| `callable`       | Yes            | Yes               | Rerun and execute callback           |

### Affected Widgets

All stateful widgets with `on_change`:

- `st.slider`, `st.select_slider`
- `st.selectbox`, `st.multiselect`, `st.radio`
- `st.checkbox`, `st.toggle`
- `st.text_input`, `st.text_area`
- `st.number_input`
- `st.date_input`, `st.time_input`
- `st.file_uploader`
- `st.color_picker`
- `st.camera_input`, `st.audio_input`
- `st.data_editor`
- `st.feedback`

### Not Affected: Trigger Widgets

Trigger-based widgets (`st.button`, `st.chat_input`, `st.form_submit_button`, `st.menu_button`)
are excluded because their values only exist during the rerun. Without a rerun, the trigger value
is never received by Python code.

### Behavior

When `on_change="ignore"`:

1. User interacts with widget (e.g., moves slider)
2. Frontend updates the widget's visual state
3. Widget value is updated in **frontend state** only (no immediate flush to backend)
4. **No rerun is triggered**
5. On next rerun (e.g., triggered by a button click), the frontend sends the updated value to the
   backend, and Python code receives it

### Examples

**Example 1: Batch parameter changes**

```python
import streamlit as st

st.title("ML Model Tuner")

# Adjust parameters without triggering reruns
threshold = st.slider("Threshold", 0.0, 1.0, 0.5, on_change="ignore")
learning_rate = st.slider("Learning Rate", 0.001, 0.1, 0.01, on_change="ignore")
epochs = st.number_input(
    "Epochs", min_value=1, max_value=100, value=10, on_change="ignore"
)

# Only run expensive computation when user clicks
if st.button("Train Model"):
    with st.spinner("Training..."):
        model = train_model(threshold, learning_rate, epochs)
    st.success(f"Model trained! Accuracy: {model.accuracy:.2%}")
```

**Example 2: File upload with manual processing**

```python
import streamlit as st
import pandas as pd

# Upload without immediate processing
uploaded_file = st.file_uploader("Upload CSV", on_change="ignore")

if st.button("Process File"):
    if uploaded_file:
        df = pd.read_csv(uploaded_file)
        st.dataframe(df)
    else:
        st.warning("Please upload a file first")
```

**Example 3: Dashboard filters**

```python
import streamlit as st

st.title("Sales Dashboard")

# Filters don't trigger reruns
col1, col2, col3 = st.columns(3)
region = col1.selectbox("Region", ["All", "North", "South", "East", "West"], on_change="ignore")
year = col2.selectbox("Year", [2024, 2023, 2022], on_change="ignore")
category = col3.multiselect("Category", ["Electronics", "Clothing", "Food"], on_change="ignore")

# Apply filters button
if st.button("Apply Filters"):
    data = load_sales_data(region, year, category)
    st.line_chart(data)
```

### Reading Widget Values

When `on_change="ignore"`:

- The **frontend UI** updates immediately (user sees the new slider position, selected option, etc.)
- **Python code** still sees the **previous value** until a rerun is triggered by another means
- On the next rerun, the updated value becomes available via:
  1. **Return value**: `value = st.slider(..., on_change="ignore")`
  2. **Session state**: `st.session_state.my_key` if `key="my_key"` is provided

This is the expected behavior - the feature is designed for cases where you want to batch multiple
widget changes before processing them together.

**Note:** Widget values modified with `on_change="ignore"` are held in browser memory only. If the
session ends or the page is refreshed before a rerun occurs, those changes are lost.

## Checklist

| Item                         | ✅ or comment                                             |
| ---------------------------- | --------------------------------------------------------- |
| Works on SiS, Cloud, etc?    | ✅ Requires coordinated frontend, proto, and backend changes; expected to work consistently across supported platforms |
| No breaking API changes      | ✅ No breaking runtime changes; minor type signature evolution (`None` → `"rerun"` default) |
| No new dependencies          | ✅                                        |
| Metrics collected            | ✅ Existing widget metrics apply          |
| Any security/legal impact?   | ✅ No                                     |
| Any docs changes needed?     | ✅ Update all affected widget docstrings and API docs |
