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
from typing import Any, Final
from unittest.mock import MagicMock, patch

import pytest

from streamlit.components.v2.presentation import make_bidi_component_presenter
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state import SessionState

_AGGREGATOR_WIDGET_ID: Final = "agg"


class _FakeWStates:
    """Minimal widget-state store for presenter tests."""

    def __init__(self) -> None:
        self.widget_metadata: dict[str, Any] = {}
        self._payloads: dict[str, Any] = {}
        self.set_from_value_calls: list[tuple[str, dict[str, Any]]] = []

    def __getitem__(self, k: str) -> Any:
        if k not in self._payloads:
            raise KeyError(k)
        return self._payloads[k]

    def set_from_value(self, widget_id: str, value: Any) -> None:
        self.set_from_value_calls.append((widget_id, dict(value)))


class _FakeKeyIdMapper:
    """Minimal key-id mapper that returns the widget_id as the user key."""

    def get_key_from_id(self, widget_id: str) -> str:
        return widget_id


class _FakeSession:
    """SessionState stand-in with the attributes ``presentation`` reads."""

    def __init__(self) -> None:
        self._new_widget_state = _FakeWStates()
        self._key_id_mapper = _FakeKeyIdMapper()


def _make_ready_session(widget_id: str = _AGGREGATOR_WIDGET_ID) -> _FakeSession:
    """Return a fake session with valid trigger-aggregator metadata for ``widget_id``."""
    ss = _FakeSession()
    ss._new_widget_state.widget_metadata[widget_id] = SimpleNamespace(
        value_type="json_trigger_value"
    )
    ss._new_widget_state._payloads[widget_id] = []
    return ss


@pytest.mark.parametrize(
    "base_value",
    [None, 0, "text", [1, 2], (3, 4)],
    ids=["none", "int", "str", "list", "tuple"],
)
def test_presenter_returns_non_dict_base_unchanged(base_value: object) -> None:
    """Non-mapping ``base_value`` is returned without reading widget state."""
    ss = _FakeSession()
    presenter = make_bidi_component_presenter(_AGGREGATOR_WIDGET_ID)
    assert presenter(base_value, ss) is base_value


@pytest.mark.parametrize(
    "meta",
    [None, SimpleNamespace(value_type="other")],
    ids=["missing_meta", "wrong_value_type"],
)
def test_presenter_skips_merge_when_aggregator_meta_invalid(
    meta: SimpleNamespace | None,
) -> None:
    """Missing or non-trigger aggregator metadata yields the original dict."""
    ss = _FakeSession()
    if meta is not None:
        ss._new_widget_state.widget_metadata[_AGGREGATOR_WIDGET_ID] = meta

    presenter = make_bidi_component_presenter(_AGGREGATOR_WIDGET_ID)
    base: dict[str, object] = {"k": 1}
    out = presenter(base, ss)

    assert out is base


def test_presenter_falls_back_to_base_on_unexpected_error() -> None:
    """Any exception while merging triggers is swallowed; base dict is returned."""
    mock_session_state = MagicMock(spec=SessionState)
    mock_session_state._new_widget_state = MagicMock()
    mock_session_state._new_widget_state.widget_metadata.get.side_effect = RuntimeError(
        "boom"
    )

    presenter = make_bidi_component_presenter(_AGGREGATOR_WIDGET_ID)
    base: dict[str, object] = {"a": 1}
    assert presenter(base, mock_session_state) is base


def test_presenter_merge_when_aggregator_value_missing() -> None:
    """A ``KeyError`` reading aggregator payloads is treated as no trigger events."""
    ss = _FakeSession()
    ss._new_widget_state.widget_metadata[_AGGREGATOR_WIDGET_ID] = SimpleNamespace(
        value_type="json_trigger_value"
    )

    presenter = make_bidi_component_presenter(_AGGREGATOR_WIDGET_ID)
    base: dict[str, object] = {"only": "base"}
    out = presenter(base, ss)

    assert dict(out) == {"only": "base"}


