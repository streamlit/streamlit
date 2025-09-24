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

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

import streamlit as st
from streamlit import _main as st_main
from streamlit.components.v2.bidi_component.constants import EVENT_DELIM
from streamlit.components.v2.bidi_component.main import _make_trigger_id
from streamlit.components.v2.bidi_component.state import BidiComponentResult
from streamlit.components.v2.component_manager import BidiComponentManager
from streamlit.components.v2.component_registry import BidiComponentDefinition
from streamlit.errors import (
    BidiComponentInvalidCallbackNameError,
    StreamlitAPIException,
)
from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime import Runtime
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from tests.delta_generator_test_case import DeltaGeneratorTestCase


def test_event_delim_is_double_underscore():
    """Test that the EVENT_DELIM constant has the correct value."""
    assert EVENT_DELIM == "__", (
        f"EVENT_DELIM must be set to the string '__'. Found {EVENT_DELIM!r} instead."
    )


@pytest.mark.parametrize(
    ("base", "event", "expected"),
    [
        ("comp", "click", "comp__click"),
        ("component123", "change", "component123__change"),
        ("Δelta", "🚀", "Δelta__🚀"),  # Unicode should be preserved
    ],
)
def test_make_trigger_id_constructs_valid_id(base: str, event: str, expected: str):
    """Test that _make_trigger_id constructs a valid trigger ID for various inputs."""
    assert _make_trigger_id(base, event) == f"$$STREAMLIT_INTERNAL_KEY_{expected}"


def test_result_merges_state_and_trigger_values_and_exposes_dg():
    """BidiComponentResult should behave like a mapping/attribute dict and expose the dg."""

    # Arrange
    state_vals = {"foo": 123, "bar": "abc"}
    trigger_vals = {"clicked": True, "changed": {"value": 42}}

    # Act
    result = BidiComponentResult(state_vals, trigger_vals)

    # Assert mapping access
    assert result["foo"] == 123
    assert result["bar"] == "abc"
    assert result["clicked"] is True
    assert result["changed"] == {"value": 42}

    # Assert attribute access
    assert result.foo == 123
    assert result.bar == "abc"
    assert result.clicked is True
    assert result.changed == {"value": 42}


def test_make_trigger_id_is_idempotent():
    """Test that _make_trigger_id is idempotent."""
    base, event = "foo", "bar"
    first = _make_trigger_id(base, event)
    second = _make_trigger_id(base, event)
    assert first == second == "$$STREAMLIT_INTERNAL_KEY_foo__bar"


def test_make_trigger_id_rejects_delimiter_in_base_or_event():
    """Test that _make_trigger_id rejects delimiters in base or event names."""
    with pytest.raises(StreamlitAPIException):
        _make_trigger_id("bad__base", "click")

    with pytest.raises(StreamlitAPIException):
        _make_trigger_id("base", "bad__event")


class BidiComponentInvalidCallbackNameErrorTest(DeltaGeneratorTestCase):
    """Test that BidiComponentInvalidCallbackNameError is raised when invalid
    callback names are provided."""

    def setUp(self):
        super().setUp()
        registry = Runtime.instance().bidi_component_registry
        component_def = BidiComponentDefinition(
            name="my_component",
            js="console.log('hello');",
        )
        registry._components["my_component"] = component_def
        self.dg = st_main

    def test_bidi_component_disallowed_on_change_callbacks(self):
        """Test that `on_change` and `on__change` are disallowed as callbacks."""
        with pytest.raises(BidiComponentInvalidCallbackNameError):
            self.dg._bidi_component(
                "my_component",
                key="key1",
                on_change=lambda: None,
            )

        with pytest.raises(BidiComponentInvalidCallbackNameError):
            self.dg._bidi_component(
                "my_component",
                key="key2",
                on__change=lambda: None,
            )


