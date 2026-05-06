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

from __future__ import annotations

import decimal
import unittest
from fractions import Fraction

import numpy as np
import pytest
from parameterized import parameterized

from streamlit import string_util
from streamlit.errors import StreamlitAPIException


class StringUtilTest(unittest.TestCase):
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
        assert string_util.is_emoji(text) == expected

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
        assert string_util.extract_leading_emoji(text) == expected

    @parameterized.expand(
        [
            # Empty string
            ("", ("", "")),
            # No icon
            ("some text", ("", "some text")),
            ("A", ("", "A")),
            # Emoji extraction
            ("😃", ("😃", "")),
            ("😃 message", ("😃", "message")),
            ("🚨 Error occurred", ("🚨", "Error occurred")),
            ("⚠️ Warning message", ("⚠️", "Warning message")),
            # Multi-character emoji
            ("👨‍👨‍👧‍👦 Family event", ("👨‍👨‍👧‍👦", "Family event")),
            # Material icon extraction
            (":material/warning: Caution", (":material/warning:", "Caution")),
            (":material/thumb_up: Great job", (":material/thumb_up:", "Great job")),
            (":material/error:", (":material/error:", "")),
            (":material/info: Some info", (":material/info:", "Some info")),
            # Invalid material icon falls back to emoji check (should return empty)
            (
                ":material/invalid_icon_xyz: text",
                ("", ":material/invalid_icon_xyz: text"),
            ),
            # Text starting with colon but not material icon
            (":not_material: text", ("", ":not_material: text")),
            # Multiline body text - emoji extraction should preserve newlines
            ("🚨 Error\nMore details", ("🚨", "Error\nMore details")),
            # Multiline body text - material icon extraction should preserve newlines
            (
                ":material/warning: Caution\nMore info",
                (":material/warning:", "Caution\nMore info"),
            ),
            # Emoji in middle doesn't get extracted
            ("text 😃 more", ("", "text 😃 more")),
        ]
    )
    def test_extract_leading_icon(self, text, expected):
        """Test streamlit.string_util.extract_leading_icon."""
        assert string_util.extract_leading_icon(text) == expected

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
        assert string_util._contains_special_chars(text) == expected

    def test_simplify_number(self):
        """Test streamlit.string_util.simplify_number."""

        assert string_util.simplify_number(100) == "100"

        assert string_util.simplify_number(10000) == "10k"

        assert string_util.simplify_number(1000000) == "1m"

        assert string_util.simplify_number(1000000000) == "1b"

        assert string_util.simplify_number(1000000000000) == "1t"

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
        assert string_util.max_char_sequence(text, char) == expected

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
        with pytest.raises(StreamlitAPIException) as e:
            string_util.validate_material_icon(icon_name)

        assert "not a valid Material icon." in str(e.value)

    @parameterized.expand(
        [
            (1, "1"),
            (1.0, "1.0"),
            (decimal.Decimal("1.0"), "1.0"),
            (Fraction(1, 1), "1"),
            (np.int16(1), "1"),
            (np.float16(1.0), "1.0"),
            (np.float32(1.0), "1.0"),
            (np.float64(1.0), "1.0"),
            (np.int32(1), "1"),
            (np.int64(1), "1"),
        ]
    )
    def test_from_number(self, value: object, expected: str):
        """Test that from_number returns correct string representations for numeric types."""
        assert string_util.from_number(value) == expected

    def test_from_number_invalid_object_exception(self):
        """Test that from_number raises TypeError for invalid objects."""
        with pytest.raises(TypeError):
            string_util.from_number(None)

    @parameterized.expand(
        [
            (None, ""),
            ("spinner", "spinner"),
            ("😃", "😃"),
            (":material/thumb_up:", ":material/thumb_up:"),
        ]
    )
    def test_validate_icon_or_emoji(self, icon, expected):
        """Test streamlit.string_util.validate_icon_or_emoji."""
        assert string_util.validate_icon_or_emoji(icon) == expected

    @parameterized.expand(
        [
            ("invalid"),
            (":material/invalid:"),
        ]
    )
    def test_validate_icon_or_emoji_raises(self, icon):
        """Test that validate_icon_or_emoji raises StreamlitAPIException on invalid inputs."""
        with pytest.raises(StreamlitAPIException):
            string_util.validate_icon_or_emoji(icon)

    def test_validate_emoji_none(self):
        """Test that validate_emoji returns empty string for None input."""
        assert string_util.validate_emoji(None) == ""

    def test_validate_material_icon_none(self):
        """Test that validate_material_icon returns empty string for None input."""
        assert string_util.validate_material_icon(None) == ""

    @parameterized.expand(
        [
            (b"hello world", False),  # Text only
            (b"\x00\x01\x02", True),  # Binary control characters
            (b"text with \x00 null", True),  # Text with null byte
            (b"", False),  # Empty bytes
        ]
    )
    def test_is_binary_string(self, inp: bytes, expected: bool):
        """Test that is_binary_string correctly identifies binary vs text data."""
        assert string_util.is_binary_string(inp) == expected

    def test_from_number_with_invalid_item_method(self):
        """Test from_number with object that has item() but returns non-numeric."""

        class FakeNumpyValue:
            def item(self) -> str:
                return "not a number"

        with pytest.raises(TypeError):
            string_util.from_number(FakeNumpyValue())  # type: ignore[arg-type]

    def test_from_number_with_failing_item_method(self):
        """Test from_number with object whose item() raises an exception."""

        class FakeNumpyValue:
            def item(self) -> int:
                raise ValueError("item() failed")

        with pytest.raises(TypeError):
            string_util.from_number(FakeNumpyValue())  # type: ignore[arg-type]
