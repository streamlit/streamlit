# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import numbers
from dataclasses import dataclass
from textwrap import dedent
from typing import TYPE_CHECKING, Literal, TypeVar, Union, cast, overload

from typing_extensions import TypeAlias

from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.js_number import JSNumber, JSNumberBoundsException
from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    WidthWithoutContent,
    validate_width,
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
    to_key,
)
from streamlit.errors import (
    StreamlitInvalidNumberFormatError,
    StreamlitJSNumberBoundsError,
    StreamlitMixedNumericTypesError,
    StreamlitValueAboveMaxError,
    StreamlitValueBelowMinError,
)
from streamlit.proto.NumberInput_pb2 import NumberInput as NumberInputProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    get_session_state,
    register_widget,
)
from streamlit.string_util import validate_icon_or_emoji

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


Number: TypeAlias = Union[int, float]
IntOrNone = TypeVar("IntOrNone", int, None)
FloatOrNone = TypeVar("FloatOrNone", float, None)


@dataclass
class NumberInputSerde:
    value: Number | None
    data_type: int

    def serialize(self, v: Number | None) -> Number | None:
        return v

    def deserialize(self, ui_value: Number | None) -> Number | None:
        val: Number | None = ui_value if ui_value is not None else self.value

        if val is not None and self.data_type == NumberInputProto.INT:
            val = int(val)

        return val


