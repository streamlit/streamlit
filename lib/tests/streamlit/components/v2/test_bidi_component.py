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

from __future__ import annotations

import json
import math
from typing import Any
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

import streamlit as st
from streamlit import _main as st_main
from streamlit.components.v2.bidi_component.constants import EVENT_DELIM
from streamlit.components.v2.bidi_component.main import (
    BidiComponentMixin,
    _make_trigger_id,
)
from streamlit.components.v2.bidi_component.state import ComponentResult
from streamlit.components.v2.component_manager import BidiComponentManager
from streamlit.components.v2.component_registry import BidiComponentDefinition
from streamlit.errors import (
    BidiComponentInvalidCallbackNameError,
    StreamlitAPIException,
)
from streamlit.proto.BidiComponent_pb2 import BidiComponent as BidiComponentProto
from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime import Runtime
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state.session_state import (
    STREAMLIT_INTERNAL_KEY_PREFIX,
    _is_internal_key,
)
from streamlit.util import calc_hash
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


def test_make_trigger_id_validates_base_delimiter() -> None:
    """Test that _make_trigger_id raises exception if base contains delimiter."""
    with pytest.raises(StreamlitAPIException, match="delimiter sequence"):
        _make_trigger_id("base__with__delim", "click")


def test_make_trigger_id_validates_event_delimiter() -> None:
    """Test that _make_trigger_id raises exception if event contains delimiter."""
    with pytest.raises(StreamlitAPIException, match="delimiter sequence"):
        _make_trigger_id("normal_base", "click__event")


def test_make_trigger_id_creates_internal_key() -> None:
    """Test that _make_trigger_id creates widget IDs with internal prefix.
    Trigger widgets should be marked as internal so they don't appear
    in st.session_state when accessed by end users.
    """
    base_id = "my_component_123"
    event = "click"

    trigger_id = _make_trigger_id(base_id, event)

    # Should start with internal prefix
    assert trigger_id.startswith(STREAMLIT_INTERNAL_KEY_PREFIX), (
        f"Trigger ID should start with {STREAMLIT_INTERNAL_KEY_PREFIX}, got: {trigger_id}"
    )

    # Should contain the base component ID
    assert base_id in trigger_id, (
        f"Trigger ID should contain base '{base_id}', got: {trigger_id}"
    )

    # Should contain the event name
    assert event in trigger_id, (
        f"Trigger ID should contain event '{event}', got: {trigger_id}"
    )

    # Should contain the event delimiter
    assert EVENT_DELIM in trigger_id, (
        f"Trigger ID should contain delimiter '{EVENT_DELIM}', got: {trigger_id}"
    )


def test_trigger_id_is_detected_as_internal() -> None:
    """Test that trigger widget IDs are correctly identified as internal keys."""
    base_id = "my_component_123"
    event = "click"

    trigger_id = _make_trigger_id(base_id, event)

    # Trigger ID should be detected as internal
    assert _is_internal_key(trigger_id), (
        f"Trigger ID should be detected as internal: {trigger_id}"
    )


def test_regular_keys_are_not_detected_as_internal() -> None:
    """Test that regular keys and widget IDs are not detected as internal."""
    regular_key = "user_defined_key"
    regular_widget_id = "$$ID-my_widget-None"  # Typical auto-generated widget ID
    component_id = "my_component_main_widget"  # Component main widget ID

    # Regular keys should not be detected as internal
    assert not _is_internal_key(regular_key), (
        f"Regular key should not be detected as internal: {regular_key}"
    )
    assert not _is_internal_key(regular_widget_id), (
        f"Regular widget ID should not be detected as internal: {regular_widget_id}"
    )
    assert not _is_internal_key(component_id), (
        f"Component ID should not be detected as internal: {component_id}"
    )


def test_make_trigger_id_normal_case() -> None:
    """Test that _make_trigger_id works correctly for normal inputs."""
    base_id = "normal_base"
    event = "normal_event"

    trigger_id = _make_trigger_id(base_id, event)

    # Should succeed and return a valid internal key
    assert trigger_id is not None
    assert _is_internal_key(trigger_id)
    assert base_id in trigger_id
    assert event in trigger_id


def test_multiple_trigger_ids_are_all_internal() -> None:
    """Test that multiple trigger IDs for the same component are all internal."""
    base_id = "my_component_456"
    events = ["click", "change", "submit", "hover"]

    trigger_ids = [_make_trigger_id(base_id, event) for event in events]

    # All trigger IDs should be internal
    for trigger_id in trigger_ids:
        assert _is_internal_key(trigger_id), (
            f"All trigger IDs should be internal: {trigger_id}"
        )

    # All trigger IDs should be unique
    assert len(trigger_ids) == len(set(trigger_ids)), "All trigger IDs should be unique"


