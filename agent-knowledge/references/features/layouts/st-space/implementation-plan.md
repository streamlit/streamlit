---
status: stable
last_updated: 2025-11-05
---

# Implementation Plan for `st.space`

## Overview

The `st.space` command adds vertical or horizontal spacing to Streamlit apps. It automatically adapts based on container direction (vertical → height, horizontal → width) and supports pixel values, "stretch", and rem-based literal sizes ("small", "medium", "large").

---

## 1. **Proto Layer** (Foundation)

### 1.1 Extend Width/HeightConfig to Support Rem Values

**Files to modify:**

- `proto/streamlit/proto/WidthConfig.proto`
- `proto/streamlit/proto/HeightConfig.proto`

**Changes:**

```protobuf
// WidthConfig.proto
message WidthConfig {
  oneof width_spec {
    bool use_stretch = 1;
    bool use_content = 2;
    uint32 pixel_width = 3;
    float rem_width = 4;  // NEW: Support rem values
  }
}

// HeightConfig.proto
message HeightConfig {
  oneof height_spec {
    bool use_stretch = 1;
    bool use_content = 2;
    uint32 pixel_height = 3;
    float rem_height = 4;  // NEW: Support rem values
  }
}
```

**Rationale:** Per the spec note, we need rem support in WidthConfig/HeightConfig to handle "small" (0.75rem), "medium" (2.5rem), "large" (4.25rem) size literals.

### 1.2 Create Space Proto Message

**New file:** `proto/streamlit/proto/Space.proto`

```protobuf
/**!
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

syntax = "proto3";

option java_package = "com.snowflake.apps.streamlit";
option java_outer_classname = "SpaceProto";

package streamlit;

// A space element for adding vertical or horizontal spacing.
// Layout is controlled via Element.width_config and Element.height_config.
message Space {
  // Space element has no content - layout is controlled via
  // Element.width_config and Element.height_config
}
```

**Rationale:** Following the Empty element pattern - simple message with no fields since all sizing is handled via layout configs.

### 1.3 Register Space in Element.proto

**File:** `proto/streamlit/proto/Element.proto`

**Changes:**

```protobuf
import "streamlit/proto/Space.proto";  // Add import at top with other imports

message Element {
  // ... existing fields ...

  oneof type {
    // ... existing elements ...
    Space space = 60;  // Add new element type (next available ID)
    // Next ID: 61
  }
}
```

### 1.4 Compile Protobufs

**Command:** `make protobuf` (from repo root)

---

## 2. **Python Backend Layer**

### 2.1 Extend layout_utils for Rem Support

**File:** `lib/streamlit/elements/lib/layout_utils.py`

**Changes:**

1. **Add Size type alias:**

```python
Size: TypeAlias = Union[int, Literal["stretch", "small", "medium", "large"]]
```

2. **Add validation function:**

```python
def validate_size(size: Size) -> None:
    """Validate the size parameter for st.space.

    Parameters
    ----------
    size : Any
        The size value to validate.

    Raises
    ------
    StreamlitInvalidSizeError
        If the size value is invalid.
    """
    if not isinstance(size, (int, str)):
        raise StreamlitInvalidSizeError(size)

    if isinstance(size, str):
        valid_strings = ["stretch", "small", "medium", "large"]
        if size not in valid_strings:
            raise StreamlitInvalidSizeError(size)
    elif isinstance(size, int) and size <= 0:
        raise StreamlitInvalidSizeError(size)
```

3. **Add size-to-rem mapping:**

```python
SIZE_TO_REM_MAPPING = {
    "small": 0.75,   # Height of widget label minus gap
    "medium": 2.5,   # Height of button/input field
    "large": 4.25,   # Height of large widget without label
}
```

4. **Update get_width_config and get_height_config:**

```python
def get_width_config(width: Width | Size) -> WidthConfig:
    width_config = WidthConfig()
    if isinstance(width, str) and width in SIZE_TO_REM_MAPPING:
        width_config.rem_width = SIZE_TO_REM_MAPPING[width]
    elif isinstance(width, int):
        width_config.pixel_width = width
    elif width == "content":
        width_config.use_content = True
    else:
        width_config.use_stretch = True
    return width_config

def get_height_config(height: Height | Size) -> HeightConfig:
    height_config = HeightConfig()
    if isinstance(height, str) and height in SIZE_TO_REM_MAPPING:
        height_config.rem_height = SIZE_TO_REM_MAPPING[height]
    elif isinstance(height, int):
        height_config.pixel_height = height
    elif height == "content":
        height_config.use_content = True
    else:
        height_config.use_stretch = True
    return height_config
```

5. **Add StreamlitInvalidSizeError to errors.py:**

```python
class StreamlitInvalidSizeError(StreamlitAPIException):
    """Raised when an invalid size value is provided."""
    # Implementation following pattern of StreamlitInvalidWidthError
```

### 2.2 Create Space Element Implementation

**New file:** `lib/streamlit/elements/space.py`

