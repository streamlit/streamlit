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

"""time_input unit test."""

from datetime import date, datetime, time, timedelta
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.widgets.time_widgets import (
    TimeInputSerde,
    _convert_datelike_to_date,
    _convert_timelike_to_time,
    _parse_date_value,
)
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitInvalidBindValueError,
    StreamlitInvalidWidthError,
)
from streamlit.proto.LabelVisibility_pb2 import LabelVisibility
from streamlit.testing.v1.app_test import AppTest
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class TimeInputTest(DeltaGeneratorTestCase):
    """Test ability to marshall time_input protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.time_input("the label")

        c = self.get_delta_from_queue().new_element.time_input
        assert c.label == "the label"
        assert (
            c.label_visibility.value == LabelVisibility.LabelVisibilityOptions.VISIBLE
        )
        assert datetime.strptime(c.default, "%H:%M").time() <= datetime.now().time()
        assert c.HasField("default")
        assert not c.disabled

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.time_input("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.time_input
        assert c.disabled

    def test_none_value(self):
        """Test that it can be called with None as initial value."""
        st.time_input("the label", value=None)

        c = self.get_delta_from_queue().new_element.time_input
        assert c.label == "the label"
        # If a proto property is null is not determined by this value,
        # but by the check via the HasField method:
        assert c.default == ""
        assert not c.HasField("default")

    @parameterized.expand(
        [
            (time(8, 45), "08:45"),
            (datetime(2019, 7, 6, 21, 15), "21:15"),
            ("21:15:00", "21:15"),
            ("21:15:10.123", "21:15"),
            ("2019-07-06 21:15:10.123", "21:15"),
        ]
    )
    def test_value_types(self, arg_value, proto_value):
        """Test that it supports different types of values."""
        st.time_input("the label", arg_value)

        c = self.get_delta_from_queue().new_element.time_input
        assert c.label == "the label"
        assert c.default == proto_value

    def test_inside_column(self):
        """Test that it works correctly inside of a column."""
        col1, _ = st.columns([3, 2])

        with col1:
            st.time_input("foo")

        all_deltas = self.get_all_deltas_from_queue()

        # 4 elements will be created: 1 horizontal block, 2 columns, 1 widget
        assert len(all_deltas) == 4
        time_input_proto = self.get_delta_from_queue().new_element.time_input

        assert time_input_proto.label == "foo"

    @parameterized.expand(
        [
            ("visible", LabelVisibility.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibility.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibility.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility param."""
        st.time_input("the label", label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.time_input
        assert c.label_visibility.value == proto_value

    def test_label_visibility_wrong_value(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.time_input("the label", label_visibility="wrong_value")
        assert (
            str(e.value)
            == "Unsupported label_visibility option 'wrong_value'. Valid values are 'visible', 'hidden' or 'collapsed'."
        )

    def test_st_time_input(self):
        """Test st.time_input."""
        value = time(8, 45)
        st.time_input("Set an alarm for", value)

        el = self.get_delta_from_queue().new_element
        assert el.time_input.default == "08:45"
        assert el.time_input.step == timedelta(minutes=15).seconds

    def test_st_time_input_with_step(self):
        """Test st.time_input with step."""
        value = time(9, 00)
        st.time_input("Set an alarm for", value, step=timedelta(minutes=5))

        el = self.get_delta_from_queue().new_element
        assert el.time_input.default == "09:00"
        assert el.time_input.step == timedelta(minutes=5).seconds

    def test_st_time_input_exceptions(self):
        """Test st.time_input exceptions."""
        value = time(9, 00)
        with pytest.raises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=True)
        with pytest.raises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=(90, 0))
        with pytest.raises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=1)
        with pytest.raises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=59)
        with pytest.raises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=timedelta(hours=24))
        with pytest.raises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=timedelta(days=1))

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.time_input("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-3).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_width_config_default(self):
        """Test that default width is 'stretch'."""
        st.time_input("the label")

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    def test_width_config_pixel(self):
        """Test that pixel width works properly."""
        st.time_input("the label", width=200)

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 200

    def test_width_config_stretch(self):
        """Test that 'stretch' width works properly."""
        st.time_input("the label", width="stretch")

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
            st.time_input("the label", width=width)

    def test_stable_id_with_key(self):
        """Test that the widget ID is stable when a stable key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with certain params (keep whitelisted kwargs stable)
            st.time_input(
                label="Label 1",
                key="time_input_key",
                value=time(8, 45),
                help="Help 1",
                disabled=False,
                width="stretch",
                on_change=lambda: None,
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
                label_visibility="visible",
                # Whitelisted kwargs:
                step=timedelta(minutes=15),
            )
            c1 = self.get_delta_from_queue().new_element.time_input
            id1 = c1.id

            # Second render with different non-whitelisted params but same key
            st.time_input(
                label="Label 2",
                key="time_input_key",
                value=time(9, 0),
                help="Help 2",
                disabled=True,
                width=200,
                on_change=lambda: None,
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
                label_visibility="hidden",
                # Keep whitelisted the same to ensure ID stability
                step=timedelta(minutes=15),
            )
            c2 = self.get_delta_from_queue().new_element.time_input
            id2 = c2.id
            assert id1 == id2

    @parameterized.expand(
        [
            ("step", timedelta(minutes=15), timedelta(minutes=5)),
        ]
    )
    def test_whitelisted_stable_key_kwargs(self, kwarg_name, value1, value2):
        """Test that the widget ID changes when a whitelisted kwarg changes even when the key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            base_kwargs = {
                "label": "Label",
                "key": "time_input_key",
                # keep other params stable
                "value": time(8, 45),
                "step": value1,
            }

            st.time_input(**base_kwargs)
            c1 = self.get_delta_from_queue().new_element.time_input
            id1 = c1.id

            base_kwargs[kwarg_name] = value2
            st.time_input(**base_kwargs)
            c2 = self.get_delta_from_queue().new_element.time_input
            id2 = c2.id
            assert id1 != id2


def test_time_input_interaction():
    """Test interactions with an empty time_input widget."""

    def script():
        import streamlit as st

        st.time_input("the label", value=None)

    at = AppTest.from_function(script).run()
    time_input = at.time_input[0]
    assert time_input.value is None

    # Input a time:
    at = time_input.set_value(time(8, 45)).run()
    time_input = at.time_input[0]
    assert time_input.value == time(8, 45)

    # # Clear the value
    at = time_input.set_value(None).run()
    time_input = at.time_input[0]
    assert time_input.value is None


def test_None_session_state_value_retained():
    def script():
        import streamlit as st

        if "time_input" not in st.session_state:
            st.session_state["time_input"] = None

        st.time_input("time_input", key="time_input")
        st.button("button")

    at = AppTest.from_function(script).run()
    at = at.button[0].click().run()
    assert at.time_input[0].value is None


class TimeInputBindQueryParamsTest(DeltaGeneratorTestCase):
    """Test query param binding for st.time_input."""

    def test_bind_query_params_sets_query_param_key(self):
        """Test that bind='query-params' sets query_param_key."""
        st.time_input("the label", key="my_key", bind="query-params")

        c = self.get_delta_from_queue().new_element.time_input
        assert c.query_param_key == "my_key"

    def test_no_bind_does_not_set_query_param_key(self):
        """Test that query_param_key is empty without bind."""
        st.time_input("the label", key="my_key")

        c = self.get_delta_from_queue().new_element.time_input
        assert c.query_param_key == ""

    def test_bind_requires_key(self):
        """Test that bind without key raises StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException):
            st.time_input("the label", bind="query-params")

    def test_invalid_bind_value_raises_exception(self):
        """Test that an invalid bind value raises StreamlitInvalidBindValueError."""
        with pytest.raises(StreamlitInvalidBindValueError, match=r"invalid-value"):
            st.time_input("the label", key="my_key", bind="invalid-value")

    def test_bind_query_params_with_explicit_value(self):
        """Test that bind works when value is explicitly set."""
        st.time_input(
            "the label",
            value=time(14, 30),
            key="my_key",
            bind="query-params",
        )

        c = self.get_delta_from_queue().new_element.time_input
        assert c.query_param_key == "my_key"
        assert c.default == "14:30"

    def test_bind_query_params_with_none_value(self):
        """Test that bind works with value=None (clearable)."""
        st.time_input("the label", value=None, key="my_key", bind="query-params")

        c = self.get_delta_from_queue().new_element.time_input
        assert c.query_param_key == "my_key"
        assert not c.HasField("default")


class TestTimeInputSerdeDeserialization:
    """Tests for TimeInputSerde deserialization."""

    def test_deserialize_returns_default_on_none(self):
        """Test that None ui_value returns the default value."""
        serde = TimeInputSerde(value=time(8, 45))
        result = serde.deserialize(None)
        assert result == time(8, 45)

    def test_deserialize_parses_hh_mm(self):
        """Test that HH:MM format is correctly parsed."""
        serde = TimeInputSerde(value=time(8, 45))
        result = serde.deserialize("14:30")
        assert result == time(14, 30)

    def test_deserialize_returns_parsed_time_without_snapping(self):
        """Test that deserialize returns the parsed time as-is."""
        serde = TimeInputSerde(value=time(9, 0), step=1800)
        result = serde.deserialize("09:10")
        assert result == time(9, 10)

    def test_deserialize_invalid_format_reverts_to_default(self):
        """Test that unparseable strings revert to the default value."""
        serde = TimeInputSerde(value=time(8, 45))
        result = serde.deserialize("not-a-time")
        assert result == time(8, 45)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("12:30", time(12, 30)),
        ("2020-01-01T12:30:45.123", time(12, 30)),
        (datetime(2020, 1, 1, 9, 5, 33), time(9, 5)),
    ],
    ids=["iso_time", "iso_datetime_drops_subseconds", "datetime_object"],
)
def test_convert_timelike_to_time_parses_value(
    value: str | datetime, expected: time
) -> None:
    """``_convert_timelike_to_time`` parses ISO strings and datetimes to a time."""
    assert _convert_timelike_to_time(value) == expected


def test_convert_timelike_to_time_returns_same_instance_for_time() -> None:
    """A ``time`` instance is returned unchanged (identity-preserving)."""
    t = time(7, 15)
    assert _convert_timelike_to_time(t) is t


@pytest.mark.parametrize(
    ("invalid_input", "match"),
    [("not-a-time", "datetime, time"), (42, None)],
    ids=["invalid_string", "invalid_type"],
)
def test_convert_timelike_to_time_invalid_raises(
    invalid_input: object, match: str | None
) -> None:
    """Unparseable strings or wrong types raise StreamlitAPIException."""
    with pytest.raises(StreamlitAPIException, match=match):
        _convert_timelike_to_time(invalid_input)  # type: ignore[arg-type]


def test_convert_datelike_to_date_today_keyword() -> None:
    """The string ``"today"`` resolves to today's date."""
    # Freeze time so the comparison cannot flake across a midnight boundary.
    # A datetime subclass is used (instead of a plain mock) so the function's
    # internal isinstance(..., datetime) checks keep working.
    frozen_now = datetime(2026, 6, 11, 12, 0, 0)

    class _FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz: object = None) -> datetime:  # type: ignore[override]
            return frozen_now

    with patch("streamlit.elements.widgets.time_widgets.datetime", _FrozenDatetime):
        assert _convert_datelike_to_date("today") == frozen_now.date()


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("2020-01-15", date(2020, 1, 15)),
        ("2020-01-15T10:00:00", date(2020, 1, 15)),
    ],
    ids=["iso_date", "iso_datetime"],
)
def test_convert_datelike_to_date_parses_iso_strings(
    value: str, expected: date
) -> None:
    """``_convert_datelike_to_date`` parses ISO date and datetime strings."""
    assert _convert_datelike_to_date(value) == expected


