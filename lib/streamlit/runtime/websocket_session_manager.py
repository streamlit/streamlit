# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from typing import TYPE_CHECKING, Callable, Final, List, cast

from streamlit.logger import get_logger
from streamlit.runtime.app_session import AppSession
from streamlit.runtime.session_manager import (
    ActiveSessionInfo,
    SessionClient,
    SessionInfo,
    SessionManager,
    SessionStorage,
)

if TYPE_CHECKING:
    from streamlit.runtime.script_data import ScriptData
    from streamlit.runtime.scriptrunner.script_cache import ScriptCache
    from streamlit.runtime.uploaded_file_manager import UploadedFileManager

_LOGGER: Final = get_logger(__name__)


class WebsocketSessionManager(SessionManager):
    """A SessionManager used to manage sessions with lifecycles tied to those of a
    browser tab's websocket connection.

    WebsocketSessionManagers differentiate between "active" and "inactive" sessions.
    Active sessions are those with a currently active websocket connection. Inactive
    sessions are sessions without. Eventual cleanup of inactive sessions is a detail left
    to the specific SessionStorage that a WebsocketSessionManager is instantiated with.
    """

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

    def connect_session(
        self,
        client: SessionClient,
        script_data: ScriptData,
        user_info: dict[str, str | None],
        existing_session_id: str | None = None,
        session_id_override: str | None = None,
    ) -> str:
        assert not (
            existing_session_id and session_id_override
        ), "Only one of existing_session_id and session_id_override should be truthy"

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

        if session_info:
            existing_session = session_info.session
            existing_session.register_file_watchers()

            self._active_session_info_by_id[existing_session.id] = ActiveSessionInfo(
                client,
                existing_session,
                session_info.script_run_count,
            )
            self._session_storage.delete(existing_session.id)

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

        assert (
            session.id not in self._active_session_info_by_id
        ), f"session.id '{session.id}' registered multiple times!"

        self._active_session_info_by_id[session.id] = ActiveSessionInfo(client, session)
        return session.id

    def disconnect_session(self, session_id: str) -> None:
        if session_id in self._active_session_info_by_id:
            active_session_info = self._active_session_info_by_id[session_id]
            session = active_session_info.session

            session.request_script_stop()
            session.disconnect_file_watchers()

            self._session_storage.save(SessionInfo(client=None, session=session))
            del self._active_session_info_by_id[session_id]

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
            return

        session_info = self._session_storage.get(session_id)
        if session_info:
            self._session_storage.delete(session_id)
            session_info.session.shutdown()

    def get_session_info(self, session_id: str) -> SessionInfo | None:
        session_info = self.get_active_session_info(session_id)
        if session_info:
            return cast(SessionInfo, session_info)
        return self._session_storage.get(session_id)

    def list_sessions(self) -> list[SessionInfo]:
        return (
            cast(List[SessionInfo], self.list_active_sessions())
            + self._session_storage.list()
        )
