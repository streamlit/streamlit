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

from datetime import date, time, datetime, timedelta, timezone
from typing import cast

import streamlit
from streamlit.errors import StreamlitAPIException
from streamlit.js_number import JSNumber
from streamlit.js_number import JSNumberBoundsException
from streamlit.proto.Slider_pb2 import Slider as SliderProto
from streamlit.widgets import register_widget
from .form import current_form_id


class SliderMixin:
    def slider(
        self,
        label,
        min_value=None,
        max_value=None,
        value=None,
        step=None,
        format=None,
        key=None,
        help=None,
    ):
        """Display a slider widget.

        This supports int, float, date, time, and datetime types.

        This also allows you to render a range slider by passing a two-element
        tuple or list as the `value`.

        The difference between `st.slider` and `st.select_slider` is that
        `slider` only accepts numerical or date/time data and takes a range as
        input, while `select_slider` accepts any datatype and takes an iterable
        set of options.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this slider is for.
        min_value : a supported type or None
            The minimum permitted value.
            Defaults to 0 if the value is an int, 0.0 if a float,
            value - timedelta(days=14) if a date/datetime, time.min if a time
        max_value : a supported type or None
            The maximum permitted value.
            Defaults to 100 if the value is an int, 1.0 if a float,
            value + timedelta(days=14) if a date/datetime, time.max if a time
        value : a supported type or a tuple/list of supported types or None
            The value of the slider when it first renders. If a tuple/list
            of two values is passed here, then a range slider with those lower
            and upper bounds is rendered. For example, if set to `(1, 10)` the
            slider will have a selectable range between 1 and 10.
            Defaults to min_value.
        step : int/float/timedelta or None
            The stepping interval.
            Defaults to 1 if the value is an int, 0.01 if a float,
            timedelta(days=1) if a date/datetime, timedelta(minutes=15) if a time
            (or if max_value - min_value < 1 day)
        format : str or None
            A printf-style format string controlling how the interface should
            display numbers. This does not impact the return value.
            Formatter for int/float supports: %d %e %f %g %i
            Formatter for date/time/datetime uses Moment.js notation:
            https://momentjs.com/docs/#/displaying/format/
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            A tooltip that gets displayed next to the slider.

        Returns
        -------
        int/float/date/time/datetime or tuple of int/float/date/time/datetime
            The current value of the slider widget. The return type will match
            the data type of the value parameter.

        Examples
        --------
        >>> age = st.slider('How old are you?', 0, 130, 25)
        >>> st.write("I'm ", age, 'years old')

        And here's an example of a range slider:

        >>> values = st.slider(
        ...     'Select a range of values',
        ...     0.0, 100.0, (25.0, 75.0))
        >>> st.write('Values:', values)

        This is a range time slider:

        >>> from datetime import time
        >>> appointment = st.slider(
        ...     "Schedule your appointment:",
        ...     value=(time(11, 30), time(12, 45)))
        >>> st.write("You're scheduled for:", appointment)

        Finally, a datetime slider:

        >>> from datetime import datetime
        >>> start_time = st.slider(
        ...     "When do you start?",
        ...     value=datetime(2020, 1, 1, 9, 30),
        ...     format="MM/DD/YY - hh:mm")
        >>> st.write("Start time:", start_time)

        """

        # Set value default.
        if value is None:
            value = min_value if min_value is not None else 0

        SUPPORTED_TYPES = {
            int: SliderProto.INT,
            float: SliderProto.FLOAT,
            datetime: SliderProto.DATETIME,
            date: SliderProto.DATE,
            time: SliderProto.TIME,
        }
        TIMELIKE_TYPES = (SliderProto.DATETIME, SliderProto.TIME, SliderProto.DATE)

        # Ensure that the value is either a single value or a range of values.
        single_value = isinstance(value, tuple(SUPPORTED_TYPES.keys()))
        range_value = isinstance(value, (list, tuple)) and len(value) in (0, 1, 2)
        if not single_value and not range_value:
            raise StreamlitAPIException(
                "Slider value should either be an int/float/datetime or a list/tuple of "
                "0 to 2 ints/floats/datetimes"
            )

        # Simplify future logic by always making value a list
        if single_value:
            value = [value]

        def all_same_type(items):
            return len(set(map(type, items))) < 2

        if not all_same_type(value):
            raise StreamlitAPIException(
                "Slider tuple/list components must be of the same type.\n"
                f"But were: {list(map(type, value))}"
            )

        if len(value) == 0:
            data_type = SliderProto.INT
        else:
            data_type = SUPPORTED_TYPES[type(value[0])]

        datetime_min = time.min
        datetime_max = time.max
        if data_type == SliderProto.TIME:
            datetime_min = time.min.replace(tzinfo=value[0].tzinfo)
            datetime_max = time.max.replace(tzinfo=value[0].tzinfo)
        if data_type in (SliderProto.DATETIME, SliderProto.DATE):
            datetime_min = value[0] - timedelta(days=14)
            datetime_max = value[0] + timedelta(days=14)

        DEFAULTS = {
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
            min_value = DEFAULTS[data_type]["min_value"]
        if max_value is None:
            max_value = DEFAULTS[data_type]["max_value"]
        if step is None:
            step = DEFAULTS[data_type]["step"]
            if (
                data_type
                in (
                    SliderProto.DATETIME,
                    SliderProto.DATE,
                )
                and max_value - min_value < timedelta(days=1)
            ):
                step = timedelta(minutes=15)
        if format is None:
            format = DEFAULTS[data_type]["format"]

        if step == 0:
            raise StreamlitAPIException(
                "Slider components cannot be passed a `step` of 0."
            )

        # Ensure that all arguments are of the same type.
        args = [min_value, max_value, step]
        int_args = all(map(lambda a: isinstance(a, int), args))
        float_args = all(map(lambda a: isinstance(a, float), args))
        # When min and max_value are the same timelike, step should be a timedelta
        timelike_args = (
            data_type in TIMELIKE_TYPES
            and isinstance(step, timedelta)
            and type(min_value) == type(max_value)
        )

        if not int_args and not float_args and not timelike_args:
            raise StreamlitAPIException(
                "Slider value arguments must be of matching types."
                "\n`min_value` has %(min_type)s type."
                "\n`max_value` has %(max_type)s type."
                "\n`step` has %(step)s type."
                % {
                    "min_type": type(min_value).__name__,
                    "max_type": type(max_value).__name__,
                    "step": type(step).__name__,
                }
            )

        # Ensure that the value matches arguments' types.
        all_ints = data_type == SliderProto.INT and int_args
        all_floats = data_type == SliderProto.FLOAT and float_args
        all_timelikes = data_type in TIMELIKE_TYPES and timelike_args

        if not all_ints and not all_floats and not all_timelikes:
            raise StreamlitAPIException(
                "Both value and arguments must be of the same type."
                "\n`value` has %(value_type)s type."
                "\n`min_value` has %(min_type)s type."
                "\n`max_value` has %(max_type)s type."
                % {
                    "value_type": type(value).__name__,
                    "min_type": type(min_value).__name__,
                    "max_type": type(max_value).__name__,
                }
            )

        # Ensure that min <= value(s) <= max, adjusting the bounds as necessary.
        min_value = min(min_value, max_value)
        max_value = max(min_value, max_value)
        if len(value) == 1:
            min_value = min(value[0], min_value)
            max_value = max(value[0], max_value)
        elif len(value) == 2:
            start, end = value
            if start > end:
                # Swap start and end, since they seem reversed
                start, end = end, start
                value = start, end
            min_value = min(start, min_value)
            max_value = max(end, max_value)
        else:
            # Empty list, so let's just use the outer bounds
            value = [min_value, max_value]

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

        # Convert dates or times into datetimes
        if data_type == SliderProto.TIME:

            def _time_to_datetime(time):
                # Note, here we pick an arbitrary date well after Unix epoch.
                # This prevents pre-epoch timezone issues (https://bugs.python.org/issue36759)
                # We're dropping the date from datetime laters, anyways.
                return datetime.combine(date(2000, 1, 1), time)

            value = list(map(_time_to_datetime, value))
            min_value = _time_to_datetime(min_value)
            max_value = _time_to_datetime(max_value)

        if data_type == SliderProto.DATE:

            def _date_to_datetime(date):
                return datetime.combine(date, time())

            value = list(map(_date_to_datetime, value))
            min_value = _date_to_datetime(min_value)
            max_value = _date_to_datetime(max_value)

        # Now, convert to microseconds (so we can serialize datetime to a long)
        if data_type in TIMELIKE_TYPES:
            SECONDS_TO_MICROS = 1000 * 1000
            DAYS_TO_MICROS = 24 * 60 * 60 * SECONDS_TO_MICROS

            def _delta_to_micros(delta):
                return (
                    delta.microseconds
                    + delta.seconds * SECONDS_TO_MICROS
                    + delta.days * DAYS_TO_MICROS
                )

            UTC_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)

            def _datetime_to_micros(dt):
                # If dt is naive, Python converts from local time
                utc_dt = dt.astimezone(timezone.utc)
                return _delta_to_micros(utc_dt - UTC_EPOCH)

            # Restore times/datetimes to original timezone (dates are always naive)
            orig_tz = (
                value[0].tzinfo
                if data_type in (SliderProto.TIME, SliderProto.DATETIME)
                else None
            )

            def _micros_to_datetime(micros):
                utc_dt = UTC_EPOCH + timedelta(microseconds=micros)
                # Convert from utc back to original time (local time if naive)
                return utc_dt.astimezone(orig_tz).replace(tzinfo=orig_tz)

            value = list(map(_datetime_to_micros, value))
            min_value = _datetime_to_micros(min_value)
            max_value = _datetime_to_micros(max_value)
            step = _delta_to_micros(step)

        # It would be great if we could guess the number of decimal places from
        # the `step` argument, but this would only be meaningful if step were a
        # decimal. As a possible improvement we could make this function accept
        # decimals and/or use some heuristics for floats.

        slider_proto = SliderProto()
        slider_proto.label = label
        slider_proto.format = format
        slider_proto.default[:] = value
        slider_proto.min = min_value
        slider_proto.max = max_value
        slider_proto.step = step
        slider_proto.data_type = data_type
        slider_proto.options[:] = []
        slider_proto.form_id = current_form_id(self.dg)
        if help is not None:
            slider_proto.help = help

        ui_value = register_widget("slider", slider_proto, user_key=key)
        if ui_value:
            current_value = getattr(ui_value, "data")
        else:
            # Widget has not been used; fallback to the original value,
            current_value = value
        # The widget always returns a float array, so fix the return type if necessary
        if data_type == SliderProto.INT:
            current_value = list(map(int, current_value))
        if data_type == SliderProto.DATETIME:
            current_value = [_micros_to_datetime(int(v)) for v in current_value]
        if data_type == SliderProto.DATE:
            current_value = [_micros_to_datetime(int(v)).date() for v in current_value]
        if data_type == SliderProto.TIME:
            current_value = [
                _micros_to_datetime(int(v)).time().replace(tzinfo=orig_tz)
                for v in current_value
            ]
        # If the original value was a list/tuple, so will be the output (and vice versa)
        return_value = current_value[0] if single_value else tuple(current_value)
        return self.dg._enqueue("slider", slider_proto, return_value)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
