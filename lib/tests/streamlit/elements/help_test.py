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

"""st.help unit test."""
import inspect
import sys
import unittest
from unittest.mock import patch

import numpy as np
import pytest

import streamlit as st
from streamlit.elements.doc_string import _get_variable_name_from_code_str
from tests.delta_generator_test_case import DeltaGeneratorTestCase


def patch_varname_getter():
    """Patches streamlit.elements.doc_string so _get_variable_name() works outside ScriptRunner."""
    parent_frame_filename = inspect.getouterframes(inspect.currentframe())[2].filename

    return patch(
        "streamlit.elements.doc_string.SCRIPTRUNNER_FILENAME", parent_frame_filename
    )


class StHelpTest(DeltaGeneratorTestCase):
    """Test st.help."""

    def test_no_arg(self):
        """When st.help is called with no arguments, show Streamlit docs."""

        with patch_varname_getter():
            st.help()

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("", ds.name)
        self.assertEqual("streamlit", ds.value)
        self.assertEqual("module", ds.type)
        self.assertTrue(ds.doc_string.startswith("Streamlit."))

    def test_none_arg(self):
        """When st.help is called with None as an argument, don't show Streamlit docs."""

        with patch_varname_getter():
            st.help(None)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("", ds.name)
        self.assertEqual("None", ds.value)
        self.assertEqual("NoneType", ds.type)
        self.assertEqual("", ds.doc_string)

    def test_basic_func_with_doc(self):
        """Test basic function with docstring."""

        def my_func(some_param, another_param=123):
            """This is the doc"""
            pass

        with patch_varname_getter():
            st.help(my_func)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("my_func", ds.name)
        self.assertEqual(
            "tests.streamlit.elements.help_test.StHelpTest."
            "test_basic_func_with_doc.<locals>.my_func(some_param, another_param=123)",
            ds.value,
        )
        self.assertEqual("function", ds.type)
        self.assertEqual("This is the doc", ds.doc_string)

    def test_basic_func_without_doc(self):
        """Test basic function without docstring."""

        def my_func(some_param, another_param=123):
            pass

        with patch_varname_getter():
            st.help(my_func)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("my_func", ds.name)
        self.assertEqual(
            "tests.streamlit.elements.help_test.StHelpTest."
            "test_basic_func_without_doc.<locals>.my_func(some_param, another_param=123)",
            ds.value,
        )
        self.assertEqual("function", ds.type)
        self.assertEqual("", ds.doc_string)

    def test_deltagenerator_func(self):
        """Test Streamlit DeltaGenerator function."""

        with patch_varname_getter():
            st.help(st.audio)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("st.audio", ds.name)
        self.assertEqual("method", ds.type)

        if sys.version_info < (3, 9):
            # Python < 3.9 represents the signature slightly differently
            signature = (
                "(data: Union[str, bytes, _io.BytesIO, io.RawIOBase, "
                "_io.BufferedReader, ForwardRef('npt.NDArray[Any]'), NoneType], "
                "format: str = 'audio/wav', start_time: int = 0, *, "
                "sample_rate: Union[int, NoneType] = None) -> 'DeltaGenerator'"
            )
        else:
            signature = (
                "(data: Union[str, bytes, _io.BytesIO, io.RawIOBase, "
                "_io.BufferedReader, ForwardRef('npt.NDArray[Any]'), NoneType], "
                "format: str = 'audio/wav', start_time: int = 0, *, "
                "sample_rate: Optional[int] = None) -> 'DeltaGenerator'"
            )

        self.assertEqual(
            f"streamlit.delta_generator.MediaMixin.audio{signature}", ds.value
        )
        self.assertTrue(ds.doc_string.startswith("Display an audio player"))

    def test_builtin_func(self):
        """Test a built-in function."""

        with patch_varname_getter():
            st.help(dir)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("dir", ds.name)
        self.assertEqual("builtins.dir(...)", ds.value)
        self.assertEqual("builtin_function_or_method", ds.type)
        self.assertTrue(len(ds.doc_string) > 0)

    def test_varname(self):
        """Test a named variable."""

        myvar = 123
        with patch_varname_getter():
            st.help(myvar)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("myvar", ds.name)
        self.assertEqual("123", ds.value)
        self.assertEqual("int", ds.type)
        self.assertTrue(len(ds.doc_string) > 0)

    # TODO: When we stop supporting Python 3.7, uncomment this.
    # This doesn't even compile when running in 3.7, so I'm commenting it out.
    # Which means we can't test support for walrus in st.help :(
    # def test_walrus(self):
    #     """Test a named variable using walrus operator."""

    #     with patch_varname_getter():
    #         st.help(myvar := 123)

    #     ds = self.get_delta_from_queue().new_element.doc_string
    #     self.assertEqual("myvar", ds.name)
    #     self.assertEqual("123", ds.value)
    #     self.assertEqual("int", ds.type)
    #     self.assertTrue(len(ds.doc_string) > 0)

    def test_complex_var(self):
        """Test complex dict-list-object combination."""

        myvar = {"foo": [None, {"bar": "baz"}]}

        with patch_varname_getter():
            st.help(myvar["foo"][1]["bar"].strip)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual('myvar["foo"][1]["bar"].strip', ds.name)
        self.assertEqual(r"str.strip(chars=None, /)", ds.value)
        self.assertEqual("builtin_function_or_method", ds.type)
        self.assertTrue(len(ds.doc_string) > 0)

    def test_builtin_obj(self):
        """Test a built-in function."""

        with patch_varname_getter():
            st.help(123)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("", ds.name)
        self.assertEqual("123", ds.value)
        self.assertEqual("int", ds.type)
        self.assertTrue(len(ds.doc_string) > 0)

    def test_doc_defined_for_type(self):
        """When the docs are defined for the type on an object, but not
        the object, we expect the docs of the type. This is the case
        of ndarray generated as follow.
        """

        array = np.arange(1)

        with patch_varname_getter():
            st.help(array)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("array", ds.name)
        self.assertEqual("array([0])", ds.value)
        self.assertEqual("ndarray", ds.type)
        self.assertTrue("ndarray" in ds.doc_string)

    def test_passing_a_class(self):
        """When the object is a class and no docs are defined,
        we expect docs to be None."""

        class MyClass(object):
            pass

        with patch_varname_getter():
            st.help(MyClass)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual(type(MyClass), type)
        self.assertEqual("MyClass", ds.name)
        self.assertEqual(
            "tests.streamlit.elements.help_test.StHelpTest."
            "test_passing_a_class.<locals>.MyClass()",
            ds.value,
        )
        self.assertEqual("class", ds.type)
        self.assertEqual("", ds.doc_string)

    def test_padding_an_instance(self):
        """When the type of the object is type and no docs are defined,
        we expect docs to be None."""

        class MyClass(object):
            pass

        with patch_varname_getter():
            st.help(MyClass)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual(type(MyClass), type)
        self.assertEqual("MyClass", ds.name)
        self.assertEqual(
            "tests.streamlit.elements.help_test.StHelpTest."
            "test_padding_an_instance.<locals>.MyClass()",
            ds.value,
        )
        self.assertEqual("class", ds.type)
        self.assertEqual("", ds.doc_string)

    def test_class_members(self):
        class MyClass(object):
            a = 1
            b = 2

            def __init__(self):
                self.c = 3
                self.d = 4

            @property
            def e(self):
                "Property e"
                return 5

            @staticmethod
            def staticmethod1(self, x=10):
                "Static method 1"

            @classmethod
            def classmethod1(self, y=20):
                "Class method 1"

        with patch_varname_getter():
            st.help(MyClass)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual(len(ds.members), 5)

        expected_outputs = [
            ("a", "1", "", "int"),
            ("b", "2", "", "int"),
            ("e", "", "Property e", "property"),
            ("classmethod1", "", "Class method 1", "method"),
            ("staticmethod1", "", "Static method 1", "function"),
        ]

        for i, expected in enumerate(expected_outputs):
            self.assertEqual(ds.members[i].name, expected[0])
            self.assertEqual(ds.members[i].value, expected[1])
            self.assertEqual(ds.members[i].doc_string, expected[2])
            self.assertEqual(ds.members[i].type, expected[3])

    def test_instance_members(self):
        class MyClass(object):
            a = 1
            b = 2

            def __init__(self):
                self.c = 3
                self.d = 4

            @property
            def e(self):
                "Property e"
                return 5

            @staticmethod
            def staticmethod1(self, x=10):
                "Static method 1"

            @classmethod
            def classmethod1(self, y=20):
                "Class method 1"

        my_instance = MyClass()

        with patch_varname_getter():
            st.help(my_instance)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual(len(ds.members), 7)

        expected_outputs = [
            ("a", "1", "", "int"),
            ("b", "2", "", "int"),
            ("c", "3", "", "int"),
            ("d", "4", "", "int"),
            ("e", "", "Property e", "property"),
            ("classmethod1", "", "Class method 1", "method"),
            ("staticmethod1", "", "Static method 1", "function"),
        ]

        for i, expected in enumerate(expected_outputs):
            self.assertEqual(ds.members[i].name, expected[0])
            self.assertEqual(ds.members[i].value, expected[1])
            self.assertEqual(ds.members[i].doc_string, expected[2])
            self.assertEqual(ds.members[i].type, expected[3])


