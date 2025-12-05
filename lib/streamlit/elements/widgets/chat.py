# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from collections.abc import Iterator, MutableMapping, Sequence
from dataclasses import dataclass, field
from enum import Enum
from typing import (
    TYPE_CHECKING,
    Any,
    Literal,
    cast,
    overload,
)

from streamlit import config, runtime
from streamlit.delta_generator_singletons import get_dg_singleton_instance
from streamlit.elements.lib.file_uploader_utils import (
    enforce_filename_restriction,
    normalize_upload_file_type,
)
from streamlit.elements.lib.form_utils import is_in_form
from streamlit.elements.lib.image_utils import AtomicImage, image_to_url
from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    Width,
    WidthWithoutContent,
    validate_width,
)
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import (
    Key,
    compute_and_register_element_id,
    get_chat_input_accept_file_proto_value,
    save_for_app_testing,
    to_key,
)
from streamlit.elements.widgets.audio_input import ALLOWED_SAMPLE_RATES
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.ChatInput_pb2 import ChatInput as ChatInputProto
from streamlit.proto.Common_pb2 import ChatInputValue as ChatInputValueProto
from streamlit.proto.Common_pb2 import FileUploaderState as FileUploaderStateProto
from streamlit.proto.Common_pb2 import UploadedFileInfo as UploadedFileInfoProto
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.proto.WidthConfig_pb2 import WidthConfig
from streamlit.runtime.memory_uploaded_file_manager import (
    MemoryUploadedFileManager,
)
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.runtime.state.session_state_proxy import get_session_state
from streamlit.runtime.uploaded_file_manager import DeletedFile, UploadedFile
from streamlit.string_util import is_emoji, validate_material_icon

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


# Audio file validation constants
_ACCEPTED_AUDIO_EXTENSION: str = ".wav"
_ACCEPTED_AUDIO_MIME_TYPES: frozenset[str] = frozenset(
    {
        "audio/wav",
        "audio/wave",
        "audio/x-wav",
    }
)


