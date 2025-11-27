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

"""Unit tests for starlette_app_utils.py."""

from __future__ import annotations

import binascii
import time
import unittest

import pytest
from tornado.util import _websocket_mask

from streamlit.web.server.starlette import starlette_app_utils


class StarletteServerUtilsTest(unittest.TestCase):
    def test_parse_range_header_bytes(self):
        """Test parsing standard byte ranges."""
        # Entire file
        assert starlette_app_utils.parse_range_header("bytes=0-", 100) == (0, 99)
        # First 10 bytes
        assert starlette_app_utils.parse_range_header("bytes=0-9", 100) == (0, 9)
        # Middle range
        assert starlette_app_utils.parse_range_header("bytes=10-19", 100) == (10, 19)
        # Last 10 bytes (suffix)
        assert starlette_app_utils.parse_range_header("bytes=-10", 100) == (90, 99)
        # Range exceeding end caps at end
        assert starlette_app_utils.parse_range_header("bytes=90-200", 100) == (
            90,
            99,
        )

    def test_parse_range_header_errors(self):
        """Test invalid range headers raise ValueError."""
        # Empty content
        with pytest.raises(ValueError, match="empty content"):
            starlette_app_utils.parse_range_header("bytes=0-10", 0)

        # Invalid units
        with pytest.raises(ValueError, match="invalid range"):
            starlette_app_utils.parse_range_header("bits=0-10", 100)

        # Multiple ranges not supported
        with pytest.raises(ValueError, match="invalid range"):
            starlette_app_utils.parse_range_header("bytes=0-10, 20-30", 100)

        # Invalid start
        with pytest.raises(ValueError, match="invalid suffix range"):
            starlette_app_utils.parse_range_header("bytes=-5-10", 100)

        # Start > total
        with pytest.raises(ValueError, match="start out of range"):
            starlette_app_utils.parse_range_header("bytes=150-200", 100)

        # End before start
        with pytest.raises(ValueError, match="end before start"):
            starlette_app_utils.parse_range_header("bytes=50-40", 100)

    def test_websocket_mask_compatibility(self):
        """Test that websocket_mask matches Tornado's implementation."""
        mask = b"1234"
        data = b"hello world"

        expected = _websocket_mask(mask, data)
        actual = starlette_app_utils.websocket_mask(mask, data)
        assert actual == expected

        # It should be reversible (XOR)
        masked = actual
        unmasked = starlette_app_utils.websocket_mask(mask, masked)
        assert unmasked == data

    def test_websocket_mask_empty_data(self):
        """Test that masking empty data returns empty bytes."""
        mask = b"1234"
        data = b""

        result = starlette_app_utils.websocket_mask(mask, data)
        assert result == b""

    def test_websocket_mask_invalid_mask_length(self):
        """Test that invalid mask length raises ValueError."""
        with pytest.raises(ValueError, match="mask must be 4 bytes"):
            starlette_app_utils.websocket_mask(b"12", b"data")

        with pytest.raises(ValueError, match="mask must be 4 bytes"):
            starlette_app_utils.websocket_mask(b"12345", b"data")

        with pytest.raises(ValueError, match="mask must be 4 bytes"):
            starlette_app_utils.websocket_mask(b"", b"data")

    def test_websocket_mask_various_lengths(self):
        """Test masking data of various lengths matches Tornado."""
        mask = b"\x01\x02\x03\x04"

        # Test lengths 1-10 to cover different modulo cases
        for length in range(1, 11):
            data = bytes(range(length))
            expected = _websocket_mask(mask, data)
            actual = starlette_app_utils.websocket_mask(mask, data)
            assert actual == expected, f"Mismatch for length {length}"

    def test_signed_value_roundtrip(self):
        """Test that create_signed_value and decode_signed_value work together."""
        secret = "test_secret_key"
        name = "test_cookie"
        value = "test_value"

        # Create a signed value
        signed_value = starlette_app_utils.create_signed_value(secret, name, value)

        # Decode using our utility
        decoded = starlette_app_utils.decode_signed_value(secret, name, signed_value)
        assert decoded is not None
        assert decoded.decode("utf-8") == value

    def test_signed_value_with_bytes(self):
        """Test that signed value works with bytes input."""
        secret = "test_secret_key"
        name = "test_cookie"
        value = b"test_value_bytes"

        signed_value = starlette_app_utils.create_signed_value(secret, name, value)
        decoded = starlette_app_utils.decode_signed_value(secret, name, signed_value)
        assert decoded == value

    def test_decode_signed_value_invalid_signature(self):
        """Test that invalid signature returns None."""
        secret = "test_secret_key"
        name = "test_cookie"

        # Tampered value
        result = starlette_app_utils.decode_signed_value(
            secret, name, "invalid_signed_value"
        )
        assert result is None

    def test_decode_signed_value_wrong_secret(self):
        """Test that wrong secret returns None."""
        secret = "test_secret_key"
        name = "test_cookie"
        value = "test_value"

        signed_value = starlette_app_utils.create_signed_value(secret, name, value)
        result = starlette_app_utils.decode_signed_value(
            "wrong_secret", name, signed_value
        )
        assert result is None

    def test_xsrf_token_roundtrip(self):
        """Test generating and then decoding an XSRF token."""
        token = b"some_random_token_bytes"
        timestamp = int(time.time())

        # Generate string
        cookie_val = starlette_app_utils.generate_xsrf_token_string(token, timestamp)

        # Verify format
        assert cookie_val.startswith("2|")
        parts = cookie_val.split("|")
        assert len(parts) == 4

        # Decode string
        decoded_token, decoded_timestamp = starlette_app_utils.decode_xsrf_token_string(
            cookie_val
        )

        assert decoded_token == token
        assert decoded_timestamp == timestamp

    def test_decode_xsrf_token_v1(self):
        """Test decoding a legacy v1 XSRF token (unmasked hex)."""
        token = b"legacy_token"
        hex_token = binascii.b2a_hex(token).decode("ascii")

        # decode_xsrf_token_string treats anything not starting with '2|' as v1
        decoded_token, decoded_timestamp = starlette_app_utils.decode_xsrf_token_string(
            hex_token
        )

        assert decoded_token == token
        # For v1 tokens, it returns current time as timestamp
        assert decoded_timestamp is not None
        assert abs(decoded_timestamp - time.time()) < 2

    def test_decode_xsrf_token_invalid(self):
        """Test decoding invalid tokens returns (None, None)."""
        assert starlette_app_utils.decode_xsrf_token_string("invalid") == (
            None,
            None,
        )
        assert starlette_app_utils.decode_xsrf_token_string("2|bad|format") == (
            None,
            None,
        )
