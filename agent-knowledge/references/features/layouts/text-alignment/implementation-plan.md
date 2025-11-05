---
status: stable
last_updated: 2025-11-05
---

# Text Alignment Feature - Implementation Plan

This document provides a detailed implementation plan for adding `text_alignment` parameter to text elements in Streamlit.

---

## Overview

**Goal**: Add a `text_alignment` parameter to text elements (`st.markdown`, `st.text`, `st.caption`, `st.title`, `st.header`, `st.subheader`) to control CSS text alignment.

**Related Spec**: See `TEXT_ALIGNMENT_SPEC.md` for product requirements and design decisions.

**GitHub Issue**: https://github.com/streamlit/streamlit/issues/4109 (47 👍)

---

## Architectural Approach

**Key Decision**: Add `text_alignment_config` to `Element.proto` (like `width_config`/`height_config`) instead of individual element protos.

**Benefits**:

- ✅ **50% less code** (10 files vs 19 files modified)
- ✅ **Centralized logic** (proto copying in ONE place: `_enqueue`)
- ✅ **Centralized styling** (CSS in ONE place: `StyledElementContainerLayoutWrapper`)
- ✅ **Consistent architecture** (matches how width/height work)
- ✅ **Future-proof** (adding to new elements is trivial)

See `/work-tmp/TEXT_ALIGNMENT_ARCHITECTURE_ANALYSIS.md` for detailed comparison.

---

## Implementation Layers

The implementation follows the standard Streamlit architecture:

1. **Proto Layer**: Add `text_alignment_config` to `Element.proto`
2. **Python Layer**: Use `LayoutConfig` to pass text_alignment (no proto copying in elements)
3. **Frontend Layer**: Apply CSS in `StyledElementContainerLayoutWrapper` (no component changes)
4. **Testing Layer**: Add unit tests, E2E tests, and type tests
5. **Documentation**: Update docstrings

---

## 1. Proto Layer Changes

**Architecture Decision**: Add `text_alignment_config` to `Element.proto` (not individual element protos) to match how `width_config` and `height_config` are handled. This provides better consistency, less code duplication, and centralized styling logic.

### 1.1 Add TextAlignmentConfig Message

**File**: `/proto/streamlit/proto/TextAlignmentConfig.proto` (NEW FILE)

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
option java_outer_classname = "TextAlignmentConfigProto";

// Text alignment configuration for text elements
message TextAlignmentConfig {
  enum Alignment {
    UNSPECIFIED = 0;  // Reserved for backwards compatibility
    LEFT = 1;
    CENTER = 2;
    RIGHT = 3;
    JUSTIFY = 4;
  }

  Alignment alignment = 1;
}
```

### 1.2 Update Element.proto

**File**: `/proto/streamlit/proto/Element.proto` (UPDATE)

Add text_alignment_config alongside width_config and height_config:

```protobuf
import "streamlit/proto/TextAlignmentConfig.proto";

// An element which can be displayed on the screen.
message Element {

  // Layout configuration for elements
  optional streamlit.HeightConfig height_config = 57;
  optional streamlit.WidthConfig width_config = 58;
  optional streamlit.TextAlignmentConfig text_alignment_config = 59;  // NEW

  // An element can be one of the following element types.
  oneof type {
    // ... existing element types ...
  }
}
```

**Why this approach?**

- ✅ Consistent with how width/height are handled
- ✅ Centralized layout config in one place
- ✅ Works automatically for all elements
- ✅ Easier to extend to new elements
- ✅ Less proto file modifications (2 files vs 4)

### 1.3 Compile Protobufs

After making proto changes, compile them:

```bash
make protobuf
```

This generates Python and TypeScript bindings automatically.

---

## 2. Python Layer Changes

### 2.1 Add Type Definitions and Validation

**File**: `/lib/streamlit/elements/lib/layout_utils.py`

**Add**:

```python
# Add to imports
from streamlit.errors import StreamlitInvalidTextAlignmentError

# Add type alias (around line 40, with other type aliases)
TextAlignment: TypeAlias = Literal["left", "center", "right", "justify"]

# Update LayoutConfig dataclass (around line 52)
@dataclass
class LayoutConfig:
    width: Width | SpaceSize | None = None
    height: Height | SpaceSize | None = None
    text_alignment: TextAlignment | None = None  # NEW

# Add validation function (around line 210, after other validation functions)
def validate_text_alignment(text_alignment: TextAlignment) -> None:
    """Validate the text_alignment parameter.

    Parameters
    ----------
    text_alignment : Any
        The text alignment value to validate.

    Raises
    ------
    StreamlitInvalidTextAlignmentError
        If the text_alignment value is invalid.
    """
    valid_alignments = ["left", "center", "right", "justify"]
    if text_alignment not in valid_alignments:
        raise StreamlitInvalidTextAlignmentError(text_alignment)


# Add proto conversion function (around line 250, after get_align)
def get_text_alignment_config(
    text_alignment: TextAlignment,
) -> TextAlignmentConfig:
    """Convert text alignment string to proto config.

    Parameters
    ----------
    text_alignment : TextAlignment
        The text alignment value ("left", "center", "right", "justify").

    Returns
    -------
    TextAlignmentConfig
        Proto message with alignment set.
    """
    from streamlit.proto.TextAlignmentConfig_pb2 import TextAlignmentConfig

    alignment_mapping = {
        "left": TextAlignmentConfig.Alignment.LEFT,
        "center": TextAlignmentConfig.Alignment.CENTER,
        "right": TextAlignmentConfig.Alignment.RIGHT,
        "justify": TextAlignmentConfig.Alignment.JUSTIFY,
    }

    config = TextAlignmentConfig()
    config.alignment = alignment_mapping[text_alignment]
    return config
```

### 2.2 Add Error Class

**File**: `/lib/streamlit/errors.py`

**Add** (find appropriate location with other `StreamlitInvalid*` errors):

```python
class StreamlitInvalidTextAlignmentError(StreamlitAPIException):
    """Exception raised when an invalid text_alignment value is provided."""

    def __init__(self, text_alignment: Any):
        super().__init__(
            f'Invalid text_alignment value: "{text_alignment}". '
            'Valid values are: "left", "center", "right", "justify".'
        )
