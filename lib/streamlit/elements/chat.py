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

from typing import TYPE_CHECKING, cast, Tuple

from typing_extensions import Literal

from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import is_emoji
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.elements.image import image_to_url, WidthBehaviour, AtomicImage


if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


def _process_avatar_input(
    avatar: Literal["user", "assistant"] | str | AtomicImage | None = None
) -> Tuple[BlockProto.ChatMessage.AvatarType.ValueType, str]:
    AvatarType = BlockProto.ChatMessage.AvatarType

    if avatar is None:
        return AvatarType.ICON, ""
    elif isinstance(avatar, str) and avatar in ["user", "assistant"]:
        return AvatarType.ICON, avatar
    elif isinstance(avatar, str) and is_emoji(avatar):
        return AvatarType.EMOJI, avatar
    else:
        # TODO(lukasmasuch): Pure SVGs are not yet supported here.
        # They have a special handling in `st.image` and might require some refactoring.
        return AvatarType.IMAGE, image_to_url(
            avatar,
            width=WidthBehaviour.ORIGINAL,
            clamp=False,
            channels="RGB",
            output_format="auto",
            image_id="",
        )


class ChatMixin:
    @gather_metrics("chat_message")
    def chat_message(
        self,
        label: Literal["user", "assistant"] | str,
        *,
        avatar: Literal["user", "assistant"] | str | AtomicImage | None = None,
        background: bool | None = None,
    ) -> "DeltaGenerator":
        if avatar is None and label.lower() in ["user", "assistant"]:
            # For selected labels, we are mapping the label to an avatar
            avatar = label.lower()
        avatar_type, converted_avatar = _process_avatar_input(avatar)

        message_container_proto = BlockProto.ChatMessage()
        message_container_proto.label = label
        message_container_proto.avatar = converted_avatar
        message_container_proto.avatar_type = avatar_type
        if background or (background is None and label == "user"):
            message_container_proto.background = "grey"
        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.chat_message.CopyFrom(message_container_proto)

        return self.dg._block(block_proto=block_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
