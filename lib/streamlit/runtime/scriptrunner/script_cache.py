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

import os.path
import threading
from typing import Any

from streamlit import config
from streamlit.runtime.scriptrunner import magic
from streamlit.source_util import open_python_file


class ScriptCache:
    """Thread-safe cache of Python script bytecode."""

    def __init__(self):
        # Mapping of script_path: bytecode
        self._cache: dict[str, Any] = {}
        self._lock = threading.Lock()

    def clear(self) -> None:
        """Remove all entries from the cache.

        Notes
        -----
        Threading: SAFE. May be called on any thread.
        """
        with self._lock:
            self._cache.clear()

    def get_bytecode(self, script_path: str) -> Any:
        """Return the bytecode for the Python script at the given path.

        If the bytecode is not already in the cache, the script will be
        compiled first.

        Raises
        ------
        Any Exception raised while reading or compiling the script.

        Notes
        -----
        Threading: SAFE. May be called on any thread.
        """

        script_path = os.path.abspath(script_path)

        with self._lock:
            bytecode = self._cache.get(script_path, None)
            if bytecode is not None:
                # Fast path: the code is already cached.
                return bytecode

            # Populate the cache
            with open_python_file(script_path) as f:
                filebody = f.read()

            if config.get_option("runner.magicEnabled"):
                filebody = magic.add_magic(filebody, script_path)

            bytecode = compile(  # type: ignore
                filebody,
                # Pass in the file path so it can show up in exceptions.
                script_path,
                # We're compiling entire blocks of Python, so we need "exec"
                # mode (as opposed to "eval" or "single").
                mode="exec",
                # Don't inherit any flags or "future" statements.
                flags=0,
                dont_inherit=1,
                # Use the default optimization options.
                optimize=-1,
            )

            self._cache[script_path] = bytecode
            return bytecode