```

### 2.3 Update DeltaGenerator.\_enqueue

**File**: `/lib/streamlit/delta_generator.py`

**Update the existing `layout_config` handling** (around line 489-497):

```python
# In _enqueue method, update the existing layout_config block:
if layout_config:
    if layout_config.height is not None:
        msg.delta.new_element.height_config.CopyFrom(
            get_height_config(layout_config.height)
        )
    if layout_config.width is not None:
        msg.delta.new_element.width_config.CopyFrom(
            get_width_config(layout_config.width)
        )
    # NEW: Add text_alignment handling alongside width/height
    if layout_config.text_alignment is not None:
        msg.delta.new_element.text_alignment_config.CopyFrom(
            get_text_alignment_config(layout_config.text_alignment)
        )
```

**Why this approach?**

- ✅ Centralized proto copying in ONE place
- ✅ Consistent with how width/height are handled
- ✅ No need to modify proto copying logic in each element file
- ✅ Automatically works for any element that uses LayoutConfig

### 2.4 Update Element Functions

#### 2.4.1 st.markdown and st.caption

**File**: `/lib/streamlit/elements/markdown.py`

**Changes**:

```python
# Add to imports
from streamlit.elements.lib.layout_utils import (
    TextAlignment,
    # ... existing imports
)

# Update st.markdown signature (around line 40)
@gather_metrics("markdown")
def markdown(
    self,
    body: SupportsStr,
    unsafe_allow_html: bool = False,
    *,  # keyword-only arguments:
    help: str | None = None,
    width: Width = "stretch",
    text_alignment: TextAlignment = "left",  # NEW PARAMETER
) -> DeltaGenerator:
    r"""Display string formatted as Markdown.

    Parameters
    ----------
    # ... existing parameters ...

    text_alignment : "left", "center", "right", or "justify"
        The horizontal alignment of the text within the element. This can
        be one of the following:

        - ``"left"`` (default): Text is aligned to the left edge.
        - ``"center"``: Text is centered.
        - ``"right"``: Text is aligned to the right edge.
        - ``"justify"``: Text is justified (stretched to align on both
          left and right edges, with the last line left-aligned).

        .. note::
            For text alignment to have a visible effect, the element's
            width must be wider than its content. If using ``width="content"``
            with short text, alignment may not be noticeable.

    # ... rest of docstring ...
    """
    markdown_proto = MarkdownProto()

    markdown_proto.body = clean_text(body)
    markdown_proto.allow_html = unsafe_allow_html
    markdown_proto.element_type = MarkdownProto.Type.NATIVE
    if help:
        markdown_proto.help = help

    validate_width(width, allow_content=True)
    # NEW: Pass text_alignment in LayoutConfig (proto copying handled by _enqueue)
    layout_config = LayoutConfig(width=width, text_alignment=text_alignment)

    return self.dg._enqueue("markdown", markdown_proto, layout_config=layout_config)


# Update st.caption signature (around line 169)
@gather_metrics("caption")
def caption(
    self,
    body: SupportsStr,
    unsafe_allow_html: bool = False,
    *,  # keyword-only arguments:
    help: str | None = None,
    width: Width = "stretch",
    text_alignment: TextAlignment = "left",  # NEW PARAMETER
) -> DeltaGenerator:
    """Display text in small font.

    # ... existing docstring content ...

    text_alignment : "left", "center", "right", or "justify"
        The horizontal alignment of the text within the element. This can
        be one of the following:

        - ``"left"`` (default): Text is aligned to the left edge.
        - ``"center"``: Text is centered.
        - ``"right"``: Text is aligned to the right edge.
        - ``"justify"``: Text is justified (stretched to align on both
          left and right edges, with the last line left-aligned).

    # ... rest of docstring ...
    """
    caption_proto = MarkdownProto()
    caption_proto.body = clean_text(body)
    caption_proto.allow_html = unsafe_allow_html
    caption_proto.is_caption = True
    caption_proto.element_type = MarkdownProto.Type.CAPTION
    if help:
        caption_proto.help = help

    validate_width(width, allow_content=True)
    # NEW: Pass text_alignment in LayoutConfig (proto copying handled by _enqueue)
    layout_config = LayoutConfig(width=width, text_alignment=text_alignment)

    return self.dg._enqueue("markdown", caption_proto, layout_config=layout_config)
```

**Note**: `st.latex` deliberately excluded per spec (rarely used, equations typically left-aligned).

#### 2.4.2 st.text

**File**: `/lib/streamlit/elements/text.py`

**Changes**:

```python
# Add to imports
from streamlit.elements.lib.layout_utils import (
    TextAlignment,
    # ... existing imports
)

# Update st.text signature (around line 32)
@gather_metrics("text")
def text(
    self,
    body: SupportsStr,
    *,  # keyword-only arguments:
    help: str | None = None,
    width: Width = "content",
    text_alignment: TextAlignment = "left",  # NEW PARAMETER
) -> DeltaGenerator:
    r"""Write text without Markdown or HTML parsing.

    # ... existing docstring content ...

    text_alignment : "left", "center", "right", or "justify"
        The horizontal alignment of the text within the element. This can
        be one of the following:

        - ``"left"`` (default): Text is aligned to the left edge.
        - ``"center"``: Text is centered.
        - ``"right"``: Text is aligned to the right edge.
        - ``"justify"``: Text is justified (stretched to align on both
          left and right edges, with the last line left-aligned).

    # ... rest of docstring ...
    """
    text_proto = TextProto()
    text_proto.body = clean_text(body)
    if help:
        text_proto.help = help

    validate_width(width, allow_content=True)
    # NEW: Pass text_alignment in LayoutConfig (proto copying handled by _enqueue)
    layout_config = LayoutConfig(width=width, text_alignment=text_alignment)

    return self.dg._enqueue("text", text_proto, layout_config=layout_config)
