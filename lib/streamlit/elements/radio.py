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
from streamlit.proto.Radio_pb2 import Radio as RadioProto
from streamlit.state.widgets import register_widget
from streamlit.state.session_state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
)
from streamlit.type_util import Key, OptionSequence, ensure_indexable, to_key
from streamlit.util import index_
from .form import current_form_id
from .utils import check_callback_rules, check_session_state_rules


class RadioMixin:
    def radio(
        self,
        label: str,
        options: OptionSequence,
        index: int = 0,
        format_func: Callable[[Any], str] = str,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
    ) -> Any:
        """Display a radio button widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this radio group is for.
        options : Sequence, numpy.ndarray, pandas.Series, pandas.DataFrame, or pandas.Index
            Labels for the radio options. This will be cast to str internally
            by default. For pandas.DataFrame, the first column is selected.
        index : int
            The index of the preselected option on first render.
        format_func : function
            Function to modify the display of radio options. It receives
            the raw option as an argument and should output the label to be
            shown for that option. This has no impact on the return value of
            the radio.
        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            An optional tooltip that gets displayed next to the radio.
        on_change : callable
            An optional callback invoked when this radio's value changes.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        Returns
        -------
        any
            The selected option.

        Example
        -------
        >>> genre = st.radio(
        ...     "What\'s your favorite movie genre",
        ...     ('Comedy', 'Drama', 'Documentary'))
        >>>
        >>> if genre == 'Comedy':
        ...     st.write('You selected comedy.')
        ... else:
        ...     st.write("You didn\'t select comedy.")

        .. output::
           https://share.streamlit.io/streamlit/docs/main/python/api-examples-source/widget.radio.py
           height: 260px

        """
        key = to_key(key)
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(default_value=None if index == 0 else index, key=key)

        opt = ensure_indexable(options)

        if not isinstance(index, int):
            raise StreamlitAPIException(
                "Radio Value has invalid type: %s" % type(index).__name__
            )

        if len(opt) > 0 and not 0 <= index < len(opt):
            raise StreamlitAPIException(
                "Radio index must be between 0 and length of options"
            )

        radio_proto = RadioProto()
        radio_proto.label = label
        radio_proto.default = index
        radio_proto.options[:] = [str(format_func(option)) for option in opt]
        radio_proto.form_id = current_form_id(self.dg)
        if help is not None:
            radio_proto.help = dedent(help)

        def deserialize_radio(ui_value, widget_id=""):
            idx = ui_value if ui_value is not None else index

            return opt[idx] if len(opt) > 0 and opt[idx] is not None else None

        def serialize_radio(v):
            if len(options) == 0:
                return 0
            return index_(options, v)

        current_value, set_frontend_value = register_widget(
            "radio",
            radio_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_radio,
            serializer=serialize_radio,
        )

        if set_frontend_value:
            radio_proto.value = serialize_radio(current_value)
            radio_proto.set_value = True

        self.dg._enqueue("radio", radio_proto)
        return cast(str, current_value)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
