# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""Base class for DeltaGenerator-related unit tests."""

from __future__ import annotations

import threading
import unittest
from typing import TYPE_CHECKING
from unittest.mock import MagicMock

from streamlit.runtime import Runtime
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)
from streamlit.runtime.forward_msg_queue import ForwardMsgQueue
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner import (
    ScriptRunContext,
    add_script_run_ctx,
    get_script_run_ctx,
)
from streamlit.runtime.scriptrunner_utils.script_requests import ScriptRequests
from streamlit.runtime.session_manager import SessionManager
from streamlit.runtime.state import SafeSessionState, SessionState
from streamlit.web.server.server import MEDIA_ENDPOINT, UPLOAD_FILE_ENDPOINT

if TYPE_CHECKING:
    from streamlit.proto.Delta_pb2 import Delta
    from streamlit.proto.ForwardMsg_pb2 import ForwardMsg


class DeltaGeneratorTestCase(unittest.TestCase):
    def setUp(self):
        self.forward_msg_queue = ForwardMsgQueue()

        # Save our thread's current ScriptRunContext
        self.orig_report_ctx = get_script_run_ctx()

        # Create a new ScriptRunContext to use for the test.
        self.script_run_ctx = ScriptRunContext(
            session_id="test session id",
            _enqueue=self.forward_msg_queue.enqueue,
            query_string="",
            session_state=SafeSessionState(SessionState(), lambda: None),
            uploaded_file_mgr=MemoryUploadedFileManager(UPLOAD_FILE_ENDPOINT),
            main_script_path="",
            user_info={"email": "test@example.com"},
            script_requests=ScriptRequests(),
            fragment_storage=MemoryFragmentStorage(),
            pages_manager=PagesManager(""),
        )
        add_script_run_ctx(threading.current_thread(), self.script_run_ctx)

        # Create a MemoryMediaFileStorage instance, and the MediaFileManager
        # singleton.
        self.media_file_storage = MemoryMediaFileStorage(MEDIA_ENDPOINT)

        mock_runtime = MagicMock(spec=Runtime)
        mock_runtime.cache_storage_manager = MemoryCacheStorageManager()
        mock_runtime.media_file_mgr = MediaFileManager(self.media_file_storage)
        mock_runtime.uploaded_file_mgr = self.script_run_ctx.uploaded_file_mgr
        mock_runtime._session_mgr = MagicMock(spec=SessionManager)
        Runtime._instance = mock_runtime

    def tearDown(self):
        self.clear_queue()
        add_script_run_ctx(threading.current_thread(), self.orig_report_ctx)
        Runtime._instance = None

    def get_message_from_queue(self, index=-1) -> ForwardMsg:
        """Get a ForwardMsg proto from the queue, by index."""
        return self.forward_msg_queue._queue[index]

    def get_delta_from_queue(self, index=-1) -> Delta:
        """Get a Delta proto from the queue, by index."""
        deltas = self.get_all_deltas_from_queue()
        return deltas[index]

    def get_all_deltas_from_queue(self) -> list[Delta]:
        """Return all the delta messages in our ForwardMsgQueue"""
        return [
            msg.delta for msg in self.forward_msg_queue._queue if msg.HasField("delta")
        ]

    def clear_queue(self) -> None:
        self.forward_msg_queue.clear()
