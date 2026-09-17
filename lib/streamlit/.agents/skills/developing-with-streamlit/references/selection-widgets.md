
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

Keep option lists in the low thousands. Streamlit serializes the whole option
list into the widget's message, and `filter_mode` matching then runs client-side
over all of it. The dropdown is virtualized, so long lists still render fine;
the costs are message size and main-thread filtering. Short labels run about 18
bytes per option, so 10k options is roughly 180 KB and 1M roughly 18 MB, scaling
with label length. Streamlit caches messages at or above
`global.minCachedMessageSize` (10 KB) and re-sends unchanged ones as a hash
reference, so that payload crosses the wire on first render and whenever the
list changes.

Client-side filtering gets no such reprieve. The default `filter_mode="fuzzy"`
scores and ranks every option: once warm, roughly 10 ms per keystroke at 100k
options and 100 ms at 1M, and several times that on the first keystroke of a
session. `"contains"` and `"prefix"` are a single pass, closer to 30 ms and
20 ms at 1M, so switching mode is the cheapest fix for a list that has to stay
client-side in the upper thousands.

Don't fetch a whole table into the app just to derive options. Ask the database
for a bounded, distinct list:

```python
conn = st.connection("sql")

# BAD: pulls every row into the app for one dropdown; can exhaust app memory
df = conn.query("select * from orders")
customer = st.selectbox("Customer", df["customer"].unique())

# GOOD: the database does the work and returns a bounded list
customers = conn.query(
    "select distinct customer from orders order by customer limit 1000",
    ttl=3600,
)["customer"]
customer = st.selectbox("Customer", customers)
```

That hands the app one bounded column, but the database still has to find those
distinct values. When the base table is large, precompute them into a small
table or materialized view on a schedule and point the widget at that, so you
don't pay for it again on every cache expiry.

Above a few thousand values, stop shipping the list and search it. Run a
debounced query and offer only the matching values:

```python
conn = st.connection("sql")
st.session_state.setdefault("selected_customer", None)


def like_term(text: str) -> str:
    """Escape LIKE wildcards so a typed % or _ matches literally."""
    for char in ("!", "%", "_"):
        text = text.replace(char, "!" + char)
    return f"%{text}%"


def clear_filter() -> None:
    st.session_state.selected_customer = None
    st.session_state.customer_search = ""


@st.fragment
def customer_filter() -> None:
    term = st.text_input(
        "Customer",
        key="customer_search",
        type="search",
        live="300ms",
        placeholder="Type to search…",
    )
    if len(term) >= 2:
        # `customers` is the precomputed distinct list from above.
        matches = conn.query(
            "select customer from customers"
            " where customer like :term escape '!'"
            " order by customer limit 50",
            params={"term": like_term(term)},
            ttl=60,
        )["customer"]
        if matches.empty:
            st.caption("No matches.")
        else:
            picked = st.selectbox(
                "Matches",
                matches,
                index=None,
                placeholder="Select a match",
                label_visibility="collapsed",
            )
            current = st.session_state.selected_customer
            if picked is not None and picked != current:
                st.session_state.selected_customer = picked
                st.rerun()
    if st.button("Clear filter", on_click=clear_filter):
        st.rerun()


customer_filter()

if st.session_state.selected_customer is not None:
    st.dataframe(
        conn.query(
            "select * from orders where customer = :customer limit 100",
            params={"customer": st.session_state.selected_customer},
            ttl=60,
        )
    )
```

- `live="300ms"` sends the value to Python after 300 ms without further typing,
  and `@st.fragment` keeps the rest of the app from rerunning while the user
  types.
- Only the fragment reruns when the user types or picks, so the table below it
  keeps showing the previous selection. Store the choice in Session State and
  call `st.rerun()` when it changes, as above; dependent code then re-executes
  once per real change. Rendering the dependent parts inside the fragment also
  works, and needs no rerun.
- Commit the choice only when the user picks one, and let `setdefault` seed the
  key so dependent code doesn't hit `KeyError` before the first pick.
  `index=None` stops the first match applying itself, and ignoring a `None`
  selection stops a search that no longer lists the current customer from
  dropping the filter behind the user's back. Committing that `None`, or
  resetting the stored choice at the top of the fragment, reruns forever.
- Clear through an `on_click` callback, and leave the button enabled. The
  callback runs before this run's widgets, so it can reset the search box;
  clearing only `selected_customer` leaves the still-mounted selectbox to
  re-commit its old value. Disabling the button on `selected_customer is None`
  breaks it too: the callback has already set that, so the click returns `False`
  and the app never reruns.
- Keep the committed key off the selectbox, and leave that widget keyless so
  changing options resets its identity. A `key="selected_customer"` there hands
  the slot to the widget, and a search omitting the current pick resets it.
- Keep the `limit`. It bounds the message, and lets the database stop early
  when the plan already produces the requested order; with a leading `%` and a
  sort it may have to rank candidates first. That leading `%` is what matches
  mid-value, which users expect. Whether an index can serve a `like` at all
  depends on the backend, collation, and pattern, so check the query plan and
  add a full-text or search index if it doesn't hold up.
- Escape `%` and `_` in the term and declare an `escape` character. Untouched
  they are wildcards, so a typed `%` matches far more than the user asked for.
  `!` sidesteps the dialects where `\` is itself a string-literal escape.
- Pass a `ttl` to `conn.query` here. It caches indefinitely by default, every
  keystroke is a new cache key, and it takes no `max_entries`, so the `ttl` is
  the only bound on that cache. Pass it as a number or `timedelta`: the
  parameter is typed `float | int | timedelta | None`, so a duration string
  works at runtime but fails a type check.
- These examples use `st.connection("sql")`, where parameters are `:name` with a
  dict. `st.connection("snowflake")` binds with `?` and uppercases unquoted
  columns; see `snowflake-connection.md` before porting them.

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
