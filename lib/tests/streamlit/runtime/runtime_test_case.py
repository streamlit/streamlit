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

import asyncio
from typing import Callable, Dict, List, Optional
from unittest import mock

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime import Runtime, RuntimeConfig, RuntimeState
from streamlit.runtime.app_session import AppSession
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.session_manager import (
    SessionClient,
    SessionData,
    SessionInfo,
    SessionManager,
    SessionStorage,
)
from streamlit.runtime.uploaded_file_manager import UploadedFileManager
from tests.isolated_asyncio_test_case import IsolatedAsyncioTestCase


class MockSessionManager(SessionManager):
    """A MockSessionManager used for runtime tests.

    This is done so that our runtime tests don't rely on a specific SessionManager
    implementation.
    """

    def __init__(
        self,
        session_storage: SessionStorage,
        uploaded_file_manager: UploadedFileManager,
        message_enqueued_callback: Optional[Callable[[], None]],
    ) -> None:
        self._uploaded_file_mgr = uploaded_file_manager
        self._message_enqueued_callback = message_enqueued_callback

        # Mapping of AppSession.id -> SessionInfo.
        self._session_info_by_id: Dict[str, SessionInfo] = {}

    def connect_session(
        self,
        client: SessionClient,
        session_data: SessionData,
        user_info: Dict[str, Optional[str]],
        existing_session_id: Optional[str] = None,
    ) -> str:
        with mock.patch(
            "streamlit.runtime.scriptrunner.ScriptRunner", new=mock.MagicMock()
        ):
            session = AppSession(
                session_data=session_data,
                uploaded_file_manager=self._uploaded_file_mgr,
                message_enqueued_callback=self._message_enqueued_callback,
                local_sources_watcher=mock.MagicMock(),
                user_info=user_info,
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
        return list(self._session_info_by_id.values())


class RuntimeTestCase(IsolatedAsyncioTestCase):
    """Base class for tests that use streamlit.Runtime directly."""

    _next_session_id = 0

    async def asyncSetUp(self):
        config = RuntimeConfig(
            script_path="mock/script/path.py",
            command_line="",
            media_file_storage=MemoryMediaFileStorage("/mock/media"),
            session_manager_class=MockSessionManager,
            session_storage=mock.MagicMock(),
        )
        self.runtime = Runtime(config)

    async def asyncTearDown(self):
        # Stop the runtime, and return when it's stopped
        if self.runtime.state != RuntimeState.INITIAL:
            self.runtime.stop()
            await self.runtime.stopped
        Runtime._instance = None

    @staticmethod
    async def tick_runtime_loop() -> None:
        """Sleep just long enough to guarantee that the Runtime's loop
        has a chance to run.
        """
        # Our sleep time needs to be longer than the longest sleep time inside the
        # Runtime loop, which is 0.01 + (1 tick * number of connected sessions).
        # 0.03 is near-instant, and conservative enough that the tick will happen
        # under our test circumstances.
        await asyncio.sleep(0.03)

    def enqueue_forward_msg(self, session_id: str, msg: ForwardMsg) -> None:
        """Enqueue a ForwardMsg to a given session_id. It will be sent
        to the client on the next iteration through the run loop. (You can
        use `await self.tick_runtime_loop()` to tick the run loop.)
        """
        session_info = self.runtime._session_mgr.get_active_session_info(session_id)
        if session_info is None:
            return
        session_info.session._enqueue_forward_msg(msg)
