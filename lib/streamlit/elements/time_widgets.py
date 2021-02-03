# Copyright 2018-2021 Streamlit Inc.
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
from typing import cast

import streamlit
from streamlit.errors import StreamlitAPIException
from streamlit.proto.DateInput_pb2 import DateInput as DateInputProto
from streamlit.proto.TimeInput_pb2 import TimeInput as TimeInputProto
from .utils import register_widget


class TimeWidgetsMixin:
    def time_input(self, label, value=None, key=None, help=None):
        """Display a time input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this time input is for.
        value : datetime.time/datetime.datetime
            The value of this widget when it first renders. This will be
            cast to str internally. Defaults to the current time.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            A tooltip that gets displayed next to the input.

        Returns
        -------
        datetime.time
            The current value of the time input widget.

        Example
        -------
        >>> t = st.time_input('Set an alarm for', datetime.time(8, 45))
        >>> st.write('Alarm is set for', t)

        """
        # Set value default.
        if value is None:
            value = datetime.now().time()

        # Ensure that the value is either datetime/time
        if not isinstance(value, datetime) and not isinstance(value, time):
            raise StreamlitAPIException(
                "The type of the value should be either datetime or time."
            )

        # Convert datetime to time
        if isinstance(value, datetime):
            value = value.time()

        time_input_proto = TimeInputProto()
        time_input_proto.label = label
        time_input_proto.default = time.strftime(value, "%H:%M")
        if help is not None:
            time_input_proto.help = help

        ui_value = register_widget("time_input", time_input_proto, user_key=key)
        current_value = (
            datetime.strptime(ui_value, "%H:%M").time()
            if ui_value is not None
            else value
        )
        return self.dg._enqueue("time_input", time_input_proto, current_value)

    def date_input(
        self,
        label,
        value=None,
        min_value=None,
        max_value=None,
        key=None,
        help=None,
    ):
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
            The minimum selectable date. Defaults to today-10y.
        max_value : datetime.date or datetime.datetime
            The maximum selectable date. Defaults to today+10y.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            A tooltip that gets displayed next to the input.

        Returns
        -------
        datetime.date
            The current value of the date input widget.

        Example
        -------
        >>> d = st.date_input(
        ...     "When\'s your birthday",
        ...     datetime.date(2019, 7, 6))
        >>> st.write('Your birthday is:', d)

        """
        # Set value default.
        if value is None:
            value = datetime.now().date()

        single_value = isinstance(value, (date, datetime))
        range_value = isinstance(value, (list, tuple)) and len(value) in (0, 1, 2)
        if not single_value and not range_value:
            raise StreamlitAPIException(
                "DateInput value should either be an date/datetime or a list/tuple of "
                "0 - 2 date/datetime values"
            )

        if single_value:
            value = [value]

        date_input_proto = DateInputProto()
        date_input_proto.is_range = range_value
        if help is not None:
            date_input_proto.help = help

        value = [v.date() if isinstance(v, datetime) else v for v in value]

        date_input_proto.label = label
        date_input_proto.default[:] = [date.strftime(v, "%Y/%m/%d") for v in value]

        if isinstance(min_value, datetime):
            min_value = min_value.date()
        elif min_value is None:
            today = date.today()
            min_value = date(today.year - 10, today.month, today.day)

        date_input_proto.min = date.strftime(min_value, "%Y/%m/%d")

        if max_value is None:
            today = date.today()
            max_value = date(today.year + 10, today.month, today.day)

        if isinstance(max_value, datetime):
            max_value = max_value.date()

        date_input_proto.max = date.strftime(max_value, "%Y/%m/%d")

        ui_value = register_widget("date_input", date_input_proto, user_key=key)

        if ui_value is not None:
            value = getattr(ui_value, "data")
            value = [datetime.strptime(v, "%Y/%m/%d").date() for v in value]

        return_value = value[0] if single_value else tuple(value)
        return self.dg._enqueue("date_input", date_input_proto, return_value)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
