# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from streamlit.type_util import Key, to_key
from textwrap import dedent
from typing import Optional, cast, List

import streamlit
from streamlit.proto.CameraInput_pb2 import (
    CameraInput as CameraInputProto,
)

from streamlit.script_run_context import get_script_run_ctx
from streamlit.state.widgets import register_widget
from streamlit.state.session_state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
)

from ..proto.Common_pb2 import (
    FileUploaderState as FileUploaderStateProto,
    UploadedFileInfo as UploadedFileInfoProto,
)
from ..uploaded_file_manager import UploadedFile, UploadedFileRec

from .form import current_form_id
from .utils import check_callback_rules, check_session_state_rules

SomeUploadedSnapshotFile = Optional[UploadedFile]


class CameraInputMixin:
    def camera_input(
        self,
        label: str,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
    ) -> SomeUploadedSnapshotFile:
        """Display a widget that returns pictures from the user's webcam.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this widget is used for.

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        help : str
            A tooltip that gets displayed next to the camera input.

        on_change : callable
            An optional callback invoked when this camera_input's value
            changes.

        args : tuple
            An optional tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean, which disables the camera input if set to
            True. The default is False. This argument can only be supplied by
            keyword.

        Returns
        -------
        None or UploadedFile
            The UploadedFile class is a subclass of BytesIO, and therefore
            it is "file-like". This means you can pass them anywhere where
            a file is expected.

        Examples
        -------
        >>> import streamlit as st
        >>>
        >>> picture = st.camera_input("Take a picture")
        >>>
        >>> if picture:
        ...     st.image(picture)

        """
        key = to_key(key)
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(default_value=None, key=key, writes_allowed=False)

        camera_input_proto = CameraInputProto()
        camera_input_proto.label = label
        camera_input_proto.form_id = current_form_id(self.dg)
        camera_input_proto.disabled = disabled

        if help is not None:
            camera_input_proto.help = dedent(help)

        def serialize_camera_image_input(
            snapshot: SomeUploadedSnapshotFile,
        ) -> FileUploaderStateProto:
            state_proto = FileUploaderStateProto()

            ctx = get_script_run_ctx()
            if ctx is None:
                return state_proto

            # ctx.uploaded_file_mgr._file_id_counter stores the id to use for
            # the *next* uploaded file, so the current highest file id is the
            # counter minus 1.
            state_proto.max_file_id = ctx.uploaded_file_mgr._file_id_counter - 1

            if not snapshot:
                return state_proto

            file_info: UploadedFileInfoProto = state_proto.uploaded_file_info.add()
            file_info.id = snapshot.id
            file_info.name = snapshot.name
            file_info.size = snapshot.size

            return state_proto

        def deserialize_camera_image_input(
            ui_value: Optional[FileUploaderStateProto], widget_id: str
        ) -> SomeUploadedSnapshotFile:
            file_recs = self._get_file_recs_for_camera_input_widget(widget_id, ui_value)

            if len(file_recs) == 0:
                return_value = None
            else:
                return_value = UploadedFile(file_recs[0])
            return return_value

        widget_value, _ = register_widget(
            "camera_input",
            camera_input_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_camera_image_input,
            serializer=serialize_camera_image_input,
        )

        ctx = get_script_run_ctx()
        camera_image_input_state = serialize_camera_image_input(widget_value)

        uploaded_shapshot_info = camera_image_input_state.uploaded_file_info

        if ctx is not None and len(uploaded_shapshot_info) != 0:
            newest_file_id = camera_image_input_state.max_file_id
            active_file_ids = [f.id for f in uploaded_shapshot_info]

            ctx.uploaded_file_mgr.remove_orphaned_files(
                session_id=ctx.session_id,
                widget_id=camera_input_proto.id,
                newest_file_id=newest_file_id,
                active_file_ids=active_file_ids,
            )

        self.dg._enqueue("camera_input", camera_input_proto)
        return cast(SomeUploadedSnapshotFile, widget_value)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)

    @staticmethod
    def _get_file_recs_for_camera_input_widget(
        widget_id: str, widget_value: Optional[FileUploaderStateProto]
    ) -> List[UploadedFileRec]:
        if widget_value is None:
            return []

        ctx = get_script_run_ctx()
        if ctx is None:
            return []

        uploaded_file_info = widget_value.uploaded_file_info
        if len(uploaded_file_info) == 0:
            return []

        active_file_ids = [f.id for f in uploaded_file_info]

        # Grab the files that correspond to our active file IDs.
        return ctx.uploaded_file_mgr.get_files(
            session_id=ctx.session_id,
            widget_id=widget_id,
            file_ids=active_file_ids,
        )
