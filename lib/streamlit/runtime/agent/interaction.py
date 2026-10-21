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

"""Drive a real AppSession from an agent API request and wait for it to settle.

An agent session is an ordinary ``AppSession`` whose client accumulates
ForwardMsgs instead of writing them to a WebSocket. Input goes through the same
``rerun_script`` path the browser uses, so callbacks, widget reconciliation, and
stale-node cleanup are the runtime's own behavior. ``interact`` serves one
request: it creates or finds the session, checks the widget values and trigger
the request sends against the last snapshot, reruns the session with them,
waits until the run chain has settled, and returns the encoded snapshot.
"""

from __future__ import annotations

import asyncio
import contextlib
import functools
import re
import secrets
import threading
import time
import zoneinfo
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any, Final
from urllib.parse import parse_qs, parse_qsl, urlencode

from streamlit import config
from streamlit.elements.lib import agent_spec
from streamlit.logger import get_logger
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ClientState_pb2 import ContextInfo
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime import RuntimeState
from streamlit.runtime.agent import snapshot, widget_patch
from streamlit.runtime.agent.errors import AgentRequestError
from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState
from streamlit.runtime.scriptrunner_utils.script_run_context_attr import (
    SCRIPT_RUN_CONTEXT_ATTR_NAME,
)
from streamlit.runtime.session_manager import SessionClient
from streamlit.runtime.state.query_params import EMBED_QUERY_PARAMS_KEYS

if TYPE_CHECKING:
    from collections.abc import Callable, Generator, Iterable, Mapping

    from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
    from streamlit.proto.WidgetStates_pb2 import WidgetStates
    from streamlit.runtime.agent.snapshot import ElementState, Snapshot
    from streamlit.runtime.app_session import AppSession
    from streamlit.runtime.runtime import Runtime
    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        ScriptRunContext,
        UserInfoType,
    )
    from streamlit.runtime.session_manager import ClientContext
    from streamlit.runtime.state.query_params import QueryParams
    from streamlit.runtime.state.session_state import SessionState
    from streamlit.source_util import PageHash, PageInfo

_LOGGER: Final = get_logger(__name__)

# The longest an idle session outlives its TTL while no request arrives.
_SWEEP_SECONDS: Final = 60.0

_STOPPED_RUNTIME_STATES: Final = frozenset(
    {RuntimeState.STOPPING, RuntimeState.STOPPED}
)

_SETTLING_STATUSES: Final = frozenset(
    {
        ForwardMsg.FINISHED_SUCCESSFULLY,
        # A fragment run is a complete run of its own, and an app that calls
        # `st.rerun(scope="fragment")` never produces anything else.
        ForwardMsg.FINISHED_FRAGMENT_RUN_SUCCESSFULLY,
        ForwardMsg.FINISHED_WITH_COMPILE_ERROR,
    }
)

# Request headers that never reach `st.context.headers`. The route reads no
# cookie, and `Authorization` and `Proxy-Authorization` are credentials for
# whatever fronts the app, not for app code.
_WITHHELD_HEADERS: Final = frozenset({"cookie", "authorization", "proxy-authorization"})