```python
# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

from typing import TYPE_CHECKING, Union

from typing_extensions import Literal

from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    Size,
    validate_size,
)
from streamlit.proto.Space_pb2 import Space as SpaceProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class SpaceMixin:
    @gather_metrics("space")
    def space(
        self,
        size: Size = "small",
    ) -> DeltaGenerator:
        """Add vertical or horizontal space.

        `st.space` adds space in the direction of its parent container. In
        a vertical layout, it adds vertical space (controlled by height).
        In a horizontal layout, it adds horizontal space (controlled by width).

        Parameters
        ----------
        size : "small", "medium", "large", "stretch", or int
            The size of the space. Can be:

            - ``"small"`` (default): 0.75rem - Height of a widget label minus gap.
              Useful for aligning buttons with labeled widgets.
            - ``"medium"``: 2.5rem - Height of a button or input field.
            - ``"large"``: 4.25rem - Height of a large widget without a label.
            - ``"stretch"``: Expands to fill remaining space in the container.
            - An integer: Fixed size in pixels.

        Returns
        -------
        DeltaGenerator
            Can be used with the `with` notation to place elements inside the space
            (though this is typically not useful).

        Example
        -------
        Add small vertical space between elements:

        >>> import streamlit as st
        >>>
        >>> st.write("First element")
        >>> st.space()  # Adds small vertical space
        >>> st.write("Second element")

        Add horizontal space in a container:

        >>> with st.container(horizontal=True):
        ...     st.button("Left")
        ...     st.space("stretch")  # Pushes button to left, next to right
        ...     st.button("Right")

        Use different space sizes:

        >>> st.write("Content")
        >>> st.space("medium")  # 2.5rem vertical space
        >>> st.write("More content")
        >>> st.space(100)  # 100px vertical space
        >>> st.write("Final content")

        Align buttons with labeled widgets:

        >>> with st.container(horizontal=True):
        ...     st.text_input("Name")
        ...     st.space("small")  # Aligns with input field
        ...     st.button("Submit")
        """
        space_proto = SpaceProto()

        validate_size(size)

        # In vertical layouts, size controls height.
        # In horizontal layouts, size controls width.
        # We set both width and height configs to the same size value.
        # The frontend uses FlexContext to determine container direction and
        # applies ONLY the relevant dimension (width for horizontal, height for vertical)
        # to avoid unintended cross-axis spacing.
        layout_config = LayoutConfig(width=size, height=size)

        return self.dg._enqueue("space", space_proto, layout_config=layout_config)
```

**Key design decisions:**

- Size is a positional parameter (per spec)
- Default is "small" (per spec)
- We set both width and height configs to the same size value (both sent over wire)
- Frontend uses FlexContext to apply ONLY the relevant dimension (width XOR height) to avoid cross-axis interference
- Comprehensive docstring with examples following Numpydoc style

### 2.3 Register Space in DeltaGenerator

**File:** `lib/streamlit/__init__.py`

Add import and mixin (following existing patterns for other elements):

- Import `SpaceMixin` from `streamlit.elements.space`
- Add `SpaceMixin` to the `DeltaGenerator` class inheritance list

---

## 3. **Frontend Layer**

### 3.1 Update useLayoutStyles Hook

**File:** `frontend/lib/src/components/core/Layout/useLayoutStyles.ts`

**Changes:**

1. **Update DimensionType enum:**

```typescript
enum DimensionType {
  STRETCH = "stretch",
  CONTENT = "content",
  PIXEL = "pixel",
  REM = "rem", // NEW
}
```

2. **Update LayoutDimensionConfig type:**

```typescript
type LayoutDimensionConfig = {
  type: DimensionType | undefined;
  pixels?: number | undefined;
  rem?: number | undefined; // NEW: Support rem values
};
```

3. **Update getWidth function:**

```typescript
const getWidth = (
  element: Element | BlockProto,
  // subElement supports older config where the width is set on the lower
  // level element.
  subElement?: SubElement
): LayoutDimensionConfig => {
  // We need to support old width configurations for backwards compatibility,
  // since some integrations cache the messages and we want to ensure that the FE
  // can still support old message formats.
  let pixels: number | undefined;
  let rem: number | undefined;
  let type: DimensionType | undefined;

  const isStretch =
    element.widthConfig?.useStretch || subElement?.widthConfig?.useStretch;
  const isContent =
    element?.widthConfig?.useContent || subElement?.widthConfig?.useContent;
  const isPixel =
    element?.widthConfig?.pixelWidth ||
    subElement?.widthConfig?.pixelWidth ||
    element.widthConfig?.pixelWidth === 0;
  const isRem = element.widthConfig?.remWidth; // NEW

  if (isStretch) {
    type = DimensionType.STRETCH;
  } else if (isContent) {
    type = DimensionType.CONTENT;
  } else if (isRem && isPositiveNumber(element.widthConfig?.remWidth)) {
    // NEW: Handle rem width
    type = DimensionType.REM;
    rem = element.widthConfig?.remWidth;
  } else if (isPixel && isPositiveNumber(element.widthConfig?.pixelWidth)) {
    type = DimensionType.PIXEL;
    pixels = element.widthConfig?.pixelWidth;
  } else if (
    isPixel &&
    isPositiveNumber(subElement?.widthConfig?.pixelWidth)
  ) {
    type = DimensionType.PIXEL;
    pixels = subElement?.widthConfig?.pixelWidth;
  } else if (
    isNonZeroPositiveNumber(subElement?.width) &&
    !element.widthConfig
  ) {
    pixels = subElement?.width;
    type = DimensionType.PIXEL;
  }
  // The current behaviour is for useContainerWidth to take precedence over
  // width, see arrow.py for reference.
  if (subElement?.useContainerWidth) {
    type = DimensionType.STRETCH;
  }
  return { pixels, rem, type };
};
```

