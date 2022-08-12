import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit.source_util as source_util
from streamlit.util import calc_md5


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
        with pytest.raises(AssertionError) as e:
            source_util.page_sort_key(Path("/foo/bar/baz.rs"))

        assert str(e.value) == "/foo/bar/baz.rs is not a Python file"

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

    @patch("streamlit.source_util._on_pages_changed", new=MagicMock())
    @patch("streamlit.source_util._cached_pages", new="Some pages")
    def test_invalidate_pages_cache(self):
        source_util.invalidate_pages_cache()

        assert source_util._cached_pages is None
        source_util._on_pages_changed.send.assert_called_once()

    @patch("streamlit.source_util._on_pages_changed", new=MagicMock())
    def test_register_pages_changed_callback(self):
        callback = lambda: None

        disconnect = source_util.register_pages_changed_callback(callback)

        source_util._on_pages_changed.connect.assert_called_once_with(
            callback, weak=False
        )

        disconnect()
        source_util._on_pages_changed.disconnect.assert_called_once_with(callback)


# NOTE: We write this test function using pytest conventions (as opposed to
# using unittest.TestCase like in the rest of the codebase) because the tmpdir
# pytest fixture is so useful for writing this test it's worth having the
# slight inconsistency.
@patch("streamlit.source_util._cached_pages", new=None)
def test_get_pages(tmpdir):
    # Write an empty string to create a file.
    tmpdir.join("streamlit_app.py").write("")

    pages_dir = tmpdir.mkdir("pages")
    pages = [
        # These pages are out of order so that we can check that they're sorted
        # in the assert below.
        "03_other_page.py",
        "04 last numbered page.py",
        "01-page.py",
        # This page should appear last since it doesn't have an integer prefix.
        "page.py",
        # This file shouldn't appear as a page because it's hidden.
        ".hidden_file.py",
        # This shouldn't appear because it's not a Python file.
        "not_a_page.rs",
    ]
    for p in pages:
        pages_dir.join(p).write("")

    main_script_path = str(tmpdir / "streamlit_app.py")

    received_pages = source_util.get_pages(main_script_path)
    assert received_pages == {
        calc_md5(main_script_path): {
            "page_script_hash": calc_md5(main_script_path),
            "page_name": "streamlit_app",
            "script_path": main_script_path,
            "icon": "",
        },
        calc_md5(str(pages_dir / "01-page.py")): {
            "page_script_hash": calc_md5(str(pages_dir / "01-page.py")),
            "page_name": "page",
            "script_path": str(pages_dir / "01-page.py"),
            "icon": "",
        },
        calc_md5(str(pages_dir / "03_other_page.py")): {
            "page_script_hash": calc_md5(str(pages_dir / "03_other_page.py")),
            "page_name": "other_page",
            "script_path": str(pages_dir / "03_other_page.py"),
            "icon": "",
        },
        calc_md5(str(pages_dir / "04 last numbered page.py")): {
            "page_script_hash": calc_md5(str(pages_dir / "04 last numbered page.py")),
            "page_name": "last_numbered_page",
            "script_path": str(pages_dir / "04 last numbered page.py"),
            "icon": "",
        },
        calc_md5(str(pages_dir / "page.py")): {
            "page_script_hash": calc_md5(str(pages_dir / "page.py")),
            "page_name": "page",
            "script_path": str(pages_dir / "page.py"),
            "icon": "",
        },
    }

    # Assert address-equality to verify the cache is used the second time
    # get_pages is called.
    assert source_util.get_pages(main_script_path) is received_pages