@dataclass
class ChatInputValue(MutableMapping[str, Any]):
    """Represents the value returned by `st.chat_input` after user interaction.

    This dataclass contains the user's input text, any files uploaded, and optionally
    an audio recording. It provides a dict-like interface for accessing and modifying
    its attributes.

    Attributes
    ----------
    text : str
        The text input provided by the user.
    files : list[UploadedFile]
        A list of files uploaded by the user. Only present when accept_file=True.
    audio : UploadedFile or None, optional
        An audio recording uploaded by the user, if any. Only present when accept_audio=True.

    Notes
    -----
    - Supports dict-like access via `__getitem__`, `__setitem__`, and `__delitem__`.
    - Use `to_dict()` to convert the value to a standard dictionary.
    - The 'files' key is only present when accept_file=True.
    - The 'audio' key is only present when accept_audio=True.
    """

    text: str
    files: list[UploadedFile] = field(default_factory=list)
    audio: UploadedFile | None = None
    _include_files: bool = field(default=False, repr=False, compare=False)
    _include_audio: bool = field(default=False, repr=False, compare=False)
    _included_keys: tuple[str, ...] = field(init=False, repr=False, compare=False)

    def __post_init__(self) -> None:
        """Compute and cache the included keys after initialization."""
        keys: list[str] = ["text"]
        if self._include_files:
            keys.append("files")
        if self._include_audio:
            keys.append("audio")
        object.__setattr__(self, "_included_keys", tuple(keys))

    def _get_included_keys(self) -> tuple[str, ...]:
        """Return tuple of keys that should be exposed based on inclusion flags."""
        return self._included_keys

    def __len__(self) -> int:
        return len(self._get_included_keys())

    def __iter__(self) -> Iterator[str]:
        return iter(self._get_included_keys())

    def __contains__(self, key: object) -> bool:
        if not isinstance(key, str):
            return False
        return key in self._get_included_keys()

    def __getitem__(self, item: str) -> str | list[UploadedFile] | UploadedFile | None:
        if item not in self._get_included_keys():
            raise KeyError(f"Invalid key: {item}")
        try:
            return getattr(self, item)  # type: ignore[no-any-return]
        except AttributeError:
            raise KeyError(f"Invalid key: {item}") from None

    def __getattribute__(self, name: str) -> Any:
        # Intercept access to files/audio when they're excluded
        # Use object.__getattribute__ to avoid infinite recursion
        if name == "files" and not object.__getattribute__(self, "_include_files"):
            raise AttributeError(
                "'ChatInputValue' object has no attribute 'files' (accept_file=False)"
            )
        if name == "audio" and not object.__getattribute__(self, "_include_audio"):
            raise AttributeError(
                "'ChatInputValue' object has no attribute 'audio' (accept_audio=False)"
            )
        # For all other attributes, use normal lookup
        return object.__getattribute__(self, name)

    def __setitem__(self, key: str, value: Any) -> None:
        if key not in self._get_included_keys():
            raise KeyError(f"Invalid key: {key}")
        setattr(self, key, value)

    def __delitem__(self, key: str) -> None:
        if key not in self._get_included_keys():
            raise KeyError(f"Invalid key: {key}")
        try:
            delattr(self, key)
        except AttributeError:
            raise KeyError(f"Invalid key: {key}") from None

    def to_dict(self) -> dict[str, str | list[UploadedFile] | UploadedFile | None]:
        result: dict[str, str | list[UploadedFile] | UploadedFile | None] = {
            "text": self.text
        }
        if self._include_files:
            result["files"] = self.files
        if self._include_audio:
            result["audio"] = self.audio
        return result


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
    AvatarType = BlockProto.ChatMessage.AvatarType  # noqa: N806

    if avatar is None:
        return AvatarType.ICON, ""
    if isinstance(avatar, str) and avatar in {item.value for item in PresetNames}:
        # On the frontend, we only support "assistant" and "user" for the avatar.
        return (
            AvatarType.ICON,
            (
                "assistant"
                if avatar in [PresetNames.AI, PresetNames.ASSISTANT]
                else "user"
            ),
        )
    if isinstance(avatar, str) and is_emoji(avatar):
        return AvatarType.EMOJI, avatar

    if isinstance(avatar, str) and avatar.startswith(":material"):
        return AvatarType.ICON, validate_material_icon(avatar)
    try:
        return AvatarType.IMAGE, image_to_url(
            avatar,
            layout_config=LayoutConfig(width="content"),
            clamp=False,
            channels="RGB",
            output_format="auto",
            image_id=delta_path,
        )
    except Exception as ex:
        raise StreamlitAPIException(
            "Failed to load the provided avatar value as an image."
        ) from ex


def _pop_upload_files(
    files_value: FileUploaderStateProto | None,
) -> list[UploadedFile]:
    if files_value is None:
        return []

    ctx = get_script_run_ctx()
    if ctx is None:
        return []

    uploaded_file_info = files_value.uploaded_file_info
    if len(uploaded_file_info) == 0:
        return []

    file_recs_list = ctx.uploaded_file_mgr.get_files(
        session_id=ctx.session_id,
        file_ids=[f.file_id for f in uploaded_file_info],
    )

    file_recs = {f.file_id: f for f in file_recs_list}

    collected_files: list[UploadedFile] = []

    for f in uploaded_file_info:
        maybe_file_rec = file_recs.get(f.file_id)
        if maybe_file_rec is not None:
            uploaded_file = UploadedFile(maybe_file_rec, f.file_urls)
            collected_files.append(uploaded_file)

            # Remove file from manager after creating UploadedFile object.
            # Only MemoryUploadedFileManager implements remove_file.
            # This explicit type check ensures we only use this cleanup logic
            # with manager types we've explicitly approved.
            if isinstance(ctx.uploaded_file_mgr, MemoryUploadedFileManager):
                ctx.uploaded_file_mgr.remove_file(
                    session_id=ctx.session_id,
                    file_id=f.file_id,
                )

    return collected_files


