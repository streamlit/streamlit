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

from typing import cast

import streamlit
from streamlit.proto.Button_pb2 import Button as ButtonProto
from .utils import register_widget


class ButtonMixin:
    def button(self, label, key=None, on_click=None):
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
        on_click : callable
            The callable that is invoked when the button is clicked, not
            when the return value changes. The callable has no parameters.

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
        button_proto = ButtonProto()

        button_proto.label = label
        button_proto.default = False

        def on_change(new_value):
            if new_value and on_click is not None:
                on_click()

        def deserialize_button(ui_value):
            return ui_value if ui_value is not None else False

        current_value = register_widget(
            "button",
            button_proto,
            user_key=key,
            on_change_handler=on_change,
            deserializer=deserialize_button,
        )
        return self.dg._enqueue("button", button_proto, current_value)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
