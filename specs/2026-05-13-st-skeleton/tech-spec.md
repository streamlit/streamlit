---
author: lukasmasuch
created: 2026-05-13
---

# `st.skeleton` - Technical Implementation

## Summary

This tech spec covers the implementation of `st.skeleton()` as a public API, building on the
existing internal `_skeleton` command. The key technical challenge is supporting both standalone
(replaceable placeholder) and context manager (auto-clearing) modes in a single command.

## Problem

The internal `st._skeleton()` currently:

1. Only supports standalone mode (returns `DeltaGenerator`)
2. Only accepts `height` parameter (no `width` support)
3. Uses the element's own proto field for height, not the standard `HeightConfig`

To make this a public API, we need:

1. Support for context manager mode that auto-clears on exit
2. Width and height support using the standard `WidthConfig`/`HeightConfig` protos
3. A clean implementation that handles both modes gracefully

## Proposal

### Architecture Decision: SkeletonPlaceholder Class

Following the pattern established by `StatusContainer` (used by `st.status()`), we'll create
a `SkeletonPlaceholder` class that extends `DeltaGenerator` with custom `__exit__` behavior:

```python
class SkeletonPlaceholder(DeltaGenerator):
    """A DeltaGenerator that auto-clears when used as a context manager."""

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> Literal[False]:
        # Clear the skeleton when exiting context manager
        self.empty()
        return super().__exit__(exc_type, exc_val, exc_tb)
```

This gives us:

- **Standalone mode**: Works like `st.empty()` - full `DeltaGenerator` API for replacing content
- **Context manager mode**: Auto-clears on exit, similar to `st.spinner()` semantics

### Backend Implementation

**File: `lib/streamlit/elements/lib/skeleton_placeholder.py`** (new file)

```python
from __future__ import annotations

from typing import TYPE_CHECKING, Literal, cast

from streamlit.delta_generator import DeltaGenerator
from streamlit.elements.lib.layout_utils import (
    HeightWithoutContent,
    WidthWithoutContent,
    create_layout_config,
)
from streamlit.proto.Skeleton_pb2 import Skeleton as SkeletonProto

if TYPE_CHECKING:
    from types import TracebackType
    from streamlit.cursor import Cursor


class SkeletonPlaceholder(DeltaGenerator):
    """A placeholder that displays a skeleton loading animation.

    This extends DeltaGenerator with auto-clear behavior when used as a
    context manager. In standalone mode, it behaves like st.empty().
    """

    @staticmethod
    def _create(
        parent: DeltaGenerator,
        height: HeightWithoutContent,
        width: WidthWithoutContent,
    ) -> SkeletonPlaceholder:
        """Create a new skeleton placeholder."""
        layout_config = create_layout_config(
            width=width,
            height=height,
            allow_stretch_height=True,
        )

        skeleton_proto = SkeletonProto()
        # Style is ELEMENT (default) - APP style is internal-only

        placeholder = cast(
            SkeletonPlaceholder,
            parent._enqueue(
                "skeleton",
                skeleton_proto,
                layout_config=layout_config,
                dg_type=SkeletonPlaceholder,
            ),
        )
        return placeholder

    def __init__(
        self,
        root_container: int | None,
        cursor: Cursor | None,
        parent: DeltaGenerator | None,
        block_type: str | None,
    ) -> None:
        super().__init__(
            root_container=root_container,
            cursor=cursor,
            parent=parent,
            block_type=block_type,
        )

    def __enter__(self) -> SkeletonPlaceholder:
        super().__enter__()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> Literal[False]:
        # Clear the skeleton when exiting context manager
        self.empty()
        return super().__exit__(exc_type, exc_val, exc_tb)
```

**File: `lib/streamlit/elements/empty.py`** (modifications)

```python
from streamlit.elements.lib.skeleton_placeholder import SkeletonPlaceholder
from streamlit.elements.lib.layout_utils import HeightWithoutContent, WidthWithoutContent


class EmptyMixin:
    # ... existing empty() and _skeleton() methods ...

    @gather_metrics("skeleton")
    def skeleton(
        self,
        height: HeightWithoutContent = 100,
        *,
        width: WidthWithoutContent = "stretch",
    ) -> SkeletonPlaceholder:
        """Display a skeleton loading placeholder."""
        return SkeletonPlaceholder._create(
            parent=self.dg,
            height=height,
            width=width,
        )
```

### Proto Changes

**No proto changes required.** The existing `Skeleton.proto` is sufficient:

```protobuf
message Skeleton {
  enum SkeletonStyle {
    ELEMENT = 0;
    APP = 1; // internal-only
  }
  SkeletonStyle style = 1;
  optional int32 height = 2;  // Legacy: prefer Element.height_config
}
```

The `height` field in the proto is legacy and maintained for backward compatibility. The
frontend should prefer `Element.height_config` when present, falling back to
`Skeleton.height` for backward compatibility with internal `_skeleton` usage.

### Frontend Changes