class _RequestContext:
    """What `st.context` reads for an agent session: the request being served.

    A browser session's headers are those of its WebSocket handshake, fixed for
    the connection. An agent session's follow each request instead, because a
    platform can mint a short-lived token per request, such as the
    caller's-rights token a Snowflake app opens its connection with.
    """

    def __init__(self, headers: Iterable[tuple[str, str]]) -> None:
        self._headers = [
            (name, value)
            for name, value in headers
            if name.lower() not in _WITHHELD_HEADERS
        ]

    @property
    def headers(self) -> Iterable[tuple[str, str]]:
        return self._headers

    @property
    def cookies(self) -> Mapping[str, str]:
        return {}

    @property
    def remote_ip(self) -> str | None:
        return None


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

    One deliberate difference: a compile error prunes too. The browser keeps
    the previous page visible behind the error, but a snapshot of it would
    offer actions for a script that no longer runs.

    Cached-message references are never produced for this client because it does
    not advertise cached hashes, so every message arrives with its payload.
    """

    def __init__(self) -> None:
        # Deltas with the id of the run that produced them, in arrival order,
        # so a later write to the same position wins.
        self._deltas: list[tuple[str, ForwardMsg]] = []
        # Where in `_deltas` the current run last wrote an element at each
        # position. An element rewritten in place -- `st.write_stream` chunks,
        # a progress loop, a placeholder updated in a loop -- then replaces its
        # earlier write instead of piling up until the run ends.
        self._element_at: dict[tuple[int, ...], int] = {}
        # Standing facts about the app -- the page list, the title, how the last
        # run ended. Only the most recent of each kind matters, and a fragment
        # run does not re-emit them, so they are kept by kind rather than
        # accumulated.
        self._lifecycle: dict[str, ForwardMsg] = {}
        self._run_id = ""
        # The fragments the most recent run re-rendered, which is what that run
        # owns when it finishes and stale deltas are dropped.
        self._fragments_this_run: frozenset[str] = frozenset()
        # When the last run settled, which is session activity even when no
        # request is waiting for it.
        self.finished_at = time.monotonic()
        # Set when this interaction's run changed the query string, which is
        # how the server tells a browser to update its address bar.
        self.query_string_update: str | None = None
        # The request the current interaction is serving, as `st.context` sees it.
        self.request_context: _RequestContext | None = None

    def write_forward_msg(self, msg: ForwardMsg) -> None:
        """Buffer a message. Never raises.

        Called inside the runtime's message loop, which an exception would end
        for every session on the server, browsers included. A failure here is
        logged, and costs at most this session's snapshot.
        """
        try:
            self._write(msg)
        except Exception:
            _LOGGER.exception("Agent session client failed to buffer a message.")

    @property
    def messages(self) -> list[ForwardMsg]:
        """The messages that make up the page, as a snapshot reads them."""
        return [*self._lifecycle.values(), *(msg for _, msg in self._deltas)]

    @property
    def client_context(self) -> ClientContext | None:
        return self.request_context

    def begin_interaction(self) -> None:
        """Forget what the previous interaction's run reported."""
        self.query_string_update = None

    def _write(self, msg: ForwardMsg) -> None:
        msg_type = msg.WhichOneof("type")

        if msg_type == "new_session":
            self._run_id = msg.new_session.script_run_id
            self._fragments_this_run = frozenset(msg.new_session.fragment_ids_this_run)
            self._element_at = {}

        if msg_type == "delta":
            self._add_delta(msg)
            return

        if msg_type == "page_info_changed":
            self.query_string_update = msg.page_info_changed.query_string

        if msg_type == "session_event":
            # Kept per event, so a later `script_changed_on_disk` cannot evict
            # the compile error a snapshot reports.
            self._lifecycle[f"session_event.{msg.session_event.WhichOneof('type')}"] = (
                msg
            )
        elif msg_type is not None:
            self._lifecycle[msg_type] = msg

        if msg_type == "script_finished" and msg.script_finished in _SETTLING_STATUSES:
            self._drop_stale_deltas()
            self.finished_at = time.monotonic()

    def _add_delta(self, msg: ForwardMsg) -> None:
        position = tuple(msg.metadata.delta_path)
        if msg.delta.WhichOneof("type") == "new_element":
            index = self._element_at.get(position)
            if index is not None:
                self._deltas[index] = (self._run_id, msg)
                return
            self._element_at[position] = len(self._deltas)
        else:
            # A block written here supersedes what was at and below it, and an
            # element written after it has to come after it, so stop replacing
            # there. Otherwise a child of a cleared and rebuilt container would
            # land in its old slot, before the clear, and be erased by it.
            depth = len(position)
            for cached in [p for p in self._element_at if p[:depth] == position]:
                del self._element_at[cached]
        self._deltas.append((self._run_id, msg))

    def _drop_stale_deltas(self) -> None:
        """Drop what the finished run was responsible for and did not re-emit.

        This is the frontend's stale-node rule over a message list: a full run
        replaces the whole tree, so anything older is gone, while a fragment run
        replaces only its own region and leaves the rest of the app standing.
        """
        running = self._fragments_this_run
        # Its indexes point into the list being replaced.
        self._element_at = {}
        self._deltas = [
            (run_id, msg)
            for run_id, msg in self._deltas
            if run_id == self._run_id
            or (running and msg.delta.fragment_id not in running)
        ]


# The request fields that say what an interaction does. Two requests with the
# same values ask for the same thing, so a retry of a timed-out click collects
# its run rather than firing the click again.
_ACTION_FIELDS: Final = ("widget_state", "trigger", "page", "query_params", "context")

# Every field an `interact` request may carry.
_REQUEST_FIELDS: Final = frozenset({"session_id", *_ACTION_FIELDS})

# Generous for a BCP 47 tag with extensions, which is what a browser reports.
_MAX_LOCALE_LENGTH: Final = 64

# The shape of a BCP 47 language tag: a language, then hyphenated subtags, as
# in "de-DE" or "zh-Hans-CN". Not a POSIX locale such as "en_US.UTF-8", which a
# browser never reports and a locale library would refuse.
_LANGUAGE_TAG: Final = re.compile(r"[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*")


@functools.cache
def _known_timezones() -> frozenset[str]:
    return frozenset(zoneinfo.available_timezones())


@dataclass
class _EncodedSnapshot:
    """A settled interaction's snapshot and its encoded response body."""

    snapshot: Snapshot
    body: bytes


@dataclass
class _Interaction:
    """What a sent interaction needs once its run chain settles."""

    # The request's action fields, so a retry can be recognized.
    action: dict[str, Any]
    # The query string the request sent, kept unless the run reports a change.
    query_string: str
    # A `page` handed to the runtime unresolved, which can only be checked once
    # the run has produced the page list.
    unverified_page: str | None
    # When the run was sent, so a retry that times out again can say how long
    # it has been running.
    started: float = field(default_factory=time.monotonic)
    # The result built for a client that left while it was being built, so
    # the retry that collects the interaction does not build it again.
    built: _EncodedSnapshot | None = None


def _released_event() -> asyncio.Event:
    event = asyncio.Event()
    event.set()
    return event


@dataclass
class AgentSession:
    """Server-side bookkeeping for one agent session."""

    handle: str
    app_session_id: str
    client: AgentSessionClient
    # Who created the session, from the deployment's trusted identity headers.
    # The handle alone is a bearer credential, so a request carrying a
    # different identity is treated as not knowing the session at all.
    user_info: UserInfoType
    # The query string this client holds, kept the way a browser keeps its
    # address bar: sent with each rerun, and updated when the server says it
    # changed. Deriving it per request instead would replay parameters a page
    # transition has already dropped.
    query_string: str = ""
    # Browser facts the client chose to state, resent with every rerun the way
    # a browser resends its own. None until a request supplies them, so the app
    # reads `st.context.timezone` as unknown rather than as a guess.
    context_info: ContextInfo | None = None
    last_used: float = field(default_factory=time.monotonic)
    # The last snapshot's `pages`, which an `unknown_page` error lists.
    pages: list[dict[str, Any]] = field(default_factory=list)
    # What the last snapshot recorded about each keyed element, which the next
    # request's widget values and trigger are checked against.
    element_states: dict[str, ElementState] = field(default_factory=dict)
    # Set while an interaction is in flight; a second one is refused, not queued.
    busy: bool = False
    # Set whenever `busy` is not, so the retry that collects an interaction
    # whose client left can wait for the session to free up.
    released: asyncio.Event = field(default_factory=_released_event)
    # An interaction that outlasted the run timeout and whose result nobody has
    # collected yet. Its run keeps going, and a retry waits for it.
    timed_out: _Interaction | None = None


