# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
from enum import Enum
from typing import TYPE_CHECKING, Literal, cast

from streamlit import runtime
from streamlit.delta_generator_singletons import get_dg_singleton_instance
from streamlit.elements.image import AtomicImage, WidthBehaviour, image_to_url
from streamlit.elements.lib.form_utils import is_in_form
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import (
    Key,
    compute_and_register_element_id,
    save_for_app_testing,
    to_key,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.ChatInput_pb2 import ChatInput as ChatInputProto
from streamlit.proto.Common_pb2 import StringTriggerValue as StringTriggerValueProto
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.string_util import is_emoji, validate_material_icon

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class PresetNames(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    AI = "ai"  # Equivalent to assistant
    HUMAN = "human"  # Equivalent to user


def _process_avatar_input(
    avatar: str | AtomicImage | None, delta_path: str
) -> tuple[BlockProto.ChatMessage.AvatarType.ValueType, str]:
    """Detects the avatar type and prepares the avatar data for the frontend.

    Parameters
    ----------
    avatar :
        The avatar that was provided by the user.
    delta_path : str
        The delta path is used as media ID when a local image is served via the media
        file manager.

    Returns
    -------
    Tuple[AvatarType, str]
        The detected avatar type and the prepared avatar data.
    """
    AvatarType = BlockProto.ChatMessage.AvatarType

    if avatar is None:
        return AvatarType.ICON, ""
    elif isinstance(avatar, str) and avatar in {item.value for item in PresetNames}:
        # On the frontend, we only support "assistant" and "user" for the avatar.
        return (
            AvatarType.ICON,
            (
                "assistant"
                if avatar in [PresetNames.AI, PresetNames.ASSISTANT]
                else "user"
            ),
        )
    elif isinstance(avatar, str) and is_emoji(avatar):
        return AvatarType.EMOJI, avatar

    elif isinstance(avatar, str) and avatar.startswith(":material"):
        return AvatarType.ICON, validate_material_icon(avatar)
    else:
        try:
            return AvatarType.IMAGE, image_to_url(
                avatar,
                width=WidthBehaviour.ORIGINAL,
                clamp=False,
                channels="RGB",
                output_format="auto",
                image_id=delta_path,
            )
        except Exception as ex:
            raise StreamlitAPIException(
                "Failed to load the provided avatar value as an image."
            ) from ex


@dataclass
class ChatInputSerde:
    def deserialize(
        self, ui_value: StringTriggerValueProto | None, widget_id: str = ""
    ) -> str | None:
        if ui_value is None or not ui_value.HasField("data"):
            return None

        return ui_value.data

    def serialize(self, v: str | None) -> StringTriggerValueProto:
        return StringTriggerValueProto(data=v)


class ChatMixin:
    @gather_metrics("chat_message")
    def chat_message(
        self,
        name: Literal["user", "assistant", "ai", "human"] | str,
        *,
        avatar: Literal["user", "assistant"] | str | AtomicImage | None = None,
    ) -> DeltaGenerator:
        """Insert a chat message container.

        To add elements to the returned container, you can use ``with`` notation
        (preferred) or just call methods directly on the returned object. See the
        examples below.

        Parameters
        ----------
        name : "user", "assistant", "ai", "human", or str
            The name of the message author. Can be "human"/"user" or
            "ai"/"assistant" to enable preset styling and avatars.

            Currently, the name is not shown in the UI but is only set as an
            accessibility label. For accessibility reasons, you should not use
            an empty string.

        avatar : Anything supported by st.image, str, or None
            The avatar shown next to the message.

            If ``avatar`` is ``None`` (default), the icon will be determined
            from ``name`` as follows:

            * If ``name`` is ``"user"`` or ``"human"``, the message will have a
              default user icon.

            * If ``name`` is ``"ai"`` or ``"assistant"``, the message will have
              a default bot icon.

            * For all other values of ``name``, the message will show the first
              letter of the name.

            In addition to the types supported by ``st.image`` (like URLs or numpy
            arrays), the following strings are valid:

            * A single-character emoji. For example, you can set ``avatar="🧑‍💻"``
              or ``avatar="🦖"``. Emoji short codes are not supported.

            * An icon from the Material Symbols library (rounded style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols \
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.

        Returns
        -------
        Container
            A single container that can hold multiple elements.

        Examples
        --------
        You can use ``with`` notation to insert any element into an expander

        >>> import streamlit as st
        >>> import numpy as np
        >>>
        >>> with st.chat_message("user"):
        ...     st.write("Hello 👋")
        ...     st.line_chart(np.random.randn(30, 3))

        .. output ::
            https://doc-chat-message-user.streamlit.app/
            height: 450px

        Or you can just call methods directly in the returned objects:

        >>> import streamlit as st
        >>> import numpy as np
        >>>
        >>> message = st.chat_message("assistant")
        >>> message.write("Hello human")
        >>> message.bar_chart(np.random.randn(30, 3))

        .. output ::
            https://doc-chat-message-user1.streamlit.app/
            height: 450px

        """
        if name is None:
            raise StreamlitAPIException(
                "The author name is required for a chat message, please set it via the parameter `name`."
            )

        if avatar is None and (
            name.lower() in {item.value for item in PresetNames} or is_emoji(name)
        ):
            # For selected labels, we are mapping the label to an avatar
            avatar = name.lower()
        avatar_type, converted_avatar = _process_avatar_input(
            avatar, self.dg._get_delta_path_str()
        )

        message_container_proto = BlockProto.ChatMessage()
        message_container_proto.name = name
        message_container_proto.avatar = converted_avatar
        message_container_proto.avatar_type = avatar_type
        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.chat_message.CopyFrom(message_container_proto)

        return self.dg._block(block_proto=block_proto)

    @gather_metrics("chat_input")
    def chat_input(
        self,
        placeholder: str = "Your message",
        *,
        key: Key | None = None,
        max_chars: int | None = None,
        disabled: bool = False,
        on_submit: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
    ) -> str | None:
        """Display a chat input widget.

        Parameters
        ----------
        placeholder : str
            A placeholder text shown when the chat input is empty. Defaults to
            "Your message". For accessibility reasons, you should not use an
            empty string.

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget based on
            its content. No two widgets may have the same key.

        max_chars : int or None
            The maximum number of characters that can be entered. If ``None``
            (default), there will be no maximum.

        disabled : bool
            Whether the chat input should be disabled. Defaults to ``False``.

        on_submit : callable
            An optional callback invoked when the chat input's value is submitted.

        args : tuple
            An optional tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        Returns
        -------
        str or None
            The current (non-empty) value of the text input widget on the last
            run of the app. Otherwise, ``None``.

        Examples
        --------
        When ``st.chat_input`` is used in the main body of an app, it will be
        pinned to the bottom of the page.

        >>> import streamlit as st
        >>>
        >>> prompt = st.chat_input("Say something")
        >>> if prompt:
        ...     st.write(f"User has sent the following prompt: {prompt}")

        .. output ::
            https://doc-chat-input.streamlit.app/
            height: 350px

        The chat input can also be used inline by nesting it inside any layout
        container (container, columns, tabs, sidebar, etc) or fragment. Create
        chat interfaces embedded next to other content or have multiple
        chatbots!

        >>> import streamlit as st
        >>>
        >>> with st.sidebar:
        >>>     messages = st.container(height=300)
        >>>     if prompt := st.chat_input("Say something"):
        >>>         messages.chat_message("user").write(prompt)
        >>>         messages.chat_message("assistant").write(f"Echo: {prompt}")

        .. output ::
            https://doc-chat-input-inline.streamlit.app/
            height: 350px
        """
        # We default to an empty string here and disallow user choice intentionally
        default = ""
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_submit,
            default_value=default,
            writes_allowed=False,
        )

        ctx = get_script_run_ctx()
        element_id = compute_and_register_element_id(
            "chat_input",
            user_key=key,
            # chat_input is not allowed to be used in a form.
            form_id=None,
            placeholder=placeholder,
            max_chars=max_chars,
        )

        # It doesn't make sense to create a chat input inside a form.
        # We throw an error to warn the user about this.
        # We omit this check for scripts running outside streamlit, because
        # they will have no script_run_ctx.
        if runtime.exists():
            if is_in_form(self.dg):
                raise StreamlitAPIException(
                    "`st.chat_input()` can't be used in a `st.form()`."
                )

        # Determine the position of the chat input:
        # Use bottom position if chat input is within the main container
        # either directly or within a vertical container. If it has any
        # other container types as parents, we use inline position.
        ancestor_block_types = set(self.dg._active_dg._ancestor_block_types)
        if (
            self.dg._active_dg._root_container == RootContainer.MAIN
            and not ancestor_block_types
        ):
            position = "bottom"
        else:
            position = "inline"

        chat_input_proto = ChatInputProto()
        chat_input_proto.id = element_id
        chat_input_proto.placeholder = str(placeholder)

        if max_chars is not None:
            chat_input_proto.max_chars = max_chars

        chat_input_proto.default = default

        serde = ChatInputSerde()
        widget_state = register_widget(
            "chat_input",
            chat_input_proto,
            on_change_handler=on_submit,
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

        if ctx:
            save_for_app_testing(ctx, element_id, widget_state.value)
        if position == "bottom":
            # We need to enqueue the chat input into the bottom container
            # instead of the currently active dg.
            get_dg_singleton_instance().bottom_dg._enqueue(
                "chat_input", chat_input_proto
            )
        else:
            self.dg._enqueue("chat_input", chat_input_proto)

        return widget_state.value if not widget_state.value_changed else None

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
