
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
the costs are message size and main-thread filtering. A 10k-option list is
roughly 180 KB and 1M options roughly 18 MB. Streamlit caches messages at or
above `global.minCachedMessageSize` (10 KB) and re-sends unchanged ones as a
hash reference, so that payload crosses the wire on first render and whenever
the list changes. Client-side filtering gets no such reprieve: at 1M options it
freezes the UI for several hundred milliseconds per keystroke.

So don't build options from a full table scan. Ask the database for the distinct
values, bounded:

```python
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

Above a few thousand values, stop shipping the list and search it. Query on a
debounce and offer only what matched:

```python
st.session_state.setdefault("customer", None)


def like_term(text: str) -> str:
    """Escape LIKE wildcards so a typed % or _ matches literally."""
    for char in ("\\", "%", "_"):
        text = text.replace(char, "\\" + char)
    return f"%{text}%"


@st.fragment
def customer_filter() -> None:
    term = st.text_input(
        "Customer", type="search", live="300ms", placeholder="Type to search…"
    )
    if len(term) >= 2:
        matches = conn.query(
            "select customer from customers"
            " where customer like :term escape '\\'"
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
            if picked is not None and picked != st.session_state.customer:
                st.session_state.customer = picked
                st.rerun()
    if st.session_state.customer and st.button("Clear filter"):
        st.session_state.customer = None
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
- Commit the choice only when the user picks one, and let `setdefault` seed the
  key so dependent code doesn't hit `KeyError` before the first pick.
  `index=None` stops the first match applying itself, and ignoring a `None`
  selection stops a search that no longer lists the current customer from
  dropping the filter behind the user's back. Committing that `None`, or
  resetting the stored choice at the top of the fragment, reruns forever.
- Keep the `limit`. It bounds the message and lets the database stop once it has
  enough rows. A leading `%` matches mid-value, which users expect, but makes
  the match itself scan. Whether an index can serve a `like` at all depends on
  the backend, collation, and pattern, so check the query plan and add a
  full-text or search index if it doesn't hold up.
- Escape `%` and `_` in the term and declare an `escape` character. Untouched
  they are wildcards, so a typed `%` matches far more than the user asked for.
- Pass a `ttl` to `conn.query` here. It caches indefinitely by default, and
  every keystroke is a new cache key. Pass it as a number or `timedelta`: the
  parameter is typed `float | int | timedelta | None`, so a duration string
  works at runtime but fails a type check.

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
