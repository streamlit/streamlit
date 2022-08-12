"""Config System Unittest."""
from unittest.mock import MagicMock, mock_open, patch
import copy
import os
import textwrap
import unittest

import pytest
from parameterized import parameterized

from streamlit import config
from streamlit import env_util
from streamlit.config_option import ConfigOption

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
        ]

        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

        try:
            del os.environ["TEST_ENV_VAR"]
        except Exception:
            pass
        config._delete_option("_test.tomlTest")

    def test_simple_config_option(self):
        """Test creating a simple (constant) config option."""
        # Create the config option.
        config_option = ConfigOption(
            "_test.simpleParam", description="Simple config option.", default_val=12345
        )

        # Test that it works.
        self.assertEqual(config_option.key, "_test.simpleParam")
        self.assertEqual(config_option.section, "_test")
        self.assertEqual(config_option.name, "simpleParam")
        self.assertEqual(config_option.description, "Simple config option.")
        self.assertEqual(config_option.where_defined, ConfigOption.DEFAULT_DEFINITION)
        self.assertEqual(config_option.value, 12345)

    def test_complex_config_option(self):
        """Test setting a complex (functional) config option."""
        # Create the config option.
        @ConfigOption("_test.complexParam")
        def config_option():
            """Complex config option."""
            return 12345

        # Test that it works.
        self.assertEqual(config_option.key, "_test.complexParam")
        self.assertEqual(config_option.section, "_test")
        self.assertEqual(config_option.name, "complexParam")
        self.assertEqual(config_option.description, "Complex config option.")
        self.assertEqual(config_option.where_defined, ConfigOption.DEFAULT_DEFINITION)
        self.assertEqual(config_option.value, 12345)

    def test_complex_config_option_must_have_doc_strings(self):
        """Test that complex config options use funcs with doc stringsself.

        This is because the doc string forms the option's description.
        """
        with self.assertRaises(AssertionError):

            @ConfigOption("_test.noDocString")
            def no_doc_string():
                pass

    def test_invalid_config_name(self):
        """Test setting an invalid config section."""
        with self.assertRaises(AssertionError):
            ConfigOption("_test.myParam.")

    def test_invalid_config_section(self):
        """Test setting an invalid config section."""
        with self.assertRaises(AssertionError):
            config._create_option("mySection.myParam")

    def test_cannot_overwrite_config_section(self):
        """Test overwriting a config section using _create_section."""
        with self.assertRaises(AssertionError):
            config._create_section("_test2", "A test section.")
            config._create_section("_test2", "A test section.")

    def test_cannot_overwrite_config_key(self):
        """Test overwriting a config option using _create_option."""
        with self.assertRaises(AssertionError):
            config._create_option("_test.overwriteKey")
            config._create_option("_test.overwriteKey")

    def test_param_names_are_camel_case(self):
        """Test that param names must be camelCase.

        Note the exception is the "_test" section which is used
        for unit testing.
        """
        with self.assertRaises(AssertionError):
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
        self.assertEqual(config.get_option("_test.independentOption"), DUMMY_VAL_1)
        self.assertEqual(config.get_option("_test.dependentOption"), DUMMY_VAL_1)
        self.assertEqual(
            config.get_where_defined("_test.independentOption"),
            ConfigOption.DEFAULT_DEFINITION,
        )
        self.assertEqual(
            config.get_where_defined("_test.dependentOption"),
            ConfigOption.DEFAULT_DEFINITION,
        )

        # Override the independent option. Both update!
        config.set_option("_test.independentOption", DUMMY_VAL_2)
        self.assertEqual(config.get_option("_test.independentOption"), DUMMY_VAL_2)
        self.assertEqual(config.get_option("_test.dependentOption"), DUMMY_VAL_2)
        self.assertEqual(
            config.get_where_defined("_test.independentOption"), config._USER_DEFINED
        )
        self.assertEqual(
            config.get_where_defined("_test.dependentOption"),
            ConfigOption.DEFAULT_DEFINITION,
        )

        # Override the dependent option. Only that updates!
        config.set_option("_test.dependentOption", DUMMY_VAL_3)
        self.assertEqual(config.get_option("_test.independentOption"), DUMMY_VAL_2)
        self.assertEqual(config.get_option("_test.dependentOption"), DUMMY_VAL_3)
        self.assertEqual(
            config.get_where_defined("_test.independentOption"), config._USER_DEFINED
        )
        self.assertEqual(
            config.get_where_defined("_test.dependentOption"), config._USER_DEFINED
        )

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
        self.assertEqual(config.get_option("_test.tomlTest"), DUMMY_VAL_1)
        self.assertEqual(
            config.get_where_defined("_test.tomlTest"), ConfigOption.DEFAULT_DEFINITION
        )

        # Override it with some TOML
        NEW_TOML = (
            """
            [_test]
            tomlTest="%s"
        """
            % DUMMY_VAL_2
        )
        config._update_config_with_toml(NEW_TOML, DUMMY_DEFINITION)
        self.assertEqual(config.get_option("_test.tomlTest"), DUMMY_VAL_2)
        self.assertEqual(config.get_where_defined("_test.tomlTest"), DUMMY_DEFINITION)

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
        self.assertEqual(config.get_option("_test.tomlTest"), DEFAULT_VAL)
        self.assertEqual(
            config.get_where_defined("_test.tomlTest"), ConfigOption.DEFAULT_DEFINITION
        )

        os.environ["TEST_ENV_VAR"] = DESIRED_VAL

        # Override it with some TOML
        NEW_TOML = """
            [_test]
            tomlTest="env:TEST_ENV_VAR"
        """
        config._update_config_with_toml(NEW_TOML, DUMMY_DEFINITION)
        self.assertEqual(config.get_option("_test.tomlTest"), DESIRED_VAL)
        self.assertEqual(config.get_where_defined("_test.tomlTest"), DUMMY_DEFINITION)

    def test_delete_option(self):
        # Create a dummy default option.
        config._create_option(
            "_test.testDeleteOption",
            description="This option tests the _delete_option function.",
            default_val="delete me!",
        )
        config.get_config_options(force_reparse=True)
        self.assertEqual(config.get_option("_test.testDeleteOption"), "delete me!")

        config._delete_option("_test.testDeleteOption")

        with pytest.raises(RuntimeError) as e:
            config.get_option("_test.testDeleteOption")
        self.assertEqual(
            str(e.value), 'Config key "_test.testDeleteOption" not defined.'
        )

        config._delete_option("_test.testDeleteOption")

    def test_sections_order(self):
        sections = sorted(
            [
                "_test",
                "browser",
                "client",
                "theme",
                "deprecation",
                "global",
                "logger",
                "mapbox",
                "runner",
                "server",
                "ui",
            ]
        )
        keys = sorted(list(config._section_descriptions.keys()))
        self.assertEqual(sections, keys)

    def test_config_option_keys(self):
        config_options = sorted(
            [
                "browser.gatherUsageStats",
                "browser.serverAddress",
                "browser.serverPort",
                "client.caching",
                "client.displayEnabled",
                "client.showErrorDetails",
                "theme.base",
                "theme.primaryColor",
                "theme.backgroundColor",
                "theme.secondaryBackgroundColor",
                "theme.textColor",
                "theme.font",
                "deprecation.showfileUploaderEncoding",
                "deprecation.showImageFormat",
                "deprecation.showPyplotGlobalUse",
                "global.developmentMode",
                "global.disableWatchdogWarning",
                "global.logLevel",
                "global.maxCachedMessageAge",
                "global.minCachedMessageSize",
                "global.showWarningOnDirectExecution",
                "global.suppressDeprecationWarnings",
                "global.unitTest",
                "global.dataFrameSerialization",
                "logger.enableRich",
                "logger.level",
                "logger.messageFormat",
                "runner.magicEnabled",
                "runner.installTracer",
                "runner.fixMatplotlib",
                "runner.postScriptGC",
                "runner.fastReruns",
                "mapbox.token",
                "server.baseUrlPath",
                "server.enableCORS",
                "server.cookieSecret",
                "server.scriptHealthCheckEnabled",
                "server.enableWebsocketCompression",
                "server.enableXsrfProtection",
                "server.fileWatcherType",
                "server.folderWatchBlacklist",
                "server.headless",
                "server.address",
                "server.allowRunOnSave",
                "server.port",
                "server.runOnSave",
                "server.maxUploadSize",
                "server.maxMessageSize",
                "ui.hideTopBar",
                "ui.hideSidebarNav",
            ]
        )
        keys = sorted(config._config_options.keys())
        self.assertEqual(config_options, keys)

    def test_check_conflicts_server_port(self):
        config._set_option("global.developmentMode", True, "test")
        config._set_option("server.port", 1234, "test")
        with pytest.raises(AssertionError) as e:
            config._check_conflicts()
        self.assertEqual(
            str(e.value),
            "server.port does not work when global.developmentMode is true.",
        )

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
        with pytest.raises(AssertionError) as e:
            config._check_conflicts()
        self.assertEqual(
            str(e.value),
            "browser.serverPort does not work when global.developmentMode is true.",
        )

    def test_maybe_convert_to_number(self):
        self.assertEqual(1234, config._maybe_convert_to_number("1234"))
        self.assertEqual(1234.5678, config._maybe_convert_to_number("1234.5678"))
        self.assertEqual("1234.5678ex", config._maybe_convert_to_number("1234.5678ex"))

    def test_maybe_read_env_variable(self):
        self.assertEqual(
            "env:RANDOM_TEST", config._maybe_read_env_variable("env:RANDOM_TEST")
        )
        os.environ["RANDOM_TEST"] = "1234"
        self.assertEqual(1234, config._maybe_read_env_variable("env:RANDOM_TEST"))

    def test_update_config_with_toml(self):
        self.assertEqual(True, config.get_option("client.caching"))
        toml = textwrap.dedent(
            """
           [client]
           caching = false
        """
        )
        config._update_config_with_toml(toml, "test")
        self.assertEqual(False, config.get_option("client.caching"))

    def test_set_option(self):
        with self.assertLogs(logger="streamlit.config", level="WARNING") as cm:
            config._set_option("not.defined", "no.value", "test")
        # cm.output is a list of messages and there shouldn't be any other messages besides one created by this test
        self.assertTrue(
            '"not.defined" is not a valid config option. If you previously had this config option set, it may have been removed.'
            in cm.output[0]
        )

        config._set_option("client.caching", "test", "test")
        self.assertEqual("test", config.get_option("client.caching"))

    def test_is_manually_set(self):
        config._set_option("browser.serverAddress", "some.bucket", "test")
        self.assertEqual(True, config.is_manually_set("browser.serverAddress"))

        config._set_option("browser.serverAddress", "some.bucket", "<default>")
        self.assertEqual(False, config.is_manually_set("browser.serverAddress"))

    def test_is_unset(self):
        config._set_option("browser.serverAddress", "some.bucket", "test")
        self.assertEqual(False, config._is_unset("browser.serverAddress"))

        config._set_option("browser.serverAddress", "some.bucket", "<default>")
        self.assertEqual(True, config._is_unset("browser.serverAddress"))

    def test_get_where_defined(self):
        config._set_option("browser.serverAddress", "some.bucket", "test")
        self.assertEqual("test", config.get_where_defined("browser.serverAddress"))

        with pytest.raises(RuntimeError) as e:
            config.get_where_defined("doesnt.exist")
        self.assertEqual(str(e.value), 'Config key "doesnt.exist" not defined.')

    def test_get_option(self):
        config._set_option("browser.serverAddress", "some.bucket", "test")
        self.assertEqual("some.bucket", config.get_option("browser.serverAddress"))

        with pytest.raises(RuntimeError) as e:
            config.get_option("doesnt.exist")
        self.assertEqual(str(e.value), 'Config key "doesnt.exist" not defined.')

    def test_get_options_for_section(self):
        config._set_option("theme.primaryColor", "000000", "test")
        config._set_option("theme.font", "serif", "test")

        expected = {
            "base": None,
            "primaryColor": "000000",
            "secondaryBackgroundColor": None,
            "backgroundColor": None,
            "textColor": None,
            "font": "serif",
        }
        self.assertEqual(config.get_options_for_section("theme"), expected)

    def test_browser_server_port(self):
        # developmentMode must be False for server.port to be modified
        config.set_option("global.developmentMode", False)
        config.set_option("server.port", 1234)
        self.assertEqual(1234, config.get_option("browser.serverPort"))

    def test_server_headless_via_atom_plugin(self):
        os.environ["IS_RUNNING_IN_STREAMLIT_EDITOR_PLUGIN"] = "True"

        self.assertEqual(True, config.get_option("server.headless"))

        del os.environ["IS_RUNNING_IN_STREAMLIT_EDITOR_PLUGIN"]

    def test_server_headless(self):
        orig_display = None
        if "DISPLAY" in os.environ.keys():
            orig_display = os.environ["DISPLAY"]
            del os.environ["DISPLAY"]

        orig_is_linux_or_bsd = env_util.IS_LINUX_OR_BSD
        env_util.IS_LINUX_OR_BSD = True

        self.assertEqual(True, config.get_option("server.headless"))

        env_util.IS_LINUX_OR_BSD = orig_is_linux_or_bsd
        if orig_display:
            os.environ["DISPLAY"] = orig_display

    def test_global_dev_mode(self):
        config.set_option("global.developmentMode", True)
        self.assertEqual(True, config.get_option("global.developmentMode"))

    def test_global_log_level_debug(self):
        config.set_option("global.developmentMode", True)
        self.assertEqual("debug", config.get_option("logger.level"))

    def test_global_log_level(self):
        config.set_option("global.developmentMode", False)
        self.assertEqual("info", config.get_option("logger.level"))

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

        with patch.object(config, "_config_options", new=config_options), patch.object(
            config._on_config_parsed, "connect"
        ) as patched_connect, patch.object(
            config._on_config_parsed, "disconnect"
        ) as patched_disconnect:
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

            self.assertEqual(True, config.get_option("client.caching"))
            self.assertIsNone(config.get_option("theme.font"))

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

            self.assertEqual("sans serif", config.get_option("theme.font"))
            self.assertIsNone(config.get_option("theme.textColor"))

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

            self.assertEqual("#FFFFFF", config.get_option("theme.textColor"))
            self.assertIsNone(config.get_option("theme.font"))

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
        open = mock_open()
        open.side_effect = [global_open.return_value, local_open.return_value]

        open_patch = patch("streamlit.config.open", open)
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
            self.assertEqual("light", config.get_option("theme.base"))

            # theme.font is set in global, and not in local
            self.assertEqual("sans serif", config.get_option("theme.font"))

            # theme.textColor is set in local and not in global
            self.assertEqual("#FFFFFF", config.get_option("theme.textColor"))

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
        open = mock_open()
        open.side_effect = [global_open.return_value, local_open.return_value]

        open_patch = patch("streamlit.config.open", open)
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

            self.assertEqual("light", config.get_option("theme.base"))
            self.assertEqual("#FFFFFF", config.get_option("theme.textColor"))
            self.assertEqual("monospace", config.get_option("theme.font"))

    def test_upload_file_default_values(self):
        self.assertEqual(200, config.get_option("server.maxUploadSize"))

    def test_max_message_size_default_values(self):
        self.assertEqual(200, config.get_option("server.maxMessageSize"))

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

            self.assertEqual("dark", config.get_option("theme.base"))
            self.assertEqual("sans serif", config.get_option("theme.font"))

        global_config = """
        [theme]
        base = "dark"
        """
        open_patch = patch("streamlit.config.open", mock_open(read_data=global_config))

        with open_patch, makedirs_patch, pathexists_patch:
            config.get_config_options(force_reparse=True)

            self.assertEqual("dark", config.get_option("theme.base"))
            self.assertEqual(None, config.get_option("theme.font"))

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
