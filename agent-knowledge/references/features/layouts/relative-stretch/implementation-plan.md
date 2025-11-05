---
status: stable
last_updated: 2025-11-05
---

# Relative Stretch Width/Height Implementation Plan

## Implementation Decision Summary

**Key Simplification**: We treat `width="stretch"` as `width="stretch:1"` internally.

- **Python Backend**: Always sets `stretch_scale = 1.0` for all stretch modes (explicit or default)
- **Frontend**: Always uses scale value from proto (defaults to 1.0 for old messages without the field)
- **Benefit**: Eliminates special case logic, cleaner code, consistent behavior
- **User Impact**: None - `width="stretch"` still works exactly as before, just internally represented as scale=1.0

## Critical Analysis of Spec

### Strengths

1. **API Choice**: `width="stretch:N"` (Option 2) is consistent with the Google Fonts pattern already used in theming
2. **Behavior Alignment**: Matches existing `st.columns([2, 1])` mental model, making it intuitive for users
3. **Backwards Compatible**: `width="stretch:1"` equivalent to `width="stretch"` ensures smooth migration
4. **Flexible Scale**: Supporting both int and float allows fine-grained control (e.g., `1.5`, `2.3`)

### Identified Gaps & Concerns

#### 1. **API Validation & Error Handling**

The spec doesn't address:

- **Invalid formats**: What happens with `width="stretch:"` (missing N), `width="stretch:abc"` (non-numeric), `width="stretch:-1"` (negative)?
- **Edge cases**: `width="stretch:0"` (zero scale - should be invalid)
- **Precision limits**: Should we cap the scale (e.g., max 100)? Very large values could cause layout issues

**Recommendation**:

- Reject zero and negative values with clear error messages
- Support floats with reasonable precision (2-3 decimal places)
- Consider max value of 100 to prevent abuse
- Provide helpful error message: "width must be 'stretch' or 'stretch:N' where N is a positive number"

#### 2. **Mixed Layouts Behavior**

The spec states "if only one element has N set, it behaves like width='stretch'" but doesn't fully clarify:

- What if we have: `stretch:2` alone in a container? Does it fill 100% of space (not 200%)?
- Mixed modes: Container with `width="stretch:2"`, `width="content"`, and `width=300`?

**Implementation Decision**: ✅ **SIMPLIFIED**

- **Treat `width="stretch"` as `width="stretch:1"` internally**
- All stretch elements have a scale factor (default: 1.0)
- Scale is **relative to other stretch elements**, not absolute
- Non-stretch elements (content, pixel) are sized first, then remaining space is divided among stretch elements by their scale factors
- This is standard flexbox behavior - `flex-grow` only affects how **remaining** space is distributed
- Simpler implementation: no special casing needed, flex-grow always uses the scale value

#### 3. **Height in Vertical Containers**

The spec mentions "same for height" but doesn't explicitly show vertical layout examples.

**Should verify**:

- `height="stretch:2"` works in vertical containers (`st.container(horizontal=False)`)
- Height scales work with `st.columns()` (vertical distribution within each column)

#### 4. **Interaction with Min/Max Width Constraints**

Current implementation has minimum widths for element categories (14rem for large, 8rem for medium).

**Question**: How do scales interact with these minimums?

- If container is 300px wide, element A has `width="stretch:2"` (min 14rem = 224px), element B has `width="stretch:1"` (min 8rem = 128px)
- 224px + 128px = 352px > 300px container → overflow or proportional reduction?

**Recommendation**:

- The `flex` shorthand handles this: `flex: "2 1 14rem"` means "grow at 2x rate, shrink at 1x rate, base is 14rem"
- Browser flex algorithm will handle overflow by shrinking elements while respecting flex-shrink ratios
- Document this behavior for users

#### 5. **Type System Updates**

The spec doesn't mention TypeScript/Python type system changes.

**Required**:

- Update `Width` and `Height` TypeAlias to allow `"stretch:N"` format
- This is a string pattern that needs runtime validation, not compile-time validation
- Keep types as `int | Literal["stretch", "content"]` for now, since `"stretch:2"` is just a special string format

#### 6. **Cross-Container Inheritance**

What happens if a stretched element with scale contains a stretched child?

```python
with st.container(horizontal=True) as outer:
    with st.container(width="stretch:2") as inner:  # inner container
        st.text("A", width="stretch")  # relative to inner or outer?
```

**Answer**: Each flex container is independent - the child element only knows about its immediate parent's flex context. This is correct CSS behavior.

---

## Implementation Plan

### Phase 1: Python Backend (lib/streamlit)

#### 1.1 Update Type Aliases & Constants

**File**: `lib/streamlit/elements/lib/layout_utils.py`

```python
# Add after existing imports
import re
from typing import Final

# Pattern for matching "stretch:N" format
_STRETCH_SCALE_PATTERN: Final = re.compile(r"^stretch:(\d+\.?\d*)$")

# Keep existing type aliases unchanged - they allow any string, validated at runtime
# Width: TypeAlias = int | Literal["stretch", "content"]
# Height: TypeAlias = int | Literal["stretch", "content"]
```

#### 1.2 Create Scale Parsing Utility

**File**: `lib/streamlit/elements/lib/layout_utils.py`

