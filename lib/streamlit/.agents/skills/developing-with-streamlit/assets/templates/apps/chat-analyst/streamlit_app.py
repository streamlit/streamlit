# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Chat analyst: an AI assistant that shows its work while it answers.

A chat and agent app: people ask questions in a chat, and the agent's tool
calls appear as a timeline under a compact "Thought for N seconds" toggle
before its answer streams in, with a chart drawn from the same data.

Notes on this template:
- Conversations live in Session State by ID, and every message has its own ID,
  so widget keys such as each answer's feedback stay with their message.
  ``persist_state="session"`` keeps a rating while its chat isn't open.
- The sidebar lists recent chats as tertiary buttons with ``wrap=False`` in an
  ``st.container(gap=None)``: compact rows whose long titles end in an
  ellipsis. Sending a message moves its chat to the top.
- ``st.chat_input(submit_mode="stop")`` turns the send button into a stop
  button. A stopped run, or one interrupted by switching chats, leaves a
  question without an answer, so the next run shows "This response was
  interrupted" with a retry button. A stop doesn't start a run, so the note
  appears with the user's next interaction. Sending a new message instead
  leaves the stopped question unanswered in the history.
- The agent yields an event as each tool call starts and ends, and each one is
  drawn where the work runs: an ``st.status(type="step")`` with a
  ``:shimmer[...]`` label inside a compact "Thinking" ``st.status``. The
  message stores the finished steps and the measured thinking time, and
  history replays them complete and collapsed.
- ``st.write_stream(cursor=...)`` streams the answer, and ``st.feedback`` rates
  it. ``st.pills`` offers suggestions on the start screen, and follow-ups to
  the latest answer in one row (``wrap=False``) above the chat input, in an
  ``st.bottom.empty()`` slot. Both are read before they render, so they
  disappear while the reply runs.
- Messages store the streamed answer and the data to redraw a chart, not the
  element. Each chart is keyed by its message ID, so it keeps its identity and
  doesn't replay its entry animation when the messages above it change.

No model is called: ``agent.py`` runs scripted analyses over synthetic data.
Replace ``agent.run`` with your model or agent framework, mapping its events to
``Running``, ``Step``, and ``Reply``.

Session State lasts for one browser session. Store the conversations in a
database to keep them longer.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

import agent

import streamlit as st

st.set_page_config(
    page_title="Chat analyst",
    page_icon=":material/forum:",
    layout="centered",
)

CURSOR = ":primary[▍]"
Message = dict[str, Any]


def new_id() -> str:
    return uuid.uuid4().hex[:8]


def chats() -> dict[str, list[Message]]:
    """Every conversation in the session by ID, least recently active first."""
    conversations: dict[str, list[Message]] = st.session_state.setdefault("chats", {})
    return conversations


def chat_id() -> str:
    """The ID of the open conversation."""
    open_id: str = st.session_state.setdefault("chat_id", new_id())
    return open_id


def messages() -> list[Message]:
    """The open conversation."""
    return chats().setdefault(chat_id(), [])


def chat_title(history: list[Message]) -> str:
    """The agent's title for the first reply, or the opening question until then."""
    replies: list[agent.Reply] = [m["reply"] for m in history if "reply" in m]
    return replies[0].title if replies else str(history[0]["content"])[:48]


def new_chat() -> None:
    if messages():
        st.session_state.chat_id = new_id()


def open_chat(target: str) -> None:
    st.session_state.chat_id = target


def retry() -> None:
    st.session_state.retry = True


def thank_for_feedback(message_id: str) -> None:
    if st.session_state.get(f"feedback_{message_id}") is not None:
        st.toast("Thanks for the feedback.", icon=":material/thumb_up:")


def transcript(history: list[Message]) -> str:
    return "\n\n".join(
        f"**You:** {m['content']}"
        if m["role"] == "user"
        else f"**Analyst:** {m['answer']}"
        for m in history
    )


def thought_for(seconds: int) -> str:
    return f"Thought for {seconds} second{'s' if seconds != 1 else ''}"


def render_steps(message: Message) -> None:
    """A finished reply's steps as a "Thought for N seconds" toggle."""
    if not message["steps"]:
        return
    with st.status(thought_for(message["seconds"]), type="compact", state="complete"):
        for step in message["steps"]:
            with st.status(step.label, type="step", state="complete"):
                st.markdown(step.detail)


def run_agent(prompt: str) -> tuple[agent.Reply, list[agent.Step], int]:
    """Run the agent and show each tool call as a step while it runs.

    The "Thinking" toggle opens with the first tool call, so a reply that needs
    no tools streams its answer straight away.
    """
    started = time.monotonic()
    steps: list[agent.Step] = []
    thinking = step_status = None
    reply = None
    for event in agent.run(prompt):
        if isinstance(event, agent.Reply):
            reply = event
            continue
        if thinking is None:
            thinking = st.status(":shimmer[Thinking]", type="compact", expanded=True)
        # Write to the statuses directly to keep them running. Leaving a
        # status's ``with`` block would mark it complete.
        if isinstance(event, agent.Running):
            step_status = thinking.status(
                f":shimmer[{event.label}]", type="step", expanded=True
            )
        else:
            if step_status is None:  # A tool call reported only once it finished
                step_status = thinking.status(event.label, type="step")
            step_status.markdown(event.detail)
            step_status.update(label=event.label, state="complete")
            steps.append(event)
            step_status = None
    if reply is None:
        raise RuntimeError("The agent finished without a reply.")
    seconds = max(1, round(time.monotonic() - started))
    if thinking is not None:
        thinking.update(label=thought_for(seconds), state="complete", expanded=False)
    return reply, steps, seconds


