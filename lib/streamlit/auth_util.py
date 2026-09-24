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
import binascii
import json
import re
import warnings
import zlib
from collections.abc import Callable, Mapping
from datetime import datetime, timedelta, timezone
from functools import cache
from typing import TYPE_CHECKING, Any, Final, TypedDict, cast
from urllib.parse import urlencode, urlparse

from streamlit import config
from streamlit.errors import StreamlitAuthError, StreamlitMissingAuthlibError
from streamlit.logger import get_logger
from streamlit.runtime.secrets import AttrDict, secrets_singleton

_LOGGER: Final = get_logger(__name__)

if TYPE_CHECKING:

    class ProviderTokenPayload(TypedDict):
        provider: str
        exp: int


MAX_COOKIE_BYTES: Final = 4096
# Distinguishes zlib-compressed payloads from JSON, which starts with `{` or `[`.
_COMPRESSED_COOKIE_PREFIX: Final = "z:"
# Upper bound on sibling cookies; more than this would blow past typical
# proxy Cookie header limits anyway.
_MAX_COOKIE_CHUNKS: Final = 32
# uvicorn and many reverse proxies reject Cookie headers longer than 8KiB.
_MAX_COOKIE_HEADER_BYTES: Final = 8192
_PROVIDER_TOKEN_ALGORITHM: Final = "HS256"  # noqa: S105
# joserfc emits SecurityWarning when the symmetric key is shorter than 14 bytes
# (112 bits). We track the same threshold to surface a one-time Streamlit-level
# warning when callers configure a weak ``cookie_secret``.
_JOSERFC_MIN_KEY_BYTES: Final = 14


class AuthCache:
    """Simple cache implementation for storing info required for Authlib."""

    def __init__(self) -> None:
        self.cache: dict[str, Any] = {}

    def get(self, key: str) -> Any:
        return self.cache.get(key)

    # for set method, we are follow the same signature used in Authlib
    # the expires_in is not used in our case
    def set(self, key: str, value: Any, expires_in: int | None = None) -> None:  # noqa: ARG002
        self.cache[key] = value

    def get_dict(self) -> dict[str, Any]:
        return self.cache

    def delete(self, key: str) -> None:
        self.cache.pop(key, None)


def is_authlib_installed() -> bool:
    """Check if Authlib is installed."""
    try:
        import authlib

        authlib_version = authlib.__version__
        authlib_version_tuple = tuple(map(int, authlib_version.split(".")))

        if authlib_version_tuple < (1, 3, 2):
            return False
    except (ImportError, ModuleNotFoundError):  # pragma: no cover - optional dep
        return False
    return True


def get_signing_secret() -> str:
    """Get the cookie signing secret from the configuration or secrets.toml."""
    signing_secret: str = config.get_option("server.cookieSecret")
    if secrets_singleton.load_if_toml_exists():
        auth_section = secrets_singleton.get("auth")
        if auth_section:
            signing_secret = auth_section.get("cookie_secret", signing_secret)
    return signing_secret


def get_secrets_auth_section() -> AttrDict:
    """Get the 'auth' section of the secrets.toml."""
    auth_section = AttrDict({})
    if secrets_singleton.load_if_toml_exists():
        auth_section = cast("AttrDict", secrets_singleton.get("auth", AttrDict({})))

    return auth_section


def get_expose_tokens_config() -> list[str]:
    """Get the expose_tokens configuration from secrets.toml.

    Returns a list of token types to expose. Accepts both string and list formats:
    - expose_tokens = "id" -> ["id"]
    - expose_tokens = ["id", "access"] -> ["id", "access"]
    """
    auth_section = get_secrets_auth_section()
    expose_tokens = auth_section.get("expose_tokens")

    if isinstance(expose_tokens, str):
        res = [expose_tokens]
    elif isinstance(expose_tokens, list):
        res = [str(token) for token in expose_tokens]
    else:
        return []

    if set(res) - {"id", "access"}:
        raise StreamlitAuthError(
            "Invalid expose_tokens configuration. Only 'id' and 'access' are allowed."
        )

    return res


