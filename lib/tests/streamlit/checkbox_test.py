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

"""checkbox unit tests."""

from parameterized import parameterized

from tests import testutil
import streamlit as st


class SomeObj(object):
    pass


class CheckboxTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall checkbox protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.checkbox("the label")

        c = self.get_delta_from_queue().new_element.checkbox
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, False)

    @parameterized.expand(
        [
            ("some str", True),
            (123, True),
            (0, False),
            (None, False),
            ({}, False),
            (SomeObj(), True),
        ]
    )
    def test_value_types(self, arg_value, proto_value):
        """Test that it supports different types of values."""
        st.checkbox("the label", arg_value)

        c = self.get_delta_from_queue().new_element.checkbox
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, proto_value)
