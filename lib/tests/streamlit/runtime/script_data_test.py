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

import unittest
from dataclasses import FrozenInstanceError

import pytest

from streamlit.runtime.script_data import ScriptData


class ScriptDataTest(unittest.TestCase):
    def test_script_folder_and_name_set(self):
        script_data = ScriptData(
            "/path/to/some/script.py",
            "streamlit run /path/to/some/script.py",
        )

        assert script_data.main_script_path == "/path/to/some/script.py"
        assert script_data.command_line == "streamlit run /path/to/some/script.py"
        assert script_data.script_folder == "/path/to/some"
        assert script_data.name == "script"

    def test_is_frozen(self):
        script_data = ScriptData(
            "/path/to/some/script.py",
            "streamlit run /path/to/some/script.py",
        )

        with pytest.raises(FrozenInstanceError):
            script_data.name = "bob"
