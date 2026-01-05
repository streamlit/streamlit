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

from __future__ import annotations

import base64
import json
import unittest
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from streamlit.auth_util import (
    AuthCache,
    _calculate_signing_overhead,
    clear_cookie_and_chunks,
    get_cookie_with_chunks,
    get_expose_tokens_config,
    get_signing_secret,
    set_cookie_with_chunks,
)
from streamlit.errors import StreamlitAuthError

# Simulates realistic Tornado cookie signing overhead (~100 bytes for signature, timestamp, etc.)
MOCK_SIGNING_OVERHEAD = 100


def create_realistic_signed_value(name: str, value: str) -> bytes:
    """Mock that simulates realistic Tornado cookie signing behavior.

    Returns base64-encoded value plus a fixed overhead to simulate signing.
    """
    base64_value = base64.b64encode(value.encode()).decode()
    # Simulate: "2|1:0|10:timestamp|{name_len}:{name}|{val_len}:{base64_value}||{signature}" noqa: ERA001
    overhead = "x" * MOCK_SIGNING_OVERHEAD
    return f"{overhead}{base64_value}".encode()


CONFIG_MOCK: dict[str, Any] = {}

SECRETS_MOCK = {
    "redirect_uri": "http://localhost:8501/oauth2callback",
    "cookie_secret": "your_cookie_secret_here",
    "google": {
        "client_id": "CLIENT_ID",
        "client_secret": "CLIENT_SECRET",
        "server_metadata_url": "https://accounts.google.com/.well-known/openid-configuration",
    },
    "microsoft": {
        "client_id": "CLIENT_ID",
        "client_secret": "CLIENT_SECRET",
        "server_metadata_url": "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
    },
    "auth0": {
        "client_id": "CLIENT_ID",
        "client_secret": "CLIENT_SECRET",
        "server_metadata_url": "https://YOUR_DOMAIN/.well-known/openid-configuration",
    },
}


class AuthUtilTest(unittest.TestCase):
    """Test auth utils."""

    def test_auth_cache(self):
        """Test AuthCache basic functionality."""
        cache = AuthCache()
        cache.set("key1", "value1", 3600)
        assert cache.get("key1") == "value1"
        cache.delete("key1")
        assert cache.get("key1") is None

    @patch(
        "streamlit.auth_util.secrets_singleton",
        MagicMock(
            load_if_toml_exists=MagicMock(return_value=True),
            get=MagicMock(return_value=SECRETS_MOCK),
        ),
    )
    @patch(
        "streamlit.auth_util.config",
        MagicMock(
            get_option=MagicMock(return_value="CONFIG_COOKIE_SECRET"),
        ),
    )
    def test_get_signing_secret(self):
        """Get the cookie signing secret from the configuration or secrets.toml."""
        x = get_signing_secret()
        assert x == "your_cookie_secret_here"


class ExposeTokensConfigTest(unittest.TestCase):
    """Test expose_tokens configuration parsing."""

    def test_expose_tokens_string_config(self):
        """Test expose_tokens as a string."""
        with patch(
            "streamlit.auth_util.secrets_singleton",
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(
                    return_value={
                        "redirect_uri": "http://localhost:8501/oauth2callback",
                        "cookie_secret": "test_cookie_secret",
                        "expose_tokens": "id",
                    }
                ),
            ),
        ):
            result = get_expose_tokens_config()
            assert result == ["id"]

    def test_expose_tokens_list_config(self):
        """Test expose_tokens as a list."""
        with patch(
            "streamlit.auth_util.secrets_singleton",
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(
                    return_value={
                        "redirect_uri": "http://localhost:8501/oauth2callback",
                        "cookie_secret": "test_cookie_secret",
                        "expose_tokens": ["id", "access"],
                    }
                ),
            ),
        ):
            result = get_expose_tokens_config()
            assert result == ["id", "access"]

    def test_expose_tokens_no_config(self):
        """Test when expose_tokens is not configured."""
        with patch(
            "streamlit.auth_util.secrets_singleton",
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(
                    return_value={
                        "redirect_uri": "http://localhost:8501/oauth2callback",
                        "cookie_secret": "test_cookie_secret",
                    }
                ),
            ),
        ):
            result = get_expose_tokens_config()
            assert result == []

    def test_expose_tokens_invalid_type(self):
        """Test expose_tokens with invalid type."""
        with patch(
            "streamlit.auth_util.secrets_singleton",
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(
                    return_value={
                        "redirect_uri": "http://localhost:8501/oauth2callback",
                        "cookie_secret": "test_cookie_secret",
                        "expose_tokens": 123,  # Invalid type
                    }
                ),
            ),
        ):
            result = get_expose_tokens_config()
            assert result == []

    def test_expose_tokens_invalid_value_raises_error(self):
        """Test expose_tokens with invalid token value raises StreamlitAuthError."""
        with patch(
            "streamlit.auth_util.secrets_singleton",
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(
                    return_value={
                        "redirect_uri": "http://localhost:8501/oauth2callback",
                        "cookie_secret": "test_cookie_secret",
                        "expose_tokens": ["id", "invalid"],  # Invalid token value
                    }
                ),
            ),
        ):
            with pytest.raises(StreamlitAuthError) as exc_info:
                get_expose_tokens_config()
            assert (
                "Invalid expose_tokens configuration. Only 'id' and 'access' are allowed."
                in str(exc_info.value)
            )


