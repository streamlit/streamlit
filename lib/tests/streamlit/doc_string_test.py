# -*- coding: future_fstrings -*-
# Copyright 2019 Streamlit Inc. All rights reserved.

"""doc_string unit test."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import unittest
import sys

import streamlit as st
from streamlit import protobuf
from streamlit import doc_string

is_python_2 = sys.version_info[0] == 2


class DocStringTest(unittest.TestCase):
    """Test ability to marshall docstring protos."""

    def test_basic_func_with_doc(self):
        """Test basic function with docstring."""
        def my_func(some_param, another_param=123):
            """This is the doc"""
            pass

        delta = protobuf.Delta()
        doc_string.marshall(delta.new_element, my_func)

        ds = delta.new_element.doc_string
        self.assertEqual(ds.name, 'my_func')
        self.assertEqual(ds.module, 'doc_string_test')
        if is_python_2:
            self.assertEqual(ds.type, '<type \'function\'>')
        else:
            self.assertEqual(ds.type, '<class \'function\'>')
        self.assertEqual(ds.signature, '(some_param, another_param=123)')
        self.assertEqual(ds.doc_string, 'This is the doc')

    def test_basic_func_without_doc(self):
        """Test basic function without docstring."""
        def my_func(some_param, another_param=123):
            pass

        delta = protobuf.Delta()
        doc_string.marshall(delta.new_element, my_func)

        ds = delta.new_element.doc_string
        self.assertEqual(ds.name, 'my_func')
        self.assertEqual(ds.module, 'doc_string_test')
        if is_python_2:
            self.assertEqual(ds.type, '<type \'function\'>')
        else:
            self.assertEqual(ds.type, '<class \'function\'>')
        self.assertEqual(ds.signature, '(some_param, another_param=123)')
        self.assertEqual(ds.doc_string, 'No docs available.')

    def test_deltagenerator_func(self):
        """Test Streamlit DeltaGenerator function."""
        delta = protobuf.Delta()
        doc_string.marshall(delta.new_element, st.audio)

        ds = delta.new_element.doc_string
        self.assertEqual(ds.name, 'audio')
        self.assertEqual(ds.module, 'streamlit')
        if is_python_2:
            self.assertEqual(ds.type, '<type \'function\'>')
            self.assertEqual(ds.signature, '(data, format=u\'audio/wav\')')
        else:
            self.assertEqual(ds.type, '<class \'function\'>')
            self.assertEqual(ds.signature, '(data, format=\'audio/wav\')')
        self.assertTrue(ds.doc_string.startswith('Display an audio player'))

    def test_unwrapped_deltagenerator_func(self):
        """Test unwrapped Streamlit DeltaGenerator function."""
        delta = protobuf.Delta()
        doc_string.marshall(delta.new_element, st.dataframe)

        ds = delta.new_element.doc_string
        self.assertEqual(ds.name, 'dataframe')
        self.assertEqual(ds.module, 'streamlit')
        if is_python_2:
            self.assertEqual(ds.type, '<type \'function\'>')
        else:
            self.assertEqual(ds.type, '<class \'function\'>')
        self.assertEqual(ds.signature, '(df)')
        self.assertTrue(ds.doc_string.startswith('Display a dataframe'))

    def test_st_cache(self):
        """Test st.cache function (since it's from the 'caching' module)."""
        delta = protobuf.Delta()
        doc_string.marshall(delta.new_element, st.cache)

        ds = delta.new_element.doc_string
        self.assertEqual(ds.name, 'cache')
        self.assertEqual(ds.module, 'streamlit')
        if is_python_2:
            self.assertEqual(ds.type, '<type \'function\'>')
        else:
            self.assertEqual(ds.type, '<class \'function\'>')
        self.assertEqual(ds.signature, '(func)')
        self.assertTrue(ds.doc_string.startswith('Function decorator to'))

    def test_st_write(self):
        """Test st.write function (since it's from __init__)."""
        delta = protobuf.Delta()
        doc_string.marshall(delta.new_element, st.write)

        ds = delta.new_element.doc_string
        self.assertEqual(ds.name, 'write')
        self.assertEqual(ds.module, 'streamlit')
        if is_python_2:
            self.assertEqual(ds.type, '<type \'function\'>')
        else:
            self.assertEqual(ds.type, '<class \'function\'>')
        self.assertEqual(ds.signature, '(*args)')
        self.assertTrue(ds.doc_string.startswith('Write arguments to the'))

    def test_builtin_func(self):
        """Test a built-in function."""
        delta = protobuf.Delta()
        doc_string.marshall(delta.new_element, dir)

        ds = delta.new_element.doc_string
        self.assertEqual(ds.name, 'dir')
        if is_python_2:
            self.assertEqual(ds.module, '__builtin__')
            self.assertEqual(ds.type, '<type \'builtin_function_or_method\'>')
        else:
            self.assertEqual(ds.module, 'builtins')
            self.assertEqual(ds.type, '<class \'builtin_function_or_method\'>')
        self.assertEqual(ds.signature, '')
        self.assertTrue(len(ds.doc_string) > 0)

    def test_builtin_obj(self):
        """Test a built-in function."""
        delta = protobuf.Delta()
        doc_string.marshall(delta.new_element, 123)

        ds = delta.new_element.doc_string
        self.assertEqual(ds.name, '')
        self.assertEqual(ds.module, '')
        if is_python_2:
            self.assertEqual(ds.type, '<type \'int\'>')
        else:
            self.assertEqual(ds.type, '<class \'int\'>')
        self.assertEqual(ds.signature, '')
        self.assertTrue(len(ds.doc_string) > 0)
