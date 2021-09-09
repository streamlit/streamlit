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
from unittest.mock import patch

import streamlit as st
from streamlit.caching.singleton_decorator import _cache_info


class SingletonTest(unittest.TestCase):
    def test_simple(self):
        @st.experimental_singleton
        def foo():
            return 42

        self.assertEqual(foo(), 42)
        self.assertEqual(foo(), 42)

    def test_multiple_int_like_floats(self):
        @st.experimental_singleton
        def foo(x):
            return x

        self.assertEqual(foo(1.0), 1.0)
        self.assertEqual(foo(3.0), 3.0)

    @patch.object(st, "exception")
    def test_return_memoized_object(self, exception):
        """If data has been cached, the memoized function shouldn't be called."""
        called = [False]

        @st.experimental_singleton
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

        exception.assert_not_called()

    @patch.object(st, "exception")
    def test_mutate_return(self, exception):
        """Mutating a memoized return value is legal, and will affect
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

    @patch.object(st, "exception")
    def test_mutate_args(self, exception):
        """Mutating an argument inside a memoized function doesn't throw
        an error (but it's probably not a great idea)."""

        @st.experimental_singleton
        def foo(d):
            d["answer"] += 1
            return d["answer"]

        d = {"answer": 0}

        self.assertEqual(foo(d), 1)
        self.assertEqual(foo(d), 2)

        exception.assert_not_called()

    def test_multithread_stack(self):
        """Test that cached_func_stack behaves properly in multiple threads."""

        def get_counter():
            return len(_cache_info.cached_func_stack)

        def set_counter(val):
            _cache_info.cached_func_stack = ["foo"] * val

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

    def test_ignored_args(self):
        """Args prefixed with _ are not used as part of the cache key."""
        call_count = [0]

        @st.experimental_singleton
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
