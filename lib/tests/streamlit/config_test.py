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

"""Config System Unittest."""

from __future__ import annotations

import copy
import os
import sys
import tempfile
import textwrap
import unittest
from contextlib import contextmanager
from unittest.mock import MagicMock, mock_open, patch

import pytest
from parameterized import parameterized

from streamlit import config, config_util, env_util
from streamlit.config import CustomThemeCategories, ShowErrorDetailsConfigOptions
from streamlit.config_option import ConfigOption
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitInvalidThemeError,
    StreamlitInvalidThemeSectionError,
)

SECTION_DESCRIPTIONS = copy.deepcopy(config._section_descriptions)
CONFIG_OPTIONS = copy.deepcopy(config._config_options)


class ConfigTest(unittest.TestCase):
    """Test the config system."""

    def setUp(self):
        self.patches = [
            patch.object(
                config, "_section_descriptions", new=copy.deepcopy(SECTION_DESCRIPTIONS)
            ),
            patch.object(config, "_config_options", new=copy.deepcopy(CONFIG_OPTIONS)),
            patch.dict(os.environ),
        ]

        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

        config._delete_option("_test.tomlTest")

    def _create_theme_config_options(self):
        """Create a list of the valid config options for the [theme] section."""
        valid_general_config_options = self._create_subsection_config_options("theme")

        # Config option valid only for the [theme] section
        # Add option here if it is only allowed in the [theme] section
        valid_theme_only_config_options = [
            "base",
            "baseFontSize",
            "baseFontWeight",
            "fontFaces",
            "showSidebarBorder",
            "chartCategoricalColors",
            "chartSequentialColors",
        ]

        theme_config_options = [
            *valid_general_config_options,
        ]
        for option in valid_theme_only_config_options:
            theme_config_options.append(f"theme.{option}")

        return theme_config_options

    def _create_subsection_config_options(self, section: str):
        """Create a list of the valid config options for a subsection of the theme section."""

        # Valid config options for subsections
        # Add config option here if it is allowed in any section
        valid_section_config_options = [
            "primaryColor",
            "backgroundColor",
            "secondaryBackgroundColor",
            "textColor",
            "baseRadius",
            "buttonRadius",
            "font",
            "headingFont",
            "codeFont",
            "codeFontSize",
            "codeFontWeight",
            "headingFontSizes",
            "headingFontWeights",
            "borderColor",
            "dataframeBorderColor",
            "showWidgetBorder",
            "linkColor",
            "linkUnderline",
            "codeTextColor",
            "codeBackgroundColor",
            "dataframeHeaderBackgroundColor",
            "redColor",
            "orangeColor",
            "yellowColor",
            "blueColor",
            "greenColor",
            "violetColor",
            "grayColor",
            "redBackgroundColor",
            "orangeBackgroundColor",
            "yellowBackgroundColor",
            "blueBackgroundColor",
            "greenBackgroundColor",
            "violetBackgroundColor",
            "grayBackgroundColor",
            "redTextColor",
            "orangeTextColor",
            "yellowTextColor",
            "blueTextColor",
            "greenTextColor",
            "violetTextColor",
            "grayTextColor",
        ]

        section_config_options = []
        if section != "theme":
            section = f"theme.{section}"
        for option in valid_section_config_options:
            section_config_options.append(f"{section}.{option}")

        return section_config_options

    def test_set_user_option_scriptable(self):
        """Test that scriptable options can be set from API."""
        # This is set in lib/tests/conftest.py to off
        assert (
            config.get_option("client.showErrorDetails")
            == ShowErrorDetailsConfigOptions.FULL
        )

        try:
            # client.showErrorDetails can be set after run starts.
            config.set_user_option(
                "client.showErrorDetails", ShowErrorDetailsConfigOptions.STACKTRACE
            )
            assert (
                config.get_option("client.showErrorDetails")
                == ShowErrorDetailsConfigOptions.STACKTRACE
            )
        finally:
            # Restore original value
            config.set_user_option(
                "client.showErrorDetails", ShowErrorDetailsConfigOptions.FULL
            )

    def test_set_user_option_unscriptable(self):
        """Test that unscriptable options cannot be set with st.set_option."""
        # This is set in lib/tests/conftest.py to off
        assert config.get_option("server.enableCORS")

        with pytest.raises(StreamlitAPIException):
            config.set_user_option("server.enableCORS", False)

    def test_simple_config_option(self):
        """Test creating a simple (constant) config option."""
        # Create the config option.
        config_option = ConfigOption(
            "_test.simpleParam", description="Simple config option.", default_val=12345
        )

        # Test that it works.
        assert config_option.key == "_test.simpleParam"
        assert config_option.section == "_test"
        assert config_option.name == "simpleParam"
        assert config_option.description == "Simple config option."
        assert config_option.where_defined == ConfigOption.DEFAULT_DEFINITION
        assert config_option.value == 12345
        assert config_option.env_var == "STREAMLIT__TEST_SIMPLE_PARAM"
        assert not config_option.multiple

    def test_multiple_config_option(self):
        """Test creating a multiple value config option."""
        config_option = ConfigOption(
            "_test.simpleParam",
            description="Simple config option.",
            default_val=[12345],
            multiple=True,
        )

        assert config_option.key == "_test.simpleParam"
        assert config_option.section == "_test"
        assert config_option.name == "simpleParam"
        assert config_option.description == "Simple config option."
        assert config_option.where_defined == ConfigOption.DEFAULT_DEFINITION
        assert config_option.value == [12345]
        assert config_option.env_var == "STREAMLIT__TEST_SIMPLE_PARAM"
        assert config_option.multiple

    def test_complex_config_option(self):
        """Test setting a complex (functional) config option."""

        # Create the config option.
        @ConfigOption("_test.complexParam")
        def config_option():
            """Complex config option."""
            return 12345

        # Test that it works.
        assert config_option.key == "_test.complexParam"
        assert config_option.section == "_test"
        assert config_option.name == "complexParam"
        assert config_option.description == "Complex config option."
        assert config_option.where_defined == ConfigOption.DEFAULT_DEFINITION
        assert config_option.value == 12345
        assert config_option.env_var == "STREAMLIT__TEST_COMPLEX_PARAM"

    def test_complex_config_option_must_have_doc_strings(self):
        """Test that complex config options use funcs with doc stringsself.

        This is because the doc string forms the option's description.
        """
        with pytest.raises(
            RuntimeError,
            match=r"Complex config options require doc strings for their description.",
        ):

            @ConfigOption("_test.noDocString")
            def no_doc_string():
                pass

    def test_invalid_config_name(self):
        """Test setting an invalid config section."""
        with pytest.raises(
            ValueError,
            match=r'Key "_test.myParam." has invalid format.',
        ):
            ConfigOption("_test.myParam.")

    def test_invalid_config_section(self):
        """Test setting an invalid config section."""
        with pytest.raises(RuntimeError):
            config._create_option("mySection.myParam")

    def test_cannot_overwrite_config_section(self):
        """Test overwriting a config section using _create_section."""
        with pytest.raises(
            RuntimeError,
            match=r'Cannot define section "_test2" twice.',
        ):
            config._create_section("_test2", "A test section.")
            config._create_section("_test2", "A test section.")

    def test_cannot_overwrite_config_key(self):
        """Test overwriting a config option using _create_option."""
        with pytest.raises(
            RuntimeError,
            match=r'Cannot define option "_test.overwriteKey" twice.',
        ):
            config._create_option("_test.overwriteKey")
            config._create_option("_test.overwriteKey")

    def test_param_names_are_camel_case(self):
        """Test that param names must be camelCase.

        Note the exception is the "_test" section which is used
        for unit testing.
        """
        with pytest.raises(
            ValueError,
            match=r'Key "_test.snake_case" has invalid format.',
        ):
            config._create_option("_test.snake_case")

    def test_get_set_and_complex_config_options(self):
        """Verify that changing one option changes another, dependent one.

        This also implicitly tests simple and complex ConfigOptions as well as
        get_option() and set_option().
        """
        # Some useful variables.
        DUMMY_VAL_1, DUMMY_VAL_2, DUMMY_VAL_3 = "Steven", "Vincent", "Buscemi"

        # Set up both options.
        config._create_option(
            "_test.independentOption",
            description="This option can change at will",
            default_val=DUMMY_VAL_1,
        )

        @config._create_option("_test.dependentOption")
        def _test_dependent_option():
            """Depend on the value of _test.independentOption."""
            return config.get_option("_test.independentOption")

        config.get_config_options(force_reparse=True)

        # Check that the default values are good.
        assert config.get_option("_test.independentOption") == DUMMY_VAL_1
        assert config.get_option("_test.dependentOption") == DUMMY_VAL_1
        assert (
            config.get_where_defined("_test.independentOption")
            == ConfigOption.DEFAULT_DEFINITION
        )
        assert (
            config.get_where_defined("_test.dependentOption")
            == ConfigOption.DEFAULT_DEFINITION
        )

        # Override the independent option. Both update!
        config.set_option("_test.independentOption", DUMMY_VAL_2)
        assert config.get_option("_test.independentOption") == DUMMY_VAL_2
        assert config.get_option("_test.dependentOption") == DUMMY_VAL_2
        assert (
            config.get_where_defined("_test.independentOption") == config._USER_DEFINED
        )
        assert (
            config.get_where_defined("_test.dependentOption")
            == ConfigOption.DEFAULT_DEFINITION
        )

        # Override the dependent option. Only that updates!
        config.set_option("_test.dependentOption", DUMMY_VAL_3)
        assert config.get_option("_test.independentOption") == DUMMY_VAL_2
        assert config.get_option("_test.dependentOption") == DUMMY_VAL_3
        assert (
            config.get_where_defined("_test.independentOption") == config._USER_DEFINED
        )
        assert config.get_where_defined("_test.dependentOption") == config._USER_DEFINED

    def test_create_theme_options(self):
        config._create_theme_options(
            "testConfig",
            categories=["theme"],
            description="This is a test config",
            default_val="TEST",
        )

        options = config.get_config_options(force_reparse=True)

        theme_key = "theme.testConfig"
        assert options[theme_key].name == "testConfig"
        assert options[theme_key].section == "theme"
        assert options[theme_key].description == "This is a test config"
        assert options[theme_key].value == "TEST"

        config._delete_option(theme_key)

        assert f"theme.{CustomThemeCategories.SIDEBAR.value}.testConfig" not in options

    def test_create_theme_options_for_categories(self):
        config._create_theme_options(
            "testConfig",
            categories=["theme", CustomThemeCategories.SIDEBAR],
            description="This is a test config",
            default_val="TEST",
        )

        options = config.get_config_options(force_reparse=True)

        theme_key = "theme.testConfig"
        assert options[theme_key].name == "testConfig"
        assert options[theme_key].section == "theme"
        assert options[theme_key].description == "This is a test config"
        assert options[theme_key].value == "TEST"

        sidebar_key = f"theme.{CustomThemeCategories.SIDEBAR.value}.testConfig"
        assert options[sidebar_key].name == "testConfig"
        assert (
            options[sidebar_key].section
            == f"theme.{CustomThemeCategories.SIDEBAR.value}"
        )
        assert options[sidebar_key].description == "This is a test config"
        assert options[sidebar_key].value == "TEST"

        config._delete_option(theme_key)
        config._delete_option(sidebar_key)

    def test_create_theme_options_for_complex_categories(self):
        config._create_theme_options(
            "testConfig",
            categories=[
                "theme",
                CustomThemeCategories.SIDEBAR,
                CustomThemeCategories.LIGHT,
                CustomThemeCategories.DARK,
                CustomThemeCategories.LIGHT_SIDEBAR,
                CustomThemeCategories.DARK_SIDEBAR,
            ],
            description="This is a test config",
            default_val="TEST",
        )

        options = config.get_config_options(force_reparse=True)
        theme_key = "theme.testConfig"
        assert options[theme_key].name == "testConfig"
        assert options[theme_key].section == "theme"
        assert options[theme_key].description == "This is a test config"
        assert options[theme_key].value == "TEST"

        sidebar_key = f"theme.{CustomThemeCategories.SIDEBAR.value}.testConfig"
        assert options[sidebar_key].name == "testConfig"
        assert (
            options[sidebar_key].section
            == f"theme.{CustomThemeCategories.SIDEBAR.value}"
        )
        assert options[sidebar_key].description == "This is a test config"
        assert options[sidebar_key].value == "TEST"

        light_key = f"theme.{CustomThemeCategories.LIGHT.value}.testConfig"
        assert options[light_key].name == "testConfig"
        assert (
            options[light_key].section == f"theme.{CustomThemeCategories.LIGHT.value}"
        )
        assert options[light_key].description == "This is a test config"
        assert options[light_key].value == "TEST"

        dark_key = f"theme.{CustomThemeCategories.DARK.value}.testConfig"
        assert options[dark_key].name == "testConfig"
        assert options[dark_key].section == f"theme.{CustomThemeCategories.DARK.value}"
        assert options[dark_key].description == "This is a test config"
        assert options[dark_key].value == "TEST"

        sidebar_light_key = (
            f"theme.{CustomThemeCategories.LIGHT_SIDEBAR.value}.testConfig"
        )
        assert options[sidebar_light_key].name == "testConfig"
        assert (
            options[sidebar_light_key].section
            == f"theme.{CustomThemeCategories.LIGHT_SIDEBAR.value}"
        )
        assert options[sidebar_light_key].description == "This is a test config"
        assert options[sidebar_light_key].value == "TEST"

        sidebar_dark_key = (
            f"theme.{CustomThemeCategories.DARK_SIDEBAR.value}.testConfig"
        )
        assert options[sidebar_dark_key].name == "testConfig"
        assert (
            options[sidebar_dark_key].section
            == f"theme.{CustomThemeCategories.DARK_SIDEBAR.value}"
        )
        assert options[sidebar_dark_key].description == "This is a test config"
        assert options[sidebar_dark_key].value == "TEST"

        config._delete_option(theme_key)
        config._delete_option(sidebar_key)
        config._delete_option(light_key)
        config._delete_option(dark_key)
        config._delete_option(sidebar_light_key)
        config._delete_option(sidebar_dark_key)

    def test_parsing_toml(self):
        """Test config._update_config_with_toml()."""
        # Some useful variables.
        DUMMY_VAL_1, DUMMY_VAL_2 = "Christopher", "Walken"
        DUMMY_DEFINITION = "<test definition>"

        # Create a dummy default option.
        config._create_option(
            "_test.tomlTest",
            description="This option tests the TOML parser.",
            default_val=DUMMY_VAL_1,
        )
        config.get_config_options(force_reparse=True)
        assert config.get_option("_test.tomlTest") == DUMMY_VAL_1
        assert (
            config.get_where_defined("_test.tomlTest")
            == ConfigOption.DEFAULT_DEFINITION
        )

        # Override it with some TOML
        NEW_TOML = f"""
            [_test]
            tomlTest="{DUMMY_VAL_2}"
        """
        config._update_config_with_toml(NEW_TOML, DUMMY_DEFINITION)
        assert config.get_option("_test.tomlTest") == DUMMY_VAL_2
        assert config.get_where_defined("_test.tomlTest") == DUMMY_DEFINITION

    def test_parsing_toml_with_valid_theme_nesting(self):
        """Test that valid theme nesting patterns are parsed correctly."""
        toml_content = """
        [theme.sidebar]
        primaryColor = "#000000"

        [theme.light]
        primaryColor = "#0000FF"

        [theme.dark]
        primaryColor = "#FFFF00"

        [theme.dark.sidebar]
        primaryColor = "#00FF00"

        [theme.light.sidebar]
        primaryColor = "#FF0000"
        """
        config._update_config_with_toml(toml_content, "test")
        assert config.get_option("theme.sidebar.primaryColor") == "#000000"
        assert config.get_option("theme.light.primaryColor") == "#0000FF"
        assert config.get_option("theme.dark.primaryColor") == "#FFFF00"
        assert config.get_option("theme.dark.sidebar.primaryColor") == "#00FF00"
        assert config.get_option("theme.light.sidebar.primaryColor") == "#FF0000"

    @parameterized.expand(
        [
            # Invalid nested sections
            "theme.sidebar.light",
            "theme.sidebar.dark",
            "theme.light.dark",
            "theme.dark.light",
            # Invalid deep nesting
            "theme.light.sidebar.dark",
            "theme.dark.sidebar.light",
        ]
    )
    def test_parsing_toml_with_invalid_theme_sections(self, section_path):
        """Test that invalid theme section patterns are rejected."""
        toml_content = f"""
        [{section_path}]
        primaryColor = "#FF0000"
        """
        with pytest.raises(
            StreamlitInvalidThemeSectionError,
            match=rf"Invalid theme section: `{section_path}`",
        ):
            config._update_config_with_toml(toml_content, "test")

    def test_parsing_invalid_toml(self):
        """Test that exceptions during toml.loads are caught and logged."""
        # Create a dummy default option
        config._create_option(
            "_test.invalidTomlTest",
            description="This option tests invalid TOML handling.",
            default_val="default_value",
        )
        config.get_config_options(force_reparse=True)

        # Store initial value
        initial_value = config.get_option("_test.invalidTomlTest")

        # Try to parse invalid TOML
        invalid_toml = """
            [_test]
            invalidTomlTest = "value"
            [invalid_section
            missing_bracket = "value"
        """

        with patch.object(config._LOGGER, "exception") as mock_logger:
            config._update_config_with_toml(invalid_toml, "<test definition>")
            mock_logger.assert_called_once()

        # Verify the value remains unchanged
        assert config.get_option("_test.invalidTomlTest") == initial_value
        assert (
            config.get_where_defined("_test.invalidTomlTest")
            == ConfigOption.DEFAULT_DEFINITION
        )

    def test_parsing_env_vars_in_toml(self):
        """Test that environment variables get parsed in the TOML file."""
        # Some useful variables.
        DEFAULT_VAL, DESIRED_VAL = "Christopher", "Walken"
        DUMMY_DEFINITION = "<test definition>"

        # Create a dummy default option.
        config._create_option(
            "_test.tomlTest",
            description="This option tests the TOML parser.",
            default_val=DEFAULT_VAL,
        )
        config.get_config_options(force_reparse=True)
        assert config.get_option("_test.tomlTest") == DEFAULT_VAL
        assert (
            config.get_where_defined("_test.tomlTest")
            == ConfigOption.DEFAULT_DEFINITION
        )

        os.environ["TEST_ENV_VAR"] = DESIRED_VAL

        # Override it with some TOML
        NEW_TOML = """
            [_test]
            tomlTest="env:TEST_ENV_VAR"
        """
        config._update_config_with_toml(NEW_TOML, DUMMY_DEFINITION)
        assert config.get_option("_test.tomlTest") == DESIRED_VAL
        assert config.get_where_defined("_test.tomlTest") == DUMMY_DEFINITION

    def test_parsing_to_map(self):
        """Test that we can parse into a dict-valued option."""
        DUMMY_DEFINITION = "<test definition>"
        DEFAULT_VAL = {}
        # Create a dummy default option.
        config._create_option(
            "_test.tomlTest",
            description="This option tests the TOML parser.",
            default_val=DEFAULT_VAL,
        )
        config.get_config_options(force_reparse=True)
        assert config.get_option("_test.tomlTest") == DEFAULT_VAL
        assert (
            config.get_where_defined("_test.tomlTest")
            == ConfigOption.DEFAULT_DEFINITION
        )

        # Validate that we can set nested values and get back a dict.
        NEW_TOML = """
            [_test.tomlTest]
            one-value = "one"
            two-value = "two"
        """
        config._update_config_with_toml(NEW_TOML, DUMMY_DEFINITION)
        assert config.get_option("_test.tomlTest") == {
            "one-value": "one",
            "two-value": "two",
        }
        assert config.get_where_defined("_test.tomlTest") == DUMMY_DEFINITION

    def test_parsing_sensitive_options(self):
        """Test config._update_config_with_sensitive_env_var()."""
        # Some useful variables.
        DUMMY_VAL_1, DUMMY_VAL_2 = "Adam", "Malysz"

        # Create a dummy default option.
        config._create_option(
            "_test.sensitiveTest",
            description="This sensitive option tests the config parser.",
            default_val=DUMMY_VAL_1,
            sensitive=True,
        )
        config.get_config_options(force_reparse=True)
        assert config.get_option("_test.sensitiveTest") == DUMMY_VAL_1
        assert (
            config.get_where_defined("_test.sensitiveTest")
            == ConfigOption.DEFAULT_DEFINITION
        )
        with patch.dict(os.environ, STREAMLIT__TEST_SENSITIVE_TEST=DUMMY_VAL_2):
            config.get_config_options(force_reparse=True)
            assert config.get_option("_test.sensitiveTest") == DUMMY_VAL_2
            assert (
                config.get_where_defined("_test.sensitiveTest")
                == config._DEFINED_BY_ENV_VAR
            )

    def test_delete_option(self):
        # Create a dummy default option.
        config._create_option(
            "_test.testDeleteOption",
            description="This option tests the _delete_option function.",
            default_val="delete me!",
        )
        config.get_config_options(force_reparse=True)
        assert config.get_option("_test.testDeleteOption") == "delete me!"

        config._delete_option("_test.testDeleteOption")

        with pytest.raises(RuntimeError) as e:
            config.get_option("_test.testDeleteOption")
        assert str(e.value) == 'Config key "_test.testDeleteOption" not defined.'

        config._delete_option("_test.testDeleteOption")

    def test_multiple_value_option(self):
        option = config._create_option(
            "_test.testMultipleValueOption",
            description="This option tests multiple values for an option",
            default_val=["Option 1", "Option 2"],
            multiple=True,
        )

        assert option.multiple
        config.get_config_options(force_reparse=True)
        assert config.get_option("_test.testMultipleValueOption") == [
            "Option 1",
            "Option 2",
        ]

    def test_sections_order(self):
        sections = sorted(
            [
                "_test",
                "browser",
                "client",
                "theme",
                "theme.dark",
                "theme.light",
                "theme.sidebar",
                "theme.dark.sidebar",
                "theme.light.sidebar",
                "global",
                "logger",
                "magic",
                "mapbox",
                "runner",
                "secrets",
                "server",
                "ui",
            ]
        )
        keys = sorted(config._section_descriptions.keys())
        assert sections == keys

    def test_config_option_keys(self):
        # To avoid having to manually add a new config for each section (theme, theme.sidebar, etc.),
        # we create a list of config options for each section with a helper.
        # To update this test, add new config option to the helper.
        theme_config_options = self._create_theme_config_options()
        sidebar_config_options = self._create_subsection_config_options("sidebar")
        light_config_options = self._create_subsection_config_options("light")
        dark_config_options = self._create_subsection_config_options("dark")
        light_sidebar_config_options = self._create_subsection_config_options(
            "light.sidebar"
        )
        dark_sidebar_config_options = self._create_subsection_config_options(
            "dark.sidebar"
        )

        config_options = sorted(
            [
                "browser.gatherUsageStats",
                "browser.serverAddress",
                "browser.serverPort",
                "client.showErrorDetails",
                "client.showSidebarNavigation",
                "client.toolbarMode",
                # Theme section options
                *theme_config_options,
                # Sidebar theme section options
                *sidebar_config_options,
                # Light theme section options
                *light_config_options,
                # Dark theme section options
                *dark_config_options,
                # Light sidebar theme section options
                *light_sidebar_config_options,
                # Dark sidebar theme section options
                *dark_sidebar_config_options,
                "global.appTest",
                "global.developmentMode",
                "global.disableWidgetStateDuplicationWarning",
                "global.e2eTest",
                "global.maxCachedMessageAge",
                "global.minCachedMessageSize",
                "global.showWarningOnDirectExecution",
                "global.suppressDeprecationWarnings",
                "global.unitTest",
                "logger.enableRich",
                "logger.level",
                "logger.messageFormat",
                "runner.enforceSerializableSessionState",
                "runner.magicEnabled",
                "runner.postScriptGC",
                "runner.fastReruns",
                "runner.enumCoercion",
                "magic.displayRootDocString",
                "magic.displayLastExprIfNoSemicolon",
                "mapbox.token",
                "secrets.files",
                "server.address",
                "server.allowRunOnSave",
                "server.baseUrlPath",
                "server.cookieSecret",
                "server.corsAllowedOrigins",
                "server.customComponentBaseUrlPath",
                "server.disconnectedSessionTTL",
                "server.enableArrowTruncation",
                "server.enableCORS",
                "server.enableStaticServing",
                "server.enableWebsocketCompression",
                "server.websocketPingInterval",
                "server.enableXsrfProtection",
                "server.fileWatcherType",
                "server.folderWatchBlacklist",
                "server.folderWatchList",
                "server.headless",
                "server.maxMessageSize",
                "server.maxUploadSize",
                "server.port",
                "server.runOnSave",
                "server.scriptHealthCheckEnabled",
                "server.showEmailPrompt",
                "server.sslCertFile",
                "server.sslKeyFile",
                "server.trustedUserHeaders",
                "ui.hideTopBar",
            ]
        )
        keys = sorted(config._config_options.keys())
        assert config_options == keys

    def test_check_conflicts_server_port(self):
        config._set_option("global.developmentMode", True, "test")
        config._set_option("server.port", 1234, "test")
        with pytest.raises(
            RuntimeError,
            match=r"server.port does not work when global.developmentMode is true.",
        ):
            config._check_conflicts()

    @patch("streamlit.logger.get_logger")
    def test_check_conflicts_server_csrf(self, get_logger):
        config._set_option("server.enableXsrfProtection", True, "test")
        config._set_option("server.enableCORS", True, "test")
        mock_logger = get_logger()
        config._check_conflicts()
        mock_logger.warning.assert_called_once()

    def test_check_conflicts_browser_serverport(self):
        config._set_option("global.developmentMode", True, "test")
        config._set_option("browser.serverPort", 1234, "test")
        with pytest.raises(
            RuntimeError,
            match=r"browser.serverPort does not work when global.developmentMode is true.",
        ):
            config._check_conflicts()

    def test_parse_trusted_user_headers_handles_bad_json(self):
        # JSON that fails to parse.
        config._set_option("server.trustedUserHeaders", "{123:}", "test")
        with pytest.raises(
            RuntimeError,
            match="bad JSON value",
        ):
            config._parse_trusted_user_headers()

    def test_parse_trusted_user_headers_handles_non_objects(self):
        # Non-object values.
        for value in ("[]", "null", "123", "false", '"str"'):
            config._set_option("server.trustedUserHeaders", value, "test")
            with pytest.raises(
                RuntimeError,
                match="JSON must be an object",
            ):
                config._parse_trusted_user_headers()

    def test_parse_trusted_user_headers_handles_non_string_entries(self):
        # Non-string object values.
        for value in (
            '{"key": null}',
            '{"key": 123}',
            '{"key": []}',
            '{"good_key": "value", "bad_key": false}',
        ):
            config._set_option("server.trustedUserHeaders", value, "test")
            with pytest.raises(
                RuntimeError,
                match="JSON must only have string values",
            ):
                config._parse_trusted_user_headers()

    def test_parse_trusted_user_headers_parses_good_json(self):
        config._set_option(
            "server.trustedUserHeaders",
            '{"value_one": "val", "value_two": "v2"}',
            "test",
        )
        config._parse_trusted_user_headers()
        assert config.get_option("server.trustedUserHeaders") == {
            "value_one": "val",
            "value_two": "v2",
        }

    def test_parse_trusted_user_headers_forbids_duplicate_user_keys(self):
        config._set_option(
            "server.trustedUserHeaders",
            {"hdr-one": "duplicate", "hdr-two": "duplicate", "hdr-three": "unique"},
            "test",
        )
        with pytest.raises(
            RuntimeError,
            match=r"had multiple mappings.*duplicate",
        ):
            config._parse_trusted_user_headers()

    def test_maybe_convert_to_number(self):
        assert config._maybe_convert_to_number("1234") == 1234
        assert config._maybe_convert_to_number("1234.5678") == 1234.5678
        assert config._maybe_convert_to_number("1234.5678ex") == "1234.5678ex"

    def test_maybe_read_env_variable(self):
        assert config._maybe_read_env_variable("env:RANDOM_TEST") == "env:RANDOM_TEST"
        os.environ["RANDOM_TEST"] = "1234"
        assert config._maybe_read_env_variable("env:RANDOM_TEST") == 1234

    def test_update_config_with_toml(self):
        assert (
            config.get_option("client.showErrorDetails")
            == ShowErrorDetailsConfigOptions.FULL
        )
        toml = textwrap.dedent(
            """
           [client]
           showErrorDetails = "type"
        """
        )
        config._update_config_with_toml(toml, "test")
        assert (
            config.get_option("client.showErrorDetails")
            == ShowErrorDetailsConfigOptions.TYPE
        )

    def test_set_option(self):
        with self.assertLogs(logger="streamlit.config", level="WARNING") as cm:
            config._set_option("not.defined", "no.value", "test")
        # cm.output is a list of messages and there shouldn't be any other messages besides one created by this test
        assert (
            '"not.defined" is not a valid config option. '
            "If you previously had this config option set, it may have been removed."
            in cm.output[0]
        )

        config._set_option("browser.gatherUsageStats", "test", "test")
        assert config.get_option("browser.gatherUsageStats") == "test"

    def test_is_manually_set(self):
        config._set_option("browser.serverAddress", "some.bucket", "test")
        assert config.is_manually_set("browser.serverAddress")

        config._set_option("browser.serverAddress", "some.bucket", "<default>")
        assert not config.is_manually_set("browser.serverAddress")

    def test_is_unset(self):
        config._set_option("browser.serverAddress", "some.bucket", "test")
        assert not config._is_unset("browser.serverAddress")

        config._set_option("browser.serverAddress", "some.bucket", "<default>")
        assert config._is_unset("browser.serverAddress")

    def test_get_where_defined(self):
        config._set_option("browser.serverAddress", "some.bucket", "test")
        assert config.get_where_defined("browser.serverAddress") == "test"

        with pytest.raises(RuntimeError) as e:
            config.get_where_defined("doesnt.exist")
        assert str(e.value) == 'Config key "doesnt.exist" not defined.'

    def test_get_option(self):
        config._set_option("browser.serverAddress", "some.bucket", "test")
        assert config.get_option("browser.serverAddress") == "some.bucket"

        with pytest.raises(RuntimeError) as e:
            config.get_option("doesnt.exist")
        assert str(e.value) == 'Config key "doesnt.exist" not defined.'

    def test_with_no_theme_options(self):
        """Test that all theme options are None when no theme options are set."""
        expected = {
            "base": None,
            "primaryColor": None,
            "baseRadius": None,
            "buttonRadius": None,
            "secondaryBackgroundColor": None,
            "backgroundColor": None,
            "textColor": None,
            "borderColor": None,
            "dataframeBorderColor": None,
            "showWidgetBorder": None,
            "linkColor": None,
            "linkUnderline": None,
            "font": None,
            "headingFont": None,
            "codeFont": None,
            "codeFontSize": None,
            "codeFontWeight": None,
            "fontFaces": None,
            "baseFontSize": None,
            "baseFontWeight": None,
            "codeTextColor": None,
            "codeBackgroundColor": None,
            "dataframeHeaderBackgroundColor": None,
            "showSidebarBorder": None,
            "headingFontSizes": None,
            "headingFontWeights": None,
            "chartCategoricalColors": None,
            "chartSequentialColors": None,
            "redColor": None,
            "orangeColor": None,
            "yellowColor": None,
            "blueColor": None,
            "greenColor": None,
            "violetColor": None,
            "grayColor": None,
            "redBackgroundColor": None,
            "orangeBackgroundColor": None,
            "yellowBackgroundColor": None,
            "blueBackgroundColor": None,
            "greenBackgroundColor": None,
            "violetBackgroundColor": None,
            "grayBackgroundColor": None,
            "redTextColor": None,
            "orangeTextColor": None,
            "yellowTextColor": None,
            "blueTextColor": None,
            "greenTextColor": None,
            "violetTextColor": None,
            "grayTextColor": None,
        }
        assert config.get_options_for_section("theme") == expected

    def test_with_theme_options(self):
        """Test that the theme options are correctly set."""

        config._set_option("theme.primaryColor", "#1BD760", "test")

        config._set_option("theme.base", "dark", "test")
        config._set_option("theme.textColor", "#DFFDE0", "test")
        config._set_option("theme.baseRadius", "1.2rem", "test")
        config._set_option("theme.buttonRadius", "medium", "test")
        config._set_option("theme.secondaryBackgroundColor", "#021A09", "test")
        config._set_option("theme.backgroundColor", "#001200", "test")
        config._set_option("theme.borderColor", "#0B4C0B", "test")
        config._set_option("theme.dataframeBorderColor", "#280f63", "test")
        config._set_option("theme.showWidgetBorder", True, "test")
        config._set_option("theme.linkColor", "#2EC163", "test")
        config._set_option("theme.linkUnderline", False, "test")
        config._set_option("theme.codeTextColor", "#158237", "test")
        config._set_option("theme.codeBackgroundColor", "#29361e", "test")
        config._set_option("theme.dataframeHeaderBackgroundColor", "#29361e", "test")
        config._set_option("theme.font", "Inter", "test")
        config._set_option("theme.headingFont", "Inter", "test")
        config._set_option(
            "theme.fontFaces",
            [
                {
                    "family": "Inter",
                    "url": "https://raw.githubusercontent.com/rsms/inter/refs/heads/master/docs/font-files/Inter-Regular.woff2",
                    "weight": 400,
                },
            ],
            "test",
        )
        config._set_option("theme.codeFont", "Monaspace Argon", "test")
        config._set_option("theme.codeFontSize", "12px", "test")
        config._set_option("theme.codeFontWeight", 300, "test")
        config._set_option("theme.baseFontSize", 14, "test")
        config._set_option("theme.baseFontWeight", 300, "test")
        config._set_option("theme.headingFontWeights", [700, 600, 500], "test")
        config._set_option(
            "theme.headingFontSizes",
            ["2.875rem", "2.75rem", "2rem", "1.75rem", "1.5rem", "1.25rem"],
            "test",
        )
        config._set_option("theme.showSidebarBorder", True, "test")
        config._set_option(
            "theme.chartCategoricalColors", ["#000000", "#111111", "#222222"], "test"
        )
        config._set_option(
            "theme.chartSequentialColors", ["#000000", "#111111", "#222222"], "test"
        )
        config._set_option("theme.redColor", "red", "test")
        config._set_option("theme.orangeColor", "orange", "test")
        config._set_option("theme.yellowColor", "yellow", "test")
        config._set_option("theme.blueColor", "blue", "test")
        config._set_option("theme.greenColor", "green", "test")
        config._set_option("theme.violetColor", "violet", "test")
        config._set_option("theme.grayColor", "gray", "test")
        config._set_option("theme.redBackgroundColor", "#ff8c8c", "test")
        config._set_option("theme.orangeBackgroundColor", "#ffd16a", "test")
        config._set_option("theme.yellowBackgroundColor", "#ffff59", "test")
        config._set_option("theme.blueBackgroundColor", "#60b4ff", "test")
        config._set_option("theme.greenBackgroundColor", "#5ce488", "test")
        config._set_option("theme.violetBackgroundColor", "#b27eff", "test")
        config._set_option("theme.grayBackgroundColor", "#bfc5d3", "test")
        config._set_option("theme.redTextColor", "#ffabab", "test")
        config._set_option("theme.orangeTextColor", "#ffe08e", "test")
        config._set_option("theme.yellowTextColor", "#ffff7d", "test")
        config._set_option("theme.blueTextColor", "#83c9ff", "test")
        config._set_option("theme.greenTextColor", "#7defa1", "test")
        config._set_option("theme.violetTextColor", "#c89dff", "test")
        config._set_option("theme.grayTextColor", "#d5dae5", "test")

        expected = {
            "base": "dark",
            "primaryColor": "#1BD760",
            "baseRadius": "1.2rem",
            "buttonRadius": "medium",
            "secondaryBackgroundColor": "#021A09",
            "backgroundColor": "#001200",
            "textColor": "#DFFDE0",
            "borderColor": "#0B4C0B",
            "dataframeBorderColor": "#280f63",
            "showWidgetBorder": True,
            "linkColor": "#2EC163",
            "linkUnderline": False,
            "font": "Inter",
            "headingFont": "Inter",
            "codeFont": "Monaspace Argon",
            "codeFontSize": "12px",
            "codeFontWeight": 300,
            "headingFontSizes": [
                "2.875rem",
                "2.75rem",
                "2rem",
                "1.75rem",
                "1.5rem",
                "1.25rem",
            ],
            "headingFontWeights": [700, 600, 500],
            "codeTextColor": "#158237",
            "codeBackgroundColor": "#29361e",
            "dataframeHeaderBackgroundColor": "#29361e",
            "fontFaces": [
                {
                    "family": "Inter",
                    "url": "https://raw.githubusercontent.com/rsms/inter/refs/heads/master/docs/font-files/Inter-Regular.woff2",
                    "weight": 400,
                },
            ],
            "baseFontSize": 14,
            "baseFontWeight": 300,
            "showSidebarBorder": True,
            "chartCategoricalColors": ["#000000", "#111111", "#222222"],
            "chartSequentialColors": ["#000000", "#111111", "#222222"],
            "redColor": "red",
            "orangeColor": "orange",
            "yellowColor": "yellow",
            "blueColor": "blue",
            "greenColor": "green",
            "violetColor": "violet",
            "grayColor": "gray",
            "redBackgroundColor": "#ff8c8c",
            "orangeBackgroundColor": "#ffd16a",
            "yellowBackgroundColor": "#ffff59",
            "blueBackgroundColor": "#60b4ff",
            "greenBackgroundColor": "#5ce488",
            "violetBackgroundColor": "#b27eff",
            "grayBackgroundColor": "#bfc5d3",
            "redTextColor": "#ffabab",
            "orangeTextColor": "#ffe08e",
            "yellowTextColor": "#ffff7d",
            "blueTextColor": "#83c9ff",
            "greenTextColor": "#7defa1",
            "violetTextColor": "#c89dff",
            "grayTextColor": "#d5dae5",
        }
        assert config.get_options_for_section("theme") == expected

    def test_with_sidebar_theme_options(self):
        """Test that the sidebar theme options are correctly set."""

        config._set_option("theme.sidebar.primaryColor", "#FFF000", "test")

        config._set_option("theme.sidebar.textColor", "#DFFDE0", "test")
        config._set_option("theme.sidebar.baseRadius", "1.2rem", "test")
        config._set_option("theme.sidebar.buttonRadius", "medium", "test")
        config._set_option("theme.sidebar.secondaryBackgroundColor", "#021A09", "test")
        config._set_option("theme.sidebar.backgroundColor", "#001200", "test")
        config._set_option("theme.sidebar.borderColor", "#0B4C0B", "test")
        config._set_option("theme.sidebar.dataframeBorderColor", "#280f63", "test")
        config._set_option("theme.sidebar.showWidgetBorder", True, "test")
        config._set_option("theme.sidebar.linkColor", "#2EC163", "test")
        config._set_option("theme.sidebar.linkUnderline", False, "test")
        config._set_option("theme.sidebar.font", "Inter", "test")
        config._set_option("theme.sidebar.headingFont", "Inter", "test")
        config._set_option("theme.sidebar.codeFont", "Monaspace Argon", "test")
        config._set_option("theme.sidebar.codeFontSize", "12px", "test")
        config._set_option("theme.sidebar.codeFontWeight", 600, "test")
        config._set_option(
            "theme.sidebar.headingFontSizes", ["2.875rem", "2.75rem"], "test"
        )
        config._set_option("theme.sidebar.headingFontWeights", [600, 500, 500], "test")
        config._set_option("theme.sidebar.codeTextColor", "#158237", "test")
        config._set_option("theme.sidebar.codeBackgroundColor", "#29361e", "test")
        config._set_option(
            "theme.sidebar.dataframeHeaderBackgroundColor", "#29361e", "test"
        )
        config._set_option("theme.sidebar.redColor", "#7d353b", "test")
        config._set_option("theme.sidebar.orangeColor", "#d95a00", "test")
        config._set_option("theme.sidebar.yellowColor", "#916e10", "test")
        config._set_option("theme.sidebar.blueColor", "#004280", "test")
        config._set_option("theme.sidebar.greenColor", "#177233", "test")
        config._set_option("theme.sidebar.violetColor", "#3f3163", "test")
        config._set_option("theme.sidebar.grayColor", "#0e1117", "test")
        config._set_option("theme.sidebar.redBackgroundColor", "#ff4b4b", "test")
        config._set_option("theme.sidebar.orangeBackgroundColor", "#ffa421", "test")
        config._set_option("theme.sidebar.yellowBackgroundColor", "#ffe312", "test")
        config._set_option("theme.sidebar.blueBackgroundColor", "#1c83e1", "test")
        config._set_option("theme.sidebar.greenBackgroundColor", "#21c354", "test")
        config._set_option("theme.sidebar.violetBackgroundColor", "#803df5", "test")
        config._set_option("theme.sidebar.grayBackgroundColor", "#808495", "test")
        config._set_option("theme.sidebar.redTextColor", "#ff6c6c", "test")
        config._set_option("theme.sidebar.orangeTextColor", "#ffbd45", "test")
        config._set_option("theme.sidebar.yellowTextColor", "#fff835", "test")
        config._set_option("theme.sidebar.blueTextColor", "#3d9df3", "test")
        config._set_option("theme.sidebar.greenTextColor", "#3dd56d", "test")
        config._set_option("theme.sidebar.violetTextColor", "#9a5dff", "test")
        config._set_option("theme.sidebar.grayTextColor", "#a3a8b8", "test")

        expected = {
            "primaryColor": "#FFF000",
            "baseRadius": "1.2rem",
            "buttonRadius": "medium",
            "secondaryBackgroundColor": "#021A09",
            "backgroundColor": "#001200",
            "textColor": "#DFFDE0",
            "borderColor": "#0B4C0B",
            "dataframeBorderColor": "#280f63",
            "showWidgetBorder": True,
            "linkColor": "#2EC163",
            "linkUnderline": False,
            "font": "Inter",
            "headingFont": "Inter",
            "codeFont": "Monaspace Argon",
            "codeFontSize": "12px",
            "codeFontWeight": 600,
            "headingFontSizes": ["2.875rem", "2.75rem"],
            "headingFontWeights": [600, 500, 500],
            "codeTextColor": "#158237",
            "codeBackgroundColor": "#29361e",
            "dataframeHeaderBackgroundColor": "#29361e",
            "redColor": "#7d353b",
            "orangeColor": "#d95a00",
            "yellowColor": "#916e10",
            "blueColor": "#004280",
            "greenColor": "#177233",
            "violetColor": "#3f3163",
            "grayColor": "#0e1117",
            "redBackgroundColor": "#ff4b4b",
            "orangeBackgroundColor": "#ffa421",
            "yellowBackgroundColor": "#ffe312",
            "blueBackgroundColor": "#1c83e1",
            "greenBackgroundColor": "#21c354",
            "violetBackgroundColor": "#803df5",
            "grayBackgroundColor": "#808495",
            "redTextColor": "#ff6c6c",
            "orangeTextColor": "#ffbd45",
            "yellowTextColor": "#fff835",
            "blueTextColor": "#3d9df3",
            "greenTextColor": "#3dd56d",
            "violetTextColor": "#9a5dff",
            "grayTextColor": "#a3a8b8",
        }
        assert config.get_options_for_section("theme.sidebar") == expected

    def test_with_sidebar_theme_unsupported_options(self):
        """Test that the sidebar theme cannot set unsupported options."""
        unsupported_options = ["showSidebarBorder"]

        for option in unsupported_options:
            with self.assertLogs(logger="streamlit.config", level="WARNING") as cm:
                config._set_option(f"theme.sidebar.{option}", True, "test")
            # cm.output is a list of messages and there shouldn't be any other messages besides one created by this test
            assert (
                f'"theme.sidebar.{option}" is not a valid config option. '
                "If you previously had this config option set, it may have been removed."
                in cm.output[0]
            )

    def test_browser_server_port(self):
        # developmentMode must be False for server.port to be modified
        config.set_option("global.developmentMode", False)
        config.set_option("server.port", 1234)
        assert config.get_option("browser.serverPort") == 1234

    def test_server_headless(self):
        orig_display = None
        if "DISPLAY" in os.environ:
            orig_display = os.environ["DISPLAY"]
            del os.environ["DISPLAY"]

        orig_is_linux_or_bsd = env_util.IS_LINUX_OR_BSD
        env_util.IS_LINUX_OR_BSD = True

        assert config.get_option("server.headless")

        env_util.IS_LINUX_OR_BSD = orig_is_linux_or_bsd
        if orig_display:
            os.environ["DISPLAY"] = orig_display

    def test_global_dev_mode(self):
        config.set_option("global.developmentMode", True)
        assert config.get_option("global.developmentMode")

    def test_global_log_level_debug(self):
        config.set_option("global.developmentMode", True)
        assert config.get_option("logger.level") == "debug"

    def test_global_log_level(self):
        config.set_option("global.developmentMode", False)
        assert config.get_option("logger.level") == "info"

    @parameterized.expand(
        [
            (CONFIG_OPTIONS, True),
            (CONFIG_OPTIONS, False),
            (None, False),
            (None, True),
        ]
    )
    def test_on_config_parsed(self, config_options, connect_signal):
        """Tests to make sure callback is handled properly based upon
        _config_file_has_been_parsed and connect_signal."""

        mock_callback = MagicMock(return_value=None)

        with (
            patch.object(config, "_config_options", new=config_options),
            patch.object(config._on_config_parsed, "connect") as patched_connect,
            patch.object(config._on_config_parsed, "disconnect") as patched_disconnect,
        ):
            mock_callback.reset_mock()
            disconnect_callback = config.on_config_parsed(mock_callback, connect_signal)

            if connect_signal:
                patched_connect.assert_called_once()
                mock_callback.assert_not_called()
            elif config_options:
                patched_connect.assert_not_called()
                mock_callback.assert_called_once()
            else:
                patched_connect.assert_called_once()
                mock_callback.assert_not_called()

            disconnect_callback()
            patched_disconnect.assert_called_once()

    def test_secret_files_default_values(self):
        """Verify that we're looking for secrets.toml in the right place."""
        if "win32" not in sys.platform:
            # conftest.py sets the HOME envvar to "/mock/home/folder".
            expected_global_path = "/mock/home/folder/.streamlit/secrets.toml"
        else:
            # On windows systems, HOME does not work so we look in the user's directory instead.
            expected_global_path = os.path.join(
                os.path.expanduser("~"), ".streamlit", "secrets.toml"
            )
        assert [
            expected_global_path,
            os.path.abspath("./.streamlit/secrets.toml"),
        ] == config.get_option("secrets.files")