def render_result(reply: agent.Reply, message_id: str) -> None:
    """The reply's chart, if it has one, and its feedback, keyed by the message ID."""
    if reply.chart:
        st.echarts_chart(
            reply.chart, height=260, alt=reply.chart_alt, key=f"chart_{message_id}"
        )
    st.feedback(
        "thumbs",
        key=f"feedback_{message_id}",
        persist_state="session",
        on_change=thank_for_feedback,
        args=(message_id,),
    )


def render_assistant(message: Message) -> None:
    with st.chat_message("assistant"):
        render_steps(message)
        st.markdown(message["answer"])
        render_result(message["reply"], message["id"])


def respond(prompt: str) -> Message:
    """Run the agent for a request and show its work as it happens."""
    message_id = new_id()
    with st.chat_message("assistant"):
        reply, steps, seconds = run_agent(prompt)
        # With a real model, stream its tokens here instead.
        answer = st.write_stream(agent.stream(reply.answer), cursor=CURSOR)
        render_result(reply, message_id)
    return {
        "role": "assistant",
        "id": message_id,
        "reply": reply,
        "steps": steps,
        "seconds": seconds,
        "answer": answer,
    }


with st.sidebar:
    st.button(
        "New chat", icon=":material/edit_square:", width="stretch", on_click=new_chat
    )
    recent = [
        (recent_id, chat) for recent_id, chat in reversed(chats().items()) if chat
    ]
    if recent:
        with st.container(gap="xsmall"):
            st.caption("Recent")
            with st.container(gap=None):
                for recent_id, chat in recent:
                    label = chat_title(chat)
                    st.button(
                        f"**{label}**" if recent_id == chat_id() else label,
                        type="tertiary",
                        wrap=False,
                        key=f"chat_{recent_id}",
                        on_click=open_chat,
                        args=(recent_id,),
                    )
    st.caption("Scripted answers over synthetic data. Connect a model in `agent.py`.")

# Created before the chat input, so the follow-ups sit right above it
followup_slot = st.bottom.empty()
submission = st.chat_input("Ask about revenue by region", submit_mode="stop")
history = messages()
latest = history[-1] if history else None
followups: dict[str, str] = (
    latest["reply"].followups if latest and "reply" in latest else {}
)
retrying = (
    bool(st.session_state.pop("retry", False))
    and latest is not None
    and latest["role"] == "user"
)
prompt = submission or (latest["content"] if retrying and latest else None)

# A picked suggestion or follow-up is a prompt too. Read it before the pills
# render, so they disappear while the reply streams. Suggestions are keyed by
# chat, so a pick from an interrupted run can't resend in a new chat.
suggestion_key = f"suggestion_{chat_id()}"
if prompt is None and not history and (picked := st.session_state.get(suggestion_key)):
    prompt = agent.SUGGESTIONS[picked]
if prompt is None and latest and followups:
    followup_key = f"followup_{latest['id']}"
    if picked := st.session_state.get(followup_key):
        prompt = followups[picked]
    else:
        # Pills placed directly in the slot would stay on screen until the next
        # reply finishes. In a container, the empty slot removes them right away.
        with followup_slot.container():
            st.pills(
                "Follow up",
                list(followups),
                label_visibility="collapsed",
                wrap=False,
                key=followup_key,
            )

if not history and prompt is None:
    st.space("large")
    with st.container(horizontal_alignment="center", gap="small"):
        st.title("What should we look into?", anchor=False, text_alignment="center")
        st.markdown(
            ":gray[Ask about weekly revenue by region. The agent shows each step "
            "it takes.]",
            text_alignment="center",
        )
        st.space("small")
        st.pills(
            "Try asking",
            list(agent.SUGGESTIONS),
            label_visibility="collapsed",
            key=suggestion_key,
        )
elif history:
    with st.container(
        horizontal=True, horizontal_alignment="distribute", vertical_alignment="center"
    ):
        st.markdown(f"**{chat_title(history)}**", width="content")
        st.download_button(
            "",
            transcript(history),
            file_name="chat.md",
            mime="text/markdown",
            icon=":material/download:",
            type="tertiary",
            on_click="ignore",
            help="Download the conversation",
        )

    for message in history:
        if message["role"] == "user":
            with st.chat_message("user"):
                st.markdown(message["content"])
        else:
            render_assistant(message)
    if history[-1]["role"] == "user" and prompt is None:
        with st.chat_message("assistant"):
            with st.container(horizontal=True, vertical_alignment="center"):
                st.caption("This response was interrupted.")
                st.button(
                    "Try again",
                    icon=":material/refresh:",
                    type="tertiary",
                    on_click=retry,
                )

if prompt is not None:
    # Recent lists chats in reverse, so moving this one to the end lists it first
    chats()[chat_id()] = chats().pop(chat_id())
    if not retrying:
        history.append({"role": "user", "id": new_id(), "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)
    history.append(respond(prompt))
    st.rerun()
