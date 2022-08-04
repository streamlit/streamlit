# Copyright 2018-2022 Streamlit Inc.
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
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    register_widget,
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
        format_func: Callable[[Any], Any] = str,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        *,  # keyword-only args:
        disabled: bool = False,
        horizontal: bool = False,
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
        disabled : bool
            An optional boolean, which disables the radio button if set to
            True. The default is False. This argument can only be supplied by
            keyword.
        horizontal : bool
            An optional boolean, which orients the radio group horizontally.
            The default is false (vertical buttons). This argument can only
            be supplied by keyword.

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
           https://doc-radio.streamlitapp.com/
           height: 260px

        """
        ctx = get_script_run_ctx()
        return self._radio(
            label=label,
            options=options,
            index=index,
            format_func=format_func,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            horizontal=horizontal,
            ctx=ctx,
        )

    def _radio(
        self,
        label: str,
        options: OptionSequence,
        index: int = 0,
        format_func: Callable[[Any], Any] = str,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        *,  # keyword-only args:
        disabled: bool = False,
        horizontal: bool = False,
        ctx: Optional[ScriptRunContext],
    ) -> Any:
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
        radio_proto.horizontal = horizontal
        if help is not None:
            radio_proto.help = dedent(help)

        def deserialize_radio(ui_value, widget_id=""):
            idx = ui_value if ui_value is not None else index

            return opt[idx] if len(opt) > 0 and opt[idx] is not None else None

        def serialize_radio(v):
            if len(opt) == 0:
                return 0
            return index_(opt, v)

        widget_state = register_widget(
            "radio",
            radio_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_radio,
            serializer=serialize_radio,
            ctx=ctx,
        )

        # This needs to be done after register_widget because we don't want
        # the following proto fields to affect a widget's ID.
        radio_proto.disabled = disabled
        if widget_state.value_changed:
            radio_proto.value = serialize_radio(widget_state.value)
            radio_proto.set_value = True

        self.dg._enqueue("radio", radio_proto)
        return widget_state.value

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
