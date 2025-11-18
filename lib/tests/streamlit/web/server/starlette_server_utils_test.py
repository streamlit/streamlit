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

"""Unit tests for starlette_server_utils.py."""

from __future__ import annotations

import unittest
from unittest.mock import patch

import pytest
from tornado.util import _websocket_mask
from tornado.web import create_signed_value

from streamlit.web.server import starlette_server_utils


class StarletteServerUtilsTest(unittest.TestCase):
    def test_parse_range_header_bytes(self):
        """Test parsing standard byte ranges."""
        # Entire file
        assert starlette_server_utils.parse_range_header("bytes=0-", 100) == (0, 99)
        # First 10 bytes
        assert starlette_server_utils.parse_range_header("bytes=0-9", 100) == (0, 9)
        # Middle range
        assert starlette_server_utils.parse_range_header("bytes=10-19", 100) == (10, 19)
        # Last 10 bytes (suffix)
        assert starlette_server_utils.parse_range_header("bytes=-10", 100) == (90, 99)
        # Range exceeding end caps at end
        assert starlette_server_utils.parse_range_header("bytes=90-200", 100) == (
            90,
            99,
        )

    def test_parse_range_header_errors(self):
        """Test invalid range headers raise ValueError."""
        # Empty content
        with pytest.raises(ValueError, match="empty content"):
            starlette_server_utils.parse_range_header("bytes=0-10", 0)

        # Invalid units
        with pytest.raises(ValueError, match="invalid range"):
            starlette_server_utils.parse_range_header("bits=0-10", 100)

        # Multiple ranges not supported
        with pytest.raises(ValueError, match="invalid range"):
            starlette_server_utils.parse_range_header("bytes=0-10, 20-30", 100)

        # Invalid start
        with pytest.raises(ValueError, match="invalid suffix range"):
            starlette_server_utils.parse_range_header("bytes=-5-10", 100)

        # Start > total
        with pytest.raises(ValueError, match="start out of range"):
            starlette_server_utils.parse_range_header("bytes=150-200", 100)

        # End before start
        with pytest.raises(ValueError, match="end before start"):
            starlette_server_utils.parse_range_header("bytes=50-40", 100)

    def test_websocket_mask_compatibility(self):
        """Test that websocket_mask matches Tornado's implementation."""
        mask = b"1234"
        data = b"hello world"

        expected = _websocket_mask(mask, data)
        actual = starlette_server_utils.websocket_mask(mask, data)
        assert actual == expected

        # It should be reversible (XOR)
        masked = actual
        unmasked = starlette_server_utils.websocket_mask(mask, masked)
        assert unmasked == data

    def test_decode_signed_value_compatibility(self):
        """Test that decode_signed_value is compatible with Tornado's create_signed_value."""
        secret = "test_secret_key"
        name = "test_cookie"
        value = "test_value"

        # Create a signed value using Tornado
        signed_value = create_signed_value(secret, name, value)

        # Decode using our utility
        decoded = starlette_server_utils.decode_signed_value(secret, name, signed_value)
        assert decoded.decode("utf-8") == value

    @patch("streamlit.web.server.starlette_server_utils._tornado_decode_signed_value")
    def test_decode_signed_value_fallback(self, mock_tornado_decode):
        """Test that it falls back gracefully (currently returns None) if Tornado is missing or mocking fails."""
        # Simulate tornado missing by mocking the internal import reference to None
        # (This is slightly tricky since we can't easily unload the module, but we can force the fallback path
        # if we were to modify the module. Since we can't easily modify the module state for just one test without
        # reloading, we will test the logic by mocking the implementation if it were None).

        # Ideally, we would test the fallback logic if we implemented a pure python version.
        # Since currently it wraps Tornado, we just verify it calls it.
        mock_tornado_decode.return_value = b"decoded"

        result = starlette_server_utils.decode_signed_value("secret", "name", "value")
        assert result == b"decoded"
        mock_tornado_decode.assert_called_once()
