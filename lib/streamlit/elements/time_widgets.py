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

from datetime import datetime, date, time
from textwrap import dedent
from typing import Any, cast, List, Optional, Sequence, Tuple, TYPE_CHECKING, Union

import attr
from dateutil import relativedelta
from typing_extensions import TypeAlias

from streamlit.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.type_util import Key, to_key
from streamlit.errors import StreamlitAPIException
from streamlit.proto.DateInput_pb2 import DateInput as DateInputProto
from streamlit.proto.TimeInput_pb2 import TimeInput as TimeInputProto
from streamlit.state import (
    register_widget,
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
)
from .form import current_form_id
from .utils import check_callback_rules, check_session_state_rules

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


TimeValue: TypeAlias = Union[time, datetime, None]
SingleDateValue: TypeAlias = Union[date, datetime, None]
DateValue: TypeAlias = Union[SingleDateValue, Sequence[SingleDateValue]]
DateWidgetReturn: TypeAlias = Union[date, Tuple[()], Tuple[date], Tuple[date, date]]


def _parse_date_value(value: DateValue) -> Tuple[List[date], bool]:
    parsed_dates: List[date]
    range_value: bool = False
    if value is None:
        # Set value default.
        parsed_dates = [datetime.now().date()]
    elif isinstance(value, datetime):
        parsed_dates = [value.date()]
    elif isinstance(value, date):
        parsed_dates = [value]
    elif isinstance(value, (list, tuple)):
        if not len(value) in (0, 1, 2):
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
    parsed_dates: Sequence[date],
) -> date:
    parsed_min_date: date
    if isinstance(min_value, datetime):
        parsed_min_date = min_value.date()
    elif isinstance(min_value, date):
        parsed_min_date = min_value
    elif min_value is None:
        if parsed_dates:
            parsed_min_date = parsed_dates[0] - relativedelta.relativedelta(years=10)
        else:
            parsed_min_date = date.today() - relativedelta.relativedelta(years=10)
    else:
        raise StreamlitAPIException(
            "DateInput min should either be a date/datetime or None"
        )
    return parsed_min_date


def _parse_max_date(
    max_value: SingleDateValue,
    parsed_dates: Sequence[date],
) -> date:
    parsed_max_date: date
    if isinstance(max_value, datetime):
        parsed_max_date = max_value.date()
    elif isinstance(max_value, date):
        parsed_max_date = max_value
    elif max_value is None:
        if parsed_dates:
            parsed_max_date = parsed_dates[-1] + relativedelta.relativedelta(years=10)
        else:
            parsed_max_date = date.today() + relativedelta.relativedelta(years=10)
    else:
        raise StreamlitAPIException(
            "DateInput max should either be a date/datetime or None"
        )
    return parsed_max_date


@attr.s(auto_attribs=True, slots=True, frozen=True)
class _DateInputValues:
    value: Sequence[date]
    is_range: bool
    max: date
    min: date

    @classmethod
    def from_raw_values(
        cls,
        value: DateValue,
        min_value: SingleDateValue,
        max_value: SingleDateValue,
    ) -> "_DateInputValues":

        parsed_value, is_range = _parse_date_value(value=value)
        return cls(
            value=parsed_value,
            is_range=is_range,
            min=_parse_min_date(
                min_value=min_value,
                parsed_dates=parsed_value,
            ),
            max=_parse_max_date(
                max_value=max_value,
                parsed_dates=parsed_value,
            ),
        )

    def __attrs_post_init__(self) -> None:
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