class ConfigLoadingTest(unittest.TestCase):
    """Tests that involve loading the config.toml file."""

    def setUp(self):
        self.patches = [
            patch.object(
                config, "_section_descriptions", new=copy.deepcopy(SECTION_DESCRIPTIONS)
            ),
            patch.object(config, "_config_options", new=None),
        ]

        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def test_missing_config(self):
        """Test that we can initialize our config even if the file is missing."""
        with patch("streamlit.config.os.path.exists") as path_exists:
            path_exists.return_value = False
            config.get_config_options()

            assert config.get_option("browser.gatherUsageStats")
            assert config.get_option("theme.font") is None

    def test_load_global_config(self):
        """Test that ~/.streamlit/config.toml is read."""
        global_config = """
        [theme]
        base = "dark"
        font = "sans serif"
        """
        global_config_path = "/mock/home/folder/.streamlit/config.toml"

        open_patch = patch("streamlit.config.open", mock_open(read_data=global_config))
        # patch streamlit.*.os.* instead of os.* for py35 compat
        makedirs_patch = patch("streamlit.config.os.makedirs")
        makedirs_patch.return_value = True
        pathexists_patch = patch("streamlit.config.os.path.exists")
        pathexists_patch.side_effect = lambda path: path == global_config_path

        with open_patch, makedirs_patch, pathexists_patch:
            config.get_config_options()

            assert config.get_option("theme.font") == "sans serif"
            assert config.get_option("theme.textColor") is None

    def test_load_local_config(self):
        """Test that $CWD/.streamlit/config.toml is read, even
        if ~/.streamlit/config.toml is missing.
        """

        local_config = """
        [theme]
        base = "light"
        textColor = "#FFFFFF"
        """

        local_config_path = os.path.join(os.getcwd(), ".streamlit/config.toml")

        open_patch = patch("streamlit.config.open", mock_open(read_data=local_config))
        # patch streamlit.*.os.* instead of os.* for py35 compat
        makedirs_patch = patch("streamlit.config.os.makedirs")
        makedirs_patch.return_value = True
        pathexists_patch = patch("streamlit.config.os.path.exists")
        pathexists_patch.side_effect = lambda path: path == local_config_path

        with open_patch, makedirs_patch, pathexists_patch:
            config.get_config_options()

            assert config.get_option("theme.textColor") == "#FFFFFF"
            assert config.get_option("theme.font") is None

    def test_load_global_local_config(self):
        """Test that $CWD/.streamlit/config.toml gets overlaid on
        ~/.streamlit/config.toml at parse time.
        """

        global_config = """
        [theme]
        base = "dark"
        font = "sans serif"
        """

        local_config = """
        [theme]
        base = "light"
        textColor = "#FFFFFF"
        """

        global_config_path = "/mock/home/folder/.streamlit/config.toml"
        local_config_path = os.path.join(os.getcwd(), ".streamlit/config.toml")

        global_open = mock_open(read_data=global_config)
        local_open = mock_open(read_data=local_config)
        file_open = mock_open()
        file_open.side_effect = [global_open.return_value, local_open.return_value]

        open_patch = patch("streamlit.config.open", file_open)
        # patch streamlit.*.os.* instead of os.* for py35 compat
        makedirs_patch = patch("streamlit.config.os.makedirs")
        makedirs_patch.return_value = True
        pathexists_patch = patch("streamlit.config.os.path.exists")
        pathexists_patch.side_effect = lambda path: path in [
            global_config_path,
            local_config_path,
        ]

        with open_patch, makedirs_patch, pathexists_patch:
            config.get_config_options()

            # theme.base set in both local and global
            assert config.get_option("theme.base") == "light"

            # theme.font is set in global, and not in local
            assert config.get_option("theme.font") == "sans serif"

            # theme.textColor is set in local and not in global
            assert config.get_option("theme.textColor") == "#FFFFFF"

    def test_load_global_local_flag_config(self):
        """Test that CLI flags have higher priority than both
        ~/.streamlit/config.toml and $CWD/.streamlit/config.toml at parse time.
        """

        global_config = """
        [theme]
        base = "dark"
        font = "sans serif"
        textColor = "#FFFFFF"
        """

        local_config = """
        [theme]
        base = "light"
        font = "serif"
        """

        global_config_path = "/mock/home/folder/.streamlit/config.toml"
        local_config_path = os.path.join(os.getcwd(), ".streamlit/config.toml")

        global_open = mock_open(read_data=global_config)
        local_open = mock_open(read_data=local_config)
        file_open = mock_open()
        file_open.side_effect = [global_open.return_value, local_open.return_value]

        open_patch = patch("streamlit.config.open", file_open)
        # patch streamlit.*.os.* instead of os.* for py35 compat
        makedirs_patch = patch("streamlit.config.os.makedirs")
        makedirs_patch.return_value = True
        pathexists_patch = patch("streamlit.config.os.path.exists")
        pathexists_patch.side_effect = lambda path: path in [
            global_config_path,
            local_config_path,
        ]

        with open_patch, makedirs_patch, pathexists_patch:
            config.get_config_options(options_from_flags={"theme.font": "monospace"})

            assert config.get_option("theme.base") == "light"
            assert config.get_option("theme.textColor") == "#FFFFFF"
            assert config.get_option("theme.font") == "monospace"

    def test_upload_file_default_values(self):
        assert config.get_option("server.maxUploadSize") == 200

    def test_max_message_size_default_values(self):
        assert config.get_option("server.maxMessageSize") == 200

    def test_config_options_removed_on_reparse(self):
        """Test that config options that are removed in a file are also removed
        from our _config_options dict."""

        global_config_path = "/mock/home/folder/.streamlit/config.toml"
        makedirs_patch = patch("streamlit.config.os.makedirs")
        makedirs_patch.return_value = True
        pathexists_patch = patch("streamlit.config.os.path.exists")
        pathexists_patch.side_effect = lambda path: path == global_config_path

        global_config = """
        [theme]
        base = "dark"
        font = "sans serif"
        """
        open_patch = patch("streamlit.config.open", mock_open(read_data=global_config))

        with open_patch, makedirs_patch, pathexists_patch:
            config.get_config_options()

            assert config.get_option("theme.base") == "dark"
            assert config.get_option("theme.font") == "sans serif"

        global_config = """
        [theme]
        base = "dark"
        """
        open_patch = patch("streamlit.config.open", mock_open(read_data=global_config))

        with open_patch, makedirs_patch, pathexists_patch:
            config.get_config_options(force_reparse=True)

            assert config.get_option("theme.base") == "dark"
            assert None is config.get_option("theme.font")

    @patch("streamlit.logger.get_logger")
    def test_config_options_warn_on_server_change(self, get_logger):
        """Test that a warning is logged if a user changes a config file in the
        server section."""

        global_config_path = "/mock/home/folder/.streamlit/config.toml"
        makedirs_patch = patch("streamlit.config.os.makedirs")
        makedirs_patch.return_value = True
        pathexists_patch = patch("streamlit.config.os.path.exists")
        pathexists_patch.side_effect = lambda path: path == global_config_path
        mock_logger = get_logger()

        global_config = """
        [server]
        address = "localhost"
        """
        open_patch = patch("streamlit.config.open", mock_open(read_data=global_config))

        with open_patch, makedirs_patch, pathexists_patch:
            config.get_config_options()

        global_config = """
        [server]
        address = "streamlit.io"
        """
        open_patch = patch("streamlit.config.open", mock_open(read_data=global_config))

        with open_patch, makedirs_patch, pathexists_patch:
            config.get_config_options(force_reparse=True)

        mock_logger.warning.assert_any_call(
            "An update to the [server] config option section was detected."
            " To have these changes be reflected, please restart streamlit."
        )


