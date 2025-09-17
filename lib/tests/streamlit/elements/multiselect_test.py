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

"""multiselect unit tests."""

from typing import Any
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.lib.options_selector_utils import create_mappings
from streamlit.elements.widgets.multiselect import (
    MultiSelectSerde,
    _get_default_count,
)
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitInvalidWidthError,
    StreamlitSelectionCountExceedsMaxError,
)
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.testing.v1.app_test import AppTest
from streamlit.testing.v1.util import patch_config_options
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.data_test_cases import (
    SHARED_TEST_CASES,
    CaseMetadata,
)
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class Multiselectbox(DeltaGeneratorTestCase):
    """Test ability to marshall multiselect protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.multiselect("the label", ("m", "f"))

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.label == "the label"
        assert (
            c.label_visibility.value
            == LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE
        )
        assert c.default[:] == []
        assert not c.disabled
        assert not c.accept_new_options

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.multiselect("the label", ("m", "f"), disabled=True)

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.disabled

    @parameterized.expand(
        SHARED_TEST_CASES,
    )
    def test_option_types(self, name: str, input_data: Any, metadata: CaseMetadata):
        """Test that it supports different types of options."""
        st.multiselect("the label", input_data)

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.label == "the label"
        assert c.default[:] == []
        assert {str(item) for item in c.options} == {
            str(item) for item in metadata.expected_sequence
        }

    def test_cast_options_to_string(self):
        """Test that it casts options to string."""
        arg_options = ["some str", 123, None, {}]
        proto_options = ["some str", "123", "None", "{}"]

        st.multiselect("the label", arg_options, default=None)

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.label == "the label"
        assert c.default[:] == []
        assert c.options == proto_options

    def test_default_string(self):
        """Test if works when the default value is not a list."""
        arg_options = ["some str", 123, None, {}]
        proto_options = ["some str", "123", "None", "{}"]

        st.multiselect("the label", arg_options, default=123)

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.label == "the label"
        assert c.default[:] == [1]
        assert c.options == proto_options

    def test_format_function(self):
        """Test that it formats options."""
        arg_options = [{"name": "john", "height": 180}, {"name": "lisa", "height": 200}]
        proto_options = ["john", "lisa"]

        st.multiselect("the label", arg_options, format_func=lambda x: x["name"])

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.label == "the label"
        assert c.default[:] == []
        assert c.options == proto_options

    @parameterized.expand(
        [
            ((),),
            ([],),
            (np.array([]),),
            (pd.Series(np.array([])),),
            (set(),),
            ([],),
        ]
    )
    def test_no_options(self, options):
        """Test that it handles no options."""
        st.multiselect("the label", options, default=options)

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.label == "the label"
        assert c.default[:] == []
        assert c.options == []

    @parameterized.expand([(None, []), ([], []), (["Tea", "Water"], [1, 2])])
    def test_defaults(self, defaults, expected):
        """Test that valid default can be passed as expected."""
        st.multiselect("the label", ["Coffee", "Tea", "Water"], defaults)

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.label == "the label"
        assert c.default[:] == expected
        assert c.options == ["Coffee", "Tea", "Water"]
        # Default placeholders are now handled on the frontend side
        # Backend only passes through custom user-provided placeholders

    @parameterized.expand(
        [
            (("Tea", "Water"), [1, 2]),
            ((i for i in ("Tea", "Water")), [1, 2]),
            (np.array(["Coffee", "Tea"]), [0, 1]),
            (pd.Series(np.array(["Coffee", "Tea"])), [0, 1]),
            ("Coffee", [0]),
        ]
    )
    def test_default_types(self, defaults, expected):
        """Test that iterables other than lists can be passed as defaults."""
        st.multiselect("the label", ["Coffee", "Tea", "Water"], defaults)

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.label == "the label"
        assert c.default[:] == expected
        assert c.options == ["Coffee", "Tea", "Water"]

    @parameterized.expand(
        [
            (
                pd.Series(np.array(["green", "blue", "red", "yellow", "brown"])),
                ["yellow"],
                ["green", "blue", "red", "yellow", "brown"],
                [3],
            ),
            (
                np.array(["green", "blue", "red", "yellow", "brown"]),
                ["green", "red"],
                ["green", "blue", "red", "yellow", "brown"],
                [0, 2],
            ),
            (
                ("green", "blue", "red", "yellow", "brown"),
                ["blue"],
                ["green", "blue", "red", "yellow", "brown"],
                [1],
            ),
            (
                ["green", "blue", "red", "yellow", "brown"],
                ["brown"],
                ["green", "blue", "red", "yellow", "brown"],
                [4],
            ),
            (
                pd.DataFrame({"col1": ["male", "female"], "col2": ["15", "10"]}),
                ["male", "female"],
                ["male", "female"],
                [0, 1],
            ),
        ]
    )
    def test_options_with_default_types(
        self, options, defaults, expected_options, expected_default
    ):
        st.multiselect("label", options, defaults)

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.label == "label"
        assert c.default[:] == expected_default
        assert c.options == expected_options

    def test_accept_new_options(self):
        """Test that it can accept new options."""
        st.multiselect("the label", ("m", "f"), accept_new_options=True)

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.accept_new_options
        # Placeholder logic is now handled on the frontend side
        # Backend only passes through custom user-provided placeholders

    @parameterized.expand(
        [
            (["Tea", "Vodka", None], StreamlitAPIException),
            ([1, 2], StreamlitAPIException),
        ]
    )
    def test_invalid_defaults(self, defaults, expected):
        """Test that invalid default trigger the expected exception."""
        with pytest.raises(expected):
            st.multiselect("the label", ["Coffee", "Tea", "Water"], defaults)

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        st.multiselect("foo", ["bar", "baz"])

        proto = self.get_delta_from_queue().new_element.multiselect
        assert proto.form_id == ""

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st.multiselect("foo", ["bar", "baz"])

        # 2 elements will be created: form block, widget
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        multiselect_proto = self.get_delta_from_queue(1).new_element.multiselect
        assert multiselect_proto.form_id == form_proto.form.form_id

    def test_inside_column(self):
        """Test that it works correctly inside of a column."""

        col1, _col2 = st.columns(2)

        with col1:
            st.multiselect("foo", ["bar", "baz"])

        all_deltas = self.get_all_deltas_from_queue()

        # 4 elements will be created: 1 horizontal block, 2 columns, 1 widget
        assert len(all_deltas) == 4
        multiselect_proto = self.get_delta_from_queue().new_element.multiselect

        assert multiselect_proto.label == "foo"
        assert multiselect_proto.options == ["bar", "baz"]
        assert multiselect_proto.default == []

    @parameterized.expand(
        [
            ("visible", LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility param."""
        st.multiselect("the label", ("m", "f"), label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.label_visibility.value == proto_value

    def test_label_visibility_wrong_value(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.multiselect("the label", ("m", "f"), label_visibility="wrong_value")
        assert (
            str(e.value)
            == "Unsupported label_visibility option 'wrong_value'. Valid values are 'visible', 'hidden' or 'collapsed'."
        )

    def test_max_selections(self):
        st.multiselect("the label", ("m", "f"), max_selections=2)

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.max_selections == 2

    @parameterized.expand(
        [
            (["a", "b", "c"], 3),
            (["a"], 1),
            ([], 0),
            ("a", 1),
            (None, 0),
            (("a", "b", "c"), 3),
        ]
    )
    def test_get_default_count(self, default, expected_count):
        assert _get_default_count(default) == expected_count

    def test_placeholder(self):
        """Test that it can be called with placeholder params."""
        st.multiselect(
            "the label", ["Coffee", "Tea", "Water"], placeholder="Select your beverage"
        )

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.placeholder == "Select your beverage"

    def test_empty_string_placeholder(self):
        """Test that empty string placeholder is converted to single space to allow explicit empty placeholder."""
        st.multiselect("the label", ["Coffee", "Tea", "Water"], placeholder="")

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.placeholder == " "

    def test_none_placeholder_uses_default(self):
        """Test that None placeholder gets converted to empty string for frontend to handle."""
        st.multiselect("the label", ["Coffee", "Tea", "Water"], placeholder=None)

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.placeholder == ""

    def test_none_placeholder_with_accept_new_options(self):
        """Test that None placeholder gets converted to empty string with accept_new_options."""
        st.multiselect(
            "the label",
            ["Coffee", "Tea", "Water"],
            placeholder=None,
            accept_new_options=True,
        )

        c = self.get_delta_from_queue().new_element.multiselect
        assert c.placeholder == ""

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.multiselect("the label", ["Coffee", "Tea", "Water"]))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_stable_id_with_key(self):
        """Test that the widget ID is stable when a stable key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with certain params
            st.multiselect(
                label="Label",
                default=["a"],
                key="multiselect_key",
                help="Help 1",
                disabled=False,
                width="stretch",
                on_change=lambda: None,
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
                label_visibility="visible",
                placeholder="placeholder 1",
                # Whitelisted kwargs:
                format_func=lambda x: x.capitalize(),
                options=["a", "b", "cd"],
                accept_new_options=True,
                max_selections=3,
            )
            c1 = self.get_delta_from_queue().new_element.multiselect
            id1 = c1.id

            # Second render with different non-whitelisted params but same key
            st.multiselect(
                label="Label 2",
                default=["a", "b"],
                key="multiselect_key",
                help="Help 2",
                disabled=True,
                width=200,
                on_change=lambda: None,
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
                label_visibility="hidden",
                placeholder="placeholder 2",
                # Whitelisted kwargs:
                format_func=lambda x: x.capitalize(),
                options=["a", "b", "cd"],
                accept_new_options=True,
                max_selections=3,
            )
            c2 = self.get_delta_from_queue().new_element.multiselect
            id2 = c2.id
            assert id1 == id2

    @parameterized.expand(
        [
            ("options", ["a", "b"], ["a", "b", "c"]),
            ("max_selections", 2, 3),
            ("accept_new_options", True, False),
            ("format_func", lambda x: x.lower(), lambda x: x.upper()),
        ]
    )
    def test_whitelisted_stable_key_kwargs(
        self, kwarg_name: str, value1: object, value2: object
    ):
        """Test that the widget ID changes when a whitelisted kwarg changes even when the key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            base_kwargs = {
                "label": "Label",
                "key": "multiselect_key_whitelist",
                "options": ["a", "b"],
                "default": ["a"],
                "max_selections": 2,
                "accept_new_options": True,
                "format_func": lambda x: x.lower(),
            }

            base_kwargs[kwarg_name] = value1
            st.multiselect(**base_kwargs)
            c1 = self.get_delta_from_queue().new_element.multiselect
            id1 = c1.id

            base_kwargs[kwarg_name] = value2
            st.multiselect(**base_kwargs)
            c2 = self.get_delta_from_queue().new_element.multiselect
            id2 = c2.id
            assert id1 != id2

    def test_over_max_selections_initialization(self):
        with pytest.raises(StreamlitSelectionCountExceedsMaxError):
            st.multiselect(
                "the label", ["a", "b", "c", "d"], ["a", "b", "c"], max_selections=2
            )

    @parameterized.expand(
        [
            (
                1,
                1,
                (
                    "Multiselect has 1 option selected but `max_selections` is set to 1. "
                    "This happened because you either gave too many options to `default` or "
                    "you manipulated the widget's state through `st.session_state`. "
                    "Note that the latter can happen before the line indicated in the traceback. "
                    "Please select at most 1 option."
                ),
            ),
            (
                1,
                0,
                (
                    "Multiselect has 1 option selected but `max_selections` is set to 0. "
                    "This happened because you either gave too many options to `default` or "
                    "you manipulated the widget's state through `st.session_state`. "
                    "Note that the latter can happen before the line indicated in the traceback. "
                    "Please select at most 0 options."
                ),
            ),
            (
                2,
                1,
                (
                    "Multiselect has 2 options selected but `max_selections` is set to 1. "
                    "This happened because you either gave too many options to `default` or "
                    "you manipulated the widget's state through `st.session_state`. "
                    "Note that the latter can happen before the line indicated in the traceback. "
                    "Please select at most 1 option."
                ),
            ),
            (
                3,
                2,
                (
                    "Multiselect has 3 options selected but `max_selections` is set to 2. "
                    "This happened because you either gave too many options to `default` or "
                    "you manipulated the widget's state through `st.session_state`. "
                    "Note that the latter can happen before the line indicated in the traceback. "
                    "Please select at most 2 options."
                ),
            ),
        ]
    )
    def test_get_over_max_options_message(
        self, current_selections, max_selections, expected_msg
    ):
        self.maxDiff = 1000
        error = StreamlitSelectionCountExceedsMaxError(
            current_selections_count=current_selections,
            max_selections_count=max_selections,
        )
        assert str(error) == expected_msg

    def test_width_config_default(self):
        """Test that default width is 'stretch'."""
        st.multiselect("the label", ("m", "f"))

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    def test_width_config_pixel(self):
        """Test that pixel width works properly."""
        st.multiselect("the label", ("m", "f"), width=200)

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 200

    def test_width_config_stretch(self):
        """Test that 'stretch' width works properly."""
        st.multiselect("the label", ("m", "f"), width="stretch")

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
            st.multiselect("the label", ("m", "f"), width=width)


def test_multiselect_enum_coercion():
    """Test E2E Enum Coercion on a selectbox."""

    def script():
        from enum import Enum

        import streamlit as st

        class EnumA(Enum):
            A = 1
            B = 2
            C = 3

        selected_list = st.multiselect("my_enum", EnumA, default=[EnumA.A, EnumA.C])
        st.text(id(selected_list[0].__class__))
        st.text(id(EnumA))
        st.text(all(selected in EnumA for selected in selected_list))

    at = AppTest.from_function(script).run()

    def test_enum():
        multiselect = at.multiselect[0]
        original_class = multiselect.value[0].__class__
        multiselect.set_value([original_class.A, original_class.B]).run()
        assert at.text[0].value == at.text[1].value, "Enum Class ID not the same"
        assert at.text[2].value == "True", "Not all enums found in class"

    with patch_config_options({"runner.enumCoercion": "nameOnly"}):
        test_enum()
    with (
        patch_config_options({"runner.enumCoercion": "off"}),
        pytest.raises(AssertionError),
    ):
        test_enum()  # expect a failure with the config value off.


class TestMultiSelectSerde:
    def test_serialize(self):
        options = ["Option A", "Option B", "Option C"]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = MultiSelectSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        res = serde.serialize(["A", "C"])
        assert res == ["A", "C"]

    def test_serialize_empty_list(self):
        options = ["Option A", "Option B", "Option C"]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = MultiSelectSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        res = serde.serialize([])
        assert res == []

    def test_serialize_with_format_func(self):
        options = ["Option A", "Option B", "Option C"]

        def format_func(x):
            return f"Format: {x}"

        formatted_options, formatted_option_to_option_index = create_mappings(
            options, format_func
        )
        serde = MultiSelectSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        res = serde.serialize(["A", "Option C"])
        assert res == ["A", "Format: Option C"]

    def test_deserialize(self):
        options = ["Option A", "Option B", "Option C"]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = MultiSelectSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        res = serde.deserialize(["Option A", "Option C", "B"])
        assert res == ["Option A", "Option C", "B"]

    def test_deserialize_empty_list(self):
        options = ["Option A", "Option B", "Option C"]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = MultiSelectSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        res = serde.deserialize([])
        assert res == []

    def test_deserialize_with_default_indices(self):
        options = ["Option A", "Option B", "Option C"]
        default_indices = [0, 2]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = MultiSelectSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            default_options_indices=default_indices,
        )

        res = serde.deserialize(None)
        assert res == ["Option A", "Option C"]

    def test_deserialize_complex_options(self):
        # Test with more complex option types
        complex_options = [
            {"id": 1, "name": "First"},
            {"id": 2, "name": "Second"},
            {"id": 3, "name": "Third"},
        ]

        def format_func(x):
            return x["name"]

        formatted_options, formatted_option_to_option_index = create_mappings(
            complex_options, format_func
        )
        serde = MultiSelectSerde(
            complex_options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        res = serde.deserialize(["First", "Third"])
        assert res == [complex_options[0], complex_options[2]]
