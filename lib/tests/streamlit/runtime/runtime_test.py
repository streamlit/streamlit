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
from unittest.mock import MagicMock, patch

import pytest

from streamlit.runtime.runtime import (
    RuntimeState,
    SessionClient,
    Runtime,
    RuntimeConfig,
)
from streamlit.watcher import event_based_path_watcher
from .runtime_test_case import RuntimeTestCase


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
            client=MagicMock(spec=SessionClient), user_info=MagicMock()
        )
        self.assertEqual(
            RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED, self.runtime.state
        )

        self.runtime.close_session(session_id)
        self.assertEqual(RuntimeState.NO_SESSIONS_CONNECTED, self.runtime.state)

    async def test_multiple_sessions(self):
        """Multiple sessions can be connected."""
        await self.start_runtime_loop()

        session_ids = []
        for ii in range(3):
            session_id = self.runtime.create_session(
                client=MagicMock(spec=SessionClient),
                user_info=MagicMock(),
            )

            self.assertEqual(
                RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED, self.runtime.state
            )
            session_ids.append(session_id)

        for ii in range(len(session_ids)):
            self.runtime.close_session(session_ids[ii])
            expected_state = (
                RuntimeState.NO_SESSIONS_CONNECTED
                if ii == len(session_ids) - 1
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
            client=MagicMock(spec=SessionClient), user_info=MagicMock()
        )
        self.runtime.close_session(session_id)
        self.runtime.close_session(session_id)

    async def test_is_active_session(self):
        """`is_active_session` should work as expected."""
        await self.start_runtime_loop()
        session_id = self.runtime.create_session(
            client=MagicMock(spec=SessionClient), user_info=MagicMock()
        )
        self.assertTrue(self.runtime.is_active_session(session_id))
        self.assertFalse(self.runtime.is_active_session("not_a_session_id"))

    async def test_handle_backmsg(self):
        """BackMsgs should be delivered to the appropriate AppSession."""
        with self.patch_app_session():
            await self.start_runtime_loop()
            session_id = self.runtime.create_session(
                client=MagicMock(spec=SessionClient), user_info=MagicMock()
            )

            back_msg = MagicMock()
            self.runtime.handle_backmsg(session_id, back_msg)

            app_session = self.runtime._get_session_info(session_id).session
            app_session.handle_backmsg.assert_called_once_with(back_msg)

    async def test_handle_backmsg_invalid_session(self):
        """A BackMsg for an invalid session should get dropped without an error."""
        await self.start_runtime_loop()
        self.runtime.handle_backmsg("not_a_session_id", MagicMock())


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
        await self._check_script_loading(
            "import streamlit as st\n\nst.deprecatedWrite('test')",
            False,
            "error",
        )

    @pytest.mark.slow
    async def test_valid_script(self):
        await self._check_script_loading(
            "import streamlit as st\n\nst.write('test')", True, "ok"
        )

    @pytest.mark.slow
    async def test_timeout_script(self):
        with patch("streamlit.runtime.runtime.SCRIPT_RUN_CHECK_TIMEOUT", new=0.1):
            await self._check_script_loading(
                "import time\n\ntime.sleep(5)", False, "timeout"
            )

    async def _check_script_loading(self, script, expected_loads, expected_msg):
        with os.fdopen(self._fd, "w") as tmp:
            tmp.write(script)

        ok, msg = await self.runtime.does_script_run_without_error()
        event_based_path_watcher._MultiPathWatcher.get_singleton().close()
        event_based_path_watcher._MultiPathWatcher._singleton = None
        self.assertEqual(expected_loads, ok)
        self.assertEqual(expected_msg, msg)
