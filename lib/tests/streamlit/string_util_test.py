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

import unittest

from parameterized import parameterized

from streamlit import string_util
from streamlit.errors import StreamlitAPIException


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

    @parameterized.expand(
        [
            ("A", False),
            ("hello", False),
            ("1_foo", False),
            ("1.foo", False),
            ("1-foo", False),
            ("foo bar", False),
            ("foo.bar", False),
            ("foo&bar", False),
            ("", False),
            ("a 😃bc", True),
            ("X😃", True),
            ("%", True),
            ("😃", True),
            ("😃 page name", True),
            ("👨‍👨‍👧‍👦_page name", True),
            ("何_is_this", True),
        ]
    )
    def test_contains_special_chars(self, text: str, expected: bool):
        self.assertEqual(string_util._contains_special_chars(text), expected)

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

    @parameterized.expand(
        [
            ("", "`", 0),
            ("`", "`", 1),
            ("a", "`", 0),
            ("``", "`", 2),
            ("aba", "a", 1),
            ("a``a", "`", 2),
            ("```abc```", "`", 3),
            ("a`b``c```d", "`", 3),
            ("``````", "`", 6),
            (
                "a`b`c`d`e",
                "`",
                1,
            ),
            ("a``b```c````d", "`", 4),
            ("no backticks here", "`", 0),
        ]
    )
    def test_max_char_sequence(self, text, char, expected):
        self.assertEqual(string_util.max_char_sequence(text, char), expected)

    @parameterized.expand(
        [
            ":material/cabin:",
            ":material/add_circle:",
            ":material/add_a_photo:",
        ]
    )
    def test_validate_material_icons_success(self, icon_string: str):
        """Test that validate_material_icons not raises exception on correct icons."""
        string_util.validate_material_icon(icon_string)

    @parameterized.expand(
        [
            ":material/cabBbin:",
            ":material-outlined/add_circle:",
            ":material:add_a_photo:",
        ]
    )
    def test_validate_material_icons_raises_exception(self, icon_name):
        """Test that validate_material_icons raises exception on incorrect icons."""
        with self.assertRaises(StreamlitAPIException) as e:
            string_util.validate_material_icon(icon_name)

        self.assertIn("not a valid Material icon.", str(e.exception))
