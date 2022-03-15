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
from streamlit.proto.Selectbox_pb2 import Selectbox as SelectboxProto
from streamlit.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.state import (
    register_widget,
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
)
from streamlit.type_util import Key, OptionSequence, ensure_indexable, to_key
from streamlit.util import index_
from .form import current_form_id
from .utils import check_callback_rules, check_session_state_rules


class SelectboxMixin:
    def selectbox(
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
        *,  # keyword-only arguments:
        disabled: bool = False,
    ) -> Any:
        """Display a select widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this select widget is for.
        options : Sequence, numpy.ndarray, pandas.Series, pandas.DataFrame, or pandas.Index
            Labels for the select options. This will be cast to str internally
            by default. For pandas.DataFrame, the first column is selected.
        index : int
            The index of the preselected option on first render.
        format_func : function
            Function to modify the display of the labels. It receives the option
            as an argument and its output will be cast to str.
        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            An optional tooltip that gets displayed next to the selectbox.
        on_change : callable
            An optional callback invoked when this selectbox's value changes.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.
        disabled : bool
            An optional boolean, which disables the selectbox if set to True.
            The default is False. This argument can only be supplied by keyword.

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

        .. output::
           https://share.streamlit.io/streamlit/docs/main/python/api-examples-source/widget.selectbox.py
           height: 320px

        """
        ctx = get_script_run_ctx()
        return self._selectbox(
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
            ctx=ctx,
        )

    def _selectbox(
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
        *,  # keyword-only arguments:
        disabled: bool = False,
        ctx: Optional[ScriptRunContext] = None,
    ) -> Any:
        key = to_key(key)
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(default_value=None if index == 0 else index, key=key)

        opt = ensure_indexable(options)

        if not isinstance(index, int):
            raise StreamlitAPIException(
                "Selectbox Value has invalid type: %s" % type(index).__name__
            )

        if len(opt) > 0 and not 0 <= index < len(opt):
            raise StreamlitAPIException(
                "Selectbox index must be between 0 and length of options"
            )

        selectbox_proto = SelectboxProto()
        selectbox_proto.label = label
        selectbox_proto.default = index
        selectbox_proto.options[:] = [str(format_func(option)) for option in opt]
        selectbox_proto.form_id = current_form_id(self.dg)
        selectbox_proto.disabled = disabled
        if help is not None:
            selectbox_proto.help = dedent(help)

        def deserialize_select_box(ui_value, widget_id=""):
            idx = ui_value if ui_value is not None else index

            return opt[idx] if len(opt) > 0 and opt[idx] is not None else None

        def serialize_select_box(v):
            if len(opt) == 0:
                return 0
            return index_(opt, v)

        current_value, set_frontend_value = register_widget(
            "selectbox",
            selectbox_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_select_box,
            serializer=serialize_select_box,
            ctx=ctx,
        )

        if set_frontend_value:
            selectbox_proto.value = serialize_select_box(current_value)
            selectbox_proto.set_value = True

        self.dg._enqueue("selectbox", selectbox_proto)
        return cast(str, current_value)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