def test_presenter_payload_list_skips_non_dict_entries() -> None:
    """Only mapping entries in a list payload contribute trigger keys."""
    ss = _make_ready_session()
    ss._new_widget_state._payloads[_AGGREGATOR_WIDGET_ID] = [
        "not-a-dict",
        {"event": "keep", "value": 1},
        42,
    ]
    presenter = make_bidi_component_presenter(_AGGREGATOR_WIDGET_ID)
    base: dict[str, object] = {"base": True}

    assert dict(presenter(base, ss)) == {"keep": 1, "base": True}


def test_presenter_ignores_payloads_with_non_string_event() -> None:
    """Trigger entries whose ``event`` is not a string are ignored."""
    ss = _make_ready_session()
    ss._new_widget_state._payloads[_AGGREGATOR_WIDGET_ID] = [
        {"event": 99, "value": "ignored"},
        {"event": "ok", "value": 0},
    ]
    presenter = make_bidi_component_presenter(_AGGREGATOR_WIDGET_ID)

    assert dict(presenter({}, ss)) == {"ok": 0}


def test_presenter_unexpected_payload_type_yields_no_triggers() -> None:
    """Non-list, non-dict aggregator values produce no merged trigger keys."""
    ss = _make_ready_session()
    ss._new_widget_state._payloads[_AGGREGATOR_WIDGET_ID] = "weird"
    presenter = make_bidi_component_presenter(_AGGREGATOR_WIDGET_ID)
    base: dict[str, object] = {"x": 1}

    assert dict(presenter(base, ss)) == {"x": 1}


def test_presenter_single_dict_payload_merges_one_event() -> None:
    """A bare dict stored for the aggregator is treated as one trigger payload."""
    ss = _make_ready_session()
    ss._new_widget_state._payloads[_AGGREGATOR_WIDGET_ID] = {
        "event": "solo",
        "value": "y",
    }
    presenter = make_bidi_component_presenter(_AGGREGATOR_WIDGET_ID)

    assert dict(presenter({"b": 1}, ss)) == {"solo": "y", "b": 1}


def test_write_through_deepcopy_returns_same_proxy() -> None:
    """Deep copy must not duplicate the write-through proxy to session state."""
    ss = _make_ready_session()
    presenter = make_bidi_component_presenter(_AGGREGATOR_WIDGET_ID, component_id="cid")
    wt = presenter({}, ss)

    copied = copy.deepcopy(wt)
    assert copied is wt


def test_write_through_getattr_uses_mapping_get() -> None:
    """Attribute access on the proxy delegates to ``dict.get``."""
    ss = _make_ready_session()
    presenter = make_bidi_component_presenter(_AGGREGATOR_WIDGET_ID, component_id="cid")
    wt = presenter({"x": 1}, ss)

    assert wt.x == 1
    assert wt.missing is None


def test_write_through_setattr_public_name_sets_item() -> None:
    """``__setattr__`` routes non-private names to ``__setitem__``."""
    ss = _make_ready_session()
    presenter = make_bidi_component_presenter(_AGGREGATOR_WIDGET_ID, component_id="cid")
    wt = presenter({}, ss)

    wt.alpha = 42
    assert wt["alpha"] == 42
    assert ss._new_widget_state.set_from_value_calls[-1] == ("cid", {"alpha": 42})


def test_write_through_setattr_private_name_does_not_use_setitem() -> None:
    """Names starting with ``_`` are stored as attributes, not dict keys."""
    ss = _make_ready_session()
    presenter = make_bidi_component_presenter(_AGGREGATOR_WIDGET_ID, component_id="cid")
    wt = presenter({}, ss)

    wt._shadow = 99
    assert "_shadow" not in wt
    assert wt._shadow == 99
    assert ss._new_widget_state.set_from_value_calls == []


