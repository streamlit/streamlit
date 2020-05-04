# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""multiselect unit tests."""

import numpy as np
import pandas as pd
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests import testutil


class Multiselectbox(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall multiselect protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.multiselect("the label", ("m", "f"))

        c = self.get_delta_from_queue().new_element.multiselect
        self.assertEqual(c.label, "the label")
        self.assertListEqual(c.default[:], [])

    @parameterized.expand(
        [
            (("m", "f"), ["m", "f"]),
            (["male", "female"], ["male", "female"]),
            (np.array(["m", "f"]), ["m", "f"]),
            (pd.Series(np.array(["male", "female"])), ["male", "female"]),
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
            (["Tea", "Vodka", None], StreamlitAPIException),
            ([1, 2], StreamlitAPIException),
        ]
    )
    def test_invalid_defaults(self, defaults, expected):
        """Test that invalid default trigger the expected exception."""
        with self.assertRaises(expected):
            st.multiselect("the label", ["Coffee", "Tea", "Water"], defaults)
