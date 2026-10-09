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

"""SPIKE: fork a browser session into a new agent session.

A fork copies what a browser session holds on the server (its session state,
uploaded files, page, query string, browser context, and connection headers)
into a fresh agent session, which then runs the app once. The browser session
is only read: nothing is written to it, and none of its runs is interrupted.

Authorization has two parts. The browser session mints a grant, which is a
short-lived, single-use random token. The agent presents it, and the fork goes
ahead only if the agent's trusted identity equals the browser session's. The
grant names one session and nothing else, so it cannot be turned into access to
another one. In the prototype the app mints the grant from inside a run (see
`grant_for_current_session`). A real version would hand it to the frontend
only while the agent API is on.
"""

from __future__ import annotations

import copy
import secrets
import threading
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Final

from streamlit.proto.ClientState_pb2 import ContextInfo
from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
from streamlit.runtime.agent.errors import AgentRequestError
from streamlit.runtime.caching import cache_resource_api
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    get_script_run_ctx,
)
from streamlit.runtime.state.session_state import (
    Serialized,
    SessionState,
    Value,
)

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping

    from streamlit.runtime.app_session import AppSession
    from streamlit.runtime.runtime import Runtime

# Long enough for a co-browsing client to scrape the page and call the agent
# API, short enough that a grant left in a DOM is soon worthless.
_GRANT_TTL_SECONDS: Final = 120.0

# Headers that describe the WebSocket upgrade itself rather than the user or the
# deployment. They mean nothing to a session without a socket.
_CONNECTION_HEADERS: Final = frozenset(
    {
        "connection",
        "upgrade",
        "sec-websocket-key",
        "sec-websocket-version",
        "sec-websocket-extensions",
        "sec-websocket-protocol",
    }
)


@dataclass(frozen=True)
class FrozenClientContext:
    """A connection context copied at one moment: a browser's or a request's."""

    headers: tuple[tuple[str, str], ...]
    cookies: Mapping[str, str]
    remote_ip: str | None


@dataclass(frozen=True)
class _Grant:
    session_id: str
    user_info: dict[str, Any]
    expires_at: float


class ForkGrants:
    """Single-use, short-lived permissions to fork one browser session.

    Kept in process memory, which is enough: a fork has to reach the replica
    that holds the browser session anyway.
    """

    def __init__(self, *, ttl_seconds: float = _GRANT_TTL_SECONDS) -> None:
        self._ttl_seconds = ttl_seconds
        self._lock = threading.Lock()
        self._grants: dict[str, _Grant] = {}

    def issue(self, session_id: str, user_info: Mapping[str, Any]) -> str:
        """A new grant for `session_id`, replacing any earlier one for it."""
        token = f"fg_{secrets.token_urlsafe(24)}"
        now = time.monotonic()
        with self._lock:
            self._prune(now)
            # One live grant per session, so an app that mints on every run
            # does not pile them up.
            for existing, grant in list(self._grants.items()):
                if grant.session_id == session_id:
                    del self._grants[existing]
            self._grants[token] = _Grant(
                session_id=session_id,
                user_info=dict(user_info),
                expires_at=now + self._ttl_seconds,
            )
        return token

    def check(self, token: str, user_info: Mapping[str, Any]) -> str:
        """The session a live grant names, if `user_info` may use it.

        A grant presented under a different identity is destroyed, so a leaked
        grant cannot be retried until a matching identity turns up. Every
        refusal reads the same, so a caller cannot tell an expired grant from
        one minted for someone else.
        """
        with self._lock:
            self._prune(time.monotonic())
            grant = self._grants.get(token)
            if grant is not None and grant.user_info != dict(user_info):
                del self._grants[token]
                grant = None
        if grant is None:
            raise _unknown_fork()
        return grant.session_id

    def consume(self, token: str) -> None:
        """Spend a grant once its fork has been taken."""
        with self._lock:
            self._grants.pop(token, None)

    def _prune(self, now: float) -> None:
        for token, grant in list(self._grants.items()):
            if grant.expires_at <= now:
                del self._grants[token]


# The prototype keeps one table per process, shared by the agent routes and by
# scripts that mint grants.
GRANTS: Final = ForkGrants()


