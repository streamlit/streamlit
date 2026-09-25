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
import importlib.util
import json
import secrets
import sys
import unittest
import warnings
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, patch

import pytest

from streamlit import auth_util
from streamlit.auth_util import (
    _MAX_COOKIE_HEADER_BYTES,
    AuthCache,
    _set_split_cookie,
    generate_default_provider_section,
    get_cookie_with_chunks,
    get_expose_tokens_config,
    get_redirect_uri,
    get_signing_secret,
    get_tokens_to_store,
    is_authlib_installed,
    set_cookie_with_chunks,
    validate_auth_credentials,
)
from streamlit.errors import StreamlitAuthError
from streamlit.runtime.secrets import AttrDict
from streamlit.web.server.starlette.starlette_app_utils import create_signed_value

if TYPE_CHECKING:
    from collections.abc import Callable

# ``joserfc`` is a transitive dependency of ``Authlib>=1.7`` but is not yet
# declared directly by the ``streamlit[auth]`` extra. The affected tests
# below assert behavior that only holds on the ``joserfc`` decode/encode path
# (warning suppression and Streamlit's own claim-validation error messages),
# so we skip them when only the Authlib fallback is available.
_JOSERFC_AVAILABLE = importlib.util.find_spec("joserfc") is not None
_REQUIRES_JOSERFC = pytest.mark.skipif(
    not _JOSERFC_AVAILABLE,
    reason="requires joserfc; Authlib fallback path uses different error/warning text",
)

# Simulates realistic cookie signing overhead (~100 bytes for signature, timestamp, etc.)
MOCK_SIGNING_OVERHEAD = 100
TEST_COOKIE_ATTR_SIZE = len("; Path=/; HttpOnly")


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


def _create_test_provider_token(claims: dict[str, Any]) -> str:
    """Create a provider token with the joserfc backend used by guarded tests."""
    header = {"alg": "HS256"}
    from joserfc import jwt

    return jwt.encode(header, claims, auth_util._get_joserfc_signing_key())


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


@pytest.mark.parametrize(
    ("expose_tokens_config", "token_payload", "expected"),
    [
        (
            None,
            {"id_token": "test-id-token", "access_token": "test-access-token"},
            {"id_token": "test-id-token"},
        ),
        (
            ["access"],
            {"id_token": "test-id-token", "access_token": "test-access-token"},
            {"id_token": "test-id-token", "access_token": "test-access-token"},
        ),
        (
            None,
            {},
            {},
        ),
        (
            ["access"],
            {"access_token": "test-access-token"},
            {"access_token": "test-access-token"},
        ),
        (
            ["access"],
            {"id_token": None, "access_token": 12345},
            {},
        ),
    ],
    ids=[
        "default_keeps_only_id_token",
        "access_exposed_keeps_both",
        "empty_payload_returns_empty",
        "only_access_token_in_payload",
        "non_string_tokens_ignored",
    ],
)
def test_get_tokens_to_store(
    expose_tokens_config: list[str] | None,
    token_payload: dict[str, Any],
    expected: dict[str, str],
) -> None:
    """Verify tokens are stored based on expose_tokens configuration and payload."""
    secrets_config: dict[str, Any] = {
        "redirect_uri": "http://localhost:8501/oauth2callback",
        "cookie_secret": "test_cookie_secret",
    }
    if expose_tokens_config is not None:
        secrets_config["expose_tokens"] = expose_tokens_config

    with patch(
        "streamlit.auth_util.secrets_singleton",
        MagicMock(
            load_if_toml_exists=MagicMock(return_value=True),
            get=MagicMock(return_value=secrets_config),
        ),
    ):
        result = get_tokens_to_store(token_payload)

    assert result == expected


