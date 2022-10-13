# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from typing import Callable, Dict, List, Optional

from typing_extensions import Final

from streamlit.logger import get_logger
from streamlit.runtime.app_session import AppSession
from streamlit.runtime.session_data import SessionData
from streamlit.runtime.session_manager import (
    SessionClient,
    SessionInfo,
    SessionManager,
    SessionStorage,
)
from streamlit.runtime.uploaded_file_manager import UploadedFileManager
from streamlit.watcher import LocalSourcesWatcher

LOGGER: Final = get_logger(__name__)


class WebsocketSessionManager(SessionManager):
    def __init__(
        self,
        session_storage: SessionStorage,
        uploaded_file_manager: UploadedFileManager,
        message_enqueued_callback: Optional[Callable[[], None]],
    ) -> None:
        # NOTE: We intentionally don't do anything with session_storage for now as we
        # will initially implement WebsocketSessionManager so the current runtime
        # session handling behavior is unchanged.
        #
        # A concrete session_storage class will be implemented and used in subsequent
        # changes when we add session reuse on a websocket reconnect.
        #
        # Since we aren't worrying about session reconnects yet, we don't need to
        # differentiate between active and inactive sessions and can provide the minimal
        # implementation of a SessionManager below.

        self._uploaded_file_mgr = uploaded_file_manager
        self._message_enqueued_callback = message_enqueued_callback

        # Mapping of AppSession.id -> SessionInfo.
        self._session_info_by_id: Dict[str, SessionInfo] = {}

    def connect_session(
        self,
        client: SessionClient,
        session_data: SessionData,
        user_info: Dict[str, Optional[str]],
        existing_session_id: Optional[str] = None,  # unused for now
    ) -> str:
        session = AppSession(
            session_data=session_data,
            uploaded_file_manager=self._uploaded_file_mgr,
            message_enqueued_callback=self._message_enqueued_callback,
            local_sources_watcher=LocalSourcesWatcher(session_data.main_script_path),
            user_info=user_info,
        )

        LOGGER.debug(
            "Created new session for client %s. Session ID: %s", id(client), session.id
        )

        assert (
            session.id not in self._session_info_by_id
        ), f"session.id '{session.id}' registered multiple times!"

        self._session_info_by_id[session.id] = SessionInfo(client, session)
        return session.id

    def close_session(self, session_id: str) -> None:
        if session_id in self._session_info_by_id:
            session_info = self._session_info_by_id[session_id]
            del self._session_info_by_id[session_id]
            session_info.session.shutdown()

    def get_session_info(self, session_id: str) -> Optional[SessionInfo]:
        return self._session_info_by_id.get(session_id, None)

    def list_sessions(self) -> List[SessionInfo]:
        # Shallow-clone our sessions into a list, so we can iterate
        # over it and not worry about whether it's being changed
        # outside this coroutine.
        return list(self._session_info_by_id.values())
