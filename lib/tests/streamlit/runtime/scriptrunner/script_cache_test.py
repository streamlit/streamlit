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
from streamlit.runtime.scriptrunner.script_cache import ScriptCache


def _get_script_path(name: str) -> str:
    return os.path.join(os.path.dirname(__file__), "test_data", name)


class ScriptCacheTest(unittest.TestCase):
    def test_load_valid_script(self):
        """`get_bytecode` works as expected."""
        cache = ScriptCache()
        result = cache.get_bytecode(_get_script_path("good_script.py"))
        self.assertIsNotNone(result)
        # Execing the code shouldn't raise an error
        exec(result)

    @mock.patch("streamlit.runtime.scriptrunner.script_cache.open_python_file")
    def test_returns_cached_data(self, mock_open_python_file: Mock):
        """`get_bytecode` caches its results."""
        mock_open_python_file.side_effect = source_util.open_python_file
        cache = ScriptCache()

        # The first time we get a script's bytecode, the script is loaded from disk.
        result = cache.get_bytecode(_get_script_path("good_script.py"))
        self.assertIsNotNone(result)
        mock_open_python_file.assert_called_once()

        # Subsequent calls don't reload the script from disk and return the same object.
        mock_open_python_file.reset_mock()
        self.assertIs(cache.get_bytecode(_get_script_path("good_script.py")), result)
        mock_open_python_file.assert_not_called()

    def test_clear(self):
        """`clear` removes cached entries."""
        cache = ScriptCache()
        cache.get_bytecode(_get_script_path("good_script.py"))
        self.assertEquals(1, len(cache._cache))

        cache.clear()
        self.assertEquals(0, len(cache._cache))

    def test_file_not_found_error(self):
        """An exception is thrown when a script file doesn't exist."""
        cache = ScriptCache()
        with self.assertRaises(FileNotFoundError):
            cache.get_bytecode(_get_script_path("not_a_valid_path.py"))

    def test_syntax_error(self):
        """An exception is thrown when a script has a compile error."""
        cache = ScriptCache()
        with self.assertRaises(SyntaxError):
            cache.get_bytecode(_get_script_path("compile_error.py.txt"))