**File: `frontend/lib/src/components/elements/Skeleton/Skeleton.tsx`**

Update the Skeleton component to use `height_config` and `width_config` from the Element
proto:

```tsx
interface SkeletonProps {
  element: SkeletonProto
  widthConfig?: WidthConfig
  heightConfig?: HeightConfig
}

const RawSkeleton: FC<SkeletonProps> = ({
  element,
  widthConfig,
  heightConfig,
}) => {
  if (element.style === SkeletonProto.SkeletonStyle.APP) {
    return <AppSkeleton />
  }

  // Compute height from heightConfig, falling back to element.height
  const height = heightConfig?.pixelHeight
    ? `${heightConfig.pixelHeight}px`
    : heightConfig?.useStretch
      ? "100%"
      : element.height
        ? `${element.height}px`
        : undefined

  // Compute width from widthConfig (default: stretch)
  const width = widthConfig?.pixelWidth
    ? `${widthConfig.pixelWidth}px`
    : widthConfig?.useContent
      ? "fit-content"
      : "100%"  // useStretch or no config = stretch

  return (
    <SquareSkeleton
      className="stSkeleton"
      data-testid="stSkeleton"
      height={height}
      width={width}
    />
  )
}
```

### Transient Elements vs Persistent: Mode-Based Approach

After discussion, the cleanest design uses **different mechanisms per mode**:

| Mode | Mechanism | Behavior |
|------|-----------|----------|
| Standalone | Persistent (like `st.empty()`) | Immediate, replaceable |
| Context manager | Transient (like `st.spinner()`) | 0.5s delay, auto-clear |

This gives users the best of both worlds:
- **Standalone**: When you *know* content will take time, show skeleton immediately and replace it
- **Context manager**: When duration is *unknown*, use delay to avoid flicker for fast ops

### Backend Implementation (Revised)

The `skeleton()` method needs to support both modes. Since Python can't detect "will this
be used as a context manager?" at call time, we use a hybrid approach:

**File: `lib/streamlit/elements/skeleton.py`** (new file)

```python
from __future__ import annotations

import contextlib
import threading
from typing import TYPE_CHECKING, Final, Literal, cast

from streamlit.delta_generator import DeltaGenerator
from streamlit.elements.lib.layout_utils import (
    HeightWithoutContent,
    WidthWithoutContent,
    create_layout_config,
)
from streamlit.errors import NoSessionContext
from streamlit.proto.Element_pb2 import Element as ElementProto
from streamlit.proto.Skeleton_pb2 import Skeleton as SkeletonProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import add_script_run_ctx, enqueue_message

if TYPE_CHECKING:
    from collections.abc import Iterator
    from streamlit.cursor import Cursor

DELAY_SECS: Final = 0.5


class SkeletonPlaceholder(DeltaGenerator):
    """A skeleton placeholder that supports both standalone and context manager modes.

    - Standalone mode (like st.empty): Shows immediately, user replaces content
    - Context manager mode (like st.spinner): 0.5s delay, auto-clears on exit
    """

    _is_context_manager: bool = False
    _create_transient: object = None
    _clear_transient: object = None

    @staticmethod
    def _create_standalone(
        parent: DeltaGenerator,
        height: HeightWithoutContent,
        width: WidthWithoutContent,
    ) -> SkeletonPlaceholder:
        """Create a standalone skeleton (like st.empty)."""
        layout_config = create_layout_config(
            width=width,
            height=height,
            allow_stretch_height=True,
        )
        skeleton_proto = SkeletonProto()

        placeholder = cast(
            SkeletonPlaceholder,
            parent._enqueue(
                "skeleton",
                skeleton_proto,
                layout_config=layout_config,
                dg_type=SkeletonPlaceholder,
            ),
        )
        placeholder._is_context_manager = False
        return placeholder

    def __init__(
        self,
        root_container: int | None,
        cursor: Cursor | None,
        parent: DeltaGenerator | None,
        block_type: str | None,
    ) -> None:
        super().__init__(
            root_container=root_container,
            cursor=cursor,
            parent=parent,
            block_type=block_type,
        )

    @contextlib.contextmanager
    def _as_context_manager(
        self,
        parent: DeltaGenerator,
        height: HeightWithoutContent,
        width: WidthWithoutContent,
    ) -> Iterator[None]:
        """Context manager mode (like st.spinner) - 0.5s delay, auto-clear."""
        layout_config = create_layout_config(
            width=width,
            height=height,
            allow_stretch_height=True,
        )

        skeleton_proto = SkeletonProto()
        element_proto = ElementProto()
        element_proto.skeleton.CopyFrom(skeleton_proto)

        try:
            create_transient, clear_transient = parent._transient(
                element_proto,
                layout_config=layout_config,
            )
        except NoSessionContext:
            yield
            return

        display_skeleton = True
        display_lock = threading.Lock()
        timer: threading.Timer | None = None

        try:
            def show_skeleton() -> None:
                with display_lock:
                    if display_skeleton:
                        enqueue_message(create_transient())

            timer = threading.Timer(DELAY_SECS, show_skeleton)
            add_script_run_ctx(timer)
            timer.start()
            yield
        finally:
            if timer:
                timer.cancel()
            with display_lock:
                display_skeleton = False
                enqueue_message(clear_transient())


class SkeletonMixin:
    @gather_metrics("skeleton")
    def skeleton(
        self,
        height: HeightWithoutContent = 100,
        *,
        width: WidthWithoutContent = "stretch",
    ) -> SkeletonPlaceholder:
        """Display a skeleton loading placeholder.

        Supports two usage patterns:

        1. Standalone (like st.empty): Shows immediately, replace with content
           >>> placeholder = st.skeleton(height=200)
           >>> placeholder.dataframe(data)

        2. Context manager (like st.spinner): 0.5s delay, auto-clears
           >>> with st.skeleton(height=200):
           ...     data = expensive_operation()
           >>> st.dataframe(data)
        """
        return SkeletonPlaceholder._create_standalone(
            parent=self.dg,
            height=height,
            width=width,
        )

    @property
    def dg(self) -> DeltaGenerator:
        return cast(DeltaGenerator, self)
```

