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

from enum import Enum
from typing import TYPE_CHECKING, Tuple, cast

from typing_extensions import Literal

from streamlit.elements.image import AtomicImage, WidthBehaviour, image_to_url
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import is_emoji

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class PresetLabels(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


def _process_avatar_input(
    avatar: str | AtomicImage | None = None,
) -> Tuple[BlockProto.ChatMessage.AvatarType.ValueType, str]:
    """Detects the avatar type and prepares the avatar data for the frontend.

    Parameters
    ----------
    avatar :
        The avatar that was provided by the user.

    Returns
    -------
    Tuple[AvatarType, str]
        The detected avatar type and the prepared avatar data.
    """
    AvatarType = BlockProto.ChatMessage.AvatarType

    if avatar is None:
        return AvatarType.ICON, ""
    elif isinstance(avatar, str) and avatar in [
        PresetLabels.USER,
        PresetLabels.ASSISTANT,
    ]:
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
        participant: Literal["user", "assistant"] | str,
        *,
        avatar: Literal["user", "assistant"] | str | AtomicImage | None = None,
    ) -> "DeltaGenerator":
        r"""Insert a container that is styled like a chat message.

        To add elements to the returned container, you can use "with" notation
        (preferred) or just call methods directly on the returned object. See
         examples below.

        Parameters
        ----------
        participant : "user", "assistant", or str
            The name of the chat participant. Can be “user” or “assistant” to enable
            preset styling and avatars. For accessibility reasons, you should not
            use an empty string.
        avatar : str, numpy.ndarray, or BytesIO
            The avatar shown next to the message. Can be one of:

            * A single emoji, e.g. “🧑‍💻”, “🤖”, “🦖”. Shortcodes are not supported.

            * An image using one of the formats allowed for ``st.image``: path of a local
            image file; URL to fetch the image from; array of shape (w,h) or (w,h,1)
            for a monochrome image, (w,h,3) for a color image, or (w,h,4) for an RGBA image.

        Returns
        -------
        Container
            A single container that can hold multiple elements.

        Examples
        --------
        You can use `with` notation to insert any element into an expander

        >>> import streamlit as st
        >>> import numpy as np
        >>>
        >>> with st.chat_message("user"):
        ...     st.write(\"Hello 👋\")
        ...     st.line_chart(np.random.randn(30, 3))

        .. output ::
            https://doc-chat-message-user.streamlit.app/
            height: 450px

        Or you can just call methods directly in the returned objects:

        >>> import streamlit as st
        >>> import numpy as np
        >>>
        >>> message = st.chat_message("assistant"):
        >>> message.write(\"Hello human\")
        >>> message.bar_chart(np.random.randn(30, 3))

        .. output ::
            https://doc-chat-message-assistant.streamlit.app/
            height: 450px

        """
        if participant is None:
            raise StreamlitAPIException("A participant is required for a chat message")

        if avatar is None and (
            participant.lower()
            in [
                PresetLabels.USER,
                PresetLabels.ASSISTANT,
            ]
            or is_emoji(participant)
        ):
            # For selected labels, we are mapping the label to an avatar
            avatar = participant.lower()
        avatar_type, converted_avatar = _process_avatar_input(avatar)

        message_container_proto = BlockProto.ChatMessage()
        message_container_proto.participant = participant
        message_container_proto.avatar = converted_avatar
        message_container_proto.avatar_type = avatar_type
        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.chat_message.CopyFrom(message_container_proto)

        return self.dg._block(block_proto=block_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
