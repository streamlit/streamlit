# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import unittest

import pytest
from parameterized import parameterized

from streamlit.config_option import ConfigOption, DeprecationError


class ConfigOptionTest(unittest.TestCase):
    @parameterized.expand(
        [
            ("missingKey",),
            (".missingSection",),
            ("has spaces",),
            ("_.key"),
            ("section.v_1_name"),
        ]
    )
    def test_invalid_key(self, key):
        with pytest.raises(AssertionError) as e:
            ConfigOption(key)
        self.assertEqual('Key "%s" has invalid format.' % key, str(e.value))

    @parameterized.expand(
        [
            ("section.name", "section", "name"),
            ("section.numbered12", "section", "numbered12"),
            ("numbered1.allowCaps", "numbered1", "allowCaps"),
            ("allowCaps.numbered2", "allowCaps", "numbered2"),
        ]
    )
    def test_valid_keys(self, key, section, name):
        c = ConfigOption(key)
        self.assertEqual(section, c.section)
        self.assertEqual(name, c.name)

    def test_constructor_default_values(self):
        key = "mysection.myName"
        c = ConfigOption(key)
        self.assertEqual("mysection", c.section)
        self.assertEqual("myName", c.name)
        self.assertEqual(None, c.description)
        self.assertEqual("visible", c.visibility)

    def test_call(self):
        key = "mysection.myName"
        c = ConfigOption(key)

        @c
        def someRandomFunction():
            """Random docstring."""
            pass

        self.assertEqual("Random docstring.", c.description)
        self.assertEqual(someRandomFunction._get_val_func, c._get_val_func)

    def test_call_assert(self):
        key = "mysection.myName"
        c = ConfigOption(key)

        with pytest.raises(AssertionError) as e:

            @c
            def someRandomFunction():
                pass

        self.assertEqual(
            "Complex config options require doc strings for their description.",
            str(e.value),
        )

    def test_value(self):
        my_value = "myValue"

        key = "mysection.myName"
        c = ConfigOption(key)

        @c
        def someRandomFunction():
            """Random docstring."""
            return my_value

        self.assertEqual(my_value, c.value)

    def test_set_value(self):
        my_value = "myValue"
        where_defined = "im defined here"

        key = "mysection.myName"
        c = ConfigOption(key)
        c.set_value(my_value, where_defined)

        self.assertEqual(my_value, c.value)
        self.assertEqual(where_defined, c.where_defined)

    def test_deprecated_expired(self):
        my_value = "myValue"
        where_defined = "im defined here"

        key = "mysection.myName"

        c = ConfigOption(
            key,
            deprecated=True,
            deprecation_text="dep text",
            expiration_date="2000-01-01",
        )

        with self.assertRaises(DeprecationError):
            c.set_value(my_value, where_defined)

        self.assertTrue(c.is_expired())

    def test_deprecated_unexpired(self):
        my_value = "myValue"
        where_defined = "im defined here"

        key = "mysection.myName"

        c = ConfigOption(
            key,
            deprecated=True,
            deprecation_text="dep text",
            expiration_date="2100-01-01",
        )

        c.set_value(my_value, where_defined)

        self.assertFalse(c.is_expired())

    def test_replaced_by_unexpired(self):
        c = ConfigOption(
            "mysection.oldName",
            description="My old description",
            replaced_by="mysection.newName",
            expiration_date="2100-01-01",
        )

        self.assertTrue(c.deprecated)
        self.assertFalse(c.is_expired())

    def test_replaced_by_expired(self):
        c = ConfigOption(
            "mysection.oldName",
            description="My old description",
            replaced_by="mysection.newName",
            expiration_date="2000-01-01",
        )

        self.assertTrue(c.deprecated)
        self.assertTrue(c.is_expired())
