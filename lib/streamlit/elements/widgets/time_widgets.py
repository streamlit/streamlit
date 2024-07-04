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

import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from textwrap import dedent
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    List,
    Literal,
    Sequence,
    Tuple,
    Union,
    cast,
    overload,
)

from typing_extensions import TypeAlias

from streamlit.elements.form import current_form_id
from streamlit.elements.lib.policies import (
    check_widget_policies,
    maybe_raise_label_warnings,
)
from streamlit.elements.lib.utils import (
    Key,
    LabelVisibility,
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
from streamlit.runtime.state.common import compute_widget_id
from streamlit.time_util import adjust_years

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

SingleDateValue: TypeAlias = Union[date, datetime, None]
DateValue: TypeAlias = Union[SingleDateValue, Sequence[SingleDateValue]]
DateWidgetReturn: TypeAlias = Union[
    date, Tuple[()], Tuple[date], Tuple[date, date], None
]

DEFAULT_STEP_MINUTES: Final = 15
ALLOWED_DATE_FORMATS: Final = re.compile(
    r"^(YYYY[/.\-]MM[/.\-]DD|DD[/.\-]MM[/.\-]YYYY|MM[/.\-]DD[/.\-]YYYY)$"
)


def _parse_date_value(
    value: Literal["today", "default_value_today"] | DateValue,
) -> tuple[list[date] | None, bool]:
    parsed_dates: list[date]
    range_value: bool = False
    if value is None:
        return None, range_value
    if value == "today":
        parsed_dates = [datetime.now().date()]
    elif value == "default_value_today":
        parsed_dates = [datetime.now().date()]
    elif isinstance(value, datetime):
        parsed_dates = [value.date()]
    elif isinstance(value, date):
        parsed_dates = [value]
    elif isinstance(value, (list, tuple)):
        if len(value) not in {0, 1, 2}:
            raise StreamlitAPIException(
                "DateInput value should either be an date/datetime or a list/tuple of "
                "0 - 2 date/datetime values"
            )

        parsed_dates = [v.date() if isinstance(v, datetime) else v for v in value]
        range_value = True
    else:
        raise StreamlitAPIException(
            "DateInput value should either be an date/datetime or a list/tuple of "
            "0 - 2 date/datetime values"
        )
    return parsed_dates, range_value


def _parse_min_date(
    min_value: SingleDateValue,
    parsed_dates: Sequence[date] | None,
) -> date:
    parsed_min_date: date
    if isinstance(min_value, datetime):
        parsed_min_date = min_value.date()
    elif isinstance(min_value, date):
        parsed_min_date = min_value
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
    max_value: SingleDateValue,
    parsed_dates: Sequence[date] | None,
) -> date:
    parsed_max_date: date
    if isinstance(max_value, datetime):
        parsed_max_date = max_value.date()
    elif isinstance(max_value, date):
        parsed_max_date = max_value
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
        value: Literal["today", "default_value_today"] | DateValue,
        min_value: SingleDateValue,
        max_value: SingleDateValue,
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

        if value == "default_value_today":
            v = cast(List[date], parsed_value)[0]
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

    def deserialize(self, ui_value: str | None, widget_id: Any = "") -> time | None:
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

    def deserialize(
        self,
        ui_value: Any,
        widget_id: str = "",
    ) -> DateWidgetReturn:
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
        return cast(DateWidgetReturn, tuple(return_value))

    def serialize(self, v: DateWidgetReturn) -> list[str]:
        if v is None:
            return []

        to_serialize = list(v) if isinstance(v, (list, tuple)) else [v]
        return [date.strftime(v, "%Y/%m/%d") for v in to_serialize]


