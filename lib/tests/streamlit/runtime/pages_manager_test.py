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

"""Unit tests for PagesManager"""

from __future__ import annotations

import threading
import unittest

from streamlit.runtime.pages_manager import PagesManager


class PagesManagerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.pages_manager = PagesManager("main_script_path")

    def test_set_pages_and_resolve_valid_hash(self) -> None:
        """Ensure the page script is provided with valid page hash specified."""
        self.pages_manager.set_script_intent("page_hash", "")
        page_script = self.pages_manager.set_pages_and_resolve(
            {"page_hash": {"page_script_hash": "page_hash"}},
            fallback_page_hash=self.pages_manager.main_script_hash,
        )
        assert page_script is not None
        assert page_script["page_script_hash"] == "page_hash"

    def test_set_pages_and_resolve_invalid_hash(self) -> None:
        """Ensure None is returned with invalid page hash specified."""
        self.pages_manager.set_script_intent("bad_hash", "")
        page_script = self.pages_manager.set_pages_and_resolve(
            {"page_hash": {"page_script_hash": "page_hash"}},
            fallback_page_hash=self.pages_manager.main_script_hash,
        )
        assert page_script is None

    def test_set_pages_and_resolve_valid_name(self) -> None:
        """Ensure the page script is provided with valid page name specified."""
        self.pages_manager.set_script_intent("", "page_name")
        page_script = self.pages_manager.set_pages_and_resolve(
            {
                "page_hash": {
                    "page_script_hash": "page_hash",
                    "url_pathname": "page_name",
                }
            },
            fallback_page_hash=self.pages_manager.main_script_hash,
        )
        assert page_script is not None
        assert page_script["page_script_hash"] == "page_hash"

    def test_set_pages_and_resolve_invalid_name(self) -> None:
        """Ensure the page script is not provided with invalid page name specified."""
        self.pages_manager.set_script_intent("", "foo")
        page_script = self.pages_manager.set_pages_and_resolve(
            {
                "page_hash": {
                    "page_script_hash": "page_hash",
                    "url_pathname": "page_name",
                }
            },
            fallback_page_hash=self.pages_manager.main_script_hash,
        )
        assert page_script is None

    def test_get_initial_active_script(self) -> None:
        """Test that the initial active script is correctly retrieved with the
        main script path provided."""
        page_info = self.pages_manager.get_initial_active_script("page_hash")

        assert page_info == {
            "script_path": "main_script_path",
            "page_script_hash": "page_hash",
        }

    def test_get_pages_returns_copy(self) -> None:
        """Ensure get_pages() returns a copy, not the internal dict."""
        self.pages_manager.set_pages_and_resolve(
            {"hash1": {"page_script_hash": "hash1", "script_path": "/path1"}},
        )
        pages = self.pages_manager.get_pages()
        pages["hash2"] = {"page_script_hash": "hash2", "script_path": "/path2"}
        assert "hash2" not in self.pages_manager.get_pages()

    def test_get_pages_snapshot_isolation(self) -> None:
        """Ensure get_pages() returns an isolated copy unaffected by later updates.

        This tests copy semantics: a snapshot taken before set_pages_and_resolve()
        should not reflect changes made after. For actual threading concurrency
        tests, see test_concurrent_get_pages_does_not_raise.
        """
        self.pages_manager.set_pages_and_resolve(
            {"hash1": {"page_script_hash": "hash1", "script_path": "/path1"}},
        )
        snapshot = self.pages_manager.get_pages()
        self.pages_manager.set_pages_and_resolve(
            {"hash2": {"page_script_hash": "hash2", "script_path": "/path2"}},
        )
        assert "hash1" in snapshot
        assert "hash2" not in snapshot

    def test_concurrent_get_pages_does_not_raise(self) -> None:
        """Ensure concurrent get_pages() calls do not raise during iteration."""
        pages = {f"hash{i}": {"page_script_hash": f"hash{i}"} for i in range(100)}
        self.pages_manager.set_pages_and_resolve(pages)
        errors: list[Exception] = []

        def reader() -> None:
            try:
                for _ in range(100):
                    for _page_hash, page_info in self.pages_manager.get_pages().items():
                        _ = page_info.get("page_script_hash")
            except Exception as e:
                errors.append(e)

        def writer() -> None:
            for i in range(100):
                new_pages = {f"hash{i}": {"page_script_hash": f"hash{i}"}}
                self.pages_manager.set_pages_and_resolve(new_pages)

        threads = [threading.Thread(target=reader) for _ in range(5)]
        threads.append(threading.Thread(target=writer))
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert len(errors) == 0, f"Errors during concurrent access: {errors}"

    def test_set_pages_and_resolve_with_fallback(self) -> None:
        """Ensure fallback_page_hash is used when no intent is set."""
        self.pages_manager.set_script_intent("", "")
        page_script = self.pages_manager.set_pages_and_resolve(
            {"fallback": {"page_script_hash": "fallback", "script_path": "/fallback"}},
            fallback_page_hash="fallback",
        )
        assert page_script is not None
        assert page_script["page_script_hash"] == "fallback"

    def test_set_pages_and_resolve_no_pages(self) -> None:
        """Ensure set_pages_and_resolve returns None when pages dict is set empty."""
        page_script = self.pages_manager.set_pages_and_resolve({})
        assert page_script is None
