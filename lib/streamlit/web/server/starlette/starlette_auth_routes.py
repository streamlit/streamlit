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

"""Starlette app authentication routes."""

from __future__ import annotations

import importlib
import json
from typing import TYPE_CHECKING, Any, Final, cast
from urllib.parse import urlparse

from streamlit.auth_util import (
    AuthCache,
    decode_provider_token,
    generate_default_provider_section,
    get_secrets_auth_section,
)
from streamlit.errors import StreamlitAuthError
from streamlit.logger import get_logger
from streamlit.url_util import make_url_path
from streamlit.web.server.oauth_authlib_routes import auth_cache
from streamlit.web.server.server_util import AUTH_COOKIE_NAME, get_cookie_secret
from streamlit.web.server.starlette.starlette_app_utils import create_signed_value

if TYPE_CHECKING:
    from starlette.responses import RedirectResponse, Response
    from starlette.routing import Route

# Auth route path constants (without base URL prefix)
ROUTE_AUTH_LOGIN: Final = "auth/login"
ROUTE_AUTH_LOGOUT: Final = "auth/logout"
ROUTE_OAUTH_CALLBACK: Final = "oauth2callback"


class _AsyncAuthCache:
    """Adapter that exposes AuthCache with awaitable methods for Authlib.

    Streamlit's internal AuthCache is synchronous, but Authlib's Starlette integration
    expects an async cache interface. This adapter bridges the two.
    """

    def __init__(self, cache: AuthCache) -> None:
        self._cache = cache

    async def get(self, key: str) -> Any:
        return self._cache.get(key)

    async def set(self, key: str, value: Any, expires_in: int | None = None) -> None:
        self._cache.set(key, value, expires_in)

    async def delete(self, key: str) -> None:
        self._cache.delete(key)

    def get_dict(self) -> dict[str, Any]:
        return self._cache.get_dict()


_STARLETTE_AUTH_CACHE = _AsyncAuthCache(auth_cache)


if TYPE_CHECKING:
    from starlette.requests import Request

_LOGGER: Final = get_logger(__name__)


