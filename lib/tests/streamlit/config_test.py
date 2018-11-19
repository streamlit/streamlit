# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

"""Config System Unittest."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import unittest

from streamlit import config
from streamlit.ConfigOption import ConfigOption

class ConfigTest(unittest.TestCase):
    """Test the config system."""

    def test_simple_config_option(self):
        """Test creating a simple (constant) config option."""
        # Create the config option.
        config_option = ConfigOption('_test.simpleParam',
            description = 'Simple config option.',
            default_val = 12345)

        # Test that it works.
        self.assertEqual(config_option.key, '_test.simpleParam')
        self.assertEqual(config_option.section, '_test')
        self.assertEqual(config_option.name, 'simpleParam')
        self.assertEqual(config_option.description,
            'Simple config option.')
        self.assertEqual(config_option.where_defined,
            ConfigOption.DEFAULT_DEFINITION)
        self.assertEqual(config_option.value, 12345)


    def test_complex_config_option(self):
        """Test setting a complex (functional) config option."""
        # Create the config option.
        @ConfigOption('_test.complexParam')
        def config_option():
            """Complex config option."""
            return 12345

        # Test that it works.
        self.assertEqual(config_option.key, '_test.complexParam')
        self.assertEqual(config_option.section, '_test')
        self.assertEqual(config_option.name, 'complexParam')
        self.assertEqual(config_option.description,
            'Complex config option.')
        self.assertEqual(config_option.where_defined,
            ConfigOption.DEFAULT_DEFINITION)
        self.assertEqual(config_option.value, 12345)

    def test_complex_config_option_must_have_doc_strings(self):
        """Test that complex config options have doc string to form
        their descriptions."""
        with self.assertRaises(AssertionError):
            @ConfigOption('_test.noDocString')
            def no_doc_string():
                pass

    def test_invalid_config_name(self):
        """Test setting an invalid config section."""
        with self.assertRaises(AssertionError):
            ConfigOption('_test.myParam.')

    def test_invalid_config_section(self):
        """Test setting an invalid config section."""
        with self.assertRaises(AssertionError):
            config._create_option('mySection.myParam')

    def test_cannot_overwrite_config_section(self):
        """Test overwriting a config section using _create_section."""
        with self.assertRaises(AssertionError):
            config._create_section('_test2', 'A test section.')
            config._create_section('_test2', 'A test section.')

    def test_cannot_overwrite_config_key(self):
        """Test overwriting a config option using _create_option."""
        with self.assertRaises(AssertionError):
            config._create_option('_test.overwriteKey')
            config._create_option('_test.overwriteKey')

    def test_param_names_are_camel_case(self):
        """Test that param names must be camelCase.

        Note the exception is the "_test" section which is used
        for unit testing.
        """
        with self.assertRaises(AssertionError):
            config._create_option('_test.snake_case')

    def test_get_set_and_complex_config_options(self):
        """Creates a pair of config options, one of which depends on another
        and verifies that changing one changes the other.

        This also implicitly tests simple and complex ConfigOptions as well as
        get_option() and set_option().
        """
        # Some useful variables.
        DUMMY_VAL_1, DUMMY_VAL_2, DUMMY_VAL_3 = 'Steven', 'Vincent', 'Buscemi'

        # Set up both options.
        config._create_option('_test.independentOption',
            description = 'This option can change at will',
            default_val = DUMMY_VAL_1)
        @config._create_option('_test.dependentOption')
        def _test_dependent_option():
            """This depends on the value of _test.independentOption."""
            return config.get_option('_test.independentOption')

        # Check that the default values are good.
        self.assertEqual(config.get_option('_test.independentOption'),
            DUMMY_VAL_1)
        self.assertEqual(config.get_option('_test.dependentOption'),
            DUMMY_VAL_1)
        self.assertEqual(config.get_where_defined('_test.independentOption'),
            ConfigOption.DEFAULT_DEFINITION)
        self.assertEqual(config.get_where_defined('_test.dependentOption'),
            ConfigOption.DEFAULT_DEFINITION)

        # Override the independent option. Both update!
        config.set_option('_test.independentOption', DUMMY_VAL_2)
        self.assertEqual(config.get_option('_test.independentOption'),
            DUMMY_VAL_2)
        self.assertEqual(config.get_option('_test.dependentOption'),
            DUMMY_VAL_2)
        self.assertEqual(config.get_where_defined('_test.independentOption'),
            config._USER_DEFINED)
        self.assertEqual(config.get_where_defined('_test.dependentOption'),
            ConfigOption.DEFAULT_DEFINITION)

        # Override the dependent option. Only that updates!
        config.set_option('_test.dependentOption', DUMMY_VAL_3)
        self.assertEqual(config.get_option('_test.independentOption'),
            DUMMY_VAL_2)
        self.assertEqual(config.get_option('_test.dependentOption'),
            DUMMY_VAL_3)
        self.assertEqual(config.get_where_defined('_test.independentOption'),
            config._USER_DEFINED)
        self.assertEqual(config.get_where_defined('_test.dependentOption'),
            config._USER_DEFINED)

    def test_parsing_toml(self):
        """Test config._update_config_with_toml()."""
        # Some useful variables.
        DUMMY_VAL_1, DUMMY_VAL_2 = 'Christopher', 'Walken'
        DUMMY_DEFINTIION = '<test definition>'

        # Create a dummy default option.
        config._create_option('_test.tomlTest',
            description = 'This option tests the TOML parser.',
            default_val = DUMMY_VAL_1)
        self.assertEqual(config.get_option('_test.tomlTest'), DUMMY_VAL_1)
        self.assertEqual(config.get_where_defined('_test.tomlTest'),
            ConfigOption.DEFAULT_DEFINITION)

        # Override it with some TOML
        NEW_TOML = f"""
            [_test]
            tomlTest="{DUMMY_VAL_2}"
        """
        config._update_config_with_toml(NEW_TOML, DUMMY_DEFINTIION)
        self.assertEqual(config.get_option('_test.tomlTest'), DUMMY_VAL_2)
        self.assertEqual(config.get_where_defined('_test.tomlTest'),
            DUMMY_DEFINTIION)
