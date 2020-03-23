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
from typing import Tuple
from unittest import mock

import tornado.testing
import tornado.web

from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.plugins import MarshallPluginException
from streamlit.plugins import PluginRegistry
from streamlit.plugins import PluginRequestHandler
from streamlit.plugins import plugin
from tests.testutil import DeltaGeneratorTestCase

JAVASCRIPT_1 = """
export default (args, st) => {
  return <div>Hello, lovely world!</div>
}
"""

JAVASCRIPT_2 = """
export default (args, st) => {
  return <span>Goodbye, cruel world!</span>
}
"""


class PluginTest(DeltaGeneratorTestCase):
    def setUp(self, override_root=True) -> None:
        super().setUp(override_root)
        self.registry = PluginRegistry()

    def _register_plugin(self, javascript) -> Tuple[Callable, str]:
        with mock.patch("streamlit.plugins.PluginRegistry.instance") as p:
            p.return_value = self.registry

            plugin_func = plugin(javascript)
            plugin_id = self.registry._get_id(javascript)

            return plugin_func, plugin_id

    def test_register_plugin(self):
        """Test the output of st.plugin"""
        plugin_func, plugin_id = self._register_plugin(JAVASCRIPT_1)
        # Ensure our Registry was filled in.
        self.assertIsNotNone(plugin_func)
        self.assertEqual(JAVASCRIPT_1, self.registry.get_plugin(plugin_id))

    def test_plugin_func_none(self):
        """Test `plugin_func(None)`"""
        plugin_func, plugin_id = self._register_plugin(JAVASCRIPT_1)

        return_value = plugin_func(DeltaGenerator(), None)
        self.assertIsNone(return_value)

        proto = self.get_delta_from_queue().new_element.plugin_instance
        self.assertEqual("null", proto.args_json)
        self.assertEqual(plugin_id, proto.plugin_id)

    def test_plugin_func_args(self):
        """Test `plugin_func() with complex args"""
        plugin_func, plugin_id = self._register_plugin(JAVASCRIPT_1)

        args = {
            "foo": "bar",
            "baz": None,
            "qux": {"inner": 3.14},
        }

        return_value = plugin_func(DeltaGenerator(), args)
        self.assertIsNone(return_value)

        proto = self.get_delta_from_queue().new_element.plugin_instance
        self.assertEqual(json.dumps(args), proto.args_json)
        self.assertEqual(plugin_id, proto.plugin_id)

    def test_plugin_func_bad_args(self):
        """Test `plugin_func()` with non-JSON-friendly args"""
        plugin_func, plugin_id = self._register_plugin(JAVASCRIPT_1)

        with self.assertRaises(MarshallPluginException):
            plugin_func(DeltaGenerator(), {"bad": DeltaGenerator()})


class PluginRegistryTest(unittest.TestCase):
    def test_singleton(self):
        self.assertIsNotNone(PluginRegistry.instance())
        self.assertEqual(
            PluginRegistry.instance(), PluginRegistry.instance(),
        )

    def test_register_plugin(self):
        registry = PluginRegistry()
        id1 = registry.register_plugin(JAVASCRIPT_1)
        id2 = registry.register_plugin(JAVASCRIPT_2)
        self.assertEqual(JAVASCRIPT_1, registry.get_plugin(id1))
        self.assertEqual(JAVASCRIPT_2, registry.get_plugin(id2))

    def test_register_duplicate(self):
        """Registering a duplicate is not an error and should result
        in the same ID."""
        registry = PluginRegistry()
        self.assertEqual(
            registry.register_plugin(JAVASCRIPT_1),
            registry.register_plugin(JAVASCRIPT_1),
        )


class PluginRequestHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Tests the /plugin endpoint"""

    def get_app(self):
        self.registry = PluginRegistry()
        return tornado.web.Application(
            [("/plugin/(.*)", PluginRequestHandler, dict(registry=self.registry))]
        )

    def test_get_file(self):
        """Getting an existing file should work."""
        id = self.registry.register_plugin(JAVASCRIPT_1)
        rsp = self.fetch("/plugin/%s" % id)
        self.assertEqual(200, rsp.code)
        self.assertEqual(JAVASCRIPT_1, rsp.body.decode())

    def test_missing_file(self):
        """Getting a non-existent file should 404"""
        rsp = self.fetch("/plugin/no_such_id")
        self.assertEqual(404, rsp.code)