class TimeWidgetsMixin:
    @overload
    def time_input(
        self,
        label: str,
        value: time | datetime | Literal["now"] = "now",
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        step: int | timedelta = timedelta(minutes=DEFAULT_STEP_MINUTES),
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
    ) -> time | None:
        pass

    @gather_metrics("time_input")
    def time_input(
        self,
        label: str,
        value: time | datetime | Literal["now"] | None = "now",
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        step: int | timedelta = timedelta(minutes=DEFAULT_STEP_MINUTES),
    ) -> time | None:
        r"""Display a time input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this time input is for.
            The label can optionally contain Markdown and supports the following
            elements: Bold, Italics, Strikethroughs, Inline Code, Emojis, and Links.

            This also supports:

            * Emoji shortcodes, such as ``:+1:``  and ``:sunglasses:``.
              For a list of all supported codes,
              see https://share.streamlit.io/streamlit/emoji-shortcodes.

            * LaTeX expressions, by wrapping them in "$" or "$$" (the "$$"
              must be on their own lines). Supported LaTeX functions are listed
              at https://katex.org/docs/supported.html.

            * Colored text and background colors for text, using the syntax
              ``:color[text to be colored]`` and ``:color-background[text to be colored]``,
              respectively. ``color`` must be replaced with any of the following
              supported colors: blue, green, orange, red, violet, gray/grey, rainbow.
              For example, you can use ``:orange[your text here]`` or
              ``:blue-background[your text here]``.

            Unsupported elements are unwrapped so only their children (text contents) render.
            Display unsupported elements as literal characters by
            backslash-escaping them. E.g. ``1\. Not an ordered list``.

            For accessibility reasons, you should never set an empty label (label="")
            but hide it with label_visibility if needed. In the future, we may disallow
            empty labels by raising an exception.
        value : datetime.time/datetime.datetime, "now" or None
            The value of this widget when it first renders. This will be
            cast to str internally. If ``None``, will initialize empty and
            return ``None`` until the user selects a time. If "now" (default),
            will initialize with the current time.
        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            An optional tooltip that gets displayed next to the input.
        on_change : callable
            An optional callback invoked when this time_input's value changes.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.
        disabled : bool
            An optional boolean, which disables the time input if set to True.
            The default is False.
        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. If "hidden", the label doesn't show but there
            is still empty space for it above the widget (equivalent to label="").
            If "collapsed", both the label and the space are removed. Default is
            "visible".
        step : int or timedelta
            The stepping interval in seconds. Defaults to 900, i.e. 15 minutes.
            You can also pass a datetime.timedelta object.

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
            ctx=ctx,
        )

    def _time_input(
        self,
        label: str,
        value: time | datetime | Literal["now"] | None = "now",
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        step: int | timedelta = timedelta(minutes=DEFAULT_STEP_MINUTES),
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
        if value is None:
            parsed_time = None
        elif value == "now":
            # Set value default.
            parsed_time = datetime.now().time().replace(second=0, microsecond=0)
        elif isinstance(value, datetime):
            parsed_time = value.time().replace(second=0, microsecond=0)
        elif isinstance(value, time):
            parsed_time = value
        else:
            raise StreamlitAPIException(
                "The type of value should be one of datetime, time or None"
            )

        id = compute_widget_id(
            "time_input",
            user_key=key,
            label=label,
            value=parsed_time if isinstance(value, (datetime, time)) else value,
            key=key,
            help=help,
            step=step,
            form_id=current_form_id(self.dg),
            page=ctx.active_script_hash if ctx else None,
        )
        del value

        session_state = get_session_state().filtered_state
        if key is not None and key in session_state and session_state[key] is None:
            parsed_time = None

        time_input_proto = TimeInputProto()
        time_input_proto.id = id
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
            "time_input",
            time_input_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
        )

        if widget_state.value_changed:
            if (serialized_value := serde.serialize(widget_state.value)) is not None:
                time_input_proto.value = serialized_value
            time_input_proto.set_value = True

        self.dg._enqueue("time_input", time_input_proto)
        return widget_state.value

    @gather_metrics("date_input")
    def date_input(
        self,
        label: str,
        value: DateValue | Literal["today"] = "default_value_today",  # type: ignore[assignment]
        min_value: SingleDateValue = None,
        max_value: SingleDateValue = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        format: str = "YYYY/MM/DD",
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
    ) -> DateWidgetReturn:
        r"""Display a date input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this date input is for.
            The label can optionally contain Markdown and supports the following
            elements: Bold, Italics, Strikethroughs, Inline Code, Emojis, and Links.

            This also supports:

            * Emoji shortcodes, such as ``:+1:``  and ``:sunglasses:``.
              For a list of all supported codes,
              see https://share.streamlit.io/streamlit/emoji-shortcodes.

            * LaTeX expressions, by wrapping them in "$" or "$$" (the "$$"
              must be on their own lines). Supported LaTeX functions are listed
              at https://katex.org/docs/supported.html.

            * Colored text and background colors for text, using the syntax
              ``:color[text to be colored]`` and ``:color-background[text to be colored]``,
              respectively. ``color`` must be replaced with any of the following
              supported colors: blue, green, orange, red, violet, gray/grey, rainbow.
              For example, you can use ``:orange[your text here]`` or
              ``:blue-background[your text here]``.

            Unsupported elements are unwrapped so only their children (text contents) render.
            Display unsupported elements as literal characters by
            backslash-escaping them. E.g. ``1\. Not an ordered list``.

            For accessibility reasons, you should never set an empty label (label="")
            but hide it with label_visibility if needed. In the future, we may disallow
            empty labels by raising an exception.
        value : datetime.date or datetime.datetime or list/tuple of datetime.date or datetime.datetime, "today", or None
            The value of this widget when it first renders. If a list/tuple with
            0 to 2 date/datetime values is provided, the datepicker will allow
            users to provide a range. If ``None``, will initialize empty and
            return ``None`` until the user provides input. If "today" (default),
            will initialize with today as a single-date picker.
        min_value : datetime.date or datetime.datetime
            The minimum selectable date. If value is a date, defaults to value - 10 years.
            If value is the interval [start, end], defaults to start - 10 years.
        max_value : datetime.date or datetime.datetime
            The maximum selectable date. If value is a date, defaults to value + 10 years.
            If value is the interval [start, end], defaults to end + 10 years.
        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            An optional tooltip that gets displayed next to the input.
        on_change : callable
            An optional callback invoked when this date_input's value changes.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.
        format : str
            A format string controlling how the interface should display dates.
            Supports "YYYY/MM/DD" (default), "DD/MM/YYYY", or "MM/DD/YYYY".
            You may also use a period (.) or hyphen (-) as separators.
        disabled : bool
            An optional boolean, which disables the date input if set to True.
            The default is False.
        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. If "hidden", the label doesn't show but there
            is still empty space for it above the widget (equivalent to label="").
            If "collapsed", both the label and the space are removed. Default is
            "visible".


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
            ctx=ctx,
        )

    def _date_input(
        self,
        label: str,
        value: (
            Literal["today", "default_value_today"] | DateValue
        ) = "default_value_today",
        min_value: SingleDateValue = None,
        max_value: SingleDateValue = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        format: str = "YYYY/MM/DD",
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        ctx: ScriptRunContext | None = None,
    ) -> DateWidgetReturn:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_change,
            default_value=value if value != "default_value_today" else None,
        )
        maybe_raise_label_warnings(label, label_visibility)

        def parse_date_deterministic(
            v: SingleDateValue | Literal["today", "default_value_today"],
        ) -> str | None:
            if isinstance(v, datetime):
                return date.strftime(v.date(), "%Y/%m/%d")
            elif isinstance(v, date):
                return date.strftime(v, "%Y/%m/%d")
            return None

        parsed_min_date = parse_date_deterministic(min_value)
        parsed_max_date = parse_date_deterministic(max_value)

        parsed: str | None | list[str | None]
        if value == "today" or value == "default_value_today" or value is None:
            parsed = None
        elif isinstance(value, (datetime, date)):
            parsed = parse_date_deterministic(value)
        else:
            parsed = [parse_date_deterministic(cast(SingleDateValue, v)) for v in value]

        # TODO this is missing the error path, integrate with the dateinputvalues parsing

        id = compute_widget_id(
            "date_input",
            user_key=key,
            label=label,
            value=parsed,
            min_value=parsed_min_date,
            max_value=parsed_max_date,
            key=key,
            help=help,
            format=format,
            form_id=current_form_id(self.dg),
            page=ctx.active_script_hash if ctx else None,
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

        if value == "default_value_today":
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
        date_input_proto.id = id
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
            "date_input",
            date_input_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
        )

        if widget_state.value_changed:
            date_input_proto.value[:] = serde.serialize(widget_state.value)
            date_input_proto.set_value = True

        self.dg._enqueue("date_input", date_input_proto)
        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