def grant_for_current_session() -> str:
    """Mint a fork grant for the session running this script.

    Prototype hook: an app calls this and puts the result on the page, where a
    co-browsing client reads it. A real version would deliver it to the
    frontend instead, so app code never handles it.
    """
    ctx = get_script_run_ctx()
    if ctx is None:
        raise RuntimeError("A fork grant can only be minted inside a script run.")
    return GRANTS.issue(ctx.session_id, ctx.user_info)


@dataclass
class ForkReport:
    """What a fork copied and what it had to leave behind."""

    # Session-state entries copied, by user key or, for keyless widgets, by id.
    copied: int = 0
    # Entries that could not be copied, by user key, with the exception type.
    # They are absent in the fork, so an app that initializes them when missing
    # builds them afresh.
    dropped: dict[str, str] = field(default_factory=dict)
    # Entries kept as the same object because they are `st.cache_resource`
    # results, which every session already shares.
    shared_resources: list[str] = field(default_factory=list)
    uploaded_files: int = 0
    headers: list[str] = field(default_factory=list)
    copy_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "copied": self.copied,
            "dropped": dict(sorted(self.dropped.items())),
            "shared_resources": sorted(self.shared_resources),
            "uploaded_files": self.uploaded_files,
            "headers": sorted(self.headers),
            "copy_ms": round(self.copy_ms, 2),
        }


@dataclass
class ForkSource:
    """Everything a fork takes from the browser session, captured at once."""

    session_state: SessionState
    user_info: dict[str, Any]
    client_context: FrozenClientContext | None
    page_script_hash: str
    page_name: str
    query_string: str
    context_info: ContextInfo | None
    files: list[Any]
    report: ForkReport


def capture(
    runtime: Runtime,
    *,
    source_session_id: str,
    user_info: Mapping[str, Any],
    agent_session_ids: Iterable[str],
) -> ForkSource:
    """Copy a browser session's server-side state, without changing it.

    Runs on the event loop with no await, so no BackMsg can start a run in the
    source while the copy is taken. A run already in progress refuses the fork
    instead: its script thread is writing the state being copied.
    """
    if source_session_id in set(agent_session_ids):
        # An agent session is already addressable by its own handle.
        raise _unknown_fork()
    session_info = runtime._session_mgr.get_active_session_info(source_session_id)
    if session_info is None:
        raise _unknown_fork()
    source: AppSession = session_info.session
    # Checked again, beyond the grant, so a grant can never outlive a change of
    # who the session belongs to.
    if not source.matches_user_info(dict(user_info)):
        raise _unknown_fork()
    if source._scriptrunner is not None:
        raise AgentRequestError(
            "source_busy",
            "The browser session is running the app right now. Retry once its "
            "run finishes.",
        )

    started = time.perf_counter()
    report = ForkReport()
    session_state = copy_session_state(source.session_state, report)
    files = _uploaded_files(runtime, source_session_id, session_state, report)
    report.uploaded_files = len(files)
    client_context = _copy_client_context(session_info.client.client_context)
    if client_context is not None:
        report.headers = sorted({name.lower() for name, _ in client_context.headers})

    client_state = source._client_state
    page_script_hash = client_state.page_script_hash
    page_info = source._pages_manager.get_pages().get(page_script_hash)
    page_name = str(page_info.get("url_pathname", "")) if page_info else ""
    context_info: ContextInfo | None = None
    if client_state.HasField("context_info"):
        context_info = ContextInfo()
        context_info.CopyFrom(client_state.context_info)
    report.copy_ms = (time.perf_counter() - started) * 1000

    return ForkSource(
        session_state=session_state,
        user_info=copy.deepcopy(source._user_info),
        client_context=client_context,
        page_script_hash=page_script_hash,
        page_name=page_name,
        query_string=client_state.query_string,
        context_info=context_info,
        files=files,
        report=report,
    )


def install(runtime: Runtime, app_session: AppSession, source: ForkSource) -> None:
    """Give a new, never-run agent session the captured state."""
    app_session._session_state = source.session_state
    # The page the first run asks for, read the way `_run_interaction` reads it.
    app_session._client_state.page_script_hash = source.page_script_hash
    manager = runtime.uploaded_file_mgr
    if isinstance(manager, MemoryUploadedFileManager):
        for record in source.files:
            manager.add_file(app_session.id, record)


