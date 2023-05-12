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

import os.path
import unittest
from unittest import mock
from unittest.mock import Mock

from streamlit import source_util
from streamlit.runtime.scriptrunner.user_script_cache import UserScriptCache


def _get_script_path(name: str) -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "test_data", name))


class ScriptCacheTest(unittest.TestCase):
    def setUp(self) -> None:
        source_util.invalidate_pages_cache()
        self.main_script_path = _get_script_path("good_script.py")
        self.cache = UserScriptCache(self.main_script_path)

    def tearDown(self) -> None:
        source_util.invalidate_pages_cache()

    def test_load_valid_script(self):
        """`get_bytecode` works as expected."""
        result = self.cache.get_bytecode(_get_script_path("good_script.py"))
        self.assertIsNotNone(result)
        # Execing the code shouldn't raise an error
        exec(result)

    @mock.patch("streamlit.runtime.scriptrunner.user_script_cache.open_python_file")
    def test_returns_cached_data(self, mock_open_python_file: Mock):
        """`get_bytecode` caches its results."""
        mock_open_python_file.side_effect = source_util.open_python_file

        # The first time we get a script's bytecode, the script is loaded from disk.
        result = self.cache.get_bytecode(_get_script_path("good_script.py"))
        self.assertIsNotNone(result)
        mock_open_python_file.assert_called_once()

        # Subsequent calls don't reload the script from disk and return the same object.
        mock_open_python_file.reset_mock()
        self.assertIs(
            self.cache.get_bytecode(_get_script_path("good_script.py")), result
        )
        mock_open_python_file.assert_not_called()

    def test_clear(self):
        """`clear` removes cached entries."""
        # Add an item to the cache
        self.cache.get_bytecode(_get_script_path("good_script.py"))
        self.assertEquals(1, len(self.cache._cache))

        # Assert that `clear` removes it
        self.cache.clear()
        self.assertEquals(0, len(self.cache._cache))

    def test_file_not_found_error(self):
        """An exception is thrown when a script file doesn't exist."""
        with self.assertRaises(FileNotFoundError):
            self.cache.get_bytecode(_get_script_path("not_a_valid_path.py"))

    def test_syntax_error(self):
        """An exception is thrown when a script has a compile error."""
        with self.assertRaises(SyntaxError):
            self.cache.get_bytecode(_get_script_path("compile_error.py.txt"))

    def test_clear_when_local_source_changes(self):
        """When a local source file changes, the cache should be automatically cleared."""
        # Add an item to the cache
        self.cache.get_bytecode(self.main_script_path)
        self.assertEquals(1, len(self.cache._cache))

        # Pretend that a source file has changed
        self.cache._sources_watcher.on_file_changed(self.main_script_path)

        # The cache should be empty
        self.assertEquals(0, len(self.cache._cache))
