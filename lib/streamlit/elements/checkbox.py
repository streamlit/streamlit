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
from streamlit.proto.Checkbox_pb2 import Checkbox as CheckboxProto
from .utils import register_widget
from streamlit.session_state import get_session_state


class CheckboxMixin:
    def checkbox(self, label, value=None, key=None, on_change=None, context=None):
        """Display a checkbox widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this checkbox is for.
        value : bool
            Preselect the checkbox when it first renders. This will be
            cast to bool internally.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        on_change : callable
            The callable that is invoked when the value changes. The callable
            only has one parameter, the new value.

        Returns
        -------
        bool
            Whether or not the checkbox is checked.

        Example
        -------
        >>> agree = st.checkbox('I agree')
        >>>
        >>> if agree:
        ...     st.write('Great!')

        """
        if key is None:
            key = label

        state = get_session_state()
        force_set_value = value is not None or state.is_new_value(key)

        # Value not passed in, try to get it from state
        if value is None:
            value = state[key]
        # Value not in state, use default
        if value is None:
            value = False

        value = bool(value)

        checkbox_proto = CheckboxProto()
        checkbox_proto.label = label
        checkbox_proto.default = value
        if force_set_value:
            checkbox_proto.value = value
            checkbox_proto.valueSet = True

        def deserialize_checkbox(ui_value):
            return bool(ui_value if ui_value is not None else value)

        register_widget(
            "checkbox",
            checkbox_proto,
            user_key=key,
            on_change_handler=on_change,
            context=context,
            deserializer=deserialize_checkbox,
        )
        return self.dg._enqueue("checkbox", checkbox_proto, value)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
