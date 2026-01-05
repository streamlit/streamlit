# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

if TYPE_CHECKING:
    from datetime import date, datetime, time, timedelta

    from streamlit.elements.widgets.time_widgets import TimeWidgetsMixin

    datetime_input = TimeWidgetsMixin().datetime_input

    # Single datetime input
    assert_type(datetime_input("foo", datetime(2025, 11, 19, 16, 45)), datetime)
    assert_type(datetime_input("foo", date(2025, 11, 19)), datetime)
    assert_type(datetime_input("foo", time(16, 45)), datetime)
    assert_type(datetime_input("foo", value="now"), datetime)
    assert_type(datetime_input("foo", value="2025-11-19 16:45"), datetime)

    # Should return datetime or None if value is None
    assert_type(datetime_input("foo", value=None), datetime | None)
    assert_type(
        datetime_input(
            "foo",
            value=None,
            min_value=datetime(2020, 1, 1, 0, 0),
            max_value=datetime(2030, 1, 1, 0, 0),
        ),
        datetime | None,
    )

    # With min_value / max_value using different input types
    assert_type(
        datetime_input(
            "foo",
            datetime(2025, 11, 19, 16, 45),
            min_value=date(2020, 1, 1),
            max_value="2030-01-01 23:59",
        ),
        datetime,
    )

    # With format and step overrides
    assert_type(
        datetime_input(
            "foo",
            datetime(2025, 11, 19, 16, 45),
            format="MM/DD/YYYY",
            step=900,
        ),
        datetime,
    )
    assert_type(
        datetime_input(
            "foo",
            datetime(2025, 11, 19, 16, 45),
            format="DD.MM.YYYY",
            step=timedelta(minutes=30),
        ),
        datetime,
    )

    # With disabled and label visibility options
    assert_type(
        datetime_input("foo", datetime(2025, 11, 19, 16, 45), disabled=True), datetime
    )
    assert_type(
        datetime_input(
            "foo", datetime(2025, 11, 19, 16, 45), label_visibility="hidden"
        ),
        datetime,
    )

    # With callbacks
    def on_change_callback(value: datetime | None) -> None:
        pass

    assert_type(
        datetime_input(
            "foo",
            datetime(2025, 11, 19, 16, 45),
            on_change=on_change_callback,
            args=(1,),
            kwargs={"key": "value"},
        ),
        datetime,
    )

    # With key and help
    assert_type(
        datetime_input("foo", datetime(2025, 11, 19, 16, 45), key="unique_key"),
        datetime,
    )
    assert_type(
        datetime_input(
            "foo",
            datetime(2025, 11, 19, 16, 45),
            help="This is a helpful tooltip",
        ),
        datetime,
    )
