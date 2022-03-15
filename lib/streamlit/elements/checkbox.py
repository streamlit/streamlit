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

from streamlit.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.type_util import Key, to_key
from textwrap import dedent
from typing import cast, Optional

import streamlit
from streamlit.proto.Checkbox_pb2 import Checkbox as CheckboxProto
from streamlit.state import (
    register_widget,
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
)
from .form import current_form_id
from .utils import check_callback_rules, check_session_state_rules


class CheckboxMixin:
    def checkbox(
        self,
        label: str,
        value: bool = False,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
    ) -> bool:
        """Display a checkbox widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this checkbox is for.
        value : bool
            Preselect the checkbox when it first renders. This will be
            cast to bool internally.
        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            An optional tooltip that gets displayed next to the checkbox.
        on_change : callable
            An optional callback invoked when this checkbox's value changes.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.
        disabled : bool
            An optional boolean, which disables the checkbox if set to True.
            The default is False. This argument can only be supplied by keyword.

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

        .. output::
           https://share.streamlit.io/streamlit/docs/main/python/api-examples-source/widget.checkbox.py
           height: 220px

        """
        ctx = get_script_run_ctx()
        return self._checkbox(
            label=label,
            value=value,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            ctx=ctx,
        )

    def _checkbox(
        self,
        label: str,
        value: bool = False,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        ctx: Optional[ScriptRunContext] = None,
    ) -> bool:
        key = to_key(key)
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(
            default_value=None if value is False else value, key=key
        )

        checkbox_proto = CheckboxProto()
        checkbox_proto.label = label
        checkbox_proto.default = bool(value)
        checkbox_proto.form_id = current_form_id(self.dg)
        checkbox_proto.disabled = disabled
        if help is not None:
            checkbox_proto.help = dedent(help)

        def deserialize_checkbox(ui_value: Optional[bool], widget_id: str = "") -> bool:
            return bool(ui_value if ui_value is not None else value)

        current_value, set_frontend_value = register_widget(
            "checkbox",
            checkbox_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_checkbox,
            serializer=bool,
            ctx=ctx,
        )

        if set_frontend_value:
            checkbox_proto.value = current_value
            checkbox_proto.set_value = True

        self.dg._enqueue("checkbox", checkbox_proto)
        return cast(bool, current_value)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
