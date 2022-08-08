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
import os
import shutil
import tempfile
from typing import List
from unittest.mock import MagicMock, patch

import pytest

import streamlit
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.forward_msg_cache import populate_hash_if_needed
from streamlit.runtime.runtime import (
    RuntimeState,
    SessionClient,
    Runtime,
    RuntimeConfig, RuntimeStoppedError,
)
from streamlit.runtime.uploaded_file_manager import UploadedFileRec
from streamlit.watcher import event_based_path_watcher
from tests.streamlit.message_mocks import (
    create_dataframe_msg,
    create_script_finished_message,
)
from testutil import patch_config_options
from .runtime_test_case import RuntimeTestCase


class MockSessionClient(SessionClient):
    """A SessionClient that captures all its ForwardMsgs into a list."""

    def __init__(self):
        self.forward_msgs: List[ForwardMsg] = []

    def write_forward_msg(self, msg: ForwardMsg) -> None:
        self.forward_msgs.append(msg)


class RuntimeTest(RuntimeTestCase):
    async def test_start_stop(self):
        """starting and stopping the Runtime should work as expected."""
        self.assertEqual(RuntimeState.INITIAL, self.runtime.state)

        await self.start_runtime_loop()
        self.assertEqual(RuntimeState.NO_SESSIONS_CONNECTED, self.runtime.state)

        self.runtime.stop()
        await asyncio.sleep(0)  # Wait a tick for the stop to be acknowledged
        self.assertEqual(RuntimeState.STOPPING, self.runtime.state)

        await self.runtime.stopped
        self.assertEqual(RuntimeState.STOPPED, self.runtime.state)

    async def test_create_session(self):
        """We can create and remove a single session."""
        await self.start_runtime_loop()

        session_id = self.runtime.create_session(
            client=MockSessionClient(), user_info=MagicMock()
        )
        self.assertEqual(
            RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED, self.runtime.state
        )

        self.runtime.close_session(session_id)
        self.assertEqual(RuntimeState.NO_SESSIONS_CONNECTED, self.runtime.state)

    async def test_close_session_shuts_down_appsession(self):
        """Closing a session should shutdown its associated AppSession."""
        with self.patch_app_session():
            await self.start_runtime_loop()

            # Create a session and get its associated AppSession object.
            session_id = self.runtime.create_session(
                client=MockSessionClient(), user_info=MagicMock()
            )
            app_session = self.runtime._get_session_info(session_id).session

            # Close the session. AppSession.shutdown should be called.
            self.runtime.close_session(session_id)
            app_session.shutdown.assert_called_once()

    async def test_multiple_sessions(self):
        """Multiple sessions can be connected."""
        await self.start_runtime_loop()

        session_ids = []
        for _ in range(3):
            session_id = self.runtime.create_session(
                client=MockSessionClient(),
                user_info=MagicMock(),
            )

            self.assertEqual(
                RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED, self.runtime.state
            )
            session_ids.append(session_id)

        for i in range(len(session_ids)):
            self.runtime.close_session(session_ids[i])
            expected_state = (
                RuntimeState.NO_SESSIONS_CONNECTED
                if i == len(session_ids) - 1
                else RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED
            )
            self.assertEqual(expected_state, self.runtime.state)

        self.assertEqual(RuntimeState.NO_SESSIONS_CONNECTED, self.runtime.state)

    async def test_close_invalid_session(self):
        """Closing a session that doesn't exist is a no-op: no error raised."""
        await self.start_runtime_loop()

        # Close a session that never existed
        self.runtime.close_session("no_such_session")

        # Close a valid session twice
        session_id = self.runtime.create_session(
            client=MockSessionClient(), user_info=MagicMock()
        )
        self.runtime.close_session(session_id)
        self.runtime.close_session(session_id)

    async def test_is_active_session(self):
        """`is_active_session` should work as expected."""
        await self.start_runtime_loop()
        session_id = self.runtime.create_session(
            client=MockSessionClient(), user_info=MagicMock()
        )
        self.assertTrue(self.runtime.is_active_session(session_id))
        self.assertFalse(self.runtime.is_active_session("not_a_session_id"))

        self.runtime.close_session(session_id)
        self.assertFalse(self.runtime.is_active_session(session_id))

    async def test_handle_backmsg(self):
        """BackMsgs should be delivered to the appropriate AppSession."""
        with self.patch_app_session():
            await self.start_runtime_loop()
            session_id = self.runtime.create_session(
                client=MockSessionClient(), user_info=MagicMock()
            )

            back_msg = MagicMock()
            self.runtime.handle_backmsg(session_id, back_msg)

            app_session = self.runtime._get_session_info(session_id).session
            app_session.handle_backmsg.assert_called_once_with(back_msg)

    async def test_handle_backmsg_invalid_session(self):
        """A BackMsg for an invalid session should get dropped without an error."""
        await self.start_runtime_loop()
        self.runtime.handle_backmsg("not_a_session_id", MagicMock())

    async def test_create_session_after_stop(self):
        """After Runtime.stop is called, `create_session` is an error."""
        await self.start_runtime_loop()
        self.runtime.stop()
        await asyncio.sleep(0)

        with self.assertRaises(RuntimeStoppedError):
            self.runtime.create_session(MagicMock(), MagicMock())

    async def test_handle_backmsg_after_stop(self):
        """After Runtime.stop is called, `handle_backmsg` is an error."""
        await self.start_runtime_loop()
        self.runtime.stop()
        await asyncio.sleep(0)

        with self.assertRaises(RuntimeStoppedError):
            self.runtime.handle_backmsg("not_a_session_id", MagicMock())

    async def test_sets_is_running_with_streamlit_flag(self):
        """Runtime should set streamlit._is_running_with_streamlit when it
        starts.
        """
        # This will frequently be True from other tests
        streamlit._is_running_with_streamlit = False
        await self.start_runtime_loop()
        self.assertTrue(streamlit._is_running_with_streamlit)

    async def test_forwardmsg_hashing(self):
        """Test that outgoing ForwardMsgs contain hashes."""
        await self.start_runtime_loop()

        client = MockSessionClient()
        session_id = self.runtime.create_session(client=client, user_info=MagicMock())

        # Get the SessionInfo for this client
        session_info = self.runtime._get_session_info(session_id)

        # Create a message and ensure its hash is unset; we're testing
        # that _send_message adds the hash before it goes out.
        msg = create_dataframe_msg([1, 2, 3])
        msg.ClearField("hash")
        self.runtime._send_message(session_info, msg)

        received = client.forward_msgs.pop()
        self.assertEqual(populate_hash_if_needed(msg), received.hash)

    async def test_forwardmsg_cacheable_flag(self):
        """Test that the metadata.cacheable flag is set properly on outgoing
        ForwardMsgs."""
        await self.start_runtime_loop()

        client = MockSessionClient()
        session_id = self.runtime.create_session(client=client, user_info=MagicMock())

        # Get the SessionInfo for this client
        session_info = self.runtime._get_session_info(session_id)

        with patch_config_options({"global.minCachedMessageSize": 0}):
            cacheable_msg = create_dataframe_msg([1, 2, 3])
            self.runtime._send_message(session_info, cacheable_msg)

            received = client.forward_msgs.pop()
            self.assertTrue(cacheable_msg.metadata.cacheable)
            self.assertTrue(received.metadata.cacheable)

        with patch_config_options({"global.minCachedMessageSize": 1000}):
            cacheable_msg = create_dataframe_msg([4, 5, 6])
            self.runtime._send_message(session_info, cacheable_msg)

            received = client.forward_msgs.pop()
            self.assertFalse(cacheable_msg.metadata.cacheable)
            self.assertFalse(received.metadata.cacheable)

    async def test_duplicate_forwardmsg_caching(self):
        """Test that duplicate ForwardMsgs are sent only once."""
        with patch_config_options({"global.minCachedMessageSize": 0}):
            await self.start_runtime_loop()

            client = MockSessionClient()
            session_id = self.runtime.create_session(
                client=client, user_info=MagicMock()
            )

            # Get the SessionInfo for this client
            session_info = self.runtime._get_session_info(session_id)

            msg1 = create_dataframe_msg([1, 2, 3], 1)

            # Send the message, and read it back. It will not have been cached.
            self.runtime._send_message(session_info, msg1)
            uncached = client.forward_msgs.pop()
            self.assertEqual("delta", uncached.WhichOneof("type"))

            msg2 = create_dataframe_msg([1, 2, 3], 123)

            # Send an equivalent message. This time, it should be cached,
            # and a "hash_reference" message should be received instead.
            self.runtime._send_message(session_info, msg2)
            cached = client.forward_msgs.pop()
            self.assertEqual("ref_hash", cached.WhichOneof("type"))
            # We should have the *hash* of msg1 and msg2:
            self.assertEqual(msg1.hash, cached.ref_hash)
            self.assertEqual(msg2.hash, cached.ref_hash)
            # And the same *metadata* as msg2:
            self.assertEqual(msg2.metadata, cached.metadata)

    async def test_forwardmsg_cache_clearing(self):
        """Test that the ForwardMsgCache gets properly cleared when scripts
        finish running.
        """
        with patch_config_options(
            {"global.minCachedMessageSize": 0, "global.maxCachedMessageAge": 1}
        ):
            await self.start_runtime_loop()

            client = MockSessionClient()
            session_id = self.runtime.create_session(
                client=client, user_info=MagicMock()
            )

            # Get the SessionInfo for this client
            session_info = self.runtime._get_session_info(session_id)

            data_msg = create_dataframe_msg([1, 2, 3])

            def finish_script(success: bool) -> None:
                status = (
                    ForwardMsg.FINISHED_SUCCESSFULLY
                    if success
                    else ForwardMsg.FINISHED_WITH_COMPILE_ERROR
                )
                finish_msg = create_script_finished_message(status)
                self.runtime._send_message(session_info, finish_msg)

            def is_data_msg_cached() -> bool:
                return (
                    self.runtime._message_cache.get_message(data_msg.hash) is not None
                )

            def send_data_msg() -> None:
                self.runtime._send_message(session_info, data_msg)

            # Send a cacheable message. It should be cached.
            send_data_msg()
            self.assertTrue(is_data_msg_cached())

            # End the script with a compile error. Nothing should change;
            # compile errors don't increase the age of items in the cache.
            finish_script(False)
            self.assertTrue(is_data_msg_cached())

            # End the script successfully. Nothing should change, because
            # the age of the cached message is now 1.
            finish_script(True)
            self.assertTrue(is_data_msg_cached())

            # Send the message again. This should reset its age to 0 in the
            # cache, so it won't be evicted when the script next finishes.
            send_data_msg()
            self.assertTrue(is_data_msg_cached())

            # Finish the script. The cached message age is now 1.
            finish_script(True)
            self.assertTrue(is_data_msg_cached())

            # Finish again. The cached message age will be 2, and so it
            # should be evicted from the cache.
            finish_script(True)
            self.assertFalse(is_data_msg_cached())

    async def test_orphaned_upload_file_deletion(self):
        """An uploaded file with no associated AppSession should be
        deleted.
        """
        await self.start_runtime_loop()

        client = MockSessionClient()
        session_id = self.runtime.create_session(
            client=client, user_info=MagicMock()
        )

        file = UploadedFileRec(0, "file.txt", "type", b"123")

        # Upload a file for our connected session.
        added_file = self.runtime._uploaded_file_mgr.add_file(
            session_id=session_id,
            widget_id="widget_id",
            file=UploadedFileRec(0, "file.txt", "type", b"123")
        )

        # The file should exist.
        self.assertEqual(
            self.runtime._uploaded_file_mgr.get_all_files(
                session_id, "widget_id"
            ),
            [added_file],
        )

        # Disconnect the session. The file should be deleted.
        self.runtime.close_session(session_id)
        self.assertEqual(
            self.runtime._uploaded_file_mgr.get_all_files(
                session_id, "widget_id"
            ),
            [],
        )

        # Upload a file for a session that doesn't exist.
        self.runtime._uploaded_file_mgr.add_file(
            session_id="no_such_session",
            widget_id="widget_id",
            file=file
        )

        # The file should be immediately deleted.
        self.assertEqual(
            self.runtime._uploaded_file_mgr.get_all_files(
                "no_such_session", "widget_id"
            ),
            [],
        )


