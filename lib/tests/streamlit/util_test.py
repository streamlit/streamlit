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

import random
import unittest
from typing import Dict, List, Set
from unittest.mock import patch

import numpy as np
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

    @parameterized.expand(
        [
            (np.array([1, 2, 3, 4, 5]), 5, 4),
            # This one will have 0.15000000000000002 because of floating point precision
            (np.arange(0.0, 0.25, 0.05), 0.15, 3),
            ([0, 1, 2, 3], 3, 3),
            ([0.1, 0.2, 0.3], 0.2, 1),
            ([0.1, 0.2, None], None, 2),
            ([0.1, 0.2, float("inf")], float("inf"), 2),
            (["He", "ello w", "orld"], "He", 0),
            (list(np.arange(0.0, 0.25, 0.05)), 0.15, 3),
        ]
    )
    def test_successful_index_(self, input, find_value, expected_index):
        actual_index = util.index_(input, find_value)
        self.assertEqual(actual_index, expected_index)

    @parameterized.expand(
        [
            (np.array([1, 2, 3, 4, 5]), 6),
            (np.arange(0.0, 0.25, 0.05), 0.1500002),
            ([0, 1, 2, 3], 3.00001),
            ([0.1, 0.2, 0.3], 0.3000004),
            ([0.1, 0.2, 0.3], None),
            (["He", "ello w", "orld"], "world"),
            (list(np.arange(0.0, 0.25, 0.05)), 0.150002),
        ]
    )
    def test_unsuccessful_index_(self, input, find_value):
        with self.assertRaises(ValueError):
            util.index_(input, find_value)

    @parameterized.expand(
        [
            ({"x": ["a"]}, ["x"], {}),
            ({"a": ["a1", "a2"], "b": ["b1", "b2"]}, ["a"], {"b": ["b1", "b2"]}),
            ({"c": ["c1", "c2"]}, "no_existing_key", {"c": ["c1", "c2"]}),
            (
                {
                    "embed": ["true"],
                    "embed_options": ["show_padding", "show_colored_line"],
                },
                ["embed", "embed_options"],
                {},
            ),
            (
                {"EMBED": ["TRUE"], "EMBED_OPTIONS": ["DISABLE_SCROLLING"]},
                ["embed", "embed_options"],
                {},
            ),
        ]
    )
    def test_drop_key_query_params(
        self,
        query_params: Dict[str, List[str]],
        keys_to_drop: List[str],
        result: Dict[str, List[str]],
    ):
        self.assertDictEqual(
            util.exclude_key_query_params(query_params, keys_to_drop), result
        )

    @parameterized.expand(
        [
            ({"x": ["a"]}, "x", {"a"}),
            ({"a": ["a1"], "b": ["b1", "b2"]}, "a", {"a1"}),
            ({"c": ["c1", "c2"]}, "no_existing_key", set()),
            (
                {
                    "embed": ["true"],
                    "embed_options": ["show_padding", "show_colored_line"],
                },
                "embed",
                {"true"},
            ),
            (
                {"EMBED": ["TRUE"], "EMBED_OPTIONS": ["DISABLE_SCROLLING"]},
                "embed_options",
                {"disable_scrolling"},
            ),
        ]
    )
    def test_extract_key_query_params(
        self, query_params: Dict[str, List[str]], param_key: str, result: Set[str]
    ):
        self.assertSetEqual(
            util.extract_key_query_params(query_params, param_key), result
        )