```python
def _parse_stretch_scale(value: str) -> tuple[bool, float | None]:
    """Parse stretch scale from format 'stretch:N'.

    Parameters
    ----------
    value : str
        The value to parse (e.g., "stretch", "stretch:2", "stretch:1.5")

    Returns
    -------
    tuple[bool, float | None]
        (is_stretch_with_scale, scale_value)
        - If value is exactly "stretch", returns (False, None)
        - If value is "stretch:N", returns (True, N as float)
        - Otherwise returns (False, None)

    Examples
    --------
    >>> _parse_stretch_scale("stretch")
    (False, None)
    >>> _parse_stretch_scale("stretch:2")
    (True, 2.0)
    >>> _parse_stretch_scale("stretch:1.5")
    (True, 1.5)
    >>> _parse_stretch_scale("content")
    (False, None)
    """
    if not isinstance(value, str):
        return (False, None)

    if value == "stretch":
        return (False, None)

    match = _STRETCH_SCALE_PATTERN.match(value)
    if match:
        scale = float(match.group(1))
        return (True, scale)

    return (False, None)
```

#### 1.3 Update Validation Functions

**File**: `lib/streamlit/elements/lib/layout_utils.py`

**Changes to `validate_width()`**:

```python
def validate_width(width: Width, allow_content: bool = False) -> None:
    """Validate the width parameter.

    Parameters
    ----------
    width : Any
        The width value to validate. Can be:
        - int: pixel width (must be positive)
        - "stretch": fill available space
        - "stretch:N": fill available space with relative scale N
        - "content": size to content (if allow_content=True)
    allow_content : bool
        Whether to allow "content" as a valid width value.

    Raises
    ------
    StreamlitInvalidWidthError
        If the width value is invalid.
    """
    if not isinstance(width, (int, str)):
        raise StreamlitInvalidWidthError(width, allow_content)

    if isinstance(width, str):
        # Check for stretch with scale
        is_scaled_stretch, scale = _parse_stretch_scale(width)

        if is_scaled_stretch:
            # Validate scale value
            if scale <= 0:
                raise StreamlitInvalidWidthError(
                    width,
                    allow_content,
                    detail="Scale value in 'stretch:N' must be a positive number"
                )
            if scale > 100:
                raise StreamlitInvalidWidthError(
                    width,
                    allow_content,
                    detail="Scale value in 'stretch:N' must not exceed 100"
                )
            return  # Valid scaled stretch

        # Check standard string values
        valid_strings = ["stretch"]
        if allow_content:
            valid_strings.append("content")

        if width not in valid_strings:
            raise StreamlitInvalidWidthError(width, allow_content)
    elif width <= 0:
        raise StreamlitInvalidWidthError(width, allow_content)
```

**Similar changes for `validate_height()`** - apply same pattern.

**Note**: The `StreamlitInvalidWidthError` and `StreamlitInvalidHeightError` exceptions may need to support an optional `detail` parameter for better error messages.

#### 1.4 Update Proto Conversion

**File**: `lib/streamlit/elements/lib/layout_utils.py`

```python
def get_width_config(width: Width | SpaceSize) -> WidthConfig:
    """Convert width value to WidthConfig proto message.

    Handles:
    - int/float: pixel width
    - "stretch": use_stretch=True, scale=1.0 (default scale)
    - "stretch:N": use_stretch=True, scale=N
    - "content": use_content=True
    - "small"/"medium"/"large": rem_width

    Note: All stretch modes set a scale value. Plain "stretch" is treated
    as "stretch:1" internally for consistency.
    """
    width_config = WidthConfig()

    if isinstance(width, str) and width in SIZE_TO_REM_MAPPING:
        # Space size literals
        width_config.rem_width = SIZE_TO_REM_MAPPING[width]
    elif isinstance(width, (int, float)):
        # Pixel width
        width_config.pixel_width = int(width)
    elif width == "content":
        # Content sizing
        width_config.use_content = True
    else:
        # Stretch mode (with or without explicit scale)
        # Treat "stretch" as "stretch:1" internally
        is_scaled_stretch, scale = _parse_stretch_scale(width)
        width_config.use_stretch = True
        width_config.stretch_scale = scale if is_scaled_stretch else 1.0

    return width_config


def get_height_config(height: Height | SpaceSize) -> HeightConfig:
    """Convert height value to HeightConfig proto message.

    Similar to get_width_config but for height dimension.
    All stretch modes set a scale value (default: 1.0 for plain "stretch").
    """
    height_config = HeightConfig()

    if isinstance(height, str) and height in SIZE_TO_REM_MAPPING:
        height_config.rem_height = SIZE_TO_REM_MAPPING[height]
    elif isinstance(height, (int, float)):
        height_config.pixel_height = int(height)
    elif height == "content":
        height_config.use_content = True
    else:
        # Stretch mode (with or without explicit scale)
        # Treat "stretch" as "stretch:1" internally
        is_scaled_stretch, scale = _parse_stretch_scale(height)
        height_config.use_stretch = True
        height_config.stretch_scale = scale if is_scaled_stretch else 1.0

    return height_config
```

#### 1.5 Handle `use_container_width` Deprecation Conflict ⚠️

**Critical Issue**: Several chart elements support the deprecated `use_container_width` parameter which **overwrites** the `width` parameter, losing the scale factor.

**Affected Files**:

- `lib/streamlit/elements/plotly_chart.py` (lines 577-593)
- `lib/streamlit/elements/pyplot.py` (lines 136-149)
- `lib/streamlit/elements/graphviz_chart.py` (lines 163-175)
- `lib/streamlit/elements/vega_charts.py` (lines 2210-2227)

**Problem**: When user calls `st.plotly_chart(fig, width="stretch:2", use_container_width=True)`, the deprecation handling code does:

