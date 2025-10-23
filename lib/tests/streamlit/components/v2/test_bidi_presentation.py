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

import copy
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from streamlit.components.v2.presentation import make_bidi_component_presenter
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state import SessionState


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

    base = {"alpha": 1}
    out = presenter(base, ss)
    assert dict(out) == {"alpha": 1, "foo": True, "bar": 123}


def test_bidi_presenter_handles_non_list_payload() -> None:
    """Test that the presenter can handle a single, non-list event payload."""
    ss = _FakeSession()
    agg_id = "$$_internal__wid__events"
    presenter = make_bidi_component_presenter(agg_id)
    ss._new_widget_state.widget_metadata[agg_id] = SimpleNamespace(
        value_type="json_trigger_value"
    )
    ss._new_widget_state._payloads[agg_id] = {"event": "foo", "value": "x"}

    base = {}
    out = presenter(base, ss)
    assert dict(out) == {"foo": "x"}


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


def test_setitem_disallows_setting_created_widget():
    """Test that __setitem__ disallows setting a created widget."""
    mock_session_state = MagicMock(spec=SessionState)
    mock_session_state._key_id_mapper = MagicMock()
    mock_session_state._key_id_mapper.get_key_from_id.return_value = "test_key"
    mock_session_state._new_widget_state = MagicMock()
    mock_session_state._new_widget_state.widget_metadata.get.return_value = MagicMock(
        value_type="json_trigger_value"
    )

    mock_ctx = MagicMock()
    mock_ctx.widget_ids_this_run = {"test_component_id"}
    mock_ctx.form_ids_this_run = set()

    presenter = make_bidi_component_presenter(
        aggregator_id="test_aggregator_id",
        component_id="test_component_id",
    )
    write_through_dict = presenter({}, mock_session_state)

    with patch(
        "streamlit.components.v2.presentation.get_script_run_ctx",
        return_value=mock_ctx,
    ):
        with pytest.raises(StreamlitAPIException) as e:
            write_through_dict["value"] = "new_value"
        assert (
            "`st.session_state.test_key.value` cannot be modified after the component"
            in str(e.value)
        )


def test_delitem_disallows_deleting_from_created_widget():
    """Test that __delitem__ disallows deleting from a created widget."""
    mock_session_state = MagicMock(spec=SessionState)
    mock_session_state._key_id_mapper = MagicMock()
    mock_session_state._key_id_mapper.get_key_from_id.return_value = "test_key"
    mock_session_state._new_widget_state = MagicMock()
    mock_session_state._new_widget_state.widget_metadata.get.return_value = MagicMock(
        value_type="json_trigger_value"
    )

    mock_ctx = MagicMock()
    mock_ctx.widget_ids_this_run = {"test_component_id"}
    mock_ctx.form_ids_this_run = set()

    presenter = make_bidi_component_presenter(
        aggregator_id="test_aggregator_id",
        component_id="test_component_id",
    )
    write_through_dict = presenter({"value": "old_value"}, mock_session_state)

    with patch(
        "streamlit.components.v2.presentation.get_script_run_ctx",
        return_value=mock_ctx,
    ):
        with pytest.raises(StreamlitAPIException) as e:
            del write_through_dict["value"]
        assert (
            "`st.session_state.test_key.value` cannot be modified after the component"
            in str(e.value)
        )


def test_setitem_disallows_setting_widget_in_form():
    """Test that __setitem__ disallows setting a widget in a form."""
    mock_session_state = MagicMock(spec=SessionState)
    mock_session_state._key_id_mapper = MagicMock()
    mock_session_state._key_id_mapper.get_key_from_id.return_value = "test_key"
    mock_session_state._new_widget_state = MagicMock()
    mock_session_state._new_widget_state.widget_metadata.get.return_value = MagicMock(
        value_type="json_trigger_value"
    )

    mock_ctx = MagicMock()
    mock_ctx.widget_ids_this_run = set()
    mock_ctx.form_ids_this_run = {"test_key"}

    presenter = make_bidi_component_presenter(
        aggregator_id="test_aggregator_id",
        component_id="test_component_id",
    )
    write_through_dict = presenter({}, mock_session_state)

    with patch(
        "streamlit.components.v2.presentation.get_script_run_ctx",
        return_value=mock_ctx,
    ):
        with pytest.raises(StreamlitAPIException) as e:
            write_through_dict["value"] = "new_value"
        assert (
            "`st.session_state.test_key.value` cannot be modified after the component"
            in str(e.value)
        )


def test_setitem_allows_setting_before_widget_creation():
    """Test that __setitem__ allows setting state before widget creation."""
    mock_session_state = MagicMock(spec=SessionState)
    mock_session_state._key_id_mapper = MagicMock()
    mock_session_state._key_id_mapper.get_key_from_id.return_value = "test_key"
    mock_session_state._new_widget_state = MagicMock()
    mock_session_state._new_widget_state.widget_metadata.get.return_value = MagicMock(
        value_type="json_trigger_value"
    )

    mock_ctx = MagicMock()
    mock_ctx.widget_ids_this_run = set()
    mock_ctx.form_ids_this_run = set()

    presenter = make_bidi_component_presenter(
        aggregator_id="test_aggregator_id",
        component_id="test_component_id",
    )
    write_through_dict = presenter({}, mock_session_state)

    with patch(
        "streamlit.components.v2.presentation.get_script_run_ctx",
        return_value=mock_ctx,
    ):
        try:
            write_through_dict["value"] = "new_value"
        except StreamlitAPIException as e:
            pytest.fail(f"Setting state before creation raised an exception: {e}")


def test_deepcopy_returns_self():
    """Test that deepcopy returns the same object."""
    mock_session_state = MagicMock(spec=SessionState)
    mock_session_state._key_id_mapper = MagicMock()
    mock_session_state._new_widget_state = MagicMock()
    mock_session_state._new_widget_state.widget_metadata.get.return_value = MagicMock(
        value_type="json_trigger_value"
    )

    presenter = make_bidi_component_presenter(
        aggregator_id="test_aggregator_id",
        component_id="test_component_id",
    )
    write_through_dict = presenter({}, mock_session_state)

    copied_dict = copy.deepcopy(write_through_dict)
    assert write_through_dict is copied_dict
