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
from unittest.mock import patch

import pytest

from streamlit.elements.lib.built_in_chart_utils import _get_built_in_color_css


class BuiltInChartUtilsTest(unittest.TestCase):
    def test_get_built_in_color_css_static_colors(self):
        """Test that static built-in colors return correct CSS values."""
        test_cases = [
            ("red", "#ff4b4b"),
            ("orange", "#ffa421"),
            ("yellow", "#faca2b"),
            ("blue", "#1c83e1"),
            ("green", "#21c354"),
            ("violet", "#803df5"),
            ("gray", "#a3a8b8"),
            ("grey", "#a3a8b8"),  # gray and grey are aliases
        ]

        for color_name, expected_css in test_cases:
            with self.subTest(color=color_name):
                result = _get_built_in_color_css(color_name)
                self.assertEqual(result, expected_css)

    def test_get_built_in_color_css_primary_with_theme(self):
        """Test that primary color uses theme configuration when available."""
        with patch("streamlit.elements.lib.built_in_chart_utils.config") as mock_config:
            mock_config.get_option.return_value = "#custom_primary"

            result = _get_built_in_color_css("primary")
            self.assertEqual(result, "#custom_primary")
            mock_config.get_option.assert_called_once_with("theme.primaryColor")

    def test_get_built_in_color_css_primary_fallback(self):
        """Test that primary color falls back to default when theme not configured."""
        with patch("streamlit.elements.lib.built_in_chart_utils.config") as mock_config:
            mock_config.get_option.return_value = None

            result = _get_built_in_color_css("primary")
            self.assertEqual(result, "#ff4b4b")  # Default Streamlit primary color

    def test_get_built_in_color_css_primary_theme_error(self):
        """Test that primary color falls back to default when theme config fails."""
        with patch("streamlit.elements.lib.built_in_chart_utils.config") as mock_config:
            mock_config.get_option.side_effect = Exception("Config error")

            result = _get_built_in_color_css("primary")
            self.assertEqual(result, "#ff4b4b")  # Default Streamlit primary color

    def test_get_built_in_color_css_unknown_color(self):
        """Test that unknown colors are returned unchanged."""
        unknown_colors = ["purple", "cyan", "magenta", "unknown"]

        for color in unknown_colors:
            with self.subTest(color=color):
                result = _get_built_in_color_css(color)
                self.assertEqual(result, color)

    def test_get_built_in_color_css_case_sensitivity(self):
        """Test that color names are case-sensitive."""
        # These should return unchanged since they don't match exactly
        case_variants = ["Red", "RED", "Blue", "BLUE", "Primary", "PRIMARY"]

        for color in case_variants:
            with self.subTest(color=color):
                result = _get_built_in_color_css(color)
                self.assertEqual(result, color)  # Should return unchanged