4. **Update getHeight function similarly:**

```typescript
const getHeight = (
  element: Element | BlockProto,
  subElement?: SubElement
): LayoutDimensionConfig => {
  let pixels: number | undefined;
  let rem: number | undefined;
  let type: DimensionType | undefined;

  const isStretch =
    element.heightConfig?.useStretch || subElement?.heightConfig?.useStretch;
  const isContent =
    element.heightConfig?.useContent || subElement?.heightConfig?.useContent;
  const isPixel =
    element.heightConfig?.pixelHeight ||
    subElement?.heightConfig?.pixelHeight ||
    element.heightConfig?.pixelHeight === 0;
  const isRem = element.heightConfig?.remHeight; // NEW

  if (isStretch) {
    type = DimensionType.STRETCH;
  } else if (isContent) {
    type = DimensionType.CONTENT;
  } else if (isRem && isPositiveNumber(element.heightConfig?.remHeight)) {
    // NEW: Handle rem height
    type = DimensionType.REM;
    rem = element.heightConfig?.remHeight;
  } else if (isPixel && isPositiveNumber(element.heightConfig?.pixelHeight)) {
    type = DimensionType.PIXEL;
    pixels = element.heightConfig?.pixelHeight;
  } else if (
    isPixel &&
    isPositiveNumber(subElement?.heightConfig?.pixelHeight)
  ) {
    type = DimensionType.PIXEL;
    pixels = subElement?.heightConfig?.pixelHeight;
  } else if (
    isNonZeroPositiveNumber(subElement?.height) &&
    !element.heightConfig
  ) {
    pixels = subElement?.height;
    type = DimensionType.PIXEL;
  }

  return { pixels, rem, type };
};
```

5. **Update CSS generation in useLayoutStyles hook:**

```typescript
// In the main useLayoutStyles function, update width handling:
if (widthConfig.type === DimensionType.REM) {
  styles.width = `${widthConfig.rem}rem`;
} else if (widthConfig.type === DimensionType.STRETCH) {
  // ... existing stretch handling
} else if (widthConfig.type === DimensionType.PIXEL) {
  // ... existing pixel handling
} else if (widthConfig.type === DimensionType.CONTENT) {
  // ... existing content handling
}

// Similarly for height handling:
if (heightConfig.type === DimensionType.REM) {
  styles.height = `${heightConfig.rem}rem`;
} else if (heightConfig.type === DimensionType.STRETCH) {
  // ... existing stretch handling
} else if (heightConfig.type === DimensionType.PIXEL) {
  // ... existing pixel handling
} else if (heightConfig.type === DimensionType.CONTENT) {
  // ... existing content handling
}
```

### 3.2 Add Space Element Renderer

**File:** `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx`

**Changes:**

1. **Import Space proto (add to existing imports at top):**

```typescript
import {
  // ... existing imports ...
  Space as SpaceProto,
} from "@streamlit/protobuf";
```

2. **Add case in RawElementNodeRenderer switch statement:**

```typescript
case "space":
  return <div className="stSpace" data-testid="stSpace" />
```

**Rationale:** Like the "empty" element, space renders as a simple div. All sizing is handled by the layout wrapper system via width/height configs.

### 3.3 Add FlexContext-Aware Styling for Space Elements

**File:** `frontend/lib/src/components/core/Block/styled-components.ts` or `StyledElementContainerLayoutWrapper`

**Changes:**

Add special handling for space elements to apply only the relevant dimension based on container direction. This prevents unintended cross-axis spacing.

**Approach A: In StyledElementContainerLayoutWrapper** (Recommended)

```typescript
import { useContext } from "react";
import { FlexContext } from "~lib/components/core/Layout/FlexContext";

export const StyledElementContainerLayoutWrapper = (
  props: LayoutWrapperProps
): ReactElement => {
  const { node, children, ...otherProps } = props;
  const flexContext = useContext(FlexContext);

  // Get layout styles normally
  let styles = useLayoutStyles({
    element: node.element,
    styleOverrides,
    minStretchBehavior,
  });

  // Special handling for space elements: apply only relevant dimension
  if (node.element.type === "space") {
    // Both width and height configs are set, but we only apply one
    const isHorizontal = flexContext?.isInHorizontalLayout;

    if (isHorizontal) {
      // In horizontal layout: keep width, clear height
      // This prevents unwanted vertical spacing
      delete styles.height;
      styles.minHeight = 0;
    } else {
      // In vertical layout (default): keep height, clear width
      // This prevents unwanted horizontal spacing
      delete styles.width;
      styles.minWidth = 0;
    }
  }

  return (
    <StyledElementContainer {...otherProps} style={styles}>
      {children}
    </StyledElementContainer>
  );
};
```

**Rationale:**

- **Prevents cross-axis bugs:** Only the relevant dimension is applied, avoiding unexpected spacing
- **Uses existing FlexContext:** No need to create new infrastructure
- **Element-specific logic:** Clean separation for space element behavior
- **Explicit control:** Clear which dimension is active in which layout

