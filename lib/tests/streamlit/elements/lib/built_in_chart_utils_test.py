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

from typing import Any
from unittest.mock import patch

import pytest

from streamlit.elements.lib.built_in_chart_utils import (
    BUILTIN_COLOR_NAMES,
    _resolve_color_names,
    is_builtin_color_name,
    resolve_builtin_color_name,
)


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

    def test_resolve_with_custom_theme_config(self) -> None:
        """Test color resolution when theme is configured via config.get_option()."""

        def mock_get_option(key: str) -> str | None:
            config_values = {
                "theme.redColor": "#custom_red",
                "theme.blueColor": "#custom_blue",
                "theme.primaryColor": "#custom_primary",
            }
            return config_values.get(key)

        with patch(
            "streamlit.elements.lib.built_in_chart_utils.config.get_option",
            side_effect=mock_get_option,
        ):
            assert resolve_builtin_color_name("red") == "#custom_red"
            assert resolve_builtin_color_name("blue") == "#custom_blue"
            assert resolve_builtin_color_name("primary") == "#custom_primary"

    def test_resolve_with_default_theme(self) -> None:
        """Test color resolution with default theme (config returns None)."""
        with patch(
            "streamlit.elements.lib.built_in_chart_utils.config.get_option",
            return_value=None,
        ):
            # Default values from lib/streamlit/config.py (light theme)
            assert resolve_builtin_color_name("red") == "#ff4b4b"
            assert resolve_builtin_color_name("orange") == "#ffa421"
            assert resolve_builtin_color_name("yellow") == "#faca2b"
            assert resolve_builtin_color_name("blue") == "#1c83e1"
            assert resolve_builtin_color_name("green") == "#21c354"
            assert resolve_builtin_color_name("violet") == "#803df5"
            assert resolve_builtin_color_name("gray") == "#a3a8b8"
            assert resolve_builtin_color_name("primary") == "#ff4b4b"

    def test_grey_alias(self) -> None:
        """Test that 'grey' is correctly aliased to 'gray'."""

        def mock_get_option(key: str) -> str | None:
            if key == "theme.grayColor":
                return "#custom_gray"
            return None

        with patch(
            "streamlit.elements.lib.built_in_chart_utils.config.get_option",
            side_effect=mock_get_option,
        ):
            assert resolve_builtin_color_name("grey") == "#custom_gray"
            assert resolve_builtin_color_name("GREY") == "#custom_gray"

        # Without custom config, grey should return gray's default
        with patch(
            "streamlit.elements.lib.built_in_chart_utils.config.get_option",
            return_value=None,
        ):
            assert resolve_builtin_color_name("grey") == "#a3a8b8"

    def test_case_insensitivity(self) -> None:
        """Test that color names are case-insensitive."""

        def mock_get_option(key: str) -> str | None:
            if key == "theme.redColor":
                return "#custom_red"
            return None

        with patch(
            "streamlit.elements.lib.built_in_chart_utils.config.get_option",
            side_effect=mock_get_option,
        ):
            assert resolve_builtin_color_name("RED") == "#custom_red"
            assert resolve_builtin_color_name("Red") == "#custom_red"
            assert resolve_builtin_color_name("red") == "#custom_red"

    def test_config_key_mapping(self) -> None:
        """Test that correct config keys are used for each color."""
        called_keys: list[str] = []

        def mock_get_option(key: str) -> str | None:
            called_keys.append(key)
            return None

        with patch(
            "streamlit.elements.lib.built_in_chart_utils.config.get_option",
            side_effect=mock_get_option,
        ):
            resolve_builtin_color_name("red")
            resolve_builtin_color_name("primary")
            resolve_builtin_color_name("grey")

        assert "theme.redColor" in called_keys
        assert "theme.primaryColor" in called_keys
        # grey should be normalized to gray
        assert "theme.grayColor" in called_keys


class TestResolveColorNames:
    """Test _resolve_color_names function."""

    def test_resolve_none(self) -> None:
        """Test that None is passed through unchanged."""
        assert _resolve_color_names(None) is None

    def test_resolve_builtin_color_string(self) -> None:
        """Test resolving a single built-in color name."""

        def mock_get_option(key: str) -> str | None:
            if key == "theme.redColor":
                return "#custom_red"
            return None

        with patch(
            "streamlit.elements.lib.built_in_chart_utils.config.get_option",
            side_effect=mock_get_option,
        ):
            assert _resolve_color_names("red") == "#custom_red"

        with patch(
            "streamlit.elements.lib.built_in_chart_utils.config.get_option",
            return_value=None,
        ):
            assert _resolve_color_names("red") == "#ff4b4b"

    def test_resolve_non_builtin_color_string(self) -> None:
        """Test that non-built-in colors are passed through unchanged."""
        assert _resolve_color_names("#FF0000") == "#FF0000"
        assert _resolve_color_names("notacolor") == "notacolor"

    def test_resolve_color_list(self) -> None:
        """Test resolving a list of colors."""

        def mock_get_option(key: str) -> str | None:
            config_values = {
                "theme.redColor": "#custom_red",
                "theme.blueColor": "#custom_blue",
            }
            return config_values.get(key)

        with patch(
            "streamlit.elements.lib.built_in_chart_utils.config.get_option",
            side_effect=mock_get_option,
        ):
            result = _resolve_color_names(["red", "#00FF00", "blue"])
            assert result == ["#custom_red", "#00FF00", "#custom_blue"]

    def test_resolve_mixed_list(self) -> None:
        """Test resolving a list with built-in and non-built-in colors."""
        with patch(
            "streamlit.elements.lib.built_in_chart_utils.config.get_option",
            return_value=None,
        ):
            result = _resolve_color_names(["red", "#AABBCC", "notacolor"])
            assert result == ["#ff4b4b", "#AABBCC", "notacolor"]

    def test_preserve_column_names(self) -> None:
        """Test that non-color strings (like column names) are preserved."""
        # This simulates the case where a column name might match a color name
        result = _resolve_color_names("mycolumn")
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
