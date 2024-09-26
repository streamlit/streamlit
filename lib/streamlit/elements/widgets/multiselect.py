# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

from dataclasses import dataclass, field
from textwrap import dedent
from typing import TYPE_CHECKING, Any, Callable, Generic, Sequence, cast

from streamlit.dataframe_util import OptionSequence
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.options_selector_utils import (
    check_and_convert_to_indices,
    convert_to_sequence_and_check_comparable,
    get_default_indices,
    maybe_coerce_enum_sequence,
)
from streamlit.elements.lib.policies import (
    check_widget_policies,
    maybe_raise_label_warnings,
)
from streamlit.elements.lib.utils import (
    Key,
    LabelVisibility,
    compute_and_register_element_id,
    get_label_visibility_proto_value,
    save_for_app_testing,
    to_key,
)
from streamlit.errors import (
    StreamlitSelectionCountExceedsMaxError,
)
from streamlit.proto.MultiSelect_pb2 import MultiSelect as MultiSelectProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import register_widget
from streamlit.type_util import (
    T,
    is_iterable,
)

if TYPE_CHECKING:
    from streamlit.dataframe_util import OptionSequence
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.state import (
        WidgetArgs,
        WidgetCallback,
        WidgetKwargs,
    )


@dataclass
class MultiSelectSerde(Generic[T]):
    options: Sequence[T]
    default_value: list[int] = field(default_factory=list)

    def serialize(self, value: list[T]) -> list[int]:
        indices = check_and_convert_to_indices(self.options, value)
        return indices if indices is not None else []

    def deserialize(
        self,
        ui_value: list[int] | None,
        widget_id: str = "",
    ) -> list[T]:
        current_value: list[int] = (
            ui_value if ui_value is not None else self.default_value
        )
        return [self.options[i] for i in current_value]


def _get_default_count(default: Sequence[Any] | Any | None) -> int:
    if default is None:
        return 0
    if not is_iterable(default):
        return 1
    return len(cast(Sequence[Any], default))


def _check_max_selections(
    selections: Sequence[Any] | Any | None, max_selections: int | None
):
    if max_selections is None:
        return

    default_count = _get_default_count(selections)
    if default_count > max_selections:
        raise StreamlitSelectionCountExceedsMaxError(
            current_selections_count=default_count, max_selections_count=max_selections
        )


class MultiSelectMixin:
    @gather_metrics("multiselect")
    def multiselect(
        self,
        label: str,
        options: OptionSequence[T],
        default: Any | None = None,
        format_func: Callable[[Any], Any] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        max_selections: int | None = None,
        placeholder: str = "Choose an option",
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> list[T]:
        r"""Display a multiselect widget.
        The multiselect widget starts as empty.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this select widget is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, and
            Links.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            For accessibility reasons, you should never set an empty label (label="")
            but hide it with label_visibility if needed. In the future, we may disallow
            empty labels by raising an exception.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        options : Iterable
            Labels for the select options in an ``Iterable``. This can be a
            ``list``, ``set``, or anything supported by ``st.dataframe``. If
            ``options`` is dataframe-like, the first column will be used. Each
            label will be cast to ``str`` internally by default.

        default: Iterable of V, V, or None
            List of default values. Can also be a single value.

        format_func : function
            Function to modify the display of selectbox options. It receives
            the raw option as an argument and should output the label to be
            shown for that option. This has no impact on the return value of
            the multiselect.

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. No two widgets may have the same key.

        help : str
            An optional tooltip that gets displayed next to the multiselect.

        on_change : callable
            An optional callback invoked when this multiselect's value changes.

        args : tuple
            An optional tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        max_selections : int
            The max selections that can be selected at a time.

        placeholder : str
            A string to display when no options are selected.
            Defaults to 'Choose an option'.

        disabled : bool
            An optional boolean, which disables the multiselect widget if set
            to True. The default is False. This argument can only be supplied
            by keyword.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. If "hidden", the label doesn't show but there
            is still empty space for it above the widget (equivalent to label="").
            If "collapsed", both the label and the space are removed. Default is
            "visible".

        Returns
        -------
        list
            A list with the selected options

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> options = st.multiselect(
        ...     "What are your favorite colors",
        ...     ["Green", "Yellow", "Red", "Blue"],
        ...     ["Yellow", "Red"],
        ... )
        >>>
        >>> st.write("You selected:", options)

        .. output::
           https://doc-multiselect.streamlit.app/
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
            max_selections=max_selections,
            placeholder=placeholder,
            disabled=disabled,
            label_visibility=label_visibility,
            ctx=ctx,
        )

    def _multiselect(
        self,
        label: str,
        options: OptionSequence[T],
        default: Sequence[Any] | Any | None = None,
        format_func: Callable[[Any], Any] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        max_selections: int | None = None,
        placeholder: str = "Choose an option",
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        ctx: ScriptRunContext | None = None,
    ) -> list[T]:
        key = to_key(key)

        widget_name = "multiselect"
        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=default,
        )
        maybe_raise_label_warnings(label, label_visibility)

        indexable_options = convert_to_sequence_and_check_comparable(options)
        formatted_options = [format_func(option) for option in indexable_options]
        default_values = get_default_indices(indexable_options, default)

        form_id = current_form_id(self.dg)
        element_id = compute_and_register_element_id(
            widget_name,
            user_key=key,
            form_id=form_id,
            label=label,
            options=formatted_options,
            default=default_values,
            help=help,
            max_selections=max_selections,
            placeholder=placeholder,
        )

        proto = MultiSelectProto()
        proto.id = element_id
        proto.default[:] = default_values
        proto.form_id = form_id
        proto.disabled = disabled
        proto.label = label
        proto.max_selections = max_selections or 0
        proto.placeholder = placeholder
        proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )
        proto.options[:] = formatted_options
        if help is not None:
            proto.help = dedent(help)

        serde = MultiSelectSerde(indexable_options, default_values)
        widget_state = register_widget(
            "multiselect",
            proto,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
        )

        _check_max_selections(widget_state.value, max_selections)
        widget_state = maybe_coerce_enum_sequence(
            widget_state, options, indexable_options
        )

        if widget_state.value_changed:
            proto.value[:] = serde.serialize(widget_state.value)
            proto.set_value = True

        if ctx:
            save_for_app_testing(ctx, element_id, format_func)

        self.dg._enqueue(widget_name, proto)

        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
