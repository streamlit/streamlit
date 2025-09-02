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

import pytest
from parameterized import parameterized
from tornado.httputil import HTTPHeaders

import streamlit as st
from streamlit.runtime.context import (
    StreamlitCookies,
    StreamlitHeaders,
    StreamlitTheme,
    _get_request,
    _normalize_header,
)


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

    @parameterized.expand(
        [
            ("8.8.8.8", "8.8.8.8"),  # Regular IP address
            ("192.168.1.1", "192.168.1.1"),  # Private IP address
            ("127.0.0.1", None),  # IPv4 localhost
            ("::1", None),  # IPv6 localhost
        ]
    )
    @patch("streamlit.runtime.context._get_request")
    def test_ip_address_values(self, remote_ip, expected_value, mock_get_request):
        """Test that `st.context.ip_address` handles different IP addresses correctly"""
        mock_get_request.return_value = MagicMock(remote_ip=remote_ip)
        assert st.context.ip_address == expected_value

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


class StreamlitHeadersTest(unittest.TestCase):
    """Test StreamlitHeaders class methods."""

    def test_headers_get_all(self):
        """Test that get_all returns all values for a header."""
        headers = StreamlitHeaders(
            [("Content-Type", "text/html"), ("Content-Type", "text/plain")]
        )
        assert headers.get_all("content-type") == ["text/html", "text/plain"]

    def test_headers_get_all_empty(self):
        """Test that get_all returns empty list for non-existent header."""
        headers = StreamlitHeaders([])
        assert headers.get_all("non-existent") == []

    def test_headers_len(self):
        """Test that __len__ returns number of unique headers."""
        headers = StreamlitHeaders(
            [("Content-Type", "text/html"), ("Cache-Control", "no-cache")]
        )
        assert len(headers) == 2

    def test_headers_iter(self):
        """Test that __iter__ returns header keys."""
        headers = StreamlitHeaders(
            [("Content-Type", "text/html"), ("Cache-Control", "no-cache")]
        )
        header_keys = list(headers)
        assert sorted(header_keys) == ["Cache-Control", "Content-Type"]

    def test_headers_getitem_keyerror(self):
        """Test that __getitem__ raises KeyError for non-existent header."""
        headers = StreamlitHeaders([])
        with pytest.raises(KeyError, match="non-existent"):
            _ = headers["non-existent"]

    def test_headers_from_tornado(self):
        """Test creating StreamlitHeaders from Tornado HTTPHeaders."""
        tornado_headers = HTTPHeaders()
        tornado_headers.add("Content-Type", "text/html")
        tornado_headers.add("Content-Type", "text/plain")
        headers = StreamlitHeaders.from_tornado_headers(tornado_headers)
        assert headers.get_all("content-type") == ["text/html", "text/plain"]


class StreamlitCookiesTest(unittest.TestCase):
    """Test StreamlitCookies class methods."""

    def test_cookies_getitem(self):
        """Test that __getitem__ returns cookie value."""
        cookies = StreamlitCookies({"session_id": "abc123", "user_id": "456"})
        assert cookies["session_id"] == "abc123"
        assert cookies["user_id"] == "456"

    def test_cookies_len(self):
        """Test that __len__ returns number of cookies."""
        cookies = StreamlitCookies({"session_id": "abc123", "user_id": "456"})
        assert len(cookies) == 2

    def test_cookies_iter(self):
        """Test that __iter__ returns cookie keys."""
        cookies = StreamlitCookies({"session_id": "abc123", "user_id": "456"})
        cookie_keys = list(cookies)
        assert sorted(cookie_keys) == ["session_id", "user_id"]

    def test_cookies_from_tornado(self):
        """Test creating StreamlitCookies from Tornado cookies."""
        morsel1 = Morsel()
        morsel1.set("session_id", "abc123", "abc123")
        morsel2 = Morsel()
        morsel2.set("user_id", "456", "456")
        tornado_cookies = {"session_id": morsel1, "user_id": morsel2}
        cookies = StreamlitCookies.from_tornado_cookies(tornado_cookies)
        assert cookies.to_dict() == {"session_id": "abc123", "user_id": "456"}


class StreamlitThemeTest(unittest.TestCase):
    """Test StreamlitTheme class methods."""

    def test_theme_init(self):
        """Test StreamlitTheme initialization."""
        theme = StreamlitTheme({"type": "dark", "primary": "#FF0000"})
        assert theme.type == "dark"
        assert theme["primary"] == "#FF0000"

    def test_theme_from_context_info(self):
        """Test StreamlitTheme.from_context_info class method."""
        theme = StreamlitTheme.from_context_info({"type": "light"})
        assert theme.type == "light"