class CookieChunkingTest(unittest.TestCase):
    """Test cookie chunking functionality."""

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
            cookie_attr_size=TEST_COOKIE_ATTR_SIZE,
        )

        # Should only have the main cookie, no chunks
        assert "test_cookie" in cookies
        assert "test_cookie_count" not in cookies
        assert "test_cookie_0" not in cookies
        assert json.loads(cookies["test_cookie"]) == small_data

    def test_set_cookie_with_chunks_large_cookie(self):
        """Large compressible cookies are compacted rather than split into many chunks."""
        cookies: dict[str, str] = {}

        def mock_set_cookie(name: str, value: str) -> None:
            cookies[name] = value

        def mock_get_cookie(name: str) -> bytes | None:
            raw = cookies.get(name)
            return None if raw is None else raw.encode()

        large_data = {"key": "x" * 5000}
        set_cookie_with_chunks(
            mock_set_cookie,
            create_realistic_signed_value,
            "test_cookie",
            large_data,
            cookie_attr_size=TEST_COOKIE_ATTR_SIZE,
        )

        assert "test_cookie" in cookies
        # Repeating payload compresses below the per-cookie limit, so it is stored
        # as a single compressed cookie instead of many JSON slices.
        assert not cookies["test_cookie"].startswith("chunks-")
        assert cookies["test_cookie"].startswith("z:")
        result = get_cookie_with_chunks(mock_get_cookie, "test_cookie")
        assert result is not None
        assert json.loads(result) == large_data

    def test_set_cookie_with_chunks_respects_cookie_attr_size(self):
        """Test that larger cookie attributes trigger chunking sooner."""
        cookie_name = "test_cookie"
        larger_cookie_attr_size = TEST_COOKIE_ATTR_SIZE + 32
        payload_size = 1

        while True:
            data = {"key": "x" * payload_size}
            serialized = json.dumps(data)
            signed_value = create_realistic_signed_value(cookie_name, serialized)
            default_size = (
                len(cookie_name) + 1 + len(signed_value) + TEST_COOKIE_ATTR_SIZE
            )
            larger_size = (
                len(cookie_name) + 1 + len(signed_value) + larger_cookie_attr_size
            )

            if default_size <= auth_util.MAX_COOKIE_BYTES < larger_size:
                break

            payload_size += 1
            if payload_size > 5000:  # pragma: no cover - defensive
                raise AssertionError("Could not find boundary payload size")

        default_cookies: dict[str, str] = {}

        def mock_set_default_cookie(name: str, value: str) -> None:
            default_cookies[name] = value

        set_cookie_with_chunks(
            mock_set_default_cookie,
            create_realistic_signed_value,
            cookie_name,
            data,
            cookie_attr_size=TEST_COOKIE_ATTR_SIZE,
        )

        assert not default_cookies[cookie_name].startswith("chunks-")
        assert not default_cookies[cookie_name].startswith("z:")

        larger_cookies: dict[str, str] = {}

        def mock_set_larger_cookie(name: str, value: str) -> None:
            larger_cookies[name] = value

        set_cookie_with_chunks(
            mock_set_larger_cookie,
            create_realistic_signed_value,
            cookie_name,
            data,
            cookie_attr_size=larger_cookie_attr_size,
        )

        larger_value = larger_cookies[cookie_name]
        assert larger_value.startswith(("chunks-", "z:"))

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
            cookie_attr_size=TEST_COOKIE_ATTR_SIZE,
        )

        # Get the cookie
        result = get_cookie_with_chunks(mock_get_cookie, "auth_cookie")
        assert result is not None
        assert json.loads(result) == data

    def test_round_trip_large_cookie(self):
        """Test setting and getting a large cookie that is compacted or chunked."""
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
            cookie_attr_size=TEST_COOKIE_ATTR_SIZE,
        )

        # Verify chunks were created
        assert "auth_cookie" in cookies

        # Get the cookie (should reconstruct it)
        result = get_cookie_with_chunks(mock_get_cookie, "auth_cookie")
        assert result is not None
        assert json.loads(result) == data


def _jwt_like_token(groups: list[str], salt: str) -> str:
    """Build a JWT-shaped token with a full-size RS256 signature segment."""
    header = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9"
    payload = {
        "iss": "https://authentik.example.com/application/o/streamlit/",
        "sub": "user-123",
        "aud": "streamlit",
        "email": "user@example.com",
        "groups": groups,
        "salt": salt,
    }
    payload_b64 = (
        base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    )
    signature = base64.urlsafe_b64encode(bytes(range(256))).decode().rstrip("=")
    return f"{header}.{payload_b64}.{signature}"


