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

from typing import TYPE_CHECKING

from streamlit.errors import StreamlitAPIException
from streamlit.url_util import is_url

if TYPE_CHECKING:
    from streamlit.proto.NewSession_pb2 import CustomThemeConfig


def _parse_font_config(
    font_config: str | None,
    property_name: str,
) -> tuple[str, str | None]:
    """Parse a single font configuration string.

    Args:
        font_config: The font configuration string (e.g., "Inter" or "Inter:https://...")
        property_name: The property name for error messages ("font", "codeFont", "headingFont")

    Returns
    -------
        A tuple of (font_name, source_url). source_url is None if not provided or not valid.
    """
    if not font_config:
        return "", None

    # Strip leading/trailing whitespace from the config
    font_config = font_config.strip()

    if ":" not in font_config:
        # No colon found, treat the entire string as the font name
        return font_config, None

    # Note: it is possible there are multiple colons in the string, so we need to split on the first colon.
    font_name, source_url = font_config.split(":", 1)
    # Strip whitespace from both font name and source
    font_name = font_name.strip()
    source_url = source_url.strip()

    # Check that the href does not contain multiple fonts, so we confirm that "family="
    # only shows up once in the source string (structure applies to Google Fonts only)
    family_occurrences = source_url.count("family=")
    if family_occurrences > 1:
        raise StreamlitAPIException(
            f"The source URL specified in the {property_name} property of config.toml contains multiple fonts. "
            "Please specify only one font in the source URL."
        )

    is_valid_url = is_url(source_url)

    # If the source is a valid URL (http/https) but no font name is provided, throw an exception
    if is_valid_url and not font_name:
        raise StreamlitAPIException(
            f"A font family name is required when specifying a source URL "
            f"for the {property_name} property in config.toml."
        )

    if is_valid_url:
        return font_name, source_url

    return font_name, None


def _get_font_source_config_name(property_name: str, section: str) -> str:
    """Get the config name for font sources based on property and section. This is used on the FE
    as the id for the font source link in the html head.
    """
    if section == "theme":
        return property_name
    return f"{property_name}-sidebar"


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

    # Parse body font config
    body_font_name, body_font_source = _parse_font_config(body_font_config, "font")
    if body_font_name:
        msg.body_font = body_font_name
    if body_font_source:
        config_name = _get_font_source_config_name("font", section)
        msg.font_sources.add(config_name=config_name, source_url=body_font_source)

    # Parse code font config
    code_font_name, code_font_source = _parse_font_config(code_font_config, "codeFont")
    if code_font_name:
        msg.code_font = code_font_name
    if code_font_source:
        config_name = _get_font_source_config_name("codeFont", section)
        msg.font_sources.add(config_name=config_name, source_url=code_font_source)

    # Parse heading font config
    heading_font_name, heading_font_source = _parse_font_config(
        heading_font_config, "headingFont"
    )
    if heading_font_name:
        msg.heading_font = heading_font_name
    if heading_font_source:
        config_name = _get_font_source_config_name("headingFont", section)
        msg.font_sources.add(config_name=config_name, source_url=heading_font_source)

    return msg
