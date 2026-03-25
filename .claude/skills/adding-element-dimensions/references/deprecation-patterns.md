# Deprecation patterns for use_container_width

Detailed patterns for handling `use_container_width` deprecation when adding or modernizing dimension parameters.

## Scenario A: Element only had `use_container_width: bool`

Example: `st.plotly_chart`, `st.altair_chart`

The mapping is straightforward:

```python
if use_container_width is not None:
    show_deprecation_warning(
        make_deprecated_name_warning(
            "use_container_width",
            "width",
            "YYYY-MM-DD",
            "For `use_container_width=True`, use `width='stretch'`. "
            "For `use_container_width=False`, use `width='content'`.",
            include_st_prefix=False,
        ),
        show_in_browser=False,
    )
    if use_container_width:
        width = "stretch"
    else:
        width = "content"
```

### Test matrix

| `use_container_width` | `width` arg | Resolved width | width_spec |
|---|---|---|---|
| `True` | (any) | `"stretch"` | `use_stretch` |
| `False` | (any) | `"content"` | `use_content` |
| `None` (default) | `"stretch"` | `"stretch"` | `use_stretch` |
| `None` (default) | `"content"` | `"content"` | `use_content` |
| `None` (default) | `500` | `500` | `pixel_width` |

## Scenario B: Element had both `width: int | None` and `use_container_width: bool`

Example: `st.pydeck_chart`, `st.bar_chart`, `st.area_chart`

The key subtlety: when `use_container_width=False` and the user provided an integer `width`, preserve the integer rather than blindly converting to `"content"`.

```python
if use_container_width is not None:
    show_deprecation_warning(
        make_deprecated_name_warning(
            "use_container_width",
            "width",
            "YYYY-MM-DD",
            "For `use_container_width=True`, use `width='stretch'`. "
            "For `use_container_width=False`, use `width='content'` or specify an integer width.",
            include_st_prefix=False,
        ),
        show_in_browser=False,
    )
    if use_container_width:
        width = "stretch"
    elif not isinstance(width, int):
        width = "content"
    # else: keep the integer width as-is
```

### Test matrix

| `use_container_width` | `width` arg | Resolved width | width_spec |
|---|---|---|---|
| `True` | `"stretch"` (default) | `"stretch"` | `use_stretch` |
| `True` | `500` | `"stretch"` | `use_stretch` |
| `False` | `"stretch"` (default) | `"content"` | `use_content` |
| `False` | `"content"` | `"content"` | `use_content` |
| `False` | `500` | `500` | `pixel_width` |
| `None` (default) | `"stretch"` | `"stretch"` | `use_stretch` |
| `None` (default) | `"content"` | `"content"` | `use_content` |
| `None` (default) | `500` | `500` | `pixel_width` |

## Elements with native chart dimensions

Some chart libraries (e.g., pydeck) specify their own width/height. When `width="content"` is used with such elements, the implementation may extract the chart's native dimension and convert it to a pixel value. See `st.pydeck_chart` in `lib/streamlit/elements/deck_gl_json_chart.py` for this pattern.
