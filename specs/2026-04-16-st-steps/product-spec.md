---
author: lukasmasuch
created: 2026-04-16
status: Draft
---

# Timeline container for progress steps / chain of thought

## Summary

Add a new `st.steps` container that displays a vertical timeline of steps, each with an icon,
label, and optional content. Steps can be added dynamically and support state transitions
(running → complete/error), making it ideal for AI chain-of-thought visualization, multi-stage
pipelines, and activity feeds.

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
- **Activity feeds**: Display chronological events

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
steps = st.steps()

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

> **Alternative names considered:** `st.timeline`, `st.progress_steps`, `st.status_steps`,
> `st.chain_of_thought`, `st.activity_feed`. We chose `st.steps` for its simplicity and broad
> applicability—it describes the visual pattern without being tied to a specific use case.

### Parameters

#### `steps.step()` — Individual Step

| Parameter     | Type                                              | Default  | Description |
|---------------|---------------------------------------------------|----------|-------------|
| `label`       | `str`                                             | required | Step label. Supports markdown (bold, italics, links, inline code, emoji, and Material icons via `:material/icon_name:`). |
| `description` | `str \| None`                                     | `None`   | Optional subtitle shown below the label. Supports the same markdown syntax as `label`. |
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

Steps are displayed vertically with a connecting timeline line on the left. Each step shows an
icon (or state indicator), label, and optional description. Step content appears indented below
the step header. Active/running steps show a spinner icon.

```
┌─────────────────────────────────────────┐
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

The vertical line connects steps visually, similar to GitHub's activity timeline.

**State-to-icon mapping (when `icon=None`):**

| State       | Default Icon              | Visual Style |
|-------------|---------------------------|--------------|
| `"running"` | Animated spinner          | Primary color |
| `"complete"`| `:material/check_circle:` | Faded appearance |
| `"error"`   | `:material/error:`        | Faded appearance |
| `None`      | `:material/circle:`       | Faded appearance |

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

**Collapsibility:**

- Individual steps with content are collapsible by clicking the step header
- Collapsed steps still show their icon, label, and description
- The `expanded` parameter in `step.update()` controls programmatic expansion
- Steps without content are not collapsible: no chevron icon on hover, no button role, and no keyboard interaction

### Examples

**Basic AI chain of thought:**

```python
import streamlit as st

with st.steps() as thinking:
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

with st.steps() as pipeline:
    with pipeline.step("Loading data", icon=":material/download:", state="running") as load_step:
        data = load_dataset()
        st.write(f"Loaded {len(data)} rows")

    with pipeline.step("Validating", icon=":material/check:", state="running") as validate_step:
        errors = validate(data)
        if errors:
            st.error(f"Found {len(errors)} validation errors")
            validate_step.update(state="error")
        else:
            st.success("All records valid")

    with pipeline.step("Processing", icon=":material/settings:", state="running") as process_step:
        for i, batch in enumerate(batches):
            process_step.update(description=f"Batch {i+1}/{len(batches)}")
            process_batch(batch)
```

**Scrollable container with auto-scroll:**

```python
import streamlit as st

# Wrap in st.container for fixed height with scrolling
with st.container(height=400):
    with st.steps() as activity:
        for event in stream_agent_events():
            with activity.step(event.action, icon=event.icon, state="complete"):
                st.write(event.details)
```

**Collapsing step content:**

```python
import streamlit as st

with st.steps() as cot:
    with cot.step("Step 1: Parse input", state="complete") as step1:
        st.code("tokens = tokenize(input)")
        # Collapse this step after showing content
        step1.update(expanded=False)

    with cot.step("Step 2: Retrieve context", state="complete"):
        st.write("Retrieved 5 relevant documents")
```

### Edge Cases

- **Empty container**: Renders as an empty container with no steps
- **No content in step**: Step displays with just icon and label; not interactive (no expand/collapse UI)
- **Nested steps containers**: Allowed; each manages its own timeline independently
- **Long labels/descriptions**: Text wraps within the step content area

## Out of Scope (Future Work)

The following features are intentionally excluded from the initial implementation:

| Feature | Reason |
|---------|--------|
| Container `height` parameter | Use `st.container(height=...)` wrapper for scrollable steps |
| Container label/title | Use `st.expander` wrapper for a titled, collapsible container |
| Container `expanded` state | Use `st.expander` wrapper if container-level collapse is needed |
| Container `state` (running/complete/error) | Simplifies the API; state is per-step |
| Container `.update()` method | No mutable container properties in initial version |
| Container `width` parameter | Follow standard Streamlit container width behavior |
| Horizontal timeline layout | Validate vertical design first; add `direction` parameter based on demand |
| Step navigation / wizard behavior | Tracked separately in [#10748](https://github.com/streamlit/streamlit/issues/10748) |
| Nested sub-steps | Adds complexity; defer until user demand is validated |
| Step reordering/removal APIs | Not needed for streaming use case |

## Checklist

| Item                       | ✅ or comment |
|----------------------------|---------------|
| Works on SiS, Cloud, etc?  | ✅ Uses standard session state and widget patterns |
| No breaking API changes    | ✅ New element, no changes to existing APIs |
| No new dependencies        | ✅ Uses existing frontend libraries (React, Emotion) |
| Metrics collected          | ✅ `@gather_metrics("steps")` and `@gather_metrics("step")` |
| Any security/legal impact? | ✅ None identified |
| Any docs changes needed?   | ✅ New element documentation with examples |