def test_result_merges_state_and_trigger_values():
    """ComponentResult should behave like a mapping/attribute dict."""

    # Arrange
    state_vals = {"foo": 123, "bar": "abc"}
    trigger_vals = {"clicked": True, "changed": {"value": 42}}

    # Act
    result = ComponentResult(state_vals, trigger_vals)

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
        manager = Runtime.instance().bidi_component_registry
        component_def = BidiComponentDefinition(
            name="my_component",
            js="console.log('hello');",
        )
        manager.register(component_def)
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
    - ``ComponentResult`` exposes event keys and merges persistent state
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
        assert isinstance(result, ComponentResult)
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
            for wid in ctx.widget_ids_this_run.snapshot()
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

    def test_component_with_css_only_succeeds(self):
        """Test that a CSS-only component mounts without raising."""
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="css_only_component",
                css="div { color: red; }",
            )
        )

        st._bidi_component("css_only_component")

        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name == "css_only_component"
        assert bidi_component_proto.css_content == "div { color: red; }"
        assert bidi_component_proto.js_content == ""
        assert bidi_component_proto.html_content == ""

    def test_component_with_no_content_succeeds(self):
        """Test that a component with no JS/HTML/CSS mounts without raising."""
        self.mock_component_manager.register(
            BidiComponentDefinition(
                name="empty_component",
            )
        )

        st._bidi_component("empty_component")

        delta = self.get_delta_from_queue()
        bidi_component_proto = delta.new_element.bidi_component
        assert bidi_component_proto.component_name == "empty_component"
        assert bidi_component_proto.css_content == ""
        assert bidi_component_proto.js_content == ""
        assert bidi_component_proto.html_content == ""

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


