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


# ============================================================================
# Additional coverage tests for make_bidi_component_presenter
# ============================================================================


def _script_run_ctx_mock() -> MagicMock:
    """Return a minimal script-run context mock for persist paths."""
    ctx = MagicMock()
    ctx.widget_ids_this_run = set()
    ctx.form_ids_this_run = set()
    return ctx


def _make_mock_session_state(
    agg_id: str,
    *,
    agg_meta_value_type: str | None = "json_trigger_value",
    agg_value: Any = None,
    agg_getitem_error: BaseException | None = None,
) -> MagicMock:
    """Build a ``SessionState`` mock wired for ``make_bidi_component_presenter`` tests.

    Parameters
    ----------
    agg_id
        Aggregator widget id passed to ``widget_metadata.get`` / ``__getitem__``.
    agg_meta_value_type
        ``value_type`` on metadata, or ``None`` to simulate missing metadata.
    agg_value
        Value returned when ``_new_widget_state[agg_id]`` is read (if no error).
    agg_getitem_error
        If set, ``__getitem__`` raises this instead of returning ``agg_value``.
    """
    ss = MagicMock(spec=SessionState)
    nws = MagicMock()

    if agg_meta_value_type is not None:
        meta = MagicMock()
        meta.value_type = agg_meta_value_type
        nws.widget_metadata.get.return_value = meta
    else:
        nws.widget_metadata.get.return_value = None

    if agg_getitem_error is not None:
        nws.__getitem__.side_effect = agg_getitem_error
    else:
        nws.__getitem__.return_value = agg_value

    ss._new_widget_state = nws
    ss._key_id_mapper = MagicMock()
    ss._key_id_mapper.get_key_from_id.return_value = "user_key"
    return ss


def test_presenter_returns_base_value_for_non_dict() -> None:
    """Non-dict ``base_value`` is returned unchanged (no write-through wrapper)."""
    agg_id = "agg"
    ss = _make_mock_session_state(agg_id)
    presenter = make_bidi_component_presenter(agg_id, component_id="cid")
    base: object = "not a dict"
    assert presenter(base, ss) is base


def test_presenter_returns_write_through_dict() -> None:
    """With trigger metadata and payloads, presenter returns a merged dict subclass."""
    agg_id = "agg"
    ss = _make_mock_session_state(
        agg_id,
        agg_value=[
            {"event": "click", "value": 1},
            {"event": "hover", "value": "x"},
        ],
    )
    presenter = make_bidi_component_presenter(agg_id, component_id="cid")
    base = {"base_k": True}
    out = presenter(base, ss)

    assert isinstance(out, dict)
    assert type(out) is not dict
    assert dict(out) == {"click": 1, "hover": "x", "base_k": True}


def test_write_through_getattr_uses_dict_get() -> None:
    """Attribute access delegates to ``dict.get`` via ``__getattr__``."""
    agg_id = "agg"
    ss = _make_mock_session_state(agg_id, agg_value=[])
    presenter = make_bidi_component_presenter(agg_id, component_id="cid")
    wt = presenter({"a": 7}, ss)
    assert wt.a == 7
    assert wt.missing is None


def test_write_through_setattr_private_name() -> None:
    """Names starting with ``_`` use ``object.__setattr__`` (not ``__setitem__``)."""
    agg_id = "agg"
    ss = _make_mock_session_state(agg_id, agg_value=[])
    presenter = make_bidi_component_presenter(agg_id, component_id="cid")
    wt = presenter({}, ss)

    with patch(
        "streamlit.components.v2.presentation.get_script_run_ctx",
        return_value=None,
    ):
        wt._private = 42

    assert wt._private == 42
    assert "_private" not in wt
    ss._new_widget_state.set_from_value.assert_not_called()


def test_write_through_setattr_public_name() -> None:
    """Public attribute assignment routes through ``__setitem__`` and persists."""
    agg_id = "agg"
    comp_id = "comp"
    ss = _make_mock_session_state(agg_id, agg_value=[])
    presenter = make_bidi_component_presenter(agg_id, component_id=comp_id)
    wt = presenter({}, ss)

    mock_ctx = _script_run_ctx_mock()
    with patch(
        "streamlit.components.v2.presentation.get_script_run_ctx",
        return_value=mock_ctx,
    ):
        wt.my_key = 99

    assert wt["my_key"] == 99
    ss._new_widget_state.set_from_value.assert_called_with(comp_id, {"my_key": 99})