def test_compressible_oidc_tokens_stay_under_websocket_header_limit() -> None:
    """Duplicate large OIDC tokens must not explode the Cookie request header.

    itsdangerous compresses the whole JSON, so a just-over-4KiB signed cookie
    used to be split into many uncompressed slices whose combined Cookie header
    exceeded uvicorn's 8KiB WebSocket handshake limit (#16569).
    """
    secret = "test-cookie-secret"
    cookie_name = "_streamlit_user_tokens"
    cookie_attr_size = len("; Path=/; HttpOnly; SameSite=lax; Max-Age=2592000")
    groups = [f"authentik-group-{i:03d}-aaaaaaaaaaaaaaaa" for i in range(500)]
    tokens = {
        "id_token": _jwt_like_token(groups, "id"),
        "access_token": _jwt_like_token(groups, "access"),
    }

    cookies: dict[str, str] = {}

    def set_cookie(name: str, value: str) -> None:
        cookies[name] = value

    def sign(name: str, value: str) -> bytes:
        return create_signed_value(secret, name, value)

    set_cookie_with_chunks(
        set_cookie,
        sign,
        cookie_name,
        tokens,
        cookie_attr_size=cookie_attr_size,
    )
    set_cookie_with_chunks(
        set_cookie,
        sign,
        "_streamlit_user",
        {
            "email": "user@example.com",
            "name": "User",
            "origin": "http://localhost:8501",
            "is_logged_in": True,
            "provider": "default",
        },
        cookie_attr_size=cookie_attr_size,
    )

    request_parts = [
        f"{name}={sign(name, raw).decode()}" for name, raw in cookies.items()
    ]
    # XSRF and session cookies are also sent on the WebSocket handshake.
    extra_header = f"_xsrf={'x' * 32}; session={'s' * 64}"
    cookie_header = "; ".join([*request_parts, extra_header])

    assert len(cookie_header) < _MAX_COOKIE_HEADER_BYTES
    chunk_keys = [name for name in cookies if name.startswith(f"{cookie_name}_")]
    assert chunk_keys == []

    def get_unsigned(name: str) -> bytes | None:
        raw = cookies.get(name)
        return None if raw is None else raw.encode()

    result = get_cookie_with_chunks(get_unsigned, cookie_name)
    assert result is not None
    assert json.loads(result) == tokens


def test_incompressible_payload_is_compressed_and_chunked() -> None:
    """Random payloads that stay over 4KiB after compression are split and round-trip."""
    cookies: dict[str, str] = {}

    def mock_set_cookie(name: str, value: str) -> None:
        cookies[name] = value

    def mock_get_cookie(name: str) -> bytes | None:
        raw = cookies.get(name)
        return None if raw is None else raw.encode()

    data: dict[str, str] | None = None
    for nbytes in range(2000, 6000, 250):
        cookies.clear()
        candidate = {"token": secrets.token_urlsafe(nbytes)}
        try:
            set_cookie_with_chunks(
                mock_set_cookie,
                create_realistic_signed_value,
                "test_cookie",
                candidate,
                cookie_attr_size=TEST_COOKIE_ATTR_SIZE,
            )
        except StreamlitAuthError:
            continue
        if cookies.get("test_cookie", "").startswith("chunks-"):
            data = candidate
            break

    assert data is not None, "Could not find a payload that compresses then splits"
    chunk_keys = [name for name in cookies if name.startswith("test_cookie_")]
    assert chunk_keys
    result = get_cookie_with_chunks(mock_get_cookie, "test_cookie")
    assert result is not None
    assert json.loads(result) == data


