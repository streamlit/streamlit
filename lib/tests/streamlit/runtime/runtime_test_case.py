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
from unittest import mock

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime import media_file_manager
from streamlit.runtime.app_session import AppSession
from streamlit.runtime.runtime import Runtime, RuntimeConfig, RuntimeState
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from tests.isolated_asyncio_test_case import IsolatedAsyncioTestCase


class RuntimeTestCase(IsolatedAsyncioTestCase):
    """Base class for tests that use streamlit.Runtime directly."""

    _next_session_id = 0

    async def asyncSetUp(self):
        config = RuntimeConfig(
            script_path="mock/script/path.py",
            command_line="",
            media_file_storage=MemoryMediaFileStorage("/mock/media"),
        )
        self.runtime = Runtime(config)

    async def asyncTearDown(self):
        # Stop the runtime, and return when it's stopped
        if self.runtime.state != RuntimeState.INITIAL:
            self.runtime.stop()
            await self.runtime.stopped
        media_file_manager._media_file_manager = None

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
        session_info = self.runtime._get_session_info(session_id)
        if session_info is None:
            return
        session_info.session._enqueue_forward_msg(msg)

    def patch_app_session(self):
        """Mock the Runtime's AppSession import. Use this on tests where we don't want
        actual sessions to be instantiated, or scripts to be run.
        """
        return mock.patch(
            "streamlit.runtime.runtime.AppSession",
            # new_callable must return a function, not an object, or else
            # there will only be a single AppSession mock. Hence the lambda.
            new_callable=lambda: self._create_mock_app_session,
        )

    @classmethod
    def _create_mock_app_session(cls, *args, **kwargs):
        """Create a mock AppSession. Each mocked instance will have
        its own unique ID."""
        mock_id = mock.PropertyMock(return_value=f"mock_id:{cls._next_session_id}")
        cls._next_session_id += 1

        mock_session = mock.MagicMock(AppSession, autospec=True, *args, **kwargs)
        type(mock_session).id = mock_id
        return mock_session