class AgentSessionRegistry:
    """Tracks agent sessions and reclaims them once they go idle.

    Reclaiming happens on every request and on a timer while any session
    exists, so a server that stops getting agent requests still releases each
    session's app session and media.

    Threading: UNSAFE. Every method must be called on the runtime's event loop.
    """

    def __init__(self, runtime: Runtime) -> None:
        self._runtime = runtime
        self._sessions: dict[str, AgentSession] = {}
        self._sweeper: asyncio.Task[None] | None = None

    def create(self, user_info: UserInfoType) -> AgentSession:
        """Create an agent session for ``user_info``, the caller's identity.

        Raises
        ------
        AgentRequestError
            ``too_many_sessions`` when the server already holds
            ``server.agentMaxSessions`` sessions after idle ones are reclaimed.
        """
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
        app_session_id = self._runtime.connect_session(
            client=client, user_info=dict(user_info)
        )
        # An opaque bearer handle, long enough to be unguessable, so a client
        # cannot address another session, or a browser session, by trying ids.
        handle = f"s_{secrets.token_hex(16)}"
        session = AgentSession(
            handle=handle,
            app_session_id=app_session_id,
            client=client,
            user_info=dict(user_info),
        )
        self._sessions[handle] = session
        try:
            # Tell the element layer that this session's commands should
            # describe themselves. Sessions not registered here -- every
            # browser session -- build nothing.
            agent_spec.register_agent_session(app_session_id)
            # The internal id never leaves the server, but a WebSocket naming
            # it must still not take the session over.
            self._runtime.mark_session_nonresumable(app_session_id)
            app_session = self.app_session(session)
            app_session.track_settling()
            # An edit applies on the next interaction, as with `runOnSave` off,
            # so a client is never handed the result of a run it did not ask
            # for.
            app_session.set_run_on_save(False)
        except Exception:
            self.close(handle)
            raise

        if self._sweeper is None or self._sweeper.done():
            self._sweeper = asyncio.get_running_loop().create_task(self._sweep())
        return session

    def get(self, handle: str, user_info: UserInfoType) -> AgentSession:
        """Find the session ``handle`` names, if ``user_info`` created it.

        Raises
        ------
        AgentRequestError
            ``unknown_session`` for a handle that does not exist, has expired,
            or belongs to a different identity.
        """
        self._reclaim_idle()
        session = self._sessions.get(handle)
        if session is None or session.user_info != user_info:
            ttl = _duration(float(config.get_option("server.agentSessionTTL")))
            raise AgentRequestError(
                "unknown_session",
                "This session does not exist or has expired: sessions end after "
                f"{ttl} without a request. Omit `session_id` to start a new one.",
            )
        session.last_used = time.monotonic()
        return session

    def app_session(self, session: AgentSession) -> AppSession:
        """The ``AppSession`` behind ``session``.

        Raises
        ------
        AgentRequestError
            ``unknown_session`` when the runtime no longer has it.
        """
        app_session = self._runtime.get_app_session(session.app_session_id)
        if app_session is None:
            raise AgentRequestError(
                "unknown_session",
                "This session's app session is gone. Omit `session_id` to start "
                "a new one.",
            )
        return app_session

    def close(self, handle: str) -> None:
        """Close the session ``handle`` names. Closing it again does nothing."""
        session = self._sessions.pop(handle, None)
        if session is not None:
            agent_spec.forget_agent_session(session.app_session_id)
            self._runtime.close_session(session.app_session_id)

    def _runtime_stopped(self) -> bool:
        return self._runtime.state in _STOPPED_RUNTIME_STATES

    async def _sweep(self) -> None:
        """Reclaim idle sessions on a timer, until none are left."""
        while self._sessions and not self._runtime_stopped():
            ttl = float(config.get_option("server.agentSessionTTL"))
            # At least a second apart, so a TTL of zero or less cannot spin the
            # event loop while a busy session is never reclaimed.
            await asyncio.sleep(min(max(ttl, 1.0), _SWEEP_SECONDS))
            if self._runtime_stopped():
                break
            try:
                self._reclaim_idle()
            except Exception:
                # The timer is what frees idle sessions while no request
                # arrives, so one failure must not end it.
                _LOGGER.exception("Failed to reclaim idle agent sessions.")

    def _reclaim_idle(self) -> None:
        ttl = float(config.get_option("server.agentSessionTTL"))
        now = time.monotonic()
        for handle, session in list(self._sessions.items()):
            app_session = self._runtime.get_app_session(session.app_session_id)
            idle_since = _idle_since(
                session, settled=app_session is None or app_session.is_settled
            )
            if idle_since is not None and now - idle_since > ttl:
                _LOGGER.debug(
                    "Reclaiming idle agent session %s", session.app_session_id
                )
                self.close(handle)