```

#### 2.4.3 st.title, st.header, st.subheader

**File**: `/lib/streamlit/elements/heading.py`

**Changes**:

```python
# Add to imports
from streamlit.elements.lib.layout_utils import (
    TextAlignment,
    # ... existing imports
)

# Update st.header signature (around line 44)
@gather_metrics("header")
def header(
    self,
    body: SupportsStr,
    anchor: Anchor = None,
    *,  # keyword-only arguments:
    help: str | None = None,
    divider: Divider = False,
    width: Width = "stretch",
    text_alignment: TextAlignment = "left",  # NEW PARAMETER
) -> DeltaGenerator:
    """Display text in header formatting.

    # ... existing docstring content ...

    text_alignment : "left", "center", "right", or "justify"
        The horizontal alignment of the text within the element. This can
        be one of the following:

        - ``"left"`` (default): Text is aligned to the left edge.
        - ``"center"``: Text is centered.
        - ``"right"``: Text is aligned to the right edge.
        - ``"justify"``: Text is justified (stretched to align on both
          left and right edges, with the last line left-aligned).

    # ... rest of docstring ...
    """
    validate_width(width, allow_content=True)
    # NEW: Pass text_alignment in LayoutConfig (proto copying handled by _enqueue)
    layout_config = LayoutConfig(width=width, text_alignment=text_alignment)

    return self.dg._enqueue(
        "heading",
        HeadingMixin._create_heading_proto(
            tag=HeadingProtoTag.HEADER_TAG,
            body=body,
            anchor=anchor,
            help=help,
            divider=divider,
        ),
        layout_config=layout_config,
    )


# Update st.subheader signature (around line 133)
@gather_metrics("subheader")
def subheader(
    self,
    body: SupportsStr,
    anchor: Anchor = None,
    *,  # keyword-only arguments:
    help: str | None = None,
    divider: Divider = False,
    width: Width = "stretch",
    text_alignment: TextAlignment = "left",  # NEW PARAMETER
) -> DeltaGenerator:
    """Display text in subheader formatting.

    # ... existing docstring content with text_alignment parameter ...
    """
    validate_width(width, allow_content=True)
    # NEW: Pass text_alignment in LayoutConfig (proto copying handled by _enqueue)
    layout_config = LayoutConfig(width=width, text_alignment=text_alignment)

    return self.dg._enqueue(
        "heading",
        HeadingMixin._create_heading_proto(
            tag=HeadingProtoTag.SUBHEADER_TAG,
            body=body,
            anchor=anchor,
            help=help,
            divider=divider,
        ),
        layout_config=layout_config,
    )


# Update st.title signature (around line 222)
@gather_metrics("title")
def title(
    self,
    body: SupportsStr,
    anchor: Anchor = None,
    *,  # keyword-only arguments:
    help: str | None = None,
    width: Width = "stretch",
    text_alignment: TextAlignment = "left",  # NEW PARAMETER
) -> DeltaGenerator:
    """Display text in title formatting.

    # ... existing docstring content with text_alignment parameter ...
    """
    validate_width(width, allow_content=True)
    # NEW: Pass text_alignment in LayoutConfig (proto copying handled by _enqueue)
    layout_config = LayoutConfig(width=width, text_alignment=text_alignment)

    return self.dg._enqueue(
        "heading",
        HeadingMixin._create_heading_proto(
            tag=HeadingProtoTag.TITLE_TAG,
            body=body,
            anchor=anchor,
            help=help,
        ),
        layout_config=layout_config,
    )
```

**Note**: No changes needed to `_create_heading_proto()` - text alignment is now handled via LayoutConfig, not proto fields.

---

## 3. Frontend Layer Changes

**Architecture Decision**: Apply text-align styling in `StyledElementContainerLayoutWrapper` instead of individual components. This provides centralized styling logic that works automatically for all elements.

### 3.1 Add CSS Utility Function

**File**: `/frontend/lib/src/components/core/Layout/utils.ts`

**Add** (at the end of the file):

```typescript
import { TextAlignmentConfig } from "@streamlit/protobuf";

/**
 * Convert TextAlignmentConfig proto to CSS text-align value.
 *
 * @param config - The text alignment configuration from proto
 * @returns CSS text-align value or undefined if not set
 */
export function getTextAlignmentStyle(
  config?: TextAlignmentConfig
): string | undefined {
  if (!config?.alignment) {
    return undefined;
  }

  const alignmentMap: Record<TextAlignmentConfig.Alignment, string> = {
    [TextAlignmentConfig.Alignment.LEFT]: "left",
    [TextAlignmentConfig.Alignment.CENTER]: "center",
    [TextAlignmentConfig.Alignment.RIGHT]: "right",
    [TextAlignmentConfig.Alignment.JUSTIFY]: "justify",
    [TextAlignmentConfig.Alignment.UNSPECIFIED]: "left",
  };

  return alignmentMap[config.alignment] || "left";
}
```

### 3.2 Update Styled Components for Block Elements

**File**: `/frontend/lib/src/components/shared/StreamlitMarkdown/styled-components.ts`

To make tables and lists properly respond to text-align CSS, we need to make them inline-block elements. This is necessary because CSS `text-align` affects inline content, not block-level elements.

**Add to the table styles** (around line 267):

```typescript
table: {
  // Add some space below the markdown tables
  marginBottom: theme.spacing.lg,
  // Prevent double borders
  borderCollapse: "collapse",
  // Make tables display as inline-block so they respect text-align
  display: "inline-block",
},
```

**Add after the "p, ol, ul, dl, li" styles** (around line 316):

```typescript
// Make ONLY top-level ul and ol inline-block so they respect text-align
// Use > to target only direct children, not nested lists
"& > ul, & > ol": {
  display: "inline-block",
  textAlign: "left", // Reset text-align for content inside lists
},

// Ensure nested lists stay as block elements
"li > ul, li > ol": {
  display: "block",
},
```

**Why inline-block?**

- CSS `text-align` property affects inline and inline-block elements, not block elements
- Tables and lists are block-level by default, so they don't respond to text-align on parent
- Making them inline-block allows them to be positioned by text-align while maintaining their internal structure
- Nested lists must remain block-level to preserve proper indentation

### 3.3 Update StyledElementContainerLayoutWrapper

**File**: `/frontend/lib/src/components/core/Block/StyledElementContainerLayoutWrapper.tsx`

**Update** the component to apply text alignment styling (around line 80-120):

```typescript
import { getTextAlignmentStyle } from "~lib/components/core/Layout/utils";

