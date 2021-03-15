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
from streamlit.proto.MultiSelect_pb2 import MultiSelect as MultiSelectProto
from streamlit.type_util import is_type, ensure_iterable
from .utils import register_widget


class MultiSelectMixin:
    def multiselect(
        self, label, options, default=None, format_func=str, key=None, help=None
    ):
        """Display a multiselect widget.
        The multiselect widget starts as empty.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this select widget is for.
        options : list, tuple, numpy.ndarray, pandas.Series, or pandas.DataFrame
            Labels for the select options. This will be cast to str internally
            by default. For pandas.DataFrame, the first column is selected.
        default: [str] or None
            List of default values.
        format_func : function
            Function to modify the display of selectbox options. It receives
            the raw option as an argument and should output the label to be
            shown for that option. This has no impact on the return value of
            the selectbox.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            A tooltip that gets displayed next to the multiselect.

        Returns
        -------
        [str]
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
        options = ensure_iterable(options)

        # Perform validation checks and return indices base on the default values.
        def _check_and_convert_to_indices(options, default_values):
            if default_values is None and None not in options:
                return None

            if not isinstance(default_values, list):
                # This if is done before others because calling if not x (done
                # right below) when x is of type pd.Series() or np.array() throws a
                # ValueError exception.
                if is_type(default_values, "numpy.ndarray") or is_type(
                    default_values, "pandas.core.series.Series"
                ):
                    default_values = list(default_values)
                elif not default_values or default_values in options:
                    default_values = [default_values]
                else:
                    default_values = list(default_values)

            for value in default_values:
                if value not in options:
                    raise StreamlitAPIException(
                        "Every Multiselect default value must exist in options"
                    )

            return [options.index(value) for value in default_values]

        indices = _check_and_convert_to_indices(options, default)
        multiselect_proto = MultiSelectProto()
        multiselect_proto.label = label
        default_value = [] if indices is None else indices
        multiselect_proto.default[:] = default_value
        multiselect_proto.options[:] = [str(format_func(option)) for option in options]
        if help is not None:
            multiselect_proto.help = help

        ui_value = register_widget("multiselect", multiselect_proto, user_key=key)
        current_value = ui_value.data if ui_value is not None else default_value
        return_value = [options[i] for i in current_value]
        return self.dg._enqueue("multiselect", multiselect_proto, return_value)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
