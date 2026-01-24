# st.feedback Migration Plan

## Overview

This document outlines the plan to extract `st.feedback` into its own frontend component and proto, separate from `ButtonGroup`. The goal is to:

1. Create a dedicated `Feedback.proto` that sends the feedback type (thumbs/faces/stars) instead of individual icon strings
2. Build a standalone React component that constructs icons based on the feedback type
3. Remove the dependency on baseui's `ButtonGroup` component
4. **Remove all feedback-specific code from ButtonGroup** (both frontend and backend)
5. Maintain the same Python API and frontend behavior

## Current Implementation Analysis

### Backend (`lib/streamlit/elements/widgets/button_group.py`)

- `st.feedback()` is implemented as part of `ButtonGroupMixin`
- Icons are defined as constants (`_THUMB_ICONS`, `_FACES_ICONS`, `_STAR_ICON`, `_SELECTED_STAR_ICON`)
- `get_mapped_options()` converts feedback type to `ButtonGroupProto.Option` objects
- Uses `_SingleSelectSerde` for serialization/deserialization
- Returns integer (0-1 for thumbs, 0-4 for faces/stars) or None

### Proto (`proto/streamlit/proto/ButtonGroup.proto`)

- Uses generic `ButtonGroup` message with `Option` submessage
- Each option has `content_icon` and `selected_content_icon` fields
- Sends icon strings like `:material/thumb_up:`
- Uses `SelectionVisualization` enum for stars behavior

### Frontend (`frontend/lib/src/components/widgets/ButtonGroup/ButtonGroup.tsx`)

- Uses baseui's `ButtonGroup` component (from `baseui/button-group`)
- Handles selection with `MODE.radio` for single select
- Renders icons via `DynamicButtonLabel` component
- `showAsSelected()` handles "ALL_UP_TO_SELECTED" visualization for stars

## Proposed Changes

### 1. New Proto Definition

Create `proto/streamlit/proto/Feedback.proto`:

```protobuf
syntax = "proto3";

option java_package = "com.snowflake.apps.streamlit";
option java_outer_classname = "FeedbackProto";

message Feedback {
  enum FeedbackType {
    THUMBS = 0;
    FACES = 1;
    STARS = 2;
  }

  string id = 1;
  FeedbackType type = 2;
  optional uint32 default = 3;  // Default selection index
  bool disabled = 4;
  string form_id = 5;

  // Value passed by the backend (selection index)
  optional uint32 value = 6;
  bool set_value = 7;
}
```

**Rationale:**
- Simpler proto that sends just the type
- Frontend constructs the correct icons based on type
- Single selection index instead of array (feedback is always single-select)
- Removes `Option` message overhead

### 2. New Frontend Component

Create `frontend/lib/src/components/widgets/Feedback/Feedback.tsx`:

**Structure:**
```
frontend/lib/src/components/widgets/Feedback/
├── Feedback.tsx          # Main component
├── Feedback.test.tsx     # Unit tests
├── styled-components.ts  # Styled components
└── index.ts              # Exports
```

**Key Implementation Details:**

1. **No baseui dependency**: Use flexbox layout with our existing `BaseButton` and `DynamicIcon` components

2. **Icon definitions in frontend**:
   ```typescript
   const FEEDBACK_CONFIG = {
     thumbs: {
       icons: ["thumb_down", "thumb_up"],  // Reversed display order
       indices: [1, 0],  // thumbs-up first visually but index 1
       selectionMode: "ONLY_SELECTED",
     },
     faces: {
       icons: [
         "sentiment_sad",
         "sentiment_dissatisfied",
         "sentiment_neutral",
         "sentiment_satisfied",
         "sentiment_very_satisfied",
       ],
       indices: [0, 1, 2, 3, 4],
       selectionMode: "ONLY_SELECTED",
     },
     stars: {
       icon: "star",
       selectedIcon: "star_filled",
       count: 5,
       indices: [0, 1, 2, 3, 4],
       selectionMode: "ALL_UP_TO_SELECTED",
     },
   }
   ```

3. **Component structure** (without baseui):
   ```tsx
   <StyledFeedbackContainer>
     {buttons.map((button, index) => (
       <StyledFeedbackButton
         key={index}
         onClick={() => handleClick(index)}
         disabled={disabled}
         isSelected={isSelected(index)}
       >
         <DynamicIcon
           iconValue={getIcon(index)}
           size="lg"
         />
       </StyledFeedbackButton>
     ))}
   </StyledFeedbackContainer>
   ```

