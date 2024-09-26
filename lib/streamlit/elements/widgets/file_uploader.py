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
from typing import TYPE_CHECKING, List, Literal, Sequence, Union, cast, overload

from typing_extensions import TypeAlias

from streamlit import config
from streamlit.elements.lib.form_utils import current_form_id
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
    from streamlit.delta_generator import DeltaGenerator

SomeUploadedFiles: TypeAlias = Union[
    UploadedFile,
    DeletedFile,
    List[Union[UploadedFile, DeletedFile]],
    None,
]


TYPE_PAIRS = [
    (".jpg", ".jpeg"),
    (".mpg", ".mpeg"),
    (".mp4", ".mpeg4"),
    (".tif", ".tiff"),
    (".htm", ".html"),
]


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
    accept_multiple_files: bool

    def deserialize(
        self, ui_value: FileUploaderStateProto | None, widget_id: str
    ) -> SomeUploadedFiles:
        upload_files = _get_upload_files(ui_value)

        if len(upload_files) == 0:
            return_value: SomeUploadedFiles = [] if self.accept_multiple_files else None
        else:
            return_value = (
                upload_files if self.accept_multiple_files else upload_files[0]
            )
        return return_value

    def serialize(self, files: SomeUploadedFiles) -> FileUploaderStateProto:
        state_proto = FileUploaderStateProto()

        if not files:
            return state_proto
        elif not isinstance(files, list):
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
    # There are 2 associated variables, each with 2 options.
    # 1. The `accept_multiple_files` argument is set as `True`,
    #    or it is set as `False` or omitted, in which case the default value `False`.
    # 2. The `type` argument may or may not be provided as a keyword-only argument.
    # There must be 2x2=4 overloads to cover all the possible arguments,
    # as these overloads must be mutually exclusive for mypy.

    # 1. type is given as not a keyword-only argument
    # 2. accept_multiple_files = True
    @overload
    def file_uploader(
        self,
        label: str,
        type: str | Sequence[str] | None,
        accept_multiple_files: Literal[True],
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> list[UploadedFile] | None: ...

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
    ) -> UploadedFile | None: ...

    # The following 2 overloads represent the cases where
    # the `type` argument is a keyword-only argument.
    # See https://github.com/python/mypy/issues/4020#issuecomment-737600893
    # for the related discussions and examples.

    # 1. type is skipped or a keyword argument
    # 2. accept_multiple_files = True
    @overload
    def file_uploader(
        self,
        label: str,
        *,
        accept_multiple_files: Literal[True],
        type: str | Sequence[str] | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> list[UploadedFile] | None: ...

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
    ) -> UploadedFile | None: ...

    @gather_metrics("file_uploader")
    def file_uploader(
        self,
        label: str,
        type: str | Sequence[str] | None = None,
        accept_multiple_files: bool = False,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> UploadedFile | list[UploadedFile] | None:
        r"""Display a file uploader widget.
        By default, uploaded files are limited to 200MB. You can configure
        this using the ``server.maxUploadSize`` config option. For more info
        on how to set config options, see
        https://docs.streamlit.io/develop/api-reference/configuration/config.toml

        Parameters
        ----------
        label : str
            A short label explaining to the user what this file uploader is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, and
            Links.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            For accessibility reasons, you should never set an empty label (label="")
            but hide it with label_visibility if needed. In the future, we may disallow
            empty labels by raising an exception.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        type : str or list of str or None
            Array of allowed extensions. ['png', 'jpg']
            The default is None, which means all extensions are allowed.

        accept_multiple_files : bool
            If True, allows the user to upload multiple files at the same time,
            in which case the return value will be a list of files.
            Default: False

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. No two widgets may have the same key.

        help : str
            A tooltip that gets displayed next to the file uploader.

        on_change : callable
            An optional callback invoked when this file_uploader's value
            changes.

        args : tuple
            An optional tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean, which disables the file uploader if set to
            True. The default is False. This argument can only be supplied by
            keyword.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. If "hidden", the label doesn't show but there
            is still empty space for it above the widget (equivalent to label="").
            If "collapsed", both the label and the space are removed. Default is
            "visible".

        Returns
        -------
        None or UploadedFile or list of UploadedFile
            - If accept_multiple_files is False, returns either None or
              an UploadedFile object.
            - If accept_multiple_files is True, returns a list with the
              uploaded files as UploadedFile objects. If no files were
              uploaded, returns an empty list.

            The UploadedFile class is a subclass of BytesIO, and therefore is
            "file-like". This means you can pass an instance of it anywhere a
            file is expected.

        Examples
        --------
        Insert a file uploader that accepts a single file at a time:

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

        Insert a file uploader that accepts multiple files at a time:

        >>> import streamlit as st
        >>>
        >>> uploaded_files = st.file_uploader(
        ...     "Choose a CSV file", accept_multiple_files=True
        ... )
        >>> for uploaded_file in uploaded_files:
        ...     bytes_data = uploaded_file.read()
        ...     st.write("filename:", uploaded_file.name)
        ...     st.write(bytes_data)

        .. output::
           https://doc-file-uploader.streamlit.app/
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
            ctx=ctx,
        )

    def _file_uploader(
        self,
        label: str,
        type: str | Sequence[str] | None = None,
        accept_multiple_files: bool = False,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        label_visibility: LabelVisibility = "visible",
        disabled: bool = False,
        ctx: ScriptRunContext | None = None,
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
            form_id=current_form_id(self.dg),
            label=label,
            type=type,
            accept_multiple_files=accept_multiple_files,
            help=help,
        )

        if type:
            if isinstance(type, str):
                type = [type]

            # May need a regex or a library to validate file types are valid
            # extensions.
            type = [
                file_type if file_type[0] == "." else f".{file_type}"
                for file_type in type
            ]

            type = [t.lower() for t in type]

            for x, y in TYPE_PAIRS:
                if x in type and y not in type:
                    type.append(y)
                if y in type and x not in type:
                    type.append(x)

        file_uploader_proto = FileUploaderProto()
        file_uploader_proto.id = element_id
        file_uploader_proto.label = label
        file_uploader_proto.type[:] = type if type is not None else []
        file_uploader_proto.max_upload_size_mb = config.get_option(
            "server.maxUploadSize"
        )
        file_uploader_proto.multiple_files = accept_multiple_files
        file_uploader_proto.form_id = current_form_id(self.dg)
        file_uploader_proto.disabled = disabled
        file_uploader_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if help is not None:
            file_uploader_proto.help = dedent(help)

        serde = FileUploaderSerde(accept_multiple_files)

        # FileUploader's widget value is a list of file IDs
        # representing the current set of files that this uploader should
        # know about.
        widget_state = register_widget(
            "file_uploader",
            file_uploader_proto,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
        )

        self.dg._enqueue("file_uploader", file_uploader_proto)

        if isinstance(widget_state.value, DeletedFile):
            return None
        elif isinstance(widget_state.value, list):
            return [f for f in widget_state.value if not isinstance(f, DeletedFile)]

        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
