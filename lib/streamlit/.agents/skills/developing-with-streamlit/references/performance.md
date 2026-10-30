# Streamlit performance

Performance is the biggest win. Without caching and fragments, your app reruns everything on every interaction.

## Caching

### @st.cache_data for data

Use for any function that loads or computes data.

```python
# BAD: Recomputes on every rerun
def load_data(path):
    return pd.read_csv(path)


# GOOD: Cache at most the 100 most recently used paths
@st.cache_data(max_entries=100)
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

### Background refresh (serve stale while updating)

By default, when a cached entry's `ttl` expires, the next call blocks while the function recomputes. Use `refresh_mode="background"` to instead return the expired value immediately and recompute in the background—ideal when slightly stale data is acceptable but latency isn't.

```python
@st.cache_data(ttl="5m", refresh_mode="background")
def get_metrics():
    return api.fetch()
```

Requirements and caveats: a `ttl` is required, and `refresh_mode="background"` can't be combined with `persist`. The function can't use session-specific features (e.g. `st.session_state`) or render Streamlit elements—pass any needed values as arguments. Works with both `st.cache_data` and `st.cache_resource`. Combining it with an `async def` cached function raises an error at decoration time; use `refresh_mode="foreground"` instead.

By default Streamlit hard-expires a background-refresh entry at `2 × ttl`, serving it stale for one extra `ttl`. Set `runner.cacheBackgroundRefreshTTLMultiplier` to a finite number greater than `1.0` to move that bound: a multiplier of `M` hard-expires at `M × ttl`, giving a stale window of `(M - 1) × ttl`. Invalid values warn and fall back to `2.0`. Raising it avoids blocking recomputes after idle periods or failed refreshes; lowering it serves fresher data and frees memory sooner.

```toml
# .streamlit/config.toml
[runner]
cacheBackgroundRefreshTTLMultiplier = 4.0
```

Background refresh is access-driven: it starts only after a call observes an expired entry, so the caller may briefly receive stale data. For advanced cases that need the server to initiate background refreshes for specific global cache keys even without user traffic, use an `st.App` lifespan task to periodically call the cached function with those arguments. See [Scheduled background refresh for specific keys](server-asgi.md#scheduled-background-refresh-for-specific-keys).

### Async functions

`@st.cache_data` and `@st.cache_resource` can decorate `async def` functions. The decorated call returns an awaitable; you must await it (for example with `asyncio.run()` in a Streamlit script). Streamlit caches the awaited return value, not the coroutine.

```python
import asyncio

import streamlit as st


@st.cache_data
async def load_config():
    return await fetch_config()


config = asyncio.run(load_config())
```

Do not cache live async clients or connections bound to the event loop that created them — that loop may already be closed on a later rerun, and the object will raise `Event loop closed`. Cache results that stay valid across loops, such as API payloads, dataframes, and config.

### Bound cache growth

**Important:** `st.cache_data` and `st.cache_resource` are unbounded by default. Use `ttl` to expire stale results.
Use `max_entries` when the workload gives a practical entry-count bound. For `st.cache_resource`, this is the available count-based limit.
For `st.cache_data`, use `max_size` only when the user provides a byte budget or deployment memory constraints and the intended allocation across caches determine a per-cache budget. It limits serialized bytes for one decorated function, not total process memory or RSS. Do not guess it from source dataset size, representative or example values, or arbitrary constants; ask the user when the memory budget is unknown. Combine limits when they address different risks. `max_size` integers are bytes; strings use binary units (`"500MB"` and `"500MiB"` are equal):

```python
# BAD: No growth bound
@st.cache_data
def get_user_data(user_id):
    return fetch_user(user_id)


# GOOD: Bound by age and the app's 1,000-entry cache budget
@st.cache_data(ttl="1h", max_entries=1000)
def get_user_data(user_id):
    return fetch_user(user_id)


# GOOD: Enforce the user's 500 MiB allocation (one oversized value is retained)
@st.cache_data(max_size="500MiB")
def get_large_report(report_id):
    return build_report(report_id)
```

## Fragments

Use `@st.fragment` to isolate reruns for self-contained UI pieces.

```python
# BAD: Full app reruns
st.metric("Users", get_count())
st.button("Refresh")
query = st.text_input("Search", type="search", live=True)
st.dataframe(search(query))


# GOOD: Only fragment reruns
@st.fragment
def live_metrics():
    st.metric("Users", get_count())
    st.button("Refresh")


@st.fragment
def live_search():
    query = st.text_input("Search", type="search", live=True)
    st.dataframe(search(query))


live_metrics()
live_search()
```

For auto-refreshing metrics, use `run_every` instead of a `while True` loop or `time.sleep()` followed by `st.rerun()`:

```python
@st.fragment(run_every="30s")
def auto_refresh_metrics():
    st.metric("Users", get_count())


