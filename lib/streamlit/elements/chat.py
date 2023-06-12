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

from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional, cast, List, Dict, Any

from typing_extensions import Final, Literal

from streamlit import runtime
from streamlit.elements.utils import check_callback_rules
from streamlit.elements.form import is_in_form
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.ChatInput_pb2 import ChatInput as ChatInputProto
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.elements import chat_api_prototypes
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.type_util import Key, SupportsStr, to_key

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

FORM_DOCS_INFO: Final = """

For more information, refer to the
[documentation for forms](https://docs.streamlit.io/library/api-reference/control-flow/st.form).
"""


@dataclass
class ChatInputSerde:
    value: SupportsStr

    def deserialize(self, ui_value: Optional[str], widget_id: str = "") -> str | None:
        return ui_value

    def serialize(self, v: str | None) -> str | None:
        return v


class ChatMixin:
    def chat_layout(
        self,
        participants: List[chat_api_prototypes.ChatUserInfo | str]
        | Dict[str, str | None]
        | None = None,
    ) -> List[chat_api_prototypes.ChatChildrenDeltaGenerator]:
        return chat_api_prototypes.chat_v3(self.dg, participants)

    def chat_v9(
        self,
        participants: List[chat_api_prototypes.ChatUserInfo | str]
        | Dict[str, str | None]
        | None = None,
        chat_state: chat_api_prototypes.ChatState | str | None = None,
    ) -> "DeltaGenerator":
        return chat_api_prototypes.chat_v9(self.dg, participants, chat_state)

    def chat_message_v9(
        self, participant: str | chat_api_prototypes.ChatUserInfo, *args: Any
    ):
        return chat_api_prototypes.chat_message(self.dg, participant, *args)

    def _chat_message(
        self,
        label: str,
        avatar: str | None = None,
        background: Literal["grey"] | None = None,
    ) -> "DeltaGenerator":
        message_container_proto = BlockProto.ChatMessage()
        message_container_proto.label = label
        message_container_proto.avatar = avatar or ""
        if background:
            message_container_proto.background = background
        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.chat_message.CopyFrom(message_container_proto)

        return self.dg._block(block_proto=block_proto)

    def _chat_container(self) -> "DeltaGenerator":
        if self.dg != self.dg._main_dg:
            raise StreamlitAPIException(
                "st._chat_container() can only be used in the main container"
            )

        chat_container_proto = BlockProto.ChatContainer()

        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.chat_container.CopyFrom(chat_container_proto)

        return self.dg._block(block_proto=block_proto)

    # TODO: @gather_metrics("chat_input")
    def chat_input(
        self,
        placeholder: str | None = None,
        *,
        value: str | None = None,
        key: Key | None = None,
        on_change: WidgetCallback | None = None,
        max_chars: int | None = None,
        disabled: bool = False,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
    ) -> str | None:
        key = to_key(key)
        check_callback_rules(self.dg, on_change)

        if self.dg != self.dg._main_dg:
            raise StreamlitAPIException(
                "st.chat_input() can only be used in the main container"
            )

        # It doesn't make sense to create a chat_input inside a form.
        # We throw an error to warn the user about this.
        # We omit this check for scripts running outside streamlit, because
        # they will have no script_run_ctx.
        if runtime.exists() and is_in_form(self.dg):
            raise StreamlitAPIException(
                f"`st.chat_input()` can't be used in an `st.form()`.{FORM_DOCS_INFO}"
            )

        chat_input_proto = ChatInputProto()
        if placeholder is not None:
            chat_input_proto.placeholder = str(placeholder)

        if max_chars is not None:
            chat_input_proto.max_chars = max_chars

        chat_input_proto.default = value if value is not None else ""
        # chat inputs can't be in forms
        chat_input_proto.form_id = ""

        ctx = get_script_run_ctx()
        serde = ChatInputSerde("")
        widget_state = register_widget(
            "chat_input",
            chat_input_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
        )

        chat_input_proto.disabled = disabled
        if widget_state.value_changed and widget_state.value is not None:
            chat_input_proto.value = widget_state.value
            chat_input_proto.set_value = True

        self.dg._enqueue("chat_input", chat_input_proto)
        return None if widget_state.value_changed else widget_state.value

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
