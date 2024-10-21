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

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are incorrect.
# Note: Due to https://mypy.readthedocs.io/en/latest/duck_type_compatibility.html, mypy will not detect
# an <int> value being assigned to a <float> variable. There's nothing we can do about this, apparently.
if TYPE_CHECKING:
    from datetime import date, time, timedelta

    from streamlit.elements.widgets.slider import SliderMixin

    slider = SliderMixin().slider

    assert_type(slider("foo"), int)
    assert_type(slider("foo", 5), int)
    assert_type(slider("foo", 5, 10), int)
    assert_type(slider("foo", 5, 10, 8), int)
    assert_type(slider("foo", 5, 10, 8, 1), int)
    assert_type(slider("foo", 5.0), float)
    assert_type(slider("foo", 5.0, 10.0), float)
    assert_type(slider("foo", 5.0, 10.0, 6.0), float)
    assert_type(slider("foo", 5.0, 10.0, 6.0, 1.0), float)

    assert_type(slider("foo", 5, 10, [5, 8]), tuple[int, int])
    assert_type(slider("foo", 5, 10, [5, 8], 1), tuple[int, int])

    assert_type(slider("foo", min_value=5, value=5), int)
    assert_type(slider("foo", min_value=5, step=1), int)
    assert_type(slider("foo", min_value=5, value=5, step=1), int)
    assert_type(slider("foo", min_value=5, max_value=10, value=5, step=1), int)
    assert_type(slider("foo", max_value=10, value=5, step=1), int)
    assert_type(slider("foo", max_value=10, step=1), int)
    assert_type(slider("foo", step=1), int)
    assert_type(slider("foo", min_value=5, max_value=10), int)
    assert_type(slider("foo", min_value=5, max_value=10, step=1), int)

    assert_type(slider("foo", min_value=5.0, value=5.0), float)
    assert_type(slider("foo", min_value=5.0, step=1.0), float)
    assert_type(slider("foo", min_value=5.0, value=5.0, step=1.0), float)
    assert_type(
        slider("foo", min_value=5.0, max_value=10.0, value=5.0, step=1.0), float
    )
    assert_type(slider("foo", max_value=10.0, value=5.0, step=1.0), float)
    assert_type(slider("foo", max_value=10.0, step=1.0), float)
    # kwsingularfloat7 = slider("foo", step=1.0)
    # ^ This actually raises an exception and is an invalid signature
    assert_type(slider("foo", min_value=5.0, max_value=10.0), float)
    assert_type(slider("foo", min_value=5.0, max_value=10.0, step=1.0), float)

    assert_type(slider("foo", min_value=5, value=[5, 9]), tuple[int, int])
    assert_type(
        slider("foo", min_value=5, max_value=10, value=[8, 9], step=1), tuple[int, int]
    )
    assert_type(slider("foo", max_value=10, value=[8, 9], step=1), tuple[int, int])

    assert_type(slider("foo", min_value=5.0, value=[5.0, 9.0]), tuple[float, float])
    assert_type(
        slider("foo", min_value=5.0, max_value=10.0, value=[8.0, 9.0], step=1.0),
        tuple[float, float],
    )
    assert_type(
        slider("foo", max_value=10.0, value=[8.0, 9.0], step=1.0), tuple[float, float]
    )

    _2024_5_1 = date(2024, 5, 1)
    _2024_5_8 = date(2024, 5, 8)
    _2024_5_15 = date(2024, 5, 15)
    _2024_5_20 = date(2024, 5, 20)
    _1DAYSPAN = timedelta(1)

    assert_type(slider("foo", _2024_5_1), date)
    assert_type(slider("foo", _2024_5_1, _2024_5_20), date)
    assert_type(slider("foo", _2024_5_1, _2024_5_20, _2024_5_8), date)
    assert_type(slider("foo", _2024_5_1, _2024_5_20, _2024_5_8, _1DAYSPAN), date)

    assert_type(
        slider("foo", _2024_5_1, _2024_5_20, [_2024_5_8, _2024_5_15]), tuple[date, date]
    )
    assert_type(
        slider("foo", _2024_5_1, _2024_5_20, [_2024_5_8, _2024_5_15], _1DAYSPAN),
        tuple[date, date],
    )

    assert_type(slider("foo", min_value=_2024_5_1, value=_2024_5_8), date)
    assert_type(slider("foo", min_value=_2024_5_1, step=_1DAYSPAN), date)
    assert_type(
        slider("foo", min_value=_2024_5_1, value=_2024_5_8, step=_1DAYSPAN), date
    )
    assert_type(
        slider(
            "foo",
            min_value=_2024_5_1,
            max_value=_2024_5_20,
            value=_2024_5_8,
            step=_1DAYSPAN,
        ),
        date,
    )
    assert_type(
        slider("foo", max_value=_2024_5_20, value=_2024_5_8, step=_1DAYSPAN), date
    )
    assert_type(slider("foo", max_value=_2024_5_20, step=_1DAYSPAN), date)
    # kwsingulardate7 = slider("foo", step=_1DAYSPAN)
    # ^ This actually raises an exception and is an invalid signature
    assert_type(slider("foo", min_value=_2024_5_1, max_value=_2024_5_20), date)
    assert_type(
        slider("foo", min_value=_2024_5_1, max_value=_2024_5_20, step=_1DAYSPAN), date
    )

    assert_type(
        slider("foo", min_value=_2024_5_1, value=[_2024_5_8, _2024_5_15]),
        tuple[date, date],
    )
    assert_type(
        slider(
            "foo",
            min_value=_2024_5_1,
            max_value=_2024_5_20,
            value=[_2024_5_8, _2024_5_15],
            step=_1DAYSPAN,
        ),
        tuple[date, date],
    )
    assert_type(
        slider(
            "foo", max_value=_2024_5_20, value=[_2024_5_8, _2024_5_15], step=_1DAYSPAN
        ),
        tuple[date, date],
    )

    _0800 = time(8)
    _1400 = time(14)
    _1800 = time(18)
    _2000 = time(20)
    _5MINUTESPAN = timedelta(minutes=5)

    assert_type(slider("foo", _0800), time)
    assert_type(slider("foo", _0800, _2000), time)
    assert_type(slider("foo", _0800, _2000, _1400), time)
    assert_type(slider("foo", _0800, _2000, _1400, _5MINUTESPAN), time)
    assert_type(slider("foo", _0800, _2000, [_1400, _1800]), tuple[time, time])
    assert_type(
        slider("foo", _0800, _2000, [_1400, _1800], _5MINUTESPAN), tuple[time, time]
    )

    assert_type(slider("foo", min_value=_0800, value=_1400), time)
    assert_type(slider("foo", min_value=_0800, step=_5MINUTESPAN), time)
    assert_type(slider("foo", min_value=_0800, value=_1400, step=_5MINUTESPAN), time)
    assert_type(
        slider("foo", min_value=_0800, max_value=_2000, value=_1400, step=_5MINUTESPAN),
        time,
    )
    assert_type(slider("foo", max_value=_2000, value=_1400, step=_5MINUTESPAN), time)
    assert_type(slider("foo", max_value=_2000, step=_5MINUTESPAN), time)
    # kwsingulartime7 = slider("foo", step=_5MINUTESPAN)
    # ^ This actually raises an exception and is an invalid signature
    assert_type(slider("foo", min_value=_0800, max_value=_2000), time)
    assert_type(
        slider("foo", min_value=_0800, max_value=_2000, step=_5MINUTESPAN), time
    )

    assert_type(slider("foo", min_value=_0800, value=[_1400, _1800]), tuple[time, time])
    assert_type(
        slider(
            "foo",
            min_value=_0800,
            max_value=_2000,
            value=[_1400, _1800],
            step=_5MINUTESPAN,
        ),
        tuple[time, time],
    )
    assert_type(
        slider("foo", max_value=_2000, value=[_1400, _1800], step=_5MINUTESPAN),
        tuple[time, time],
    )
