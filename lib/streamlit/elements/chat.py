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

from typing import TYPE_CHECKING, cast

from typing_extensions import Literal

from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import is_emoji
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.elements.image import image_to_url, WidthBehaviour, AtomicImage


if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class ChatMixin:
    @gather_metrics("chat_message")
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

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
