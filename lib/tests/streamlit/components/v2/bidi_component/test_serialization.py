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

import pandas as pd

from streamlit.components.v2.bidi_component.serialization import (
    BidiComponentSerde,
    _extract_dataframes_from_dict,
    deserialize_trigger_list,
    handle_deserialize,
    serialize_mixed_data,
)
from streamlit.proto.BidiComponent_pb2 import BidiComponent as BidiComponentProto


def test_handle_deserialize():
    """Test handle_deserialize with valid JSON, invalid JSON, and None."""
    assert handle_deserialize('{"key": "value"}') == {"key": "value"}
    assert handle_deserialize("not a json string") == "not a json string"
    assert handle_deserialize(None) is None


def test_deserialize_trigger_list():
    """Test deserialize_trigger_list with different payload formats."""
    assert deserialize_trigger_list('[{"event": "click"}]') == [{"event": "click"}]
    assert deserialize_trigger_list('{"event": "click"}') == [{"event": "click"}]
    assert deserialize_trigger_list(None) is None


def test_serde_deserialize_with_dict():
    """Test deserialize with a dictionary."""
    serde = BidiComponentSerde()
    state = serde.deserialize({"foo": "bar"})
    assert state == {"foo": "bar"}


def test_serde_deserialize_with_json_string():
    """Test deserialize with a JSON string."""
    serde = BidiComponentSerde()
    state = serde.deserialize('{"foo": "bar"}')
    assert state == {"foo": "bar"}


def test_serde_deserialize_with_defaults():
    """Test deserialize with default values."""
    serde = BidiComponentSerde(default={"bar": "baz"})
    state = serde.deserialize({"foo": "qux"})
    assert state == {"foo": "qux", "bar": "baz"}


def test_serde_deserialize_with_none():
    """Test deserialize with None."""
    serde = BidiComponentSerde()
    state = serde.deserialize(None)
    assert state == {}


def test_serde_serialize():
    """Test serialize."""
    serde = BidiComponentSerde()
    serialized = serde.serialize({"foo": "bar"})
    assert serialized == '{"foo": "bar"}'


def test_serde_deserialize_with_defaults_empty_state():
    """Test that defaults are applied when state is empty."""
    defaults = {"count": 0, "message": "hello", "enabled": True}
    serde = BidiComponentSerde(default=defaults)

    # Deserialize empty state
    result = serde.deserialize(None)

    # Should have defaults applied
    assert result["count"] == 0
    assert result["message"] == "hello"
    assert result["enabled"] is True


def test_serde_deserialize_with_defaults_partial_state():
    """Test that defaults are applied only for missing keys."""
    defaults = {"count": 0, "message": "hello", "enabled": True}
    serde = BidiComponentSerde(default=defaults)

    # Deserialize partial state
    partial_state = {"count": 5, "message": "custom"}
    result = serde.deserialize(json.dumps(partial_state))

    # Should preserve existing values and add missing defaults
    assert result["count"] == 5  # Existing value preserved
    assert result["message"] == "custom"  # Existing value preserved
    assert result["enabled"] is True  # Default applied


def test_serde_deserialize_with_defaults_complete_state():
    """Test that defaults don't override existing values."""
    defaults = {"count": 0, "message": "hello"}
    serde = BidiComponentSerde(default=defaults)

    # Deserialize complete state
    complete_state = {"count": 10, "message": "world", "extra": "data"}
    result = serde.deserialize(json.dumps(complete_state))

    # Should preserve all existing values
    assert result["count"] == 10
    assert result["message"] == "world"
    assert result["extra"] == "data"


def test_serde_deserialize_without_defaults():
    """Test that serde works correctly without defaults."""
    serde = BidiComponentSerde()  # No defaults

    # Deserialize state
    state = {"count": 5}
    result = serde.deserialize(json.dumps(state))

    # Should just return the state as-is
    assert result["count"] == 5


def test_serde_deserialize_with_invalid_json():
    """Test that defaults are applied even with invalid JSON input."""
    defaults = {"fallback": "value"}
    serde = BidiComponentSerde(default=defaults)

    # Deserialize invalid JSON
    result = serde.deserialize("invalid json {")

    # Should fall back to empty state with defaults applied
    assert result["fallback"] == "value"


def test_serde_deserialize_with_dict_input_and_defaults():
    """Test that defaults work with direct dict input."""
    defaults = {"default_key": "default_value"}
    serde = BidiComponentSerde(default=defaults)

    # Deserialize dict input
    input_dict = {"existing_key": "existing_value"}
    result = serde.deserialize(input_dict)

    # Should merge defaults with existing
    assert result["existing_key"] == "existing_value"
    assert result["default_key"] == "default_value"


def test_serde_deserialize_with_none_defaults():
    """Test that None values in defaults are properly handled."""
    defaults = {"nullable": None, "string": "value"}
    serde = BidiComponentSerde(default=defaults)

    # Deserialize empty state
    result = serde.deserialize(None)

    # Should apply None as a valid default
    assert result["nullable"] is None
    assert result["string"] == "value"


def test_extract_dataframes_from_dict():
    """Test _extract_dataframes_from_dict."""
    df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
    data = {"key1": "value1", "dataframe": df, "key2": 123}

    arrow_blobs = {}
    processed_data = _extract_dataframes_from_dict(data, arrow_blobs)

    assert "key1" in processed_data
    assert "key2" in processed_data
    assert "dataframe" in processed_data
    assert "__streamlit_arrow_ref__" in processed_data["dataframe"]
    assert len(arrow_blobs) == 1


def test_serialize_mixed_data_with_dataframe():
    """Test serialize_mixed_data with a dataframe."""
    df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
    data = {"my_df": df, "other_key": "value"}
    proto = BidiComponentProto()

    serialize_mixed_data(data, proto)

    assert proto.HasField("mixed")
    assert not proto.HasField("json")
    mixed_data = json.loads(proto.mixed.json)
    assert "my_df" in mixed_data
    assert "__streamlit_arrow_ref__" in mixed_data["my_df"]
    assert len(proto.mixed.arrow_blobs) == 1


def test_serialize_mixed_data_without_dataframe():
    """Test serialize_mixed_data without a dataframe."""
    data = {"key": "value"}
    proto = BidiComponentProto()

    serialize_mixed_data(data, proto)

    assert not proto.HasField("mixed")
    assert proto.HasField("json")
    assert json.loads(proto.json) == data


def test_serialize_mixed_data_with_non_dict():
    """Test serialize_mixed_data with non-dictionary data."""
    data = [1, 2, 3]
    proto = BidiComponentProto()

    serialize_mixed_data(data, proto)

    assert not proto.HasField("mixed")
    assert proto.HasField("json")
    assert json.loads(proto.json) == data


def test_serialization_fallback_to_string():
    """Test that serialization falls back to string representation on failure."""
    # Sets are not directly JSON-serializable
    data = {"key": {1, 2, 3}}
    proto = BidiComponentProto()

    serialize_mixed_data(data, proto)

    assert not proto.HasField("mixed")
    assert proto.HasField("json")
    assert json.loads(proto.json) == str(data)
