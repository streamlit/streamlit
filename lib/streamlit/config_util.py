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

import copy
import os
import re
import urllib.error
import urllib.request
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import Iterator

from streamlit import cli_util, url_util
from streamlit.config_option import ConfigOption
from streamlit.elements.lib.color_util import is_css_color_like
from streamlit.errors import (
    StreamlitInvalidThemeError,
    StreamlitInvalidThemeOptionError,
    StreamlitInvalidThemeSectionError,
)

# Maximum size for theme files (1MB). Theme files should be small configuration
# files containing only theme options, not large data files.
_MAX_THEME_FILE_SIZE_BYTES = 1024 * 1024  # 1MB


def _get_logger() -> Any:
    """Get logger for this module. Separate function to avoid circular imports."""
    from streamlit.logger import get_logger

    return get_logger(__name__)


def server_option_changed(
    old_options: dict[str, ConfigOption], new_options: dict[str, ConfigOption]
) -> bool:
    """Return True if and only if an option in the server section differs
    between old_options and new_options.
    """
    for opt_name, opt_val in old_options.items():
        if not opt_name.startswith("server"):
            continue

        old_val = opt_val.value
        new_val = new_options[opt_name].value
        if old_val != new_val:
            return True

    return False


def show_config(
    section_descriptions: dict[str, str],
    config_options: dict[str, ConfigOption],
) -> None:
    """Print the given config sections/options to the terminal."""

    out = []
    out.append(
        _clean(
            """
        # Below are all the sections and options you can have in
        ~/.streamlit/config.toml.
    """
        )
    )

    def append_desc(text: str) -> None:
        out.append("# " + cli_util.style_for_cli(text, bold=True))

    def append_comment(text: str) -> None:
        out.append("# " + cli_util.style_for_cli(text))

    def append_section(text: str) -> None:
        out.append(cli_util.style_for_cli(text, bold=True, fg="green"))

    def append_setting(text: str) -> None:
        out.append(cli_util.style_for_cli(text, fg="green"))

    for section in section_descriptions:
        # We inject a fake config section used for unit tests that we exclude here as
        # its options are often missing required properties, which confuses the code
        # below.
        if section == "_test":
            continue

        section_options = {
            k: v
            for k, v in config_options.items()
            if v.section == section and v.visibility == "visible" and not v.is_expired()
        }

        # Only show config header if section is non-empty.
        if len(section_options) == 0:
            continue

        out.append("")
        append_section(f"[{section}]")
        out.append("")

        for option in section_options.values():
            key = option.key.split(".")[-1]
            description_paragraphs = _clean_paragraphs(option.description or "")

            last_paragraph_idx = len(description_paragraphs) - 1

            for i, paragraph in enumerate(description_paragraphs):
                # Split paragraph into lines
                lines = paragraph.rstrip().split(
                    "\n"
                )  # Remove trailing newline characters

                # If the first line is empty, remove it
                if lines and not lines[0].strip():
                    lines = lines[1:]

                # Choose function based on whether it's the first paragraph or not
                append_func = append_desc if i == 0 else append_comment

                # Add comment character to each line and add to out
                for line in lines:
                    append_func(line.lstrip())

                # # Add a line break after a paragraph only if it's not the last paragraph
                if i != last_paragraph_idx:
                    append_comment("")

            if option.deprecated:
                if out[-1] != "#":
                    append_comment("")
                append_comment(
                    cli_util.style_for_cli("THIS IS DEPRECATED.", fg="yellow")
                )
                append_comment("")
                for line in _clean_paragraphs(option.deprecation_text):
                    append_comment(line)
                append_comment("")
                append_comment(
                    f"This option will be removed on or after {option.expiration_date}."
                )

            import toml

            toml_default = toml.dumps({"default": option.default_val})
            toml_default = toml_default[10:].strip()

            if len(toml_default) > 0:
                # Ensure a line break before appending "Default" comment, if not already there
                if out[-1] != "#":
                    append_comment("")
                append_comment(f"Default: {toml_default}")
            else:
                # Don't say "Default: (unset)" here because this branch applies
                # to complex config settings too.
                pass

            option_is_manually_set = (
                option.where_defined != ConfigOption.DEFAULT_DEFINITION
            )

            if option_is_manually_set:
                if out[-1] != "# ":
                    append_comment("")
                append_comment(f"The value below was set in {option.where_defined}")

            toml_setting = toml.dumps({key: option.value})

            if len(toml_setting) == 0:
                toml_setting = f"# {key} =\n"
            elif not option_is_manually_set:
                toml_setting = f"# {toml_setting}"

            append_setting(toml_setting)

    cli_util.print_to_cli("\n".join(out))


