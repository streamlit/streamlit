# Copyright 2018-2022 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import asyncio
from unittest.mock import MagicMock

from streamlit.runtime.runtime import RuntimeState, SessionClient
from .runtime_test_case import RuntimeTestCase


class RuntimeTest(RuntimeTestCase):
    async def test_start_stop(self):
        """Test that we can start and stop the Runtime."""
        self.assertEqual(RuntimeState.INITIAL, self.runtime.state)

        await self.start_runtime_loop()
        self.assertEqual(RuntimeState.NO_SESSIONS_CONNECTED, self.runtime.state)

        self.runtime.stop()
        await asyncio.sleep(0)  # Wait a tick for the stop to be acknowledged
        self.assertEqual(RuntimeState.STOPPING, self.runtime.state)

        await self.runtime.stopped
        self.assertEqual(RuntimeState.STOPPED, self.runtime.state)

    async def test_create_session(self):
        """Test that we can create and remove a single session."""
        await self.start_runtime_loop()

        session_id = self.runtime.create_session(client=MagicMock(spec=SessionClient), user_info=MagicMock())
        self.assertEqual(RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED, self.runtime.state)

        self.runtime.close_session(session_id)
        self.assertEqual(RuntimeState.NO_SESSIONS_CONNECTED, self.runtime.state)

