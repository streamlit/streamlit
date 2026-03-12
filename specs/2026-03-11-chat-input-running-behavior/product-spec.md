---
author: lukasmasuch
created: 2026-03-11
---

# Configurable Running-State Behavior for `st.chat_input`

## Summary

Add a `submit_mode` parameter to `st.chat_input` that controls widget behavior after submission
during script execution. This enables three modes: showing a stop button (to cancel the run),
disabling input (to prevent interruptions), or keeping input enabled (current default). This
addresses the common pain point of users interrupting LLM responses by submitting new messages
while streaming.

## Problem

When users submit a prompt in `st.chat_input`, there's no built-in way to:
1. **Prevent interruptions**: Users can submit new messages while an LLM is generating a response,
   which interrupts streaming and corrupts conversation history.
2. **Cancel generation**: Unlike ChatGPT and other AI interfaces, users cannot stop an in-progress
   LLM generation from the chat input.

**User requests:**

- [#8323](https://github.com/streamlit/streamlit/issues/8323) - Impossible to disable st.chat_input
  while writing the model's response (40+ upvotes)
- [#11854](https://github.com/streamlit/streamlit/issues/11854) - Turn submit button in
  st.chat_input into stop button (18+ upvotes)

**Use cases:**

- **Streaming AI responses**: Prevent users from sending new messages while the assistant is
  generating a response, avoiding message interleaving and broken conversation state.
- **Canceling long generations**: Allow users to stop an LLM that's generating an overly long or
  unwanted response.
- **Interactive agents**: Support agentic workflows where users may need to interrupt or redirect
  an agent's execution.

**Current behavior:**

The `disabled` parameter exists but does not help because:
1. It's evaluated at script start, before the submission is processed
2. Setting `disabled=True` after receiving input requires a rerun, but the script is already
   running
3. Workarounds using callbacks and `st.rerun()` are brittle and cause focus loss

Current workarounds from the community (all have significant drawbacks):

```python
# Workaround 1: Callback + rerun (loses focus, requires extra rerun)
def on_submit():
    st.session_state.disabled = True

if prompt := st.chat_input("Ask", on_submit=on_submit, disabled=st.session_state.disabled):
    # ... generate response ...
    st.session_state.disabled = False
    st.rerun()  # Extra rerun needed to re-enable

# Workaround 2: CSS hack (fragile, loses focus)
st.markdown("""
<style>
    .stApp[data-teststate=running] .stChatInput textarea { display: none; }
</style>
""", unsafe_allow_html=True)
```

## Proposal

### API

```python
st.chat_input(
    placeholder: str = "Your message",
    *,
    submit_mode: Literal["disabled", "stop", None] | bool = None,  # NEW
    ...,
)
```

### Parameter

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `submit_mode` | `Literal["disabled", "stop", None]` \| `bool` | `None` | Controls widget behavior after submission while the script is running. `"disabled"` disables input during the run. `"stop"` transforms the submit button into a stop button. `None` keeps input enabled (current behavior). `True` is an alias for `"disabled"`, `False` is an alias for `None`. |

### Behavior

**`submit_mode=None` or `submit_mode=False` (default):**

- Current behavior: widget remains fully enabled after submission
- Users can submit new messages while the script is running
- Preserves backward compatibility

**`submit_mode="disabled"` or `submit_mode=True`:**

- Widget is automatically disabled after the user submits a message
- The text area and all buttons (submit, file upload, voice) are disabled
- Widget re-enables when the script run completes
- Input field is cleared and focus is preserved

> **Design note:** `submit_mode=True` maps to `"disabled"` rather than `"stop"` because disabling
> is the safer, less disruptive behavior. The stop button actively terminates execution, which may
> have unintended side effects if users don't expect it.

**`submit_mode="stop"`:**

- Submit button transforms into a stop button (square icon) after submission
- Clicking the stop button sends a `stop_script` BackMsg to the server
- This is equivalent to clicking "Stop" in the app's status widget
- When clicked, `st.stop()` is effectively called, halting script execution
- Text area remains disabled during the run (same as `"disabled"`)
- Widget returns to normal state when the script run completes (whether stopped or finished)

### Visual Design

When `submit_mode="stop"` and the script is running:

```
+------------------------------------------------------------------+
| [textarea disabled, showing placeholder]           [stop button] |
+------------------------------------------------------------------+
```

- The stop button uses the same square/stop icon as the StatusWidget
- A subtle "Generating..." or spinner indicator could be shown in the placeholder area
  (implementation detail, may be deferred)

### Examples

**Basic usage - disable during generation:**

```python
import streamlit as st

if prompt := st.chat_input("Ask anything", submit_mode="disabled"):
    with st.chat_message("user"):
        st.write(prompt)
    with st.chat_message("assistant"):
        st.write_stream(generate_response(prompt))  # Chat input stays disabled
# After streaming completes, chat input re-enables automatically
```

**Stop button for interruptible generation:**

```python
import streamlit as st

if prompt := st.chat_input("Ask anything", submit_mode="stop"):
    with st.chat_message("user"):
        st.write(prompt)
    with st.chat_message("assistant"):
        # User can click stop button to interrupt this
        st.write_stream(generate_response(prompt))
```

**Explicit disabled for maximum clarity:**

```python
import streamlit as st

# Use True as shorthand for "disabled"
if prompt := st.chat_input("Chat", submit_mode=True):
    process_message(prompt)
```

### Scope and Detection

**Which `st.chat_input` widget gets the submit_mode behavior?**

The `submit_mode` parameter only affects the specific `st.chat_input` instance that triggered the
current script run. Other `st.chat_input` widgets on the page (if any) are not affected.

**How does the widget know it triggered the run?**

Detection uses the same mechanism as the existing `disabled` prop flow, but is scoped to the
triggering widget:

1. When the user submits, the frontend sends a rerun BackMsg with the updated widget value
2. The frontend tracks that this widget triggered the rerun (similar to how form submit works)
3. During the script run, if `submit_mode` is set, the triggering widget applies the behavior
4. When a `scriptFinished` ForwardMsg arrives, the widget reverts to normal state

This approach ensures:
- Multi-chat-input pages work correctly (only the triggered one changes)
- The parameter is declarative (no session state management needed)
- Focus is preserved (no rerun needed to apply the behavior)

### Edge Cases

- **Multiple chat inputs**: Only the widget that triggered the run is affected; others remain
  in their default state.
- **Fragment reruns**: If the chat_input is inside a fragment, the behavior scopes to the
  fragment rerun, not the full app.
- **Already running**: If a script is running from a different trigger (button click, etc.),
  chat_input behaves normally per its `disabled` parameter.
- **Stop during streaming**: When stopped, `st.write_stream` raises `StopException` just like
  when `st.stop()` is called. The generator is interrupted.
- **Callbacks**: The `on_submit` callback runs before the running behavior is applied (callbacks
  execute during widget processing, before script body runs).

## Alternatives Considered

### Parameter Name Options

Several parameter names were considered:

| Name | Example | Pros | Cons |
|------|---------|------|------|
| `submit_mode` | `submit_mode="stop"` | Focuses on what changes (submit button), concise | Doesn't explicitly mention "during run" |
| `running` | `running="disabled"` | Short, indicates timing | Ambiguous ("running what?") |
| `while_running` | `while_running="stop"` | Most explicit about timing | Longer, slightly awkward |
| `busy` | `busy="disabled"` | Shortest, intuitive | Generic, doesn't indicate when it applies |
| `processing` | `processing="stop"` | Clear intent | Implies CPU work specifically |
| `on_submit_running` | `on_submit_running="disabled"` | Explicit about trigger+state | Very long |

**Decision:** `submit_mode` was chosen as it's concise, focuses on the user-facing change (the
submit button behavior), and follows a `*_mode` pattern that could extend to other widgets.

### API Shape Options

**Option 1: Separate `on_running` callback**

```python
st.chat_input("Ask", on_running=lambda: "disabled")
```

- Pros: Maximum flexibility
- Cons: Overly complex for common use cases, doesn't match existing widget patterns

**Option 2: Global config option**

```toml
[client]
chat_input_running_behavior = "disabled"
```

- Pros: App-wide setting
- Cons: Doesn't allow per-widget customization, config is for environment not behavior

**Option 3: Boolean `disable_during_run` parameter**

```python
st.chat_input("Ask", disable_during_run=True)
```

- Pros: Simple boolean
- Cons: Can't support stop button behavior, not extensible

## Out of Scope (Future Work)

- **Custom running indicator**: Showing a "Generating..." message or custom spinner inside the
  input area. Could be added later as a `running_placeholder` parameter.
- **Partial generation display**: Showing the response tokens in the input area while generating.
  This is a more complex UX pattern better suited for a separate feature.
- **Programmatic stop**: An `st.stop_chat()` or similar API to stop generation from code. The
  current `st.stop()` already serves this purpose.
- **`submit_mode` parameter for other widgets**: Could extend to `st.button`, `st.form_submit_button`,
  etc. in a future enhancement if there's demand.

## Implementation Notes

### Backend Changes

- **`lib/streamlit/elements/widgets/chat.py`**: Add `submit_mode` parameter, serialize to proto
- **`proto/streamlit/proto/ChatInput.proto`**: Add `submit_mode` field (enum: NONE, DISABLED, STOP)

### Frontend Changes

- **`frontend/lib/src/components/widgets/ChatInput/ChatInput.tsx`**:
  - Track whether this widget triggered the current run
  - When `submit_mode` is set and widget triggered the run:
    - For `DISABLED`: disable all inputs
    - For `STOP`: replace submit button with stop button, disable text area
  - Listen for script completion to revert state
- **Stop button**: Reuse existing `stopScript` mechanism from `App.tsx`

### Testing

- **E2E tests**: Test all three modes, verify stop actually stops script, verify focus preservation
- **Unit tests**: Backend parameter validation, proto serialization

## Checklist

| Item | Status |
|------|--------|
| Works on SiS, Cloud, etc? | Yes - uses existing stop mechanism |
| No breaking API changes | Yes - new optional parameter with None default |
| No new dependencies | Yes - reuses existing stop infrastructure |
| Metrics collected | Yes - `submit_mode` parameter usage |
| Any security/legal impact? | No |
| Any docs changes needed? | Yes - document `submit_mode` parameter with examples |
