# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""st.cache (legacy) unit tests. These tests just test that `st.cache` correctly routes
to `st.cache_data` and `st.cache_resource` as expected. It does not test the actual
caching functionality, which is tested in the cache_data & cache_resource tests."""

from __future__ import annotations

import threading
import unittest
from unittest.mock import MagicMock, Mock, patch

import streamlit as st
from streamlit.runtime import Runtime
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)
from streamlit.runtime.scriptrunner import add_script_run_ctx
from tests.testutil import create_mock_script_run_ctx


class LegacyCacheTest(unittest.TestCase):
    def setUp(self) -> None:
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())
        mock_runtime = MagicMock(spec=Runtime)
        mock_runtime.cache_storage_manager = MemoryCacheStorageManager()
        Runtime._instance = mock_runtime

    def tearDown(self):
        # Some of these tests reach directly into _cache_info and twiddle it.
        # Reset default values on teardown.
        st.cache_data.clear()
        st.cache_resource.clear()

    @patch("streamlit.deprecation_util.show_deprecation_warning")
    def test_deprecation_warnings(self, show_warning_mock: Mock):
        """We show deprecation warnings when using `@st.cache`."""

        # We show the deprecation warning at declaration time:
        @st.cache
        def foo():
            return 42

        show_warning_mock.assert_called_once()

    @patch("streamlit.cache_data")
    def test_cache_data_usage(self, cache_data_mock: Mock):
        """`@st.cache` should call `st.cache_data` when no parameter are specified."""

        @st.cache
        def foo():
            return 42

        cache_data_mock.assert_called_once()

    @patch("streamlit.cache_data")
    def test_cache_data_usage_with_kwargs(self, cache_data_mock: Mock):
        """`@st.cache` should call `st.cache_data` with kwargs when `allow_output_mutation` is False."""

        @st.cache(
            allow_output_mutation=False,
            persist=True,
            show_spinner=True,
            hash_funcs={},
            max_entries=10,
            ttl=1,
        )
        def foo():
            return 42

        cache_data_mock.assert_called_once_with(
            None,
            persist=True,
            show_spinner=True,
            hash_funcs={},
            max_entries=10,
            ttl=1,
        )

    @patch("streamlit.cache_resource")
    def test_cache_resource_usage_with_kwargs(self, cache_resource_mock: Mock):
        """`@st.cache` should call `st.cache_resource` with kwargs when `allow_output_mutation` is True."""

        @st.cache(
            allow_output_mutation=True,
            persist=True,  # persist is not forwarded to cache_resource
            show_spinner=True,
            hash_funcs={},
            max_entries=10,
            ttl=1,
        )
        def foo():
            return 42

        cache_resource_mock.assert_called_once_with(
            None,
            show_spinner=True,
            hash_funcs={},
            max_entries=10,
            ttl=1,
        )
