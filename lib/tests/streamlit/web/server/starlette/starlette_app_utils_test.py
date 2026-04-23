# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from streamlit.web.server.starlette import starlette_app_utils


def _reference_websocket_mask(mask: bytes, data: bytes) -> bytes:
    """Reference implementation of WebSocket masking per RFC 6455 Section 5.3.

    Each byte of data is XORed with mask[i % 4].
    """
    result = bytearray(len(data))
    for i, byte in enumerate(data):
        result[i] = byte ^ mask[i % 4]
    return bytes(result)


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
        """Test that websocket_mask matches the reference RFC 6455 implementation."""
        mask = b"1234"
        data = b"hello world"

        expected = _reference_websocket_mask(mask, data)
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
        """Test masking data of various lengths matches reference implementation."""
        mask = b"\x01\x02\x03\x04"

        # Test lengths 1-10 to cover different modulo cases
        for length in range(1, 11):
            data = bytes(range(length))
            expected = _reference_websocket_mask(mask, data)
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

    def test_decode_signed_value_empty_value(self):
        """Test that empty value returns None."""
        secret = "test_secret_key"
        name = "test_cookie"

        # Empty string
        assert starlette_app_utils.decode_signed_value(secret, name, "") is None
        # Empty bytes
        assert starlette_app_utils.decode_signed_value(secret, name, b"") is None

    def test_decode_signed_value_non_utf8_bytes(self):
        """Test that non-UTF-8 bytes return None instead of raising."""
        secret = "test_secret_key"
        name = "test_cookie"
        # Invalid UTF-8 sequence
        invalid_utf8 = b"\xff\xfe\x00\x01"

        result = starlette_app_utils.decode_signed_value(secret, name, invalid_utf8)
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

    def test_decode_xsrf_token_empty(self):
        """Test that empty/whitespace-only strings return (None, None)."""
        # Empty string
        assert starlette_app_utils.decode_xsrf_token_string("") == (None, None)
        # Whitespace only (stripped to empty)
        assert starlette_app_utils.decode_xsrf_token_string("   ") == (None, None)
        # Only quotes (stripped to empty)
        assert starlette_app_utils.decode_xsrf_token_string('""') == (None, None)
        assert starlette_app_utils.decode_xsrf_token_string("''") == (None, None)

    def test_generate_random_hex_string_default(self):
        """Test generate_random_hex_string with default length."""
        result = starlette_app_utils.generate_random_hex_string()
        # Default is 32 bytes = 64 hex characters
        assert len(result) == 64
        # Should be valid hex
        int(result, 16)

    def test_generate_random_hex_string_custom_length(self):
        """Test generate_random_hex_string with custom byte count."""
        result = starlette_app_utils.generate_random_hex_string(16)
        # 16 bytes = 32 hex characters
        assert len(result) == 32
        # Should be valid hex
        int(result, 16)

    def test_generate_random_hex_string_uniqueness(self):
        """Test that generate_random_hex_string produces unique values."""
        results = {starlette_app_utils.generate_random_hex_string() for _ in range(100)}
        # All 100 should be unique
        assert len(results) == 100


class TestValidateXsrfToken:
    """Tests for validate_xsrf_token function."""

    def test_returns_false_when_supplied_token_none(self) -> None:
        """Test that False is returned when supplied token is None."""
        xsrf_cookie = starlette_app_utils.generate_xsrf_token_string()

        result = starlette_app_utils.validate_xsrf_token(None, xsrf_cookie)

        assert result is False

    def test_returns_false_when_cookie_none(self) -> None:
        """Test that False is returned when cookie is None."""
        xsrf_token = starlette_app_utils.generate_xsrf_token_string()

        result = starlette_app_utils.validate_xsrf_token(xsrf_token, None)

        assert result is False

    def test_returns_false_when_both_none(self) -> None:
        """Test that False is returned when both are None."""
        result = starlette_app_utils.validate_xsrf_token(None, None)

        assert result is False

    def test_returns_true_for_matching_tokens(self) -> None:
        """Test that True is returned when tokens match."""
        xsrf_token = starlette_app_utils.generate_xsrf_token_string()

        result = starlette_app_utils.validate_xsrf_token(xsrf_token, xsrf_token)

        assert result is True

    def test_returns_true_for_matching_tokens_with_different_timestamps(self) -> None:
        """Test that validation succeeds when tokens have same bytes but different timestamps."""
        token_bytes = b"0123456789abcdef"
        token1 = starlette_app_utils.generate_xsrf_token_string(
            token_bytes, timestamp=12345
        )
        token2 = starlette_app_utils.generate_xsrf_token_string(
            token_bytes, timestamp=67890
        )

        result = starlette_app_utils.validate_xsrf_token(token1, token2)

        assert result is True

    def test_returns_false_for_different_tokens(self) -> None:
        """Test that False is returned when tokens differ."""
        token1 = starlette_app_utils.generate_xsrf_token_string()
        token2 = starlette_app_utils.generate_xsrf_token_string()

        result = starlette_app_utils.validate_xsrf_token(token1, token2)

        assert result is False

    def test_returns_false_for_invalid_token_format(self) -> None:
        """Test that False is returned for invalid token format."""
        valid_token = starlette_app_utils.generate_xsrf_token_string()

        result = starlette_app_utils.validate_xsrf_token("invalid-token", valid_token)

        assert result is False