def _clean(txt: str) -> str:
    """Replace sequences of multiple spaces with a single space, excluding newlines.

    Preserves leading and trailing spaces, and does not modify spaces in between lines.
    """
    return re.sub(r" +", " ", txt)


def _clean_paragraphs(txt: str) -> list[str]:
    """Split the text into paragraphs, preserve newlines within the paragraphs."""
    # Strip both leading and trailing newlines.
    txt = txt.strip("\n")
    paragraphs = txt.split("\n\n")
    return [
        "\n".join(_clean(line) for line in paragraph.split("\n"))
        for paragraph in paragraphs
    ]


# Theme configuration - theme.base support functions


def _check_color_value(value: Any, option_name: str) -> None:
    """Validate theme color configuration option values.

    Validates that the value is a string (or list of strings, in the case of
    chartCategoricalColors and chartSequentialColors) and is not empty.

    Handles both single color strings (like primaryColor, backgroundColor)
    and arrays of color strings (like chartCategoricalColors, chartSequentialColors).

    Parameters
    ----------
    value : Any
        The color value to validate. Can be a string or list of strings.
    option_name : str
        The name of the theme option being validated (e.g., "theme.primaryColor").

    Raises
    ------
    StreamlitInvalidThemeOptionError
        If the value is not a string/list of strings, is empty, or contains
        empty values in the case of arrays.

    Notes
    -----
    Logs warnings for potentially invalid colors, since more comprehensive
    validation happens on the frontend.
    """
    logger = _get_logger()

    # Handle array color options (chartCategoricalColors, chartSequentialColors)
    if isinstance(value, list):
        if not value:
            raise StreamlitInvalidThemeOptionError(
                f"Theme option '{option_name}' cannot be an empty array"
            )

        for i, color in enumerate(value):
            if not isinstance(color, str):
                raise StreamlitInvalidThemeOptionError(
                    f"Theme option '{option_name}[{i}]' must be a string, got {type(color).__name__}: {color}"
                )

            color_str = color.strip()
            if not color_str:
                raise StreamlitInvalidThemeOptionError(
                    f"Theme option '{option_name}[{i}]' cannot be empty"
                )

            # Lightweight color validation with warning
            if not is_css_color_like(color_str):
                logger.warning(
                    "Theme option '%s[%s]' may be an invalid color: %s. "
                    "Expected formats: hex, rgb, and rgba colors",
                    option_name,
                    i,
                    color_str,
                )

        return  # All colors in array have been checked

    # Handle single color options (primaryColor, backgroundColor, etc.)
    if not isinstance(value, str):
        raise StreamlitInvalidThemeOptionError(
            f"Theme option '{option_name}' must be a string or array of strings, got {type(value).__name__}: {value}"
        )

    value_str: str = value.strip()

    if not value_str:
        raise StreamlitInvalidThemeOptionError(
            f"Theme option '{option_name}' cannot be empty"
        )

    # Lightweight color validation with warning
    if not is_css_color_like(value_str):
        logger.warning(
            "Theme option '%s' may be an invalid color: %s. "
            "Expected formats: hex, rgb, and rgba colors",
            option_name,
            value_str,
        )


def _iterate_theme_config_options(
    config_options: dict[str, ConfigOption],
) -> Iterator[tuple[str, Any]]:
    """
    Iterate through theme config options, yielding (option_path, value) pairs.
    Returns: theme.primaryColor, #ff0000, ...

    Leveraged by _extract_current_theme_config() to retrieve main config.toml theme options.
    """
    for opt_name, opt_val in config_options.items():
        if opt_name.startswith("theme.") and opt_val.value is not None:
            yield opt_name, opt_val.value


