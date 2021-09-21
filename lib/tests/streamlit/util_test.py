# Copyright 2018-2021 Streamlit Inc.
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

import random
import unittest
from unittest.mock import patch

from parameterized import parameterized

from streamlit import util


class UtilTest(unittest.TestCase):
    """Test Streamlit utility functions."""

    def test_memoization(self):
        """Test that util.memoize works."""
        non_memoized_func = lambda: random.randint(0, 1000000)
        yes_memoized_func = util.memoize(non_memoized_func)
        self.assertNotEqual(non_memoized_func(), non_memoized_func())
        self.assertEqual(yes_memoized_func(), yes_memoized_func())

    @parameterized.expand(
        [("Linux", False, True), ("Windows", True, False), ("Darwin", False, True)]
    )
    def test_open_browser(self, os_type, webbrowser_expect, popen_expect):
        """Test web browser opening scenarios."""
        from streamlit import env_util

        env_util.IS_WINDOWS = os_type == "Windows"
        env_util.IS_DARWIN = os_type == "Darwin"
        env_util.IS_LINUX_OR_BSD = os_type == "Linux"

        with patch("streamlit.env_util.is_executable_in_path", return_value=True):
            with patch("webbrowser.open") as webbrowser_open:
                with patch("subprocess.Popen") as subprocess_popen:
                    util.open_browser("http://some-url")
                    self.assertEqual(webbrowser_expect, webbrowser_open.called)
                    self.assertEqual(popen_expect, subprocess_popen.called)

    def test_open_browser_linux_no_xdg(self):
        """Test opening the browser on Linux with no xdg installed"""
        from streamlit import env_util

        env_util.IS_LINUX_OR_BSD = True

        with patch("streamlit.env_util.is_executable_in_path", return_value=False):
            with patch("webbrowser.open") as webbrowser_open:
                with patch("subprocess.Popen") as subprocess_popen:
                    util.open_browser("http://some-url")
                    self.assertEqual(True, webbrowser_open.called)
                    self.assertEqual(False, subprocess_popen.called)

    def test_functools_wraps(self):
        """Test wrap for functools.wraps"""

        import streamlit as st

        @st.cache
        def f():
            return True

        self.assertEqual(True, hasattr(f, "__wrapped__"))

    @parameterized.expand(
        [
            ({}, {}),
            (
                {
                    "HELLO": 4,
                    "Hello": "world",
                    "hElLo": 5.5,
                    "": "",
                },
                {"hello": 4, "hello": "world", "hello": 5.5, "": ""},
            ),
        ]
    )
    def test_lower_clean_dict_keys(self, input_dict, answer_dict):
        return_dict = util.lower_clean_dict_keys(input_dict)
        self.assertEqual(return_dict, answer_dict)
