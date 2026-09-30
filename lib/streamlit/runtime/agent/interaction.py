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

"""Drive a real AppSession from an HTTP request and wait for it to settle.

An agent session is an ordinary ``AppSession`` whose client accumulates
ForwardMsgs instead of writing them to a WebSocket. That is the whole trick:
input goes through the same ``rerun_script`` path the browser uses, so
callbacks, widget reconciliation, and stale-node cleanup are the runtime's
existing behavior rather than a second implementation.
"""

from __future__ import annotations

import asyncio
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any, Final
from urllib.parse import urlencode
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from streamlit import config
from streamlit.elements.lib import agent_spec
from streamlit.logger import get_logger
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ClientState_pb2 import ContextInfo
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.agent import snapshot as snapshot_module
from streamlit.runtime.agent.widget_patch import (
    AgentRequestError,
    build_widget_states,
    resolve_fragment,
)
from streamlit.runtime.session_manager import SessionClient

if TYPE_CHECKING:
    from streamlit.runtime.agent.snapshot import ElementState
    from streamlit.runtime.runtime import Runtime
    from streamlit.runtime.session_manager import ClientContext

_LOGGER: Final = get_logger(__name__)

# How long to keep waiting after a run finishes, in case a callback or
# st.rerun() starts another one. The browser has no equivalent because it
# renders continuously; a single response has to know when to stop.
_RUN_CHAIN_SETTLE_SECONDS: Final = 0.05


_SETTLING_STATUSES: Final = frozenset(
    {
        ForwardMsg.FINISHED_SUCCESSFULLY,
        # A fragment run is a complete run of its own, and an app that calls
        # `st.rerun(scope="fragment")` never produces anything else.
        ForwardMsg.FINISHED_FRAGMENT_RUN_SUCCESSFULLY,
        ForwardMsg.FINISHED_WITH_COMPILE_ERROR,
    }
)


class AgentSessionClient(SessionClient):
    """A session client that accumulates messages instead of sending them.

    The buffer plays the part the browser's element tree plays, not the part of
    the server's outgoing queue, and it follows the same rules: deltas
    accumulate as they arrive, and pruning happens when a run *finishes*,
    scoped to what that run was responsible for. A full run owns the whole
    tree; a fragment run owns only its own fragments.

    Pruning on finish rather than on start is what makes an interrupted run
    safe. A callback that calls ``st.rerun(scope="fragment")`` aborts the full
    run before it emits anything, so clearing at the start would throw away the
    app and leave a snapshot containing nothing but the fragment.

    Cached-message references are never produced for this client because it does
    not advertise cached hashes, so every message arrives with its payload.
    """

    def __init__(self) -> None:
        # Deltas with the id of the run that produced them, in arrival order,
        # so a later write to the same position wins.
        self._deltas: list[tuple[str, ForwardMsg]] = []
        # Standing facts about the app -- the page list, the title, how the last
        # run ended. Only the most recent of each kind matters, and a fragment
        # run does not re-emit them, so they are kept by type rather than
        # accumulated.
        self._lifecycle: dict[str, ForwardMsg] = {}
        self._run_finished = asyncio.Event()
        self._run_id = ""
        # Set when this interaction's run changed the query string, which is
        # how the server tells a browser to update its address bar.
        self.query_string_update: str | None = None
        # The fragments the most recent run re-rendered, which is what that run
        # owns when it finishes and stale deltas are dropped.
        self.fragments_last_run: list[str] = []

    def write_forward_msg(self, msg: ForwardMsg) -> None:
        msg_type = msg.WhichOneof("type")

        if msg_type == "new_session":
            self._run_id = msg.new_session.script_run_id
            self.fragments_last_run = list(msg.new_session.fragment_ids_this_run)
            self._run_finished.clear()

        if msg_type == "delta":
            self._deltas.append((self._run_id, msg))
            return

        if msg_type == "page_info_changed":
            self.query_string_update = msg.page_info_changed.query_string

        if msg_type is not None:
            self._lifecycle[msg_type] = msg

        if msg_type == "script_finished" and msg.script_finished in _SETTLING_STATUSES:
            self._drop_stale_deltas()
            self._run_finished.set()

    def _drop_stale_deltas(self) -> None:
        """Drop what the finished run was responsible for and did not re-emit.

        This is the frontend's stale-node rule over a message list: a full run
        replaces the whole tree, so anything older is gone, while a fragment run
        replaces only its own region and leaves the rest of the app standing.
        """
        running = set(self.fragments_last_run)
        self._deltas = [
            (run_id, msg)
            for run_id, msg in self._deltas
            if run_id == self._run_id
            or (running and msg.delta.fragment_id not in running)
        ]

    @property
    def messages(self) -> list[ForwardMsg]:
        return [*self._lifecycle.values(), *(msg for _, msg in self._deltas)]

    @property
    def client_context(self) -> ClientContext | None:
        return None

    def begin_interaction(self) -> None:
        self._run_finished.clear()
        self.query_string_update = None

    async def wait_until_settled(self, timeout: float) -> None:
        """Wait for the run chain to stop producing new runs.

        One client submission can cause several script runs through callbacks,
        ``st.rerun()``, or a page redirect. "Settled" means no further run
        started within a short grace period after the last one finished.
        """
        deadline = time.monotonic() + timeout

        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError
            try:
                await asyncio.wait_for(self._run_finished.wait(), remaining)
            except (TimeoutError, asyncio.TimeoutError) as exc:
                raise TimeoutError from exc

            # Give a follow-up run a chance to clear the event again.
            await asyncio.sleep(_RUN_CHAIN_SETTLE_SECONDS)
            if self._run_finished.is_set():
                return


