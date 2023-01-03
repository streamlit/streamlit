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

"""st.singleton unit tests."""

import threading
import unittest
from typing import Any, List
from unittest.mock import Mock, patch

from pympler.asizeof import asizeof

import streamlit as st
from streamlit.runtime.caching import get_singleton_stats_provider, singleton_decorator
from streamlit.runtime.caching.cache_errors import CacheType
from streamlit.runtime.caching.cache_utils import MultiCacheResults
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.stats import CacheStat
from tests.streamlit.runtime.caching.common_cache_test import (
    as_cached_result as _as_cached_result,
)
from tests.testutil import create_mock_script_run_ctx


def as_cached_result(value: Any) -> MultiCacheResults:
    return _as_cached_result(value, CacheType.MEMO)


class SingletonTest(unittest.TestCase):
    def setUp(self) -> None:
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

    def tearDown(self):
        st.experimental_singleton.clear()
        # Some of these tests reach directly into _cache_info and twiddle it.
        # Reset default values on teardown.
        singleton_decorator.SINGLETON_CALL_STACK._cached_func_stack = []
        singleton_decorator.SINGLETON_CALL_STACK._suppress_st_function_warning = 0

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


class SingletonValidateTest(unittest.TestCase):
    def setUp(self) -> None:
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

    def tearDown(self):
        st.experimental_singleton.clear()
        # Some of these tests reach directly into _cache_info and twiddle it.
        # Reset default values on teardown.
        singleton_decorator.SINGLETON_CALL_STACK._cached_func_stack = []
        singleton_decorator.SINGLETON_CALL_STACK._suppress_st_function_warning = 0

    def test_validate_success(self):
        """If we have a validate function and it returns True, we don't recompute our cached value."""
        validate = Mock(return_value=True)

        call_count: List[int] = [0]

        @st.experimental_singleton(validate=validate)
        def f() -> int:
            call_count[0] += 1
            return call_count[0]

        # First call: call_count == 1; validate not called (because we computed a new value)
        self.assertEqual(1, f())
        validate.assert_not_called()

        # Subsequent calls: call_count == 1; validate called each time
        for _ in range(3):
            self.assertEqual(1, f())
            validate.assert_called_once_with(1)
            validate.reset_mock()

    def test_validate_fail(self):
        """If we have a validate function and it returns False, we recompute our cached value."""
        validate = Mock(return_value=False)

        call_count: List[int] = [0]

        @st.experimental_singleton(validate=validate)
        def f() -> int:
            call_count[0] += 1
            return call_count[0]

        # First call: call_count == 1; validate not called (because we computed a new value)
        expected_call_count = 1
        self.assertEqual(expected_call_count, f())
        validate.assert_not_called()

        # Subsequent calls: call_count increases; validate called with previous value
        for _ in range(3):
            expected_call_count += 1
            self.assertEqual(expected_call_count, f())
            validate.assert_called_once_with(expected_call_count - 1)
            validate.reset_mock()


class SingletonStatsProviderTest(unittest.TestCase):
    def setUp(self):
        # Guard against external tests not properly cache-clearing
        # in their teardowns.
        st.experimental_singleton.clear()

        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

    def tearDown(self):
        st.experimental_singleton.clear()

    def test_no_stats(self):
        self.assertEqual([], get_singleton_stats_provider().get_stats())

    def test_multiple_stats(self):
        @st.experimental_singleton
        def foo(count):
            return [3.14] * count

        @st.experimental_singleton
        def bar():
            return threading.Lock()

        foo(1)
        foo(53)
        bar()
        bar()

        foo_cache_name = f"{foo.__module__}.{foo.__qualname__}"
        bar_cache_name = f"{bar.__module__}.{bar.__qualname__}"

        expected = [
            CacheStat(
                category_name="st_singleton",
                cache_name=foo_cache_name,
                byte_length=get_byte_length(as_cached_result([3.14])),
            ),
            CacheStat(
                category_name="st_singleton",
                cache_name=foo_cache_name,
                byte_length=get_byte_length(as_cached_result([3.14] * 53)),
            ),
            CacheStat(
                category_name="st_singleton",
                cache_name=bar_cache_name,
                byte_length=get_byte_length(as_cached_result(bar())),
            ),
        ]

        # The order of these is non-deterministic, so check Set equality
        # instead of List equality
        self.assertEqual(set(expected), set(get_singleton_stats_provider().get_stats()))


def get_byte_length(value):
    """Return the byte length of the pickled value."""
    return asizeof(value)
