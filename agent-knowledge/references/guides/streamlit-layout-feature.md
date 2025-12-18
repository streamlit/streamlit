---
status: stable
last_updated: 2025-11-05
---

# Overview

This document includes details of the implementation of the layout feature for Streamlit.

The layout feature includes:

- Width parameters for widgets and elements.
- Height parameters for widgets and elements.
- A container element for flexbox layouts (st.container).

The layout system is still under development and some elements may still use an older style or may not have all of the described features implemented.

# Description of Expected Behaviour

## Width

All Streamlit elements have a width parameter that allows users developing layouts to configure its width.

Elements support a subset of the modes or all of them.
There are three modes:

1. Stretch

When the width on an element is set to "stretch", the element should expand to fill available horizontal space according to these rules:

- The element's display width should not exceed the width of its parent container.

Examples:

```python
import streamlit as st
import numpy as np
from numpy import typing as npt

img: npt.NDArray[np.int64] = np.repeat(0, 75000).reshape(300, 250)
with st.container(horizontal=True, key="horizontal_parent_container", width=300):
  # The width of this image should expand to fill the horizontal_parent_container (minus some padding).
  # The width of this image should never be more than 300px because that is the width of the parent.
  st.image(img, width="stretch")
```

- When the element is in a row inside a horizontal container, space should be shared with other elements.

Examples:

```python
import streamlit as st
import numpy as np
from numpy import typing as npt

img: npt.NDArray[np.int64] = np.repeat(0, 75000).reshape(300, 250)
with st.container(horizontal=True, key="horizontal_parent_container"):
  # The image and the markdown element should share the space equally. At typical screen widths, we expect to see
  # both elements on one row.
  st.image(img, width="stretch")
  # st.markdown will have internal whitespace on wide screens.
  st.markdown("HELLO DARLING", width="stretch")
```

2. Content

When the width on an element is set to "content", the width of the element should be based on the contents of the element.

3. Integer

When an integer width is provided, the element will be that width in pixels.

## Height

All Streamlit elements have a height parameter that allows users developing layouts to configure its height.

Elements support a subset of the available modes or all of them.
The modes are:

1. Stretch

When the height on an element is set to "stretch", the element should expand to fill available vertical space according to these rules:

- The element's display height should not exceed the height of its parent container.

Examples:

```python
with st.container(key="vertical_parent_container", height=300):
 # The height of the text area should expand to fill the parent container (minus some padding).
 # The height of the text area should never be more than 300px because that is the height of the parent container.
  st.text_area("enter your message here", height="stretch")
```

- When the element is in a column inside a vertical container, space should be shared with other elements.

Examples:

```python
with st.container(key="vertical_parent_container", height=400):
  # The text area and code block should share the vertical space equally.
  st.text_area("Enter your message here", height="stretch")
  # The code block will also stretch to share remaining space.
  st.code("print('Additional content below')", height="stretch")
```

2. Content

When the height on an element is set to "content", the height of the element should be based on the contents of the element.

3. Integer

When an integer height is provided, the element will be that height in pixels.

4. Auto

Some elements have this mode which indicates customized behavior for the element. This mode is only available for specific elements that display data tables.

Examples:

- `st.dataframe` and `st.data_editor` support this height mode. When `height="auto"` (the default), these elements automatically size their height to show at most 10 rows of data, optimizing the display for the dataset size.

# Technical Implementation Details

## Architecture Flow

- Python API → Proto messages → Frontend CSS

**Key Implementation Layers:**

- **Python**: `lib/streamlit/elements/`, `lib/streamlit/delta_generator.py`
- **Proto**: `proto/streamlit/proto/{Element,WidthConfig,HeightConfig}.proto`
- **Frontend**: `frontend/lib/src/components/core/{Block,Layout}/` (ElementNodeRenderer, StyledElementContainerLayoutWrapper, useLayoutStyles)

## Python Layer

The API is provided to the user in the python function corresponding to the element.

Example:

```python
 def metric(
     # ... other parameters ...
     *,
     # ... other keyword-only parameters ...
     width: Width = "stretch",
     height: Height = "content",
     # ... other keyword-only parameters ...
 ) -> DeltaGenerator:
```

The width and height are validated using common utility functions, then a LayoutConfig object is
created and provided to the `_enqueue` method on the Delta Generator.

        validate_height(height, allow_content=True)
        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width, height=height)

        return self.dg._enqueue("metric", metric_proto, layout_config=layout_config)

In `_enqueue`, the layout config is converted to proto messages:

```python
if layout_config:
    if layout_config.height is not None:
        msg.delta.new_element.height_config.CopyFrom(
            get_height_config(layout_config.height)
        )
    if layout_config.width is not None:
        msg.delta.new_element.width_config.CopyFrom(
            get_width_config(layout_config.width)
        )
```

The `get_height_config` and `get_width_config` utility functions convert the Python string/int values into the appropriate proto message structure.

## Proto Messages

Proto messages communicate layout preferences from Python to frontend. The layout system uses three related messages:

