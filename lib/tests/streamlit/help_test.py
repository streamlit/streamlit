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

"""st.help unit test."""

from tests import testutil
import streamlit as st
import numpy as np


class StHelpTest(testutil.DeltaGeneratorTestCase):
    """Test st.help."""

    def test_basic_func_with_doc(self):
        """Test basic function with docstring."""

        def my_func(some_param, another_param=123):
            """This is the doc"""
            pass

        st.help(my_func)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("my_func", ds.name)
        self.assertEqual("help_test", ds.module)
        self.assertEqual("<class 'function'>", ds.type)
        self.assertEqual("(some_param, another_param=123)", ds.signature)
        self.assertEqual("This is the doc", ds.doc_string)

    def test_basic_func_without_doc(self):
        """Test basic function without docstring."""

        def my_func(some_param, another_param=123):
            pass

        st.help(my_func)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("my_func", ds.name)
        self.assertEqual("help_test", ds.module)
        self.assertEqual("<class 'function'>", ds.type)
        self.assertEqual("(some_param, another_param=123)", ds.signature)
        self.assertEqual("No docs available.", ds.doc_string)

    def test_deltagenerator_func(self):
        """Test Streamlit DeltaGenerator function."""

        st.help(st.audio)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("audio", ds.name)
        self.assertEqual("streamlit", ds.module)
        self.assertEqual("<class 'method'>", ds.type)
        self.assertEqual("(data, format='audio/wav', start_time=0)", ds.signature)
        self.assertTrue(ds.doc_string.startswith("Display an audio player"))

    def test_unwrapped_deltagenerator_func(self):
        """Test unwrapped Streamlit DeltaGenerator function."""
        st.help(st.dataframe)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("dataframe", ds.name)
        self.assertEqual("streamlit", ds.module)
        self.assertEqual("<class 'method'>", ds.type)
        self.assertEqual("(data=None, width=None, height=None)", ds.signature)
        self.assertTrue(ds.doc_string.startswith("Display a dataframe"))

    def test_st_cache(self):
        """Test st.cache function (since it's from the 'caching' module)."""
        st.help(st.cache)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("cache", ds.name)
        self.assertEqual("streamlit", ds.module)
        self.assertEqual("<class 'function'>", ds.type)
        self.assertEqual(
            ds.signature,
            (
                "(func=None, "
                "persist=False, "
                "allow_output_mutation=False, "
                "show_spinner=True, "
                "suppress_st_warning=False, "
                "hash_funcs=None, "
                "max_entries=None, "
                "ttl=None)"
            ),
        )
        self.assertTrue(ds.doc_string.startswith("Function decorator to"))

    def test_st_write(self):
        """Test st.write function (since it's from __init__)."""
        st.help(st.write)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("write", ds.name)
        self.assertEqual("streamlit", ds.module)
        self.assertEqual("<class 'function'>", ds.type)
        self.assertEqual("(*args, **kwargs)", ds.signature)
        self.assertTrue(ds.doc_string.startswith("Write arguments to the"))

    def test_builtin_func(self):
        """Test a built-in function."""
        st.help(dir)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("dir", ds.name)
        self.assertEqual("builtins", ds.module)
        self.assertEqual("<class 'builtin_function_or_method'>", ds.type)
        self.assertEqual("", ds.signature)
        self.assertTrue(len(ds.doc_string) > 0)

    def test_builtin_obj(self):
        """Test a built-in function."""
        st.help(123)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("", ds.name)
        self.assertEqual("", ds.module)
        self.assertEqual("<class 'int'>", ds.type)
        self.assertEqual("", ds.signature)
        self.assertTrue(len(ds.doc_string) > 0)

    def test_doc_defined_for_type(self):
        """When the docs are defined for the type on an object, but not
        the object, we expect the docs of the type. This is the case
        of ndarray generated as follow.
        """

        array = np.arange(1)

        st.help(array)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("", ds.name)
        self.assertTrue("ndarray" in ds.doc_string)

    def test_doc_type_is_type(self):
        """When the type of the object is type and no docs are defined,
        we expect docs are not available"""

        class MyClass(object):
            pass

        st.help(MyClass)

        ds = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual(type(MyClass), type)
        self.assertEqual("MyClass", ds.name)
        self.assertEqual("help_test", ds.module)
        self.assertEqual("No docs available.", ds.doc_string)
