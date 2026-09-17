
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

For more values than fit comfortably in a dropdown, see [High-cardinality options](#high-cardinality-options).

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

Streamlit sends every option to the browser on each rerun, and `filter_mode`
matching runs client-side over the whole list. The dropdown is virtualized, so
long lists still render fine; the cost is payload and main-thread filtering.
Keep option lists in the low thousands. A 10k-option list costs roughly 180 KB
per rerun; 1M options costs ~18 MB and several hundred milliseconds of frozen UI
per keystroke.

So don't build options from a full table scan. Ask the database for the distinct
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

That hands the app one bounded column, but the database still has to find those
distinct values. When the base table is large, precompute them into a small
table or materialized view on a schedule and point the widget at that, so you
don't pay for it again on every cache expiry.

Above a few thousand values, stop shipping the list and search it. Query on a
debounce and offer only what matched:

```python
@st.fragment
def customer_filter() -> None:
    term = st.text_input(
        "Customer", type="search", live="300ms", placeholder="Type to search…"
    )
    choice = None
    if len(term) >= 2:
        matches = conn.query(
            "select customer from customers where customer like :term"
            " order by customer limit 50",
            params={"term": f"%{term}%"},
            ttl="60s",
        )["customer"]
        if matches.empty:
            st.caption("No matches.")
        else:
            choice = st.selectbox(
                "Matches",
                matches,
                index=None,
                placeholder="Select a match",
                label_visibility="collapsed",
            )
    if choice != st.session_state.get("customer"):
        st.session_state.customer = choice
        st.rerun()


customer_filter()
```

- `live="300ms"` commits after a 300ms pause in typing, and `@st.fragment` keeps
  the rest of the app from rerunning while the user types.
- Only the fragment reruns when the user types or picks, so the rest of the app
  keeps showing results for the previous selection. Store the choice in Session
  State and call `st.rerun()` when it changes, as above; dependent code then
  re-executes once per real change. Rendering the dependent parts inside the
  fragment also works, and needs no rerun.
- `index=None` applies nothing until the user picks, so that rerun fires on a
  real selection and not on every keystroke. Never reset the stored choice at
  the top of the fragment: with `st.rerun()`, that loops forever.
- Keep the `limit`. It bounds the payload and lets the database stop once it has
  enough rows. A leading `%` matches mid-value, which users expect, but makes
  the match itself scan. Whether an index can serve a `like` at all depends on
  the backend, collation, and pattern, so check the query plan and add a
  full-text or search index if it doesn't hold up.
- Pass a `ttl` to `conn.query` here. It caches indefinitely by default, and
  every keystroke is a new cache key.

Cascading filters (region → city → store) keep each list small without a search
box.

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
