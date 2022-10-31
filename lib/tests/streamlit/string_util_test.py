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

import unittest

from parameterized import parameterized

from streamlit import string_util


class StringUtilTest(unittest.TestCase):
    def test_decode_ascii(self):
        """Test streamlit.string_util.decode_ascii."""
        self.assertEqual("test string.", string_util.decode_ascii(b"test string."))

    @parameterized.expand(
        [
            ("", False),
            ("A", False),
            ("%", False),
            ("😃", True),
            ("👨‍👨‍👧‍👦", True),
            ("😃😃", False),
            ("😃X", False),
            ("X😃", False),
        ]
    )
    def test_is_emoji(self, text: str, expected: bool):
        """Test streamlit.string_util.is_emoji."""
        self.assertEqual(string_util.is_emoji(text), expected)

    @parameterized.expand(
        [
            ("", ("", "")),
            ("A", ("", "A")),
            ("%", ("", "%")),
            ("😃", ("😃", "")),
            ("😃 page name", ("😃", "page name")),
            ("😃-page name", ("😃", "page name")),
            ("😃_page name", ("😃", "page name")),
            ("😃 _- page name", ("😃", "page name")),
            # Test that multi-character emoji are fully extracted.
            ("👨‍👨‍👧‍👦_page name", ("👨‍👨‍👧‍👦", "page name")),
            ("😃😃", ("😃", "😃")),
            ("1️⃣X", ("1️⃣", "X")),
            ("X😃", ("", "X😃")),
            # Test that certain non-emoji unicode characters don't get
            # incorrectly detected as emoji.
            ("何_is_this", ("", "何_is_this")),
        ]
    )
    def test_extract_leading_emoji(self, text, expected):
        self.assertEqual(string_util.extract_leading_emoji(text), expected)

    def test_snake_case_to_camel_case(self):
        """Test streamlit.string_util.snake_case_to_camel_case."""
        self.assertEqual(
            "TestString.", string_util.snake_case_to_camel_case("test_string.")
        )

        self.assertEqual("Init", string_util.snake_case_to_camel_case("__init__"))

    def test_clean_filename(self):
        """Test streamlit.string_util.clean_filename."""
        self.assertEqual("test_result", string_util.clean_filename("test re*su/lt;"))

    def test_generate_download_filename_from_title(self):
        """Test streamlit.string_util.generate_download_filename_from_title."""

        self.assertTrue(
            string_util.generate_download_filename_from_title(
                "app · Streamlit"
            ).startswith("App")
        )

        self.assertTrue(
            string_util.generate_download_filename_from_title(
                "app · Streamlit"
            ).startswith("App")
        )

        self.assertTrue(
            string_util.generate_download_filename_from_title(
                "App title here"
            ).startswith("AppTitleHere")
        )

        self.assertTrue(
            string_util.generate_download_filename_from_title(
                "Аптека, улица, фонарь"
            ).startswith("АптекаУлицаФонарь")
        )

    def test_simplify_number(self):
        """Test streamlit.string_util.simplify_number."""

        self.assertEqual(string_util.simplify_number(100), "100")

        self.assertEqual(string_util.simplify_number(10000), "10k")

        self.assertEqual(string_util.simplify_number(1000000), "1m")

        self.assertEqual(string_util.simplify_number(1000000000), "1b")

        self.assertEqual(string_util.simplify_number(1000000000000), "1t")
