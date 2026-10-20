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

"""Drive a real AppSession for the agent API.

An agent session is an ordinary ``AppSession`` whose client accumulates
ForwardMsgs instead of writing them to a WebSocket. Input goes through the same
``rerun_script`` path the browser uses, so callbacks, widget reconciliation, and
stale-node cleanup are the runtime's own behavior.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Final

from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.session_manager import SessionClient

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping

    from streamlit.runtime.session_manager import ClientContext

_LOGGER: Final = get_logger(__name__)

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
        # Indexes into the list being rebuilt.
        self._element_at = {}
        self._deltas = [
            (run_id, msg)
            for run_id, msg in self._deltas
            if run_id == self._run_id
            or (running and msg.delta.fragment_id not in running)
        ]