def _extract_current_theme_config(
    config_options: dict[str, ConfigOption],
) -> dict[str, Any]:
    """
    Extract current theme configuration from config options.
    Returns a dictionary with the current theme options in nested format.
    """
    current_theme_options = {}

    for opt_name, opt_value in _iterate_theme_config_options(config_options):
        parts = opt_name.split(".")
        if len(parts) == 2:  # theme.option
            _, option = parts
            if option != "base":  # Don't include the base option itself
                current_theme_options[option] = opt_value
        elif len(parts) == 3:  # theme.sidebar.option or theme.light.option
            _, section, option = parts
            if section not in current_theme_options:
                current_theme_options[section] = {}
            current_theme_options[section][option] = opt_value
        elif len(parts) == 4:  # theme.light.sidebar.option or theme.dark.sidebar.option
            _, section, subsection, option = parts
            if section not in current_theme_options:
                current_theme_options[section] = {}
            if subsection not in current_theme_options[section]:
                current_theme_options[section][subsection] = {}
            current_theme_options[section][subsection][option] = opt_value

    return current_theme_options


def _get_valid_theme_options(
    config_options_template: dict[str, ConfigOption],
) -> tuple[set[str], set[str]]:
    """Get valid theme configuration options for main theme and theme sections.

    Extracts valid theme options from the config options template to ensure they
    stay in sync with the actual theme options defined via _create_theme_options() calls.

    Parameters
    ----------
    config_options_template : dict[str, ConfigOption]
        Template of all available configuration options.

    Returns
    -------
    tuple[set[str], set[str]]
        A tuple (main_theme_options, section_theme_options) where:
        - main_theme_options: Valid theme options for the main theme (without "theme." prefix)
        - section_theme_options: Valid theme options for sections/subsections
          (sidebar, light, dark, light.sidebar, dark.sidebar)

    Notes
    -----
    All non-main theme sections have the same valid options, so we only need to
    extract them once.
    """
    # Extract options dynamically from the config template
    main_theme_options = set()
    section_theme_options = set()

    # Extract theme options from the config template
    for option_key in config_options_template:
        if option_key.startswith("theme."):
            parts = option_key.split(".")
            # Direct theme options like "theme.primaryColor"
            if parts[0] == "theme" and len(parts) == 2:
                _, option_name = parts
                main_theme_options.add(option_name)
            # Subsection options like "theme.sidebar.primaryColor"
            elif parts[0] == "theme" and parts[1] == "sidebar" and len(parts) == 3:
                # All subsections (sidebar, light, dark, light.sidebar, dark.sidebar)
                # get the same options as theme.sidebar (which excludes main-only options)
                _, _, option_name = parts
                section_theme_options.add(option_name)

    return main_theme_options, section_theme_options


def _invalid_theme_option_warning(
    option_name: str,
    file_path_or_url: str,
    valid_options: set[str],
    section_name: str = "theme",
) -> None:
    """Helper function to log a warning for an invalid theme option."""

    if section_name == "theme":
        full_option_name = f"{section_name}.{option_name}"
    else:
        # Handle sections like "sidebar" -> "theme.sidebar.{option_name}"
        # or subsections like "light.sidebar" -> "theme.light.sidebar.{option_name}"
        full_option_name = f"theme.{section_name}.{option_name}"

    valid_options_list = "\n".join(f"  • {opt}" for opt in sorted(valid_options))
    _get_logger().warning(
        "Theme file %s contains invalid theme option: '%s'.\n\n"
        "Valid '%s' options are:\n%s",
        file_path_or_url,
        full_option_name,
        section_name,
        valid_options_list,
    )