@pytest.mark.parametrize(
    ("widget_ids", "form_ids"),
    [
        ({"comp"}, set()),
        (set(), {"user_key"}),
    ],
    ids=["widget_in_current_run", "form_in_current_run"],
)
def test_write_through_rejects_nested_mutations_after_component_run(
    widget_ids: set[str],
    form_ids: set[str],
) -> None:
    """``_check_modification`` blocks writes when the widget or its form already ran."""
    mock_session_state = MagicMock(spec=SessionState)
    mock_session_state._key_id_mapper = MagicMock()
    mock_session_state._key_id_mapper.get_key_from_id.return_value = "user_key"
    mock_session_state._new_widget_state = MagicMock()
    mock_session_state._new_widget_state.widget_metadata.get.return_value = MagicMock(
        value_type="json_trigger_value"
    )

    mock_ctx = MagicMock()
    mock_ctx.widget_ids_this_run = widget_ids
    mock_ctx.form_ids_this_run = form_ids

    presenter = make_bidi_component_presenter(
        _AGGREGATOR_WIDGET_ID, component_id="comp"
    )
    wt = presenter({}, mock_session_state)

    with patch(
        "streamlit.components.v2.presentation.get_script_run_ctx",
        return_value=mock_ctx,
    ):
        with pytest.raises(StreamlitAPIException, match="user_key"):
            wt["nested"] = 1


def test_write_through_setitem_ignores_disallowed_keys() -> None:
    """Keys outside ``allowed_state_keys`` are ignored without persisting."""
    ss = _make_ready_session()
    presenter = make_bidi_component_presenter(
        _AGGREGATOR_WIDGET_ID, component_id="cid", allowed_state_keys={"ok"}
    )
    wt = presenter({"ok": 0}, ss)
    ss._new_widget_state.set_from_value_calls.clear()

    wt["bad"] = 123

    assert "bad" not in wt
    assert ss._new_widget_state.set_from_value_calls == []


@pytest.mark.parametrize(
    "op",
    [pytest.param("setitem", id="setitem"), pytest.param("delitem", id="delitem")],
)
def test_write_through_mutation_succeeds_when_persist_raises(op: str) -> None:
    """``__setitem__`` / ``__delitem__`` update the proxy even if ``set_from_value`` raises."""
    ss = _make_ready_session()
    ss._new_widget_state.set_from_value = MagicMock(  # type: ignore[method-assign]
        side_effect=OSError("persist failed")
    )
    presenter = make_bidi_component_presenter(_AGGREGATOR_WIDGET_ID, component_id="cid")
    if op == "setitem":
        wt = presenter({}, ss)
        wt["k"] = "v"
        assert wt["k"] == "v"
    else:
        wt = presenter({"only": True}, ss)
        del wt["only"]
        assert "only" not in wt


def test_write_through_delitem_persists_flat_state() -> None:
    """Deleting a key removes it from the proxy and persists the remainder."""
    ss = _make_ready_session()
    presenter = make_bidi_component_presenter(_AGGREGATOR_WIDGET_ID, component_id="cid")
    wt = presenter({"a": 1, "b": 2}, ss)
    ss._new_widget_state.set_from_value_calls.clear()

    del wt["a"]

    assert "a" not in wt
    assert dict(wt) == {"b": 2}
    assert ss._new_widget_state.set_from_value_calls[-1] == ("cid", {"b": 2})


def test_write_through_without_component_id_skips_persist() -> None:
    """No ``component_id`` means mutations do not call ``set_from_value``."""
    ss = _make_ready_session()
    presenter = make_bidi_component_presenter(_AGGREGATOR_WIDGET_ID, component_id=None)
    wt = presenter({"x": 1}, ss)

    wt["y"] = 2
    del wt["x"]

    assert dict(wt) == {"y": 2}
    assert ss._new_widget_state.set_from_value_calls == []
