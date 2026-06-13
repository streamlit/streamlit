---
author: lukasmasuch
created: 2026-04-08
---

# Configurable Running-State Behavior for `st.chat_input`

## Summary

Add a `submit_mode` parameter to `st.chat_input` that controls widget behavior after submission during script execution. This enables three modes: showing a stop button (to cancel the run), disabling input (to prevent interruptions), or keeping input enabled (current default). This addresses the common pain point of users interrupting LLM responses by submitting new messages while streaming.

## Problem

When users submit a prompt in `st.chat_input`, there's no built-in way to:

1. **Prevent interruptions**: Users can submit new messages while an LLM is generating a response, which interrupts streaming and corrupts conversation history.
2. **Cancel generation**: Unlike ChatGPT and other AI interfaces, users cannot stop an in-progress LLM generation from the chat input.

### User Requests

- [#8323](https://github.com/streamlit/streamlit/issues/8323) - Impossible to disable `st.chat_input` while writing the model's response
- [#11854](https://github.com/streamlit/streamlit/issues/11854) - Turn submit button in `st.chat_input` into stop button

### Use Cases

- **Streaming AI responses**: Prevent users from sending new messages while the assistant is generating a response, avoiding message interleaving and broken conversation state.
- **Canceling long generations**: Allow users to stop an LLM that's generating an overly long or unwanted response.
- **Interactive agents**: Support agentic workflows where users may need to interrupt or redirect an agent's execution.

### Current Behavior

The `disabled` parameter exists but does not help because:

1. It's evaluated at script start, before the submission is processed
2. Setting `disabled=True` after receiving input requires a rerun, but the script is already running
3. Workarounds using callbacks and `st.rerun()` are brittle and cause focus loss

Current workarounds from the community (all have significant drawbacks):

```python
# Workaround 1: Callback + rerun (loses focus, requires extra rerun)
if "disabled" not in st.session_state:
    st.session_state.disabled = False

def on_submit():
    st.session_state.disabled = True

if prompt := st.chat_input("Ask", on_submit=on_submit, disabled=st.session_state.disabled):
    # ... generate response ...
    st.session_state.disabled = False
    st.rerun()  # Extra rerun needed to re-enable

# Workaround 2: CSS hack (fragile, loses focus)
st.markdown("""
<style>
    .stApp[data-test-script-state="running"] .stChatInput textarea { display: none; }
</style>
""", unsafe_allow_html=True)
```

## Proposal

### API

```python
st.chat_input(
    placeholder: str = "Your message",
    *,
    submit_mode: Literal["submit", "disable", "stop"] = "submit",  # NEW
    ...,
)
```

### Parameter

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `submit_mode` | `Literal["submit", "disable", "stop"]` | `"submit"` | Controls widget behavior after submission while the script is running. `"submit"` keeps input enabled (current behavior). `"disable"` disables input during the run. `"stop"` transforms the submit button into a stop button. |

### Behavior

**`submit_mode="submit"` (default):**

- Current behavior: widget remains fully enabled after submission
- Users can submit new messages while the script is running
- Preserves backward compatibility

**`submit_mode="disable"`:**

- Widget is automatically disabled after the user submits a message
- The text area and all buttons (submit, file upload, voice) are disabled
- Widget re-enables when the script run completes
- Input field is cleared on submit; when the run completes and the widget re-enables, focus returns to the input automatically

**`submit_mode="stop"`:**

- After submission, the text area is disabled for the duration of the script run
- The file upload and voice buttons are also disabled during the run
- The submit button is replaced by an enabled stop button (square icon)
- The stop button is the only interactive sub-control while the script is running
- Clicking the stop button sends a `stop_script` BackMsg to the server
- This is equivalent to clicking "Stop" in the app's status widget
- When clicked, `st.stop()` is effectively called, halting script execution
- Widget returns to normal state when the script run completes (whether stopped or finished)

### Visual Design

When `submit_mode="stop"` and the script is running:

```
+------------------------------------------------------------------+
| [textarea disabled, showing placeholder]           [stop button] |
+------------------------------------------------------------------+
```

### Examples

**Basic usage - disable during generation:**

```python
import streamlit as st

if prompt := st.chat_input("Ask anything", submit_mode="disable"):
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

### Scope and Detection

**Which `st.chat_input` widget gets the submit_mode behavior?**

The `submit_mode` parameter only affects the specific `st.chat_input` instance that triggered the current script run. Other `st.chat_input` widgets on the page (if any) are not affected.

**How does the widget know it triggered the run?**

Detection uses the same mechanism as the existing `disabled` prop flow, but is scoped to the triggering widget:

1. When the user submits, the frontend sends a rerun BackMsg with the updated widget value
2. The frontend tracks that this widget triggered the rerun (similar to how form submit works)
3. During the script run, if `submit_mode` is `"disable"` or `"stop"`, the triggering widget applies the behavior
4. The widget reverts to normal state when the run it triggered completes. The re-enable signal is the `scriptFinished` ForwardMsg for the matching run scope: the full script run for a page-level widget, or the corresponding fragment rerun for a widget inside a fragment (see the "Fragment reruns" edge case). A page-level widget therefore does not re-enable on a fragment rerun's completion, and a fragment-scoped widget re-enables when its fragment rerun finishes even if a full script run is still in progress from a different trigger.

This approach ensures:

- Multi-chat-input pages work correctly (only the triggered one changes)
- The parameter is declarative (no session state management needed)
- Focus is preserved (no rerun needed to apply the behavior)

### Edge Cases

- **Multiple chat inputs**: Only the widget that triggered the run is affected; others remain in their default state.
- **Fragment reruns**: If the `chat_input` is inside a fragment, the disable/re-enable lifecycle scopes to the fragment rerun, not the full app. The widget re-enables when the fragment completes, even if the full script is still running from a different trigger. Conversely, if a page-level `chat_input` triggers a full rerun while a fragment is running, the fragment's execution continues until completion (existing behavior) and the `chat_input` re-enables when the full script finishes. Note that for `submit_mode="stop"`, only this visual disable/re-enable lifecycle is fragment-scoped: clicking the stop button halts the entire script run via the app-wide `stop_script` mechanism, since there is no fragment-scoped stop today. Because the fragment cannot complete normally once the run is stopped, in that case the widget re-enables on the app-wide `scriptFinished` signal (when the full script run ends) rather than on fragment completion. If finer-grained, fragment-only cancellation is needed, that would require a separate mechanism and is out of scope here.
- **Already running**: If a script is running from a different trigger (button click, etc.), `chat_input` behaves normally per its `disabled` parameter. Because the running-state behavior only applies to the widget that triggered the current run, a `submit_mode="stop"` input does not turn its submit button into a stop button in this case.
- **`disabled=True` with `submit_mode`**: When `disabled=True` is explicitly set by the developer, the `disabled` parameter takes precedence and `submit_mode` has no effect (the widget is always disabled regardless of run state).
- **Stop during streaming**: When stopped, `st.write_stream` halts output just as if `st.stop()` were called. The generator is interrupted.
- **Callbacks**: The `on_submit` callback executes normally as part of widget processing on the server (before the script body runs). The running-state UI (disabled input or stop button) is a client-side change applied at submission time, independent of callback execution—so `on_submit` is unaffected by `submit_mode`.
- **`st.rerun()` inside the handler**: Calling `st.rerun()` within the triggered run ends that run and emits `scriptFinished`, so the widget re-enables, and the follow-up run is not attributed to the `chat_input`. For the initial version this is a known limitation: `submit_mode` keeps the widget disabled/stoppable only for the single run it triggered, not across a chain of `st.rerun()` calls. A more robust implementation could persist the "triggered-by" relationship across the rerun chain; that is out of scope here.

## Alternatives Considered

### Parameter Name Options

Several parameter names were considered:

| Name | Example | Pros | Cons |
|------|---------|------|------|
| `submit_mode` | `submit_mode="stop"` | Focuses on what changes (submit button), concise | Doesn't explicitly mention "during run" |
| `running` | `running="disable"` | Short, indicates timing | Ambiguous ("running what?") |
| `while_running` | `while_running="stop"` | Most explicit about timing | Longer, slightly awkward |
| `busy` | `busy="disable"` | Shortest, intuitive | Generic, doesn't indicate when it applies |
| `processing` | `processing="stop"` | Clear intent | Implies CPU work specifically |
| `on_submit_running` | `on_submit_running="disable"` | Explicit about trigger+state | Very long |

**Decision:** `submit_mode` was chosen as it's concise, focuses on the user-facing change (the submit button behavior), and follows a `*_mode` pattern that could extend to other widgets.

### API Shape Options

**Option 1: Separate `on_running` callback**

```python
st.chat_input("Ask", on_running=lambda: "disable")
```

- Pros: Maximum flexibility
- Cons: Overly complex for common use cases, doesn't match existing widget patterns

**Option 2: Global config option**

```toml
[client]
chat_input_running_behavior = "disable"
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

- **Custom running indicator**: Showing a "Generating..." message or custom spinner inside the input area. Could be added later as a `running_placeholder` parameter.

## Checklist

| Item                         | ✅ or comment          |
|------------------------------|------------------------|
| Works on SiS, Cloud, etc?    | ✅ uses existing stop mechanism |
| No breaking API changes      | ✅ new optional parameter with `"submit"` default |
| No new dependencies          | ✅ reuses existing stop infrastructure |
| Metrics collected            | ✅ `submit_mode` parameter usage |
| Any security/legal impact?   | ✅ No impact |
| Any docs changes needed?     | ✅ document `submit_mode` parameter with examples |
