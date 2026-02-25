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
    from datetime import datetime, time, timedelta

    from streamlit.elements.widgets.time_widgets import TimeWidgetsMixin

    time_input = TimeWidgetsMixin().time_input

    # Test default return type
    assert_type(time_input("label"), time)

    # Test positional args
    assert_type(time_input("label", "now"), time)
    assert_type(time_input("label", None), time | None)

    # Test value types
    assert_type(time_input("label", value="now"), time)
    assert_type(time_input("label", value=time(12, 0)), time)
    assert_type(time_input("label", value=datetime(2020, 1, 1, 12, 0)), time)
    assert_type(time_input("label", value="12:00"), time)

    # Test None value
    assert_type(time_input("label", value=None), time | None)

    # Test optional value
    v: time | datetime | str | None = None
    assert_type(time_input("label", value=v), time | None)

    # Test kwargs
    assert_type(time_input("label", step=60), time)
    assert_type(time_input("label", step=timedelta(minutes=15)), time)
    assert_type(time_input("label", disabled=True), time)
    assert_type(time_input("label", label_visibility="hidden"), time)
    assert_type(time_input("label", help="help"), time)
    assert_type(time_input("label", key="foo"), time)
    assert_type(time_input("label", key=123), time)
    assert_type(time_input("label", on_change=lambda: None), time)
    assert_type(time_input("label", args=("arg",)), time)
    assert_type(time_input("label", kwargs={"k": "v"}), time)
    assert_type(time_input("label", width="stretch"), time)
    assert_type(time_input("label", width=100), time)

    # Test with bind parameter
    assert_type(
        time_input("label", time(12, 0), key="my_key", bind="query-params"), time
    )
    assert_type(
        time_input("label", value=None, key="my_key", bind="query-params"),
        time | None,
    )
    assert_type(time_input("label", time(12, 0), key="my_key", bind=None), time)