def _idle_since(session: AgentSession, *, settled: bool) -> float | None:
    """When a session last did anything, or None while a request is served.

    ``settled`` is whether the session's app has settled. Activity is the
    client's last request or the last run finishing, whichever is later, so a
    run that finishes after `run_timed_out` gets a full TTL to be collected.
    While that run is still going only requests count: a run that never
    finishes, such as a loop that calls `st.rerun()`, is reclaimed once its
    client stops asking for it, and closing the session stops it.
    """
    if session.busy:
        return None
    if session.timed_out is not None and not settled:
        return session.last_used
    return max(session.last_used, session.client.finished_at)


async def interact(
    runtime: Runtime,
    registry: AgentSessionRegistry,
    request: dict[str, Any],
    *,
    user_info: UserInfoType,
    headers: Iterable[tuple[str, str]],
    encode: Callable[[dict[str, Any]], bytes],
) -> bytes:
    """Run one interaction and return its encoded snapshot.

    A request's widget values and trigger are checked against the session's
    last snapshot, and the whole request is refused before anything runs if
    one of them is not legal there. The rerun carries them as a browser's
    would, scoped to a fragment when every one of them is inside it.

    Parameters
    ----------
    runtime : Runtime
        The runtime the agent sessions run in.
    registry : AgentSessionRegistry
        The agent sessions of ``runtime``.
    request : dict[str, Any]
        The parsed request body.
    user_info : UserInfoType
        What the deployment's trusted identity headers say about the caller,
        mapped the way the WebSocket maps them for a browser.
    headers : Iterable[tuple[str, str]]
        The request's headers, which the app reads as ``st.context.headers``
        when this request starts a run.
    encode : Callable[[dict[str, Any]], bytes]
        Turns the snapshot document into the response body. It runs in a worker
        thread together with the snapshot build, and may change the document.

    Returns
    -------
    bytes
        The response body for the settled snapshot.

    Raises
    ------
    AgentRequestError
        For every refusal the error catalog lists. A creating call that fails
        after its session exists carries that session's handle.
    """
    # Off the event loop, since it walks every string in a body that can be as
    # large as a message from the browser.
    requested_context = await asyncio.to_thread(_validate_request_shape, request)
    deadline = time.monotonic() + _run_timeout()

    handle = request.get("session_id")
    is_new_session = handle is None
    if handle is None:
        session = registry.create(user_info)
    else:
        session = registry.get(handle, user_info)

    if session.busy and _is_collecting_retry(session, request):
        # What is in flight is an interaction whose client left, still building
        # its snapshot, and this request collects it. Wait for that, as a retry
        # waits for a timed-out run, rather than refusing the one request the
        # session is waiting for.
        try:
            async with asyncio.timeout(deadline - time.monotonic()):
                await session.released.wait()
        except TimeoutError:
            # The build can finish in the same loop iteration the timeout
            # fires in.
            if session.busy:
                raise AgentRequestError(
                    "run_timed_out",
                    "The app has finished, but its snapshot was still being "
                    f"built after {_duration(_run_timeout())}. Nothing is lost: "
                    "send a request with only `session_id` to collect it.",
                    session_id=session.handle,
                ) from None
    # Checked and claimed with no await in between, so a second request on the
    # event loop always sees the claim. A lock would wait instead of refusing,
    # and could start the second interaction after its client had given up.
    if session.busy:
        raise AgentRequestError(
            "session_busy",
            "This session already has an interaction in flight. If it is one "
            "whose response you lost, send only `session_id` in a moment to "
            "collect it.",
        )
    session.busy = True
    session.released.clear()
    try:
        return await _run_interaction(
            runtime,
            registry.app_session(session),
            session,
            request,
            requested_context=requested_context,
            is_new_session=is_new_session,
            headers=headers,
            deadline=deadline,
            encode=encode,
        )
    except AgentRequestError as exc:
        # A creating call that fails after the session exists has still run the
        # app, so the session is real and usable. Hand its id back rather than
        # stranding the caller with a session it cannot continue.
        if is_new_session and exc.session_id is None:
            exc.session_id = session.handle
        raise
    except (Exception, asyncio.CancelledError):
        # An unexpected failure, or a client that left, gets no `session_id`,
        # so nobody could reach a session a creating call made, and it would
        # hold a slot until the TTL. `_wait_and_build` lets an abandoned build
        # finish before it re-raises, so closing never runs under one.
        if is_new_session:
            registry.close(session.handle)
        raise
    finally:
        # The idle TTL counts from the end of the last request, so a client
        # collecting a long run with retries is never reclaimed between them.
        session.last_used = time.monotonic()
        session.busy = False
        session.released.set()


def _run_timeout() -> float:
    return float(config.get_option("server.agentRunTimeout"))


def _duration(seconds: float) -> str:
    """Phrase a number of seconds for an error message, such as "15 minutes"."""
    if seconds and seconds % 60 == 0:
        amount, unit = seconds / 60, "minute"
    else:
        amount, unit = seconds, "second"
    return f"{amount:g} {unit}{'' if amount == 1 else 's'}"


def _action_of(request: dict[str, Any]) -> dict[str, Any]:
    """What a request asks to do: its action fields that are present."""
    return {
        name: request[name] for name in _ACTION_FIELDS if request.get(name) is not None
    }


def _is_collecting_retry(session: AgentSession, request: dict[str, Any]) -> bool:
    """Whether a request is a retry of the session's timed-out interaction:
    only `session_id`, or the same request again.
    """
    pending = session.timed_out
    action = _action_of(request)
    return pending is not None and (not action or action == pending.action)


