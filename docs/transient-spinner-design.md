# Technical Design: Transient Spinner Architecture

## Problem Statement

Streamlit's current spinner implementation creates persistent elements in the execution model tree that cause duplicate element issues when elements change between reruns. The spinner utilizes a delta path - coordinates that define an element's position in the tree - and occupies that position permanently even after removal. This design leads to the "transient spinner" problem where:

1. A spinner is shown at a specific delta path position
2. The spinner is "removed" by sending an empty element to that position
3. On subsequent runs, if a different element type occupies that position, duplicate elements appear in the UI

## Current Architecture Analysis

### Backend Implementation (`lib/streamlit/elements/spinner.py`)

The current spinner implementation:
- Creates a message placeholder using `st.empty()` (line 102)
- Enqueues spinner content via `message._enqueue("spinner", spinner_proto, layout_config=layout_config)` (line 116-118)
- On cleanup, replaces content with either:
  - `message.container()` for chat messages (line 136)
  - `message.empty()` for other contexts (line 138)

### Frontend Implementation (`frontend/lib/src/components/elements/Spinner/Spinner.tsx`)

The spinner component:
- Renders as a standard React component with spinner icon and text
- Receives `SpinnerProto` element data
- Manages elapsed time display when `showTime` is enabled
- Has no special handling for transient behavior

### Delta Path System (`frontend/lib/src/AppNode.ts`)

The delta path system manages element positioning:
- Each element receives coordinates (`deltaPath: number[]`) defining its tree position
- Elements are placed using `this.root.setIn(deltaPath, elementNode, scriptRunId)`
- No special handling exists for temporary or transient elements

## Root Cause Analysis

The transient spinner issue stems from the fundamental mismatch between:

1. **Spinner's temporary nature**: Spinners should not persist in the execution model
2. **Delta path permanence**: Current system assumes all elements with delta paths are persistent
3. **Cleanup mechanism**: Using `empty()` or `container()` still reserves the delta path position

## Proposed Solution: Overlay-Based Transient Spinner

### Design Overview

Implement a dual-rendering approach where spinners:
1. **Don't use delta paths** for positioning in the execution tree
2. **Render as overlays** positioned relative to their intended location
3. **Self-manage lifecycle** without affecting the execution model

### Technical Approach

#### 1. Backend Changes

**New Spinner Protocol** (`proto/streamlit/proto/Spinner.proto`):
```protobuf
message Spinner {
  string text = 1;
  bool cache = 2;
  bool show_time = 3;

  // NEW: Transient spinner metadata
  bool is_complete = 4;          // Flag to remove spinner from screen
  string spinner_id = 5;         // UUID for spinner identification
}
```

**Modified Spinner Implementation** (`lib/streamlit/elements/spinner.py`):
```python
@contextlib.contextmanager
def spinner(
    text: str = "In progress...",
    *,
    show_time: bool = False,
    _cache: bool = False,
    width: Width = "content",
) -> Iterator[None]:
    import uuid

    # Generate UUID for spinner identification
    spinner_id = str(uuid.uuid4())

    # Create and send initial spinner
    spinner_proto = SpinnerProto()
    spinner_proto.text = clean_text(text)
    spinner_proto.cache = _cache
    spinner_proto.show_time = show_time
    spinner_proto.is_complete = False
    spinner_proto.spinner_id = spinner_id

    # Send as regular delta message
    message = st.empty()
    message._enqueue("spinner", spinner_proto)

    try:
        yield
    finally:
        # Mark spinner as complete
        completion_proto = SpinnerProto()
        completion_proto.is_complete = True
        completion_proto.spinner_id = spinner_id

        # Send completion to same delta path
        message._enqueue("spinner", completion_proto)
```

**Updated AppNode Architecture** (`frontend/lib/src/AppNode.ts`):
```typescript
// Updated to handle spinners through normal delta processing
class AppNode {
  public applyDelta(msg: ForwardMsg): AppNode {
    if (msg.delta?.newElement?.spinner) {
      const spinner = msg.delta.newElement.spinner
      const deltaPath = msg.delta.metadata.deltaPath

      if (spinner.isComplete) {
        // Remove completed spinner from the normal child at this delta path
        this.removeChild(deltaPath)
      } else {
        // Add spinner as a regular child but mark it as transient
        const spinnerNode = new SpinnerNode(spinner, true) // true = isTransient
        this.setChild(deltaPath, spinnerNode)
      }

      return this
    }

    // ... existing delta processing for other elements ...
  }

  // Children are already in order with transient spinners intermixed
  public getChildren(): AppNode[] {
    return Array.from(this.children.values())
  }

  // Generate keys for element rendering based on position and type
  public generateElementKey(deltaPath: number[], isTransient: boolean = false): string {
    const pathKey = deltaPath.join('-')
    return isTransient ? `transient-${pathKey}` : `element-${pathKey}`
  }
}

class SpinnerNode extends AppNode {
  constructor(
    public spinnerProto: SpinnerProto,
    public isTransient: boolean = true
  ) {
    super()
  }
}
```

#### 2. Frontend Changes

