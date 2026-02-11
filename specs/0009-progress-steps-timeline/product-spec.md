---
author: lukasmasuch
created: 2026-02-07
status: Draft
---

# Add `st.progress_steps` for timeline / chain-of-thought UIs

## Summary

Add a new `st.progress_steps` container that lets apps append chronological steps with rich
content while a task is running. The API is streaming-first (similar to `st.status`), so users
can add and update steps incrementally instead of pre-declaring all steps upfront. This makes it
easy to build AI chain-of-thought style UIs, event timelines, and multi-stage task visualizations.

## Problem

Users want a native way to show step-by-step task progress (especially for AI agents) in a single,
structured container:

- [#13248](https://github.com/streamlit/streamlit/issues/13248) - Add a container element to render
  progress steps / timeline / chain of thought.

Current options are awkward:

1. Multiple `st.status` containers: each step becomes a separate expandable block, which is visually noisy
   and does not read like one timeline.
2. Plain markdown lists: no step state (`running`/`complete`/`error`) or icon/status affordances.
3. Declarative containers (like tabs): require defining all items upfront, which does not fit streaming
   and incremental tool-calling workflows.

The requested pattern is dynamic and composable:

```python
with st.progress_steps("Reasoning") as steps:
    with steps.add_step("Searching for profiles", icon=":material/search:"):
        ...
```

This mirrors modern chain-of-thought UI patterns (for example, the AI SDK Elements
`ChainOfThought` component), while keeping Streamlit's Python-first ergonomics.

## Proposal

### API

```python
st.progress_steps(
    label: str,
    *,
    expanded: bool = False,
    state: Literal["running", "complete", "error"] = "running",
    width: WidthWithoutContent = "stretch",
) -> ProgressStepsContainer
```

```python
ProgressStepsContainer.add_step(
    label: str,
    *,
    state: Literal["running", "complete", "error"] = "running",
    icon: str | None = None,
) -> ProgressStep
```

```python
ProgressStepsContainer.update(
    *,
    label: str | None = None,
    expanded: bool | None = None,
    state: Literal["running", "complete", "error"] | None = None,
) -> None
```

```python
ProgressStep.update(
    *,
    label: str | None = None,
    state: Literal["running", "complete", "error"] | None = None,
    icon: str | None = None,
) -> None
```

### Why this API shape

- Uses familiar `with ... as ...` and `.update()` patterns from `st.status`.
- Keeps the most common path short:
  - Create one container.
  - Add steps as work happens.
  - Let context managers auto-complete states.
- Keeps complexity opt-in:
  - Basic users can only use `with steps.add_step("...")`.
  - Advanced users can manage states/icons explicitly via `.update()`.
- Uses existing state vocabulary (`running`, `complete`, `error`) for consistency across Streamlit.

### Parameters

#### `st.progress_steps(...)`

| Parameter  | Type                                      | Default     | Description |
| ---------- | ----------------------------------------- | ----------- | ----------- |
| `label`    | `str`                                     | required    | Header label for the progress-steps container. Supports Streamlit markdown label syntax. |
| `expanded` | `bool`                                    | `False`     | Whether the container starts expanded. |
| `state`    | `"running" \| "complete" \| "error"`      | `"running"` | Header state/icon for the container. Same semantics as `st.status`. |
| `width`    | `"stretch" \| int`                        | `"stretch"` | Container width. Same behavior as `st.status`. |

#### `ProgressStepsContainer.add_step(...)`

| Parameter | Type                                      | Default     | Description |
| --------- | ----------------------------------------- | ----------- | ----------- |
| `label`   | `str`                                     | required    | Step title text. Supports Streamlit markdown label syntax. |
| `state`   | `"running" \| "complete" \| "error"`      | `"running"` | Step state. |
| `icon`    | `str \| None`                             | `None`      | Optional custom icon (emoji or `:material/...:`). If omitted, state-based icon is used. |

### Behavior

#### Container behavior

- Renders as a single collapsible container with a header label and state icon.
- Steps are displayed in insertion order from top to bottom.
- Content inside collapsed containers is still computed and sent to frontend (same behavior as `st.status`).
- `ProgressStepsContainer` supports `with` notation and behaves like `st.status`:
  - If context exits without exception and current container state is `running`, auto-update to `complete`.
  - If context exits with exception and current container state is `running`, auto-update to `error`.

#### Step behavior

- Each step renders:
  - an icon (custom icon or state-based fallback),
  - a label,
  - optional child content written inside that step container.
- `ProgressStep` is a container (`DeltaGenerator` subtype), so any Streamlit element can be placed inside it:
  text, markdown, charts, images, tables, code, etc.
- `ProgressStep` also supports `with` notation:
  - If context exits without exception and step state is `running`, auto-update to `complete`.
  - If context exits with exception and step state is `running`, auto-update to `error`.

#### State and icon mapping

- `running`: spinner icon
- `complete`: check icon
- `error`: error icon
- If a custom `icon` is provided, it overrides the state icon for that step.

#### Validation

- `label` is required for container and step creation.
- Invalid `state` values raise `StreamlitAPIException`.
- Invalid `icon` values follow existing icon validation behavior (`validate_icon_or_emoji`).
- `width` validation is identical to `st.status` (`"stretch"` or positive `int` only).

### Examples

#### Basic streaming usage

```python
import time
import streamlit as st

with st.progress_steps("Profile lookup", expanded=True) as steps:
    with steps.add_step("Searching for public profiles", icon=":material/search:"):
        st.write("Checking X, GitHub, and LinkedIn...")
        time.sleep(1.0)

    with steps.add_step("Fetching profile image", icon=":material/image:"):
        st.image("https://picsum.photos/320/200")
        time.sleep(0.5)

    with steps.add_step("Summarizing findings"):
        st.markdown("Found role, location, and recent activity.")
```

#### Manual state updates

```python
import streamlit as st

steps = st.progress_steps("Data pipeline", expanded=True)

extract = steps.add_step("Extracting data")
extract.write("Reading source tables...")
extract.update(state="complete", icon=":material/download_done:")

transform = steps.add_step("Transforming data")
transform.write("Applying normalization rules...")
transform.update(state="error")

steps.update(state="error", label="Pipeline failed")
```

### Out of scope for initial implementation

- Interactive step navigation / wizard behavior (tracked separately in
  [#10748](https://github.com/streamlit/streamlit/issues/10748)).
- Horizontal step layouts.
- Per-step collapse/expand controls.
- Step reordering/removal APIs.
- Specialized subcomponents (e.g., dedicated search-result badges); users compose with normal Streamlit elements.

### Implementation notes

- Add dedicated block types in protobuf for:
  - progress-steps container metadata (label/expanded/state)
  - step metadata (label/state/icon)
- Do not overload `Block.Expandable` for steps:
  - avoids collisions with existing status/expander assumptions in frontend and AppTest.
- Backend:
  - Add new `LayoutsMixin.progress_steps(...)`.
  - Add mutable container/step classes similar to `StatusContainer` with delta-path-based `.update()`.
- Frontend:
  - Add a `ProgressSteps` renderer and a `ProgressStep` renderer in `Block.tsx`.
  - Reuse existing icon utilities and markdown label rendering.
  - Render a vertical timeline visual treatment (connector line + step rows).
- Testing:
  - Python unit tests for API validation, context manager auto-state transitions, and update semantics.
  - Frontend tests for rendering, state icon behavior, collapse behavior, and step order.
  - AppTest support for querying `progress_steps` and `progress_step` nodes.

### Alternatives considered

#### 1) Extend `st.status` with `.add_step(...)`

Rejected for now:

- Blurs the distinction between single-status containers and timeline containers.
- Adds complexity to an existing command that should stay simple.
- Makes discoverability weaker for users looking specifically for timeline/steps UI.

#### 2) Add `st.chain_of_thought`

Rejected:

- Too AI-specific for a general-purpose timeline/progress UI.
- Implies model reasoning exposure semantics rather than user-authored step logs.

#### 3) Declarative `st.progress_steps([...])` only

Rejected:

- Does not support incremental streaming workflows, which are the core use case.

## Checklist

| Item                       | ✅ or comment |
| -------------------------- | ------------- |
| Works on SiS, Cloud, etc?  | ✅ Pure Streamlit UI container, no platform-specific behavior expected |
| No breaking API changes    | ✅ Additive API |
| No new dependencies        | ✅ Reuse existing frontend/backend infrastructure |
| Metrics collected          | ✅ Track command usage and step counts/updates |
| Any security/legal impact? | ✅ No new external integrations; user controls content |
| Any docs changes needed?   | ✅ New API reference page + examples in status/chat patterns |
| Any other risks?           | Potential performance impact for very large step histories; monitor and document best practices |