def test_legacy_uncompressed_chunked_cookies_still_round_trip() -> None:
    """Cookies split as raw JSON slices before compressed payloads still decode."""
    original_value = '{"id_token": "abc", "access_token": "def"}'
    cookies: dict[str, bytes] = {
        "test_cookie": b"chunks-2",
        "test_cookie_1": original_value[:20].encode(),
        "test_cookie_2": original_value[20:].encode(),
    }

    def mock_get_cookie(name: str) -> bytes | None:
        return cookies.get(name)

    result = get_cookie_with_chunks(mock_get_cookie, "test_cookie")
    assert result == original_value.encode()


def test_invalid_compressed_cookie_returns_none() -> None:
    """A corrupted compressed cookie payload is treated as missing."""

    def mock_get_cookie(_name: str) -> bytes | None:
        return b"z:not-valid-base64!!!"

    assert get_cookie_with_chunks(mock_get_cookie, "c") is None


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
        (lambda: AttrDict({"client_id": "abc"}), None),
        (
            lambda: AttrDict({"redirect_uri": "http://localhost:8501/callback"}),
            None,
        ),
        (
            lambda: AttrDict({"redirect_uri": "http://localhost:8501/oauth2callback"}),
            "http://localhost:8501/oauth2callback",
        ),
    ],
    ids=[
        "no_section",
        "no_redirect_uri",
        "section_without_redirect_uri",
        "wrong_suffix",
        "valid_callback",
    ],
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
        (lambda: AttrDict({"client_id": "abc"}), None),
        (
            lambda: AttrDict({"redirect_uri": "https://example.com/oauth2callback"}),
            "https://example.com",
        ),
        (
            lambda: AttrDict({"redirect_uri": "http://localhost:8501/oauth2callback"}),
            "http://localhost:8501",
        ),
    ],
    ids=[
        "no_section",
        "no_redirect_uri",
        "section_without_redirect_uri",
        "https_host",
        "localhost_port",
    ],
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


@_REQUIRES_JOSERFC
def test_provider_token_round_trip_suppresses_auth_warnings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Round-trip provider tokens without surfacing Authlib or key-size warnings."""
    monkeypatch.setattr(auth_util, "get_signing_secret", lambda: "short-secret")

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        token = auth_util.encode_provider_token("google")
        payload = auth_util.decode_provider_token(token)

    assert payload["provider"] == "google"
    assert isinstance(payload["exp"], int)
    assert caught == []


@_REQUIRES_JOSERFC
def test_get_joserfc_signing_key_logs_weak_secret_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Emit a single Streamlit-level log for sub-112-bit ``cookie_secret``s."""
    monkeypatch.setattr(auth_util, "get_signing_secret", lambda: "short-secret")
    auth_util._warn_short_signing_secret_once.cache_clear()

    with patch.object(auth_util._LOGGER, "warning") as mock_warning:
        auth_util._get_joserfc_signing_key()
        auth_util._get_joserfc_signing_key()

    assert mock_warning.call_count == 1
    assert "112 bits" in mock_warning.call_args.args[0]

    # A long-enough secret on a fresh flag must not log.
    auth_util._warn_short_signing_secret_once.cache_clear()
    monkeypatch.setattr(
        auth_util, "get_signing_secret", lambda: "this-secret-is-long-enough"
    )
    with patch.object(auth_util._LOGGER, "warning") as mock_warning:
        auth_util._get_joserfc_signing_key()
    assert mock_warning.call_count == 0


@_REQUIRES_JOSERFC
def test_ensure_joserfc_security_warning_suppressed_is_idempotent() -> None:
    """``_ensure_joserfc_security_warning_suppressed`` does not duplicate filters."""
    from joserfc.errors import SecurityWarning

    with warnings.catch_warnings():
        warnings.resetwarnings()
        auth_util._ensure_joserfc_security_warning_suppressed()
        auth_util._ensure_joserfc_security_warning_suppressed()
        matching = [
            f for f in warnings.filters if f[0] == "ignore" and f[2] is SecurityWarning
        ]
        assert len(matching) == 1


