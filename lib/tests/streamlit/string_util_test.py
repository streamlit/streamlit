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
import sys
import unittest
from contextlib import contextmanager
from fractions import Fraction
from typing import TYPE_CHECKING

import numpy as np
import pytest
from parameterized import parameterized

from streamlit import string_util
from streamlit.errors import StreamlitAPIException, StreamlitInvalidParameterTypeError

if TYPE_CHECKING:
    from collections.abc import Iterator


@contextmanager
def _without_modules(*module_names: str) -> Iterator[None]:
    """Temporarily remove modules from ``sys.modules`` to detect unexpected imports."""
    saved = {name: sys.modules.pop(name, None) for name in module_names}
    try:
        yield
    finally:
        for name, mod in saved.items():
            if mod is not None:
                sys.modules[name] = mod
            else:
                sys.modules.pop(name, None)


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

    def test_to_str(self):
        """``to_str`` leaves strings unchanged and stringifies other values."""
        assert string_util.to_str("already") == "already"
        assert string_util.to_str(123) == "123"
        assert string_util.to_str(None) == "None"

    def test_to_help_str(self):
        """``to_help_str`` stringifies and dedents help text."""
        assert string_util.to_help_str("already") == "already"
        assert string_util.to_help_str(123) == "123"
        assert string_util.to_help_str("    indented") == "indented"

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

    def test_simplify_number(self):
        """Test streamlit.string_util.simplify_number."""

        assert string_util.simplify_number(100) == "100"

        assert string_util.simplify_number(10000) == "10k"

        assert string_util.simplify_number(1000000) == "1m"

        assert string_util.simplify_number(1000000000) == "1b"

        assert string_util.simplify_number(1000000000000) == "1t"

        # Numbers beyond a trillion stay in trillions instead of raising an
        # IndexError past the largest suffix.
        assert string_util.simplify_number(1000000000000000) == "1000t"

        assert string_util.simplify_number(2500000000000000000) == "2500000t"

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

    def test_from_number_zero_dim_array_uses_item(self):
        """A 0-d numpy array isn't a Number, so its item() value is formatted."""
        assert string_util.from_number(np.array(5)) == "5"
        assert string_util.from_number(np.array(2.5)) == "2.5"

    @parameterized.expand(
        [
            (None, ""),
            ("", ""),
            ("   ", ""),
            ("spinner", "spinner"),
            (" spinner ", "spinner"),
            ("😃", "😃"),
            (" 😃 ", "😃"),
            ("👨‍👨‍👧‍👦", "👨‍👨‍👧‍👦"),
            ("👍🏽", "👍🏽"),
            ("️🚨", "️🚨"),
            (":material/thumb_up:", ":material/thumb_up:"),
            (" :material/thumb_up: ", ":material/thumb_up:"),
            ("🇺🇸", "🇺🇸"),
            ("1️⃣", "1️⃣"),
        ]
    )
    def test_validate_icon_or_emoji(self, icon: str | None, expected: str) -> None:
        """Valid icons are returned in normalized form; None and whitespace mean no icon."""
        assert string_util.validate_icon_or_emoji(icon) == expected

    @parameterized.expand(
        [
            (":material/invalid:", "invalid-material-icon"),
            (":material/thumb_up", "invalid-material-icon"),
            (":Material/thumb_up:", "invalid-material-icon"),
            (":rocket:", "invalid-emoji-shortcode"),
            (":+1:", "invalid-emoji-shortcode"),
            ("invalid", "invalid-icon"),
            ("😃😃", "invalid-emoji"),
            ("https://example.com/icon.png", "invalid-image"),
            ("data:image/png;base64,abc", "invalid-image"),
            ("//cdn.example.com/icon.png", "invalid-image"),
            ("logo.png", "invalid-icon"),
        ]
    )
    def test_validate_icon_or_emoji_classifies_invalid_values(
        self, icon: str, error_id: str
    ) -> None:
        """Invalid values raise with a specific error_id rather than a catch-all."""
        with pytest.raises(StreamlitAPIException) as e:
            string_util.validate_icon_or_emoji(icon)
        assert e.value.error_id == error_id

    def test_validate_icon_or_emoji_truncates_long_invalid_image_values(self) -> None:
        """Long URL-shaped values must not dump their full contents into the exception."""
        icon = "data:image/png;base64," + "A" * 200
        with pytest.raises(StreamlitAPIException) as e:
            string_util.validate_icon_or_emoji(icon)
        assert e.value.error_id == "invalid-image"
        message = str(e.value)
        assert icon not in message
        assert "A" * 200 not in message
        assert "…" in message

    def test_validate_icon_or_emoji_rejects_non_string(self) -> None:
        """Non-string values raise StreamlitInvalidParameterTypeError, not AttributeError."""
        with pytest.raises(StreamlitInvalidParameterTypeError) as e:
            string_util.validate_icon_or_emoji(123)  # type: ignore[arg-type]
        assert e.value.exec_kwargs["parameter"] == "icon"
        assert "int" in str(e.value)

    def test_validate_icon_or_emoji_emoji_error_says_single_emoji(self) -> None:
        """Invalid emoji-like values mention a single emoji, not a single character."""
        with pytest.raises(StreamlitAPIException) as e:
            string_util.validate_icon_or_emoji("😃😃")
        assert "single emoji" in str(e.value)
        assert "single character" not in str(e.value)

    def test_validate_icon_or_emoji_does_not_load_catalogs_for_non_emoji_values(
        self,
    ) -> None:
        """Non-emoji values must not import the emoji or Material icon catalogs."""
        catalog_modules = ("streamlit.emojis", "streamlit.material_icon_names")
        with _without_modules(*catalog_modules):
            assert string_util.validate_icon_or_emoji("spinner") == "spinner"
            assert string_util.validate_icon_or_emoji("") == ""
            with pytest.raises(StreamlitAPIException) as e:
                string_util.validate_icon_or_emoji("home")
            assert e.value.error_id == "invalid-icon"
            with pytest.raises(StreamlitAPIException) as e:
                string_util.validate_icon_or_emoji(":rocket:")
            assert e.value.error_id == "invalid-emoji-shortcode"
            with pytest.raises(StreamlitAPIException) as e:
                string_util.validate_icon_or_emoji("https://example.com/icon.png")
            assert e.value.error_id == "invalid-image"
            for name in catalog_modules:
                assert name not in sys.modules

    def test_validate_icon_or_emoji_does_not_load_emoji_catalog_for_material(
        self,
    ) -> None:
        """Malformed Material syntax must not load the emoji catalog."""
        with _without_modules("streamlit.emojis"):
            with pytest.raises(StreamlitAPIException) as e:
                string_util.validate_icon_or_emoji(":material/not_a_real_icon:")
            assert e.value.error_id == "invalid-material-icon"
            assert "streamlit.emojis" not in sys.modules

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

    @parameterized.expand(
        [
            ("<foo blarg at 0x15ee6f9a0>", True),  # glibc: lowercase hex
            ("<__main__.Foo object at 0x0000027B0C1B1550>", True),  # MSVC instance
            ("<property object at 0x000002500A1F3240>", True),  # MSVC property
            # The "at" and "0x" literals stay case-sensitive: CPython normalizes
            # the prefix to a lowercase "0x" no matter how the C runtime cased
            # the digits.
            ("<foo blarg AT 0X15EE6F9A0>", False),
            ("<module 'os' from '/usr/lib/os.py'>", False),  # Repr with no address
            ("<foo blarg at 0xdeadbeefg>", False),  # Non-hex character
            ("<foo blarg at 15ee6f9a0>", False),  # Missing the 0x prefix
            ("", False),
        ]
    )
    def test_is_mem_address_str(self, string: str, expected: bool) -> None:
        """``is_mem_address_str`` matches default object reprs in either hex casing."""
        assert string_util.is_mem_address_str(string) == expected

    def test_is_mem_address_str_matches_this_host(self) -> None:
        """This host's default object repr matches, whatever hex casing its C
        runtime emits."""
        assert string_util.is_mem_address_str(repr(object()))

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


def test_validate_icon_or_emoji_skips_url_and_path_helpers() -> None:
    """Validation must not import URL or path-security helpers."""
    modules = ("streamlit.url_util", "streamlit.path_security")
    with _without_modules(*modules):
        assert string_util.validate_icon_or_emoji("spinner") == "spinner"
        assert string_util.validate_icon_or_emoji("😃") == "😃"
        assert (
            string_util.validate_icon_or_emoji(":material/thumb_up:")
            == ":material/thumb_up:"
        )
        with pytest.raises(StreamlitAPIException) as e:
            string_util.validate_icon_or_emoji("home")
        assert e.value.error_id == "invalid-icon"
        with pytest.raises(StreamlitAPIException) as e:
            string_util.validate_icon_or_emoji(":rocket:")
        assert e.value.error_id == "invalid-emoji-shortcode"
        with pytest.raises(StreamlitAPIException) as e:
            string_util.validate_icon_or_emoji("https://example.com/icon.png")
        assert e.value.error_id == "invalid-image"
        with pytest.raises(StreamlitAPIException) as e:
            string_util.validate_icon_or_emoji("logo.png")
        assert e.value.error_id == "invalid-icon"
        for name in modules:
            assert name not in sys.modules
