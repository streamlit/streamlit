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

from streamlit.runtime.state.common import WidgetMetadata
from streamlit.runtime.state.presentation import apply_presenter
from streamlit.runtime.state.session_state import SessionState


class _FakeWStates:
    def __init__(self) -> None:
        self.widget_metadata: dict[str, Any] = {}


class _FakeSession:
    def __init__(self) -> None:
        self._new_widget_state = _FakeWStates()

    def _get_widget_metadata(self, widget_id: str) -> WidgetMetadata[Any] | None:
        return self._new_widget_state.widget_metadata.get(widget_id)


def test_apply_presenter_returns_base_when_no_meta() -> None:
    """Return base value unchanged when widget metadata is missing."""
    ss = _FakeSession()
    base = {"value": 1}
    out = apply_presenter(ss, "wid", base)
    assert out is base


def test_apply_presenter_returns_base_when_no_presenter() -> None:
    """Return base value unchanged when metadata has no presenter."""
    ss = _FakeSession()
    ss._new_widget_state.widget_metadata["wid"] = SimpleNamespace()
    base = [1, 2, 3]
    out = apply_presenter(ss, "wid", base)
    assert out is base


def test_apply_presenter_applies_presenter() -> None:
    """Apply the registered presenter to the base value."""

    def _presenter(base: Any, _ss: Any) -> Any:
        return {"presented": base}

    ss = _FakeSession()
    ss._new_widget_state.widget_metadata["wid"] = SimpleNamespace(presenter=_presenter)
    base = {"value": 123}
    out = apply_presenter(ss, "wid", base)
    assert out == {"presented": {"value": 123}}


def test_apply_presenter_swallows_presenter_errors() -> None:
    """Return base value unchanged if presenter raises an exception."""

    def _boom(_base: Any, _ss: Any) -> Any:
        raise RuntimeError("boom")

    ss = _FakeSession()
    ss._new_widget_state.widget_metadata["wid"] = SimpleNamespace(presenter=_boom)
    base = "hello"
    out = apply_presenter(ss, "wid", base)
    assert out is base


def test_presenter_applied_once_via_getitem_and_filtered_state() -> None:
    """Presenter must be applied exactly once for both __getitem__ and filtered_state.

    We simulate a widget with a user key mapping and attach a presenter that wraps
    the base value in a dict. Double application would produce nested wrapping.
    """

    ss = SessionState()

    # Simulate a widget with element id and user key mapping
    widget_id = "$$ID-abc-ukey"
    user_key = "ukey"

    # Register metadata with a no-op deserializer/serializer for a simple string
    meta = WidgetMetadata[str](
        id=widget_id,
        deserializer=lambda v: v,
        serializer=lambda v: v,
        value_type="string_value",
    )
    ss._set_widget_metadata(meta)
    ss._set_key_widget_mapping(widget_id, user_key)

    # Set the underlying widget value in new widget state
    ss._new_widget_state.set_from_value(widget_id, "base")

    # Install a presenter that wraps once
    def _wrap_once(base: Any, _ss: Any) -> Any:
        return {"presented": base}

    # Attach presenter to metadata store
    ss._new_widget_state.widget_metadata[widget_id] = SimpleNamespace(
        id=widget_id,
        deserializer=meta.deserializer,
        serializer=meta.serializer,
        value_type=meta.value_type,
        presenter=_wrap_once,
    )

    # Access via __getitem__ using the widget id; should apply once
    got = ss[widget_id]
    assert got == {"presented": "base"}

    # Access via filtered_state using the user key; should apply once
    filtered = ss.filtered_state
    assert filtered[user_key] == {"presented": "base"}


def test_get_widget_states_uses_base_value_not_presented() -> None:
    """Serialized widget states must contain base (unpresented) values.

    This ensures presentation is only applied for user-facing access via
    `st.session_state[...]` and `filtered_state`, while serialization stays
    lossless and stable.
    """

    ss = SessionState()

    # Create widget metadata for a simple string and register mapping.
    widget_id = "$$ID-abc-ukey"
    user_key = "ukey"
    meta = WidgetMetadata[str](
        id=widget_id,
        deserializer=lambda v: v,
        serializer=lambda v: v,
        value_type="string_value",
    )
    ss._set_widget_metadata(meta)
    ss._set_key_widget_mapping(widget_id, user_key)

    # Underlying base value stored in widget state.
    base_value = "raw"
    ss._new_widget_state.set_from_value(widget_id, base_value)

    # Presenter that would wrap the base value if applied.
    def _wrap(base: Any, _ss: Any) -> Any:
        return {"presented": base}

    # Attach presenter on metadata store (simulating element registration that
    # enriches the metadata entry).
    ss._new_widget_state.widget_metadata[widget_id] = SimpleNamespace(
        id=widget_id,
        deserializer=meta.deserializer,
        serializer=meta.serializer,
        value_type=meta.value_type,
        presenter=_wrap,
    )

    # Verify that user-facing access applies presentation.
    assert ss[widget_id] == {"presented": base_value}

    # Now get serialized widget states; these should contain the base value
    # via the `string_value` field and not the presented wrapper.
    states = ss.get_widget_states()
    assert len(states) == 1
    st = states[0]
    # Ensure we serialized as string_value and not JSON or other wrappers
    assert st.WhichOneof("value") == "string_value"
    assert st.string_value == base_value


def test_filtered_state_includes_keyed_element_when_not_internal() -> None:
    """filtered_state includes user key for keyed element ids when not internal."""

    ss = SessionState()

    widget_id = "$$ID-abc-ukey"
    user_key = "ukey"

    # Minimal metadata and value
    meta = WidgetMetadata[str](
        id=widget_id,
        deserializer=lambda v: v,
        serializer=lambda v: v,
        value_type="string_value",
    )
    ss._set_widget_metadata(meta)
    ss._new_widget_state.set_from_value(widget_id, "base")
    ss._set_key_widget_mapping(widget_id, user_key)

    filtered = ss.filtered_state
    assert user_key in filtered
    assert filtered[user_key] == "base"


def test_filtered_state_excludes_keyed_element_when_internal(monkeypatch) -> None:
    """filtered_state excludes entries when _is_internal_key(k) is True for the id."""

    import streamlit.runtime.state.session_state as ss_mod

    ss = SessionState()

    widget_id = "$$ID-internal-ukey"
    user_key = "ukey"

    meta = WidgetMetadata[str](
        id=widget_id,
        deserializer=lambda v: v,
        serializer=lambda v: v,
        value_type="string_value",
    )
    ss._set_widget_metadata(meta)
    ss._new_widget_state.set_from_value(widget_id, "base")
    ss._set_key_widget_mapping(widget_id, user_key)

    # Patch _is_internal_key to treat this widget_id as internal
    original = ss_mod._is_internal_key
    monkeypatch.setattr(
        ss_mod,
        "_is_internal_key",
        lambda k: True if k == widget_id else original(k),
        raising=True,
    )

    filtered = ss.filtered_state
    assert user_key not in filtered