class BidiComponentIdentityTest(DeltaGeneratorTestCase):
    """Validate CCv2 identity rules for keyed and unkeyed instances."""

    def setUp(self):
        super().setUp()
        self.manager = BidiComponentManager()
        runtime = Runtime.instance()
        if runtime is None:
            raise RuntimeError("Runtime.instance() returned None in test setup.")
        runtime.bidi_component_registry = self.manager
        self.manager.register(
            BidiComponentDefinition(name="ident", js="console.log('hi');")
        )

    def _clear_widget_registrations_for_current_run(self) -> None:
        """Allow re-registering the same id within the same run for testing keyed stability."""
        ctx = get_script_run_ctx()
        assert ctx is not None
        ctx.widget_user_keys_this_run.clear()
        ctx.widget_ids_this_run.clear()

    def _render_and_get_id(self) -> str:
        delta = self.get_delta_from_queue()
        return delta.new_element.bidi_component.id

    def test_unkeyed_id_stable_when_data_is_none(self):
        """Without data, unkeyed components should have stable IDs based on other params."""
        st._bidi_component("ident")
        id1 = self._render_and_get_id()

        self._clear_widget_registrations_for_current_run()

        st._bidi_component("ident")
        id2 = self._render_and_get_id()

        assert id1 == id2

    def test_unkeyed_id_differs_between_none_and_empty_data(self):
        """data=None must produce a different ID than data={} (empty dict is still data)."""
        st._bidi_component("ident", data=None)
        id_none = self._render_and_get_id()

        st._bidi_component("ident", data={})
        id_empty = self._render_and_get_id()

        assert id_none != id_empty

    def test_unkeyed_id_changes_when_json_data_changes(self):
        """Without a user key, changing JSON data must change the backend id."""
        st._bidi_component("ident", data={"x": 1})
        id1 = self._render_and_get_id()

        st._bidi_component("ident", data={"x": 2})
        id2 = self._render_and_get_id()

        assert id1 != id2

    def test_unkeyed_id_changes_when_bytes_change(self):
        """Without a user key, changing bytes must change the backend id."""
        st._bidi_component("ident", data=b"abc")
        id1 = self._render_and_get_id()

        st._bidi_component("ident", data=b"abcd")
        id2 = self._render_and_get_id()

        assert id1 != id2

    def test_unkeyed_id_changes_when_arrow_data_changes(self):
        """Without a user key, changing dataframe content must change the backend id."""

        st._bidi_component("ident", data=pd.DataFrame({"a": [1, 2]}))
        id1 = self._render_and_get_id()

        st._bidi_component("ident", data=pd.DataFrame({"a": [1, 3]}))
        id2 = self._render_and_get_id()

        assert id1 != id2

    def test_unkeyed_id_changes_when_mixed_blobs_change(self):
        """Without a user key, MixedData blob fingerprint differences must change id."""

        st._bidi_component("ident", data={"df": pd.DataFrame({"x": [1]})})
        id1 = self._render_and_get_id()

        st._bidi_component("ident", data={"df": pd.DataFrame({"x": [2]})})
        id2 = self._render_and_get_id()

        assert id1 != id2

    def test_keyed_id_stable_when_data_changes_json(self):
        """With a user key, changing JSON data must NOT change the backend id (same run)."""
        st._bidi_component("ident", key="K", data={"v": 1})
        id1 = self._render_and_get_id()

        # Allow re-registering the same id in the same run for test purposes
        self._clear_widget_registrations_for_current_run()

        st._bidi_component("ident", key="K", data={"v": 2})
        id2 = self._render_and_get_id()

        assert id1 == id2

    def test_keyed_id_stable_when_mixed_data_changes(self):
        """With a user key, changing MixedData (JSON + blobs) must NOT change the backend id (same run)."""

        st._bidi_component(
            "ident", key="MIX", data={"df": pd.DataFrame({"a": [1]}), "m": {"x": 1}}
        )
        id1 = self._render_and_get_id()

        self._clear_widget_registrations_for_current_run()

        st._bidi_component(
            "ident", key="MIX", data={"df": pd.DataFrame({"a": [2]}), "m": {"x": 2}}
        )
        id2 = self._render_and_get_id()

        assert id1 == id2

    def test_unkeyed_id_stable_when_arrow_data_unchanged(self):
        """Without a user key, unchanged dataframe content must keep the same backend id (no needless churn)."""

        df1 = pd.DataFrame({"a": [1, 2, 3]})
        st._bidi_component("ident", data=df1)
        id1 = self._render_and_get_id()

        # Allow re-registering the same id in this run for stability assertion
        self._clear_widget_registrations_for_current_run()

        # New DataFrame object with identical content
        df2 = pd.DataFrame({"a": [1, 2, 3]})
        st._bidi_component("ident", data=df2)
        id2 = self._render_and_get_id()

        assert id1 == id2

    def test_unkeyed_id_stable_when_mixed_data_unchanged(self):
        """Without a user key, unchanged MixedData must keep the same backend id (no needless churn)."""

        mixed1 = {"df": pd.DataFrame({"x": [1, 2]}), "meta": {"k": "v"}}
        st._bidi_component("ident", data=mixed1)
        id1 = self._render_and_get_id()

        self._clear_widget_registrations_for_current_run()

        # New objects but same serialized content and key order
        mixed2 = {"df": pd.DataFrame({"x": [1, 2]}), "meta": {"k": "v"}}
        st._bidi_component("ident", data=mixed2)
        id2 = self._render_and_get_id()

        assert id1 == id2

    def test_keyed_id_stable_when_data_changes_arrow(self):
        """With a user key, changing Arrow/mixed data must NOT change the backend id (same run)."""

        st._bidi_component("ident", key="ARW", data=pd.DataFrame({"a": [1]}))
        id1 = self._render_and_get_id()

        self._clear_widget_registrations_for_current_run()

        st._bidi_component("ident", key="ARW", data=pd.DataFrame({"a": [2]}))
        id2 = self._render_and_get_id()

        assert id1 == id2

    def test_unkeyed_id_stable_when_default_unchanged(self):
        """Without a user key, unchanged defaults must keep the same backend id."""
        st._bidi_component(
            "ident",
            default={"foo": 1},
            on_foo_change=MagicMock(),
        )
        id1 = self._render_and_get_id()

        self._clear_widget_registrations_for_current_run()

        st._bidi_component(
            "ident",
            default={"foo": 1},
            on_foo_change=MagicMock(),
        )
        id2 = self._render_and_get_id()

        assert id1 == id2

    def test_unkeyed_id_changes_when_default_changes(self):
        """Without a user key, changing defaults must change the backend id."""
        st._bidi_component(
            "ident",
            default={"foo": 1},
            on_foo_change=MagicMock(),
        )
        id1 = self._render_and_get_id()

        st._bidi_component(
            "ident",
            default={"foo": 2},
            on_foo_change=MagicMock(),
        )
        id2 = self._render_and_get_id()

        assert id1 != id2

    def test_keyed_id_stable_when_default_changes(self):
        """With a user key, changing defaults must NOT change the backend id (same run)."""
        st._bidi_component(
            "ident",
            key="DEF",
            default={"foo": 1},
            on_foo_change=MagicMock(),
        )
        id1 = self._render_and_get_id()

        self._clear_widget_registrations_for_current_run()

        st._bidi_component(
            "ident",
            key="DEF",
            default={"foo": 2},
            on_foo_change=MagicMock(),
        )
        id2 = self._render_and_get_id()

        assert id1 == id2

    def test_identity_kwargs_raises_on_unhandled_oneof(self):
        """_build_bidi_identity_kwargs should raise if an unknown oneof is encountered."""
        mixin = BidiComponentMixin()

        class DummyProto:
            def WhichOneof(self, _name: str) -> str:
                return "new_unhandled_field"

        with pytest.raises(
            RuntimeError, match=r"Unhandled BidiComponent\.data oneof field"
        ):
            mixin._build_bidi_identity_kwargs(
                component_name="cmp",
                isolate_styles=True,
                width="stretch",
                height="content",
                proto=DummyProto(),  # type: ignore[arg-type]
            )

    def test_identity_kwargs_mixed_blob_keys_are_sorted(self):
        """When computing identity, mixed arrow blob ref IDs must be sorted for stability."""
        mixin = BidiComponentMixin()
        proto = BidiComponentProto()
        proto.mixed.json = "{}"
        # Insert keys in descending order to verify sorting in identity.
        proto.mixed.arrow_blobs["b"].data = b"b"
        proto.mixed.arrow_blobs["a"].data = b"a"

        identity = mixin._build_bidi_identity_kwargs(
            component_name="cmp",
            isolate_styles=True,
            width="stretch",
            height="content",
            proto=proto,
        )

        assert identity["mixed_json"] == calc_hash("{}")
        assert identity["mixed_arrow_blobs"] == "a,b"

    def test_identity_kwargs_json_canonicalizes_order(self):
        """Identity canonicalization should ignore key insertion order for JSON data."""
        mixin = BidiComponentMixin()
        proto = BidiComponentProto()
        proto.json = json.dumps({"b": 2, "a": 1})

        identity = mixin._build_bidi_identity_kwargs(
            component_name="cmp",
            isolate_styles=True,
            width="stretch",
            height="content",
            proto=proto,
        )

        expected = json.dumps({"a": 1, "b": 2}, sort_keys=True)
        assert identity["json"] == calc_hash(expected)

    def test_identity_kwargs_mixed_json_canonicalizes_order(self):
        """MixedData identity must canonicalize JSON portion independently of storage order."""
        mixin = BidiComponentMixin()
        proto = BidiComponentProto()
        proto.mixed.json = json.dumps({"b": 2, "a": 1})

        identity = mixin._build_bidi_identity_kwargs(
            component_name="cmp",
            isolate_styles=True,
            width="stretch",
            height="content",
            proto=proto,
        )

        expected = json.dumps({"a": 1, "b": 2}, sort_keys=True)
        assert identity["mixed_json"] == calc_hash(expected)

    def test_identity_kwargs_bytes_use_digest(self):
        """Raw byte payloads should contribute content digests, not the full payload."""
        mixin = BidiComponentMixin()
        proto = BidiComponentProto()
        proto.bytes = b"bytes payload"

        identity = mixin._build_bidi_identity_kwargs(
            component_name="cmp",
            isolate_styles=True,
            width="stretch",
            height="content",
            proto=proto,
        )

        assert identity["bytes"] == calc_hash(b"bytes payload")

    def test_identity_kwargs_arrow_data_use_digest(self):
        """Arrow payloads should contribute digests to avoid hashing large blobs repeatedly."""
        mixin = BidiComponentMixin()
        proto = BidiComponentProto()
        proto.arrow_data.data = b"\x00\x01"

        identity = mixin._build_bidi_identity_kwargs(
            component_name="cmp",
            isolate_styles=True,
            width="stretch",
            height="content",
            proto=proto,
        )

        assert identity["arrow_data"] == calc_hash(b"\x00\x01")

    def test_unkeyed_id_stable_when_json_key_order_changes(self):
        """Without a user key, changing the insertion order of keys in a JSON dict should NOT change the backend id."""
        data1 = {"a": 1, "b": 2}
        data2 = {"b": 2, "a": 1}

        st._bidi_component("ident", data=data1)
        id1 = self._render_and_get_id()

        self._clear_widget_registrations_for_current_run()

        st._bidi_component("ident", data=data2)
        id2 = self._render_and_get_id()

        assert id1 == id2

    def test_unkeyed_id_stable_when_mixed_data_json_key_order_changes(self):
        """Without a user key, changing the insertion order of keys in the JSON
        part of MixedData should NOT change the backend id."""
        # We use different dataframes (same content) to trigger mixed processing but keep blobs same
        df1 = pd.DataFrame({"c": [3]})
        df2 = pd.DataFrame({"c": [3]})

        data1 = {"df": df1, "meta": {"a": 1, "b": 2}}
        data2 = {"df": df2, "meta": {"b": 2, "a": 1}}

        st._bidi_component("ident", data=data1)
        id1 = self._render_and_get_id()

        self._clear_widget_registrations_for_current_run()

        st._bidi_component("ident", data=data2)
        id2 = self._render_and_get_id()

        assert id1 == id2

    def test_unkeyed_id_stable_with_duplicate_dataframe_content(self):
        """Two different keys with identical DataFrame content should produce stable IDs.

        This validates content-addressing deduplication: identical DataFrames under
        different keys share the same blob ref ID, so the identity is stable.
        """
        data1 = {"df1": pd.DataFrame({"x": [1]}), "df2": pd.DataFrame({"x": [1]})}
        st._bidi_component("ident", data=data1)
        id1 = self._render_and_get_id()

        self._clear_widget_registrations_for_current_run()

        # Same structure, new DataFrame objects with identical content
        data2 = {"df1": pd.DataFrame({"x": [1]}), "df2": pd.DataFrame({"x": [1]})}
        st._bidi_component("ident", data=data2)
        id2 = self._render_and_get_id()

        assert id1 == id2

    def test_identity_kwargs_uses_optimization_when_data_provided(self):
        """When data is provided, identity calculation should skip unnecessary deserialization."""
        mixin = BidiComponentMixin()
        proto = BidiComponentProto()
        data = {"a": 1, "b": 2}
        # Pre-populate proto.json to simulate what happens in main
        proto.json = json.dumps(data)

        # Mock _canonical_json_digest_for_identity to ensure it's NOT called
        # when the optimization path is taken.
        with patch.object(mixin, "_canonical_json_digest_for_identity") as mock_digest:
            identity = mixin._build_bidi_identity_kwargs(
                component_name="cmp",
                isolate_styles=True,
                width="stretch",
                height="content",
                proto=proto,
                data=data,
            )

            # Verify the result is correct (sorted keys)
            expected_canonical = json.dumps(data, sort_keys=True)
            assert identity["json"] == calc_hash(expected_canonical)

            # Verify the slow path was skipped
            mock_digest.assert_not_called()

        # Verify behavior WITHOUT data (slow path fallback)
        with patch.object(
            mixin,
            "_canonical_json_digest_for_identity",
            wraps=mixin._canonical_json_digest_for_identity,
        ) as mock_digest:
            identity = mixin._build_bidi_identity_kwargs(
                component_name="cmp",
                isolate_styles=True,
                width="stretch",
                height="content",
                proto=proto,
                data=None,
            )

            # Verify result is still correct
            assert identity["json"] == calc_hash(expected_canonical)

            # Verify the slow path WAS called
            mock_digest.assert_called_once()


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


