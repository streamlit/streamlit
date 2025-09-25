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

"""Config Util Unittest."""

from __future__ import annotations

import copy
import os
import re
import tempfile
import textwrap
import unittest
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

from streamlit import config, config_util
from streamlit.config_option import ConfigOption
from streamlit.errors import StreamlitAPIException

CONFIG_OPTIONS_TEMPLATE = config._config_options_template
CONFIG_SECTION_DESCRIPTIONS = copy.deepcopy(config._section_descriptions)


def create_config_options(overrides):
    config_options = copy.deepcopy(CONFIG_OPTIONS_TEMPLATE)
    for opt_name, opt_val in overrides.items():
        config_options[opt_name].set_value(opt_val, "test")
    return config_options


class ConfigUtilTest(unittest.TestCase):
    def test_clean(self):
        result = config_util._clean(" clean    this         text  ")
        assert result == " clean this text "

    def test_clean_empty_string(self):
        result = config_util._clean("")
        assert result == ""

    def test_clean_paragraphs(self):
        # from https://www.lipsum.com/
        input_text = textwrap.dedent(
            """
            Lorem              ipsum dolor sit amet,
            consectetur adipiscing elit.

               Curabitur ac fermentum eros.

            Maecenas                   libero est,
                    ultricies
            eget ligula eget,    """
        )

        truth = [
            "Lorem ipsum dolor sit amet,\nconsectetur adipiscing elit.",
            " Curabitur ac fermentum eros.",
            "Maecenas libero est,\n ultricies\neget ligula eget, ",
        ]

        result = config_util._clean_paragraphs(input_text)
        assert truth == result

    def test_clean_paragraphs_empty_string(self):
        result = config_util._clean_paragraphs("")
        assert result == [""]

    @patch("click.secho")
    def test_default_config_options_commented_out(self, patched_echo):
        config_options = create_config_options(
            {
                "server.address": "example.com",  # overrides default
                "server.port": 8501,  # explicitly set to default
            }
        )

        config_util.show_config(CONFIG_SECTION_DESCRIPTIONS, config_options)

        [(args, _)] = patched_echo.call_args_list
        # Remove the ascii escape sequences used to color terminal output.
        output = re.compile(r"\x1b[^m]*m").sub("", args[0])
        lines = set(output.split("\n"))

        # Config options not explicitly set should be commented out.
        assert "# runOnSave = false" in lines

        # Config options explicitly set should *not* be commented out, even if
        # they are set to their default values.
        assert 'address = "example.com"' in lines
        assert "port = 8501" in lines

    @patch("click.secho")
    def test_ui_section_hidden(self, patched_echo):
        config_options = create_config_options({})

        config_util.show_config(CONFIG_SECTION_DESCRIPTIONS, config_options)

        [(args, _)] = patched_echo.call_args_list
        # Remove the ascii escape sequences used to color terminal output.
        output = re.compile(r"\x1b[^m]*m").sub("", args[0])
        lines = set(output.split("\n"))

        assert "[ui]" not in lines
        assert "# hideTopBar = false" not in lines

    @parameterized.expand(
        [
            # Nothing changed.
            (
                {
                    "mapbox.token": "shhhhhhh",
                    "server.address": "localhost",
                },
                {
                    "mapbox.token": "shhhhhhh",
                    "server.address": "localhost",
                },
                False,
            ),
            # A non-server config option changed.
            (
                {
                    "mapbox.token": "shhhhhhh",
                    "server.address": "localhost",
                },
                {
                    "mapbox.token": "SHHHHHHH!!!!!! >:(",
                    "server.address": "localhost",
                },
                False,
            ),
            # A server config option changed.
            (
                {
                    "mapbox.token": "shhhhhhh",
                    "server.address": "localhost",
                },
                {
                    "mapbox.token": "shhhhhhh",
                    "server.address": "streamlit.io",
                },
                True,
            ),
        ]
    )
    def test_server_option_changed(self, old, new, changed):
        old_options = create_config_options(old)
        new_options = create_config_options(new)
        assert config_util.server_option_changed(old_options, new_options) == changed

    @patch("click.secho")
    def test_newlines_preserved_in_description(self, patched_echo):
        config_options = {
            "server.customOption": ConfigOption(
                key="server.customOption",
                description="""
                    This option has multiple lines.
                    Each line should be preserved.
                    Even this one.
                """,
                default_val="default",
                type_=str,
            )
        }

        config_util.show_config(CONFIG_SECTION_DESCRIPTIONS, config_options)

        [(args, _)] = patched_echo.call_args_list
        # Remove the ascii escape sequences used to color terminal output.
        output = re.compile(r"\x1b[^m]*m").sub("", args[0])
        lines = set(output.split("\n"))

        assert "# This option has multiple lines." in lines
        assert "# Each line should be preserved." in lines
        assert "# Even this one." in lines

    @patch("click.secho")
    def test_omits_empty_lines_at_description_start(self, patched_echo):
        config_options = {
            "server.customOption": ConfigOption(
                key="server.customOption",
                description="""

                    This option's description starts from third line.
                    All preceding empty lines should be removed.
                """,
                default_val="default",
                type_=str,
            )
        }

        config_util.show_config(CONFIG_SECTION_DESCRIPTIONS, config_options)

        [(args, _)] = patched_echo.call_args_list
        # Remove the ascii escape sequences used to color terminal output.
        output = re.compile(r"\x1b[^m]*m").sub("", args[0])
        lines = output.split("\n")
        description_index = lines.index(
            "# This option's description starts from third line."
        )

        assert description_index > 1, (
            "Description should not be at the start of the output"
        )
        assert lines[description_index - 1].strip() == "", (
            "Preceding line should be empty (this line separates config options)"
        )
        assert lines[description_index - 2].strip() != "", (
            "The line before the preceding line should not be empty (this is the section header)"
        )

    @patch("click.secho")
    def test_description_appears_before_option(self, patched_echo):
        config_options = {
            "server.customOption": ConfigOption(
                key="server.customOption",
                description="This option's description should appear before the option.",
                default_val="default",
                type_=str,
            )
        }

        config_util.show_config(CONFIG_SECTION_DESCRIPTIONS, config_options)

        [(args, _)] = patched_echo.call_args_list
        # Remove the ascii escape sequences used to color terminal output.
        output = re.compile(r"\x1b[^m]*m").sub("", args[0])
        lines = output.split("\n")

        # Find the index of the description and the option in the output.
        description_index = lines.index(
            "# This option's description should appear before the option."
        )
        option_index = lines.index('# customOption = "default"')

        # Assert that the description appears before the option.
        assert description_index < option_index

    @patch("click.secho")
    def test_show_config_section_formatting(self, patched_echo):
        config_options = create_config_options(
            {"server.address": "localhost", "theme.sidebar.primaryColor": "red"}
        )
        config_util.show_config(CONFIG_SECTION_DESCRIPTIONS, config_options)

        [(args, _)] = patched_echo.call_args_list
        output = re.compile(r"\x1b[^m]*m").sub("", args[0])
        lines = output.split("\n")

        assert "[server]" in lines
        assert 'address = "localhost"' in lines
        assert "[theme.sidebar]" in lines
        assert 'primaryColor = "red"' in lines

    @patch("click.secho")
    def test_show_config_hidden_option(self, patched_echo):
        config_options = {
            "server.hiddenOption": ConfigOption(
                key="server.hiddenOption",
                description="This is a hidden option.",
                default_val="default",
                type_=str,
                visibility="hidden",
            )
        }
        config_util.show_config(CONFIG_SECTION_DESCRIPTIONS, config_options)

        [(args, _)] = patched_echo.call_args_list
        output = re.compile(r"\x1b[^m]*m").sub("", args[0])
        lines = output.split("\n")

        assert "# This is a hidden option." not in lines

    @patch("click.secho")
    def test_correctly_handles_show_error_details(self, patched_echo):
        """Test that show_config correctly handles showErrorDetails = "full"
        based on a regression.
        """
        config_util.show_config(
            CONFIG_SECTION_DESCRIPTIONS,
            create_config_options({}),
        )

        [(args, _)] = patched_echo.call_args_list
        output = re.compile(r"\x1b[^m]*m").sub("", args[0])

        assert 'showErrorDetails = "full"' in output


