# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
from parameterized import parameterized

import streamlit as st
from streamlit.elements.multiselect import (
    _get_default_count,
    _get_over_max_options_message,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from tests import testutil


class Multiselectbox(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall multiselect protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.multiselect("the label", ("m", "f"))

        c = self.get_delta_from_queue().new_element.multiselect
        self.assertEqual(c.label, "the label")
        self.assertEqual(
            c.label_visibility.value,
            LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE,
        )
        self.assertListEqual(c.default[:], [])
        self.assertEqual(c.disabled, False)

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.multiselect("the label", ("m", "f"), disabled=True)

        c = self.get_delta_from_queue().new_element.multiselect
        self.assertEqual(c.disabled, True)

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
        st.multiselect("the label", options)

        c = self.get_delta_from_queue().new_element.multiselect
        self.assertEqual(c.label, "the label")
        self.assertListEqual(c.default[:], [])
        self.assertEqual(c.options, proto_options)

    def test_cast_options_to_string(self):
        """Test that it casts options to string."""
        arg_options = ["some str", 123, None, {}]
        proto_options = ["some str", "123", "None", "{}"]

        st.multiselect("the label", arg_options, default=None)

        c = self.get_delta_from_queue().new_element.multiselect
        self.assertEqual(c.label, "the label")
        self.assertListEqual(c.default[:], [2])
        self.assertEqual(c.options, proto_options)

    def test_default_string(self):
        """Test if works when the default value is not a list."""
        arg_options = ["some str", 123, None, {}]
        proto_options = ["some str", "123", "None", "{}"]

        st.multiselect("the label", arg_options, default={})

        c = self.get_delta_from_queue().new_element.multiselect
        self.assertEqual(c.label, "the label")
        self.assertListEqual(c.default[:], [3])
        self.assertEqual(c.options, proto_options)

    def test_format_function(self):
        """Test that it formats options."""
        arg_options = [{"name": "john", "height": 180}, {"name": "lisa", "height": 200}]
        proto_options = ["john", "lisa"]

        st.multiselect("the label", arg_options, format_func=lambda x: x["name"])

        c = self.get_delta_from_queue().new_element.multiselect
        self.assertEqual(c.label, "the label")
        self.assertListEqual(c.default[:], [])
        self.assertEqual(c.options, proto_options)

    @parameterized.expand([((),), ([],), (np.array([]),), (pd.Series(np.array([])),)])
    def test_no_options(self, options):
        """Test that it handles no options."""
        st.multiselect("the label", options)

        c = self.get_delta_from_queue().new_element.multiselect
        self.assertEqual(c.label, "the label")
        self.assertListEqual(c.default[:], [])
        self.assertEqual(c.options, [])

    @parameterized.expand([(15, TypeError), ("str", TypeError)])
    def test_invalid_options(self, options, expected):
        """Test that it handles invalid options."""
        with self.assertRaises(expected):
            st.multiselect("the label", options)

    @parameterized.expand([(None, []), ([], []), (["Tea", "Water"], [1, 2])])
    def test_defaults(self, defaults, expected):
        """Test that valid default can be passed as expected."""
        st.multiselect("the label", ["Coffee", "Tea", "Water"], defaults)

        c = self.get_delta_from_queue().new_element.multiselect
        self.assertEqual(c.label, "the label")
        self.assertListEqual(c.default[:], expected)
        self.assertEqual(c.options, ["Coffee", "Tea", "Water"])

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
        self.assertEqual(c.label, "the label")
        self.assertListEqual(c.default[:], expected)
        self.assertEqual(c.options, ["Coffee", "Tea", "Water"])

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
        self.assertEqual(c.label, "label")
        self.assertListEqual(c.default[:], expected_default)
        self.assertEqual(c.options, expected_options)

    @parameterized.expand(
        [
            (["Tea", "Vodka", None], StreamlitAPIException),
            ([1, 2], StreamlitAPIException),
        ]
    )
    def test_invalid_defaults(self, defaults, expected):
        """Test that invalid default trigger the expected exception."""
        with self.assertRaises(expected):
            st.multiselect("the label", ["Coffee", "Tea", "Water"], defaults)

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        st.multiselect("foo", ["bar", "baz"])

        proto = self.get_delta_from_queue().new_element.multiselect
        self.assertEqual(proto.form_id, "")

    @patch("streamlit.runtime.is_running", new=MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st.multiselect("foo", ["bar", "baz"])

        # 2 elements will be created: form block, widget
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        form_proto = self.get_delta_from_queue(0).add_block
        multiselect_proto = self.get_delta_from_queue(1).new_element.multiselect
        self.assertEqual(multiselect_proto.form_id, form_proto.form.form_id)

    def test_inside_column(self):
        """Test that it works correctly inside of a column."""

        col1, col2 = st.columns(2)

        with col1:
            st.multiselect("foo", ["bar", "baz"])

        all_deltas = self.get_all_deltas_from_queue()

        # 4 elements will be created: 1 horizontal block, 2 columns, 1 widget
        self.assertEqual(len(all_deltas), 4)
        multiselect_proto = self.get_delta_from_queue().new_element.multiselect

        self.assertEqual(multiselect_proto.label, "foo")
        self.assertEqual(multiselect_proto.options, ["bar", "baz"])
        self.assertEqual(multiselect_proto.default, [])

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
        self.assertEqual(c.label_visibility.value, proto_value)

    def test_label_visibility_wrong_value(self):
        with self.assertRaises(StreamlitAPIException) as e:
            st.multiselect("the label", ("m", "f"), label_visibility="wrong_value")
            self.assertEquals(
                str(e),
                "Unsupported label_visibility option 'wrong_value'. Valid values are "
                "'visible', 'hidden' or 'collapsed'.",
            )

    def test_max_selections(self):
        st.multiselect("the label", ("m", "f"), max_selections=2)

        c = self.get_delta_from_queue().new_element.multiselect
        self.assertEqual(c.max_selections, 2)

    def test_over_max_selections_initialization(self):
        with self.assertRaises(StreamlitAPIException) as e:
            st.multiselect(
                "the label", ["a", "b", "c", "d"], ["a", "b", "c"], max_selections=2
            )
        self.assertEqual(
            str(e.exception),
            """
Multiselect has 3 options selected but `max_selections`
is set to 2. This happened because you either gave too many options to `default`
or you manipulated the widget's state through `st.session_state`. Note that
the latter can happen before the line indicated in the traceback.
Please select at most 2 options.
""",
        )

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
        self.assertEqual(_get_default_count(default), expected_count)

    @parameterized.expand(
        [
            (
                1,
                1,
                f"""
Multiselect has 1 option selected but `max_selections`
is set to 1. This happened because you either gave too many options to `default`
or you manipulated the widget's state through `st.session_state`. Note that
the latter can happen before the line indicated in the traceback.
Please select at most 1 option.
""",
            ),
            (
                1,
                0,
                f"""
Multiselect has 1 option selected but `max_selections`
is set to 0. This happened because you either gave too many options to `default`
or you manipulated the widget's state through `st.session_state`. Note that
the latter can happen before the line indicated in the traceback.
Please select at most 0 options.
""",
            ),
            (
                2,
                1,
                f"""
Multiselect has 2 options selected but `max_selections`
is set to 1. This happened because you either gave too many options to `default`
or you manipulated the widget's state through `st.session_state`. Note that
the latter can happen before the line indicated in the traceback.
Please select at most 1 option.
""",
            ),
            (
                3,
                2,
                f"""
Multiselect has 3 options selected but `max_selections`
is set to 2. This happened because you either gave too many options to `default`
or you manipulated the widget's state through `st.session_state`. Note that
the latter can happen before the line indicated in the traceback.
Please select at most 2 options.
""",
            ),
        ]
    )
    def test_get_over_max_options_message(
        self, current_selections, max_selections, expected_msg
    ):
        self.assertEqual(
            _get_over_max_options_message(current_selections, max_selections),
            expected_msg,
        )