class BidiComponentMixinTest(DeltaGeneratorTestCase):
    """Validate bi-directional component mixin behavior.

    This suite verifies:
    - Parsing of ``on_<event>_change`` kwargs into an event-to-callback mapping
    - Registration of the per-run aggregator trigger widget with
      ``value_type`` equal to ``"json_trigger_value"``
    - ``BidiComponentResult`` exposes event keys and merges persistent state
      with trigger values
    - Callbacks and widget metadata are correctly stored in ``SessionState``
      for the current run
    """

    def setUp(self):
        super().setUp()
        # Create and inject a fresh component manager for each test run
        self.component_manager = BidiComponentManager()
        runtime = Runtime.instance()
        if runtime is None:
            raise RuntimeError("Runtime.instance() returned None in test setup.")
        runtime.bidi_component_registry = self.component_manager

    # ---------------------------------------------------------------------
    # Helpers
    # ---------------------------------------------------------------------
    def _register_dummy_component(self, name: str = "dummy") -> None:
        self.component_manager.register(
            BidiComponentDefinition(name=name, js="console.log('hi');")
        )

    # ---------------------------------------------------------------------
    # Tests
    # ---------------------------------------------------------------------
    def test_event_callback_parsing_and_trigger_widget_registration(self):
        """Providing ``on_click_change`` should register a trigger widget."""

        self._register_dummy_component()

        on_click_cb = MagicMock(name="on_click_cb")
        on_hover_cb = MagicMock(name="on_hover_cb")

        # Act
        result = st._bidi_component(
            "dummy",
            on_click_change=on_click_cb,
            on_hover_change=on_hover_cb,
        )

        # ------------------------------------------------------------------
        # Assert - return type & merged keys
        # ------------------------------------------------------------------
        assert isinstance(result, BidiComponentResult)
        # No state set yet, but we expect trigger keys to exist with None
        assert "click" in result
        assert result.click is None
        assert "hover" in result
        assert result.hover is None

        # ------------------------------------------------------------------
        # Assert - trigger widget metadata
        # ------------------------------------------------------------------
        ctx = get_script_run_ctx()
        assert ctx is not None, "ScriptRunContext missing in test"

        # Compute expected aggregator trigger id
        base_id = next(
            wid
            for wid in ctx.widget_ids_this_run
            if wid.startswith("$$ID") and EVENT_DELIM not in wid
        )
        aggregator_id = _make_trigger_id(base_id, "events")

        # Access internal SessionState to retrieve widget metadata.
        internal_state = ctx.session_state._state  # SessionState instance

        metadata_aggregator = internal_state._new_widget_state.widget_metadata[
            aggregator_id
        ]

        assert metadata_aggregator.value_type == "json_trigger_value"

        # The callbacks must be wired by event name in metadata
        assert metadata_aggregator.callbacks == {
            "click": on_click_cb,
            "hover": on_hover_cb,
        }


