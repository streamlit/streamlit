---
name: adding-element-dimensions
description: Adds or modernizes width/height dimension parameters on Streamlit elements. Covers LayoutConfig wiring, Width/Height types, use_container_width deprecation, proto field handling, and frontend layout integration. Use when adding width or height to any element, or converting old int-based dimensions to the new type system.
---

# Adding element dimensions

Add `width` and/or `height` parameters to a Streamlit element, or modernize existing `width: int | None` / `height: int | None` parameters to the unified `Width` / `Height` type system.

## Prerequisites

Read `wiki/new-feature-guide.md` for general implementation order (proto → backend → tests → frontend → E2E). This skill covers only the **dimension-specific** patterns on top of that guide.

## Identify the scenario

| Scenario | Starting state | Target |
|----------|---------------|--------|
| **A — New dimension** | Element has no `width`/`height` param (may have `use_container_width`) | Add `width: Width = "stretch"` and/or `height: Height = "content"` |
| **B — Modernize existing** | Element has `width: int \| None` / `height: int \| None` | Change to `Width` / `Height` type with string defaults |

Reference implementations:
- **Scenario A (width):** `st.plotly_chart` in `lib/streamlit/elements/plotly_chart.py`
- **Scenario B (both):** `st.line_chart` in `lib/streamlit/elements/vega_charts.py`
- **Scenario A (width with deprecation):** `st.image` in `lib/streamlit/elements/image.py`

## Step 1: Backend — types and imports

```python
from streamlit.elements.lib.layout_utils import (
    Height,
    LayoutConfig,
    Width,
    validate_height,
    validate_width,
)
from streamlit.deprecation_util import (
    make_deprecated_name_warning,
    show_deprecation_warning,
)
```

Defaults: `width: Width = "stretch"`, `height: Height = "content"`.

If the element has `use_container_width`, change it to `use_container_width: bool | None = None` for backward compatibility.

## Step 2: Backend — deprecation and validation

Place this at the start of the method body, before any other logic:

```python
# --- use_container_width deprecation (omit if element never had it) ---
if use_container_width is not None:
    show_deprecation_warning(
        make_deprecated_name_warning(
            "use_container_width",
            "width",
            "YYYY-MM-DD",  # Set removal date ~1 year out
            "For `use_container_width=True`, use `width='stretch'`. "
            "For `use_container_width=False`, use `width='content'`.",
            include_st_prefix=False,
        ),
        show_in_browser=False,
    )
    if use_container_width:
        width = "stretch"
    elif not isinstance(width, int):
        width = "content"
    # If width is already an int, preserve it

validate_width(width, allow_content=True)
validate_height(height, allow_content=True)
```

## Step 3: Backend — LayoutConfig and enqueue

Always create a `LayoutConfig` and pass it to `_enqueue`. Never conditionally omit it.

```python
layout_config = LayoutConfig(width=width, height=height)
return self.dg._enqueue("element_type", proto, layout_config=layout_config)
```

**Stop setting deprecated proto fields.** Remove lines like `proto.use_container_width = ...` or `proto.width = ...`. The layout system reads `WidthConfig` / `HeightConfig` from the `Element` wrapper, not from the element-specific proto.

## Step 4: Proto — mark deprecated fields

If the element proto has `use_container_width`, `width`, or `height` fields, mark them deprecated. This is a comment-only change — no recompile needed:

```protobuf
// DEPRECATED: Use widthConfig in Element layout configuration instead.
bool use_container_width = 5 [deprecated=true];
```

## Step 5: Frontend — update component (only if needed)

**Check first:** Search the React component for `element.useContainerWidth`. If not found, skip this step — the layout system handles everything via `StyledElementContainerLayoutWrapper` and `useLayoutStyles`.

If the component does read `element.useContainerWidth`:

```typescript
import { shouldWidthStretch } from "~lib/components/core/Layout/utils"

const useStretchWidth =
  shouldWidthStretch(widthConfig) || element.useContainerWidth
```

## Step 6: Docstrings

Width parameter:

```
width : "stretch", "content", or int
    How to size the element's width:

    - ``"stretch"`` (default): Expand to the width of the parent container.
    - ``"content"``: Size to fit contents, up to the parent container width.
    - An integer: Set width to this many pixels.
```

Height parameter:

```
height : "stretch", "content", or int
    How to size the element's height:

    - ``"content"`` (default): Size to fit contents.
    - ``"stretch"``: Expand to the height of the parent container.
    - An integer: Set height to this many pixels.
```

If `use_container_width` exists, add a `.. deprecated::` directive to its docstring pointing users to `width`.

## Step 7: Tests

### Unit tests

Test `element.width_config` / `element.height_config` on the enqueued element — never test deprecated proto fields.

```python
@parameterized.expand([
    ("stretch", "use_stretch", True),
    ("content", "use_content", True),
    (500, "pixel_width", 500),
])
def test_width(self, width, expected_spec, expected_value):
    st.element(data, width=width)
    el = self.get_delta_from_queue().new_element
    assert el.width_config.WhichOneof("width_spec") == expected_spec
    assert getattr(el.width_config, expected_spec) == expected_value
```

Test deprecation warnings:

```python
@patch("streamlit.elements.module_name.show_deprecation_warning")
def test_use_container_width_deprecation(self, mock_warn):
    st.element(data, use_container_width=True)
    mock_warn.assert_called_once()
    el = self.get_delta_from_queue().new_element
    assert el.width_config.WhichOneof("width_spec") == "use_stretch"
```

Test validation errors (`0`, `-1`, `"invalid"`) raise `StreamlitAPIException`.

### E2E tests

Add examples with `width="content"`, `width="stretch"`, `width=400`, and corresponding snapshot assertions. For `height="stretch"`, wrap in `st.container(height=500, key="stretch_test")` so the stretch is visible.

## Validation checklist

- [ ] `width: Width` / `height: Height` in signature and all overloads
- [ ] `validate_width` / `validate_height` called with `allow_content=True`
- [ ] `LayoutConfig` always passed to `_enqueue` (never conditional)
- [ ] Deprecated proto fields no longer set in Python
- [ ] Proto fields marked `[deprecated=true]` if they exist
- [ ] Frontend component updated only if it reads `element.useContainerWidth`
- [ ] Unit tests assert on `el.width_config` / `el.height_config`, not deprecated fields
- [ ] Deprecation warning tested when `use_container_width` is provided
- [ ] E2E test with snapshot for each dimension value
- [ ] `make check` passes

## Key files

| Concern | Path |
|---------|------|
| Types, validation, `get_*_config` | `lib/streamlit/elements/lib/layout_utils.py` |
| Proto definitions | `proto/streamlit/proto/WidthConfig.proto`, `HeightConfig.proto` |
| Element proto layout fields | `proto/streamlit/proto/Element.proto` (fields 57–58) |
| `_enqueue` layout copy | `lib/streamlit/delta_generator.py` |
| Frontend layout wrapper | `frontend/lib/src/components/core/Block/StyledElementContainerLayoutWrapper.tsx` |
| Frontend dimension → CSS | `frontend/lib/src/components/core/Layout/useLayoutStyles.ts` |
| `shouldWidthStretch` helper | `frontend/lib/src/components/core/Layout/utils.ts` |
