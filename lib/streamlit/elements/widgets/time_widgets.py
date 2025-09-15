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

import re
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from textwrap import dedent
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Literal,
    Union,
    cast,
    overload,
)

from typing_extensions import TypeAlias

from streamlit.elements.lib.form_utils import current_form_id
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
from streamlit.errors import StreamlitAPIException
from streamlit.proto.DateInput_pb2 import DateInput as DateInputProto
from streamlit.proto.TimeInput_pb2 import TimeInput as TimeInputProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    get_session_state,
    register_widget,
)
from streamlit.time_util import adjust_years

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

# Type for things that point to a specific time (even if a default time, though not None).
TimeValue: TypeAlias = Union[time, datetime, str, Literal["now"]]

# Type for things that point to a specific date (even if a default date, including None).
NullableScalarDateValue: TypeAlias = Union[date, datetime, str, Literal["today"], None]

# The accepted input value for st.date_input. Can be a date scalar or a date range.
DateValue: TypeAlias = Union[NullableScalarDateValue, Sequence[NullableScalarDateValue]]

# The return value of st.date_input.
DateWidgetRangeReturn: TypeAlias = Union[
    tuple[()],
    tuple[date],
    tuple[date, date],
]
DateWidgetReturn: TypeAlias = Union[date, DateWidgetRangeReturn, None]


DEFAULT_STEP_MINUTES: Final = 15
ALLOWED_DATE_FORMATS: Final = re.compile(
    r"^(YYYY[/.\-]MM[/.\-]DD|DD[/.\-]MM[/.\-]YYYY|MM[/.\-]DD[/.\-]YYYY)$"
)


def _convert_timelike_to_time(value: TimeValue) -> time:
    if value == "now":
        # Set value default.
        return datetime.now().time().replace(second=0, microsecond=0)

    if isinstance(value, str):
        try:
            return time.fromisoformat(value)
        except ValueError:
            try:
                return (
                    datetime.fromisoformat(value)
                    .time()
                    .replace(second=0, microsecond=0)
                )
            except ValueError:
                # We throw an error below.
                pass

    if isinstance(value, datetime):
        return value.time().replace(second=0, microsecond=0)

    if isinstance(value, time):
        return value

    raise StreamlitAPIException(
        "The type of value should be one of datetime, time, ISO string or None"
    )


def _convert_datelike_to_date(
    value: NullableScalarDateValue,
) -> date:
    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    if value in {"today"}:
        return datetime.now().date()

    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            try:
                return datetime.fromisoformat(value).date()
            except ValueError:
                # We throw an error below.
                pass

    raise StreamlitAPIException(
        'Date value should either be an date/datetime or an ISO string or "today"'
    )


def _parse_date_value(value: DateValue) -> tuple[list[date] | None, bool]:
    if value is None:
        return None, False

    value_tuple: Sequence[NullableScalarDateValue]

    if isinstance(value, Sequence) and not isinstance(value, str):
        is_range = True
        value_tuple = value
    else:
        is_range = False
        value_tuple = [cast("NullableScalarDateValue", value)]

    if len(value_tuple) not in {0, 1, 2}:
        raise StreamlitAPIException(
            "DateInput value should either be an date/datetime or a list/tuple of "
            "0 - 2 date/datetime values"
        )

    parsed_dates = [_convert_datelike_to_date(v) for v in value_tuple]

    return parsed_dates, is_range


def _parse_min_date(
    min_value: NullableScalarDateValue,
    parsed_dates: Sequence[date] | None,
) -> date:
    parsed_min_date: date
    if isinstance(min_value, (datetime, date, str)):
        parsed_min_date = _convert_datelike_to_date(min_value)
    elif min_value is None:
        if parsed_dates:
            parsed_min_date = adjust_years(parsed_dates[0], years=-10)
        else:
            parsed_min_date = adjust_years(date.today(), years=-10)
    else:
        raise StreamlitAPIException(
            "DateInput min should either be a date/datetime or None"
        )
    return parsed_min_date


def _parse_max_date(
    max_value: NullableScalarDateValue,
    parsed_dates: Sequence[date] | None,
) -> date:
    parsed_max_date: date
    if isinstance(max_value, (datetime, date, str)):
        parsed_max_date = _convert_datelike_to_date(max_value)
    elif max_value is None:
        if parsed_dates:
            parsed_max_date = adjust_years(parsed_dates[-1], years=10)
        else:
            parsed_max_date = adjust_years(date.today(), years=10)
    else:
        raise StreamlitAPIException(
            "DateInput max should either be a date/datetime or None"
        )
    return parsed_max_date


