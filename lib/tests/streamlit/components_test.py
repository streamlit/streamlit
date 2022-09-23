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

import json
import os
import unittest
from typing import Any
from unittest import mock
from unittest.mock import patch

import pandas as pd
import pytest

import streamlit as st
import streamlit.components.v1 as components
from streamlit import StreamlitAPIException
from streamlit.components.v1 import component_arrow
from streamlit.components.v1.components import (
    ComponentRegistry,
    CustomComponent,
)
from streamlit.errors import DuplicateWidgetID
from streamlit.proto.Components_pb2 import SpecialArg
from streamlit.type_util import to_bytes
from tests import testutil
from tests.testutil import DeltaGeneratorTestCase

URL = "http://not.a.real.url:3001"
PATH = "not/a/real/path"


def _serialize_dataframe_arg(key: str, value: Any) -> SpecialArg:
    special_arg = SpecialArg()
    special_arg.key = key
    component_arrow.marshall(special_arg.arrow_dataframe.data, value)
    return special_arg


def _serialize_bytes_arg(key: str, value: Any) -> SpecialArg:
    special_arg = SpecialArg()
    special_arg.key = key
    special_arg.bytes = to_bytes(value)
    return special_arg


class DeclareComponentTest(unittest.TestCase):
    """Test component declaration."""

    def tearDown(self) -> None:
        ComponentRegistry._instance = None

    def test_name(self):
        """Test component name generation"""
        # Test a component defined in a module with no package
        component = components.declare_component("foo", url=URL)
        self.assertEqual("tests.streamlit.components_test.foo", component.name)

        # Test a component defined in __init__.py
        from tests.streamlit.component_test_data import component as init_component

        self.assertEqual(
            "tests.streamlit.component_test_data.foo",
            init_component.name,
        )

        # Test a component defined in a module within a package
        from tests.streamlit.component_test_data.outer_module import (
            component as outer_module_component,
        )

        self.assertEqual(
            "tests.streamlit.component_test_data.outer_module.foo",
            outer_module_component.name,
        )

        # Test a component defined in module within a nested package
        from tests.streamlit.component_test_data.nested.inner_module import (
            component as inner_module_component,
        )

        self.assertEqual(
            "tests.streamlit.component_test_data.nested.inner_module.foo",
            inner_module_component.name,
        )

    def test_only_path(self):
        """Succeed when a path is provided."""

        def isdir(path):
            return path == PATH or path == os.path.abspath(PATH)

        with mock.patch(
            "streamlit.components.v1.components.os.path.isdir", side_effect=isdir
        ):
            component = components.declare_component("test", path=PATH)

        self.assertEqual(PATH, component.path)
        self.assertIsNone(component.url)

        self.assertEqual(
            ComponentRegistry.instance().get_component_path(component.name),
            component.abspath,
        )

    def test_only_url(self):
        """Succeed when a URL is provided."""
        component = components.declare_component("test", url=URL)
        self.assertEqual(URL, component.url)
        self.assertIsNone(component.path)

        self.assertEqual(
            ComponentRegistry.instance().get_component_path("components_test"),
            component.abspath,
        )

    def test_path_and_url(self):
        """Fail if path AND url are provided."""
        with pytest.raises(StreamlitAPIException) as exception_message:
            components.declare_component("test", path=PATH, url=URL)
        self.assertEqual(
            "Either 'path' or 'url' must be set, but not both.",
            str(exception_message.value),
        )

    def test_no_path_and_no_url(self):
        """Fail if neither path nor url is provided."""
        with pytest.raises(StreamlitAPIException) as exception_message:
            components.declare_component("test", path=None, url=None)
        self.assertEqual(
            "Either 'path' or 'url' must be set, but not both.",
            str(exception_message.value),
        )


