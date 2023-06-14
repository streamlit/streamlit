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

"""Config Util Unittest."""
import copy
import re
import textwrap
import unittest
from unittest.mock import patch

from parameterized import parameterized

from streamlit import config, config_util
from streamlit.config_option import ConfigOption

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
        self.assertEqual(" clean this text ", result)

    def test_clean_empty_string(self):
        result = config_util._clean("")
        self.assertEqual("", result)

    def test_clean_paragraphs(self):
        # from https://www.lipsum.com/
        input = textwrap.dedent(
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

        result = config_util._clean_paragraphs(input)
        self.assertEqual(truth, result)

    def test_clean_paragraphs_empty_string(self):
        result = config_util._clean_paragraphs("")
        self.assertEqual([""], result)

    @patch("streamlit.config_util.click.echo")
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

    @patch("streamlit.config_util.click.echo")
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
        self.assertEqual(
            config_util.server_option_changed(old_options, new_options), changed
        )

    @patch("streamlit.config_util.click.echo")
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

    @patch("streamlit.config_util.click.echo")
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

        assert (
            description_index > 1
        ), "Description should not be at the start of the output"
        assert (
            lines[description_index - 1].strip() == ""
        ), "Preceding line should be empty (this line separates config options)"
        assert (
            lines[description_index - 2].strip() != ""
        ), "The line before the preceding line should not be empty (this is the section header)"

    @patch("streamlit.config_util.click.echo")
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
        self.assertLess(description_index, option_index)

    @patch("streamlit.config_util.click.echo")
    def test_show_config_section_formatting(self, patched_echo):
        config_options = create_config_options({"server.address": "localhost"})
        config_util.show_config(CONFIG_SECTION_DESCRIPTIONS, config_options)

        [(args, _)] = patched_echo.call_args_list
        output = re.compile(r"\x1b[^m]*m").sub("", args[0])
        lines = output.split("\n")

        self.assertIn("[server]", lines)

    @patch("streamlit.config_util.click.echo")
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

        self.assertNotIn("# This is a hidden option.", lines)
