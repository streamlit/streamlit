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

"""st.cache_resource unit tests."""

import threading
import unittest
from typing import Any
from unittest.mock import patch

from pympler.asizeof import asizeof

import streamlit as st
from streamlit.runtime.caching import (
    cache_resource_api,
    get_resource_cache_stats_provider,
)
from streamlit.runtime.caching.cache_errors import CacheType
from streamlit.runtime.caching.cache_utils import MultiCacheResults
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.stats import CacheStat
from tests.streamlit.runtime.caching.common_cache_test import (
    as_cached_result as _as_cached_result,
)
from tests.testutil import create_mock_script_run_ctx


def as_cached_result(value: Any) -> MultiCacheResults:
    return _as_cached_result(value, CacheType.RESOURCE)


class CacheResourceTest(unittest.TestCase):
    def setUp(self) -> None:
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

    def tearDown(self):
        st.experimental_singleton.clear()
        # Some of these tests reach directly into _cache_info and twiddle it.
        # Reset default values on teardown.
        cache_resource_api.CACHE_RESOURCE_CALL_STACK._cached_func_stack = []
        cache_resource_api.CACHE_RESOURCE_CALL_STACK._suppress_st_function_warning = 0

    @patch.object(st, "exception")
    def test_mutate_return(self, exception):
        """Mutating a cache_resource return value is legal, and *will* affect
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


class CacheResourceStatsProviderTest(unittest.TestCase):
    def setUp(self):
        # Guard against external tests not properly cache-clearing
        # in their teardowns.
        st.experimental_singleton.clear()

        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

    def tearDown(self):
        st.experimental_singleton.clear()

    def test_no_stats(self):
        self.assertEqual([], get_resource_cache_stats_provider().get_stats())

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
                category_name="st_cache_resource",
                cache_name=foo_cache_name,
                byte_length=get_byte_length(as_cached_result([3.14])),
            ),
            CacheStat(
                category_name="st_cache_resource",
                cache_name=foo_cache_name,
                byte_length=get_byte_length(as_cached_result([3.14] * 53)),
            ),
            CacheStat(
                category_name="st_cache_resource",
                cache_name=bar_cache_name,
                byte_length=get_byte_length(as_cached_result(bar())),
            ),
        ]

        # The order of these is non-deterministic, so check Set equality
        # instead of List equality
        self.assertEqual(
            set(expected), set(get_resource_cache_stats_provider().get_stats())
        )


def get_byte_length(value: Any) -> int:
    """Return the byte length of the pickled value."""
    return asizeof(value)
