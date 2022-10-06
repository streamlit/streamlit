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

"""button unit test."""

import streamlit as st
from tests import testutil


class ButtonTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall button protos."""

    def test_button(self):
        """Test that it can be called."""
        st.button("the label")

        c = self.get_delta_from_queue().new_element.button
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, False)
        self.assertEqual(c.form_id, "")
        self.assertEqual(c.type, "secondary")
        self.assertEqual(c.is_form_submitter, False)
        self.assertEqual(c.disabled, False)

    def test_type(self):
        """Test that it can be called with type param."""
        st.button("the label", type="primary")

        c = self.get_delta_from_queue().new_element.button
        self.assertEqual(c.type, "primary")

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.button("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.button
        self.assertEqual(c.disabled, True)