def copy_session_state(source: SessionState, report: ForkReport) -> SessionState:
    """A deep copy of `source`, entry by entry.

    One memo serves the whole copy, so two keys that hold the same object still
    hold one object in the fork. The memo starts out mapping every global
    `st.cache_resource` result to itself: those are shared by every session by
    design, so the fork shares them rather than duplicating a model or a pool.
    An entry that cannot be copied is dropped and reported, never shared,
    because sharing a mutable object would put two writers back on it.
    """
    memo, resource_ids = _resource_memo()
    key_for_id = source._key_id_mapper.id_key_mapping
    target = SessionState()

    def copy_entry(name: str, value: Any) -> tuple[bool, Any]:
        label = key_for_id.get(name, name)
        if id(value) in resource_ids:
            report.shared_resources.append(label)
        try:
            copied = copy.deepcopy(value, memo)
        except Exception as exc:
            report.dropped[label] = type(exc).__name__
            return False, None
        report.copied += 1
        return True, copied

    for name, value in source._old_state.items():
        ok, copied = copy_entry(name, value)
        if ok:
            target._old_state[name] = copied
    for name, value in source._new_session_state.items():
        ok, copied = copy_entry(name, value)
        if ok:
            target._new_session_state[name] = copied
    for widget_id, state in source._new_widget_state.states.items():
        if isinstance(state, Serialized):
            proto = WidgetStateProto()
            proto.CopyFrom(state.value)
            target._new_widget_state.states[widget_id] = Serialized(proto)
            report.copied += 1
            continue
        ok, copied = copy_entry(widget_id, state.value)
        if ok:
            target._new_widget_state.states[widget_id] = Value(copied)

    # Metadata is immutable, and the fork's first run registers every live
    # widget again, so sharing it is safe. Copying it would also copy callback
    # arguments, which can be anything.
    target._new_widget_state.widget_metadata = dict(
        source._new_widget_state.widget_metadata
    )
    target._key_id_mapper = copy.deepcopy(source._key_id_mapper)
    target.query_params = copy.deepcopy(source.query_params)
    target._query_param_bound_widget_ids = set(source._query_param_bound_widget_ids)
    target._persist_tracker = copy.deepcopy(source._persist_tracker)
    return target


def _resource_memo() -> tuple[dict[int, Any], frozenset[int]]:
    """A deepcopy memo that maps each global cached resource to itself."""
    memo: dict[int, Any] = {}
    caches = cache_resource_api._resource_caches
    with caches._caches_lock:
        global_caches = list(caches._function_caches.get(None, {}).values())
    for cache in global_caches:
        with cache._mem_cache_lock:
            results = list(cache._mem_cache.values())
        for result in results:
            memo[id(result.value)] = result.value
    return memo, frozenset(memo)


def _uploaded_files(
    runtime: Runtime,
    source_session_id: str,
    session_state: SessionState,
    report: ForkReport,
) -> list[Any]:
    """The upload records the copied widget states point at.

    Records are immutable, so the fork holds the same bytes rather than a copy.
    Only the in-memory manager can be given a record for another session; the
    `UploadedFileManager` interface has no way to add one, so a deployment with
    its own manager forks without the uploads, and the report says so.
    """
    file_ids = [
        info.file_id
        for proto in session_state.get_widget_states()
        if proto.WhichOneof("value") == "file_uploader_state_value"
        for info in proto.file_uploader_state_value.uploaded_file_info
    ]
    if not file_ids:
        return []
    if not isinstance(runtime.uploaded_file_mgr, MemoryUploadedFileManager):
        report.dropped["uploaded files"] = type(runtime.uploaded_file_mgr).__name__
        return []
    return list(runtime.uploaded_file_mgr.get_files(source_session_id, file_ids))


def _copy_client_context(context: Any) -> FrozenClientContext | None:
    if context is None:
        return None
    return FrozenClientContext(
        headers=tuple(
            (name, value)
            for name, value in context.headers
            if name.lower() not in _CONNECTION_HEADERS
        ),
        cookies=dict(context.cookies),
        remote_ip=context.remote_ip,
    )


def _unknown_fork() -> AgentRequestError:
    # The same refusal as a bad grant, so a caller learns nothing about which
    # sessions exist or whom they belong to.
    return AgentRequestError(
        "unknown_fork",
        "This fork grant does not exist, has expired, was already used, or was "
        "issued to a different user. Ask the app for a new one.",
    )
