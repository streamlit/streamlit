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
from typing import Any, Callable, Optional, cast

import streamlit
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Slider_pb2 import Slider as SliderProto
from streamlit.state.session_state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
)
from streamlit.state.widgets import register_widget
from streamlit.type_util import Key, OptionSequence, ensure_indexable, to_key
from streamlit.util import index_
from .form import current_form_id
from .utils import check_callback_rules, check_session_state_rules


class SelectSliderMixin:
    def select_slider(
        self,
        label: str,
        options: OptionSequence = [],
        value: Any = None,
        format_func: Callable[[Any], Any] = str,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
    ) -> Any:
        """
        Display a slider widget to select items from a list.

        This also allows you to render a range slider by passing a two-element
        tuple or list as the `value`.

        The difference between `st.select_slider` and `st.slider` is that
        `select_slider` accepts any datatype and takes an iterable set of
        options, while `slider` only accepts numerical or date/time data and
        takes a range as input.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this slider is for.
        options : Sequence, numpy.ndarray, pandas.Series, pandas.DataFrame, or pandas.Index
            Labels for the slider options. All options will be cast to str
            internally by default. For pandas.DataFrame, the first column is
            selected.
        value : a supported type or a tuple/list of supported types or None
            The value of the slider when it first renders. If a tuple/list
            of two values is passed here, then a range slider with those lower
            and upper bounds is rendered. For example, if set to `(1, 10)` the
            slider will have a selectable range between 1 and 10.
            Defaults to first option.
        format_func : function
            Function to modify the display of the labels from the options.
            argument. It receives the option as an argument and its output
            will be cast to str.
        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            An optional tooltip that gets displayed next to the select slider.
        on_change : callable
            An optional callback invoked when this select_slider's value changes.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        Returns
        -------
        any value or tuple of any value
            The current value of the slider widget. The return type will match
            the data type of the value parameter.

        Examples
        --------
        >>> color = st.select_slider(
        ...     'Select a color of the rainbow',
        ...     options=['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'])
        >>> st.write('My favorite color is', color)

        And here's an example of a range select slider:

        >>> start_color, end_color = st.select_slider(
        ...     'Select a range of color wavelength',
        ...     options=['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'],
        ...     value=('red', 'blue'))
        >>> st.write('You selected wavelengths between', start_color, 'and', end_color)
        """
        key = to_key(key)
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(default_value=value, key=key)

        opt = ensure_indexable(options)

        if len(opt) == 0:
            raise StreamlitAPIException("The `options` argument needs to be non-empty")

        is_range_value = isinstance(value, (list, tuple))

        def as_index_list(v):
            is_range_value = isinstance(v, (list, tuple))
            if is_range_value:
                slider_value = [index_(opt, val) for val in v]
                start, end = slider_value
                if start > end:
                    slider_value = [end, start]
                return slider_value
            else:
                # Simplify future logic by always making value a list
                try:
                    return [index_(opt, v)]
                except ValueError:
                    if value is not None:
                        raise

                    return [0]

        # Convert element to index of the elements
        slider_value = as_index_list(value)

        slider_proto = SliderProto()
        slider_proto.label = label
        slider_proto.format = "%s"
        slider_proto.default[:] = slider_value
        slider_proto.min = 0
        slider_proto.max = len(opt) - 1
        slider_proto.step = 1  # default for index changes
        slider_proto.data_type = SliderProto.INT
        slider_proto.options[:] = [str(format_func(option)) for option in opt]
        slider_proto.form_id = current_form_id(self.dg)
        if help is not None:
            slider_proto.help = dedent(help)

        def deserialize_select_slider(ui_value, widget_id=""):
            if not ui_value:
                # Widget has not been used; fallback to the original value,
                ui_value = slider_value

            # The widget always returns floats, so convert to ints before indexing
            return_value = list(map(lambda x: opt[int(x)], ui_value))  # type: ignore[no-any-return]

            # If the original value was a list/tuple, so will be the output (and vice versa)
            return tuple(return_value) if is_range_value else return_value[0]

        def serialize_select_slider(v):
            return as_index_list(v)

        current_value, set_frontend_value = register_widget(
            "slider",
            slider_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_select_slider,
            serializer=serialize_select_slider,
        )

        if set_frontend_value:
            slider_proto.value[:] = serialize_select_slider(current_value)
            slider_proto.set_value = True

        self.dg._enqueue("slider", slider_proto)
        return current_value

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