4. **Selection handling**:
   - Single select only
   - Click on selected item deselects it (returns None)
   - For stars: show all icons up to selected as "filled"

5. **Accessibility**:
   - Use `role="radiogroup"` on container
   - Use `role="radio"` on buttons
   - Proper `aria-checked` states
   - Keyboard navigation (arrow keys)

### 3. Backend Changes

Update `lib/streamlit/elements/widgets/button_group.py`:

1. **Import new proto**:
   ```python
   from streamlit.proto.Feedback_pb2 import Feedback as FeedbackProto
   ```

2. **Update `feedback()` method**:
   - Build `FeedbackProto` instead of `ButtonGroupProto`
   - Send feedback type enum instead of mapped options
   - Use new element name "feedback" for enqueue

3. **Simplify serde**:
   - Use single integer value instead of int array
   - Update `value_type` to `int_value` instead of `int_array_value`

4. **Keep backwards compatibility**:
   - Same Python API: `st.feedback(options="thumbs", ...)`
   - Same return values: integer or None

### 4. Widget State Changes

Update widget state handling:

```python
# In feedback method
widget_state = register_widget(
    proto.id,
    on_change_handler=on_change,
    args=args,
    kwargs=kwargs,
    deserializer=lambda x: x if x is not None else None,
    serializer=lambda x: x if x is not None else -1,  # Use -1 for None
    ctx=ctx,
    value_type="int_value",  # Changed from int_array_value
)
```

### 5. Files to Modify/Create

**New Files:**
- `proto/streamlit/proto/Feedback.proto`
- `frontend/lib/src/components/widgets/Feedback/Feedback.tsx`
- `frontend/lib/src/components/widgets/Feedback/Feedback.test.tsx`
- `frontend/lib/src/components/widgets/Feedback/styled-components.ts`
- `frontend/lib/src/components/widgets/Feedback/index.ts`
- `lib/streamlit/elements/widgets/feedback.py` (new module for feedback)
- `lib/tests/streamlit/elements/feedback_test.py`

**Modified Files (additions):**
- `lib/streamlit/__init__.py` (update imports if needed)
- `frontend/lib/src/components/widgets/index.ts` (add Feedback export)
- `frontend/lib/src/components/core/AppView/useElements.tsx` (add Feedback case)
- `lib/streamlit/delta_generator.py` (add FeedbackMixin)

**Modified Files (cleanup - remove feedback-specific code):**
- `lib/streamlit/elements/widgets/button_group.py`:
  - Remove icon constants (`_THUMB_ICONS`, `_FACES_ICONS`, `_STAR_ICON`, etc.)
  - Remove `get_mapped_options()` function
  - Remove `feedback()` method and its overloads from `ButtonGroupMixin`
  - Remove borderless style handling from `_button_group()`
- `proto/streamlit/proto/ButtonGroup.proto`:
  - Remove `BORDERLESS` from `Style` enum
  - Consider removing `ALL_UP_TO_SELECTED` from `SelectionVisualization` enum
- `frontend/lib/src/components/widgets/ButtonGroup/ButtonGroup.tsx`:
  - Remove `BORDERLESS` style handling
  - Remove `ALL_UP_TO_SELECTED` visualization logic
  - Simplify `showAsSelected()` function
- `lib/tests/streamlit/elements/button_group_test.py`:
  - Remove `TestGetMappedOptions` class
  - Remove feedback-related test cases
- `frontend/lib/src/components/widgets/ButtonGroup/ButtonGroup.test.tsx`:
  - Remove BORDERLESS style tests
  - Remove ALL_UP_TO_SELECTED tests

### 6. Testing Strategy

**Unit Tests (Python):**
- Test proto serialization/deserialization
- Test default value handling
- Test return value types for each feedback type
- Test disabled state

**Unit Tests (Frontend):**
- Test rendering of each feedback type
- Test click interactions
- Test selection visualization (especially stars)
- Test disabled state
- Test keyboard navigation

**E2E Tests:**
- Update existing `st_feedback_test.py` (should pass unchanged)
- May need to update locator strategy from `stButtonGroup` to `stFeedback`

## Implementation Steps

1. **Create new proto** (`Feedback.proto`)
   - Define `Feedback` message with `FeedbackType` enum
   - Run `make protobuf` to generate Python and TypeScript code

2. **Create frontend component**
   - Create `Feedback/` directory structure
   - Implement styled components (reuse existing button styles)
   - Implement main `Feedback.tsx` component
   - Add tests

