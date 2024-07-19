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
from textwrap import dedent
from typing import TYPE_CHECKING, Union, cast

from typing_extensions import TypeAlias

from streamlit.elements.form import current_form_id
from streamlit.elements.lib.policies import (
    check_widget_policies,
    maybe_raise_label_warnings,
)
from streamlit.elements.lib.utils import (
    Key,
    LabelVisibility,
    get_label_visibility_proto_value,
    to_key,
)
from streamlit.elements.widgets.file_uploader import _get_upload_files
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
from streamlit.runtime.state.common import compute_widget_id
from streamlit.runtime.uploaded_file_manager import DeletedFile, UploadedFile

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

SomeUploadedAudioFile: TypeAlias = Union[UploadedFile, DeletedFile, None]


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
        self, ui_value: FileUploaderStateProto | None, widget_id: str
    ) -> SomeUploadedAudioFile:
        upload_files = _get_upload_files(ui_value)
        if len(upload_files) == 0:
            return_value = None
        else:
            return_value = upload_files[0]
        return return_value


class AudioInputMixin:
    @gather_metrics("audio_input")
    def audio_input(
        self,
        label: str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> UploadedFile | None:
        """TODO[kajarenc]ADD DOCSTRINGS HERE"""
        ctx = get_script_run_ctx()
        return self._audio_input(
            label=label,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            label_visibility=label_visibility,
            ctx=ctx,
        )

    def _audio_input(
        self,
        label: str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
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

        id = compute_widget_id(
            "audio_input",
            user_key=key,
            label=label,
            key=key,
            help=help,
            form_id=current_form_id(self.dg),
            page=ctx.active_script_hash if ctx else None,
        )

        audio_input_proto = AudioInputProto()
        audio_input_proto.id = id
        audio_input_proto.label = label
        audio_input_proto.form_id = current_form_id(self.dg)
        audio_input_proto.disabled = disabled
        audio_input_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if help is not None:
            audio_input_proto.help = dedent(help)

        serde = AudioInputSerde()

        audio_input_state = register_widget(
            "audio_input",
            audio_input_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
        )

        self.dg._enqueue("audio_input", audio_input_proto)

        if isinstance(audio_input_state.value, DeletedFile):
            return None
        return audio_input_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