@pytest.mark.parametrize(
    ("invalid_input", "match"),
    [("not-a-date", "ISO string"), (42, None)],
    ids=["invalid_string", "invalid_type"],
)
def test_convert_datelike_to_date_invalid_raises(
    invalid_input: object, match: str | None
) -> None:
    """Unparseable strings or wrong types raise StreamlitAPIException."""
    with pytest.raises(StreamlitAPIException, match=match):
        _convert_datelike_to_date(invalid_input)  # type: ignore[arg-type]


def test_parse_date_value_none_is_not_range() -> None:
    """A ``None`` value yields ``(None, False)``."""
    assert _parse_date_value(None) == (None, False)


def test_parse_date_value_too_many_dates_raises() -> None:
    """A range of more than 2 dates raises StreamlitAPIException."""
    with pytest.raises(StreamlitAPIException, match="0 - 2 date"):
        _parse_date_value([date(2020, 1, 1), date(2020, 1, 2), date(2020, 1, 3)])


@pytest.mark.parametrize(
    ("value", "expected_dates", "expected_is_range"),
    [
        (date(2020, 1, 1), [date(2020, 1, 1)], False),
        (
            [date(2020, 1, 1), date(2020, 1, 2)],
            [date(2020, 1, 1), date(2020, 1, 2)],
            True,
        ),
    ],
    ids=["single_date", "date_range"],
)
def test_parse_date_value_returns_dates_and_range_flag(
    value: date | list[date],
    expected_dates: list[date],
    expected_is_range: bool,
) -> None:
    """Single dates are wrapped in a list; lists are treated as ranges."""
    assert _parse_date_value(value) == (expected_dates, expected_is_range)