**Why this matters:**
Without this logic, setting both `width: "2.5rem"` and `height: "2.5rem"` would cause:

- In horizontal containers: Unwanted 2.5rem vertical spacing (breaking row alignment)
- In vertical containers: Unwanted 2.5rem horizontal spacing (making elements too wide)

### 3.4 Update Element Type Categorization (Optional)

**File:** `frontend/lib/src/components/core/Block/styled-components.ts`

Check if space needs special handling in `StyledElementContainer`. Since it's purely layout-driven with no content, it likely doesn't need special category classification like charts or inputs. However, we may want to ensure it has minimal or zero min-width/height.

**Note:** With the FlexContext-aware approach in section 3.3, explicit min-width/height handling may not be needed since we're already clearing the unused dimension. However, setting them to 0 provides extra safety:

```typescript
...(elementType === "space"
  ? {
      minWidth: 0,
      minHeight: 0,
    }
  : {}),
```

---

## 4. **Testing**

### 4.1 Python Unit Tests

**New file:** `lib/tests/streamlit/elements/space_test.py`

```python
# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitInvalidSizeError
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class SpaceTest(DeltaGeneratorTestCase):
    """Test ability to marshall space protos."""

    def test_space_default(self):
        """Test st.space() with default size."""
        st.space()

        c = self.get_delta_from_queue().new_element
        assert c.space is not None
        # Default is "small" = 0.75rem
        assert c.width_config.rem_width == 0.75
        assert c.height_config.rem_height == 0.75

    @parameterized.expand(
        [
            ("small", 0.75),
            ("medium", 2.5),
            ("large", 4.25),
        ]
    )
    def test_space_rem_sizes(self, size_name, expected_rem):
        """Test space with rem size literals."""
        st.space(size_name)
        c = self.get_delta_from_queue().new_element
        assert c.space is not None
        assert c.width_config.rem_width == expected_rem
        assert c.height_config.rem_height == expected_rem

    def test_space_stretch(self):
        """Test space with stretch size."""
        st.space("stretch")
        c = self.get_delta_from_queue().new_element
        assert c.space is not None
        assert c.width_config.use_stretch
        assert c.height_config.use_stretch

    @parameterized.expand(
        [
            (100,),
            (50,),
            (1,),
        ]
    )
    def test_space_pixel_sizes(self, pixel_value):
        """Test space with pixel sizes."""
        st.space(pixel_value)
        c = self.get_delta_from_queue().new_element
        assert c.space is not None
        assert c.width_config.pixel_width == pixel_value
        assert c.height_config.pixel_height == pixel_value

    @parameterized.expand(
        [
            ("invalid",),
            (-100,),
            (0,),
            (100.5,),  # Floats not supported
            (-50.5,),
            (None,),
        ]
    )
    def test_space_invalid_sizes(self, invalid_size):
        """Test that invalid size values raise an exception."""
        with pytest.raises(StreamlitInvalidSizeError):
            st.space(invalid_size)
```

**Test coverage:**

- Default behavior (`st.space()` → "small" → 0.75rem)
- All size literals: "small", "medium", "large", "stretch"
- Pixel values (positive integers only)
- Invalid inputs (negative, zero, floats, invalid strings, None)
- Proto message generation
- Width/height config with rem values
- Layout config properly passed

**Pattern:** Follows `divider_test.py` structure using `DeltaGeneratorTestCase`

### 4.2 Layout Utils Unit Tests

**File:** `lib/tests/streamlit/elements/lib/layout_utils_test.py`

**Add tests for:**

```python
@parameterized.expand(
    [
        ("small",),
        ("medium",),
        ("large",),
        ("stretch",),
        (1,),
        (100,),
    ]
)
def test_validate_size_valid(self, size):
    """validate_size accepts valid size values."""
    validate_size(size)

@parameterized.expand(
    [
        (0,),
        (-1,),
        (50.5,),  # Floats not supported
        ("invalid",),
        (None,),
        ("content",),  # Not valid for st.space
    ]
)
def test_validate_size_invalid(self, size):
    """validate_size raises for invalid size values."""
    with pytest.raises(StreamlitInvalidSizeError):
        validate_size(size)

def test_get_width_config_rem(self):
    """get_width_config handles rem values correctly."""
    for size, expected_rem in [("small", 0.75), ("medium", 2.5), ("large", 4.25)]:
        config = get_width_config(size)
        assert config.rem_width == expected_rem

def test_get_height_config_rem(self):
    """get_height_config handles rem values correctly."""
    for size, expected_rem in [("small", 0.75), ("medium", 2.5), ("large", 4.25)]:
        config = get_height_config(size)
        assert config.rem_height == expected_rem
```

### 4.3 Frontend Unit Tests

**File:** `frontend/lib/src/components/core/Layout/useLayoutStyles.test.ts`

**Add test cases:**