def _validate_theme_section_recursive(
    section_configs: dict[str, Any],
    section_path: str,
    file_path_or_url: str,
    section_options: set[str],
    filtered_parent: dict[str, Any],
    allow_sidebar_subsection: bool = False,
) -> None:
    """Recursively validate a theme section and its subsection/options.

    Parameters
    ----------
    section_configs : dict[str, Any]
        The section configs to validate.
    section_path : str
        Path like 'sidebar', 'light', 'light.sidebar'.
    file_path_or_url : str
        Theme file path for error messages.
    section_options : set[str]
        Valid options for this section.
    filtered_parent : dict[str, Any]
        Parent section to populate/filter out invalid options.
    allow_sidebar_subsection : bool, optional
        Allow sidebar subsection (only "light" and "dark" sections), by default False.

    Raises
    ------
    StreamlitInvalidThemeSectionError
        If an invalid subsection is found.
    """
    for option_name, option_value in section_configs.items():
        if isinstance(option_value, dict):
            # This is a subsection
            if not allow_sidebar_subsection or option_name != "sidebar":
                raise StreamlitInvalidThemeSectionError(
                    f"theme.{section_path}.{option_name}",
                    file_path_or_url,
                )

            # Create and validate the subsection's options
            if option_name not in filtered_parent:
                filtered_parent[option_name] = {}

            _validate_theme_section_recursive(
                option_value,
                f"{section_path}.{option_name}",
                file_path_or_url,
                section_options,
                filtered_parent[option_name],
                False,  # sidebar subsection can't have further subsections
            )
        elif option_name not in section_options:
            # This is an invalid section option
            _invalid_theme_option_warning(
                option_name,
                file_path_or_url,
                section_options,
                section_path,
            )
            # Remove the invalid option from the filtered theme
            filtered_parent.pop(option_name, None)
        else:
            # Valid option - add to filtered theme and check color values
            filtered_parent[option_name] = option_value
            full_option_name = f"theme.{section_path}.{option_name}"
            if "color" in full_option_name.lower():
                _check_color_value(option_value, full_option_name)


def _validate_theme_file_content(
    theme_content: dict[str, Any],
    file_path_or_url: str,
    config_options_template: dict[str, ConfigOption],
) -> dict[str, Any]:
    """
    Validate that a theme file contains only valid theme sections and config options.

    If invalid sections are found in the theme file, a StreamlitInvalidThemeSectionError is raised.

    If invalid config options are found in the theme file, a warning is logged with the valid
    options for the given section.

    Returns
    -------
        A filtered copy of the theme content with invalid options removed.
    """
    # Get valid options for each type of section
    valid_main_options, valid_section_options = _get_valid_theme_options(
        config_options_template
    )
    # Valid theme sections
    valid_sections = {"sidebar", "light", "dark"}

    theme_section = theme_content.get("theme", {})

    # Create a filtered copy of the theme content
    filtered_theme = copy.deepcopy(theme_content)
    filtered_theme_section = filtered_theme.get("theme", {})

    # Validate theme options
    for option_name, option_value in theme_section.items():
        # This is a section like theme.sidebar, theme.light, theme.dark
        if isinstance(option_value, dict):
            # Invalid section: raise error
            if option_name not in valid_sections:
                raise StreamlitInvalidThemeSectionError(
                    option_name,
                    file_path_or_url,
                )

            # Create the section in our filtered theme and validate it
            if option_name not in filtered_theme_section:
                filtered_theme_section[option_name] = {}

            # Subsection can only be sidebar from within light and dark sections
            allow_sidebar_subsection = option_name in {"light", "dark"}

            _validate_theme_section_recursive(
                option_value,
                option_name,
                file_path_or_url,
                valid_section_options,
                filtered_theme_section[option_name],
                allow_sidebar_subsection,
            )

        elif option_name not in valid_main_options:
            # Invalid main theme option
            _invalid_theme_option_warning(
                option_name,
                file_path_or_url,
                valid_main_options,
            )
            # Remove the invalid option from the filtered theme
            filtered_theme_section.pop(option_name, None)

        else:
            # Valid main theme option - if color config, check color value
            full_option_name = f"theme.{option_name}"
            if "color" in full_option_name.lower():
                _check_color_value(option_value, full_option_name)

    return filtered_theme


