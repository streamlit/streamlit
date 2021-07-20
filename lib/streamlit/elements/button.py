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
import os

from typing import Optional, cast

import streamlit
from streamlit import type_util
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Button_pb2 import Button as ButtonProto
from streamlit.media_file_manager import media_file_manager
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
[documentation for forms](https://docs.streamlit.io/api.html#form).
"""


class ButtonMixin:
    def button(
        self,
        label,
        key=None,
        help=None,
        on_click=None,
        args=None,
        kwargs=None,
    ) -> bool:
        """Display a button widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this button is for.
        key : str
            An optional string to use as the unique key for the widget.
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
        label: str = "Download",
        data=None,
        file_name: Optional[str] = None,
        mime: Optional[str] = None,
        key: Optional[str] = None,
        help: Optional[str] = None,
        on_click: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
    ) -> bool:
        download_button_proto = DownloadButtonProto()

        download_button_proto.label = label
        download_button_proto.default = False

        marshall_file(
            self.dg._get_delta_path_str(), data, download_button_proto, mime, file_name
        )
        if file_name is not None:
            download_button_proto.file_name = file_name

        if help is not None:
            button_proto.help = help

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
            button_proto.help = help

        def deserialize_button(ui_value, widget_id=""):
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


def marshall_file(coordinates, data, proto_download_button, mimetype, filename=None):
    if isinstance(data, str):
        # Assume it's a filename or string data. Allow OS-based file errors.
        if os.path.isfile(data):
            with open(data, "rb") as fh:
                this_file = media_file_manager.add(
                    fh.read(),
                    mimetype or "application/octet-stream",
                    coordinates,
                    filename=filename,
                    is_for_static_download=True,
                )
                proto_download_button.url = this_file.url
                return
        else:
            this_file = media_file_manager.add(
                data.encode(),
                mimetype or "text/plain",
                coordinates,
                filename=filename,
                is_for_static_download=True,
            )
            proto_download_button.url = this_file.url
            return
    if isinstance(data, io.TextIOWrapper):
        my_str = data.read()
        data = my_str.encode()
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
    elif type_util.is_type(data, "numpy.ndarray"):
        data = data.tobytes()
        mimetype = mimetype or "application/octet-stream"
    else:
        raise RuntimeError("Invalid binary data format!!!!!: %s" % type(data))

    this_file = media_file_manager.add(
        data, mimetype, coordinates, filename=filename, is_for_static_download=True
    )
    proto_download_button.url = this_file.url
