# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

"""st.caching unit tests."""
import threading
import unittest

from mock import patch

import streamlit as st
from streamlit import caching
from streamlit.caching import _build_args_mutated_message
from streamlit.caching import is_within_cached_function


class CacheTest(unittest.TestCase):
    def tearDown(self):
        st.caching._within_cached_function_counter.val = 0

    def test_simple(self):
        @st.cache
        def foo():
            return 42

        self.assertEqual(foo(), 42)
        self.assertEqual(foo(), 42)

    @patch.object(st, "warning")
    def test_args(self, warning):
        called = [False]

        @st.cache
        def f(x):
            called[0] = True
            return x

        self.assertFalse(called[0])
        f(0)

        self.assertTrue(called[0])

        called = [False]  # Reset called

        f(0)
        self.assertFalse(called[0])

        f(1)
        self.assertTrue(called[0])

        warning.assert_not_called()

    @patch.object(st, "warning")
    def test_mutate_return(self, warning):
        @st.cache
        def f():
            return [0, 1]

        r = f()

        r[0] = 1

        warning.assert_not_called()

        f()

        warning.assert_called()

    @patch.object(st, "warning")
    def test_mutate_args(self, warning):
        @st.cache
        def f(x):
            x[0] = 2

        warning.assert_not_called()

        f([1, 2])

        warning.assert_called_with(_build_args_mutated_message(f))

    def test_is_within_cached_function(self):
        # By default, we're not within @st.cache
        self.assertFalse(is_within_cached_function())

        @st.cache
        def f():
            # This should be true when we're in a cache function
            return is_within_cached_function()

        was_within_cached_function = f()
        self.assertTrue(was_within_cached_function)
        self.assertFalse(is_within_cached_function())

        # Test nested st.cache functions
        @st.cache
        def outer():
            @st.cache
            def inner():
                return is_within_cached_function()

            return inner()

        was_within_cached_function = outer()
        self.assertTrue(was_within_cached_function)
        self.assertFalse(is_within_cached_function())

        # Test st.cache functions that raise errors
        with self.assertRaises(RuntimeError):

            @st.cache
            def cached_raise_error():
                self.assertTrue(is_within_cached_function())
                raise RuntimeError("avast!")

            cached_raise_error()
        self.assertFalse(is_within_cached_function())

    def test_caching_counter(self):
        """Test that _within_cached_function_counter behaves properly in
        multiple threads."""

        def get_counter():
            return caching._within_cached_function_counter.val

        def set_counter(val):
            caching._within_cached_function_counter.val = val

        self.assertEqual(0, get_counter())
        set_counter(1)
        self.assertEqual(1, get_counter())

        values_in_thread = []

        def thread_test():
            values_in_thread.append(get_counter())
            set_counter(55)
            values_in_thread.append(get_counter())

        thread = threading.Thread(target=thread_test)
        thread.start()
        thread.join()

        self.assertEqual([0, 55], values_in_thread)

        # The other thread should not have modified the main thread
        self.assertEqual(1, get_counter())


# Temporarily turn off these tests since there's no Cache object in __init__
# right now.
class CachingObjectTest(unittest.TestCase):
    def off_test_simple(self):
        val = 42

        for _ in range(2):
            c = st.Cache()
            if c:
                c.value = val

            self.assertEqual(c.value, val)

    def off_test_ignore_hash(self):
        val = 42

        for _ in range(2):
            c = st.Cache(ignore_hash=True)
            if c:
                c.value = val

            self.assertEqual(c.value, val)

    def off_test_has_changes(self):
        val = 42

        for _ in range(2):
            c = st.Cache()
            if c.has_changes():
                c.value = val

            self.assertEqual(c.value, val)

    @patch.object(st, "warning")
    def off_test_mutate(self, warning):
        for _ in range(2):
            c = st.Cache()
            if c:
                c.value = [0, 1]

            c.value[0] = 1

        warning.assert_called()
