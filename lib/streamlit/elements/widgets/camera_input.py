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
from typing import TYPE_CHECKING, Final, Literal, TypeAlias, cast

from streamlit.elements.lib.file_uploader_utils import enforce_filename_restriction
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import create_layout_config
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
from streamlit.proto.CameraInput_pb2 import CameraInput as CameraInputProto
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

SomeUploadedSnapshotFile: TypeAlias = UploadedFile | DeletedFile | None

CameraInputResolution: TypeAlias = Literal["480p", "720p", "1080p"]

_RESOLUTION_TO_HEIGHT: Final[dict[str, int]] = {
    "480p": 480,
    "720p": 720,
    "1080p": 1080,
}


@dataclass
class CameraInputSerde:
    def serialize(
        self,
        snapshot: SomeUploadedSnapshotFile,
    ) -> FileUploaderStateProto:
        state_proto = FileUploaderStateProto()

        if snapshot is None or isinstance(snapshot, DeletedFile):
            return state_proto

        file_info: UploadedFileInfoProto = state_proto.uploaded_file_info.add()
        file_info.file_id = snapshot.file_id
        file_info.name = snapshot.name
        file_info.size = snapshot.size
        file_info.file_urls.CopyFrom(snapshot._file_urls)

        return state_proto

    def deserialize(
        self, ui_value: FileUploaderStateProto | None
    ) -> SomeUploadedSnapshotFile:
        upload_files = _get_upload_files(ui_value)
        return_value = None if len(upload_files) == 0 else upload_files[0]
        if return_value is not None and not isinstance(return_value, DeletedFile):
            enforce_filename_restriction(return_value.name, [".jpg"])
        return return_value


class CameraInputMixin:
    @gather_metrics("camera_input")
    def camera_input(
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
        resolution: CameraInputResolution | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> UploadedFile | None:
        r"""Display a widget that returns pictures from the user's webcam.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this widget is used for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, Links,
            and Images. Images display like icons, with a max height equal to
            the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Common block-level Markdown (headings,
            lists, blockquotes) is automatically escaped and displays as
            literal text in labels.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            For accessibility reasons, you should never set an empty label, but
            you can hide it with ``label_visibility`` if needed. In the future,
            we may disallow empty labels by raising an exception.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        key : str, int, or None
            An optional string or integer to use as the unique key for
            the widget. If this is ``None`` (default), a key will be
            generated for the widget based on the values of the other
            parameters. No two widgets may have the same key. Assigning
            a key stabilizes the widget's identity and preserves its
            state across reruns even when other parameters change.

            A key lets you access the widget's value via
            ``st.session_state[key]`` (read-only). For more details, see
            `Widget behavior
            <https://docs.streamlit.io/develop/concepts/architecture/widget-behavior>`_.

            Additionally, if ``key`` is provided, it will be used as a
            CSS class name prefixed with ``st-key-``.

        help : str or None
            A tooltip that gets displayed next to the widget label. Streamlit
            only displays the tooltip when ``label_visibility="visible"``. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        on_change : callable
            An optional callback invoked when this camera_input's value
            changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean that disables the camera input if set to
            ``True``. Default is ``False``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.
            If this is ``"collapsed"``, Streamlit displays no label or spacer.

        resolution : "480p", "720p", "1080p", or None
            The capture resolution to request from the user's camera. Resolution
            presets set the target image height in pixels; the width is determined
            by the camera's native aspect ratio. This can be one of the following:

            - ``None`` (default): Streamlit captures at a resolution determined by
              the widget's display size.
            - ``"480p"``: Target a height of 480 pixels.
            - ``"720p"``: Target a height of 720 pixels.
            - ``"1080p"``: Target a height of 1080 pixels.

            The value is a request, not a guarantee. Cameras support a fixed set of
            resolutions, so the browser selects the closest supported resolution and
            the returned image may differ from the requested height. If you need
            exact dimensions, resize the captured image after capture (for example,
            with ``PIL.Image.resize``).

        width : "stretch" or int
            The width of the camera input widget. This can be one of the
            following:

            - ``"stretch"`` (default): The width of the widget matches the
              width of the parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

        Returns
        -------
        None or UploadedFile
            The UploadedFile class is a subclass of BytesIO, and therefore is
            "file-like". This means you can pass an instance of it anywhere a
            file is expected.

        Examples
        --------
        *Example 1:* Capture a photo and display it.

        >>> import streamlit as st
        >>>
        >>> enable = st.checkbox("Enable camera")
        >>> picture = st.camera_input("Take a picture", disabled=not enable)
        >>>
        >>> if picture:
        ...     st.image(picture)

        .. output::
           https://doc-camera-input.streamlit.app/
           height: 600px

        *Example 2:* Capture a photo at 720p resolution.

        >>> import streamlit as st
        >>>
        >>> picture = st.camera_input("Scan QR code", resolution="720p")
        >>>
        >>> if picture:
        ...     st.image(picture)

        """
        if resolution is not None and resolution not in _RESOLUTION_TO_HEIGHT:
            raise StreamlitAPIException(
                f"Invalid resolution: {resolution!r}. "
                f"Must be one of {list(_RESOLUTION_TO_HEIGHT)}, or None."
            )

        ctx = get_script_run_ctx()
        return self._camera_input(
            label=label,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            label_visibility=label_visibility,
            resolution=resolution,
            width=width,
            ctx=ctx,
        )

    def _camera_input(
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
        resolution: CameraInputResolution | None = None,
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
            "camera_input",
            user_key=key,
            key_as_main_identity=True,
            dg=self.dg,
            label=label,
            help=help,
            width=width,
            resolution=resolution,
        )

        camera_input_proto = CameraInputProto()
        camera_input_proto.id = element_id
        camera_input_proto.label = label
        camera_input_proto.form_id = current_form_id(self.dg)
        camera_input_proto.disabled = disabled
        camera_input_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if resolution is not None:
            camera_input_proto.resolution_height = _RESOLUTION_TO_HEIGHT[resolution]

        if help is not None:
            camera_input_proto.help = dedent(help)

        layout_config = create_layout_config(width=width)

        serde = CameraInputSerde()

        camera_input_state = register_widget(
            camera_input_proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="file_uploader_state_value",
        )

        self.dg._enqueue(
            "camera_input", camera_input_proto, layout_config=layout_config
        )

        if isinstance(camera_input_state.value, DeletedFile):
            return None
        return camera_input_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """The associated DeltaGenerator."""
        return cast("DeltaGenerator", self)
