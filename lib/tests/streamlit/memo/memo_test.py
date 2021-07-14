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

"""st.memo unit tests."""
import threading
import unittest
from unittest.mock import patch

import streamlit as st
from streamlit.memo import memo


class MemoTest(unittest.TestCase):
    def test_simple(self):
        @st.memo
        def foo():
            return 42

        self.assertEqual(foo(), 42)
        self.assertEqual(foo(), 42)

    def test_multiple_int_like_floats(self):
        @st.memo
        def foo(x):
            return x

        self.assertEqual(foo(1.0), 1.0)
        self.assertEqual(foo(3.0), 3.0)

    @patch.object(st, "exception")
    def test_return_memoized_object(self, exception):
        """If data has been cached, the memoized function shouldn't be called."""
        called = [False]

        @st.memo
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
        """Mutating a memoized return value is legal, and won't affect
        future accessors of the data."""

        @st.memo
        def f():
            return [0, 1]

        r1 = f()

        r1[0] = 1

        r2 = f()

        exception.assert_not_called()

        self.assertEqual(r1, [1, 1])
        self.assertEqual(r2, [0, 1])

    @patch.object(st, "exception")
    def test_mutate_args(self, exception):
        """Mutating an argument inside a memoized function doesn't throw
        an error (but it's probably not a great idea)."""

        @st.memo
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
            return len(memo._cache_info.cached_func_stack)

        def set_counter(val):
            memo._cache_info.cached_func_stack = ["foo"] * val

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
