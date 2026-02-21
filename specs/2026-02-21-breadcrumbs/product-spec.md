---
author: lukasmasuch
created: 2026-02-21
---

# Breadcrumbs widget

## Summary

Add a new `st.breadcrumbs` widget that displays a horizontal navigation path (e.g.,
Home > Section > Page), helping users understand their location in multi-page or nested
app flows and quickly jump to higher-level views. Clicking an item triggers a rerun and
returns the clicked item.

## Problem

Users building multi-page apps or nested navigation flows need a way to show the current
location hierarchy and allow navigation to parent pages. Breadcrumbs are a common UI
pattern for this use case, but Streamlit doesn't provide a built-in solution.

**Requests:**

- [#13147](https://github.com/streamlit/streamlit/issues/13147) — Add a breadcrumbs widget
- [#5889](https://github.com/streamlit/streamlit/issues/5889) — Hierarchical multipage
  navigation (14+ comments, related use case)

**Use cases:**

- Documentation sites with nested sections (Home > Guide > Installation)
- E-commerce apps with category hierarchies (Home > Electronics > Phones)
- Admin dashboards with nested views (Dashboard > Users > User Detail)
- File browsers showing directory paths (Root > Documents > Reports)
- Multi-step wizards showing progress (Step 1 > Step 2 > Step 3)

**Current workarounds:**

Users combine `st.columns` with multiple `st.button` or use custom HTML, but this lacks
proper accessibility semantics and consistent styling.

```python
# Current workaround (verbose, no accessibility)
cols = st.columns([1, 1, 1, 3])
with cols[0]:
    if st.button("Home", type="tertiary"):
        st.switch_page("home.py")
with cols[1]:
    st.write(">")
with cols[2]:
    if st.button("Section", type="tertiary"):
        st.switch_page("section.py")
```

## Proposal

### API

```python
st.breadcrumbs(
    items: Sequence[T],
    *,
    separator: str = "/",
    key: Key | None = None,
    help: str | None = None,
    on_click: WidgetCallback | None = None,
    args: WidgetArgs | None = None,
    kwargs: WidgetKwargs | None = None,
    disabled: bool = False,
    format_func: Callable[[T], str] = str,
) -> T | None
```

### Parameters

| Parameter     | Type                         | Default  | Description                                                                                                                        |
| ------------- | ---------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `items`       | `Sequence[T]`                | required | Items to display in the breadcrumb path, ordered from root to current. The last item represents the current page.                  |
| `separator`   | `str`                        | `"/"`    | Separator displayed between items. Supports markdown including icons (e.g., `:material/chevron_right:`).                           |
| `key`         | `str \| int \| None`         | `None`   | Unique key for the widget.                                                                                                         |
| `help`        | `str \| None`                | `None`   | Tooltip text shown on hover over the widget.                                                                                       |
| `on_click`    | `Callable \| None`           | `None`   | Callback function executed when an item is clicked.                                                                                |
| `args`        | `list \| tuple \| None`      | `None`   | Arguments to pass to the callback.                                                                                                 |
| `kwargs`      | `dict \| None`               | `None`   | Keyword arguments to pass to the callback.                                                                                         |
| `disabled`    | `bool`                       | `False`  | Whether the breadcrumb navigation is disabled.                                                                                     |
| `format_func` | `Callable[[T], str]`         | `str`    | Function to convert items to display strings. Supports markdown including icons (`:material/home:`). Same behavior as `st.pills`. |

### Return Value

| Condition    | Return Value                                                                |
| ------------ | --------------------------------------------------------------------------- |
| Item clicked | `T` — the clicked item value (not the last item, which is non-clickable).   |
| No click     | `None`                                                                      |

### Behavior

- Items are displayed horizontally with the `separator` string between them (default `/`)
- The separator supports markdown including material icons (e.g., `:material/chevron_right:`)
- All items except the last are clickable links; the last item (current page) is displayed
  as plain text
- Clicking an item triggers a rerun and returns the clicked item value
- The widget uses proper accessibility semantics (`<nav>` with `aria-label`, ordered list,
  `aria-current="page"` on the last item)
- When `disabled=True`, all items appear as plain text (none are clickable)
- Long paths that overflow wrap to the next line or can be truncated (design TBD)

### Examples

**Basic usage:**

```python
import streamlit as st

clicked = st.breadcrumbs(["Home", "Electronics", "Phones", "iPhone 15"])

if clicked == "Home":
    st.switch_page("home.py")
elif clicked == "Electronics":
    st.switch_page("electronics.py")
elif clicked == "Phones":
    st.switch_page("phones.py")
# "iPhone 15" is current page, not clickable
```

**With icons:**

```python
import streamlit as st

clicked = st.breadcrumbs(
    ["home", "folder", "file"],
    format_func=lambda x: f":material/{x}: {x.title()}",
)
```

**With custom separator:**

```python
import streamlit as st

# Using a text separator
clicked = st.breadcrumbs(["Home", "Section", "Page"], separator=" > ")

# Using a material icon as separator
clicked = st.breadcrumbs(
    ["Home", "Section", "Page"],
    separator=":material/chevron_right:",
)
```

**With custom objects:**

```python
import streamlit as st

pages = [
    {"id": "home", "title": "Home", "path": "home.py"},
    {"id": "users", "title": "Users", "path": "users.py"},
    {"id": "detail", "title": "User Detail", "path": "detail.py"},
]

clicked = st.breadcrumbs(
    pages,
    format_func=lambda p: p["title"],
)

if clicked:
    st.switch_page(clicked["path"])
```

**With `st.Page` objects (future integration):**

```python
import streamlit as st

# When combined with st.navigation, st.Page objects can be used directly
home = st.Page("home.py", title="Home", icon=":material/home:")
section = st.Page("section.py", title="Section")
current = st.Page("current.py", title="Current Page")

clicked = st.breadcrumbs([home, section, current])

if clicked:
    st.switch_page(clicked)  # st.Page has url_path for navigation
```

### Edge Cases

- **Empty items**: Raises `StreamlitAPIException`
- **Single item**: Displays the item as non-clickable text (current page only)
- **Duplicate items**: Allowed; returns the exact item value clicked
- **Long item labels**: Truncated with ellipsis; full text shown on hover
- **Click on current (last) item**: Not clickable, returns `None`

---

## Design Options

### Option 1: Trigger-based widget (like `st.button`) ✅ PREFERRED

The proposal above follows this approach. The widget acts as a trigger: clicking an item
returns it once, then returns `None` on subsequent reruns until clicked again.

**Pros:**
- Consistent with `st.button` and `st.menu_button` patterns
- Simple mental model: click returns value
- Works naturally with `st.switch_page` for navigation

**Cons:**
- No persistent state (but breadcrumbs typically don't need it)

### Option 2: Selection-based widget (like `st.selectbox`)

The widget would maintain state and always return the currently selected/last item.

```python
current = st.breadcrumbs(["Home", "Section", "Page"], default="Page")
# Returns "Page" until user clicks another item
```

**Pros:**
- More like traditional widgets with persistent selection

**Cons:**
- Doesn't match typical breadcrumb UX (navigate away, don't select)
- Confusing: what does "selecting" a breadcrumb mean?
- Would need `default` parameter logic

### Option 3: Automatic page navigation

The widget would automatically call `st.switch_page` when an item with a `url_path` is
clicked (like when using `st.Page` objects).

```python
st.breadcrumbs([home_page, section_page, current_page])
# Automatically navigates when clicked, no return value needed
```

**Pros:**
- More convenient for multipage apps
- Tighter integration with `st.navigation`

**Cons:**
- Magic behavior that's harder to customize
- What if user wants to do something before/instead of navigation?
- Inconsistent with other widgets that return values

---

## Out of Scope (Future Work)

- **Automatic breadcrumb generation**: Automatically derive breadcrumbs from
  `st.navigation` page hierarchy. Requires changes to how `st.Page` tracks parent/child
  relationships. See [#5889](https://github.com/streamlit/streamlit/issues/5889).
- **Collapsible breadcrumbs**: For very long paths, collapse middle items into a dropdown
  (e.g., Home > ... > Current). Can add based on user feedback.
- **Structured data / SEO**: Output JSON-LD structured data for search engines. Not
  applicable for Streamlit apps.

---

## Checklist

| Item                       | ✅ or comment                                                  |
| -------------------------- | -------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ✅                                                             |
| No breaking API changes    | ✅                                                             |
| No new dependencies        | ✅                                                             |
| Metrics collected          | ✅                                                             |
| Any security/legal impact? | ✅ None                                                        |
| Any docs changes needed?   | ✅ Document new widget, add to navigation category in API docs |

---

## References

- **GitHub Issues:**
  - [#13147](https://github.com/streamlit/streamlit/issues/13147) — Add a breadcrumbs widget
  - [#5889](https://github.com/streamlit/streamlit/issues/5889) — Hierarchical multipage navigation
- **Design resources:**
  - [Component Gallery: Breadcrumbs](https://component.gallery/components/breadcrumbs/)
  - [WAI-ARIA Breadcrumb Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/)
