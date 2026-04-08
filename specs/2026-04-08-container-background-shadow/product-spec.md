---
author: lukasmasuch
created: 2026-04-08
---

# Add `background` and `shadow` parameters to `st.container`

## Summary

Add two boolean parameters to `st.container`: `background: bool = False` and `shadow: bool = False`. When `background=True`, the container displays with the theme's secondary background color and inverts child element colors (similar to sidebar behavior). When `shadow=True`, the container displays with a subtle box shadow. Together, these enable the classic dashboard look of white cards on a gray background.

## Problem

Users want to create visually distinct dashboard layouts with cards that stand out from the page background. Currently, `st.container` only supports `border=True` to visually separate content, but borders alone often make dashboards look "busy" and cluttered.

**User requests:**

- [#10531](https://github.com/streamlit/streamlit/issues/10531) — Background color for `st.container`
- [#12418](https://github.com/streamlit/streamlit/issues/12418) — Ability to set background of st.container (or perhaps support for cards)

**Use cases:**

- **Dashboard cards**: White cards on a gray background for a clean, modern dashboard look
- **Callout sections**: Visually highlight important content areas
- **Grouped content**: Visually separate related elements without heavy borders
- **Card-based layouts**: Create card grids similar to popular dashboard frameworks

**Current workarounds:**

Users resort to custom CSS via `st.html` or `st.markdown` with `unsafe_allow_html=True`, which is fragile, hard to maintain, and doesn't integrate with Streamlit's theming.

## Proposal

### API

```python
st.container(
    ...,
    background: bool = False,  # NEW
    shadow: bool = False,      # NEW
)
```

### Parameters

| Parameter    | Type   | Default | Description |
|--------------|--------|---------|-------------|
| `background` | `bool` | `False` | Whether to show a background color. When `True`, uses the theme's secondary background color and inverts colors for child elements (similar to sidebar behavior). |
| `shadow`     | `bool` | `False` | Whether to show a box shadow around the container. |

### Behavior

**`background=False` (default):**

- Container has no visible background (transparent)
- Child elements use their normal theme colors

**`background=True`:**

- Container displays with `secondaryBackgroundColor` as its background
- Child elements inside the container swap their background colors (this is also how the sidebar works in its default setting):
  - Elements that normally use `backgroundColor` now use `secondaryBackgroundColor`
  - Elements that normally use `secondaryBackgroundColor` now use `backgroundColor`
- This creates the "white cards on gray background" effect when the page background is gray
- The color inversion is implemented via a ThemeProvider context, ensuring all child components (buttons, inputs, charts, etc.) automatically adapt

**`shadow=False` (default):**

- Container has no box shadow

**`shadow=True`:**

- Container displays with a subtle box shadow
- Shadow intensity adapts to light/dark theme for appropriate contrast
- On dark backgrounds where shadows are less visible, a subtle border is automatically added to maintain visual separation (consistent with popover menu behavior)

**Visual styling when `background=True` or `shadow=True`:**

- Adds padding (same as `border=True`) to prevent content from touching edges
- Adds border-radius for rounded corners (same as `border=True`)
- These visual styles stack with `border=True` if both are set

**Combination behavior:**

All three parameters (`border`, `background`, `shadow`) can be combined:

```python
# Just border (existing behavior)
st.container(border=True)

# Just background (new)
st.container(background=True)

# Just shadow (new)
st.container(shadow=True)

# Card with background and shadow (common dashboard pattern)
st.container(background=True, shadow=True)

# All three combined
st.container(border=True, background=True, shadow=True)
```

### Examples

**Dashboard with card layout:**

```python
import streamlit as st

st.set_page_config(layout="wide")

# KPI row with card styling
cols = st.columns(4)
for i, col in enumerate(cols):
    with col:
        with st.container(background=True, shadow=True):
            st.metric(f"Metric {i+1}", value=f"{100+i*10}")

# Main content area
left, right = st.columns([2, 1])

with left:
    with st.container(background=True, shadow=True, height=400):
        st.subheader("Chart")
        st.line_chart({"data": [1, 5, 2, 6, 2, 1]})

with right:
    with st.container(background=True, shadow=True, height=400):
        st.subheader("Recent Activity")
        st.dataframe({"A": [1, 2, 3], "B": [4, 5, 6]})
```

**Subtle card without shadow:**

```python
import streamlit as st

# Just background, no shadow - more subtle appearance
with st.container(background=True):
    st.write("This content has a subtle background distinction")
```

**Helper function for consistent cards:**

```python
import streamlit as st
from contextlib import contextmanager

@contextmanager
def card(**kwargs):
    """Create a card with consistent styling."""
    with st.container(background=True, shadow=True, **kwargs):
        yield

# Usage
with card(height=200):
    st.metric("Revenue", "$1.2M", "+12%")
```

### Edge cases

- **Nested containers with `background=True`**: Each container applies its own theme inversion. A nested `background=True` container inside another `background=True` container will swap colors again, effectively returning to the original colors.
- **Sidebar containers**: Containers in the sidebar already use secondary background colors. Setting `background=True` will invert to primary background, which may or may not be the desired effect.
- **Charts and visualizations**: Charts will automatically adapt their background to match the container's theme context, ensuring proper visual integration.
- **Custom components**: Third-party components that don't use Streamlit's theme context may not adapt their colors automatically.

## Future considerations

The following are explicitly **out of scope** for this initial implementation but may be considered later:

**Arbitrary background colors:**

```python
# NOT in this spec - potential future extension
st.container(background="blue")  # Named color
st.container(background="#FF5733")  # Hex color
```

Allowing arbitrary colors introduces complexity around ensuring child element colors work well with the chosen background. The boolean approach sidesteps this by always using the theme's secondary background, which is designed to work with all elements.

**Theming for containers:**

```python
# NOT in this spec - potential future extension
st.container(theme={"background_color": "white", "primary_color": "green"})
```

A more powerful but complex approach that would allow full theme customization per container.

**Shadow sizes:**

```python
# NOT in this spec - potential future extension
st.container(shadow="small" | "medium" | "large")
```

Multiple shadow intensities could be added later if users request more control.

**`st.card` command:**

A dedicated `st.card()` command that defaults to `background=True, shadow=True` styling was considered. However, extending `st.container` with these parameters provides the same functionality without adding a new command. A future `st.card` could be added for image cards or other specialized use cases.

**Extending to other elements:**

The same `background` and `shadow` parameters could be added to:
- `st.form`
- `st.columns` (via `st.column`)
- `st.expander`
- `st.metric` (already has `border`)

This is out of scope for the initial implementation but follows naturally if the `st.container` implementation proves successful.

## Checklist

| Item                         | ✅ or comment                                                    |
|------------------------------|------------------------------------------------------------------|
| Works on SiS, Cloud, etc?    | ✅ Pure frontend styling, no platform-specific behavior          |
| No breaking API changes      | ✅ New optional parameters with backward-compatible defaults     |
| No new dependencies          | ✅ Uses existing theme infrastructure and ThemeProvider          |
| Metrics collected            | ✅ Parameter usage tracked via existing `gather_metrics`         |
| Any security/legal impact?   | ✅ No security implications                                      |
| Any docs changes needed?     | ✅ Document new parameters with examples                         |
