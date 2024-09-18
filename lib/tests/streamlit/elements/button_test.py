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

"""button unit test."""

import streamlit as st
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class ButtonTest(DeltaGeneratorTestCase):
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

    def test_emoji_icon(self):
        """Test that it can be called with emoji icon."""
        st.button("the label", icon="⚡")

        c = self.get_delta_from_queue().new_element.button
        self.assertEqual(c.icon, "⚡")

    def test_material_icon(self):
        """Test that it can be called with material icon."""
        st.button("the label", icon=":material/thumb_up:")

        c = self.get_delta_from_queue().new_element.button
        self.assertEqual(c.icon, ":material/thumb_up:")

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.button("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.button
        self.assertEqual(c.disabled, True)

    def test_use_container_width_can_be_set_to_true(self):
        """Test use_container_width can be set to true."""
        st.button("the label", use_container_width=True)

        c = self.get_delta_from_queue().new_element.button
        self.assertEqual(c.use_container_width, True)

    def test_use_container_width_is_false_by_default(self):
        """Test use_container_width is false by default."""
        st.button("the label")

        c = self.get_delta_from_queue().new_element.button
        self.assertEqual(c.use_container_width, False)

    def test_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.button("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        self.assertEqual(el.type, "CachedWidgetWarning")
        self.assertTrue(el.is_warning)
