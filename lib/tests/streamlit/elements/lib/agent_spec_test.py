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

import pytest

from streamlit.elements.lib import agent_spec
from streamlit.elements.lib.column_config_utils import INDEX_IDENTIFIER
from streamlit.proto.Image_pb2 import Image as ImageProto


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


def test_described_column_config_drops_presentation_and_index() -> None:
    """Column config is reported from the resolved mapping, without layout."""
    described = agent_spec.described_column_config(
        {
            "notes": {
                "label": "Notes",
                "width": 100,
                "alignment": "left",
                "pinned": True,
                "hidden": False,
            },
            INDEX_IDENTIFIER: {"width": 20},
            "secret": {"hidden": True},
        }
    )

    assert described == {
        "notes": {"label": "Notes", "hidden": False},
        "secret": {"hidden": True},
    }
    assert agent_spec.described_column_config({INDEX_IDENTIFIER: {"width": 1}}) is None
    assert agent_spec.described_column_config("unchanged") == "unchanged"


def test_proto_alt_distinguishes_missing_from_empty() -> None:
    """An empty alt is a real value: it marks an image as decorative."""
    image = ImageProto()
    assert agent_spec.proto_alt(image) is None
    image.alt = ""
    assert agent_spec.proto_alt(image) == ""


def test_block_marks_a_transparent_wrapper() -> None:
    """An internal wrapper says so, and carries no public parameters."""
    encoded = agent_spec.block("container", transparent=True, border=None)
    assert encoded is not None
    decoded = json.loads(encoded)
    assert decoded["transparent"] is True
    assert decoded["props"] == {}
