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

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from numbers import Integral, Real
from textwrap import dedent
from typing import TYPE_CHECKING, Any, Final, Sequence, Tuple, TypeVar, Union, cast

from typing_extensions import TypeAlias

from streamlit.elements.form import current_form_id
from streamlit.elements.lib.policies import (
    check_cache_replay_rules,
    check_callback_rules,
    check_fragment_path_policy,
    check_session_state_rules,
)
from streamlit.elements.lib.utils import get_label_visibility_proto_value
from streamlit.errors import StreamlitAPIException
from streamlit.js_number import JSNumber, JSNumberBoundsException
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
from streamlit.runtime.state.common import compute_widget_id
from streamlit.type_util import Key, LabelVisibility, maybe_raise_label_warnings, to_key

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

SliderScalarT = TypeVar("SliderScalarT", int, float, date, time, datetime)

Step: TypeAlias = Union[int, float, timedelta]
SliderScalar: TypeAlias = Union[int, float, date, time, datetime]

SliderValueGeneric: TypeAlias = Union[
    SliderScalarT,
    Sequence[SliderScalarT],
]
SliderValue: TypeAlias = Union[
    SliderValueGeneric[int],
    SliderValueGeneric[float],
    SliderValueGeneric[date],
    SliderValueGeneric[time],
    SliderValueGeneric[datetime],
]

SliderReturnGeneric: TypeAlias = Union[
    SliderScalarT,
    Tuple[SliderScalarT],
    Tuple[SliderScalarT, SliderScalarT],
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
    """Restore times/datetimes to original timezone (dates are always naive)"""
    utc_dt = UTC_EPOCH + timedelta(microseconds=micros)
    # Add the original timezone. No conversion is required here,
    # since in the serialization, we also just replace the timestamp with UTC.
    return utc_dt.replace(tzinfo=orig_tz)


@dataclass
class SliderSerde:
    value: list[float]
    data_type: int
    single_value: bool
    orig_tz: tzinfo | None

    def deserialize(self, ui_value: list[float] | None, widget_id: str = ""):
        if ui_value is not None:
            val: Any = ui_value
        else:
            # Widget has not been used; fallback to the original value,
            val = self.value

        # The widget always returns a float array, so fix the return type if necessary
        if self.data_type == SliderProto.INT:
            val = [int(v) for v in val]
        if self.data_type == SliderProto.DATETIME:
            val = [_micros_to_datetime(int(v), self.orig_tz) for v in val]
        if self.data_type == SliderProto.DATE:
            val = [_micros_to_datetime(int(v), self.orig_tz).date() for v in val]
        if self.data_type == SliderProto.TIME:
            val = [
                _micros_to_datetime(int(v), self.orig_tz)
                .time()
                .replace(tzinfo=self.orig_tz)
                for v in val
            ]
        return val[0] if self.single_value else tuple(val)

    def serialize(self, v: Any) -> list[Any]:
        range_value = isinstance(v, (list, tuple))
        value = list(v) if range_value else [v]
        if self.data_type == SliderProto.DATE:
            value = [_datetime_to_micros(_date_to_datetime(v)) for v in value]
        if self.data_type == SliderProto.TIME:
            value = [_datetime_to_micros(_time_to_datetime(v)) for v in value]
        if self.data_type == SliderProto.DATETIME:
            value = [_datetime_to_micros(v) for v in value]
        return value


class SliderMixin:
    @gather_metrics("slider")
    def slider(
        self,
        label: str,
        min_value: SliderScalar | None = None,
        max_value: SliderScalar | None = None,
        value: SliderValue | None = None,
        step: Step | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        # TODO(harahu): Add overload definitions. The return type is
        #  `SliderReturn`, in reality, but the return type is left as `Any`
        #  until we have proper overload definitions in place. Otherwise the
        #  user would have to cast the return value more often than not, which
        #  can be annoying.
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
            stored or returned by the widget due to serialization contstraints
            between the Python server and JavaScript client. You must handle
            such numbers as floats, leading to a loss in precision.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this slider is for.
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
        step : int, float, timedelta, or None
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
        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            An optional tooltip that gets displayed next to the slider.
        on_change : callable
            An optional callback invoked when this slider's value changes.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.
        disabled : bool
            An optional boolean, which disables the slider if set to True. The
            default is False.
        label_visibility : "visible", "hidden", or "collapsed"
            The visibility of the label. If "hidden", the label doesn't show but there
            is still empty space for it above the widget (equivalent to label="").
            If "collapsed", both the label and the space are removed. Default is
            "visible".


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
        >>> values = st.slider(
        ...     "Select a range of values",
        ...     0.0, 100.0, (25.0, 75.0))
        >>> st.write("Values:", values)

        This is a range time slider:

        >>> import streamlit as st
        >>> from datetime import time
        >>>
        >>> appointment = st.slider(
        ...     "Schedule your appointment:",
        ...     value=(time(11, 30), time(12, 45)))
        >>> st.write("You're scheduled for:", appointment)

        Finally, a datetime slider:

        >>> import streamlit as st
        >>> from datetime import datetime
        >>>
        >>> start_time = st.slider(
        ...     "When do you start?",
        ...     value=datetime(2020, 1, 1, 9, 30),
        ...     format="MM/DD/YY - hh:mm")
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
            ctx=ctx,
        )

    def _slider(
        self,
        label: str,
        min_value=None,
        max_value=None,
        value=None,
        step: Step | None = None,
        format: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        disabled: bool = False,
        label_visibility: LabelVisibility = "visible",
        ctx: ScriptRunContext | None = None,
    ) -> SliderReturn:
        key = to_key(key)

        try:
            check_fragment_path_policy(self.dg)
            check_cache_replay_rules()
            check_callback_rules(self.dg, on_change)
            check_session_state_rules(default_value=value, key=key)
            maybe_raise_label_warnings(label, label_visibility)

            id = compute_widget_id(
                "slider",
                user_key=key,
                label=label,
                min_value=min_value,
                max_value=max_value,
                value=value,
                step=step,
                format=format,
                key=key,
                help=help,
                form_id=current_form_id(self.dg),
                page=ctx.active_script_hash if ctx else None,
            )

            # Rest of the code remains the same
        except Exception as e:
            raise StreamlitAPIException(str(e)) from e

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
