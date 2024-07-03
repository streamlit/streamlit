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

"""button_group unit test."""

from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.widgets.button_group import (
    _FACES_ICONS,
    _SELECTED_STAR_ICON,
    _STAR_ICON,
    _THUMB_ICONS,
    FeedbackSerde,
    get_mapped_options,
)
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class TestGetMappedOptions:
    def test_thumbs(self):
        options, options_indices = get_mapped_options("thumbs")

        assert len(options) == 2
        assert len(options_indices) == 2

        for index, option in enumerate(options):
            assert option.content == _THUMB_ICONS[index]

        # ensure order of thumbs
        assert "down" in options[1].content
        assert options_indices[0] == 1
        assert "up" in options[0].content
        assert options_indices[1] == 0

    def test_faces(self):
        options, options_indices = get_mapped_options("faces")

        assert len(options) == 5
        assert len(options_indices) == 5

        for index, option in enumerate(options):
            assert option.content == _FACES_ICONS[index]
            assert option.selected_content == ""
            assert options_indices[index] == index

        # ensure order of faces
        assert "sad" in options[0].content
        assert "very_satisfied" in options[4].content

    def test_stars(self):
        options, options_indices = get_mapped_options("stars")

        assert len(options) == 5
        assert len(options_indices) == 5

        for index, option in enumerate(options):
            assert option.content == _STAR_ICON
            assert option.selected_content == _SELECTED_STAR_ICON
            assert options_indices[index] == index
            assert option.disable_selection_highlight


class TestFeedbackSerde:
    def test_serialize(self):
        option_indices = [5, 6, 7]
        serde = FeedbackSerde(option_indices)
        res = serde.serialize(6)
        assert res == [1]

    def test_serialize_raise_option_does_not_exist(self):
        option_indices = [5, 6, 7]
        serde = FeedbackSerde(option_indices)

        with pytest.raises(StreamlitAPIException):
            serde.serialize(8)

    def test_deserialize(self):
        option_indices = [5, 6, 7]
        serde = FeedbackSerde(option_indices)
        res = serde.deserialize([1], "")
        assert res == 6

    def test_deserialize_raise_indexerror(self):
        option_indices = [5, 6, 7]
        serde = FeedbackSerde(option_indices)

        with pytest.raises(IndexError):
            serde.deserialize([3], "")


class ButtonGroupFeedbackTest(DeltaGeneratorTestCase):
    """Test ability to marshall button_group protos."""

    def test_feedback(self):
        st.feedback("thumbs")

        delta = self.get_delta_from_queue().new_element.button_group
        correct_thumbs_order = [":material/thumb_up:", ":material/thumb_down:"]
        self.assertEqual(
            [option.content for option in delta.options],
            correct_thumbs_order,
        )
        self.assertEqual(delta.default, [])
        self.assertEqual(delta.click_mode, 0)
        self.assertFalse(delta.disabled)
        self.assertEqual(delta.form_id, "")
        self.assertEqual(delta.selection_visualization, 0)

    def test_default_return_value(self):
        sentiment = st.feedback("thumbs")
        self.assertIsNone(sentiment)

    def test_feedback_disabled(self):
        st.feedback("thumbs", disabled=True)

        delta = self.get_delta_from_queue().new_element.button_group
        self.assertTrue(delta.disabled)