class BidiComponentTriggerCallbackTest(DeltaGeneratorTestCase):
    """Verify that per-event *trigger* callbacks fire only for their event."""

    COMPONENT_NAME = "trigger_component"

    # ------------------------------------------------------------------
    # Test lifecycle helpers
    # ------------------------------------------------------------------
    def setUp(self):
        super().setUp()

        # Patch a fresh component manager into the Runtime singleton so tests are isolated.
        self.component_manager = BidiComponentManager()
        self.runtime_patcher = patch.object(
            Runtime, "instance", return_value=MagicMock()
        )
        self.mock_runtime = self.runtime_patcher.start()
        self.mock_runtime.return_value.bidi_component_registry = self.component_manager

        # Register a minimal JS-only component definition (enough for backend tests).
        self.component_manager.register(
            BidiComponentDefinition(name=self.COMPONENT_NAME, js="console.log('hi');")
        )

        # Prepare mocks for per-event callbacks.
        self.range_trigger_cb = MagicMock(name="range_trigger_cb")
        self.text_trigger_cb = MagicMock(name="text_trigger_cb")
        self.button_cb = MagicMock(name="button_cb")

        # First script run: render the component and capture its widget id.
        st._bidi_component(
            self.COMPONENT_NAME,
            on_range_change=self.range_trigger_cb,
            on_text_change=self.text_trigger_cb,
        )

        # Render a separate *button* widget that uses the classic trigger_value
        # mechanism so we can verify coexistence of multiple trigger sources.
        st.button("Click me!", on_click=self.button_cb)

        # After enqueuing both the component and the button, the button proto
        # is at the tail of the queue (index -1) and the component proto just
        # before that (index -2).

        self.button_id = self.get_delta_from_queue().new_element.button.id  # type: ignore[attr-defined]

        self.component_id = (
            self.get_delta_from_queue(-2).new_element.bidi_component.id  # type: ignore[attr-defined]
        )

        # Sanity: no callbacks should have fired during initial render.
        self.range_trigger_cb.assert_not_called()
        self.text_trigger_cb.assert_not_called()
        self.button_cb.assert_not_called()

    def tearDown(self):
        super().tearDown()
        # Stop Runtime.instance patcher started in setUp.
        self.runtime_patcher.stop()

    # ------------------------------------------------------------------
    # Utility to simulate frontend trigger updates
    # ------------------------------------------------------------------
    def _simulate_trigger_update(self, trigger_updates: dict[str, Any]):
        """Emulate the frontend firing one or more triggers.
        Parameters
        ----------
        trigger_updates : Dict[str, Any]
            Mapping from *event name* to *payload* value. The payload will be
            JSON-serialized before being injected into the ``WidgetState``
            protobuf.
        """

        # Aggregator path: combine updates into a single payload
        updates = [
            {"event": name, "value": payload}
            for name, payload in trigger_updates.items()
        ]
        payload = updates[0] if len(updates) == 1 else updates

        agg_id = _make_trigger_id(self.component_id, "events")
        ws = WidgetState(id=agg_id)
        ws.json_trigger_value = json.dumps(payload)
        widget_states = WidgetStates(widgets=[ws])

        # Feed the simulated WidgetStates into Session State which will, in
        # turn, invoke the appropriate callbacks via ``_call_callbacks``.
        self.script_run_ctx.session_state.on_script_will_rerun(widget_states)

    def _simulate_button_click(self):
        """Simulate a user clicking the separate st.button widget."""

        ws = WidgetState(id=self.button_id)
        ws.trigger_value = True
        widget_states = WidgetStates(widgets=[ws])
        self.script_run_ctx.session_state.on_script_will_rerun(widget_states)

    # ------------------------------------------------------------------
    # Tests
    # ------------------------------------------------------------------
    def test_only_range_trigger_invokes_only_range_callback(self):
        """Updating only the ``range`` trigger should only call its callback."""

        self._simulate_trigger_update({"range": 10})

        self.range_trigger_cb.assert_called_once()
        self.text_trigger_cb.assert_not_called()

        # Value assertions via aggregator
        agg_id = _make_trigger_id(self.component_id, "events")
        assert self.script_run_ctx.session_state[agg_id] == [
            {"event": "range", "value": 10}
        ]

    def test_only_text_trigger_invokes_only_text_callback(self):
        """Updating only the ``text`` trigger should only call its callback."""

        self._simulate_trigger_update({"text": "hello"})

        self.text_trigger_cb.assert_called_once()
        self.range_trigger_cb.assert_not_called()

    def test_both_triggers_fired_invokes_both_callbacks(self):
        """When *both* triggers fire simultaneously, *both* callbacks fire."""

        self._simulate_trigger_update({"range": 77, "text": "world"})

        self.range_trigger_cb.assert_called_once()
        self.text_trigger_cb.assert_called_once()

    # --------------------------------------------------------------
    # Interactions involving *another* trigger widget (st.button)
    # --------------------------------------------------------------

    def test_button_click_invokes_only_button_callback(self):
        """Clicking the separate st.button must not affect component triggers."""

        self._simulate_button_click()

        self.button_cb.assert_called_once()
        self.range_trigger_cb.assert_not_called()
        self.text_trigger_cb.assert_not_called()

        # After a button click, the *previous* range trigger should have been
        # reset to ``None`` by SessionState._reset_triggers.
        agg_id = _make_trigger_id(self.component_id, "events")
        assert self.script_run_ctx.session_state[agg_id] is None

        self._simulate_trigger_update({"range": 10})

        self.button_cb.assert_called_once()
        self.range_trigger_cb.assert_called_once()
        self.text_trigger_cb.assert_not_called()

    def test_button_and_component_trigger_both_fire(self):
        """Simultaneous component trigger + button click fires *all* callbacks."""

        # Compose a single WidgetStates message that includes both updates.
        widget_states = WidgetStates()

        # Component trigger via aggregator for 'range'
        agg_id = _make_trigger_id(self.component_id, "events")
        ws_component = WidgetState(id=agg_id)
        ws_component.json_trigger_value = json.dumps({"event": "range", "value": 123})
        widget_states.widgets.append(ws_component)

        # Button click
        ws_button = WidgetState(id=self.button_id)
        ws_button.trigger_value = True
        widget_states.widgets.append(ws_button)

        # Act
        self.script_run_ctx.session_state.on_script_will_rerun(widget_states)

        # Assert: all three callbacks should have fired accordingly.
        self.range_trigger_cb.assert_called_once()
        self.button_cb.assert_called_once()
        # text trigger remains untouched
        self.text_trigger_cb.assert_not_called()

    def test_handle_deserialize_with_none_input(self):
        """Test handle_deserialize returns None when input is None."""
        # Get the handle_deserialize function by creating an instance
        # and accessing the function through the component creation process
        deserializer = self._get_handle_deserialize_function()

        result = deserializer(None)
        assert result is None

    def test_handle_deserialize_with_valid_json_strings(self):
        """Test handle_deserialize correctly parses valid JSON strings."""
        deserializer = self._get_handle_deserialize_function()

        # Test various valid JSON values
        test_cases = [
            ("null", None),
            ("true", True),
            ("false", False),
            ("123", 123),
            ("-45.67", -45.67),
            ('"hello"', "hello"),
            ('"test string"', "test string"),
            ('{"key": "value"}', {"key": "value"}),
            ("[1, 2, 3]", [1, 2, 3]),
            ('{"nested": {"data": [1, 2]}}', {"nested": {"data": [1, 2]}}),
        ]

        for json_str, expected in test_cases:
            result = deserializer(json_str)
            assert result == expected, (
                f"Failed for input {json_str!r}: expected {expected!r}, got {result!r}"
            )

    def test_handle_deserialize_with_invalid_json_returns_string(self):
        """Test handle_deserialize returns string as-is when JSON parsing fails."""
        deserializer = self._get_handle_deserialize_function()

        # Test various non-JSON strings that should be returned as-is
        test_cases = [
            "hello world",
            "not json",
            "123abc",
            "true but not quite",
            "{not valid json}",
            "[1, 2, 3",  # Missing closing bracket
            '{"incomplete": ',  # Incomplete JSON
            "simple text",
            "user input value",
            "component_state_value",
        ]

        for invalid_json in test_cases:
            result = deserializer(invalid_json)
            assert result == invalid_json, (
                f"Failed for input {invalid_json!r}: expected {invalid_json!r}, got {result!r}"
            )

    def test_handle_deserialize_with_empty_and_whitespace_strings(self):
        """Test handle_deserialize handles empty and whitespace strings correctly."""
        deserializer = self._get_handle_deserialize_function()

        # Empty and whitespace strings should be returned as-is since they're not valid JSON
        test_cases = [
            "",  # Empty string
            " ",  # Single space
            "   ",  # Multiple spaces
            "\t",  # Tab
            "\n",  # Newline
            "\r\n",  # Windows line ending
            " \t\n ",  # Mixed whitespace
        ]

        for whitespace_str in test_cases:
            result = deserializer(whitespace_str)
            assert result == whitespace_str, (
                f"Failed for input {whitespace_str!r}: expected {whitespace_str!r}, got {result!r}"
            )

    def test_handle_deserialize_with_edge_case_strings(self):
        """Test handle_deserialize with edge case string inputs."""
        deserializer = self._get_handle_deserialize_function()

        # Test cases that should be returned as strings (not valid JSON)
        string_cases = [
            "undefined",  # Common JS value
            "null_but_not",  # Looks like null but isn't
            "True",  # Python True (capital T)
            "False",  # Python False (capital F)
            '"unclosed string',  # Malformed JSON string
            'single"quote',  # Mixed quotes
            "emoji 😀",  # Unicode content
            "special chars: àáâãäå",  # Accented characters
        ]

        for edge_case in string_cases:
            result = deserializer(edge_case)
            assert result == edge_case, (
                f"Failed for input {edge_case!r}: expected {edge_case!r}, got {result!r}"
            )

        # Test cases that are valid JSON and should be parsed
        json_cases = [
            ("0", 0),  # Valid JSON number
        ]

        for json_str, expected in json_cases:
            result = deserializer(json_str)
            assert result == expected, (
                f"Failed for input {json_str!r}: expected {expected!r}, got {result!r}"
            )

        # Non-standard JSON values: Python's json module accepts these and
        # returns float representations even though they're not part of the
        # official JSON specification.
        nonstandard_cases = [
            ("NaN", math.isnan),
            ("Infinity", lambda v: math.isinf(v) and v > 0),
            ("-Infinity", lambda v: math.isinf(v) and v < 0),
        ]

        for json_str, predicate in nonstandard_cases:
            result = deserializer(json_str)
            assert isinstance(result, float), (
                f"Failed for input {json_str!r}: expected float, got {type(result).__name__}: {result!r}"
            )
            assert predicate(result), (
                f"Failed for input {json_str!r}: float did not meet predicate, got {result!r}"
            )

    def _get_handle_deserialize_function(self):
        """Helper method to extract the handle_deserialize function for testing."""
        # We need to access the handle_deserialize function that's defined inside
        # the component creation process. Since it's a local function, we'll
        # simulate the creation process or create a standalone version for testing.

        def handle_deserialize(s: str | None) -> Any:
            """Standalone version of the handle_deserialize function for testing."""
            if s is None:
                return None
            try:
                return json.loads(s)
            except json.JSONDecodeError:
                return s

        return handle_deserialize

    def test_string_values_work_in_trigger_updates(self):
        """Integration test: verify string values work properly in trigger updates."""
        # Test that string values that aren't valid JSON are handled correctly
        # in the context of actual trigger updates

        widget_states = WidgetStates()

        # Test with a plain string value (not valid JSON)
        ws_component = WidgetState(id=_make_trigger_id(self.component_id, "events"))
        ws_component.json_trigger_value = json.dumps(
            {"event": "text", "value": "plain string value"}
        )
        widget_states.widgets.append(ws_component)

        # Process the widget states
        self.script_run_ctx.session_state.on_script_will_rerun(widget_states)

        # Verify the trigger value is accessible and equals the original object (wrapped in list)
        text_trigger_id = _make_trigger_id(self.component_id, "events")
        trigger_value = self.script_run_ctx.session_state[text_trigger_id]

        assert trigger_value == [{"event": "text", "value": "plain string value"}]

        # Verify the callback was called
        self.text_trigger_cb.assert_called_once()

    def test_mixed_json_and_string_values_in_triggers(self):
        """Integration test: verify both JSON and string values work together."""
        widget_states = WidgetStates()

        # Combine both triggers into a single aggregator payload list
        agg_id = _make_trigger_id(self.component_id, "events")
        ws_both = WidgetState(id=agg_id)
        ws_both.json_trigger_value = json.dumps(
            [
                {"event": "range", "value": 42},
                {"event": "text", "value": "user input text"},
            ]
        )
        widget_states.widgets.append(ws_both)

        # Process the widget states
        self.script_run_ctx.session_state.on_script_will_rerun(widget_states)

        # Verify both values are correctly deserialized
        agg_id = _make_trigger_id(self.component_id, "events")
        agg_value = self.script_run_ctx.session_state[agg_id]
        assert isinstance(agg_value, list)
        by_event = {item["event"]: item["value"] for item in agg_value}
        assert by_event["range"] == 42
        assert by_event["text"] == "user input text"

        # Verify both callbacks were called
        self.range_trigger_cb.assert_called_once()
        self.text_trigger_cb.assert_called_once()

    def test_empty_string_json_trigger_value_does_not_crash(self):
        """Test that an empty string json_trigger_value doesn't cause issues."""
        # Simulate a trigger update with an empty string
        widget_states = WidgetStates()
        ws_component = WidgetState(id=_make_trigger_id(self.component_id, "events"))
        ws_component.json_trigger_value = json.dumps({"event": "range", "value": ""})
        widget_states.widgets.append(ws_component)

        # Process the widget states
        self.script_run_ctx.session_state.on_script_will_rerun(widget_states)

        # Access the trigger value - this should work without throwing an exception
        range_id = _make_trigger_id(self.component_id, "events")
        trigger_value = self.script_run_ctx.session_state[range_id]

        # The trigger value should be a list with one object with empty string value
        assert trigger_value == [{"event": "range", "value": ""}]

        # The callback should have been called since we have a non-None value
        self.range_trigger_cb.assert_called_once()

    def test_whitespace_json_trigger_value_preserves_whitespace(self):
        """Test that whitespace-only json_trigger_value preserves the whitespace."""
        # Simulate a trigger update with whitespace
        widget_states = WidgetStates()
        ws_component = WidgetState(id=_make_trigger_id(self.component_id, "events"))
        ws_component.json_trigger_value = json.dumps({"event": "range", "value": "   "})
        widget_states.widgets.append(ws_component)

        # Process the widget states
        self.script_run_ctx.session_state.on_script_will_rerun(widget_states)

        # Access the trigger value
        range_id = _make_trigger_id(self.component_id, "events")
        trigger_value = self.script_run_ctx.session_state[range_id]

        # The trigger value should preserve the whitespace within the object
        assert trigger_value == [{"event": "range", "value": "   "}]

        # The callback should have been called since we have a non-None value
        self.range_trigger_cb.assert_called_once()

    def test_deserializer_lambda_handles_edge_cases(self):
        """Test the deserializer lambda function directly with various edge cases."""
        # This test is now updated to test the new handle_deserialize function
        deserializer = self._get_handle_deserialize_function()

        # Test cases that should work with the new deserializer
        assert deserializer(None) is None
        assert deserializer("null") is None
        assert deserializer('"hello"') == "hello"
        assert deserializer("123") == 123
        assert deserializer('{"key": "value"}') == {"key": "value"}

        # Test string values that aren't JSON - these should return as strings
        assert deserializer("") == ""
        assert deserializer("   ") == "   "
        assert deserializer(" ") == " "
        assert deserializer("\n") == "\n"
        assert deserializer("\t") == "\t"
        assert deserializer("plain text") == "plain text"
        assert deserializer("not json") == "not json"

        # All of these should work without raising JSONDecodeError
        test_cases = ["", "   ", " ", "\n", "\t", "plain text", "user input"]
        for s in test_cases:
            assert deserializer(s) == s
