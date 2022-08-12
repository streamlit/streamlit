import asyncio
import threading
from queue import Queue

from streamlit.runtime.runtime import Runtime, RuntimeConfig
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
                config = RuntimeConfig("mock/script/path.py", "")
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