@dataclass
class AgentSession:
    """Server-side bookkeeping for one agent session."""

    handle: str
    session_id: str
    client: AgentSessionClient
    # The query string this client holds, kept the way a browser keeps its
    # address bar: sent with each rerun, and updated when the server says it
    # changed. Deriving it per request instead would replay parameters a page
    # transition has already dropped.
    query_string: str = ""
    # Browser facts the client chose to state, resent with every rerun the way
    # a browser resends its own. None until a request supplies them, so the app
    # reads `st.context.timezone` as unknown rather than as a guess.
    context_info: ContextInfo | None = None
    # Who created the session, from the deployment's trusted identity headers.
    # The handle alone is a bearer credential, so a request carrying a
    # different identity is treated as not knowing the session at all.
    user_info: dict[str, Any] = field(default_factory=dict)
    last_used: float = field(default_factory=time.monotonic)
    element_states: dict[str, ElementState] = field(default_factory=dict)
    # Guards against a second interaction arriving while one is still running.
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class AgentSessionRegistry:
    """Tracks agent sessions and reclaims them once they go idle."""

    def __init__(self, runtime: Runtime) -> None:
        self._runtime = runtime
        self._sessions: dict[str, AgentSession] = {}

    def get(self, handle: str, user_info: dict[str, Any]) -> AgentSession:
        self._reclaim_idle()
        session = self._sessions.get(handle)
        if session is None or session.user_info != user_info:
            raise AgentRequestError(
                "unknown_session",
                f"Session {handle!r} does not exist or has expired. Omit "
                "`session_id` to start a new one.",
            )
        session.last_used = time.monotonic()
        return session

    def create(self, user_info: dict[str, Any]) -> AgentSession:
        self._reclaim_idle()
        max_sessions = int(config.get_option("server.agentMaxSessions"))
        if len(self._sessions) >= max_sessions:
            raise AgentRequestError(
                "too_many_sessions",
                f"This server already holds {max_sessions} agent sessions. "
                "Reuse an existing `session_id`, or retry once idle sessions "
                "expire.",
            )

        client = AgentSessionClient()
        session_id = self._runtime.connect_session(
            client=client, user_info=dict(user_info)
        )
        # Tell the element layer that this session's commands should describe
        # themselves. Sessions not registered here -- every browser session --
        # build nothing, so their messages never carry a description.
        agent_spec.register_agent_session(session_id)
        # An opaque bearer handle, long enough to be unguessable, so a client
        # cannot address another session, or a browser session, by trying ids.
        handle = f"s_{secrets.token_hex(16)}"
        session = AgentSession(
            handle=handle, session_id=session_id, client=client, user_info=user_info
        )
        self._sessions[handle] = session
        return session

    def close(self, handle: str) -> None:
        session = self._sessions.pop(handle, None)
        if session is not None:
            agent_spec.forget_agent_session(session.session_id)
            self._runtime.close_session(session.session_id)

    def _reclaim_idle(self) -> None:
        ttl = float(config.get_option("server.agentSessionTTL"))
        now = time.monotonic()
        for handle, session in list(self._sessions.items()):
            if now - session.last_used > ttl and not session.lock.locked():
                _LOGGER.debug("Reclaiming idle agent session %s", handle)
                self.close(handle)