export const StyledElementContainerLayoutWrapper: FC<...> = ({ node }) => {
  const element = node.element;

  // ... existing code for minStretchBehavior and styleOverrides ...

  // NEW: Get text alignment style from element config
  const textAlign = getTextAlignmentStyle(element.textAlignmentConfig);

  // Apply layout styles including text alignment
  const styles = useLayoutStyles({
    element,
    styleOverrides: {
      ...styleOverrides,
      ...(textAlign && { textAlign }),  // Add text-align to style overrides
    },
    minStretchBehavior,
  });

  return <StyledElementContainer style={styles}>...</StyledElementContainer>;
};
```

**Why this approach?**

- ✅ ONE location for text-align styling (not 3+ components)
- ✅ Works automatically for ALL elements (including future ones)
- ✅ Consistent with how width/height styling is applied
- ✅ No need to modify individual component files
- ✅ Easier to maintain and debug

**Note**: No changes needed to individual component files (Markdown.tsx, Text.tsx, Heading.tsx) - styling is handled centrally.

---

## 4. Testing Strategy

### 4.1 Python Unit Tests

**Important**: Use parameterized tests to avoid code duplication across alignment values.

**File**: `/lib/tests/streamlit/elements/markdown_test.py` (UPDATE existing test file)

Add to the existing test file:

```python
"""Unit tests for markdown elements with text_alignment parameter."""
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitInvalidTextAlignmentError
from streamlit.proto.TextAlignmentConfig_pb2 import TextAlignmentConfig
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class StMarkdownTextAlignmentTest(DeltaGeneratorTestCase):
    """Test st.markdown text_alignment parameter."""

    @parameterized.expand([
        ("left", TextAlignmentConfig.Alignment.LEFT),
        ("center", TextAlignmentConfig.Alignment.CENTER),
        ("right", TextAlignmentConfig.Alignment.RIGHT),
        ("justify", TextAlignmentConfig.Alignment.JUSTIFY),
    ])
    def test_st_markdown_text_alignment(self, alignment_value, expected_proto_value):
        """Test st.markdown with different text_alignment values."""
        st.markdown("Test markdown", text_alignment=alignment_value)

        el = self.get_delta_from_queue().new_element
        assert el.markdown.body == "Test markdown"
        # Check Element-level text_alignment_config (NOT markdown.text_alignment_config)
        assert el.text_alignment_config.alignment == expected_proto_value

    def test_st_markdown_text_alignment_default(self):
        """Test st.markdown defaults to left alignment."""
        st.markdown("Test markdown")

        el = self.get_delta_from_queue().new_element
        assert el.markdown.body == "Test markdown"
        # Default should be LEFT
        assert el.text_alignment_config.alignment == TextAlignmentConfig.Alignment.LEFT

    def test_st_markdown_text_alignment_invalid(self):
        """Test st.markdown with invalid text_alignment raises error."""
        with pytest.raises(StreamlitInvalidTextAlignmentError):
            st.markdown("Test", text_alignment="invalid")


class StCaptionTextAlignmentTest(DeltaGeneratorTestCase):
    """Test st.caption text_alignment parameter."""

    @parameterized.expand([
        ("left", TextAlignmentConfig.Alignment.LEFT),
        ("center", TextAlignmentConfig.Alignment.CENTER),
        ("right", TextAlignmentConfig.Alignment.RIGHT),
        ("justify", TextAlignmentConfig.Alignment.JUSTIFY),
    ])
    def test_st_caption_text_alignment(self, alignment_value, expected_proto_value):
        """Test st.caption with different text_alignment values."""
        st.caption("Caption text", text_alignment=alignment_value)

        el = self.get_delta_from_queue().new_element
        assert el.markdown.body == "Caption text"
        assert el.markdown.is_caption is True
        # Check Element-level text_alignment_config
        assert el.text_alignment_config.alignment == expected_proto_value
```

**File**: `/lib/tests/streamlit/elements/text_test.py` (UPDATE existing test file)

```python
class StTextTextAlignmentTest(DeltaGeneratorTestCase):
    """Test st.text text_alignment parameter."""

    @parameterized.expand([
        ("left", TextAlignmentConfig.Alignment.LEFT),
        ("center", TextAlignmentConfig.Alignment.CENTER),
        ("right", TextAlignmentConfig.Alignment.RIGHT),
        ("justify", TextAlignmentConfig.Alignment.JUSTIFY),
    ])
    def test_st_text_text_alignment(self, alignment_value, expected_proto_value):
        """Test st.text with different text_alignment values."""
        st.text("Plain text", text_alignment=alignment_value)

        el = self.get_delta_from_queue().new_element
        assert el.text.body == "Plain text"
        # Check Element-level text_alignment_config
        assert el.text_alignment_config.alignment == expected_proto_value
```

**File**: `/lib/tests/streamlit/elements/heading_test.py` (UPDATE existing test file)

```python
class StTitleTextAlignmentTest(DeltaGeneratorTestCase):
    """Test st.title text_alignment parameter."""

    @parameterized.expand([
        ("left", TextAlignmentConfig.Alignment.LEFT),
        ("center", TextAlignmentConfig.Alignment.CENTER),
        ("right", TextAlignmentConfig.Alignment.RIGHT),
        ("justify", TextAlignmentConfig.Alignment.JUSTIFY),
    ])
    def test_st_title_text_alignment(self, alignment_value, expected_proto_value):
        """Test st.title with different text_alignment values."""
        st.title("Title text", text_alignment=alignment_value)

        el = self.get_delta_from_queue().new_element
        assert el.heading.body == "Title text"
        assert el.heading.tag == "h1"
        # Check Element-level text_alignment_config
        assert el.text_alignment_config.alignment == expected_proto_value


