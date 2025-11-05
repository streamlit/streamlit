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

from dataclasses import dataclass
from textwrap import dedent
from typing import TYPE_CHECKING, Literal, TypeAlias, cast, overload

from streamlit import config
from streamlit.elements.lib.file_uploader_utils import (
    enforce_filename_restriction,
    normalize_upload_file_type,
)
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    WidthWithoutContent,
    validate_width,
)
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
from streamlit.proto.Common_pb2 import FileUploaderState as FileUploaderStateProto
from streamlit.proto.Common_pb2 import UploadedFileInfo as UploadedFileInfoProto
from streamlit.proto.FileUploader_pb2 import FileUploader as FileUploaderProto
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
    from collections.abc import Sequence

    from streamlit.delta_generator import DeltaGenerator

SomeUploadedFiles: TypeAlias = (
    UploadedFile | DeletedFile | list[UploadedFile | DeletedFile] | None
)

# Type alias for accept_multiple_files parameter.
# If True, multiple files can be uploaded.
# If False, only a single file can be uploaded.
# If set to the literal "directory", users can upload an entire directory (folder) of files.
AcceptMultipleFiles: TypeAlias = bool | Literal["directory"]


def _get_upload_files(
    widget_value: FileUploaderStateProto | None,
) -> list[UploadedFile | DeletedFile]:
    if widget_value is None:
        return []

    ctx = get_script_run_ctx()
    if ctx is None:
        return []

    uploaded_file_info = widget_value.uploaded_file_info
    if len(uploaded_file_info) == 0:
        return []

    file_recs_list = ctx.uploaded_file_mgr.get_files(
        session_id=ctx.session_id,
        file_ids=[f.file_id for f in uploaded_file_info],
    )

    file_recs = {f.file_id: f for f in file_recs_list}

    collected_files: list[UploadedFile | DeletedFile] = []

    for f in uploaded_file_info:
        maybe_file_rec = file_recs.get(f.file_id)
        if maybe_file_rec is not None:
            uploaded_file = UploadedFile(maybe_file_rec, f.file_urls)
            collected_files.append(uploaded_file)
        else:
            collected_files.append(DeletedFile(f.file_id))

    return collected_files


@dataclass
class FileUploaderSerde:
    accept_multiple_files: AcceptMultipleFiles
    allowed_types: Sequence[str] | None = None

    def deserialize(self, ui_value: FileUploaderStateProto | None) -> SomeUploadedFiles:
        upload_files = _get_upload_files(ui_value)

        for file in upload_files:
            if isinstance(file, DeletedFile):
                continue

            if self.allowed_types:
                enforce_filename_restriction(file.name, self.allowed_types)

        # Directory uploads always return a list, similar to multiple files
        is_multiple_or_directory = (
            self.accept_multiple_files is True
            or self.accept_multiple_files == "directory"
        )

        if len(upload_files) == 0:
            return_value: SomeUploadedFiles = [] if is_multiple_or_directory else None
        else:
            return_value = upload_files if is_multiple_or_directory else upload_files[0]
        return return_value

    def serialize(self, files: SomeUploadedFiles) -> FileUploaderStateProto:
        state_proto = FileUploaderStateProto()

        if not files:
            return state_proto
        if not isinstance(files, list):
            files = [files]

        for f in files:
            if isinstance(f, DeletedFile):
                continue
            file_info: UploadedFileInfoProto = state_proto.uploaded_file_info.add()
            file_info.file_id = f.file_id
            file_info.name = f.name
            file_info.size = f.size
            file_info.file_urls.CopyFrom(f._file_urls)

        return state_proto