async def interact(
    runtime: Runtime,
    registry: AgentSessionRegistry,
    request: dict[str, Any],
    *,
    user_info: dict[str, Any],
) -> dict[str, Any]:
    """Run one interaction and return the resulting snapshot document.

    ``user_info`` is what the deployment's trusted identity headers say about
    the caller, mapped the way the WebSocket maps them for a browser.
    """
    _validate_request_shape(request)

    handle = request.get("session_id")
    is_new_session = handle is None

    if is_new_session:
        # Both are rejected before a session exists, because element keys only
        # come from a snapshot and a creating call has not produced one yet.
        for field_name in ("widget_state", "trigger"):
            if request.get(field_name) is not None:
                raise AgentRequestError(
                    "invalid_request",
                    f"`{field_name}` cannot be sent on a creating call, because "
                    "element keys only exist once the app has run. Create the "
                    "session first, then act on the keys it returns.",
                )
        session = registry.create(user_info)
    else:
        if not isinstance(handle, str):
            raise AgentRequestError("invalid_request", "`session_id` must be a string.")
        session = registry.get(handle, user_info)

    if session.lock.locked():
        raise AgentRequestError(
            "session_busy",
            "This session already has an interaction in flight.",
        )

    try:
        async with session.lock:
            return await _run_interaction(runtime, session, request)
    except AgentRequestError as exc:
        # A creating call that fails after the session exists has still run the
        # app, so the session is real and usable. Hand its id back rather than
        # stranding the caller with a session it cannot continue or close.
        if is_new_session and exc.session_id is None:
            exc.session_id = session.handle
        raise