```python
if use_container_width:
    width = "stretch"  # ❌ Overwrites width="stretch:2", losing the :2 scale!
```

**Solution**: Extract scale factor BEFORE deprecation handling, then reapply:

```python
# BEFORE handling use_container_width deprecation
# Extract scale factor from width parameter if present
scale_factor = None
if isinstance(width, str) and width.startswith("stretch:"):
    is_scaled, scale_factor = _parse_stretch_scale(width)

# Handle use_container_width deprecation
if use_container_width is not None:
    show_deprecation_warning(...)
    if use_container_width:
        width = "stretch"
    elif not isinstance(width, int):
        width = "content"

# AFTER handling deprecation: Reapply scale factor if it was present
if scale_factor is not None:
    width = f"stretch:{scale_factor}"
```

**Alternative Solution (Simpler)**: Since `use_container_width` is deprecated (removal planned for 2025-12-31), we could just document this as a known limitation and tell users not to mix `use_container_width=True` with `width="stretch:N"`.

**Recommendation for POC**: For now, don't use `use_container_width` with scaled stretch. The workaround is simple - just use `width="stretch:N"` without `use_container_width`.

---

### Phase 2: Protocol Buffers (proto/streamlit/proto)

#### 2.1 Update WidthConfig.proto

**File**: `proto/streamlit/proto/WidthConfig.proto`

```protobuf
message WidthConfig {
  oneof width_spec {
    bool use_stretch = 1;
    bool use_content = 2;
    uint32 pixel_width = 3;
    float rem_width = 4;
  }

  // Optional scale factor for stretch mode.
  // Only meaningful when use_stretch=true.
  // Default: 1.0 (equal distribution with other stretch elements)
  // Example: 2.0 means this element takes 2x the space of elements with scale=1.0
  optional float stretch_scale = 5;
}
```

**Backwards Compatibility**: ✅ SAFE

- Adding an optional field is backwards compatible
- **New behavior**: All new messages with `use_stretch=true` will set `stretch_scale=1.0` (or higher)
- **Old messages**: Older messages without `stretch_scale` will be handled by frontend (default to 1.0)
- Older clients reading new messages with `stretch_scale` will ignore the field (graceful degradation)
- The field is marked `optional` for proto compatibility, but Python backend always sets it for stretch mode

#### 2.2 Update HeightConfig.proto

**File**: `proto/streamlit/proto/HeightConfig.proto`

```protobuf
message HeightConfig {
  oneof height_spec {
    bool use_stretch = 1;
    bool use_content = 2;
    uint32 pixel_height = 3;
    float rem_height = 4;
  }

  // Optional scale factor for stretch mode.
  // Only meaningful when use_stretch=true.
  // Default: 1.0 (equal distribution with other stretch elements)
  optional float stretch_scale = 5;
}
```

#### 2.3 Compile Protobufs

After updating proto files, run:

```bash
make protobuf
```

This will regenerate Python and TypeScript bindings.

---

### Phase 3: Frontend TypeScript (frontend/lib)

#### 3.1 Update LayoutDimensionConfig Type

**File**: `frontend/lib/src/components/core/Layout/useLayoutStyles.ts`

```typescript
type LayoutDimensionConfig =
  | { type: DimensionType.STRETCH; scale: number } // Scale is always set (min 1.0)
  | { type: DimensionType.CONTENT }
  | { type: DimensionType.PIXEL; pixels: number }
  | { type: DimensionType.REM; rem: number }
  | { type: DimensionType.AUTO };
```

#### 3.2 Update getWidth() Function

**File**: `frontend/lib/src/components/core/Layout/useLayoutStyles.ts`

```typescript
const getWidth = (
  element: Element | BlockProto,
  subElement?: SubElement
): LayoutDimensionConfig => {
  // ... existing useContainerWidth logic ...

  const isStretch =
    element.widthConfig?.useStretch || subElement?.widthConfig?.useStretch;

  if (isStretch) {
    // Get scale from proto, defaulting to 1.0 for backwards compatibility
    // with old messages that don't have stretch_scale set
    const scale = element.widthConfig?.stretchScale ?? 1.0;
    return { type: DimensionType.STRETCH, scale };
  }

  // ... rest of existing logic ...
};
```

#### 3.3 Update getHeight() Function

**File**: `frontend/lib/src/components/core/Layout/useLayoutStyles.ts`

```typescript
const getHeight = (
  element: Element | BlockProto,
  subElement?: SubElement
): LayoutDimensionConfig => {
  const isStretch = !!element.heightConfig?.useStretch;

  if (isStretch) {
    // Get scale from proto, defaulting to 1.0 for backwards compatibility
    const scale = element.heightConfig?.stretchScale ?? 1.0;
    return { type: DimensionType.STRETCH, scale };
  }

  // ... rest of existing logic ...
};
```

#### 3.4 Update getFlex() Function

**File**: `frontend/lib/src/components/core/Layout/useLayoutStyles.ts`

**This is the KEY change** - using the scale in flex-grow:

