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

import io

from streamlit.type_util import Key, to_key
from typing import cast, Optional, Union, BinaryIO, TextIO
from textwrap import dedent

import streamlit
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Button_pb2 import Button as ButtonProto
from streamlit.in_memory_file_manager import in_memory_file_manager
from streamlit.proto.DownloadButton_pb2 import DownloadButton as DownloadButtonProto
from streamlit.state.session_state import (
    WidgetArgs,
    WidgetCallback,
    WidgetDeserializer,
    WidgetKwargs,
)
from streamlit.state.widgets import register_widget
from .form import current_form_id, is_in_form
from .utils import check_callback_rules, check_session_state_rules


FORM_DOCS_INFO = """

For more information, refer to the
[documentation for forms](https://docs.streamlit.io/api.html#streamlit.form).
"""

DownloadButtonDataType = Union[str, bytes, TextIO, BinaryIO]


class ButtonMixin:
    def button(
        self,
        label: str,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_click: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
    ) -> bool:
        """Display a button widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this button is for.
        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            An optional tooltip that gets displayed when the button is
            hovered over.
        on_click : callable
            An optional callback invoked when this button is clicked.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        Returns
        -------
        bool
            If the button was clicked on the last run of the app.

        Example
        -------
        >>> if st.button('Say hello'):
        ...     st.write('Why hello there')
        ... else:
        ...     st.write('Goodbye')

        """
        key = to_key(key)
        return self.dg._button(
            label,
            key,
            help,
            is_form_submitter=False,
            on_click=on_click,
            args=args,
            kwargs=kwargs,
        )

    def download_button(
        self,
        label: str,
        data: DownloadButtonDataType,
        file_name: Optional[str] = None,
        mime: Optional[str] = None,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_click: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
    ) -> bool:
        """Display a download button widget.

        Download button has a few constraints:

        - Download button is designed to download data that is stored in the
          Streamlit server's memory and works best when file size is 
          reasonably small, <50MB.

        - For large file sizes, it is recommended to use a third party 
          cloud based object storage solution.

        - We recommend doing any file transformation operations outside 
          the download button declaration. Caching such transformations 
          also prevents from slowing down the app on every rerun. 
          See the examples below to learn more.

        Parameters
        ----------
        label : str
            A short label explaining to what this button is for.
        data : str or bytes or file
            The contents of the file to be downloaded.
        file_name: str
            An optional string to use as the name of the file to be downloaded,
            eg. 'my_file.csv'. If file name is not specified, then we provide
            a generic name for the download.
        mime : str or None
            The MIME type of the data. If None, defaults to "text/plain" or
            "application/octet-stream" depending on the data type.
        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            An optional tooltip that gets displayed when the button is
            hovered over.
        on_click : callable
            An optional callback invoked when this button is clicked.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        Returns
        -------
        bool
            If the button was clicked on the last run of the app.

        Examples
        --------

        While download button can be used to download arbitrary files, here are
        some common use-cases to get you started.

        Download a large DataFrame:

        >>> @st.cache
        ... def convert_df(df):
        ...   # Cache the conversion to prevent computation on every rerun
        ...	  return df.to_csv().encode('utf-8')
        >>> csv = convert_df(my_large_df)
        >>> st.download_button(
        ...     label="Press to Download",
        ...     data=csv,
        ...     file_name='large_df.csv',
        ...     mime='text/csv',
        ... )

        Download a CSV file:

        >>> text_contents = '''
        ... Col1, Col2
        ... 123, 456
        ... 789, 000
        ... '''
        >>> st.download_button(
        ...     label='Download CSV', data=text_contents,
        ...     file_name='file.csv', mime='text/csv'
        ... )

        Download a binary file:

        >>> binary_contents = b'example content'
        ... # Defaults to 'application/octet-stream'
        >>> st.download_button('Download binary file', binary_contents)

        Download an image:

        >>> with open("flower.png", "rb") as file:
        ...     btn = st.download_button(
        ...             label="Download Image",
        ...             data=file,
        ...             file_name="flower.png",
        ...             mime="image/png"
        ...           )
        """

        key = to_key(key)
        check_session_state_rules(default_value=None, key=key, writes_allowed=False)
        if is_in_form(self.dg):
            raise StreamlitAPIException(
                f"`st.download_button()` can't be used in an `st.form()`.{FORM_DOCS_INFO}"
            )

        download_button_proto = DownloadButtonProto()

        download_button_proto.label = label
        download_button_proto.default = False

        marshall_file(
            self.dg._get_delta_path_str(), data, download_button_proto, mime, file_name
        )

        if help is not None:
            download_button_proto.help = dedent(help)

        def deserialize_button(ui_value, widget_id=""):
            return ui_value or False

        current_value, _ = register_widget(
            "download_button",
            download_button_proto,
            user_key=key,
            on_change_handler=on_click,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_button,
            serializer=bool,
        )
        self.dg._enqueue("download_button", download_button_proto)
        return cast(bool, current_value)

    def _button(
        self,
        label: str,
        key: Optional[str],
        help: Optional[str],
        is_form_submitter: bool,
        on_click: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
    ) -> bool:
        if not is_form_submitter:
            check_callback_rules(self.dg, on_click)
        check_session_state_rules(default_value=None, key=key, writes_allowed=False)

        # It doesn't make sense to create a button inside a form (except
        # for the "Form Submitter" button that's automatically created in
        # every form). We throw an error to warn the user about this.
        # We omit this check for scripts running outside streamlit, because
        # they will have no report_ctx.
        if streamlit._is_running_with_streamlit:
            if is_in_form(self.dg) and not is_form_submitter:
                raise StreamlitAPIException(
                    f"`st.button()` can't be used in an `st.form()`.{FORM_DOCS_INFO}"
                )
            elif not is_in_form(self.dg) and is_form_submitter:
                raise StreamlitAPIException(
                    f"`st.form_submit_button()` must be used inside an `st.form()`.{FORM_DOCS_INFO}"
                )

        button_proto = ButtonProto()
        button_proto.label = label
        button_proto.default = False
        button_proto.is_form_submitter = is_form_submitter
        button_proto.form_id = current_form_id(self.dg)
        if help is not None:
            button_proto.help = dedent(help)

        def deserialize_button(ui_value: bool, widget_id: str = "") -> bool:
            return ui_value or False

        current_value, _ = register_widget(
            "button",
            button_proto,
            user_key=key,
            on_change_handler=on_click,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_button,
            serializer=bool,
        )
        self.dg._enqueue("button", button_proto)
        return cast(bool, current_value)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)


def marshall_file(coordinates, data, proto_download_button, mimetype, file_name=None):
    if isinstance(data, str):
        data = data.encode()
        mimetype = mimetype or "text/plain"
    elif isinstance(data, io.TextIOWrapper):
        string_data = data.read()
        data = string_data.encode()
        mimetype = mimetype or "text/plain"
    # Assume bytes; try methods until we run out.
    elif isinstance(data, bytes):
        mimetype = mimetype or "application/octet-stream"
    elif isinstance(data, io.BytesIO):
        data.seek(0)
        data = data.getvalue()
        mimetype = mimetype or "application/octet-stream"
    elif isinstance(data, io.RawIOBase) or isinstance(data, io.BufferedReader):
        data.seek(0)
        data = data.read()
        mimetype = mimetype or "application/octet-stream"
    else:
        raise RuntimeError("Invalid binary data format: %s" % type(data))

    this_file = in_memory_file_manager.add(
        data, mimetype, coordinates, file_name=file_name, is_for_static_download=True
    )
    proto_download_button.url = this_file.url