async def _run_interaction(
    runtime: Runtime,
    session: AgentSession,
    request: dict[str, Any],
) -> dict[str, Any]:
    app_session = _app_session(runtime, session)

    widget_state = request.get("widget_state")
    trigger = request.get("trigger")
    page = request.get("page")
    query_params = request.get("query_params")

    # `is not None`, not truthiness: an empty `trigger: {}` is falsy but is
    # still a malformed trigger, and silently treating it as "no trigger" turns
    # a client mistake into a plain rerun that looks like it worked.
    has_widget_change = widget_state is not None or trigger is not None
    if (page is not None or query_params is not None) and has_widget_change:
        raise AgentRequestError(
            "invalid_request",
            "Navigation (`page`, `query_params`) is a separate transition and "
            "cannot be combined with widget changes.",
        )

    client_state = app_session._client_state
    rerun = BackMsg().rerun_script
    rerun.page_script_hash = client_state.page_script_hash
    rerun.query_string = session.query_string

    context = request.get("context")
    context_info = session.context_info if context is None else _parse_context(context)
    if context_info is not None:
        rerun.context_info.CopyFrom(context_info)

    if page is not None:
        page_hash, page_name = _resolve_page(app_session, page)
        rerun.page_script_hash = page_hash
        rerun.page_name = page_name
    if query_params is not None:
        rerun.query_string = _encode_query_params(query_params)

    if has_widget_change:
        widget_states = build_widget_states(
            app_session.session_state,
            widget_state=widget_state,
            trigger=trigger,
            element_states=session.element_states,
        )
        rerun.widget_states.CopyFrom(widget_states)
        # Acting on something inside a fragment reruns only that fragment, as
        # it does in the browser. Navigation deliberately never scopes: it is a
        # whole-app transition, and it is already refused above in combination
        # with widget changes.
        rerun.fragment_id = resolve_fragment(
            app_session.session_state,
            session.element_states,
            widget_state=widget_state,
            trigger=trigger,
        )

    back_msg = BackMsg()
    back_msg.rerun_script.CopyFrom(rerun)

    session.context_info = context_info
    session.client.begin_interaction()
    runtime.handle_backmsg(session.session_id, back_msg)

    timeout = float(config.get_option("server.agentRunTimeout"))
    try:
        await session.client.wait_until_settled(timeout)
    except TimeoutError as exc:
        raise AgentRequestError(
            "run_timed_out",
            f"The app did not finish within {timeout:g} seconds. It may still be "
            "running; the next interaction on this session stops it and starts "
            "a fresh run.",
        ) from exc

    # Keep the query string the way a browser keeps its address bar: what was
    # sent, unless the run reported a change. Streamlit scopes widget-bound
    # parameters by page, so a page transition drops some, and replaying the
    # request's own string would keep reporting a filter the app has discarded.
    if session.client.query_string_update is not None:
        session.query_string = session.client.query_string_update
    else:
        session.query_string = rerun.query_string

    result = snapshot_module.build_snapshot(
        session_id=session.handle,
        messages=session.client.messages,
        session_state=app_session.session_state,
        query_params=_decode_query_params(session.query_string),
    )
    session.element_states = result.element_states
    session.last_used = time.monotonic()

    _verify_navigation_landed(page, result.document)
    return result.document


def _verify_navigation_landed(requested_page: Any, document: dict[str, Any]) -> None:
    """Reject a `page` that the app did not actually navigate to.

    On a creating call the page list does not exist yet, so `_resolve_page`
    hands an unrecognized path to the runtime rather than rejecting it -- which
    is right for a valid path, and silently lands on the default page for a
    typo. The page list exists by the time the run finishes, so check then. The
    run has already happened, which is why the message says so.
    """
    if not isinstance(requested_page, str):
        return

    landed = document.get("page", {}).get("url_path")
    if landed is None or landed == requested_page.strip("/"):
        return

    pages = document.get("pages", [])
    available = [page["url_path"] for page in pages]
    raise AgentRequestError(
        "unknown_page",
        f"No page with url_path {requested_page!r}; the app ran its default "
        f"page instead. Available: {sorted(available)}.",
        # The page list is the whole remedy, so it travels as data rather than
        # only inside the message.
        details={"pages": pages},
    )


def _app_session(runtime: Runtime, session: AgentSession) -> Any:
    session_info = runtime._session_mgr.get_active_session_info(session.session_id)
    if session_info is None:
        raise AgentRequestError(
            "unknown_session",
            "The underlying app session is gone. Start a new session.",
        )
    return session_info.session


def _validate_request_shape(request: dict[str, Any]) -> None:
    known = {"session_id", "widget_state", "trigger", "page", "query_params", "context"}
    unknown = set(request) - known
    if unknown:
        raise AgentRequestError(
            "invalid_request",
            f"Unknown request fields: {', '.join(sorted(unknown))}.",
        )

    widget_state = request.get("widget_state")
    if widget_state is not None and not isinstance(widget_state, dict):
        raise AgentRequestError("invalid_request", "`widget_state` must be an object.")

    trigger = request.get("trigger")
    if trigger is not None and not isinstance(trigger, dict):
        raise AgentRequestError(
            "invalid_request",
            "`trigger` must be an object with a `key`, and at most one may be sent.",
        )


