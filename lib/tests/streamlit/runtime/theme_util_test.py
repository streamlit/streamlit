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

import pytest

from streamlit.errors import StreamlitAPIException
from streamlit.proto.NewSession_pb2 import CustomThemeConfig
from streamlit.runtime.theme_util import parse_fonts_with_source


class TestParseFontsWithSource:
    """Test cases for the parse_fonts_with_source function."""

    def test_parse_all_fonts_name_only(self):
        """Test parsing all three fonts with just font names (no sources)."""
        msg = CustomThemeConfig()
        updated_msg = parse_fonts_with_source(
            msg,
            body_font_config="Inter",
            code_font_config="Roboto Mono",
            heading_font_config="Inter Bold",
            section="theme",
        )

        assert updated_msg.body_font == "Inter"
        assert updated_msg.code_font == "Roboto Mono"
        assert updated_msg.heading_font == "Inter Bold"
        assert len(updated_msg.font_sources) == 0

    def test_parse_empty_inputs(self):
        """Test parsing with empty/None inputs."""
        msg = CustomThemeConfig()
        updated_msg = parse_fonts_with_source(
            msg,
            body_font_config=None,
            code_font_config=None,
            heading_font_config=None,
            section="theme",
        )

        assert updated_msg.body_font == ""
        assert updated_msg.code_font == ""
        assert updated_msg.heading_font == ""
        assert len(updated_msg.font_sources) == 0

    def test_parse_body_font_with_source(self):
        """Test parsing body font with HTTP source URL."""
        msg = CustomThemeConfig()
        updated_msg = parse_fonts_with_source(
            msg,
            body_font_config="Inter:https://fonts.googleapis.com/css2?family=Inter&display=swap",
            code_font_config=None,
            heading_font_config=None,
            section="theme",
        )

        assert updated_msg.body_font == "Inter"
        assert len(updated_msg.font_sources) == 1
        assert updated_msg.font_sources[0].config_name == "font"
        assert (
            updated_msg.font_sources[0].source_url
            == "https://fonts.googleapis.com/css2?family=Inter&display=swap"
        )

    def test_parse_code_font_with_source(self):
        """Test parsing code font with HTTPS source URL."""
        msg = CustomThemeConfig()
        updated_msg = parse_fonts_with_source(
            msg,
            body_font_config=None,
            code_font_config="Tagesschrift:https://fonts.googleapis.com/css2?family=Tagesschrift&display=swap",
            heading_font_config=None,
            section="theme",
        )

        assert updated_msg.code_font == "Tagesschrift"
        assert len(updated_msg.font_sources) == 1
        assert updated_msg.font_sources[0].config_name == "codeFont"
        assert (
            updated_msg.font_sources[0].source_url
            == "https://fonts.googleapis.com/css2?family=Tagesschrift&display=swap"
        )

    def test_parse_heading_font_with_source(self):
        """Test parsing heading font with HTTP source URL."""
        msg = CustomThemeConfig()
        updated_msg = parse_fonts_with_source(
            msg,
            body_font_config=None,
            code_font_config=None,
            heading_font_config="playwrite-cc-za:https://use.typekit.net/eor5wum.css",
            section="theme",
        )

        assert updated_msg.heading_font == "playwrite-cc-za"
        assert len(updated_msg.font_sources) == 1
        assert updated_msg.font_sources[0].config_name == "headingFont"
        assert (
            updated_msg.font_sources[0].source_url
            == "https://use.typekit.net/eor5wum.css"
        )

    def test_parse_font_with_empty_name_raises_exception(self):
        """Test parsing font config with empty name but valid source raises exception."""
        msg = CustomThemeConfig()
        with pytest.raises(StreamlitAPIException) as exc_info:
            parse_fonts_with_source(
                msg,
                body_font_config=":https://fonts.googleapis.com/css2?family=Inter&display=swap",
                code_font_config=None,
                heading_font_config=None,
                section="theme",
            )

        error_message = str(exc_info.value)
        assert (
            "A font family name is required when specifying a source URL for the font property in config.toml."
            in error_message
        )

    def test_parse_fonts_theme_section(self):
        """Test parsing fonts with 'theme' section (default config names)."""
        msg = CustomThemeConfig()
        updated_msg = parse_fonts_with_source(
            msg,
            body_font_config="Inter:https://fonts.googleapis.com/css2?family=Inter&display=swap",
            code_font_config="Roboto:https://fonts.googleapis.com/css2?family=Roboto&display=swap",
            heading_font_config="Bold:https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap",
            section="theme",
        )

        assert len(updated_msg.font_sources) == 3
        config_names = [source.config_name for source in updated_msg.font_sources]
        assert "font" in config_names
        assert "codeFont" in config_names
        assert "headingFont" in config_names

    def test_parse_fonts_theme_sidebar_section(self):
        """Test parsing fonts with 'theme.sidebar' section (sidebar config names)."""
        msg = CustomThemeConfig()
        updated_msg = parse_fonts_with_source(
            msg,
            body_font_config="Inter:https://fonts.googleapis.com/css2?family=Inter&display=swap",
            code_font_config="Roboto:https://fonts.googleapis.com/css2?family=Roboto&display=swap",
            heading_font_config="Bold:https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap",
            section="theme.sidebar",
        )

        assert len(updated_msg.font_sources) == 3
        config_names = [source.config_name for source in updated_msg.font_sources]
        assert "font-sidebar" in config_names
        assert "codeFont-sidebar" in config_names
        assert "headingFont-sidebar" in config_names

    def test_mixed_font_configs(self):
        """Test parsing with mix of font-only and font-with-source configs."""
        msg = CustomThemeConfig()
        updated_msg = parse_fonts_with_source(
            msg,
            body_font_config="Inter",  # No source
            code_font_config="Roboto:https://fonts.googleapis.com/css2?family=Roboto&display=swap",  # With source
            heading_font_config="Bold Font Name",  # No source
            section="theme",
        )

        assert updated_msg.body_font == "Inter"
        assert updated_msg.code_font == "Roboto"
        assert updated_msg.heading_font == "Bold Font Name"
        # Only code font should have a source
        assert len(updated_msg.font_sources) == 1
        assert updated_msg.font_sources[0].config_name == "codeFont"

    def test_body_font_multiple_families_raises_exception(self):
        """Test that multiple fonts in body font source raises StreamlitAPIException."""
        msg = CustomThemeConfig()
        with pytest.raises(StreamlitAPIException) as exc_info:
            parse_fonts_with_source(
                msg,
                body_font_config="Inter:https://fonts.googleapis.com/css2?family=Inter&family=Roboto&display=swap",
                code_font_config=None,
                heading_font_config=None,
                section="theme",
            )

        error_message = str(exc_info.value)
        assert (
            "The source URL specified in the font property of config.toml contains multiple fonts. "
            "Please specify only one font in the source URL." in error_message
        )

    def test_code_font_multiple_families_raises_exception(self):
        """Test that multiple fonts in code font source raises StreamlitAPIException."""
        msg = CustomThemeConfig()
        with pytest.raises(StreamlitAPIException) as exc_info:
            parse_fonts_with_source(
                msg,
                body_font_config=None,
                code_font_config="Roboto:https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Source+Code+Pro&display=swap",
                heading_font_config=None,
                section="theme",
            )

        error_message = str(exc_info.value)
        assert (
            "The source URL specified in the codeFont property of config.toml contains multiple fonts. "
            "Please specify only one font in the source URL." in error_message
        )

    def test_heading_font_multiple_families_raises_exception(self):
        """Test that multiple fonts in heading font source raises StreamlitAPIException."""
        msg = CustomThemeConfig()
        with pytest.raises(StreamlitAPIException) as exc_info:
            parse_fonts_with_source(
                msg,
                body_font_config=None,
                code_font_config=None,
                heading_font_config="Bold:https://fonts.googleapis.com/css2?family=Inter:wght@700&family=Roboto:wght@900&display=swap",
                section="theme",
            )

        error_message = str(exc_info.value)
        assert (
            "The source URL specified in the headingFont property of config.toml contains multiple fonts. "
            "Please specify only one font in the source URL." in error_message
        )

    def test_parse_font_with_multiple_colons_in_url(self):
        """Test parsing font config with multiple colons in the source URL."""
        msg = CustomThemeConfig()
        updated_msg = parse_fonts_with_source(
            msg,
            body_font_config="Inter:https://fonts.googleapis.com:443/css2?family=Inter&display=swap",
            code_font_config=None,
            heading_font_config=None,
            section="theme",
        )

        assert updated_msg.body_font == "Inter"
        assert len(updated_msg.font_sources) == 1
        assert (
            updated_msg.font_sources[0].source_url
            == "https://fonts.googleapis.com:443/css2?family=Inter&display=swap"
        )

    def test_parse_font_whitespace_handling(self):
        """Test parsing font config with whitespace strips whitespace properly."""
        msg = CustomThemeConfig()
        updated_msg = parse_fonts_with_source(
            msg,
            body_font_config="  Inter  :  https://fonts.googleapis.com/css2?family=Inter&display=swap  ",
            code_font_config=None,
            heading_font_config=None,
            section="theme",
        )

        # Function should strip whitespace from font name and URL
        assert updated_msg.body_font == "Inter"
        assert len(updated_msg.font_sources) == 1
        assert (
            updated_msg.font_sources[0].source_url
            == "https://fonts.googleapis.com/css2?family=Inter&display=swap"
        )