class StHeaderTextAlignmentTest(DeltaGeneratorTestCase):
    """Test st.header text_alignment parameter."""

    @parameterized.expand([
        ("left", TextAlignmentConfig.Alignment.LEFT),
        ("center", TextAlignmentConfig.Alignment.CENTER),
        ("right", TextAlignmentConfig.Alignment.RIGHT),
        ("justify", TextAlignmentConfig.Alignment.JUSTIFY),
    ])
    def test_st_header_text_alignment(self, alignment_value, expected_proto_value):
        """Test st.header with different text_alignment values."""
        st.header("Header text", text_alignment=alignment_value)

        el = self.get_delta_from_queue().new_element
        assert el.heading.body == "Header text"
        assert el.heading.tag == "h2"
        # Check Element-level text_alignment_config
        assert el.text_alignment_config.alignment == expected_proto_value


class StSubheaderTextAlignmentTest(DeltaGeneratorTestCase):
    """Test st.subheader text_alignment parameter."""

    @parameterized.expand([
        ("left", TextAlignmentConfig.Alignment.LEFT),
        ("center", TextAlignmentConfig.Alignment.CENTER),
        ("right", TextAlignmentConfig.Alignment.RIGHT),
        ("justify", TextAlignmentConfig.Alignment.JUSTIFY),
    ])
    def test_st_subheader_text_alignment(self, alignment_value, expected_proto_value):
        """Test st.subheader with different text_alignment values."""
        st.subheader("Subheader text", text_alignment=alignment_value)

        el = self.get_delta_from_queue().new_element
        assert el.heading.body == "Subheader text"
        assert el.heading.tag == "h3"
        # Check Element-level text_alignment_config
        assert el.text_alignment_config.alignment == expected_proto_value
```

**Key Testing Patterns**:

1. ✅ Use `@parameterized.expand()` to test all alignment values in ONE test method
2. ✅ Check `el.text_alignment_config.alignment` (Element-level, not element-specific proto)
3. ✅ Test default behavior (should be LEFT when not specified)
4. ✅ Test invalid values raise `StreamlitInvalidTextAlignmentError`
5. ✅ Each element type (markdown, caption, text, title, header, subheader) gets its own test class

### 4.2 Python Type Tests

**File**: `/lib/tests/streamlit/typing/text_alignment_typing_test.py` (NEW)

```python
"""Type tests for text_alignment parameter."""
from typing_extensions import assert_type

import streamlit as st
from streamlit.delta_generator import DeltaGenerator


def test_markdown_text_alignment_types():
    """Test type checking for st.markdown text_alignment parameter."""
    # Valid types
    assert_type(st.markdown("Test", text_alignment="left"), DeltaGenerator)
    assert_type(st.markdown("Test", text_alignment="center"), DeltaGenerator)
    assert_type(st.markdown("Test", text_alignment="right"), DeltaGenerator)
    assert_type(st.markdown("Test", text_alignment="justify"), DeltaGenerator)

    # Invalid types should fail mypy
    # st.markdown("Test", text_alignment="invalid")  # type: ignore
    # st.markdown("Test", text_alignment=123)  # type: ignore


def test_text_text_alignment_types():
    """Test type checking for st.text text_alignment parameter."""
    assert_type(st.text("Test", text_alignment="left"), DeltaGenerator)
    # ... similar tests


def test_heading_text_alignment_types():
    """Test type checking for heading elements."""
    assert_type(st.title("Test", text_alignment="center"), DeltaGenerator)
    assert_type(st.header("Test", text_alignment="right"), DeltaGenerator)
    assert_type(st.subheader("Test", text_alignment="justify"), DeltaGenerator)
```

### 4.3 Frontend Unit Tests

**Important**: Since text-align styling is now applied in `StyledElementContainerLayoutWrapper`, tests should focus on the utility function rather than individual components.

**File**: `/frontend/lib/src/components/core/Layout/utils.test.ts` (UPDATE)

Add tests for the `getTextAlignmentStyle()` utility function:

```typescript
import { TextAlignmentConfig } from "@streamlit/protobuf";
import { getTextAlignmentStyle } from "./utils";

describe("getTextAlignmentStyle", () => {
  it.each([
    [TextAlignmentConfig.Alignment.LEFT, "left"],
    [TextAlignmentConfig.Alignment.CENTER, "center"],
    [TextAlignmentConfig.Alignment.RIGHT, "right"],
    [TextAlignmentConfig.Alignment.JUSTIFY, "justify"],
    [TextAlignmentConfig.Alignment.UNSPECIFIED, "left"],
  ])(
    "converts %s to %s",
    (alignment: TextAlignmentConfig.Alignment, expectedCSS: string) => {
      const config = TextAlignmentConfig.create({ alignment });
      expect(getTextAlignmentStyle(config)).toBe(expectedCSS);
    }
  );

  it("returns undefined when config is not provided", () => {
    expect(getTextAlignmentStyle(undefined)).toBeUndefined();
  });

  it("returns undefined when alignment is not set", () => {
    const config = TextAlignmentConfig.create({});
    expect(getTextAlignmentStyle(config)).toBeUndefined();
  });
});
```

**File**: `/frontend/lib/src/components/core/Block/StyledElementContainerLayoutWrapper.test.tsx` (UPDATE)

Add tests to verify text-align is applied in the wrapper:

```typescript
import { render } from "@testing-library/react";
import { Element, TextAlignmentConfig } from "@streamlit/protobuf";
import { StyledElementContainerLayoutWrapper } from "./StyledElementContainerLayoutWrapper";