def get_tokens_to_store(token_payload: Mapping[str, Any]) -> dict[str, str]:
    """Select which OAuth tokens should be persisted in auth cookies.

    Always retains the ID token when available so logout can send an
    ``id_token_hint`` to providers that support RP-initiated logout. The
    access token is only persisted when ``expose_tokens`` explicitly opts in.
    """
    stored_tokens: dict[str, str] = {}

    id_token = token_payload.get("id_token")
    if isinstance(id_token, str):
        stored_tokens["id_token"] = id_token

    if "access" in get_expose_tokens_config():
        access_token = token_payload.get("access_token")
        if isinstance(access_token, str):
            stored_tokens["access_token"] = access_token

    return stored_tokens


def get_redirect_uri(auth_section: AttrDict) -> str | None:
    """Get the redirect_uri from auth_section - filling in port number if needed."""

    if "redirect_uri" not in auth_section:
        return None

    redirect_uri: str = auth_section["redirect_uri"]
    if "{port}" in redirect_uri:
        redirect_uri = redirect_uri.replace(
            "{port}", str(config.get_option("server.port"))
        )

    try:
        redirect_uri_parsed = urlparse(redirect_uri)
    except ValueError:  # pragma: no cover - defensive
        raise StreamlitAuthError(
            f"Invalid redirect_uri: {redirect_uri}. Please check your configuration."
        )

    return redirect_uri_parsed.geturl()


def get_validated_redirect_uri() -> str | None:
    """Get the redirect_uri from secrets, validating it ends with /oauth2callback.

    This is used for logout flows where we need a validated redirect URI
    that matches the OAuth callback path.

    Returns
    -------
    str | None
        The validated redirect URI, or None if not configured or invalid.
    """
    auth_section = get_secrets_auth_section()
    if not auth_section:
        return None

    redirect_uri = get_redirect_uri(auth_section)
    if not redirect_uri:
        return None

    if not redirect_uri.endswith("/oauth2callback"):
        _LOGGER.warning("Redirect URI does not end with /oauth2callback")
        return None

    return redirect_uri


def get_origin_from_redirect_uri() -> str | None:
    """Extract the origin (scheme + host) from the configured redirect_uri.

    Returns
    -------
    str | None
        The origin in format "scheme://host:port", or None if not configured.
    """
    auth_section = get_secrets_auth_section()
    if not auth_section:
        return None

    redirect_uri = get_redirect_uri(auth_section)
    if not redirect_uri:
        return None

    redirect_uri_parsed = urlparse(redirect_uri)
    return f"{redirect_uri_parsed.scheme}://{redirect_uri_parsed.netloc}"


def build_logout_url(
    end_session_endpoint: str,
    client_id: str,
    post_logout_redirect_uri: str,
    id_token: str | None = None,
) -> str:
    """Build an OIDC logout URL with the required parameters.

    Parameters
    ----------
    end_session_endpoint
        The OIDC provider's end_session_endpoint URL.
    client_id
        The OAuth client ID.
    post_logout_redirect_uri
        The URI to redirect to after logout.
    id_token
        Optional ID token to include as id_token_hint for the logout request.

    Returns
    -------
    str
        The complete logout URL with query parameters.
    """
    from urllib.parse import parse_qsl

    logout_params: dict[str, str] = {
        "client_id": client_id,
        "post_logout_redirect_uri": post_logout_redirect_uri,
    }

    if id_token:
        logout_params["id_token_hint"] = id_token

    # Per OIDC spec, end_session_endpoint should be a clean URL without query params,
    # but we handle existing params defensively for non-standard providers.
    parsed = urlparse(end_session_endpoint)
    existing_params = dict(parse_qsl(parsed.query))
    merged_params = {**existing_params, **logout_params}
    new_query = urlencode(merged_params)
    return parsed._replace(query=new_query).geturl()


def _get_provider_token_expiration_timestamp() -> int:
    """Return the expiration timestamp for short-lived provider tokens."""
    return int((datetime.now(timezone.utc) + timedelta(minutes=2)).timestamp())