```typescript
const getFlex = (
  widthConfig: LayoutDimensionConfig,
  heightConfig: LayoutDimensionConfig,
  direction: Direction | undefined,
  minStretchBehavior?: MinFlexElementWidth
): string | undefined => {
  if (direction === Direction.HORIZONTAL) {
    switch (widthConfig.type) {
      case DimensionType.PIXEL:
        return `0 0 ${widthConfig.pixels}px`;
      case DimensionType.REM:
        return `0 0 ${widthConfig.rem}rem`;
      case DimensionType.CONTENT:
        return "0 0 fit-content";
      case DimensionType.STRETCH:
        // Use scale as flex-grow value (scale is always set, minimum 1.0)
        return `${widthConfig.scale} 1 ${minStretchBehavior ?? "fit-content"}`;
      case DimensionType.AUTO:
        return undefined;
      default:
        assertNever(widthConfig);
    }
  } else if (direction === Direction.VERTICAL) {
    switch (heightConfig.type) {
      case DimensionType.PIXEL:
        return `0 0 ${heightConfig.pixels}px`;
      case DimensionType.REM:
        return `0 0 ${heightConfig.rem}rem`;
      case DimensionType.CONTENT:
        // Content sizing in vertical layout - no flex
        return undefined;
      case DimensionType.STRETCH:
        // Use scale as flex-grow value for vertical stretch (scale always set)
        return `${heightConfig.scale} 1 auto`;
      case DimensionType.AUTO:
        return undefined;
      default:
        assertNever(heightConfig);
    }
  }

  return undefined;
};
```

**CSS Flex Shorthand Explanation**:

- `flex: "<grow> <shrink> <basis>"`
- `flex: "2 1 14rem"` means:
  - `flex-grow: 2` → Takes 2x the remaining space compared to elements with flex-grow: 1
  - `flex-shrink: 1` → Shrinks at same rate if container too small
  - `flex-basis: 14rem` → Minimum size before growing/shrinking

**Implementation Simplification**:

- `width="stretch"` internally becomes `width="stretch:1"` (scale = 1.0)
- All stretch elements have a scale value, eliminating special case logic
- Frontend always uses the scale directly from proto (default 1.0 for old messages)
- This makes the code cleaner and behavior more consistent

#### 3.5 Update Element-Specific Overrides ⚠️

**File**: `frontend/lib/src/components/core/Block/StyledElementContainerLayoutWrapper.tsx`

**Critical Issue**: Some elements have special `styleOverrides` that hardcode flex values. These are applied **after** `useLayoutStyles`, so they override the scale. Must update them to use scale.

**Elements with Hardcoded Flex Values:**

**1. TextArea (line ~126-132)**

```typescript
if (node.element.type === "textArea") {
  if (node.element.heightConfig?.useStretch) {
    // ✅ Use the scale from heightConfig
    const scale = node.element.heightConfig?.stretchScale ?? 1.0;
    return {
      height: "100%",
      flex: `${scale} 1 8rem`, // Was hardcoded as "1 1 8rem"
    };
  }
  // ... rest of logic
}
```

**2. ArrowVegaLiteChart (line ~152-165)**

```typescript
} else if (node.element.type === "arrowVegaLiteChart") {
  if (node.element.widthConfig?.useContent) {
    styles.width = "100%"
  }
  if (isInHorizontalLayout && !node.element.widthConfig) {
    // Legacy behavior for old charts without widthConfig
    styles.flex = "1 1 14rem"
  } else if (
    isInHorizontalLayout &&
    node.element.widthConfig?.useStretch &&
    node.element.widthConfig?.stretchScale
  ) {
    // ✅ When widthConfig has a custom scale, apply it
    const scale = node.element.widthConfig.stretchScale
    styles.flex = `${scale} 1 14rem`
  }
  return styles
}
```

**Why This Matters**: `styleOverrides` are merged after `useLayoutStyles` calculation:

```typescript
return {
  ...calculatedStyles, // From useLayoutStyles
  ...styleOverrides, // Element-specific overrides (applied last, take precedence)
};
```

If an element returns `flex: "1 1 14rem"` in styleOverrides, it will override the flex value calculated by `useLayoutStyles`, even if that calculation correctly used the scale.

**Action Required**: Audit all elements in `StyledElementContainerLayoutWrapper.tsx` that set `flex` in their styleOverrides and update them to use the scale value.

---

### Phase 4: Testing

#### 4.1 Python Unit Tests

**File**: `lib/tests/streamlit/elements/lib/layout_utils_test.py`