st_calls = [
    "st.help({0})",
    "st.write({0})",
]


class GetVariableNameFromCodeStrTest(unittest.TestCase):
    def test_st_help_no_arg(self):
        actual = _get_variable_name_from_code_str("st.help()")
        self.assertEqual(actual, None)

    def test_variable_should_match_own_name(self):
        tests = [
            "a",
            "a_b",
            "a.b",
            "a[b]",
            "a[0]",
            "a[0].c",
            "a[0].c.foo()",
        ]

        for test in tests:
            for st_call in st_calls:
                # Wrap test in an st call.
                code = st_call.format(test)

                actual = _get_variable_name_from_code_str(code)
                self.assertEqual(actual, test)

    def test_constant_should_have_no_name(self):
        tests = [
            "None",
            "0",
            "1",
            "123",
            "False",
            "True",
            "'some string'",
            "b'some bytes'",
            "...",
        ]

        for test in tests:
            for st_call in st_calls:
                # Wrap test in an st call.
                code = st_call.format(test)

                actual = _get_variable_name_from_code_str(code)
                self.assertEqual(actual, None)

    @pytest.mark.skipif(
        sys.version_info < (3, 8), reason="Walrus was introduced in Python 3.8"
    )
    def test_walrus_should_return_var_name(self):
        for st_call in st_calls:
            # Wrap test in an st call.
            code = st_call.format("a := 123")

            actual = _get_variable_name_from_code_str(code)
            self.assertEqual(actual, "a")

    def test_magic_should_just_echo(self):
        tests = [
            "a",
            "a_b",
            "a.b",
            "a[b]",
            "a[0]",
            "a[0].c",
            "a[0].c.foo()",
            "None",
            "0",
            "1",
            "123",
            "False",
            "True",
            "'some string'",
            "b'some bytes'",
            "...",
            "f'some {f} string'",
            "[x for x in range(10)]",
            "(x for x in range(10))",
            "{x: None for x in range(10)}",
        ]

        for code in tests:
            actual = _get_variable_name_from_code_str(code)
            self.assertEqual(actual, code)

        # Testing with comma at the end
        tests += [
            "foo()",
        ]

        for code in tests:
            actual = _get_variable_name_from_code_str(code + ",")
            self.assertEqual(actual, code)

    def test_if_dont_know_just_echo(self):
        tests = [
            "foo()",
            "[x for x in range(10)]",
            "(x for x in range(10))",
            "{x: None for x in range(10)}",
        ]

        for test in tests:
            for st_call in st_calls:
                # Wrap test in an st call.
                code = st_call.format(test)

                actual = _get_variable_name_from_code_str(code)
                self.assertEqual(actual, test)

        # Python re-adds the () around generator expressions, so we
        # test this case separately.
        test = "x for x in range(10)"
        expected = "(x for x in range(10))"

        for st_call in st_calls:
            # Wrap test in an st call.
            code = st_call.format(test)

            actual = _get_variable_name_from_code_str(code)
            self.assertEqual(actual, expected)

    def test_multiline_gets_linearized(self):
        test = """foo(
            "bar"
        )"""

        for st_call in st_calls:
            # Wrap test in an st call.
            code = st_call.format(test)

            actual = _get_variable_name_from_code_str(code)
            self.assertEqual(actual, "foo(")