3. **Update backend**
   - Create `feedback.py` module
   - Move feedback logic from `button_group.py`
   - Update widget registration to use new proto
   - Update `DeltaGenerator` to include new mixin

4. **Integration**
   - Add Feedback component to `useElements.tsx`
   - Update exports

5. **Testing**
   - Run Python unit tests
   - Run frontend unit tests
   - Run E2E tests
   - Verify snapshots match (may need updates due to test-id changes)

6. **Cleanup** (see detailed section below)
   - Remove all feedback-specific code from ButtonGroup (frontend and backend)
   - Update documentation if needed

## Cleanup: Remove Feedback-Specific Code from ButtonGroup

After the new Feedback component is working, all feedback-specific code must be removed from the ButtonGroup implementation.

### Backend Cleanup (`lib/streamlit/elements/widgets/button_group.py`)

**Remove these constants:**
```python
_THUMB_ICONS: Final = (":material/thumb_up:", ":material/thumb_down:")
_FACES_ICONS: Final = (
    ":material/sentiment_sad:",
    ":material/sentiment_dissatisfied:",
    ":material/sentiment_neutral:",
    ":material/sentiment_satisfied:",
    ":material/sentiment_very_satisfied:",
)
_NUMBER_STARS: Final = 5
_STAR_ICON: Final = ":material/star:"
_SELECTED_STAR_ICON: Final = ":material/star_filled:"
```

**Remove this function:**
```python
def get_mapped_options(
    feedback_option: Literal["thumbs", "faces", "stars"],
) -> tuple[list[ButtonGroupProto.Option], list[int]]:
    ...
```

**Remove the `feedback()` method** from `ButtonGroupMixin` class (lines 272-477), including:
- All three `@overload` decorators for type hints
- The main `@gather_metrics("feedback")` decorated method
- Related docstrings and examples

**Remove feedback-related logic from `_button_group()`:**
- The comment about "borderless style is used by st.feedback" in `compute_and_register_element_id`
- The `"feedback" if style == "borderless" else style` logic (line 1096)

**After cleanup, `ButtonGroupMixin` should only contain:**
- `pills()` method
- `segmented_control()` method
- `_internal_button_group()` method
- `_button_group()` method (simplified)

### Proto Cleanup (`proto/streamlit/proto/ButtonGroup.proto`)

**Consider removing (if no longer needed after feedback extraction):**
```protobuf
enum SelectionVisualization {
  ONLY_SELECTED = 0;
  ALL_UP_TO_SELECTED = 1;  // Only used by st.feedback stars
}

enum Style {
  SEGMENTED_CONTROL = 0;
  PILLS = 1;
  BORDERLESS = 2;  // Only used by st.feedback
}
```

**Note:** `SelectionVisualization.ALL_UP_TO_SELECTED` and `Style.BORDERLESS` are only used by feedback. After extraction:
- `BORDERLESS` style can be removed from `ButtonGroup.proto`
- `ALL_UP_TO_SELECTED` can be removed (or kept if useful for future features)
- The `selected_content_icon` field in `Option` message was primarily for stars - evaluate if still needed

### Frontend Cleanup (`frontend/lib/src/components/widgets/ButtonGroup/ButtonGroup.tsx`)

**Remove feedback-specific logic from `getContentElement()`:**
```typescript
// This block handles BORDERLESS style for feedback:
const kind =
  style === ButtonGroupProto.Style.PILLS
    ? BaseButtonKind.PILLS
    : style === ButtonGroupProto.Style.BORDERLESS
      ? BaseButtonKind.BORDERLESS_ICON  // Remove this case
      : BaseButtonKind.SEGMENTED_CONTROL
```

**Remove BORDERLESS handling from `getButtonGroupOverridesStyle()`:**
```typescript
// Remove this case:
case ButtonGroupProto.Style.BORDERLESS:
  return {
    ...baseStyle,
    columnGap: spacing.threeXS,
    rowGap: spacing.threeXS,
  }
```

**Simplify `showAsSelected()` function:**
- The `ALL_UP_TO_SELECTED` visualization mode is only used by stars feedback
- After extraction, this function can be simplified or removed if not needed by pills/segmented_control

**Remove from `createOptionChild()`:**
- Logic for handling `selectedContentIcon` (only used by stars)
- Logic for `BORDERLESS` style button kind

### Frontend Cleanup (`frontend/lib/src/components/shared/BaseButton/styled-components.ts`)

