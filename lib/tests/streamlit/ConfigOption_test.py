import logging
import time
import unittest

import pytest

from streamlit.ConfigOption import ConfigOption


class ConfigOptionTest(unittest.TestCase):

    def test_foo(self):

        self.assertTrue(True)

    def test_invalid_key(self):
        key = 'broken'
        with pytest.raises(AssertionError) as e:
            c = ConfigOption(key)
        self.assertEquals( 
            'Key "%s" has invalid format.' % key,
            str(e.value))

    def test_constructor_default_values(self):
        key = 'mysection.myName'
        c = ConfigOption(key)
        self.assertEquals('mysection', c.section)
        self.assertEquals('myName', c.name)
        self.assertEquals(None, c.description)
        self.assertEquals(u'visible', c.visibility)

    def test_call(self):
        key = 'mysection.myName'
        c = ConfigOption(key)

        @c
        def someRandomFunction():
            """Random docstring."""
            pass
        self.assertEquals('Random docstring.', c.description)
        self.assertEquals(someRandomFunction._get_val_func, c._get_val_func)

    def test_call_assert(self):
        key = 'mysection.myName'
        c = ConfigOption(key)

        with pytest.raises(AssertionError) as e:
            @c
            def someRandomFunction():
                pass
            
        self.assertEquals( 
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
        
        self.assertEquals(my_value, c.value)
            
    def test_set_value(self):
        my_value = 'myValue'
        where_defined = 'im defined here'

        key = 'mysection.myName'
        c = ConfigOption(key)
        c.set_value(my_value, where_defined)
        
        self.assertEquals(my_value, c.value)
        self.assertEquals(where_defined, c.where_defined)

if __name__ == '__main__':
    unittest.main()