class ThemeInheritanceIntegrationTest(unittest.TestCase):
    """Integration tests for theme inheritance functionality."""

    def setUp(self):
        self.patches = [
            patch.object(
                config, "_section_descriptions", new=copy.deepcopy(SECTION_DESCRIPTIONS)
            ),
            patch.object(config, "_config_options", new=None),
        ]

        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def _create_theme_file(self, content: str, filename: str = "theme.toml") -> str:
        """
        Helper to create a temporary theme file.
        WARNING: Should only be called from _theme_file() since this method creates files
        with delete=False, so cleanup is manual. Use _theme_file() context manager for
        automatic cleanup.
        """

        # Use the same pattern as other tests in the repo
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=f"_{filename}", delete=False
        ) as f:
            f.write(content)
            return f.name

    @contextmanager
    def _theme_file(self, content: str, filename: str = "theme.toml"):
        """Context manager for temporary theme files with automatic cleanup."""
        theme_file = self._create_theme_file(content, filename)
        try:
            yield theme_file
        finally:
            os.unlink(theme_file)

    @contextmanager
    def _config_patches(self, config_toml: str, theme_files: list[str] | None = None):
        """Context manager for common config patches."""
        if theme_files is None:
            theme_files = []

        with patch("streamlit.config.open", mock_open(read_data=config_toml)):
            with patch("streamlit.config.os.path.exists") as mock_exists:

                def mock_path_exists(path):
                    # Allow theme files and the mocked config file to exist
                    allowed_paths = [
                        *theme_files,
                        os.path.join(os.getcwd(), ".streamlit/config.toml"),
                    ]
                    return path in allowed_paths

                mock_exists.side_effect = mock_path_exists
                yield

    def test_theme_inheritance_base_file_local(self):
        """Test theme inheritance - theme.base is a local file."""
        base_content = """
        [theme]
        base = "dark"
        primaryColor = "#00ff41"
        backgroundColor = "#0a0a0a"
        textColor = "#ffffff"
        """

        with self._theme_file(base_content) as theme_file:
            # Create config with theme.base pointing to our file
            config_toml = f"""
            [theme]
            base = "{theme_file}"
            """

            with self._config_patches(config_toml, theme_files=[theme_file]):
                config.get_config_options()

                # Verify that theme options were loaded from theme file
                assert config.get_option("theme.base") == "dark"
                assert config.get_option("theme.primaryColor") == "#00ff41"
                assert config.get_option("theme.backgroundColor") == "#0a0a0a"
                assert config.get_option("theme.textColor") == "#ffffff"

    @patch("streamlit.config_util.url_util.is_url")
    @patch("streamlit.config_util.urllib.request.urlopen")
    def test_theme_inheritance_base_file_url(self, mock_urlopen, mock_is_url):
        """Test theme inheritance - theme.base is a URL."""
        mock_is_url.return_value = True

        theme_content = """
        [theme]
        base = "dark"
        primaryColor = "#00ff41"
        backgroundColor = "#0a0a0a"
        """

        mock_response = MagicMock()
        mock_response.read.return_value = theme_content.encode("utf-8")
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        config_toml = """
        [theme]
        base = "https://example.com/theme.toml"
        primaryColor = "#override"
        """

        with self._config_patches(config_toml):
            config.get_config_options()

            # Verify inheritance from URL
            assert config.get_option("theme.base") == "dark"
            assert config.get_option("theme.primaryColor") == "#override"
            assert config.get_option("theme.backgroundColor") == "#0a0a0a"

    def test_theme_inheritance_base_not_file(self):
        """Test that valid base values ('light', 'dark') do not trigger file loading."""

        # Test each builtin base value separately to avoid interference
        for base_value in ["light", "dark"]:
            with self.subTest(base=base_value):
                config_toml = f"""
                [theme]
                base = "{base_value}"
                primaryColor = "#ff0000"
                """

                # Mock _load_theme_file to fail if called - it shouldn't be!
                with patch("streamlit.config_util._load_theme_file") as mock_load_theme:
                    mock_load_theme.side_effect = AssertionError(
                        f"_load_theme_file should not be called for builtin base '{base_value}'"
                    )

                    with self._config_patches(config_toml):
                        # Force a fresh config parse to avoid state leakage between subtests
                        config.get_config_options(force_reparse=True)

                        # Verify the config worked normally (primaryColor proves config was processed)
                        assert config.get_option("theme.primaryColor") == "#ff0000"

                        # Most importantly: verify file loading was never attempted
                        mock_load_theme.assert_not_called()

    def test_theme_inheritance_config_overrides_base(self):
        """Test that config.toml values override theme.base file values."""
        base_content = """
        [theme]
        base = "dark"
        primaryColor = "#00ff41"
        backgroundColor = "#0a0a0a"
        textColor = "#ffffff"
        """

        with self._theme_file(base_content) as theme_file:
            # Config that overrides some theme file values
            config_toml = f"""
            [theme]
            base = "{theme_file}"
            primaryColor = "#ff0000"
            # backgroundColor should come from theme file
            # textColor should come from theme file
            """

            with self._config_patches(config_toml, theme_files=[theme_file]):
                config.get_config_options()

                # Verify inheritance: config overrides win
                assert config.get_option("theme.base") == "dark"  # From base file
                assert config.get_option("theme.primaryColor") == "#ff0000"  # Override
                assert (
                    config.get_option("theme.backgroundColor") == "#0a0a0a"
                )  # From base file
                assert (
                    config.get_option("theme.textColor") == "#ffffff"
                )  # From base file

    def test_theme_inheritance_sidebar_sections(self):
        """Test theme inheritance with sidebar sections."""
        base_content = """
        [theme]
        base = "dark"
        primaryColor = "#00ff41"
        backgroundColor = "#0a0a0a"

        [theme.sidebar]
        primaryColor = "#00ff81"
        backgroundColor = "#1a1a1a"
        textColor = "#dddddd"
        """

        with self._theme_file(base_content) as theme_file:
            # Config with sidebar overrides
            config_toml = f"""
            [theme]
            base = "{theme_file}"
            primaryColor = "#ff0000"

            [theme.sidebar]
            primaryColor = "#ff6b6b"
            # backgroundColor should come from theme file
            """

            with self._config_patches(config_toml, theme_files=[theme_file]):
                config.get_config_options()

                # Main theme options
                assert config.get_option("theme.primaryColor") == "#ff0000"  # Override
                assert (
                    config.get_option("theme.backgroundColor") == "#0a0a0a"
                )  # From base

                # Sidebar options
                assert (
                    config.get_option("theme.sidebar.primaryColor") == "#ff6b6b"
                )  # Override
                assert (
                    config.get_option("theme.sidebar.backgroundColor") == "#1a1a1a"
                )  # From base
                assert (
                    config.get_option("theme.sidebar.textColor") == "#dddddd"
                )  # From base

    def test_theme_inheritance_comprehensive_merge(self):
        """Test comprehensive theme inheritance with all option types."""
        theme_content = """
        [theme]
        base = "dark"
        primaryColor = "#00ff41"
        backgroundColor = "#0a0a0a"
        textColor = "#ffffff"
        font = "Inter"
        codeFont = "JetBrains Mono"
        borderColor = "#333333"
        linkColor = "#00ff41"

        [theme.sidebar]
        primaryColor = "#00ff81"
        backgroundColor = "#1a1a1a"
        textColor = "#dddddd"
        """

        with self._theme_file(theme_content) as theme_file:
            # Comprehensive config overrides
            config_toml = f"""
            [theme]
            base = "{theme_file}"
            primaryColor = "#ff0000"
            font = "Roboto"
            # Other values should come from theme file

            [theme.sidebar]
            primaryColor = "#ff6b6b"
            # Other sidebar values should come from theme file
            """

            with self._config_patches(config_toml, theme_files=[theme_file]):
                config.get_config_options()

                # Main theme - overrides
                assert config.get_option("theme.base") == "dark"  # From theme file
                assert config.get_option("theme.primaryColor") == "#ff0000"  # Override
                assert config.get_option("theme.font") == "Roboto"  # Override

                # Main theme - from theme file
                assert config.get_option("theme.backgroundColor") == "#0a0a0a"
                assert config.get_option("theme.textColor") == "#ffffff"
                assert config.get_option("theme.codeFont") == "JetBrains Mono"
                assert config.get_option("theme.borderColor") == "#333333"
                assert config.get_option("theme.linkColor") == "#00ff41"

                # Sidebar - override
                assert config.get_option("theme.sidebar.primaryColor") == "#ff6b6b"

                # Sidebar - from theme file
                assert config.get_option("theme.sidebar.backgroundColor") == "#1a1a1a"
                assert config.get_option("theme.sidebar.textColor") == "#dddddd"

    def test_theme_inheritance_with_base_via_cli_flag(self):
        """Test theme inheritance when theme.base is passed via CLI flag (Click processing)."""
        theme_content = """
        [theme]
        base = "dark"
        primaryColor = "#00ff00"
        backgroundColor = "#000000"
        textColor = "#ffffff"
        """

        with self._theme_file(theme_content) as theme_file:
            # Simulate CLI flag processing by Click - this is what options_from_flags represents
            options_from_flags = {"theme.base": theme_file}

            with patch("streamlit.config.os.path.exists") as mock_exists:
                mock_exists.side_effect = lambda path: path == theme_file

                config.get_config_options(
                    force_reparse=True, options_from_flags=options_from_flags
                )

                # Verify theme inheritance worked with CLI flag
                assert (
                    config.get_option("theme.base") == "dark"
                )  # From theme file content
                assert (
                    config.get_option("theme.primaryColor") == "#00ff00"
                )  # From theme file content

                # The original theme.base option should show CLI flag as source
                # But after inheritance, theme.base gets the value from the theme file
                # Let's verify a non-base option shows the CLI flag was the trigger
                assert "theme file:" in config.get_where_defined("theme.primaryColor")

    def test_theme_inheritance_with_base_via_env_var(self):
        """Test theme inheritance when theme.base is set via direct environment variable."""
        theme_content = """
        [theme]
        base = "dark"
        primaryColor = "#00ff00"
        backgroundColor = "#000000"
        textColor = "#ffffff"
        """

        with self._theme_file(theme_content) as theme_file:
            # Test direct environment variable (not processed by Click)
            with patch.dict(os.environ, {"STREAMLIT_THEME_BASE": theme_file}):
                # Patch both config and config_util os.path.exists for comprehensive mocking
                with patch("streamlit.config.open", mock_open(read_data="")):
                    with patch("streamlit.config.os.path.exists") as config_mock_exists:
                        with patch(
                            "streamlit.config_util.os.path.exists"
                        ) as util_mock_exists:

                            def mock_path_exists(path):
                                # Allow theme file and empty config file to exist
                                return path == theme_file or path.endswith(
                                    ".streamlit/config.toml"
                                )

                            config_mock_exists.side_effect = mock_path_exists
                            util_mock_exists.side_effect = mock_path_exists

                            config.get_config_options(force_reparse=True)

                            # Manually trigger env var processing for testing
                            # (In real usage this would be automatic for sensitive options)
                            config._set_option(
                                "theme.base", theme_file, config._DEFINED_BY_ENV_VAR
                            )

                            # Re-run theme inheritance after env var is set
                            # Theme file exists and both modules can access it
                            config_util.process_theme_inheritance(
                                config._config_options,
                                config._config_options_template,
                                config._set_option,
                            )

                            # Verify theme inheritance worked with direct env var
                            assert (
                                config.get_option("theme.base") == "dark"
                            )  # From theme file content
                            assert (
                                config.get_option("theme.primaryColor") == "#00ff00"
                            )  # From theme file content

                            # Verify it shows as coming from theme file (since inheritance processed it)
                            assert "theme file:" in config.get_where_defined(
                                "theme.primaryColor"
                            )

    def test_cli_flag_overrides_env_var_precedence(self):
        """Test that CLI flags have higher precedence than environment variables."""
        # This test demonstrates precedence by showing that when config.get_config_options()
        # processes both env vars and CLI flags, CLI flags take precedence

        env_theme_content = """[theme]\nbase = "dark"\nprimaryColor = "#000000" """
        cli_theme_content = """[theme]\nbase = "light"\nprimaryColor = "#ffffff" """

        with self._theme_file(env_theme_content, "env_theme.toml") as env_theme_file:
            with self._theme_file(
                cli_theme_content, "cli_theme.toml"
            ) as cli_theme_file:
                config_toml = ""  # Empty config file

                with self._config_patches(config_toml):
                    with patch("streamlit.config.os.path.exists") as mock_exists:
                        mock_exists.side_effect = lambda path: path in [
                            env_theme_file,
                            cli_theme_file,
                        ]

                        # First simulate env var processing
                        config.get_config_options(force_reparse=True)
                        config._set_option(
                            "theme.base", env_theme_file, config._DEFINED_BY_ENV_VAR
                        )

                        # Then simulate CLI flag processing (higher precedence)
                        # This simulates what happens in get_config_options when options_from_flags is provided
                        config._set_option(
                            "theme.base", cli_theme_file, config._DEFINED_BY_FLAG
                        )

                        # Run theme inheritance with the final CLI flag value
                        config_util.process_theme_inheritance(
                            config._config_options,
                            config._config_options_template,
                            config._set_option,
                        )

                        # CLI flag should win - theme content comes from cli_theme_file
                        assert (
                            config.get_option("theme.base") == "light"
                        )  # From CLI theme file
                        assert (
                            config.get_option("theme.primaryColor") == "#ffffff"
                        )  # From CLI theme file
                        assert "theme file:" in config.get_where_defined(
                            "theme.primaryColor"
                        )

    def test_theme_inheritance_with_base_via_command_flag(self):
        """Test theme inheritance when theme.base is passed via command line flag."""
        base_content = """
        [theme]
        base = "light"
        primaryColor = "#ff0000"
        backgroundColor = "#ffffff"
        font = "serif"
        """

        with self._theme_file(base_content) as theme_file:
            # Simulate command line flag - theme.base gets processed, then inheritance loads the theme
            options_from_flags = {
                "theme.base": theme_file,
            }

            with patch("streamlit.config.os.path.exists") as mock_exists:
                mock_exists.side_effect = lambda path: path == theme_file

                config.get_config_options(
                    force_reparse=True, options_from_flags=options_from_flags
                )

                # Base theme file values are loaded
                assert config.get_option("theme.base") == "light"
                assert config.get_option("theme.primaryColor") == "#ff0000"
                assert config.get_option("theme.backgroundColor") == "#ffffff"
                assert config.get_option("theme.font") == "serif"
                assert "theme file:" in config.get_where_defined("theme.primaryColor")

    def test_theme_inheritance_complex_precedence(self):
        """Test complex precedence scenario for theme.base and config.toml overrides."""
        # Create a base theme file
        base_theme_content = """
        [theme]
        base = "dark"
        primaryColor = "#ff0000"
        backgroundColor = "#000000"
        textColor = "#ffffff"
        font = "serif"
        borderColor = "#333333"

        [theme.dark]
        linkColor = "#7851A9"
        borderColor = "#361551"

        [theme.sidebar]
        primaryColor = "#ff4444"
        backgroundColor = "#111111"

        [theme.dark.sidebar]
        blueColor = "#4169e1"
        greenColor = "#355E3B"
        """

        with self._theme_file(base_theme_content, "base_theme.toml") as base_theme_file:
            # Config file references the base theme but overrides some values
            config_toml = f"""
            [theme]
            base = "{base_theme_file}"
            primaryColor = "#00ff00"
            # backgroundColor should come from base theme
            textColor = "#cccccc"

            [theme.dark]
            linkColor = "#CD1C18"

            [theme.sidebar]
            backgroundColor = "#222222"
            # primaryColor should come from base theme

            [theme.dark.sidebar]
            blueColor = "#ADD8E6"
            """

            with self._config_patches(config_toml, theme_files=[base_theme_file]):
                config.get_config_options(force_reparse=True)

                # Verify complex precedence: base theme file < config overrides
                assert config.get_option("theme.base") == "dark"  # From base theme
                assert (
                    config.get_option("theme.primaryColor") == "#00ff00"
                )  # Config overrides base
                assert (
                    config.get_option("theme.backgroundColor") == "#000000"
                )  # From base theme (no override)
                assert (
                    config.get_option("theme.textColor") == "#cccccc"
                )  # Config overrides base
                assert (
                    config.get_option("theme.dark.linkColor") == "#CD1C18"
                )  # Config overrides base
                assert (
                    config.get_option("theme.dark.borderColor") == "#361551"
                )  # From base theme (no config override)
                assert (
                    config.get_option("theme.font") == "serif"
                )  # From base theme (no override)
                assert (
                    config.get_option("theme.borderColor") == "#333333"
                )  # From base theme (no override)
                assert (
                    config.get_option("theme.dark.sidebar.blueColor") == "#ADD8E6"
                )  # Config override

                # Sidebar precedence
                assert (
                    config.get_option("theme.sidebar.primaryColor") == "#ff4444"
                )  # From base theme (no config override)
                assert (
                    config.get_option("theme.sidebar.backgroundColor") == "#222222"
                )  # Config override
                assert (
                    config.get_option("theme.dark.sidebar.greenColor") == "#355E3B"
                )  # From base theme (no override)

                # Verify where_defined is correct
                assert "theme file:" in config.get_where_defined(
                    "theme.backgroundColor"
                )
                assert "theme file:" in config.get_where_defined("theme.textColor")

    def test_theme_inheritance_preserves_env_var_and_flag_precedence(self):
        """Test that theme inheritance preserves environment variables and command line flags."""
        theme_content = """
        [theme]
        base = "dark"
        primaryColor = "#00ff00"
        backgroundColor = "#000000"
        font = "serif"
        borderColor = "#333333"
        """

        with self._theme_file(theme_content) as theme_file:
            # Config file references theme file and sets some overrides
            config_toml = f"""
            [theme]
            base = "{theme_file}"
            primaryColor = "#ff0000"
            textColor = "#ffffff"

            [theme.dark]
            linkColor = "#7851A9"
            """

            # Simulate environment variable and command line flag (higher precedence)
            options_from_flags = {
                # Env var would be processed as flag by Click framework
                "theme.font": "Arial",  # Should override theme file's "serif"
                "theme.borderColor": "#999999",  # Should override theme file's "#333333"
                "theme.dark.linkColor": "#CD1C18",  # Should override theme file's "#7851A9"
                "theme.linkColor": "#0066cc",  # New value not in theme file or config
            }

            with self._config_patches(config_toml, theme_files=[theme_file]):
                config.get_config_options(
                    force_reparse=True, options_from_flags=options_from_flags
                )

                # Verify correct precedence hierarchy:
                # 1. Theme file base values
                assert config.get_option("theme.base") == "dark"  # From theme file
                assert (
                    config.get_option("theme.backgroundColor") == "#000000"
                )  # From theme file (no override)

                # 2. Config file overrides
                assert (
                    config.get_option("theme.primaryColor") == "#ff0000"
                )  # Config overrides theme
                assert (
                    config.get_option("theme.textColor") == "#ffffff"
                )  # From config (not in theme)

                # 3. Environment variables and command line flags (higher precedence)
                assert (
                    config.get_option("theme.font") == "Arial"
                )  # Flag/env overrides theme file
                assert (
                    config.get_option("theme.borderColor") == "#999999"
                )  # Flag/env overrides theme file
                assert (
                    config.get_option("theme.dark.linkColor") == "#CD1C18"
                )  # Flag/env overrides theme file
                assert (
                    config.get_option("theme.linkColor") == "#0066cc"
                )  # New value from flag/env

                # Verify where_defined is correct for high-precedence options
                assert "command-line" in config.get_where_defined("theme.font").lower()
                assert (
                    "command-line"
                    in config.get_where_defined("theme.borderColor").lower()
                )
                assert (
                    "command-line"
                    in config.get_where_defined("theme.linkColor").lower()
                )

    def test_theme_complex_inheritance_preserves_env_var_and_flag_precedence(self):
        """Test that theme inheritance with sections/subsections preserves environment
        variables and command line flags."""
        theme_content = """
        [theme]
        base = "dark"
        primaryColor = "#00ff00"

        [theme.light]
        font = "sans-serif"
        backgroundColor = "#000000"

        [theme.dark]
        font = "serif"

        [theme.sidebar]
        textColor = "#ffffff"
        borderColor = "#333333"

        [theme.light.sidebar]
        borderColor = "#999999"

        [theme.dark.sidebar]
        linkColor = "#cccccc"
        """

        with self._theme_file(theme_content) as theme_file:
            # Config file references theme file and sets some overrides
            config_toml = f"""
            [theme]
            base = "{theme_file}"
            primaryColor = "#ff0000"

            [theme.dark]
            linkColor = "#7851A9"

            [theme.sidebar]
            textColor = "#cccccc"

            [theme.light.sidebar]
            borderColor = "#888888"

            [theme.dark.sidebar]
            linkColor = "#ADD8E6"
            """

            # Simulate environment variable and command line flag (higher precedence)
            options_from_flags = {
                # Env var would be processed as flag by Click framework
                "theme.primaryColor": "#ff6b6b",  # Should override base/config toml
                "theme.light.font": "Arial",  # Should override theme file's "sans-serif"
                "theme.sidebar.borderColor": "#999999",  # Should override theme file's "#333333"
                "theme.dark.linkColor": "#CD1C18",  # Should override theme file's "#7851A9"
                "theme.dark.sidebar.linkColor": "#4169e1",  # Should override config file's "#ADD8E6"
                "theme.linkColor": "#0066cc",  # New value not in theme file or config
            }

            with self._config_patches(config_toml, theme_files=[theme_file]):
                config.get_config_options(
                    force_reparse=True, options_from_flags=options_from_flags
                )

                # Verify correct precedence hierarchy:
                # 1. Theme file base values
                assert config.get_option("theme.base") == "dark"  # From theme file
                assert config.get_option("theme.light.backgroundColor") == "#000000"
                assert config.get_option("theme.dark.font") == "serif"

                # 2. Config file overrides
                assert config.get_option("theme.sidebar.textColor") == "#cccccc"
                assert config.get_option("theme.light.sidebar.borderColor") == "#888888"

                # 3. Environment variables and command line flags (higher precedence)
                assert config.get_option("theme.primaryColor") == "#ff6b6b"
                assert config.get_option("theme.light.font") == "Arial"
                assert config.get_option("theme.dark.linkColor") == "#CD1C18"
                assert config.get_option("theme.sidebar.borderColor") == "#999999"
                assert config.get_option("theme.dark.sidebar.linkColor") == "#4169e1"
                assert config.get_option("theme.linkColor") == "#0066cc"

                # Verify where_defined is correct
                assert (
                    "theme file"
                    in config.get_where_defined("theme.light.backgroundColor").lower()
                )
                assert (
                    "theme file"
                    in config.get_where_defined("theme.sidebar.textColor").lower()
                )
                assert (
                    "command-line"
                    in config.get_where_defined("theme.primaryColor").lower()
                )
                assert (
                    "command-line"
                    in config.get_where_defined("theme.light.font").lower()
                )
                assert (
                    "command-line"
                    in config.get_where_defined("theme.linkColor").lower()
                )

    def test_theme_inheritance_default_to_light(self):
        """Test config.toml referencing a theme file with no base specified defaults to "light"."""
        # Create base theme file WITHOUT base property
        theme_without_base = """
        [theme]
        primaryColor = "#ff0000"
        backgroundColor = "#000000"
        textColor = "#ffffff"
        font = "Inter"
        """

        with self._theme_file(theme_without_base, "external_theme.toml") as theme_file:
            # config.toml references the theme file via base (not "light"/"dark")
            config_toml = f"""
            [theme]
            base = "{theme_file}"
            primaryColor = "#ff6b6b"  # Config override
            """

            with self._config_patches(config_toml, theme_files=[theme_file]):
                config.get_config_options(force_reparse=True)

                # THE CRITICAL TEST: theme.base must be valid for app_session
                final_base = config.get_option("theme.base")
                assert final_base in ("light", "dark"), (
                    f"theme.base should be 'light' or 'dark', got '{final_base}'"
                )
                assert final_base == "light"  # Should default to light

                # Verify where_defined shows the default behavior
                where_defined = config.get_where_defined("theme.base")
                assert "theme file:" in where_defined
                assert "(default)" in where_defined
                assert theme_file in where_defined

                # Verify theme inheritance worked correctly for other options
                assert (
                    config.get_option("theme.primaryColor") == "#ff6b6b"
                )  # Config override
                assert (
                    config.get_option("theme.backgroundColor") == "#000000"
                )  # From theme file
                assert (
                    config.get_option("theme.textColor") == "#ffffff"
                )  # From theme file
                assert config.get_option("theme.font") == "Inter"  # From theme file

                # This is what app_session.py expects - valid base values only
                base_map = {"light": "LIGHT", "dark": "DARK"}
                assert final_base in base_map, (
                    "app_session would log warning without this fix"
                )

    def test_theme_inheritance_cli_env_var_default_to_light(self):
        """Test that CLI/env var theme.base pointing to file with no base specified defaults to "light"."""
        # Create theme file WITHOUT base property
        theme_without_base = """
        [theme]
        primaryColor = "#00ff00"
        backgroundColor = "#111111"
        textColor = "#cccccc"
        # CRITICAL: No base property in external theme file
        """

        with self._theme_file(theme_without_base, "cli_theme.toml") as theme_file:
            # Simulate CLI flag or environment variable setting theme.base to file path
            options_from_flags = {
                "theme.base": theme_file,  # This would be set by CLI or env var
                "theme.textColor": "#ffffff",  # CLI override to test precedence
            }

            # No config.toml file - only CLI/env var input
            with patch("streamlit.config.get_config_files") as mock_get_files:
                mock_get_files.return_value = []  # No config files

                config.get_config_options(
                    force_reparse=True, options_from_flags=options_from_flags
                )

                # THE CRITICAL TEST: theme.base must be valid for app_session
                final_base = config.get_option("theme.base")
                assert final_base in ("light", "dark"), (
                    f"theme.base should be 'light' or 'dark', got '{final_base}'"
                )
                assert final_base == "light"  # Should default to light

                # Verify CLI override precedence is preserved
                assert config.get_option("theme.textColor") == "#ffffff"  # CLI override
                where_defined_color = config.get_where_defined("theme.textColor")
                assert "command-line" in where_defined_color.lower()

                # Verify other options come from theme file
                assert (
                    config.get_option("theme.primaryColor") == "#00ff00"
                )  # From theme file
                assert (
                    config.get_option("theme.backgroundColor") == "#111111"
                )  # From theme file

                # Verify where_defined for base shows it's from theme file with default
                where_defined_base = config.get_where_defined("theme.base")
                assert "theme file:" in where_defined_base
                assert "(default)" in where_defined_base

                # Simulate what app_session.py would check (this was the warning source)
                base_map = {"light": "LIGHT", "dark": "DARK"}
                assert final_base in base_map, "This prevents app_session warning!"

    # Testing expected error scenarios:

    def test_theme_base_missing_file_error(self):
        """Test error handling when referenced file in theme.base is missing."""
        config_toml = """
        [theme]
        base = "nonexistent_theme.toml"
        """

        with self._config_patches(config_toml):  # No theme files exist
            with pytest.raises(FileNotFoundError) as cm:
                config.get_config_options()

            assert "Theme file not found" in str(cm.value)

    def test_theme_base_nested_base_error(self):
        """Test error when referenced file in theme.base, has theme.base pointing to another theme file."""
        base_content = """
        [theme]
        base = "another_theme.toml"
        primaryColor = "#00ff41"
        """

        with self._theme_file(base_content) as theme_file:
            config_toml = f"""
            [theme]
            base = "{theme_file}"
            """

            with self._config_patches(config_toml, theme_files=[theme_file]):
                with pytest.raises(StreamlitInvalidThemeError) as cm:
                    config.get_config_options()

                assert "cannot reference another theme file" in str(cm.value)

    def test_theme_base_invalid_section(self):
        """Test error when theme file contains invalid sections."""
        theme_content = """
        [theme]
        base = "dark"
        primaryColor = "#00ff41"

        [theme.invalidSection]
        primaryColor = "#ff0000"
        """

        with self._theme_file(theme_content) as theme_file:
            config_toml = f"""
            [theme]
            base = "{theme_file}"
            """

            with self._config_patches(config_toml, theme_files=[theme_file]):
                with pytest.raises(StreamlitInvalidThemeSectionError) as cm:
                    config.get_config_options()

                assert "Invalid theme section" in str(cm.value)
                assert "invalidSection" in str(cm.value)

    def test_theme_base_no_theme_section_error(self):
        """Test error when theme file is missing [theme] section."""
        theme_content = """
        [server]
        port = 8501
        """

        with self._theme_file(theme_content) as theme_file:
            config_toml = f"""
            [theme]
            base = "{theme_file}"
            """

            with self._config_patches(config_toml, theme_files=[theme_file]):
                with pytest.raises(StreamlitInvalidThemeSectionError) as cm:
                    config.get_config_options()

                assert "must contain a [theme] section" in str(cm.value)

    def test_theme_base_malformed_error(self):
        """Test malformed theme file triggers error."""
        # Test: Theme file with invalid TOML syntax
        malformed_theme_content = """
        [theme
        primaryColor = "#ff0000"
        """

        with self._theme_file(
            malformed_theme_content, "malformed.toml"
        ) as malformed_theme_file:
            config_toml = f"""
            [theme]
            base = "{malformed_theme_file}"
            """

            with self._config_patches(config_toml, theme_files=[malformed_theme_file]):
                with pytest.raises(StreamlitInvalidThemeError) as cm:
                    config.get_config_options()

                assert "Error loading theme file" in str(cm.value)

    @patch("streamlit.config_util.url_util.is_url")
    @patch("streamlit.config_util.urllib.request.urlopen")
    def test_theme_base_url_network_error(self, mock_urlopen, mock_is_url):
        """Test error handling for URL network errors."""
        mock_is_url.return_value = True

        import urllib.error

        mock_urlopen.side_effect = urllib.error.URLError("Network error")

        config_toml = """
        [theme]
        base = "https://example.com/theme.toml"
        """

        with self._config_patches(config_toml):
            with pytest.raises(StreamlitInvalidThemeError) as cm:
                config.get_config_options()

            assert "Could not load theme file from URL" in str(cm.value)
