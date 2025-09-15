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

"""dropdown_button unit test."""

from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class DropdownButtonTest(DeltaGeneratorTestCase):
    """Test ability to marshall dropdown button protos."""

    def test_basic_dropdown_button(self):
        """Test that basic dropdown button can be created."""
        st.dropdown_button(label="Actions", options=["Save", "Load", "Delete"])

        c = self.get_delta_from_queue().new_element.dropdown_button
        assert c.label == "Actions"
        assert list(c.options) == ["Save", "Load", "Delete"]
        assert c.type == "secondary"  # default type
        assert c.placeholder == "Select an option"  # default placeholder
        assert not c.disabled
        assert not c.use_container_width
        assert c.icon == ""
        assert c.help == ""

    def test_dropdown_button_with_all_parameters(self):
        """Test dropdown button with all parameters set."""
        st.dropdown_button(
            label="Settings",
            options=["Profile", "Preferences", "Logout"],
            type="primary",
            icon="⚙️",
            disabled=True,
            use_container_width=True,
            placeholder="Choose setting",
            help="Select a setting option",
            key="settings_dropdown",
        )

        c = self.get_delta_from_queue().new_element.dropdown_button
        assert c.label == "Settings"
        assert list(c.options) == ["Profile", "Preferences", "Logout"]
        assert c.type == "primary"
        assert c.icon == "⚙️"
        assert c.disabled
        assert c.use_container_width
        assert c.placeholder == "Choose setting"
        assert c.help == "Select a setting option"

    @parameterized.expand(["primary", "secondary", "tertiary"])
    def test_dropdown_button_types(self, button_type):
        """Test that dropdown button accepts all valid types."""
        st.dropdown_button(
            label="Test Button", options=["Option 1", "Option 2"], type=button_type
        )

        c = self.get_delta_from_queue().new_element.dropdown_button
        assert c.type == button_type

    def test_invalid_button_type_raises_exception(self):
        """Test that invalid button type raises StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException) as exc_info:
            st.dropdown_button(
                label="Test Button",
                options=["Option 1", "Option 2"],
                type="invalid_type",
            )

        assert (
            'The type argument to st.button must be "primary", "secondary", or "tertiary"'
            in str(exc_info.value)
        )

    def test_dropdown_button_with_emoji_icon(self):
        """Test dropdown button with emoji icon."""
        st.dropdown_button(label="Actions", options=["Save", "Load"], icon="💾")

        c = self.get_delta_from_queue().new_element.dropdown_button
        assert c.icon == "💾"

    def test_dropdown_button_with_material_icon(self):
        """Test dropdown button with material icon."""
        st.dropdown_button(
            label="Actions", options=["Save", "Load"], icon=":material/save:"
        )

        c = self.get_delta_from_queue().new_element.dropdown_button
        assert c.icon == ":material/save:"

    def test_dropdown_button_with_empty_options_list(self):
        """Test dropdown button with empty options list."""
        st.dropdown_button(label="Empty Actions", options=[])

        c = self.get_delta_from_queue().new_element.dropdown_button
        assert c.label == "Empty Actions"
        assert list(c.options) == []

    def test_dropdown_button_disabled(self):
        """Test that dropdown button can be disabled."""
        st.dropdown_button(
            label="Disabled Button", options=["Option 1", "Option 2"], disabled=True
        )

        c = self.get_delta_from_queue().new_element.dropdown_button
        assert c.disabled

    def test_dropdown_button_use_container_width(self):
        """Test that dropdown button can use container width."""
        st.dropdown_button(
            label="Full Width Button",
            options=["Option 1", "Option 2"],
            use_container_width=True,
        )

        c = self.get_delta_from_queue().new_element.dropdown_button
        assert c.use_container_width

    def test_dropdown_button_with_help_text(self):
        """Test dropdown button with help text."""
        help_text = "This is a helpful tooltip\nwith multiple lines"
        st.dropdown_button(
            label="Help Button", options=["Option 1", "Option 2"], help=help_text
        )

        c = self.get_delta_from_queue().new_element.dropdown_button
        # Help text should be dedented
        assert c.help == help_text

    def test_dropdown_button_with_key(self):
        """Test dropdown button with user-provided key."""
        st.dropdown_button(
            label="Keyed Button",
            options=["Option 1", "Option 2"],
            key="my_dropdown_key",
        )

        c = self.get_delta_from_queue().new_element.dropdown_button
        # Element should have an ID that includes the key
        assert c.id != ""

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_dropdown_button_inside_form_raises_exception(self):
        """Test that dropdown button inside form raises StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException) as exc_info:
            with st.form("test_form"):
                st.dropdown_button(
                    label="Form Button", options=["Option 1", "Option 2"]
                )

        assert "`st.dropdown_button()` can't be used in an `st.form()`" in str(
            exc_info.value
        )

    def test_dropdown_button_callback_registration(self):
        """Test that dropdown button callback is properly registered."""

        def on_change():
            st.session_state.clicked = True

        st.dropdown_button(
            label="Callback Button",
            options=["Option 1", "Option 2"],
            on_click=on_change,
            key="callback_dropdown",
        )

        # The widget should be registered
        c = self.get_delta_from_queue().new_element.dropdown_button
        assert c.id != ""

    def test_dropdown_button_serde_serialize(self):
        """Test dropdown button serialization."""
        from streamlit.elements.widgets.dropdown_button import DropdownButtonSerde

        serde = DropdownButtonSerde()

        # Test serialization of string value
        assert serde.serialize("test_value") == "test_value"
        assert serde.serialize(None) == ""

    def test_dropdown_button_serde_deserialize(self):
        """Test dropdown button deserialization."""
        from streamlit.elements.widgets.dropdown_button import DropdownButtonSerde

        serde = DropdownButtonSerde()

        # Test deserialization of UI values
        assert serde.deserialize("test_value") == "test_value"
        assert serde.deserialize("") is None
        assert serde.deserialize(None) is None

    def test_dropdown_button_returns_none_initially(self):
        """Test that dropdown button returns None when no value is set."""
        result = st.dropdown_button(
            label="Test Button", options=["Option 1", "Option 2"], key="test_dropdown"
        )

        # Should return None initially (no selection made)
        assert result is None

    def test_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.dropdown_button("the label", ["option1", "option2"]))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"

    def test_dropdown_button_with_duplicate_options(self):
        """Test dropdown button with duplicate options."""
        st.dropdown_button(
            label="Duplicate Options",
            options=["Option 1", "Option 1", "Option 2", "Option 2"],
        )

        c = self.get_delta_from_queue().new_element.dropdown_button
        assert list(c.options) == ["Option 1", "Option 1", "Option 2", "Option 2"]

    def test_dropdown_button_placeholder_variations(self):
        """Test different placeholder values."""
        # Test custom placeholder
        st.dropdown_button(
            label="Custom Placeholder",
            options=["Option 1", "Option 2"],
            placeholder="Pick one",
        )

        c = self.get_delta_from_queue().new_element.dropdown_button
        assert c.placeholder == "Pick one"

        # Test None placeholder (should use default)
        st.dropdown_button(
            label="Default Placeholder",
            options=["Option 1", "Option 2"],
            placeholder=None,
        )

        c = self.get_delta_from_queue().new_element.dropdown_button
        assert c.placeholder == "Select an option"  # default
