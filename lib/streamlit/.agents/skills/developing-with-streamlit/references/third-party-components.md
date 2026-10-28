# Streamlit custom components

Third-party custom components are community Python libraries that add UI Streamlit does not ship.

## Prefer a native equivalent

Components are not maintained by Streamlit. They can break on Streamlit upgrades and often miss theming, accessibility, and performance work that ships in core. Do not add one, and do not build a custom component, to recreate a native command.

| Instead of | Use |
| --- | --- |
| `streamlit-autorefresh` (`st_autorefresh`) | `@st.fragment(run_every=...)` on the section that should refresh. That reruns only the fragment, not the whole app. Do not loop the script. |
| `streamlit-aggrid` | `st.dataframe` or `st.data_editor` with `column_config` for sorting, search, editing, and formatting. See [data-display.md](data-display.md). |
| `streamlit-folium` (`st_folium`) | `st.map` for latitude/longitude points, or `st.pydeck_chart` for deck.gl maps. |
| `streamlit-option-menu` | `st.navigation` when the menu switches app sections; `st.segmented_control` when it switches views within one page. |
| `extra-streamlit-components` (`CookieManager`) | `st.context.cookies` to read the initial request. `st.App` middleware can set a cookie on an HTTP response, not after a widget interaction. See [server-asgi.md](server-asgi.md). |
| `streamlit-searchbox` | `st.selectbox` (it filters a known list as you type) to pick one option; `st.text_input(..., type="search", live=True)` to filter results rendered below it. Put the text input in a `@st.fragment` when the rest of the page should stay put. |
| `streamlit-echarts` | `st.echarts_chart` for a JSON-compatible option, JSON string, or `pyecharts` chart. Prefer a Vega-based chart unless the spec is already ECharts. See [data-display.md](data-display.md). |
| `streamlit-keyup` (`st_keyup`) | `st.text_input(..., live=True)`, inside a `@st.fragment` when the rest of the page should stay put. |

Use the package only when the native command does not cover the behavior:

- **Whole-page refresh** — `@st.fragment(run_every=...)` reruns only that fragment. Keep `streamlit-autorefresh` when the whole page must rerun on a timer. Do not call `st.rerun()` unconditionally inside that fragment: its body also runs on the initial full-app run, so the call reruns the app continuously.
- **AgGrid** — per-column filter menus, row grouping, pivoting, or custom cell renderers that `column_config` cannot express. `st.dataframe` search highlights matching cells and does not hide other rows. Filter in Python with separate widgets when that is enough.
- **Folium** — a Folium map or Leaflet behavior that `st.map` and `st.pydeck_chart` do not provide.
- **Cookies** — `st.context.cookies` is read-only and reflects the initial request. `st.App` middleware can set cookies on HTTP responses, not in response to in-app actions. Use a cookie component only when the script must set a cookie after the page loads; for sign-in, prefer `st.login`.
- **Search suggestions** — a dropdown of suggestions computed in Python as the user types (`streamlit-searchbox`). `st.text_input` returns the typed text and has no suggestion list.
- **ECharts** — JavaScript callbacks (`JsCode`, `formatter` functions, `custom` series), GeoJSON map registration, or ECharts GL / 3D charts. `st.echarts_chart` accepts JSON-compatible options only. See [data-display.md](data-display.md).

## Installation

Install using the PyPI package name (not the repo name—they can differ):

```bash
uv add <pypi-package-name>
```

Then import according to the component's documentation. The import name often differs from the package name too.

## Before adopting a component

- **Check maintenance** — recent commits and a current release
- **Check compatibility** — it works with the app's Streamlit version
- **Check popularity** — downloads and community usage
- **Confirm the gap** — no native command in the mapping above covers the behavior

## Components with no native equivalent

### streamlit-bokeh

Official replacement for `st.bokeh_chart` (removed from Streamlit API). Maintained by Streamlit.

- **Repo:** https://github.com/streamlit/streamlit-bokeh
- **Docs:** https://pypi.org/project/streamlit-bokeh/

```bash
uv add streamlit-bokeh
```

```python
from bokeh.plotting import figure
from streamlit_bokeh import streamlit_bokeh

p = figure(title="Simple Line", x_axis_label="x", y_axis_label="y")
p.line([1, 2, 3, 4, 5], [6, 7, 2, 4, 5], line_width=2)
streamlit_bokeh(p)
```

### streamlit-pivot-table

Interactive pivot tables with drag-and-drop dimensions, aggregation, and drill-down. Maintained by Streamlit.

- **Repo:** https://github.com/streamlit/streamlit-pivot-table
- **Docs:** https://pypi.org/project/streamlit-pivot/

```bash
uv add streamlit-pivot
```

```python
import pandas as pd
from streamlit_pivot import st_pivot_table

df = pd.read_csv("sales.csv")
result = st_pivot_table(
    df,
    key="my_pivot",
    rows=["Region"],
    columns=["Year"],
    values=["Revenue"],
    aggregation={"Revenue": "sum"},
    show_totals=True,
)
```

### streamlit-extras

A collection of community utilities. Cherry-pick what you need.

- **Repo:** https://github.com/arnaudmiribel/streamlit-extras
- **Docs:** https://extras.streamlit.app/

```bash
uv add streamlit-extras
```

For pagination, use the native `st.pagination` widget instead of `streamlit_extras.pagination`.

```python
from annotated_text import annotated_text

annotated_text(
    "This ",
    ("is", "verb", "#8ef"),
    " some ",
    ("annotated", "adj", "#faa"),
    ("text", "noun", "#afa"),
)
```

## When native is not enough

### streamlit-aggrid

Per-column filter menus, row grouping, pivoting, and custom cell renderers beyond `column_config`. Sorting, search, editing, and formatting belong on `st.dataframe` and `st.data_editor`. Search highlights matching cells and does not hide other rows.

- **Repo:** https://github.com/PablocFonseca/streamlit-aggrid
- **Docs:** https://pypi.org/project/streamlit-aggrid/

```bash
uv add streamlit-aggrid
```

### streamlit-folium

Folium and Leaflet behavior that `st.map` and `st.pydeck_chart` do not provide.

- **Repo:** https://github.com/randyzwitch/streamlit-folium
- **Docs:** https://folium.streamlit.app/

```bash
uv add streamlit-folium
```

## Discover more

Browse the custom component gallery: https://streamlit.io/components

Filter by category, popularity, and recency to find custom components for your use case.

## References

- [Components Gallery](https://streamlit.io/components)
- [Build a custom component](https://docs.streamlit.io/develop/concepts/custom-components)
