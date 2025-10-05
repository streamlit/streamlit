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

from typing import Any

import pytest

from streamlit.elements.lib.built_in_chart_utils import (
    BUILTIN_COLOR_NAMES,
    _resolve_color_names,
    is_builtin_color_name,
    resolve_builtin_color_name,
)


class MockTheme:
    """Mock theme object for testing."""

    def __init__(self, **kwargs: str) -> None:
        self._colors = kwargs

    def __getattr__(self, name: str) -> str:
        if name.startswith("_"):
            raise AttributeError(
                f"'{type(self).__name__}' object has no attribute '{name}'"
            )
        if name not in self._colors:
            raise AttributeError(
                f"'{type(self).__name__}' object has no attribute '{name}'"
            )
        return self._colors[name]


class TestIsBuiltinColorName:
    """Test is_builtin_color_name function."""

    @pytest.mark.parametrize(
        "color_name",
        [
            "red",
            "RED",
            "Red",
            "orange",
            "yellow",
            "blue",
            "green",
            "violet",
            "gray",
            "grey",
            "GREY",
            "primary",
            "PRIMARY",
        ],
    )
    def test_valid_builtin_color_names(self, color_name: str) -> None:
        """Test that valid built-in color names are recognized."""
        assert is_builtin_color_name(color_name) is True

    @pytest.mark.parametrize(
        "invalid_input",
        [
            "notacolor",
            "purple",  # Not a built-in color
            "#FF0000",  # Hex color
            "",
            None,
            123,
            ["red"],
        ],
    )
    def test_invalid_inputs(self, invalid_input: Any) -> None:
        """Test that invalid inputs are rejected."""
        assert is_builtin_color_name(invalid_input) is False


class TestResolveBuiltinColorName:
    """Test resolve_builtin_color_name function."""

    def test_resolve_with_theme(self) -> None:
        """Test color resolution with a theme object."""
        theme = MockTheme(
            redColor="#custom_red",
            blueColor="#custom_blue",
            primaryColor="#custom_primary",
        )

        assert resolve_builtin_color_name("red", theme) == "#custom_red"
        assert resolve_builtin_color_name("blue", theme) == "#custom_blue"
        assert resolve_builtin_color_name("primary", theme) == "#custom_primary"

    def test_resolve_without_theme(self) -> None:
        """Test color resolution without a theme (fallback to defaults)."""
        # Default values from lib/streamlit/config.py (light theme)
        assert resolve_builtin_color_name("red", None) == "#ff4b4b"
        assert resolve_builtin_color_name("orange", None) == "#ffa421"
        assert resolve_builtin_color_name("yellow", None) == "#faca2b"
        assert resolve_builtin_color_name("blue", None) == "#1c83e1"
        assert resolve_builtin_color_name("green", None) == "#21c354"
        assert resolve_builtin_color_name("violet", None) == "#803df5"
        assert resolve_builtin_color_name("gray", None) == "#a3a8b8"
        assert resolve_builtin_color_name("primary", None) == "#ff4b4b"

    def test_grey_alias(self) -> None:
        """Test that 'grey' is correctly aliased to 'gray'."""
        theme = MockTheme(grayColor="#custom_gray")
        assert resolve_builtin_color_name("grey", theme) == "#custom_gray"
        assert resolve_builtin_color_name("GREY", theme) == "#custom_gray"

        # Without theme, grey should return gray's default
        assert resolve_builtin_color_name("grey", None) == "#a3a8b8"

    def test_case_insensitivity(self) -> None:
        """Test that color names are case-insensitive."""
        theme = MockTheme(redColor="#custom_red")
        assert resolve_builtin_color_name("RED", theme) == "#custom_red"
        assert resolve_builtin_color_name("Red", theme) == "#custom_red"
        assert resolve_builtin_color_name("red", theme) == "#custom_red"

    def test_theme_fallback_to_default(self) -> None:
        """Test that missing theme colors fallback to defaults."""
        theme = MockTheme()  # Empty theme
        # Default values from lib/streamlit/config.py (light theme)
        assert resolve_builtin_color_name("red", theme) == "#ff4b4b"
        assert resolve_builtin_color_name("blue", theme) == "#1c83e1"


class TestResolveColorNames:
    """Test _resolve_color_names function."""

    def test_resolve_none(self) -> None:
        """Test that None is passed through unchanged."""
        assert _resolve_color_names(None, None) is None

    def test_resolve_builtin_color_string(self) -> None:
        """Test resolving a single built-in color name."""
        theme = MockTheme(redColor="#custom_red")
        assert _resolve_color_names("red", theme) == "#custom_red"
        assert _resolve_color_names("red", None) == "#ff4b4b"

    def test_resolve_non_builtin_color_string(self) -> None:
        """Test that non-built-in colors are passed through unchanged."""
        assert _resolve_color_names("#FF0000", None) == "#FF0000"
        assert _resolve_color_names("notacolor", None) == "notacolor"

    def test_resolve_color_list(self) -> None:
        """Test resolving a list of colors."""
        theme = MockTheme(redColor="#custom_red", blueColor="#custom_blue")
        result = _resolve_color_names(["red", "#00FF00", "blue"], theme)
        assert result == ["#custom_red", "#00FF00", "#custom_blue"]

    def test_resolve_mixed_list(self) -> None:
        """Test resolving a list with built-in and non-built-in colors."""
        result = _resolve_color_names(["red", "#AABBCC", "notacolor"], None)
        assert result == ["#ff4b4b", "#AABBCC", "notacolor"]

    def test_preserve_column_names(self) -> None:
        """Test that non-color strings (like column names) are preserved."""
        # This simulates the case where a column name might match a color name
        result = _resolve_color_names("mycolumn", None)
        assert result == "mycolumn"


class TestBuiltinColorNamesConstant:
    """Test BUILTIN_COLOR_NAMES constant."""

    def test_contains_all_expected_colors(self) -> None:
        """Test that the constant contains all expected color names."""
        expected_colors = {
            "red",
            "orange",
            "yellow",
            "blue",
            "green",
            "violet",
            "gray",
            "grey",
            "primary",
        }
        assert expected_colors == BUILTIN_COLOR_NAMES

    def test_is_frozenset(self) -> None:
        """Test that BUILTIN_COLOR_NAMES is a frozenset (immutable)."""
        assert isinstance(BUILTIN_COLOR_NAMES, frozenset)