auto_refresh_metrics()
```

Use for: live metrics, refresh buttons, live search, interactive charts that don't affect global state.

### Keyed reruns — target a fragment from a callback

Use this when a widget *outside* a fragment should trigger only that fragment's rerun — not a full-app rerun. Give the fragment a stable name with `@st.fragment(key=...)` and call `st.rerun("<key>")` from the widget's callback.

```python
@st.fragment(key="charts")
def charts():
    st.line_chart(st.session_state.data)


charts()
# Button lives outside the fragment; clicking it reruns only "charts".
st.button("Refresh charts", on_click=lambda: st.rerun("charts"))
```

To rerun multiple fragments at once, pass a list:

```python
st.button("Refresh all", on_click=lambda: st.rerun(["charts", "table"]))
```

**Constraints:**

- `st.rerun("<key>")` is **only valid inside a widget callback** (`on_change`, `on_click`, etc.). Calling it from the main script body or a fragment body raises an error.
- The named fragment must have been rendered during the **most recently completed full-app run**. Fragments evicted because they were behind a `False` conditional in that run are no longer in storage and raise an error.

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

**Where to put controls during a long load.** Put a control in the main script when it must stay responsive while one fragment is much slower than the rest.

- While a full-app run is still in progress, a widget *inside* a fragment waits until that run finishes, including the slow fragments.
- A main-script widget starts a new full-app run and preempts the in-progress one, so every card refreshes together.
- Once the app is idle, an in-fragment widget reruns just that fragment; when cards load in a similar time, per-card controls are fine.

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

**Every form must include at least one `st.form_submit_button`.** It's the only way to submit a form—without it, the form's widget values are never sent to your app and the form is non-functional. Note that `st.button` and `st.download_button` can't be placed inside a form.

Use `border=False` for seamless inline forms that don't look like forms:

```python
with st.form("invite", border=False):
    with st.container(horizontal=True):
        email = st.text_input("Email", label_visibility="collapsed")
        st.form_submit_button("Invite")
```

**When to use forms:**

- Multiple related inputs (signup, filters, settings)
- Text inputs where typing triggers expensive operations
- Any UI where "submit" semantics make sense

**When NOT to use forms:** If inputs depend on each other (e.g., selecting a country should update available cities), forms won't work since there's no rerun until submit. See [Skip reruns on individual widgets](#skip-reruns-on-individual-widgets-advanced) for an alternative.

## Skip reruns on individual widgets (advanced)

With `on_change="ignore"`, most stateful input widgets update in the browser without a rerun. Python receives the new value on the next browser-triggered rerun, such as a button click.

Use it to build dynamic forms that `st.form` can't express: defer inputs that don't change other fields, and let the ones that do rerun normally.

```python
country = st.selectbox("Country", countries)  # Reruns to refresh the city options
city = st.selectbox("City", get_cities(country), on_change="ignore")
name = st.text_input("Name", on_change="ignore")

if st.button("Save"):
    save_contact(country, city, name)
```

Prefer caching, fragments, and forms first, and only use this where the user doesn't expect an immediate reaction:

- Don't use it on widgets that drive other UI (options, conditional fields, charts). Nothing else reacts, so the app looks broken.
- Any browser-triggered rerun, even from an unrelated widget, delivers all pending values. Gate the work that uses them behind a button.
- Pending values are lost on a page refresh unless the widget sets `key` and `bind="query-params"`.
- It has no effect inside `st.form`. File, camera, and audio inputs still upload immediately; only the rerun is deferred.

## Client-side validation

Use client-side validation and limits whenever the widget already supports them. They catch bad input in the browser, which avoids a rerun and gives the user immediate feedback.

- `st.text_input`: `validate`, `required`, `max_chars`, and `type` (`type="email"` and `type="url"` check the format by default).
- `st.text_area`: `required` and `max_chars`. `st.selectbox`: `required`. `st.chat_input`: `max_chars`.
- `st.number_input`: `min_value`, `max_value`, `step`, and `required`.
- `st.date_input`: `min_value`, `max_value`, and `required`. `st.time_input`: `required`. `st.datetime_input`: `min_value`, `max_value`, `step`, and `required`.
- `required=True` does not change the default: `st.selectbox` still starts on its first option, `st.date_input` still starts at today, and `st.time_input` and `st.datetime_input` still start at the current time. For an empty required field, pass `value=None` (`index=None` for `st.selectbox`) together with `required=True`. For an empty required date range, pass `value=[]` together with `required=True`.
- `st.data_editor`: the same kinds of limits via `st.column_config`.
- `st.file_uploader`: `type` rejects a disallowed file before upload.

```python
email = st.text_input("Email", type="email", required=True)
qty = st.number_input("Quantity", min_value=1, max_value=99, step=1)
```

These checks are a UX guardrail, not a security boundary. See [Widget input constraints are mostly client-side](session-state.md#widget-input-constraints-are-mostly-client-side).

## Conditional rendering

**This is critical and often missed.** By default, the app script enters every tab, expander, and popover body on each rerun, even when hidden, collapsed, or closed. When a body contains expensive work, use `on_change="rerun"` with an `.open` guard, as shown below.

### Tabs with expensive content

`st.tabs` renders ALL tab content on every rerun, even hidden tabs. Two fixes:

**Preferred: Dynamic tabs with `on_change="rerun"`**

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

**Preferred: Dynamic expander with `on_change="rerun"`**

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

## Charts with large data

Charts process every row in the browser, which outweighs the Python side from about 10,000 points. Aggregate first and pick the chart command by size; see [charts.md](charts.md#large-datasets).

## Render stable UI before slow work

Streamlit runs your script top to bottom and emits a UI delta as each `st.*` command runs. During a rerun, the elements from the _previous_ run stay on screen and are marked **stale** (faded to ~33% opacity after a short delay) until the new run reaches the same delta paths or finishes and clears the leftovers. So if slow code runs before the app has recreated its downstream layout, users can temporarily see faded old elements, duplicate-looking content, or a stale UI branch from a previous run.

Fast reruns usually don't show this (the fade is delayed), though a rerun that runs just past the delay can briefly flash stale content. Greying is a symptom of slow work blocking rendering — fix the ordering and the slowness, not the fade.

Prefer this order:

1. Render stable chrome first: title, filters, tabs/containers, section headers, and output slots — plus anything that does not depend on the slow result (sidebar controls, help text, footers).
2. Start slow work only after the page has claimed the slots where results will land.
3. Fill those slots when the work completes.

Only the parts that depend on the slow result should wait.

```python
# BAD: The chart and table depend on the report, so they must wait — but the
# sidebar and footer below don't, yet they stay faded/stale until it returns.
st.title("Account report")
account = st.selectbox("Account", accounts)