**Key insight**: The `skeleton()` method always returns a `SkeletonPlaceholder` (standalone
mode). When used as a context manager, `SkeletonPlaceholder.__enter__` detects this and
switches to transient behavior.

Actually, a cleaner approach is to have `skeleton()` return a special object that behaves
differently based on how it's used:

```python
class SkeletonPlaceholder(DeltaGenerator):
    """Dual-mode skeleton: standalone or context manager."""

    _parent: DeltaGenerator
    _height: HeightWithoutContent
    _width: WidthWithoutContent
    _entered_as_context_manager: bool = False

    def __enter__(self) -> SkeletonPlaceholder:
        # Switch to transient/spinner mode
        self._entered_as_context_manager = True
        # ... set up timer and transient element ...
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> Literal[False]:
        if self._entered_as_context_manager:
            # Cancel timer, clear transient
            ...
        return False
```

This way:
- `placeholder = st.skeleton()` → standalone, immediate, replaceable
- `with st.skeleton():` → context manager, delayed, transient

### Testing Strategy

**Unit tests** (`lib/tests/streamlit/elements/skeleton_test.py`):
- Standalone mode: Verify skeleton proto is enqueued with correct height/width config
- Context manager mode: Verify skeleton is cleared on exit
- Exception handling: Verify skeleton clears even if exception raised in block
- Parameter validation: Verify errors for invalid height/width values

**Frontend tests** (`frontend/lib/src/components/elements/Skeleton/Skeleton.test.tsx`):
- Render with pixel height/width
- Render with stretch height/width
- Backward compatibility with legacy `element.height` field

**E2E tests** (`e2e_playwright/st_skeleton_test.py`):
- Visual snapshot of skeleton animation
- Verify skeleton replaces with content in standalone mode
- Verify skeleton clears after context manager exits

## Alternatives Considered

### 1. Single Mechanism for Both Modes

**Option A: Always transient (like spinner)**
- Pros: Simple, consistent
- Cons: Can't replace content, no space reservation in standalone mode

**Option B: Always persistent (like empty)**
- Pros: Simple, replaceable
- Cons: No delay for context manager, flicker on fast ops

**Decision:** Use different mechanisms per mode. This matches user intent:
- Standalone = "I know this takes time, show skeleton now"
- Context manager = "I don't know how long, avoid flicker if fast"

### 2. Separate Commands for Standalone vs Context Manager

```python
st.skeleton(height=100)  # Standalone only
with st.skeleton_loading(height=100):  # Context manager only
    ...
```

**Pros:**
- Clear separation of concerns
- No mode-detection complexity

**Cons:**
- Two commands for related functionality
- Users would need to learn two APIs

**Decision:** Single command with dual mode. The behavior difference is intuitive based
on usage pattern.

### 3. Using @contextlib.contextmanager

```python
@contextlib.contextmanager
def skeleton(height, width):
    dg = self.dg._enqueue("skeleton", ...)
    try:
        yield dg
    finally:
        dg.empty()
```

**Pros:**
- Simple implementation

**Cons:**
- Always clears on exit, even in "standalone" mode
- Standalone usage becomes awkward: `placeholder = st.skeleton().__enter__()`
- Type hints don't work well with generator functions

**Decision:** Use custom `SkeletonPlaceholder` class for cleaner API.

### 4. Adding Width to Skeleton Proto

```protobuf
message Skeleton {
  SkeletonStyle style = 1;
  optional int32 height = 2;
  optional int32 width = 3;  // NEW
}
```

**Pros:**
- Self-contained proto

**Cons:**
- Duplicates `WidthConfig`/`HeightConfig` functionality
- Inconsistent with other elements that use `Element.width_config`
- Harder to add `"stretch"` support and future dimension options

**Decision:** Use `Element.width_config` and `Element.height_config` for consistency.
