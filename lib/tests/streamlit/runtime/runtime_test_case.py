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
from asyncio import Future
from unittest import mock

from isolated_asyncio_test_case import IsolatedAsyncioTestCase
from streamlit.runtime.app_session import AppSession
from streamlit.runtime.runtime import Runtime, RuntimeConfig, RuntimeState


class RuntimeTestCase(IsolatedAsyncioTestCase):
    _next_session_id = 0

    async def asyncSetUp(self):
        config = RuntimeConfig("mock/script/path.py", "")
        self.runtime = Runtime(config)

    async def asyncTearDown(self):
        # Stop the runtime, and return when it's stopped
        if self.runtime.state != RuntimeState.INITIAL:
            self.runtime.stop()
            await self.runtime.stopped

    async def start_runtime_loop(self) -> None:
        """Start the Runtime loop. Call this before calling any other Runtime functions."""
        runtime_started = Future()
        on_started = lambda: runtime_started.set_result(None)

        # Per the create_task docs, we need to retain a reference to this
        # task. https://docs.python.org/3/library/asyncio-task.html#asyncio.create_task
        self._runtime_task = asyncio.create_task(self.runtime.run(on_started))

        await runtime_started

    def patch_app_session(self):
        """Mock the Runtime's AppSession import. We don't want
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
        mock_id = mock.PropertyMock(
            return_value=f"mock_id:{cls._next_session_id}"
        )
        cls._next_session_id += 1

        mock_session = mock.MagicMock(AppSession, autospec=True, *args, **kwargs)
        type(mock_session).id = mock_id
        return mock_session
