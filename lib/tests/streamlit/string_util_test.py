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
            ("️🚨", True),
            ("️⛔️", True),
            ("️👍🏽", True),
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

    def test_simplify_number(self):
        """Test streamlit.string_util.simplify_number."""

        self.assertEqual(string_util.simplify_number(100), "100")

        self.assertEqual(string_util.simplify_number(10000), "10k")

        self.assertEqual(string_util.simplify_number(1000000), "1m")

        self.assertEqual(string_util.simplify_number(1000000000), "1b")

        self.assertEqual(string_util.simplify_number(1000000000000), "1t")

    @parameterized.expand(
        [
            # Correctly identified as containing HTML tags.
            ("<br/>", True),
            ("<p>foo</p>", True),
            ("bar <div>baz</div>", True),
            # Correctly identified as not containing HTML tags.
            ("Hello, World", False),  # No HTML tags
            ("<a>", False),  # No closing tag
            ("<<a>>", False),  # Malformatted tag
            ("a < 3 && b > 3", False),  # Easily mistaken for a tag by more naive regex
        ]
    )
    def test_probably_contains_html_tags(self, text, expected):
        self.assertEqual(string_util.probably_contains_html_tags(text), expected)
