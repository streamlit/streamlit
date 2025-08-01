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

from dataclasses import dataclass
from textwrap import dedent
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Generic,
    TypeVar,
    cast,
    overload,
)

from typing_extensions import TypeGuard

from streamlit.dataframe_util import OptionSequence, convert_anything_to_list
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import LayoutConfig, validate_width
from streamlit.elements.lib.options_selector_utils import (
    index_,
    maybe_coerce_enum,
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
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Slider_pb2 import Slider as SliderProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.type_util import check_python_comparable

if TYPE_CHECKING:
    from collections.abc import Sequence

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import WidthWithoutContent
    from streamlit.runtime.state.common import RegisterWidgetResult

T = TypeVar("T")


def _is_range_value(value: T | Sequence[T]) -> TypeGuard[Sequence[T]]:
    return isinstance(value, (list, tuple))


@dataclass
class SelectSliderSerde(Generic[T]):
    options: Sequence[T]
    value: list[int]
    is_range_value: bool

    def serialize(self, v: object) -> list[int]:
        return self._as_index_list(v)

    def deserialize(self, ui_value: list[int] | None) -> T | tuple[T, T]:
        if not ui_value:
            # Widget has not been used; fallback to the original value,
            ui_value = self.value

        # The widget always returns floats, so convert to ints before indexing
        return_value: tuple[T, T] = cast(
            "tuple[T, T]",
            tuple(self.options[int(x)] for x in ui_value),
        )

        # If the original value was a list/tuple, so will be the output (and vice versa)
        return return_value if self.is_range_value else return_value[0]

    def _as_index_list(self, v: Any) -> list[int]:
        if _is_range_value(v):
            slider_value = [index_(self.options, val) for val in v]
            start, end = slider_value
            if start > end:
                slider_value = [end, start]
            return slider_value
        return [index_(self.options, v)]


class SelectSliderMixin:
    @overload
    def select_slider(
        self,
        label: str,
        options: OptionSequence[T],
        value: tuple[T, T] | list[T],
        format_func: Callable[[Any], Any] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> tuple[T, T]: ...

    @overload
    def select_slider(
        self,
        label: str,
        options: OptionSequence[T] = (),
        value: T | None = None,
        format_func: Callable[[Any], Any] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> T: ...

    @gather_metrics("select_slider")
    def select_slider(
        self,
        label: str,
        options: OptionSequence[T] = (),
        value: T | Sequence[T] | None = None,
        format_func: Callable[[Any], Any] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> T | tuple[T, T]:
        r"""
        Display a slider widget to select items from a list.

        This also allows you to render a range slider by passing a two-element
        tuple or list as the ``value``.

        The difference between ``st.select_slider`` and ``st.slider`` is that
        ``select_slider`` accepts any datatype and takes an iterable set of
        options, while ``st.slider`` only accepts numerical or date/time data and
        takes a range as input.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this slider is for.
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

        options : Iterable
            Labels for the select options in an ``Iterable``. This can be a
            ``list``, ``set``, or anything supported by ``st.dataframe``. If
            ``options`` is dataframe-like, the first column will be used. Each
            label will be cast to ``str`` internally by default.

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
            based on its content. No two widgets may have the same key.

        help : str or None
            A tooltip that gets displayed next to the widget label. Streamlit
            only displays the tooltip when ``label_visibility="visible"``. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        on_change : callable
            An optional callback invoked when this select_slider's value changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean that disables the select slider if set to
            ``True``. The default is ``False``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.
            If this is ``"collapsed"``, Streamlit displays no label or spacer.

        width : "stretch" or int
            The width of the slider widget. This can be one of the
            following:

            - ``"stretch"`` (default): The width of the widget matches the
              width of the parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

        Returns
        -------
        any value or tuple of any value
            The current value of the slider widget. The return type will match
            the data type of the value parameter.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> color = st.select_slider(
        ...     "Select a color of the rainbow",
        ...     options=[
        ...         "red",
        ...         "orange",
        ...         "yellow",
        ...         "green",
        ...         "blue",
        ...         "indigo",
        ...         "violet",
        ...     ],
        ... )
        >>> st.write("My favorite color is", color)

        And here's an example of a range select slider:

        >>> import streamlit as st
        >>>
        >>> start_color, end_color = st.select_slider(
        ...     "Select a range of color wavelength",
        ...     options=[
        ...         "red",
        ...         "orange",
        ...         "yellow",
        ...         "green",
        ...         "blue",
        ...         "indigo",
        ...         "violet",
        ...     ],
        ...     value=("red", "blue"),
        ... )
        >>> st.write("You selected wavelengths between", start_color, "and", end_color)

        .. output::
           https://doc-select-slider.streamlit.app/
           height: 450px

        """
        ctx = get_script_run_ctx()
        return self._select_slider(
            label=label,
            options=options,
            value=value,
            format_func=format_func,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            label_visibility=label_visibility,
            ctx=ctx,
            width=width,
        )

    def _select_slider(
        self,
        label: str,
        options: OptionSequence[T] = (),
        value: T | Sequence[T] | None = None,
        format_func: Callable[[Any], Any] = str,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        ctx: ScriptRunContext | None = None,
        width: WidthWithoutContent = "stretch",
    ) -> T | tuple[T, T]:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=value,
        )
        maybe_raise_label_warnings(label, label_visibility)

        opt = convert_anything_to_list(options)
        check_python_comparable(opt)

        if len(opt) == 0:
            raise StreamlitAPIException("The `options` argument needs to be non-empty")

        def as_index_list(v: Any) -> list[int]:
            if _is_range_value(v):
                slider_value = [index_(opt, val) for val in v]
                start, end = slider_value
                if start > end:
                    slider_value = [end, start]
                return slider_value
            # Simplify future logic by always making value a list
            try:
                return [index_(opt, v)]
            except ValueError:
                if value is not None:
                    raise

                return [0]

        # Convert element to index of the elements
        slider_value = as_index_list(value)

        element_id = compute_and_register_element_id(
            "select_slider",
            user_key=key,
            form_id=current_form_id(self.dg),
            dg=self.dg,
            label=label,
            options=[str(format_func(option)) for option in opt],
            value=slider_value,
            help=help,
            width=width,
        )

        slider_proto = SliderProto()
        slider_proto.id = element_id
        slider_proto.type = SliderProto.Type.SELECT_SLIDER
        slider_proto.label = label
        slider_proto.format = "%s"
        slider_proto.default[:] = slider_value
        slider_proto.min = 0
        slider_proto.max = len(opt) - 1
        slider_proto.step = 1  # default for index changes
        slider_proto.data_type = SliderProto.INT
        slider_proto.options[:] = [str(format_func(option)) for option in opt]
        slider_proto.form_id = current_form_id(self.dg)
        slider_proto.disabled = disabled
        slider_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )
        if help is not None:
            slider_proto.help = dedent(help)

        validate_width(width)
        layout_config = LayoutConfig(width=width)

        serde = SelectSliderSerde(opt, slider_value, _is_range_value(value))

        widget_state = register_widget(
            slider_proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="double_array_value",
        )
        if isinstance(widget_state.value, tuple):
            widget_state = maybe_coerce_enum_sequence(
                cast("RegisterWidgetResult[tuple[T, T]]", widget_state), options, opt
            )
        else:
            widget_state = maybe_coerce_enum(widget_state, options, opt)

        if widget_state.value_changed:
            slider_proto.value[:] = serde.serialize(widget_state.value)
            slider_proto.set_value = True

        if ctx:
            save_for_app_testing(ctx, element_id, format_func)

        self.dg._enqueue("slider", slider_proto, layout_config=layout_config)
        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
