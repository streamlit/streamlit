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

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from numbers import Integral, Real
from textwrap import dedent
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    TypedDict,
    TypeVar,
    Union,
    cast,
    overload,
)

from typing_extensions import TypeAlias

from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.js_number import JSNumber, JSNumberBoundsException
from streamlit.elements.lib.layout_utils import LayoutConfig, validate_width
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
    StreamlitAPIException,
    StreamlitValueAboveMaxError,
    StreamlitValueBelowMinError,
)
from streamlit.proto.Slider_pb2 import Slider as SliderProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    get_session_state,
    register_widget,
)

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import WidthWithoutContent

SliderNumericT = TypeVar("SliderNumericT", int, float)
SliderDatelikeT = TypeVar("SliderDatelikeT", date, time, datetime)

SliderNumericSpanT: TypeAlias = Union[
    list[SliderNumericT],
    tuple[()],
    tuple[SliderNumericT],
    tuple[SliderNumericT, SliderNumericT],
]
SliderDatelikeSpanT: TypeAlias = Union[
    list[SliderDatelikeT],
    tuple[()],
    tuple[SliderDatelikeT],
    tuple[SliderDatelikeT, SliderDatelikeT],
]

StepNumericT: TypeAlias = SliderNumericT
StepDatelikeT: TypeAlias = timedelta

SliderStep: TypeAlias = Union[int, float, timedelta]
SliderScalar: TypeAlias = Union[int, float, date, time, datetime]
SliderValueT = TypeVar("SliderValueT", int, float, date, time, datetime)
SliderValueGeneric: TypeAlias = Union[
    SliderValueT,
    Sequence[SliderValueT],
]
SliderValue: TypeAlias = Union[
    SliderValueGeneric[int],
    SliderValueGeneric[float],
    SliderValueGeneric[date],
    SliderValueGeneric[time],
    SliderValueGeneric[datetime],
]
SliderReturnGeneric: TypeAlias = Union[
    SliderValueT,
    tuple[SliderValueT],
    tuple[SliderValueT, SliderValueT],
]
SliderReturn: TypeAlias = Union[
    SliderReturnGeneric[int],
    SliderReturnGeneric[float],
    SliderReturnGeneric[date],
    SliderReturnGeneric[time],
    SliderReturnGeneric[datetime],
]

SECONDS_TO_MICROS: Final = 1000 * 1000
DAYS_TO_MICROS: Final = 24 * 60 * 60 * SECONDS_TO_MICROS

UTC_EPOCH: Final = datetime(1970, 1, 1, tzinfo=timezone.utc)

SUPPORTED_TYPES: Final = {
    Integral: SliderProto.INT,
    Real: SliderProto.FLOAT,
    datetime: SliderProto.DATETIME,
    date: SliderProto.DATE,
    time: SliderProto.TIME,
}
TIMELIKE_TYPES: Final = (SliderProto.DATETIME, SliderProto.TIME, SliderProto.DATE)


def _time_to_datetime(time_: time) -> datetime:
    # Note, here we pick an arbitrary date well after Unix epoch.
    # This prevents pre-epoch timezone issues (https://bugs.python.org/issue36759)
    # We're dropping the date from datetime later, anyway.
    return datetime.combine(date(2000, 1, 1), time_)


def _date_to_datetime(date_: date) -> datetime:
    return datetime.combine(date_, time())


def _delta_to_micros(delta: timedelta) -> int:
    return (
        delta.microseconds
        + delta.seconds * SECONDS_TO_MICROS
        + delta.days * DAYS_TO_MICROS
    )


def _datetime_to_micros(dt: datetime) -> int:
    # The frontend is not aware of timezones and only expects a UTC-based
    # timestamp (in microseconds). Since we want to show the date/time exactly
    # as it is in the given datetime object, we just set the tzinfo to UTC and
    # do not do any timezone conversions. Only the backend knows about
    # original timezone and will replace the UTC timestamp in the deserialization.
    utc_dt = dt.replace(tzinfo=timezone.utc)
    return _delta_to_micros(utc_dt - UTC_EPOCH)


