# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Config System Unittest."""

import copy
import os
import textwrap
import unittest

import pytest

from mock import patch

from streamlit import config
from streamlit.ConfigOption import ConfigOption

SECTION_DESCRIPTIONS = copy.deepcopy(config._section_descriptions)
CONFIG_OPTIONS = copy.deepcopy(config._config_options)


class ConfigTest(unittest.TestCase):
    """Test the config system."""

    def setUp(self):
        self.patch1 = patch.object(
            config, "_section_descriptions", new=copy.deepcopy(SECTION_DESCRIPTIONS)
        )
        self.patch2 = patch.object(
            config, "_config_options", new=copy.deepcopy(CONFIG_OPTIONS)
        )
        self.patch1.start()
        self.patch2.start()

    def tearDown(self):
        self.patch1.stop()
        self.patch2.stop()
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

        This is becuase the doc string forms the option's description.
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
        config.set_option("s3.bucket", "some.bucket")
        config._delete_option("s3.bucket")
        with pytest.raises(RuntimeError) as e:
            config.get_option("s3.bucket")
        self.assertEqual(str(e.value), 'Config key "s3.bucket" not defined.')

        config._delete_option("s3.bucket")

    def test_sections_order(self):
        sections = sorted(
            ["_test", u"browser", u"client", u"global", u"runner", u"s3", u"server"]
        )
        keys = sorted(list(config._section_descriptions.keys()))
        self.assertEqual(sections, keys)

    def test_config_option_keys(self):
        config_options = sorted(
            [
                u"browser.gatherUsageStats",
                u"browser.serverAddress",
                u"browser.serverPort",
                u"client.caching",
                u"client.displayEnabled",
                u"global.developmentMode",
                u"global.disableWatchdogWarning",
                u"global.logLevel",
                u"global.maxCachedMessageAge",
                u"global.minCachedMessageSize",
                u"global.metrics",
                u"global.sharingMode",
                u"global.showWarningOnDirectExecution",
                u"global.unitTest",
                u"global.useNode",
                u"runner.magicEnabled",
                u"runner.installTracer",
                u"runner.fixMatplotlib",
                u"s3.accessKeyId",
                u"s3.bucket",
                u"s3.keyPrefix",
                u"s3.profile",
                u"s3.region",
                u"s3.requireLoginToView",
                u"s3.secretAccessKey",
                u"s3.url",
                u"server.enableCORS",
                u"server.folderWatchBlacklist",
                u"server.headless",
                u"server.liveSave",
                u"server.port",
                u"server.runOnSave",
            ]
        )
        keys = sorted(config._config_options.keys())
        self.assertEqual(config_options, keys)

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
            u"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            u"Curabitur ac fermentum eros.",
            u"Maecenas libero est, ultricies eget ligula eget,",
        ]

        result = config._clean_paragraphs(input)
        self.assertEqual(truth, result)

    def test_clean(self):
        result = config._clean(" clean    this         text  ")
        self.assertEqual("clean this text", result)

    def test_check_conflicts_2(self):
        config._set_option("global.developmentMode", True, "test")
        config._set_option("server.port", 1234, "test")
        with pytest.raises(AssertionError) as e:
            config._check_conflicts()
        self.assertEqual(
            str(e.value),
            "server.port does not work when global.developmentMode is true.",
        )

    def test_check_conflicts_2a(self):
        config._set_option("global.developmentMode", True, "test")
        config._set_option("browser.serverPort", 1234, "test")
        with pytest.raises(AssertionError) as e:
            config._check_conflicts()
        self.assertEqual(
            str(e.value),
            "browser.serverPort does not work when global.developmentMode is " "true.",
        )

    def test_check_conflicts_3(self):
        with pytest.raises(AssertionError) as e:
            config._set_option("global.sharingMode", "s3", "test")
            config._set_option("s3.bucket", None, "<default>")
            config._check_conflicts()
        self.assertEqual(
            str(e.value),
            'When global.sharingMode is set to "s3", s3.bucket must also be set',
        )

    def test_check_conflicts_4(self):
        with pytest.raises(AssertionError) as e:
            config._set_option("global.sharingMode", "s3", "test")
            config._set_option("s3.bucket", "some.bucket", "test")
            config._set_option("s3.accessKeyId", "some.key", "test")
            config._set_option("s3.secretAccessKey", None, "<default>")
            config._check_conflicts()
        self.assertEqual(
            str(e.value),
            "In config.toml, s3.accessKeyId and s3.secretAccessKey must either both be set or both be unset.",
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
        with pytest.raises(AssertionError) as e:
            config._set_option("not.defined", "no.value", "test")
        self.assertEqual(str(e.value), 'Key "not.defined" is not defined.')

        config._set_option("client.caching", "test", "test")
        self.assertEqual("test", config.get_option("client.caching"))

    def test_is_manually_set(self):
        config._set_option("s3.bucket", "some.bucket", "test")
        self.assertEqual(True, config.is_manually_set("s3.bucket"))

        config._set_option("s3.bucket", "some.bucket", "<default>")
        self.assertEqual(False, config.is_manually_set("s3.bucket"))

    def test_is_unset(self):
        config._set_option("s3.bucket", "some.bucket", "test")
        self.assertEqual(False, config._is_unset("s3.bucket"))

        config._set_option("s3.bucket", "some.bucket", "<default>")
        self.assertEqual(True, config._is_unset("s3.bucket"))

    def test_get_where_defined(self):
        config._set_option("s3.bucket", "some.bucket", "test")
        self.assertEqual("test", config.get_where_defined("s3.bucket"))

        with pytest.raises(RuntimeError) as e:
            config.get_where_defined("doesnt.exist")
        self.assertEqual(str(e.value), 'Config key "doesnt.exist" not defined.')

    def test_get_options(self):
        config._set_option("s3.bucket", "some.bucket", "test")
        self.assertEqual("some.bucket", config.get_option("s3.bucket"))

        with pytest.raises(RuntimeError) as e:
            config.get_option("doesnt.exist")
        self.assertEqual(str(e.value), 'Config key "doesnt.exist" not defined.')

    def test_s3(self):
        self.assertEqual(None, config.get_option("s3.secretAccessKey"))
        self.assertEqual(None, config.get_option("s3.accessKeyId"))
        self.assertEqual(None, config.get_option("s3.url"))
        self.assertEqual(None, config.get_option("s3.bucket"))

    def test_browser_server_port(self):
        config.set_option("server.port", 1234)
        self.assertEqual(1234, config.get_option("browser.serverPort"))

    def test_server_headless_via_liveSave(self):
        config.set_option("server.liveSave", True)
        self.assertEqual(True, config.get_option("server.headless"))

    def test_server_headless_via_atom_plugin(self):
        os.environ["IS_RUNNING_IN_STREAMLIT_EDITOR_PLUGIN"] = "True"

        config.set_option("server.liveSave", False)
        self.assertEqual(True, config.get_option("server.headless"))

        del os.environ["IS_RUNNING_IN_STREAMLIT_EDITOR_PLUGIN"]

    def test_server_headless(self):
        orig_display = None
        if "DISPLAY" in os.environ.keys():
            orig_display = os.environ["DISPLAY"]
            del os.environ["DISPLAY"]

        with patch("streamlit.config.platform.system") as p:
            p.return_value = "Linux"
            self.assertEqual(True, config.get_option("server.headless"))

        if orig_display:
            os.environ["DISPLAY"] = orig_display

    def test_global_dev_mode(self):
        config.set_option("global.developmentMode", True)
        self.assertEqual(True, config.get_option("global.developmentMode"))

    def test_global_log_level_debug(self):
        config.set_option("global.developmentMode", True)
        self.assertEqual(u"debug", config.get_option("global.logLevel"))

    def test_global_log_level(self):
        config.set_option("global.developmentMode", False)
        self.assertEqual(u"info", config.get_option("global.logLevel"))
