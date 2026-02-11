---
author: lukasmasuch
created: 2025-02-11
status: Draft
---

# Page visibility parameter for `st.Page`

## Summary

Add a `visibility` parameter to `st.Page` that controls whether a page appears in
the navigation menu. When set to `"hidden"`, the page remains accessible via direct
URL or `st.page_link` but is not displayed in the sidebar or top navigation.

## Problem

Users need to create pages that are accessible via URL but should not appear in the
navigation menu. Common use cases include:

- **Detail/drill-down pages**: Pages that show item details, accessed via
  `st.page_link` from a list view, but shouldn't clutter the navigation menu
- **Dynamic routing**: Pages that represent different states or views that users
  navigate to programmatically rather than through the menu
- **Admin/internal pages**: Pages that should only be accessible to users who know
  the URL or are directed there via a link
- **Onboarding/wizard flows**: Multi-step flows where navigation should be controlled
  by the app logic, not user navigation

**Requests:**

- [#10738](https://github.com/streamlit/streamlit/issues/10738) — Feature request for
  hidden navigation pages (21+ upvotes)
- [#9195](https://github.com/streamlit/streamlit/issues/9195) — Duplicate request
  (marked as duplicate of #10738)

**Current workarounds:**

Users currently have no clean way to achieve this. The only options are:

1. Use `st.navigation(pages, position="hidden")` which hides **all** pages from
   navigation, not individual ones
2. Dynamically modify the pages list to exclude hidden pages, but this breaks URL
   access since excluded pages aren't registered with `st.navigation`

## Proposal

### API

Add a new `visibility` parameter to `st.Page`:

```python
st.Page(
    page: str | Path | Callable[[], None],
    *,
    title: str | None = None,
    icon: str | None = None,
    url_path: str | None = None,
    default: bool = False,
    visibility: Literal["visible", "hidden"] = "visible",  # NEW
) -> StreamlitPage
```

Note: The `visibility` is stored internally but not exposed as a public property on
`StreamlitPage`. Users set it at page creation time and don't need to read it back.

### Parameters

| Parameter    | Type                              | Default     | Description                                                                        |
| ------------ | --------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `visibility` | `Literal["visible", "hidden"]`    | `"visible"` | Controls whether the page appears in the navigation menu.                          |

**Parameter naming rationale:**

The parameter name `visibility` with values `"visible"` and `"hidden"` was chosen to:

1. Align with existing Streamlit conventions:
   - `label_visibility` on widgets uses `"visible"`, `"hidden"`, `"collapsed"`
   - `st.navigation(..., position="hidden")` uses `"hidden"` to hide the entire nav
2. Be clear and self-documenting
3. Allow future extensibility (e.g., `"collapsed"` for a different display mode)

### Behavior

- **`visibility="visible"` (default)**: Page appears in the navigation menu as usual
- **`visibility="hidden"`**: Page is excluded from the navigation menu but:
  - Remains accessible via direct URL navigation
  - Can be linked to via `st.page_link`
  - Can be set as the current page via `st.switch_page`
  - Participates in `st.navigation` page resolution (URL matching)

**Important behaviors:**

1. **Hidden pages can be default**: A hidden page can have `default=True`. In this
   case, the page loads at the root URL but doesn't appear in navigation. This is
   useful for landing pages that redirect elsewhere or pages that are only shown
   conditionally.

2. **Navigation with all hidden pages**: If all pages have `visibility="hidden"`,
   the navigation menu is not displayed (equivalent to `position="hidden"` on
   `st.navigation`).

3. **Section handling**: Hidden pages don't affect section rendering. If all pages
   in a section are hidden, that section header is not displayed.

### Examples

**Basic hidden page:**

```python
import streamlit as st

# Define pages - detail page is hidden from navigation
pages = [
    st.Page("home.py", title="Home", icon=":material/home:"),
    st.Page("list.py", title="Items", icon=":material/list:"),
    st.Page("detail.py", title="Item Detail", visibility="hidden"),
]

pg = st.navigation(pages)
pg.run()
```

**Accessing hidden page via page_link:**

```python
# In list.py
import streamlit as st

st.title("Items")

for item in get_items():
    col1, col2 = st.columns([3, 1])
    col1.write(item["name"])
    col2.page_link("detail.py", label="View", icon=":material/open_in_new:")
```

**Hidden default page for conditional routing:**

```python
import streamlit as st

# Landing page is hidden - users are routed elsewhere based on state
pages = [
    st.Page("landing.py", title="Welcome", default=True, visibility="hidden"),
    st.Page("dashboard.py", title="Dashboard", icon=":material/dashboard:"),
    st.Page("settings.py", title="Settings", icon=":material/settings:"),
]

pg = st.navigation(pages)
pg.run()
```

```python
# In landing.py
import streamlit as st

if st.session_state.get("onboarded"):
    st.switch_page("dashboard.py")
else:
    st.title("Welcome! Let's get you set up...")
    # Onboarding flow...
```

**Sections with some hidden pages:**

```python
import streamlit as st

pages = {
    "Main": [
        st.Page("home.py", title="Home"),
        st.Page("about.py", title="About"),
    ],
    "Admin": [
        st.Page("admin.py", title="Admin Panel"),
        st.Page("admin_detail.py", title="Admin Detail", visibility="hidden"),
    ],
}

# Navigation shows: Main (Home, About), Admin (Admin Panel)
# admin_detail.py is accessible via URL but not shown
pg = st.navigation(pages)
pg.run()
```

### Edge Cases

| Scenario                              | Behavior                                                      |
| ------------------------------------- | ------------------------------------------------------------- |
| All pages hidden                      | Navigation menu not displayed                                 |
| All pages in a section hidden         | Section header not displayed                                  |
| Hidden page with `default=True`       | Allowed; page loads at root URL but not shown in nav          |
| Single visible page + hidden pages    | Navigation menu not displayed (same as single page)           |
| Invalid visibility value              | Raises `StreamlitAPIException`                                |
| Navigating to hidden page via URL     | Page loads normally                                           |
| `st.switch_page` to hidden page       | Works normally                                                |

## Checklist

| Item                       | ✅ or comment                                                  |
| -------------------------- | -------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ✅                                                             |
| No breaking API changes    | ✅ New optional parameter with backward-compatible default     |
| No new dependencies        | ✅                                                             |
| Metrics collected          | ✅ Existing `Page` metrics sufficient                          |
| Any security/legal impact? | ✅ No impact - hidden pages are still accessible via URL       |
| Any docs changes needed?   | ✅ Document new parameter in `st.Page` API reference           |
