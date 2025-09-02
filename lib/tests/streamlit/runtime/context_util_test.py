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
from unittest.mock import MagicMock

from parameterized import parameterized

from streamlit.runtime.context_util import maybe_add_page_path, maybe_trim_page_path


class ContextUtilTest(unittest.TestCase):
    @parameterized.expand(
        [
            # Test case: URL with no page path
            ("https://example.com", {}, "https://example.com"),
            # Test case: URL with page path that matches a page
            (
                "https://example.com/page1",
                {"hash1": {"url_pathname": "page1"}},
                "https://example.com/",
            ),
            # Test case: URL with page path that doesn't match any page
            (
                "https://example.com/unknown",
                {"hash1": {"url_pathname": "page1"}},
                "https://example.com/unknown",
            ),
            # Test case: URL with trailing slash
            (
                "https://example.com/page1/",
                {"hash1": {"url_pathname": "page1"}},
                "https://example.com/",
            ),
            # Test case: URL with multiple segments where the last segment matches a page
            (
                "https://example.com/path/to/page1",
                {"hash1": {"url_pathname": "page1"}},
                "https://example.com/path/to/",
            ),
            # Test case: URL with empty page path in pages
            (
                "https://example.com",
                {"hash1": {"url_pathname": ""}},
                "https://example.com",
            ),
            # Test case: URL with multiple pages, one matching
            (
                "https://example.com/page2",
                {
                    "hash1": {"url_pathname": "page1"},
                    "hash2": {"url_pathname": "page2"},
                    "hash3": {"url_pathname": "page3"},
                },
                "https://example.com/",
            ),
        ]
    )
    def test_maybe_trim_page_path(self, url, pages, expected):
        """Test that `maybe_trim_page_path` correctly trims page paths from URLs"""
        # Create a mock PagesManager
        mock_page_manager = MagicMock()
        mock_page_manager.get_pages.return_value = pages

        # Call the function and check the result
        result = maybe_trim_page_path(url, mock_page_manager)
        assert result == expected

    @parameterized.expand(
        [
            # Test case: URL with no current page
            ("https://example.com", "", {}, "https://example.com"),
            # Test case: URL with the current page that has a url_pathname
            (
                "https://example.com",
                "hash1",
                {"hash1": {"url_pathname": "page1"}},
                "https://example.com/page1",
            ),
            # Test case: URL with current page that has no url_pathname
            (
                "https://example.com",
                "hash1",
                {"hash1": {"page_name": "Page 1"}},
                "https://example.com",
            ),
            # Test case: URL with current page that has empty url_pathname
            (
                "https://example.com",
                "hash1",
                {"hash1": {"url_pathname": ""}},
                "https://example.com",
            ),
            # Test case: URL with trailing slash
            (
                "https://example.com/",
                "hash1",
                {"hash1": {"url_pathname": "page1"}},
                "https://example.com/page1",
            ),
            # Test case: URL with the current page hash that doesn't exist in pages
            (
                "https://example.com",
                "unknown",
                {"hash1": {"url_pathname": "page1"}},
                "https://example.com",
            ),
        ]
    )
    def test_maybe_add_page_path(self, url, current_hash, pages, expected):
        """Test that `maybe_add_page_path` correctly adds page paths to URLs"""
        # Create a mock PagesManager
        mock_page_manager = MagicMock()
        mock_page_manager.current_page_script_hash = current_hash
        mock_page_manager.get_pages.return_value = pages

        # Call the function and check the result
        result = maybe_add_page_path(url, mock_page_manager)
        assert result == expected
