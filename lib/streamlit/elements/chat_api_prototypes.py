# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
from __future__ import annotations

import inspect
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, List, Tuple, Dict, Literal, Optional

from typing_extensions import Required, NotRequired, TypedDict

import streamlit

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


# Shared:
class ChatUserInfo(TypedDict):
    role: Required[str]
    avatar: NotRequired[str | None]
    background: NotRequired[Literal["grey"] | None]
    hidden: NotRequired[bool]


def _clean_stale_elements(dg: "DeltaGenerator"):
    for _ in range(10):
        # Trick to clean up all stale elements in the container
        # Issue is that if there are more elements in the container in
        # the main message compared to the history message,
        # the history message will get stale
        dg.empty()


def ChatUser(
    role: str,
    avatar: str | None = None,
    background: Literal["grey"] | None = None,
    hidden: bool = False,
) -> ChatUserInfo:
    return ChatUserInfo(role=role, avatar=avatar, background=background, hidden=hidden)


def _process_participants(
    participants: List[ChatUserInfo | str] | Dict[str, str | None] | str | None
) -> List[ChatUserInfo]:
    if participants is None:
        return [
            ChatUser(role="user", avatar="user", background="grey"),
            ChatUser(role="assistant", avatar="assistant"),
        ]
    elif isinstance(participants, dict):
        processed_participants = []
        for role, value in participants.items():
            background: Literal["grey"] | None = None
            if role == "user":
                background = "grey"
            if isinstance(value, str):
                processed_participants.append(
                    ChatUser(role=role, avatar=value, background=background)
                )
            elif value is None:
                processed_participants.append(
                    ChatUser(role=role, hidden=True, background=background)
                )
            elif value is Ellipsis:  # type: ignore
                processed_participants.append(
                    ChatUser(role=role, background=background)
                )
        return processed_participants
    elif isinstance(participants, str):
        return [ChatUser(role=participants)]
    else:
        if len(participants) > 0 and isinstance(participants[0], str):
            return [ChatUser(role=participant) for participant in participants]
        return participants


# V3 Version:


@dataclass
class ChatHandler:
    parent_dg: "DeltaGenerator"
    last_speaker: Optional["ChatChildrenDeltaGenerator"] = None


class ChatChildrenDeltaGenerator:
    def __init__(self, chat_handler: ChatHandler, participant: ChatUserInfo):
        self._chat_handler = chat_handler
        self._message_container: "DeltaGenerator" | None = None
        self._participant = participant

    def _get_or_create_chat_message(self) -> "DeltaGenerator":
        if self._chat_handler.last_speaker != self or self._message_container is None:
            self._message_container = self._chat_handler.parent_dg._chat_message(
                label=self._participant["role"],
                avatar=self._participant["avatar"],
                background=self._participant["background"],
            )
            self._chat_handler.last_speaker = self
        return self._message_container

    def __getattr__(self, name):
        return getattr(self._get_or_create_chat_message(), name)

    def __enter__(self):
        return self._get_or_create_chat_message().__enter__()

    def __exit__(self, exc_type, exc_val, exc_tb):
        return self._get_or_create_chat_message().__exit__(exc_type, exc_val, exc_tb)


def chat_v3(
    dg: "DeltaGenerator",
    participants: List[ChatUserInfo | str] | Dict[str, str | None] | None = None,
) -> List[ChatChildrenDeltaGenerator]:
    participants = _process_participants(participants)
    chat_layout = dg._chat_container()
    chat_handler = ChatHandler(chat_layout)
    return [
        ChatChildrenDeltaGenerator(chat_handler, participant)
        for participant in participants
    ]


# V9 Version:

# V9 State Extension:


class ChatMessage(TypedDict):
    participant: Required[ChatUserInfo]
    content: Required[List[Any]]


class OpenAiChatMessage(TypedDict):
    role: str
    content: str


class ChatState:
    def __init__(self):
        self._messages: List[ChatMessage] = []

    def add_message(self, participant: ChatUserInfo | str, *content):
        if isinstance(participant, str):
            participant = ChatUser(role=participant)
        self._messages.append(
            {
                "participant": participant,
                "content": list(content),
            }
        )

    @property
    def messages(self):
        return self._messages

    def clear(self):
        self._messages = []

    def to_openai(self) -> List[OpenAiChatMessage]:
        converted_messages: List[OpenAiChatMessage] = []
        for message in self._messages:
            # Join all text content of the message:
            text_content = " ".join(
                content for content in message["content"] if isinstance(content, str)
            )
            converted_messages.append(
                {
                    "role": message["participant"]
                    if isinstance(message["participant"], str)
                    else message["participant"]["role"],
                    "content": text_content,
                }
            )
        return converted_messages

    def __bool__(self):
        return bool(self._messages)


