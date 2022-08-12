from dataclasses import dataclass
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.type_util import Key, to_key
from textwrap import dedent
from typing import cast, Optional, TYPE_CHECKING

from streamlit.proto.Checkbox_pb2 import Checkbox as CheckboxProto
from streamlit.runtime.state import (
    register_widget,
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
)
from streamlit.runtime.metrics_util import gather_metrics

from .form import current_form_id
from .utils import check_callback_rules, check_session_state_rules


if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


@dataclass
class CheckboxSerde:
    value: bool

    def serialize(self, v: bool) -> bool:
        return bool(v)

    def deserialize(self, ui_value: Optional[bool], widget_id: str = "") -> bool:
        return bool(ui_value if ui_value is not None else self.value)


class CheckboxMixin:
    @gather_metrics
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
           https://doc-checkbox.streamlitapp.com/
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
        if help is not None:
            checkbox_proto.help = dedent(help)

        serde = CheckboxSerde(value)

        checkbox_state = register_widget(
            "checkbox",
            checkbox_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
        )

        # This needs to be done after register_widget because we don't want
        # the following proto fields to affect a widget's ID.
        checkbox_proto.disabled = disabled
        if checkbox_state.value_changed:
            checkbox_proto.value = checkbox_state.value
            checkbox_proto.set_value = True

        self.dg._enqueue("checkbox", checkbox_proto)
        return checkbox_state.value

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