def _ensure_joserfc_security_warning_suppressed() -> None:
    """Idempotently suppress joserfc's ``SecurityWarning`` for this process.

    ``warnings.catch_warnings()`` is documented as not thread-safe: it saves
    and restores the shared ``warnings.filters`` list, so concurrent calls
    from the encode/decode hot path can racily leak filter state into other
    sessions. We instead append a single category-only filter to the global
    list (an O(1) check protects against duplicates), which is safe under the
    GIL and survives ``warnings.simplefilter`` resets in a self-healing way.

    The category-only match (rather than a string-matched message filter) is
    intentional: ``OctKey.import_key`` is the only joserfc call site Streamlit
    uses, so suppressing the entire ``SecurityWarning`` category here cannot
    hide warnings from unrelated code, and it does not regress when joserfc
    rewords the message.
    """
    from joserfc.errors import SecurityWarning

    for entry in warnings.filters:
        action, _msg, category, _module, _lineno = entry
        if action == "ignore" and category is SecurityWarning:
            return
    warnings.filterwarnings("ignore", category=SecurityWarning)


@cache
def _warn_short_signing_secret_once() -> None:
    """Emit a single Streamlit-level warning for sub-112-bit cookie secrets.

    joserfc's ``SecurityWarning`` is suppressed by
    ``_ensure_joserfc_security_warning_suppressed`` so it does not surface to
    every app on every request, but a too-short ``cookie_secret`` is still a
    real signal we want operators to see at least once per process.
    """
    _LOGGER.warning(
        "auth.cookie_secret / server.cookieSecret is shorter than %d bytes "
        "(112 bits). Use a longer, randomly generated secret to ensure "
        "adequate cryptographic strength.",
        _JOSERFC_MIN_KEY_BYTES,
    )


def _get_joserfc_signing_key() -> Any:
    """Create the signing key used for provider tokens with ``joserfc``."""
    from joserfc.jwk import OctKey

    # TODO(auth): Revisit weak ``cookie_secret`` handling at the Streamlit level
    # so we can validate / reject (rather than just log) sub-112-bit secrets.
    _ensure_joserfc_security_warning_suppressed()
    secret = get_signing_secret()
    if len(secret) < _JOSERFC_MIN_KEY_BYTES:
        _warn_short_signing_secret_once()
    return OctKey.import_key(secret)


def _encode_provider_token_with_joserfc(provider: str) -> str:
    """Encode a provider token with ``joserfc``."""
    from joserfc import jwt

    header = {"alg": _PROVIDER_TOKEN_ALGORITHM}
    payload = {
        "provider": provider,
        "exp": _get_provider_token_expiration_timestamp(),
    }
    return jwt.encode(header, payload, _get_joserfc_signing_key())


def _encode_provider_token_with_authlib(provider: str) -> str:
    """Encode a provider token with the legacy Authlib JOSE API."""
    from authlib.jose import jwt

    header = {"alg": _PROVIDER_TOKEN_ALGORITHM}
    payload = {
        "provider": provider,
        "exp": _get_provider_token_expiration_timestamp(),
    }
    provider_token = cast(
        "str | bytes", jwt.encode(header, payload, get_signing_secret())
    )
    if isinstance(provider_token, bytes):
        return provider_token.decode("latin-1")
    return provider_token


def _validate_provider_token_claims(
    claims: Mapping[str, Any],
) -> ProviderTokenPayload:
    """Validate decoded provider-token claims."""
    provider = claims.get("provider")
    if provider is None:
        raise ValueError("provider claim is missing")
    if not isinstance(provider, str):
        raise TypeError("provider claim is invalid")
    if provider == "":
        raise ValueError("provider claim is empty")

    exp = claims.get("exp")
    if exp is None:
        raise ValueError("exp claim is missing")
    if isinstance(exp, bool) or not isinstance(exp, (int, float)):
        raise TypeError("exp claim is invalid")
    if exp <= datetime.now(timezone.utc).timestamp():
        raise ValueError("token has expired")

    return {"provider": provider, "exp": int(exp)}


def _decode_provider_token_with_joserfc(
    provider_token: str,
) -> ProviderTokenPayload:
    """Decode a provider token with ``joserfc``."""
    from joserfc import jwt
    from joserfc.errors import JoseError

    try:
        decoded_token = jwt.decode(
            provider_token,
            _get_joserfc_signing_key(),
            algorithms=[_PROVIDER_TOKEN_ALGORITHM],
        )
        return _validate_provider_token_claims(decoded_token.claims)
    except (JoseError, TypeError, ValueError) as e:
        raise StreamlitAuthError(f"Error decoding provider token: {e}") from None