def test_write_through_setitem_with_allowed_keys_filter() -> None:
    """Keys outside ``allowed_state_keys`` are ignored (no persist, no dict entry)."""
    agg_id = "agg"
    comp_id = "comp"
    ss = _make_mock_session_state(agg_id, agg_value=[])
    presenter = make_bidi_component_presenter(
        agg_id, component_id=comp_id, allowed_state_keys={"foo"}
    )
    wt = presenter({"foo": 1}, ss)

    mock_ctx = _script_run_ctx_mock()
    with patch(
        "streamlit.components.v2.presentation.get_script_run_ctx",
        return_value=mock_ctx,
    ):
        wt["bar"] = 2

    assert "bar" not in wt
    ss._new_widget_state.set_from_value.assert_not_called()


def test_write_through_setitem_persist_error() -> None:
    """Persist failures on ``__setitem__`` are swallowed and logged at debug."""
    agg_id = "agg"
    comp_id = "comp"
    ss = _make_mock_session_state(agg_id, agg_value=[])
    ss._new_widget_state.set_from_value.side_effect = RuntimeError("persist failed")
    presenter = make_bidi_component_presenter(agg_id, component_id=comp_id)
    wt = presenter({}, ss)

    mock_ctx = _script_run_ctx_mock()
    with (
        patch(
            "streamlit.components.v2.presentation.get_script_run_ctx",
            return_value=mock_ctx,
        ),
        patch("streamlit.components.v2.presentation._LOGGER.debug") as debug_mock,
    ):
        wt["k"] = 1

    assert wt["k"] == 1
    debug_mock.assert_called()
    assert "Failed to persist CCv2 state update" in debug_mock.call_args[0][0]


def test_write_through_delitem() -> None:
    """``__delitem__`` removes the key and persists the updated mapping."""
    agg_id = "agg"
    comp_id = "comp"
    ss = _make_mock_session_state(agg_id, agg_value=[])
    presenter = make_bidi_component_presenter(agg_id, component_id=comp_id)
    wt = presenter({"a": 1, "b": 2}, ss)

    mock_ctx = _script_run_ctx_mock()
    with patch(
        "streamlit.components.v2.presentation.get_script_run_ctx",
        return_value=mock_ctx,
    ):
        del wt["a"]

    assert "a" not in wt
    assert wt["b"] == 2
    ss._new_widget_state.set_from_value.assert_called_with(comp_id, {"b": 2})


def test_write_through_delitem_persist_error() -> None:
    """Persist failures on delete are swallowed and logged at debug."""
    agg_id = "agg"
    comp_id = "comp"
    ss = _make_mock_session_state(agg_id, agg_value=[])
    ss._new_widget_state.set_from_value.side_effect = RuntimeError("persist failed")
    presenter = make_bidi_component_presenter(agg_id, component_id=comp_id)
    wt = presenter({"x": 1}, ss)

    mock_ctx = _script_run_ctx_mock()
    with (
        patch(
            "streamlit.components.v2.presentation.get_script_run_ctx",
            return_value=mock_ctx,
        ),
        patch("streamlit.components.v2.presentation._LOGGER.debug") as debug_mock,
    ):
        del wt["x"]

    assert "x" not in wt
    debug_mock.assert_called()
    assert "Failed to persist CCv2 state deletion" in debug_mock.call_args[0][0]


def test_presenter_returns_base_on_metadata_missing() -> None:
    """Missing aggregator metadata returns ``base_value`` without merging."""
    agg_id = "agg"
    ss = _make_mock_session_state(agg_id, agg_meta_value_type=None, agg_value=[])
    presenter = make_bidi_component_presenter(agg_id, component_id="cid")
    base = {"only": "base"}
    assert presenter(base, ss) is base


def test_presenter_returns_base_on_unexpected_merge_error() -> None:
    """Unexpected errors in the merge path fall back to ``base_value`` and log."""
    agg_id = "agg"
    ss = _make_mock_session_state(
        agg_id,
        agg_value=[],
        agg_getitem_error=RuntimeError("unexpected"),
    )
    presenter = make_bidi_component_presenter(agg_id, component_id="cid")
    base = {"k": 1}
    with patch("streamlit.components.v2.presentation._LOGGER.debug") as debug_mock:
        out = presenter(base, ss)

    assert out is base
    debug_mock.assert_called()
    assert (
        "Failed to merge trigger events into component state"
        in debug_mock.call_args[0][0]
    )
