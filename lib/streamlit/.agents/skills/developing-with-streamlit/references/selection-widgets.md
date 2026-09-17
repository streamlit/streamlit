
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

Keep option lists in the low thousands. Streamlit serializes every option into
the widget's message, so the payload grows with the option count times the label
length: a million 16-character labels is roughly 16 MB. Messages at or above
`global.minCachedMessageSize` (10 KB) are cached and re-sent as a hash
reference, so that payload crosses the wire on first render and whenever the
list changes.

`filter_mode` matching then runs in the browser on every keystroke. Matching
tests every option; `"fuzzy"`, the default, also scores and sorts the ones that
match. That only matters well above the low thousands, where message size is
already the reason to stop shipping the list.

Don't fetch a whole table into the app just to derive options. Ask the database
for a bounded, distinct list. If the real domain is larger than that bound, use
the search pattern below; truncating hides values from the user:

```python
conn = st.connection("sql")

# BAD: pulls every row into the app for one dropdown; can exhaust app memory
df = conn.query("select * from orders")
customer = st.selectbox("Customer", df["customer"].unique())

# GOOD: the database does the work and returns a bounded list
customer = st.selectbox(
    "Customer",
    conn.query(
        "select distinct customer from orders order by customer limit 1000",
        ttl=3600,
    )["customer"],
)
```

`select distinct` still scans the column, so on a large base table precompute
the values into their own table or materialized view on a schedule.

Above a few thousand values, stop shipping the list and search it:

```python
conn = st.connection("sql")


def like_term(text: str) -> str:
    """Escape LIKE wildcards so a typed % or _ matches literally."""
    for char in ("!", "%", "_"):
        text = text.replace(char, "!" + char)
    return f"%{text}%"


term = st.text_input(
    "Customer", type="search", live="300ms", placeholder="Type to search…"
)
customer = None
if len(term) >= 2:
    matches = conn.query(  # the precomputed distinct table
        "select customer from customers"
        " where customer like :term escape '!' order by customer limit 50",
        params={"term": like_term(term)},
        ttl=60,
    )["customer"]
    customer = st.pills("Matches", matches, wrap=False, label_visibility="collapsed")
```

- `live="300ms"` sends the value to Python after a 300 ms pause. Pills keep the
  matches on screen, so picking one is a single click, and `wrap=False` holds
  them to one scrollable row.
- Keep the `limit`: it bounds the message, and the database can stop early when
  the plan already produces that order. Whether an index can serve the `like`
  depends on the backend, collation, and pattern, so check the plan.
- Escape `%` and `_` and declare an `escape` character, or a typed `%` matches
  far more than the user asked for. `!` avoids the dialects where `\` is itself
  a string-literal escape.
- Pass `ttl` as a number: `conn.query` caches indefinitely by default, takes no
  `max_entries`, and every keystroke is a new cache key.
- `st.connection("sql")` binds `:name` with a dict; Snowflake binds `?`
  positionally and uppercases unquoted column names.
- When the rest of the app is expensive, wrap this in `@st.fragment`, publish
  the choice through Session State, and call `st.rerun()` when it changes so
  dependents refresh. Only the fragment reruns otherwise, so they would keep
  showing the previous selection.

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