@patch("streamlit.source_util._cached_pages", new=None)
class ScriptCheckTest(RuntimeTestCase):
    """Tests for Runtime.does_script_run_without_error"""

    def setUp(self) -> None:
        self._home = tempfile.mkdtemp()
        self._old_home = os.environ["HOME"]
        os.environ["HOME"] = self._home

        self._fd, self._path = tempfile.mkstemp()

        super().setUp()

    async def asyncSetUp(self):
        config = RuntimeConfig(script_path=self._path, command_line="mock command line")
        self.runtime = Runtime(config)
        await self.start_runtime_loop()

    def tearDown(self) -> None:
        if event_based_path_watcher._MultiPathWatcher._singleton is not None:
            event_based_path_watcher._MultiPathWatcher.get_singleton().close()
            event_based_path_watcher._MultiPathWatcher._singleton = None

        os.environ["HOME"] = self._old_home
        os.remove(self._path)
        shutil.rmtree(self._home)

        super().tearDown()

    @pytest.mark.slow
    async def test_invalid_script(self):
        script = """
import streamlit as st
st.not_a_function('test')
"""

        await self._check_script_loading(script, False, "error")

    @pytest.mark.slow
    async def test_valid_script(self):
        script = """
import streamlit as st
st.write('test')
"""

        await self._check_script_loading(script, True, "ok")

    @pytest.mark.slow
    async def test_timeout_script(self):
        script = """
import time
time.sleep(5)
"""

        with patch("streamlit.runtime.runtime.SCRIPT_RUN_CHECK_TIMEOUT", new=0.1):
            await self._check_script_loading(script, False, "timeout")

    async def _check_script_loading(self, script: str, expected_loads: bool, expected_msg: str) -> None:
        with os.fdopen(self._fd, "w") as tmp:
            tmp.write(script)

        ok, msg = await self.runtime.does_script_run_without_error()
        event_based_path_watcher._MultiPathWatcher.get_singleton().close()
        event_based_path_watcher._MultiPathWatcher._singleton = None
        self.assertEqual(expected_loads, ok)
        self.assertEqual(expected_msg, msg)
