from streamlit import config

from streamlit.proto.FileUploader_pb2 import FileUploader as FileUploaderProto
from streamlit.report_thread import get_report_ctx
from streamlit.file_util import get_encoded_file_data
from streamlit.errors import StreamlitDeprecationWarning
from .utils import NoValue, _set_widget_id


class FileUploaderMixin:
    def file_uploader(
        dg, label, type=None, accept_multiple_files=False, key=None, **kwargs
    ):
        """Display a file uploader widget.
        By default, uploaded files are limited to 200MB. You can configure
        this using the `server.maxUploadSize` config option.

        Parameters
        ----------
        label : str or None
            A short label explaining to the user what this file uploader is for.

        type : str or list of str or None
            Array of allowed extensions. ['png', 'jpg']
            The default is None, which means all extensions are allowed.

        accept_multiple_files : bool
            If True, allows the user to upload multiple files at the same time,
            in which case the return value will be a list of files.
            Default: False

        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        None or UploadedFile or list of UploadedFile
            - If allow_multiple_files is False, returns either None or
              an UploadedFile object.
            - If allow_multiple_files is True, returns a list with the
              uploaded files as UploadedFile objects. If no files were
              uploaded, returns an empty list.
            The UploadedFile class is a subclass of BytesIO, and therefore
            it is "file-like". This means you can pass them anywhere where
            a file is expected.

        Examples
        --------
        Insert a file uploader that accepts a single file at a time:

        >>> uploaded_file = st.file_uploader("Choose a file")
        >>> if uploaded_file is not None:
        ...     # To read file as bytes:
        ...     bytes_data = uploaded_file.read()
        ...     st.write(bytes_data)

        ...     # To convert to a string based IO:
        ...     stringio = StringIO(uploaded_file.decode("utf-8"))
        ...     st.write(stringio)

        ...     # To read file as string:
        ...     string_data = stringio.read()
        ...     st.write(string_data)

        ...     # Can be used wherever a "file-like" object is accepted:
        ...     dataframe = pd.read_csv(uploaded_file)
        ...     st.write(dataframe)

        Insert a file uploader that accepts multiple files at a time:

        >>> uploaded_files = st.file_uploader("Choose a CSV file", accept_multiple_files=True)
        >>> for uploaded_file in uploaded_files:
        ...     bytes_data = uploaded_file.read()
        ...     st.write("filename:", uploaded_file.name)
        ...     st.write(bytes_data)
        """

        if type:
            if isinstance(type, str):
                type = [type]

            # May need a regex or a library to validate file types are valid
            # extensions.
            type = [
                file_type if file_type[0] == "." else f".{file_type}"
                for file_type in type
            ]

        has_encoding = "encoding" in kwargs
        show_deprecation_warning = config.get_option(
            "deprecation.showfileUploaderEncoding"
        )

        if show_deprecation_warning and has_encoding:
            dg.exception(FileUploaderEncodingWarning())  # type: ignore

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

        if files is None or len(files) == 0:
            return_value = [] if accept_multiple_files else NoValue
        else:
            return_value = files if accept_multiple_files else files[0]

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
The behavior of `st.file_uploader` no longer autodetects the file's encoding.
This means that _all files_ will be returned as binary buffers. If you need to
work with a string buffer, you can convert to a StringIO by decoding the binary
buffer as shown below:

```
file_buffer = st.file_uploader(...)
string_io = file_buffer.decode()
```
            """