```typescript
describe("rem width/height handling", () => {
  it("applies rem width correctly", () => {
    const element = {
      widthConfig: { remWidth: 2.5 },
    };
    const styles = useLayoutStyles({ element });
    expect(styles.width).toBe("2.5rem");
  });

  it("applies rem height correctly", () => {
    const element = {
      heightConfig: { remHeight: 0.75 },
    };
    const styles = useLayoutStyles({ element });
    expect(styles.height).toBe("0.75rem");
  });

  it("handles all rem size literals", () => {
    const testCases = [
      { rem: 0.75, name: "small" },
      { rem: 2.5, name: "medium" },
      { rem: 4.25, name: "large" },
    ];

    testCases.forEach(({ rem }) => {
      const element = {
        widthConfig: { remWidth: rem },
        heightConfig: { remHeight: rem },
      };
      const styles = useLayoutStyles({ element });
      expect(styles.width).toBe(`${rem}rem`);
      expect(styles.height).toBe(`${rem}rem`);
    });
  });
});

describe("space element FlexContext dimension handling", () => {
  it("applies only width in horizontal layout", () => {
    // Mock FlexContext for horizontal layout
    const element = {
      type: "space",
      widthConfig: { remWidth: 2.5 },
      heightConfig: { remHeight: 2.5 },
    };

    // Test that wrapper logic clears height in horizontal context
    // This test validates the StyledElementContainerLayoutWrapper behavior
    // Implementation will depend on how the wrapper is structured
  });

  it("applies only height in vertical layout", () => {
    // Mock FlexContext for vertical layout (or null/undefined)
    const element = {
      type: "space",
      widthConfig: { remWidth: 2.5 },
      heightConfig: { remHeight: 2.5 },
    };

    // Test that wrapper logic clears width in vertical context
    // This test validates the StyledElementContainerLayoutWrapper behavior
  });
});
```

### 4.4 E2E Tests

**New file:** `e2e_playwright/st_space.py`

```python
# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import streamlit as st

st.header("Vertical Spacing Tests")

st.write("Line 1")
st.space()  # default small
st.write("Line 2 (after small space)")

st.space("medium")
st.write("Line 3 (after medium space)")

st.space("large")
st.write("Line 4 (after large space)")

st.space(50)  # 50px
st.write("Line 5 (after 50px space)")

st.divider()

st.header("Horizontal Spacing Tests")

with st.container(horizontal=True):
    st.button("Left")
    st.space("small")
    st.button("After small")
    st.space("stretch")
    st.button("Right")

with st.container(horizontal=True):
    st.button("A")
    st.space(100)  # 100px
    st.button("B (after 100px)")

with st.container(horizontal=True):
    st.button("Start")
    st.space("medium")
    st.button("Middle")
    st.space("medium")
    st.button("End")

st.divider()

st.header("Nested Container Test")

with st.container():
    st.write("Outer container")
    st.space("large")
    with st.container(horizontal=True):
        st.button("Inner Left")
        st.space("stretch")
        st.button("Inner Right")
    st.space("medium")
    st.write("Bottom of outer container")
```

**New file:** `e2e_playwright/st_space_test.py`

```python
# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from playwright.sync_api import Page, expect

from e2e_playwright.shared.app_utils import expect_markdown


def test_space_elements_exist(app: Page):
    """Test that space elements are rendered."""
    space_elements = app.get_by_test_id("stSpace")
    # We have multiple space elements in the test app
    expect(space_elements.first).to_be_attached()


def test_vertical_spacing(app: Page, assert_snapshot: ImageCompareFunction):
    """Test vertical spacing between elements."""
    # Get the container with vertical spacing tests
    markdown_elements = app.get_by_test_id("stMarkdown")

    # Capture snapshots of vertical spacing sections
    # This visually verifies the spacing is correct
    assert_snapshot(markdown_elements.nth(0), name="st_space_vertical_section")


def test_horizontal_spacing(app: Page, assert_snapshot: ImageCompareFunction):
    """Test horizontal spacing in containers."""
    # Get horizontal containers
    containers = app.locator('[data-testid="stHorizontalBlock"]')

    # Snapshot first horizontal container with various space sizes
    assert_snapshot(containers.nth(0), name="st_space_horizontal_small_stretch")
    assert_snapshot(containers.nth(1), name="st_space_horizontal_pixel")
    assert_snapshot(containers.nth(2), name="st_space_horizontal_medium")


def test_space_element_has_no_visible_content(app: Page):
    """Test that space elements themselves are invisible."""
    space_elements = app.get_by_test_id("stSpace")
    first_space = space_elements.first

    # Space should exist in DOM
    expect(first_space).to_be_attached()

    # Space should have no text content
    expect(first_space).to_have_text("")


def test_nested_containers_with_space(app: Page):
    """Test that space works correctly in nested containers."""
    # This is implicitly tested by the test app rendering correctly
    # We just verify the structure exists
    nested_container = app.locator('[data-testid="stVerticalBlock"]').last
    expect(nested_container).to_be_attached()
```

**Test coverage:**

- Visual snapshot tests for different sizes
- Vertical vs horizontal layout behavior
- Space elements render with correct dimensions
- No visual content (empty div)
- Nested container behavior

---

## 5. **Documentation & Type Support**

### 5.1 AppTest Support

**File:** `lib/streamlit/testing/v1/element_tree.py`

Add `Space` class following the pattern of `Divider`:

```python
class Space(Element):
    """A representation of st.space for testing."""

    @property
    def type(self) -> str:
        """The type of the element ("space")."""
        return "space"
```

