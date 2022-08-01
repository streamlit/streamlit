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

from enum import Enum
from textwrap import dedent
from typing import (
    Any,
    Callable,
    cast,
    Iterable,
    Optional,
    overload,
    List,
    Sequence,
    Union,
    TypeVar,
)

import streamlit
from streamlit.errors import StreamlitAPIException
from streamlit.proto.MultiSelect_pb2 import MultiSelect as MultiSelectProto
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.type_util import Key, OptionSequence, ensure_indexable, is_type, to_key

from streamlit.runtime.state import (
    register_widget,
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
)
from .form import current_form_id
from .utils import check_callback_rules, check_session_state_rules

T = TypeVar("T")


class MultiSelectMixin:
    @overload
    def multiselect(
        self,
        label: str,
        options: Sequence[T],
        default: Optional[Any] = None,
        format_func: Callable[[Any], Any] = str,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
    ) -> List[T]:
        ...

    @overload
    def multiselect(
        self,
        label: str,
        options: OptionSequence,
        default: Optional[Any] = None,
        format_func: Callable[[Any], Any] = str,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
    ) -> List[Any]:
        ...

    def multiselect(
        self,
        label: str,
        options: OptionSequence,
        default: Optional[Any] = None,
        format_func: Callable[[Any], Any] = str,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
    ) -> List[Any]:
        """Display a multiselect widget.
        The multiselect widget starts as empty.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this select widget is for.
        options : Sequence[V], numpy.ndarray, pandas.Series, pandas.DataFrame, or pandas.Index
            Labels for the select options. This will be cast to str internally
            by default. For pandas.DataFrame, the first column is selected.
        default: [V], V, or None
            List of default values. Can also be a single value.
        format_func : function
            Function to modify the display of selectbox options. It receives
            the raw option as an argument and should output the label to be
            shown for that option. This has no impact on the return value of
            the multiselect.
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
        disabled : bool
            An optional boolean, which disables the multiselect widget if set
            to True. The default is False. This argument can only be supplied
            by keyword.

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

        .. output::
           https://doc-multiselect.streamlitapp.com/
           height: 420px

        """
        ctx = get_script_run_ctx()
        return self._multiselect(
            label=label,
            options=options,
            default=default,
            format_func=format_func,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            ctx=ctx,
        )

    def _multiselect(
        self,
        label: str,
        options: OptionSequence,
        default: Union[Iterable[Any], Any, None] = None,
        format_func: Callable[[Any], Any] = str,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        ctx: Optional[ScriptRunContext] = None,
    ) -> List[Any]:
        key = to_key(key)
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(default_value=default, key=key)

        opt = ensure_indexable(options)

        @overload
        def _check_and_convert_to_indices(  # type: ignore[misc]
            opt: Sequence[Any], default_values: None
        ) -> Optional[List[int]]:
            ...

        @overload
        def _check_and_convert_to_indices(
            opt: Sequence[Any], default_values: Union[Iterable[Any], Any]
        ) -> List[int]:
            ...

        def _check_and_convert_to_indices(
            opt: Sequence[Any], default_values: Union[Iterable[Any], Any, None]
        ) -> Optional[List[int]]:
            """Perform validation checks and return indices based on the default values."""
            if default_values is None and None not in opt:
                return None

            if not isinstance(default_values, list):
                # This if is done before others because calling if not x (done
                # right below) when x is of type pd.Series() or np.array() throws a
                # ValueError exception.
                if is_type(default_values, "numpy.ndarray") or is_type(
                    default_values, "pandas.core.series.Series"
                ):
                    default_values = list(cast(Iterable[Any], default_values))
                elif not default_values or default_values in opt:
                    default_values = [default_values]
                else:
                    default_values = list(default_values)
            if len(default_values) != 0 and isinstance(default_values[0], Enum):
                str_default_values = [str(enum) for enum in default_values]
                mapped_opt_keys = [str(enum) for enum in opt]
                for value in str_default_values:
                    if value not in mapped_opt_keys:
                        raise StreamlitAPIException(
                            "Every Multiselect default value must exist in options"
                        )
                return [mapped_opt_keys.index(value) for value in str_default_values]

            for value in default_values:
                if value not in opt:
                    raise StreamlitAPIException(
                        "Every Multiselect default value must exist in options"
                    )

            return [opt.index(value) for value in default_values]

        indices = _check_and_convert_to_indices(opt, default)
        multiselect_proto = MultiSelectProto()
        multiselect_proto.label = label
        default_value: List[int] = [] if indices is None else indices
        multiselect_proto.default[:] = default_value
        multiselect_proto.options[:] = [str(format_func(option)) for option in opt]
        multiselect_proto.form_id = current_form_id(self.dg)
        if help is not None:
            multiselect_proto.help = dedent(help)

        def deserialize_multiselect(
            ui_value: Optional[List[int]], widget_id: str = ""
        ) -> List[Any]:
            current_value: List[int] = (
                ui_value if ui_value is not None else default_value
            )
            return [opt[i] for i in current_value]

        def serialize_multiselect(value: List[Any]) -> List[int]:
            return _check_and_convert_to_indices(opt, value)

        widget_state = register_widget(
            "multiselect",
            multiselect_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_multiselect,
            serializer=serialize_multiselect,
            ctx=ctx,
        )
        # This needs to be done after register_widget because we don't want
        # the following proto fields to affect a widget's ID.
        multiselect_proto.disabled = disabled
        if widget_state.value_changed:
            multiselect_proto.value[:] = serialize_multiselect(widget_state.value)
            multiselect_proto.set_value = True

        self.dg._enqueue("multiselect", multiselect_proto)
        if len(widget_state.value) != 0:
            if isinstance(widget_state.value[0], Enum):
                return [str(enum) for enum in widget_state.value]
        return widget_state.value

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
