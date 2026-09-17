
# Streamlit selection widgets

The right selection widget for the job. Streamlit has evolved—many old patterns are now anti-patterns.

## When to use what

Use `st.segmented_control` or `st.pills` when you want all options visible at once. Use `st.selectbox` or `st.multiselect` when options should be hidden in a dropdown.

| Widget | Best For |
|--------|----------|
| `st.segmented_control` | 2-5 options, single select, all visible |
| `st.pills` | 2-5 options, multi-select, all visible |
| `st.selectbox` | Many options, single select, dropdown |
| `st.multiselect` | Many options, multi-select, dropdown |

For more values than fit comfortably in a dropdown, filter server-side instead of listing them — see [High-cardinality options](#high-cardinality-options).

## Segmented control (options visible, single select)

```python
# BAD
status = st.radio("Status", ["Draft", "Published"], horizontal=True)

# GOOD
status = st.segmented_control("Status", ["Draft", "Published"])
```

For vertical layouts, `st.radio(..., horizontal=False)` is still a great choice.

Cleaner, more modern look than horizontal radio buttons.

## Pills (options visible, multi-select)

```python
# Multi-select with few options
selected = st.pills(
    "Tags", ["Python", "SQL", "dbt", "Streamlit"], selection_mode="multi"
)
```

Can also be used to mimic an "example" widget, especially with `label_visibility="collapsed"`:
```python
st.pills(
    "Examples", ["Show me sales data", "Top customers"], label_visibility="collapsed"
)
```

More visual and easier to use than `st.multiselect` for small option sets.

## Selectbox (many options, single select)

```python
country = st.selectbox(
    "Select a country", ["USA", "UK", "Canada", "Germany", "France", ...]
)
```

Dropdowns scale better than radio/pills for long lists, but the whole option list still travels to the browser. Past a few thousand values, see [High-cardinality options](#high-cardinality-options).

## Multiselect (many options, multi-select)

```python
countries = st.multiselect(
    "Select countries", ["USA", "UK", "Canada", "Germany", "France", ...]
)
```

## Keep options on one row with `wrap`

`st.pills`, `st.segmented_control`, and `st.multiselect` accept `wrap`. The
default `None` stays on one row (and scrolls if needed) inside a horizontal
container or when the widget is placed directly in a column, and wraps onto
additional rows otherwise. Nested layout containers such as a form, expander,
or vertical `st.container` reset this. Pass `wrap=False` to always keep a
single row, or `wrap=True` to always wrap.

```python
# Directly in a column: stays one row by default
col1, col2 = st.columns(2)
with col1:
    tags = st.pills("Tags", ["Python", "SQL", "dbt"], selection_mode="multi")

# Nested in a form: wrap unless you opt out
with st.form("filters"):
    tags = st.pills(
        "Tags", ["Python", "SQL", "dbt"], selection_mode="multi", wrap=False
    )
    st.form_submit_button("Apply")
```

## High-cardinality options

Every option is serialized into the widget's message and sent to the browser on
each rerun, and `filter_mode` matching then runs client-side over the whole
list. The dropdown is virtualized, so long lists still render fine — payload and
main-thread filtering are the cost. Keep option lists in the low thousands: a
10k-option list is roughly 180 KB per rerun, while 1M options is ~18 MB and
several hundred milliseconds of frozen UI per keystroke.

Never derive options from a full table scan. Ask the database for the distinct
values, bounded:

```python
# BAD: pulls every row into the app for one dropdown; can exhaust app memory
df = conn.query("select * from orders")
customer = st.selectbox("Customer", df["customer"].unique())

# GOOD: the database does the work and returns a bounded list
customers = conn.query(
    "select distinct customer from orders order by customer limit 1000",
    ttl="1h",
)["customer"]
customer = st.selectbox("Customer", customers)
```

When the real domain is larger than a few thousand values, don't ship the list —
search it. Query on a debounce and offer only what matched:

```python
@st.fragment
def customer_filter() -> None:
    term = st.text_input(
        "Customer", type="search", live="300ms", placeholder="Type to search…"
    )
    st.session_state.customer = None
    if len(term) < 2:
        return
    matches = conn.query(
        "select customer from customers where customer like :term"
        " order by customer limit 50",
        params={"term": f"{term}%"},
        ttl="60s",
    )["customer"]
    if matches.empty:
        st.caption("No matches.")
    else:
        st.session_state.customer = st.selectbox(
            "Matches", matches, label_visibility="collapsed"
        )


customer_filter()
```

- `live="300ms"` commits on a pause instead of on every keystroke, and
  `@st.fragment` keeps the rest of the app from rerunning while the user types.
- The `limit` bounds the query and the payload; matching a prefix (`term%`) lets
  an index serve it.
- Pass a `ttl` to `conn.query` here — it caches indefinitely by default, and
  every keystroke is a new cache key.
- Read the choice from `st.session_state` outside the fragment; a fragment's
  return value isn't available to the main script on a fragment-scoped rerun.

Cascading filters (region → city → store) are the other way to keep each list
small. Use `accept_new_options=True` when users already know the exact value and
shouldn't have to find it in a list.

## Toggle vs checkbox

Use `st.toggle` for settings that trigger changes in the app. Reserve `st.checkbox` for forms.

```python
# GOOD: Toggle for app settings
dark_mode = st.toggle("Dark mode")
show_advanced = st.toggle("Show advanced options")

# GOOD: Checkbox in forms
with st.form("signup"):
    agree = st.checkbox("I agree to the terms")
    st.form_submit_button("Sign up")
```

## Forms with border=False

Remove the default form border for cleaner inline forms. Keep the border for longer forms where visual grouping helps.

```python
# Inline form without border
with st.form(key="add_item", border=False):
    with st.container(horizontal=True, vertical_alignment="bottom"):
        st.text_input("New item", label_visibility="collapsed", placeholder="Add item")
        st.form_submit_button("Add", icon=":material/add:")

# Longer form - keep the border for visual grouping
with st.form("signup"):
    st.text_input("Name")
    st.text_input("Email")
    st.selectbox("Role", ["Admin", "User"])
    st.form_submit_button("Submit")
```

## Custom options in selectbox and multiselect

Allow users to add their own options with `accept_new_options`:

```python
# Works with multiselect
tickers = st.multiselect(
    "Stock tickers",
    options=["AAPL", "MSFT", "GOOGL", "NVDA"],
    default=["AAPL"],
    accept_new_options=True,
    placeholder="Choose stocks or type your own",
)

# Also works with selectbox
country = st.selectbox(
    "Country",
    options=["USA", "UK", "Canada"],
    accept_new_options=True,
    placeholder="Select or type a country",
)
```

## References

- [st.segmented_control](https://docs.streamlit.io/develop/api-reference/widgets/st.segmented_control)
- [st.pills](https://docs.streamlit.io/develop/api-reference/widgets/st.pills)
- [st.selectbox](https://docs.streamlit.io/develop/api-reference/widgets/st.selectbox)
- [st.multiselect](https://docs.streamlit.io/develop/api-reference/widgets/st.multiselect)
- [st.toggle](https://docs.streamlit.io/develop/api-reference/widgets/st.toggle)
- [st.checkbox](https://docs.streamlit.io/develop/api-reference/widgets/st.checkbox)
- [st.form](https://docs.streamlit.io/develop/api-reference/execution-flow/st.form)
