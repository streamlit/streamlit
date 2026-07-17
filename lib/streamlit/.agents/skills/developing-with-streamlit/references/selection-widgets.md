
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
    "Tags",
    ["Python", "SQL", "dbt", "Streamlit"],
    selection_mode="multi"
)
```

Can also be used to mimic an "example" widget, especially with `label_visibility="collapsed"`:
```python
st.pills("Examples", ["Show me sales data", "Top customers"], label_visibility="collapsed")
```

More visual and easier to use than `st.multiselect` for small option sets.

## Selectbox (many options, single select)

```python
country = st.selectbox(
    "Select a country",
    ["USA", "UK", "Canada", "Germany", "France", ...]
)
```

Dropdowns scale better than radio/pills for long lists.

## Multiselect (many options, multi-select)

```python
countries = st.multiselect(
    "Select countries",
    ["USA", "UK", "Canada", "Germany", "France", ...]
)
```

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
    placeholder="Choose stocks or type your own"
)

# Also works with selectbox
country = st.selectbox(
    "Country",
    options=["USA", "UK", "Canada"],
    accept_new_options=True,
    placeholder="Select or type a country"
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
