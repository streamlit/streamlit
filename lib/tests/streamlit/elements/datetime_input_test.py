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

"""datetime_input unit test."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException, StreamlitInvalidWidthError
from streamlit.proto.LabelVisibility_pb2 import LabelVisibility
from streamlit.testing.v1.app_test import AppTest
from streamlit.testing.v1.element_tree import DateTimeInput
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields

DATETIME_FORMAT = "%Y/%m/%d, %H:%M"


class DateTimeInputTest(DeltaGeneratorTestCase):
    """Test ability to marshall datetime_input protos."""

    def test_just_label(self):
        """Test rendering with default value."""
        st.datetime_input("the label")

        proto = self.get_delta_from_queue().new_element.date_time_input
        assert proto.label == "the label"
        assert (
            proto.label_visibility.value
            == LabelVisibility.LabelVisibilityOptions.VISIBLE
        )
        assert proto.format == "YYYY/MM/DD"
        assert proto.step == timedelta(minutes=15).seconds
        assert not proto.disabled
        assert len(proto.default) == 1
        assert proto.default[0] is not None

        parsed_default = datetime.strptime(proto.default[0], DATETIME_FORMAT)
        assert parsed_default <= datetime.now()

        parsed_min = datetime.strptime(proto.min, DATETIME_FORMAT)
        parsed_max = datetime.strptime(proto.max, DATETIME_FORMAT)
        assert parsed_min < parsed_default < parsed_max

    def test_none_value(self):
        """Test that it can be called with None as initial value."""
        st.datetime_input("the label", value=None)

        proto = self.get_delta_from_queue().new_element.date_time_input
        assert proto.label == "the label"
        assert not proto.default

    @parameterized.expand(
        [
            (
                datetime(2025, 11, 19, 16, 45),
                datetime(2025, 11, 19, 16, 45),
            ),
            (
                date(2025, 11, 19),
                datetime(2025, 11, 19, 0, 0),
            ),
            (
                time(16, 45),
                datetime.combine(date.today(), time(16, 45)),
            ),
            (
                "2025-11-19 16:45:00",
                datetime(2025, 11, 19, 16, 45),
            ),
        ]
    )
    def test_value_types(
        self, arg_value: datetime | date | time | str, expected: datetime
    ):
        """Test that it supports different types of values."""
        st.datetime_input("the label", arg_value)

        proto = self.get_delta_from_queue().new_element.date_time_input
        assert proto.label == "the label"
        assert proto.default[0] == expected.strftime(DATETIME_FORMAT)

    def test_min_max_values(self):
        """Test custom min/max values."""
        min_value = datetime(2020, 1, 1, 8, 0)
        max_value = datetime(2030, 1, 1, 18, 0)
        st.datetime_input(
            "Range",
            datetime(2025, 1, 1, 12, 0),
            min_value=min_value,
            max_value=max_value,
        )

        proto = self.get_delta_from_queue().new_element.date_time_input
        assert proto.min == min_value.strftime(DATETIME_FORMAT)
        assert proto.max == max_value.strftime(DATETIME_FORMAT)

    def test_label_visibility(self):
        """Test that label visibility works."""
        st.datetime_input("the label", label_visibility="hidden")

        proto = self.get_delta_from_queue().new_element.date_time_input
        assert (
            proto.label_visibility.value
            == LabelVisibility.LabelVisibilityOptions.HIDDEN
        )

    def test_label_visibility_wrong_value(self):
        """Test that invalid label visibility raises."""
        with pytest.raises(StreamlitAPIException):
            st.datetime_input("the label", label_visibility="wrong_value")

    def test_step_validation(self):
        """Test invalid step values."""
        with pytest.raises(StreamlitAPIException):
            st.datetime_input("The label", step=True)
        with pytest.raises(StreamlitAPIException):
            st.datetime_input("The label", step=(1, 0))
        with pytest.raises(StreamlitAPIException):
            st.datetime_input("The label", step=30)
        with pytest.raises(StreamlitAPIException):
            st.datetime_input("The label", step=timedelta(hours=24))

    def test_format_validation(self):
        """Test invalid format raises."""
        with pytest.raises(StreamlitAPIException):
            st.datetime_input("the label", format="YY/MM/DD")

    def test_width_config_default(self):
        """Test that default width is 'stretch'."""
        st.datetime_input("the label")

        proto = self.get_delta_from_queue().new_element
        assert (
            proto.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert proto.width_config.use_stretch

    def test_width_config_pixel(self):
        """Test that pixel width works properly."""
        st.datetime_input("the label", width=200)

        proto = self.get_delta_from_queue().new_element
        assert (
            proto.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert proto.width_config.pixel_width == 200

    def test_invalid_width(self):
        """Test that invalid width raises."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.datetime_input("the label", width="invalid")  # type: ignore[arg-type]

    def test_inside_column(self):
        """Test that it works correctly inside of a column."""
        col1, _ = st.columns([3, 2])

        with col1:
            st.datetime_input("foo")

        all_deltas = self.get_all_deltas_from_queue()
        assert len(all_deltas) == 4
        proto = self.get_delta_from_queue().new_element.date_time_input
        assert proto.label == "foo"

    def test_stable_id_with_key(self):
        """Test ID stability when key provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            st.datetime_input(
                label="Label 1",
                key="datetime_key",
                value=datetime(2025, 1, 1, 9, 0),
                min_value=datetime(2020, 1, 1, 0, 0),
                max_value=datetime(2030, 1, 1, 0, 0),
                format="YYYY/MM/DD",
                step=timedelta(minutes=15),
            )
            proto1 = self.get_delta_from_queue().new_element.date_time_input
            id1 = proto1.id

            st.datetime_input(
                label="Label 2",
                key="datetime_key",
                value=datetime(2025, 1, 2, 9, 0),
                min_value=datetime(2020, 1, 1, 0, 0),
                max_value=datetime(2030, 1, 1, 0, 0),
                format="YYYY/MM/DD",
                step=timedelta(minutes=15),
            )
            proto2 = self.get_delta_from_queue().new_element.date_time_input
            id2 = proto2.id
            assert id1 == id2

    def test_whitelisted_key_changes(self):
        """Test that whitelisted kwargs update the ID."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            base_kwargs = {
                "label": "Label",
                "key": "datetime_key",
                "value": datetime(2025, 1, 1, 9, 0),
                "min_value": datetime(2020, 1, 1, 0, 0),
                "max_value": datetime(2030, 1, 1, 0, 0),
                "format": "YYYY/MM/DD",
                "step": timedelta(minutes=15),
            }

            st.datetime_input(**base_kwargs)
            proto1 = self.get_delta_from_queue().new_element.date_time_input
            id1 = proto1.id

            base_kwargs["step"] = timedelta(minutes=30)
            st.datetime_input(**base_kwargs)
            proto2 = self.get_delta_from_queue().new_element.date_time_input
            id2 = proto2.id
            assert id1 != id2

    def test_min_value_now(self):
        """Test min_value='now'."""

        class MockDatetime(datetime):
            @classmethod
            def now(cls, tz=None):
                return cls(2024, 1, 1, 12, 0, 0)

        with patch("streamlit.elements.widgets.time_widgets.datetime", MockDatetime):
            # We must use MockDatetime for the value passed in, because time_widgets.datetime
            # is patched to MockDatetime, so isinstance(val, datetime) checks against MockDatetime.
            # Real datetime objects would fail this check.
            val = MockDatetime(2024, 1, 1, 13, 0, 0)
            st.datetime_input("min_now", value=val, min_value="now")
            proto = self.get_delta_from_queue().new_element.date_time_input

            # min should be exactly the mocked now
            assert proto.min == "2024/01/01, 12:00"

    def test_max_value_now(self):
        """Test max_value='now'."""

        class MockDatetime(datetime):
            @classmethod
            def now(cls, tz=None):
                return cls(2024, 1, 1, 12, 0, 0)

        with patch("streamlit.elements.widgets.time_widgets.datetime", MockDatetime):
            val = MockDatetime(2024, 1, 1, 11, 0, 0)
            st.datetime_input("max_now", value=val, max_value="now")
            proto = self.get_delta_from_queue().new_element.date_time_input

            # max should be exactly the mocked now
            assert proto.max == "2024/01/01, 12:00"

    def test_min_max_exception(self):
        """Test that min_value > max_value raises an exception."""
        min_value = datetime(2030, 1, 1, 12, 0)
        max_value = datetime(2020, 1, 1, 12, 0)
        with pytest.raises(StreamlitAPIException):
            st.datetime_input("Label", min_value=min_value, max_value=max_value)

    def test_initial_value_out_of_bounds_exception(self):
        """Test that initial value out of min/max bounds raises an exception."""
        min_value = datetime(2020, 1, 1, 12, 0)
        max_value = datetime(2030, 1, 1, 12, 0)

        with pytest.raises(StreamlitAPIException):
            st.datetime_input(
                "Label",
                value=datetime(2010, 1, 1),
                min_value=min_value,
                max_value=max_value,
            )

        with pytest.raises(StreamlitAPIException):
            st.datetime_input(
                "Label",
                value=datetime(2040, 1, 1),
                min_value=min_value,
                max_value=max_value,
            )

    def test_timezone_handling(self):
        """Test that timezone-aware datetimes are normalized to naive."""
        # Create a timezone-aware datetime
        dt_aware = datetime(2025, 1, 1, 12, 0, tzinfo=timezone.utc)

        st.datetime_input("Label", value=dt_aware)

        proto = self.get_delta_from_queue().new_element.date_time_input
        # Proto string should not contain timezone info
        assert proto.default[0] == "2025/01/01, 12:00"

    def test_invalid_value_exception(self):
        """Test that passing an invalid value raises an exception."""
        with pytest.raises(StreamlitAPIException):
            st.datetime_input("Label", value="invalid-date-string")

    def test_help_and_disabled(self):
        """Test help and disabled parameters."""
        st.datetime_input("Label", help="The help text", disabled=True)

        proto = self.get_delta_from_queue().new_element.date_time_input
        assert proto.help == "The help text"
        assert proto.disabled is True


