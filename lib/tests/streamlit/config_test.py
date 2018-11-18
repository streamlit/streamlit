"""Config System Unittest."""

# import json
import unittest

from streamlit import config
from streamlit.ConfigOption import ConfigOption

class ConfigTest(unittest.TestCase):
    """Test the config system."""

    def test_badly_formed_full_qualified_name(self):
        """Test setting an invalid config section."""
        with self.assertRaises(AssertionError):
            ConfigOption('_test.myParam.')

    def test_invalid_config_section(self):
        """Test setting an invalid config section."""
        with self.assertRaises(AssertionError):
            ConfigOption('mySection.myParam')

    def test_simple_config_option(self):
        """Test setting an invalid config section."""
        # Create the config option.
        config_option = ConfigOption('_test.simpleParam',
            description = 'Simple config option.',
            default_val = 12345)

        # Test that it works.
        self.assertEqual(config_option.get_description(),
            'Simple config option.')
        self.assertEqual(config_option.get_value(), 12345)

    def test_complex_config_option(self):
        """Test setting an invalid config section."""
        # Create the config option.
        @ConfigOption('_test.complexParam')
        def config_option():
            """Complex config option."""
            return 12345

        # Test that it works.
        self.assertEqual(config_option.get_description(),
            'Complex config option.')
        self.assertEqual(config_option.get_value(), 12345)