```python
import pytest
from streamlit.elements.lib.layout_utils import (
    _parse_stretch_scale,
    validate_width,
    validate_height,
    get_width_config,
    get_height_config,
)
from streamlit.errors import StreamlitInvalidWidthError, StreamlitInvalidHeightError


class TestParseStretchScale:
    """Test the _parse_stretch_scale utility function."""

    def test_plain_stretch(self):
        is_scaled, scale = _parse_stretch_scale("stretch")
        assert is_scaled is False
        assert scale is None

    def test_stretch_with_integer_scale(self):
        is_scaled, scale = _parse_stretch_scale("stretch:2")
        assert is_scaled is True
        assert scale == 2.0

    def test_stretch_with_float_scale(self):
        is_scaled, scale = _parse_stretch_scale("stretch:1.5")
        assert is_scaled is True
        assert scale == 1.5

    def test_stretch_with_decimal_variations(self):
        # "stretch:2.0" should work
        is_scaled, scale = _parse_stretch_scale("stretch:2.0")
        assert is_scaled is True
        assert scale == 2.0

        # "stretch:0.5" should work
        is_scaled, scale = _parse_stretch_scale("stretch:0.5")
        assert is_scaled is True
        assert scale == 0.5

    def test_non_stretch_values(self):
        assert _parse_stretch_scale("content") == (False, None)
        assert _parse_stretch_scale("auto") == (False, None)
        assert _parse_stretch_scale("100") == (False, None)

    def test_invalid_formats(self):
        # Missing scale value
        assert _parse_stretch_scale("stretch:") == (False, None)
        # Non-numeric scale
        assert _parse_stretch_scale("stretch:abc") == (False, None)
        # Multiple colons
        assert _parse_stretch_scale("stretch:2:3") == (False, None)


class TestValidateWidth:
    """Test width validation with scale support."""

    def test_valid_stretch_variants(self):
        # Plain stretch
        validate_width("stretch")
        # Stretch with integer scale
        validate_width("stretch:2")
        # Stretch with float scale
        validate_width("stretch:1.5")
        # Stretch with scale of 1 (equivalent to plain stretch)
        validate_width("stretch:1")

    def test_valid_content_when_allowed(self):
        validate_width("content", allow_content=True)

    def test_valid_pixel_width(self):
        validate_width(100)
        validate_width(1)

    def test_invalid_zero_scale(self):
        with pytest.raises(StreamlitInvalidWidthError):
            validate_width("stretch:0")

    def test_invalid_negative_scale(self):
        with pytest.raises(StreamlitInvalidWidthError):
            validate_width("stretch:-1")

    def test_invalid_too_large_scale(self):
        with pytest.raises(StreamlitInvalidWidthError):
            validate_width("stretch:101")

    def test_invalid_formats(self):
        with pytest.raises(StreamlitInvalidWidthError):
            validate_width("stretch:")
        with pytest.raises(StreamlitInvalidWidthError):
            validate_width("stretch:abc")
        with pytest.raises(StreamlitInvalidWidthError):
            validate_width("invalid")

    def test_invalid_types(self):
        with pytest.raises(StreamlitInvalidWidthError):
            validate_width(None)
        with pytest.raises(StreamlitInvalidWidthError):
            validate_width([100])


class TestGetWidthConfig:
    """Test proto conversion with scale support."""

    def test_plain_stretch(self):
        config = get_width_config("stretch")
        assert config.use_stretch is True
        # Plain "stretch" is treated as "stretch:1" internally
        assert config.stretch_scale == 1.0

    def test_stretch_with_scale(self):
        config = get_width_config("stretch:2")
        assert config.use_stretch is True
        assert config.stretch_scale == 2.0

    def test_stretch_with_float_scale(self):
        config = get_width_config("stretch:1.5")
        assert config.use_stretch is True
        assert config.stretch_scale == 1.5

    def test_content(self):
        config = get_width_config("content")
        assert config.use_content is True
        # Content mode doesn't use stretch_scale
        assert not config.HasField("stretch_scale")

    def test_pixel_width(self):
        config = get_width_config(300)
        assert config.pixel_width == 300
        assert not config.HasField("stretch_scale")


class TestValidateHeight:
    """Test height validation - same patterns as width."""

    def test_valid_stretch_with_scale(self):
        validate_height("stretch:2")
        validate_height("stretch:0.5")

    def test_invalid_zero_scale(self):
        with pytest.raises(StreamlitInvalidHeightError):
            validate_height("stretch:0")


class TestGetHeightConfig:
    """Test height proto conversion - same patterns as width."""

    def test_stretch_with_scale(self):
        config = get_height_config("stretch:3")
        assert config.use_stretch is True
        assert config.stretch_scale == 3.0
```

#### 4.2 Frontend Unit Tests

**File**: `frontend/lib/src/components/core/Layout/useLayoutStyles.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLayoutStyles } from "./useLayoutStyles";
import { Element } from "@streamlit/protobuf";
import { FlexContext } from "./FlexContext";
import { Direction } from "./utils";

describe("useLayoutStyles with stretch scales", () => {
  it("should apply default flex-grow of 1 for plain stretch", () => {
    const element: Element = {
      widthConfig: { useStretch: true },
    };

    const { result } = renderHook(() => useLayoutStyles({ element }), {
      wrapper: ({ children }) => (
        <FlexContext.Provider
          value={{
            direction: Direction.HORIZONTAL,
            isInHorizontalLayout: true,
          }}
        >
          {children}
        </FlexContext.Provider>
      ),
    });

    expect(result.current.flex).toBe("1 1 fit-content");
  });

  it("should apply custom flex-grow for stretch with scale", () => {
    const element: Element = {
      widthConfig: { useStretch: true, stretchScale: 2 },
    };

    const { result } = renderHook(() => useLayoutStyles({ element }), {
      wrapper: ({ children }) => (
        <FlexContext.Provider
          value={{
            direction: Direction.HORIZONTAL,
            isInHorizontalLayout: true,
          }}
        >
          {children}
        </FlexContext.Provider>
      ),
    });

    expect(result.current.flex).toBe("2 1 fit-content");
  });

  it("should handle float scales", () => {
    const element: Element = {
      widthConfig: { useStretch: true, stretchScale: 1.5 },
    };

    const { result } = renderHook(() => useLayoutStyles({ element }), {
      wrapper: ({ children }) => (
        <FlexContext.Provider
          value={{
            direction: Direction.HORIZONTAL,
            isInHorizontalLayout: true,
          }}
        >
          {children}
        </FlexContext.Provider>
      ),
    });

    expect(result.current.flex).toBe("1.5 1 fit-content");
  });

  it("should respect minStretchBehavior with scale", () => {
    const element: Element = {
      widthConfig: { useStretch: true, stretchScale: 3 },
    };

    const { result } = renderHook(
      () =>
        useLayoutStyles({
          element,
          minStretchBehavior: "14rem",
        }),
      {
        wrapper: ({ children }) => (
          <FlexContext.Provider
            value={{
              direction: Direction.HORIZONTAL,
              isInHorizontalLayout: true,
            }}
          >
            {children}
          </FlexContext.Provider>
        ),
      }
    );

    expect(result.current.flex).toBe("3 1 14rem");
  });

  it("should apply scale to height in vertical layout", () => {
    const element: Element = {
      heightConfig: { useStretch: true, stretchScale: 2.5 },
    };

    const { result } = renderHook(() => useLayoutStyles({ element }), {
      wrapper: ({ children }) => (
        <FlexContext.Provider
          value={{
            direction: Direction.VERTICAL,
            isInHorizontalLayout: false,
          }}
        >
          {children}
        </FlexContext.Provider>
      ),
    });

    expect(result.current.flex).toBe("2.5 1 auto");
  });
});
```

