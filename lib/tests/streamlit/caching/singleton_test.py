# Copyright 2018-2021 Streamlit Inc.
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

"""st.singleton unit tests."""

import threading
import unittest
from unittest.mock import patch, Mock

import streamlit as st
from streamlit.caching import singleton_decorator


class SingletonTest(unittest.TestCase):
    def tearDown(self):
        # Some of these tests reach directly into _cache_info and twiddle it.
        # Reset default values on teardown.
        singleton_decorator.SINGLETON_CALL_STACK._cached_func_stack = []
        singleton_decorator.SINGLETON_CALL_STACK._suppress_st_function_warning = 0
        super().tearDown()

    @patch.object(st, "exception")
    def test_mutate_return(self, exception):
        """Mutating a singleton return value is legal, and *will* affect
        future accessors of the data."""

        @st.experimental_singleton
        def f():
            return [0, 1]

        r1 = f()

        r1[0] = 1

        r2 = f()

        exception.assert_not_called()

        self.assertEqual(r1, [1, 1])
        self.assertEqual(r2, [1, 1])

    @patch(
        "streamlit.caching.singleton_decorator.SINGLETON_CALL_STACK._show_cached_st_function_warning"
    )
    def test_cached_st_function_warning(self, warning: Mock):
        st.text("foo")
        warning.assert_not_called()

        @st.experimental_singleton
        def cached_func():
            st.text("Inside cached func")

        cached_func()
        warning.assert_called_once()

        warning.reset_mock()

        # Make sure everything got reset properly
        st.text("foo")
        warning.assert_not_called()

        # Test warning suppression
        @st.experimental_singleton(suppress_st_warning=True)
        def suppressed_cached_func():
            st.text("No warnings here!")

        suppressed_cached_func()

        warning.assert_not_called()

        # Test nested st.cache functions
        @st.experimental_singleton
        def outer():
            @st.experimental_singleton
            def inner():
                st.text("Inside nested cached func")

            return inner()

        outer()
        warning.assert_called_once()

        warning.reset_mock()

        # Test st.cache functions that raise errors
        with self.assertRaises(RuntimeError):

            @st.experimental_singleton
            def cached_raise_error():
                st.text("About to throw")
                raise RuntimeError("avast!")

            cached_raise_error()

        warning.assert_called_once()
        warning.reset_mock()

        # Make sure everything got reset properly
        st.text("foo")
        warning.assert_not_called()

        # Test st.cache functions with widgets
        @st.experimental_singleton
        def cached_widget():
            st.button("Click here!")

        cached_widget()

        warning.assert_called_once()
        warning.reset_mock()

        # Make sure everything got reset properly
        st.text("foo")
        warning.assert_not_called()
