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

"""st.caching unit tests."""
import threading
import unittest
import pytest

from mock import patch

import streamlit as st
from streamlit import caching
from tests import testutil


class CacheTest(testutil.DeltaGeneratorTestCase):
    def tearDown(self):
        # Some of these tests reach directly into _cache_info and twiddle it.
        # Reset default values on teardown.
        st.caching._cache_info.within_cached_func = 0
        st.caching._cache_info.suppress_st_function_warning = 0

    def test_simple(self):
        @st.cache
        def foo():
            return 42

        self.assertEqual(foo(), 42)
        self.assertEqual(foo(), 42)

    def test_deprecated_kwarg(self):
        with pytest.raises(Exception) as e:

            @st.cache(ignore_hash=True)
            def foo():
                return 42

        assert (
            "The `ignore_hash` argument has been renamed to `allow_output_mutation`."
            in str(e.value)
        )

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

        r2 = f()

        warning.assert_called()

        self.assertEqual(r, r2)

    @patch.object(st, "warning")
    def test_mutate_args(self, warning):
        @st.cache
        def foo(d):
            d["answer"] += 1
            return d["answer"]

        d = {"answer": 0}

        self.assertNotEqual(foo(d), foo(d))

        warning.assert_not_called()

    @patch("streamlit.caching._show_cached_st_function_warning")
    def test_cached_st_function_warning(self, warning):
        st.text("foo")
        warning.assert_not_called()

        @st.cache
        def cached_func():
            st.text("Inside cached func")

        cached_func()
        warning.assert_called_once()

        warning.reset_mock()

        # Make sure everything got reset properly
        st.text("foo")
        warning.assert_not_called()

        # Test warning suppression
        @st.cache(suppress_st_warning=True)
        def suppressed_cached_func():
            st.text("No warnings here!")

        suppressed_cached_func()

        warning.assert_not_called()

        # Test nested st.cache functions
        @st.cache
        def outer():
            @st.cache
            def inner():
                st.text("Inside nested cached func")

            return inner()

        outer()
        warning.assert_called_once()

        warning.reset_mock()

        # Test st.cache functions that raise errors
        with self.assertRaises(RuntimeError):

            @st.cache
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
        @st.cache
        def cached_widget():
            st.button("Press me!")

        cached_widget()

        warning.assert_called_once()
        warning.reset_mock()

        # Make sure everything got reset properly
        st.text("foo")
        warning.assert_not_called()

    def test_caching_counter(self):
        """Test that _within_cached_function_counter behaves properly in
        multiple threads."""

        def get_counter():
            return caching._cache_info.within_cached_func

        def set_counter(val):
            caching._cache_info.within_cached_func = val

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

    def test_max_size(self):
        """The oldest object should be evicted when maxsize is reached."""
        # Create 2 cached functions to test that they don't interfere
        # with each other.

        foo_vals = []

        @st.cache(max_entries=2)
        def foo(x):
            foo_vals.append(x)
            return x

        bar_vals = []

        @st.cache(max_entries=3)
        def bar(x):
            bar_vals.append(x)
            return x

        self.assertEqual([], foo_vals)
        self.assertEqual([], bar_vals)

        # Stick two items in both caches. foo will be filled.
        foo(0), foo(1)
        bar(0), bar(1)
        self.assertEqual([0, 1], foo_vals)
        self.assertEqual([0, 1], bar_vals)

        # 0, 1 are already cached, so called_values shouldn't change.
        foo(0), foo(1)
        bar(0), bar(1)
        self.assertEqual([0, 1], foo_vals)
        self.assertEqual([0, 1], bar_vals)

        # Add a new item to the cache.
        # foo: 0 should be evicted; 1 and 2 should be present.
        # bar: 0, 1, 2 present.
        foo(2)
        bar(2)

        # foo(0) again should cause 0 to be added again, since it was
        # previously evicted. Nothing will have been evicted from bar.
        foo(1), foo(0)
        bar(1), bar(0)
        self.assertEqual([0, 1, 2, 0], foo_vals)
        self.assertEqual([0, 1, 2], bar_vals)

    # Reduce the huge amount of logspam we get from hashing/caching
    @patch("streamlit.hashing.LOGGER.debug")
    @patch("streamlit.caching.LOGGER.debug")
    def test_no_max_size(self, _1, _2):
        """If max_size is None, the cache is unbounded."""
        called_values = []

        @st.cache(max_entries=None)
        def f(x):
            called_values.append(x)
            return x

        # Stick a bunch of items in the cache.
        for ii in range(256):
            f(ii)

        # Clear called_values, and test that accessing the same bunch of
        # items doesn't result in f() being called.
        called_values = []
        for ii in range(256):
            f(ii)
        self.assertEqual([], called_values)

    @patch("streamlit.caching.TTLCACHE_TIMER")
    def test_ttl(self, timer_patch):
        """Entries should expire after the given ttl."""
        # Create 2 cached functions to test that they don't interfere
        # with each other.
        foo_vals = []

        @st.cache(ttl=1)
        def foo(x):
            foo_vals.append(x)
            return x

        bar_vals = []

        @st.cache(ttl=5)
        def bar(x):
            bar_vals.append(x)
            return x

        # Store a value at time 0
        timer_patch.return_value = 0
        foo(0)
        bar(0)
        self.assertEqual([0], foo_vals)
        self.assertEqual([0], bar_vals)

        # Advance our timer, but not enough to expire our value.
        timer_patch.return_value = 0.5
        foo(0)
        bar(0)
        self.assertEqual([0], foo_vals)
        self.assertEqual([0], bar_vals)

        # Advance our timer enough to expire foo, but not bar.
        timer_patch.return_value = 1.5
        foo(0)
        bar(0)
        self.assertEqual([0, 0], foo_vals)
        self.assertEqual([0], bar_vals)

    def test_clear_cache(self):
        """Clear cache should do its thing."""
        foo_vals = []

        @st.cache
        def foo(x):
            foo_vals.append(x)
            return x

        bar_vals = []

        @st.cache
        def bar(x):
            bar_vals.append(x)
            return x

        foo(0), foo(1), foo(2)
        bar(0), bar(1), bar(2)
        self.assertEqual([0, 1, 2], foo_vals)
        self.assertEqual([0, 1, 2], bar_vals)

        # Clear the cache and access our original values again. They
        # should be recomputed.
        caching.clear_cache()

        foo(0), foo(1), foo(2)
        bar(0), bar(1), bar(2)
        self.assertEqual([0, 1, 2, 0, 1, 2], foo_vals)
        self.assertEqual([0, 1, 2, 0, 1, 2], bar_vals)


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

    def off_test_allow_output_mutation(self):
        val = 42

        for _ in range(2):
            c = st.Cache(allow_output_mutation=True)
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
