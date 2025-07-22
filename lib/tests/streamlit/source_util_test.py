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

from __future__ import annotations

import unittest
from pathlib import Path

import pytest
from parameterized import parameterized

from streamlit import source_util


class PageHelperFunctionTests(unittest.TestCase):
    @parameterized.expand(
        [
            # Test that the page number is treated as the first sort key.
            ("/foo/01_bar.py", (1.0, "bar")),
            ("/foo/02-bar.py", (2.0, "bar")),
            ("/foo/03 bar.py", (3.0, "bar")),
            ("/foo/04 bar baz.py", (4.0, "bar baz")),
            ("/foo/05 -_- bar.py", (5.0, "bar")),
            # Test that sorting is not case-sensitive.
            ("/foo/06_BAR.py", (6.0, "bar")),
            # Test that the first sort key is float("inf") if there is no page
            # number.
            ("/foo/bar.py", (float("inf"), "bar")),
            ("/foo/bar baz.py", (float("inf"), "bar baz")),
        ]
    )
    def test_page_sort_key(self, path_str, expected):
        assert source_util.page_sort_key(Path(path_str)) == expected

    def test_page_sort_key_error(self):
        with pytest.raises(
            ValueError,
            match="/foo/bar/baz.rs is not a Python file. This should never happen.",
        ):
            source_util.page_sort_key(Path("/foo/bar/baz.rs"))

    @parameterized.expand(
        [
            # Test that the page number is removed as expected.
            ("/foo/01_bar.py", ("", "bar")),
            ("/foo/02-bar.py", ("", "bar")),
            ("/foo/03 bar.py", ("", "bar")),
            ("/foo/04 bar baz.py", ("", "bar_baz")),
            ("/foo/05 -_- bar.py", ("", "bar")),
            ("/foo/06 -_- 🎉bar.py", ("🎉", "bar")),
            ("/foo/07 -_- 🎉-_bar.py", ("🎉", "bar")),
            ("/foo/08 -_- 🎉 _ bar.py", ("🎉", "bar")),
            # Test cases with no page number.
            ("/foo/bar.py", ("", "bar")),
            ("/foo/bar baz.py", ("", "bar_baz")),
            ("/foo/😐bar baz.py", ("😐", "bar_baz")),
            ("/foo/😐_bar baz.py", ("😐", "bar_baz")),
            # Test that separator characters in the page name are removed as
            # as expected.
            ("/foo/1 - first page.py", ("", "first_page")),
            ("/foo/123_hairy_koala.py", ("", "hairy_koala")),
            (
                "/foo/123 wow_this_has a _lot_ _of  _ ___ separators.py",
                ("", "wow_this_has_a_lot_of_separators"),
            ),
            (
                "/foo/1-dashes in page-name stay.py",
                ("", "dashes_in_page-name_stay"),
            ),
            ("/foo/2 - 🙃second page.py", ("🙃", "second_page")),
            # Test other weirdness that might happen with numbers.
            ("12 monkeys.py", ("", "monkeys")),
            ("12 😰monkeys.py", ("😰", "monkeys")),
            ("_12 monkeys.py", ("", "12_monkeys")),
            ("_12 😰monkeys.py", ("", "12_😰monkeys")),
            ("_😰12 monkeys.py", ("😰", "12_monkeys")),
            ("123.py", ("", "123")),
            ("😰123.py", ("😰", "123")),
            # Test the default case for non-Python files.
            ("not_a_python_script.rs", ("", "")),
        ]
    )
    def test_page_icon_and_name(self, path_str, expected):
        assert source_util.page_icon_and_name(Path(path_str)) == expected
