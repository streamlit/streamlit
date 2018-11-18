"""Config System Unittest."""

# import json
import unittest

from streamlit import config
from streamlit.ConfigOption import ConfigOption

class ConfigTest(unittest.TestCase):
    """Test the config system."""

    # def test_badly_formed_full_qualified_name(self):
    #     """Test setting an invalid config section."""
    #     with self.assertRaises(AssertionError):
    #         ConfigOption('_test.myParam.')

    # ALSO: add a test that you can't add the same key twice!

    def test_section_and_name_parsing(self):
        """Test setting an invalid config section."""
        config_option = ConfigOption('_test.param')
        # with self.assertRaises(AssertionError):
        #     raise RuntimeError, 'This is a test'

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
        self.assertEqual(config_option.value, 12345)

    def test_complex_config_option_must_have_doc_strings(self):
        """Test that complex config options have doc string to form
        their descriptions."""
        with self.assertRaises(AssertionError):
            @ConfigOption('_test.noDocString')
            def no_doc_string():
                pass

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