@dataclass(frozen=True)
class _DateInputValues:
    value: Sequence[date] | None
    is_range: bool
    max: date
    min: date

    @classmethod
    def from_raw_values(
        cls,
        value: DateValue,
        min_value: NullableScalarDateValue,
        max_value: NullableScalarDateValue,
    ) -> _DateInputValues:
        parsed_value, is_range = _parse_date_value(value=value)
        parsed_min = _parse_min_date(
            min_value=min_value,
            parsed_dates=parsed_value,
        )
        parsed_max = _parse_max_date(
            max_value=max_value,
            parsed_dates=parsed_value,
        )

        if value == "today":
            v = cast("list[date]", parsed_value)[0]
            if v < parsed_min:
                parsed_value = [parsed_min]
            if v > parsed_max:
                parsed_value = [parsed_max]

        return cls(
            value=parsed_value,
            is_range=is_range,
            min=parsed_min,
            max=parsed_max,
        )

    def __post_init__(self) -> None:
        if self.min > self.max:
            raise StreamlitAPIException(
                f"The `min_value`, set to {self.min}, shouldn't be larger "
                f"than the `max_value`, set to {self.max}."
            )

        if self.value:
            start_value = self.value[0]
            end_value = self.value[-1]

            if (start_value < self.min) or (end_value > self.max):
                raise StreamlitAPIException(
                    f"The default `value` of {self.value} "
                    f"must lie between the `min_value` of {self.min} "
                    f"and the `max_value` of {self.max}, inclusively."
                )


@dataclass
class TimeInputSerde:
    value: time | None

    def deserialize(self, ui_value: str | None) -> time | None:
        return (
            datetime.strptime(ui_value, "%H:%M").time()
            if ui_value is not None
            else self.value
        )

    def serialize(self, v: datetime | time | None) -> str | None:
        if v is None:
            return None
        if isinstance(v, datetime):
            v = v.time()
        return time.strftime(v, "%H:%M")


@dataclass
class DateInputSerde:
    value: _DateInputValues

    def deserialize(self, ui_value: Any) -> DateWidgetReturn:
        return_value: Sequence[date] | None
        if ui_value is not None:
            return_value = tuple(
                datetime.strptime(v, "%Y/%m/%d").date() for v in ui_value
            )
        else:
            return_value = self.value.value

        if return_value is None or len(return_value) == 0:
            return () if self.value.is_range else None

        if not self.value.is_range:
            return return_value[0]
        return cast("DateWidgetReturn", tuple(return_value))

    def serialize(self, v: DateWidgetReturn) -> list[str]:
        if v is None:
            return []

        to_serialize = list(v) if isinstance(v, Sequence) else [v]
        return [date.strftime(v, "%Y/%m/%d") for v in to_serialize]