def _normalize_nested_config(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _normalize_nested_config(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_normalize_nested_config(item) for item in value]
    return value


def _looks_like_provider_section(value: dict[str, Any]) -> bool:
    provider_keys = {
        "client_id",
        "client_secret",
        "server_metadata_url",
        "authorize_url",
        "api_base_url",
        "request_token_url",
    }
    return any(key in value for key in provider_keys)


class _AuthlibConfig(dict[str, Any]):
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
    from starlette.responses import RedirectResponse

    return RedirectResponse(make_url_path(base_url, "/"), status_code=302)


async def _set_auth_cookie(response: Response, user_info: dict[str, Any]) -> None:
    serialized_cookie_value = json.dumps(user_info)
    if len(serialized_cookie_value.encode()) > 4096:
        _LOGGER.error(
            "Authentication cookie size exceeds maximum browser limit of 4096 bytes. Authentication may fail."
        )

    cookie_secret = get_cookie_secret()
    signed_value = create_signed_value(
        cookie_secret, AUTH_COOKIE_NAME, serialized_cookie_value
    )
    cookie_payload = signed_value.decode("utf-8")

    response.set_cookie(AUTH_COOKIE_NAME, cookie_payload, httponly=True)


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(AUTH_COOKIE_NAME)


def _create_oauth_client(provider: str) -> tuple[Any, str]:
    try:
        authlib_module = importlib.import_module(
            "authlib.integrations.starlette_client"
        )
    except ModuleNotFoundError:  # pragma: no cover - optional dependency
        raise StreamlitAuthError(
            "Authentication requires Authlib>=1.3.2. "
            "Install it via `pip install streamlit[auth]`."
        )
    oauth_cls = authlib_module.OAuth  # ty: ignore

    auth_section = get_secrets_auth_section()
    if auth_section:
        redirect_uri = auth_section.get("redirect_uri", None)
        config = auth_section.to_dict()
    else:
        config = {}
        redirect_uri = "/"

    provider_section = config.setdefault(provider, {})

    if not provider_section and provider == "default":
        provider_section = generate_default_provider_section(auth_section)
        config["default"] = provider_section

    provider_client_kwargs = provider_section.setdefault("client_kwargs", {})
    if "scope" not in provider_client_kwargs:
        provider_client_kwargs["scope"] = "openid email profile"
    if "prompt" not in provider_client_kwargs:
        provider_client_kwargs["prompt"] = "select_account"

    oauth = oauth_cls(config=_AuthlibConfig(config), cache=_STARLETTE_AUTH_CACHE)
    oauth.register(provider)
    return oauth.create_client(provider), redirect_uri


def _parse_provider_token(provider_token: str | None) -> str | None:
    if provider_token is None:
        return None
    try:
        payload = decode_provider_token(provider_token)
    except StreamlitAuthError:
        return None

    return payload["provider"]


def _get_provider_by_state(state_code_from_url: str | None) -> str | None:
    if state_code_from_url is None:
        return None
    current_cache_keys = list(auth_cache.get_dict().keys())
    state_provider_mapping = {}
    for key in current_cache_keys:
        try:
            _, _, recorded_provider, code = key.split("_")
        except ValueError:
            # Skip malformed cache keys that don't match the expected format.
            continue
        state_provider_mapping[code] = recorded_provider

    provider: str | None = state_provider_mapping.get(state_code_from_url)
    return provider


def _get_origin_from_secrets() -> str | None:
    redirect_uri = None
    auth_section = get_secrets_auth_section()
    if auth_section:
        redirect_uri = auth_section.get("redirect_uri", None)

    if not redirect_uri:
        return None

    redirect_uri_parsed = urlparse(redirect_uri)
    origin_from_redirect_uri: str = (
        redirect_uri_parsed.scheme + "://" + redirect_uri_parsed.netloc
    )
    return origin_from_redirect_uri


async def _auth_login(request: Request, base_url: str) -> Response:
    provider = _parse_provider_token(request.query_params.get("provider"))
    if provider is None:
        return await _redirect_to_base(base_url)

    client, redirect_uri = _create_oauth_client(provider)
    try:
        response = await client.authorize_redirect(request, redirect_uri)
        return cast("Response", response)
    except Exception as exc:  # pragma: no cover - error path
        from starlette.responses import Response

        _LOGGER.warning("Error during authentication.", exc_info=True)
        return Response(str(exc), status_code=400)


async def _auth_logout(_request: Request, base_url: str) -> Response:
    response = await _redirect_to_base(base_url)
    _clear_auth_cookie(response)
    return response


async def _auth_callback(request: Request, base_url: str) -> Response:
    provider = _get_provider_by_state(request.query_params.get("state"))
    origin = _get_origin_from_secrets()
    if origin is None:
        _LOGGER.error(
            "Error, misconfigured origin for `redirect_uri` in secrets. ",
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
        _LOGGER.error(
            "Error, missing provider for oauth callback.",
        )
        return await _redirect_to_base(base_url)

    client, _ = _create_oauth_client(provider)
    token = await client.authorize_access_token(request)
    user = token.get("userinfo") or {}

    response = await _redirect_to_base(base_url)

    cookie_value = dict(user, origin=origin, is_logged_in=True)
    if user:
        await _set_auth_cookie(response, cookie_value)
    else:  # pragma: no cover - error path
        _LOGGER.error(
            "Error, missing user info.",
        )
    return response


def get_auth_routes(base_url: str) -> list[Route]:
    from starlette.routing import Route

    async def login(request: Request) -> Response:
        return await _auth_login(request, base_url)

    async def logout(request: Request) -> Response:
        return await _auth_logout(request, base_url)

    async def callback(request: Request) -> Response:
        return await _auth_callback(request, base_url)

    return [
        Route(make_url_path(base_url, ROUTE_AUTH_LOGIN), login, methods=["GET"]),
        Route(make_url_path(base_url, ROUTE_AUTH_LOGOUT), logout, methods=["GET"]),
        Route(make_url_path(base_url, ROUTE_OAUTH_CALLBACK), callback, methods=["GET"]),
    ]
