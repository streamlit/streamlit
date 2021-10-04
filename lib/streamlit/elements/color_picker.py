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

import re
from streamlit.type_util import Key, to_key
from textwrap import dedent
from typing import Optional, cast

import streamlit
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ColorPicker_pb2 import ColorPicker as ColorPickerProto
from streamlit.state.widgets import register_widget
from streamlit.state.session_state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
)
from .form import current_form_id
from .utils import check_callback_rules, check_session_state_rules


class ColorPickerMixin:
    def color_picker(
        self,
        label: str,
        value: Optional[str] = None,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
    ) -> str:
        """Display a color picker widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
        value : str
            The hex value of this widget when it first renders. If None,
            defaults to black.
        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            An optional tooltip that gets displayed next to the color picker.
        on_change : callable
            An optional callback invoked when this color_picker's value
            changes.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        Returns
        -------
        str
            The selected color as a hex string.

        Example
        -------
        >>> color = st.color_picker('Pick A Color', '#00f900')
        >>> st.write('The current color is', color)

        """
        key = to_key(key)
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(default_value=value, key=key)

        # set value default
        if value is None:
            value = "#000000"

        # make sure the value is a string
        if not isinstance(value, str):
            raise StreamlitAPIException(
                """
                Color Picker Value has invalid type: %s. Expects a hex string
                like '#00FFAA' or '#000'.
                """
                % type(value).__name__
            )

        # validate the value and expects a hex string
        match = re.match(r"^#(?:[0-9a-fA-F]{3}){1,2}$", value)

        if not match:
            raise StreamlitAPIException(
                """
                '%s' is not a valid hex code for colors. Valid ones are like
                '#00FFAA' or '#000'.
                """
                % value
            )

        color_picker_proto = ColorPickerProto()
        color_picker_proto.label = label
        color_picker_proto.default = str(value)
        color_picker_proto.form_id = current_form_id(self.dg)
        if help is not None:
            color_picker_proto.help = dedent(help)

        def deserialize_color_picker(
            ui_value: Optional[str], widget_id: str = ""
        ) -> str:
            return str(ui_value if ui_value is not None else value)

        current_value, set_frontend_value = register_widget(
            "color_picker",
            color_picker_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_color_picker,
            serializer=str,
        )

        if set_frontend_value:
            color_picker_proto.value = current_value
            color_picker_proto.set_value = True

        self.dg._enqueue("color_picker", color_picker_proto)
        return cast(str, current_value)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
