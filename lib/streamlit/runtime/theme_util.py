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

from typing import TYPE_CHECKING

from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    from streamlit.proto.NewSession_pb2 import CustomThemeConfig


def parse_fonts_with_source(
    msg: CustomThemeConfig,
    body_font_config: str | None,
    code_font_config: str | None,
    heading_font_config: str | None,
    section: str,
) -> CustomThemeConfig:
    """Populate the CustomThemeConfig message with the font, codeFont, and headingFont fields set,
    as well as the font_sources field to be added to the html head.

    Args:
        msg: CustomThemeConfig message to be populated.
        body_font_config: A string with just the font name (e.g., "Inter") or in the format
            "<font_family_name_here>:<source_url_here>".
        code_font_config: A string with just the font name (e.g., "Roboto Mono") or in the format
            "<code_font_family_name_here>:<source_url_here>".
        heading_font_config: A string with just the font name (e.g., "Inter Bold") or in the format
            "<heading_font_family_name_here>:<source_url_here>".
        section: The section of the config.toml file to parse the fonts from.

    Examples
    --------
    body_font_config: "Inter" (just font name)
    code_font_config: "Tagesschrift:https://fonts.googleapis.com/css2?family=Tagesschrift&display=swap" (with source)
    heading_font_config: "playwrite-cc-za:https://use.typekit.net/xxs7euo.css"

    Returns
    -------
        Updated CustomThemeConfig message with the font, codeFont, and headingFont fields set.
        Also sets sources in font_sources field to be added to the html (only when source URLs are provided).
    """

    if body_font_config:
        # If no source is specified (no colon), just use the font name.
        # Otherwise, split the font theme config on the colon. Before the first colon should be the font family name,
        # and after the first colon should be the source URL.

        if ":" in body_font_config:
            # Note: it is possible there are multiple colons in the string, so we need to split on the first colon.
            body_font, body_source = body_font_config.split(":", 1)
            # Also, we attempt to check that the href does not contain multiple fonts, so we confirm that "family="
            # only shows up once in the source string (structure applies to Google Fonts only)
            body_family_occurances = body_source.count("family=")
            if body_family_occurances > 1:
                raise StreamlitAPIException(
                    "The source URL specified in the font property of config.toml contains multiple fonts. "
                    "Please specify only one font in the source URL."
                )

            if body_font:
                # Since the font field uses the deprecated enum, we need to put the font
                # config into the body_font field instead:
                msg.body_font = body_font
            # If the source is a valid URL (http/https), add it to the font_sources field to be added to the html head
            if body_source.startswith("http"):
                config_name = "font" if section == "theme" else "font-sidebar"
                msg.font_sources.add(config_name=config_name, source_url=body_source)
        else:
            # No colon found, treat the entire string as the font name
            msg.body_font = body_font_config

    if code_font_config:
        if ":" in code_font_config:
            code_font, code_source = code_font_config.split(":", 1)
            code_family_occurances = code_source.count("family=")
            if code_family_occurances > 1:
                raise StreamlitAPIException(
                    "The source URL specified in the codeFont property of config.toml contains multiple fonts. "
                    "Please specify only one font in the source URL."
                )

            if code_font:
                msg.code_font = code_font
            if code_source.startswith("http"):
                config_name = "codeFont" if section == "theme" else "codeFont-sidebar"
                msg.font_sources.add(config_name=config_name, source_url=code_source)
        else:
            # No colon found, treat the entire string as the font name
            msg.code_font = code_font_config

    if heading_font_config:
        if ":" in heading_font_config:
            heading_font, heading_source = heading_font_config.split(":", 1)
            heading_family_occurances = heading_source.count("family=")
            if heading_family_occurances > 1:
                raise StreamlitAPIException(
                    "The source URL specified in the headingFont property of config.toml contains multiple fonts. "
                    "Please specify only one font in the source URL."
                )

            if heading_font:
                msg.heading_font = heading_font
            if heading_source.startswith("http"):
                config_name = (
                    "headingFont" if section == "theme" else "headingFont-sidebar"
                )
                msg.font_sources.add(config_name=config_name, source_url=heading_source)
        else:
            # No colon found, treat the entire string as the font name
            msg.heading_font = heading_font_config

    return msg