def _load_theme_file(
    file_path_or_url: str, config_options_template: dict[str, ConfigOption]
) -> dict[str, Any]:
    """
    Load and parse a theme TOML file from a local path or URL.

    Handles raising errors when a file cannot be found, read, parsed,
    or contains invalid theme options.

    Otherwise returns the parsed TOML content as a dictionary.
    """

    def _raise_missing_toml() -> None:
        raise StreamlitInvalidThemeError(
            "The 'toml' package is required to load theme files. "
            "Please install it with 'pip install toml'."
        )

    def _raise_file_not_found() -> None:
        raise FileNotFoundError(f"Theme file not found: {file_path_or_url}")

    def _raise_missing_theme_section() -> None:
        raise StreamlitInvalidThemeSectionError(
            f"Theme file {file_path_or_url} must contain a [theme] section"
        )

    def _raise_file_too_large() -> None:
        content_size = len(content.encode("utf-8"))
        raise StreamlitInvalidThemeError(
            f"Theme file {file_path_or_url} is too large ({content_size:,} bytes). "
            f"Maximum allowed size is {_MAX_THEME_FILE_SIZE_BYTES:,} bytes (1MB). "
            f"Theme files should contain only configuration options, not large data."
        )

    try:
        import toml
    except ImportError:
        _raise_missing_toml()

    # Check if it's a URL using the url_util helper (only allow http/https schemes by default)
    is_valid_url = url_util.is_url(file_path_or_url)

    try:
        if is_valid_url:
            # Load from URL - noqa: S310 suppressed since url_util.is_url() restricts to only
            # http/https schemes by default, preventing file:// or other dangerous schemes
            # 30-second timeout prevents hanging in poor network conditions (same as cli.py)
            with urllib.request.urlopen(file_path_or_url, timeout=30) as response:  # noqa: S310
                content = response.read().decode("utf-8")
        else:
            # Load from local file path
            # Resolve relative paths from the current working directory
            if not os.path.isabs(file_path_or_url):
                file_path_or_url = os.path.join(os.getcwd(), file_path_or_url)

            if not os.path.exists(file_path_or_url):
                _raise_file_not_found()

            with open(file_path_or_url, encoding="utf-8") as f:
                content = f.read()

        # Check file size limit - theme files should be small configuration files
        content_size = len(content.encode("utf-8"))
        if content_size > _MAX_THEME_FILE_SIZE_BYTES:
            _raise_file_too_large()

        # Parse the TOML content
        parsed_theme = toml.loads(content)  # ty: ignore[possibly-unresolved-reference]

        # Validate that the theme file has a theme section
        if "theme" not in parsed_theme:
            _raise_missing_theme_section()

        # Validate that the theme file contains only valid theme options, filtering out invalid ones
        filtered_theme = _validate_theme_file_content(
            parsed_theme, file_path_or_url, config_options_template
        )

        return filtered_theme

    except (
        StreamlitInvalidThemeError,
        StreamlitInvalidThemeOptionError,
        StreamlitInvalidThemeSectionError,
        FileNotFoundError,
    ):
        # Re-raise these specific exceptions
        raise
    except urllib.error.URLError as e:
        raise StreamlitInvalidThemeError(
            f"Could not load theme file from URL {file_path_or_url}: {e}"
        ) from e
    except Exception as e:
        raise StreamlitInvalidThemeError(
            f"Error loading theme file {file_path_or_url}: {e}"
        ) from e


def _deep_merge_theme_dicts(
    base_dict: dict[str, Any], override_dict: dict[str, Any]
) -> dict[str, Any]:
    """
    Recursively merge two dictionaries, with override_dict values taking precedence.
    Handles arbitrary levels of nesting for theme configurations.
    """
    merged = copy.deepcopy(base_dict)

    for key, value in override_dict.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            # Both base and override have dict values for this key, merge recursively
            merged[key] = _deep_merge_theme_dicts(merged[key], value)
        else:
            # Override value takes precedence (either new key or non-dict value)
            merged[key] = copy.deepcopy(value)

    return merged


def _apply_theme_inheritance(
    base_theme: dict[str, Any], override_theme: dict[str, Any]
) -> dict[str, Any]:
    """
    Apply theme inheritance where theme config values from config.toml
    take precedence over the theme configs defined in theme.base toml file.

    Returns a dictionary with the merged theme configuration.
    """
    return _deep_merge_theme_dicts(base_theme, override_theme)


def _set_theme_options_recursive(
    options_dict: dict[str, Any], prefix: str, set_option_func: Any, source: str
) -> None:
    """
    Recursively set theme options from nested dictionary in process_theme_inheritance().
    This utility function traverses nested theme configuration sections/subsection
    and sets each option using the provided set_option_func.
    """
    for option_name, option_value in options_dict.items():
        if option_name == "base" and prefix == "theme":
            # Base is handled separately in theme inheritance
            continue

        current_key = f"{prefix}.{option_name}" if prefix else option_name

        if isinstance(option_value, dict):
            # Recursively handle nested sections
            _set_theme_options_recursive(
                option_value, current_key, set_option_func, source
            )
        else:
            # Set the actual config option
            set_option_func(current_key, option_value, source)


