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
import pytest
import pandas as pd
from typing import Callable
from unittest import mock

import tornado.testing
import tornado.web

import streamlit
from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.components import MarshallComponentException
from streamlit.components import ComponentRegistry
from streamlit.components import ComponentRequestHandler
from streamlit.components import CustomComponent
from streamlit.components import register_component as register_component
from streamlit.components import declare_component as declare_component
from tests.testutil import DeltaGeneratorTestCase
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ComponentInstance_pb2 import ArgsDataframe


URL = "http://not.a.real.url:3001"
PATH = "not/a/real/path"


class DeclareComponentTest(DeltaGeneratorTestCase):
    """Test declaration of custom component."""

    def test_only_path(self):
        """Test __init__ when only path is provided."""
        instance = CustomComponent(PATH, None)
        self.assertEqual(PATH, instance.path)
        self.assertIsNone(instance.url)
        self.assertIsNone(instance._custom_wrapper)

    def test_only_url(self):
        """Test __init__ when only url is provided."""
        instance = CustomComponent(None, URL)
        self.assertEqual(URL, instance.url)
        self.assertIsNone(instance.path)
        self.assertIsNone(instance._custom_wrapper)

    def test_path_and_url(self):
        """Test __init__ when both path and url are provided."""
        with pytest.raises(StreamlitAPIException) as exception_message:
            CustomComponent(PATH, URL)
        self.assertEqual(
            "Either 'path' or 'url' must be set, but not both.",
            str(exception_message.value),
        )

    def test_no_path_and_no_url(self):
        """Test __init__ when neither path nor url are provided."""
        with pytest.raises(StreamlitAPIException) as exception_message:
            CustomComponent(None, None)
        self.assertEqual(
            "Either 'path' or 'url' must be set, but not both.",
            str(exception_message.value),
        )


class RegisterComponentTest(DeltaGeneratorTestCase):
    """Test registration of custom component."""

    def setUp(self):
        super().setUp()
        TestComponent = declare_component(url=URL)
        register_component("test_component", TestComponent)

    def test_st_binding(self):
        """Test that component has been attached to st namespace"""
        self.assertTrue(hasattr(streamlit.components.st, "test_component"))

    def test_dg_binding(self):
        """Test that component has been attached to DeltaGenerator"""
        self.assertTrue(hasattr(streamlit.components.DeltaGenerator, "test_component"))

    def test_only_json_args(self):
        """Test that component with only json args is marshalled correctly."""
        streamlit.test_component(foo="bar")
        proto = self.get_delta_from_queue().new_element.component_instance
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
        streamlit.test_component(df=df)
        proto = self.get_delta_from_queue().new_element.component_instance
        self.assertEqual("{}", proto.args_json)
        # (HK) TODO: Add assertEqual check for Apache Arrow pybytes.
        self.assertIsNotNone(proto.args_dataframe)

    def test_no_args(self):
        """Test that component with no args is marshalled correctly."""
        streamlit.test_component()
        proto = self.get_delta_from_queue().new_element.component_instance
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
        streamlit.test_component(foo="bar", df=df)
        proto = self.get_delta_from_queue().new_element.component_instance
        self.assertEqual(json.dumps({"foo": "bar"}), proto.args_json)
        # (HK) TODO: Add assertEqual check for Apache Arrow pybytes.
        self.assertIsNotNone(proto.args_dataframe)

    def test_decorator(self):
        """Test component with decorator."""
        TestComponent = declare_component(url=URL)

        @TestComponent
        def create_instance(f, name, key=None):
            return f(name=name, key=key, default=0)

        register_component("test_component", TestComponent)
        streamlit.test_component("foo")
        proto = self.get_delta_from_queue().new_element.component_instance
        self.assertEqual(
            json.dumps({"name": "foo", "key": None, "default": 0}), proto.args_json
        )


class ComponentRequestHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """TODO!"""

    pass