#### 4.3 E2E Playwright Tests

**File**: `e2e_playwright/st_width_height_scale_test.py`

```python
"""E2E tests for relative stretch width/height with scale factors."""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run


def test_horizontal_width_scaling(app: Page, assert_snapshot: ImageCompareFunction):
    """Test width scaling in horizontal container."""
    # Snapshot comparison would show visual distribution
    assert_snapshot(app, name="width_scale_horizontal_container")

    # Verify element widths are proportional
    elem1 = app.get_by_test_id("stImage").first
    elem2 = app.get_by_test_id("stMarkdown").first

    # Element with width="stretch:2" should be ~2x wider than width="stretch:1"
    width1 = elem1.bounding_box()["width"]
    width2 = elem2.bounding_box()["width"]

    # Allow 10% tolerance for rounding/padding
    assert abs((width1 / width2) - 2.0) < 0.2


def test_vertical_height_scaling(app: Page, assert_snapshot: ImageCompareFunction):
    """Test height scaling in vertical container."""
    assert_snapshot(app, name="height_scale_vertical_container")

    elem1 = app.get_by_test_id("stTextArea").first
    elem2 = app.get_by_test_id("stMarkdown").first

    height1 = elem1.bounding_box()["height"]
    height2 = elem2.bounding_box()["height"]

    # Element with height="stretch:3" should be ~3x taller
    assert abs((height1 / height2) - 3.0) < 0.3


def test_mixed_scales_three_elements(app: Page):
    """Test distribution with three elements having different scales."""
    # App code would have: stretch:1, stretch:2, stretch:3
    # They should divide space in 1:2:3 ratio
    elements = app.get_by_test_id("stMarkdown").all()

    widths = [elem.bounding_box()["width"] for elem in elements[:3]]

    # Verify proportions (within tolerance)
    # widths[1] should be ~2x widths[0]
    assert abs((widths[1] / widths[0]) - 2.0) < 0.2
    # widths[2] should be ~3x widths[0]
    assert abs((widths[2] / widths[0]) - 3.0) < 0.3


def test_float_scale_values(app: Page):
    """Test that float scale values like 1.5 work correctly."""
    elem1 = app.get_by_test_id("stMarkdown").nth(0)
    elem2 = app.get_by_test_id("stMarkdown").nth(1)

    width1 = elem1.bounding_box()["width"]
    width2 = elem2.bounding_box()["width"]

    # stretch:1.5 vs stretch:1 should give 1.5:1 ratio
    assert abs((width1 / width2) - 1.5) < 0.15
```

**Corresponding test app** (`e2e_playwright/st_width_height_scale_test.py` companion):

```python
import streamlit as st
import numpy as np

st.title("Width/Height Scale Tests")

# Test 1: Horizontal width scaling
st.subheader("Test 1: Horizontal Width Scaling (2:1)")
with st.container(horizontal=True):
    img = np.repeat(0, 75000).reshape(300, 250)
    st.image(img, width="stretch:2")
    st.markdown("This text\nshould be\nhalf the width", width="stretch")

# Test 2: Vertical height scaling
st.subheader("Test 2: Vertical Height Scaling (3:1)")
with st.container(height=400):
    st.text_area("Enter message", height="stretch:3")
    st.markdown("This should be 1/3 the height", height="stretch")

# Test 3: Three elements with different scales
st.subheader("Test 3: Mixed Scales (1:2:3)")
with st.container(horizontal=True):
    st.markdown("1x", width="stretch:1")
    st.markdown("2x", width="stretch:2")
    st.markdown("3x", width="stretch:3")

# Test 4: Float scales
st.subheader("Test 4: Float Scales (1.5:1)")
with st.container(horizontal=True):
    st.markdown("1.5x", width="stretch:1.5")
    st.markdown("1x", width="stretch")
```

#### 4.4 Type Tests

**File**: `lib/tests/streamlit/typing/test_width_height_typing.py`

```python
"""Type tests for width/height parameters with scale."""

from typing_extensions import assert_type
import streamlit as st

# Valid width values
assert_type(st.text("Hello", width="stretch"), st.delta_generator.DeltaGenerator)
assert_type(st.text("Hello", width="stretch:2"), st.delta_generator.DeltaGenerator)
assert_type(st.text("Hello", width="stretch:1.5"), st.delta_generator.DeltaGenerator)
assert_type(st.text("Hello", width="content"), st.delta_generator.DeltaGenerator)
assert_type(st.text("Hello", width=300), st.delta_generator.DeltaGenerator)

# Valid height values
assert_type(st.text_area("Msg", height="stretch:3"), st.delta_generator.DeltaGenerator)
assert_type(st.text_area("Msg", height="stretch"), st.delta_generator.DeltaGenerator)
assert_type(st.text_area("Msg", height=200), st.delta_generator.DeltaGenerator)
```

