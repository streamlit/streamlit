import unittest

import pytest

from streamlit.ConfigOption import ConfigOption


class ConfigOptionTest(unittest.TestCase):

    def test_invalid_key(self):
        key = 'broken'
        with pytest.raises(AssertionError) as e:
            ConfigOption(key)
        self.assertEqual(
            'Key "%s" has invalid format.' % key,
            str(e.value))

    def test_constructor_default_values(self):
        key = 'mysection.myName'
        c = ConfigOption(key)
        self.assertEqual('mysection', c.section)
        self.assertEqual('myName', c.name)
        self.assertEqual(None, c.description)
        self.assertEqual(u'visible', c.visibility)

    def test_call(self):
        key = 'mysection.myName'
        c = ConfigOption(key)

        @c
        def someRandomFunction():
            """Random docstring."""
            pass
        self.assertEqual('Random docstring.', c.description)
        self.assertEqual(someRandomFunction._get_val_func, c._get_val_func)

    def test_call_assert(self):
        key = 'mysection.myName'
        c = ConfigOption(key)

        with pytest.raises(AssertionError) as e:
            @c
            def someRandomFunction():
                pass

        self.assertEqual(
            'Complex config options require doc strings for their description.',
            str(e.value))

    def test_value(self):
        my_value = 'myValue'

        key = 'mysection.myName'
        c = ConfigOption(key)

        @c
        def someRandomFunction():
            """Random docstring."""
            return my_value

        self.assertEqual(my_value, c.value)

    def test_set_value(self):
        my_value = 'myValue'
        where_defined = 'im defined here'

        key = 'mysection.myName'
        c = ConfigOption(key)
        c.set_value(my_value, where_defined)

        self.assertEqual(my_value, c.value)
        self.assertEqual(where_defined, c.where_defined)


if __name__ == '__main__':
    unittest.main()
