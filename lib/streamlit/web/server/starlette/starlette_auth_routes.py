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

# ruff: noqa: RUF029  # Async route handlers are idiomatic even without await

"""Starlette app authentication routes."""

from __future__ import annotations

import json
import time
from typing import TYPE_CHECKING, Any, Final, cast

from streamlit.auth_util import (
    build_logout_url,
    clear_cookie_and_chunks,
    decode_provider_token,
    generate_default_provider_section,
    get_cookie_with_chunks,
    get_origin_from_redirect_uri,
    get_redirect_uri,
    get_secrets_auth_section,
    get_validated_redirect_uri,
    set_cookie_with_chunks,
)
from streamlit.errors import StreamlitAuthError
from streamlit.logger import get_logger
from streamlit.url_util import make_url_path
from streamlit.web.server.server_util import get_cookie_secret
from streamlit.web.server.starlette.starlette_app_utils import (
    create_signed_value,
    decode_signed_value,
)
from streamlit.web.server.starlette.starlette_server_config import (
    TOKENS_COOKIE_NAME,
    USER_COOKIE_NAME,
)

if TYPE_CHECKING:
    from starlette.requests import Request
    from starlette.responses import RedirectResponse, Response
    from starlette.routing import Route

_LOGGER: Final = get_logger(__name__)

# Auth route path constants (without base URL prefix)
_ROUTE_AUTH_LOGIN: Final = "auth/login"
_ROUTE_AUTH_LOGOUT: Final = "auth/logout"
_ROUTE_OAUTH_CALLBACK: Final = "oauth2callback"


class _AsyncAuthCache:
    """Async cache for Authlib's Starlette integration.

    Authlib's Starlette OAuth client expects an async cache interface.
    This implementation tracks per-item expiration times to automatically
    expire OAuth state entries, preventing unbounded memory growth from
    abandoned auth flows.

    Cache size is expected to be very small: one entry is created per login
    attempt (not per user/session) and exists only during the OAuth flow—from
    clicking "Login" until the OAuth callback completes (typically seconds).
    Each entry is a few hundred bytes. Entries expire after 1 hour (Authlib's
    default) or are consumed upon successful callback.
    """

    # Fallback TTL if authlib doesn't provide an expiration time.
    # This is the same TTL used internally in Authlib (1 hour).
    _DEFAULT_TTL_SECONDS: Final = 3600

    def __init__(self) -> None:
        # Cache structure: {key: (value, expiration_timestamp)}
        # where key is Authlib's state key (e.g., "_state_google_abc123"),
        # value is the OAuth state data, and expiration_timestamp is a Unix timestamp.
        self._cache: dict[str, tuple[Any, float]] = {}

    def _evict_expired(self) -> None:
        """Evict expired items from the cache."""
        now = time.time()
        expired_keys = [k for k, (_, exp) in self._cache.items() if exp <= now]
        for key in expired_keys:
            del self._cache[key]

    async def get(self, key: str) -> Any:
        """Get an item from the cache."""
        self._evict_expired()
        entry = self._cache.get(key)
        return entry[0] if entry else None

    async def set(self, key: str, value: Any, expires_in: int | None = None) -> None:
        """Set an item in the cache."""
        self._evict_expired()
        ttl = expires_in if expires_in is not None else self._DEFAULT_TTL_SECONDS
        self._cache[key] = (value, time.time() + ttl)

    async def delete(self, key: str) -> None:
        """Delete an item from the cache."""
        self._cache.pop(key, None)

    def get_dict(self) -> dict[str, Any]:
        """Get a dictionary of all items in the cache."""
        self._evict_expired()
        return {k: v for k, (v, _) in self._cache.items()}