def _decode_provider_token_with_authlib(
    provider_token: str,
) -> ProviderTokenPayload:
    """Decode a provider token with the legacy Authlib JOSE API."""
    from authlib.jose import JoseError, JWTClaims, jwt

    claim_options = {"exp": {"essential": True}, "provider": {"essential": True}}
    try:
        payload: JWTClaims = jwt.decode(
            provider_token, get_signing_secret(), claims_options=claim_options
        )
        payload.validate()
    except (JoseError, TypeError, ValueError) as e:
        raise StreamlitAuthError(f"Error decoding provider token: {e}") from None

    return cast("ProviderTokenPayload", payload)


def encode_provider_token(provider: str) -> str:
    """Returns a signed JWT token with the provider and expiration time."""
    try:
        return _encode_provider_token_with_joserfc(provider)
    except ImportError:
        try:
            return _encode_provider_token_with_authlib(provider)
        except ImportError:
            raise StreamlitMissingAuthlibError() from None


def decode_provider_token(provider_token: str) -> ProviderTokenPayload:
    """Decode the JWT token and validate the claims."""
    try:
        return _decode_provider_token_with_joserfc(provider_token)
    except ImportError:
        try:
            return _decode_provider_token_with_authlib(provider_token)
        except ImportError:
            raise StreamlitMissingAuthlibError() from None


def generate_default_provider_section(auth_section: AttrDict) -> dict[str, Any]:
    """Generate a default provider section for the 'auth' section of secrets.toml."""
    default_provider_section = {}
    if auth_section.get("client_id"):
        default_provider_section["client_id"] = auth_section.get("client_id")
    if auth_section.get("client_secret"):
        default_provider_section["client_secret"] = auth_section.get("client_secret")
    if auth_section.get("server_metadata_url"):
        default_provider_section["server_metadata_url"] = auth_section.get(
            "server_metadata_url"
        )
    if auth_section.get("client_kwargs"):
        default_provider_section["client_kwargs"] = cast(
            "AttrDict", auth_section.get("client_kwargs", AttrDict({}))
        ).to_dict()
    if auth_section.get("expose_tokens"):
        default_provider_section["expose_tokens"] = auth_section.get("expose_tokens")
    return default_provider_section


def _signed_cookie_size(
    create_signed_value_fn: Callable[[str, str], bytes],
    cookie_name: str,
    value: str,
    cookie_attr_size: int,
) -> int:
    """Return ``name=value`` plus attribute bytes for a signed cookie."""
    signed_value = create_signed_value_fn(cookie_name, value)
    return len(cookie_name) + 1 + len(signed_value) + cookie_attr_size


def _cookie_request_header_size(
    create_signed_value_fn: Callable[[str, str], bytes],
    cookies: list[tuple[str, str]],
) -> int:
    """Return the Cookie request-header size for these unsigned name/value pairs.

    The browser sends ``name=signed_value`` pairs separated by ``"; "``.
    Set-Cookie attributes are not included.
    """
    if not cookies:
        return 0
    sizes = [
        len(name) + 1 + len(create_signed_value_fn(name, value))
        for name, value in cookies
    ]
    return sum(sizes) + 2 * (len(sizes) - 1)


def _compress_cookie_payload(serialized: str) -> str:
    """Return a compact, ASCII-safe encoding of a large cookie payload.

    itsdangerous already zlib-compresses when signing, so a size check on the
    signed JSON can pass a 4KB limit while the uncompressed JSON is tens of
    kilobytes. Splitting that uncompressed JSON then re-signing each slice
    explodes the Cookie header. Compressing *before* splitting keeps the
    stored fragments small.
    """
    compressed = zlib.compress(serialized.encode("utf-8"))
    encoded = base64.urlsafe_b64encode(compressed).decode("ascii")
    return f"{_COMPRESSED_COOKIE_PREFIX}{encoded}"


def _decompress_cookie_payload(payload: bytes) -> bytes | None:
    """Return the original bytes, or ``None`` if a ``z:`` payload is corrupt.

    Payloads that do not start with ``z:`` are returned unchanged so legacy
    JSON cookies keep working.
    """
    prefix = _COMPRESSED_COOKIE_PREFIX.encode("ascii")
    if not payload.startswith(prefix):
        return payload

    encoded = payload[len(prefix) :]
    try:
        padded = encoded + b"=" * ((4 - len(encoded) % 4) % 4)
        return zlib.decompress(base64.urlsafe_b64decode(padded))
    except (ValueError, zlib.error, binascii.Error):
        _LOGGER.warning("Failed to decompress cookie payload")
        return None


