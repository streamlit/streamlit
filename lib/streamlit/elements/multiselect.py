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

from textwrap import dedent
from typing import Optional, cast, List

import streamlit
from streamlit.errors import StreamlitAPIException
from streamlit.proto.MultiSelect_pb2 import MultiSelect as MultiSelectProto
from streamlit.state.widgets import register_widget
from streamlit.type_util import Key, OptionSequence, ensure_indexable, is_type, to_key

from streamlit.state.session_state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
)
from .form import current_form_id
from .utils import check_callback_rules, check_session_state_rules


class MultiSelectMixin:
    def multiselect(
        self,
        label: str,
        options: OptionSequence,
        default: Optional[List[str]] = None,
        format_func=str,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
    ) -> List[str]:
        """Display a multiselect widget.
        The multiselect widget starts as empty.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this select widget is for.
        options : Sequence, numpy.ndarray, pandas.Series, pandas.DataFrame, or pandas.Index
            Labels for the select options. This will be cast to str internally
            by default. For pandas.DataFrame, the first column is selected.
        default: [str] or None
            List of default values.
        format_func : function
            Function to modify the display of selectbox options. It receives
            the raw option as an argument and should output the label to be
            shown for that option. This has no impact on the return value of
            the selectbox.
        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            An optional tooltip that gets displayed next to the multiselect.
        on_change : callable
            An optional callback invoked when this multiselect's value changes.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        Returns
        -------
        list
            A list with the selected options

        Example
        -------
        >>> options = st.multiselect(
        ...     'What are your favorite colors',
        ...     ['Green', 'Yellow', 'Red', 'Blue'],
        ...     ['Yellow', 'Red'])
        >>>
        >>> st.write('You selected:', options)

        .. note::
           User experience can be degraded for large lists of `options` (100+), as this widget
           is not designed to handle arbitrary text search efficiently. See this
           `thread <https://discuss.streamlit.io/t/streamlit-loading-column-data-takes-too-much-time/1791>`_
           on the Streamlit community forum for more information and
           `GitHub issue #1059 <https://github.com/streamlit/streamlit/issues/1059>`_ for updates on the issue.

        """
        key = to_key(key)
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(default_value=default, key=key)

        opt = ensure_indexable(options)

        # Perform validation checks and return indices base on the default values.
        def _check_and_convert_to_indices(opt, default_values):
            if default_values is None and None not in opt:
                return None

            if not isinstance(default_values, list):
                # This if is done before others because calling if not x (done
                # right below) when x is of type pd.Series() or np.array() throws a
                # ValueError exception.
                if is_type(default_values, "numpy.ndarray") or is_type(
                    default_values, "pandas.core.series.Series"
                ):
                    default_values = list(default_values)
                elif not default_values or default_values in opt:
                    default_values = [default_values]
                else:
                    default_values = list(default_values)

            for value in default_values:
                if value not in opt:
                    raise StreamlitAPIException(
                        "Every Multiselect default value must exist in options"
                    )

            return [opt.index(value) for value in default_values]

        indices = _check_and_convert_to_indices(opt, default)
        multiselect_proto = MultiSelectProto()
        multiselect_proto.label = label
        default_value = [] if indices is None else indices
        multiselect_proto.default[:] = default_value
        multiselect_proto.options[:] = [str(format_func(option)) for option in opt]
        multiselect_proto.form_id = current_form_id(self.dg)
        if help is not None:
            multiselect_proto.help = dedent(help)

        def deserialize_multiselect(
            ui_value: Optional[List[int]], widget_id: str = ""
        ) -> List[str]:
            current_value = ui_value if ui_value is not None else default_value
            return [opt[i] for i in current_value]

        def serialize_multiselect(value):
            return _check_and_convert_to_indices(opt, value)

        current_value, set_frontend_value = register_widget(
            "multiselect",
            multiselect_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_multiselect,
            serializer=serialize_multiselect,
        )

        if set_frontend_value:
            multiselect_proto.value[:] = _check_and_convert_to_indices(
                opt, current_value
            )
            multiselect_proto.set_value = True

        self.dg._enqueue("multiselect", multiselect_proto)
        return cast(List[str], current_value)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
