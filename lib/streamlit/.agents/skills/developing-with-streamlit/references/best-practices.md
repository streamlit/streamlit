# Streamlit best practices

Opinionated examples for writing clean, performant, and maintainable Streamlit apps.

Use this reference when reviewing an app, starting a new app, or applying the quick-reference rules from `SKILL.md`.

## Styling and copy

Do not use custom CSS for app styling unless the user actively requests it. Prefer native Streamlit APIs and `.streamlit/config.toml` to customize the appearance.

```python
# BAD: Styling the app with injected CSS
st.markdown(
    "<style>.stButton button { background: #ff4b4b; }</style>",
    unsafe_allow_html=True,
)
```

```toml
# GOOD: Configure theme tokens in .streamlit/config.toml
[theme]
primaryColor = "#ff4b4b"
backgroundColor = "#ffffff"
secondaryBackgroundColor = "#f6f8fa"
textColor = "#262730"
```

Prefer Material Symbols icons over emojis in UI labels, and use sentence casing.

```python
# BAD: Title casing and emoji-heavy UI
st.button("Sales Reports 📊")
st.button("Refresh Data 🔄")

# GOOD: Sentence casing and Material Symbols
st.button("Sales reports", icon=":material/bar_chart:")
st.button("Refresh data", icon=":material/refresh:")
```

Do not use empty widget labels. Hide labels when the surrounding UI already provides context.

```python
# BAD: Empty label hurts accessibility
query = st.text_input("", placeholder="Search")

# GOOD: Accessible label, visually collapsed
query = st.text_input(
    "Search",
    placeholder="Search",
    label_visibility="collapsed",
)
```

## HTML and iframes

Prefer native Streamlit elements over recreating UI with custom HTML. This includes UI created with `st.html`, `st.markdown(..., unsafe_allow_html=True)`, or `st.components.v1.html`. Use custom HTML only when no native element provides the required UI or behavior.

Do not use the deprecated `st.components.v1.html` or `st.components.v1.iframe` commands.

- Use `st.iframe` for URLs or HTML that should render inside an iframe. It is the iframe-based replacement for either legacy command.
- Use `st.html` for static HTML or CSS that should render directly in the app instead of inside an iframe. JavaScript is ignored by default; only enable it with `unsafe_allow_javascript=True` when necessary, and never enable it for untrusted content.

## Layout

Use `width` instead of deprecated `use_container_width`.

```python
# BAD: Deprecated
st.dataframe(df, use_container_width=True)

# GOOD: Default is stretch; set content width only when needed
st.dataframe(df)
st.dataframe(df, width="content")
```

Prefer horizontal containers for responsive rows, and reserve columns for fixed grids or specific width ratios.

```python
# BAD: Columns for a simple button row
left, right = st.columns(2)
left.button("Cancel")
right.button("Save", type="primary")

# GOOD: Responsive horizontal row
with st.container(horizontal=True, horizontal_alignment="right"):
    st.button("Cancel")
    st.button("Save", type="primary")
```

Use bordered containers for visual grouping.

```python
with st.container(border=True):
    st.metric("Revenue", "$1.2M", delta="8%")
    st.caption("Last 30 days")
```

## Navigation and pages

Use `st.navigation` with an `app_pages/` directory. Avoid the legacy `pages/` auto-discovery pattern and app-body navigation built from `st.page_link`.

```python
# GOOD: streamlit_app.py
import streamlit as st

page = st.navigation(
    [
        st.Page("app_pages/home.py", title="Home", icon=":material/home:"),
        st.Page("app_pages/sales.py", title="Sales", icon=":material/analytics:"),
    ]
)

page.run()
```

Keep page files as direct scripts. Do not wrap the page body in a render function.

```python
# BAD: app_pages/sales.py
def render_page():
    st.title("Sales")
    st.line_chart(load_sales())

render_page()
```

```python
# GOOD: app_pages/sales.py
import streamlit as st

from utils.data import load_sales

st.title("Sales")
st.line_chart(load_sales())
```

## Performance

Cache expensive work at the right granularity. Cache source data or expensive computation, then apply cheap interactive filters outside the cached function.

```python
# BAD: Unbounded cache with one entry per filter value
@st.cache_data
def load_filtered_orders(region: str) -> pd.DataFrame:
    orders = fetch_orders()
    return orders[orders["region"] == region]


region = st.selectbox("Region", regions)
orders = load_filtered_orders(region)
```

```python
# GOOD: Cache the expensive source load with a practical bound
@st.cache_data(ttl="15m", max_entries=20)
def load_orders() -> pd.DataFrame:
    return fetch_orders()


region = st.selectbox("Region", regions)
orders = load_orders()
filtered_orders = orders[orders["region"] == region]
```

Use `st.cache_resource` for shared resources, and do not wrap `st.connection`.

```python
# GOOD: Shared model or client
@st.cache_resource
def load_model():
    return SentenceTransformer("all-MiniLM-L6-v2")
```

