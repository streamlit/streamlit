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

import json
import re
from collections.abc import Callable, Mapping
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any, Final, TypedDict, cast
from urllib.parse import urlparse

from streamlit import config
from streamlit.errors import StreamlitAuthError
from streamlit.logger import get_logger
from streamlit.runtime.secrets import AttrDict, secrets_singleton

_LOGGER: Final = get_logger(__name__)

if TYPE_CHECKING:

    class ProviderTokenPayload(TypedDict):
        provider: str
        exp: int


MAX_COOKIE_BYTES: Final = 4096
# Cookie attributes added by Tornado: "; Path=/; HttpOnly"
COOKIE_ATTRIBUTES: Final = "; Path=/; HttpOnly"
COOKIE_ATTR_SIZE: Final = len(COOKIE_ATTRIBUTES)
# Safety buffer for signing overhead to account for edge cases, rounding, and potential
# variations in signing implementations (e.g., longer timestamps after year 2286)
SIGNING_OVERHEAD_SAFETY_BUFFER: Final = 50
# Base64 encoding of 1 byte = 4 bytes, so overhead = total - 4
SINGLE_BYTE_BASE64_SIZE: Final = 4


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
    except (ImportError, ModuleNotFoundError):
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
    except ValueError:
        raise StreamlitAuthError(
            f"Invalid redirect_uri: {redirect_uri}. Please check your configuration."
        )

    return redirect_uri_parsed.geturl()


def encode_provider_token(provider: str) -> str:
    """Returns a signed JWT token with the provider and expiration time."""
    try:
        from authlib.jose import jwt
    except ImportError:
        raise StreamlitAuthError(
            """To use authentication features, you need to install Authlib>=1.3.2, e.g. via `pip install Authlib`."""
        ) from None

    header = {"alg": "HS256"}
    payload = {
        "provider": provider,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=2),
    }
    provider_token: bytes = jwt.encode(header, payload, get_signing_secret())
    # JWT token is a byte string, so we need to decode it to a URL compatible string
    return provider_token.decode("latin-1")


def decode_provider_token(provider_token: str) -> ProviderTokenPayload:
    """Decode the JWT token and validate the claims."""
    try:
        from authlib.jose import JoseError, JWTClaims, jwt
    except ImportError:
        raise StreamlitAuthError(
            """To use authentication features, you need to install Authlib>=1.3.2, e.g. via `pip install Authlib`."""
        ) from None

    # Our JWT token is short-lived (2 minutes), so we check here that it contains
    # the 'exp' (and it is not expired), and 'provider' field exists.
    claim_options = {"exp": {"essential": True}, "provider": {"essential": True}}
    try:
        payload: JWTClaims = jwt.decode(
            provider_token, get_signing_secret(), claims_options=claim_options
        )
        payload.validate()
    except JoseError as e:
        raise StreamlitAuthError(f"Error decoding provider token: {e}") from None

    return cast("ProviderTokenPayload", payload)


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


def set_cookie_with_chunks(
    set_single_cookie_fn: Callable[[str, str], None],
    create_signed_value_fn: Callable[[str, str], bytes],
    cookie_name: str,
    value: dict[str, Any],
) -> None:
    """Set a cookie, splitting into multiple cookies if necessary.

    Args:
        set_single_cookie_fn: Function to set a single cookie (cookie_name, value)
        create_signed_value_fn: Function to create a signed cookie value (cookie_name, value)
        cookie_name: Name of the cookie
        value: Dictionary value to serialize and store
    """
    serialized_cookie_value = json.dumps(value)

    # Calculate actual cookie size using the provided signing function
    signed_value = create_signed_value_fn(cookie_name, serialized_cookie_value)

    # Cookie format: "name=value" + COOKIE_ATTRIBUTES
    actual_cookie_size = len(cookie_name) + 1 + len(signed_value) + COOKIE_ATTR_SIZE

    # Check if cookie needs to be split
    if actual_cookie_size > MAX_COOKIE_BYTES:
        _LOGGER.debug(
            "Cookie size (%d bytes) exceeds browser limit. Splitting into multiple cookies.",
            actual_cookie_size,
        )
        _set_split_cookie(
            set_single_cookie_fn,
            create_signed_value_fn,
            cookie_name,
            serialized_cookie_value,
        )
    else:
        set_single_cookie_fn(cookie_name, serialized_cookie_value)


def _calculate_signing_overhead(
    create_signed_value_fn: Callable[[str, str], bytes],
    cookie_name: str,
) -> int:
    """Calculate the server's signing overhead by measuring the size difference.

    This empirically measures the overhead added by the signing function (e.g., Tornado's
    create_signed_value) by signing a minimal test value and computing the difference.

    Args:
        create_signed_value_fn: Function to create a signed cookie value
        cookie_name: Name of the cookie (affects overhead due to length prefix)

    Returns
    -------
        The number of bytes added by signing (excluding the base64-encoded value)
    """
    test_value = "x"  # Minimal test value (1 byte)
    signed = create_signed_value_fn(cookie_name, test_value)
    return len(signed) - SINGLE_BYTE_BASE64_SIZE