class CookieChunkingTest(unittest.TestCase):
    """Test cookie chunking functionality."""

    def test_calculate_signing_overhead(self):
        """Test that signing overhead is calculated correctly from the signing function."""
        # The overhead should be the signed size minus base64 size of the test value
        # base64("x") = "eA==" which is 4 bytes
        overhead = _calculate_signing_overhead(
            create_realistic_signed_value, "test_cookie"
        )
        assert overhead == MOCK_SIGNING_OVERHEAD

    def test_set_cookie_with_chunks_small_cookie(self):
        """Test that small cookies are set without chunking."""
        cookies: dict[str, str] = {}

        def mock_set_cookie(name: str, value: str) -> None:
            cookies[name] = value

        small_data = {"key": "value"}
        set_cookie_with_chunks(
            mock_set_cookie,
            create_realistic_signed_value,
            "test_cookie",
            small_data,
        )

        # Should only have the main cookie, no chunks
        assert "test_cookie" in cookies
        assert "test_cookie_count" not in cookies
        assert "test_cookie_0" not in cookies
        assert json.loads(cookies["test_cookie"]) == small_data

    def test_set_cookie_with_chunks_large_cookie(self):
        """Test that large cookies are split into chunks."""
        cookies: dict[str, str] = {}

        def mock_set_cookie(name: str, value: str) -> None:
            cookies[name] = value

        # Create data large enough to exceed the 4096 byte cookie limit after signing
        # With ~100 byte overhead and base64 expansion (4/3), we need ~3000+ raw bytes
        large_data = {"key": "x" * 5000}
        set_cookie_with_chunks(
            mock_set_cookie,
            create_realistic_signed_value,
            "test_cookie",
            large_data,
        )

        # Main cookie should exist (contains chunk count marker)
        assert "test_cookie" in cookies
        chunk_count = int(cookies["test_cookie"].split("-")[1])
        assert chunk_count > 1  # Should have multiple chunks

        # Verify all chunks exist (1, 2, ..., chunk_count)
        for i in range(1, chunk_count + 1):
            assert f"test_cookie_{i}" in cookies

    def test_get_cookie_with_chunks_single_cookie(self):
        """Test retrieving a single (non-chunked) cookie."""
        cookies: dict[str, bytes] = {
            "test_cookie": b'{"key": "value"}',
        }

        def mock_get_cookie(name: str) -> bytes | None:
            return cookies.get(name)

        result = get_cookie_with_chunks(mock_get_cookie, "test_cookie")
        assert result == b'{"key": "value"}'

    def test_get_cookie_with_chunks_chunked_cookie(self):
        """Test retrieving a chunked cookie."""
        original_value = '{"key": "value123"}'
        chunk1 = '{"key": '  # Main cookie contains first chunk
        chunk2 = '"value123"}'

        cookies: dict[str, bytes] = {
            "test_cookie": b"chunks-2",
            "test_cookie_1": chunk1.encode(),  # Main cookie is first chunk
            "test_cookie_2": chunk2.encode(),
        }

        def mock_get_cookie(name: str) -> bytes | None:
            return cookies.get(name)

        result = get_cookie_with_chunks(mock_get_cookie, "test_cookie")
        assert result == original_value.encode()

    def test_get_cookie_with_chunks_missing_cookie(self):
        """Test retrieving a non-existent cookie."""

        def mock_get_cookie(name: str) -> bytes | None:
            return None

        result = get_cookie_with_chunks(mock_get_cookie, "test_cookie")
        assert result is None

    def test_get_cookie_with_chunks_missing_chunk(self):
        """Test retrieving a chunked cookie with a missing chunk."""
        cookies: dict[str, bytes] = {
            "test_cookie": b"chunks-3",
            "test_cookie_1": b"chunk0",  # Main cookie is first chunk
            # test_cookie_2 is missing
            "test_cookie_3": b"chunk2",
        }

        def mock_get_cookie(name: str) -> bytes | None:
            return cookies.get(name)

        result = get_cookie_with_chunks(mock_get_cookie, "test_cookie")
        assert result is None

    def test_get_cookie_with_chunks_invalid_count(self):
        """Test retrieving a chunked cookie with invalid count."""
        cookies: dict[str, bytes] = {
            "test_cookie": b"chunks-invalid",
        }

        def mock_get_cookie(name: str) -> bytes | None:
            return cookies.get(name)

        result = get_cookie_with_chunks(mock_get_cookie, "test_cookie")
        assert result == b"chunks-invalid"

    def test_clear_cookie_and_chunks_single_cookie(self):
        """Test clearing a single (non-chunked) cookie."""
        cookies: dict[str, bytes] = {
            "test_cookie": b'{"key": "value"}',
        }
        cleared: list[str] = []

        def mock_get_cookie(name: str) -> bytes | None:
            return cookies.get(name)

        def mock_clear_cookie(name: str) -> None:
            cleared.append(name)
            cookies.pop(name, None)

        clear_cookie_and_chunks(mock_get_cookie, mock_clear_cookie, "test_cookie")

        assert "test_cookie" in cleared
        assert len(cleared) == 1

    def test_clear_cookie_and_chunks_chunked_cookie(self):
        """Test clearing a chunked cookie."""
        cookies: dict[str, bytes] = {
            "test_cookie": b"chunks-3",
            "test_cookie_1": b"chunk1",
            "test_cookie_2": b"chunk2",
            "test_cookie_3": b"chunk3",
        }
        cleared: list[str] = []

        def mock_get_cookie(name: str) -> bytes | None:
            return cookies.get(name)

        def mock_clear_cookie(name: str) -> None:
            cleared.append(name)
            cookies.pop(name, None)

        clear_cookie_and_chunks(mock_get_cookie, mock_clear_cookie, "test_cookie")

        # Should clear the main cookie, additional chunks (1, 2), and the count cookie
        assert "test_cookie" in cleared
        assert "test_cookie_1" in cleared
        assert "test_cookie_2" in cleared
        assert "test_cookie_3" in cleared
        assert len(cleared) == 4  # main, 1, 2, 3

    def test_clear_cookie_and_chunks_invalid_count(self):
        """Test clearing a chunked cookie with invalid count."""
        cookies: dict[str, bytes] = {
            "test_cookie": b"chunks-invalid",
        }
        cleared: list[str] = []

        def mock_get_cookie(name: str) -> bytes | None:
            return cookies.get(name)

        def mock_clear_cookie(name: str) -> None:
            cleared.append(name)
            cookies.pop(name, None)

        clear_cookie_and_chunks(mock_get_cookie, mock_clear_cookie, "test_cookie")

        # Should clear the main cookie and the count cookie
        assert "test_cookie" in cleared
        assert len(cleared) == 1

    def test_round_trip_small_cookie(self):
        """Test setting and getting a small cookie."""
        cookies: dict[str, bytes] = {}

        def mock_set_cookie(name: str, value: str) -> None:
            cookies[name] = value.encode()

        def mock_get_cookie(name: str) -> bytes | None:
            return cookies.get(name)

        data = {"user": "john", "email": "john@example.com"}

        # Set the cookie
        set_cookie_with_chunks(
            mock_set_cookie,
            create_realistic_signed_value,
            "auth_cookie",
            data,
        )

        # Get the cookie
        result = get_cookie_with_chunks(mock_get_cookie, "auth_cookie")
        assert result is not None
        assert json.loads(result) == data

    def test_round_trip_large_cookie(self):
        """Test setting and getting a large cookie that requires chunking."""
        cookies: dict[str, bytes] = {}

        def mock_set_cookie(name: str, value: str) -> None:
            cookies[name] = value.encode()

        def mock_get_cookie(name: str) -> bytes | None:
            return cookies.get(name)

        # Create large data that will require chunking
        data = {"token": "x" * 5000}

        # Set the cookie (should chunk it)
        set_cookie_with_chunks(
            mock_set_cookie,
            create_realistic_signed_value,
            "auth_cookie",
            data,
        )

        # Verify chunks were created
        assert "auth_cookie" in cookies

        # Get the cookie (should reconstruct it)
        result = get_cookie_with_chunks(mock_get_cookie, "auth_cookie")
        assert result is not None
        assert json.loads(result) == data
