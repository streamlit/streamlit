# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import contextlib
import threading
from typing import TYPE_CHECKING, Iterator, Literal, Optional, cast

import streamlit as st
from streamlit.elements.alert import validate_emoji
from streamlit.proto.AlertTypeMessage_pb2 import AlertTypeMessage
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.string_util import clean_text

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.type_util import SupportsStr


ALERT_TYPE_MAPPING = {
    "error": AlertTypeMessage.ERROR,
    "warning": AlertTypeMessage.WARNING,
    "info": AlertTypeMessage.INFO,
    "success": AlertTypeMessage.SUCCESS,
}


class ModalAlertMixin:
    @gather_metrics("alert")
    def alert(
        self,
        body: "SupportsStr",
        *,  # keyword-only args:
        title: str = "",
        icon: Optional[str] = None,
        type: Literal["default", "error", "warning", "info", "success"] = "default",
    ) -> "DeltaGenerator":
        from streamlit.proto.Alert_pb2 import Alert
        from streamlit.proto.ModalAlert_pb2 import ModalAlert

        alert_proto = ModalAlert(
            closeable=True,
            title=clean_text(title),
            alert=Alert(
                body=clean_text(body),
                icon=validate_emoji(icon),
                format=ALERT_TYPE_MAPPING.get(type),
            ),
        )

        return self.dg._enqueue("modal_alert", alert_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


@contextlib.contextmanager
def wait(
    body: "SupportsStr",
    *,  # keyword-only args:
    title: str = "",
    icon: Optional[str] = None,
    type: Literal["default", "error", "warning", "info", "success"] = "default",
) -> Iterator[None]:
    from streamlit.elements.spinner import DELAY_SECS
    from streamlit.proto.Alert_pb2 import Alert
    from streamlit.proto.ModalAlert_pb2 import ModalAlert

    message = st.empty()
    display_alert = True
    display_alert_lock = threading.Lock()
    try:

        def set_alert():
            with display_alert_lock:
                if display_alert:
                    alert_proto = ModalAlert(
                        closeable=False,
                        alert=Alert(
                            body=clean_text(body),
                            icon=validate_emoji(icon),
                            format=ALERT_TYPE_MAPPING.get(type),
                        ),
                        title=clean_text(title),
                    )
                    message._enqueue("modal_alert", alert_proto)

        add_script_run_ctx(threading.Timer(DELAY_SECS, set_alert)).start()
        yield
    finally:
        if display_alert_lock:
            with display_alert_lock:
                display_alert = False
        message.empty()
