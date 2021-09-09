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
import pickle
import re
import threading
import unittest
from unittest.mock import patch, mock_open, MagicMock

import streamlit as st
from streamlit import StreamlitAPIException, file_util
from streamlit.caching import memo_decorator
from streamlit.caching.cache_errors import CacheError


class MemoTest(unittest.TestCase):
    def tearDown(self):
        # Some of these tests reach directly into _cache_info and twiddle it.
        # Reset default values on teardown.
        memo_decorator._cache_info.cached_func_stack = []
        memo_decorator._cache_info.suppress_st_function_warning = 0
        super().tearDown()

    def test_simple(self):
        @st.experimental_memo
        def foo():
            return 42

        self.assertEqual(foo(), 42)
        self.assertEqual(foo(), 42)

    def test_multiple_int_like_floats(self):
        @st.experimental_memo
        def foo(x):
            return x

        self.assertEqual(foo(1.0), 1.0)
        self.assertEqual(foo(3.0), 3.0)

    @patch.object(st, "exception")
    def test_return_memoized_object(self, exception):
        """If data has been cached, the memoized function shouldn't be called."""
        called = [False]

        @st.experimental_memo
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

        @st.experimental_memo
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

        @st.experimental_memo
        def foo(d):
            d["answer"] += 1
            return d["answer"]

        d = {"answer": 0}

        self.assertEqual(foo(d), 1)
        self.assertEqual(foo(d), 2)

        exception.assert_not_called()

    @patch("streamlit.caching.memo_decorator._show_cached_st_function_warning")
    def test_cached_st_function_warning(self, warning):
        st.text("foo")
        warning.assert_not_called()

        @st.experimental_memo
        def cached_func():
            st.text("Inside cached func")

        cached_func()
        warning.assert_called_once()

        warning.reset_mock()

        # Make sure everything got reset properly
        st.text("foo")
        warning.assert_not_called()

        # Test warning suppression
        @st.experimental_memo(suppress_st_warning=True)
        def suppressed_cached_func():
            st.text("No warnings here!")

        suppressed_cached_func()

        warning.assert_not_called()

        # Test nested st.cache functions
        @st.experimental_memo
        def outer():
            @st.experimental_memo
            def inner():
                st.text("Inside nested cached func")

            return inner()

        outer()
        warning.assert_called_once()

        warning.reset_mock()

        # Test st.cache functions that raise errors
        with self.assertRaises(RuntimeError):

            @st.experimental_memo
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
        @st.experimental_memo
        def cached_widget():
            st.button("Press me!")

        cached_widget()

        warning.assert_called_once()
        warning.reset_mock()

        # Make sure everything got reset properly
        st.text("foo")
        warning.assert_not_called()

    def test_multithread_stack(self):
        """Test that cached_func_stack behaves properly in multiple threads."""

        def get_counter():
            return len(memo_decorator._cache_info.cached_func_stack)

        def set_counter(val):
            memo_decorator._cache_info.cached_func_stack = ["foo"] * val

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

        @st.experimental_memo
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


class MemoPersistTest(unittest.TestCase):
    """st.memo disk persistence tests"""

    @patch("streamlit.caching.memo_decorator.streamlit_write")
    def test_dont_persist_by_default(self, mock_write):
        @st.experimental_memo
        def foo():
            return "data"

        foo()
        mock_write.assert_not_called()

    @patch("streamlit.caching.memo_decorator.streamlit_write")
    def test_persist_path(self, mock_write):
        """Ensure we're writing to ~/.streamlit/memo"""

        @st.experimental_memo(persist="disk")
        def foo():
            return "data"

        foo()
        mock_write.assert_called_once()

        write_path = mock_write.call_args[0][0]
        match = re.fullmatch(
            r"/mock/home/folder/.streamlit/cache/.*?\.memo", write_path
        )
        self.assertIsNotNone(match)

    @patch("streamlit.file_util.os.stat", MagicMock())
    @patch(
        "streamlit.file_util.get_streamlit_file_path",
        MagicMock(return_value="/cache/file"),
    )
    @patch(
        "streamlit.file_util.open",
        mock_open(read_data=pickle.dumps("mock_pickled_value")),
    )
    @patch(
        "streamlit.caching.memo_decorator.streamlit_read",
        wraps=file_util.streamlit_read,
    )
    def test_read_persisted_data(self, mock_read):
        """We should read persisted data from disk on cache miss."""

        @st.experimental_memo(persist="disk")
        def foo():
            return "actual_value"

        data = foo()
        mock_read.assert_called_once()
        self.assertEqual("mock_pickled_value", data)

    @patch("streamlit.file_util.os.stat", MagicMock())
    @patch(
        "streamlit.file_util.get_streamlit_file_path",
        MagicMock(return_value="/cache/file"),
    )
    @patch("streamlit.file_util.open", mock_open(read_data="bad_pickled_value"))
    @patch(
        "streamlit.caching.memo_decorator.streamlit_read",
        wraps=file_util.streamlit_read,
    )
    def test_read_bad_persisted_data(self, mock_read):
        """If our persisted data is bad, we raise an exception."""

        @st.experimental_memo(persist="disk")
        def foo():
            return "actual_value"

        with self.assertRaises(CacheError) as error:
            foo()
        mock_read.assert_called_once()
        self.assertEqual("Unable to read from cache", str(error.exception))

    def test_bad_persist_value(self):
        with self.assertRaises(StreamlitAPIException) as e:

            @st.experimental_memo(persist="yesplz")
            def foo():
                pass

        self.assertEqual(
            "Unsupported persist option 'yesplz'. Valid values are 'disk' or None.",
            str(e.exception),
        )