**Updated AppNode Architecture** (`frontend/lib/src/AppNode.ts`):
```typescript
// Updated to handle transient spinners in the AppNode architecture
class AppNode {
  private transientSpinners: Map<string, SpinnerElement> = new Map()

  // Method to get all rendered children including transient spinners
  public getRenderedChildren(): (AppNode | SpinnerElement)[] {
    const regularChildren = this.children.values()
    const transientSpinners = Array.from(this.transientSpinners.values())
    return [...regularChildren, ...transientSpinners]
  }

  // Handle spinner elements with special key generation
  public applyDelta(msg: ForwardMsg): AppNode {
    if (msg.delta?.newElement?.spinner) {
      const spinner = msg.delta.newElement.spinner

      if (spinner.isComplete) {
        // Remove completed spinner
        this.transientSpinners.delete(spinner.spinnerId)
      } else {
        // Add/update spinner with special transient key
        const spinnerElement = new SpinnerElement(spinner)
        this.transientSpinners.set(spinner.spinnerId, spinnerElement)
      }

      return this
    }

    // ... existing delta processing for regular elements ...
  }

  // Generate keys for element rendering
  public generateElementKey(index: number, isTransient: boolean = false): string {
    if (isTransient) {
      return `transient-${index}`
    }
    return `element-${index}`
  }
}
```

**Updated Block.tsx Integration** (`frontend/lib/src/components/core/Block/Block.tsx`):
```typescript
// Updated Block component to handle intermixed regular and transient elements
function Block({ node, width }: BlockProps): ReactElement {
  const children = node.getChildren() // Regular children with transient spinners intermixed

  return (
    <div className="block-container">
      {children.map((child, index) => {
        const deltaPath = child.deltaPath
        const isTransient = child instanceof SpinnerNode && child.isTransient

        return (
          <ElementNodeRenderer
            key={node.generateElementKey(deltaPath, isTransient)}
            node={child}
            width={width}
          />
        )
      })}
    </div>
  )
}
```

#### 3. Protocol Buffer Changes

**Enhanced ForwardMsg** - No longer needs special transient message handling:
```protobuf
// Spinners now use regular Delta messages with standard positioning
// The is_complete flag in SpinnerProto handles lifecycle management
// No additional protocol changes needed beyond the SpinnerProto updates
```

### Implementation Benefits

#### 1. **Eliminates Duplicate Elements**
- Spinners use normal delta path positioning like other elements
- Use `is_complete` flag for clean removal without tree mutations
- Natural ordering preserved with spinners intermixed with regular children

#### 2. **Performance Improvements**
- No special transient message handling needed
- Leverages existing delta processing infrastructure
- Efficient key generation based on delta path and transient flag

#### 3. **Better User Experience**
- Spinners appear in natural document order
- Consistent behavior with all other Streamlit elements
- Seamless integration with existing layout systems

#### 4. **Simplified Architecture**
- Single spinner function handles entire lifecycle
- Standard delta message flow throughout
- Natural intermixing of regular and transient elements in render order

### Migration Strategy

#### Phase 1: Infrastructure (Week 1)
- Update SpinnerProto with `is_complete` and `spinner_id` fields
- Modify spinner implementation to use UUID identification
- Update AppNode to handle transient spinners in rendered children
- Update Block.tsx to use special keys for transient elements

#### Phase 2: Testing and Integration (Week 2)
- Update tests for new transient behavior
- Add performance benchmarks
- Test spinner lifecycle with `is_complete` flag
- Validate key generation and rendering performance

#### Phase 3: Documentation and Optimization (Week 4)
- Update documentation
- Add examples of spinner usage patterns
- Performance optimization based on real-world usage
- Clean up any legacy spinner handling code

### Testing Strategy

#### Unit Tests
- Backend: Verify transient spinners don't create delta path entries
- Frontend: Test TransientSpinnerManager lifecycle management
- Protocol: Validate transient message serialization

#### Integration Tests
- End-to-end spinner display/removal without tree modifications
- Performance tests comparing transient vs. traditional approaches
- Cross-browser overlay positioning validation

#### Regression Tests
- Ensure existing spinner functionality remains intact
- Verify no duplicate elements in complex scenarios
- Test spinner behavior in various container types (chat, columns, etc.)

## Alternative Approaches Considered

### 1. **Delta Path Reuse Strategy**
- **Approach**: Mark spinner delta paths for reuse by subsequent elements
- **Issues**: Complex path management, potential race conditions, doesn't address root cause

### 2. **Virtual Spinner Elements**
- **Approach**: Create spinner elements that exist only in frontend state
- **Issues**: Complicated synchronization, diverges from Streamlit's execution model

### 3. **Spinner-Specific Delta Paths**
- **Approach**: Use negative indices or special path markers for spinners
- **Issues**: Increases execution tree complexity, potential path conflicts

## Conclusion

The updated transient spinner architecture addresses the core issue by treating spinners as regular delta elements while maintaining their transient nature through the `is_complete` flag. By integrating spinners directly into the standard delta flow:

1. **Standard delta processing** - Spinners use normal delta paths and messaging
2. **UUID identification** for clean lifecycle management
3. **Completion flags** instead of complex removal logic
4. **Natural intermixing** - Spinners appear in document order with regular elements
5. **Integrated lifecycle** - Everything handled within the single spinner function

This solution eliminates the root cause of duplicate elements while maintaining perfect consistency with Streamlit's existing architecture. Spinners are treated as first-class elements that happen to be transient, rather than as special cases requiring separate infrastructure.
