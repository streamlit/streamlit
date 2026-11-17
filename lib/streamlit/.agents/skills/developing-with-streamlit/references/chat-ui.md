
# Streamlit chat interfaces

Build conversational UIs with Streamlit's chat elements. For a complete chat and agent app (recent chats, tool-call steps, streamed answers with charts, feedback, and stopped runs), start from the `chat-analyst` template in `assets/templates/apps/`.

## Basic chat structure

```python
import streamlit as st

if "messages" not in st.session_state:
    st.session_state.messages = []

# Display chat history
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.write(msg["content"])

# Handle new input
if prompt := st.chat_input("Ask a question"):
    st.session_state.messages.append({"role": "user", "content": prompt})

    with st.chat_message("user"):
        st.write(prompt)

    with st.chat_message("assistant"):
        response = get_response(prompt)  # Your LLM call
        st.write(response)

    st.session_state.messages.append({"role": "assistant", "content": response})
```

## Streaming responses

Use `st.write_stream` for token-by-token display. Pass any generator that yields strings, including the OpenAI generator directly:

```python
def get_streaming_response(prompt):
    # Replace with your LLM client (OpenAI, Anthropic, Cortex, etc.)
    for chunk in your_llm_client.stream(prompt):
        yield chunk


with st.chat_message("assistant"):
    response = st.write_stream(get_streaming_response(prompt))

st.session_state.messages.append({"role": "assistant", "content": response})
```

Pass `cursor=` to show a cursor at the end of the text while it streams, for example `st.write_stream(stream, cursor=":primary[▍]")`.

With OpenAI, you can pass the stream directly:

```python
from openai import OpenAI

client = OpenAI()
with st.chat_message("assistant"):
    stream = client.chat.completions.create(
        model="gpt-6-astra",
        messages=st.session_state.messages,
        stream=True,
    )
    response = st.write_stream(stream)
```

## Controlling input while the response runs

Use `submit_mode` to control what happens to the chat input after a user submits a message while the script (e.g. an LLM response) is still running:

```python
# Disable the input until the response finishes (prevents interruptions)
prompt = st.chat_input("Ask a question", submit_mode="disable")

# Turn the submit button into a stop button so users can cancel a long response
prompt = st.chat_input("Ask a question", submit_mode="stop")
```

- `"submit"` (default): the input stays enabled, so users can send new messages while the script runs.
- `"disable"`: the input is disabled after submission and re-enabled when the run completes—useful to avoid interrupting streaming responses.
- `"stop"`: the submit button becomes a stop button during the run; clicking it stops the script, like the app's "Stop" button.

A stopped run usually leaves the user's message in history without a reply. Offer a retry instead of rendering nothing. A stop ends the script without starting another run, so the retry appears on the next rerun; don't try to draw it from the stopped run. Set a flag in the button's callback and read it before drawing anything, so the retry run doesn't draw the "stopped" note above the new reply:

```python
def retry() -> None:
    st.session_state.retry = True


history = st.session_state.messages
stopped = bool(history) and history[-1]["role"] == "user"
retrying = not prompt and stopped and st.session_state.pop("retry", False)
if retrying:
    prompt = history[-1]["content"]

# ... draw the history ...

if not prompt and stopped:
    with st.chat_message("assistant"):
        st.caption("You stopped this response.")
        st.button(
            "Try again", icon=":material/refresh:", type="tertiary", on_click=retry
        )

if prompt and not retrying:  # A retried question is already in history
    history.append({"role": "user", "content": prompt})
```

## Thinking and agent steps

Use `type="compact"` or `type="step"` on `st.status` or `st.expander` inside a chat message to disclose reasoning without the default bordered container. Prefer `st.status` for live thinking; `st.expander` is fine for static replay from history.

**Compact thinking expander.** A borderless inline toggle—the ChatGPT/Claude-style "Thought for N seconds" pattern. Use this for a single reasoning block. While work is running, wrap the compact label in `:shimmer[...]` so the text itself is the in-progress cue; update to a static label when complete.

```python
with st.chat_message("assistant"):
    with st.status(":shimmer[Thinking]", type="compact") as status:
        st.write(reasoning)
        status.update(label="Thought for 4 seconds", state="complete")

    response = st.write_stream(get_streaming_response(prompt))
```

**Step timeline.** Consecutive `type="step"` containers share a vertical connector. Use this for tool calls, retrieval, and multi-stage agent work that should stay visible in the message.

```python
with st.chat_message("assistant"):
    with st.status("Searching docs", type="step"):
        sources = search(prompt)
        st.write(sources[0])

    with st.status("Thinking", type="step"):
        st.write(reasoning)

    response = st.write_stream(get_streaming_response(prompt, sources))
```

The connector already stops when the next sibling is not a step, so you do not need an empty terminal step before the streamed answer.

**Combining both.** Nest the step timeline inside a compact status when the details should stay collapsed by default. This is usually the best fit in chat: a "Thought for N seconds" toggle that reveals the chain of thought.

