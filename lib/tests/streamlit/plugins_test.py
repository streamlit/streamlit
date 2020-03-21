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

import unittest

from streamlit.plugins import PluginRegistry

JAVASCRIPT_1 = """
export default (args, st) => {
  return <div>Hello, world!</div>
}
"""

JAVASCRIPT_2 = """
export default (args, st) => {
  return <span>Goodbye, cruel world!</span>
}
"""


class PluginRegistryTest(unittest.TestCase):
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