# TODO: These tests are very similar to the ones in multiselect_test.py -> refactor to re-use them
class TestButtonGroup(DeltaGeneratorTestCase):
    @parameterized.expand(
        [
            (("m", "f"), ["m", "f"]),
            (["male", "female"], ["male", "female"]),
            (np.array(["m", "f"]), ["m", "f"]),
            (pd.Series(np.array(["male", "female"])), ["male", "female"]),
            (pd.DataFrame({"options": ["male", "female"]}), ["male", "female"]),
            (
                pd.DataFrame(
                    data=[[1, 4, 7], [2, 5, 8], [3, 6, 9]], columns=["a", "b", "c"]
                ).columns,
                ["a", "b", "c"],
            ),
        ]
    )
    def test_option_types(self, options, proto_options):
        """Test that it supports different types of options."""
        st._internal_button_group(options)

        c = self.get_delta_from_queue().new_element.button_group
        self.assertListEqual(c.default[:], [])
        self.assertEqual(
            [option.content for option in c.options],
            proto_options,
        )

    def test_default_string(self):
        """Test if works when the default value is not a list."""
        arg_options = ["some str", 123, None, {}]
        proto_options = ["some str", "123", "None", "{}"]

        st._internal_button_group(
            arg_options,
            default={},
        )

        c = self.get_delta_from_queue().new_element.button_group
        self.assertListEqual(c.default[:], [3])
        self.assertEqual(
            [option.content for option in c.options],
            proto_options,
        )

    @parameterized.expand(
        [
            ((),),
            ([],),
            (np.array([]),),
            (pd.Series(np.array([])),),
            (set(),),
        ]
    )
    def test_no_options(self, options):
        """Test that it handles no options."""
        st._internal_button_group(options)

        c = self.get_delta_from_queue().new_element.button_group
        self.assertListEqual(c.default[:], [])
        self.assertEqual([option.content for option in c.options], [])

    @parameterized.expand([(15, TypeError), ("str", TypeError)])
    def test_invalid_options(self, options, expected):
        """Test that it handles invalid options."""
        with self.assertRaises(expected):
            st._internal_button_group(options)

    @parameterized.expand([(None, []), ([], []), (["Tea", "Water"], [1, 2])])
    def test_defaults(self, defaults, expected):
        """Test that valid default can be passed as expected."""
        st._internal_button_group(["Coffee", "Tea", "Water"], default=defaults)
        c = self.get_delta_from_queue().new_element.button_group
        self.assertListEqual(c.default[:], expected)
        self.assertEqual(
            [option.content for option in c.options],
            ["Coffee", "Tea", "Water"],
        )

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
        st._internal_button_group(["Coffee", "Tea", "Water"], default=defaults)

        c = self.get_delta_from_queue().new_element.button_group
        self.assertListEqual(c.default[:], expected)
        self.assertEqual(
            [option.content for option in c.options],
            ["Coffee", "Tea", "Water"],
        )

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
        st._internal_button_group(options, default=defaults)
        c = self.get_delta_from_queue().new_element.button_group
        self.assertListEqual(c.default[:], expected_default)
        self.assertEqual(
            [option.content for option in c.options],
            expected_options,
        )

    @parameterized.expand(
        [
            (["Tea", "Vodka", None], StreamlitAPIException),
            ([1, 2], StreamlitAPIException),
        ]
    )
    def test_invalid_defaults(self, defaults, expected):
        """Test that invalid default trigger the expected exception."""
        with self.assertRaises(expected):
            st._internal_button_group(["Coffee", "Tea", "Water"], default=defaults)

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""
        st._internal_button_group(["bar", "baz"])

        proto = self.get_delta_from_queue().new_element.button_group
        self.assertEqual(proto.form_id, "")

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st._internal_button_group(["bar", "baz"])
        # 2 elements will be created: form block, widget
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        form_proto = self.get_delta_from_queue(0).add_block
        proto = self.get_delta_from_queue(1).new_element.button_group
        self.assertEqual(proto.form_id, form_proto.form.form_id)

    def test_inside_column(self):
        """Test that it works correctly inside of a column."""

        col1, col2 = st.columns(2)

        with col1:
            st._internal_button_group(["bar", "baz"])
        all_deltas = self.get_all_deltas_from_queue()

        # 4 elements will be created: 1 horizontal block, 2 columns, 1 widget
        self.assertEqual(len(all_deltas), 4)
        proto = self.get_delta_from_queue().new_element.button_group

        self.assertEqual(proto.default, [])
        self.assertEqual([option.content for option in proto.options], ["bar", "baz"])
