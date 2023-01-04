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

"""st.cache_data unit tests."""
from __future__ import annotations

import logging
import pickle
import re
import threading
import unittest
from typing import Any
from unittest.mock import MagicMock, Mock, mock_open, patch

from parameterized import parameterized

import streamlit as st
from streamlit import file_util
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Text_pb2 import Text as TextProto
from streamlit.runtime.caching import cache_data_api
from streamlit.runtime.caching.cache_data_api import (
    get_cache_path,
    get_data_cache_stats_provider,
)
from streamlit.runtime.caching.cache_errors import CacheError, CacheType
from streamlit.runtime.caching.cache_utils import (
    CachedResult,
    ElementMsgData,
    MultiCacheResults,
    _make_widget_key,
)
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.stats import CacheStat
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.runtime.caching.common_cache_test import (
    as_cached_result as _as_cached_result,
)
from tests.testutil import create_mock_script_run_ctx


def as_cached_result(value: Any) -> MultiCacheResults:
    return _as_cached_result(value, CacheType.DATA)


def as_replay_test_data() -> MultiCacheResults:
    """Creates cached results for a function that returned 1
    and executed `st.text(1)`.
    """
    widget_key = _make_widget_key([], CacheType.DATA)
    d = {}
    d[widget_key] = CachedResult(
        1,
        [ElementMsgData("text", TextProto(body="1"), st._main.id, "")],
        st._main.id,
        st.sidebar.id,
    )
    return MultiCacheResults(set(), d)


class CacheDataTest(unittest.TestCase):
    def setUp(self) -> None:
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

    def tearDown(self):
        # Some of these tests reach directly into _cache_info and twiddle it.
        # Reset default values on teardown.
        cache_data_api.CACHE_DATA_CALL_STACK._cached_func_stack = []
        cache_data_api.CACHE_DATA_CALL_STACK._suppress_st_function_warning = 0
        st.cache_data.clear()

    @patch.object(st, "exception")
    def test_mutate_return(self, exception):
        """Mutating a memoized return value is legal, and *won't* affect
        future accessors of the data."""

        @st.cache_data
        def f():
            return [0, 1]

        r1 = f()

        r1[0] = 1

        r2 = f()

        exception.assert_not_called()

        self.assertEqual(r1, [1, 1])
        self.assertEqual(r2, [0, 1])

    def test_multiple_api_names(self):
        """`st.cache_data` is effectively an alias for `st.cache_data`, and we
        support both APIs while cache_data is being deprecated.
        """
        num_calls = [0]

        def foo():
            num_calls[0] += 1
            return 42

        # Annotate a function with both `cache_data` and `cache_data`.
        cache_data_func = st.cache_data(foo)
        memo_func = st.cache_data(foo)

        # Call both versions of the function and assert the results.
        self.assertEqual(42, cache_data_func())
        self.assertEqual(42, memo_func())

        # Because these decorators share the same cache, calling both functions
        # results in just a single call to the decorated function.
        self.assertEqual(1, num_calls[0])


