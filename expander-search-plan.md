# Feature Request: Exclude Collapsed Expander Content from Browser Search (Cmd+F)

## Problem Statement

When users press Cmd+F (or Ctrl+F) to search a Streamlit page, the browser's find-in-page feature also matches text hidden inside collapsed `st.expander` components. This is problematic because:

1. Expanders often contain long, less relevant text that users intentionally hide
2. Search results include content the user cannot see, causing confusion
3. Users must expand each expander to find where the match actually is

## Root Cause Analysis

The current expander implementation uses the HTML5 `<details>` element:

**Key files:**
- `frontend/lib/src/components/elements/Expander/Expander.tsx`
- `frontend/lib/src/components/elements/Expander/styled-components.ts`

**Current behavior:**
- The expander content (`StyledDetailsPanel`) is **always rendered to the DOM**
- When collapsed, the content is hidden via the native `<details>` element behavior
- Browsers perform Cmd+F searches on the entire DOM tree, not just visible content
- The `<details>` element's collapsed state doesn't prevent browser search from finding text

```tsx
// Current implementation (Expander.tsx:257-259)
<StyledDetailsPanel data-testid="stExpanderDetails" ref={contentRef}>
  {children}
</StyledDetailsPanel>
```

## Proposed Solutions

### Option 1: Use the `inert` Attribute (Recommended)

Add the HTML `inert` attribute to the content panel when the expander is collapsed.

**How it works:**
- `inert` is an HTML boolean attribute that marks an element as non-interactive
- Browsers exclude `inert` content from find-in-page (Cmd+F) searches
- Also prevents focus, click events, and assistive technology access to hidden content

**Implementation:**

```tsx
// Expander.tsx - Update StyledDetailsPanel
<StyledDetailsPanel
  data-testid="stExpanderDetails"
  ref={contentRef}
  inert={!expanded ? true : undefined}  // Set inert when collapsed
>
  {children}
</StyledDetailsPanel>
```

**Pros:**
- Modern HTML standard designed exactly for this use case
- Minimal code change (single attribute addition)
- Improves accessibility by properly hiding non-visible content from screen readers
- No animation or layout changes required
- Progressive enhancement - gracefully degrades in older browsers

**Cons:**
- TypeScript may need type declaration for `inert` attribute (though React 18.2+ includes it)

**Browser Support:**
- Chrome 102+, Edge 102+, Firefox 112+, Safari 15.5+
- Streamlit's browserslist (`">0.2%", "not dead", "not ie <= 11"`) covers these browsers

### Option 2: Use `hidden="until-found"` Attribute

HTML's `hidden="until-found"` allows content to be found via Cmd+F and auto-revealed.

**Implementation:**
```tsx
<StyledDetailsPanel
  hidden={!expanded ? "until-found" : undefined}
  onBeforeMatch={() => setExpanded(true)}
>
```

**Pros:**
- Content can still be found, but expander auto-expands to reveal it
- Users see where matches are located

**Cons:**
- Changes the expected behavior (might confuse some users)
- More complex event handling needed
- Less browser support than `inert`

### Option 3: Conditional Rendering

Only render content when the expander is expanded.

**Implementation:**
```tsx
{expanded && (
  <StyledDetailsPanel>
    {children}
  </StyledDetailsPanel>
)}
```

**Pros:**
- Guaranteed no search matches in collapsed content
- Potentially better memory usage for large content

**Cons:**
- Breaks current animation system (animates height to content)
- Loses scroll position inside collapsed expanders
- More expensive re-renders when toggling
- May cause layout shift issues
- Significant architectural change

### Option 4: CSS `content-visibility: hidden`

Use CSS to hide content from rendering.

**Implementation:**
```tsx
// styled-components.ts
export const StyledDetailsPanel = styled.div<{isExpanded: boolean}>(
  ({ theme, isExpanded }) => ({
    contentVisibility: isExpanded ? 'visible' : 'hidden',
    // ... other styles
  })
)
```

**Cons:**
- Browser Cmd+F behavior with `content-visibility` is inconsistent
- Primarily designed for rendering performance, not search exclusion
- Not a reliable solution for this specific problem

## Recommended Approach: Option 1 (`inert` attribute)

The `inert` attribute is the best solution because:

1. **Standard compliance**: It's the HTML standard for marking content as non-interactive
2. **Minimal changes**: Single attribute addition, no architectural changes
3. **Browser support**: Supported by all browsers in Streamlit's target list
4. **Accessibility**: Properly hides content from assistive technology
5. **Performance**: No impact on rendering or animation
6. **Semantics**: Correctly expresses that collapsed content is "inactive"

## Implementation Plan