def test_datetime_input_interaction():
    """Test interactions with an empty datetime_input widget."""

    def script():
        import streamlit as st

        st.datetime_input("the label", value=None)

    at = AppTest.from_function(script).run()
    widget = at.datetime_input[0]
    assert widget.value is None

    new_value = datetime(2025, 11, 19, 16, 45)
    DateTimeInput.set_value(widget, new_value)
    at = widget.run()
    widget = at.datetime_input[0]
    assert widget.value == new_value

    at = widget.set_value(None).run()
    widget = at.datetime_input[0]
    assert widget.value is None


def test_datetime_input_min_max_validation():
    """Test that datetime_input rejects values outside min/max bounds."""

    def script():
        from datetime import datetime

        import streamlit as st

        min_value = datetime(2020, 1, 1, 8, 0)
        max_value = datetime(2030, 1, 1, 18, 0)
        initial_value = datetime(2025, 1, 1, 12, 0)

        st.datetime_input(
            "the label",
            value=initial_value,
            min_value=min_value,
            max_value=max_value,
        )

    at = AppTest.from_function(script).run()
    widget = at.datetime_input[0]
    assert widget.value == datetime(2025, 1, 1, 12, 0)

    # Try to set a value below min - should keep the current value
    below_min_value = datetime(2019, 12, 31, 23, 0)
    at = widget.set_value(below_min_value).run()
    widget = at.datetime_input[0]
    assert widget.value == datetime(2025, 1, 1, 12, 0)

    # Try to set a value above max - should keep the current value
    above_max_value = datetime(2030, 1, 2, 0, 0)
    at = widget.set_value(above_max_value).run()
    widget = at.datetime_input[0]
    assert widget.value == datetime(2025, 1, 1, 12, 0)

    # Valid value within bounds should work
    valid_value = datetime(2025, 6, 15, 14, 30)
    at = widget.set_value(valid_value).run()
    widget = at.datetime_input[0]
    assert widget.value == valid_value


