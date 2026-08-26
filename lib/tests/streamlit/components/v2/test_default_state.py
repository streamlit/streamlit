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

"""Integration tests for the `default` parameter in Components V2."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from streamlit.components.v2 import component
from streamlit.components.v2.component_manager import BidiComponentManager
from streamlit.errors import StreamlitAPIException
from streamlit.runtime import Runtime
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class DefaultStateIntegrationTest(DeltaGeneratorTestCase):
    """Integration tests for `default` using the public component API."""

    def setUp(self) -> None:
        """Set up a fresh component manager patched into the Runtime singleton."""
        super().setUp()
        self.mock_component_manager = BidiComponentManager()
        self.runtime_patcher = patch.object(
            Runtime, "instance", return_value=MagicMock()
        )
        self.mock_runtime = self.runtime_patcher.start()
        self.mock_runtime.return_value.bidi_component_registry = (
            self.mock_component_manager
        )

    def tearDown(self) -> None:
        """Tear down the runtime patcher."""
        super().tearDown()
        self.runtime_patcher.stop()

    def test_component_with_default_basic(self) -> None:
        """Test basic `default` functionality with the public API."""
        # Declare a component
        my_component = component(
            "test_component",
            js="console.log('test');",
        )

        # Create mock callbacks
        on_value_change = MagicMock()
        on_enabled_change = MagicMock()

        # Use the component with default
        result = my_component(
            default={
                "value": 42,
                "enabled": False,
            },
            on_value_change=on_value_change,
            on_enabled_change=on_enabled_change,
        )

        # Verify defaults are applied
        assert result["value"] == 42
        assert result["enabled"] is False

    def test_component_default_validation(self) -> None:
        """Test that `default` key validation works with the public API."""
        # Declare a component
        my_component = component(
            "validation_test_component",
            js="console.log('validation test');",
        )

        # Create callback for only one state
        on_valid_change = MagicMock()

        # Try to use invalid default
        with pytest.raises(StreamlitAPIException) as exc_info:
            my_component(
                default={
                    "valid": "this is ok",
                    "invalid": "this should fail",
                },
                on_valid_change=on_valid_change,
            )

        # Verify the error message
        error_message = str(exc_info.value)
        assert "invalid" in error_message
        assert "not a valid state name" in error_message

    def test_component_default_with_data(self) -> None:
        """Test that `default` works correctly with the `data` parameter."""
        # Declare a component
        my_component = component(
            "data_and_defaults_component",
            js="console.log('data and defaults');",
        )

        # Create callbacks
        on_selection_change = MagicMock()
        on_mode_change = MagicMock()

        # Use both data and default
        result = my_component(
            data={"items": ["a", "b", "c"]},
            default={
                "selection": [],
                "mode": "single",
            },
            on_selection_change=on_selection_change,
            on_mode_change=on_mode_change,
        )

        # Verify defaults are applied
        assert result["selection"] == []
        assert result["mode"] == "single"

        # Verify the proto contains both data and component setup
        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name.endswith(
            "data_and_defaults_component"
        )

    def test_component_default_complex_types(self) -> None:
        """Test `default` with complex data types like lists and dicts."""
        # Declare a component
        my_component = component(
            "complex_types_component",
            js="console.log('complex types');",
        )

        # Create callbacks
        on_items_change = MagicMock()
        on_config_change = MagicMock()

        # Complex default values
        default_items = [{"id": 1, "name": "Item 1"}, {"id": 2, "name": "Item 2"}]
        default_config = {
            "theme": "dark",
            "settings": {"auto_save": True, "timeout": 30},
        }

        # Use the component
        result = my_component(
            default={
                "items": default_items,
                "config": default_config,
            },
            on_items_change=on_items_change,
            on_config_change=on_config_change,
        )

        # Verify complex defaults are preserved
        assert result["items"] == default_items
        assert result["config"] == default_config
        assert result["config"]["settings"]["auto_save"] is True

    def test_component_default_none_values(self) -> None:
        """Test `default` with None values using the public API."""
        # Declare a component
        my_component = component(
            "none_values_component",
            js="console.log('none values');",
        )

        # Create callback
        on_nullable_change = MagicMock()

        # Use None as default value
        result = my_component(
            default={"nullable": None},
            on_nullable_change=on_nullable_change,
        )

        # Verify None is properly handled
        assert result["nullable"] is None
