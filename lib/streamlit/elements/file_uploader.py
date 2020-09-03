from streamlit import config

from streamlit.proto.FileUploader_pb2 import FileUploader as FileUploaderProto
from streamlit.report_thread import get_report_ctx
from streamlit.file_util import get_encoded_file_data
from streamlit.errors import StreamlitDeprecationWarning
from .utils import NoValue, _set_widget_id


class FileUploaderMixin:
    def file_uploader(dg, label, type=None, key=None, **kwargs):
        """Display a file uploader widget.

        By default, uploaded files are limited to 200MB. You can configure
        this using the `server.maxUploadSize` config option.

        Parameters
        ----------
        label : str or None
            A short label explaining to the user what this file uploader is for.
        type : str or list of str or None
            Array of allowed extensions. ['png', 'jpg']
            By default, all extensions are allowed.
        encoding : str or None
            The encoding to use when opening textual files (i.e. non-binary).
            For example: 'utf-8'. If set to 'auto', will try to guess the
            encoding. If None, will assume the file is binary.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        BytesIO or StringIO or or list of BytesIO/StringIO or None
            If no file has been uploaded, returns None. Otherwise, returns
            the data for the uploaded file(s):
            - If the file is in a well-known textual format (or if the encoding
            parameter is set), the file data is a StringIO.
            - Otherwise the file data is BytesIO.
            - If multiple_files is True, a list of file data will be returned.

            Note that BytesIO/StringIO are "file-like", which means you can
            pass them anywhere where a file is expected!

        Examples
        --------
        >>> uploaded_file = st.file_uploader("Choose a CSV file", type="csv")
        >>> if uploaded_file is not None:
        ...     data = pd.read_csv(uploaded_file)
        ...     st.write(data)

        """
        # Don't release this just yet. (When ready to release, turn test back
        # on at file_uploader_test.py)
        accept_multiple_files = False

        if isinstance(type, str):
            type = [type]

        encoding = kwargs.get("encoding")
        has_encoding = "encoding" in kwargs
        show_deprecation_warning = config.get_option(
            "deprecation.showfileUploaderEncoding"
        )

        if show_deprecation_warning and (
            (has_encoding and encoding is not None) or not has_encoding
        ):
            dg.exception(FileUploaderEncodingWarning())  # type: ignore

        if not has_encoding:
            encoding = "auto"

        file_uploader_proto = FileUploaderProto()
        file_uploader_proto.label = label
        file_uploader_proto.type[:] = type if type is not None else []
        file_uploader_proto.max_upload_size_mb = config.get_option(
            "server.maxUploadSize"
        )
        file_uploader_proto.multiple_files = accept_multiple_files
        _set_widget_id("file_uploader", file_uploader_proto, user_key=key)

        files = None
        ctx = get_report_ctx()
        if ctx is not None:
            files = ctx.uploaded_file_mgr.get_files(
                session_id=ctx.session_id, widget_id=file_uploader_proto.id
            )

        if files is None:
            return_value = NoValue
        else:
            file_datas = [get_encoded_file_data(file.data, encoding) for file in files]
            return_value = file_datas if accept_multiple_files else file_datas[0]
        return dg._enqueue("file_uploader", file_uploader_proto, return_value)  # type: ignore


class FileUploaderEncodingWarning(StreamlitDeprecationWarning):
    def __init__(self):
        msg = self._get_message()
        config_option = "deprecation.showfileUploaderEncoding"
        super(FileUploaderEncodingWarning, self).__init__(
            msg=msg, config_option=config_option
        )

    def _get_message(self):
        return """
The behavior of `st.file_uploader` will soon change to no longer autodetect
the file's encoding. This means that _all files_ will be returned as binary buffers.

This change will go in effect after August 15, 2020.

If you are expecting a text buffer, you can future-proof your code now by
wrapping the returned buffer in a [`TextIOWrapper`](https://docs.python.org/3/library/io.html#io.TextIOWrapper),
as shown below:

```
import io

file_buffer = st.file_uploader(...)
text_io = io.TextIOWrapper(file_buffer)
```
            """