class ContextPropertiesNoneTest(unittest.TestCase):
    """Test context properties when context or request is None."""

    @patch("streamlit.runtime.context._get_request", MagicMock(return_value=None))
    def test_headers_none_request(self):
        """Test that headers returns empty when request is None."""
        headers = st.context.headers
        assert headers.to_dict() == {}

    @patch("streamlit.runtime.context._get_request", MagicMock(return_value=None))
    def test_cookies_none_request(self):
        """Test that cookies returns empty when request is None."""
        cookies = st.context.cookies
        assert cookies.to_dict() == {}

    @parameterized.expand(
        [
            ("theme",),
            ("timezone",),
            ("timezone_offset",),
            ("locale",),
            ("is_embedded",),
        ]
    )
    @patch("streamlit.runtime.context.get_script_run_ctx", MagicMock(return_value=None))
    def test_property_none_context(self, property_name):
        """Test that properties return None when context is None."""
        if property_name == "theme":
            assert getattr(st.context, property_name).type is None
        else:
            assert getattr(st.context, property_name) is None

    @parameterized.expand(
        [
            ("theme",),
            ("timezone",),
            ("timezone_offset",),
            ("locale",),
            ("is_embedded",),
        ]
    )
    @patch("streamlit.runtime.context.get_script_run_ctx")
    def test_property_none_context_info(self, property_name, mock_get_script_run_ctx):
        """Test that properties return None when context_info is None."""
        mock_ctx = MagicMock()
        mock_ctx.context_info = None
        mock_get_script_run_ctx.return_value = mock_ctx

        if property_name == "theme":
            assert getattr(st.context, property_name).type is None
        else:
            assert getattr(st.context, property_name) is None

    @parameterized.expand(
        [
            ("theme", "color_scheme", "dark", "dark"),
            ("timezone", "timezone", "America/New_York", "America/New_York"),
            ("timezone_offset", "timezone_offset", -300, -300),
            ("locale", "locale", "en-US", "en-US"),
            ("is_embedded", "is_embedded", True, True),
        ]
    )
    @patch("streamlit.runtime.context.get_script_run_ctx")
    def test_property_with_value(
        self,
        property_name,
        attribute_name,
        test_value,
        expected_value,
        mock_get_script_run_ctx,
    ):
        """Test that properties return correct values from context_info."""
        mock_context_info = MagicMock()
        setattr(mock_context_info, attribute_name, test_value)
        mock_ctx = MagicMock()
        mock_ctx.context_info = mock_context_info
        mock_get_script_run_ctx.return_value = mock_ctx

        if property_name == "theme":
            assert getattr(st.context, property_name).type == expected_value
        else:
            assert getattr(st.context, property_name) == expected_value

    @patch("streamlit.runtime.context._get_request", MagicMock(return_value=None))
    def test_ip_address_none_request(self):
        """Test that ip_address returns None when request is None."""
        assert st.context.ip_address is None


class GetRequestTest(unittest.TestCase):
    """Test _get_request function edge cases."""

    @patch("streamlit.runtime.context.get_script_run_ctx", MagicMock(return_value=None))
    def test_get_request_none_context(self):
        """Test that _get_request returns None when context is None."""
        assert _get_request() is None

    @patch("streamlit.runtime.context.get_script_run_ctx")
    @patch("streamlit.runtime.context.runtime")
    def test_get_request_none_session_client(
        self, mock_runtime, mock_get_script_run_ctx
    ):
        """Test that _get_request returns None when session_client is None."""
        mock_ctx = MagicMock()
        mock_ctx.session_id = "test_session"
        mock_get_script_run_ctx.return_value = mock_ctx

        mock_instance = MagicMock()
        mock_instance.get_client.return_value = None
        mock_runtime.get_instance.return_value = mock_instance

        assert _get_request() is None

    @patch("streamlit.runtime.context.get_script_run_ctx")
    @patch("streamlit.runtime.context.runtime")
    def test_get_request_non_websocket_handler(
        self, mock_runtime, mock_get_script_run_ctx
    ):
        """Test that _get_request returns None for non-BrowserWebSocketHandler."""
        mock_ctx = MagicMock()
        mock_ctx.session_id = "test_session"
        mock_get_script_run_ctx.return_value = mock_ctx

        # Create a mock session client that is not a BrowserWebSocketHandler
        mock_session_client = MagicMock()
        type(mock_session_client).__module__ = "some.other.module"
        type(mock_session_client).__qualname__ = "SomeOtherHandler"

        mock_instance = MagicMock()
        mock_instance.get_client.return_value = mock_session_client
        mock_runtime.get_instance.return_value = mock_instance

        assert _get_request() is None

    @patch("streamlit.runtime.context.get_script_run_ctx")
    @patch("streamlit.runtime.context.runtime")
    def test_get_request_valid_websocket_handler(
        self, mock_runtime, mock_get_script_run_ctx
    ):
        """Test that _get_request returns request for valid BrowserWebSocketHandler."""
        mock_ctx = MagicMock()
        mock_ctx.session_id = "test_session"
        mock_get_script_run_ctx.return_value = mock_ctx

        # Create a mock session client that is a BrowserWebSocketHandler
        mock_request = MagicMock()
        mock_session_client = MagicMock()
        # Use type() to properly mock the module and qualname
        type(
            mock_session_client
        ).__module__ = "streamlit.web.server.browser_websocket_handler"
        type(mock_session_client).__qualname__ = "BrowserWebSocketHandler"
        mock_session_client.request = mock_request

        mock_instance = MagicMock()
        mock_instance.get_client.return_value = mock_session_client
        mock_runtime.get_instance.return_value = mock_instance

        assert _get_request() == mock_request
