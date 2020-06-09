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
import os
import unittest
from unittest import mock

import pandas as pd
import pytest
import tornado.testing
import tornado.web

from streamlit import StreamlitAPIException
from streamlit.components import ComponentRegistry, CustomComponent
from streamlit.components import declare_component as declare_component
from tests.testutil import DeltaGeneratorTestCase

URL = "http://not.a.real.url:3001"
PATH = "not/a/real/path"


class DeclareComponentTest(unittest.TestCase):
    """Test st.declare_component."""

    def tearDown(self) -> None:
        ComponentRegistry._instance = None

    def test_name(self):
        """Test component name generation"""
        # Test a component defined in a module with no package
        component = declare_component("foo", url=URL)
        self.assertEqual("components_test.foo", component.name)

        # Test a component defined in __init__.py
        from component_test_data import component as init_component

        self.assertEqual(
            "component_test_data.foo", init_component.name,
        )

        # Test a component defined in a module within a package
        from component_test_data.outer_module import component as outer_module_component

        self.assertEqual(
            "component_test_data.outer_module.foo", outer_module_component.name,
        )

        # Test a component defined in module within a nested package
        from component_test_data.nested.inner_module import (
            component as inner_module_component,
        )

        self.assertEqual(
            "component_test_data.nested.inner_module.foo", inner_module_component.name,
        )

    def test_only_path(self):
        """Succeed when a path is provided."""

        def isdir(path):
            return path == PATH or path == os.path.abspath(PATH)

        with mock.patch("streamlit.components.os.path.isdir", side_effect=isdir):
            component = declare_component("test", path=PATH)

        self.assertEqual(PATH, component.path)
        self.assertIsNone(component.url)

        self.assertEqual(
            ComponentRegistry.instance().get_component_path(component.name),
            component.abspath,
        )

    def test_only_url(self):
        """Succeed when a URL is provided."""
        component = declare_component("test", url=URL)
        self.assertEqual(URL, component.url)
        self.assertIsNone(component.path)

        self.assertEqual(
            ComponentRegistry.instance().get_component_path("components_test"),
            component.abspath,
        )

    def test_path_and_url(self):
        """Fail if path AND url are provided."""
        with pytest.raises(StreamlitAPIException) as exception_message:
            declare_component("test", path=PATH, url=URL)
        self.assertEqual(
            "Either 'path' or 'url' must be set, but not both.",
            str(exception_message.value),
        )

    def test_no_path_and_no_url(self):
        """Fail if neither path nor url is provided."""
        with pytest.raises(StreamlitAPIException) as exception_message:
            declare_component("test", path=None, url=None)
        self.assertEqual(
            "Either 'path' or 'url' must be set, but not both.",
            str(exception_message.value),
        )

    def test_declared_in_main_module(self):
        """If st.declare_component is called in the main module, then
        the component name should be the filename of that module."""
        # TODO!
        pass


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
                CustomComponent("test_component", path=test_path)
            )

        self.assertEqual(test_path, registry.get_component_path("test_component"))

    def test_register_component_no_path(self):
        """It's not an error to register a component without a path."""
        registry = ComponentRegistry.instance()

        # Return None when the component hasn't been registered
        self.assertIsNone(registry.get_component_path("test_component"))

        # And also return None when the component doesn't have a path
        registry.register_component(
            CustomComponent("test_component", url="http://not.a.url")
        )
        self.assertIsNone(registry.get_component_path("test_component"))

    def test_register_invalid_path(self):
        """We raise an exception if a component is registered with a
        non-existent path.
        """
        test_path = "/a/test/component/directory"

        registry = ComponentRegistry.instance()
        with self.assertRaises(StreamlitAPIException) as ctx:
            registry.register_component(CustomComponent("test_component", test_path))
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
            registry.register_component(CustomComponent("test_component", test_path_1))
            registry.register_component(CustomComponent("test_component", test_path_1))
            self.assertEqual(test_path_1, registry.get_component_path("test_component"))

            registry.register_component(CustomComponent("test_component", test_path_2))
            self.assertEqual(test_path_2, registry.get_component_path("test_component"))


class InvokeComponentTest(DeltaGeneratorTestCase):
    """Test invocation of a custom component object."""

    def setUp(self):
        super().setUp()
        self.test_component = declare_component("test", url=URL)

    def test_only_json_args(self):
        """Test that component with only json args is marshalled correctly."""
        self.test_component(foo="bar")
        proto = self.get_delta_from_queue().new_element.component_instance

        self.assertEqual(self.test_component.name, proto.component_name)
        self.assertEqual(json.dumps({"foo": "bar"}), proto.args_json)
        self.assertEqual("[]", str(proto.args_dataframe))

    def test_only_df_args(self):
        """Test that component with only dataframe args is marshalled correctly."""
        raw_data = {
            "First Name": ["Jason", "Molly"],
            "Last Name": ["Miller", "Jacobson"],
            "Age": [42, 52],
        }
        df = pd.DataFrame(raw_data, columns=["First Name", "Last Name", "Age"])
        self.test_component(df=df)
        proto = self.get_delta_from_queue().new_element.component_instance

        self.assertEqual(self.test_component.name, proto.component_name)
        self.assertEqual("{}", proto.args_json)
        # (HK) TODO: Add assertEqual check for Apache Arrow pybytes.
        self.assertIsNotNone(proto.args_dataframe)

    def test_no_args(self):
        """Test that component with no args is marshalled correctly."""
        self.test_component()
        proto = self.get_delta_from_queue().new_element.component_instance

        self.assertEqual(self.test_component.name, proto.component_name)
        self.assertEqual("{}", proto.args_json)
        self.assertEqual("[]", str(proto.args_dataframe))

    def test_json_and_df_args(self):
        """Test that component with json and dataframe args is marshalled correctly."""
        raw_data = {
            "First Name": ["Jason", "Molly"],
            "Last Name": ["Miller", "Jacobson"],
            "Age": [42, 52],
        }
        df = pd.DataFrame(raw_data, columns=["First Name", "Last Name", "Age"])
        self.test_component(foo="bar", df=df)
        proto = self.get_delta_from_queue().new_element.component_instance

        self.assertEqual(self.test_component.name, proto.component_name)
        self.assertEqual(json.dumps({"foo": "bar"}), proto.args_json)
        # (HK) TODO: Add assertEqual check for Apache Arrow pybytes.
        self.assertIsNotNone(proto.args_dataframe)

    def test_key(self):
        """Test the 'key' param"""
        # TODO!
        pass

    def test_default(self):
        """Test the 'default' param"""
        # TODO!
        pass


class ComponentRequestHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """TODO!"""

    pass
