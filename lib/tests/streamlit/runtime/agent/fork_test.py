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

"""SPIKE: unit tests for forking a browser session into an agent session."""

from __future__ import annotations

import threading
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest

import streamlit as st
from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
from streamlit.runtime.agent import fork
from streamlit.runtime.agent.errors import AgentRequestError
from streamlit.runtime.state.session_state import Serialized, SessionState

_ALICE: dict[str, Any] = {"user_name": "alice"}
_MALLORY: dict[str, Any] = {"user_name": "mallory"}


def _refusal(call: Any) -> str:
    with pytest.raises(AgentRequestError) as raised:
        call()
    return raised.value.code


def test_grant_names_one_session_for_one_user_once() -> None:
    """A grant resolves for its own user until it is consumed."""
    grants = fork.ForkGrants()
    token = grants.issue("browser-1", _ALICE)

    assert grants.check(token, _ALICE) == "browser-1"
    grants.consume(token)
    assert _refusal(lambda: grants.check(token, _ALICE)) == "unknown_fork"


def test_grant_presented_by_another_user_is_destroyed() -> None:
    """A leaked grant cannot be retried until a matching identity turns up."""
    grants = fork.ForkGrants()
    token = grants.issue("browser-1", _ALICE)

    assert _refusal(lambda: grants.check(token, _MALLORY)) == "unknown_fork"
    assert _refusal(lambda: grants.check(token, _ALICE)) == "unknown_fork"


def test_anonymous_caller_cannot_use_an_identified_users_grant() -> None:
    """No identity is a different identity, not a wildcard."""
    grants = fork.ForkGrants()
    token = grants.issue("browser-1", _ALICE)

    assert _refusal(lambda: grants.check(token, {})) == "unknown_fork"


def test_grant_expires(monkeypatch: pytest.MonkeyPatch) -> None:
    """A grant left in a page is worthless after its TTL."""
    now = [1000.0]
    monkeypatch.setattr(fork.time, "monotonic", lambda: now[0])
    grants = fork.ForkGrants(ttl_seconds=120)
    token = grants.issue("browser-1", _ALICE)

    now[0] += 119
    assert grants.check(token, _ALICE) == "browser-1"
    now[0] += 2
    assert _refusal(lambda: grants.check(token, _ALICE)) == "unknown_fork"


def test_new_grant_replaces_the_sessions_earlier_one() -> None:
    """An app that mints on every run holds one live grant, not many."""
    grants = fork.ForkGrants()
    first = grants.issue("browser-1", _ALICE)
    second = grants.issue("browser-1", _ALICE)
    other = grants.issue("browser-2", _ALICE)

    assert _refusal(lambda: grants.check(first, _ALICE)) == "unknown_fork"
    assert grants.check(second, _ALICE) == "browser-1"
    assert grants.check(other, _ALICE) == "browser-2"


def test_copy_is_independent_and_keeps_aliasing() -> None:
    """The fork mutates its own objects, which stay shared where they were."""
    source = SessionState()
    shared = {"filters": ["US"]}
    source._new_session_state["a"] = shared
    source._old_state["b"] = shared

    target = fork.copy_session_state(source, fork.ForkReport())
    target._new_session_state["a"]["filters"].append("EU")

    assert shared == {"filters": ["US"]}
    assert target._old_state["b"] is target._new_session_state["a"]


def test_copy_drops_what_cannot_be_copied_rather_than_sharing_it() -> None:
    """A value deepcopy refuses is absent in the fork, never the same object."""
    source = SessionState()
    source._new_session_state["lock"] = threading.Lock()
    source._new_session_state["count"] = 3
    report = fork.ForkReport()

    target = fork.copy_session_state(source, report)

    assert "lock" not in target._new_session_state
    assert target._new_session_state["count"] == 3
    assert report.dropped == {"lock": "TypeError"}


def test_copy_shares_global_cached_resources() -> None:
    """A `st.cache_resource` result stays one object, even inside a container."""

    class Pool:
        def __init__(self) -> None:
            self.lock = threading.Lock()

    @st.cache_resource
    def get_pool() -> Pool:
        return Pool()

    pool = get_pool()
    source = SessionState()
    source._new_session_state["pool"] = pool
    source._new_session_state["holder"] = {"pool": pool, "rows": [1]}
    report = fork.ForkReport()

    target = fork.copy_session_state(source, report)

    assert target._new_session_state["pool"] is pool
    assert target._new_session_state["holder"]["pool"] is pool
    assert (
        target._new_session_state["holder"] is not source._new_session_state["holder"]
    )
    assert report.shared_resources == ["pool"]
    assert report.dropped == {}
    get_pool.clear()


def test_copy_keeps_serialized_widget_values_apart() -> None:
    """A serialized widget value is a separate proto in the fork."""
    source = SessionState()
    proto = WidgetStateProto(id="$$ID-abc-None", string_value="Texas")
    source._new_widget_state.states[proto.id] = Serialized(proto)

    target = fork.copy_session_state(source, fork.ForkReport())
    copied = target._new_widget_state.states[proto.id]
    assert isinstance(copied, Serialized)
    copied.value.string_value = "Ohio"

    assert proto.string_value == "Texas"


def _runtime_with(session: Any) -> Any:
    runtime = MagicMock()
    runtime._session_mgr.get_active_session_info.return_value = SimpleNamespace(
        session=session, client=SimpleNamespace(client_context=None)
    )
    return runtime


def _browser_session(*, user_info: dict[str, Any], running: bool = False) -> Any:
    session = MagicMock()
    session.matches_user_info.side_effect = lambda other: other == user_info
    session._scriptrunner = object() if running else None
    session.session_state = SessionState()
    return session


@pytest.mark.parametrize(
    ("session", "user_info", "agent_ids", "code"),
    [
        (_browser_session(user_info=_ALICE), _MALLORY, (), "unknown_fork"),
        (_browser_session(user_info=_ALICE), _ALICE, ("browser-1",), "unknown_fork"),
        (
            _browser_session(user_info=_ALICE, running=True),
            _ALICE,
            (),
            "source_busy",
        ),
    ],
    ids=["other_user", "agent_session", "mid_run"],
)
def test_capture_refuses(
    session: Any, user_info: dict[str, Any], agent_ids: tuple[str, ...], code: str
) -> None:
    """Only an idle browser session of the same user is copied."""
    runtime = _runtime_with(session)

    assert (
        _refusal(
            lambda: fork.capture(
                runtime,
                source_session_id="browser-1",
                user_info=user_info,
                agent_session_ids=agent_ids,
            )
        )
        == code
    )