def _resolve_page(app_session: Any, page: Any) -> tuple[str, str]:
    """Map a public ``url_path`` to a rerun target.

    Returns the internal page script hash when it is already known, and
    otherwise the path itself for the runtime to resolve. The second case is
    not an edge case: an ``st.navigation`` app has no page list until it has
    run once, so a creating call that names a page cannot look up a hash. The
    browser has the same problem on a cold load and solves it the same way, by
    sending ``page_name`` and letting the runtime resolve it.
    """
    if not isinstance(page, str):
        raise AgentRequestError("invalid_request", "`page` must be a string.")

    url_path = page.strip("/")
    pages = app_session._pages_manager.get_pages()
    known_paths = {info.get("url_pathname", "") for info in pages.values()}

    for page_hash, info in pages.items():
        if info.get("url_pathname", "") == url_path:
            return str(page_hash), ""

    if known_paths <= {""}:
        # Only the default page is registered, so the app has not declared its
        # pages yet. Hand the path to the runtime rather than guessing.
        return "", url_path

    raise AgentRequestError(
        "unknown_page",
        f"No page with url_path {page!r}. Available: {sorted(known_paths)}.",
    )


def _encode_query_params(query_params: Any) -> str:
    if not isinstance(query_params, dict):
        raise AgentRequestError(
            "invalid_request",
            "`query_params` must be an object mapping names to lists of strings.",
        )

    pairs: list[tuple[str, str]] = []
    for name, values in query_params.items():
        items = values if isinstance(values, list) else [values]
        for value in items:
            if not isinstance(value, (str, int, float, bool)):
                raise AgentRequestError(
                    "invalid_request",
                    f"Query parameter {name!r} must be a string or list of strings.",
                )
            pairs.append((str(name), str(value)))
    return urlencode(pairs)


def _parse_context(context: Any) -> ContextInfo:
    """Build the browser context a request states about its client.

    Only facts a browser sends about itself without authentication, so
    accepting them grants nothing. Identity never comes from here.
    """
    if not isinstance(context, dict):
        raise AgentRequestError("invalid_request", "`context` must be an object.")
    unknown = set(context) - {"timezone", "locale"}
    if unknown:
        raise AgentRequestError(
            "invalid_request",
            f"Unknown `context` fields: {', '.join(sorted(unknown))}. Supported: "
            "`timezone`, `locale`.",
        )

    info = ContextInfo()
    timezone = context.get("timezone")
    if timezone is not None:
        try:
            zone = ZoneInfo(timezone) if isinstance(timezone, str) else None
        except (ZoneInfoNotFoundError, ValueError):
            zone = None
        if zone is None:
            raise AgentRequestError(
                "invalid_request",
                f"`context.timezone` must be an IANA name such as "
                f"'Europe/Berlin', not {timezone!r}.",
            )
        info.timezone = timezone
        # A browser reports the offset alongside the name, as minutes behind
        # UTC the way JavaScript's getTimezoneOffset counts them. Deriving it
        # keeps the two from disagreeing.
        utc_offset = datetime.now(zone).utcoffset()
        info.timezone_offset = (
            -int(utc_offset.total_seconds()) // 60 if utc_offset is not None else 0
        )

    locale = context.get("locale")
    if locale is not None:
        if not isinstance(locale, str) or not locale:
            raise AgentRequestError(
                "invalid_request",
                "`context.locale` must be a language tag such as 'de-DE'.",
            )
        info.locale = locale
    return info


def _decode_query_params(query_string: str) -> dict[str, list[str]]:
    from urllib.parse import parse_qs

    return parse_qs(query_string, keep_blank_values=True)