def set_cookie_with_chunks(
    set_single_cookie_fn: Callable[[str, str], None],
    create_signed_value_fn: Callable[[str, str], bytes],
    cookie_name: str,
    value: dict[str, Any],
    *,
    cookie_attr_size: int,
) -> None:
    """Set a cookie, splitting into multiple cookies if necessary.

    Args:
        set_single_cookie_fn: Function to set a single cookie (cookie_name, value)
        create_signed_value_fn: Function to create a signed cookie value (cookie_name, value)
        cookie_name: Name of the cookie
        value: Dictionary value to serialize and store
        cookie_attr_size: Number of attribute bytes appended to each cookie.
    """
    serialized_cookie_value = json.dumps(value)
    actual_cookie_size = _signed_cookie_size(
        create_signed_value_fn,
        cookie_name,
        serialized_cookie_value,
        cookie_attr_size,
    )

    if actual_cookie_size <= MAX_COOKIE_BYTES:
        set_single_cookie_fn(cookie_name, serialized_cookie_value)
        return

    _LOGGER.debug(
        "Signed cookie size (%d bytes) exceeds the browser limit; compressing the payload.",
        actual_cookie_size,
    )
    payload = _compress_cookie_payload(serialized_cookie_value)
    compressed_size = _signed_cookie_size(
        create_signed_value_fn,
        cookie_name,
        payload,
        cookie_attr_size,
    )
    if compressed_size <= MAX_COOKIE_BYTES:
        set_single_cookie_fn(cookie_name, payload)
        return

    _set_split_cookie(
        set_single_cookie_fn,
        create_signed_value_fn,
        cookie_name,
        payload,
        cookie_attr_size=cookie_attr_size,
    )