class BidiComponentTest(DeltaGeneratorTestCase):
    """Test the bidi_component functionality."""

    def setUp(self):
        super().setUp()
        # Create a mock component manager for testing
        self.mock_component_manager = BidiComponentManager()

        # Patch the Runtime to return our mock component manager
        self.runtime_patcher = patch.object(
            Runtime, "instance", return_value=MagicMock()
        )
        self.mock_runtime = self.runtime_patcher.start()
        self.mock_runtime.return_value.bidi_component_registry = (
            self.mock_component_manager
        )

    def tearDown(self):
        super().tearDown()
        self.runtime_patcher.stop()

    def test_component_with_js_content_only(self):
        """Test component with only JavaScript content."""
        # Register a component with JS content only
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="js_only_component",
                js="console.log('hello world');",
            )
        )

        # Call the component
        st._bidi_component("js_only_component")

        # Verify the proto was enqueued
        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name == "js_only_component"
        assert bidi_component_proto.js_content == "console.log('hello world');"
        assert bidi_component_proto.html_content == ""

    def test_component_with_html_content_only(self):
        """Test component with only HTML content."""
        # Register a component with HTML content only
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="html_only_component",
                html="<div>Hello World</div>",
            )
        )

        # Call the component
        st._bidi_component("html_only_component")

        # Verify the proto was enqueued
        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name == "html_only_component"
        assert bidi_component_proto.html_content == "<div>Hello World</div>"
        assert bidi_component_proto.js_content == ""

    def test_component_with_js_url_only(self):
        """Test component with only JavaScript URL."""
        # Create a mock component definition with js_url
        mock_component_def = MagicMock(spec=BidiComponentDefinition)
        mock_component_def.js_content = None
        mock_component_def.js_url = "index.js"
        mock_component_def.html_content = None
        mock_component_def.css_content = None
        mock_component_def.css_url = None
        mock_component_def.isolate_styles = True

        # Mock the registry to return our component
        with patch.object(
            self.mock_component_manager, "get", return_value=mock_component_def
        ):
            # Call the component
            st._bidi_component("js_url_component")

            # Verify the proto was enqueued
            delta = self.get_delta_from_queue()
            bidi_component_proto = delta.new_element.bidi_component
            assert bidi_component_proto.component_name == "js_url_component"
            assert bidi_component_proto.js_source_path == "index.js"
            assert bidi_component_proto.html_content == ""

    def test_component_with_both_js_and_html(self):
        """Test component with both JavaScript and HTML content."""
        # Register a component with both JS and HTML content
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="full_component",
                js="console.log('hello world');",
                html="<div>Hello World</div>",
                css="div { color: red; }",
            )
        )

        # Call the component
        st._bidi_component("full_component")

        # Verify the proto was enqueued
        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name == "full_component"
        assert bidi_component_proto.js_content == "console.log('hello world');"
        assert bidi_component_proto.html_content == "<div>Hello World</div>"
        assert bidi_component_proto.css_content == "div { color: red; }"

    def test_component_with_no_js_or_html_raises_exception(self):
        """Test that component with neither JS nor HTML content raises StreamlitAPIException."""
        # Register a component with only CSS content (no JS or HTML)
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="css_only_component",
                css="div { color: red; }",
            )
        )

        # Call the component and expect an exception
        with pytest.raises(StreamlitAPIException) as exc_info:
            st._bidi_component("css_only_component")

        # Verify the error message
        error_message = str(exc_info.value)
        assert "css_only_component" in error_message
        assert "must have either JavaScript content" in error_message
        assert (
            "(`js_content` or `js_url`) or HTML content (`html_content`)"
            in error_message
        )

    def test_component_with_empty_js_and_html_raises_exception(self):
        """Test that component with empty JS and HTML content raises StreamlitAPIException."""
        # Create a mock component definition with empty content
        mock_component_def = MagicMock(spec=BidiComponentDefinition)
        mock_component_def.js_content = ""  # Empty string
        mock_component_def.js_url = None
        mock_component_def.html_content = ""  # Empty string
        mock_component_def.css_content = "div { color: red; }"
        mock_component_def.css_url = None
        mock_component_def.isolate_styles = True

        # Mock the registry to return our component
        with patch.object(
            self.mock_component_manager, "get", return_value=mock_component_def
        ):
            # Call the component and expect an exception
            with pytest.raises(StreamlitAPIException) as exc_info:
                st._bidi_component("empty_component")

            # Verify the error message
            error_message = str(exc_info.value)
            assert "empty_component" in error_message
            assert "must have either JavaScript content" in error_message

    def test_unregistered_component_raises_value_error(self):
        """Test that calling an unregistered component raises ValueError."""
        # Call a component that doesn't exist
        with pytest.raises(
            ValueError, match="Component 'nonexistent_component' is not registered"
        ):
            st._bidi_component("nonexistent_component")

    def test_component_with_key(self):
        """Test component with a user-specified key."""
        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="keyed_component",
                js="console.log('hello world');",
            )
        )

        # Call the component with a key
        st._bidi_component("keyed_component", key="my_key")

        # Verify the proto was enqueued with the correct ID
        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name == "keyed_component"
        # The ID should be deterministic based on the key
        assert bidi_component_proto.id is not None

    def test_component_with_scalar_data(self):
        """Test component with scalar data parameter serialized as JSON."""
        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="data_component",
                js="console.log('hello world');",
            )
        )

        # Use a simple scalar value which is treated as DataFormat.UNKNOWN and therefore JSON-encoded
        test_data = "hello streamlit"
        st._bidi_component("data_component", data=test_data)

        # Verify the proto was enqueued with the data
        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name == "data_component"
        # Data should be JSON serialized inside the `json` oneof field
        assert bidi_component_proto.WhichOneof("data") == "json"
        assert bidi_component_proto.json == '"hello streamlit"'

    def test_component_with_dict_data_json(self):
        """Test component with dict data serialized as JSON."""
        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="dict_data_component",
                js="console.log('hello world');",
            )
        )

        test_dict = {"message": "hello", "count": 42}
        st._bidi_component("dict_data_component", data=test_dict)

        delta = self.get_delta_from_queue()
        proto = delta.new_element.bidi_component
        assert proto.component_name == "dict_data_component"
        # Should choose JSON path
        assert proto.WhichOneof("data") == "json"

        assert json.loads(proto.json) == test_dict

    def test_component_with_arrow_data(self):
        """Test component with dataframe-like data serialized to Arrow."""

        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="arrow_data_component",
                js="console.log('hello world');",
            )
        )

        # Use a simple Pandas DataFrame which should be detected as dataframe-like
        df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
        st._bidi_component("arrow_data_component", data=df)

        # Verify the proto was enqueued with Arrow data
        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name == "arrow_data_component"
        assert bidi_component_proto.WhichOneof("data") == "arrow_data"
        # The Arrow bytes should be non-empty
        assert len(bidi_component_proto.arrow_data.data) > 0

    def test_component_with_bytes_data(self):
        """Test component with raw bytes data passed through unchanged."""
        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="bytes_data_component",
                js="console.log('hello world');",
            )
        )

        # Raw bytes payload
        binary_payload = b"\x00\x01\x02streamlit"
        st._bidi_component("bytes_data_component", data=binary_payload)

        # Verify the proto was enqueued with bytes data
        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name == "bytes_data_component"
        assert bidi_component_proto.WhichOneof("data") == "bytes"
        assert bidi_component_proto.bytes == binary_payload

    def test_component_with_callbacks(self):
        """Test component with callback handlers."""
        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="callback_component",
                js="console.log('hello world');",
            )
        )

        # Create mock callback
        on_click_callback = MagicMock()

        # Call the component with event-specific callback
        result = st._bidi_component(
            "callback_component",
            on_click_change=on_click_callback,
        )

        # Verify the result
        assert hasattr(result, "click")

        # Verify the proto was enqueued with registered handler names
        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name == "callback_component"

    def test_component_with_dict_containing_dataframe(self):
        """Test component with dict containing dataframe - should use mixed data serialization."""

        import pandas as pd

        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="dict_with_df_component",
                js="console.log('hello world');",
            )
        )

        # Create mixed data with dataframe automatically detected
        df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
        mixed_data = {
            "config": {"title": "My Chart", "theme": "dark"},
            "dataframe": df,  # This should be automatically detected and converted
            "metadata": {"rows": 3, "cols": 2},
        }

        st._bidi_component("dict_with_df_component", data=mixed_data)

        # Verify the proto was enqueued with mixed data
        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name == "dict_with_df_component"
        assert bidi_component_proto.WhichOneof("data") == "mixed"

        # Verify the mixed data structure
        mixed_proto = bidi_component_proto.mixed
        assert mixed_proto.json is not None
        assert len(mixed_proto.arrow_blobs) == 1

        # Parse the JSON to verify placeholder structure
        parsed_json = json.loads(mixed_proto.json)
        assert parsed_json["config"]["title"] == "My Chart"
        assert parsed_json["metadata"]["rows"] == 3
        # The dataframe should be replaced with a placeholder
        assert "__streamlit_arrow_ref__" in parsed_json["dataframe"]

    def test_component_with_multiple_dataframes_in_dict(self):
        """Test component with dict containing multiple dataframes."""

        import pandas as pd

        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="multi_df_component",
                js="console.log('hello world');",
            )
        )

        # Create mixed data with multiple dataframes
        df1 = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
        df2 = pd.DataFrame({"c": [4, 5, 6], "d": ["p", "q", "r"]})

        mixed_data = {
            "config": {"title": "My Chart", "theme": "dark"},
            "sales_data": df1,  # Should be automatically detected
            "inventory_data": df2,  # Should be automatically detected
            "metadata": {"rows": 3, "cols": 2},
        }

        st._bidi_component("multi_df_component", data=mixed_data)

        # Verify the proto was enqueued with mixed data
        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name == "multi_df_component"
        assert bidi_component_proto.WhichOneof("data") == "mixed"

        # Verify the mixed data structure
        mixed_proto = bidi_component_proto.mixed
        assert mixed_proto.json is not None
        assert len(mixed_proto.arrow_blobs) == 2  # Two dataframes

        # Parse the JSON to verify placeholder structure
        parsed_json = json.loads(mixed_proto.json)
        assert parsed_json["config"]["title"] == "My Chart"
        assert parsed_json["config"]["theme"] == "dark"
        assert parsed_json["metadata"]["rows"] == 3
        # Both dataframes should be replaced with placeholders
        assert "__streamlit_arrow_ref__" in parsed_json["sales_data"]
        assert "__streamlit_arrow_ref__" in parsed_json["inventory_data"]

    def test_component_with_dict_without_dataframes(self):
        """Test component with dict containing no dataframes - should use JSON serialization."""

        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="json_only_component",
                js="console.log('hello world');",
            )
        )

        # Create data with no dataframes
        data = {
            "config": {"theme": "dark", "height": 400},
            "labels": ["A", "B", "C"],
            "settings": {"enabled": True},
            "metadata": {"version": "1.0"},
        }

        st._bidi_component("json_only_component", data=data)

        # Verify the proto was enqueued with JSON serialization
        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name == "json_only_component"
        assert bidi_component_proto.WhichOneof("data") == "json"

        # Parse the JSON to verify it matches original data

        parsed_json = json.loads(bidi_component_proto.json)
        assert parsed_json == data

    def test_component_with_list_data(self):
        """Test component with list data - should use JSON serialization."""

        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="list_component",
                js="console.log('hello world');",
            )
        )

        # Create list data (no automatic dataframe detection for lists)
        df = pd.DataFrame({"col": [1, 2, 3]})
        list_data = [
            {"name": "dataset1", "values": [1, 2, 3]},
            {"name": "dataset2", "values": [4, 5, 6]},
            df,  # This dataframe will be converted to JSON via fallback
        ]

        st._bidi_component("list_component", data=list_data)

        # Verify the proto was enqueued with JSON serialization
        # (since we only detect dataframes in first level of dicts)
        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name == "list_component"
        assert bidi_component_proto.WhichOneof("data") == "json"

        # The data should be JSON-serialized as a string (due to DataFrame fallback)
        import json

        parsed_json = json.loads(bidi_component_proto.json)
        assert isinstance(parsed_json, str)  # It's a string representation
        assert "dataset1" in parsed_json
        assert "dataset2" in parsed_json

    def test_component_with_tuple_data(self):
        """Test component with tuple data - should use JSON serialization."""

        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="tuple_component",
                js="console.log('hello world');",
            )
        )

        # Create tuple data (no automatic dataframe detection for tuples)
        df = pd.DataFrame({"value": [42]})
        tuple_data = ("metadata", df, {"extra": "info"})

        st._bidi_component("tuple_component", data=tuple_data)

        # Verify the proto was enqueued with JSON serialization
        # (since we only detect dataframes in first level of dicts)
        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name == "tuple_component"
        assert bidi_component_proto.WhichOneof("data") == "json"

        # The data should be JSON-serialized as a string (due to DataFrame fallback)
        import json

        parsed_json = json.loads(bidi_component_proto.json)

        # The tuple with DataFrame gets converted to string representation
        assert isinstance(parsed_json, str)
        assert "metadata" in parsed_json
        assert "extra" in parsed_json
        assert "info" in parsed_json

    def test_component_with_dict_no_arrow_refs_uses_json(self):
        """Test that dictionaries without ArrowReference objects use regular JSON serialization."""
        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="json_only_component",
                js="console.log('hello world');",
            )
        )

        # Create dictionary without any ArrowReference objects
        regular_data = {
            "config": {"title": "Chart", "enabled": True},
            "values": [1, 2, 3, 4],
            "metadata": {"count": 4},
        }

        st._bidi_component("json_only_component", data=regular_data)

        # Verify the proto uses regular JSON serialization
        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.WhichOneof("data") == "json"

        parsed_data = json.loads(bidi_component_proto.json)
        assert parsed_data == regular_data

    def test_default_with_valid_callbacks(self):
        """Test that default works correctly with valid callback names."""
        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="default_component",
                js="console.log('hello world');",
            )
        )

        # Create mock callbacks
        on_selected_change = MagicMock()
        on_search_change = MagicMock()

        # Call the component with default
        result = st._bidi_component(
            "default_component",
            default={
                "selected": ["item1", "item2"],
                "search": "default search",
            },
            on_selected_change=on_selected_change,
            on_search_change=on_search_change,
        )

        # Verify the result contains default values
        assert result["selected"] == ["item1", "item2"]
        assert result["search"] == "default search"

    def test_default_validation_error(self):
        """Test that invalid keys in default raise StreamlitAPIException."""
        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="validation_component",
                js="console.log('hello world');",
            )
        )

        # Create mock callback for only one state
        on_valid_change = MagicMock()

        # Call the component with invalid default key
        with pytest.raises(StreamlitAPIException) as exc_info:
            st._bidi_component(
                "validation_component",
                default={
                    "valid": "this is ok",
                    "invalid": "this should fail",  # No on_invalid_change callback
                },
                on_valid_change=on_valid_change,
            )

        # Verify the error message
        error_message = str(exc_info.value)
        assert "invalid" in error_message
        assert "not a valid state name" in error_message
        assert "Available state names: `['valid']`" in error_message

    def test_default_no_callbacks_error(self):
        """Test that default with no callbacks raises StreamlitAPIException."""
        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="no_callbacks_component",
                js="console.log('hello world');",
            )
        )

        # Call the component with default but no callbacks
        with pytest.raises(StreamlitAPIException) as exc_info:
            st._bidi_component(
                "no_callbacks_component",
                default={"some_state": "value"},
            )

        # Verify the error message mentions no available state names
        error_message = str(exc_info.value)
        assert "some_state" in error_message
        assert "not a valid state name" in error_message
        assert "Available state names: `none`" in error_message

    def test_default_none_is_valid(self):
        """Test that default=None works correctly."""
        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="none_default_component",
                js="console.log('hello world');",
            )
        )

        # Create mock callback
        on_test_change = MagicMock()

        # Call the component with default=None
        result = st._bidi_component(
            "none_default_component",
            default=None,
            on_test_change=on_test_change,
        )

        # Should work without error and have empty state
        assert result["test"] is None

    def test_default_empty_dict(self):
        """Test that empty default dict works correctly."""
        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="empty_default_component",
                js="console.log('hello world');",
            )
        )

        # Create mock callback
        on_test_change = MagicMock()

        # Call the component with empty default
        result = st._bidi_component(
            "empty_default_component",
            default={},
            on_test_change=on_test_change,
        )

        # Should work without error
        assert result["test"] is None

    def test_default_with_none_values(self):
        """Test that None values in default are properly handled."""
        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="none_values_component",
                js="console.log('hello world');",
            )
        )

        # Create mock callback
        on_nullable_change = MagicMock()

        # Call the component with None default value
        result = st._bidi_component(
            "none_values_component",
            default={"nullable": None},
            on_nullable_change=on_nullable_change,
        )

        # Verify None is properly set as default
        assert result["nullable"] is None

    def test_default_complex_values(self):
        """Test that complex values in default work correctly."""
        # Register a component
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="complex_default_component",
                js="console.log('hello world');",
            )
        )

        # Create mock callbacks
        on_list_state_change = MagicMock()
        on_dict_state_change = MagicMock()

        # Call the component with complex default values
        complex_list = [1, 2, {"nested": "value"}]
        complex_dict = {"key": "value", "nested": {"data": [1, 2, 3]}}

        result = st._bidi_component(
            "complex_default_component",
            default={
                "list_state": complex_list,
                "dict_state": complex_dict,
            },
            on_list_state_change=on_list_state_change,
            on_dict_state_change=on_dict_state_change,
        )

        # Verify complex values are properly set
        assert result["list_state"] == complex_list
        assert result["dict_state"] == complex_dict


