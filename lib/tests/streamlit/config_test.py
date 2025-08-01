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
import textwrap
import unittest
from unittest.mock import MagicMock, mock_open, patch

import pytest
from parameterized import parameterized

from streamlit import config, env_util
from streamlit.config import CustomThemeCategories, ShowErrorDetailsConfigOptions
from streamlit.config_option import ConfigOption
from streamlit.errors import StreamlitAPIException

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
            match="Complex config options require doc strings for their description.",
        ):

            @ConfigOption("_test.noDocString")
            def no_doc_string():
                pass

    def test_invalid_config_name(self):
        """Test setting an invalid config section."""
        with pytest.raises(
            ValueError,
            match='Key "_test.myParam." has invalid format.',
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
            match='Cannot define section "_test2" twice.',
        ):
            config._create_section("_test2", "A test section.")
            config._create_section("_test2", "A test section.")

    def test_cannot_overwrite_config_key(self):
        """Test overwriting a config option using _create_option."""
        with pytest.raises(
            RuntimeError,
            match='Cannot define option "_test.overwriteKey" twice.',
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
            match='Key "_test.snake_case" has invalid format.',
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
                "theme.sidebar",
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
        config_options = sorted(
            [
                "browser.gatherUsageStats",
                "browser.serverAddress",
                "browser.serverPort",
                "client.showErrorDetails",
                "client.showSidebarNavigation",
                "client.toolbarMode",
                "theme.base",
                "theme.primaryColor",
                "theme.backgroundColor",
                "theme.secondaryBackgroundColor",
                "theme.textColor",
                "theme.baseFontSize",
                "theme.baseFontWeight",
                "theme.baseRadius",
                "theme.buttonRadius",
                "theme.font",
                "theme.headingFont",
                "theme.codeFont",
                "theme.codeFontSize",
                "theme.codeFontWeight",
                "theme.headingFontSizes",
                "theme.headingFontWeights",
                "theme.fontFaces",
                "theme.borderColor",
                "theme.dataframeBorderColor",
                "theme.showWidgetBorder",
                "theme.linkColor",
                "theme.linkUnderline",
                "theme.codeBackgroundColor",
                "theme.dataframeHeaderBackgroundColor",
                "theme.showSidebarBorder",
                "theme.chartCategoricalColors",
                "theme.chartSequentialColors",
                "theme.sidebar.primaryColor",
                "theme.sidebar.backgroundColor",
                "theme.sidebar.secondaryBackgroundColor",
                "theme.sidebar.textColor",
                "theme.sidebar.baseRadius",
                "theme.sidebar.buttonRadius",
                "theme.sidebar.font",
                "theme.sidebar.headingFont",
                "theme.sidebar.codeFont",
                "theme.sidebar.codeFontSize",
                "theme.sidebar.codeFontWeight",
                "theme.sidebar.headingFontSizes",
                "theme.sidebar.headingFontWeights",
                "theme.sidebar.borderColor",
                "theme.sidebar.dataframeBorderColor",
                "theme.sidebar.showWidgetBorder",
                "theme.sidebar.linkColor",
                "theme.sidebar.linkUnderline",
                "theme.sidebar.codeBackgroundColor",
                "theme.sidebar.dataframeHeaderBackgroundColor",
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
                "server.baseUrlPath",
                "server.customComponentBaseUrlPath",
                "server.enableCORS",
                "server.cookieSecret",
                "server.corsAllowedOrigins",
                "server.scriptHealthCheckEnabled",
                "server.enableWebsocketCompression",
                "server.enableXsrfProtection",
                "server.fileWatcherType",
                "server.folderWatchList",
                "server.folderWatchBlacklist",
                "server.headless",
                "server.showEmailPrompt",
                "server.address",
                "server.allowRunOnSave",
                "server.port",
                "server.runOnSave",
                "server.maxUploadSize",
                "server.maxMessageSize",
                "server.enableStaticServing",
                "server.enableArrowTruncation",
                "server.sslCertFile",
                "server.sslKeyFile",
                "server.disconnectedSessionTTL",
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
            match="server.port does not work when global.developmentMode is true.",
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
            match="browser.serverPort does not work when global.developmentMode is true.",
        ):
            config._check_conflicts()

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
            "codeBackgroundColor": None,
            "dataframeHeaderBackgroundColor": None,
            "showSidebarBorder": None,
            "headingFontSizes": None,
            "headingFontWeights": None,
            "chartCategoricalColors": None,
            "chartSequentialColors": None,
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
        config._set_option("theme.sidebar.codeBackgroundColor", "#29361e", "test")
        config._set_option(
            "theme.sidebar.dataframeHeaderBackgroundColor", "#29361e", "test"
        )

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
            "codeBackgroundColor": "#29361e",
            "dataframeHeaderBackgroundColor": "#29361e",
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
