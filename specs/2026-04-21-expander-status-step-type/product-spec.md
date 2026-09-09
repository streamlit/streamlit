---
author: lukasmasuch
created: 2026-04-21
---

# `type="step"` for `st.expander` and `st.status`

## Summary

Extend `st.expander` and `st.status` with a new `type="step"` parameter that renders them
in a timeline-style layout with an icon column and vertical connector line. This enables
chain-of-thought visualization, multi-stage pipelines, and activity feeds by composing
existing primitives rather than introducing a new container.

## Problem

Users building AI applications need to display reasoning steps, tool calls, or multi-stage
pipelines in a visually organized timeline. Currently, there's no native Streamlit element
for this common UI pattern—users resort to workarounds like nested expanders, markdown with
manual formatting, or custom components.

**User requests:**

- [#13248](https://github.com/streamlit/streamlit/issues/13248) — Add a container element to
  render progress steps / timeline / chain-of-thought

**Related:**

- [#13246](https://github.com/streamlit/streamlit/issues/13246) — Compact style for
  expander/status. This proposal uses the same `type` parameter pattern, allowing future
  values like `type="compact"` to coexist with `type="step"`.

**Use cases:**

- **AI chain-of-thought**: Display LLM reasoning steps with expandable details
- **Multi-agent workflows**: Show which agent is active and what each has accomplished
- **Data pipelines**: Visualize ETL stages with status indicators
- **Activity feeds**: Display chronological events

**Current workarounds:**

- Nested `st.expander` elements (no visual timeline, cluttered)
- `st.status` repeated multiple times (no visual connection between steps)
- Custom HTML/CSS via `st.markdown` (fragile, no interactivity)
- Third-party components (additional dependencies, maintenance burden)
- [Streamlit Extras: Steps](https://extras.streamlit.app/?extra=%F0%9F%AA%9C+Steps) (community package)

**Inspiration from other libraries:**

| Library | Component | Pattern |
|---------|-----------|---------|
| [Vercel AI SDK](https://elements.ai-sdk.dev/components/chain-of-thought) | ChainOfThought | Collapsible steps with status, icons |
| [Elastic UI](https://eui.elastic.co/docs/components/display/timeline/) | Timeline | Vertical timeline with icons and content |
| [Chakra UI](https://chakra-ui.com/docs/components/timeline) | Timeline | Steps with connector lines |
| [BaseWeb](https://baseweb.design/components/progress-steps/) | ProgressSteps | Sequential steps with active state |

**Why extend existing commands?**

Following API design principle #18 ("Extend Before Inventing"):

> Prefer adding parameters to existing commands over creating new ones. Extension
> preserves user mental models.

Both `st.expander` and `st.status` are collapsible containers with labels, icons, and
expand/collapse behavior. A step is fundamentally the same concept with different visual
styling. By adding `type="step"`, users can:

1. **Compose timelines incrementally**: No need to learn a new container primitive
2. **Leverage existing features**: `st.expander`'s `key`, `on_change`, and `st.status`'s
   `.update()` method work unchanged
3. **Mix and match**: Combine step-style and default-style containers in the same app

## Proposal

### API

Add a `type` parameter to `st.expander` and `st.status`:

```python
# st.expander with type="step"
with st.expander(
    ...,
    type: Literal["default", "step"] = "default",  # NEW
) -> ExpanderContainer: ...

# st.status with type="step"
with st.status(
    ...,
    type: Literal["default", "step"] = "default",  # NEW
) -> StatusContainer: ...
```

### Parameter

| Parameter | Type                         | Default     | Description |
|-----------|------------------------------|-------------|-------------|
| `type`    | `Literal["default", "step"]` | `"default"` | Display style. `"default"` is the standard bordered expander. `"step"` renders a timeline-style step with icon column and connector line. |

### Alternative Names Considered

| Name | Pros | Cons |
|------|------|------|
| `type="step"` | Describes the visual pattern; aligns with "progress steps" terminology | Could be confused with wizard/navigation steps |
| `type="timeline"` | Intuitive for activity feeds | Less specific; timelines can have many styles |
| `type="activity"` | Good for activity feed use case | Too narrow; doesn't fit chain-of-thought |
| `type="minimal"` | Describes reduced visual chrome | Doesn't convey the timeline/connector structure |

**Recommendation:** Use `type="step"` as it's broadly applicable and consistent with
terminology in other UI libraries (BaseWeb's "ProgressSteps", etc.).

### Behavior

**Visual design (`type="step"`):**

Steps are displayed with a timeline-style layout featuring an icon column on the left,
a vertical connector line, and content indented to the right:

```
+------------------------------------------+
|  [check]  Step 1 label                   |  <- Icon + label
|  |   +------------------------+          |
|  |   | Step 1 content         |          |  <- Collapsed/expanded content
|  |   +------------------------+          |
|  |                                       |  <- Connector line
|  [spin]  Step 2 label                    |  <- Spinner for running state
|  |                                       |
|  |                                       |
|  [o]  Step 3 label                       |  <- Neutral icon (no state)
|                                          |  <- No connector (empty step)
+------------------------------------------+
```

**State-to-icon mapping and precedence (default state):**

When determining which icon to display in the default (non-hover/non-focus) state, the
following precedence applies (highest first). Note: hover/focus behavior overrides this
precedence to show the chevron affordance—see "Hover behavior" below.

| Condition | Icon | Visual Style | Notes |
|-----------|------|--------------|-------|
| `icon` parameter set explicitly | User-specified icon | Normal | User icon always takes precedence |
| `state="running"` (`st.status` only) | Animated spinner | Faded appearance | |
| `state="complete"` (`st.status` only) | `:material/check_circle:` | Faded appearance | Faded to emphasize active/upcoming steps |
| `state="error"` (`st.status` only) | `:material/error:` | Error/destructive color | |
| No icon, no state (`st.expander`) | `:material/circle:` | Faded appearance | Neutral placeholder |

**Hover behavior:**

When the step has collapsible content and the user hovers, a chevron icon appears
(replacing the state icon) to indicate expand/collapse affordance. This replacement
applies even when a user-specified icon is set—the chevron signals interactivity
regardless of the icon source. Keyboard focus also reveals the chevron affordance.

**Connector line:**

The vertical connector line extends from below the icon to the bottom of the step's
content area.

- **Empty steps**: Steps with no content do not render a connector line, providing a
  natural visual termination for the last step in a sequence.
- **Empty step between content-bearing steps**: When an empty step appears between two
  steps that have content (e.g., Step 1 with content -> Step 2 empty -> Step 3 with
  content), the timeline visually breaks into two disconnected segments. The connector
  from Step 1 terminates at its boundary, and Step 3 starts fresh without an incoming
  connector. This is consistent with the "empty steps hide connector" rule—the empty
  Step 2 acts as a visual break point.
- **Non-step elements between steps**: If a non-step element (e.g., `st.write()` or a
  default-type expander) is placed between two `type="step"` containers, the connector
  line from the previous step terminates at that step's content boundary. The next step
  starts fresh without a connector to the previous. This is by design—adjacent steps
  form a visual timeline, but interspersed elements break the chain.

**Collapsibility:**

- Step-style containers with content are collapsible by clicking the step header
- Collapsed steps still show their icon and label
- Steps without content are not collapsible (no chevron icon, no button role)

**Accessibility:**

- Collapsible step headers have `role="button"` and respond to `Enter`/`Space` keypresses
- The header exposes `aria-expanded` to indicate expand/collapse state
- Focus styles follow the standard Streamlit focus ring pattern
- **Screen reader state communication**: The step's current state (running, complete,
  error) is conveyed via an `aria-label` that combines the label and state, e.g.,
  "Loading data — running" or "Data loaded — complete". This ensures non-sighted users
  receive the same state information communicated visually through icons.

### Examples

**Basic chain of thought with step-style expanders:**

```python
import streamlit as st

with st.expander(
    "Understanding your question",
    type="step",
    icon=":material/check_circle:",
    expanded=False,
):
    st.write("Parsed: 'What is the weather in NYC?'")

with st.expander(
    "Searching for information",
    type="step",
    icon=":material/check_circle:",
    expanded=False,
):
    st.json({"sources": ["weather.gov", "accuweather.com"]})

with st.expander(
    "Generating response",
    type="step",
    icon=":material/progress_activity:",
):
    st.write("The weather in NYC is...")
```

**Step-style status with auto-transitions:**

```python
import streamlit as st

with st.status("Loading data", type="step", state="running") as step1:
    data = fetch_data()
    st.write(f"Loaded {len(data)} records")
# Auto-transitions to "complete" on exit

with st.status("Processing", type="step", state="running") as step2:
    result = process(data)
    if result.has_errors:
        step2.update(state="error")
    else:
        st.write("Processing complete")
```

**Mixing step-style and default expanders:**

```python
import streamlit as st

st.header("Analysis Results")

# Use step-style for the pipeline
with st.status("Data loaded", type="step", state="complete"):
    st.metric("Records", 1234)

with st.status("Analysis complete", type="step", state="complete"):
    st.metric("Score", 0.95)

# Use default expander for supplementary details
with st.expander("View raw data"):  # type="default" (standard look)
    st.dataframe(data)
```

**Scrollable timeline:**

```python
import streamlit as st

# Wrap in st.container for fixed height with scrolling
with st.container(height=400):
    for event in stream_agent_events():
        with st.status(event.action, type="step", state="complete"):
            st.write(event.details)
```

## Alternative API: Standalone `st.steps` Container

An alternative approach would introduce a new `st.steps` container that explicitly groups
steps together. See [#14816](https://github.com/streamlit/streamlit/pull/14816) for the full spec.

```python
# Alternative: Dedicated st.steps container
with st.steps() as steps:
    with steps.step("Step 1", state="complete"):
        st.write("Content 1")
    with steps.step("Step 2", state="running"):
        st.write("Content 2")
```

**Trade-offs:**

| Aspect | `type="step"` (this proposal) | `st.steps` (alternative) |
|--------|-------------------------------|--------------------------|
| Learning curve | Extends familiar commands | New container API to learn |
| Connector line control | Empty steps hide connector | Container auto-hides last connector |
| Grouping | Implicit—adjacent steps form timeline | Explicit `with st.steps():` |
| API surface | No new methods | New `.step()` method |
| Implementation | Extends existing protos/components | New proto messages, new components |
| Flexibility | Mix step-style with other elements | Steps must be inside container |

**When to prefer `st.steps` alternative:**

- When explicit grouping semantics matter (e.g., "these 5 steps are one logical unit")
- When the timeline needs container-level features (height, title, etc.)

**When to prefer `type="step"` (this proposal):**

- When composing steps with other elements in the same flow
- When leveraging existing `st.expander`/`st.status` features (`key`, `on_change`, `.update()`)
- When minimizing API surface area
- When migrating existing `st.status` usage to step styling

## Out of Scope (Future Work)

| Feature | Reason |
|---------|--------|
| `description` parameter | Subtitle text below the label; can add later based on demand |
| `type="compact"` | Related to [#13246](https://github.com/streamlit/streamlit/issues/13246); separate proposal |
| Horizontal timeline layout | Validate vertical design first |
| Step numbering | Can be added to label via markdown |
| Standalone `st.steps` container | Could be added later if user feedback demands explicit grouping; see [#14816](https://github.com/streamlit/streamlit/pull/14816) for spec |

## Checklist

| Item                       | ✅ or comment |
|----------------------------|---------------|
| Works on SiS, Cloud, etc?  | ✅ Uses existing expander/status infrastructure |
| No breaking API changes    | ✅ New optional parameters only |
| No new dependencies        | ✅ Reuses existing styled components |
| Metrics collected          | ✅ Existing `@gather_metrics` on expander/status |
| Any security/legal impact? | ✅ None identified |
| Any docs changes needed?   | ✅ Update expander/status docs with type parameter |
