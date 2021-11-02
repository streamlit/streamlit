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
from typing import Optional, cast

import streamlit
from streamlit.proto.CameraImageInput_pb2 import (
    CameraImageInput as CameraImageInputProto,
)
from streamlit.state.widgets import register_widget
from streamlit.state.session_state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
)
from .form import current_form_id
from .utils import check_callback_rules, check_session_state_rules


class CameraImageInputMixin:
    def camera_image_input(
        self,
        label: str,
        value: Optional[str] = None,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
    ) -> str:
        """Display camera image input widget."""
        key = to_key(key)
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(default_value=value, key=key)

        if not value or not isinstance(value, str):
            value = "NOne"

        camera_image_input_proto = CameraImageInputProto()
        camera_image_input_proto.label = label
        camera_image_input_proto.value = value
        camera_image_input_proto.default = str(value)
        camera_image_input_proto.form_id = current_form_id(self.dg)
        if help is not None:
            camera_image_input_proto.help = dedent(help)

        def deserialize_camera_image_input(
            ui_value: Optional[str], widget_id: str = ""
        ) -> str:
            return str(ui_value if ui_value is not None else value)

        current_value, set_frontend_value = register_widget(
            "camera_image_input",
            camera_image_input_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_camera_image_input,
            serializer=str,
        )

        if set_frontend_value:
            camera_image_input_proto.value = current_value
            camera_image_input_proto.set_value = True

        self.dg._enqueue("camera_image_input", camera_image_input_proto)
        return cast(str, current_value)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