**Evaluate if these can be removed:**
```typescript
// These are primarily used by feedback:
export const StyledBorderlessIconButton = ...
export const StyledBorderlessIconButtonActive = ...
```

**Note:** Keep these if they're used elsewhere (e.g., other icon buttons). Check for usage before removing.

### Test Cleanup

**Backend tests (`lib/tests/streamlit/elements/button_group_test.py`):**
- Remove `TestGetMappedOptions` class
- Remove any feedback-specific test cases
- Keep only pills and segmented_control tests

**Frontend tests (`frontend/lib/src/components/widgets/ButtonGroup/ButtonGroup.test.tsx`):**
- Remove tests for BORDERLESS style
- Remove tests for `ALL_UP_TO_SELECTED` visualization
- Remove tests for icon-only options (if only used by feedback)

### E2E Test Updates

**Update `e2e_playwright/shared/app_utils.py`:**
- Add new helper functions for Feedback widget (similar to `get_button_group`)
- Update `get_feedback_icon_buttons` to use new test-id (`stFeedback` instead of `stButtonGroup`)

**Update `e2e_playwright/st_feedback_test.py`:**
- Change locators from `get_button_group()` to new feedback-specific helpers
- Update test-id patterns from `stBaseButton-borderlessIcon` to new feedback button test-ids

### Summary of Removals

| Location | What to Remove |
|----------|----------------|
| `button_group.py` | Icon constants, `get_mapped_options()`, `feedback()` method, borderless style handling |
| `ButtonGroup.proto` | `BORDERLESS` style enum value, possibly `ALL_UP_TO_SELECTED` |
| `ButtonGroup.tsx` | BORDERLESS style handling, `ALL_UP_TO_SELECTED` logic, `selectedContentIcon` handling |
| `styled-components.ts` | Possibly `StyledBorderlessIconButton*` (check usage first) |
| `button_group_test.py` | `TestGetMappedOptions`, feedback-related tests |
| `ButtonGroup.test.tsx` | BORDERLESS and ALL_UP_TO_SELECTED tests |

## Baseui Removal Assessment

**What baseui provides for ButtonGroup:**
1. Selection state management (`MODE.radio`, `MODE.checkbox`)
2. Click handling with selection toggling
3. Accessibility attributes (role, aria-checked, etc.)
4. Keyboard navigation
5. Visual grouping and layout

**Can we build this without baseui?**

**YES** - Here's why:

1. **Selection state**: Already managed by Streamlit's widget state system via `useBasicWidgetState` hook

2. **Click handling**: Simple onClick handlers with state updates

3. **Accessibility**: We can add these manually:
   ```tsx
   <div role="radiogroup" aria-label="Feedback rating">
     <button
       role="radio"
       aria-checked={isSelected}
       tabIndex={isSelected ? 0 : -1}
     />
   </div>
   ```

4. **Keyboard navigation**: Custom implementation with `onKeyDown`:
   - Arrow keys to move between options
   - Space/Enter to select

5. **Layout**: Flexbox with gap spacing (already used in current implementation)

**Benefits of removing baseui:**
- Smaller bundle size for Feedback component
- More control over styling and behavior
- Simpler component structure
- No dependency on baseui's internal implementation details

**The existing `BaseButton` and `StyledBorderlessIconButton` components already provide all the styling we need.**

## Migration Path

This is a breaking change at the proto level but NOT at the Python API level. Users of `st.feedback()` will not need to change their code.

For internal backwards compatibility during migration:
1. Both `ButtonGroup` and `Feedback` protos can coexist
2. Frontend can handle both message types temporarily
3. Gradual rollout possible if needed

## Estimated Scope

**New code:**
- Proto: ~20 lines
- Frontend component: ~200-250 lines
- Backend module: ~150-200 lines
- Tests: ~200-300 lines

**Code to remove from ButtonGroup:**
- Backend (`button_group.py`): ~200 lines (feedback method, icon constants, get_mapped_options)
- Proto (`ButtonGroup.proto`): ~5-10 lines (BORDERLESS style, possibly ALL_UP_TO_SELECTED)
- Frontend (`ButtonGroup.tsx`): ~50-80 lines (BORDERLESS handling, showAsSelected simplification)
- Backend tests: ~50-100 lines
- Frontend tests: ~30-50 lines

**Net change:** The new Feedback component will be slightly larger than the removed code, but results in cleaner separation of concerns.

**Total estimated effort:**
- New code: ~600-800 lines
- Removed code: ~350-450 lines
- Net addition: ~200-400 lines
