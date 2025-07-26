# Fix for Issue #12038: Improve wrapping behavior for st.pills and st.segmented_control with width="stretch"

## Problem Description

When using `width="stretch"` on `st.pills` and `st.segmented_control`, the pills/segments don't wrap evenly. When buttons wrap to the next line, their width becomes uneven - particularly the last row often has fewer buttons that become much wider than buttons in previous rows.

## Root Cause

The original implementation used `flex: "1 1 fit-content"` for stretched buttons. While this makes buttons take equal space within a single row, it doesn't handle multi-row wrapping gracefully. When buttons wrap, the flex algorithm distributes available space equally among buttons in each row, causing uneven widths across rows.

## Solution

Modified the flex properties for both `StyledPillsButton` and `StyledSegmentedControlButton` components when `containerWidth` is true (i.e., when `width="stretch"` is used):

### Changes Made

1. **Updated flex property**: Changed from `flex: "1 1 fit-content"` to `flex: "1 1 calc(100% / 3)"`
   - This uses a calculated flex-basis that encourages more even distribution
   - The basis of `100% / 3` promotes wrapping at reasonable breakpoints

2. **Added maxWidth constraint**: Added `maxWidth: "calc(100% / 2 - 4px)"`
   - Prevents any single button from becoming excessively wide
   - The `-4px` accounts for gaps between buttons
   - Ensures that even if only one button wraps, it won't become too wide

3. **Updated minWidth**: Changed from `"max-content"` to `"fit-content"`
   - Ensures buttons maintain readable width while being more flexible

### Files Modified

1. `/frontend/lib/src/components/shared/BaseButton/styled-components.ts`
   - Updated `StyledPillsButton` component
   - Updated `StyledSegmentedControlButton` component

2. `/frontend/lib/src/components/widgets/ButtonGroup/ButtonGroup.test.tsx`
   - Added tests for width behavior verification

3. `/e2e_playwright/st_pills.py`
   - Enhanced with examples demonstrating wrapping behavior

4. `/e2e_playwright/st_segmented_control.py`
   - Enhanced with examples demonstrating wrapping behavior

### Expected Behavior After Fix

- Buttons with `width="stretch"` will wrap more evenly across multiple lines
- No single button will exceed 50% of the container width
- The last row won't have excessively wide buttons
- Overall distribution should be more visually balanced

### Testing

The fix can be tested by:
1. Running the enhanced e2e test apps for pills and segmented controls
2. Observing the wrapping behavior with various screen widths
3. Comparing with the original behavior (content width)

### Browser Compatibility

The fix uses CSS `calc()` function which is supported in all modern browsers:
- Chrome 19+
- Firefox 16+
- Safari 6+
- Internet Explorer 9+
