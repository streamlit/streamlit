# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import unittest
from unittest.mock import patch

from parameterized import parameterized

from streamlit import env_util
from streamlit.cli_util import open_browser
from streamlit.testing.v1.util import patch_config_options


class CliUtilTest(unittest.TestCase):
    @parameterized.expand(
        [("Linux", False, True), ("Windows", True, False), ("Darwin", False, True)]
    )
    def test_open_browser(self, os_type, webbrowser_expect, popen_expect):
        """Test web browser opening scenarios."""
        with patch.object(env_util, "IS_WINDOWS", os_type == "Windows"), \
             patch.object(env_util, "IS_DARWIN", os_type == "Darwin"), \
             patch.object(env_util, "IS_LINUX_OR_BSD", os_type == "Linux"):
            with patch("streamlit.env_util.is_executable_in_path", return_value=True):
                with patch("webbrowser.open") as webbrowser_open:
                    with patch("subprocess.Popen") as subprocess_popen:
                        open_browser("http://some-url")
                        assert webbrowser_expect == webbrowser_open.called
                        assert popen_expect == subprocess_popen.called

    def test_open_browser_linux_no_xdg(self):
        """Test opening the browser on Linux with no xdg installed"""
        with patch.object(env_util, "IS_LINUX_OR_BSD", True), \
             patch.object(env_util, "IS_WINDOWS", False), \
             patch.object(env_util, "IS_DARWIN", False):
            with patch("streamlit.env_util.is_executable_in_path", return_value=False):
                with patch("webbrowser.open") as webbrowser_open:
                    with patch("subprocess.Popen") as subprocess_popen:
                        open_browser("http://some-url")
                        assert webbrowser_open.called
                        assert not subprocess_popen.called

    def test_open_browser_with_browser_command(self):
        """When browser.command is set, open_browser launches subprocess directly."""
        with patch_config_options({"browser.command": "/usr/bin/firefox"}):
            with patch("subprocess.Popen") as subprocess_popen:
                open_browser("http://some-url")

                subprocess_popen.assert_called_once()
                args = subprocess_popen.call_args[0][0]
                assert args == ["/usr/bin/firefox", "http://some-url"]

    def test_open_browser_command_not_set_uses_default(self):
        """When browser.command is empty, the OS default mechanism is used."""
        with patch.object(env_util, "IS_LINUX_OR_BSD", True), \
             patch.object(env_util, "IS_WINDOWS", False), \
             patch.object(env_util, "IS_DARWIN", False):
            with patch_config_options({"browser.command": ""}):
                with patch("streamlit.env_util.is_executable_in_path", return_value=True):
                    with patch("subprocess.Popen") as subprocess_popen:
                        open_browser("http://some-url")

                        subprocess_popen.assert_called_once()
                        args = subprocess_popen.call_args[0][0]
                        assert args[0] == "xdg-open"
