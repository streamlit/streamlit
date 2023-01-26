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
from unittest.mock import patch

import numpy as np

import streamlit as st
from tests.delta_generator_test_case import DeltaGeneratorTestCase


def patch_varname_getter():
    """Patches streamlit.elements.doc_string so _get_variable_name() works outside ScriptRunner."""
    parent_frame_filename = inspect.getouterframes(inspect.currentframe())[2].filename

    return patch(
        "streamlit.elements.doc_string.SCRIPTRUNNER_FILENAME", parent_frame_filename
    )


class StHelpTest(DeltaGeneratorTestCase):
    """Test st.help."""

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

        self.assertEqual(ds.members[0].name, "a")
        self.assertEqual(ds.members[0].value, "1")
        self.assertEqual(ds.members[0].doc_string, "")
        self.assertEqual(ds.members[0].type, "int")

        self.assertEqual(ds.members[1].name, "b")
        self.assertEqual(ds.members[1].value, "2")
        self.assertEqual(ds.members[1].doc_string, "")
        self.assertEqual(ds.members[1].type, "int")

        self.assertEqual(ds.members[2].name, "e")
        self.assertEqual(ds.members[2].value, "")
        self.assertEqual(ds.members[2].doc_string, "Property e")
        self.assertEqual(ds.members[2].type, "property")

        self.assertEqual(ds.members[3].name, "classmethod1")
        self.assertEqual(ds.members[3].value, "")
        self.assertEqual(ds.members[3].doc_string, "Class method 1")
        self.assertEqual(ds.members[3].type, "method")

        self.assertEqual(ds.members[4].name, "staticmethod1")
        self.assertEqual(ds.members[4].value, "")
        self.assertEqual(ds.members[4].doc_string, "Static method 1")
        self.assertEqual(ds.members[4].type, "function")

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

        self.assertEqual(ds.members[0].name, "a")
        self.assertEqual(ds.members[0].value, "1")
        self.assertEqual(ds.members[0].doc_string, "")
        self.assertEqual(ds.members[0].type, "int")

        self.assertEqual(ds.members[1].name, "b")
        self.assertEqual(ds.members[1].value, "2")
        self.assertEqual(ds.members[1].doc_string, "")
        self.assertEqual(ds.members[1].type, "int")

        self.assertEqual(ds.members[2].name, "c")
        self.assertEqual(ds.members[2].value, "3")
        self.assertEqual(ds.members[2].doc_string, "")
        self.assertEqual(ds.members[2].type, "int")

        self.assertEqual(ds.members[3].name, "d")
        self.assertEqual(ds.members[3].value, "4")
        self.assertEqual(ds.members[3].doc_string, "")
        self.assertEqual(ds.members[3].type, "int")

        self.assertEqual(ds.members[4].name, "e")
        self.assertEqual(ds.members[4].value, "")
        self.assertEqual(ds.members[4].doc_string, "Property e")
        self.assertEqual(ds.members[4].type, "property")

        self.assertEqual(ds.members[5].name, "classmethod1")
        self.assertEqual(ds.members[5].value, "")
        self.assertEqual(ds.members[5].doc_string, "Class method 1")
        self.assertEqual(ds.members[5].type, "method")

        self.assertEqual(ds.members[6].name, "staticmethod1")
        self.assertEqual(ds.members[6].value, "")
        self.assertEqual(ds.members[6].doc_string, "Static method 1")
        self.assertEqual(ds.members[6].type, "function")
