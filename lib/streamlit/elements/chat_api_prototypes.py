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

DEFAULT_ASSISTANT_IMAGE = "data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='32' height='32' rx='8' fill='%233580F2'/%3E%3Cg clip-path='url(%23clip0_428_18531)'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M16.5796 16.1184L16.0898 16.6082C16.0244 16.6736 15.9184 16.6736 15.853 16.6082L15.3633 16.1185C15.2979 16.0531 15.2979 15.9471 15.3633 15.8817L15.853 15.3919C15.9184 15.3265 16.0245 15.3265 16.0899 15.3919L16.5796 15.8817C16.645 15.947 16.645 16.0531 16.5796 16.1184ZM17.6041 15.5018L16.4697 14.3674C16.1946 14.0922 15.7484 14.0922 15.4732 14.3674L14.3387 15.5019C14.0635 15.7771 14.0635 16.2232 14.3387 16.4984L15.4731 17.6328C15.7483 17.908 16.1944 17.908 16.4696 17.6328L17.6041 16.4983C17.8793 16.2231 17.8793 15.7769 17.6041 15.5018Z' fill='white'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M14.0865 8C13.5278 8 13.075 8.45287 13.075 9.0115V11.1059L11.2474 10.0508C10.7636 9.77145 10.145 9.9372 9.86566 10.421C9.58635 10.9048 9.7521 11.5234 10.2359 11.8027L13.4445 13.6552C13.6191 13.7988 13.8427 13.8851 14.0865 13.8851C14.6451 13.8851 15.098 13.4322 15.098 12.8736V9.0115C15.098 8.45287 14.6451 8 14.0865 8Z' fill='white'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M13.2911 16.3839C13.2973 16.3688 13.3035 16.3536 13.309 16.3381C13.3151 16.3209 13.3205 16.3035 13.3256 16.286C13.3296 16.2726 13.3335 16.2593 13.3369 16.2458C13.3416 16.2271 13.3455 16.2083 13.3491 16.1895C13.3516 16.1762 13.354 16.163 13.3561 16.1496C13.3588 16.1312 13.3609 16.1129 13.3626 16.0944C13.364 16.0797 13.3652 16.0651 13.3659 16.0504C13.3668 16.0336 13.367 16.0169 13.367 16.0001C13.367 15.9833 13.3668 15.9666 13.3659 15.9498C13.3652 15.9351 13.364 15.9204 13.3626 15.9058C13.3609 15.8873 13.3588 15.869 13.3561 15.8505C13.354 15.8372 13.3516 15.8239 13.3491 15.8106C13.3455 15.7918 13.3416 15.7731 13.3369 15.7544C13.3335 15.7409 13.3296 15.7275 13.3256 15.7141C13.3205 15.6967 13.3151 15.6793 13.309 15.662C13.3035 15.6466 13.2973 15.6314 13.2911 15.6162C13.2851 15.6016 13.2792 15.5871 13.2725 15.5727C13.264 15.5545 13.2545 15.5367 13.2449 15.519C13.2405 15.5108 13.237 15.5024 13.2323 15.4943C13.2305 15.4912 13.2283 15.4884 13.2265 15.4854C13.2154 15.4665 13.2031 15.4482 13.1907 15.43C13.1841 15.4203 13.1777 15.4102 13.1708 15.4007C13.1588 15.3844 13.1458 15.3689 13.1328 15.3533C13.124 15.3427 13.1156 15.3319 13.1065 15.3218C13.0951 15.3093 13.0829 15.2975 13.0709 15.2855C13.0589 15.2735 13.0471 15.2612 13.0346 15.2499C13.0245 15.2409 13.0137 15.2324 13.0031 15.2237C12.9875 15.2106 12.972 15.1976 12.9557 15.1857C12.9462 15.1787 12.9362 15.1723 12.9264 15.1657C12.9082 15.1533 12.8899 15.1411 12.871 15.1299C12.868 15.1281 12.8652 15.1259 12.8621 15.1241L9.51743 13.1931C9.03361 12.9137 8.41499 13.0795 8.13568 13.5633C7.85637 14.0471 8.02212 14.6657 8.50594 14.945L10.3333 16.0001L8.50594 17.0552C8.02212 17.3345 7.85637 17.9531 8.13568 18.4369C8.41499 18.9207 9.03361 19.0864 9.51743 18.8071L12.8621 16.8761C12.8652 16.8742 12.868 16.8721 12.871 16.8702C12.8899 16.8591 12.9082 16.8469 12.9264 16.8345C12.9362 16.8278 12.9462 16.8215 12.9557 16.8145C12.972 16.8025 12.9875 16.7895 13.0031 16.7765C13.0137 16.7678 13.0245 16.7593 13.0346 16.7502C13.047 16.7389 13.0589 16.7267 13.0709 16.7146C13.0829 16.7026 13.0951 16.6908 13.1065 16.6783C13.1156 16.6683 13.124 16.6574 13.1328 16.647C13.1458 16.6313 13.1588 16.6158 13.1708 16.5994C13.1777 16.59 13.1841 16.5799 13.1907 16.5701C13.2031 16.5519 13.2154 16.5337 13.2265 16.5148C13.2284 16.5117 13.2305 16.5089 13.2323 16.5058C13.237 16.4978 13.2405 16.4894 13.2449 16.4812C13.2545 16.4634 13.264 16.4457 13.2725 16.4274C13.2792 16.413 13.2851 16.3985 13.2911 16.3839Z' fill='white'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M14.0865 18.115C13.8427 18.115 13.6192 18.2012 13.4445 18.3448L10.2359 20.1973C9.7521 20.4766 9.58635 21.0952 9.86566 21.579C10.145 22.0628 10.7636 22.2286 11.2474 21.9493L13.075 20.8941V22.9886C13.075 23.5472 13.5278 24.0001 14.0865 24.0001C14.6451 24.0001 15.098 23.5472 15.098 22.9886V19.1265C15.098 18.5679 14.6451 18.115 14.0865 18.115Z' fill='white'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M21.7068 20.1973L18.4982 18.3448C18.3235 18.2012 18.0999 18.115 17.8562 18.115C17.2976 18.115 16.8447 18.5679 16.8447 19.1265V22.9886C16.8447 23.5472 17.2976 24.0001 17.8562 24.0001C18.4148 24.0001 18.8677 23.5472 18.8677 22.9886V20.8941L20.6953 21.9493C21.1791 22.2286 21.7977 22.0628 22.0771 21.579C22.3564 21.0952 22.1906 20.4766 21.7068 20.1973Z' fill='white'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M23.4368 17.0551L21.6094 16.0001L23.4368 14.945C23.9206 14.6657 24.0864 14.0471 23.8071 13.5633C23.5277 13.0795 22.9091 12.9137 22.4253 13.1931L19.0807 15.1241C19.0775 15.1259 19.0748 15.1281 19.0717 15.1299C19.0528 15.1411 19.0345 15.1533 19.0163 15.1657C19.0066 15.1723 18.9965 15.1787 18.987 15.1857C18.9707 15.1977 18.9552 15.2107 18.9396 15.2236C18.9291 15.2324 18.9183 15.2408 18.9081 15.2499C18.8956 15.2612 18.8839 15.2735 18.8718 15.2855C18.8598 15.2975 18.8476 15.3093 18.8362 15.3218C18.8271 15.332 18.8187 15.3428 18.8099 15.3532C18.797 15.3689 18.784 15.3844 18.772 15.4007C18.765 15.4102 18.7587 15.4202 18.752 15.43C18.7396 15.4482 18.7274 15.4664 18.7162 15.4853C18.7144 15.4885 18.7122 15.4912 18.7104 15.4943C18.7058 15.5024 18.7022 15.5108 18.6978 15.519C18.6882 15.5367 18.6788 15.5545 18.6703 15.5727C18.6635 15.5871 18.6576 15.6017 18.6516 15.6162C18.6454 15.6314 18.6392 15.6465 18.6338 15.662C18.6276 15.6793 18.6223 15.6966 18.6171 15.7141C18.6132 15.7275 18.6092 15.7409 18.6059 15.7544C18.6012 15.7731 18.5972 15.7918 18.5936 15.8107C18.5911 15.824 18.5887 15.8372 18.5867 15.8505C18.5839 15.869 18.5818 15.8874 18.5801 15.9058C18.5787 15.9204 18.5776 15.9351 18.5768 15.9498C18.576 15.9666 18.5757 15.9833 18.5757 16.0001C18.5757 16.0168 18.576 16.0336 18.5768 16.0503C18.5776 16.0651 18.5787 16.0797 18.5801 16.0944C18.5818 16.1128 18.5839 16.1312 18.5867 16.1496C18.5887 16.163 18.5911 16.1762 18.5936 16.1895C18.5972 16.2083 18.6012 16.227 18.6059 16.2458C18.6092 16.2593 18.6132 16.2726 18.6171 16.286C18.6223 16.3035 18.6276 16.3208 18.6338 16.3381C18.6392 16.3536 18.6454 16.3687 18.6516 16.3839C18.6576 16.3985 18.6635 16.413 18.6703 16.4274C18.6788 16.4457 18.6882 16.4635 18.6978 16.4812C18.7022 16.4893 18.7058 16.4978 18.7104 16.5058C18.7122 16.5089 18.7144 16.5117 18.7162 16.5148C18.7274 16.5337 18.7396 16.552 18.752 16.5701C18.7587 16.5799 18.765 16.59 18.772 16.5994C18.784 16.6157 18.797 16.6313 18.81 16.6469C18.8188 16.6574 18.8271 16.6682 18.8362 16.6783C18.8476 16.6908 18.8598 16.7026 18.8719 16.7147C18.8839 16.7267 18.8956 16.7389 18.9081 16.7502C18.9183 16.7593 18.9291 16.7678 18.9396 16.7765C18.9552 16.7895 18.9707 16.8025 18.987 16.8145C18.9965 16.8215 19.0066 16.8278 19.0163 16.8345C19.0345 16.8469 19.0528 16.8591 19.0717 16.8703C19.0748 16.8721 19.0775 16.8742 19.0807 16.8761L22.4253 18.8071C22.9091 19.0864 23.5277 18.9207 23.8071 18.4369C24.0864 17.9531 23.9206 17.3344 23.4368 17.0551Z' fill='white'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M22.0771 10.421C21.7977 9.93725 21.1791 9.77145 20.6953 10.0508L18.8677 11.1059V9.0115C18.8677 8.45287 18.4149 8 17.8562 8C17.2976 8 16.8447 8.45287 16.8447 9.0115V12.8736C16.8447 13.4322 17.2976 13.8851 17.8562 13.8851C18.0999 13.8851 18.3235 13.7988 18.4982 13.6552L21.7068 11.8027C22.1906 11.5235 22.3564 10.9048 22.0771 10.421Z' fill='white'/%3E%3C/g%3E%3Cdefs%3E%3CclipPath id='clip0_428_18531'%3E%3Crect width='16' height='16' fill='white' transform='translate(8 8)'/%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E"
DEFAULT_USER_IMAGE = "https://miro.medium.com/v2/resize:fit:1400/format:webp/1*WG_wkTeaK3FdevXHNLxSTA.jpeg"


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
    participants: List[ChatUserInfo] | Dict[str, str | None] | str | None
) -> List[ChatUserInfo]:
    if participants is None:
        return [
            ChatUser(role="user", avatar=DEFAULT_USER_IMAGE, background="grey"),
            ChatUser(role="assistant", avatar=DEFAULT_ASSISTANT_IMAGE),
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
    participants: List[ChatUserInfo] | Dict[str, str | None] | None = None,
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

    def add_message(self, participant: ChatUserInfo, *content):
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
    participants: List[ChatUserInfo] | Dict[str, str | None] | None = None,
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
            for message in chat_container.chat_state.messages:  # type: ignore
                if isinstance(message["participant"], str):
                    message_participant = chat_container.chat_participants[  # type: ignore
                        message["participant"]
                    ]
                else:
                    message_participant = message["participant"]
                if not message_participant["hidden"]:
                    _display_chat_message(
                        chat_container, message_participant, *message.get("content", [])
                    )

    return chat_container