**Test file:** `lib/tests/streamlit/testing/element_tree_test.py`

**Add test:**

```python
def test_space():
    """Test that space elements can be queried in AppTest."""
    script = AppTest.from_string(
        """
        import streamlit as st

        st.space()
        st.space("medium")
        st.space(100)
        """,
    )
    sr = script.run()

    assert len(sr.space) == 3
    assert sr.space[0].type == "space"

    repr(sr.space[0])
```

### 5.2 Type Tests

**New file:** `lib/tests/streamlit/typing/space_test.py`

```python
# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Typing tests for st.space."""

from typing_extensions import assert_type

import streamlit as st
from streamlit.delta_generator import DeltaGenerator


def test_space_return_type():
    """Test that st.space returns DeltaGenerator."""
    # Default
    assert_type(st.space(), DeltaGenerator)

    # With size literals
    assert_type(st.space("small"), DeltaGenerator)
    assert_type(st.space("medium"), DeltaGenerator)
    assert_type(st.space("large"), DeltaGenerator)
    assert_type(st.space("stretch"), DeltaGenerator)

    # With pixel values
    assert_type(st.space(100), DeltaGenerator)


def test_space_parameter_types():
    """Test that st.space accepts correct parameter types."""
    # These should all type-check correctly
    st.space()
    st.space("small")
    st.space("medium")
    st.space("large")
    st.space("stretch")
    st.space(100)
```

Verify typing with: `make python-types`

---

## 6. **Implementation Order & Dependencies**

### Phase 1: Proto Foundation (Day 1)

1. ✅ Update `proto/streamlit/proto/WidthConfig.proto` (add `float rem_width = 4`)
2. ✅ Update `proto/streamlit/proto/HeightConfig.proto` (add `float rem_height = 4`)
3. ✅ Create `proto/streamlit/proto/Space.proto`
4. ✅ Update `proto/streamlit/proto/Element.proto` (add Space import and type)
5. ✅ Run `make protobuf` from repo root
6. ✅ Verify generated files are created without errors

### Phase 2: Python Backend (Day 1-2)

1. ✅ Add `StreamlitInvalidSizeError` to `lib/streamlit/errors.py`
2. ✅ Update `lib/streamlit/elements/lib/layout_utils.py`:
   - Add `Size` type alias
   - Add `SIZE_TO_REM_MAPPING` constant
   - Add `validate_size()` function
   - Update `get_width_config()` for rem support
   - Update `get_height_config()` for rem support
3. ✅ Create `lib/streamlit/elements/space.py` with `SpaceMixin` class
4. ✅ Register in `lib/streamlit/__init__.py`:
   - Import `SpaceMixin`
   - Add to `DeltaGenerator` mixins
5. ✅ Write Python unit tests:
   - `lib/tests/streamlit/elements/space_test.py`
   - Add tests to `lib/tests/streamlit/elements/lib/layout_utils_test.py`
6. ✅ Run `pytest lib/tests/streamlit/elements/space_test.py`
7. ✅ Run `make python-lint` and fix any issues

### Phase 3: Frontend (Day 2-3)

1. ✅ Update `frontend/lib/src/components/core/Layout/useLayoutStyles.ts`:
   - Add `DimensionType.REM`
   - Update `LayoutDimensionConfig` type
   - Update `getWidth()` function
   - Update `getHeight()` function
   - Update CSS generation for rem values
2. ✅ Update `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx`:
   - Import `Space as SpaceProto`
   - Add `case "space"` in switch statement
3. ✅ **Add FlexContext-aware dimension logic** in `StyledElementContainerLayoutWrapper`:
   - Import `FlexContext`
   - Check `node.element.type === "space"`
   - Apply only width (horizontal) OR height (vertical) based on `flexContext.isInHorizontalLayout`
   - Clear unused dimension to prevent cross-axis interference
4. ✅ (Optional) Update `frontend/lib/src/components/core/Block/styled-components.ts` for min-width/height safety
5. ✅ Write frontend unit tests in `frontend/lib/src/components/core/Layout/useLayoutStyles.test.ts`
6. ✅ Add FlexContext tests for space element dimension application
7. ✅ Run `make frontend-tests`
8. ✅ Run `make frontend-lint` and fix any issues

### Phase 4: Integration & E2E Testing (Day 3-4)

1. ✅ Create `e2e_playwright/st_space.py` test script
2. ✅ Create `e2e_playwright/st_space_test.py` test file
3. ✅ Run E2E test: `make run-e2e-test st_space_test.py`
4. ✅ Capture and review snapshots
5. ✅ Add AppTest support:
   - Update `lib/streamlit/testing/v1/element_tree.py`
   - Add test in `lib/tests/streamlit/testing/element_tree_test.py`
6. ✅ Create typing tests: `lib/tests/streamlit/typing/space_test.py`
7. ✅ Run `make python-types` to verify typing

### Phase 5: Final Validation (Day 4)

1. ✅ Run full Python test suite: `make python-tests`
2. ✅ Run full frontend test suite: `make frontend-tests`
3. ✅ Run linters:
   - `make python-lint`
   - `make frontend-lint`
4. ✅ Run type checkers:
   - `make python-types`
   - `make frontend-types`
