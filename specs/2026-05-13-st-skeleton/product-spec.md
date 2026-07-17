---
author: lukasmasuch
created: 2026-05-13
---

# `st.skeleton` - Skeleton Loading Placeholder

## Summary

Expose a public `st.skeleton()` command that displays an animated loading placeholder element.
The command supports both standalone usage (like `st.empty()`) and context manager usage
(like `st.spinner()`), allowing developers to reserve layout space and provide visual feedback
while content loads.

## Problem

Streamlit apps often experience "layout shift" when content loads asynchronously. Elements
appear suddenly, causing the page to jump and creating a jarring user experience. This is
particularly problematic for:

- Data fetching that takes noticeable time
- LLM responses and AI-powered features
- Heavy computations that block rendering
- Content that loads progressively

Currently, developers use `st.empty()` as a placeholder, but it's invisible and doesn't
communicate to users that content is loading. The alternative is `st.spinner()`, which shows
a loading indicator but doesn't reserve the space the final content will occupy.

Skeleton loading patterns are widely adopted (Material UI, Chakra UI, Ant Design) because
they:

1. Prevent layout shift by reserving space
2. Provide visual feedback that content is loading
3. Give users a sense of the content structure before it loads
4. Feel faster than blank space or spinners (perceived performance)

**User requests:**