def test_datetime_input_callback():
    """Test that on_change callback is triggered."""

    def script():
        from datetime import datetime

        import streamlit as st

        if "called" not in st.session_state:
            st.session_state.called = False

        def callback():
            st.session_state.called = True

        st.datetime_input(
            "Label", value=datetime(2020, 1, 1, 10, 0), on_change=callback, key="dt"
        )

    at = AppTest.from_function(script).run()

    new_value = datetime(2025, 1, 1, 12, 0)
    at.datetime_input[0].set_value(new_value).run()

    assert at.session_state.called
    assert at.session_state.dt == new_value


@patch("streamlit.elements.lib.policies._shown_default_value_warning", new=False)
def test_session_state_takes_precedence():
    """Test that session state value takes precedence over default value."""

    def script():
        from datetime import datetime

        import streamlit as st

        if "my_datetime" not in st.session_state:
            st.session_state.my_datetime = datetime(2024, 12, 25, 10, 0)

        st.datetime_input("Label", value=datetime(2025, 1, 1), key="my_datetime")

    at = AppTest.from_function(script).run()
    widget = at.datetime_input[0]
    assert widget.value == datetime(2024, 12, 25, 10, 0)


def test_dynamic_min_value_resets_value_when_below_new_min():
    """Test that value resets to default when dynamically changing min_value makes current value invalid."""

    def script():
        from datetime import datetime

        import streamlit as st

        if "update_bounds" not in st.session_state:
            st.session_state["update_bounds"] = False

        if st.session_state["update_bounds"]:
            # New min_value makes the previous value invalid
            value = st.datetime_input(
                "datetime",
                min_value=datetime(2024, 6, 1, 0, 0),
                max_value=datetime(2024, 12, 31, 23, 59),
                key="datetime",
                value=datetime(2024, 7, 15, 12, 0),
            )
        else:
            value = st.datetime_input(
                "datetime",
                min_value=datetime(2024, 1, 1, 0, 0),
                max_value=datetime(2024, 12, 31, 23, 59),
                key="datetime",
                value=datetime(2024, 5, 15, 12, 0),
            )
        st.write(f"value: {value}")

        if st.button("Toggle bounds"):
            st.session_state["update_bounds"] = not st.session_state["update_bounds"]

    at = AppTest.from_function(script).run()
    assert at.datetime_input[0].value == datetime(2024, 5, 15, 12, 0)

    # Set value to March 1 (valid with min_value=Jan 1)
    at = at.datetime_input[0].set_value(datetime(2024, 3, 1, 10, 0)).run()
    assert at.datetime_input[0].value == datetime(2024, 3, 1, 10, 0)

    # Toggle bounds - the click updates session_state["update_bounds"] to True
    at = at.button[0].click().run()
    # AppTest requires an additional run to process the widget with the new bounds
    at = at.run()
    # Now min_value=June 1, so March 1 is invalid and should reset to default (July 15)
    assert at.datetime_input[0].value == datetime(2024, 7, 15, 12, 0)