class FileUploaderMixin:
    # Multiple overloads are defined on `file_uploader()` below to represent
    # the different return types of `file_uploader()`.
    # These return types differ according to the value of the `accept_multiple_files` argument.
    # There must be 2x2=4 overloads to cover all the possible arguments,
    # as these overloads must be mutually exclusive for mypy.
    # There are 3 associated variables, each with 2+ options.
    # 1. The `accept_multiple_files` argument is set as `True` or `"directory"`,
    #    or it is set as `False` or omitted, in which case the default value `False`.
    # 2. The `type` argument may or may not be provided as a keyword-only argument.
    # 3. Directory uploads always return a list of UploadedFile objects.

    # 1. type is given as not a keyword-only argument
    # 2. accept_multiple_files = True or "directory"
    @overload
    def file_uploader(
        self,
        label: str,
        type: str | Sequence[str] | None,
        accept_multiple_files: Literal[True, "directory"],
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> list[UploadedFile]: ...

    # 1. type is given as not a keyword-only argument
    # 2. accept_multiple_files = False or omitted
    @overload
    def file_uploader(
        self,
        label: str,
        type: str | Sequence[str] | None,
        accept_multiple_files: Literal[False] = False,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> UploadedFile | None: ...

    # The following 2 overloads represent the cases where
    # the `type` argument is a keyword-only argument.
    # See https://github.com/python/mypy/issues/4020#issuecomment-737600893
    # for the related discussions and examples.

    # 1. type is skipped or a keyword argument
    # 2. accept_multiple_files = True or "directory"
    @overload
    def file_uploader(
        self,
        label: str,
        *,
        accept_multiple_files: Literal[True, "directory"],
        type: str | Sequence[str] | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> list[UploadedFile]: ...

    # 1. type is skipped or a keyword argument
    # 2. accept_multiple_files = False or omitted
    @overload
    def file_uploader(
        self,
        label: str,
        *,
        accept_multiple_files: Literal[False] = False,
        type: str | Sequence[str] | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> UploadedFile | None: ...

    @gather_metrics("file_uploader")
    def file_uploader(
        self,
        label: str,
        type: str | Sequence[str] | None = None,
        accept_multiple_files: AcceptMultipleFiles = False,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> UploadedFile | list[UploadedFile] | None:
        r"""Display a file uploader widget.
        By default, uploaded files are limited to 200 MB each. You can
        configure this using the ``server.maxUploadSize`` config option. For
        more information on how to set config options, see |config.toml|_.

        .. |config.toml| replace:: ``config.toml``
        .. _config.toml: https://docs.streamlit.io/develop/api-reference/configuration/config.toml

        Parameters
        ----------
        label : str
            A short label explaining to the user what this file uploader is for.
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

        type : str, list of str, or None
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

        accept_multiple_files : bool or "directory"
            Whether to accept more than one file in a submission. This can be one
            of the following values:

            - ``False`` (default): The user can only submit one file at a time.
            - ``True``: The user can upload multiple files at the same time.
            - ``"directory"``: The user can select a directory to upload all
              files in the directory and its subdirectories. If ``type`` is
              set, only files matching those type(s) will be uploaded.

            When this is ``True`` or ``"directory"``, the return value will be
            a list and a user can additively select files if they click the
            browse button on the widget multiple times.

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
            An optional callback invoked when this file_uploader's value
            changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean that disables the file uploader if set to
            ``True``. The default is ``False``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.
            If this is ``"collapsed"``, Streamlit displays no label or spacer.

        width : "stretch" or int
            The width of the file uploader widget. This can be one of the
            following:

            - ``"stretch"`` (default): The width of the widget matches the
              width of the parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

        Returns
        -------
        None, UploadedFile, or list of UploadedFile
            - If accept_multiple_files is ``False``, returns either ``None`` or
              an ``UploadedFile`` object.
            - If accept_multiple_files is ``True`` or ``"directory"``, returns
              a list with the uploaded files as ``UploadedFile`` objects. If no
              files were uploaded, returns an empty list.

            The ``UploadedFile`` class is a subclass of ``BytesIO``, and
            therefore is "file-like". This means you can pass an instance of it
            anywhere a file is expected.

        Examples
        --------
        **Example 1: Accept a single file at a time**

        >>> import streamlit as st
        >>> import pandas as pd
        >>> from io import StringIO
        >>>
        >>> uploaded_file = st.file_uploader("Choose a file")
        >>> if uploaded_file is not None:
        ...     # To read file as bytes:
        ...     bytes_data = uploaded_file.getvalue()
        ...     st.write(bytes_data)
        >>>
        ...     # To convert to a string based IO:
        ...     stringio = StringIO(uploaded_file.getvalue().decode("utf-8"))
        ...     st.write(stringio)
        >>>
        ...     # To read file as string:
        ...     string_data = stringio.read()
        ...     st.write(string_data)
        >>>
        ...     # Can be used wherever a "file-like" object is accepted:
        ...     dataframe = pd.read_csv(uploaded_file)
        ...     st.write(dataframe)

        **Example 2: Accept multiple files at a time**

        >>> import pandas as pd
        >>> import streamlit as st
        >>>
        >>> uploaded_files = st.file_uploader(
        ...     "Upload data", accept_multiple_files=True, type="csv"
        ... )
        >>> for uploaded_file in uploaded_files:
        ...     df = pd.read_csv(uploaded_file)
        ...     st.write(df)

        .. output::
           https://doc-file-uploader.streamlit.app/
           height: 375px

        **Example 3: Accept an entire directory**

        >>> import streamlit as st
        >>>
        >>> uploaded_files = st.file_uploader(
        ...     "Upload images", accept_multiple_files="directory", type=["jpg", "png"]
        ... )
        >>> for uploaded_file in uploaded_files:
        ...     st.image(uploaded_file)

        .. output::
           https://doc-file-uploader-directory.streamlit.app/
           height: 375px

        """
        ctx = get_script_run_ctx()
        return self._file_uploader(
            label=label,
            type=type,
            accept_multiple_files=accept_multiple_files,
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

    def _file_uploader(
        self,
        label: str,
        type: str | Sequence[str] | None = None,
        accept_multiple_files: AcceptMultipleFiles = False,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        label_visibility: LabelVisibility = "visible",
        disabled: bool = False,
        ctx: ScriptRunContext | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> UploadedFile | list[UploadedFile] | None:
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
            "file_uploader",
            user_key=key,
            key_as_main_identity=False,
            dg=self.dg,
            label=label,
            type=type,
            accept_multiple_files=accept_multiple_files,
            help=help,
            width=width,
        )

        normalized_type = normalize_upload_file_type(type) if type else None

        file_uploader_proto = FileUploaderProto()
        file_uploader_proto.id = element_id
        file_uploader_proto.label = label
        file_uploader_proto.type[:] = (
            normalized_type if normalized_type is not None else []
        )
        file_uploader_proto.max_upload_size_mb = config.get_option(
            "server.maxUploadSize"
        )
        # Handle directory uploads - they should enable multiple files and set the directory flag
        is_directory_upload = accept_multiple_files == "directory"
        file_uploader_proto.multiple_files = (
            accept_multiple_files is True or is_directory_upload
        )
        file_uploader_proto.accept_directory = is_directory_upload
        file_uploader_proto.form_id = current_form_id(self.dg)
        file_uploader_proto.disabled = disabled
        file_uploader_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if help is not None:
            file_uploader_proto.help = dedent(help)

        serde = FileUploaderSerde(accept_multiple_files, allowed_types=normalized_type)

        # FileUploader's widget value is a list of file IDs
        # representing the current set of files that this uploader should
        # know about.
        widget_state = register_widget(
            file_uploader_proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="file_uploader_state_value",
        )

        validate_width(width)
        layout_config = LayoutConfig(width=width)

        self.dg._enqueue(
            "file_uploader", file_uploader_proto, layout_config=layout_config
        )

        if isinstance(widget_state.value, DeletedFile):
            return None
        if isinstance(widget_state.value, list):
            return [f for f in widget_state.value if not isinstance(f, DeletedFile)]

        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
