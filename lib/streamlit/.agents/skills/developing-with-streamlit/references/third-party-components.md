
# Streamlit custom components

Extend Streamlit with third-party custom components from the community.

## What are custom components?

Custom components are standalone Python libraries that add features not in Streamlit's core API. They're built by the community and can be installed like any Python package.

## Installation

Install using the PyPI package name (not the repo name—they can differ):

```bash
uv add <pypi-package-name>
```

Then import according to the component's documentation. The import name often differs from the package name too.

## Use with caution

Components are not maintained by Streamlit. Before adopting:

- **Check maintenance** - Is it actively maintained? Recent commits?
- **Check compatibility** - Does it work with your Streamlit version?
- **Check popularity** - GitHub stars, downloads, community usage
- **Consider alternatives** - Can you achieve this with core Streamlit?

Custom components can break when Streamlit updates, so prefer core features when possible.

## Popular custom components

### streamlit-keyup

Text input that fires on every keystroke instead of waiting for enter/blur. Useful for live search.

- **Repo:** https://github.com/blackary/streamlit-keyup
- **Docs:** https://pypi.org/project/streamlit-keyup/

```bash
uv add streamlit-keyup
```

```python
from st_keyup import st_keyup

query = st_keyup("Search", debounce=300)  # 300ms debounce
filtered = df[df["name"].str.contains(query, case=False)]
st.dataframe(filtered)
```

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

### streamlit-aggrid

Interactive dataframes with sorting, filtering, cell editing, grouping, and pivoting. Use when you need customization beyond what `st.dataframe` and `st.data_editor` offer.

- **Repo:** https://github.com/PablocFonseca/streamlit-aggrid
- **Docs:** https://pypi.org/project/streamlit-aggrid/

```bash
uv add streamlit-aggrid
```

```python
from st_aggrid import AgGrid

AgGrid(df, editable=True, filter=True)
```

**When to use aggrid over st.dataframe:**
- Interactive row grouping and pivoting
- Advanced filtering and sorting UI
- Complex cell editing workflows
- Custom cell renderers

### streamlit-folium

Interactive maps powered by Folium.

- **Repo:** https://github.com/randyzwitch/streamlit-folium
- **Docs:** https://folium.streamlit.app/

```bash
uv add streamlit-folium
```

```python
import folium
from streamlit_folium import st_folium

m = folium.Map(location=[37.7749, -122.4194], zoom_start=12)
st_folium(m, width=700)
```

### pygwalker

Tableau-like drag-and-drop data exploration.

- **Repo:** https://github.com/Kanaries/pygwalker
- **Docs:** https://docs.kanaries.net/pygwalker

```bash
uv add pygwalker
```

```python
import pygwalker as pyg

pyg.walk(df, env="Streamlit")
```

### streamlit-extras

A collection of community utilities. Cherry-pick what you need.

- **Repo:** https://github.com/arnaudmiribel/streamlit-extras
- **Docs:** https://extras.streamlit.app/

```bash
uv add streamlit-extras
```

```python
from streamlit_extras.image_selector import image_selector

# Let users click on regions of an image
selection = image_selector(image, selections=["Region A", "Region B"])
```

```python
from streamlit_extras.vertical_slider import vertical_slider

# A vertical slider widget
value = vertical_slider("Volume", min_value=0, max_value=100, default_value=50)
```

## Discover more

Browse the custom component gallery: https://streamlit.io/components

Filter by category, popularity, and recency to find custom components for your use case.

## References

- [Components Gallery](https://streamlit.io/components)
- [Build a custom component](https://docs.streamlit.io/develop/concepts/custom-components)
