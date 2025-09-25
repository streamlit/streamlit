# Technical Design: Transient Element Architecture

## Problem Statement

Streamlit's spinner implementation previously created persistent elements in the execution model tree that caused duplicate element issues when elements changed between reruns. The spinner utilized a delta path - coordinates that define an element's position in the tree - and occupied that position permanently even after removal. This design led to the "transient spinner" problem where:

1. A spinner was shown at a specific delta path position
2. The spinner was "removed" by sending an empty element to that position
3. On subsequent runs, if a different element type occupied that position, duplicate elements appeared in the UI

## Solution Overview

This implementation introduces a comprehensive **Transient Element Architecture** that addresses the core issue through:

1. **Dedicated Transient Protocol** - New `Transient.proto` message type for transient elements
2. **Visitor Pattern Architecture** - Complete refactoring of the render tree using the visitor pattern
3. **TransientNode Implementation** - New node type that manages multiple transient elements with anchors
4. **Non-Delta Path Elements** - Transient elements that don't occupy delta path positions

## Architecture Implementation

### 1. New Render Tree Architecture

The implementation completely refactored Streamlit's frontend render tree from the legacy `AppNode.ts` to a modern visitor pattern architecture:

#### Node Type Hierarchy
- **`AppNode.interface.ts`** - Base interface for all nodes
- **`BlockNode`** - Container nodes (columns, containers, etc.)
- **`ElementNode`** - Regular Streamlit elements (text, widgets, etc.)
- **`StandaloneNode`** - Special elements like logos
- **`TransientNode`** - New node type for transient elements

#### Visitor Pattern Implementation
All operations on the render tree now use the visitor pattern with `AppNodeVisitor.interface.ts`:
- **`RenderNodeVisitor`** - Converts nodes to React components
- **`ClearStaleNodeVisitor`** - Removes outdated elements
- **`ElementsSetVisitor`** - Manages element collections
- **`FilterMainScriptElementsVisitor`** - Filters script elements
- **`GetNodeByDeltaPathVisitor`** - Retrieves nodes by path
- **`SetNodeByDeltaPathVisitor`** - Places nodes at specific paths

### 2. TransientNode Architecture

The `TransientNode` class manages multiple transient elements at a single location:

```typescript
export class TransientNode implements AppNode {
  readonly anchor?: AppNode                    // Optional persistent element
  readonly transientNodes: TransientNodeMap   // Array of [id, node, orderIndex]
  readonly scriptRunId: string
  readonly clearIdSet: Set<string>            // IDs to remove

  // Manages multiple transient elements with ordering
  public hasTransientElement(id: string): boolean
  public replaceTransientNode(node: TransientNode): AppNode
  public updateTransientNodes(update: Function): TransientNodeMap
}
```

**Key Features:**
- **Anchor Support** - Can optionally hold a persistent element at the same location
- **Multiple Transients** - Manages multiple transient elements with unique IDs
- **Ordering** - Each transient has an `orderIndex` for consistent rendering order
- **Clear Semantics** - Elements can be marked for removal via `clearIdSet`

### 3. Protocol Buffer Implementation

#### New Transient.proto
```protobuf
message Transient {
  oneof type {
    Element element = 1;
    Block block = 2;
  }

  string transient_id = 3;
  optional uint32 order_index = 4;
  bool clear = 5;
}
```

#### Integration with Delta.proto
```protobuf
message Delta {
  oneof type {
    Element new_element = 3;
    Block add_block = 6;
    Transient new_transient = 9;    // New transient message type
    // ... other types
  }
}
```

### 4. Backend Spinner Implementation

The spinner implementation in `lib/streamlit/elements/spinner.py` uses the new transient architecture:

```python
@contextlib.contextmanager
def spinner(text: str = "In progress...", *, show_time: bool = False,
           _cache: bool = False, width: Width = "content") -> Iterator[None]:
    from streamlit.proto.Transient_pb2 import Transient as TransientProto

    # Create transient message with unique ID
    message = TransientProto()
    transient_id = str(uuid.uuid4())
    message.transient_id = transient_id
    message.clear = False

    # Use timer to delay spinner display (avoid flickering)
    def set_message():
        if display_message:
            # Create spinner element within transient message
            element_proto = ElementProto()
            spinner_proto = SpinnerProto()
            spinner_proto.text = clean_text(text)
            spinner_proto.cache = _cache
            spinner_proto.show_time = show_time
            element_proto.spinner.CopyFrom(spinner_proto)
            message.element.CopyFrom(element_proto)

            # Send via new _transient method
            spinner_transient = _main._transient(message, layout_config=layout_config)

    add_script_run_ctx(threading.Timer(DELAY_SECS, set_message)).start()

    try:
        yield
    finally:
        # Clear spinner by setting clear flag
        message.clear = True
        if spinner_transient is not None:
            spinner_transient._transient(message, layout_config=layout_config, advance=True)
```