class ChatStateManager:
    def __getitem__(self, key: str) -> ChatState:
        if key not in streamlit.session_state:
            # Create new chat history state
            streamlit.session_state[key] = ChatState()
        return streamlit.session_state[key]  # type: ignore

    def __setitem__(self, key: str, value: ChatState) -> None:
        streamlit.session_state[key] = value

    def __delitem__(self, key: str) -> None:
        del streamlit.session_state[key]

    def __contains__(self, key: str) -> bool:
        return key in streamlit.session_state


chat_state = ChatStateManager()

# V9 chat container:


def _display_chat_message(
    dg: "DeltaGenerator", participant: ChatUserInfo, *args: Any
) -> Tuple["DeltaGenerator", List[Any]]:
    role = participant.get("role", "")
    background = participant.get("background")
    avatar = participant.get("avatar")

    message_container = dg._chat_message(role, avatar, background=background)
    with message_container:
        message_content: List[Any] = []

        string_buffer: List[str] = []

        def flush_buffer():
            if string_buffer:
                text_content = " ".join(string_buffer)
                text_container = message_container.empty()
                text_container.markdown(text_content)
                message_content.append(text_content)
                string_buffer[:] = []

        for arg in args:
            # Order matters!
            if isinstance(arg, str):
                string_buffer.append(arg)
            elif callable(arg) or inspect.isgenerator(arg):
                flush_buffer()
                if inspect.isgeneratorfunction(arg) or inspect.isgenerator(arg):
                    # This causes greyed out effect since this element is missing on rerun:
                    stream_container = None
                    streamed_response = ""

                    def flush_stream_response():
                        nonlocal streamed_response
                        nonlocal stream_container
                        if streamed_response and stream_container:
                            stream_container.markdown(streamed_response)  # type: ignore
                            message_content.append(streamed_response)
                            stream_container = None
                            streamed_response = ""

                    generator = arg() if inspect.isgeneratorfunction(arg) else arg
                    for chunk in generator:
                        if isinstance(chunk, str):
                            first_text = False
                            if not stream_container:
                                stream_container = message_container.empty()
                                first_text = True

                            streamed_response += chunk
                            # Only add the streaming symbol on the second text chunk
                            stream_container.markdown(
                                streamed_response + ("" if first_text else "▌")
                            )
                        elif callable(chunk):
                            flush_stream_response()
                            chunk()
                            message_content.append(chunk)
                        else:
                            flush_stream_response()
                            message_container.write(chunk)
                            message_content.append(chunk)
                    flush_stream_response()

                else:
                    arg()
                    message_content.append(arg)
            else:
                flush_buffer()
                message_container.write(arg)
                message_content.append(arg)
        flush_buffer()
        _clean_stale_elements(message_container)
    return message_container, message_content


def chat_message(
    dg: "DeltaGenerator", participant: str | ChatUserInfo, *args: Any
) -> "DeltaGenerator":
    if isinstance(participant, str):
        participant = ChatUserInfo(role=participant)
    active_dg = dg._active_dg
    if hasattr(active_dg, "chat_participants") and isinstance(
        active_dg.chat_participants, dict
    ):
        participant_role = participant.get("role", "")  # type: ignore
        if participant_role in active_dg.chat_participants:
            configured_participant = active_dg.chat_participants[
                participant_role
            ].copy()
        # Update with changes from one provided in the message
        configured_participant.update(participant)
        participant = configured_participant

    message_container, message_content = _display_chat_message(dg, participant, *args)

    if hasattr(active_dg, "chat_state") and isinstance(active_dg.chat_state, ChatState):
        active_dg.chat_state.add_message(participant, *message_content)  # type: ignore

    return message_container


def chat_v9(
    dg: "DeltaGenerator",
    participants: List[ChatUserInfo | str] | Dict[str, str | None] | None = None,
    chat_state: ChatState | str | None = None,
) -> "DeltaGenerator":
    participants = _process_participants(participants)

    if isinstance(chat_state, str):
        chat_state = ChatStateManager()[chat_state]

    chat_container = dg._chat_container()

    chat_container.chat_participants = {  # type: ignore
        participant["role"]: participant for participant in participants
    }
    if chat_state is not None:
        chat_container.chat_state: ChatState = chat_state  # type: ignore
        with chat_container:
            for message in chat_container.chat_state.messages:  # type: igno
                message_participant: ChatUserInfo | None = None
                if isinstance(message["participant"], str):
                    if message["participant"] in chat_container.chat_participants:
                        message_participant = chat_container.chat_participants[  # type: ignore
                            message["participant"]
                        ]
                else:
                    message_participant = message["participant"]
                if (
                    message_participant
                    and not message_participant["hidden"]
                    and message_participant["role"] in chat_container.chat_participants
                ):
                    _display_chat_message(
                        chat_container, message_participant, *message.get("content", [])
                    )

    return chat_container