async def _run_interaction(
    runtime: Runtime,
    app_session: AppSession,
    session: AgentSession,
    request: dict[str, Any],
    *,
    requested_context: ContextInfo | None,
    is_new_session: bool,
    headers: Iterable[tuple[str, str]],
    deadline: float,
    encode: Callable[[dict[str, Any]], bytes],
) -> bytes:
    pending = session.timed_out
    if pending is not None and _is_collecting_retry(session, request):
        # A retry of an interaction that outlasted the timeout. Starting another
        # run would interrupt the one doing the work, so a run that always took
        # longer than the timeout could never finish. Collect the original
        # instead: wait for its run, or return its result if it has finished.
        # The result is collected once; the same request after that is a new
        # interaction.
        session.timed_out = None
        return await _settle(
            app_session, session, pending, deadline=deadline, encode=encode
        )
    if pending is not None and not app_session.is_settled:
        # A browser would interrupt the run, but this one's result is still
        # owed to the client that started it.
        raise AgentRequestError(
            "session_busy",
            "This session is still running an interaction that timed out. "
            "Send only `session_id` to wait for it, then send this request.",
        )
    if pending is not None:
        # Its result goes uncollected, but its run happened, so this request
        # starts from the query string that run left, not the one before it.
        _keep_query_string(session, pending)

    page = request.get("page")
    query_params = request.get("query_params")

    back_msg = BackMsg()
    rerun = back_msg.rerun_script
    rerun.page_script_hash = app_session.page_script_hash
    rerun.query_string = session.query_string

    context_info = (
        session.context_info if requested_context is None else requested_context
    )
    if context_info is not None:
        rerun.context_info.CopyFrom(context_info)

    unverified_page: str | None = None
    if page is not None:
        page_hash, page_name = _resolve_page(
            app_session.get_pages(),
            page,
            can_defer=is_new_session,
            listed=session.pages,
        )
        if not page_hash:
            unverified_page = page_name
        if page_hash != rerun.page_script_hash:
            session_state = app_session.session_state
            rerun.query_string = _query_string_for_page_change(
                session_state.query_params, rerun.query_string
            )
            rerun.widget_states.widgets.extend(
                _widget_states_for_page_change(session_state, query_params)
            )
        rerun.page_script_hash = page_hash
        rerun.page_name = page_name
    if query_params is not None:
        rerun.query_string = _encode_query_params(query_params)

    # The shape check refused widget changes together with navigation, so no
    # widget states have been set above.
    widget_state = request.get("widget_state")
    trigger = request.get("trigger")
    if widget_state is not None or trigger is not None:
        widget_states, fragment_id = await _validate_writes(
            app_session, session, widget_state=widget_state, trigger=trigger
        )
        rerun.widget_states.CopyFrom(widget_states)
        rerun.query_string = _query_string_after_edits(
            app_session.session_state.query_params, widget_states, rerun.query_string
        )
        # The runtime ignores a rerun of a fragment it no longer holds, which
        # would drop the write without a word. A full rerun applies it.
        rerun.fragment_id = (
            fragment_id if fragment_id and app_session.has_fragment(fragment_id) else ""
        )

    session.context_info = context_info
    # A timed-out run that has since finished is left uncollected: the client
    # asked for something else.
    session.timed_out = None
    # Set only when a run starts: a refused request, or a retry collecting a run
    # already going, must not change what that run reads.
    session.client.request_context = _RequestContext(headers)
    session.client.begin_interaction()
    runtime.handle_backmsg(session.app_session_id, back_msg)

    return await _settle(
        app_session,
        session,
        _Interaction(
            action=_action_of(request),
            query_string=rerun.query_string,
            unverified_page=unverified_page,
        ),
        deadline=deadline,
        encode=encode,
    )


async def _validate_writes(
    app_session: AppSession,
    session: AgentSession,
    *,
    widget_state: dict[str, Any] | None,
    trigger: dict[str, Any] | None,
) -> tuple[WidgetStates, str]:
    """Check a request's widget values and trigger against the last snapshot.

    Returns them encoded as a browser would send them, with the fragment the
    rerun is scoped to, or "" for a full rerun.
    """
    # Off the event loop, because it runs each addressed widget's
    # deserializer, which is widget code that can compare the app's own option
    # objects, and its cost grows with the length of the option lists. Safe for
    # the same reason as the snapshot build: the session is claimed and
    # settled, so no run can start.
    validation = asyncio.ensure_future(
        asyncio.to_thread(
            _validate_in_worker,
            app_session.create_detached_script_run_ctx(
                query_string=session.query_string, context_info=session.context_info
            ),
            session_state=app_session.session_state,
            element_states=session.element_states,
            widget_state=widget_state,
            trigger=trigger,
        )
    )
    try:
        return await asyncio.shield(validation)
    except asyncio.CancelledError:
        # The client left. Nothing has run, so there is nothing for a retry to
        # collect, but the thread cannot be stopped and reads session state, so
        # the session stays claimed until it finishes.
        await _wait_ignoring_cancellation(validation)
        raise


async def _settle(
    app_session: AppSession,
    session: AgentSession,
    interaction: _Interaction,
    *,
    deadline: float,
    encode: Callable[[dict[str, Any]], bytes],
) -> bytes:
    """Wait for a sent interaction's run chain to settle, then snapshot it.

    A result already built for a client that left is used as it is: the
    session stayed claimed while it was built, so nothing has run since.
    """
    if interaction.built is None:
        interaction.built = await _wait_and_build(
            app_session, session, interaction, deadline=deadline, encode=encode
        )
    built = interaction.built
    session.pages = built.snapshot.document.get("pages", [])
    session.element_states = built.snapshot.element_states
    session.last_used = time.monotonic()

    if interaction.unverified_page is not None:
        _verify_page_exists(interaction.unverified_page, session)
    return built.body