def _set_split_cookie(
    set_single_cookie_fn: Callable[[str, str], None],
    create_signed_value_fn: Callable[[str, str], bytes],
    cookie_name: str,
    value: str,
    *,
    cookie_attr_size: int,
) -> None:
    """Split a large cookie value into multiple smaller cookies.

    Uses the fewest chunks whose independently signed cookies each stay within
    ``MAX_COOKIE_BYTES``. The main cookie contains either the whole value or the
    chunk count; additional chunks use names such as ``cookie_name_1``.
    """
    too_large_error = StreamlitAuthError(
        f"Cookie '{cookie_name}' is too large to split into browser-sized pieces."
    )
    for chunk_count in range(1, _MAX_COOKIE_CHUNKS + 1):
        chunk_len = max(1, (len(value) + chunk_count - 1) // chunk_count)
        chunks = [value[i : i + chunk_len] for i in range(0, len(value), chunk_len)]
        if not chunks:
            chunks = [""]
        chunk_names = [f"{cookie_name}_{i + 1}" for i in range(len(chunks))]
        if any(
            _signed_cookie_size(create_signed_value_fn, name, chunk, cookie_attr_size)
            > MAX_COOKIE_BYTES
            for name, chunk in zip(chunk_names, chunks, strict=True)
        ):
            continue

        if len(chunks) == 1:
            header_cookies = [(cookie_name, chunks[0])]
        else:
            header_cookies = [
                (cookie_name, f"chunks-{len(chunks)}"),
                *zip(chunk_names, chunks, strict=True),
            ]
        if (
            _cookie_request_header_size(create_signed_value_fn, header_cookies)
            > _MAX_COOKIE_HEADER_BYTES
        ):
            # More chunks add header overhead, so further splits cannot recover.
            raise too_large_error

        if len(chunks) == 1:
            set_single_cookie_fn(cookie_name, chunks[0])
            return

        set_single_cookie_fn(cookie_name, f"chunks-{len(chunks)}")
        for name, chunk in zip(chunk_names, chunks, strict=True):
            set_single_cookie_fn(name, chunk)

        _LOGGER.info(
            "Split cookie '%s' into %d chunks",
            cookie_name,
            len(chunks),
        )
        return

    raise too_large_error


_chunks_regex = re.compile(rb"chunks-(\d+)")


def get_cookie_with_chunks(
    get_single_cookie_fn: Callable[[str], bytes | None],
    cookie_name: str,
) -> bytes | None:
    """Reconstruct a cookie that may be compressed and/or split.

    - If the main cookie is ``chunks-N``, join ``{name}_1`` … ``{name}_N`` and
      decompress when the payload starts with ``z:``.
    - Otherwise return the main cookie, decompressing a ``z:`` payload if present.

    Args:
        get_single_cookie_fn: Function to get a single cookie (cookie_name) -> bytes | None
        cookie_name: Name of the cookie

    Returns
    -------
        Cookie value as bytes, or None if not found
    """
    cookie_value = get_single_cookie_fn(cookie_name)
    if cookie_value is None:
        return cookie_value

    match = _chunks_regex.match(cookie_value)
    if match is None:
        return _decompress_cookie_payload(cookie_value)

    # Parse chunk count
    try:
        chunk_count = int(match.group(1))
    except (ValueError, TypeError):  # pragma: no cover - defensive
        _LOGGER.exception("Invalid chunk count for cookie '%s'", cookie_name)
        return None

    # Reconstruct the original value from chunks
    chunks = []

    for i in range(chunk_count):
        chunk_name = f"{cookie_name}_{i + 1}"
        chunk_value = get_single_cookie_fn(chunk_name)
        if chunk_value is None:
            _LOGGER.error("Missing chunk %d for cookie '%s'", i + 1, cookie_name)
            return None
        chunks.append(chunk_value)

    reconstructed_value = b"".join(chunks)
    return _decompress_cookie_payload(reconstructed_value)


def validate_auth_credentials(provider: str) -> None:
    """Validate the general auth credentials and auth credentials for the given
    provider.
    """
    if not secrets_singleton.load_if_toml_exists():
        raise StreamlitAuthError(
            """To use authentication features you need to configure credentials for at
            least one authentication provider in `.streamlit/secrets.toml`."""
        )

    auth_section = secrets_singleton.get("auth")
    if auth_section is None:
        raise StreamlitAuthError(
            """To use authentication features you need to configure credentials for at
            least one authentication provider in `.streamlit/secrets.toml`."""
        )
    if "redirect_uri" not in auth_section:
        raise StreamlitAuthError(
            """Authentication credentials in `.streamlit/secrets.toml` are missing the
            "redirect_uri" key. Please check your configuration."""
        )
    if "cookie_secret" not in auth_section:
        raise StreamlitAuthError(
            """Authentication credentials in `.streamlit/secrets.toml` are missing the
            "cookie_secret" key. Please check your configuration."""
        )

    provider_section = auth_section.get(provider)

    # TODO(kajarenc): Revisit this check later when investigating the ability
    # TODO(kajarenc): to add "_" to the provider name.
    if "_" in provider:
        raise StreamlitAuthError(
            f'Auth provider name "{provider}" contains an underscore. '
            f"Please use a provider name without underscores."
        )

    if provider_section is None and provider == "default":
        provider_section = generate_default_provider_section(auth_section)

    if provider_section is None:
        if provider == "default":
            raise StreamlitAuthError(
                """Authentication credentials in `.streamlit/secrets.toml` are missing for
                the default authentication provider. Please check your configuration."""
            )
        raise StreamlitAuthError(
            f"Authentication credentials in `.streamlit/secrets.toml` are missing for "
            f'the authentication provider "{provider}". Please check your '
            f"configuration."
        )

    if not isinstance(provider_section, Mapping):
        raise StreamlitAuthError(
            f"Authentication credentials in `.streamlit/secrets.toml` for the "
            f'authentication provider "{provider}" must be valid TOML. Please check '
            f"your configuration."
        )

    required_keys = ["client_id", "client_secret", "server_metadata_url"]
    missing_keys = [key for key in required_keys if key not in provider_section]
    if missing_keys:
        if provider == "default":
            raise StreamlitAuthError(
                "Authentication credentials in `.streamlit/secrets.toml` for the "
                f"default authentication provider are missing the following keys: "
                f"{missing_keys}. Please check your configuration."
            )
        raise StreamlitAuthError(
            "Authentication credentials in `.streamlit/secrets.toml` for the "
            f'authentication provider "{provider}" are missing the following keys: '
            f"{missing_keys}. Please check your configuration."
        )