Render stable layout before slow calls. Streamlit emits UI updates top to bottom during each rerun, so slow code before downstream elements leaves faded stale content from the previous run on screen while it runs. Render fast UI first, reserve the slow result's position with `st.container()`, then fill that slot once the work completes — wrap the slow work in `with container.skeleton():` to show a loading placeholder, and write results explicitly to the container (e.g. `container.dataframe(...)`), since the block doesn't redirect bare `st.*` calls into it. Avoid standalone `st.empty()`/`st.skeleton()` placeholders that you fill after slow work: the delay unmounts the old element and resets stateful widgets (e.g. a dataframe's scroll, sort, and selection), whereas a reserved container keeps it mounted at a stable position. Give stateful elements a stable `key`.

```python
# BAD: The whole page is stuck behind a slow load and greys out
orders = load_orders()  # ~5s
st.title("Orders")
region = st.selectbox("Region", regions)
st.dataframe(orders)

# GOOD: Title and filter paint immediately; a container reserves the table's slot and
# shows a skeleton while it loads, so the table keeps its state at a stable position.
st.title("Orders")
region = st.selectbox("Region", regions)
table_slot = st.container()  # Reserve the table's position up front
with table_slot.skeleton():
    orders = load_orders()
    table_slot.dataframe(orders, key="orders")  # Write into the reserved slot
```

See `performance.md` for the rendering-order details and a fuller placeholder example.

Use fragments for independent sections that can rerun separately from the page.

```python
@st.fragment(run_every="30s")
def live_metrics():
    st.metric("Active users", get_active_user_count())


live_metrics()
```

Use forms to batch related inputs when intermediate changes would trigger expensive work.

```python
# BAD: Search runs after each widget update
query = st.text_input("Search")
category = st.selectbox("Category", categories)
results = search(query, category)

# GOOD: Search runs only when the user submits
with st.form("search", border=False):
    query = st.text_input("Search")
    category = st.selectbox("Category", categories)
    submitted = st.form_submit_button("Search", icon=":material/search:")

if submitted:
    results = search(query, category)
```

Do not put expensive work unguarded inside tabs or expanders. Hidden tab content and collapsed expander content still compute unless you opt into dynamic state and guard the work.

```python
# BAD: Heavy content runs even when the tab is hidden
overview, details = st.tabs(["Overview", "Details"])
with details:
    render_expensive_details()

# GOOD: Heavy content only runs when the tab is selected
overview, details = st.tabs(["Overview", "Details"], on_change="rerun")
if details.open:
    with details:
        render_expensive_details()
```

```python
# GOOD: Heavy expander content only runs when opened
details = st.expander("Advanced diagnostics", on_change="rerun")
if details.open:
    with details:
        run_diagnostics()
```

## Data and charts

Prefer Vega-based charts over pyplot and Plotly.

```python
# GOOD: Native charts for common cases
st.line_chart(df, x="date", y="revenue")
st.bar_chart(df, x="category", y="orders")
st.scatter_chart(df, x="revenue", y="margin", color="segment")

# GOOD: Altair for complex charts
chart = alt.Chart(df).mark_line().encode(
    x=alt.X("date:T", title="Date"),
    y=alt.Y("revenue:Q", title="Revenue"),
    color="region:N",
)
st.altair_chart(chart)
```

Keep sensitive data out of frontend payloads. Hiding a dataframe column only hides it visually; pre-filter sensitive columns before display.

```python
# BAD: Secret column is still sent to the browser
st.dataframe(df, column_config={"api_token": None})

# GOOD: Remove sensitive data before display
safe_df = df.drop(columns=["api_token"])
st.dataframe(safe_df)
```

## Widgets and state

Prefer modern selection widgets for compact choices.

```python
# BAD: Horizontal radio for a compact mode switch
view = st.radio("View", ["Summary", "Details"], horizontal=True)

# GOOD: Segmented control for single selection
view = st.segmented_control("View", ["Summary", "Details"])

# GOOD: Pills for a few multi-select options
tags = st.pills(
    "Tags",
    ["New", "Active", "At risk"],
    selection_mode="multi",
)
```

Initialize session state in one clear place and avoid module-level mutable state for per-user data.

```python
# BAD: Shared across users when imported
filters = {}

# GOOD: Per-user state
st.session_state.setdefault("filters", {})
st.session_state.setdefault("selected_account", None)
```

Use widget keys when widgets repeat, parameters change dynamically, or code needs programmatic access.

```python
# BAD: Changing category changes widget identity and can reset input
query = st.text_input(f"Search {category}")

# GOOD: Stable widget identity and session-state access
query = st.text_input(f"Search {category}", key="search_query")
```

## Secrets and queries

Store credentials in `st.secrets`, keep `.streamlit/secrets.toml` out of git, and use parameterized queries for user-provided values.

```python
# BAD: Hard-coded secret and SQL string interpolation
api_key = "my-hardcoded-api-key"
df = conn.query(f"SELECT * FROM orders WHERE region = '{region}'")
```

```python
# GOOD: Secret from st.secrets and parameter binding
api_key = st.secrets["openai_api_key"]
df = conn.query(
    "SELECT * FROM orders WHERE region = :region",
    params={"region": region},
)
```

```gitignore
# GOOD: Keep local secrets out of source control
.streamlit/secrets.toml
```
