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

from types import SimpleNamespace
from typing import Any

from streamlit.components.v2.presentation import make_bidi_component_presenter


class _FakeWStates:
    def __init__(self) -> None:
        self.widget_metadata: dict[str, Any] = {}
        self._payloads: dict[str, Any] = {}

    def __getitem__(self, k: str) -> Any:  # emulate WStates __getitem__
        if k not in self._payloads:
            raise KeyError(k)
        return self._payloads[k]


class _FakeSession:
    def __init__(self) -> None:
        self._new_widget_state = _FakeWStates()


def test_bidi_presenter_merges_events_when_present() -> None:
    """Test that the presenter correctly merges event payloads into the base state."""
    ss = _FakeSession()
    agg_id = "$$_internal__wid__events"
    presenter = make_bidi_component_presenter(agg_id)

    ss._new_widget_state.widget_metadata[agg_id] = SimpleNamespace(
        value_type="json_trigger_value"
    )
    ss._new_widget_state._payloads[agg_id] = [
        {"event": "foo", "value": True},
        {"event": "bar", "value": 123},
    ]

    base = {"value": {"alpha": 1}}
    out = presenter(base, ss)
    assert out == {"value": {"alpha": 1, "foo": True, "bar": 123}}


def test_bidi_presenter_handles_non_list_payload() -> None:
    """Test that the presenter can handle a single, non-list event payload."""
    ss = _FakeSession()
    agg_id = "$$_internal__wid__events"
    presenter = make_bidi_component_presenter(agg_id)
    ss._new_widget_state.widget_metadata[agg_id] = SimpleNamespace(
        value_type="json_trigger_value"
    )
    ss._new_widget_state._payloads[agg_id] = {"event": "foo", "value": "x"}

    base = {"value": {}}
    out = presenter(base, ss)
    assert out == {"value": {"foo": "x"}}


def test_bidi_presenter_returns_base_on_missing_meta_or_wrong_type() -> None:
    """Test that the presenter returns the base value if metadata is missing or incorrect."""
    ss = _FakeSession()
    agg_id = "$$_internal__wid__events"
    presenter = make_bidi_component_presenter(agg_id)

    base = {"value": {"beta": 2}}
    # No metadata
    assert presenter(base, ss) == base

    # Wrong value type
    ss._new_widget_state.widget_metadata[agg_id] = SimpleNamespace(value_type="json")
    assert presenter(base, ss) == base


def test_bidi_presenter_returns_base_on_non_canonical_state_shape() -> None:
    """Test that the presenter returns the base value if the state shape is not canonical."""
    ss = _FakeSession()
    agg_id = "$$_internal__wid__events"
    presenter = make_bidi_component_presenter(agg_id)
    ss._new_widget_state.widget_metadata[agg_id] = SimpleNamespace(
        value_type="json_trigger_value"
    )
    base = {"not_value": {}}
    assert presenter(base, ss) == base
