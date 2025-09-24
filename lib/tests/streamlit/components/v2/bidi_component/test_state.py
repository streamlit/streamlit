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

from streamlit.components.v2.bidi_component.state import (
    BidiComponentResult,
    unwrap_component_state,
)


def test_unwrap_component_state() -> None:
    """Test unwrap_component_state with valid and invalid state structures."""
    valid_state = {"value": {"foo": "bar"}}
    assert unwrap_component_state(valid_state) == {"foo": "bar"}

    invalid_state_1 = {"foo": "bar"}  # Missing 'value' key
    assert unwrap_component_state(invalid_state_1) == {}

    invalid_state_2 = {"value": "not a dict"}
    assert unwrap_component_state(invalid_state_2) == {}


def test_bidi_component_result_merges_state_and_trigger_values() -> None:
    """Test that BidiComponentResult surfaces trigger and state values."""

    state_vals = {"foo": "bar"}
    trigger_vals = {"on_click": 42}

    result = BidiComponentResult(state_vals=state_vals, trigger_vals=trigger_vals)

    assert result["foo"] == "bar"
    assert result.foo == "bar"
    assert result["on_click"] == 42
    assert result.on_click == 42
    assert "delta_generator" not in result


def test_bidi_component_result_merge_order() -> None:
    """Test that trigger keys precede state keys and state overrides duplicates."""

    state_vals = {"shared": "state", "state_only": "value"}
    trigger_vals = {"shared": "trigger", "trigger_only": "value"}

    result = BidiComponentResult(state_vals=state_vals, trigger_vals=trigger_vals)

    assert list(result.keys()) == ["shared", "trigger_only", "state_only"]
    assert result.shared == "state"