class ThemeInheritanceUtilTest(unittest.TestCase):
    """Test theme inheritance utility functions."""

    def setUp(self):
        self.config_template = CONFIG_OPTIONS_TEMPLATE

    def _get_expected_theme_options_count(self, section: str = "theme") -> int:
        """
        Get the expected count of theme options by directly counting from config template.

        This uses the config template as the source of truth, ensuring the test
        stays in sync with the actual theme options defined in the system.
        """
        # Count theme options directly from the config template
        # (not using the function under test to avoid circular logic)
        theme_option_count = 0
        for option_key in self.config_template:
            if option_key.startswith(section):
                parts = option_key.split(".")
                # In the case we are counting theme options (e.g. "theme.primaryColor"):
                if section == "theme" and len(parts) == 2:
                    theme_option_count += 1
                # In the case we are counting sidebar options (e.g. "theme.sidebar.primaryColor"):
                if section == "theme.sidebar" and len(parts) == 3:
                    theme_option_count += 1

        return theme_option_count

    # Tests for theme.base support functions

    @parameterized.expand(
        [
            ("#ffffff", "theme.primaryColor"),
            ("#000", "theme.primaryColor"),
            ("#FF0000", "theme.primaryColor"),
            ("#ffff", "theme.primaryColor"),  # 4-digit hex with alpha
            ("#ffffffff", "theme.primaryColor"),  # 8-digit hex with alpha
            ("rgb(255, 0, 0)", "theme.primaryColor"),
            ("rgba(255, 0, 0, 0.5)", "theme.primaryColor"),
            ("  #ff0000  ", "theme.primaryColor"),  # Test trimming
        ]
    )
    def test_check_color_value_valid_single_colors(self, color: str, option_name: str):
        """Test _check_color_value with various valid single color formats."""
        # Should return None and not log any warnings
        with patch("streamlit.config_util._get_logger") as mock_get_logger:
            mock_logger = mock_get_logger.return_value
            result = config_util._check_color_value(color, option_name)

            assert result is None
            mock_logger.warning.assert_not_called()

    @parameterized.expand(
        [
            (["#ff0000", "#00ff00", "#0000ff"], "theme.chartCategoricalColors"),
            (
                ["rgb(255,0,0)", "rgba(0,255,0,0.5)", "#fff"],
                "theme.chartSequentialColors",
            ),
            (["#ffffff"], "theme.chartCategoricalColors"),  # Single item array
        ]
    )
    def test_check_color_value_valid_color_arrays(
        self, colors: list[str], option_name: str
    ):
        """Test _check_color_value with valid color arrays."""
        # Should return None and not log any warnings
        with patch("streamlit.config_util._get_logger") as mock_get_logger:
            mock_logger = mock_get_logger.return_value
            result = config_util._check_color_value(colors, option_name)

            assert result is None
            mock_logger.warning.assert_not_called()

    @parameterized.expand(
        [
            ("#invalid", "theme.primaryColor"),
            ("#ff", "theme.primaryColor"),
            ("#12345", "theme.primaryColor"),  # Wrong length
            ("not-a-color", "theme.primaryColor"),
        ]
    )
    def test_check_color_value_invalid_single_colors_logs_warning(
        self, color: str, option_name: str
    ):
        """Test _check_color_value logs warnings for invalid single colors but doesn't raise error."""
        with patch("streamlit.config_util._get_logger") as mock_get_logger:
            mock_logger = mock_get_logger.return_value
            result = config_util._check_color_value(color, option_name)

            # Should return None but log a warning
            assert result is None
            mock_logger.warning.assert_called_once()

            # Check warning message contains expected content
            warning_args = mock_logger.warning.call_args[0]
            assert option_name in warning_args[1]
            assert color in warning_args[2]

    def test_check_color_value_invalid_colors_in_array_logs_warnings(self):
        """Test _check_color_value logs warnings for invalid colors in arrays."""
        colors = ["#ff0000", "#invalid", "#00ff00", "not-a-color"]

        with patch("streamlit.config_util._get_logger") as mock_get_logger:
            mock_logger = mock_get_logger.return_value
            result = config_util._check_color_value(
                colors, "theme.chartCategoricalColors"
            )

            # Should return None but log warnings for invalid colors
            assert result is None
            # Should log 2 warnings (for "#invalid" and "not-a-color")
            assert mock_logger.warning.call_count == 2

    @parameterized.expand(
        [
            ("", "theme.primaryColor", "cannot be empty"),
            (123, "theme.primaryColor", "must be a string"),
            (None, "theme.primaryColor", "must be a string"),
            ([], "theme.chartCategoricalColors", "cannot be an empty array"),
            (["", "#ff0000"], "theme.chartCategoricalColors", "cannot be empty"),
            ([123, "#ff0000"], "theme.chartCategoricalColors", "must be a string"),
        ]
    )
    def test_check_color_value_type_and_empty_errors(
        self, value, option_name: str, expected_error: str
    ):
        """Test _check_color_value raises exceptions for type errors and empty values."""
        with pytest.raises(StreamlitAPIException) as cm:
            config_util._check_color_value(value, option_name)
        assert expected_error in str(cm.value)

    def test_iter_theme_config_options(self):
        """Test _iterate_theme_config_options extracts theme options correctly."""
        mock_config_options = {
            "theme.primaryColor": ConfigOption(
                "theme.primaryColor", description="", default_val="#ff0000"
            ),
            "theme.backgroundColor": ConfigOption(
                "theme.backgroundColor", description="", default_val=None
            ),  # Should be excluded
            "server.port": ConfigOption(
                "server.port", description="", default_val=8501
            ),  # Should be excluded
            "theme.font": ConfigOption(
                "theme.font", description="", default_val="serif"
            ),
            "theme.sidebar.primaryColor": ConfigOption(
                "theme.sidebar.primaryColor", description="", default_val="#00ff00"
            ),
        }

        # Set values for some options
        mock_config_options["theme.primaryColor"].set_value("#ff0000", "test")
        mock_config_options["theme.font"].set_value("serif", "test")
        mock_config_options["theme.sidebar.primaryColor"].set_value("#00ff00", "test")

        result = list(config_util._iterate_theme_config_options(mock_config_options))

        # Should only include theme options with non-None values (returns full key names)
        expected_keys = {
            "theme.primaryColor",
            "theme.font",
            "theme.sidebar.primaryColor",
        }
        actual_keys = {key for key, value in result}

        assert actual_keys == expected_keys

        # Check values
        result_dict = dict(result)
        assert result_dict["theme.primaryColor"] == "#ff0000"
        assert result_dict["theme.font"] == "serif"
        assert result_dict["theme.sidebar.primaryColor"] == "#00ff00"

    def test_extract_current_theme_config(self):
        """Test _extract_current_theme_config extracts theme config correctly."""
        mock_config_options = {
            "theme.primaryColor": ConfigOption(
                "theme.primaryColor", description="", default_val=None
            ),
            "theme.backgroundColor": ConfigOption(
                "theme.backgroundColor", description="", default_val=None
            ),
            "theme.sidebar.primaryColor": ConfigOption(
                "theme.sidebar.primaryColor", description="", default_val=None
            ),
            "server.port": ConfigOption(
                "server.port", description="", default_val=8501
            ),  # Should be excluded
        }

        # Set values for theme options
        mock_config_options["theme.primaryColor"].set_value("#ff0000", "test")
        mock_config_options["theme.backgroundColor"].set_value("#000000", "test")
        mock_config_options["theme.sidebar.primaryColor"].set_value("#00ff00", "test")
        mock_config_options["server.port"].set_value(9000, "test")  # Non-theme option

        result = config_util._extract_current_theme_config(mock_config_options)

        expected = {
            "primaryColor": "#ff0000",
            "backgroundColor": "#000000",
            "sidebar": {"primaryColor": "#00ff00"},
        }

        assert result == expected

    def test_extract_current_theme_config_no_theme_options(self):
        """Test _extract_current_theme_config with no theme options set."""
        mock_config_options = {
            "server.port": ConfigOption(
                "server.port", description="", default_val=8501
            ),
            "theme.primaryColor": ConfigOption(
                "theme.primaryColor", description="", default_val=None
            ),  # None value
        }

        mock_config_options["server.port"].set_value(9000, "test")
        # Don't set theme.primaryColor value (should remain None)

        result = config_util._extract_current_theme_config(mock_config_options)

        assert result == {}

    def test_get_valid_theme_options(self):
        """Test that _get_valid_theme_options extracts all valid theme options."""
        valid_options = config_util._get_valid_theme_options(self.config_template)

        # Test subset of expected core theme options
        expected_options = {
            "base",
            "baseFontWeight",
            "baseRadius",
            "primaryColor",
            "textColor",
            "font",
            "headingFontSizes",
            "borderColor",
            "linkUnderline",
            "chartCategoricalColors",
            "violetColor",
            "violetBackgroundColor",
            "violetTextColor",
        }
        assert expected_options.issubset(valid_options)

        # Does not include section names
        assert "sidebar" not in valid_options

        # Test that all options are strings
        for option in valid_options:
            assert isinstance(option, str)

    def test_get_valid_theme_options_main_section(self):
        """Test _get_valid_theme_options for main section specifically."""
        main_options = config_util._get_valid_theme_options(
            self.config_template, "main"
        )

        # These should be in main section
        expected_main_only = {
            "base",
            "baseFontWeight",
            "baseRadius",
            "primaryColor",
            "textColor",
            "font",
            "headingFontSizes",
            "borderColor",
            "linkUnderline",
            "chartSequentialColors",
            "blueColor",
            "blueBackgroundColor",
            "blueTextColor",
        }
        assert expected_main_only.issubset(main_options)

        # Test that we get the expected number of theme options
        # Use the config template as source of truth for expected theme options count
        expected_count = self._get_expected_theme_options_count()
        assert len(main_options) == expected_count, (
            f"Expected {expected_count} main theme options based on config template, "
            f"but got {len(main_options)}"
        )

    def test_get_valid_theme_options_sidebar_section(self):
        """Test _get_valid_theme_options for sidebar section specifically."""
        sidebar_options = config_util._get_valid_theme_options(
            self.config_template, "sidebar"
        )

        # These are some options that should be in sidebar section
        expected_sidebar = {
            # The only config with base in the name that should be in sidebar
            "baseRadius",
            "primaryColor",
            "textColor",
            "font",
            "headingFontSizes",
            "borderColor",
            "linkUnderline",
            "codeFontWeight",
            "greenColor",
            "greenBackgroundColor",
            "greenTextColor",
        }
        assert expected_sidebar.issubset(sidebar_options)

        # These are all the options that should NOT be in sidebar section
        main_only_options = {
            "base",
            "baseFontSize",
            "baseFontWeight",
            "fontFaces",
            "showSidebarBorder",
            "chartCategoricalColors",
            "chartSequentialColors",
        }
        assert main_only_options.isdisjoint(sidebar_options)

        # Test that we get the expected number of theme.sidebar options
        expected_count = self._get_expected_theme_options_count(section="theme.sidebar")
        assert len(sidebar_options) == expected_count, (
            f"Expected {expected_count} theme.sidebar options based on config template, "
            f"but got {len(sidebar_options)}"
        )

    def test_validate_theme_file_content_with_valid_content(self):
        """Test validation of valid theme file content."""
        theme_content = {
            "theme": {
                "base": "dark",
                "primaryColor": "#ff0000",
                "backgroundColor": "#000000",
                "sidebar": {"primaryColor": "#00ff00", "backgroundColor": "#111111"},
            }
        }

        # Should not raise any exception and return filtered theme
        filtered_theme = config_util._validate_theme_file_content(
            theme_content, "test_theme.toml", self.config_template
        )

        # Should return the same content since all options are valid
        assert filtered_theme == theme_content

    def test_validate_theme_file_content_invalid_option(self):
        """Test validation logs warning for invalid theme options."""
        theme_content = {"theme": {"invalidOption": "value", "primaryColor": "#ff0000"}}

        # Mock the logger returned by _get_logger
        with patch("streamlit.config_util._get_logger") as mock_get_logger:
            mock_logger = mock_get_logger.return_value
            filtered_theme = config_util._validate_theme_file_content(
                theme_content, "test_theme.toml", self.config_template
            )
            mock_logger.warning.assert_called_once()

        # Check the warning call arguments
        warning_call = mock_logger.warning.call_args
        format_string = warning_call[0][0]
        args = warning_call[0][1:]

        # Verify content in the format string and args
        assert "invalid theme option" in format_string
        assert "test_theme.toml" in args[0]  # file_path_or_url
        assert "theme.invalidOption" in args[1]  # full_option_name
        assert "theme" in args[2]  # section_name

        # Verify invalid option was removed from filtered theme
        assert "invalidOption" not in filtered_theme["theme"]
        # Verify valid option was preserved
        assert filtered_theme["theme"]["primaryColor"] == "#ff0000"

    def test_validate_theme_file_content_invalid_subsection(self):
        """Test validation rejects invalid theme subsections."""
        theme_content = {
            "theme": {
                "primaryColor": "#ff0000",
                "invalidSubsection": {"primaryColor": "#00ff00"},
            }
        }

        with pytest.raises(StreamlitAPIException) as cm:
            config_util._validate_theme_file_content(
                theme_content, "test_theme.toml", self.config_template
            )

        assert "invalid theme subsection" in str(cm.value)
        assert "invalidSubsection" in str(cm.value)

    def test_validate_theme_file_content_invalid_sidebar_option(self):
        """Test validation rejects invalid sidebar options."""
        theme_content = {
            "theme": {
                "primaryColor": "#ff0000",
                "sidebar": {"invalidSidebarOption": "value"},
            }
        }

        # Mock the logger returned by _get_logger
        with patch("streamlit.config_util._get_logger") as mock_get_logger:
            mock_logger = mock_get_logger.return_value
            filtered_theme = config_util._validate_theme_file_content(
                theme_content, "test_theme.toml", self.config_template
            )
            mock_logger.warning.assert_called_once()

        warning_call = mock_logger.warning.call_args
        format_string = warning_call[0][0]
        args = warning_call[0][1:]

        assert "invalid theme option" in format_string
        assert "test_theme.toml" in args[0]  # file_path_or_url
        assert "theme.sidebar.invalidSidebarOption" in args[1]  # full_option_name
        assert "sidebar" in args[2]  # section_name

        # Verify invalid sidebar option was removed from filtered theme
        assert "invalidSidebarOption" not in filtered_theme["theme"]["sidebar"]
        # Verify valid main option was preserved
        assert filtered_theme["theme"]["primaryColor"] == "#ff0000"

    def test_validate_theme_file_content_invalid_main_option_in_sidebar(self):
        """Test validation rejects main-theme-only options in sidebar."""
        # Test each main-only option individually
        main_only_options = {
            "base": "#ffffff",
            "baseFontSize": "16px",
            "baseFontWeight": "bold",
            "fontFaces": "Arial, sans-serif",
            "showSidebarBorder": True,
            "chartCategoricalColors": ["#ff0000", "#00ff00", "#0000ff"],
            "chartSequentialColors": ["#ff0000", "#00ff00", "#0000ff"],
        }

        for main_only_option, option_value in main_only_options.items():
            theme_content = {
                "theme": {
                    "primaryColor": "#ff0000",
                    "sidebar": {main_only_option: option_value},
                }
            }

            with patch("streamlit.config_util._get_logger") as mock_get_logger:
                mock_logger = mock_get_logger.return_value
                filtered_theme = config_util._validate_theme_file_content(
                    theme_content, "test_theme.toml", self.config_template
                )
                mock_logger.warning.assert_called_once()

            # Check the warning call arguments
            warning_call = mock_logger.warning.call_args
            format_string = warning_call[0][0]
            args = warning_call[0][1:]

            # Verify content in the format string and args
            assert "invalid theme option" in format_string
            assert "test_theme.toml" in args[0]  # file_path_or_url
            assert f"theme.sidebar.{main_only_option}" in args[1]  # full_option_name
            assert "sidebar" in args[2]  # section_name

            # Verify invalid sidebar option was removed from filtered theme
            assert main_only_option not in filtered_theme["theme"]["sidebar"]
            # Verify valid main option was preserved
            assert filtered_theme["theme"]["primaryColor"] == "#ff0000"

    def test_load_theme_file_missing_toml(self):
        """Test _load_theme_file when toml module is missing."""

        # Mock the import toml statement to raise ImportError
        with patch.dict("sys.modules", {"toml": None}):
            with pytest.raises(StreamlitAPIException) as cm:
                config_util._load_theme_file("theme.toml", self.config_template)

            assert "toml' package is required" in str(cm.value)

    def test_load_theme_file_local_success(self):
        """Test loading theme file from local path successfully."""
        theme_toml = """
        [theme]
        base = "light"
        primaryColor = "#0066cc"
        backgroundColor = "#ffffff"
        """

        with tempfile.NamedTemporaryFile(mode="w", suffix=".toml", delete=False) as f:
            f.write(theme_toml)
            temp_path = f.name

        try:
            result = config_util._load_theme_file(temp_path, self.config_template)
            assert result["theme"]["base"] == "light"
            assert result["theme"]["primaryColor"] == "#0066cc"
            assert result["theme"]["backgroundColor"] == "#ffffff"
        finally:
            os.unlink(temp_path)

    @patch("streamlit.config_util.url_util.is_url")
    @patch("streamlit.config_util.urllib.request.urlopen")
    def test_load_theme_file_url_success(self, mock_urlopen, mock_is_url):
        """Test loading theme file from URL successfully."""
        mock_is_url.return_value = True

        theme_toml = """
        [theme]
        base = "dark"
        primaryColor = "#ff0000"
        """

        mock_response = MagicMock()
        mock_response.read.return_value = theme_toml.encode("utf-8")
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        result = config_util._load_theme_file(
            "https://example.com/theme.toml", self.config_template
        )

        assert result["theme"]["base"] == "dark"
        assert result["theme"]["primaryColor"] == "#ff0000"

    @patch("streamlit.config_util.os.path.exists")
    def test_load_theme_file_missing_file(self, mock_exists):
        """Test _load_theme_file with missing local file."""
        mock_exists.return_value = False

        with pytest.raises(FileNotFoundError) as cm:
            config_util._load_theme_file("missing_theme.toml", self.config_template)

        assert "Theme file not found" in str(cm.value)

    @patch("streamlit.config_util.url_util.is_url")
    @patch("streamlit.config_util.urllib.request.urlopen")
    def test_load_theme_file_url_error(self, mock_urlopen, mock_is_url):
        """Test loading theme file from URL with network error."""
        mock_is_url.return_value = True

        import urllib.error

        mock_urlopen.side_effect = urllib.error.URLError("Network error")

        with pytest.raises(StreamlitAPIException) as cm:
            config_util._load_theme_file(
                "https://example.com/theme.toml", self.config_template
            )

        assert "Could not load theme file from URL" in str(cm.value)

    def test_load_theme_file_missing_theme_section(self):
        """Test loading theme file without [theme] section."""
        content_toml = """
        [server]
        port = 8501
        """

        with tempfile.NamedTemporaryFile(mode="w", suffix=".toml", delete=False) as f:
            f.write(content_toml)
            temp_path = f.name

        try:
            with pytest.raises(StreamlitAPIException) as cm:
                config_util._load_theme_file(temp_path, self.config_template)

            assert "must contain a [theme] section" in str(cm.value)
        finally:
            os.unlink(temp_path)

    def test_load_theme_file_invalid_toml(self):
        """Test loading theme file with invalid TOML syntax."""
        invalid_toml = """
        [theme
        base = "dark"
        primaryColor = "#ff0000"
        """

        with tempfile.NamedTemporaryFile(mode="w", suffix=".toml", delete=False) as f:
            f.write(invalid_toml)
            temp_path = f.name

        try:
            with pytest.raises(StreamlitAPIException) as cm:
                config_util._load_theme_file(temp_path, self.config_template)

            assert "Error loading theme file" in str(cm.value)
        finally:
            os.unlink(temp_path)

    def test_load_theme_file_too_large_raises_error(self):
        """Test loading theme file that exceeds size limit raises error."""
        # Create a theme file larger than 1MB
        large_content = (
            """
        [theme]
        base = "light"
        primaryColor = "#ff0000"
        # """
            + "A" * (config_util._MAX_THEME_FILE_SIZE_BYTES + 1000)
        )

        with tempfile.NamedTemporaryFile(mode="w", suffix=".toml", delete=False) as f:
            f.write(large_content)
            temp_path = f.name

        try:
            with pytest.raises(StreamlitAPIException) as cm:
                config_util._load_theme_file(temp_path, self.config_template)

            error_msg = str(cm.value)
            assert "too large" in error_msg
            assert "1MB" in error_msg
            assert "configuration options" in error_msg
        finally:
            os.unlink(temp_path)

    def test_apply_theme_inheritance_basic(self):
        """Test basic theme inheritance merging."""
        base_theme = {
            "theme": {
                "base": "dark",
                "primaryColor": "#ff0000",
                "backgroundColor": "#000000",
            }
        }

        override_theme = {
            "theme": {
                "primaryColor": "#00ff00",  # Override
                "textColor": "#ffffff",  # New option
            }
        }

        result = config_util._apply_theme_inheritance(base_theme, override_theme)

        # Base value should remain
        assert result["theme"]["base"] == "dark"
        assert result["theme"]["backgroundColor"] == "#000000"

        # Override values should take precedence
        assert result["theme"]["primaryColor"] == "#00ff00"
        assert result["theme"]["textColor"] == "#ffffff"

    def test_apply_theme_inheritance_nested(self):
        """Test theme inheritance with nested sections."""
        base_theme = {
            "theme": {
                "primaryColor": "#ff0000",
                "sidebar": {"primaryColor": "#ff4444", "backgroundColor": "#222222"},
            }
        }

        override_theme = {
            "theme": {
                "sidebar": {
                    "primaryColor": "#00ff00"  # Override sidebar primary
                }
            }
        }

        result = config_util._apply_theme_inheritance(base_theme, override_theme)

        # Main theme unchanged
        assert result["theme"]["primaryColor"] == "#ff0000"

        # Sidebar primary overridden
        assert result["theme"]["sidebar"]["primaryColor"] == "#00ff00"

        # Sidebar background preserved
        assert result["theme"]["sidebar"]["backgroundColor"] == "#222222"

    def test_apply_theme_inheritance_new_section(self):
        """Test theme inheritance adds new sections."""
        base_theme = {"theme": {"primaryColor": "#ff0000"}}

        override_theme = {"theme": {"sidebar": {"primaryColor": "#00ff00"}}}

        result = config_util._apply_theme_inheritance(base_theme, override_theme)

        assert result["theme"]["primaryColor"] == "#ff0000"
        assert result["theme"]["sidebar"]["primaryColor"] == "#00ff00"

    def test_process_theme_inheritance_builtin_base(self):
        """Test process_theme_inheritance with builtin base ('light' or 'dark')."""
        base_option = ConfigOption("theme.base", description="", default_val="dark")
        base_option.set_value("dark", "test")

        config_options = {"theme.base": base_option}

        set_option_mock = MagicMock()

        # Should return early since 'dark' is a builtin theme
        config_util.process_theme_inheritance(
            config_options, self.config_template, set_option_mock
        )

        set_option_mock.assert_not_called()

    def test_process_theme_inheritance_no_base(self):
        """Test process_theme_inheritance when no base is set."""
        config_options = {
            "theme.primaryColor": ConfigOption(
                "theme.primaryColor", description="", default_val=None
            )
        }

        set_option_mock = MagicMock()

        # Should return early without doing anything
        config_util.process_theme_inheritance(
            config_options, self.config_template, set_option_mock
        )

        set_option_mock.assert_not_called()

    @patch("streamlit.config_util._load_theme_file")
    def test_process_theme_inheritance_successful_merge(self, mock_load_theme):
        """Test successful theme inheritance processing."""
        base_option = ConfigOption("theme.base", description="", default_val=None)
        base_option.set_value("custom_theme.toml", "test")

        primary_option = ConfigOption(
            "theme.primaryColor", description="", default_val=None
        )
        primary_option.set_value("#override", "config.toml")

        config_options = {
            "theme.base": base_option,
            "theme.primaryColor": primary_option,
        }

        # Mock loaded theme file
        mock_load_theme.return_value = {
            "theme": {
                "base": "dark",
                "primaryColor": "#base_color",
                "backgroundColor": "#from_theme_file",
            }
        }

        set_option_calls = []

        def mock_set_option(key, value, source):
            set_option_calls.append((key, value, source))

        config_util.process_theme_inheritance(
            config_options, self.config_template, mock_set_option
        )

        # Verify that theme options were set correctly
        set_calls_dict = {call[0]: call[1] for call in set_option_calls}

        # Base should be set from theme file
        assert set_calls_dict.get("theme.base") == "dark"

        # Background should come from theme file
        assert set_calls_dict.get("theme.backgroundColor") == "#from_theme_file"

        # Primary color should be the merged result (config override wins)
        assert set_calls_dict.get("theme.primaryColor") == "#override"

    @patch("streamlit.config_util._load_theme_file")
    def test_process_theme_inheritance_nested_base_error(self, mock_load_theme):
        """Test process_theme_inheritance detects nested base references."""
        base_option = ConfigOption("theme.base", description="", default_val=None)
        base_option.set_value("custom_theme.toml", "test")

        config_options = {"theme.base": base_option}

        # Mock theme file with nested base reference
        mock_load_theme.return_value = {
            "theme": {
                "base": "other_theme.toml",  # Nested reference!
                "primaryColor": "#ff0000",
            }
        }

        set_option_mock = MagicMock()

        with pytest.raises(StreamlitAPIException) as cm:
            config_util.process_theme_inheritance(
                config_options, self.config_template, set_option_mock
            )

        assert "cannot reference another theme file" in str(cm.value)