def _set_split_cookie(
    set_single_cookie_fn: Callable[[str, str], None],
    create_signed_value_fn: Callable[[str, str], bytes],
    cookie_name: str,
    value: str,
) -> None:
    """Split a large cookie value into multiple smaller cookies.

    The main cookie always exists and either contains the whole value or the chunk count.
    Additional chunks are stored as cookie_name_1, cookie_name_2, etc.

    Args:
        set_single_cookie_fn: Function to set a single cookie (cookie_name, value)
        create_signed_value_fn: Function to create a signed cookie value
        cookie_name: Name of the cookie
        value: Serialized string value to split and store
    """
    # Calculate overhead empirically from the actual signing function, plus safety buffer
    signing_overhead = (
        _calculate_signing_overhead(create_signed_value_fn, cookie_name)
        + SIGNING_OVERHEAD_SAFETY_BUFFER
    )

    # Available space for the signed value:
    # MAX_COOKIE_BYTES - cookie_name - "=" (1 byte) - cookie attributes
    available_for_signed_value = (
        MAX_COOKIE_BYTES - len(cookie_name) - 1 - COOKIE_ATTR_SIZE
    )

    # Space available for the base64-encoded value (after subtracting signing overhead)
    available_for_base64_value = available_for_signed_value - signing_overhead

    # If there is not enough space for the base64-encoded value, raise an error.
    # We need at least 4 bytes for a minimal base64-encoded value.
    if available_for_base64_value < SINGLE_BYTE_BASE64_SIZE:
        raise StreamlitAuthError("Not enough space available for the signed value.")

    # Convert from base64 space to raw value space (base64 has 4/3 expansion ratio)
    chunk_size = (available_for_base64_value * 3) // 4
    chunks = []
    for i in range(0, len(value), chunk_size):
        chunk = value[i : i + chunk_size]
        chunks.append(chunk)

    if len(chunks) == 1:
        set_single_cookie_fn(cookie_name, chunks[0])
        return

    # Store count in the main cookie
    set_single_cookie_fn(cookie_name, f"chunks-{len(chunks)}")

    # Store remaining chunks as cookie_name_1, cookie_name_2, etc.
    for i in range(len(chunks)):
        chunk_name = f"{cookie_name}_{i + 1}"
        set_single_cookie_fn(chunk_name, chunks[i])

    _LOGGER.info(
        "Split cookie '%s' into %d chunks",
        cookie_name,
        len(chunks),
    )


_chunks_regex = re.compile(rb"chunks-(\d+)")


def get_cookie_with_chunks(
    get_single_cookie_fn: Callable[[str], bytes | None],
    cookie_name: str,
) -> bytes | None:
    """Get a cookie, reconstructing from chunks if it was split.

    If a count cookie exists, the main cookie contains the first chunk,
    and additional chunks are in cookie_name_1, cookie_name_2, etc.
    If no count cookie exists, the main cookie contains the entire value.

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
        return cookie_value

    # Parse chunk count
    try:
        chunk_count = int(match.group(1))
    except (ValueError, TypeError):
        _LOGGER.exception("Invalid chunk count for cookie '%s'", cookie_name)
        return None

    # Reconstruct the original value from chunks
    chunks = []

    for i in range(chunk_count):
        chunk_name = f"{cookie_name}_{i + 1}"
        chunk_value = get_single_cookie_fn(chunk_name)
        if chunk_value is None:
            _LOGGER.exception("Missing chunk %d for cookie '%s'", i + 1, cookie_name)
            return None
        chunks.append(chunk_value)

    reconstructed_value = b"".join(chunks)
    return reconstructed_value


def clear_cookie_and_chunks(
    get_single_cookie_fn: Callable[[str], bytes | None],
    clear_single_cookie_fn: Callable[[str], None],
    cookie_name: str,
) -> None:
    """Clear a cookie and any associated chunk cookies.

    The main cookie always exists. If there are chunks, also clear
    cookie_name_1, cookie_name_2, etc., and the count cookie.

    Args:
        get_single_cookie_fn: Function to get a single cookie (cookie_name) -> bytes | None
        clear_single_cookie_fn: Function to clear a single cookie (cookie_name)
        cookie_name: Name of the cookie
    """
    cookie_value = get_single_cookie_fn(cookie_name)
    clear_single_cookie_fn(cookie_name)
    if cookie_value is None:
        return

    match = _chunks_regex.match(cookie_value)
    if match is None:
        return

    try:
        chunk_count = int(match.group(1))
        # Clear additional chunk cookies (starting from 1, since main cookie is chunk 0)
        for i in range(1, chunk_count + 1):
            clear_single_cookie_fn(f"{cookie_name}_{i}")
    except (ValueError, TypeError):
        # If count is invalid, but we already cleared the main cookie
        # so we can ignore it
        pass


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