def test_decode_provider_token_expired_raises_streamlit_auth_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reject provider tokens whose ``exp`` claim is already in the past."""
    monkeypatch.setattr(auth_util, "get_signing_secret", lambda: "short-secret")
    monkeypatch.setattr(
        auth_util, "_get_provider_token_expiration_timestamp", lambda: 1
    )

    token = auth_util.encode_provider_token("google")

    with pytest.raises(StreamlitAuthError, match="expired"):
        auth_util.decode_provider_token(token)


@_REQUIRES_JOSERFC
@pytest.mark.parametrize(
    ("claims", "expected_message"),
    [
        pytest.param(
            {"exp": 9999999999},
            "provider claim is missing",
            id="missing_provider",
        ),
        pytest.param(
            {"provider": "", "exp": 9999999999},
            "provider claim is empty",
            id="empty_provider",
        ),
        pytest.param(
            {"provider": "google"},
            "exp claim",
            id="missing_exp",
        ),
        pytest.param(
            {"provider": "google", "exp": "bad"},
            "exp claim",
            id="invalid_exp_type",
        ),
    ],
)
def test_decode_provider_token_invalid_claims_raise_streamlit_auth_error(
    claims: dict[str, Any],
    expected_message: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reject provider tokens when required claims are missing or malformed."""
    monkeypatch.setattr(auth_util, "get_signing_secret", lambda: "short-secret")
    token = _create_test_provider_token(claims)

    with pytest.raises(StreamlitAuthError, match=expected_message):
        auth_util.decode_provider_token(token)


