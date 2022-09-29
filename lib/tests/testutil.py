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

"""Utility functions to use in our tests."""
import threading
import unittest
from contextlib import contextmanager
from typing import Any, Dict, List
from unittest.mock import patch, MagicMock

import streamlit
from streamlit import config
from streamlit.proto.Delta_pb2 import Delta
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime import media_file_manager, Runtime
from streamlit.runtime.app_session import AppSession
from streamlit.runtime.forward_msg_queue import ForwardMsgQueue
from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.scriptrunner import (
    add_script_run_ctx,
    get_script_run_ctx,
    ScriptRunContext,
)
from streamlit.runtime.state import SafeSessionState, SessionState
from streamlit.runtime.uploaded_file_manager import UploadedFileManager
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.web.server.server import MEDIA_ENDPOINT


@contextmanager
def patch_config_options(config_overrides: Dict[str, Any]):
    """A context manager that overrides config options. It can
    also be used as a function decorator.

    Examples:
    >>> with patch_config_options({"server.headless": True}):
    ...     assert(config.get_option("server.headless") is True)
    ...     # Other test code that relies on these options

    >>> @patch_config_options({"server.headless": True})
    ... def test_my_thing():
    ...   assert(config.get_option("server.headless") is True)
    """
    mock_get_option = build_mock_config_get_option(config_overrides)
    with patch.object(config, "get_option", new=mock_get_option):
        yield


def build_mock_config_get_option(overrides_dict):
    orig_get_option = config.get_option

    def mock_config_get_option(name):
        if name in overrides_dict:
            return overrides_dict[name]
        return orig_get_option(name)

    return mock_config_get_option


def build_mock_config_is_manually_set(overrides_dict):
    orig_is_manually_set = config.is_manually_set

    def mock_config_is_manually_set(name):
        if name in overrides_dict:
            return overrides_dict[name]
        return orig_is_manually_set(name)

    return mock_config_is_manually_set


class FakeAppSession(AppSession):
    def __init__(self):
        self._session_state = SessionState()


class DeltaGeneratorTestCase(unittest.TestCase):
    def setUp(self, override_root=True):
        self.forward_msg_queue = ForwardMsgQueue()
        self.override_root = override_root
        self.orig_report_ctx = None
        self.new_script_run_ctx = ScriptRunContext(
            session_id="test session id",
            _enqueue=self.forward_msg_queue.enqueue,
            query_string="",
            session_state=SafeSessionState(SessionState()),
            uploaded_file_mgr=UploadedFileManager(),
            page_script_hash="",
            user_info={"email": "test@test.com"},
        )

        if self.override_root:
            self.orig_report_ctx = get_script_run_ctx()
            add_script_run_ctx(threading.current_thread(), self.new_script_run_ctx)

        self.app_session = FakeAppSession()

        # Create a MemoryMediaFileStorage instance, and the MediaFileManager
        # singleton.
        self.media_file_storage = MemoryMediaFileStorage(MEDIA_ENDPOINT)

        mock_runtime = MagicMock(spec=Runtime)
        mock_runtime.media_file_mgr = MediaFileManager(self.media_file_storage)
        Runtime._instance = mock_runtime

        # Accessing the MediaFileManager requires that _is_running_with_streamlit
        # is True.
        streamlit._is_running_with_streamlit = True

    def tearDown(self):
        self.clear_queue()
        if self.override_root:
            add_script_run_ctx(threading.current_thread(), self.orig_report_ctx)
        Runtime._instance = None
        streamlit._is_running_with_streamlit = False

    def get_message_from_queue(self, index=-1) -> ForwardMsg:
        """Get a ForwardMsg proto from the queue, by index."""
        return self.forward_msg_queue._queue[index]

    def get_delta_from_queue(self, index=-1) -> Delta:
        """Get a Delta proto from the queue, by index."""
        deltas = self.get_all_deltas_from_queue()
        return deltas[index]

    def get_all_deltas_from_queue(self) -> List[Delta]:
        """Return all the delta messages in our ForwardMsgQueue"""
        return [
            msg.delta for msg in self.forward_msg_queue._queue if msg.HasField("delta")
        ]

    def clear_queue(self) -> None:
        self.forward_msg_queue.clear()


def normalize_md(txt: str) -> str:
    """Replace newlines *inside paragraphs* with spaces.

    Consecutive lines of text are considered part of the same paragraph
    in Markdown. So this function joins those into a single line to make the
    test robust to changes in text wrapping.

    NOTE: This function doesn't attempt to be 100% grammatically correct
    Markdown! It's just supposed to be "correct enough" for tests to pass. For
    example, when we guard "\n\n" from being converted, we really should be
    guarding for RegEx("\n\n+") instead. But that doesn't matter for our tests.
    """
    # Two newlines in a row should NOT be replaced with a space.
    txt = txt.replace("\n\n", "OMG_NEWLINE")

    # Lists should NOT be replaced with a space.
    txt = txt.replace("\n*", "OMG_STAR")
    txt = txt.replace("\n-", "OMG_HYPHEN")

    # Links broken over two lines should not get an extra space.
    txt = txt.replace("]\n(", "OMG_LINK")

    # Convert all remaining newlines into spaces.
    txt = txt.replace("\n", " ")

    # Restore everything else.
    txt = txt.replace("OMG_NEWLINE", "\n\n")
    txt = txt.replace("OMG_STAR", "\n*")
    txt = txt.replace("OMG_HYPHEN", "\n-")
    txt = txt.replace("OMG_LINK", "](")

    return txt.strip()