def _micros_to_datetime(micros: int, orig_tz: tzinfo | None) -> datetime:
    """Restore times/datetimes to original timezone (dates are always naive)."""
    utc_dt = UTC_EPOCH + timedelta(microseconds=micros)
    # Add the original timezone. No conversion is required here,
    # since in the serialization, we also just replace the timestamp with UTC.
    return utc_dt.replace(tzinfo=orig_tz)


class SliderDefaultValues(TypedDict):
    min_value: SliderScalar
    max_value: SliderScalar
    step: SliderStep
    format: str


@dataclass
class SliderSerde:
    value: list[float]
    data_type: int
    single_value: bool
    orig_tz: tzinfo | None

    def deserialize_single_value(self, value: float) -> SliderScalar:
        if self.data_type == SliderProto.INT:
            return int(value)
        if self.data_type == SliderProto.DATETIME:
            return _micros_to_datetime(int(value), self.orig_tz)
        if self.data_type == SliderProto.DATE:
            return _micros_to_datetime(int(value), self.orig_tz).date()
        if self.data_type == SliderProto.TIME:
            return (
                _micros_to_datetime(int(value), self.orig_tz)
                .time()
                .replace(tzinfo=self.orig_tz)
            )
        return value

    def deserialize(self, ui_value: list[float] | None) -> Any:
        if ui_value is not None:
            val = ui_value
        else:
            # Widget has not been used; fallback to the original value,
            val = self.value

        # The widget always returns a float array, so fix the return type if necessary
        deserialized_values = [self.deserialize_single_value(v) for v in val]
        return (
            deserialized_values[0] if self.single_value else tuple(deserialized_values)
        )

    def serialize(self, v: Any) -> list[Any]:
        range_value = isinstance(v, (list, tuple))
        # Convert to list to handle tuples
        processed_value = list(v) if range_value else [v]

        if self.data_type == SliderProto.DATE:
            return [
                _datetime_to_micros(_date_to_datetime(val)) for val in processed_value
            ]
        if self.data_type == SliderProto.TIME:
            return [
                _datetime_to_micros(_time_to_datetime(val)) for val in processed_value
            ]
        if self.data_type == SliderProto.DATETIME:
            return [_datetime_to_micros(val) for val in processed_value]
        # For numeric types, ensure they are floats if not already
        return [float(val) for val in processed_value]