- [#8032][issue-8032] - Feature request for `st.skeleton()` container element

**Prior art:**

- An internal `st._skeleton()` command already exists with basic height support
- The frontend `Skeleton` component and proto are already implemented
- Base Web's skeleton component is available in the frontend dependencies

[issue-8032]: https://github.com/streamlit/streamlit/issues/8032

## Proposal

### API

```python
def skeleton(
    height: int | Literal["stretch"] | None = None,
    *,
    width: int | Literal["stretch"] = "stretch",
) -> SkeletonPlaceholder:
    """Display a skeleton loading placeholder.

    Inserts an animated placeholder that can be used to reserve space while
    content loads. The skeleton displays a pulsing animation to indicate
    loading state.

    This command supports two usage patterns:

    1. **Standalone placeholder** (like ``st.empty()``): Returns a
       ``SkeletonPlaceholder`` that can be replaced with actual content.

    2. **Context manager** (like ``st.spinner()``): Shows the skeleton while
       the code block executes, then automatically clears it. In this mode,
       the skeleton is handled as a *transient element* that auto-clears
       when the block exits.

    Parameters
    ----------
    height : int, "stretch", or None
        Height of the skeleton in pixels, or ``"stretch"`` to fill the
        available vertical space. If ``None`` (default), the skeleton uses a
        default height equal to the standard input widget height.

    width : int or "stretch"
        Width of the skeleton in pixels, or ``"stretch"`` to fill the
        available horizontal space. Defaults to ``"stretch"``.
        Note: ``"content"`` is not supported since skeleton has no inherent
        content width. (This intentionally differs from ``st.spinner()``,
        which defaults ``width`` to ``"content"``.)

    Returns
    -------
    SkeletonPlaceholder
        A placeholder object that wraps a ``DeltaGenerator``. There are two
        ways to use it:

        - **Standalone**: Call ``st.*`` methods directly on the returned
          object (e.g. ``placeholder.dataframe(...)``) to replace the
          skeleton with content.
        - **Context manager**: Use it in a ``with`` block. The skeleton is
          shown as a transient element while the block runs and auto-clears
          on exit. Elements written inside the block render in the parent
          container (like ``st.spinner()``), not inside the skeleton.

    Examples
    --------
    Use as a placeholder that gets replaced with content:

    >>> import streamlit as st
    >>> import time
    >>>
    >>> placeholder = st.skeleton(height=200)
    >>> time.sleep(2)  # Simulate loading
    >>> placeholder.image("https://placehold.co/400x200")

    Use as a context manager that automatically clears:

    >>> import streamlit as st
    >>> import time
    >>>
    >>> with st.skeleton(height=150):
    ...     time.sleep(2)  # Simulate loading
    ...     data = load_data()
    >>> st.dataframe(data)

    Combine with columns for complex layouts:

    >>> import streamlit as st
    >>> import time
    >>>
    >>> col1, col2 = st.columns(2)
    >>> with col1:
    ...     placeholder1 = st.skeleton(height=100)
    >>> with col2:
    ...     placeholder2 = st.skeleton(height=100)
    >>>
    >>> time.sleep(1)
    >>> placeholder1.metric("Users", "1,234")
    >>> placeholder2.metric("Revenue", "$5,678")
    """
```

### Behavior

**Standalone mode (like `st.empty()`):**

```python
placeholder = st.skeleton(height=200)
# ... do some work ...
placeholder.dataframe(data)  # Replaces skeleton with content
```

- Shows **immediately** when `st.skeleton()` is called (no delay)
- Returns a `SkeletonPlaceholder` that wraps a `DeltaGenerator`
- The skeleton remains visible until replaced with content
- Calling any `st.*` method on the placeholder (e.g., `.write()`, `.dataframe()`) replaces
  the skeleton with that content
- Multiple replacements are supported (each call replaces the previous content)
- Calling `.empty()` clears the skeleton without replacement

**Context manager mode (like `st.spinner()`):**

```python
with st.skeleton(height=200):
    data = expensive_operation()
# Skeleton auto-clears here
st.dataframe(data)  # Content appears in normal flow
```

- Uses **0.5s delay** before showing (same as `st.spinner()`)
- If the block completes within 0.5s, no skeleton is shown (avoids flicker)
- Uses Streamlit's **transient element mechanism** (same as spinner)
- Auto-clears when the block exits (success or exception)
- Content written inside the `with` block appears in the **parent container**, not inside
  the skeleton (same as `st.spinner()`)
- Unlike `st.spinner()`, there is no text label—just the animated placeholder

**Dual-mode transition:**

When `st.skeleton()` is used as a context manager, the skeleton shown by the initial call
is cleared in `__enter__` and re-shown as a transient element with the 0.5s delay. See
[Alternatives Considered](#alternatives-considered) for why a single call can behave this
way and the simpler alternatives that were weighed.

- **Interleaved sequence (single rerun):** a standalone-then-`with` use briefly creates the
  immediate skeleton, which `__enter__` clears; the transient skeleton then appears only if
  the block runs longer than 0.5s. The persistent show and the `__enter__` clear are
  expected to coalesce on the frontend so there is no visible flash (to be verified during
  implementation).
- **`with ... as ph`:** `__enter__` returns the `SkeletonPlaceholder` for API symmetry, but
  in context-manager mode the skeleton is transient—calling methods on `ph` to replace it is
  not the intended pattern (use standalone mode for replacement).
- **Error before the block is entered:** if the script errors after `st.skeleton()` is called
  but before the `with` block starts, the initially-shown skeleton is cleared on the next
  rerun like any other element that is no longer rendered.
- **Unreserved-space tradeoff:** because `__enter__` clears the skeleton and the transient
  re-show is delayed by 0.5s (to match `st.spinner()` and avoid flicker on fast blocks),
  context-manager mode does **not** reserve layout space during that first half second. This
  is an inherent tension with the anti–layout-shift goal and a key input to the open
  dual-mode decision in [Alternatives Considered](#alternatives-considered): dropping the
  0.5s delay (or making it configurable) would reserve space immediately at the cost of
  flicker on sub-0.5s blocks. Standalone mode is unaffected—it reserves space immediately.

**Dimension behavior:**

| Parameter | Value | Behavior |
|-----------|-------|----------|
| `height` | `None` (default) | Uses the standard widget height, resolved on the frontend as a `rem` value (`theme.sizes.minElementHeight`, currently `2.5rem`) |
| `height` | `int` | Fixed height in pixels |
| `height` | `"stretch"` | Fills available vertical space (requires bounded container) |
| `width` | `int` | Fixed width in pixels |
| `width` | `"stretch"` (default) | Fills available horizontal space |

**Animation:**

The skeleton displays a pulsing opacity animation (existing behavior from internal
`_skeleton`). The animation uses Streamlit's theme colors:

- Background: `theme.colors.darkenedBgMix15`
- Border radius: `theme.radii.default`
- Animation: 750ms pulse, infinite loop

**Frontend rendering:**

The skeleton element always fills its container (100% width and height). The actual
dimensions are controlled by the layout config applied to the element container wrapper
via the `useLayoutStyles` hook.

**Accessibility:**

These are **net-new requirements** for the implementation PR. The existing internal
`Skeleton` frontend component does not yet implement them (it renders no `role`/`aria-*`
attributes, and the pulse animation has no `prefers-reduced-motion` guard). The same
treatment should be applied retroactively to existing internal `_skeleton` usages (e.g.,
`AppSkeleton`).

- The skeleton is treated as a **decorative placeholder**: it is marked `aria-hidden="true"`
  so assistive technologies do not announce each skeleton individually. This avoids silence
  (a bare skeleton has no text to read) as well as noisy, repeated announcements when many
  skeletons render at once (e.g., chat or card grids). Apps that need an audible "loading"
  cue should own that announcement via a higher-level labeled live region.
- The pulse animation respects `prefers-reduced-motion` (animation disabled when reduced
  motion is preferred).

**Rerun behavior:**

If the skeleton is never replaced (e.g., a data fetch fails or the script reruns before
replacement), the skeleton persists and displays again on the next rerun. This matches
`st.empty()` behavior - the placeholder maintains its position in the layout until
explicitly replaced or the element is no longer rendered in the script.

> **Flicker caveat (standalone mode):** When data loads quickly (e.g., a warm
> `@st.cache_data` cache), the skeleton appears for a single frame and is immediately
> replaced, which can cause a brief flicker on every rerun. Since reducing layout shift is
> the primary motivation for this command, apps that want to avoid the flicker should gate
> the skeleton on a session-state "loaded" flag (or only render it on a cache miss) rather
> than rendering it unconditionally.

### Usage Examples

**Basic data loading:**

```python
import streamlit as st
import time

st.title("Dashboard")

# Reserve space while data loads
chart_placeholder = st.skeleton(height=300)
metrics_placeholder = st.skeleton(height=80)

# Simulate data fetch
time.sleep(2)

# Replace skeletons with actual content
chart_placeholder.line_chart({"data": [1, 5, 2, 6, 3, 7]})
metrics_placeholder.metric("Total Users", "12,345", "+123")
```

**LLM streaming with skeleton:**

```python
import streamlit as st

prompt = st.chat_input("Ask me anything")

if prompt:
    st.chat_message("user").write(prompt)

    with st.chat_message("assistant"):
        # Show skeleton while waiting for first token
        placeholder = st.skeleton(height=100)

        response = ""
        for chunk in stream_llm_response(prompt):
            response += chunk
            placeholder.markdown(response)
```

**Progressive content loading:**

```python
import streamlit as st
import time

col1, col2, col3 = st.columns(3)

# Create skeletons for all cards
placeholders = []
for col in [col1, col2, col3]:
    with col:
        placeholders.append(st.skeleton(height=150))

# Load and display content progressively
for i, placeholder in enumerate(placeholders):
    time.sleep(0.5)  # Simulate staggered loading
    placeholder.write(f"Card {i + 1} content")
```

**Skeleton in fragment:**

```python
import streamlit as st
import time

@st.fragment
def data_section():
    placeholder = st.skeleton(height=100)
    time.sleep(1)
    placeholder.write("Fragment content loaded!")

data_section()
```

**Context manager for blocking operations (transient mode):**

```python
import streamlit as st

st.write("Click to load data:")

if st.button("Load"):
    with st.skeleton(height=200, width=400):
        # Skeleton shows during this block (transient)
        result = expensive_database_query()

    # Skeleton auto-clears, content appears here
    st.dataframe(result)
```

### Design

The skeleton renders as a simple rectangular element with:

- Rounded corners matching Streamlit's design system
- A subtle pulsing animation
- Theme-aware background color

```
┌─────────────────────────────────────┐
│                                     │
│     ░░░░░░░░░░░░░░░░░░░░░░░░░░     │  <- Animated pulse
│                                     │
└─────────────────────────────────────┘
```

No text, icons, or other decorations—just a clean placeholder shape.

### Comparison with Related Commands

| Command | Animation | Reserves Space | Replaceable | Delay | Has Label |
|---------|-----------|----------------|-------------|-------|-----------|
| `st.empty()` | No | No | Yes | — | No |
| `st.spinner()` | Yes | No | No | 0.5s | Yes |
| `st.skeleton()` standalone | Yes | Yes | Yes | None | No |
| `st.skeleton()` context mgr | Yes | No¹ | No | 0.5s | No |

¹ Like `st.spinner()`, context-manager mode does not reserve space during the 0.5s delay
(and shows nothing at all for blocks that finish within it). Use standalone mode to reserve
layout space immediately.

## Alternatives Considered

> **Open decision:** the return-type and dual-mode choices below need maintainer sign-off
> before implementation begins. The options are documented here per "Present Options, Not
> Edicts"; the final selection is intentionally deferred to review.

**Return type — `SkeletonPlaceholder` wrapper vs. plain `DeltaGenerator`:**

`st.empty()` returns a plain `DeltaGenerator`. We propose a thin `SkeletonPlaceholder`
wrapper instead because the context-manager mode needs custom `__enter__`/`__exit__`
semantics (transient display + auto-clear) that a plain `DeltaGenerator` does not provide.
The wrapper delegates `st.*` methods to the underlying `DeltaGenerator`, so
`placeholder.dataframe(...)`, type narrowing, and IDE autocompletion behave like
`st.empty()`.

- **Option A (proposed): `SkeletonPlaceholder` wrapper** — supports both standalone
  replacement and the transient `with` block from a single return value. Cost: one new
  public type plus method delegation.
- **Option B: plain `DeltaGenerator`** — matches `st.empty()` exactly, but cannot carry the
  transient context-manager behavior.
- **Option C: two commands** (e.g., a placeholder command plus a separate context manager) —
  unambiguous, but adds API surface and splits a single concept.

**Dual-mode in one command vs. splitting it:**

Supporting both an immediate standalone placeholder and a 0.5s-delayed context manager from a
single `st.skeleton()` call is the most novel part of this API. Because the call fully
evaluates before a `with` statement begins, the proposed mechanism is: show the skeleton
immediately, and if it is then used as a context manager, `__enter__` clears that initial
skeleton and re-shows it as a transient element with the 0.5s delay. Simpler alternatives —
dropping the 0.5s delay in `with` mode, adding an explicit `delay` parameter, or splitting
into two commands — are viable and should be weighed during review.

**`height` positional vs. keyword-only:**

`height` is the only positional argument because it is the most-tuned per-instance value
(each skeleton typically reserves a different amount of space), so `st.skeleton(200)` reads
naturally. The alternative is making it keyword-only like `st.empty()` (which takes no
positional arguments); once shipped as positional, this slot can never change.

**`width` default of `"stretch"` vs. `"content"`:**

`st.spinner()` defaults `width="content"`, but a skeleton has no intrinsic content size, so
it defaults to `"stretch"` and does not accept `"content"`. This is an intentional,
documented deviation from the "Same Name, Same Behavior" principle.

## Out of Scope (Future Work)

The following features are intentionally excluded from the initial implementation:

**Shape variants:**

Future iterations could support different shapes:

```python
st.skeleton(height=100, shape="circle")  # For avatars
st.skeleton(height=20, shape="text")     # For text lines
```

The initial implementation uses only the rectangular shape.

**Multiple skeleton lines:**

For representing text content, a future `lines` parameter could render multiple
skeleton bars:

```python
st.skeleton(lines=3)  # Three text-like skeleton lines
```

**Pulse animation customization:**

Allow users to customize or disable the animation:

```python
st.skeleton(height=100, animation="none")  # Static skeleton
st.skeleton(height=100, animation="shimmer")  # Shimmer instead of pulse
```

**Theming:**

Allow skeleton color customization via theme configuration.

**Label/text overlay:**

Optional text overlay on skeleton (e.g., "Loading chart...").

**Callback/auto-replace pattern:**

The original feature request proposed callbacks that auto-execute:

```python
st.skeleton(height=100, callback=load_data)
```

This adds complexity and can be achieved with the context manager pattern.

**Integration with `st.cache_data`:**

Automatic skeleton display during cache misses could be a future enhancement:

```python
@st.cache_data(show_skeleton=True)
def load_data():
    ...
```

## Checklist

| Item                       | ✅ or comment                                                        |
| -------------------------- | -------------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ✅ Yes - pure frontend animation, no server dependencies            |
| No breaking API changes    | ✅ Yes - new command, additive change                               |
| No new dependencies        | ✅ Yes - uses existing Skeleton component and proto                 |
| Metrics collected          | ✅ Yes - new `skeleton` metric; `_skeleton` kept separate for internal callers |
| Any security/legal impact? | ✅ No                                                               |
| Any docs changes needed?   | ✅ Yes - add to API reference and loading patterns guide            |