5. ✅ Manual testing in browser:
   - Test vertical spacing
   - Test horizontal spacing
   - Test nested containers
   - Test all size options
6. ✅ Review all changes for code quality and consistency

---

## 7. **Edge Cases & Considerations**

### 7.1 Container Direction Detection & Cross-Axis Prevention

**Behavior:** Space element adapts to parent container direction - width for horizontal, height for vertical.

**Implementation:**

1. **Python layer:** Sets both width and height configs to the same size value
2. **Frontend layer:** Uses FlexContext to detect parent container direction
3. **Styling logic:** In `StyledElementContainerLayoutWrapper`, checks `node.element.type === "space"` and:
   - If horizontal layout: Applies width only, clears height (prevents unwanted vertical spacing)
   - If vertical layout: Applies height only, clears width (prevents unwanted horizontal spacing)

**Critical:** Without clearing the unused dimension, both would apply and cause cross-axis interference:

- Example: `st.space("medium")` (2.5rem) in a horizontal container
  - ✅ **With FlexContext logic:** `width: 2.5rem` only → correct horizontal spacing
  - ❌ **Without FlexContext logic:** `width: 2.5rem` AND `height: 2.5rem` → breaks vertical alignment of row items

### 7.2 Backward Compatibility

**Concern:** Adding new proto fields could break older clients.

**Solution:** Adding new optional fields (`rem_width`, `rem_height`) is safe per protobuf compatibility rules. Older clients will ignore unknown fields. The `oneof` structure ensures only one field is set at a time.

### 7.3 Print Mode

**Behavior:** Space should work in print layouts.

**Implementation:** Handled automatically by layout system. May want to test that space elements don't create unwanted gaps in printed PDFs.

### 7.4 Nested Containers

**Behavior:** Space respects parent container direction at each nesting level.

**Implementation:** Each space element is evaluated in its immediate parent context. Nested horizontal containers inside vertical containers work correctly.

### 7.5 Multiple Consecutive Spaces

**Behavior:** Users can add multiple `st.space()` calls in sequence.

**Implementation:** Each creates an independent element. Spacing will accumulate (e.g., two `st.space("small")` = 1.5rem total).

### 7.6 Zero/Negative Values

**Behavior:** Should be rejected as invalid.

**Implementation:** `validate_size()` checks for `size <= 0` and raises `StreamlitInvalidSizeError`.

### 7.7 Integer-Only Pixel Values

**Behavior:** Only accept integers for pixel values. Float values are rejected as invalid.

**Implementation:** Type checking ensures only integers are accepted. The `validate_size()` function checks `isinstance(size, int)` not `isinstance(size, (int, float))`.

### 7.8 Interaction with Flexbox Gap

**Consideration:** Containers already have gap spacing between elements. Space element adds _additional_ space.

**Behavior:** This is intentional. Space adds explicit spacing beyond the container's gap setting.

### 7.9 Screen Reader / Accessibility

**Consideration:** Empty space elements should not be announced to screen readers.

**Implementation:** The space div has no content and no ARIA attributes, so it will be ignored by screen readers.

### 7.10 Element Key

**Behavior:** Users can optionally provide a key to space elements.

**Implementation:** Standard DeltaGenerator behavior applies. Keys work the same as for other elements.

---

## 8. **Estimated File Changes Summary**

### Proto (5 files to modify/create + generated files)

- ✏️ `proto/streamlit/proto/WidthConfig.proto` - add rem_width field
- ✏️ `proto/streamlit/proto/HeightConfig.proto` - add rem_height field
- ➕ `proto/streamlit/proto/Space.proto` - create new
- ✏️ `proto/streamlit/proto/Element.proto` - register Space
- 🔧 `make protobuf` - generates Python/TS bindings

### Python (8-9 files)

- ✏️ `lib/streamlit/errors.py` - add StreamlitInvalidSizeError
- ✏️ `lib/streamlit/elements/lib/layout_utils.py` - add Size type, validation, rem mapping
- ➕ `lib/streamlit/elements/space.py` - create SpaceMixin
- ✏️ `lib/streamlit/__init__.py` - register SpaceMixin
- ✏️ `lib/streamlit/testing/v1/element_tree.py` - add Space class
- ➕ `lib/tests/streamlit/elements/space_test.py` - create tests
- ✏️ `lib/tests/streamlit/elements/lib/layout_utils_test.py` - add tests
- ✏️ `lib/tests/streamlit/testing/element_tree_test.py` - add test
- ➕ `lib/tests/streamlit/typing/space_test.py` - create type tests

### Frontend (4-5 files)

- ✏️ `frontend/lib/src/components/core/Layout/useLayoutStyles.ts` - add rem support
- ✏️ `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx` - add space case
- ✏️ `frontend/lib/src/components/core/Block/styled-components.ts` or `StyledElementContainerLayoutWrapper` - add FlexContext-aware dimension logic for space elements
- ✏️ `frontend/lib/src/components/core/Layout/useLayoutStyles.test.ts` - add tests
- ✏️ `frontend/lib/src/components/core/Block/styled-components.ts` - optional min-width/height (may be combined with above)

### E2E Tests (2 files)

- ➕ `e2e_playwright/st_space.py` - test app script
- ➕ `e2e_playwright/st_space_test.py` - test cases