---

### Phase 5: Documentation & Migration

#### 5.1 API Documentation

Update docstrings in affected element methods:

```python
def text(
    body: str,
    *,
    width: Width = "content",
) -> DeltaGenerator:
    """Display text.

    Parameters
    ----------
    body : str
        The text to display.
    width : int or "stretch" or "stretch:N" or "content"
        The width of the element:

        - **int**: Fixed width in pixels (e.g., `width=300`)
        - **"stretch"**: Fill available horizontal space equally with other stretch elements
        - **"stretch:N"**: Fill available space with relative scale N (e.g., `width="stretch:2"`
          takes 2x the space of `width="stretch:1"`). N can be int or float.
        - **"content"**: Size to the width of the content

        The scale in "stretch:N" only affects distribution among stretch elements in the same
        horizontal container, similar to how `st.columns([2, 1])` works.

        Examples:

        >>> # Equal width
        >>> with st.container(horizontal=True):
        >>>     st.text("A", width="stretch")
        >>>     st.text("B", width="stretch")

        >>> # A is 2x wider than B
        >>> with st.container(horizontal=True):
        >>>     st.text("A", width="stretch:2")
        >>>     st.text("B", width="stretch")

    Returns
    -------
    DeltaGenerator
    """
```

#### 5.2 User-Facing Documentation

Create a guide in Streamlit docs:

**Title**: "Advanced Layouts: Relative Sizing with Stretch"

**Content**:

- Explain the `stretch:N` syntax
- Show side-by-side comparisons with `st.columns([2, 1])` mental model
- Provide visual examples with screenshots
- Explain interaction with minimum widths
- Show common patterns (sidebars, dashboard grids, etc.)

#### 5.3 Migration Guide

Since this is additive, no breaking changes. Migration guide:

- **Existing code**: All `width="stretch"` continues to work unchanged
- **New capability**: Can now add `:N` suffix for relative sizing
- **Equivalence**: `width="stretch:1"` === `width="stretch"`

---

## Implementation Checklist

### Backend (Python)

- [ ] Add `_STRETCH_SCALE_PATTERN` regex constant
- [ ] Implement `_parse_stretch_scale()` utility function
- [ ] Update `validate_width()` to handle scale format
- [ ] Update `validate_height()` to handle scale format
- [ ] Update `get_width_config()` to set `stretch_scale` field
- [ ] Update `get_height_config()` to set `stretch_scale` field
- [ ] Update error messages in exception classes if needed
- [ ] Write Python unit tests (>95% coverage target)

### Protocol Buffers

- [ ] Add `optional float stretch_scale = 5` to `WidthConfig.proto`
- [ ] Add `optional float stretch_scale = 5` to `HeightConfig.proto`
- [ ] Run `make protobuf` to regenerate bindings
- [ ] Verify generated Python/TypeScript files

### Frontend (TypeScript)

- [ ] Update `LayoutDimensionConfig` type to include `scale?: number`
- [ ] Modify `getWidth()` to extract `stretchScale` from proto
- [ ] Modify `getHeight()` to extract `stretchScale` from proto
- [ ] Update `getFlex()` to use scale as flex-grow value
- [ ] Write TypeScript unit tests for `useLayoutStyles` with scale
- [ ] Manual browser testing with dev server

### Testing

- [ ] Python unit tests for parsing and validation
- [ ] Python unit tests for proto conversion
- [ ] TypeScript unit tests for layout styles
- [ ] E2E tests for horizontal width scaling
- [ ] E2E tests for vertical height scaling
- [ ] E2E tests for mixed scale values
- [ ] E2E tests for float scales
- [ ] Type tests for width/height parameters
- [ ] Visual regression tests (snapshots)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

### Documentation

- [ ] Update element docstrings with scale examples
- [ ] Create user guide for relative sizing
- [ ] Add examples to Streamlit docs
- [ ] Update changelog/release notes
- [ ] Create internal dev documentation

### Edge Cases to Verify

- [ ] Single stretch element with scale (behaves like regular stretch)
- [ ] Mix of stretch with/without scales
- [ ] Very large scale values (e.g., 100)
- [ ] Very small scale values (e.g., 0.1)
- [ ] Scale with minimum width constraints (14rem, 8rem categories)
- [ ] Nested containers with different scales
- [ ] Scale in columns (each column has its own flex context)
- [ ] Scale with explicit pixel/content siblings
- [ ] Responsive behavior (window resize)
- [ ] Scale of exactly 1.0 (should match plain stretch)

---

## Risk Analysis

### Low Risk

- **Backwards compatibility**: Adding optional proto field is safe
- **Type system**: String validation at runtime, no compile-time changes needed
- **CSS flex**: Standard browser feature, well-supported

### Medium Risk

- **Minimum width interaction**: Complex interplay between flex-basis and flex-grow

  - **Mitigation**: Extensive testing with different element categories
  - **Mitigation**: Document expected behavior

- **Float precision**: Scale values like `1.333333` in CSS

  - **Mitigation**: CSS handles floats well in flex calculations
  - **Mitigation**: Limit precision in validation (e.g., round to 2 decimals)

- **User confusion**: Understanding relative vs. absolute sizing
  - **Mitigation**: Clear documentation with visual examples
  - **Mitigation**: Helpful error messages for invalid scales

### High Risk

- **None identified** - this is a well-scoped, additive feature using standard CSS flex

---

## Timeline Estimate

