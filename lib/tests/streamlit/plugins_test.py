# -*- coding: utf-8 -*-
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

import json
import unittest
from typing import Callable
from unittest import mock

import tornado.testing
import tornado.web

import streamlit
from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.plugins import MarshallPluginException
from streamlit.plugins import PluginRegistry
from streamlit.plugins import PluginRequestHandler
from streamlit.plugins import plugin
from tests.testutil import DeltaGeneratorTestCase

JAVASCRIPT_1 = """
return function (args, st) => {
  return <div>Hello, lovely world!</div>
}
"""

JAVASCRIPT_2 = """
export default (args, st) => {
  return <span>Goodbye, cruel world!</span>
}
"""


class PluginTest(DeltaGeneratorTestCase):
    """TODO!"""

    pass
    # def setUp(self, override_root=True) -> None:
    #     super().setUp(override_root)
    #     self.registry = PluginRegistry()
    #
    # def _register_plugin(self, name, javascript) -> [str, Callable]:
    #     registry_patch = mock.patch(
    #         "streamlit.plugins.PluginRegistry.instance", return_value=self.registry
    #     )
    #     st_patch = mock.patch("streamlit.plugins.st")
    #     dg_patch = mock.patch("streamlit.plugins.DeltaGenerator")
    #
    #     with registry_patch, st_patch, dg_patch:
    #         plugin(name, javascript)
    #         plugin_id = self.registry._get_id(javascript)
    #
    #         # Test that we're properly adding functions to st and DeltaGenerator
    #         self.assertTrue(hasattr(streamlit.plugins.st, name))
    #         self.assertTrue(hasattr(streamlit.plugins.DeltaGenerator, name))
    #
    #         return plugin_id, getattr(streamlit.plugins.DeltaGenerator, name)
    #
    # def test_register_plugin(self):
    #     """Test the output of st.plugin"""
    #     plugin_id, plugin_func = self._register_plugin("test", JAVASCRIPT_1)
    #     self.assertEqual(JAVASCRIPT_1, self.registry.get_plugin_path(plugin_id))
    #     self.assertIsNotNone(plugin_func)
    #
    # def test_plugin_func_none(self):
    #     """Test `plugin_func(None)`"""
    #     plugin_id, plugin_func = self._register_plugin("test", JAVASCRIPT_1)
    #
    #     return_value = plugin_func(DeltaGenerator(), None)
    #     self.assertIsNone(return_value)
    #
    #     proto = self.get_delta_from_queue().new_element.plugin_instance
    #     self.assertEqual("null", proto.args_json)
    #     self.assertEqual(plugin_id, proto.plugin_id)
    #
    # def test_plugin_func_args(self):
    #     """Test `plugin_func() with complex args"""
    #     plugin_id, plugin_func = self._register_plugin("test", JAVASCRIPT_1)
    #
    #     args = {
    #         "foo": "bar",
    #         "baz": None,
    #         "qux": {"inner": 3.14},
    #     }
    #
    #     return_value = plugin_func(DeltaGenerator(), args)
    #     self.assertIsNone(return_value)
    #
    #     proto = self.get_delta_from_queue().new_element.plugin_instance
    #     self.assertEqual(json.dumps(args), proto.args_json)
    #     self.assertEqual(plugin_id, proto.plugin_id)
    #
    # def test_plugin_func_bad_args(self):
    #     """Test `plugin_func()` with non-JSON-friendly args"""
    #     plugin_id, plugin_func = self._register_plugin("test", JAVASCRIPT_1)
    #
    #     with self.assertRaises(MarshallPluginException):
    #         plugin_func(DeltaGenerator(), {"bad": DeltaGenerator()})


class PluginRegistryTest(unittest.TestCase):
    """TODO!"""

    pass
    # def test_singleton(self):
    #     self.assertIsNotNone(PluginRegistry.instance())
    #     self.assertEqual(
    #         PluginRegistry.instance(), PluginRegistry.instance(),
    #     )
    #
    # def test_register_plugin(self):
    #     registry = PluginRegistry()
    #     id1 = registry.register_plugin(JAVASCRIPT_1)
    #     id2 = registry.register_plugin(JAVASCRIPT_2)
    #     self.assertEqual(JAVASCRIPT_1, registry.get_plugin_path(id1))
    #     self.assertEqual(JAVASCRIPT_2, registry.get_plugin_path(id2))
    #
    # def test_register_duplicate(self):
    #     """Registering a duplicate is not an error and should result
    #     in the same ID."""
    #     registry = PluginRegistry()
    #     self.assertEqual(
    #         registry.register_plugin(JAVASCRIPT_1),
    #         registry.register_plugin(JAVASCRIPT_1),
    #     )


class PluginRequestHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Tests the /plugin endpoint"""

    # TODO!

    def get_app(self):
        self.registry = PluginRegistry()
        return tornado.web.Application(
            [("/plugin/(.*)", PluginRequestHandler, dict(registry=self.registry))]
        )
