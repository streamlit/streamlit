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

"""Recording gate, prop pruning, and value-schema helpers for agent descriptions."""

from __future__ import annotations

import json
import math
from typing import Any
from unittest.mock import patch

import pandas as pd
import pytest

from streamlit.elements.lib import agent_spec


def _recorded(command: str, **props: Any) -> dict[str, Any]:
    """Encode one description. The module fixture turns recording on."""
    encoded = agent_spec.element(command, **props)
    assert encoded is not None
    decoded = json.loads(encoded)
    assert isinstance(decoded, dict)
    return decoded


@pytest.fixture(autouse=True)
def _force_recording(monkeypatch: pytest.MonkeyPatch) -> None:
    """Record in this module. The one test that checks the off switch disables it."""
    monkeypatch.setattr(agent_spec, "is_recording", lambda: True)


def test_recording_off_returns_none(monkeypatch: pytest.MonkeyPatch) -> None:
    """A session that is not recording builds no description."""
    monkeypatch.setattr(agent_spec, "is_recording", lambda: False)

    assert agent_spec.element("markdown", body="hello") is None
    assert agent_spec.block("container", border=False) is None


def test_drops_unset_parameters_at_any_depth() -> None:
    """None means an unset parameter, including inside a nested object.

    A null inside a list stays, because position in a list is meaningful.
    """
    decoded = _recorded(
        "dataframe",
        help=None,
        column_config={"notes": {"label": "Notes", "help": None, "width": "small"}},
        options=["a", None],
    )

    assert "help" not in decoded["props"]
    assert decoded["props"]["column_config"] == {
        "notes": {"label": "Notes", "width": "small"}
    }
    assert decoded["props"]["options"] == ["a", None]


def test_content_keeps_nulls() -> None:
    """A null in an element's body is data, not an unset parameter."""
    decoded = _recorded(
        "json",
        body=agent_spec.Content({"a": None, "nested": {"b": None}}),
        expanded=None,
    )

    assert decoded["props"]["body"] == {"a": None, "nested": {"b": None}}
    assert "expanded" not in decoded["props"]


def test_nan_prop_becomes_null() -> None:
    """A non-finite number has no JSON form, so it is reported as null."""
    decoded = _recorded("metric", value=math.nan)
    assert decoded["props"]["value"] is None


def test_cyclic_dict_prop_does_not_recurse() -> None:
    """A prop that contains itself is left for the encoder instead of looping."""
    cycle: dict[str, Any] = {}
    cycle["self"] = cycle
    decoded = _recorded("metric", column_config=cycle)
    repeated = decoded["props"]["column_config"]["self"]["self"]
    assert isinstance(repeated, str)


def test_nested_missing_values_stay_null() -> None:
    """A nested NaN or ``pd.NA`` stays null. Only an original ``None`` is dropped."""

    decoded = _recorded(
        "dataframe",
        column_config={"col": {"help": math.nan, "width": None, "label": pd.NA}},
    )
    assert decoded["props"]["column_config"] == {"col": {"help": None, "label": None}}


def test_command_type_parameter_is_a_prop() -> None:
    """``type`` is keyword-only on the helper so a button can pass its own."""
    decoded = _recorded("button", type="primary", action="trigger")
    assert decoded["type"] == "button"
    assert decoded["action"] == "trigger"
    assert decoded["props"]["type"] == "primary"


def test_value_schema_shapes() -> None:
    """The schema helpers describe shape only: a list, a pair, or a partial pair."""
    assert agent_spec.list_of(agent_spec.STRING) == {
        "type": "array",
        "items": {"type": "string"},
    }
    assert agent_spec.range_of(agent_spec.NUMBER) == {
        "type": "array",
        "items": {"type": "number"},
        "minItems": 2,
        "maxItems": 2,
    }
    assert agent_spec.range_of(agent_spec.DATE, partial=True) == {
        "type": "array",
        "items": {"type": "string", "format": "date"},
        "maxItems": 2,
    }


def test_block_marks_a_transparent_wrapper() -> None:
    """An internal wrapper says so, and carries no public parameters."""
    encoded = agent_spec.block("container", transparent=True, border=None)
    assert encoded is not None
    decoded = json.loads(encoded)
    assert decoded["transparent"] is True
    assert decoded["props"] == {}


def test_built_data_sits_beside_props() -> None:
    """The built block is the top-level `data` the serializer owns, never a prop.
    A builder that builds nothing, or none at all, reports no `data`.
    """
    block = {"complete": True, "url": "/media/abc"}
    decoded = _recorded("dataframe", data_builder=lambda: block, placeholder="-")

    assert decoded["data"] == block
    assert decoded["props"] == {"placeholder": "-"}
    assert "data" not in _recorded("dataframe", data_builder=lambda: None)
    assert "data" not in _recorded("dataframe", data_builder=None)


def test_data_builder_runs_only_while_recording(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A browser session never calls the builder, so nothing it reads costs it."""
    calls: list[str] = []

    def build() -> dict[str, Any]:
        calls.append("built")
        return {"complete": True}

    monkeypatch.setattr(agent_spec, "is_recording", lambda: False)
    assert agent_spec.element("dataframe", data_builder=build) is None
    assert calls == []

    monkeypatch.setattr(agent_spec, "is_recording", lambda: True)
    agent_spec.element("dataframe", data_builder=build)
    assert calls == ["built"]


def test_a_data_builder_that_raises_reports_no_data() -> None:
    """A bug in a builder becomes no `data`, logged at debug, never a failed command."""

    def broken() -> dict[str, Any]:
        raise ValueError("boom")

    with patch.object(agent_spec, "_LOGGER") as logger:
        decoded = _recorded("dataframe", data_builder=broken, placeholder="-")

    assert "data" not in decoded
    assert decoded["props"] == {"placeholder": "-"}
    logger.debug.assert_called_once()
    assert logger.debug.call_args.kwargs["exc_info"] is True


def test_decode_returns_an_object_and_ignores_malformed_input() -> None:
    """A description is a JSON object. Anything else is treated as undescribed."""
    assert agent_spec.decode('{"type": "markdown"}') == {"type": "markdown"}
    assert agent_spec.decode("{") == {}
    assert agent_spec.decode("[]") == {}
    assert agent_spec.decode("null") == {}
    assert agent_spec.decode(None) == {}
