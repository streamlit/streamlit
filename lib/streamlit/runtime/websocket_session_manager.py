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
from collections import defaultdict
from typing import TYPE_CHECKING, Final, cast

from streamlit import config
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
    USER_SESSION_EVENTS_FAMILY,
    CounterStat,
    GaugeStat,
    Stat,
    StatsProvider,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Mapping, Sequence

    from streamlit.runtime.script_data import ScriptData
    from streamlit.runtime.scriptrunner.script_cache import ScriptCache
    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        OnScriptErrorHandler,
        UserInfoType,
    )
    from streamlit.runtime.uploaded_file_manager import UploadedFileManager

_LOGGER: Final = get_logger(__name__)


_EVENT_TYPE_CONNECT: Final = "connect"
_EVENT_TYPE_RECONNECT: Final = "reconnect"
_EVENT_TYPE_DISCONNECT: Final = "disconnect"
_EVENT_TYPE_CLOSE: Final = "close"


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
        # USER_SESSION_EVENTS_FAMILY is advertised unconditionally so that the
        # StatsManager (which snapshots this property once at registration time)
        # always routes ?families=user_session_events requests to this provider.
        # Emission is gated separately in get_stats so the endpoint output is
        # unchanged while the feature is disabled.
        return (
            SESSION_EVENTS_FAMILY,
            SESSION_DURATION_FAMILY,
            ACTIVE_SESSIONS_FAMILY,
            USER_SESSION_EVENTS_FAMILY,
        )

    def __init__(
        self,
        session_storage: SessionStorage,
        uploaded_file_manager: UploadedFileManager,
        script_cache: ScriptCache,
        message_enqueued_callback: Callable[[], None] | None,
        on_script_error: OnScriptErrorHandler | None = None,
    ) -> None:
        self._session_storage = session_storage
        self._uploaded_file_mgr = uploaded_file_manager
        self._script_cache = script_cache
        self._message_enqueued_callback = message_enqueued_callback
        self._on_script_error = on_script_error

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

        # Per-user session-event counters, keyed by a canonical tuple of
        # (attr_name, attr_value) label pairs -> {event_type: count}. Only
        # populated when server.unsafeMetricsUserAttributes is non-empty. Never
        # pruned (bounded by the number of distinct users seen by the process).
        self._user_event_counts: defaultdict[
            tuple[tuple[str, str], ...], defaultdict[str, int]
        ] = defaultdict(lambda: defaultdict(int))
        # Identity cached per session id while a session is connected, so the
        # terminal disconnect/close event can be attributed to the connect-time
        # user. The entry is dropped on the first disconnect/close (and
        # refreshed on reconnect), so the cache stays bounded by the set of
        # currently-connected sessions and cannot leak when a disconnected
        # session is later evicted from storage without an explicit close.
        self._session_user_labels: dict[str, tuple[tuple[str, str], ...]] = {}

    def connect_session(
        self,
        client: SessionClient,
        script_data: ScriptData,
        user_info: UserInfoType,
        existing_session_id: str | None = None,
        session_id_override: str | None = None,
    ) -> str:
        if existing_session_id and session_id_override:  # pragma: no cover - defensive
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
                self._record_user_event(
                    existing_session.id, _EVENT_TYPE_RECONNECT, user_info
                )
            return existing_session.id

        session = AppSession(
            script_data=script_data,
            uploaded_file_manager=self._uploaded_file_mgr,
            script_cache=self._script_cache,
            message_enqueued_callback=self._message_enqueued_callback,
            user_info=user_info,
            session_id_override=session_id_override,
            on_script_error=self._on_script_error,
        )

        _LOGGER.debug(
            "Created new session for client %s. Session ID: %s", id(client), session.id
        )

        if (
            session.id in self._active_session_info_by_id
        ):  # pragma: no cover - defensive
            raise RuntimeError(
                f"session.id '{session.id}' registered multiple times. "
                "This should never happen."
            )

        self._active_session_info_by_id[session.id] = ActiveSessionInfo(client, session)
        with self._stats_lock:
            self._connect_count += 1
            self._session_connect_times[session.id] = time.monotonic()
            self._record_user_event(session.id, _EVENT_TYPE_CONNECT, user_info)
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
                self._record_cached_user_event(session_id, _EVENT_TYPE_DISCONNECT)

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
                self._record_cached_user_event(session_id, _EVENT_TYPE_CLOSE)

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
                self._record_cached_user_event(session_id, _EVENT_TYPE_CLOSE)

    def _accumulate_session_duration(self, session_id: str) -> None:
        """Accumulate the session duration for a closed session.

        This method must be called while holding self._stats_lock.
        """
        connect_time = self._session_connect_times.pop(session_id, None)
        if connect_time is not None:
            duration = time.monotonic() - connect_time
            self._total_session_duration_seconds += duration

    def _user_labels(
        self, user_info: UserInfoType
    ) -> tuple[tuple[str, str], ...] | None:
        """Resolve canonical (name, value) label pairs from user_info.

        Returns None when the feature is disabled (the option is empty).
        Missing/None attributes become "" (but other falsy values such as
        ``False`` are preserved).

        This method must be called while holding self._stats_lock.
        """
        attrs = config.get_option("server.unsafeMetricsUserAttributes")
        if not attrs:
            return None
        return tuple(
            sorted(
                (name, "" if (value := user_info.get(name)) is None else str(value))
                for name in attrs
            )
        )

    def _record_user_event(
        self, session_id: str, event_type: str, user_info: UserInfoType
    ) -> None:
        """Record a per-user connect/reconnect event and cache the identity.

        Best-effort: a telemetry failure must never break the session lifecycle.
        This method must be called while holding self._stats_lock.
        """
        try:
            labels = self._user_labels(user_info)
            if labels is not None:
                self._user_event_counts[labels][event_type] += 1
                self._session_user_labels[session_id] = labels
        except Exception:
            _LOGGER.debug(
                "Failed to record per-user %s event", event_type, exc_info=True
            )

    def _record_cached_user_event(self, session_id: str, event_type: str) -> None:
        """Record a per-user disconnect/close event using the cached identity.

        The cached identity is always removed (even when the feature is
        disabled), so the cache stays bounded by the currently-connected
        sessions and cannot leak when a disconnected session is later evicted
        from storage without an explicit close. The option is re-checked so a
        runtime-disable stops emitting new events. Best-effort: a telemetry
        failure must never break the session lifecycle. Must be called while
        holding self._stats_lock.
        """
        try:
            labels = self._session_user_labels.pop(session_id, None)
            if labels is not None and config.get_option(
                "server.unsafeMetricsUserAttributes"
            ):
                self._user_event_counts[labels][event_type] += 1
        except Exception:
            _LOGGER.debug(
                "Failed to record per-user %s event", event_type, exc_info=True
            )

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

        if config.get_option("server.unsafeMetricsUserAttributes") and (
            family_names is None or USER_SESSION_EVENTS_FAMILY in family_names
        ):
            with self._stats_lock:
                snapshot = {
                    labels: dict(events)
                    for labels, events in self._user_event_counts.items()
                }

            result[USER_SESSION_EVENTS_FAMILY] = [
                CounterStat(
                    family_name=USER_SESSION_EVENTS_FAMILY,
                    value=count,
                    # `type` must win over any user attribute; unpack user
                    # labels first so the discriminator is never shadowed.
                    labels={**dict(labels), "type": event_type},
                    help="Total count of session events by type and user.",
                )
                for labels, events in snapshot.items()
                for event_type, count in events.items()
            ]

        return result