class SliderMixin:
    # If min/max/value/step are not provided, then we return an int.
    # if ONLY step is provided, then it must be an int and we return an int.
    @overload
    def slider(
        self,
        label: str,
        min_value: None = None,
        max_value: None = None,
        value: None = None,
        step: int | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> int: ...

    # If min-value or max_value is provided and a numeric type, and value (if provided)
    #   is a singular numeric, return the same numeric type.
    @overload
    def slider(
        self,
        label: str,
        min_value: SliderNumericT | None = None,
        max_value: SliderNumericT | None = None,
        value: SliderNumericT | None = None,
        step: StepNumericT[SliderNumericT] | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> SliderNumericT: ...

    # If value is provided and a sequence of numeric type,
    #   return a tuple of the same numeric type.
    @overload
    def slider(
        self,
        label: str,
        min_value: SliderNumericT | None = None,
        max_value: SliderNumericT | None = None,
        *,
        value: SliderNumericSpanT[SliderNumericT],
        step: StepNumericT[SliderNumericT] | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> tuple[SliderNumericT, SliderNumericT]: ...

    # If value is provided positionally and a sequence of numeric type,
    #   return a tuple of the same numeric type.
    @overload
    def slider(
        self,
        label: str,
        min_value: SliderNumericT,
        max_value: SliderNumericT,
        value: SliderNumericSpanT[SliderNumericT],
        step: StepNumericT[SliderNumericT] | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> tuple[SliderNumericT, SliderNumericT]: ...

    # If min-value is provided and a datelike type, and value (if provided)
    #   is a singular datelike, return the same datelike type.
    @overload
    def slider(
        self,
        label: str,
        min_value: SliderDatelikeT,
        max_value: SliderDatelikeT | None = None,
        value: SliderDatelikeT | None = None,
        step: StepDatelikeT | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> SliderDatelikeT: ...

    # If max-value is provided and a datelike type, and value (if provided)
    #   is a singular datelike, return the same datelike type.
    @overload
    def slider(
        self,
        label: str,
        min_value: None = None,
        *,
        max_value: SliderDatelikeT,
        value: SliderDatelikeT | None = None,
        step: StepDatelikeT | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> SliderDatelikeT: ...

    # If value is provided and a datelike type, return the same datelike type.
    @overload
    def slider(
        self,
        label: str,
        min_value: None = None,
        max_value: None = None,
        *,
        value: SliderDatelikeT,
        step: StepDatelikeT | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> SliderDatelikeT: ...

    # If value is provided and a sequence of datelike type,
    #   return a tuple of the same datelike type.
    @overload
    def slider(
        self,
        label: str,
        min_value: SliderDatelikeT | None = None,
        max_value: SliderDatelikeT | None = None,
        *,
        value: list[SliderDatelikeT]
        | tuple[SliderDatelikeT]
        | tuple[SliderDatelikeT, SliderDatelikeT],
        step: StepDatelikeT | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> tuple[SliderDatelikeT, SliderDatelikeT]: ...

    # If value is provided positionally and a sequence of datelike type,
    #   return a tuple of the same datelike type.
    @overload
    def slider(
        self,
        label: str,
        min_value: SliderDatelikeT,
        max_value: SliderDatelikeT,
        value: SliderDatelikeSpanT[SliderDatelikeT],
        /,
        step: StepDatelikeT | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> tuple[SliderDatelikeT, SliderDatelikeT]: ...

    # https://github.com/python/mypy/issues/17614
    @gather_metrics("slider")  # type: ignore[misc]
    def slider(
        self,
        label: str,
        min_value: SliderScalar | None = None,
        max_value: SliderScalar | None = None,
        value: SliderValue | None = None,
        step: SliderStep | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> Any:
        r"""Display a slider widget.

        This supports int, float, date, time, and datetime types.

        This also allows you to render a range slider by passing a two-element
        tuple or list as the ``value``.

        The difference between ``st.slider`` and ``st.select_slider`` is that
        ``slider`` only accepts numerical or date/time data and takes a range as
        input, while ``select_slider`` accepts any datatype and takes an iterable
        set of options.

        .. note::
            Integer values exceeding +/- ``(1<<53) - 1`` cannot be accurately
            stored or returned by the widget due to serialization constraints
            between the Python server and JavaScript client. You must handle
            such numbers as floats, leading to a loss in precision.

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

        min_value : a supported type or None
            The minimum permitted value.
            If this is ``None`` (default), the minimum value depends on the
            type as follows:

            - integer: ``0``
            - float: ``0.0``
            - date or datetime: ``value - timedelta(days=14)``
            - time: ``time.min``

        max_value : a supported type or None
            The maximum permitted value.
            If this is ``None`` (default), the maximum value depends on the
            type as follows:

            - integer: ``100``
            - float: ``1.0``
            - date or datetime: ``value + timedelta(days=14)``
            - time: ``time.max``

        value : a supported type or a tuple/list of supported types or None
            The value of the slider when it first renders. If a tuple/list
            of two values is passed here, then a range slider with those lower
            and upper bounds is rendered. For example, if set to `(1, 10)` the
            slider will have a selectable range between 1 and 10.
            This defaults to ``min_value``. If the type is not otherwise
            specified in any of the numeric parameters, the widget will have an
            integer value.

        step : int, float, timedelta, or None
            The stepping interval.
            Defaults to 1 if the value is an int, 0.01 if a float,
            timedelta(days=1) if a date/datetime, timedelta(minutes=15) if a time
            (or if max_value - min_value < 1 day)

        format : str or None
            A printf-style format string controlling how the interface should
            display numbers. This does not impact the return value.

            For information about formatting integers and floats, see
            `sprintf.js
            <https://github.com/alexei/sprintf.js?tab=readme-ov-file#format-specification>`_.
            For example, ``format="%0.1f"`` adjusts the displayed decimal
            precision to only show one digit after the decimal.

            For information about formatting datetimes, dates, and times, see
            `momentJS <https://momentjs.com/docs/#/displaying/format/>`_.
            For example, ``format="ddd ha"`` adjusts the displayed datetime to
            show the day of the week and the hour ("Tue 8pm").

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
            An optional callback invoked when this slider's value changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean that disables the slider if set to ``True``.
            The default is ``False``.

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
        int/float/date/time/datetime or tuple of int/float/date/time/datetime
            The current value of the slider widget. The return type will match
            the data type of the value parameter.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> age = st.slider("How old are you?", 0, 130, 25)
        >>> st.write("I'm ", age, "years old")

        And here's an example of a range slider:

        >>> import streamlit as st
        >>>
        >>> values = st.slider("Select a range of values", 0.0, 100.0, (25.0, 75.0))
        >>> st.write("Values:", values)

        This is a range time slider:

        >>> import streamlit as st
        >>> from datetime import time
        >>>
        >>> appointment = st.slider(
        ...     "Schedule your appointment:", value=(time(11, 30), time(12, 45))
        ... )
        >>> st.write("You're scheduled for:", appointment)

        Finally, a datetime slider:

        >>> import streamlit as st
        >>> from datetime import datetime
        >>>
        >>> start_time = st.slider(
        ...     "When do you start?",
        ...     value=datetime(2020, 1, 1, 9, 30),
        ...     format="MM/DD/YY - hh:mm",
        ... )
        >>> st.write("Start time:", start_time)

        .. output::
           https://doc-slider.streamlit.app/
           height: 300px

        """
        ctx = get_script_run_ctx()
        return self._slider(
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
            disabled=disabled,
            label_visibility=label_visibility,
            width=width,
            ctx=ctx,
        )

    def _slider(
        self,
        label: str,
        min_value: Any = None,
        max_value: Any = None,
        value: Any = None,
        step: Any = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
        ctx: ScriptRunContext | None = None,
    ) -> SliderReturn:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=value,
        )
        maybe_raise_label_warnings(label, label_visibility)

        element_id = compute_and_register_element_id(
            "slider",
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
            width=width,
        )

        if value is None:
            # We need to know if this is a single or range slider, but don't have
            # a default value, so we check if session_state can tell us.
            # We already calculated the id, so there is no risk of this causing
            # the id to change.

            single_value = True

            session_state = get_session_state().filtered_state

            if key is not None and key in session_state:
                state_value = session_state[key]
                single_value = isinstance(state_value, tuple(SUPPORTED_TYPES.keys()))

            if single_value:
                value = min_value if min_value is not None else 0
            else:
                mn = min_value if min_value is not None else 0
                mx = max_value if max_value is not None else 100
                value = [mn, mx]

        # Ensure that the value is either a single value or a range of values.
        single_value = isinstance(value, tuple(SUPPORTED_TYPES.keys()))
        range_value = isinstance(value, (list, tuple)) and len(value) in (0, 1, 2)
        if not single_value and not range_value:
            raise StreamlitAPIException(
                "Slider value should either be an int/float/datetime or a list/tuple of "
                "0 to 2 ints/floats/datetimes"
            )

        # Simplify future logic by always making value a list
        prepared_value: Sequence[SliderScalar] = [value] if single_value else value  # ty: ignore[invalid-assignment]

        def value_to_generic_type(v: Any) -> SliderProto.DataType.ValueType:
            if isinstance(v, Integral):
                return SUPPORTED_TYPES[Integral]
            if isinstance(v, Real):
                return SUPPORTED_TYPES[Real]
            return SUPPORTED_TYPES[type(v)]

        def all_same_type(items: Any) -> bool:
            return len(set(map(value_to_generic_type, items))) < 2

        if not all_same_type(prepared_value):
            raise StreamlitAPIException(
                "Slider tuple/list components must be of the same type.\n"
                f"But were: {list(map(type, prepared_value))}"
            )

        data_type = (
            SliderProto.INT
            if len(prepared_value) == 0
            else value_to_generic_type(prepared_value[0])
        )

        datetime_min: datetime | time = time.min
        datetime_max: datetime | time = time.max
        if data_type == SliderProto.TIME:
            prepared_value = cast("Sequence[time]", prepared_value)

            datetime_min = time.min.replace(tzinfo=prepared_value[0].tzinfo)
            datetime_max = time.max.replace(tzinfo=prepared_value[0].tzinfo)
        if data_type in (SliderProto.DATETIME, SliderProto.DATE):
            prepared_value = cast("Sequence[datetime]", prepared_value)

            datetime_min = prepared_value[0] - timedelta(days=14)
            datetime_max = prepared_value[0] + timedelta(days=14)

        defaults: Final[dict[SliderProto.DataType.ValueType, dict[str, Any]]] = {
            SliderProto.INT: {
                "min_value": 0,
                "max_value": 100,
                "step": 1,
                "format": "%d",
            },
            SliderProto.FLOAT: {
                "min_value": 0.0,
                "max_value": 1.0,
                "step": 0.01,
                "format": "%0.2f",
            },
            SliderProto.DATETIME: {
                "min_value": datetime_min,
                "max_value": datetime_max,
                "step": timedelta(days=1),
                "format": "YYYY-MM-DD",
            },
            SliderProto.DATE: {
                "min_value": datetime_min,
                "max_value": datetime_max,
                "step": timedelta(days=1),
                "format": "YYYY-MM-DD",
            },
            SliderProto.TIME: {
                "min_value": datetime_min,
                "max_value": datetime_max,
                "step": timedelta(minutes=15),
                "format": "HH:mm",
            },
        }

        if min_value is None:
            min_value = defaults[data_type]["min_value"]
        if max_value is None:
            max_value = defaults[data_type]["max_value"]
        if step is None:
            step = defaults[data_type]["step"]
            if data_type in (
                SliderProto.DATETIME,
                SliderProto.DATE,
            ) and max_value - min_value < timedelta(days=1):
                step = timedelta(minutes=15)
        if format is None:
            format = cast("str", defaults[data_type]["format"])  # noqa: A001

        if step == 0:
            raise StreamlitAPIException(
                "Slider components cannot be passed a `step` of 0."
            )

        # Ensure that all arguments are of the same type.
        slider_args = [min_value, max_value, step]
        int_args = all(isinstance(a, Integral) for a in slider_args)
        float_args = all(
            isinstance(a, Real) and not isinstance(a, Integral) for a in slider_args
        )
        # When min and max_value are the same timelike, step should be a timedelta
        timelike_args = (
            data_type in TIMELIKE_TYPES
            and isinstance(step, timedelta)
            and type(min_value) is type(max_value)
        )

        if not int_args and not float_args and not timelike_args:
            msg = (
                "Slider value arguments must be of matching types."
                f"\n`min_value` has {type(min_value).__name__} type."
                f"\n`max_value` has {type(max_value).__name__} type."
                f"\n`step` has {type(step).__name__} type."
            )
            raise StreamlitAPIException(msg)

        # Ensure that the value matches arguments' types.
        all_ints = data_type == SliderProto.INT and int_args
        all_floats = data_type == SliderProto.FLOAT and float_args
        all_timelikes = data_type in TIMELIKE_TYPES and timelike_args

        if not all_ints and not all_floats and not all_timelikes:
            msg = (
                "Both value and arguments must be of the same type."
                f"\n`value` has {type(value).__name__} type."
                f"\n`min_value` has {type(min_value).__name__} type."
                f"\n`max_value` has {type(max_value).__name__} type."
            )
            raise StreamlitAPIException(msg)

        # Ensure that min <= value(s) <= max, adjusting the bounds as necessary.
        min_value = min(min_value, max_value)
        max_value = max(min_value, max_value)
        if len(prepared_value) == 1:
            min_value = min(prepared_value[0], min_value)
            max_value = max(prepared_value[0], max_value)
        elif len(prepared_value) == 2:
            start, end = prepared_value
            if start > end:  # type: ignore[operator]
                # Swap start and end, since they seem reversed
                start, end = end, start
                prepared_value = start, end
            min_value = min(start, min_value)
            max_value = max(end, max_value)
        else:
            # Empty list, so let's just use the outer bounds
            prepared_value = [min_value, max_value]

        # Bounds checks. JSNumber produces human-readable exceptions that
        # we simply re-package as StreamlitAPIExceptions.
        # (We check `min_value` and `max_value` here; `value` and `step` are
        # already known to be in the [min_value, max_value] range.)
        try:
            if all_ints:
                JSNumber.validate_int_bounds(min_value, "`min_value`")
                JSNumber.validate_int_bounds(max_value, "`max_value`")
            elif all_floats:
                JSNumber.validate_float_bounds(min_value, "`min_value`")
                JSNumber.validate_float_bounds(max_value, "`max_value`")
            elif all_timelikes:
                # No validation yet. TODO: check between 0001-01-01 to 9999-12-31
                pass
        except JSNumberBoundsException as e:
            raise StreamlitAPIException(str(e))

        orig_tz = None
        # Convert dates or times into datetimes
        if data_type == SliderProto.TIME:
            prepared_value = cast("Sequence[time]", prepared_value)
            min_value = cast("time", min_value)
            max_value = cast("time", max_value)

            prepared_value = list(map(_time_to_datetime, prepared_value))
            min_value = _time_to_datetime(min_value)
            max_value = _time_to_datetime(max_value)

        if data_type == SliderProto.DATE:
            prepared_value = cast("Sequence[date]", prepared_value)
            min_value = cast("date", min_value)
            max_value = cast("date", max_value)

            prepared_value = list(map(_date_to_datetime, prepared_value))
            min_value = _date_to_datetime(min_value)
            max_value = _date_to_datetime(max_value)

        # The frontend will error if the values are equal, so checking here
        # lets us produce a nicer python error message and stack trace.
        if min_value == max_value:
            raise StreamlitAPIException(
                "Slider `min_value` must be less than the `max_value`."
                f"\nThe values were {min_value} and {max_value}."
            )

        # Now, convert to microseconds (so we can serialize datetime to a long)
        if data_type in TIMELIKE_TYPES:
            prepared_value = cast("Sequence[datetime]", prepared_value)
            min_value = cast("datetime", min_value)
            max_value = cast("datetime", max_value)
            step = cast("timedelta", step)

            # Restore times/datetimes to original timezone (dates are always naive)
            orig_tz = (
                prepared_value[0].tzinfo
                if data_type in (SliderProto.TIME, SliderProto.DATETIME)
                else None
            )

            prepared_value = list(map(_datetime_to_micros, prepared_value))
            min_value = _datetime_to_micros(min_value)
            max_value = _datetime_to_micros(max_value)
            step = _delta_to_micros(step)

        # At this point, prepared_value is expected to be a list of floats:
        prepared_value = cast("list[float]", prepared_value)

        # It would be great if we could guess the number of decimal places from
        # the `step` argument, but this would only be meaningful if step were a
        # decimal. As a possible improvement we could make this function accept
        # decimals and/or use some heuristics for floats.

        slider_proto = SliderProto()
        slider_proto.type = SliderProto.Type.SLIDER
        slider_proto.id = element_id
        slider_proto.label = label
        slider_proto.format = format
        slider_proto.default[:] = prepared_value
        slider_proto.min = min_value
        slider_proto.max = max_value
        slider_proto.step = cast("float", step)
        slider_proto.data_type = data_type
        slider_proto.options[:] = []
        slider_proto.form_id = current_form_id(self.dg)
        slider_proto.disabled = disabled
        slider_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if help is not None:
            slider_proto.help = dedent(help)

        serde = SliderSerde(
            prepared_value,
            data_type,
            single_value,
            orig_tz,
        )

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

        if widget_state.value_changed:
            # Min/Max bounds checks when the value is updated.
            serialized_values = serde.serialize(widget_state.value)
            for serialized_value in serialized_values:
                # Use the deserialized values for more readable error messages for dates/times
                deserialized_value = serde.deserialize_single_value(serialized_value)

                if serialized_value < slider_proto.min:
                    raise StreamlitValueBelowMinError(
                        value=deserialized_value,
                        min_value=serde.deserialize_single_value(slider_proto.min),
                    )
                if serialized_value > slider_proto.max:
                    raise StreamlitValueAboveMaxError(
                        value=deserialized_value,
                        max_value=serde.deserialize_single_value(slider_proto.max),
                    )

            slider_proto.value[:] = serialized_values
            slider_proto.set_value = True

        validate_width(width)
        layout_config = LayoutConfig(width=width)

        self.dg._enqueue("slider", slider_proto, layout_config=layout_config)
        return cast("SliderReturn", widget_state.value)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