report = load_report(account)  # Slow query/API/model call

st.line_chart(report.history)  # Depends on report
st.dataframe(report.transactions)  # Depends on report

with st.sidebar:  # Independent of the report, but stuck behind it
    st.date_input("Date range")
    st.multiselect("Regions", regions)
st.caption(
    "Data refreshes hourly. Email support@example.com for access."
)  # Independent
```

```python
# GOOD: Everything that doesn't depend on the report renders immediately. The chart
# waits in a reserved slot that shows a skeleton while it loads and keeps its state.
st.title("Account report")
account = st.selectbox("Account", accounts)

with st.sidebar:  # Independent chrome — render it before the slow call
    st.date_input("Date range")
    st.multiselect("Regions", regions)

chart_slot = st.container()  # Reserve the chart's position up front

st.caption("Data refreshes hourly. Email support@example.com for access.")

with chart_slot.skeleton():  # Skeleton fills the reserved slot while the work runs
    report = load_report(account)  # Slow work runs after the page is painted
    chart_slot.line_chart(report.history)  # Renders into the reserved slot; keeps state
```

`st.container()` claims the chart's position up front, so the caption paints immediately instead of waiting behind `load_report`. The chart then renders into that reserved slot at a stable position, so it goes **stale** (greyed) and updates in place rather than remounting — keeping its scroll, sort, and selection. `chart_slot.skeleton()` (context manager) shows a skeleton while the block runs; write results explicitly to the container (`chart_slot.line_chart(...)`), since the block doesn't redirect bare `st.*` calls into it.

Avoid standalone `st.empty()`/`st.skeleton()` placeholders you fill later here: they clear the slot at the top of the rerun, so a slow fill commits the cleared state and the old element unmounts and loses its state (a fast fill may skip the visible clear). Reserve them for swapping in a _different_ element or stateless content. Give stateful elements a stable `key` — without one, a dataframe's identity includes its data, so it remounts when the data changes. See `layouts.md` for placeholder details.

For independent slow sections, prefer `@st.fragment(parallel=True)` and keep its output inside its own body; it cannot write to containers created outside it.

## Perceived performance (loading states)

The techniques above keep the UI fresh and responsive during slow work. When a wait is unavoidable, give immediate loading feedback so the app _feels_ responsive instead of showing greyed, stale content. These don't speed up computation — pair them with caching and fragments to cut the _actual_ work. See `layouts.md` for details:

- `st.spinner` — lightweight indicator wrapped around a block of slow work.
- `st.skeleton` — animated placeholder that reserves layout space while content loads.
- `st.progress` — determinate progress bar when you can report percent complete (e.g., looping over a known number of steps).
- `st.status` — progress and intermediate output for multi-step, long-running tasks.

## References

- [st.cache_data](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.cache_data)
- [st.cache_resource](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.cache_resource)
- [st.fragment](https://docs.streamlit.io/develop/api-reference/execution-flow/st.fragment)
- [st.form](https://docs.streamlit.io/develop/api-reference/execution-flow/st.form)