- **Phase 1 (Python)**: 0.75 day (simplified by treating stretch as stretch:1)
- **Phase 2 (Proto)**: 0.5 day (including compilation)
- **Phase 3 (Frontend)**: 0.75 day (simpler logic with scale always present)
- **Phase 4 (Testing)**: 2 days
- **Phase 5 (Docs)**: 1 day

**Total**: ~5 days for full implementation, testing, and documentation

**Note**: The decision to treat `width="stretch"` as `width="stretch:1"` internally simplifies implementation and reduces edge cases, potentially saving 0.5-1 day from original estimate.

---

## Future Enhancements

### Not in Scope for Initial Release

1. **Named scales**: `width="stretch:large"` instead of `width="stretch:2"`

   - Reasoning: Adds complexity, numeric scales are sufficient

2. **Negative scales**: Allow shrinking instead of growing

   - Reasoning: Use case unclear, can be confusing

3. **Shorthand for common ratios**: `width="1/3"` instead of `width="stretch:0.33"`
   - Reasoning: Scope creep, current API is sufficient

### Potential Follow-ups

1. **Container-level scale distribution**: `st.container(width_distribution=[2, 1, 3])`

   - Similar to `st.columns()` but more explicit
   - Could coexist with element-level scales

2. **Auto-scaling based on content**: `width="stretch:auto"`
   - Dynamically adjust scale based on content size
   - Complex to implement, unclear use case

---

## Success Metrics

### Functional Requirements

✅ Support `width="stretch:N"` and `height="stretch:N"` syntax
✅ Parse integer and float scale values
✅ Distribute space proportionally among scaled stretch elements
✅ Maintain backwards compatibility with plain `"stretch"`
✅ Work in both horizontal and vertical layouts

### Non-Functional Requirements

✅ No breaking changes to existing code
✅ Performance impact negligible (simple CSS flex change)
✅ Cross-browser compatibility (all modern browsers support flex)
✅ Comprehensive test coverage (>90%)
✅ Clear error messages for invalid scales

### User Experience

✅ Intuitive API consistent with `st.columns([2, 1])` mental model
✅ Clear documentation with visual examples
✅ Helpful error messages guide users to correct usage

---

## Appendix: CSS Flex Reference

### How flex-grow Works

```css
.container {
  display: flex;
  width: 600px;
}

.item-a {
  flex: 2 1 100px; /* flex-grow: 2, flex-shrink: 1, flex-basis: 100px */
}

.item-b {
  flex: 1 1 100px; /* flex-grow: 1, flex-shrink: 1, flex-basis: 100px */
}
```

**Calculation**:

1. Base sizes: 100px + 100px = 200px
2. Remaining space: 600px - 200px = 400px
3. Total grow factors: 2 + 1 = 3
4. Item A gets: 100px + (400px × 2/3) = 100px + 266px = 366px
5. Item B gets: 100px + (400px × 1/3) = 100px + 133px = 233px
6. Ratio: 366 / 233 ≈ 1.57 (not exactly 2:1 due to flex-basis)

**Key Insight**: flex-grow distributes **remaining** space proportionally, not total space.

If both had `flex-basis: 0`:

- Item A: 0 + (600px × 2/3) = 400px
- Item B: 0 + (600px × 1/3) = 200px
- Ratio: 400 / 200 = 2.0 (exactly 2:1)

**For Streamlit**: We use `flex-basis: fit-content` or `flex-basis: 14rem` (minimum widths), so the ratio won't be exact but will approximate the scale values.

---

## Summary: Benefits of Simplified Implementation

The decision to treat `width="stretch"` as `width="stretch:1"` internally provides several key advantages:

### Code Simplicity

- **No branching logic**: Don't need to check if scale is set vs. not set
- **Consistent data flow**: All stretch elements follow the same path through the code
- **Easier maintenance**: Future developers don't need to understand special cases

### Type Safety

- **Stricter TypeScript types**: `scale: number` instead of `scale?: number`
- **No null coalescing**: Eliminates `??` operators and potential bugs from missing defaults

### Testing

- **Fewer test cases**: Don't need to test both "scale set" and "scale unset" branches
- **Clearer expectations**: Tests always verify that stretch has scale=1.0 minimum

### Performance

- **Negligible impact**: Setting one extra float field in proto has no measurable cost
- **Simpler CSS output**: Always generates flex-grow value, no conditional logic

### User Experience

- **Invisible to users**: Users still write `width="stretch"` and it works identically
- **Predictable behavior**: All stretch elements follow the same rules (scale-based distribution)
- **Future flexibility**: Easy to add features like container-level scale defaults

### Example Code Comparison

**Without simplification** (more complex):

```python
# Python
if is_scaled_stretch and scale is not None:
    width_config.stretch_scale = scale
# Proto field: optional float stretch_scale

# TypeScript
const scale = widthConfig.scale ?? undefined
if (widthConfig.type === STRETCH) {
  const growFactor = widthConfig.scale ?? 1
  // ...
}
```

**With simplification** (cleaner):

```python
# Python
width_config.stretch_scale = scale if is_scaled_stretch else 1.0
# Proto field: optional float stretch_scale (but always set by new code)

# TypeScript
const scale = widthConfig.stretchScale ?? 1.0  // Only for old messages
return { type: STRETCH, scale }

// Later
return `${widthConfig.scale} 1 ${minWidth}`  // Direct usage
```

**Lines of code saved**: ~15-20 lines across Python + TypeScript
**Cognitive complexity reduction**: Eliminates 2-3 conditional branches
**Bug risk reduction**: Fewer code paths = fewer places for bugs to hide