describe("StyledElementContainerLayoutWrapper text alignment", () => {
  it.each([
    ["left", TextAlignmentConfig.Alignment.LEFT],
    ["center", TextAlignmentConfig.Alignment.CENTER],
    ["right", TextAlignmentConfig.Alignment.RIGHT],
    ["justify", TextAlignmentConfig.Alignment.JUSTIFY],
  ])(
    "applies text-align: %s for alignment %s",
    (expectedCSS: string, alignment: TextAlignmentConfig.Alignment) => {
      const node = {
        element: Element.create({
          markdown: { body: "Test" },
          textAlignmentConfig: { alignment },
        }),
      };

      const { container } = render(
        <StyledElementContainerLayoutWrapper node={node}>
          <div>Content</div>
        </StyledElementContainerLayoutWrapper>
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveStyle({ textAlign: expectedCSS });
    }
  );

  it("does not apply text-align when not configured", () => {
    const node = {
      element: Element.create({
        markdown: { body: "Test" },
      }),
    };

    const { container } = render(
      <StyledElementContainerLayoutWrapper node={node}>
        <div>Content</div>
      </StyledElementContainerLayoutWrapper>
    );

    const wrapper = container.firstChild;
    // Should not have text-align style when not configured
    expect(wrapper).not.toHaveStyle({ textAlign: "center" });
  });
});
```

**Key Testing Patterns**:

1. ✅ Use `it.each()` to test all alignment values in ONE test
2. ✅ Test the utility function (`getTextAlignmentStyle`) directly
3. ✅ Test the wrapper component applies the style correctly
4. ✅ Test undefined/missing config returns undefined
5. ✅ No need to test individual components - styling is centralized

### 4.4 E2E Tests

The text_alignment feature should be tested by adding new tests to existing element test files following Streamlit's E2E testing patterns.

#### Update Existing Test Files

**File**: `/e2e_playwright/st_markdown.py` (UPDATE - add test cases at end)

Add test cases for text alignment at the end of the existing file:

```python
# Text alignment tests
st.header("Text Alignment Tests")

# Test each alignment type with text, table, and nested list combined in one element
st.subheader("Left Alignment (Default)")
st.markdown("""
Left aligned text is the default behavior. This demonstrates standard left alignment.

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data A   | Data B   | Data C   |

Here is a nested list:

- Left item 1
- Left item 2
  - Nested A
  - Nested B
    - Deeply nested 1
""", text_alignment="left")

st.subheader("Center Alignment")
st.markdown("""
Center aligned text with some content to demonstrate alignment properly.

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data A   | Data B   | Data C   |

Here is a nested list:

- Center item 1
- Center item 2
  - Nested A
  - Nested B
    - Deeply nested 1
""", text_alignment="center")

st.subheader("Right Alignment")
st.markdown("""
Right aligned text content demonstrates right-side alignment.

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data A   | Data B   | Data C   |

Here is a nested list:

- Right item 1
- Right item 2
  - Nested A
  - Nested B
""", text_alignment="right")

st.subheader("Justify Alignment")
st.markdown("""
Justified text alignment. This is a longer paragraph that demonstrates text justification properly. The text stretches to fill the available width with even spacing between words on all lines except the last one.

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data A   | Data B   | Data C   |

Here is a nested list:

- Justify item 1
- Justify item 2
  - Nested A
  - Nested B
""", text_alignment="justify")

# Width interaction tests
st.subheader("Width Parameter Interaction")
with st.container(key="width_tests"):
    st.markdown("Center with stretch width", text_alignment="center", width="stretch")
    st.markdown("Center with content width", text_alignment="center", width="content")
```

**File**: `/e2e_playwright/st_markdown_test.py` (UPDATE - add test functions)

Add test functions to the existing test file:

```python
# Add to imports
import pytest
from e2e_playwright.shared.app_utils import get_markdown


@pytest.mark.parametrize(
    "alignment,text_content",
    [
        ("left", "Left aligned text is the default behavior"),
        ("center", "Center aligned text with some content"),
        ("right", "Right aligned text content"),
        ("justify", "Justified text alignment"),
    ],
)
def test_markdown_text_alignment(
    app: Page,
    assert_snapshot: ImageCompareFunction,
    alignment: str,
    text_content: str,
):
    """Test st.markdown text alignment for all alignment types.

    This test verifies that text, tables, and nested lists all respond correctly
    to text-align CSS for each alignment value. All content types are combined
    in a single markdown element for comprehensive testing.
    """
    # Get the combined markdown element (contains text, table, and nested list)
    element = get_markdown(app, text_content)
    expect(element).to_be_visible()
    element.scroll_into_view_if_needed()

    # Verify CSS is applied to the container
    expect(element).to_have_css("text-align", alignment)

    # Verify all content types are present in the element
    # 1. Text (already verified by finding element with text_content)

    # 2. Table (critical for inline-block CSS approach)
    table = element.locator("table")
    expect(table).to_be_visible()

    # 3. Nested list (critical for verifying indentation preservation)
    top_level_items = element.locator("ul > li")
    expect(top_level_items.first).to_be_visible()

    # Verify nested items exist and are properly indented
    nested_items = element.locator("li li")
    expect(nested_items.first).to_be_visible()

    # Single comprehensive snapshot showing text + table + list alignment
    assert_snapshot(element, name=f"st_markdown-text_alignment_{alignment}")


def test_markdown_text_alignment_with_width(app: Page):
    """Test that text_alignment CSS is applied regardless of width parameter."""
    # Get width test elements from keyed container
    width_section = app.get_by_role("heading", name="Width Parameter Interaction")
    width_container = width_section.locator("..").get_by_test_id("stVerticalBlock")

    # Center with stretch width
    stretch_element = get_markdown(width_container, "Center with stretch width")
    expect(stretch_element).to_be_visible()
    expect(stretch_element).to_have_css("text-align", "center")

    # Center with content width (CSS is applied but visual effect may be limited)
    content_element = get_markdown(width_container, "Center with content width")
    expect(content_element).to_be_visible()
    expect(content_element).to_have_css("text-align", "center")
```

**Similar updates needed for other elements**:

1. **File**: `/e2e_playwright/st_text.py` (UPDATE)

   - Add test cases for `st.text()` with text_alignment parameter
   - Use keyed containers for each alignment value

2. **File**: `/e2e_playwright/st_text_test.py` (UPDATE)

   - Add snapshot tests for each alignment
   - Verify CSS property is applied

3. **File**: `/e2e_playwright/st_heading.py` (UPDATE)

   - Add test cases for `st.title()`, `st.header()`, `st.subheader()` with text_alignment
   - Use keyed containers

4. **File**: `/e2e_playwright/st_heading_test.py` (UPDATE)
   - Add snapshot tests for each heading element with alignment
   - Test interaction with divider parameter (for header/subheader)

**Example pattern for st_text.py**:

```python
# Add at end of existing st_text.py file
st.header("Text Alignment Tests", key="text_alignment_section")

with st.container(key="text_left"):
    st.text("Left aligned text", text_alignment="left")

with st.container(key="text_center"):
    st.text("Center aligned text", text_alignment="center")

with st.container(key="text_right"):
    st.text("Right aligned text", text_alignment="right")
```

**Example pattern for st_text_test.py**:

```python
def test_text_alignment_center(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.text with text_alignment='center'."""
    element = get_element_by_key(app, "text_center").get_by_test_id("stText")
    expect(element).to_be_visible()
    element.scroll_into_view_if_needed()
    assert_snapshot(element, name="st_text-text_alignment_center")
```

---

## 5. Implementation Checklist

### Phase 1: Proto Layer

- [ ] Create `TextAlignmentConfig.proto` with Alignment enum
- [ ] Add `text_alignment_config` field to `Element.proto` (ONE file, not individual protos)
- [ ] Add import for `TextAlignmentConfig.proto` in `Element.proto`
- [ ] Run `make protobuf` to compile protobufs
- [ ] Verify generated Python and TypeScript files

**Files modified**: 2 (TextAlignmentConfig.proto, Element.proto)

### Phase 2: Python Layer

- [ ] Add `TextAlignment` type alias to `layout_utils.py`
- [ ] Update `LayoutConfig` dataclass to include `text_alignment` field
- [ ] Add `validate_text_alignment()` function to `layout_utils.py`
- [ ] Add `get_text_alignment_config()` function to `layout_utils.py`
- [ ] Add `StreamlitInvalidTextAlignmentError` to `errors.py`
- [ ] Update `DeltaGenerator._enqueue()` to handle `layout_config.text_alignment`
- [ ] Add `text_alignment` parameter to `st.markdown()` in `markdown.py`
- [ ] Add `text_alignment` parameter to `st.caption()` in `markdown.py`
- [ ] Add `text_alignment` parameter to `st.text()` in `text.py`
- [ ] Add `text_alignment` parameter to `st.title()` in `heading.py`
- [ ] Add `text_alignment` parameter to `st.header()` in `heading.py`
- [ ] Add `text_alignment` parameter to `st.subheader()` in `heading.py`
- [ ] Run `make python-lint` and fix any issues
- [ ] Run `make python-types` and fix any issues

**Files modified**: 5 (layout_utils.py, errors.py, delta_generator.py, markdown.py, text.py, heading.py)
**Note**: NO proto copying in element files - handled centrally in `_enqueue`

### Phase 3: Frontend Layer

- [ ] Add `getTextAlignmentStyle()` utility function to `utils.ts`
- [ ] Update `styled-components.ts` to add inline-block display for tables
- [ ] Update `styled-components.ts` to add inline-block for top-level lists only
- [ ] Update `styled-components.ts` to ensure nested lists remain block-level
- [ ] Update `StyledElementContainerLayoutWrapper.tsx` to apply text alignment
- [ ] Test with nested lists (2-3 levels deep) to ensure proper indentation
- [ ] Test with multiple tables to ensure proper stacking
- [ ] Run `make frontend-lint` and fix any issues
- [ ] Run `make frontend-types` and fix any issues

**Files modified**: 3 (utils.ts, styled-components.ts, StyledElementContainerLayoutWrapper.tsx)
**Note**: NO changes to individual components - styling applied centrally

### Phase 4: Testing

**Python Unit Tests:**

- [ ] Add parameterized test class for `st.markdown()` text_alignment
- [ ] Add parameterized test class for `st.caption()` text_alignment
- [ ] Add parameterized test class for `st.text()` text_alignment
- [ ] Add parameterized test class for `st.title()` text_alignment
- [ ] Add parameterized test class for `st.header()` text_alignment
- [ ] Add parameterized test class for `st.subheader()` text_alignment
- [ ] Verify all tests check Element-level `text_alignment_config` (not element-specific proto)
- [ ] Test default behavior (no parameter = LEFT alignment)
- [ ] Test invalid values raise `StreamlitInvalidTextAlignmentError`
- [ ] Write Python type tests for all elements
- [ ] Run `make python-tests` and verify all pass

**Frontend Unit Tests:**

- [ ] Write parameterized tests for `getTextAlignmentStyle()` utility function
- [ ] Write parameterized tests for `StyledElementContainerLayoutWrapper` text-align application
- [ ] Test undefined/missing config behavior
- [ ] Run `make frontend-tests` and verify all pass

**Note**: Use `@parameterized.expand()` (Python) and `it.each()` (TypeScript) for all alignment values. Frontend tests focus on wrapper and utility, NOT individual components (styling is centralized).

**E2E Tests:**

- [ ] Update `/e2e_playwright/st_markdown.py` with text_alignment test cases
- [ ] Update `/e2e_playwright/st_markdown_test.py` with text_alignment tests
- [ ] Update `/e2e_playwright/st_text.py` with text_alignment test cases
- [ ] Update `/e2e_playwright/st_text_test.py` with text_alignment tests
- [ ] Update `/e2e_playwright/st_heading.py` with text_alignment test cases
- [ ] Update `/e2e_playwright/st_heading_test.py` with text_alignment tests
- [ ] Run E2E tests: `make run-e2e-test st_markdown_test.py`
- [ ] Run E2E tests: `make run-e2e-test st_text_test.py`
- [ ] Run E2E tests: `make run-e2e-test st_heading_test.py`
- [ ] Review and update snapshots for visual regression
- [ ] Verify tests pass on all browsers (chromium, firefox, webkit)
- [ ] **Critical**: Verify nested list snapshot shows proper indentation

### Phase 5: Documentation & Polish

- [ ] Review all docstrings for clarity and completeness
- [ ] Verify all parameter descriptions follow Numpy style
- [ ] Test in actual Streamlit app with various scenarios
- [ ] Verify backwards compatibility (existing apps without parameter)
- [ ] Run full test suite: `make python-tests frontend-tests`
- [ ] Run linters: `make python-lint frontend-lint`
- [ ] Run type checkers: `make python-types frontend-types`

---

## 6. Known Limitations & Edge Cases

### Width Interaction Issue

As noted in the spec, there's a known interaction between `text_alignment` and `width`:

**Problematic scenario**:

```python
# Short text with width="content" - alignment has minimal visible effect
st.markdown("Short", text_alignment="center", width="content")
# The element shrinks to text width, so centering within it is not visible
```

**Recommendation**: This is acceptable and documented in the parameter description. Users who want visible text alignment should use `width="stretch"` (the default for markdown/caption) or an explicit pixel width.

### Inline-Block Approach for Tables and Lists

**Implementation Decision**: We use `display: inline-block` for tables and lists to make them respect `text-align`.

**Benefits**:

- ✅ Tables center/right-align properly
- ✅ Lists center/right-align properly
- ✅ Works with all text-align values (left, center, right, justify)
- ✅ Intuitive user experience

**Potential Side Effects**:

- Width calculation: Inline-block elements size to their content by default, but markdown tables already do this
- Stacking: Multiple tables/lists should still stack vertically (tested and confirmed)
- Nested lists: Require special handling to remain block-level for proper indentation

**Nested List Handling**:

```typescript
// Only top-level lists are inline-block
"& > ul, & > ol": {
  display: "inline-block",
  textAlign: "left",
},

// Nested lists must remain block-level
"li > ul, li > ol": {
  display: "block",
},
```

**Testing Priority**: Thoroughly test with:

- Multiple tables in sequence
- Nested lists (2-3 levels deep)
- Mixed content (tables + lists + text)
- Long tables that approach container width
- Very short lists (1-2 items)

### Backwards Compatibility

- All new parameters have defaults (`text_alignment="left"`)
- Existing apps without the parameter continue to work
- Proto field is optional, so old cached messages are compatible
- Default alignment is "left", matching current behavior
- The inline-block CSS change applies to all markdown tables/lists, but with default left alignment there should be no visual change

### Browser Compatibility

- CSS `text-align` property is universally supported
- `text-align: justify` works across all modern browsers
- `display: inline-block` is universally supported
- No special handling needed for RTL languages (CSS handles this)

---

## 7. Testing Commands

```bash
# Compile protobufs after proto changes
make protobuf

# Python linting and formatting
make python-lint
make python-format

# Python type checking
make python-types

# Run specific Python unit tests
pytest lib/tests/streamlit/elements/markdown_test.py
pytest lib/tests/streamlit/elements/text_test.py
pytest lib/tests/streamlit/elements/heading_test.py

# Frontend linting and formatting
make frontend-lint
make frontend-format

# Frontend type checking
make frontend-types

# Run frontend unit tests (from /frontend directory)
cd frontend
yarn test lib/src/components/elements/Markdown/Markdown.test.tsx

# Run E2E tests
make run-e2e-test st_markdown_test.py
make run-e2e-test st_text_test.py
make run-e2e-test st_heading_test.py

# Run all tests
make python-tests frontend-tests
```

---

## 8. Future Enhancements (Out of Scope)

These are NOT part of this implementation but could be considered later:

1. **Vertical text alignment**: `vertical_alignment` parameter for elements
2. **Auto width mode**: Implement `width="auto"` as discussed in spec
3. **RTL language detection**: Automatic text direction based on content
4. **Text direction parameter**: Explicit `text_direction="ltr"|"rtl"` parameter

---

## 9. References

- **Spec Document**: `TEXT_ALIGNMENT_SPEC.md`
- **Layout Feature Guide**: `STREAMLIT_LAYOUT_FEATURE.md`
- **GitHub Issue**: https://github.com/streamlit/streamlit/issues/4109
- **CSS text-align**: https://developer.mozilla.org/en-US/docs/Web/CSS/text-align
- **CSS display**: https://developer.mozilla.org/en-US/docs/Web/CSS/display
- **Proto Style Guide**: `/proto/streamlit/proto/AGENTS.md`
- **Python Style Guide**: `/lib/AGENTS.md`
- **Frontend Style Guide**: `/frontend/AGENTS.md`

---

## 10. Development Resources

### CSS Analysis & Testing

During implementation, the following resources were created to analyze CSS approaches:

**File**: `/work-tmp/text_alignment_css_analysis.md`

- Detailed analysis of 5 different CSS approaches for aligning tables and lists
- Comparison of margin-auto vs inline-block approaches
- Pros and cons of each approach
- Recommended implementation (Option 3: inline-block for tables and lists)

**File**: `/work-tmp/text_alignment_css_demo.html`

- Interactive HTML demo comparing all CSS approaches side-by-side
- Live examples of tables, lists, and text with different alignment strategies
- Visual demonstration of why inline-block was chosen
- Can be opened in browser for visual inspection

**File**: `/work-tmp/test_text_alignment_edge_cases.py`

- Streamlit test app showcasing complex content types
- Tests edge cases: nested lists, tables, code blocks, mixed content
- Demonstrates where text-align may have limitations
- Useful for manual testing during development

**File**: `/work-tmp/test_text_alignment_with_css.py`

- Streamlit test app with custom CSS to simulate different approaches
- Side-by-side comparison of CSS strategies
- Interactive testing of inline-block vs margin-auto

### Key Implementation Decisions

1. **Inline-block for tables and lists**: After testing multiple approaches, inline-block was chosen because:

   - Most intuitive user experience (tables and lists center as expected)
   - Works with all text-align values
   - No additional complexity beyond CSS
   - Minimal side effects (tested with nested content)

2. **Nested list handling**: Critical to only apply inline-block to top-level lists using `& > ul, & > ol` selector, otherwise nested lists lose proper indentation

3. **No code block alignment**: Code blocks (`<pre>`) intentionally left as block-level because:
   - Code is typically left-aligned by convention
   - Centered code would be confusing for users
   - Can be documented as expected behavior
