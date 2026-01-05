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

import threading
import time
from typing import TYPE_CHECKING, Final, cast

from streamlit.logger import get_logger
from streamlit.runtime.app_session import AppSession
from streamlit.runtime.session_manager import (
    ActiveSessionInfo,
    SessionClient,
    SessionInfo,
    SessionManager,
    SessionStorage,
)
from streamlit.runtime.stats import (
    ACTIVE_SESSIONS_FAMILY,
    SESSION_DURATION_FAMILY,
    SESSION_EVENTS_FAMILY,
    CounterStat,
    GaugeStat,
    Stat,
    StatsProvider,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Mapping, Sequence

    from streamlit.runtime.script_data import ScriptData
    from streamlit.runtime.scriptrunner.script_cache import ScriptCache
    from streamlit.runtime.scriptrunner_utils.script_run_context import UserInfoType
    from streamlit.runtime.uploaded_file_manager import UploadedFileManager

_LOGGER: Final = get_logger(__name__)


_EVENT_TYPE_CONNECT: Final = "connect"
_EVENT_TYPE_RECONNECT: Final = "reconnect"
_EVENT_TYPE_DISCONNECT: Final = "disconnect"


class WebsocketSessionManager(SessionManager, StatsProvider):
    """A SessionManager used to manage sessions with lifecycles tied to those of a
    browser tab's websocket connection.

    WebsocketSessionManagers differentiate between "active" and "inactive" sessions.
    Active sessions are those with a currently active websocket connection. Inactive
    sessions are sessions without. Eventual cleanup of inactive sessions is a detail left
    to the specific SessionStorage that a WebsocketSessionManager is instantiated with.
    """

    @property
    def stats_families(self) -> Sequence[str]:
        return (SESSION_EVENTS_FAMILY, SESSION_DURATION_FAMILY, ACTIVE_SESSIONS_FAMILY)

    def __init__(
        self,
        session_storage: SessionStorage,
        uploaded_file_manager: UploadedFileManager,
        script_cache: ScriptCache,
        message_enqueued_callback: Callable[[], None] | None,
    ) -> None:
        self._session_storage = session_storage
        self._uploaded_file_mgr = uploaded_file_manager
        self._script_cache = script_cache
        self._message_enqueued_callback = message_enqueued_callback

        # Mapping of AppSession.id -> ActiveSessionInfo.
        self._active_session_info_by_id: dict[str, ActiveSessionInfo] = {}

        # Session event counters for metrics
        self._stats_lock = threading.Lock()
        self._connect_count: int = 0
        self._reconnect_count: int = 0
        self._disconnect_count: int = 0

        # Session duration tracking
        self._session_connect_times: dict[str, float] = {}
        self._total_session_duration_seconds: float = 0

    def connect_session(
        self,
        client: SessionClient,
        script_data: ScriptData,
        user_info: UserInfoType,
        existing_session_id: str | None = None,
        session_id_override: str | None = None,
    ) -> str:
        if existing_session_id and session_id_override:
            raise RuntimeError(
                "Only one of existing_session_id and session_id_override should be truthy. "
                "This should never happen."
            )

        if existing_session_id in self._active_session_info_by_id:
            _LOGGER.warning(
                "Session with id %s is already connected! Connecting to a new session.",
                existing_session_id,
            )

        session_info = (
            existing_session_id
            and existing_session_id not in self._active_session_info_by_id
            and self._session_storage.get(existing_session_id)
        )

        if isinstance(session_info, SessionInfo):
            existing_session = session_info.session
            existing_session.register_file_watchers()

            self._active_session_info_by_id[existing_session.id] = ActiveSessionInfo(
                client,
                existing_session,
                session_info.script_run_count,
            )
            self._session_storage.delete(existing_session.id)

            with self._stats_lock:
                self._reconnect_count += 1
                self._session_connect_times[existing_session.id] = time.monotonic()
            return existing_session.id

        session = AppSession(
            script_data=script_data,
            uploaded_file_manager=self._uploaded_file_mgr,
            script_cache=self._script_cache,
            message_enqueued_callback=self._message_enqueued_callback,
            user_info=user_info,
            session_id_override=session_id_override,
        )

        _LOGGER.debug(
            "Created new session for client %s. Session ID: %s", id(client), session.id
        )

        if session.id in self._active_session_info_by_id:
            raise RuntimeError(
                f"session.id '{session.id}' registered multiple times. "
                "This should never happen."
            )

        self._active_session_info_by_id[session.id] = ActiveSessionInfo(client, session)
        with self._stats_lock:
            self._connect_count += 1
            self._session_connect_times[session.id] = time.monotonic()
        return session.id

    def disconnect_session(self, session_id: str) -> None:
        if session_id in self._active_session_info_by_id:
            active_session_info = self._active_session_info_by_id[session_id]
            session = active_session_info.session

            session.request_script_stop()
            session.disconnect_file_watchers()
            session.clear_session_caches()

            self._session_storage.save(
                SessionInfo(
                    client=None,
                    session=session,
                    script_run_count=active_session_info.script_run_count,
                )
            )
            del self._active_session_info_by_id[session_id]
            with self._stats_lock:
                self._disconnect_count += 1
                self._accumulate_session_duration(session_id)

        if not self._active_session_info_by_id:
            # Avoid stale cached scripts when all file watchers and sessions are disconnected
            self._script_cache.clear()

    def get_active_session_info(self, session_id: str) -> ActiveSessionInfo | None:
        return self._active_session_info_by_id.get(session_id)

    def is_active_session(self, session_id: str) -> bool:
        return session_id in self._active_session_info_by_id

    def list_active_sessions(self) -> list[ActiveSessionInfo]:
        return list(self._active_session_info_by_id.values())

    def close_session(self, session_id: str) -> None:
        if session_id in self._active_session_info_by_id:
            active_session_info = self._active_session_info_by_id[session_id]
            del self._active_session_info_by_id[session_id]
            active_session_info.session.shutdown()
            # Count disconnect for active sessions being closed directly
            with self._stats_lock:
                self._disconnect_count += 1
                self._accumulate_session_duration(session_id)

            if not self._active_session_info_by_id:
                # Avoid stale cached scripts when all file watchers and sessions are disconnected
                self._script_cache.clear()
            return

        # For sessions in storage, the disconnect was already counted when
        # disconnect_session was called earlier.
        session_info = self._session_storage.get(session_id)
        if session_info:
            self._session_storage.delete(session_id)
            session_info.session.shutdown()
            with self._stats_lock:
                self._accumulate_session_duration(session_id)

    def _accumulate_session_duration(self, session_id: str) -> None:
        """Accumulate the session duration for a closed session.

        This method must be called while holding self._stats_lock.
        """
        connect_time = self._session_connect_times.pop(session_id, None)
        if connect_time is not None:
            duration = time.monotonic() - connect_time
            self._total_session_duration_seconds += duration

    def get_session_info(self, session_id: str) -> SessionInfo | None:
        session_info = self.get_active_session_info(session_id)
        if session_info:
            return cast("SessionInfo", session_info)
        return self._session_storage.get(session_id)

    def list_sessions(self) -> list[SessionInfo]:
        return (
            cast("list[SessionInfo]", self.list_active_sessions())
            + self._session_storage.list()
        )

    def get_stats(
        self, family_names: Sequence[str] | None = None
    ) -> Mapping[str, Sequence[Stat]]:
        """Return session-related metrics.

        Returns session event counters (connections, reconnections, disconnections)
        and the current count of active sessions.
        """
        result: dict[str, list[Stat]] = {}

        if family_names is None or SESSION_EVENTS_FAMILY in family_names:
            with self._stats_lock:
                connect_count = self._connect_count
                reconnect_count = self._reconnect_count
                disconnect_count = self._disconnect_count

            result[SESSION_EVENTS_FAMILY] = [
                CounterStat(
                    family_name=SESSION_EVENTS_FAMILY,
                    value=connect_count,
                    labels={"type": _EVENT_TYPE_CONNECT},
                    help="Total count of session events by type.",
                ),
                CounterStat(
                    family_name=SESSION_EVENTS_FAMILY,
                    value=reconnect_count,
                    labels={"type": _EVENT_TYPE_RECONNECT},
                    help="Total count of session events by type.",
                ),
                CounterStat(
                    family_name=SESSION_EVENTS_FAMILY,
                    value=disconnect_count,
                    labels={"type": _EVENT_TYPE_DISCONNECT},
                    help="Total count of session events by type.",
                ),
            ]

        if family_names is None or SESSION_DURATION_FAMILY in family_names:
            with self._stats_lock:
                total_duration = int(self._total_session_duration_seconds)

            result[SESSION_DURATION_FAMILY] = [
                CounterStat(
                    family_name=SESSION_DURATION_FAMILY,
                    value=total_duration,
                    unit="seconds",
                    help="Total time spent in active sessions, in seconds.",
                ),
            ]

        if family_names is None or ACTIVE_SESSIONS_FAMILY in family_names:
            result[ACTIVE_SESSIONS_FAMILY] = [
                GaugeStat(
                    family_name=ACTIVE_SESSIONS_FAMILY,
                    value=len(self._active_session_info_by_id),
                    help="Current number of active sessions.",
                ),
            ]

        return result