async def _wait_and_build(
    app_session: AppSession,
    session: AgentSession,
    interaction: _Interaction,
    *,
    deadline: float,
    encode: Callable[[dict[str, Any]], bytes],
) -> _EncodedSnapshot:
    try:
        async with asyncio.timeout(deadline - time.monotonic()):
            await app_session.wait_until_settled()
    except asyncio.CancelledError:
        # The client went away before the run settled. The run keeps going, as
        # after a timeout, so the client's retry collects it rather than being
        # told the session is busy or starting the run again.
        session.timed_out = interaction
        raise
    except TimeoutError as exc:
        # The run can settle in the same loop iteration the timeout fires in.
        if not app_session.is_settled:
            session.timed_out = interaction
            timeout = _duration(_run_timeout())
            elapsed = _duration(round(time.monotonic() - interaction.started))
            raise AgentRequestError(
                "run_timed_out",
                f"The app did not finish within {timeout}, and is still "
                f"running, {elapsed} after this interaction started. "
                "Nothing is lost: send a request with only `session_id` to wait "
                "for it without starting it over.",
                # Always included, because the remedy is a request on this session.
                session_id=session.handle,
            ) from exc

    _keep_query_string(session, interaction)

    # Built and encoded off the event loop, because it reads every table's
    # Arrow data and runs the app's `format_func`s, which would stall every
    # session on the server. Safe while the session is claimed and settled: no
    # run can start, and the message list is copied here, on the loop that
    # appends to it.
    build = asyncio.ensure_future(
        asyncio.to_thread(
            _build_in_worker,
            app_session.create_detached_script_run_ctx(
                query_string=session.query_string, context_info=session.context_info
            ),
            encode,
            session_id=session.handle,
            messages=session.client.messages,
            session_state=app_session.session_state,
            query_params=parse_qs(session.query_string, keep_blank_values=True),
        )
    )
    try:
        return await asyncio.shield(build)
    except asyncio.CancelledError:
        # The client left while the snapshot was built. The run has settled, so
        # its retry collects it, exactly as for a client that left earlier. The
        # thread cannot be stopped and reads session state, so the session stays
        # claimed until it finishes: a new interaction must not run under it.
        # Its result is kept for that retry.
        session.timed_out = interaction
        await _wait_ignoring_cancellation(build)
        if not build.cancelled() and build.exception() is None:
            interaction.built = build.result()
        raise


def _keep_query_string(session: AgentSession, interaction: _Interaction) -> None:
    """Record the query string a settled interaction's run left.

    Kept the way a browser keeps its address bar: what was sent, unless the
    run reported a change. Streamlit scopes widget-bound parameters by page, so
    a page transition drops some, and replaying the request's own string would
    keep reporting a filter the app has discarded.
    """
    if session.client.query_string_update is not None:
        session.query_string = session.client.query_string_update
    else:
        session.query_string = interaction.query_string


async def _wait_ignoring_cancellation(future: asyncio.Future[Any]) -> None:
    """Wait until ``future`` is done, even if this task is cancelled again."""
    while not future.done():
        with contextlib.suppress(asyncio.CancelledError):
            await asyncio.wait({future})


@contextlib.contextmanager
def _script_ctx(ctx: ScriptRunContext) -> Generator[None, None, None]:
    """Make ``ctx`` the calling worker thread's script context while in use.

    App code run in a worker, such as a ``format_func``, may read
    ``st.session_state`` or ``st.context``, and would otherwise find no
    session. The context drops every message, so an ``st.*`` command called
    there has no effect.

    The context is cleared afterwards, because the executor reuses its threads
    for unrelated work. ``ThreadState`` lives in the context variables
    ``asyncio.to_thread`` copied for this call, so it never outlives it.
    """
    thread = threading.current_thread()
    setattr(thread, SCRIPT_RUN_CONTEXT_ATTR_NAME, ctx)
    try:
        ThreadState.initialize(active_script_hash=ctx.pages_manager.main_script_hash)
        yield
    finally:
        setattr(thread, SCRIPT_RUN_CONTEXT_ATTR_NAME, None)


def _build_in_worker(
    ctx: ScriptRunContext,
    encode: Callable[[dict[str, Any]], bytes],
    *,
    session_id: str,
    messages: list[ForwardMsg],
    session_state: SessionState,
    query_params: dict[str, list[str]],
) -> _EncodedSnapshot:
    """Build and encode a snapshot with ``ctx`` as the thread's script context.

    A widget's ``value`` runs the app's ``format_func``, which may read
    ``st.session_state`` or ``st.context`` and would otherwise format a label
    the run never offered.
    """
    with _script_ctx(ctx):
        built_snapshot = snapshot.build_snapshot(
            session_id=session_id,
            messages=messages,
            session_state=session_state,
            query_params=query_params,
        )
        return _EncodedSnapshot(
            snapshot=built_snapshot, body=encode(built_snapshot.document)
        )


def _validate_in_worker(
    ctx: ScriptRunContext,
    *,
    session_state: SessionState,
    element_states: Mapping[str, ElementState],
    widget_state: Mapping[str, Any] | None,
    trigger: Mapping[str, Any] | None,
) -> tuple[WidgetStates, str]:
    """Encode a request's writes and find their fragment, with ``ctx`` as the
    thread's script context.

    The fragment is resolved once every key has been accepted, so a refusal
    that names one key, such as a form error, wins over ``cross_dialog_batch``.
    """
    with _script_ctx(ctx):
        widget_states = widget_patch.build_widget_states(
            session_state,
            widget_state=widget_state,
            trigger=trigger,
            element_states=element_states,
        )
        fragment_id = widget_patch.resolve_fragment(
            session_state,
            element_states,
            widget_state=widget_state,
            trigger=trigger,
        )
    return widget_states, fragment_id


