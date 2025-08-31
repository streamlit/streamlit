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

"""Unit tests for PagesManager"""

from __future__ import annotations

import unittest

from streamlit.runtime.pages_manager import PagesManager


class PagesManagerTest(unittest.TestCase):
    def setUp(self):
        self.pages_manager = PagesManager("main_script_path")

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
        page_info = self.pages_manager.get_initial_active_script("page_hash")

        assert page_info == {
            "script_path": "main_script_path",
            "page_script_hash": "page_hash",
        }