def _pop_audio_file(
    audio_file_info: UploadedFileInfoProto | None,
) -> UploadedFile | None:
    """Extract and return a single audio file from the protobuf message.

    Similar to _pop_upload_files but handles a single audio file instead of a list.
    Validates that the uploaded file is a WAV file.

    Parameters
    ----------
    audio_file_info : UploadedFileInfoProto or None
        The protobuf message containing information about the uploaded audio file.

    Returns
    -------
    UploadedFile or None
        The extracted audio file if available, None otherwise.

    Raises
    ------
    StreamlitAPIException
        If the uploaded audio file does not have a `.wav` extension or its MIME type is not
        one of the accepted WAV types (`audio/wav`, `audio/wave`, `audio/x-wav`).
    """
    if audio_file_info is None:
        return None

    ctx = get_script_run_ctx()
    if ctx is None:
        return None

    file_recs_list = ctx.uploaded_file_mgr.get_files(
        session_id=ctx.session_id,
        file_ids=[audio_file_info.file_id],
    )

    if len(file_recs_list) == 0:
        return None

    file_rec = file_recs_list[0]
    uploaded_file = UploadedFile(file_rec, audio_file_info.file_urls)

    # Validate that the file is a WAV file by checking extension and MIME type
    if not uploaded_file.name.lower().endswith(_ACCEPTED_AUDIO_EXTENSION):
        raise StreamlitAPIException(
            f"Invalid file extension for audio input: `{uploaded_file.name}`. "
            f"Only WAV files ({_ACCEPTED_AUDIO_EXTENSION}) are accepted."
        )

    # Validate MIME type (browsers may send different variations of WAV MIME types)
    if uploaded_file.type not in _ACCEPTED_AUDIO_MIME_TYPES:
        raise StreamlitAPIException(
            f"Invalid MIME type for audio input: `{uploaded_file.type}`. "
            f"Expected one of {_ACCEPTED_AUDIO_MIME_TYPES}."
        )

    # Remove the file from the manager after creating the UploadedFile object.
    # Only MemoryUploadedFileManager implements remove_file (not part of the
    # UploadedFileManager Protocol). This explicit type check ensures we only
    # use this cleanup logic with manager types we've explicitly approved.
    if audio_file_info and isinstance(ctx.uploaded_file_mgr, MemoryUploadedFileManager):
        ctx.uploaded_file_mgr.remove_file(
            session_id=ctx.session_id,
            file_id=audio_file_info.file_id,
        )

    return uploaded_file


@dataclass
class ChatInputSerde:
    accept_files: bool = False
    accept_audio: bool = False
    allowed_types: Sequence[str] | None = None

    def deserialize(
        self, ui_value: ChatInputValueProto | None
    ) -> str | ChatInputValue | None:
        if ui_value is None or not ui_value.HasField("data"):
            return None
        if not self.accept_files and not self.accept_audio:
            return ui_value.data
        uploaded_files = _pop_upload_files(ui_value.file_uploader_state)
        for file in uploaded_files:
            if self.allowed_types and not isinstance(file, DeletedFile):
                enforce_filename_restriction(file.name, self.allowed_types)

        # Extract audio file separately from the audio_file_info field
        audio_file = _pop_audio_file(
            ui_value.audio_file_info if ui_value.HasField("audio_file_info") else None
        )

        return ChatInputValue(
            text=ui_value.data,
            files=uploaded_files,
            audio=audio_file,
            _include_files=self.accept_files,
            _include_audio=self.accept_audio,
        )

    def serialize(self, v: str | None) -> ChatInputValueProto:
        return ChatInputValueProto(data=v)