def _verify_page_exists(url_path: str, session: AgentSession) -> None:
    """Reject a `page` that the run showed does not exist.

    On a creating call `_resolve_page` hands an unrecognized path to the
    runtime, because the page list does not exist yet, and a typo then lands
    on the default page. The page list exists once the run finishes, so the
    check happens then, and the message says the run already happened.

    Checked against the page list rather than where the run ended up: an app
    may redirect with `st.switch_page`, which is not the client's mistake.
    Only a creating call defers this check, so the error always carries the
    session it created, including when a retry collects a timed-out run.
    """
    pages = session.pages
    if not pages or url_path in (page.get("url_path") for page in pages):
        return

    raise AgentRequestError(
        "unknown_page",
        f"No page with url_path {url_path!r}; the app ran its default "
        "page instead. `error.pages` lists the available pages.",
        # The page list is the whole remedy, so it travels as data rather than
        # only inside the message.
        details={"pages": pages},
        session_id=session.handle,
    )


def _refuse_invalid_text(request: Any) -> None:
    r"""Refuse text anywhere in a request that is not valid Unicode.

    JSON allows a lone UTF-16 surrogate such as "\ud800". It decodes into a
    Python string that fails only later, when protobuf, the URL, or a response
    encodes it. Walked without recursion, since the parser already allowed the
    request's nesting depth.
    """
    pending = [request]
    while pending:
        item = pending.pop()
        if isinstance(item, dict):
            pending.extend(item)
            pending.extend(item.values())
        elif isinstance(item, list):
            pending.extend(item)
        elif isinstance(item, str):
            try:
                item.encode("utf-8")
            except UnicodeEncodeError:
                raise AgentRequestError(
                    "invalid_request",
                    "The request contains text that is not valid Unicode, such "
                    "as a lone surrogate escape like \\ud800.",
                ) from None


def _validate_request_shape(request: dict[str, Any]) -> ContextInfo | None:
    """Refuse a malformed request before anything is allocated or run.

    Returns the request's parsed ``context``, or None when it has none, so the
    run does not parse it again on the event loop.
    """
    _refuse_invalid_text(request)
    unknown = set(request) - _REQUEST_FIELDS
    if unknown:
        raise AgentRequestError(
            "invalid_request",
            f"Unknown request fields: {', '.join(sorted(unknown))}.",
        )
    _refuse_malformed_writes(request)

    # Checked here, before a creating call allocates a session, rather than
    # where they are applied; parsing them has no effect.
    if request.get("page") is not None and not isinstance(request["page"], str):
        raise AgentRequestError("invalid_request", "`page` must be a string.")
    if request.get("query_params") is not None:
        _encode_query_params(request["query_params"])
    session_id = request.get("session_id")
    if session_id is not None and not isinstance(session_id, str):
        raise AgentRequestError("invalid_request", "`session_id` must be a string.")
    context = request.get("context")
    return None if context is None else _parse_context(context)


def _refuse_malformed_writes(request: dict[str, Any]) -> None:
    """Refuse ``widget_state`` and ``trigger`` of the wrong shape, or where
    they cannot apply.

    Present means not None, so an empty ``trigger`` is a malformed trigger
    rather than a plain rerun that looks like it worked.
    """
    widget_state = request.get("widget_state")
    if widget_state is not None and not isinstance(widget_state, dict):
        raise AgentRequestError("invalid_request", "`widget_state` must be an object.")

    trigger = request.get("trigger")
    if trigger is not None:
        if not isinstance(trigger, dict):
            raise AgentRequestError(
                "invalid_request",
                "`trigger` must be an object with a `key`, and at most one may "
                "be sent.",
            )
        if extra := set(trigger) - {"key", "value"}:
            raise AgentRequestError(
                "invalid_request",
                f"Unknown `trigger` fields: {', '.join(sorted(extra))}. A trigger "
                "has a `key` and, for payload-bearing triggers, a `value`.",
            )
        if not isinstance(trigger.get("key"), str):
            raise AgentRequestError(
                "invalid_request",
                "`trigger` must be an object with a string `key`. To rerun "
                "without changing anything, send no `trigger` at all.",
            )

    writes = [
        name for name in ("widget_state", "trigger") if request.get(name) is not None
    ]
    if writes and request.get("session_id") is None:
        raise AgentRequestError(
            "invalid_request",
            f"`{writes[0]}` cannot be sent on a creating call, because element "
            "keys only exist once the app has run. Create the session first, "
            "then act on the keys it returns.",
        )
    if writes and (
        request.get("page") is not None or request.get("query_params") is not None
    ):
        raise AgentRequestError(
            "invalid_request",
            "Navigation (`page`, `query_params`) is a separate transition and "
            "cannot be combined with widget changes.",
        )


