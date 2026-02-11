---
author: lukasmasuch
created: 2026-02-07
status: Draft
---

# Timeline container for progress steps / chain of thought

## Summary

Add a new `st.steps` container element that displays a vertical timeline of steps, each with
an icon, label, and optional content. This addresses the common UI pattern of showing
sequential progress, AI reasoning chains, or activity feeds. Steps can be added dynamically
and support state transitions (running → complete/error), making it ideal for streaming
scenarios like LLM chain-of-thought visualization.

## Problem

Users building AI applications frequently need to display reasoning steps, tool calls, or
multi-stage processing pipelines in a visually organized way. Currently, there's no native
Streamlit element for this common UI pattern—users resort to workarounds like nested
expanders, markdown with manual formatting, or custom components.

**User request:**

- [#13248](https://github.com/streamlit/streamlit/issues/13248) — Add a container element to
  render progress steps / timeline / chain of thought

**Use cases:**

- **AI chain of thought**: Display LLM reasoning steps with expandable details
- **Multi-agent workflows**: Show which agent is active and what each has accomplished
- **Data pipelines**: Visualize ETL stages with status indicators
- **Activity feeds**: Display chronological events with timestamps
- **Onboarding flows**: Guide users through multi-step processes

**Current workarounds:**

- Nested `st.expander` elements (no visual timeline, cluttered)
- `st.status` repeated multiple times (no visual connection between steps)
- Custom HTML/CSS via `st.markdown` (fragile, no interactivity)
- Third-party components (additional dependencies, maintenance burden)

**Inspiration from other libraries:**

| Library | Component | Pattern |
|---------|-----------|---------|
| [Vercel AI SDK](https://elements.ai-sdk.dev/components/chain-of-thought) | ChainOfThought | Collapsible steps with status, icons, search results |
| [Elastic UI](https://eui.elastic.co/docs/components/display/timeline/) | Timeline | Vertical timeline with icons and content |
| [Chakra UI](https://chakra-ui.com/docs/components/timeline) | Timeline | Steps with connector lines |
| [BaseWeb](https://baseweb.design/components/progress-steps/) | ProgressSteps | Sequential steps with active state |

## Proposal

### API

```python
# Create a steps container
steps = st.steps(
    label: str | None = None,
    *,
    expanded: bool = True,
    height: int | None = None,
)

# Add individual steps
step = steps.step(
    label: str,
    *,
    description: str | None = None,
    icon: str | None = None,
    state: Literal["running", "complete", "error"] | None = None,
)

# Use step as context manager to add content
with step:
    st.write("Step content here")

# Update step state after creation
step.update(
    *,
    label: str | None = None,
    description: str | None = None,
    icon: str | None = None,
    state: Literal["running", "complete", "error"] | None = None,
    expanded: bool | None = None,
)
```

> **Alternative names considered:** `st.timeline`, `st.progress_steps`, `st.chain_of_thought`,
> `st.activity_feed`. We chose `st.steps` for its simplicity and broad applicability—it
> describes the visual pattern without being tied to a specific use case.

### Parameters

#### `st.steps()` — Container

| Parameter  | Type             | Default | Description |
|------------|------------------|---------|-------------|
| `label`    | `str \| None`    | `None`  | Optional label displayed above the steps container. Supports markdown. |
| `expanded` | `bool`           | `True`  | Whether the container is initially expanded. When `False`, only the label is visible. |
| `height`   | `int \| None`    | `None`  | Fixed height in pixels. If set, container becomes scrollable with auto-scroll to bottom. |

#### `steps.step()` — Individual Step

| Parameter     | Type                                              | Default  | Description |
|---------------|---------------------------------------------------|----------|-------------|
| `label`       | `str`                                             | required | Step label. Supports markdown. |
| `description` | `str \| None`                                     | `None`   | Optional subtitle shown below the label. Supports markdown. |
| `icon`        | `str \| None`                                     | `None`   | Icon to display. Accepts emoji, Material icon (`:material/name:`), or `"spinner"`. If `None`, icon is derived from `state`. |
| `state`       | `Literal["running", "complete", "error"] \| None` | `None`   | Step state. Affects default icon and visual styling. If `None`, no state styling is applied. |

#### `step.update()` — Modify Step After Creation

All parameters are keyword-only and optional. Only specified parameters are updated.

| Parameter     | Type                                              | Description |
|---------------|---------------------------------------------------|-------------|
| `label`       | `str \| None`                                     | Update the step label. |
| `description` | `str \| None`                                     | Update the description. |
| `icon`        | `str \| None`                                     | Update the icon. |
| `state`       | `Literal["running", "complete", "error"] \| None` | Update the state. |
| `expanded`    | `bool \| None`                                    | Expand or collapse the step's content. |

### Return Types

- `st.steps()` returns `StepsContainer`, a `DeltaGenerator` subclass with the `.step()` method
- `steps.step()` returns `StepContainer`, a `DeltaGenerator` subclass with the `.update()` method
- Both can be used as context managers and support adding child elements

### Behavior

**Visual design:**

- Steps are displayed vertically with a connecting timeline line on the left
- Each step shows an icon (or state indicator), label, and optional description
- Step content appears indented below the step header
- Active/running steps are visually highlighted

**State-to-icon mapping (when `icon=None`):**

| State       | Default Icon              | Visual Style |
|-------------|---------------------------|--------------|
| `"running"` | Animated spinner          | Highlighted, active appearance |
| `"complete"`| `:material/check_circle:` | Muted, success color |
| `"error"`   | `:material/error:`        | Error color |
| `None`      | `:material/circle:`       | Neutral, default appearance |

**Context manager behavior:**

When using `steps.step()` as a context manager with `state="running"`:

```python
with steps.step("Processing", state="running") as step:
    result = expensive_operation()
    st.write(result)
# On normal exit: state auto-transitions to "complete"
# On exception: state auto-transitions to "error"
```

This follows the same pattern established by `st.status`.

**Auto-scroll behavior:**

When `height` is set, the container automatically scrolls to show the latest step,
similar to `st.container(height=..., autoscroll=True)`. This is essential for streaming
scenarios where new steps are added dynamically.

**Collapsibility:**

- The entire `st.steps` container can be collapsed when `expanded=False`
- Individual steps can have their content collapsed via `step.update(expanded=False)`
- Collapsed steps still show their icon, label, and state indicator

### Examples

**Basic AI chain of thought:**

```python
import streamlit as st

with st.steps("Thinking...") as thinking:
    with thinking.step("Understanding your question", state="complete"):
        st.write("Parsed query: 'What is the weather in NYC?'")

    with thinking.step("Searching for information", state="complete"):
        st.write("Found 3 relevant sources")
        st.json({"sources": ["weather.gov", "accuweather.com", "weather.com"]})

    with thinking.step("Generating response", state="running"):
        st.write_stream(generate_response())
```

**Multi-step data pipeline:**

```python
import streamlit as st

steps = st.steps("Data Pipeline")

with steps.step("Loading data", icon=":material/download:") as load_step:
    data = load_dataset()
    st.write(f"Loaded {len(data)} rows")
    load_step.update(state="complete")

with steps.step("Validating", icon=":material/check:") as validate_step:
    errors = validate(data)
    if errors:
        st.error(f"Found {len(errors)} validation errors")
        validate_step.update(state="error")
    else:
        st.success("All records valid")
        validate_step.update(state="complete")

with steps.step("Processing", icon=":material/settings:") as process_step:
    for i, batch in enumerate(batches):
        process_step.update(description=f"Batch {i+1}/{len(batches)}")
        process_batch(batch)
    process_step.update(state="complete")
```

**Streaming with auto-scroll:**

```python
import streamlit as st

# Fixed height container with auto-scroll
with st.steps("Agent Activity", height=400) as activity:
    for event in stream_agent_events():
        with activity.step(event.action, icon=event.icon, state="complete"):
            st.write(event.details)
```

**Activity feed with timestamps:**

```python
import streamlit as st
from datetime import datetime

with st.steps("Recent Activity") as feed:
    for event in get_events():
        timestamp = event.time.strftime("%H:%M")
        with feed.step(event.title, description=timestamp):
            st.write(event.description)
```

**Collapsible reasoning (chain of thought):**

```python
import streamlit as st

# Start collapsed, user can expand to see reasoning
with st.steps("Show reasoning", expanded=False) as cot:
    with cot.step("Step 1: Parse input", state="complete"):
        st.code("tokens = tokenize(input)")

    with cot.step("Step 2: Retrieve context", state="complete"):
        st.write("Retrieved 5 relevant documents")

    with cot.step("Step 3: Generate", state="complete"):
        st.write("Generated response using retrieved context")
```

### Edge Cases

- **Empty container**: Shows only the label (if provided) with no steps
- **No content in step**: Step displays with just icon and label, no indented content
- **Nested steps containers**: Allowed; each manages its own timeline independently
- **Rapid step additions**: Updates are debounced to prevent UI jank (similar to `st.status`)
- **Long labels/descriptions**: Truncated with ellipsis; full text shown on hover
- **Steps inside fragments**: Works correctly; step state persists across fragment reruns

### Visual Design

```
┌─────────────────────────────────────────┐
│ ▾ Thinking...                           │  ← Container label (collapsible)
├─────────────────────────────────────────┤
│  ✓  Understanding your question         │  ← Complete step (icon + label)
│  │   Parsed query: "weather in NYC"     │  ← Step content (indented)
│  │                                      │
│  ✓  Searching for information           │  ← Complete step
│  │   Found 3 relevant sources           │
│  │   ┌─────────────────────┐            │
│  │   │ { "sources": [...] }│            │  ← Rich content (JSON, images, etc.)
│  │   └─────────────────────┘            │
│  │                                      │
│  ◐  Generating response                 │  ← Running step (animated spinner)
│  │   The weather in NYC is...           │  ← Streaming content
│     ▌                                   │
└─────────────────────────────────────────┘
```

The vertical line connects steps visually, similar to GitHub's activity timeline or
Slack's thread indicator.

---

## Alternatives Considered

<details>
<summary>Extend st.status to support multiple steps</summary>

**Approach:** Add a `steps` parameter to `st.status` to display multiple sub-steps.

```python
with st.status("Processing", steps=["Load", "Validate", "Save"]) as status:
    status.update_step(0, state="complete")
    status.update_step(1, state="running")
```

**Pros:**
- ✅ No new top-level command
- ✅ Reuses existing infrastructure

**Cons:**
- ❌ Conflates two different UI patterns (single status vs. multi-step timeline)
- ❌ API becomes complex with step indexing
- ❌ Doesn't support content within steps naturally

**Why not selected:** The timeline pattern is distinct enough to warrant its own element.
`st.status` is for a single operation's status; `st.steps` is for visualizing a sequence.

</details>

<details>
<summary>Use st.expander for each step</summary>

**Approach:** Document a pattern using multiple `st.expander` elements.

```python
with st.expander("Step 1: Loading", expanded=True):
    st.write("Loading data...")
with st.expander("Step 2: Processing", expanded=True):
    st.write("Processing...")
```

**Pros:**
- ✅ No new API needed
- ✅ Already available

**Cons:**
- ❌ No visual timeline connection between steps
- ❌ No state indicators (running/complete/error)
- ❌ Cluttered appearance with multiple expander borders
- ❌ No auto-scroll for streaming scenarios

**Why not selected:** Expanders are designed for single collapsible sections, not
connected sequences. The timeline pattern requires visual continuity.

</details>

<details>
<summary>Separate st.timeline and st.step commands</summary>

**Approach:** Use two separate commands where `st.step` is a standalone element.

```python
with st.timeline():
    st.step("Step 1", state="complete")
    st.step("Step 2", state="running")
```

**Pros:**
- ✅ Simpler individual step API
- ✅ Steps could potentially be used outside timelines

**Cons:**
- ❌ `st.step` would need implicit context detection (inside timeline or not)
- ❌ Harder to return step objects for updates
- ❌ Less explicit about the parent-child relationship

**Why not selected:** The `container.step()` pattern makes the hierarchy explicit and
enables returning step objects for later updates, following `st.tabs` conventions.

</details>

<details>
<summary>Function/callback approach</summary>

**Approach:** Pass functions that execute for each step.

```python
def step1():
    st.write("Step 1 content")

def step2():
    st.write("Step 2 content")

st.steps([
    ("Loading", step1),
    ("Processing", step2),
])
```

**Pros:**
- ✅ Potentially enables lazy execution
- ✅ Clear separation of step definitions

**Cons:**
- ❌ Not incrementally adoptable (requires refactoring to functions)
- ❌ Less intuitive for simple cases
- ❌ Harder to handle streaming/dynamic content

**Why not selected:** Context managers are more Pythonic and align with existing Streamlit
patterns (`st.status`, `st.expander`, `st.container`).

</details>

---

## Implementation Notes

**Backend:**

- Create `StepsContainer` and `StepContainer` as `DeltaGenerator` subclasses
- Follow `StatusContainer` pattern for mutable updates via `.update()`
- Use `__enter__`/`__exit__` for context manager behavior with auto-state transitions
- Add small delay between rapid updates to prevent race conditions (as in `st.status`)

**Protobuf:**

- New `Steps` message containing repeated `Step` messages
- Each `Step` has: `id`, `label`, `description`, `icon`, `state`, `expanded`
- Content elements are children of the step block (existing pattern)

**Frontend:**

- New React component with vertical timeline styling
- Reuse existing icon rendering (`StyledIcon`) and spinner components
- CSS-based timeline connector line with proper spacing
- Smooth expand/collapse animations (consistent with `st.expander`)

---

## Future Considerations

**Horizontal timeline variant:** A `direction="horizontal"` parameter for wizard-style
progress indicators. This would be a separate enhancement after validating the vertical
design.

**Step navigation:** Allow clicking on steps to jump to that point in the app (similar to
anchor links). Requires careful consideration of rerun semantics.

**Nested steps:** Support for sub-steps within steps (e.g., "Step 2.1", "Step 2.2").
Adds complexity; defer until user demand is validated.

**Customizable connector:** Allow customizing the timeline line style (solid, dashed,
colored by state). Nice-to-have for advanced theming.

---

## Checklist

| Item                       | ✅ or comment |
|----------------------------|---------------|
| Works on SiS, Cloud, etc?  | ✅ Uses standard session state and widget patterns |
| No breaking API changes    | ✅ New element, no changes to existing APIs |
| No new dependencies        | ✅ Uses existing frontend libraries (React, Emotion) |
| Metrics collected          | ✅ `@gather_metrics("steps")` and `@gather_metrics("step")` |
| Any security/legal impact? | ✅ None identified |
| Any docs changes needed?   | ✅ New element documentation with examples |

---

## References

- **GitHub Issue:** [#13248](https://github.com/streamlit/streamlit/issues/13248)
- **Design Inspiration:**
  - [Vercel AI SDK - Chain of Thought](https://elements.ai-sdk.dev/components/chain-of-thought)
  - [Elastic UI - Timeline](https://eui.elastic.co/docs/components/display/timeline/)
  - [Chakra UI - Timeline](https://chakra-ui.com/docs/components/timeline)
  - [BaseWeb - ProgressSteps](https://baseweb.design/components/progress-steps/)
- **Related Streamlit Elements:**
  - `st.status` — Single-item mutable status container (pattern reference)
  - `st.expander` — Collapsible content (visual reference)
  - `st.container` — Auto-scroll behavior reference