class CacheDataPersistTest(DeltaGeneratorTestCase):
    """st.cache_data disk persistence tests"""

    def tearDown(self) -> None:
        st.cache_data.clear()
        super().tearDown()

    @patch("streamlit.runtime.caching.cache_data_api.streamlit_write")
    def test_dont_persist_by_default(self, mock_write):
        @st.cache_data
        def foo():
            return "data"

        foo()
        mock_write.assert_not_called()

    @patch("streamlit.runtime.caching.cache_data_api.streamlit_write")
    def test_persist_path(self, mock_write):
        """Ensure we're writing to ~/.streamlit/cache/*.memo"""

        @st.cache_data(persist="disk")
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
        "streamlit.file_util.open",
        mock_open(read_data=pickle.dumps(as_cached_result("mock_pickled_value"))),
    )
    @patch(
        "streamlit.runtime.caching.cache_data_api.streamlit_read",
        wraps=file_util.streamlit_read,
    )
    def test_read_persisted_data(self, mock_read):
        """We should read persisted data from disk on cache miss."""

        @st.cache_data(persist="disk")
        def foo():
            return "actual_value"

        data = foo()
        mock_read.assert_called_once()
        self.assertEqual("mock_pickled_value", data)

    @patch("streamlit.file_util.os.stat", MagicMock())
    @patch("streamlit.file_util.open", mock_open(read_data="bad_pickled_value"))
    @patch(
        "streamlit.runtime.caching.cache_data_api.streamlit_read",
        wraps=file_util.streamlit_read,
    )
    def test_read_bad_persisted_data(self, mock_read):
        """If our persisted data is bad, we raise an exception."""

        @st.cache_data(persist="disk")
        def foo():
            return "actual_value"

        with self.assertRaises(CacheError) as error:
            foo()
        mock_read.assert_called_once()
        self.assertEqual("Unable to read from cache", str(error.exception))

    def test_bad_persist_value(self):
        """Throw an error if an invalid value is passed to 'persist'."""
        with self.assertRaises(StreamlitAPIException) as e:

            @st.cache_data(persist="yesplz")
            def foo():
                pass

        self.assertEqual(
            "Unsupported persist option 'yesplz'. Valid values are 'disk' or None.",
            str(e.exception),
        )

    @patch("shutil.rmtree")
    def test_clear_all_disk_caches(self, mock_rmtree):
        """`clear_all` should remove the disk cache directory if it exists."""

        # If the cache dir exists, we should delete it.
        with patch("os.path.isdir", MagicMock(return_value=True)):
            st.cache_data.clear()
            mock_rmtree.assert_called_once_with(get_cache_path())

        mock_rmtree.reset_mock()

        # If the cache dir does not exist, we shouldn't try to delete it.
        with patch("os.path.isdir", MagicMock(return_value=False)):
            st.cache_data.clear()
            mock_rmtree.assert_not_called()

    @patch("streamlit.file_util.os.stat", MagicMock())
    @patch(
        "streamlit.file_util.open",
        wraps=mock_open(read_data=pickle.dumps(as_cached_result("mock_pickled_value"))),
    )
    @patch("streamlit.runtime.caching.cache_data_api.os.remove")
    def test_clear_one_disk_cache(self, mock_os_remove: Mock, mock_open: Mock):
        """A memoized function's clear_cache() property should just clear
        that function's cache."""

        @st.cache_data(persist="disk")
        def foo(val):
            return "actual_value"

        foo(0)
        foo(1)

        # We should've opened two files, one for each distinct "foo" call.
        self.assertEqual(2, mock_open.call_count)

        # Get the names of the two files that were created. These will look
        # something like '/mock/home/folder/.streamlit/cache/[long_hash].memo'
        created_filenames = {
            mock_open.call_args_list[0][0][0],
            mock_open.call_args_list[1][0][0],
        }

        mock_os_remove.assert_not_called()

        # Clear foo's cache
        foo.clear()

        # os.remove should have been called once for each of our created cache files
        self.assertEqual(2, mock_os_remove.call_count)

        removed_filenames = {
            mock_os_remove.call_args_list[0][0][0],
            mock_os_remove.call_args_list[1][0][0],
        }

        # The two files we removed should be the same two files we created.
        self.assertEqual(created_filenames, removed_filenames)

    @patch("streamlit.file_util.os.stat", MagicMock())
    @patch(
        "streamlit.file_util.open",
        wraps=mock_open(read_data=pickle.dumps(as_replay_test_data())),
    )
    def test_cached_st_function_replay(self, _):
        @st.cache_data(persist="disk")
        def foo(i):
            st.text(i)
            return i

        foo(1)

        deltas = self.get_all_deltas_from_queue()
        text = [
            element.text.body
            for element in (delta.new_element for delta in deltas)
            if element.WhichOneof("type") == "text"
        ]
        assert text == ["1"]

    @patch("streamlit.file_util.os.stat", MagicMock())
    @patch("streamlit.runtime.caching.cache_data_api.streamlit_write", MagicMock())
    @patch(
        "streamlit.file_util.open",
        wraps=mock_open(read_data=pickle.dumps(1)),
    )
    def test_cached_format_migration(self, _):
        @st.cache_data(persist="disk")
        def foo(i):
            st.text(i)
            return i

        # Executes normally, without raising any errors
        foo(1)

    @patch("streamlit.runtime.caching.cache_data_api.streamlit_write")
    def test_warning_memo_ttl_persist(self, _):
        """Using @st.cache_data with ttl and persist produces a warning."""
        with self.assertLogs(
            "streamlit.runtime.caching.cache_data_api", level=logging.WARNING
        ) as logs:

            @st.cache_data(ttl=60, persist="disk")
            def user_function():
                return 42

            st.write(user_function())

            output = "".join(logs.output)
            self.assertIn(
                "The cached function 'user_function' has a TTL that will be ignored.",
                output,
            )

    @parameterized.expand(
        [
            ("disk", "disk", True),
            ("True", True, True),
            ("None", None, False),
            ("False", False, False),
        ]
    )
    @patch("streamlit.runtime.caching.cache_data_api.streamlit_write")
    def test_persist_param_value(
        self,
        _,
        persist_value: str | bool | None,
        should_persist: bool,
        mock_write: Mock,
    ):
        """Passing "disk" or `True` enables persistence; `None` or `False` disables it."""

        @st.cache_data(persist=persist_value)
        def foo():
            return "data"

        foo()

        if should_persist:
            mock_write.assert_called_once()
        else:
            mock_write.assert_not_called()


class CacheDataStatsProviderTest(unittest.TestCase):
    def setUp(self):
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

        # Guard against external tests not properly cache-clearing
        # in their teardowns.
        st.cache_data.clear()

    def tearDown(self):
        st.cache_data.clear()

    def test_no_stats(self):
        self.assertEqual([], get_data_cache_stats_provider().get_stats())

    def test_multiple_stats(self):
        @st.cache_data
        def foo(count):
            return [3.14] * count

        @st.cache_data
        def bar():
            return "shivermetimbers"

        foo(1)
        foo(53)
        bar()
        bar()

        foo_cache_name = f"{foo.__module__}.{foo.__qualname__}"
        bar_cache_name = f"{bar.__module__}.{bar.__qualname__}"

        expected = [
            CacheStat(
                category_name="st_cache_data",
                cache_name=foo_cache_name,
                byte_length=get_byte_length(as_cached_result([3.14])),
            ),
            CacheStat(
                category_name="st_cache_data",
                cache_name=foo_cache_name,
                byte_length=get_byte_length(as_cached_result([3.14] * 53)),
            ),
            CacheStat(
                category_name="st_cache_data",
                cache_name=bar_cache_name,
                byte_length=get_byte_length(as_cached_result("shivermetimbers")),
            ),
        ]

        # The order of these is non-deterministic, so check Set equality
        # instead of List equality
        self.assertEqual(
            set(expected), set(get_data_cache_stats_provider().get_stats())
        )


def get_byte_length(value):
    """Return the byte length of the pickled value."""
    return len(pickle.dumps(value))