def test_authlib_provider_token_round_trip(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Exercise the real Authlib provider-token helpers end to end."""
    pytest.importorskip("authlib")
    from authlib.deprecate import AuthlibDeprecationWarning

    monkeypatch.setattr(auth_util, "get_signing_secret", lambda: "short-secret")

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", AuthlibDeprecationWarning)
        token = auth_util._encode_provider_token_with_authlib("google")
        payload = auth_util._decode_provider_token_with_authlib(token)

    assert payload["provider"] == "google"
    assert isinstance(payload["exp"], int)


def test_encode_provider_token_falls_back_to_authlib(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Use the Authlib encoder when ``joserfc`` is unavailable."""
    recorded_providers: list[str] = []

    def mock_encode_with_authlib(provider: str) -> str:
        recorded_providers.append(provider)
        return "fallback-token"

    monkeypatch.setattr(
        auth_util,
        "_encode_provider_token_with_joserfc",
        MagicMock(side_effect=ImportError),
    )
    monkeypatch.setattr(
        auth_util,
        "_encode_provider_token_with_authlib",
        mock_encode_with_authlib,
    )

    assert auth_util.encode_provider_token("google") == "fallback-token"
    assert recorded_providers == ["google"]


def test_decode_provider_token_falls_back_to_authlib(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Use the Authlib decoder when ``joserfc`` is unavailable."""
    monkeypatch.setattr(
        auth_util,
        "_decode_provider_token_with_joserfc",
        MagicMock(side_effect=ImportError),
    )
    monkeypatch.setattr(
        auth_util,
        "_decode_provider_token_with_authlib",
        MagicMock(return_value={"provider": "google", "exp": 1}),
    )

    assert auth_util.decode_provider_token("token") == {
        "provider": "google",
        "exp": 1,
    }


def test_provider_token_round_trips_through_real_authlib_when_joserfc_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Public encode/decode round-trip works end-to-end on the Authlib fallback path.

    The mocked dispatch tests above prove the public helpers pick the Authlib branch
    when joserfc raises ``ImportError``, and ``test_authlib_provider_token_round_trip``
    proves the Authlib helpers work in isolation. This test bridges the two by driving
    the public API with a real Authlib backend, covering the path a user on
    ``Authlib<1.7`` (no transitive joserfc) actually exercises in production.
    """
    pytest.importorskip("authlib")
    from authlib.deprecate import AuthlibDeprecationWarning

    monkeypatch.setattr(auth_util, "get_signing_secret", lambda: "short-secret")
    monkeypatch.setattr(
        auth_util,
        "_encode_provider_token_with_joserfc",
        MagicMock(side_effect=ImportError("joserfc unavailable")),
    )
    monkeypatch.setattr(
        auth_util,
        "_decode_provider_token_with_joserfc",
        MagicMock(side_effect=ImportError("joserfc unavailable")),
    )

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", AuthlibDeprecationWarning)
        token = auth_util.encode_provider_token("google")
        payload = auth_util.decode_provider_token(token)

    assert payload["provider"] == "google"
    assert isinstance(payload["exp"], int)


@pytest.mark.parametrize(
    ("operation", "args"),
    [
        pytest.param("encode_provider_token", ("google",), id="encode"),
        pytest.param("decode_provider_token", ("ignored-token",), id="decode"),
    ],
)
def test_provider_token_raises_install_hint_when_no_jose_backend_available(
    operation: str,
    args: tuple[Any, ...],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Surface the ``streamlit[auth]`` install hint when neither JOSE backend is available.

    Anti-regression for the user-facing error path on installs that have neither
    ``joserfc`` nor ``Authlib`` (e.g. plain ``pip install streamlit`` without the
    ``auth`` extra). Both private helpers are forced to raise ``ImportError`` to
    simulate the missing optional dependencies.
    """
    for helper in (
        "_encode_provider_token_with_joserfc",
        "_encode_provider_token_with_authlib",
        "_decode_provider_token_with_joserfc",
        "_decode_provider_token_with_authlib",
    ):
        monkeypatch.setattr(
            auth_util, helper, MagicMock(side_effect=ImportError("missing"))
        )

    with pytest.raises(StreamlitAuthError, match=r"pip install streamlit\[auth\]"):
        getattr(auth_util, operation)(*args)


def test_set_split_cookie_stores_single_cookie_when_chunk_fits() -> None:
    """A payload that signs under the size limit is stored as one cookie."""
    set_calls: list[tuple[str, str]] = []

    def mock_set(name: str, val: str) -> None:
        set_calls.append((name, val))

    def mock_create_signed(_name: str, value: str) -> bytes:
        return value.encode()

    _set_split_cookie(
        mock_set,
        mock_create_signed,
        "c",
        "hello",
        cookie_attr_size=0,
    )

    assert set_calls == [("c", "hello")]


def test_set_split_cookie_raises_when_chunks_cannot_fit() -> None:
    """Raise when every signed chunk would still exceed the browser cookie limit."""

    def mock_set(_name: str, _val: str) -> None:
        return None

    def mock_create_signed(_name: str, _value: str) -> bytes:
        return b"x" * 5000

    with pytest.raises(StreamlitAuthError, match="too large to split"):
        _set_split_cookie(
            mock_set,
            mock_create_signed,
            "c",
            "hello",
            cookie_attr_size=0,
        )


def test_set_split_cookie_raises_when_total_header_exceeds_limit() -> None:
    """Raise when each chunk fits in a cookie but the Cookie header would overflow."""
    set_calls: list[tuple[str, str]] = []

    def mock_set(name: str, val: str) -> None:
        set_calls.append((name, val))

    def mock_create_signed(_name: str, value: str) -> bytes:
        return b"x" * (len(value) + 100)

    with pytest.raises(StreamlitAuthError, match="too large to split"):
        _set_split_cookie(
            mock_set,
            mock_create_signed,
            "c",
            "y" * 10_000,
            cookie_attr_size=0,
        )

    assert set_calls == []


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


def test_validate_provider_token_claims_rejects_non_string_provider() -> None:
    """A non-string ``provider`` claim is rejected with ``TypeError``."""
    with pytest.raises(TypeError, match="provider claim is invalid"):
        auth_util._validate_provider_token_claims({"provider": 123, "exp": 9999999999})


def test_validate_provider_token_claims_accepts_valid_claims() -> None:
    """Valid claims are returned as a normalized payload with an integer ``exp``."""
    result = auth_util._validate_provider_token_claims(
        {"provider": "google", "exp": 9999999999.0}
    )
    assert result == {"provider": "google", "exp": 9999999999}