```python
with st.chat_message("assistant"):
    with st.status(":shimmer[Thinking]", type="compact") as status:
        with st.status("Searching docs", type="step"):
            sources = search(prompt)
            st.write(sources[0])

        with st.status("Planning", type="step"):
            st.write(reasoning)

        status.update(label="Thought for 4 seconds", state="complete")

    response = st.write_stream(get_streaming_response(prompt, sources))
```

- Keep `type="step"` containers consecutive. Any other element between them—including an invisible `st.empty()`—starts a new timeline segment.
- A step with no content also ends the timeline, which is useful to split a chain into segments—not as a dummy "done" node before the answer.
- `state` must be `"running"` (default), `"complete"`, or `"error"`—any other value raises an error, including via `status.update(state=...)`.
- Put the status where the work runs so its steps appear as the task runs. Don't gate it behind a button whose only job is to launch the task—running it in response to real input, for example `if prompt := st.chat_input(...)`, is the normal case.
- Leaving a status's `with` block marks it complete. When steps arrive as events from an agent loop, add each one with `thinking.status(...)` and write to it with `status.markdown(...)` instead of re-entering `with thinking:`, which would mark "Thinking" done after the first step.

**Replaying from history.** Store each step's label and details and the thinking time with the message, not the containers. When you redraw history, render the steps complete and collapsed, without `:shimmer[...]`, and don't run the tools again:

```python
with st.chat_message("assistant"):
    if msg["steps"]:  # A reply without tool calls has no toggle
        s = msg["seconds"]
        label = f"Thought for {s} second{'s' if s != 1 else ''}"
        with st.status(label, type="compact", state="complete"):
            for step in msg["steps"]:
                with st.status(step["label"], type="step", state="complete"):
                    st.markdown(step["detail"])
    st.markdown(msg["content"])
```

## Feedback and other per-message widgets

Give every message a stable ID when you store it, and key per-message widgets with it. Keys built from the list index collide when the app keeps several conversations and shift when messages are removed:

```python
import uuid

st.session_state.messages.append(
    {"id": uuid.uuid4().hex, "role": "assistant", "content": response}
)

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if msg["role"] == "assistant":
            st.feedback("thumbs", key=f"feedback_{msg['id']}", persist_state="session")
```

Read a rating from `st.session_state[f"feedback_{msg_id}"]`, or pass `on_change=` with `args=(msg_id,)` to log it when it changes.

- `persist_state="session"` keeps a rating while its message isn't drawn, such as when another conversation is open.
- A reply generated in this run isn't in the history loop yet. Call `st.rerun()` after storing it to draw its widgets, or draw them right after streaming.

## Charts and tables in messages

Store the data that redraws a result with the message, such as an ECharts option and its alt text or a dataframe, not the element, and redraw it from history on every rerun. Key each chart by its message ID, so it keeps its identity and doesn't replay its entry animation when the messages above it change:

```python
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if chart := msg.get("chart"):
            st.echarts_chart(
                chart, height=260, alt=msg["chart_alt"], key=f"chart_{msg['id']}"
            )
```

## Chat message avatars

Streamlit provides default avatars for "user" and "assistant" roles—only customize if you have a specific need. You can use icons or images:

```python
# With icons
with st.chat_message("assistant", avatar=":material/robot:"):
    st.write(assistant_message)

# With images
with st.chat_message("user", avatar="https://example.com/avatar.png"):
    st.write(user_message)
```

## Suggestion chips

Offer clickable suggestions before the first message. A selected suggestion becomes the first prompt, and the pills disappear once the conversation starts:

```python
SUGGESTIONS = {
    ":blue[:material/help:] What is Streamlit?": "Explain what Streamlit is",
    ":green[:material/code:] Show me an example": "Show a simple Streamlit example",
}

# Replaces the basic example's `if prompt := st.chat_input(...)`
prompt = st.chat_input("Ask a question")

if not st.session_state.messages:
    suggestions = st.empty()
    selected = suggestions.pills(
        "Try asking:", list(SUGGESTIONS.keys()), label_visibility="collapsed"
    )
    if selected:
        prompt = SUGGESTIONS[selected]
    if prompt:
        suggestions.empty()  # Hide the pills before the first reply renders

if prompt:
    ...  # Same handling as typed input: append, display, and generate the reply
```

Show suggestions only while `st.session_state.messages` is empty, and route the selected suggestion through the same `if prompt:` handler as typed input. Appending the suggestion and calling `st.rerun()` skips the reply, because on that rerun `st.chat_input` returns `None`. Render the pills in an `st.empty()` placeholder and clear it once there is a prompt; otherwise they stay on screen above the first reply until the next rerun.

### Follow-up suggestions

Show follow-ups to the latest answer in one row right above the chat input, where people type and where a long answer can't push them out of view. Keep the start-screen suggestions centered in the empty chat, where they fill the page. Give follow-ups short labels mapped to full prompts, like `SUGGESTIONS`, so the row stays readable:

