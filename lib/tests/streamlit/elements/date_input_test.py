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

"""date_input unit test."""

from datetime import date, datetime, timedelta

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException, StreamlitInvalidWidthError
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.testing.v1.app_test import AppTest
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields

TODAY = datetime.today()


class DateInputTest(DeltaGeneratorTestCase):
    """Test ability to marshall date_input protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.date_input("the label")

        c = self.get_delta_from_queue().new_element.date_input
        assert c.label == "the label"
        assert (
            c.label_visibility.value
            == LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE
        )
        assert (
            datetime.strptime(c.default[0], "%Y/%m/%d").date() <= datetime.now().date()
        )
        assert not c.disabled

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.date_input("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.date_input
        assert c.disabled

    def test_none_value(self):
        """Test that it can be called with None as value."""
        st.date_input("the label", value=None)

        c = self.get_delta_from_queue().new_element.date_input
        assert c.label == "the label"
        # If a proto property is null is not determined by this value,
        # but by the check via the HasField method:
        assert c.default == []

    @parameterized.expand(
        [
            # Epoch
            (date(1970, 1, 1), ["1970/01/01"]),
            # All scalar types
            (date(1971, 2, 3), ["1971/02/03"]),
            (datetime(2019, 7, 6, 21, 15), ["2019/07/06"]),
            ("1971-02-03", ["1971/02/03"]),
            ("1971-02-03 12:34:56", ["1971/02/03"]),
            # Lists
            ([], []),
            ([datetime(2019, 7, 6, 21, 15)], ["2019/07/06"]),
            (
                [date(2019, 7, 6), date(2020, 8, 7)],
                ["2019/07/06", "2020/08/07"],
            ),
            (
                [datetime(2019, 7, 6, 21, 15), datetime(2020, 8, 7, 21, 15)],
                ["2019/07/06", "2020/08/07"],
            ),
            (
                ["2019-07-06", "2020-08-07"],
                ["2019/07/06", "2020/08/07"],
            ),
            # Mixed list
            (
                [date(2019, 7, 6), datetime(2020, 8, 7, 21, 15)],
                ["2019/07/06", "2020/08/07"],
            ),
        ]
    )
    def test_value_types(self, arg_value, proto_value):
        """Test that it supports different types of values."""
        st.date_input("the label", arg_value)

        c = self.get_delta_from_queue().new_element.date_input
        assert c.label == "the label"
        assert c.default == proto_value

    @parameterized.expand(
        [
            ("2000-01-02", "1999-10-11", "2001-02-03"),
            ("2000-01-02", "1999-10-11 12:34:56", "2001-02-03 11:22:33"),
            ("2000-01-02", date(1999, 10, 11), date(2001, 2, 3)),
            ("2000-01-02", datetime(1999, 10, 11), datetime(2001, 2, 3)),
        ]
    )
    def test_min_max_value_types(self, arg_value, min_date_value, max_date_value):
        """Test the datatypes accepted by min_value/max_value."""
        st.date_input("the label", arg_value, min_date_value, max_date_value)

        c = self.get_delta_from_queue().new_element.date_input
        assert c.label == "the label"
        assert c.min == "1999/10/11"
        assert c.max == "2001/02/03"

    @parameterized.expand(
        [
            (date(1961, 4, 12), "1951/04/12", "1971/04/12"),
            (date(2020, 2, 29), "2010/02/28", "2030/02/28"),
            # TODO: Find a way to mock date.today()
            #       Add test for empty value list case
            ([date(2021, 4, 26)], "2011/04/26", "2031/04/26"),
            ([date(2007, 2, 4), date(2012, 1, 3)], "1997/02/04", "2022/01/03"),
        ]
    )
    def test_min_max_values(self, arg_value, min_date_value, max_date_value):
        """Test that it calculates min, max date value range if not provided"""
        st.date_input("the label", arg_value)

        c = self.get_delta_from_queue().new_element.date_input
        assert c.label == "the label"
        assert c.min == min_date_value
        assert c.max == max_date_value

    @parameterized.expand(
        [
            (
                TODAY,
                TODAY + timedelta(days=7),
                TODAY + timedelta(days=14),
            ),
            (
                TODAY + timedelta(days=8),
                TODAY,
                TODAY + timedelta(days=7),
            ),
            (
                [TODAY, TODAY + timedelta(2)],
                TODAY + timedelta(days=7),
                TODAY + timedelta(days=14),
            ),
            (
                [TODAY, TODAY + timedelta(8)],
                TODAY + timedelta(days=7),
                TODAY + timedelta(days=14),
            ),
            (
                [TODAY, TODAY + timedelta(8)],
                TODAY,
                TODAY + timedelta(days=7),
            ),
        ]
    )
    def test_value_out_of_range(self, value, min_date, max_date):
        with pytest.raises(StreamlitAPIException) as exc_message:
            st.date_input(
                "the label", value=value, min_value=min_date, max_value=max_date
            )
        if isinstance(value, (date, datetime)):
            value = [value]
        value = [v.date() if isinstance(v, datetime) else v for v in value]
        assert (
            f"The default `value` of {value} must lie between the `min_value` of {min_date.date()} "
            f"and the `max_value` of {max_date.date()}, inclusively."
            == str(exc_message.value)
        )

    @parameterized.expand(
        [
            (TODAY, TODAY, TODAY + timedelta(days=14)),
            (
                TODAY + timedelta(days=14),
                TODAY,
                TODAY + timedelta(days=14),
            ),
            (
                TODAY + timedelta(days=10),
                TODAY,
                TODAY + timedelta(days=14),
            ),
            (
                [TODAY + timedelta(1), TODAY + timedelta(2)],
                TODAY,
                TODAY + timedelta(days=14),
            ),
            (
                [TODAY, TODAY + timedelta(14)],
                TODAY,
                TODAY + timedelta(days=14),
            ),
        ]
    )
    def test_value_in_range(self, value, min_date, max_date):
        st.date_input("the label", value=value, min_value=min_date, max_value=max_date)
        # No need to assert anything. Testing if not throwing an error.

    def test_default_min_if_today_is_before_min(self):
        min_date = date(9998, 2, 28)
        st.date_input("the label", min_value=min_date, max_value=date(9999, 2, 28))

        c = self.get_delta_from_queue().new_element.date_input
        assert datetime.strptime(c.default[0], "%Y/%m/%d").date() == min_date

    def test_default_max_if_today_is_after_min(self):
        max_date = date(1001, 2, 28)
        st.date_input("the label", min_value=date(1000, 2, 28), max_value=max_date)

        c = self.get_delta_from_queue().new_element.date_input
        assert datetime.strptime(c.default[0], "%Y/%m/%d").date() == max_date

    def test_range_session_state(self):
        """Test a range set by session state."""
        date_range_input = [date(2024, 1, 15), date(2024, 1, 15) + timedelta(2)]
        state = st.session_state
        state["date_range"] = date_range_input[:]

        date_range = st.date_input(
            "select a date range",
            key="date_range",
        )

        c = self.get_delta_from_queue().new_element.date_input

        assert date_range == date_range_input

        assert c.value == ["2024/01/15", "2024/01/17"]
        assert c.is_range

    def test_inside_column(self):
        """Test that it works correctly inside a column."""
        col1, col2 = st.columns(2)

        with col1:
            st.date_input("foo")

        all_deltas = self.get_all_deltas_from_queue()

        # 4 elements will be created: 1 horizontal block, 2 columns, 1 widget
        assert len(all_deltas) == 4
        date_input_proto = self.get_delta_from_queue().new_element.date_input

        assert date_input_proto.label == "foo"

    @parameterized.expand(
        [
            ("visible", LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility param."""
        st.date_input("the label", label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.date_input
        assert c.label_visibility.value == proto_value

    def test_label_visibility_wrong_value(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.date_input("the label", label_visibility="wrong_value")
        assert (
            str(e.value)
            == "Unsupported label_visibility option 'wrong_value'. Valid values are 'visible', 'hidden' or 'collapsed'."
        )

    @parameterized.expand(
        [
            ("YYYY/MM/DD"),
            ("DD/MM/YYYY"),
            ("MM/DD/YYYY"),
            ("YYYY.MM.DD"),
            ("DD.MM.YYYY"),
            ("MM.DD.YYYY"),
            ("YYYY-MM-DD"),
            ("DD-MM-YYYY"),
            ("MM-DD-YYYY"),
        ]
    )
    def test_supported_date_format_values(self, format: str):
        """Test that it can be called with supported date formats."""
        st.date_input("the label", format=format)
        msg = self.get_delta_from_queue().new_element.date_input
        assert msg.label == "the label"
        assert msg.format == format

    @parameterized.expand(
        [
            ("YYYY:MM:DD"),  # Unexpected separator
            ("DD:MM:YYYY"),  # Unexpected separator
            ("MM:DD:YYYY"),  # Unexpected separator
            ("YYYY/DD/MM"),  # Incorrect order
            ("DD/YYYY/MM"),  # Incorrect order
            ("MM/YYYY/DD"),  # Incorrect order
            ("YYYY/MM/DDo"),  # Unsupported format
            ("DDo/MM/YYYY"),  # Unsupported format
            ("Mo/DD/YYYY"),  # Unsupported format
            ("Q/DD/YYYY"),  # Unsupported format
            ("YYYY/QQ/DD"),  # Unsupported format
            ("YYYY/Q/DD"),  # Unsupported format
            ("YYYY/MM/DD HH:mm:ss"),  # Unsupported format
            (""),  # Empty not allowed
        ]
    )
    def test_invalid_date_format_values(self, format: str):
        """Test that it raises an exception for invalid date formats."""
        with pytest.raises(StreamlitAPIException) as ex:
            st.date_input("the label", format=format)
        assert str(ex.value).startswith("The provided format")

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.date_input("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_width_config_default(self):
        """Test that default width is 'stretch'."""
        st.date_input("the label")

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    def test_width_config_pixel(self):
        """Test that pixel width works properly."""
        st.date_input("the label", width=200)

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 200

    def test_width_config_stretch(self):
        """Test that 'stretch' width works properly."""
        st.date_input("the label", width="stretch")

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    @parameterized.expand(
        [
            "invalid",
            -100,
            0,
            100.5,
            None,
        ]
    )
    def test_invalid_width(self, width):
        """Test that invalid width values raise exceptions."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.date_input("the label", width=width)


def test_date_input_interaction():
    """Test interactions with an empty date_input widget."""

    def script():
        import streamlit as st

        st.date_input("the label", value=None)

    at = AppTest.from_function(script).run()
    date_input = at.date_input[0]
    assert date_input.value is None

    # Set the value to a specific date
    at = date_input.set_value(date(2012, 1, 3)).run()
    date_input = at.date_input[0]
    assert date_input.value == date(2012, 1, 3)

    # # Clear the value
    at = date_input.set_value(None).run()
    date_input = at.date_input[0]
    assert date_input.value is None


def test_None_session_state_value_retained():
    def script():
        import streamlit as st

        if "date_input" not in st.session_state:
            st.session_state["date_input"] = None

        st.date_input("date_input", key="date_input")
        st.button("button")

    at = AppTest.from_function(script).run()
    at = at.button[0].click().run()
    assert at.date_input[0].value is None
