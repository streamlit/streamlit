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
import threading
from queue import Queue
from unittest.mock import MagicMock

from streamlit.runtime import Runtime, RuntimeConfig
from tests.isolated_asyncio_test_case import IsolatedAsyncioTestCase


class RuntimeThreadingTest(IsolatedAsyncioTestCase):
    """Threading-related Runtime tests."""

    async def test_create_runtime_on_another_thread(self):
        """Test that Runtime can be constructed on a thread that it doesn't actually
        run on.

        (This test will fail if Runtime's various asyncio initialization bits are
        performed in its constructor instead of in "start".)
        """

        queue = Queue()

        def create_runtime_on_another_thread():
            try:
                # This function should be called in another thread, which
                # should not already have an asyncio loop.
                with self.assertRaises(BaseException):
                    asyncio.get_running_loop()

                # Create a Runtime instance and put it in the (thread-safe) queue,
                # so that the main thread can retrieve it safely. If Runtime
                # creation fails, we'll stick an Exception in the queue instead.
                config = RuntimeConfig(
                    "mock/script/path.py",
                    "",
                    media_file_storage=MagicMock(),
                    session_manager_class=MagicMock(),
                    session_storage=MagicMock(),
                )
                queue.put(Runtime(config))
            except BaseException as e:
                queue.put(e)

        thread = threading.Thread(target=create_runtime_on_another_thread)
        thread.start()
        thread.join(timeout=1)
        if thread.is_alive():
            raise RuntimeError("Thread.join timed out!")

        runtime = queue.get(block=True, timeout=1)
        if isinstance(runtime, BaseException):
            raise runtime

        # Ensure we can start and stop the Runtime
        await runtime.start()
        runtime.stop()
        await runtime.stopped
