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

from __future__ import annotations

import unittest
from http.cookies import Morsel
from unittest.mock import MagicMock, patch

from parameterized import parameterized
from tornado.httputil import HTTPHeaders

import streamlit as st
from streamlit.runtime.context import _normalize_header


class StContextTest(unittest.TestCase):
    mocked_cookie = Morsel()
    mocked_cookie.set("cookieName", "cookieValue", "cookieValue")

    @patch(
        "streamlit.runtime.context._get_request",
        MagicMock(
            return_value=MagicMock(headers=HTTPHeaders({"the-header": "header-value"}))
        ),
    )
    def test_context_headers(self):
        """Test that `st.context.headers` returns headers from ScriptRunContext"""
        assert st.context.headers.to_dict() == {"The-Header": "header-value"}

    @patch(
        "streamlit.runtime.context._get_request",
        MagicMock(return_value=MagicMock(cookies={"cookieName": mocked_cookie})),
    )
    def test_context_cookies(self):
        """Test that `st.context.cookies` returns cookies from ScriptRunContext"""
        assert st.context.cookies.to_dict() == {"cookieName": "cookieValue"}

    @patch(
        "streamlit.runtime.context._get_request",
        MagicMock(return_value=MagicMock(remote_ip="8.8.8.8")),
    )
    def test_ip_address(self):
        """Test that `st.context.ip_address` returns remote_ip from Tornado request"""
        assert st.context.ip_address == "8.8.8.8"

    @patch(
        "streamlit.runtime.context._get_request",
        MagicMock(return_value=MagicMock(remote_ip="127.0.0.1")),
    )
    def test_ip_address_localhost(self):
        """Test that `st.context.ip_address` returns None if run on localhost"""
        assert st.context.ip_address is None

    @patch(
        "streamlit.runtime.context.get_script_run_ctx",
        MagicMock(return_value=None),
    )
    def test_url_none_context(self):
        """Test that `st.context.url` returns None if context is None"""
        assert st.context.url is None

    @patch("streamlit.runtime.context.get_script_run_ctx")
    def test_url_none_context_info(self, mock_get_script_run_ctx):
        """Test that `st.context.url` returns None if context_info is None"""
        # Create a mock context with None context_info
        mock_ctx = MagicMock()
        mock_ctx.context_info = None
        mock_get_script_run_ctx.return_value = mock_ctx

        assert st.context.url is None

    @patch("streamlit.runtime.context.get_script_run_ctx")
    @patch("streamlit.runtime.context.maybe_trim_page_path")
    @patch("streamlit.runtime.context.maybe_add_page_path")
    def test_url(self, mock_add_path, mock_trim_path, mock_get_script_run_ctx):
        """Test that `st.context.url` returns the URL from the context after processing"""
        # Create a mock context with a URL
        mock_context_info = MagicMock()
        mock_context_info.url = "https://example.com/original"

        mock_ctx = MagicMock()
        mock_ctx.context_info = mock_context_info
        mock_get_script_run_ctx.return_value = mock_ctx

        # Mock the page manager
        mock_ctx.pages_manager = MagicMock()

        # Set up the mock return values for the URL processing functions
        mock_trim_path.return_value = "https://example.com/"
        mock_add_path.return_value = "https://example.com/added"

        # Test that the URL is processed by both functions
        result = st.context.url

        # Verify the result
        assert result == "https://example.com/added"

        # Verify that the functions were called with the correct arguments
        mock_trim_path.assert_called_once_with(
            "https://example.com/original", mock_ctx.pages_manager
        )
        mock_add_path.assert_called_once_with(
            "https://example.com/", mock_ctx.pages_manager
        )

    @parameterized.expand(
        [
            ("coNtent-TYPE", "Content-Type"),
            ("coNtent-type", "Content-Type"),
            ("Content-Type", "Content-Type"),
            ("Content-Type", "Content-Type"),
            ("Cache-Control", "Cache-Control"),
            ("Cache-control", "Cache-Control"),
            ("cache-control", "Cache-Control"),
            ("cache-CONTROL", "Cache-Control"),
            ("Access-Control-Max-Age", "Access-Control-Max-Age"),
            ("Access-control-max-age", "Access-Control-Max-Age"),
            ("access-control-MAX-age", "Access-Control-Max-Age"),
        ]
    )
    def test_normalize_header(self, name, expected):
        """Test that `_normalize_header` normalizes header names"""
        assert _normalize_header(name) == expected