```protobuf
// Element contains layout config fields
message Element {
  optional streamlit.HeightConfig height_config = 57;
  optional streamlit.WidthConfig width_config = 58;
  // ... other element types ...
}

// Layout configuration messages (see CSS conversion table in useLayoutStyles section)
message WidthConfig {
  oneof width_spec {
    bool use_stretch = 1;
    bool use_content = 2;
    uint32 pixel_width = 3;
    float rem_width = 4;  // Used for literal sizes (e.g., st.space)
  }
}

message HeightConfig {
  oneof height_spec {
    bool use_stretch = 1;
    bool use_content = 2;
    uint32 pixel_height = 3;
    float rem_height = 4;  // Used for literal sizes (e.g., st.space)
  }
}
```

## Frontend Styling

Element node rendering is performed in `ElementNodeRenderer.tsx`.

During rendering, each element is wrapped in a `StyledElementContainerLayoutWrapper`. The layout styles are primarily applied to this wrapper container. Some elements require further stylings in their react components to implement the different height/width modes. Keeping the styling in the shared layers is preferred. Styles are computed in the hook `useLayoutStyles` based on the information provided in the proto files. This hook also implements backwards compatibly logic for previous versions of the proto messages.

### Element Rendering Flow

In `ElementNodeRenderer.tsx`, layout config is passed to elements and they're wrapped in the layout container:

```typescript
// Layout config passed to elements for custom internal styling
const elementProps = {
  widthConfig: node.element.widthConfig,
  heightConfig: node.element.heightConfig,
  // ... other props
}

// Elements wrapped in layout wrapper
<StyledElementContainerLayoutWrapper node={node}>
  <RawElementNodeRenderer {...props} />
</StyledElementContainerLayoutWrapper>
```

### Layout Wrapper Implementation

The `StyledElementContainerLayoutWrapper` applies element categories and overrides:

```typescript
// Element categories determine minimum widths in horizontal layouts
if (LARGE_STRETCH_BEHAVIOR.includes(node.element.type)) {
  minStretchBehavior = "14rem"; // Complex elements: charts, dataframes, media
} else if (MEDIUM_STRETCH_BEHAVIOR.includes(node.element.type)) {
  minStretchBehavior = "8rem"; // Form inputs: textInput, selectbox, slider
}
// Default: "fit-content" - elements shrink to natural content size

// Element-specific overrides (example: textArea stretch)
if (
  node.element.type === "textArea" &&
  node.element.heightConfig?.useStretch
) {
  styleOverrides = { height: "100%", flex: "1 1 8rem" };
}

// Apply layout styles
const styles = useLayoutStyles({
  element,
  styleOverrides,
  minStretchBehavior,
});
```

**Element Categories:**

- **LARGE_STRETCH_BEHAVIOR** (14rem minimum): Complex elements like `arrowDataFrame`, `plotlyChart`, `graphvizChart`, `video`, `fileUploader`, etc.
- **MEDIUM_STRETCH_BEHAVIOR** (8rem minimum): Form inputs like `textInput`, `selectbox`, `slider`, `textArea`, `numberInput`, etc.

These categories control the minimum flex-basis in horizontal layouts to prevent elements from shrinking too small when sharing space. They also provide min-width protection when elements are inside content-width containers.

### useLayoutStyles Hook

The `useLayoutStyles` hook (in `useLayoutStyles.ts`) converts proto config to CSS properties using these core patterns:

**Complete Proto to CSS Conversion (Default Behavior):**

| Proto Field                | Default CSS Properties                       | Context                                               |
| -------------------------- | -------------------------------------------- | ----------------------------------------------------- |
| `widthConfig.useStretch`   | `width: "100%"` + `flex: "1 1 ${minWidth}"`  | Horizontal layouts apply flex with element categories |
| `widthConfig.useContent`   | `width: "fit-content"`                       | Element shrinks to natural content size               |
| `widthConfig.pixelWidth`   | `width: "${pixels}px"`                       | Fixed width in pixels                                 |
| `heightConfig.useStretch`  | `height: "100%"` + `flex: "1 1 auto"`        | Vertical layouts apply flex properties                |
| `heightConfig.useContent`  | `height: "auto"`                             | Element uses natural content height                   |
| `heightConfig.pixelHeight` | `height: "${pixels}px"` + `overflow: "auto"` | Fixed height with scroll if needed                    |

**Min-Width Protection in Content-Width Containers:**

When an element with `width="stretch"` is inside a content-width container (tracked via `FlexContext.isInContentWidthContainer`), min-width is automatically applied using the `minStretchBehavior` value. This prevents elements from becoming too narrow when the container shrinks to fit its content.

The min-width respects parent container constraints (via `calculateMinWidthWithParentConstraint`) to avoid overflow issues.

**Element-Specific Overrides:** Some elements modify these defaults in `StyledElementContainerLayoutWrapper` (see Layout Wrapper examples above for specific cases like `textArea` stretch mode).

**Backwards Compatibility:** Supports older proto formats through `subElement` parameter for cached messages.

# Debugging

## Common Failure Modes

1. Height not stretching correctly.

The element height does not fill the parent container height, instead it fits the content.

Look for:

- HTML elements interior to the component that may need `height: 100%` to stretch.
- If it is a graph it may need the container height provided to the graphing library. The `useCalculatedDimensions` hook (in `frontend/lib/src/hooks/useCalculatedDimensions.ts`) can be utilized to measure the container height.