def _resolve_page(
    pages: dict[PageHash, PageInfo],
    page: str,
    *,
    can_defer: bool,
    listed: list[dict[str, Any]],
) -> tuple[str, str]:
    """Map a public ``url_path`` to a rerun target.

    Returns the internal page script hash when it is already known, and
    otherwise the path itself for the runtime to resolve. The second case is
    not an edge case: an ``st.navigation`` app has no page list until it has
    run once, so a creating call that names a page cannot look up a hash. The
    browser has the same problem on a cold load and solves it the same way, by
    sending ``page_name`` and letting the runtime resolve it.

    Only a creating call defers. Once the app has run, its page list is known,
    so an unknown path is refused before anything runs. The refusal lists the
    pages as the last snapshot did, ``listed``, when there is one.
    """
    url_path = page.strip("/")
    for page_hash, info in pages.items():
        if info.get("url_pathname", "") == url_path:
            return str(page_hash), ""

    known_paths = {info.get("url_pathname", "") for info in pages.values()}
    if can_defer and known_paths <= {""}:
        # Only the default page is registered, so the app has not declared its
        # pages yet. Hand the path to the runtime rather than guessing.
        return "", url_path

    raise AgentRequestError(
        "unknown_page",
        f"No page with url_path {page!r}. `error.pages` lists the available pages.",
        # As data, in the shape of the snapshot's `pages`, like the check a
        # creating call gets after its run.
        details={
            "pages": listed
            or [
                {
                    "url_path": info.get("url_pathname", ""),
                    **({"title": info["page_name"]} if info.get("page_name") else {}),
                    **({"icon": info["icon"]} if info.get("icon") else {}),
                }
                for info in pages.values()
            ]
        },
    )


def _encode_query_params(query_params: Any) -> str:
    if not isinstance(query_params, dict):
        raise AgentRequestError(
            "invalid_request",
            "`query_params` must be an object mapping names to lists of strings.",
        )

    pairs: list[tuple[str, str]] = []
    for name, values in query_params.items():
        if not isinstance(values, list) or not all(
            isinstance(value, str) for value in values
        ):
            raise AgentRequestError(
                "invalid_request",
                f"Query parameter {name!r} must be a list of strings, such as "
                '["2001"].',
            )
        pairs.extend((name, value) for value in values)
    return urlencode(pairs)


def _filtered_query_string(query_string: str, keep: Callable[[str], bool]) -> str:
    """Rebuild ``query_string`` from the pairs whose names pass ``keep``.

    Blank values stay: an empty parameter is a real value.
    """
    return urlencode(
        [
            (name, value)
            for name, value in parse_qsl(query_string, keep_blank_values=True)
            if keep(name)
        ]
    )


def _query_string_after_edits(
    bindings: QueryParams, widget_states: WidgetStates, query_string: str
) -> str:
    """Drop the parameter of every bound widget the request sets.

    The browser rewrites a ``bind="query-params"`` parameter whenever its
    widget changes, and the runtime reads the address back: as
    ``st.query_params``, and to seed the next page's widgets. Kept as it was,
    the old value would be put back over the edit. Dropping it is enough to
    prevent that without reimplementing the browser's URL format: the widget
    keeps its value, and the parameter is missing until the runtime writes it
    back itself.
    """
    edited = {
        binding.param_key
        for state in widget_states.widgets
        if (binding := bindings.get_binding_for_widget(state.id)) is not None
    }
    return _filtered_query_string(query_string, lambda name: name not in edited)


def _query_string_for_page_change(bindings: QueryParams, query_string: str) -> str:
    """Keep what a browser keeps when it switches pages.

    That is the embed parameters and the ones bound to a widget; everything
    else is cleared, so a parameter one page was opened with does not follow
    the caller to the next. The run then drops bound parameters that belong to
    another page, and reports the result like any other change.
    """
    return _filtered_query_string(
        query_string,
        lambda name: name.lower() in EMBED_QUERY_PARAMS_KEYS or bindings.is_bound(name),
    )


def _widget_states_for_page_change(
    session_state: SessionState, query_params: dict[str, list[str]] | None
) -> list[WidgetStateProto]:
    """Every widget's current value, as a browser sends it with a page change.

    The runtime keeps the state and query-parameter binding of only the widgets
    a page change lists, so without them a widget the new page shares, such as
    one in the sidebar, would lose its parameter. A bound widget whose parameter
    the request sets is left out: the runtime prefers a sent value over the
    URL's, so the request's value would be ignored, where without a page change
    it sets the widget.
    """
    requested = set(query_params or ())
    bindings = session_state.query_params
    return [
        state
        for state in session_state.get_widget_states()
        if (binding := bindings.get_binding_for_widget(state.id)) is None
        or binding.param_key not in requested
    ]


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
        # Checked against the IANA names themselves rather than by loading the
        # zone, which on a case-insensitive filesystem also finds
        # "europe/berlin" and would hand the app that spelling.
        if not isinstance(timezone, str) or timezone not in _known_timezones():
            raise AgentRequestError(
                "invalid_request",
                f"`context.timezone` must be an IANA name such as "
                f"'Europe/Berlin', not {timezone!r}.",
            )
        info.timezone = timezone
        # A browser reports the offset alongside the name, as minutes behind
        # UTC the way JavaScript's getTimezoneOffset counts them. Deriving it
        # keeps the two from disagreeing.
        utc_offset = datetime.now(zoneinfo.ZoneInfo(timezone)).utcoffset()
        info.timezone_offset = (
            -int(utc_offset.total_seconds()) // 60 if utc_offset is not None else 0
        )

    locale = context.get("locale")
    if locale is not None:
        if (
            not isinstance(locale, str)
            or len(locale) > _MAX_LOCALE_LENGTH
            or not _LANGUAGE_TAG.fullmatch(locale)
        ):
            raise AgentRequestError(
                "invalid_request",
                "`context.locale` must be a language tag such as 'de-DE'.",
            )
        info.locale = locale
    return info
