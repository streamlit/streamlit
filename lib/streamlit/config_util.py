# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import re
from typing import Dict

import click
import toml

from streamlit.config_option import ConfigOption


def server_option_changed(
    old_options: Dict[str, ConfigOption], new_options: Dict[str, ConfigOption]
) -> bool:
    """Return True if and only if an option in the server section differs
    between old_options and new_options.
    """
    for opt_name in old_options.keys():
        if not opt_name.startswith("server"):
            continue

        old_val = old_options[opt_name].value
        new_val = new_options[opt_name].value
        if old_val != new_val:
            return True

    return False


def show_config(
    section_descriptions: Dict[str, str],
    config_options: Dict[str, ConfigOption],
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

    def append_desc(text):
        out.append("# " + click.style(text, bold=True))

    def append_comment(text):
        out.append("# " + click.style(text))

    def append_section(text):
        out.append(click.style(text, bold=True, fg="green"))

    def append_setting(text):
        out.append(click.style(text, fg="green"))

    for section, section_description in section_descriptions.items():
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
        append_section("[%s]" % section)
        out.append("")

        for key, option in section_options.items():
            key = option.key.split(".")[1]
            description_paragraphs = _clean_paragraphs(option.description)

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
                    out.append("")

            toml_default = toml.dumps({"default": option.default_val})
            toml_default = toml_default[10:].strip()

            if len(toml_default) > 0:
                # Ensure a line break before appending "Default" comment, if not already there
                if out[-1] != "":
                    out.append("")
                append_comment("Default: %s" % toml_default)
            else:
                # Don't say "Default: (unset)" here because this branch applies
                # to complex config settings too.
                pass

            if option.deprecated:
                append_comment(click.style("DEPRECATED.", fg="yellow"))
                for line in _clean_paragraphs(option.deprecation_text):
                    append_comment(line)
                append_comment(
                    "This option will be removed on or after %s."
                    % option.expiration_date
                )

            option_is_manually_set = (
                option.where_defined != ConfigOption.DEFAULT_DEFINITION
            )

            if option_is_manually_set:
                append_comment("The value below was set in %s" % option.where_defined)

            toml_setting = toml.dumps({key: option.value})

            if len(toml_setting) == 0:
                toml_setting = f"# {key} =\n"
            elif not option_is_manually_set:
                toml_setting = f"# {toml_setting}"

            append_setting(toml_setting)

    click.echo("\n".join(out))


def _clean(txt):
    """Replace sequences of multiple spaces with a single space, excluding newlines.

    Preserves leading and trailing spaces, and does not modify spaces in between lines.
    """
    return re.sub(" +", " ", txt)


def _clean_paragraphs(txt):
    """Split the text into paragraphs, preserve newlines within the paragraphs."""
    # Strip both leading and trailing newlines.
    txt = txt.strip("\n")
    paragraphs = txt.split("\n\n")
    cleaned_paragraphs = [
        "\n".join(_clean(line) for line in paragraph.split("\n"))
        for paragraph in paragraphs
    ]
    return cleaned_paragraphs
