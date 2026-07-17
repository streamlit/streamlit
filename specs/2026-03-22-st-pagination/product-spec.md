---
author: lukasmasuch
created: 2026-03-22
---

# Pagination widget

## Summary

Add a new `st.pagination` widget for navigating through pages of content. The widget
displays numbered page buttons with prev/next arrows and intelligent truncation for large
page counts. One page is always selected (stateful), and the widget returns the currently
selected page number.

![Pagination widget](./pagination-dark.png)

## Problem

Users need a standard way to paginate large datasets, search results, or content
collections. Currently, developers must build custom pagination UI using buttons or
selectboxes, which is error-prone and inconsistent across apps.

**Requests:**

- [#10785](https://github.com/streamlit/streamlit/issues/10785) — Add a pagination widget
  (5+ upvotes)

**Use cases:**

- Paginating database query results
- Navigating through search results
- Breaking up long lists or galleries into manageable chunks
- Multi-step wizards with numbered steps

**Current workarounds:**

```python
# Manual pagination with buttons and session state
if "page" not in st.session_state:
    st.session_state.page = 1

cols = st.columns([1, 1, 3, 1, 1])
if cols[0].button("⬅️ Prev") and st.session_state.page > 1:
    st.session_state.page -= 1
cols[2].write(f"Page {st.session_state.page} of {total_pages}")
if cols[4].button("Next ➡️") and st.session_state.page < total_pages:
    st.session_state.page += 1
```

This pattern is verbose, doesn't scale well visually, and lacks keyboard accessibility.

## Proposal

### API

```python
st.pagination(
    num_pages: int,
    *,
    default: int = 1,
    max_visible_pages: int | None = 7,
    width: Literal["content", "stretch"] | int = "content",
    key: Key | None = None,
    on_change: WidgetCallback | None = None,
    args: WidgetArgs | None = None,
    kwargs: WidgetKwargs | None = None,
    disabled: bool = False,
) -> int
```

### Parameters

| Parameter           | Type                                   | Default     | Description                                                                                                                                             |
| ------------------- | -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `num_pages`         | `int`                                  | required    | Total number of pages. Must be ≥ 1.                                                                                                                     |
| `default`           | `int`                                  | `1`         | Initial selected page (1-indexed). Must be between 1 and `num_pages`.                                                                                   |
| `max_visible_pages` | `int \| None`                          | `7`         | Maximum number of page buttons to display (excluding prev/next arrows). The widget auto-adapts to available width and may show fewer pages to prevent wrapping. Set to `None` to remove the explicit page-count cap (all pages are eligible to be shown; responsive auto-adaptation may still hide some). Set to 0 to show only prev/next arrows. |
| `width`             | `Literal["content", "stretch"] \| int` | `"content"` | Widget width. `"content"`: fit to content. `"stretch"`: expand to container width (buttons remain centered). `int`: fixed pixel width.                  |
| `key`               | `str \| int \| None`                   | `None`      | Unique key for the widget.                                                                                                                              |
| `on_change`         | `Callable \| None`                     | `None`      | Callback function executed when page changes.                                                                                                           |
| `args`              | `list \| tuple \| None`                | `None`      | Arguments to pass to the callback.                                                                                                                      |
| `kwargs`            | `dict \| None`                         | `None`      | Keyword arguments to pass to the callback.                                                                                                              |
| `disabled`          | `bool`                                 | `False`     | Whether the widget is disabled.                                                                                                                         |

### Return Value

| Condition       | Return Value                             |
| --------------- | ---------------------------------------- |
| Page selected   | `int` — the currently selected page (1-indexed) |

The widget always returns the current page. The return value updates on rerun after a
page change.

### Behavior

**Visual layout:**

```
  < | 1 | 2 | 3 | ... | 10 | >    (when on page 1-3)
  < | 1 | ... | 5 | 6 | 7 | ... | 10 | >    (when on page 6)
  < | 1 | ... | 8 | 9 | 10 | >    (when on page 8-10)
```

**Compact layouts** (with low `max_visible_pages`):

```
  < | >                          (max_visible_pages=0)
  < | 5 | >                      (max_visible_pages=1, current page only)
  < | 5 | ... | 10 | >           (max_visible_pages=2, current + last)
```

- Previous (`<`) and next (`>`) arrow buttons are always displayed at the ends
- When `max_visible_pages == 0`, only the arrows are shown (no numbered pages)
- When `max_visible_pages == 1`, only the current page number is shown between the arrows
- When `max_visible_pages == 2`, the current page and last page are shown (if current is the last page, first and last are shown instead)
- When `max_visible_pages >= 3`, the first page (1) and last page are always included along with the current page
- Ellipsis (`...`) indicates truncated page ranges
- Currently selected page is visually highlighted
- Numbers are 1-indexed (not 0-indexed) to match user expectations

**Navigation:**

- Clicking a page number selects that page
- Clicking prev/next moves by one page
- Previous arrow is disabled when on page 1
- Next arrow is disabled when on the last page
- Clicking an ellipsis does nothing (non-interactive)

**Truncation algorithm:**

When `num_pages` exceeds `max_visible_pages`, the widget intelligently shows:
- Always: first page, last page, and current page
- Context: 1-2 pages adjacent to the current selection
- Ellipsis: where pages are hidden

The exact truncation follows established patterns (Atlassian, Chakra UI, BaseWeb):
- Near start: `1 2 3 4 5 ... 20`
- In middle: `1 ... 5 6 7 ... 20`
- Near end: `1 ... 16 17 18 19 20`

**Keyboard accessibility:**

- Tab navigates between prev/next arrows and page buttons
- Enter/Space activates the focused button
- Focus ring is visible only during keyboard navigation (not on click)

**Responsive behavior:**

- The widget automatically adapts to the available container width
- Page buttons are never wrapped to a second line
- When space is limited, the widget progressively hides page numbers while preserving:
  1. Prev/next arrows (always visible)
  2. Current page (highest priority)
  3. Last page
  4. First page
  5. Adjacent context pages
- `max_visible_pages` acts as an upper bound; fewer pages may be shown if the container is narrow
- On very narrow containers, the widget may reduce to just `< | 5 | >` (current page only) or `< | >` (arrows only)

**State management:**

- The widget is stateful: it remembers the selected page across reruns
- If `num_pages` is reduced below the current page, the page resets to `default`
- Session state can be used to read/write the current page via `st.session_state[key]`
- `on_change` is triggered on the next rerun whenever the effective page value changes compared to the previous rerun
  - User interactions that select a different page always count as a page change
  - Programmatic updates to `st.session_state[key]` that change the stored page between reruns also count as page changes
  - When `num_pages` decreases and the current page exceeds the new `num_pages`, the page resets to `default`; this counts as a page change (and triggers `on_change`) **only if** the new page is different from the previous page
- `default` is applied only when no value is present in `st.session_state[key]`; once session state exists, it takes precedence over `default`
  - Changing `default` on a later rerun does **not** by itself change the current page or trigger `on_change` as long as `st.session_state[key]` already holds a value

### Examples

**Basic usage:**

```python
import streamlit as st

page = st.pagination(num_pages=10)
st.write(f"Showing page {page}")

# Display paginated content
items_per_page = 10
start = (page - 1) * items_per_page
end = start + items_per_page
for item in my_data[start:end]:
    st.write(item)
```

**With callback:**

```python
import streamlit as st

def on_page_change():
    st.toast(f"Navigated to page {st.session_state.current_page}")

page = st.pagination(
    num_pages=20,
    key="current_page",
    on_change=on_page_change,
)
```

**Paginated dataframe:**

```python
import streamlit as st
import pandas as pd

df = pd.read_csv("large_dataset.csv")
rows_per_page = 25
total_pages = (len(df) + rows_per_page - 1) // rows_per_page

page = st.pagination(num_pages=total_pages)

start_idx = (page - 1) * rows_per_page
end_idx = start_idx + rows_per_page
st.dataframe(df.iloc[start_idx:end_idx])
```

**Multi-step wizard:**

```python
import streamlit as st

steps = ["Personal Info", "Address", "Payment", "Review"]
step = st.pagination(num_pages=len(steps), width="stretch")

st.header(steps[step - 1])
# Render step content based on current step
```

**Programmatic page changes via session state:**

```python
import streamlit as st

# Jump to a specific page programmatically
if st.button("Go to page 5"):
    st.session_state.my_page = 5

# Reset to first page
if st.button("Reset"):
    st.session_state.my_page = 1

page = st.pagination(num_pages=10, key="my_page")
```

### Edge Cases

| Scenario                         | Behavior                                             |
| -------------------------------- | ---------------------------------------------------- |
| `num_pages < 1`                  | Raises `StreamlitAPIException`                       |
| `num_pages = 1`                  | Shows single page "1", both arrows disabled          |
| `default < 1` or `> num_pages`   | Raises `StreamlitAPIException`                       |
| `max_visible_pages = None`       | Removes explicit page-count cap; responsive auto-adaptation may still hide some pages |
| `max_visible_pages = 0`          | Shows only prev/next arrows (no page numbers)        |
| `max_visible_pages = 1`          | Shows only current page number                       |
| `max_visible_pages = 2`          | Shows current page and last page (first + last if current is at edge) |
| `max_visible_pages < 0`          | Raises `StreamlitAPIException`                       |
| `num_pages` decreases at runtime | Current page resets to `default` if it exceeds new `num_pages` |
| `num_pages` ≤ `max_visible_pages`| All pages shown, no ellipsis                         |

### Design

The widget should follow Streamlit's design language:

- Match the styling of other Streamlit widgets (borders, colors, spacing)
- Support light and dark themes
- Page buttons and ellipsis indicators use identical fixed widths (sized for 3-digit numbers) to prevent layout shift during navigation
- Selected page uses primary color highlighting
- Disabled state grays out all elements

## Alternatives Considered

**Option 1: `st.paginator` wrapper** (from GitHub issue)

```python
for item in st.paginator(orig_list, group_every=5, start_at_page=3):
    st.write(item)
```

Pros:
- More "magical" — handles slicing automatically
- Fewer lines of code for simple cases

Cons:
- Less flexible — only works with iterable data
- Unclear where pagination UI appears
- Doesn't work well with database queries or API calls where you don't have all data upfront
- Mixes data handling with UI rendering

**Option 2: Low-level `st.pagination` (proposed)** ✅ PREFERRED

Pros:
- Clear separation between UI and data
- Works with any data source (database, API, local data)
- Consistent with other Streamlit widgets
- User controls where UI appears

Cons:
- Requires manual data slicing

The low-level approach is more flexible and consistent with Streamlit's design principles.

## Out of Scope (Future Work)

- **Custom labels**: Ability to use custom labels instead of numbers (e.g., for wizard steps)
- **Jump to page input**: Text input to jump directly to a specific page
- **Items per page selector**: Dropdown to change how many items per page
- **Total count display**: Showing "Page 3 of 10" or "Items 21-30 of 100"
- **Keyboard shortcuts**: Global keyboard shortcuts (e.g., left/right arrows)

These features can be added in future iterations based on user feedback.

## Checklist

| Item                       | ✅ or comment                |
| -------------------------- | ---------------------------- |
| Works on SiS, Cloud, etc?  | ✅                           |
| No breaking API changes    | ✅ (new widget)              |
| No new dependencies        | ✅                           |
| Metrics collected          | ✅                           |
| Any security/legal impact? | ✅ None                      |
| Any docs changes needed?   | ✅ Document new widget       |
