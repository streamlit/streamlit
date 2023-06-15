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
from streamlit.string_util import is_emoji
from streamlit.elements.utils import check_callback_rules
from streamlit.elements.form import is_in_form
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.ChatInput_pb2 import ChatInput as ChatInputProto
from streamlit.proto.Common_pb2 import StringTriggerValue as StringTriggerValueProto
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.elements.image import image_to_url, WidthBehaviour, AtomicImage
from streamlit.elements import chat_api_prototypes
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.type_util import Key, to_key

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

FORM_DOCS_INFO: Final = """

For more information, refer to the
[documentation for forms](https://docs.streamlit.io/library/api-reference/control-flow/st.form).
"""


@dataclass
class ChatInputSerde:
    def deserialize(
        self, ui_value: Optional[StringTriggerValueProto], widget_id: str = ""
    ) -> str | None:
        if ui_value is None or not ui_value.HasField("data"):
            return None
        return ui_value.data

    def serialize(self, v: str | None) -> StringTriggerValueProto:
        return StringTriggerValueProto(data=v)


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

    def chat_message(
        self,
        label: Literal["user", "assistant"] | str,
        *,
        avatar: Literal["user", "assistant"] | str | AtomicImage | None = None,
        background: bool | None = None,
    ) -> "DeltaGenerator":
        AVATAR_TYPES = BlockProto.ChatMessage.AvatarType

        converted_avatar: str
        if avatar is None:
            avatar_type = AVATAR_TYPES.ICON
            converted_avatar = "user" if label == "user" else "assistant"
        elif isinstance(avatar, str) and avatar in ["user", "assistant"]:
            avatar_type = AVATAR_TYPES.ICON
            converted_avatar = avatar
        elif isinstance(avatar, str) and is_emoji(avatar):
            avatar_type = AVATAR_TYPES.EMOJI
            converted_avatar = avatar
        else:
            # Try to convert the value into an image URL:
            avatar_type = AVATAR_TYPES.IMAGE
            # TODO(lukasmasuch): Pure SVGs are have a special handling in marshall_images
            converted_avatar = image_to_url(
                avatar,
                width=WidthBehaviour.ORIGINAL,
                clamp=False,
                channels="RGB",
                output_format="auto",
                image_id="",
            )

        message_container_proto = BlockProto.ChatMessage()
        message_container_proto.label = label
        message_container_proto.avatar = converted_avatar
        message_container_proto.avatar_type = avatar_type
        if background:
            message_container_proto.background = "grey"
        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.chat_message.CopyFrom(message_container_proto)

        return self.dg._block(block_proto=block_proto)

    # TODO: @gather_metrics("chat_input")
    def chat_input(
        self,
        placeholder: str | None = None,
        *,
        default: str | None = None,
        key: Key | None = None,
        max_chars: int | None = None,
        disabled: bool = False,
        position: Literal["inline", "bottom"] | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
    ) -> str | None:
        key = to_key(key)
        check_callback_rules(self.dg, on_change)

        in_main_dg = False

        # We omit this check for scripts running outside streamlit, because
        # they will have no script_run_ctx.
        if runtime.exists():
            if is_in_form(self.dg):
                # It doesn't make sense to create a chat_input inside a form.
                # We throw an error to warn the user about this.
                raise StreamlitAPIException(
                    f"`st.chat_input()` can't be used in an `st.form()`. {FORM_DOCS_INFO}"
                )
            if self.dg._active_dg == self.dg._main_dg:
                in_main_dg = True

        if position is None:
            position = "bottom" if in_main_dg else "inline"

        # TODO(lukasmasuch): Should we really do this?:
        # if not in_main_dg and position == "bottom":
        #     raise StreamlitAPIException(
        #         "`st.chat_input()` with position='bottom' can only be used in the main container."
        #     )

        chat_input_proto = ChatInputProto()
        if placeholder is not None:
            chat_input_proto.placeholder = str(placeholder)

        if max_chars is not None:
            chat_input_proto.max_chars = max_chars

        chat_input_proto.default = default if default is not None else ""
        # chat inputs can't be in forms
        chat_input_proto.form_id = ""
        chat_input_proto.position = position

        ctx = get_script_run_ctx()
        serde = ChatInputSerde()
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

        # If the widget value was changed by the user via the session state,
        # we return None here. This should only put the configured value into
        # the chat input on the frontend but should not automatically trigger the value.
        return None if widget_state.value_changed else widget_state.value

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
