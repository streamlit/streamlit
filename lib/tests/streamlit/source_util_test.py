# Copyright 2018-2022 Streamlit Inc.
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

import unittest
from pathlib import Path

import pytest
from parameterized import parameterized

import streamlit.source_util as source_util


class PageHelperFunctionTests(unittest.TestCase):
    @parameterized.expand(
        [
            # Test that the page number is treated as the first sort key.
            ("/foo/01_bar.py", (1.0, "bar")),
            ("/foo/02-bar.py", (2.0, "bar")),
            ("/foo/03 bar.py", (3.0, "bar")),
            ("/foo/04 bar baz.py", (4.0, "bar baz")),
            ("/foo/05 -_- bar.py", (5.0, "bar")),
            # Test that the first sort key is float("inf") if there is no page
            # number.
            ("/foo/bar.py", (float("inf"), "bar")),
            ("/foo/bar baz.py", (float("inf"), "bar baz")),
        ]
    )
    def test_page_sort_key(self, path_str, expected):
        assert source_util.page_sort_key(Path(path_str)) == expected

    def test_page_sort_key_error(self):
        with pytest.raises(AssertionError) as e:
            source_util.page_sort_key(Path("/foo/bar/baz.rs"))

        assert str(e.value) == "/foo/bar/baz.rs is not a Python file"

    @parameterized.expand(
        [
            # Test that the page number is removed as expected.
            ("/foo/01_bar.py", "bar"),
            ("/foo/02-bar.py", "bar"),
            ("/foo/03 bar.py", "bar"),
            ("/foo/04 bar baz.py", "bar_baz"),
            ("/foo/05 -_- bar.py", "bar"),
            # Test cases with no page number.
            ("/foo/bar.py", "bar"),
            ("/foo/bar baz.py", "bar_baz"),
            # Test that separator characters in the page name are removed as
            # as expected.
            ("/foo/1 - first page.py", "first_page"),
            ("/foo/123_hairy_koala.py", "hairy_koala"),
            (
                "/foo/123 wow_this_has a _lot_ _of  _ ___ separators.py",
                "wow_this_has_a_lot_of_separators",
            ),
            (
                "/foo/1-dashes in page-name stay.py",
                "dashes_in_page-name_stay",
            ),
            # Test other weirdness that might happen with numbers.
            ("12 monkeys.py", "monkeys"),
            ("_12 monkeys.py", "12_monkeys"),
            ("123.py", "123"),
            # Test the default case for non-Python files.
            ("not_a_python_script.rs", ""),
        ]
    )
    def test_page_name(self, path_str, expected):
        assert source_util.page_name(Path(path_str)) == expected


# NOTE: We write this test function using pytest conventions (as opposed to
# using unittest.TestCase like in the rest of the codebase) because the tmpdir
# pytest fixture is so useful for writing this test it's worth having the
# slight inconsistency.
def test_get_pages(tmpdir):
    # Write an empty string to create a file.
    tmpdir.join("streamlit_app.py").write("")

    pages_dir = tmpdir.mkdir("pages")
    pages = [
        # These pages are out of order so that we can check that they're sorted
        # in the assert below.
        "03_other_page.py",
        "last page.py",
        "01-page.py",
        # The next two pages have duplicate names so shouldn't appear.
        "page.py",
        "streamlit_app.py",
        # This shouldn't appear because it's not a Python file.
        "not_a_page.rs",
    ]
    for p in pages:
        pages_dir.join(p).write("")

    main_script_path = str(tmpdir / "streamlit_app.py")
    assert source_util.get_pages(main_script_path) == [
        {
            "page_name": "streamlit_app",
            "script_path": main_script_path,
        },
        {
            "page_name": "page",
            "script_path": str(pages_dir / "01-page.py"),
        },
        {
            "page_name": "other_page",
            "script_path": str(pages_dir / "03_other_page.py"),
        },
        {
            "page_name": "last_page",
            "script_path": str(pages_dir / "last page.py"),
        },
    ]
