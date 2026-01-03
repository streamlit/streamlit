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

from __future__ import annotations

from dataclasses import dataclass
from textwrap import dedent
from typing import TYPE_CHECKING, TypeAlias, cast

from streamlit.elements.lib.file_uploader_utils import enforce_filename_restriction
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import LayoutConfig, validate_width
from streamlit.elements.lib.policies import (
    check_widget_policies,
    maybe_raise_label_warnings,
)
from streamlit.elements.lib.utils import (
    Key,
    LabelVisibility,
    compute_and_register_element_id,
    get_label_visibility_proto_value,
    to_key,
)
from streamlit.elements.widgets.file_uploader import _get_upload_files
from streamlit.errors import StreamlitAPIException
from streamlit.proto.AudioInput_pb2 import AudioInput as AudioInputProto
from streamlit.proto.Common_pb2 import FileUploaderState as FileUploaderStateProto
from streamlit.proto.Common_pb2 import UploadedFileInfo as UploadedFileInfoProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.runtime.uploaded_file_manager import DeletedFile, UploadedFile

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import WidthWithoutContent

SomeUploadedAudioFile: TypeAlias = UploadedFile | DeletedFile | None

# Allowed sample rates for audio recording
ALLOWED_SAMPLE_RATES = {8000, 11025, 16000, 22050, 24000, 32000, 44100, 48000}


@dataclass
class AudioInputSerde:
    def serialize(
        self,
        audio_file: SomeUploadedAudioFile,
    ) -> FileUploaderStateProto:
        state_proto = FileUploaderStateProto()

        if audio_file is None or isinstance(audio_file, DeletedFile):
            return state_proto

        file_info: UploadedFileInfoProto = state_proto.uploaded_file_info.add()
        file_info.file_id = audio_file.file_id
        file_info.name = audio_file.name
        file_info.size = audio_file.size
        file_info.file_urls.CopyFrom(audio_file._file_urls)

        return state_proto

    def deserialize(
        self, ui_value: FileUploaderStateProto | None
    ) -> SomeUploadedAudioFile:
        upload_files = _get_upload_files(ui_value)
        return_value = None if len(upload_files) == 0 else upload_files[0]
        if return_value is not None and not isinstance(return_value, DeletedFile):
            enforce_filename_restriction(return_value.name, [".wav"])
        return return_value


class AudioInputMixin:
    @gather_metrics("audio_input")
    def audio_input(
        self,
        label: str,
        *,
        sample_rate: int | None = 16000,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> UploadedFile | None:
        r"""Display a widget that returns an audio recording from the user's microphone.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this widget is used for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, Links,
            and Images. Images display like icons, with a max height equal to
            the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            For accessibility reasons, you should never set an empty label, but
            you can hide it with ``label_visibility`` if needed. In the future,
            we may disallow empty labels by raising an exception.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        sample_rate : int or None
            The target sample rate for the audio recording in Hz. This
            defaults to ``16000``, which is optimal for speech recognition.

            The following values are supported: ``8000`` (telephone quality),
            ``11025``, ``16000`` (speech-recognition quality), ``22050``,
            ``24000``, ``32000``, ``44100``, ``48000`` (high-quality), or
            ``None``. If this is ``None``, the widget uses the browser's
            default sample rate (typically 44100 or 48000 Hz).

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. No two widgets may have the same key.

        help : str or None
            A tooltip that gets displayed next to the widget label. Streamlit
            only displays the tooltip when ``label_visibility="visible"``. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        on_change : callable
            An optional callback invoked when this audio input's value
            changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean that disables the audio input if set to
            ``True``. Default is ``False``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.
            If this is ``"collapsed"``, Streamlit displays no label or spacer.

        width : "stretch" or int
            The width of the audio input widget. This can be one of the following:

            - ``"stretch"`` (default): The width of the widget matches the
              width of the parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

        Returns
        -------
        None or UploadedFile
            The ``UploadedFile`` class is a subclass of ``BytesIO``, and
            therefore is "file-like". This means you can pass an instance of it
            anywhere a file is expected. The MIME type for the audio data is
            ``audio/wav``.

            .. Note::
                The resulting ``UploadedFile`` is subject to the size
                limitation configured in ``server.maxUploadSize``. If you
                expect large sound files, update the configuration option
                appropriately.

        Examples
        --------
        *Example 1:* Record a voice message and play it back.*

        The default sample rate of 16000 Hz is optimal for speech recognition.

        >>> import streamlit as st
        >>>
        >>> audio_value = st.audio_input("Record a voice message")
        >>>
        >>> if audio_value:
        ...     st.audio(audio_value)

        .. output::
           https://doc-audio-input.streamlit.app/
           height: 260px

        *Example 2:* Record high-fidelity audio and play it back.*

        Higher sample rates can create higher-quality, larger audio files. This
        might require a nicer microphone to fully appreciate the difference.

        >>> import streamlit as st
        >>>
        >>> audio_value = st.audio_input("Record high quality audio", sample_rate=48000)
        >>>
        >>> if audio_value:
        ...     st.audio(audio_value)

        .. output::
           https://doc-audio-input-high-rate.streamlit.app/
           height: 260px

        """
        # Validate sample_rate parameter
        if sample_rate is not None and sample_rate not in ALLOWED_SAMPLE_RATES:
            raise StreamlitAPIException(
                f"Invalid sample_rate: {sample_rate}. "
                f"Must be one of {sorted(ALLOWED_SAMPLE_RATES)} Hz, or None for browser default."
            )

        ctx = get_script_run_ctx()
        return self._audio_input(
            label=label,
            sample_rate=sample_rate,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            label_visibility=label_visibility,
            width=width,
            ctx=ctx,
        )

    def _audio_input(
        self,
        label: str,
        sample_rate: int | None = 16000,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
        ctx: ScriptRunContext | None = None,
    ) -> UploadedFile | None:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=None,
            writes_allowed=False,
        )
        maybe_raise_label_warnings(label, label_visibility)

        element_id = compute_and_register_element_id(
            "audio_input",
            user_key=key,
            # Treat the provided key as the main identity.
            key_as_main_identity=True,
            dg=self.dg,
            label=label,
            help=help,
            width=width,
            sample_rate=sample_rate,
        )

        audio_input_proto = AudioInputProto()
        audio_input_proto.id = element_id
        audio_input_proto.label = label
        audio_input_proto.form_id = current_form_id(self.dg)
        audio_input_proto.disabled = disabled
        audio_input_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        # Set sample_rate in protobuf if specified
        if sample_rate is not None:
            audio_input_proto.sample_rate = sample_rate

        if label and help is not None:
            audio_input_proto.help = dedent(help)

        validate_width(width)
        layout_config = LayoutConfig(width=width)

        serde = AudioInputSerde()

        audio_input_state = register_widget(
            audio_input_proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="file_uploader_state_value",
        )

        self.dg._enqueue("audio_input", audio_input_proto, layout_config=layout_config)

        if isinstance(audio_input_state.value, DeletedFile):
            return None
        return audio_input_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