class BidiComponentStateCallbackTest(DeltaGeneratorTestCase):
    """Verify that per-state callbacks fire exclusively for their key."""

    COMPONENT_NAME = "stateful_component"

    def setUp(self):
        super().setUp()
        # Set up a fresh component manager patched into the Runtime singleton.
        self.mock_component_manager = BidiComponentManager()
        self.runtime_patcher = patch.object(
            Runtime, "instance", return_value=MagicMock()
        )
        self.mock_runtime = self.runtime_patcher.start()
        self.mock_runtime.return_value.bidi_component_registry = (
            self.mock_component_manager
        )

        # Register a minimal component definition (JS only is enough for backend tests).
        self.mock_component_manager.register(
            BidiComponentDefinition(name=self.COMPONENT_NAME, js="console.log('hi');")
        )

        # Prepare per-event callback mocks.
        self.range_cb = MagicMock(name="range_cb")
        self.text_cb = MagicMock(name="text_cb")

        # First script run: render the component and capture its widget id.
        st._bidi_component(
            self.COMPONENT_NAME,
            on_range_change=self.range_cb,
            on_text_change=self.text_cb,
        )
        self.component_id = (
            self.get_delta_from_queue().new_element.bidi_component.id  # type: ignore[attr-defined]
        )
        # Sanity: no callbacks should have fired during initial render.
        self.range_cb.assert_not_called()
        self.text_cb.assert_not_called()

    def tearDown(self):
        super().tearDown()
        self.runtime_patcher.stop()

    # ------------------------------------------------------------------
    # Helper utilities
    # ------------------------------------------------------------------
    def _simulate_state_update(self, new_state: dict):
        """Trigger a faux frontend state update and run callbacks."""
        ws = WidgetState(id=self.component_id)
        ws.json_value = json.dumps(new_state)
        self.script_run_ctx.session_state.on_script_will_rerun(
            WidgetStates(widgets=[ws])
        )

    # ------------------------------------------------------------------
    # Tests
    # ------------------------------------------------------------------
    def test_only_range_changes_invokes_only_range_callback(self):
        """Test that only the 'range' callback is invoked when only 'range' state changes."""
        # Update just the "range" key.
        self._simulate_state_update({"range": 10})

        self.range_cb.assert_called_once()
        self.text_cb.assert_not_called()

    def test_only_text_changes_invokes_only_text_callback(self):
        """Test that only the 'text' callback is invoked when only 'text' state changes."""
        # Reset mock call history.
        self.range_cb.reset_mock()
        self.text_cb.reset_mock()

        # Update just the "text" key.
        self._simulate_state_update({"text": "hello"})

        self.text_cb.assert_called_once()
        self.range_cb.assert_not_called()

    def test_both_keys_change_invokes_both_callbacks(self):
        """Test that both callbacks are invoked when both 'range' and 'text' states change."""
        # Reset mock call history.
        self.range_cb.reset_mock()
        self.text_cb.reset_mock()

        # Update both keys simultaneously.
        self._simulate_state_update({"range": 77, "text": "world"})

        self.range_cb.assert_called_once()
        self.text_cb.assert_called_once()
