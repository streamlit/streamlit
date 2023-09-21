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
from __future__ import annotations

import hashlib
import pathlib
import tempfile
import textwrap
from unittest.mock import MagicMock

from streamlit import source_util
from streamlit.proto.WidgetStates_pb2 import WidgetStates
from streamlit.runtime import Runtime
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)
from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.state.session_state import SessionState
from streamlit.testing.local_script_runner import LocalScriptRunner

TMP_DIR = tempfile.TemporaryDirectory()


class TestRunner:
    def __init__(self, script_path: str, default_timeout: float):
        self._script_path = script_path
        self.default_timeout = default_timeout
        self.session_state = SessionState()

    @classmethod
    def from_string(cls, script: str, default_timeout: float = 3) -> TestRunner:
        """Create a runner for a script with the contents from a string.

        Useful for testing short scripts that fit comfortably as an inline
        string in the test itself, without having to create a separate file
        for it.

        `default_timeout` is the default time in seconds before a script is
        timed out, if not overridden for an individual `.run()` call.
        """
        hasher = hashlib.md5(bytes(script, "utf-8"))
        script_name = hasher.hexdigest()

        path = pathlib.Path(TMP_DIR.name, script_name)
        aligned_script = textwrap.dedent(script)
        path.write_text(aligned_script)
        return TestRunner(str(path), default_timeout=default_timeout)

    @classmethod
    def from_file(cls, script_path: str, default_timeout: float = 3) -> TestRunner:
        """Create a runner for the script with the given name, for testing.

        `default_timeout` is the default time in seconds before a script is
        timed out, if not overridden for an individual `.run()` call.
        """
        return TestRunner(script_path, default_timeout=default_timeout)

    def run(
        self,
        widget_state: WidgetStates | None = None,
        timeout: float | None = None,
    ) -> TestRunner:
        """Run the script, and parse the output messages for querying
        and interaction.

        Timeout is in seconds, or None to use the default timeout of the runner.
        """
        if timeout is None:
            timeout = self.default_timeout

        local_runner = LocalScriptRunner(self._script_path, self.session_state)

        # setup
        mock_runtime = MagicMock(spec=Runtime)
        mock_runtime.media_file_mgr = MediaFileManager(
            MemoryMediaFileStorage("/mock/media")
        )
        mock_runtime.cache_storage_manager = MemoryCacheStorageManager()
        Runtime._instance = mock_runtime
        with source_util._pages_cache_lock:
            self.saved_cached_pages = source_util._cached_pages
            source_util._cached_pages = None

        self._tree = local_runner.run(widget_state, timeout)
        self._tree._runner = self

        # teardown
        with source_util._pages_cache_lock:
            source_util._cached_pages = self.saved_cached_pages
        Runtime._instance = None

        return self

    @property
    def radio(self):
        return self._tree.radio