```python
followup_slot = st.bottom.empty()  # Before the chat input, so the row sits above it
prompt = st.chat_input("Ask a question")

history = st.session_state.messages
followups = history[-1].get("followups", {}) if history else {}  # Label -> prompt
if not prompt and followups:
    key = f"followup_{history[-1]['id']}"
    if picked := st.session_state.get(key):
        prompt = followups[picked]
    else:
        with followup_slot.container():
            st.pills(
                "Follow up",
                list(followups),
                label_visibility="collapsed",
                wrap=False,
                key=key,
            )
```

On the run that answers a prompt, the slot stays empty, which removes the pills right away. Put them in `slot.container()`: pills placed directly in the slot stay on screen until the run ends. Key them by the reply's message ID, so a new answer starts with nothing selected, and call `st.rerun()` after storing the reply so its follow-ups show.

## Multiple conversations and recent chats

Keep conversations in Session State by ID and track the open one. List recent chats in the sidebar as tertiary buttons with `wrap=False` inside `st.container(gap=None)`: compact rows whose long titles end in an ellipsis and show in full on hover. Switch chats in an `on_click` callback, so the run that follows draws the chosen chat:

```python
import uuid

chats = st.session_state.setdefault("chats", {})  # Chat ID -> messages
open_id = st.session_state.setdefault("chat_id", uuid.uuid4().hex)
messages = chats.setdefault(open_id, [])


def open_chat(chat_id: str) -> None:
    st.session_state.chat_id = chat_id


def new_chat() -> None:
    if chats[st.session_state.chat_id]:  # An empty chat stays open
        st.session_state.chat_id = uuid.uuid4().hex


with st.sidebar:
    st.button(
        "New chat", icon=":material/edit_square:", width="stretch", on_click=new_chat
    )
    st.caption("Recent")
    with st.container(gap=None):
        for chat_id, chat in reversed(chats.items()):
            if not chat:
                continue
            label = chat[0]["content"][:48]
            st.button(
                f"**{label}**" if chat_id == open_id else label,
                type="tertiary",
                wrap=False,
                key=f"chat_{chat_id}",
                on_click=open_chat,
                args=(chat_id,),
            )
```

Use `messages` wherever the examples above use `st.session_state.messages`. Dicts keep insertion order, so move a chat to the end when someone sends a message in it (`chats[open_id] = chats.pop(open_id)`) to list the most recently active chat first, and call `st.rerun()` after storing the reply so the sidebar shows the new order. Key per-chat widgets, such as start-screen suggestions, by the chat ID, so a new chat starts with nothing selected. Session State lasts for one browser session; store conversations in a database to keep them longer.

## File uploads

Enable file attachments with `accept_file`. When enabled, `st.chat_input` returns a dict-like object with `text` and `files` attributes:

```python
prompt = st.chat_input(
    "Ask about an image",
    accept_file=True,
    file_type=["jpg", "jpeg", "png"],
)

if prompt:
    with st.chat_message("user"):
        if prompt.text:
            st.write(prompt.text)
        if prompt.files:
            st.image(prompt.files[0])

    # Send to vision model; a message can be text-only, so files may be empty
    with st.chat_message("assistant"):
        image = prompt.files[0] if prompt.files else None
        response = analyze_image(image, prompt.text)
        st.write(response)
```

Use `accept_file="multiple"` to allow multiple files.

For typed helpers, import `ChatInputValue` and `UploadedFile` from the public `streamlit.typing` namespace instead of Streamlit's internal modules:

```python
from streamlit.typing import ChatInputValue, UploadedFile


def first_file(submission: ChatInputValue) -> UploadedFile | None:
    return submission.files[0] if "files" in submission and submission.files else None
```

## Audio input

Enable voice recording with `accept_audio`. The recorded audio is available as a WAV file:

```python
prompt = st.chat_input("Say something", accept_audio=True)

if prompt:
    if prompt.audio:
        st.audio(prompt.audio)
    if prompt.text:
        st.write(prompt.text)
```

### Dictation with speech-to-text

Convert audio to text and inject it back into the chat input:

```python
prompt = st.chat_input("Say something", accept_audio=True, key="chat")

if prompt and prompt.audio:
    # Transcribe with a speech-to-text model
    transcript = openai.audio.transcriptions.create(
        model="gpt-transcribe",
        file=prompt.audio,
    )
    # Set the transcribed text as the next input
    st.session_state.chat = transcript.text
    st.rerun()
```

## References

- `snowflake-connection.md` — Database queries and Cortex chat example
- `performance.md` — Caching strategies for LLM calls
- [st.chat_message](https://docs.streamlit.io/develop/api-reference/chat/st.chat_message)
- [st.chat_input](https://docs.streamlit.io/develop/api-reference/chat/st.chat_input)
- [st.write_stream](https://docs.streamlit.io/develop/api-reference/write-magic/st.write_stream)
- [st.status](https://docs.streamlit.io/develop/api-reference/status/st.status)
- [st.expander](https://docs.streamlit.io/develop/api-reference/layout/st.expander)
