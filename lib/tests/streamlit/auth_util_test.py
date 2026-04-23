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
import sys
import unittest
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, patch

import pytest

from streamlit import auth_util
from streamlit.auth_util import (
    AuthCache,
    _calculate_signing_overhead,
    _set_split_cookie,
    clear_cookie_and_chunks,
    generate_default_provider_section,
    get_cookie_with_chunks,
    get_expose_tokens_config,
    get_redirect_uri,
    get_signing_secret,
    is_authlib_installed,
    set_cookie_with_chunks,
    validate_auth_credentials,
)
from streamlit.errors import StreamlitAuthError
from streamlit.runtime.secrets import AttrDict

if TYPE_CHECKING:
    from collections.abc import Callable

# Simulates realistic cookie signing overhead (~100 bytes for signature, timestamp, etc.)
MOCK_SIGNING_OVERHEAD = 100


def create_realistic_signed_value(name: str, value: str) -> bytes:
    """Mock that simulates realistic cookie signing behavior.

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

    def test_get_redirect_uri_verbatim(self):
        """Test get_redirect_uri returns the existing redirect_uri when present."""
        auth_section = AttrDict({"redirect_uri": "https://example.com/callback"})
        result = get_redirect_uri(auth_section)
        assert result == "https://example.com/callback"

    @patch(
        "streamlit.auth_util.config",
        MagicMock(
            get_option=MagicMock(return_value=8502),
        ),
    )
    def test_get_redirect_uri_with_port_placeholder(self):
        """Test get_redirect_uri substitutes {port} in redirect_uri when present."""
        auth_section = AttrDict(
            {"redirect_uri": "http://localhost:{port}/oauth2callback"}
        )
        result = get_redirect_uri(auth_section)
        assert result == "http://localhost:8502/oauth2callback"

    def test_get_redirect_uri_not_present(self):
        """Test get_redirect_uri returns None when redirect_uri is not in auth_section."""
        auth_section = AttrDict({"client_id": "some_client_id"})
        result = get_redirect_uri(auth_section)
        assert result is None


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


class GenerateDefaultProviderSectionTest(unittest.TestCase):
    """Test generate_default_provider_section function."""

    def test_generates_section_with_all_fields(self):
        """Test generating a default provider section with all fields present."""
        auth_section = AttrDict(
            {
                "client_id": "test_client_id",
                "client_secret": "test_client_secret",
                "server_metadata_url": "https://example.com/.well-known/openid-configuration",
                "client_kwargs": AttrDict({"scope": "openid email profile"}),
                "expose_tokens": ["id", "access"],
            }
        )

        result = generate_default_provider_section(auth_section)

        assert result["client_id"] == "test_client_id"
        assert result["client_secret"] == "test_client_secret"
        assert (
            result["server_metadata_url"]
            == "https://example.com/.well-known/openid-configuration"
        )
        assert result["client_kwargs"] == {"scope": "openid email profile"}
        assert result["expose_tokens"] == ["id", "access"]

    def test_generates_section_with_minimal_fields(self):
        """Test generating a default provider section with only client_id."""
        auth_section = AttrDict({"client_id": "test_client_id"})

        result = generate_default_provider_section(auth_section)

        assert result == {"client_id": "test_client_id"}

    def test_generates_empty_section_with_no_fields(self):
        """Test generating a default provider section with no fields."""
        auth_section = AttrDict({})

        result = generate_default_provider_section(auth_section)

        assert result == {}


@pytest.mark.parametrize(
    ("get_section", "expected"),
    [
        (lambda: None, None),
        (lambda: AttrDict({}), None),
        (
            lambda: AttrDict({"redirect_uri": "http://localhost:8501/callback"}),
            None,
        ),
        (
            lambda: AttrDict({"redirect_uri": "http://localhost:8501/oauth2callback"}),
            "http://localhost:8501/oauth2callback",
        ),
    ],
    ids=["no_section", "no_redirect_uri", "wrong_suffix", "valid_callback"],
)
def test_get_validated_redirect_uri(
    get_section: Callable[[], AttrDict | None],
    expected: str | None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Return None unless ``redirect_uri`` ends with ``/oauth2callback``."""
    monkeypatch.setattr(auth_util, "get_secrets_auth_section", get_section)
    assert auth_util.get_validated_redirect_uri() == expected