# Theme configuration - handles theme.base


def process_theme_inheritance(
    config_options: dict[str, ConfigOption] | None,
    config_options_template: dict[str, ConfigOption],
    set_option_func: Any,
) -> None:
    """
    Process theme inheritance if theme.base points to a theme file.

    This function checks if theme.base is set to a file path or URL,
    loads the theme file, and applies inheritance logic where the
    current config.toml values override the theme.base file values.

    Sets the merged theme options to the config.
    """
    # Get the current theme.base value
    if config_options is None:
        return

    base_option = config_options.get("theme.base")
    if not base_option or base_option.value is None:
        return

    base_value = base_option.value

    # Check if it's a file path or URL (not just "light" or "dark")
    if base_value in {"light", "dark"}:
        return

    def _raise_invalid_nested_base() -> None:
        raise StreamlitInvalidThemeError(
            f"Theme file {base_value} cannot reference another theme file in its base property. "
            f"Only 'light' and 'dark' are allowed in referenced theme files."
        )

    try:
        # Load the theme file config options
        theme_file_content = _load_theme_file(base_value, config_options_template)

        # Validate that theme.base of the referenced theme file doesn't reference another file
        theme_base = theme_file_content.get("theme", {}).get("base")
        if theme_base and theme_base not in {"light", "dark"}:
            _raise_invalid_nested_base()

        # Get current theme options from main config.toml
        current_theme_options = (
            _extract_current_theme_config(config_options) if config_options else {}
        )

        # Apply inheritance: referenced theme file as base, override with theme options specified in config.toml
        merged_theme = _apply_theme_inheritance(
            theme_file_content, {"theme": current_theme_options}
        )

        # Preserve theme options set by env vars and command line flags (higher precedence)
        high_precedence_theme_options = {}
        if config_options is not None:
            for opt_name, opt_config in config_options.items():
                if (
                    opt_name.startswith("theme.")
                    and opt_name != "theme.base"
                    and opt_config.where_defined
                    in {
                        "environment variable",
                        "command-line argument or environment variable",
                    }
                ):
                    high_precedence_theme_options[opt_name] = {
                        "value": opt_config.value,
                        "where_defined": opt_config.where_defined,
                    }

            # Clear existing theme options (except base) to prepare for inheritance
            theme_options_to_remove = [
                opt_name
                for opt_name in config_options
                if opt_name.startswith("theme.") and opt_name != "theme.base"
            ]
            for opt_name in theme_options_to_remove:
                set_option_func(opt_name, None, "reset for theme inheritance")

        # Handle theme.base - always set it to a valid value ("light" or "dark", not a path/URL)
        theme_file_base = theme_file_content.get("theme", {}).get("base")
        if theme_file_base:
            set_option_func("theme.base", theme_file_base, f"theme file: {base_value}")
        else:
            # Theme file doesn't specify a base, default to "light"
            set_option_func(
                "theme.base", "light", f"theme file: {base_value} (default)"
            )

        # Set the merged theme options using recursive helper
        theme_section = merged_theme.get("theme", {})
        _set_theme_options_recursive(
            theme_section, "theme", set_option_func, f"theme file: {base_value}"
        )

        # Finally, restore theme options set by env vars and command line flags (highest precedence)
        for opt_name, opt_data in high_precedence_theme_options.items():
            set_option_func(opt_name, opt_data["value"], opt_data["where_defined"])

    except (
        StreamlitInvalidThemeError,
        StreamlitInvalidThemeOptionError,
        StreamlitInvalidThemeSectionError,
        FileNotFoundError,
    ):
        # Re-raise expected user errors as-is to preserve specific error messages
        raise
    except Exception as e:
        _get_logger().exception("Error processing theme inheritance")
        # Only wrap unexpected errors (not our specific validation errors)
        raise StreamlitInvalidThemeError(
            f"Failed to process theme inheritance from {base_value}: {e}"
        ) from e