def test_dynamic_max_value_resets_value_when_above_new_max():
    """Test that value resets to default when dynamically changing max_value makes current value invalid."""

    def script():
        from datetime import datetime

        import streamlit as st

        if "update_bounds" not in st.session_state:
            st.session_state["update_bounds"] = False

        if st.session_state["update_bounds"]:
            # New max_value makes the previous value invalid
            value = st.datetime_input(
                "datetime",
                min_value=datetime(2024, 1, 1, 0, 0),
                max_value=datetime(2024, 6, 30, 23, 59),
                key="datetime",
                value=datetime(2024, 3, 15, 12, 0),
            )
        else:
            value = st.datetime_input(
                "datetime",
                min_value=datetime(2024, 1, 1, 0, 0),
                max_value=datetime(2024, 12, 31, 23, 59),
                key="datetime",
                value=datetime(2024, 5, 15, 12, 0),
            )
        st.write(f"value: {value}")

        if st.button("Toggle bounds"):
            st.session_state["update_bounds"] = not st.session_state["update_bounds"]

    at = AppTest.from_function(script).run()
    assert at.datetime_input[0].value == datetime(2024, 5, 15, 12, 0)

    # Set value to October 1 (valid with max_value=Dec 31)
    at = at.datetime_input[0].set_value(datetime(2024, 10, 1, 14, 0)).run()
    assert at.datetime_input[0].value == datetime(2024, 10, 1, 14, 0)

    # Toggle bounds - the click updates session_state["update_bounds"] to True
    at = at.button[0].click().run()
    # AppTest requires an additional run to process the widget with the new bounds
    at = at.run()
    # Now max_value=June 30, so October 1 is invalid and should reset to default (March 15)
    assert at.datetime_input[0].value == datetime(2024, 3, 15, 12, 0)


