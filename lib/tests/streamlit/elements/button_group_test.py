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

import streamlit as st

from tests.delta_generator_test_case import DeltaGeneratorTestCase


class ButtonGroupTest(DeltaGeneratorTestCase):
    """Test ability to marshall button_group protos."""

    def test_feedback(self):
        st.feedback("thumbs")

        delta = self.get_delta_from_queue().new_element.button_group
        self.assertEqual(delta.options, [0, 1])
        self.assertEqual(delta.default, [])
        self.assertEqual(delta.click_mode, 0)
        self.assertEqual(delta.disabled, False)
        self.assertEqual(delta.form_id, "")
        self.assertEqual(delta.selection_visualization, 0)

    def test_default_return_value(self):
        sentiment = st.feedback("thumbs")
        self.assertIsNone(sentiment)

    def test_feedback_disabled(self):
        st.feedback("thumbs", disabled=True)

        delta = self.get_delta_from_queue().new_element.button_group
        self.assertEqual(delta.disabled, True)