**Key Changes:**
- **UUID-based identification** instead of delta paths
- **Timer-delayed display** to prevent flickering on fast operations
- **Clear flag semantics** for clean removal
- **Dedicated `_transient()` method** separate from regular delta processing

### 5. Frontend Rendering Integration

The `RenderNodeVisitor` handles transient nodes specially:

```typescript
export class RenderNodeVisitor implements AppNodeVisitor<OptionalReactElement> {
  visitTransientNode(node: TransientNode): OptionalReactElement {
    const transientReactElements = []

    // Render all transient elements with special keys
    node.transientNodes.forEach(([, element]) => {
      const keyOverride = this.elementKeyOverride || `transient-${this.transientElementCount}`
      this.transientElementCount += 1

      const transientReactElement = element.accept(
        new RenderNodeVisitor(this.props, this.disableFullscreenMode, keyOverride)
      )
      transientReactElements.push(transientReactElement)
    })

    // Render anchor element if present
    const anchorReactElement = node.anchor?.accept(this)
    if (anchorReactElement) {
      transientReactElements.push(anchorReactElement)
    }

    this.reactElements.push(...transientReactElements)
    return <>{transientReactElements}</>
  }
}
```

**Key Features:**
- **Special key generation** for transient elements (`transient-${count}`)
- **Anchor rendering** - persistent elements can coexist with transients
- **Ordered rendering** - transients render in their specified order

## Implementation History

The implementation was completed through a series of focused commits:

### Phase 1: Foundation (Commits c2e0e15 - 784efe7)
- **Initial Project Work** - Created design document and basic render tree structure
- **Clear Stale Nodes Visitor** - Implemented visitor pattern for cleaning outdated nodes
- **Elements Set Visitor** - Added visitor for managing element collections

### Phase 2: Visitor Pattern (Commits 496caa3 - 7922bb1)
- **Set/Get Node By Delta Path Visitors** - Implemented core delta path operations as visitors
- **Filter Main Script Elements Visitor** - Added filtering capabilities
- **AppRoot Refactoring** - Removed root as BlockNode for cleaner architecture

### Phase 3: Architecture Completion (Commits c6bb3a7 - 07e6edc)
- **Standalone Node Integration** - Made logo and special elements use StandaloneNode
- **Render Node Visitor** - Implemented React component rendering via visitor pattern

### Phase 4: Transient Implementation (Commits 1d636fe - 73d98d1)
- **TransientNode Introduction** - Added new node type with transient element management
- **Protocol Integration** - Added Transient.proto and Delta.proto integration
- **Spinner Integration** - Updated spinner to use transient architecture
- **Testing** - Added comprehensive test coverage for TransientNode

## Benefits Achieved

### 1. **Eliminates Duplicate Elements**
- Transient elements don't occupy delta path positions
- Clean removal via clear flags prevents path conflicts
- Multiple transients can coexist at the same logical location

### 2. **Architectural Modernization**
- Visitor pattern enables extensible operations on render tree
- Clear separation of concerns between node types
- Improved testability through focused visitor implementations

### 3. **Performance Improvements**
- No delta path mutations for transient elements
- Efficient UUID-based identification
- Timer-delayed spinner display prevents unnecessary renders

### 4. **Enhanced User Experience**
- Spinners appear exactly where intended without layout shifts
- Consistent ordering of multiple transient elements
- Seamless integration with existing layout systems

### 5. **Developer Experience**
- Clear abstraction for adding new transient element types
- Comprehensive visitor pattern for render tree operations
- Well-tested architecture with extensive test coverage

## Future Applications

The transient architecture enables additional use cases beyond spinners:

1. **Loading States** - Any temporary loading indicators
2. **Progress Indicators** - Transient progress bars or status messages
3. **Notifications** - Toast messages that appear/disappear
4. **Interactive Feedback** - Temporary validation messages or hints
5. **Development Tools** - Debug overlays or development-time indicators

## Migration Impact

### Backward Compatibility
- All existing spinner usage continues to work unchanged
- No breaking changes to public APIs
- Existing delta path system remains intact for regular elements

### Performance Impact
- Positive impact from reduced delta path mutations
- Timer-based display prevents unnecessary rapid updates
- Visitor pattern enables optimized tree operations

### Testing Coverage
- Comprehensive unit tests for TransientNode operations
- Integration tests for spinner lifecycle
- E2E tests validating visual behavior and absence of duplicate elements

## Conclusion

The Transient Element Architecture successfully addresses the duplicate element issue while modernizing Streamlit's frontend architecture. The implementation provides:

1. **Complete solution** to the transient spinner problem through dedicated protocols and node types
2. **Architectural foundation** for future transient element types beyond spinners
3. **Performance improvements** through optimized rendering and reduced tree mutations
4. **Enhanced maintainability** via the visitor pattern and clear separation of concerns

The solution demonstrates how thoughtful architectural refactoring can solve specific problems while providing broader benefits to the codebase's structure and extensibility.