# TODO(lukasmasuch): Reevaluate whether we can remove _AsyncAuthCache and rely on Authlib's
# built-in session storage via SessionMiddleware instead. This would simplify
# the code but would expose OAuth state data in signed cookies rather than
# keeping it server-side. See: https://docs.authlib.org/en/latest/client/starlette.html
#
# Note: For true multi-tenant support (multiple Streamlit apps in one process),
# this cache would need to be made per-runtime rather than module-level.
_STARLETTE_AUTH_CACHE: Final = _AsyncAuthCache()


def _normalize_nested_config(value: Any) -> Any:
    """Normalize nested configuration data for Authlib."""
    if isinstance(value, dict):
        return {k: _normalize_nested_config(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_normalize_nested_config(item) for item in value]
    return value


def _looks_like_provider_section(value: dict[str, Any]) -> bool:
    """Check if a dictionary looks like a provider section for Authlib."""
    provider_keys = {
        "client_id",
        "client_secret",
        "server_metadata_url",
        "authorize_url",
        "api_base_url",
        "request_token_url",
    }
    return any(key in value for key in provider_keys)


class _AuthlibConfig(dict[str, Any]):  # noqa: FURB189
    """Config adapter that exposes provider data via Authlib's flat lookup.

    Authlib expects a flat configuration dictionary (e.g. "GOOGLE_CLIENT_ID").
    Streamlit's secrets.toml structure is nested (e.g. [auth.google] client_id=...).
    This class bridges the gap by normalizing nested keys into the format Authlib expects.
    """

    def __init__(self, data: dict[str, Any]) -> None:
        normalized = {k: _normalize_nested_config(v) for k, v in data.items()}
        super().__init__(normalized)
        self._provider_sections: dict[str, dict[str, Any]] = {
            key.lower(): value
            for key, value in normalized.items()
            if isinstance(value, dict) and _looks_like_provider_section(value)
        }

    def get(self, key: Any, default: Any = None) -> Any:
        if key in self:
            return super().get(key, default)

        if not isinstance(key, str):
            return default

        provider_key, sep, param = key.partition("_")
        if not sep:
            return default

        provider_section = self._provider_sections.get(provider_key.lower())
        if provider_section is None:
            return default

        return provider_section.get(param.lower(), default)


async def _redirect_to_base(base_url: str) -> RedirectResponse:
    """Redirect to the base URL."""

    from starlette.responses import RedirectResponse

    return RedirectResponse(make_url_path(base_url, "/"), status_code=302)


def _get_cookie_path() -> str:
    """Get the cookie path based on server.baseUrlPath configuration."""
    from streamlit import config

    base_path: str | None = config.get_option("server.baseUrlPath")
    if base_path:
        # Ensure path starts with "/" and doesn't have trailing slash
        return "/" + base_path.strip("/")
    return "/"


async def _set_auth_cookie(
    response: Response, user_info: dict[str, Any], tokens: dict[str, Any]
) -> None:
    """Set the auth cookies with signed user info and tokens.

    Note: This cookie uses itsdangerous signing which is NOT compatible with
    Tornado's secure cookie format. Switching between backends will invalidate
    existing auth cookies, requiring users to re-authenticate. This is expected
    behavior when switching between Tornado and Starlette backends.

    Cookies may be split into multiple chunks if they exceed browser limits.
    """

    def set_single_cookie(cookie_name: str, value: str) -> None:
        _set_single_cookie(response, cookie_name, value)

    set_cookie_with_chunks(
        set_single_cookie,
        _create_signed_value_wrapper,
        USER_COOKIE_NAME,
        user_info,
    )
    set_cookie_with_chunks(
        set_single_cookie,
        _create_signed_value_wrapper,
        TOKENS_COOKIE_NAME,
        tokens,
    )


def _set_single_cookie(
    response: Response, cookie_name: str, serialized_value: str
) -> None:
    """Set a single signed cookie on the response.

    Cookie flags are set explicitly for clarity and parity with Tornado:
    - httponly=True: Prevents JavaScript access (security)
    - samesite="lax": Allows cookie on same-site requests and top-level navigations
    - secure is NOT set: Tornado deliberately avoids this due to Safari cookie bugs;
      the OIDC flow only works in secure contexts anyway (localhost or HTTPS)
    - path: Matches server.baseUrlPath for proper scoping
    """
    cookie_secret = get_cookie_secret()
    signed_value = create_signed_value(cookie_secret, cookie_name, serialized_value)
    cookie_payload = signed_value.decode("utf-8")
    response.set_cookie(
        cookie_name,
        cookie_payload,
        httponly=True,
        samesite="lax",
        path=_get_cookie_path(),
    )


def _create_signed_value_wrapper(cookie_name: str, value: str) -> bytes:
    """Create a signed cookie value using the cookie secret."""
    cookie_secret = get_cookie_secret()
    return create_signed_value(cookie_secret, cookie_name, value)


def _get_signed_cookie_from_request(request: Request, cookie_name: str) -> bytes | None:
    """Get and decode a signed cookie from the request.

    This helper is used during logout to determine if cookies need chunk cleanup.
    """
    cookie_value = request.cookies.get(cookie_name)
    if cookie_value is None:
        return None

    cookie_secret = get_cookie_secret()
    signed_value = cookie_value.encode("latin-1")
    decoded = decode_signed_value(cookie_secret, cookie_name, signed_value)
    return decoded


def _clear_auth_cookie(response: Response, request: Request) -> None:
    """Clear the auth cookies, including any split cookie chunks.

    The path must match the path used when setting the cookie, otherwise
    the browser won't delete it.
    """
    cookie_path = _get_cookie_path()

    def get_single_cookie(cookie_name: str) -> bytes | None:
        return _get_signed_cookie_from_request(request, cookie_name)

    def clear_single_cookie(cookie_name: str) -> None:
        response.delete_cookie(cookie_name, path=cookie_path)

    clear_cookie_and_chunks(
        get_single_cookie,
        clear_single_cookie,
        USER_COOKIE_NAME,
    )
    clear_cookie_and_chunks(
        get_single_cookie,
        clear_single_cookie,
        TOKENS_COOKIE_NAME,
    )


def _create_oauth_client(provider: str) -> tuple[Any, str]:
    """Create an OAuth client for the given provider based on secrets.toml configuration."""

    try:
        from authlib.integrations import starlette_client
    except ModuleNotFoundError:  # pragma: no cover - optional dependency
        raise StreamlitAuthError(
            "Authentication requires Authlib>=1.3.2. "
            "Install it via `pip install streamlit[auth]`."
        )

    auth_section = get_secrets_auth_section()
    if auth_section:
        redirect_uri = get_redirect_uri(auth_section) or "/"
        config = auth_section.to_dict()
    else:
        config = {}
        redirect_uri = "/"

    provider_section = config.setdefault(provider, {})

    # Guard against auth_section being None when secrets.toml exists but lacks [auth].
    # Normal flows validate config first, but this protects against edge cases.
    if not provider_section and provider == "default" and auth_section:
        provider_section = generate_default_provider_section(auth_section)
        config["default"] = provider_section

    provider_client_kwargs = provider_section.setdefault("client_kwargs", {})
    if "scope" not in provider_client_kwargs:
        provider_client_kwargs["scope"] = "openid email profile"
    if "prompt" not in provider_client_kwargs:
        provider_client_kwargs["prompt"] = "select_account"

    oauth = starlette_client.OAuth(
        config=_AuthlibConfig(config), cache=_STARLETTE_AUTH_CACHE
    )
    oauth.register(provider)
    return oauth.create_client(provider), redirect_uri  # type: ignore[no-untyped-call]


def _parse_provider_token(provider_token: str | None) -> str | None:
    """Extract the provider from the provider token."""

    if provider_token is None:
        return None
    try:
        payload = decode_provider_token(provider_token)
    except StreamlitAuthError:
        return None

    return payload["provider"]


def _get_provider_by_state(state_code_from_url: str | None) -> str | None:
    """Extract the provider from the state code from the URL."""

    if state_code_from_url is None:
        return None
    current_cache_keys = list(_STARLETTE_AUTH_CACHE.get_dict().keys())
    state_provider_mapping = {}
    for key in current_cache_keys:
        # Authlib's Starlette integration stores OAuth state in the cache using keys
        # in the format: "_state_{provider}_{state_code}".
        # Example: "_state_google_abc123" breaks down as:
        #   - "_state" = fixed prefix used by Authlib
        #   - "google" = provider name
        #   - "abc123" = state code (random token)
        #
        # This format is an implementation detail of Authlib and not a guaranteed API,
        # so we handle parsing failures gracefully by skipping malformed keys.
        # We have some unit tests that will fail in case the formats gets changed in
        # an authlib update.
        #
        # Note: This split assumes no underscores in provider names or state codes.
        # This is safe because: (1) provider names with underscores are explicitly
        # blocked in validate_auth_credentials() in auth_util.py, and (2) Authlib's
        # generate_token() uses only alphanumeric characters (a-zA-Z0-9) for state
        # codes. See auth_util.py for the underscore validation.
        try:
            _, _, recorded_provider, code = key.split("_")
        except ValueError:
            # Skip cache keys that don't match the expected 4-part format.
            continue
        state_provider_mapping[code] = recorded_provider

    provider: str | None = state_provider_mapping.get(state_code_from_url)
    return provider


def _get_origin_from_secrets() -> str | None:
    """Extract the origin from the redirect URI in the secrets."""
    return get_origin_from_redirect_uri()


def _get_cookie_value_from_request(request: Request, cookie_name: str) -> bytes | None:
    """Get a signed cookie value from the request, handling chunked cookies."""

    def get_single_cookie(name: str) -> bytes | None:
        return _get_signed_cookie_from_request(request, name)

    return get_cookie_with_chunks(get_single_cookie, cookie_name)


def _get_provider_logout_url(request: Request) -> str | None:
    """Get the OAuth provider's logout URL from OIDC metadata.

    Returns the end_session_endpoint URL with proper parameters for OIDC logout,
    or None if the provider doesn't support it or required data is unavailable.

    This function returns None (rather than raising exceptions) to allow graceful
    fallback to a simple base URL redirect when OIDC logout isn't possible.
    """
    cookie_value = _get_cookie_value_from_request(request, USER_COOKIE_NAME)

    if not cookie_value:
        return None

    try:
        user_info = json.loads(cookie_value)
        provider = user_info.get("provider")
        if not provider:
            return None

        client, _ = _create_oauth_client(provider)

        # Load OIDC metadata - Authlib's Starlette client uses async methods
        # but load_server_metadata is synchronous in both implementations
        metadata = client.load_server_metadata()
        end_session_endpoint = metadata.get("end_session_endpoint")

        if not end_session_endpoint:
            _LOGGER.info("No end_session_endpoint found for provider %s", provider)
            return None

        # Use redirect_uri (i.e. /oauth2callback) for post_logout_redirect_uri
        # This is safer than redirecting to root as some providers seem to
        # require URL to be in a whitelist - /oauth2callback should be whitelisted
        redirect_uri = get_validated_redirect_uri()
        if redirect_uri is None:
            _LOGGER.info("Redirect url could not be determined")
            return None

        # Get id_token_hint from tokens cookie if available
        id_token: str | None = None
        tokens_cookie_value = _get_cookie_value_from_request(
            request, TOKENS_COOKIE_NAME
        )
        if tokens_cookie_value:
            try:
                tokens = json.loads(tokens_cookie_value)
                id_token = tokens.get("id_token")
            except (json.JSONDecodeError, TypeError):
                _LOGGER.exception("Error, invalid tokens cookie value.")
                return None

        return build_logout_url(
            end_session_endpoint=end_session_endpoint,
            client_id=client.client_id,
            post_logout_redirect_uri=redirect_uri,
            id_token=id_token,
        )

    except Exception as e:
        _LOGGER.warning("Failed to get provider logout URL: %s", e)
        return None


async def _auth_login(request: Request, base_url: str) -> Response:
    """Handle the login request from the authentication provider."""

    provider = _parse_provider_token(request.query_params.get("provider"))
    if provider is None:
        return await _redirect_to_base(base_url)

    client, redirect_uri = _create_oauth_client(provider)
    try:
        response = await client.authorize_redirect(request, redirect_uri)
        return cast("Response", response)
    except Exception:  # pragma: no cover - error path
        from starlette.responses import Response

        # Return a generic message to avoid exposing internal error details to clients.
        _LOGGER.warning("Error during OAuth authorization redirect.", exc_info=True)
        return Response("Authentication error", status_code=400)


async def _auth_logout(request: Request, base_url: str) -> Response:
    """Logout the user by clearing the auth cookie and redirecting.

    If the OAuth provider supports end_session_endpoint, redirects there for
    proper OIDC logout. Otherwise, redirects to the base URL.
    """
    from starlette.responses import RedirectResponse

    provider_logout_url = _get_provider_logout_url(request)

    if provider_logout_url:
        response = RedirectResponse(provider_logout_url, status_code=302)
    else:
        response = await _redirect_to_base(base_url)

    _clear_auth_cookie(response, request)
    return response


async def _auth_callback(request: Request, base_url: str) -> Response:
    """Handle the OAuth callback from the authentication provider."""

    state = request.query_params.get("state")
    provider = _get_provider_by_state(state)
    origin = _get_origin_from_secrets()
    if origin is None:
        _LOGGER.error(
            "Error, misconfigured origin for `redirect_uri` in secrets.",
        )
        return await _redirect_to_base(base_url)

    error = request.query_params.get("error")
    if error:
        error_description = request.query_params.get("error_description")
        sanitized_error = error.replace("\n", "").replace("\r", "")
        sanitized_error_description = (
            error_description.replace("\n", "").replace("\r", "")
            if error_description
            else None
        )
        _LOGGER.error(
            "Error during authentication: %s. Error description: %s",
            sanitized_error,
            sanitized_error_description,
        )
        return await _redirect_to_base(base_url)

    if provider is None:
        # See https://github.com/streamlit/streamlit/issues/13101
        _LOGGER.warning(
            "Missing provider for OAuth callback; this often indicates a stale "
            "or replayed callback (for example, from browser back/forward "
            "navigation).",
        )
        return await _redirect_to_base(base_url)

    client, _ = _create_oauth_client(provider)
    token = await client.authorize_access_token(request)
    user = token.get("userinfo") or {}

    response = await _redirect_to_base(base_url)

    cookie_value = dict(user, origin=origin, is_logged_in=True, provider=provider)
    tokens = {k: token[k] for k in ["id_token", "access_token"] if k in token}
    if user:
        await _set_auth_cookie(response, cookie_value, tokens)
    else:  # pragma: no cover - error path
        _LOGGER.error(
            "OAuth provider '%s' did not return user information during callback.",
            provider,
        )
    return response


def create_auth_routes(base_url: str) -> list[Route]:
    """Create all authentication related routes for the Starlette app."""

    from starlette.routing import Route

    async def login(request: Request) -> Response:
        return await _auth_login(request, base_url)

    async def logout(request: Request) -> Response:
        return await _auth_logout(request, base_url)

    async def callback(request: Request) -> Response:
        return await _auth_callback(request, base_url)

    return [
        Route(make_url_path(base_url, _ROUTE_AUTH_LOGIN), login, methods=["GET"]),
        Route(make_url_path(base_url, _ROUTE_AUTH_LOGOUT), logout, methods=["GET"]),
        Route(
            make_url_path(base_url, _ROUTE_OAUTH_CALLBACK), callback, methods=["GET"]
        ),
    ]