**Legend:**

- ➕ Create new file
- ✏️ Modify existing file
- 🔧 Run command

**Total:** ~21 files (5 proto, 8-9 Python, 4-5 Frontend, 2 E2E) + generated proto files

---

## 9. **Success Criteria Checklist**

- [ ] `st.space()` with no args adds 0.75rem (small) vertical space
- [ ] `st.space("small")` adds 0.75rem space
- [ ] `st.space("medium")` adds 2.5rem space
- [ ] `st.space("large")` adds 4.25rem space
- [ ] `st.space("stretch")` fills remaining space in container
- [ ] `st.space(100)` adds 100px space
- [ ] `st.space(50.5)` raises `StreamlitInvalidSizeError` (floats not supported)
- [ ] Space is vertical (height) in vertical containers
- [ ] Space is horizontal (width) in horizontal containers
- [ ] Space does NOT create unwanted cross-axis spacing (height in horizontal containers, width in vertical containers)
- [ ] Space works correctly in nested containers
- [ ] Invalid inputs raise `StreamlitInvalidSizeError`
- [ ] All Python unit tests pass (`make python-tests`)
- [ ] All frontend unit tests pass (`make frontend-tests`)
- [ ] E2E tests pass (`make run-e2e-test st_space_test.py`)
- [ ] No Python linter errors (`make python-lint`)
- [ ] No frontend linter errors (`make frontend-lint`)
- [ ] No Python type errors (`make python-types`)
- [ ] No frontend type errors (`make frontend-types`)
- [ ] AppTest can query space elements via `sr.space`
- [ ] Visual snapshots look correct (proper spacing)
- [ ] Backward compatible (no breaking changes to existing code)
- [ ] Space elements are invisible (no content rendered)
- [ ] Space elements are ignored by screen readers (accessibility)

---

## 10. **Code Review Checklist**

### General

- [ ] All code follows Streamlit coding conventions
- [ ] Python code uses type hints
- [ ] Docstrings follow Numpydoc style
- [ ] Comments are clear and explain "why" not "what"
- [ ] No hardcoded magic numbers (use constants)

### Proto

- [ ] Proto fields follow naming conventions (snake_case)
- [ ] Backward compatibility maintained (no removed/renamed fields)
- [ ] Appropriate field numbers used (no conflicts)
- [ ] Java package names correct

### Python

- [ ] Imports ordered correctly (stdlib, third-party, streamlit)
- [ ] Private functions/constants prefixed with `_`
- [ ] Error messages are user-friendly
- [ ] Validation happens before proto creation
- [ ] Layout config always passed (not conditional)

### Frontend

- [ ] TypeScript types are specific (no `any`)
- [ ] React best practices followed
- [ ] CSS uses theme values (not hardcoded)
- [ ] Backward compatibility for cached messages
- [ ] Accessibility considered (ARIA, keyboard nav)

### Tests

- [ ] Tests are comprehensive (happy path + edge cases)
- [ ] Test names clearly describe what they test
- [ ] Tests are deterministic (no flaky tests)
- [ ] Snapshot tests have descriptive names
- [ ] Mock data is realistic

---

## 11. **Known Limitations & Future Enhancements**

### Current Limitations

1. **No animation support:** Space elements don't animate when size changes.
2. **No responsive sizing:** Space size is fixed, doesn't adapt to screen size.
3. **No percentage values:** Only supports pixels, rem, and stretch - no % values.

### Potential Future Enhancements

1. **Responsive sizes:** Could add breakpoint-based sizing
2. **Animation:** Could add smooth transitions when space size changes
3. **Auto spacing:** Could add an "auto" mode that intelligently adjusts based on content
4. **Percentage support:** Could allow `st.space("50%")` for relative sizing

---

## 12. **Documentation Plan** (Post-Implementation)

### User-Facing Documentation

1. **API Reference:** Add `st.space` to API docs with all parameters documented
2. **Layout Guide:** Update layout documentation to include space examples
3. **Release Notes:** Add to release notes for next version
4. **Examples Gallery:** Create example showing space usage patterns

### Internal Documentation

1. **Architecture Docs:** Update layout system docs to mention rem support
2. **Proto Docs:** Document new proto fields in Element.proto comments
3. **Testing Guide:** Add space to testing examples

---

## Summary

This implementation plan provides a comprehensive roadmap for adding `st.space` to Streamlit. The feature leverages the existing layout system, extends it with rem unit support, and follows established patterns throughout the codebase.

**Key Technical Decisions:**

1. ✅ Extend WidthConfig/HeightConfig with rem fields (not a new SizeConfig message)
2. ✅ Set both width and height configs to same value in Python (data layer)
3. ✅ Use FlexContext in frontend to apply ONLY relevant dimension (width XOR height)
4. ✅ Clear unused dimension to prevent cross-axis spacing interference
5. ✅ Use positional `size` parameter with "small" default
6. ✅ Follow Empty/Divider pattern for simple element rendering
7. ✅ Comprehensive validation at Python layer before proto creation

**Estimated Development Time:** 3-4 days for implementation + testing + review

**Risk Level:** Low - follows existing patterns, minimal new complexity, comprehensive tests

Ready for implementation! 🚀