class NumberInputMixin:
    # If "min_value: int" is given and all other numerical inputs are
    #   "int"s or not provided (value optionally being "min"), return "int"
    # If "min_value: int, value: None" is given and all other numerical inputs
    #   are "int"s or not provided, return "int | None"
    @overload
    def number_input(
        self,
        label: str,
        min_value: int,
        max_value: int | None = None,
        value: IntOrNone | Literal["min"] = "min",
        step: int | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> int | IntOrNone: ...

    # If "max_value: int" is given and all other numerical inputs are
    #   "int"s or not provided (value optionally being "min"), return "int"
    # If "max_value: int, value=None" is given and all other numerical inputs
    #   are "int"s or not provided, return "int | None"
    @overload
    def number_input(
        self,
        label: str,
        min_value: None = None,
        *,
        max_value: int,
        value: IntOrNone | Literal["min"] = "min",
        step: int | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> int | IntOrNone: ...

    # If "value=int" is given and all other numerical inputs are "int"s
    #   or not provided, return "int"
    @overload
    def number_input(
        self,
        label: str,
        min_value: int | None = None,
        max_value: int | None = None,
        *,
        value: int,
        step: int | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> int: ...

    # If "step=int" is given and all other numerical inputs are "int"s
    #   or not provided (value optionally being "min"), return "int"
    # If "step=int, value=None" is given and all other numerical inputs
    #   are "int"s or not provided, return "int | None"
    @overload
    def number_input(
        self,
        label: str,
        min_value: None = None,
        max_value: None = None,
        value: IntOrNone | Literal["min"] = "min",
        *,
        step: int,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> int | IntOrNone: ...

    # If all numerical inputs are floats (with value optionally being "min")
    #   or are not provided, return "float"
    # If only "value=None" is given and none of the other numerical inputs
    #   are "int"s, return "float | None"
    @overload
    def number_input(
        self,
        label: str,
        min_value: float | None = None,
        max_value: float | None = None,
        value: FloatOrNone | Literal["min"] = "min",
        step: float | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> float | FloatOrNone: ...

    @gather_metrics("number_input")
    def number_input(
        self,
        label: str,
        min_value: Number | None = None,
        max_value: Number | None = None,
        value: Number | Literal["min"] | None = "min",
        step: Number | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> Number | None:
        r"""Display a numeric input widget.

        .. note::
            Integer values exceeding +/- ``(1<<53) - 1`` cannot be accurately
            stored or returned by the widget due to serialization constraints
            between the Python server and JavaScript client. You must handle
            such numbers as floats, leading to a loss in precision.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, Links,
            and Images. Images display like icons, with a max height equal to
            the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            For accessibility reasons, you should never set an empty label, but
            you can hide it with ``label_visibility`` if needed. In the future,
            we may disallow empty labels by raising an exception.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        min_value : int, float, or None
            The minimum permitted value.
            If this is ``None`` (default), there will be no minimum for float
            values and a minimum of ``- (1<<53) + 1`` for integer values.

        max_value : int, float, or None
            The maximum permitted value.
            If this is ``None`` (default), there will be no maximum for float
            values and a maximum of ``(1<<53) - 1`` for integer values.

        value : int, float, "min" or None
            The value of this widget when it first renders. If this is
            ``"min"`` (default), the initial value is ``min_value`` unless
            ``min_value`` is ``None``. If ``min_value`` is ``None``, the widget
            initializes with a value of ``0.0`` or ``0``.

            If ``value`` is ``None``, the widget will initialize with no value
            and return ``None`` until the user provides input.

        step : int, float, or None
            The stepping interval.
            Defaults to 1 if the value is an int, 0.01 otherwise.
            If the value is not specified, the format parameter will be used.

        format : str or None
            A printf-style format string controlling how the interface should
            display numbers. The output must be purely numeric. This does not
            impact the return value of the widget. For more information about
            the formatting specification, see `sprintf.js
            <https://github.com/alexei/sprintf.js?tab=readme-ov-file#format-specification>`_.

            For example, ``format="%0.1f"`` adjusts the displayed decimal
            precision to only show one digit after the decimal.

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. No two widgets may have the same key.

        help : str or None
            A tooltip that gets displayed next to the widget label. Streamlit
            only displays the tooltip when ``label_visibility="visible"``. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        on_change : callable
            An optional callback invoked when this number_input's value changes.

        args : tuple
            An optional tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        placeholder : str or None
            An optional string displayed when the number input is empty.
            If None, no placeholder is displayed.

        disabled : bool
            An optional boolean that disables the number input if set to
            ``True``. The default is ``False``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.
            If this is ``"collapsed"``, Streamlit displays no label or spacer.

        icon : str, None
            An optional emoji or icon to display within the input field to the
            left of the value. If ``icon`` is ``None`` (default), no icon is
            displayed. If ``icon`` is a string, the following options are
            valid:

            - A single-character emoji. For example, you can set ``icon="🚨"``
              or ``icon="🔥"``. Emoji short codes are not supported.

            - An icon from the Material Symbols library (rounded style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols \
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.

        width : "stretch" or int
            The width of the number input widget. This can be one of the
            following:

            - ``"stretch"`` (default): The width of the widget matches the
              width of the parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

        Returns
        -------
        int or float or None
            The current value of the numeric input widget or ``None`` if the widget
            is empty. The return type will match the data type of the value parameter.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> number = st.number_input("Insert a number")
        >>> st.write("The current number is ", number)

        .. output::
           https://doc-number-input.streamlit.app/
           height: 260px

        To initialize an empty number input, use ``None`` as the value:

        >>> import streamlit as st
        >>>
        >>> number = st.number_input(
        ...     "Insert a number", value=None, placeholder="Type a number..."
        ... )
        >>> st.write("The current number is ", number)

        .. output::
           https://doc-number-input-empty.streamlit.app/
           height: 260px

        """
        ctx = get_script_run_ctx()
        return self._number_input(
            label=label,
            min_value=min_value,
            max_value=max_value,
            value=value,
            step=step,
            format=format,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            placeholder=placeholder,
            disabled=disabled,
            label_visibility=label_visibility,
            icon=icon,
            width=width,
            ctx=ctx,
        )

    def _number_input(
        self,
        label: str,
        min_value: Number | None = None,
        max_value: Number | None = None,
        value: Number | Literal["min"] | None = "min",
        step: Number | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        placeholder: str | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        icon: str | None = None,
        width: WidthWithoutContent = "stretch",
        ctx: ScriptRunContext | None = None,
    ) -> Number | None:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=value if value != "min" else None,
        )
        maybe_raise_label_warnings(label, label_visibility)

        element_id = compute_and_register_element_id(
            "number_input",
            user_key=key,
            form_id=current_form_id(self.dg),
            dg=self.dg,
            label=label,
            min_value=min_value,
            max_value=max_value,
            value=value,
            step=step,
            format=format,
            help=help,
            placeholder=None if placeholder is None else str(placeholder),
            icon=icon,
            width=width,
        )

        # Ensure that all arguments are of the same type.
        number_input_args = [min_value, max_value, value, step]

        all_int_args = all(
            isinstance(a, (numbers.Integral, type(None), str))
            for a in number_input_args
        )

        all_float_args = all(
            isinstance(a, (float, type(None), str)) for a in number_input_args
        )

        if not all_int_args and not all_float_args:
            raise StreamlitMixedNumericTypesError(
                value=value, min_value=min_value, max_value=max_value, step=step
            )

        session_state = get_session_state().filtered_state
        if key is not None and key in session_state and session_state[key] is None:
            value = None

        if value == "min":
            if min_value is not None:
                value = min_value
            elif all_int_args and all_float_args:
                value = 0.0  # if no values are provided, defaults to float
            elif all_int_args:
                value = 0
            else:
                value = 0.0

        int_value = isinstance(value, numbers.Integral)
        float_value = isinstance(value, float)

        if value is None:
            if all_int_args and not all_float_args:
                # Select int type if all relevant args are ints:
                int_value = True
            else:
                # Otherwise, defaults to float:
                float_value = True

        # Use default format depending on value type if format was not provided:
        number_format = ("%d" if int_value else "%0.2f") if format is None else format

        # Warn user if they format an int type as a float or vice versa.
        if number_format in ["%d", "%u", "%i"] and float_value:
            import streamlit as st

            st.warning(
                "Warning: NumberInput value below has type float,"
                f" but format {number_format} displays as integer."
            )
        elif number_format[-1] == "f" and int_value:
            import streamlit as st

            st.warning(
                "Warning: NumberInput value below has type int so is"
                f" displayed as int despite format string {number_format}."
            )

        if step is None:
            step = 1 if int_value else 0.01

        try:
            float(number_format % 2)
        except (TypeError, ValueError):
            raise StreamlitInvalidNumberFormatError(number_format)

        # Ensure that the value matches arguments' types.
        all_ints = int_value and all_int_args

        if min_value is not None and value is not None and min_value > value:
            raise StreamlitValueBelowMinError(value=value, min_value=min_value)

        if max_value is not None and value is not None and max_value < value:
            raise StreamlitValueAboveMaxError(value=value, max_value=max_value)

        # Bounds checks. JSNumber produces human-readable exceptions that
        # we simply re-package as StreamlitAPIExceptions.
        try:
            if all_ints:
                if min_value is not None:
                    JSNumber.validate_int_bounds(int(min_value), "`min_value`")
                else:
                    # Issue 6740: If min_value not provided, set default to minimum safe integer
                    # to avoid JS issues from smaller numbers entered via UI
                    min_value = JSNumber.MIN_SAFE_INTEGER
                if max_value is not None:
                    JSNumber.validate_int_bounds(int(max_value), "`max_value`")
                else:
                    # See note above - set default to max safe integer
                    max_value = JSNumber.MAX_SAFE_INTEGER
                if step is not None:
                    JSNumber.validate_int_bounds(int(step), "`step`")
                if value is not None:
                    JSNumber.validate_int_bounds(int(value), "`value`")
            else:
                if min_value is not None:
                    JSNumber.validate_float_bounds(min_value, "`min_value`")
                else:
                    # See note above
                    min_value = JSNumber.MIN_NEGATIVE_VALUE
                if max_value is not None:
                    JSNumber.validate_float_bounds(max_value, "`max_value`")
                else:
                    # See note above
                    max_value = JSNumber.MAX_VALUE
                if step is not None:
                    JSNumber.validate_float_bounds(step, "`step`")
                if value is not None:
                    JSNumber.validate_float_bounds(value, "`value`")
        except JSNumberBoundsException as e:
            raise StreamlitJSNumberBoundsError(str(e))

        data_type = NumberInputProto.INT if all_ints else NumberInputProto.FLOAT

        number_input_proto = NumberInputProto()
        number_input_proto.id = element_id
        number_input_proto.data_type = data_type
        number_input_proto.label = label
        if value is not None:
            number_input_proto.default = value
        if placeholder is not None:
            number_input_proto.placeholder = str(placeholder)
        number_input_proto.form_id = current_form_id(self.dg)
        number_input_proto.disabled = disabled
        number_input_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if help is not None:
            number_input_proto.help = dedent(help)

        if min_value is not None:
            number_input_proto.min = min_value
            number_input_proto.has_min = True

        if max_value is not None:
            number_input_proto.max = max_value
            number_input_proto.has_max = True

        if step is not None:
            number_input_proto.step = step

        number_input_proto.format = number_format

        if icon is not None:
            number_input_proto.icon = validate_icon_or_emoji(icon)

        serde = NumberInputSerde(value, data_type)
        widget_state = register_widget(
            number_input_proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="double_value",
        )

        if widget_state.value_changed:
            if widget_state.value is not None:
                # Min/Max bounds checks when the value is updated.
                if (
                    number_input_proto.has_min
                    and widget_state.value < number_input_proto.min
                ):
                    raise StreamlitValueBelowMinError(
                        value=widget_state.value, min_value=number_input_proto.min
                    )

                if (
                    number_input_proto.has_max
                    and widget_state.value > number_input_proto.max
                ):
                    raise StreamlitValueAboveMaxError(
                        value=widget_state.value, max_value=number_input_proto.max
                    )

                number_input_proto.value = widget_state.value
            number_input_proto.set_value = True

        validate_width(width)
        layout_config = LayoutConfig(width=width)

        self.dg._enqueue(
            "number_input", number_input_proto, layout_config=layout_config
        )
        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