class TimeWidgetsMixin:
    @overload
    def time_input(
        self,
        label: str,
        value: TimeValue = "now",
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        step: int | timedelta = timedelta(minutes=DEFAULT_STEP_MINUTES),
        width: WidthWithoutContent = "stretch",
    ) -> time:
        pass

    @overload
    def time_input(
        self,
        label: str,
        value: None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        step: int | timedelta = timedelta(minutes=DEFAULT_STEP_MINUTES),
        width: WidthWithoutContent = "stretch",
    ) -> time | None:
        pass

    @gather_metrics("time_input")
    def time_input(
        self,
        label: str,
        value: TimeValue | None = "now",
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        step: int | timedelta = timedelta(minutes=DEFAULT_STEP_MINUTES),
        width: WidthWithoutContent = "stretch",
    ) -> time | None:
        r"""Display a time input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this time input is for.
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

        value : "now", datetime.time, datetime.datetime, str, or None
            The value of this widget when it first renders. This can be one of
            the following:

            - ``"now"`` (default): The widget initializes with the current time.
            - A ``datetime.time`` or ``datetime.datetime`` object: The widget
              initializes with the given time, ignoring any date if included.
            - An ISO-formatted time ("hh:mm", "hh:mm:ss", or "hh:mm:ss.sss") or
              datetime ("YYYY-MM-DD hh:mm:ss") string: The widget initializes
              with the given time, ignoring any date if included.
            - ``None``: The widget initializes with no time and returns
              ``None`` until the user selects a time.

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
            An optional callback invoked when this time_input's value changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        disabled : bool
            An optional boolean that disables the time input if set to
            ``True``. The default is ``False``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.
            If this is ``"collapsed"``, Streamlit displays no label or spacer.

        step : int or timedelta
            The stepping interval in seconds. Defaults to 900, i.e. 15 minutes.
            You can also pass a datetime.timedelta object.

        width : "stretch" or int
            The width of the time input widget. This can be one of the following:

            - ``"stretch"`` (default): The width of the widget matches the
              width of the parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

        Returns
        -------
        datetime.time or None
            The current value of the time input widget or ``None`` if no time has been
            selected.

        Example
        -------
        >>> import datetime
        >>> import streamlit as st
        >>>
        >>> t = st.time_input("Set an alarm for", datetime.time(8, 45))
        >>> st.write("Alarm is set for", t)

        .. output::
           https://doc-time-input.streamlit.app/
           height: 260px

        To initialize an empty time input, use ``None`` as the value:

        >>> import datetime
        >>> import streamlit as st
        >>>
        >>> t = st.time_input("Set an alarm for", value=None)
        >>> st.write("Alarm is set for", t)

        .. output::
           https://doc-time-input-empty.streamlit.app/
           height: 260px

        """
        ctx = get_script_run_ctx()
        return self._time_input(
            label=label,
            value=value,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            label_visibility=label_visibility,
            step=step,
            width=width,
            ctx=ctx,
        )

    def _time_input(
        self,
        label: str,
        value: TimeValue | None = "now",
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        step: int | timedelta = timedelta(minutes=DEFAULT_STEP_MINUTES),
        width: WidthWithoutContent = "stretch",
        ctx: ScriptRunContext | None = None,
    ) -> time | None:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=value if value != "now" else None,
        )
        maybe_raise_label_warnings(label, label_visibility)

        parsed_time: time | None
        parsed_time = None if value is None else _convert_timelike_to_time(value)

        element_id = compute_and_register_element_id(
            "time_input",
            user_key=key,
            # Ensure stable ID when key is provided; only whitelist step since it
            # affects the selection granularity and available options.
            key_as_main_identity={"step"},
            dg=self.dg,
            label=label,
            value=parsed_time if isinstance(value, (datetime, time)) else value,
            help=help,
            step=step,
            width=width,
        )
        del value

        session_state = get_session_state().filtered_state
        if key is not None and key in session_state and session_state[key] is None:
            parsed_time = None

        time_input_proto = TimeInputProto()
        time_input_proto.id = element_id
        time_input_proto.label = label
        if parsed_time is not None:
            time_input_proto.default = time.strftime(parsed_time, "%H:%M")
        time_input_proto.form_id = current_form_id(self.dg)
        if not isinstance(step, (int, timedelta)):
            raise StreamlitAPIException(
                f"`step` can only be `int` or `timedelta` but {type(step)} is provided."
            )
        if isinstance(step, timedelta):
            step = step.seconds
        if step < 60 or step > timedelta(hours=23).seconds:
            raise StreamlitAPIException(
                f"`step` must be between 60 seconds and 23 hours but is currently set to {step} seconds."
            )
        time_input_proto.step = step
        time_input_proto.disabled = disabled
        time_input_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )

        if help is not None:
            time_input_proto.help = dedent(help)

        serde = TimeInputSerde(parsed_time)
        widget_state = register_widget(
            time_input_proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_value",
        )

        if widget_state.value_changed:
            if (serialized_value := serde.serialize(widget_state.value)) is not None:
                time_input_proto.value = serialized_value
            time_input_proto.set_value = True

        validate_width(width)
        layout_config = LayoutConfig(width=width)

        self.dg._enqueue("time_input", time_input_proto, layout_config=layout_config)
        return widget_state.value

    @overload
    def date_input(
        self,
        label: str,
        value: date | datetime | str | Literal["today"] = "today",
        min_value: NullableScalarDateValue = None,
        max_value: NullableScalarDateValue = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        format: str = "YYYY/MM/DD",
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> date: ...

    @overload
    def date_input(
        self,
        label: str,
        value: None,
        min_value: NullableScalarDateValue = None,
        max_value: NullableScalarDateValue = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        format: str = "YYYY/MM/DD",
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> date | None: ...

    @overload
    def date_input(
        self,
        label: str,
        value: tuple[NullableScalarDateValue]
        | tuple[NullableScalarDateValue, NullableScalarDateValue]
        | list[NullableScalarDateValue],
        min_value: NullableScalarDateValue = None,
        max_value: NullableScalarDateValue = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        format: str = "YYYY/MM/DD",
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> DateWidgetRangeReturn: ...

    @gather_metrics("date_input")
    def date_input(
        self,
        label: str,
        value: DateValue = "today",
        min_value: NullableScalarDateValue = None,
        max_value: NullableScalarDateValue = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        format: str = "YYYY/MM/DD",
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
    ) -> DateWidgetReturn:
        r"""Display a date input widget.

        The date input widget can be configured to accept a single date or a
        date range. The first day of the week is determined from the user's
        locale in their browser.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this date input is for.
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

        value : "today", datetime.date, datetime.datetime, str, list/tuple of these, or None
            The value of this widget when it first renders. This can be one of
            the following:

            - ``"today"`` (default): The widget initializes with the current date.
            - A ``datetime.date`` or ``datetime.datetime`` object: The widget
              initializes with the given date, ignoring any time if included.
            - An ISO-formatted date ("YYYY-MM-DD") or datetime
              ("YYYY-MM-DD hh:mm:ss") string: The widget initializes with the
              given date, ignoring any time if included.
            - A list or tuple with up to two of the above: The widget will
              initialize with the given date interval and return a tuple of the
              selected interval. You can pass an empty list to initialize the
              widget with an empty interval or a list with one value to
              initialize only the beginning date of the iterval.
            - ``None``: The widget initializes with no date and returns
              ``None`` until the user selects a date.

        min_value : "today", datetime.date, datetime.datetime, str, or None
            The minimum selectable date. This can be any of the date types
            accepted by ``value``, except list or tuple.

            If this is ``None`` (default), the minimum selectable date is ten
            years before the initial value. If the initial value is an
            interval, the minimum selectable date is ten years before the start
            date of the interval. If no initial value is set, the minimum
            selectable date is ten years before today.

        max_value : "today", datetime.date, datetime.datetime, str, or None
            The maximum selectable date. This can be any of the date types
            accepted by ``value``, except list or tuple.

            If this is ``None`` (default), the maximum selectable date is ten
            years after the initial value. If the initial value is an interval,
            the maximum selectable date is ten years after the end date of the
            interval. If no initial value is set, the maximum selectable date
            is ten years after today.

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
            An optional callback invoked when this date_input's value changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        format : str
            A format string controlling how the interface should display dates.
            Supports "YYYY/MM/DD" (default), "DD/MM/YYYY", or "MM/DD/YYYY".
            You may also use a period (.) or hyphen (-) as separators.

        disabled : bool
            An optional boolean that disables the date input if set to
            ``True``. The default is ``False``.

        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. The default is ``"visible"``. If this
            is ``"hidden"``, Streamlit displays an empty spacer instead of the
            label, which can help keep the widget aligned with other widgets.
            If this is ``"collapsed"``, Streamlit displays no label or spacer.

        width : "stretch" or int
            The width of the date input widget. This can be one of the following:

            - ``"stretch"`` (default): The width of the widget matches the
              width of the parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

        Returns
        -------
        datetime.date or a tuple with 0-2 dates or None
            The current value of the date input widget or ``None`` if no date has been
            selected.

        Examples
        --------
        >>> import datetime
        >>> import streamlit as st
        >>>
        >>> d = st.date_input("When's your birthday", datetime.date(2019, 7, 6))
        >>> st.write("Your birthday is:", d)

        .. output::
           https://doc-date-input.streamlit.app/
           height: 380px

        >>> import datetime
        >>> import streamlit as st
        >>>
        >>> today = datetime.datetime.now()
        >>> next_year = today.year + 1
        >>> jan_1 = datetime.date(next_year, 1, 1)
        >>> dec_31 = datetime.date(next_year, 12, 31)
        >>>
        >>> d = st.date_input(
        ...     "Select your vacation for next year",
        ...     (jan_1, datetime.date(next_year, 1, 7)),
        ...     jan_1,
        ...     dec_31,
        ...     format="MM.DD.YYYY",
        ... )
        >>> d

        .. output::
           https://doc-date-input1.streamlit.app/
           height: 380px

        To initialize an empty date input, use ``None`` as the value:

        >>> import datetime
        >>> import streamlit as st
        >>>
        >>> d = st.date_input("When's your birthday", value=None)
        >>> st.write("Your birthday is:", d)

        .. output::
           https://doc-date-input-empty.streamlit.app/
           height: 380px

        """
        ctx = get_script_run_ctx()
        return self._date_input(
            label=label,
            value=value,
            min_value=min_value,
            max_value=max_value,
            key=key,
            help=help,
            on_change=on_change,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            label_visibility=label_visibility,
            format=format,
            width=width,
            ctx=ctx,
        )

    def _date_input(
        self,
        label: str,
        value: DateValue = "today",
        min_value: NullableScalarDateValue = None,
        max_value: NullableScalarDateValue = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        format: str = "YYYY/MM/DD",
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        width: WidthWithoutContent = "stretch",
        ctx: ScriptRunContext | None = None,
    ) -> DateWidgetReturn:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=value if value != "today" else None,
        )
        maybe_raise_label_warnings(label, label_visibility)

        def parse_date_deterministic_for_id(v: NullableScalarDateValue) -> str | None:
            if v == "today":
                # For ID purposes, no need to parse the input string.
                return None
            if isinstance(v, str):
                # For ID purposes, no need to parse the input string.
                return v
            if isinstance(v, datetime):
                return date.strftime(v.date(), "%Y/%m/%d")
            if isinstance(v, date):
                return date.strftime(v, "%Y/%m/%d")

            return None

        parsed_min_date = parse_date_deterministic_for_id(min_value)
        parsed_max_date = parse_date_deterministic_for_id(max_value)

        parsed: str | None | list[str | None]
        if value == "today":
            parsed = None
        elif isinstance(value, Sequence):
            parsed = [parse_date_deterministic_for_id(v) for v in value]
        else:
            parsed = parse_date_deterministic_for_id(value)

        # TODO: this is missing the error path, integrate with the dateinputvalues parsing

        element_id = compute_and_register_element_id(
            "date_input",
            user_key=key,
            # Ensure stable ID when key is provided; explicitly whitelist parameters
            # that might invalidate the current widget state.
            # format should be supported. However, there is a bug in baseweb where
            # changing the format dynamically leads to a wrongly formatted date.
            # So, we whitelist it for now until we migrate this away from baseweb.
            key_as_main_identity={"min_value", "max_value", "format"},
            dg=self.dg,
            label=label,
            value=parsed,
            min_value=parsed_min_date,
            max_value=parsed_max_date,
            help=help,
            format=format,
            width=width,
        )
        if not bool(ALLOWED_DATE_FORMATS.match(format)):
            raise StreamlitAPIException(
                f"The provided format (`{format}`) is not valid. DateInput format "
                "should be one of `YYYY/MM/DD`, `DD/MM/YYYY`, or `MM/DD/YYYY` "
                "and can also use a period (.) or hyphen (-) as separators."
            )

        parsed_values = _DateInputValues.from_raw_values(
            value=value,
            min_value=min_value,
            max_value=max_value,
        )

        if value == "today":
            # We need to know if this is a single or range date_input, but don't have
            # a default value, so we check if session_state can tell us.
            # We already calculated the id, so there is no risk of this causing
            # the id to change.

            session_state = get_session_state().filtered_state

            if key is not None and key in session_state:
                state_value = session_state[key]
                parsed_values = _DateInputValues.from_raw_values(
                    value=state_value,
                    min_value=min_value,
                    max_value=max_value,
                )

        del value, min_value, max_value

        date_input_proto = DateInputProto()
        date_input_proto.id = element_id
        date_input_proto.is_range = parsed_values.is_range
        date_input_proto.disabled = disabled
        date_input_proto.label_visibility.value = get_label_visibility_proto_value(
            label_visibility
        )
        date_input_proto.format = format
        date_input_proto.label = label
        if parsed_values.value is None:
            # An empty array represents the empty state. The reason for using an empty
            # array here is that we cannot optional keyword for repeated fields
            # in protobuf.
            date_input_proto.default[:] = []
        else:
            date_input_proto.default[:] = [
                date.strftime(v, "%Y/%m/%d") for v in parsed_values.value
            ]
        date_input_proto.min = date.strftime(parsed_values.min, "%Y/%m/%d")
        date_input_proto.max = date.strftime(parsed_values.max, "%Y/%m/%d")
        date_input_proto.form_id = current_form_id(self.dg)

        if help is not None:
            date_input_proto.help = dedent(help)

        serde = DateInputSerde(parsed_values)

        widget_state = register_widget(
            date_input_proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_array_value",
        )

        if widget_state.value_changed:
            date_input_proto.value[:] = serde.serialize(widget_state.value)
            date_input_proto.set_value = True

        validate_width(width)
        layout_config = LayoutConfig(width=width)

        self.dg._enqueue("date_input", date_input_proto, layout_config=layout_config)
        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
