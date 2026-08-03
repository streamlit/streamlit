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

"""Unit tests for the session-scoped widget validator manager."""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import patch

from streamlit.runtime.widget_validator_manager import WidgetValidatorManager

if TYPE_CHECKING:
    from collections.abc import Callable


def _register(
    mgr: WidgetValidatorManager,
    validator: Callable[[str], bool | str],
    *,
    session_id: str = "s1",
    coordinates: str = "1.0.0",
    fragment_id: str | None = None,
) -> str:
    """Register a validator under a given session id (patches the active session)."""
    with (
        patch(
            "streamlit.runtime.widget_validator_manager._get_session_id",
            return_value=session_id,
        ),
        patch(
            "streamlit.runtime.widget_validator_manager._get_fragment_id",
            return_value=fragment_id,
        ),
    ):
        return mgr.register_validator(validator, coordinates)


def test_register_validator_returns_unique_ids() -> None:
    """Each registration gets a unique, unguessable validator id."""
    mgr = WidgetValidatorManager()
    id1 = _register(mgr, lambda _v: True, coordinates="1.0.0")
    id2 = _register(mgr, lambda _v: True, coordinates="1.0.1")
    assert id1 != id2
    assert mgr.get_validator_count() == 2


def test_run_validation_true_is_valid() -> None:
    """A validator returning True yields a valid outcome with no message."""
    mgr = WidgetValidatorManager()
    validator_id = _register(mgr, lambda value: len(value) > 2)
    outcome = mgr.run_validation("s1", validator_id, "hello")
    assert outcome.is_valid is True
    assert outcome.error_message == ""


def test_run_validation_false_is_invalid_generic() -> None:
    """A validator returning False yields an invalid outcome with no message."""
    mgr = WidgetValidatorManager()
    validator_id = _register(mgr, lambda _value: False)
    outcome = mgr.run_validation("s1", validator_id, "hello")
    assert outcome.is_valid is False
    assert outcome.error_message == ""


def test_run_validation_string_is_invalid_with_message() -> None:
    """A validator returning a string yields an invalid outcome with that message."""
    mgr = WidgetValidatorManager()
    validator_id = _register(mgr, lambda _value: "Too short.")
    outcome = mgr.run_validation("s1", validator_id, "x")
    assert outcome.is_valid is False
    assert outcome.error_message == "Too short."


def test_run_validation_empty_string_falls_back_to_generic() -> None:
    """An empty-string return is invalid and defers to the generic message."""
    mgr = WidgetValidatorManager()
    validator_id = _register(mgr, lambda _value: "")
    outcome = mgr.run_validation("s1", validator_id, "x")
    assert outcome.is_valid is False
    assert outcome.error_message == ""


def test_run_validation_unexpected_type_is_invalid() -> None:
    """A non-bool, non-str return type is treated as an internal error."""
    mgr = WidgetValidatorManager()
    validator_id = _register(mgr, lambda _value: 123)  # type: ignore[arg-type,return-value]
    outcome = mgr.run_validation("s1", validator_id, "x")
    assert outcome.is_valid is False
    assert outcome.error_message == ""


def test_run_validation_exception_is_invalid_and_logged() -> None:
    """A raising validator is treated as invalid; the traceback is logged, not leaked."""

    def boom(_value: str) -> bool:
        raise ValueError("secret internal detail")

    mgr = WidgetValidatorManager()
    validator_id = _register(mgr, boom)
    with patch("streamlit.runtime.widget_validator_manager._LOGGER") as mock_logger:
        outcome = mgr.run_validation("s1", validator_id, "x")

    assert outcome.is_valid is False
    # The frontend never receives the internal exception detail.
    assert "secret internal detail" not in outcome.error_message
    # The full traceback is logged for the developer.
    mock_logger.exception.assert_called_once()


def test_run_validation_unknown_id_fails_closed() -> None:
    """An unknown validator id fails closed rather than accepting the value."""
    mgr = WidgetValidatorManager()
    outcome = mgr.run_validation("s1", "does-not-exist", "x")
    assert outcome.is_valid is False


def test_run_validation_wrong_session_fails_closed() -> None:
    """A validator id from another session is rejected."""
    mgr = WidgetValidatorManager()
    validator_id = _register(mgr, lambda _value: True, session_id="s1")
    outcome = mgr.run_validation("other-session", validator_id, "x")
    assert outcome.is_valid is False


def test_re_register_same_coordinates_orphans_previous() -> None:
    """Re-registering at the same coordinates orphans the previous validator."""
    mgr = WidgetValidatorManager()
    first_id = _register(mgr, lambda _v: True, coordinates="1.0.0")
    second_id = _register(mgr, lambda _v: True, coordinates="1.0.0")
    assert first_id != second_id

    mgr.remove_orphaned_validators()
    # The stale validator is pruned; the current one still validates.
    assert mgr.run_validation("s1", first_id, "x").is_valid is False
    assert mgr.run_validation("s1", second_id, "x").is_valid is True
    assert mgr.get_validator_count() == 1


def test_clear_session_refs_then_prune_removes_validators() -> None:
    """clear_session_refs + remove_orphaned_validators drops a session's validators."""
    mgr = WidgetValidatorManager()
    _register(mgr, lambda _v: True, session_id="s1")
    mgr.clear_session_refs("s1")
    mgr.remove_orphaned_validators()
    assert mgr.get_validator_count() == 0


def test_clear_session_refs_only_affects_target_session() -> None:
    """Clearing one session leaves another session's validators intact."""
    mgr = WidgetValidatorManager()
    id1 = _register(mgr, lambda _v: True, session_id="s1", coordinates="1.0.0")
    id2 = _register(mgr, lambda _v: True, session_id="s2", coordinates="1.0.0")
    mgr.clear_session_refs("s1")
    mgr.remove_orphaned_validators()
    assert mgr.run_validation("s1", id1, "x").is_valid is False
    assert mgr.run_validation("s2", id2, "x").is_valid is True


def test_clear_session_refs_only_affects_target_fragments() -> None:
    """A fragment rerun only drops refs owned by the queued fragments."""
    mgr = WidgetValidatorManager()
    frag_id = _register(
        mgr, lambda _v: True, session_id="s1", coordinates="1.0.0", fragment_id="a"
    )
    body_id = _register(
        mgr, lambda _v: True, session_id="s1", coordinates="1.0.1", fragment_id=None
    )
    mgr.clear_session_refs("s1", fragment_ids=["a"])
    mgr.remove_orphaned_validators()
    assert mgr.run_validation("s1", frag_id, "x").is_valid is False
    assert mgr.run_validation("s1", body_id, "x").is_valid is True


def test_clear_session_refs_fragment_empty_list_is_noop() -> None:
    """An empty fragment list leaves all validators referenced."""
    mgr = WidgetValidatorManager()
    validator_id = _register(mgr, lambda _v: True, session_id="s1")
    mgr.clear_session_refs("s1", fragment_ids=[])
    mgr.remove_orphaned_validators()
    assert mgr.run_validation("s1", validator_id, "x").is_valid is True


def test_clear_all_for_session_removes_everything() -> None:
    """clear_all_for_session removes references and prunes in one call."""
    mgr = WidgetValidatorManager()
    _register(mgr, lambda _v: True, session_id="s1")
    mgr.clear_all_for_session("s1")
    assert mgr.get_validator_count() == 0
