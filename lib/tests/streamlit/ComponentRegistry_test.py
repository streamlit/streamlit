# Copyright 2018-2020 Streamlit Inc.
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

import unittest
from collections import namedtuple
from typing import Any
from unittest import mock

from streamlit import StreamlitAPIException
from streamlit.components import ComponentRegistry

MockComponent = namedtuple("MockComponent", ["name", "abspath", "url"])


def _create_mock_component(name, path=None, url=None) -> Any:
    return MockComponent(name, path, url)


class ComponentRegistryTest(unittest.TestCase):
    def tearDown(self) -> None:
        ComponentRegistry._instance = None

    def test_register_component_with_path(self):
        """Registering a component should associate it with its path."""
        test_path = "/a/test/component/directory"

        def isdir(path):
            return path == test_path

        registry = ComponentRegistry.instance()
        with mock.patch("streamlit.components.os.path.isdir", side_effect=isdir):
            registry.register_component(
                _create_mock_component("test_component", path=test_path)
            )

        self.assertEqual(test_path, registry.get_component_path("test_component"))

    def test_register_component_no_path(self):
        """It's not an error to register a component without a path."""
        registry = ComponentRegistry.instance()

        # Return None when the component hasn't been registered
        self.assertIsNone(registry.get_component_path("test_component"))

        # And also return None when the component doesn't have a path
        registry.register_component(_create_mock_component("test_component", path=None))
        self.assertIsNone(registry.get_component_path("test_component"))

    def test_register_invalid_path(self):
        """We raise an exception if a component is registered with a
        non-existent path.
        """
        test_path = "/a/test/component/directory"

        registry = ComponentRegistry.instance()
        with self.assertRaises(StreamlitAPIException) as ctx:
            registry.register_component(
                _create_mock_component("test_component", test_path)
            )
            self.assertIn("No such component directory", ctx.exception)

    def test_register_duplicate_path(self):
        """It's not an error to re-register a component.
        (This can happen during development).
        """
        test_path_1 = "/a/test/component/directory"
        test_path_2 = "/another/test/component/directory"

        def isdir(path):
            return path in (test_path_1, test_path_2)

        registry = ComponentRegistry.instance()
        with mock.patch("streamlit.components.os.path.isdir", side_effect=isdir):
            registry.register_component(
                _create_mock_component("test_component", test_path_1)
            )
            registry.register_component(
                _create_mock_component("test_component", test_path_1)
            )
            self.assertEqual(test_path_1, registry.get_component_path("test_component"))

            registry.register_component(
                _create_mock_component("test_component", test_path_2)
            )
            self.assertEqual(test_path_2, registry.get_component_path("test_component"))
