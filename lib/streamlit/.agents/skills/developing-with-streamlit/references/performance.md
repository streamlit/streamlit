# Streamlit performance

Performance is the biggest win. Without caching and fragments, your app reruns everything on every interaction.

## Caching

### @st.cache_data for data

Use for any function that loads or computes data.

```python
# BAD: Recomputes on every rerun
def load_data(path):
    return pd.read_csv(path)

# GOOD: Cached
@st.cache_data
def load_data(path):
    return pd.read_csv(path)
```

### @st.cache_resource for connections

Use for connections, API clients, ML models—objects that can't be serialized.

```python
@st.cache_resource
def get_client():
    return OpenAI(api_key=st.secrets["openai_key"])

@st.cache_resource
def load_model():
    return torch.load("model.pt")
```

Note: `st.connection()` already handles caching internally — don't wrap it in `@st.cache_resource`.

### TTL for fresh data

```python
@st.cache_data(ttl="5m")  # 5 minutes
def get_metrics():
    return api.fetch()

@st.cache_data(ttl="1h")  # 1 hour
def load_reference_data():
    return pd.read_csv("large_reference.csv")
```

**Guidelines:**

- Real-time dashboards → `ttl="1m"` or less
- Metrics/reports → `ttl="5m"` to `ttl="15m"`
- Reference data → `ttl="1h"` or more
- Static data → No TTL

### Prevent unbounded cache growth

**Important:** Caches without `ttl` or `max_entries` can grow indefinitely and cause memory issues. For any cached function that stores changing objects (user-specific data, parameterized queries), set limits:

```python
# BAD: Unbounded cache - memory will grow indefinitely
@st.cache_data
def get_user_data(user_id):
    return fetch_user(user_id)

# GOOD: Bounded cache with TTL
@st.cache_data(ttl="1h")
def get_user_data(user_id):
    return fetch_user(user_id)

# GOOD: Bounded cache with max entries
@st.cache_data(max_entries=100)
def get_user_data(user_id):
    return fetch_user(user_id)
```

Use `ttl` for time-based expiration OR `max_entries` for size-based limits. You usually don't need both.

## Fragments

Use `@st.fragment` to isolate reruns for self-contained UI pieces.

```python
# BAD: Full app reruns
st.metric("Users", get_count())
if st.button("Refresh"):
    st.rerun()

# GOOD: Only fragment reruns
@st.fragment
def live_metrics():
    st.metric("Users", get_count())
    st.button("Refresh")

live_metrics()
```

For auto-refreshing metrics, use `run_every`:

```python
@st.fragment(run_every="30s")
def auto_refresh_metrics():
    st.metric("Users", get_count())

auto_refresh_metrics()
```

Use for: live metrics, refresh buttons, interactive charts that don't affect global state.

### Parallel fragments

Use `parallel=True` to run independent fragments concurrently during full app reruns. Each parallel fragment is dispatched to a thread pool, so multiple slow operations overlap instead of running sequentially.

```python
# BAD: Three slow queries run sequentially (~9s total)
@st.fragment
def revenue():
    st.metric("Revenue", query_revenue())  # ~3s

@st.fragment
def users():
    st.metric("Users", query_users())  # ~3s

@st.fragment
def orders():
    st.metric("Orders", query_orders())  # ~3s

revenue()
users()
orders()

# GOOD: Three slow queries run concurrently (~3s total)
@st.fragment(parallel=True)
def revenue():
    st.metric("Revenue", query_revenue())

@st.fragment(parallel=True)
def users():
    st.metric("Users", query_users())

@st.fragment(parallel=True)
def orders():
    st.metric("Orders", query_orders())

revenue()
users()
orders()
```

**When to use `parallel=True`:**

- Independent, slow operations (DB queries, API calls, model inference)
- Multiple fragments that don't depend on each other's output

**When NOT to use:**

- Fragments that depend on each other's Session State writes

**Thread safety rules:**

- Each parallel fragment should write to its own Session State keys
- Avoid unsynchronized mutations of shared mutable objects across fragments

Note: `parallel=True` applies to full-app reruns; `run_every` triggers fragment-scoped reruns, which execute sequentially.

