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

from typing import TYPE_CHECKING, Union

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from datetime import date, datetime

    from streamlit.elements.widgets.time_widgets import (
        DateWidgetRangeReturn,
        TimeWidgetsMixin,
    )

    date_input = TimeWidgetsMixin().date_input

    # Single date input
    assert_type(date_input("foo", date(2024, 1, 1)), date)
    assert_type(date_input("foo", datetime(2024, 1, 1)), date)
    assert_type(date_input("foo", value="today"), date)
    assert_type(date_input("foo", value="2024-01-01"), date)

    # Should return date or None if value is None:
    assert_type(date_input("foo", value=None), Union[date, None])
    assert_type(
        date_input(
            "foo", value=None, min_value=date(2024, 1, 1), max_value=date(2024, 1, 31)
        ),
        Union[date, None],
    )

    # Date range input with different sequence types
    assert_type(
        date_input("foo", (date(2024, 1, 1), date(2024, 1, 31))), DateWidgetRangeReturn
    )
    assert_type(
        date_input("foo", (datetime(2024, 1, 1), datetime(2024, 1, 31))),
        DateWidgetRangeReturn,
    )
    assert_type(
        date_input("foo", [datetime(2024, 1, 1), datetime(2024, 1, 31)]),
        DateWidgetRangeReturn,
    )
    assert_type(
        date_input("foo", (datetime(2024, 1, 1),)),
        DateWidgetRangeReturn,
    )
    assert_type(
        date_input("foo", [datetime(2024, 1, 1)]),
        DateWidgetRangeReturn,
    )

    # Test with min_value and max_value
    assert_type(
        date_input(
            "foo",
            date(2024, 1, 1),
            min_value=date(2022, 1, 1),
            max_value=date(2024, 12, 31),
        ),
        date,
    )
    assert_type(
        date_input(
            "foo",
            (date(2024, 1, 1), date(2024, 12, 31)),
            min_value=date(2022, 1, 1),
            max_value=date(2024, 12, 31),
        ),
        DateWidgetRangeReturn,
    )

    # Test with different formats
    assert_type(date_input("foo", date(2024, 1, 1), format="MM/DD/YYYY"), date)
    assert_type(
        date_input("foo", (date(2024, 1, 1), date(2024, 12, 31)), format="DD.MM.YYYY"),
        DateWidgetRangeReturn,
    )

    # Test with disabled and label_visibility
    assert_type(date_input("foo", date(2024, 1, 1), disabled=True), date)
    assert_type(
        date_input("foo", date(2024, 1, 1), label_visibility="hidden"),
        date,
    )

    # Test with on_change, args, and kwargs
    def on_change_callback(d: date | None) -> None:
        pass

    assert_type(date_input("foo", date(2024, 1, 1), on_change=on_change_callback), date)
    assert_type(
        date_input(
            "foo",
            date(2024, 1, 1),
            on_change=on_change_callback,
            args=(1,),
            kwargs={"key": "value"},
        ),
        date,
    )

    # Test with key
    assert_type(date_input("foo", date(2024, 1, 1), key="unique_key"), date)

    # Test with help
    assert_type(
        date_input("foo", date(2024, 1, 1), help="This is a helpful tooltip"), date
    )

    # Edge cases
    assert_type(date_input("foo", (None, date(2024, 12, 31))), DateWidgetRangeReturn)
    assert_type(date_input("foo", (date(2024, 1, 1), None)), DateWidgetRangeReturn)

    # Mixed input types
    assert_type(
        date_input("foo", (date(2024, 1, 1), datetime(2024, 12, 31))),
        DateWidgetRangeReturn,
    )
    assert_type(
        date_input("foo", (datetime(2024, 1, 1), date(2024, 12, 31))),
        DateWidgetRangeReturn,
    )