class TimeWidgetsMixin:
    def time_input(
        self,
        label: str,
        value: TimeValue = None,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
    ) -> time:
        """Display a time input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this time input is for.
        value : datetime.time/datetime.datetime
            The value of this widget when it first renders. This will be
            cast to str internally. Defaults to the current time.
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
            The default is False. This argument can only be supplied by keyword.

        Returns
        -------
        datetime.time
            The current value of the time input widget.

        Example
        -------
        >>> t = st.time_input('Set an alarm for', datetime.time(8, 45))
        >>> st.write('Alarm is set for', t)

        .. output::
           https://share.streamlit.io/streamlit/docs/main/python/api-examples-source/widget.time_input.py
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
            ctx=ctx,
        )

    def _time_input(
        self,
        label: str,
        value: Union[time, datetime, None] = None,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        ctx: Optional[ScriptRunContext] = None,
    ) -> time:
        key = to_key(key)
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(default_value=value, key=key)

        parsed_time: time
        if value is None:
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
        del value

        time_input_proto = TimeInputProto()
        time_input_proto.label = label
        time_input_proto.default = time.strftime(parsed_time, "%H:%M")
        time_input_proto.form_id = current_form_id(self.dg)
        if help is not None:
            time_input_proto.help = dedent(help)

        def deserialize_time_input(ui_value: str, widget_id: Any = "") -> time:
            return (
                datetime.strptime(ui_value, "%H:%M").time()
                if ui_value is not None
                else parsed_time
            )

        def serialize_time_input(v: Union[datetime, time]) -> str:
            if isinstance(v, datetime):
                v = v.time()
            return time.strftime(v, "%H:%M")

        current_value, set_frontend_value = register_widget(
            "time_input",
            time_input_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_time_input,
            serializer=serialize_time_input,
            ctx=ctx,
        )

        # This needs to be done after register_widget because we don't want
        # the following proto fields to affect a widget's ID.
        time_input_proto.disabled = disabled
        if set_frontend_value:
            time_input_proto.value = serialize_time_input(
                cast(Union[datetime, time], current_value)
            )
            time_input_proto.set_value = True

        self.dg._enqueue("time_input", time_input_proto)
        return cast(time, current_value)

    def date_input(
        self,
        label: str,
        value: DateValue = None,
        min_value: SingleDateValue = None,
        max_value: SingleDateValue = None,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
    ) -> DateWidgetReturn:
        """Display a date input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this date input is for.
        value : datetime.date or datetime.datetime or list/tuple of datetime.date or datetime.datetime or None
            The value of this widget when it first renders. If a list/tuple with
            0 to 2 date/datetime values is provided, the datepicker will allow
            users to provide a range. Defaults to today as a single-date picker.
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
        disabled : bool
            An optional boolean, which disables the date input if set to True.
            The default is False. This argument can only be supplied by keyword.

        Returns
        -------
        datetime.date or a tuple with 0-2 dates
            The current value of the date input widget.

        Example
        -------
        >>> d = st.date_input(
        ...     "When\'s your birthday",
        ...     datetime.date(2019, 7, 6))
        >>> st.write('Your birthday is:', d)

        .. output::
           https://share.streamlit.io/streamlit/docs/main/python/api-examples-source/widget.date_input.py
           height: 260px

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
            ctx=ctx,
        )

    def _date_input(
        self,
        label: str,
        value: DateValue = None,
        min_value: SingleDateValue = None,
        max_value: SingleDateValue = None,
        key: Optional[Key] = None,
        help: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        ctx: Optional[ScriptRunContext] = None,
    ) -> DateWidgetReturn:
        key = to_key(key)
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(default_value=value, key=key)

        parsed_values = _DateInputValues.from_raw_values(
            value=value,
            min_value=min_value,
            max_value=max_value,
        )
        del value, min_value, max_value

        date_input_proto = DateInputProto()
        date_input_proto.is_range = parsed_values.is_range
        if help is not None:
            date_input_proto.help = dedent(help)

        date_input_proto.label = label
        date_input_proto.default[:] = [
            date.strftime(v, "%Y/%m/%d") for v in parsed_values.value
        ]

        date_input_proto.min = date.strftime(parsed_values.min, "%Y/%m/%d")
        date_input_proto.max = date.strftime(parsed_values.max, "%Y/%m/%d")

        date_input_proto.form_id = current_form_id(self.dg)

        def deserialize_date_input(
            ui_value: Any,
            widget_id: str = "",
        ) -> DateWidgetReturn:
            return_value: Sequence[date]
            if ui_value is not None:
                return_value = tuple(
                    datetime.strptime(v, "%Y/%m/%d").date() for v in ui_value
                )
            else:
                return_value = parsed_values.value

            if not parsed_values.is_range:
                return return_value[0]
            return cast(DateWidgetReturn, tuple(return_value))

        def serialize_date_input(v: DateWidgetReturn) -> List[str]:
            to_serialize = list(v) if isinstance(v, (list, tuple)) else [v]
            return [date.strftime(v, "%Y/%m/%d") for v in to_serialize]

        current_value, set_frontend_value = register_widget(
            "date_input",
            date_input_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_date_input,
            serializer=serialize_date_input,
            ctx=ctx,
        )

        # This needs to be done after register_widget because we don't want
        # the following proto fields to affect a widget's ID.
        date_input_proto.disabled = disabled
        if set_frontend_value:
            date_input_proto.value[:] = serialize_date_input(current_value)
            date_input_proto.set_value = True

        self.dg._enqueue("date_input", date_input_proto)
        return cast(DateWidgetReturn, current_value)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
