"""Config Util Unittest."""
import copy
import textwrap
import re
import unittest
from unittest.mock import patch

from parameterized import parameterized

from streamlit import config_util
from streamlit import config

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
        self.assertEqual("clean this text", result)

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
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            "Curabitur ac fermentum eros.",
            "Maecenas libero est, ultricies eget ligula eget,",
        ]

        result = config_util._clean_paragraphs(input)
        self.assertEqual(truth, result)

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