@patch(
    "streamlit.auth_util.config",
    MagicMock(get_option=MagicMock(return_value=9999)),
)
def test_get_validated_redirect_uri_substitutes_port_placeholder(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Substitute ``{port}`` in ``redirect_uri`` using the configured server port."""
    monkeypatch.setattr(
        auth_util,
        "get_secrets_auth_section",
        lambda: AttrDict({"redirect_uri": "http://localhost:{port}/oauth2callback"}),
    )
    assert (
        auth_util.get_validated_redirect_uri() == "http://localhost:9999/oauth2callback"
    )


@pytest.mark.parametrize(
    ("get_section", "expected"),
    [
        (lambda: None, None),
        (lambda: AttrDict({}), None),
        (
            lambda: AttrDict({"redirect_uri": "https://example.com/oauth2callback"}),
            "https://example.com",
        ),
        (
            lambda: AttrDict({"redirect_uri": "http://localhost:8501/oauth2callback"}),
            "http://localhost:8501",
        ),
    ],
    ids=["no_section", "no_redirect_uri", "https_host", "localhost_port"],
)
def test_get_origin_from_redirect_uri(
    get_section: Callable[[], AttrDict | None],
    expected: str | None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Parse scheme/host[/port] from ``redirect_uri``, or None if missing."""
    monkeypatch.setattr(auth_util, "get_secrets_auth_section", get_section)
    assert auth_util.get_origin_from_redirect_uri() == expected


@patch(
    "streamlit.auth_util.config",
    MagicMock(get_option=MagicMock(return_value=7777)),
)
def test_get_origin_from_redirect_uri_substitutes_port_placeholder(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Substitute ``{port}`` before parsing the origin."""
    monkeypatch.setattr(
        auth_util,
        "get_secrets_auth_section",
        lambda: AttrDict({"redirect_uri": "http://localhost:{port}/oauth2callback"}),
    )
    assert auth_util.get_origin_from_redirect_uri() == "http://localhost:7777"


@pytest.mark.parametrize(
    ("post_logout_redirect_uri", "id_token", "must_contain", "must_not_contain"),
    [
        (
            "https://myapp.com/oauth2callback",
            None,
            [
                "https://provider.com/logout",
                "client_id=test-client-id",
                "post_logout_redirect_uri",
                "myapp.com",
            ],
            ["id_token_hint"],
        ),
        (
            "https://myapp.com/oauth2callback",
            "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9",
            ["id_token_hint=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9"],
            [],
        ),
        (
            "http://localhost:8501/oauth2callback",
            None,
            ["http%3A%2F%2Flocalhost%3A8501%2Foauth2callback"],
            [],
        ),
    ],
    ids=["basic", "with_id_token", "url_encoding"],
)
def test_build_logout_url(
    post_logout_redirect_uri: str,
    id_token: str | None,
    must_contain: list[str],
    must_not_contain: list[str],
) -> None:
    """Build logout URLs with correct query encoding and optional ``id_token_hint``."""
    kwargs: dict[str, Any] = {
        "end_session_endpoint": "https://provider.com/logout",
        "client_id": "test-client-id",
        "post_logout_redirect_uri": post_logout_redirect_uri,
    }
    if id_token is not None:
        kwargs["id_token"] = id_token
    result = auth_util.build_logout_url(**kwargs)
    for fragment in must_contain:
        assert fragment in result
    for fragment in must_not_contain:
        assert fragment not in result


def test_build_logout_url_preserves_existing_query() -> None:
    """Append new parameters with ``&`` when the endpoint already has a query."""
    result = auth_util.build_logout_url(
        end_session_endpoint="https://provider.com/logout?existing=value",
        client_id="test-client-id",
        post_logout_redirect_uri="https://myapp.com/oauth2callback",
    )
    assert "existing=value" in result
    assert "client_id=test-client-id" in result
    assert "?existing=value" in result or "existing=value&" in result
    assert result.count("?") == 1


def test_auth_cache_get_dict() -> None:
    """Verify ``AuthCache.get_dict`` returns the internal cache dictionary."""
    cache = AuthCache()
    cache.set("k1", "v1")
    cache.set("k2", "v2")
    result = cache.get_dict()
    assert result == {"k1": "v1", "k2": "v2"}
    # Verify the returned dict reflects cache contents without relying on identity
    assert isinstance(result, dict)


def test_is_authlib_installed_old_version(monkeypatch: pytest.MonkeyPatch) -> None:
    """``is_authlib_installed`` returns False when Authlib is older than 1.3.2."""
    fake_authlib = MagicMock()
    fake_authlib.__version__ = "1.3.1"
    monkeypatch.setitem(sys.modules, "authlib", fake_authlib)
    assert is_authlib_installed() is False


def test_set_split_cookie_single_chunk_path() -> None:
    """Cover ``_set_split_cookie`` when the serialized value fits in one chunk.

    The initial signed payload can exceed ``MAX_COOKIE_BYTES`` while the
    empirically measured signing overhead (from the minimal probe value ``x``)
    still leaves enough room for the full serialized string in a single chunk.
    """
    set_calls: list[tuple[str, str]] = []

    def mock_set(name: str, val: str) -> None:
        set_calls.append((name, val))

    large_prefix = b"P" * 4500

    def mock_create_signed(_name: str, value: str) -> bytes:
        if value == "x":
            return b"sig:" + base64.b64encode(value.encode())
        return large_prefix + base64.b64encode(value.encode())

    serialized = json.dumps({"data": "y" * 400})
    _set_split_cookie(mock_set, mock_create_signed, "c", serialized)

    assert set_calls == [("c", serialized)]


@pytest.mark.parametrize(
    ("secrets_mock", "provider", "expected_substring"),
    [
        pytest.param(
            MagicMock(load_if_toml_exists=MagicMock(return_value=False)),
            "google",
            "authentication provider in `.streamlit/secrets.toml`",
            id="no_secrets_toml",
        ),
        pytest.param(
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(return_value=None),
            ),
            "google",
            "authentication provider in `.streamlit/secrets.toml`",
            id="no_auth_section",
        ),
        pytest.param(
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(
                    return_value=AttrDict(
                        {
                            "cookie_secret": "s",
                        }
                    )
                ),
            ),
            "google",
            '"redirect_uri"',
            id="missing_redirect_uri",
        ),
        pytest.param(
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(
                    return_value=AttrDict(
                        {
                            "redirect_uri": "http://localhost:8501/oauth2callback",
                        }
                    )
                ),
            ),
            "google",
            '"cookie_secret"',
            id="missing_cookie_secret",
        ),
        pytest.param(
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(
                    return_value=AttrDict(
                        {
                            "redirect_uri": "http://localhost:8501/oauth2callback",
                            "cookie_secret": "s",
                        }
                    )
                ),
            ),
            "my_provider",
            "underscore",
            id="provider_name_with_underscore",
        ),
        pytest.param(
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(
                    return_value=AttrDict(
                        {
                            "redirect_uri": "http://localhost:8501/oauth2callback",
                            "cookie_secret": "s",
                        }
                    )
                ),
            ),
            "okta",
            'the authentication provider "okta"',
            id="named_provider_missing_section",
        ),
    ],
)
def test_validate_auth_credentials_errors(
    secrets_mock: MagicMock,
    provider: str,
    expected_substring: str,
) -> None:
    """``validate_auth_credentials`` raises ``StreamlitAuthError`` for invalid secrets."""
    with patch("streamlit.auth_util.secrets_singleton", secrets_mock):
        with pytest.raises(StreamlitAuthError) as exc_info:
            validate_auth_credentials(provider)
    assert expected_substring in str(exc_info.value)


def test_validate_auth_credentials_default_provider_section_none() -> None:
    """Default provider raises when ``generate_default_provider_section`` yields None."""
    secrets_mock = MagicMock(
        load_if_toml_exists=MagicMock(return_value=True),
        get=MagicMock(
            return_value=AttrDict(
                {
                    "redirect_uri": "http://localhost:8501/oauth2callback",
                    "cookie_secret": "s",
                }
            )
        ),
    )
    with (
        patch("streamlit.auth_util.secrets_singleton", secrets_mock),
        patch(
            "streamlit.auth_util.generate_default_provider_section",
            return_value=None,
        ),
    ):
        with pytest.raises(StreamlitAuthError) as exc_info:
            validate_auth_credentials("default")
    assert "default authentication provider" in str(exc_info.value)


def test_validate_auth_credentials_default_missing_keys() -> None:
    """Default provider mapping is missing required OAuth keys."""
    secrets_mock = MagicMock(
        load_if_toml_exists=MagicMock(return_value=True),
        get=MagicMock(
            return_value=AttrDict(
                {
                    "redirect_uri": "http://localhost:8501/oauth2callback",
                    "cookie_secret": "s",
                    "default": {},
                }
            )
        ),
    )
    with patch("streamlit.auth_util.secrets_singleton", secrets_mock):
        with pytest.raises(StreamlitAuthError) as exc_info:
            validate_auth_credentials("default")
    msg = str(exc_info.value)
    assert "default authentication provider" in msg
    assert "client_id" in msg


def test_validate_auth_credentials_named_provider_missing_keys() -> None:
    """Named provider section exists but omits required keys."""
    secrets_mock = MagicMock(
        load_if_toml_exists=MagicMock(return_value=True),
        get=MagicMock(
            return_value=AttrDict(
                {
                    "redirect_uri": "http://localhost:8501/oauth2callback",
                    "cookie_secret": "s",
                    "google": {"client_id": "only_id"},
                }
            )
        ),
    )
    with patch("streamlit.auth_util.secrets_singleton", secrets_mock):
        with pytest.raises(StreamlitAuthError) as exc_info:
            validate_auth_credentials("google")
    msg = str(exc_info.value)
    assert 'authentication provider "google"' in msg
    assert "client_secret" in msg


def test_validate_auth_credentials_provider_section_not_mapping() -> None:
    """Provider entry must be a TOML table (mapping), not a scalar or list."""
    secrets_mock = MagicMock(
        load_if_toml_exists=MagicMock(return_value=True),
        get=MagicMock(
            return_value=AttrDict(
                {
                    "redirect_uri": "http://localhost:8501/oauth2callback",
                    "cookie_secret": "s",
                    "google": ["not", "a", "table"],
                }
            )
        ),
    )
    with patch("streamlit.auth_util.secrets_singleton", secrets_mock):
        with pytest.raises(StreamlitAuthError) as exc_info:
            validate_auth_credentials("google")
    assert "must be valid TOML" in str(exc_info.value)
