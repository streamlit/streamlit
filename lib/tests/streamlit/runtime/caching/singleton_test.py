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
from unittest.mock import patch

from pympler.asizeof import asizeof

import streamlit as st
from streamlit.runtime.caching import (
    singleton_decorator,
    get_singleton_stats_provider,
)
from streamlit.runtime.caching.cache_utils import CachedResult
from streamlit.runtime.stats import CacheStat


def as_cached_result(value):
    return CachedResult(value, [], st._main.id, st.sidebar.id)


class SingletonTest(unittest.TestCase):
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


class SingletonStatsProviderTest(unittest.TestCase):
    def setUp(self):
        # Guard against external tests not properly cache-clearing
        # in their teardowns.
        st.experimental_singleton.clear()

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