def test_dynamic_bounds_preserves_valid_value():
    """Test that value is preserved when it remains valid after bound changes."""

    def script():
        from datetime import datetime

        import streamlit as st

        if "update_bounds" not in st.session_state:
            st.session_state["update_bounds"] = False

        if st.session_state["update_bounds"]:
            # Changing bounds but May 15 is still valid (between Apr 1 and Sep 30)
            value = st.datetime_input(
                "datetime",
                min_value=datetime(2024, 4, 1, 0, 0),
                max_value=datetime(2024, 9, 30, 23, 59),
                key="datetime",
                value=datetime(2024, 5, 15, 12, 0),
            )
        else:
            value = st.datetime_input(
                "datetime",
                min_value=datetime(2024, 1, 1, 0, 0),
                max_value=datetime(2024, 12, 31, 23, 59),
                key="datetime",
                value=datetime(2024, 5, 15, 12, 0),
            )
        st.write(f"value: {value}")

        if st.button("Toggle bounds"):
            st.session_state["update_bounds"] = not st.session_state["update_bounds"]

    at = AppTest.from_function(script).run()
    assert at.datetime_input[0].value == datetime(2024, 5, 15, 12, 0)

    # Toggle bounds - the click updates session_state["update_bounds"] to True
    at = at.button[0].click().run()
    # AppTest requires an additional run to process the widget with the new bounds
    at = at.run()
    # Value should be preserved because it's still within the new bounds
    assert at.datetime_input[0].value == datetime(2024, 5, 15, 12, 0)


def test_dynamic_bounds_preserves_user_set_valid_value():
    """Test that a user-set value (different from default) is preserved when still valid after bound changes."""

    def script():
        from datetime import datetime

        import streamlit as st

        if "update_bounds" not in st.session_state:
            st.session_state["update_bounds"] = False

        if st.session_state["update_bounds"]:
            # New bounds: Apr 1 to Sep 30 - July 1 is still valid
            value = st.datetime_input(
                "datetime",
                min_value=datetime(2024, 4, 1, 0, 0),
                max_value=datetime(2024, 9, 30, 23, 59),
                key="datetime",
                value=datetime(2024, 5, 15, 12, 0),
            )
        else:
            value = st.datetime_input(
                "datetime",
                min_value=datetime(2024, 1, 1, 0, 0),
                max_value=datetime(2024, 12, 31, 23, 59),
                key="datetime",
                value=datetime(2024, 5, 15, 12, 0),
            )
        st.write(f"value: {value}")

        if st.button("Toggle bounds"):
            st.session_state["update_bounds"] = not st.session_state["update_bounds"]

    at = AppTest.from_function(script).run()
    assert at.datetime_input[0].value == datetime(2024, 5, 15, 12, 0)

    # Set value to July 1 (different from default May 15, valid in both bound ranges)
    at = at.datetime_input[0].set_value(datetime(2024, 7, 1, 10, 0)).run()
    assert at.datetime_input[0].value == datetime(2024, 7, 1, 10, 0)

    # Toggle bounds - the click updates session_state["update_bounds"] to True
    at = at.button[0].click().run()
    # AppTest requires an additional run to process the widget with the new bounds
    at = at.run()
    # User-set value (July 1) should be preserved, not reset to default (May 15)
    assert at.datetime_input[0].value == datetime(2024, 7, 1, 10, 0)
    # Ensure it's not reset to the default value
    assert at.datetime_input[0].value != datetime(2024, 5, 15, 12, 0)