class ComponentRegistryTest(unittest.TestCase):
    """Test component registration."""

    def tearDown(self) -> None:
        ComponentRegistry._instance = None

    def test_register_component_with_path(self):
        """Registering a component should associate it with its path."""
        test_path = "/a/test/component/directory"

        def isdir(path):
            return path == test_path

        registry = ComponentRegistry.instance()
        with mock.patch(
            "streamlit.components.v1.components.os.path.isdir", side_effect=isdir
        ):
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
        with mock.patch(
            "streamlit.components.v1.components.os.path.isdir", side_effect=isdir
        ):
            registry.register_component(CustomComponent("test_component", test_path_1))
            registry.register_component(CustomComponent("test_component", test_path_1))
            self.assertEqual(test_path_1, registry.get_component_path("test_component"))

            registry.register_component(CustomComponent("test_component", test_path_2))
            self.assertEqual(test_path_2, registry.get_component_path("test_component"))


class InvokeComponentTest(DeltaGeneratorTestCase):
    """Test invocation of a custom component object."""

    def setUp(self):
        super().setUp()
        self.test_component = components.declare_component("test", url=URL)

    def test_only_json_args(self):
        """Test that component with only json args is marshalled correctly."""
        self.test_component(foo="bar")
        proto = self.get_delta_from_queue().new_element.component_instance

        self.assertEqual(self.test_component.name, proto.component_name)
        self.assertJSONEqual(
            {"foo": "bar", "key": None, "default": None}, proto.json_args
        )
        self.assertEqual("[]", str(proto.special_args))

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
        self.assertJSONEqual({"key": None, "default": None}, proto.json_args)
        self.assertEqual(1, len(proto.special_args))
        self.assertEqual(_serialize_dataframe_arg("df", df), proto.special_args[0])

    def test_only_list_args(self):
        """Test that component with only list args is marshalled correctly."""
        self.test_component(data=["foo", "bar", "baz"])
        proto = self.get_delta_from_queue().new_element.component_instance
        self.assertJSONEqual(
            {"data": ["foo", "bar", "baz"], "key": None, "default": None},
            proto.json_args,
        )
        self.assertEqual("[]", str(proto.special_args))

    def test_no_args(self):
        """Test that component with no args is marshalled correctly."""
        self.test_component()
        proto = self.get_delta_from_queue().new_element.component_instance

        self.assertEqual(self.test_component.name, proto.component_name)
        self.assertJSONEqual({"key": None, "default": None}, proto.json_args)
        self.assertEqual("[]", str(proto.special_args))

    def test_bytes_args(self):
        self.test_component(foo=b"foo", bar=b"bar")
        proto = self.get_delta_from_queue().new_element.component_instance
        self.assertJSONEqual({"key": None, "default": None}, proto.json_args)
        self.assertEqual(2, len(proto.special_args))
        self.assertEqual(
            _serialize_bytes_arg("foo", b"foo"),
            proto.special_args[0],
        )
        self.assertEqual(
            _serialize_bytes_arg("bar", b"bar"),
            proto.special_args[1],
        )

    def test_mixed_args(self):
        """Test marshalling of a component with varied arg types."""
        df = pd.DataFrame(
            {
                "First Name": ["Jason", "Molly"],
                "Last Name": ["Miller", "Jacobson"],
                "Age": [42, 52],
            },
            columns=["First Name", "Last Name", "Age"],
        )
        self.test_component(string_arg="string", df_arg=df, bytes_arg=b"bytes")
        proto = self.get_delta_from_queue().new_element.component_instance

        self.assertEqual(self.test_component.name, proto.component_name)
        self.assertJSONEqual(
            {"string_arg": "string", "key": None, "default": None},
            proto.json_args,
        )
        self.assertEqual(2, len(proto.special_args))
        self.assertEqual(_serialize_dataframe_arg("df_arg", df), proto.special_args[0])
        self.assertEqual(
            _serialize_bytes_arg("bytes_arg", b"bytes"), proto.special_args[1]
        )

    def test_duplicate_key(self):
        """Two components with the same `key` should throw DuplicateWidgetID exception"""
        self.test_component(foo="bar", key="baz")

        with self.assertRaises(DuplicateWidgetID):
            self.test_component(key="baz")

    def test_key_sent_to_frontend(self):
        """We send the 'key' param to the frontend (even if it's None)."""
        # Test a string key
        self.test_component(key="baz")
        proto = self.get_delta_from_queue().new_element.component_instance
        self.assertJSONEqual({"key": "baz", "default": None}, proto.json_args)

        # Test an empty key
        self.test_component()
        proto = self.get_delta_from_queue().new_element.component_instance
        self.assertJSONEqual({"key": None, "default": None}, proto.json_args)

    def test_simple_default(self):
        """Test the 'default' param with a JSON value."""
        return_value = self.test_component(default="baz")
        self.assertEqual("baz", return_value)

        proto = self.get_delta_from_queue().new_element.component_instance
        self.assertJSONEqual({"key": None, "default": "baz"}, proto.json_args)

    def test_bytes_default(self):
        """Test the 'default' param with a bytes value."""
        return_value = self.test_component(default=b"bytes")
        self.assertEqual(b"bytes", return_value)

        proto = self.get_delta_from_queue().new_element.component_instance
        self.assertJSONEqual({"key": None}, proto.json_args)
        self.assertEqual(
            _serialize_bytes_arg("default", b"bytes"),
            proto.special_args[0],
        )

    def test_df_default(self):
        """Test the 'default' param with a DataFrame value."""
        df = pd.DataFrame(
            {
                "First Name": ["Jason", "Molly"],
                "Last Name": ["Miller", "Jacobson"],
                "Age": [42, 52],
            },
            columns=["First Name", "Last Name", "Age"],
        )
        return_value = self.test_component(default=df)
        self.assertTrue(df.equals(return_value), "df != return_value")

        proto = self.get_delta_from_queue().new_element.component_instance
        self.assertJSONEqual({"key": None}, proto.json_args)
        self.assertEqual(
            _serialize_dataframe_arg("default", df),
            proto.special_args[0],
        )

    def assertJSONEqual(self, a, b):
        """Asserts that two JSON dicts are equal. If either arg is a string,
        it will be first converted to a dict with json.loads()."""
        # Ensure both objects are dicts.
        dict_a = a if isinstance(a, dict) else json.loads(a)
        dict_b = b if isinstance(b, dict) else json.loads(b)
        self.assertEqual(dict_a, dict_b)

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        self.test_component()

        proto = self.get_delta_from_queue().new_element.component_instance
        self.assertEqual(proto.form_id, "")

    @patch("streamlit._is_running_with_streamlit", new=True)
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("foo"):
            self.test_component()

        # 2 elements will be created: form block, widget
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        form_proto = self.get_delta_from_queue(0).add_block
        component_instance_proto = self.get_delta_from_queue(
            1
        ).new_element.component_instance
        self.assertEqual(component_instance_proto.form_id, form_proto.form.form_id)


class IFrameTest(testutil.DeltaGeneratorTestCase):
    def test_iframe(self):
        """Test components.iframe"""
        components.iframe("http://not.a.url", width=200, scrolling=True)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.iframe.src, "http://not.a.url")
        self.assertEqual(el.iframe.srcdoc, "")
        self.assertEqual(el.iframe.width, 200)
        self.assertTrue(el.iframe.has_width)
        self.assertTrue(el.iframe.scrolling)

    def test_html(self):
        """Test components.html"""
        html = r"<html><body>An HTML string!</body></html>"
        components.html(html, width=200, scrolling=True)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.iframe.src, "")
        self.assertEqual(el.iframe.srcdoc, html)
        self.assertEqual(el.iframe.width, 200)
        self.assertTrue(el.iframe.has_width)
        self.assertTrue(el.iframe.scrolling)