### Step 1: Update Expander Component

**File:** `frontend/lib/src/components/elements/Expander/Expander.tsx`

Add `inert` attribute to `StyledDetailsPanel`:

```tsx
<StyledDetailsPanel
  data-testid="stExpanderDetails"
  ref={contentRef}
  inert={!expanded ? true : undefined}
>
  {children}
</StyledDetailsPanel>
```

### Step 2: Update TypeScript Types (if needed)

If TypeScript complains about `inert`, add to global types:

```tsx
// In a .d.ts file or inline
declare module 'react' {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    inert?: boolean | 'true' | '';
  }
}
```

Note: Recent React versions (18.2+) include `inert` in types.

### Step 3: Update Unit Tests

**File:** `frontend/lib/src/components/elements/Expander/Expander.test.tsx`

Add tests verifying:
- Collapsed expander content has `inert` attribute
- Expanded expander content does NOT have `inert` attribute

```tsx
it("sets inert attribute on collapsed content", () => {
  render(<Expander element={getExpanderElement({ expanded: false })}>{children}</Expander>)
  const panel = screen.getByTestId("stExpanderDetails")
  expect(panel).toHaveAttribute("inert")
})

it("removes inert attribute on expanded content", () => {
  render(<Expander element={getExpanderElement({ expanded: true })}>{children}</Expander>)
  const panel = screen.getByTestId("stExpanderDetails")
  expect(panel).not.toHaveAttribute("inert")
})
```

### Step 4: Add E2E Test (Optional)

**File:** `e2e_playwright/st_expander_test.py`

Verify browser search behavior:
- Test that Cmd+F doesn't highlight text in collapsed expanders
- Test that expanding reveals searchable content

## Files to Modify

| File | Change |
|------|--------|
| `frontend/lib/src/components/elements/Expander/Expander.tsx` | Add `inert` attribute |
| `frontend/lib/src/components/elements/Expander/Expander.test.tsx` | Add unit tests |
| `e2e_playwright/st_expander_test.py` | Add E2E test (optional) |

## Risk Assessment

**Low risk:**
- Change is additive (adds attribute, doesn't remove functionality)
- `inert` gracefully degrades (no attribute in unsupported browsers = current behavior)
- No changes to animation, styling, or state management
- Well-tested feature in modern browsers

**Considerations:**
- Users who rely on Cmd+F to find text in collapsed expanders will lose this ability
- This is likely the desired behavior based on the feature request
- Could add a parameter like `searchable=True/False` if needed for opt-in behavior

## Accessibility & Performance Analysis

### Accessibility

**Positive effects:**
- Screen readers correctly skip collapsed content (consistent with visual experience)
- Prevents keyboard focus from entering hidden content
- Standard HTML approach that browsers and assistive technology understand natively

**Potential concerns:**
- Screen reader users who use browser find (Cmd+F) won't find text in collapsed expanders - but this is the intended behavior since sighted users also won't see those matches highlighted
- If a user had focus inside an expander that gets collapsed programmatically (via `st.rerun`), focus would move to the document body. This is standard browser behavior for `inert`.

### Rendering Performance

**No negative impact:**
- The content remains in the DOM and is still rendered (just hidden by `<details>`)
- `inert` only affects interactivity and accessibility tree, not layout/paint
- May have a *slight* positive effect since browsers can skip inert subtrees for focus management and accessibility tree calculations

### Other Considerations

| Aspect | Impact |
|--------|--------|
| Form elements in collapsed expanders | Won't be submitted (correct behavior for hidden content) |
| Links in collapsed expanders | Not clickable/focusable when collapsed (intended) |
| Browser support | Excellent - all modern browsers support it |

### Conclusion

The `inert` approach is well-suited for this use case. The main tradeoff is intentional: users can't find collapsed content via Cmd+F. This aligns with the feature request since the goal was to exclude hidden content from search results. If the opposite behavior is desired (auto-expand when found), Option 2 (`hidden="until-found"`) would be the alternative, but that has less browser support and different UX implications.

## Alternative Enhancement: Make Behavior Configurable

If there's concern about changing default behavior, add a parameter:

```python
st.expander("Title", searchable=False)  # Default: False, excludes from search
st.expander("Title", searchable=True)   # Includes in browser search
```

This would require:
1. Adding `searchable` to the proto definition
2. Passing it through to the frontend
3. Conditionally applying `inert` based on the parameter

## Summary

The recommended fix is to add the `inert` attribute to the expander's content panel when collapsed. This is a minimal, standards-compliant change that directly addresses the user's feedback about Cmd+F search behavior in collapsed expanders.

**Estimated scope:** Small change (~10 lines of code + tests)