## Forms to batch interactions

By default, every widget interaction triggers a full rerun. Use `st.form` to batch multiple inputs and only rerun on submit.

```python
# BAD: Reruns on every keystroke and selection
name = st.text_input("Name")
email = st.text_input("Email")
role = st.selectbox("Role", ["Admin", "User"])

# GOOD: Single rerun when user clicks Submit
with st.form("user_form"):
    name = st.text_input("Name")
    email = st.text_input("Email")
    role = st.selectbox("Role", ["Admin", "User"])
    submitted = st.form_submit_button("Submit")

if submitted:
    save_user(name, email, role)
```

Use `border=False` for seamless inline forms that don't look like forms:

```python
with st.form("search", border=False):
    with st.container(horizontal=True):
        query = st.text_input("Search", label_visibility="collapsed")
        st.form_submit_button(":material/search:")
```

**When to use forms:**

- Multiple related inputs (signup, filters, settings)
- Text inputs where typing triggers expensive operations
- Any UI where "submit" semantics make sense

**When NOT to use forms:** If inputs depend on each other (e.g., selecting a country should update available cities), forms won't work since there's no rerun until submit.

## Conditional rendering

**This is critical and often missed.**

By default, layout containers like `st.tabs`, `st.expander`, and `st.popover` always render all their content, even when hidden or collapsed.

### Tabs with expensive content

`st.tabs` renders ALL tab content on every rerun, even hidden tabs. Two fixes:

**Preferred (Streamlit 1.55+): Dynamic tabs with `on_change="rerun"`**

Keep the tabs UX. Setting `on_change="rerun"` makes tabs dynamic — each tab's `.open` property returns `True` for the selected tab and `False` otherwise, so you can guard expensive work. (With the default `on_change="ignore"`, all tab content runs on every rerun and `.open` is `None` for every tab.)

```python
# BAD: Heavy content loads even when tab not visible
tab1, tab2 = st.tabs(["Light", "Heavy"])
with tab2:
    expensive_chart()  # Always computed!

# GOOD: Dynamic tabs — only visible tab content renders
tab1, tab2 = st.tabs(["Light", "Heavy"], on_change="rerun")
if tab1.open:
    with tab1:
        light_overview()
if tab2.open:
    with tab2:
        expensive_chart()  # Only computed when this tab is visible
```

**Alternative: Replace with `st.segmented_control` + conditional**

Swap the tabs widget entirely for a segmented control with explicit if/elif.

```python
# GOOD: Content only loads when selected
view = st.segmented_control("View", ["Light", "Heavy"])
if view == "Light":
    light_overview()
elif view == "Heavy":
    expensive_chart()  # Only computed when selected
```

### Expanders with expensive content

`st.expander` renders content even when collapsed. Two fixes:

**Preferred (Streamlit 1.55+): Dynamic expander with `on_change="rerun"`**

With `on_change="rerun"`, the `.open` property returns `True` when the expander is open and `False` when collapsed, so you can guard expensive work. (Without `on_change`, `.open` is `None` and all content runs regardless.)

```python
# BAD: Expander content always loads
with st.expander("Advanced options"):
    heavy_computation()  # Runs even when collapsed!

# GOOD: Dynamic expander — content only renders when open
exp = st.expander("Advanced options", on_change="rerun")
if exp.open:
    with exp:
        heavy_computation()  # Only runs when expanded
```

**Alternative: Replace with `st.toggle` + conditional**

```python
# GOOD: Toggle controls loading
if st.toggle("Show advanced options"):
    heavy_computation()  # Only runs when toggled on
```

## Pre-computation

Move expensive work outside the main flow:

- Compute aggregations in SQL/dbt, not Python
- Pre-compute metrics in scheduled jobs
- Use materialized views for complex queries

## Render stable UI before slow work

Streamlit runs your script top to bottom and emits a UI delta as each `st.*` command runs. During a rerun, the elements from the _previous_ run stay on screen and are marked **stale** (faded to ~33% opacity after a short delay) until the new run reaches the same delta paths or finishes and clears the leftovers. So if slow code runs before the app has recreated its downstream layout, users can temporarily see faded old elements, duplicate-looking content, or a stale UI branch from a previous run.

