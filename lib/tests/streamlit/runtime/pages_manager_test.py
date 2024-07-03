# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

"""Unit tests for PagesManager"""

import os
import unittest
from unittest.mock import MagicMock, patch

import streamlit.source_util as source_util
from streamlit.runtime.pages_manager import PagesManager, PagesStrategyV1
from streamlit.util import calc_md5


class PagesManagerTest(unittest.TestCase):
    def test_register_pages_changed_callback(self):
        """Test that the pages changed callback is correctly registered and unregistered"""
        pages_manager = PagesManager("main_script_path")
        with patch.object(source_util, "_on_pages_changed", MagicMock()):

            def callback():
                return None

            disconnect = pages_manager.register_pages_changed_callback(callback)

            source_util._on_pages_changed.connect.assert_called_once_with(
                callback, weak=False
            )

            disconnect()
            source_util._on_pages_changed.disconnect.assert_called_once_with(callback)

    @patch("streamlit.runtime.pages_manager.watch_dir")
    @patch.object(source_util, "invalidate_pages_cache", MagicMock())
    def test_install_pages_watcher(self, patched_watch_dir):
        """Test that the pages watcher is correctly installed and uninstalled"""
        # Ensure PagesStrategyV1.is_watching_pages_dir is False to start
        PagesStrategyV1.is_watching_pages_dir = False
        PagesManager(os.path.normpath("/foo/bar/streamlit_app.py"))

        patched_watch_dir.assert_called_once()
        args, _ = patched_watch_dir.call_args_list[0]
        on_pages_changed = args[1]

        patched_watch_dir.assert_called_once_with(
            os.path.normpath("/foo/bar/pages"),
            on_pages_changed,
            glob_pattern="*.py",
            allow_nonexistent=True,
        )

        patched_watch_dir.reset_mock()

        _ = PagesManager(os.path.normpath("/foo/bar/streamlit_app.py"))
        patched_watch_dir.assert_not_called()

        on_pages_changed("/foo/bar/pages")
        source_util.invalidate_pages_cache.assert_called_once()


class PagesManagerV2Test(unittest.TestCase):
    def setUp(self):
        self.pages_manager = PagesManager("main_script_path")

        # This signifies the change to V2
        self.pages_manager.set_pages({})

    def test_run_with_active_hash(self):
        """Ensure the active script is set correctly"""
        main_script_hash = self.pages_manager.main_script_hash
        assert self.pages_manager.get_active_script_hash() == main_script_hash

        with self.pages_manager.run_with_active_hash("new_hash"):
            assert self.pages_manager.get_active_script_hash() == "new_hash"

        assert self.pages_manager.get_active_script_hash() == main_script_hash

    def test_reset_active_script_hash(self):
        """Ensure the active script hash is reset correctly"""
        main_script_hash = self.pages_manager.main_script_hash
        assert self.pages_manager.get_active_script_hash() == main_script_hash

        self.pages_manager.set_active_script_hash("new_hash")
        self.pages_manager.reset_active_script_hash()

        assert self.pages_manager.get_active_script_hash() == main_script_hash

    def test_get_page_script_valid_hash(self):
        """Ensure the page script is provided with valid page hash specified"""

        self.pages_manager.set_script_intent("page_hash", "")
        self.pages_manager.set_pages({"page_hash": {"page_script_hash": "page_hash"}})

        page_script = self.pages_manager.get_page_script(
            self.pages_manager.main_script_hash
        )
        assert page_script["page_script_hash"] == "page_hash"

    def test_get_page_script_invalid_hash(self):
        """Ensure the page script is provided with invalid page hash specified"""

        self.pages_manager.set_script_intent("bad_hash", "")
        self.pages_manager.set_pages({"page_hash": {"page_script_hash": "page_hash"}})

        page_script = self.pages_manager.get_page_script(
            self.pages_manager.main_script_hash
        )
        assert page_script is None

    def test_get_page_script_valid_name(self):
        """Ensure the page script is provided with valid page name specified"""

        self.pages_manager.set_script_intent("", "page_name")
        self.pages_manager.set_pages(
            {
                "page_hash": {
                    "page_script_hash": "page_hash",
                    "url_pathname": "page_name",
                }
            }
        )

        page_script = self.pages_manager.get_page_script(
            self.pages_manager.main_script_hash
        )
        assert page_script["page_script_hash"] == "page_hash"

    def test_get_page_script_invalid_name(self):
        """Ensure the page script is not provided with invalid page name specified"""

        self.pages_manager.set_script_intent("", "foo")
        self.pages_manager.set_pages(
            {
                "page_hash": {
                    "page_script_hash": "page_hash",
                    "url_pathname": "page_name",
                }
            }
        )

        page_script = self.pages_manager.get_page_script(
            self.pages_manager.main_script_hash
        )
        assert page_script is None

    def test_get_initial_active_script(self):
        """Test that the initial active script is correctly retrieved with the
        main script path provided."""
        page_info = self.pages_manager.get_initial_active_script("page_hash", "")

        self.assertDictEqual(
            page_info,
            {"script_path": "main_script_path", "page_script_hash": "page_hash"},
        )


# NOTE: We write this test function using pytest conventions (as opposed to
# using unittest.TestCase like in the rest of the codebase) because the tmpdir
# pytest fixture is so useful for writing this test it's worth having the
# slight inconsistency.
@patch("streamlit.source_util._cached_pages", new=None)
def test_get_initial_active_script_v1(tmpdir):
    # Write an empty string to create a file.
    tmpdir.join("streamlit_app.py").write("")

    pages_dir = tmpdir.mkdir("pages")
    pages = [
        "03_other_page.py",
        "04 last numbered page.py",
        "01-page.py",
    ]
    for p in pages:
        pages_dir.join(p).write("")

    main_script_path = str(tmpdir / "streamlit_app.py")
    pages_manager = PagesManager(main_script_path)

    example_page_script_hash = calc_md5(str(pages_dir / "01-page.py"))

    # positive case - get by hash
    page = pages_manager.get_initial_active_script(example_page_script_hash, None)
    assert page["page_script_hash"] == example_page_script_hash

    # bad hash should not return a page
    page = pages_manager.get_initial_active_script("random_hash", None)
    assert page is None

    # Even if the page name is specified, we detect via the hash only
    page = pages_manager.get_initial_active_script("random_hash", "page")
    assert page is None

    # Find by page name works
    page = pages_manager.get_initial_active_script("", "page")
    assert page["page_script_hash"] == example_page_script_hash

    # Try different page name
    alternate_page_script_hash = calc_md5(str(pages_dir / "03_other_page.py"))
    page = pages_manager.get_initial_active_script("", "other_page")
    assert page["page_script_hash"] == alternate_page_script_hash

    # Even if the valid page name is specified, we detect via the hash only
    page = pages_manager.get_initial_active_script(alternate_page_script_hash, "page")
    assert page["page_script_hash"] == alternate_page_script_hash