class ChatMixin:
    @gather_metrics("chat_message")
    def chat_message(
        self,
        name: Literal["user", "assistant", "ai", "human"] | str,
        *,
        avatar: Literal["user", "assistant"] | str | AtomicImage | None = None,
        width: Width = "stretch",
    ) -> DeltaGenerator:
        """Insert a chat message container.

        To add elements to the returned container, you can use ``with`` notation
        (preferred) or just call methods directly on the returned object. See the
        examples below.

        .. note::
            To follow best design practices and maintain a good appearance on
            all screen sizes, don't nest chat message containers.

        Parameters
        ----------
        name : "user", "assistant", "ai", "human", or str
            The name of the message author. Can be "human"/"user" or
            "ai"/"assistant" to enable preset styling and avatars.

            Currently, the name is not shown in the UI but is only set as an
            accessibility label. For accessibility reasons, you should not use
            an empty string.

        avatar : Anything supported by st.image (except list), str, or None
            The avatar shown next to the message.

            If ``avatar`` is ``None`` (default), the icon will be determined
            from ``name`` as follows:

            - If ``name`` is ``"user"`` or ``"human"``, the message will have a
              default user icon.

            - If ``name`` is ``"ai"`` or ``"assistant"``, the message will have
              a default bot icon.

            - For all other values of ``name``, the message will show the first
              letter of the name.

            In addition to the types supported by |st.image|_ (except list),
            the following strings are valid:

            - A single-character emoji. For example, you can set ``avatar="🧑‍💻"``
              or ``avatar="🦖"``. Emoji short codes are not supported.

            - An icon from the Material Symbols library (rounded style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols \
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.

            - ``"spinner"``: Displays a spinner as an icon.

            .. |st.image| replace:: ``st.image``
            .. _st.image: https://docs.streamlit.io/develop/api-reference/media/st.image

        width : "stretch", "content", or int
            The width of the chat message container. This can be one of the following:

            - ``"stretch"`` (default): The width of the container matches the
              width of the parent container.
            - ``"content"``: The width of the container matches the width of its
              content, but doesn't exceed the width of the parent container.
            - An integer specifying the width in pixels: The container has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the container matches the width
              of the parent container.

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

        .. output::
            https://doc-chat-message-user.streamlit.app/
            height: 450px

        Or you can just call methods directly in the returned objects:

        >>> import streamlit as st
        >>> import numpy as np
        >>>
        >>> message = st.chat_message("assistant")
        >>> message.write("Hello human")
        >>> message.bar_chart(np.random.randn(30, 3))

        .. output::
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

        validate_width(width, allow_content=True)

        message_container_proto = BlockProto.ChatMessage()
        message_container_proto.name = name
        message_container_proto.avatar = converted_avatar
        message_container_proto.avatar_type = avatar_type

        # Set up width configuration
        width_config = WidthConfig()
        if isinstance(width, int):
            width_config.pixel_width = width
        elif width == "content":
            width_config.use_content = True
        else:
            width_config.use_stretch = True

        block_proto = BlockProto()
        block_proto.allow_empty = True
        block_proto.chat_message.CopyFrom(message_container_proto)
        block_proto.width_config.CopyFrom(width_config)

        return self.dg._block(block_proto=block_proto)

    @overload
    def chat_input(
        self,
        placeholder: str = "Your message",
        *,
        key: Key | None = None,
        max_chars: int | None = None,
        accept_file: Literal[False] = False,
        file_type: str | Sequence[str] | None = None,
        accept_audio: Literal[False] = False,
        disabled: bool = False,
        on_submit: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> str | None: ...

    @overload
    def chat_input(
        self,
        placeholder: str = "Your message",
        *,
        key: Key | None = None,
        max_chars: int | None = None,
        accept_file: Literal[False] = False,
        file_type: str | Sequence[str] | None = None,
        accept_audio: Literal[True],
        audio_sample_rate: int | None = 16000,
        disabled: bool = False,
        on_submit: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> ChatInputValue | None: ...

    @overload
    def chat_input(
        self,
        placeholder: str = "Your message",
        *,
        key: Key | None = None,
        max_chars: int | None = None,
        accept_file: Literal[True, "multiple", "directory"],
        file_type: str | Sequence[str] | None = None,
        accept_audio: bool = False,
        audio_sample_rate: int | None = 16000,
        disabled: bool = False,
        on_submit: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> ChatInputValue | None: ...

    @gather_metrics("chat_input")
    def chat_input(
        self,
        placeholder: str = "Your message",
        *,
        key: Key | None = None,
        max_chars: int | None = None,
        accept_file: bool | Literal["multiple", "directory"] = False,
        file_type: str | Sequence[str] | None = None,
        accept_audio: bool = False,
        audio_sample_rate: int | None = 16000,
        disabled: bool = False,
        on_submit: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> str | ChatInputValue | None:
        """Display a chat input widget.

        Parameters
        ----------
        placeholder : str
            A placeholder text shown when the chat input is empty. This
            defaults to ``"Your message"``. For accessibility reasons, you
            should not use an empty string.

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget based on
            its content. No two widgets may have the same key.

        max_chars : int or None
            The maximum number of characters that can be entered. If this is
            ``None`` (default), there will be no maximum.

        accept_file : bool, "multiple", or "directory"
            Whether the chat input should accept files. This can be one of the
            following values:

            - ``False`` (default): No files are accepted and the user can only
              submit a message.
            - ``True``: The user can add a single file to their submission.
            - ``"multiple"``: The user can add multiple files to their
              submission.
            - ``"directory"``: The user can add multiple files to their
              submission by selecting a directory. If ``file_type`` is set,
              only files matching those type(s) will be uploaded.

            By default, uploaded files are limited to 200 MB each. You can
            configure this using the ``server.maxUploadSize`` config option.
            For more information on how to set config options, see
            |config.toml|_.

            .. |config.toml| replace:: ``config.toml``
            .. _config.toml: https://docs.streamlit.io/develop/api-reference/configuration/config.toml

        file_type : str, Sequence[str], or None
            The allowed file extension(s) for uploaded files. This can be one
            of the following types:

            - ``None`` (default): All file extensions are allowed.
            - A string: A single file extension is allowed. For example, to
              only accept CSV files, use ``"csv"``.
            - A sequence of strings: Multiple file extensions are allowed. For
              example, to only accept JPG/JPEG and PNG files, use
              ``["jpg", "jpeg", "png"]``.

            .. note::
                This is a best-effort check, but doesn't provide a
                security guarantee against users uploading files of other types
                or type extensions. The correct handling of uploaded files is
                part of the app developer's responsibility.

        accept_audio : bool
            Whether to show an audio recording button in the chat input. This
            defaults to ``False``. If this is ``True``, users can record and
            submit audio messages. Recorded audio is available as an
            ``UploadedFile`` object with MIME type ``audio/wav``.

        audio_sample_rate : int or None
            The target sample rate for audio recording in Hz when
            ``accept_audio`` is ``True``. This defaults to ``16000``, which is
            optimal for speech recognition.

            The following values are supported: ``8000`` (telephone quality),
            ``11025``, ``16000`` (speech-recognition quality), ``22050``,
            ``24000``, ``32000``, ``44100``, ``48000`` (high-quality), or
            ``None``. If this is ``None``, the widget uses the browser's
            default sample rate (typically 44100 or 48000 Hz).

        disabled : bool
            Whether the chat input should be disabled. This defaults to
            ``False``.

        on_submit : callable
            An optional callback invoked when the chat input's value is submitted.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        width : "stretch" or int
            The width of the chat input widget. This can be one of the
            following:

            - ``"stretch"`` (default): The width of the widget matches the
              width of the parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

        Returns
        -------
        None, str, or dict-like
            The user's submission. This is one of the following types:

            - ``None``: If the user didn't submit a message, file, or audio
              recording in the last rerun, the widget returns ``None``.
            - A string: When the widget isn't configured to accept files or
              audio recordings, and the user submitted a message in the last
              rerun, the widget returns the user's message as a string.
            - A dict-like object: When the widget is configured to accept files
              or audio recordings, and the user submitted any content in the
              last rerun, the widget returns a dict-like object.
              The object always includes the ``text`` attribute, and
              optionally includes ``files`` and/or ``audio`` attributes depending
              on the ``accept_file`` and ``accept_audio`` parameters.

            When the widget is configured to accept files or audio recordings,
            and the user submitted content in the last rerun, you can access
            the user's submission with key or attribute notation from the
            dict-like object. This is shown in Example 3 below.

            - The ``text`` attribute holds a string that is the user's message.
              This is an empty string if the user only submitted one or more
              files or audio recordings.
            - The ``files`` attribute is only present when ``accept_file``
              isn't ``False``. When present, it holds a list of
              ``UploadedFile`` objects. The list is empty if the user only
              submitted a message or audio recording. Unlike
              ``st.file_uploader``, this attribute always returns a list, even
              when the widget is configured to accept only one file at a time.
            - The ``audio`` attribute is only present when ``accept_audio`` is
              ``True``. When present, it holds an ``UploadedFile`` object if
              audio was recorded or ``None`` if no audio was recorded.

            The ``UploadedFile`` class is a subclass of ``BytesIO`` and
            therefore is "file-like". This means you can pass an instance of it
            anywhere a file is expected.

        Examples
        --------
        **Example 1: Pin the chat input widget to the bottom of your app**

        When ``st.chat_input`` is used in the main body of an app, it will be
        pinned to the bottom of the page.

        >>> import streamlit as st
        >>>
        >>> prompt = st.chat_input("Say something")
        >>> if prompt:
        ...     st.write(f"User has sent the following prompt: {prompt}")

        .. output::
            https://doc-chat-input.streamlit.app/
            height: 350px

        **Example 2: Use the chat input widget inline**

        The chat input can also be used inline by nesting it inside any layout
        container (container, columns, tabs, sidebar, etc) or fragment. Create
        chat interfaces embedded next to other content, or have multiple
        chatbots!

        >>> import streamlit as st
        >>>
        >>> with st.sidebar:
        >>>     messages = st.container(height=200)
        >>>     if prompt := st.chat_input("Say something"):
        >>>         messages.chat_message("user").write(prompt)
        >>>         messages.chat_message("assistant").write(f"Echo: {prompt}")

        .. output::
            https://doc-chat-input-inline.streamlit.app/
            height: 350px

        **Example 3: Let users upload files**

        When you configure your chat input widget to allow file attachments, it
        will return a dict-like object when the user sends a submission. You
        can access the user's message through the ``text`` attribute of this
        dictionary. You can access a list of the user's submitted file(s)
        through the ``files`` attribute. Similar to ``st.session_state``, you
        can use key or attribute notation.

        >>> import streamlit as st
        >>>
        >>> prompt = st.chat_input(
        >>>     "Say something and/or attach an image",
        >>>     accept_file=True,
        >>>     file_type=["jpg", "jpeg", "png"],
        >>> )
        >>> if prompt and prompt.text:
        >>>     st.markdown(prompt.text)
        >>> if prompt and prompt["files"]:
        >>>     st.image(prompt["files"][0])

        .. output::
            https://doc-chat-input-file-uploader.streamlit.app/
            height: 350px

        **Example 4: Programmatically set the text via session state**

        You can use ``st.session_state`` to set the text of the chat input widget.

        >>> import streamlit as st
        >>>
        >>> if st.button("Set Value"):
        >>>     st.session_state.chat_input = "Hello, world!"
        >>> st.chat_input(key="chat_input")
        >>> st.write("Chat input value:", st.session_state.chat_input)

        .. output::
            https://doc-chat-input-session-state.streamlit.app/
            height: 350px

        **Example 5: Enable audio recording**

        You can enable audio recording by setting ``accept_audio=True``.
        The ``accept_audio`` parameter works independently of ``accept_file``,
        allowing you to enable audio recording with or without file uploads.

        >>> import streamlit as st
        >>>
        >>> prompt = st.chat_input(
        >>>     "Say or record something",
        >>>     accept_audio=True,
        >>> )
        >>> if prompt and prompt.text:
        >>>     st.write("Text:", prompt.text)
        >>> if prompt and prompt.audio:
        >>>     st.audio(prompt.audio)
        >>>     st.write("Audio file:", prompt.audio.name)

        .. output::
            https://doc-chat-input-audio.streamlit.app/
            height: 350px

        """
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_submit,
            default_value=None,
            writes_allowed=True,
        )

        if accept_file not in {True, False, "multiple", "directory"}:
            raise StreamlitAPIException(
                "The `accept_file` parameter must be a boolean or 'multiple' or 'directory'."
            )

        ctx = get_script_run_ctx()

        element_id = compute_and_register_element_id(
            "chat_input",
            user_key=key,
            # Treat the provided key as the main identity. Only include
            # properties that can invalidate the current widget state
            # when changed. For chat_input, those are:
            # - accept_file: Changes whether files can be attached (and how)
            # - file_type: Restricts the accepted file types
            # - max_chars: Changes the maximum allowed characters for the input
            key_as_main_identity={"accept_file", "file_type", "max_chars"},
            dg=self.dg,
            placeholder=placeholder,
            max_chars=max_chars,
            accept_file=accept_file,
            file_type=file_type,
            accept_audio=accept_audio,
            audio_sample_rate=audio_sample_rate,
            width=width,
        )

        if file_type:
            file_type = normalize_upload_file_type(file_type)

        # Validate audio_sample_rate if provided
        if (
            audio_sample_rate is not None
            and audio_sample_rate not in ALLOWED_SAMPLE_RATES
        ):
            raise StreamlitAPIException(
                f"Invalid audio_sample_rate: {audio_sample_rate}. "
                f"Must be one of {sorted(ALLOWED_SAMPLE_RATES)} Hz, or None for browser default."
            )

        # It doesn't make sense to create a chat input inside a form.
        # We throw an error to warn the user about this.
        # We omit this check for scripts running outside streamlit, because
        # they will have no script_run_ctx.
        if runtime.exists() and is_in_form(self.dg):
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

        # Setting a default value is currently not supported for chat input.
        chat_input_proto.default = ""

        chat_input_proto.accept_file = get_chat_input_accept_file_proto_value(
            accept_file
        )

        chat_input_proto.file_type[:] = file_type if file_type is not None else []
        chat_input_proto.max_upload_size_mb = config.get_option("server.maxUploadSize")
        chat_input_proto.accept_audio = accept_audio

        if audio_sample_rate is not None:
            chat_input_proto.audio_sample_rate = audio_sample_rate

        serde = ChatInputSerde(
            accept_files=accept_file in {True, "multiple", "directory"},
            accept_audio=accept_audio,
            allowed_types=file_type,
        )
        widget_state = register_widget(  # type: ignore[misc]
            chat_input_proto.id,
            on_change_handler=on_submit,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="chat_input_value",
        )

        validate_width(width)
        layout_config = LayoutConfig(width=width)

        chat_input_proto.disabled = disabled
        if widget_state.value_changed and widget_state.value is not None:
            # Support for programmatically setting the text in the chat input
            # via session state. Since chat input has a trigger state,
            # it works a bit differently to other widgets. We are not changing
            # the actual widget state here, but only inserting the provided value
            # into the chat input field. The user needs to submit the value in
            # order for the chat input to reflect the value in the backend state.
            chat_input_proto.value = widget_state.value
            chat_input_proto.set_value = True

            session_state = get_session_state()
            if key is not None and key in session_state:
                # Reset the session state value to None to reflect the actual state
                # of the widget. Which is None since the value hasn't been submitted yet.
                session_state.reset_state_value(key, None)

        if ctx:
            save_for_app_testing(ctx, element_id, widget_state.value)
        if position == "bottom":
            # We need to enqueue the chat input into the bottom container
            # instead of the currently active dg.
            get_dg_singleton_instance().bottom_dg._enqueue(
                "chat_input", chat_input_proto, layout_config=layout_config
            )
        else:
            self.dg._enqueue(
                "chat_input", chat_input_proto, layout_config=layout_config
            )

        return widget_state.value if not widget_state.value_changed else None

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
