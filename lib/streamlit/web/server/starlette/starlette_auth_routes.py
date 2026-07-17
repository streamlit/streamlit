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
from functools import lru_cache
from typing import TYPE_CHECKING, Any, Final, cast

from streamlit.auth_util import (
    build_logout_url,
    decode_provider_token,
    generate_default_provider_section,
    get_cookie_with_chunks,
    get_origin_from_redirect_uri,
    get_redirect_uri,
    get_secrets_auth_section,
    get_validated_redirect_uri,
    set_cookie_with_chunks,
)
from streamlit.errors import StreamlitAuthError, StreamlitMissingAuthlibError
from streamlit.logger import get_logger
from streamlit.url_util import make_url_path
from streamlit.web.server.server_util import get_cookie_secret
from streamlit.web.server.starlette.starlette_app_utils import (
    create_signed_value,
    decode_signed_value,
)
from streamlit.web.server.starlette.starlette_server_config import (
    AUTH_COOKIE_MAX_AGE_SECONDS,
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
_AUTH_COOKIE_SAMESITE: Final = "lax"
_AUTH_COOKIE_NAMES: Final = (USER_COOKIE_NAME, TOKENS_COOKIE_NAME)


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


@lru_cache(maxsize=1)
def _create_streamlit_oauth_class(starlette_client: Any) -> type[Any]:
    """Create a Starlette OAuth class with Streamlit-specific OIDC behavior."""

    class StreamlitStarletteOAuth2App(starlette_client.StarletteOAuth2App):  # type: ignore[misc]
        async def load_server_metadata(self) -> dict[str, Any]:
            """Enforce S256 PKCE if supported by the provider.

            PKCE (Proof Key for Code Exchange) with S256 is a security best practice
            that protects against authorization code interception attacks.
            """
            metadata = cast("dict[str, Any]", await super().load_server_metadata())
            # Use `or []` to handle providers that return null for this field
            if "S256" in (metadata.get("code_challenge_methods_supported") or []):
                self.client_kwargs["code_challenge_method"] = "S256"
            return metadata

    class StreamlitStarletteOAuth(starlette_client.OAuth):  # type: ignore[misc]
        oauth2_client_cls = StreamlitStarletteOAuth2App

    return StreamlitStarletteOAuth


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

    This cookie uses itsdangerous signing. Cookies may be split into multiple
    chunks if they exceed browser limits.
    """

    def set_single_cookie(cookie_name: str, value: str) -> None:
        _set_single_cookie(response, cookie_name, value)

    _delete_legacy_root_auth_cookies(response)

    cookie_attr_size = _get_auth_cookie_attribute_size()
    set_cookie_with_chunks(
        set_single_cookie,
        _create_signed_value_wrapper,
        USER_COOKIE_NAME,
        user_info,
        cookie_attr_size=cookie_attr_size,
    )
    set_cookie_with_chunks(
        set_single_cookie,
        _create_signed_value_wrapper,
        TOKENS_COOKIE_NAME,
        tokens,
        cookie_attr_size=cookie_attr_size,
    )


def _get_auth_cookie_attribute_size() -> int:
    """Return the auth cookie attribute bytes used for chunk-size estimation."""
    return len(
        f"; Path={_get_cookie_path()}; HttpOnly; "
        f"SameSite={_AUTH_COOKIE_SAMESITE}; "
        f"Max-Age={AUTH_COOKIE_MAX_AGE_SECONDS}"
    )


def _set_single_cookie(
    response: Response, cookie_name: str, serialized_value: str
) -> None:
    """Set a single signed cookie on the response.

    Cookie flags:
    - httponly=True: Prevents JavaScript access (security)
    - samesite="lax": Allows cookie on same-site requests and top-level navigations
    - secure is NOT set: Deliberately avoided due to Safari cookie bugs;
      the OIDC flow only works in secure contexts anyway (localhost or HTTPS)
    - path: Matches server.baseUrlPath for proper scoping
    - max_age: 30 days, restoring the persistent-cookie behaviour documented for
      st.login.
    """
    cookie_secret = get_cookie_secret()
    signed_value = create_signed_value(cookie_secret, cookie_name, serialized_value)
    cookie_payload = signed_value.decode("utf-8")
    response.set_cookie(
        cookie_name,
        cookie_payload,
        httponly=True,
        samesite=_AUTH_COOKIE_SAMESITE,
        path=_get_cookie_path(),
        max_age=AUTH_COOKIE_MAX_AGE_SECONDS,
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


def _delete_cookie_at_current_and_legacy_paths(
    response: Response, cookie_name: str
) -> None:
    """Delete a cookie at the current auth path and legacy root path."""
    cookie_path = _get_cookie_path()
    response.delete_cookie(cookie_name, path=cookie_path)
    if cookie_path != "/":
        response.delete_cookie(cookie_name, path="/")


def _delete_legacy_root_auth_cookies(response: Response) -> None:
    """Delete legacy root-path auth cookies when auth is scoped to a base path."""
    if _get_cookie_path() == "/":
        return

    # Legacy Tornado auth cookies were never chunked, so deleting the base
    # cookie name at the root path is sufficient here.
    for cookie_name in _AUTH_COOKIE_NAMES:
        response.delete_cookie(cookie_name, path="/")


def _clear_single_auth_cookie_and_chunks(
    response: Response, request: Request, cookie_name: str
) -> None:
    """Clear an auth cookie, including any split cookie chunks.

    A large cookie is split into a main cookie plus ``{cookie_name}_1``,
    ``{cookie_name}_2``, ... siblings. We discover the chunk siblings from the
    request cookies rather than by decoding the main cookie, so they are cleared
    even when the main cookie is invalid (e.g. signed with a rotated secret) and
    can no longer be decoded to read its chunk count.
    """
    _delete_cookie_at_current_and_legacy_paths(response, cookie_name)

    # The `.isdigit()` check matches only numeric chunk siblings, so clearing
    # `_streamlit_user` does not accidentally delete the separate
    # `_streamlit_user_tokens` cookie (or its `_streamlit_user_tokens_<n>`
    # chunks), even though the latter shares the `_streamlit_user_` prefix.
    chunk_prefix = f"{cookie_name}_"
    for name in request.cookies:
        if name.startswith(chunk_prefix) and name[len(chunk_prefix) :].isdigit():
            _delete_cookie_at_current_and_legacy_paths(response, name)


def _clear_auth_cookie(response: Response, request: Request) -> None:
    """Clear the auth cookies, including any split cookie chunks.

    The path must match the path used when setting the cookie, otherwise
    the browser won't delete it. Also delete legacy root-path auth cookies left
    behind by the pre-Starlette Tornado auth implementation.
    """
    for cookie_name in _AUTH_COOKIE_NAMES:
        _clear_single_auth_cookie_and_chunks(response, request, cookie_name)


def _is_auth_cookie_present_but_invalid(request: Request, cookie_name: str) -> bool:
    """Return whether an auth cookie exists but cannot be decoded."""
    return (
        request.cookies.get(cookie_name) is not None
        and _get_signed_cookie_from_request(request, cookie_name) is None
    )


def _clear_invalid_auth_cookies(response: Response, request: Request) -> None:
    """Clear auth cookies that are present but fail signature validation."""
    if _is_auth_cookie_present_but_invalid(request, USER_COOKIE_NAME):
        # If the identity cookie is invalid, the token cookie is unusable too.
        _LOGGER.debug("Clearing invalid auth cookies (identity cookie undecodable).")
        _clear_auth_cookie(response, request)
        return

    if _is_auth_cookie_present_but_invalid(request, TOKENS_COOKIE_NAME):
        _LOGGER.debug("Clearing invalid tokens cookie (tokens cookie undecodable).")
        _clear_single_auth_cookie_and_chunks(response, request, TOKENS_COOKIE_NAME)


async def _redirect_to_base_clearing_invalid_cookies(
    request: Request, base_url: str
) -> RedirectResponse:
    """Redirect to the base URL, clearing any invalid auth cookies on the way."""
    response = await _redirect_to_base(base_url)
    _clear_invalid_auth_cookies(response, request)
    return response


def _create_oauth_client(provider: str) -> tuple[Any, str]:
    """Create an OAuth client for the given provider based on secrets.toml configuration."""

    try:
        from authlib.integrations import starlette_client
    except ModuleNotFoundError as exc:  # pragma: no cover - optional dependency
        # A missing module within the "authlib" namespace means Authlib itself is
        # missing or too old to expose the Starlette integration. Any other missing
        # module (e.g. a nested dependency like httpx) should surface its real error
        # instead of being masked as a missing Authlib install.
        module_name = exc.name or ""
        if module_name == "authlib" or module_name.startswith("authlib."):
            raise StreamlitMissingAuthlibError() from exc
        raise

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

    oauth_class = _create_streamlit_oauth_class(starlette_client)
    oauth = oauth_class(config=_AuthlibConfig(config))
    oauth.register(provider)
    return oauth.create_client(provider), redirect_uri


def _parse_provider_token(provider_token: str | None) -> str | None:
    """Extract the provider from the provider token."""

    if provider_token is None:
        return None
    try:
        payload = decode_provider_token(provider_token)
    except StreamlitAuthError:
        return None

    return payload["provider"]


def _get_provider_by_state(
    request: Request, state_code_from_url: str | None
) -> str | None:
    """Extract the provider from the session based on the state code.

    Authlib stores OAuth state in the Starlette session using keys in the format
    "_state_{provider}_{state_code}". This function iterates over session keys
    to find the provider that matches the given state code.
    """
    if state_code_from_url is None:
        return None

    session = request.session
    state_provider_mapping: dict[str, str] = {}
    for key in list(session.keys()):
        # Authlib's Starlette integration stores OAuth state in the session using keys
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
        # Filter by the "_state_" prefix first to avoid false positives from other
        # session data that might happen to have 4 underscore-separated parts.
        if not key.startswith("_state_"):
            continue
        #
        # Note: Using maxsplit=3 makes the parse greedy on the last segment, which is
        # safer if the state code ever contains underscores. While Authlib's
        # generate_token() currently uses only alphanumeric characters (a-zA-Z0-9),
        # this is defensive against upstream changes. Provider names with underscores
        # are explicitly blocked in validate_auth_credentials() in auth_util.py.
        try:
            _, _, recorded_provider, code = key.split("_", 3)
        except ValueError:
            # Skip session keys that don't match the expected 4-part format.
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


async def _get_provider_logout_url(request: Request) -> str | None:
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
        metadata = await client.load_server_metadata()
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
        return await _redirect_to_base_clearing_invalid_cookies(request, base_url)

    client, redirect_uri = _create_oauth_client(provider)
    try:
        auth_response = cast(
            "Response", await client.authorize_redirect(request, redirect_uri)
        )
        _clear_invalid_auth_cookies(auth_response, request)
        return auth_response
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

    provider_logout_url = await _get_provider_logout_url(request)

    if provider_logout_url:
        response = RedirectResponse(provider_logout_url, status_code=302)
    else:
        response = await _redirect_to_base(base_url)

    _clear_auth_cookie(response, request)
    return response


async def _auth_callback(request: Request, base_url: str) -> Response:
    """Handle the OAuth callback from the authentication provider."""

    state = request.query_params.get("state")
    provider = _get_provider_by_state(request, state)
    origin = _get_origin_from_secrets()
    if origin is None:
        _LOGGER.error(
            "Error, misconfigured origin for `redirect_uri` in secrets.",
        )
        return await _redirect_to_base_clearing_invalid_cookies(request, base_url)

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
        return await _redirect_to_base_clearing_invalid_cookies(request, base_url)

    if provider is None:
        # See https://github.com/streamlit/streamlit/issues/13101
        _LOGGER.warning(
            "Missing provider for OAuth callback; this often indicates a stale "
            "or replayed callback (for example, from browser back/forward "
            "navigation).",
        )
        return await _redirect_to_base_clearing_invalid_cookies(request, base_url)

    client, _ = _create_oauth_client(provider)
    try:
        token = await client.authorize_access_token(request)
    except Exception:
        _LOGGER.warning(
            "OAuth token exchange failed for provider '%s'. Clearing auth cookies.",
            provider,
            exc_info=True,
        )
        response = await _redirect_to_base(base_url)
        _clear_auth_cookie(response, request)
        return response

    user = token.get("userinfo") or {}

    # Clear any invalid/stale auth cookies (e.g. orphaned chunks from an old
    # cookie format) before writing the fresh cookies below, so leftover state
    # cannot interfere with the new login.
    response = await _redirect_to_base_clearing_invalid_cookies(request, base_url)

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
