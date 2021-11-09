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

"""Tests that are common to both st.memo and st.singleton"""

import threading
import unittest
from unittest.mock import patch

from parameterized import parameterized

import streamlit as st
from streamlit import report_thread
from streamlit.caching import (
    MEMO_CALL_STACK,
    SINGLETON_CALL_STACK,
    clear_memo_cache,
    clear_singleton_cache,
)

memo = st.experimental_memo
singleton = st.experimental_singleton


class CommonCacheTest(unittest.TestCase):
    def tearDown(self):
        # Some of these tests reach directly into CALL_STACK data and twiddle it.
        # Reset default values on teardown.
        MEMO_CALL_STACK._cached_func_stack = []
        MEMO_CALL_STACK._suppress_st_function_warning = 0
        SINGLETON_CALL_STACK._cached_func_stack = []
        SINGLETON_CALL_STACK._suppress_st_function_warning = 0

        # Clear caches
        clear_memo_cache()
        clear_singleton_cache()

        # And some tests create widgets, and can result in DuplicateWidgetID
        # errors on subsequent runs.
        ctx = report_thread.get_report_ctx()
        if ctx is not None:
            ctx.widget_ids_this_run.clear()
        super().tearDown()

    @parameterized.expand([("memo", memo), ("singleton", singleton)])
    def test_simple(self, _, cache_decorator):
        @cache_decorator
        def foo():
            return 42

        self.assertEqual(foo(), 42)
        self.assertEqual(foo(), 42)

    @parameterized.expand([("memo", memo), ("singleton", singleton)])
    def test_multiple_int_like_floats(self, _, cache_decorator):
        @cache_decorator
        def foo(x):
            return x

        self.assertEqual(foo(1.0), 1.0)
        self.assertEqual(foo(3.0), 3.0)

    @parameterized.expand([("memo", memo), ("singleton", singleton)])
    def test_return_cached_object(self, _, cache_decorator):
        """If data has been cached, the cache function shouldn't be called."""
        with patch.object(st, "exception") as mock_exception:
            called = [False]

            @cache_decorator
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

            mock_exception.assert_not_called()

    @parameterized.expand([("memo", memo), ("singleton", singleton)])
    def test_mutate_args(self, _, cache_decorator):
        """Mutating an argument inside a memoized function doesn't throw
        an error (but it's probably not a great idea)."""
        with patch.object(st, "exception") as mock_exception:

            @cache_decorator
            def foo(d):
                d["answer"] += 1
                return d["answer"]

            d = {"answer": 0}

            self.assertEqual(foo(d), 1)
            self.assertEqual(foo(d), 2)

            mock_exception.assert_not_called()

    @parameterized.expand([("memo", memo), ("singleton", singleton)])
    def test_ignored_args(self, _, cache_decorator):
        """Args prefixed with _ are not used as part of the cache key."""
        call_count = [0]

        @cache_decorator
        def foo(arg1, _arg2, *args, kwarg1, _kwarg2=None, **kwargs):
            call_count[0] += 1

        foo(1, 2, 3, kwarg1=4, _kwarg2=5, kwarg3=6, _kwarg4=7)
        self.assertEqual([1], call_count)

        # Call foo again, but change the values for _arg2, _kwarg2, and _kwarg4.
        # The call count shouldn't change, because these args will not be part
        # of the hash.
        foo(1, None, 3, kwarg1=4, _kwarg2=None, kwarg3=6, _kwarg4=None)
        self.assertEqual([1], call_count)

        # Changing the value of any other argument will increase the call
        # count. We test each argument type:

        # arg1 (POSITIONAL_OR_KEYWORD)
        foo(None, 2, 3, kwarg1=4, _kwarg2=5, kwarg3=6, _kwarg4=7)
        self.assertEqual([2], call_count)

        # *arg (VAR_POSITIONAL)
        foo(1, 2, None, kwarg1=4, _kwarg2=5, kwarg3=6, _kwarg4=7)
        self.assertEqual([3], call_count)

        # kwarg1 (KEYWORD_ONLY)
        foo(1, 2, 3, kwarg1=None, _kwarg2=5, kwarg3=6, _kwarg4=7)
        self.assertEqual([4], call_count)

        # **kwarg (VAR_KEYWORD)
        foo(1, 2, 3, kwarg1=4, _kwarg2=5, kwarg3=None, _kwarg4=7)
        self.assertEqual([5], call_count)

    @parameterized.expand(
        [
            ("memo", memo, MEMO_CALL_STACK),
            ("singleton", singleton, SINGLETON_CALL_STACK),
        ]
    )
    def test_cached_st_function_warning(self, _, cache_decorator, call_stack):
        """Ensure we properly warn when st.foo functions are called
        inside a cached function.
        """
        with patch.object(call_stack, "_show_cached_st_function_warning") as warning:
            st.text("foo")
            warning.assert_not_called()

            @cache_decorator
            def cached_func():
                st.text("Inside cached func")

            cached_func()
            warning.assert_called_once()

            warning.reset_mock()

            # Make sure everything got reset properly
            st.text("foo")
            warning.assert_not_called()

            # Test warning suppression
            @cache_decorator(suppress_st_warning=True)
            def suppressed_cached_func():
                st.text("No warnings here!")

            suppressed_cached_func()

            warning.assert_not_called()

            # Test nested st.cache functions
            @cache_decorator
            def outer():
                @cache_decorator
                def inner():
                    st.text("Inside nested cached func")

                return inner()

            outer()
            warning.assert_called_once()

            warning.reset_mock()

            # Test st.cache functions that raise errors
            with self.assertRaises(RuntimeError):

                @cache_decorator
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
            @cache_decorator
            def cached_widget():
                st.button("Press me!")

            cached_widget()

            warning.assert_called_once()
            warning.reset_mock()

            # Make sure everything got reset properly
            st.text("foo")
            warning.assert_not_called()

    @parameterized.expand(
        [("memo", MEMO_CALL_STACK), ("singleton", SINGLETON_CALL_STACK)]
    )
    def test_multithreaded_call_stack(self, _, call_stack):
        """CachedFunctionCallStack should work across multiple threads."""

        def get_counter():
            return len(call_stack._cached_func_stack)

        def set_counter(val):
            call_stack._cached_func_stack = ["foo"] * val

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

    @parameterized.expand(
        [
            ("memo", memo, clear_memo_cache),
            ("singleton", singleton, clear_singleton_cache),
        ]
    )
    def test_clear_all_caches(self, _, cache_decorator, clear_cache_func):
        """Calling a cache's global `clear_all` function should remove all
        items from all caches of the appropriate type.
        """
        foo_vals = []

        @cache_decorator
        def foo(x):
            foo_vals.append(x)
            return x

        bar_vals = []

        @cache_decorator
        def bar(x):
            bar_vals.append(x)
            return x

        foo(0), foo(1), foo(2)
        bar(0), bar(1), bar(2)
        self.assertEqual([0, 1, 2], foo_vals)
        self.assertEqual([0, 1, 2], bar_vals)

        # Clear the cache and access our original values again. They
        # should be recomputed.
        clear_cache_func()

        foo(0), foo(1), foo(2)
        bar(0), bar(1), bar(2)
        self.assertEqual([0, 1, 2, 0, 1, 2], foo_vals)
        self.assertEqual([0, 1, 2, 0, 1, 2], bar_vals)
