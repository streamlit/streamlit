# Tech Spec: Preserving React Component State During Element Reordering

## Problem Statement

In Streamlit, when new elements are added to the same level of the delta path during a rerun, existing elements can get unmounted and remounted by React's reconciliation process. This happens because React keys are often based on array indices, causing components to lose their internal state when their position changes.

Currently, this is handled by reconstructing widget state from the WidgetStateManager, but this approach has limitations:

- Only widget state is preserved, not other React component state
- Performance overhead from state reconstruction
- Potential flickering or UI disruptions
- Loss of DOM state (scroll positions, focus, etc.)

## Proposed Solution: ID-Based Virtual DOM Reconciliation

Implement a simplified virtual reconciliation layer that only preserves state for elements with IDs (widgets). Elements without IDs (static content like text, markdown) will continue to use index-based keys and may lose state on reordering, which is acceptable since they typically don't have meaningful interactive state.

### Elements That Benefit

**Preserved (have IDs):**
- Input widgets: `st.text_input`, `st.number_input`, `st.text_area`
- Selection widgets: `st.selectbox`, `st.multiselect`, `st.radio`, `st.checkbox`
- Interactive widgets: `st.button`, `st.slider`, `st.date_input`, `st.time_input`
- Data widgets: `st.data_editor`, `st.file_uploader`
- Interactive charts: Plotly charts with selections, Vega-Lite charts with interactions

**Not Preserved (no IDs):**
- Display elements: `st.text`, `st.markdown`, `st.title`, `st.header`
- Static visualizations: `st.metric`, `st.progress`, `st.image`
- Layout elements: `st.container`, `st.columns` (the containers themselves, not their contents)
- Informational: `st.info`, `st.warning`, `st.error`, `st.success`

### Key Components

#### 1. VirtualReconciler Component (`VirtualReconciler.tsx`)

A wrapper component that manages the lifecycle of child components:

```typescript
interface ReconcilerState {
  renderedElements: Map<string, {
    node: AppNode
    element: ReactNode
    lastSeen: number
  }>
  elementOrder: string[]
}
```

**Features:**

- Maintains a map of all rendered components with their stable keys
- Hides components (using `display: none`) instead of unmounting when removed
- Only unmounts components after script run completion if they weren't re-rendered
- Tracks component order for proper visual arrangement

#### 2. Simplified Key Generation

The simplified approach uses element IDs directly as React keys:

```typescript
const getNodeKey = (node: AppNode, index: number): string => {
  if (node instanceof ElementNode) {
    const elementId = (element as any)[elementType]?.id
    if (elementId) {
      return elementId  // Stable key for widgets
    }
  }
  // Temporary key for elements without IDs
  return `temp-${index}-${Date.now()}`
}
```

**Key Strategy:**
- **Widgets with IDs**: Use their unique ID as key → state preserved
- **Static elements**: Use temporary index-based keys → state not preserved (acceptable)

#### 3. Integration with Block Renderer

Update `Block.tsx` to use the VirtualReconciler:

- Replace array index-based keys with stable keys
- Wrap child rendering in VirtualReconciler
- Enable/disable reconciliation based on block type (e.g., forms handle their own state)

## Implementation Details

### State Preservation Strategy

1. **Initial Render**:
   - Widgets (with IDs) are rendered and tracked in the reconciler's map
   - Static elements use temporary keys and are not tracked
2. **Element Insertion**:
   - New widgets get their ID as key and are tracked
   - Existing widgets keep their ID-based keys and remain mounted
   - Static elements may re-mount if their position changes
3. **Temporary Hiding**: Widgets not in current render are hidden but kept in DOM
4. **Cleanup**: After script run completes, remove widgets that weren't re-rendered

### Benefits

1. **Widget State Preservation**:
   - React component state for widgets (`useState`, `useRef`, etc.)
   - DOM state for interactive elements (focus, selections)
   - Event listeners and effect cleanup functions
   - Form input states and validation

2. **Simplified Implementation**:
   - Only tracks elements with IDs
   - Reduced memory footprint
   - Clear, predictable behavior
   - Easier to debug and maintain

3. **Better Performance**:
   - No state reconstruction overhead for widgets
   - Reduced re-rendering of interactive components
   - Minimal tracking overhead for static content

### Considerations

1. **Selective State Preservation**:
   - Only widgets with IDs preserve state
   - Static elements (text, markdown) may re-render on position change
   - This is acceptable as static elements rarely have meaningful state

2. **Memory Usage**: Only widgets remain in memory when hidden
   - Much lower memory footprint than preserving all elements
   - Clean up after each script run

3. **Developer Experience**:
   - Clear mental model: ID = preserved state
   - Predictable behavior
   - No changes to public API

## Alternative Approaches Considered

1. **React.memo with Custom Comparison**:
   - Pros: Built-in React feature
   - Cons: Only prevents re-renders, doesn't preserve position-based state

2. **Portal-based Rendering**:
   - Pros: Complete control over DOM position
   - Cons: Complex implementation, potential styling issues

3. **Extended Widget State Manager**:
   - Pros: Builds on existing system
   - Cons: Limited to serializable state, doesn't preserve DOM state

## Rollout Plan

1. **Phase 1**: Implement behind feature flag
   - Test with common use cases
   - Monitor performance metrics

2. **Phase 2**: Enable for specific components
   - Start with stateful widgets
   - Gradually expand coverage

3. **Phase 3**: General availability
   - Enable by default
   - Provide opt-out mechanism for edge cases

## Success Metrics

- Reduction in component remounts during reruns
- Decreased time spent in state reconstruction
- Improved user satisfaction scores for interactive apps
- No regression in memory usage or performance
