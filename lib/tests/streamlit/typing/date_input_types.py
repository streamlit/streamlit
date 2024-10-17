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

from typing import TYPE_CHECKING, Union

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are incorrect.
if TYPE_CHECKING:
    from datetime import date, datetime

    from streamlit.elements.widgets.time_widgets import (
        DateTupleReturn,
        TimeWidgetsMixin,
    )

    date_input = TimeWidgetsMixin().date_input

    # Single date input
    assert_type(date_input("foo", date(2024, 1, 1)), Union[date, None])
    assert_type(date_input("foo", datetime(2024, 1, 1)), Union[date, None])
    assert_type(date_input("foo", value="today"), Union[date, None])
    assert_type(date_input("foo", value="default_value_today"), Union[date, None])
    assert_type(date_input("foo", value=None), Union[date, None])

    # Date range input
    assert_type(
        date_input("foo", (date(2024, 1, 1), date(2024, 1, 31))), DateTupleReturn
    )
    assert_type(
        date_input("foo", (datetime(2024, 1, 1), datetime(2024, 1, 31))),
        DateTupleReturn,
    )

    # Test with min_value and max_value
    assert_type(
        date_input(
            "foo",
            date(2024, 1, 1),
            min_value=date(2022, 1, 1),
            max_value=date(2024, 12, 31),
        ),
        Union[date, None],
    )
    assert_type(
        date_input(
            "foo",
            (date(2024, 1, 1), date(2024, 12, 31)),
            min_value=date(2022, 1, 1),
            max_value=date(2024, 12, 31),
        ),
        DateTupleReturn,
    )

    # Test with different formats
    assert_type(
        date_input("foo", date(2024, 1, 1), format="MM/DD/YYYY"), Union[date, None]
    )
    assert_type(
        date_input("foo", (date(2024, 1, 1), date(2024, 12, 31)), format="DD.MM.YYYY"),
        DateTupleReturn,
    )

    # Test with disabled and label_visibility
    assert_type(date_input("foo", date(2024, 1, 1), disabled=True), Union[date, None])
    assert_type(
        date_input("foo", date(2024, 1, 1), label_visibility="hidden"),
        Union[date, None],
    )

    # Test with on_change, args, and kwargs
    def on_change_callback(d: date | None):
        pass

    assert_type(
        date_input("foo", date(2024, 1, 1), on_change=on_change_callback),
        Union[date, None],
    )
    assert_type(
        date_input(
            "foo",
            date(2024, 1, 1),
            on_change=on_change_callback,
            args=(1,),
            kwargs={"key": "value"},
        ),
        Union[date, None],
    )

    # Test with key
    assert_type(
        date_input("foo", date(2024, 1, 1), key="unique_key"), Union[date, None]
    )

    # Test with help
    assert_type(
        date_input("foo", date(2024, 1, 1), help="This is a helpful tooltip"),
        Union[date, None],
    )

    # Edge cases
    assert_type(date_input("foo", (None, date(2024, 12, 31))), DateTupleReturn)
    assert_type(date_input("foo", (date(2024, 1, 1), None)), DateTupleReturn)
    assert_type(date_input("foo", ()), DateTupleReturn)

    # Mixed input types
    assert_type(
        date_input("foo", (date(2024, 1, 1), datetime(2024, 12, 31))), DateTupleReturn
    )
    assert_type(
        date_input("foo", (datetime(2024, 1, 1), date(2024, 12, 31))), DateTupleReturn
    )
