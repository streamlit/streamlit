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
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Selectbox_pb2 import Selectbox as SelectboxProto
from streamlit.type_util import ensure_iterable
from .utils import register_widget, NoValue
from streamlit.session_state import get_session_state


class SelectboxMixin:
    def selectbox(
        self,
        label,
        options,
        index=None,
        value=None,
        format_func=str,
        key=None,
        on_change=None,
        context=None,
        help=None,
    ):
        """Display a select widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this select widget is for.
        options : list, tuple, numpy.ndarray, pandas.Series, or pandas.DataFrame
            Labels for the select options. This will be cast to str internally
            by default. For pandas.DataFrame, the first column is selected.
        index : int
            The index of the preselected option on first render.
        format_func : function
            Function to modify the display of the labels. It receives the option
            as an argument and its output will be cast to str.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        on_change : callable
            The callable that is invoked when the value changes. The callable
            only has one parameter, the new value.
        help : str
            A tooltip that gets displayed next to the selectbox.

        Returns
        -------
        any
            The selected option

        Example
        -------
        >>> option = st.selectbox(
        ...     'How would you like to be contacted?',
        ...     ('Email', 'Home phone', 'Mobile phone'))
        >>>
        >>> st.write('You selected:', option)

        """
        options = ensure_iterable(options)

        # legacy api compatibility
        if value is None and index is not None:
            value = options[index]

        if key is None:
            key = label

        state = get_session_state()
        force_set_value = value is not None or state.is_new_value(key)

        if value is None:
            value = state[key]
        if value is None:
            value = options[0]

        if value not in options:
            raise StreamlitAPIException(
                f"Selectbox value not in the options list: {value}"
            )

        # if len(options) > 0 and not 0 <= index < len(options):
        #     raise StreamlitAPIException(
        #         "Selectbox index must be between 0 and length of options"
        #     )

        index = options.index(value)

        selectbox_proto = SelectboxProto()
        selectbox_proto.label = label
        selectbox_proto.default = index
        selectbox_proto.options[:] = [str(format_func(option)) for option in options]
        if force_set_value:
            selectbox_proto.value = index
            selectbox_proto.valueSet = True
        if help is not None:
            selectbox_proto.help = help

        def deserialize_select_box(ui_value):
            current_value = ui_value if ui_value is not None else index

            return (
                options[current_value]
                if len(options) > 0 and options[current_value] is not None
                else NoValue
            )

        register_widget(
            "selectbox",
            selectbox_proto,
            user_key=key,
            on_change_handler=on_change,
            context=context,
            deserializer=deserialize_select_box,
        )
        return self.dg._enqueue("selectbox", selectbox_proto, value)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