Fast reruns usually don't show this, since the fade has a built-in delay — though reruns that run just past that delay can still briefly flash stale content. Greying is a symptom of slow work blocking rendering — fix the ordering and the slowness, not the fade.

Prefer this order:

1. Render stable chrome first: title, filters, tabs/containers, section headers, and output slots — plus anything that does not depend on the slow result (sidebar controls, help text, footers).
2. Start slow work only after the page has claimed the slots where results will land.
3. Fill those slots with results when the work completes.

The elements that depend on the slow result genuinely have to wait, but everything that does _not_ depend on it should render first instead of being stuck behind the slow call.

```python
# BAD: The chart and table depend on the report, so they must wait — but the
# sidebar filters and the footer below don't, and they still stay faded/stale
# until load_report returns.
st.title("Account report")
account = st.selectbox("Account", accounts)

report = load_report(account)  # Slow query/API/model call

st.line_chart(report.history)  # Depends on report
st.dataframe(report.transactions)  # Depends on report

with st.sidebar:  # Independent of the report, but stuck behind it
    st.date_input("Date range")
    st.multiselect("Regions", regions)
st.caption("Data refreshes hourly. Email support@example.com for access.")  # Independent
```

```python
# GOOD: Everything that doesn't depend on the report renders immediately. The
# chart and table wait, held by reserved containers that keep the layout in place.
st.title("Account report")
account = st.selectbox("Account", accounts)

with st.sidebar:  # Independent chrome — render it before the slow call
    st.date_input("Date range")
    st.multiselect("Regions", regions)

chart_slot = st.container()  # Reserve the report's positions up front
table_slot = st.container()

st.caption("Data refreshes hourly. Email support@example.com for access.")

report = load_report(account)  # Slow work runs after the page is painted

with chart_slot:
    st.line_chart(report.history)
with table_slot:
    st.dataframe(report.transactions, key="transactions")
```

**Reserve slots with `st.container()`, not standalone `st.empty`/`st.skeleton`.** A container keeps the previous run's elements mounted while the rerun is in flight: they go **stale** (greyed) and then update in place, so a dataframe keeps its scroll position, sort, and selection. Standalone `st.empty()`/`st.skeleton()` placeholders clear and refill their slot on every rerun, which unmounts the old element and resets that state. Give stateful elements a stable `key` so their identity survives data changes (without one, a dataframe's identity includes its data, so it remounts whenever the data changes).

To also show a loading indicator while the work runs and still keep element state, wrap the slow call and its related output in a `with st.skeleton(...):` block (context-manager mode). The skeleton shows during the wait and clears on exit, while the elements inside render into the parent at stable positions, so their state is preserved:

```python
with table_slot:
    with st.skeleton():
        report = load_report(account)  # skeleton shows while this runs
        st.dataframe(report.transactions, key="transactions")
```

Reserve standalone `st.empty()`/`st.skeleton()` for replacing an element with a _different_ one, or for content with no state worth keeping. See `layouts.md` for placeholder details.

For independent slow sections, prefer `@st.fragment(parallel=True)` so each card can fill in as soon as its own work completes. Keep fragment writes inside the fragment body; if a fragment must write to an outside container, claim that outside slot during the initial full-app run.

## Perceived performance (loading states)

The techniques above reduce _actual_ work and keep the UI fresh. When a wait is unavoidable, give immediate loading feedback so the app _feels_ responsive instead of showing greyed, stale content. These don't speed up computation — pair them with caching and fragments. See `layouts.md` for details:

- `st.spinner` — lightweight indicator wrapped around a block of slow work.
- `st.skeleton` — animated placeholder that reserves layout space while content loads.
- `st.progress` — determinate progress bar when you can report percent complete (e.g., looping over a known number of steps).
- `st.status` — progress and intermediate output for multi-step, long-running tasks.

## References

- [st.cache_data](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.cache_data)
- [st.cache_resource](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.cache_resource)
- [st.fragment](https://docs.streamlit.io/develop/api-reference/execution-flow/st.fragment)
- [st.form](https://docs.streamlit.io/develop/api-reference/execution-flow/st.form)
