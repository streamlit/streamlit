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
from __future__ import annotations

import json
from typing import Any, Final, cast
from urllib.parse import urlparse

import tornado.web

from streamlit.auth_util import (
    AuthCache,
    decode_provider_token,
    generate_default_provider_section,
    get_secrets_auth_section,
)
from streamlit.errors import StreamlitAuthError
from streamlit.logger import get_logger
from streamlit.url_util import make_url_path
from streamlit.web.server.oidc_mixin import TornadoOAuth, TornadoOAuth2App
from streamlit.web.server.server_util import AUTH_COOKIE_NAME

_LOGGER: Final = get_logger(__name__)

auth_cache = AuthCache()


def create_oauth_client(provider: str) -> tuple[TornadoOAuth2App, str]:
    """Create an OAuth client for the given provider based on secrets.toml configuration."""
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

    oauth = TornadoOAuth(config, cache=auth_cache)
    oauth.register(provider)
    return oauth.create_client(provider), redirect_uri  # type: ignore[no-untyped-call]


class AuthHandlerMixin(tornado.web.RequestHandler):
    """Mixin for handling auth cookies. Added for compatibility with Tornado < 6.3.0."""

    def initialize(self, base_url: str) -> None:
        self.base_url = base_url

    def redirect_to_base(self) -> None:
        self.redirect(make_url_path(self.base_url, "/"))

    def set_auth_cookie(self, user_info: dict[str, Any]) -> None:
        serialized_cookie_value = json.dumps(user_info)

        # log error if cookie value is larger than 4096 bytes
        if len(serialized_cookie_value.encode()) > 4096:
            _LOGGER.error(
                "Authentication cookie size exceeds maximum browser limit of 4096 bytes. Authentication may fail."
            )

        try:
            # We don't specify Tornado secure flag here because it leads to missing cookie on Safari.
            # The OIDC flow should work only on secure context anyway (localhost or HTTPS),
            # so specifying the secure flag here will not add anything in terms of security.
            self.set_signed_cookie(
                AUTH_COOKIE_NAME,
                serialized_cookie_value,
                httpOnly=True,
            )
        except AttributeError:
            self.set_secure_cookie(
                AUTH_COOKIE_NAME,
                serialized_cookie_value,
                httponly=True,
            )

    def clear_auth_cookie(self) -> None:
        self.clear_cookie(AUTH_COOKIE_NAME)


class AuthLoginHandler(AuthHandlerMixin, tornado.web.RequestHandler):
    async def get(self) -> None:
        """Redirect to the OAuth provider login page."""
        provider = self._parse_provider_token()
        if provider is None:
            self.redirect_to_base()
            return

        client, redirect_uri = create_oauth_client(provider)
        try:
            client.authorize_redirect(self, redirect_uri)
        except Exception as e:
            self.send_error(400, reason=str(e))

    def _parse_provider_token(self) -> str | None:
        provider_token = self.get_argument("provider", None)
        if provider_token is None:
            return None
        try:
            payload = decode_provider_token(provider_token)
        except StreamlitAuthError:
            return None

        return payload["provider"]


class AuthLogoutHandler(AuthHandlerMixin, tornado.web.RequestHandler):
    def get(self) -> None:
        self.clear_auth_cookie()
        self.redirect_to_base()


class AuthCallbackHandler(AuthHandlerMixin, tornado.web.RequestHandler):
    async def get(self) -> None:
        provider = self._get_provider_by_state()
        origin = self._get_origin_from_secrets()
        if origin is None:
            _LOGGER.error(
                "Error, misconfigured origin for `redirect_uri` in secrets. ",
            )
            self.redirect_to_base()
            return

        error = self.get_argument("error", None)
        if error:
            error_description = self.get_argument("error_description", None)
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
            self.redirect_to_base()
            return

        if provider is None:
            # See https://github.com/streamlit/streamlit/issues/13101
            _LOGGER.warning(
                "Missing provider for OAuth callback; this often indicates a stale "
                "or replayed callback (for example, from browser back/forward "
                "navigation).",
            )
            self.redirect_to_base()
            return

        client, _ = create_oauth_client(provider)
        token = client.authorize_access_token(self)
        user = cast("dict[str, Any]", token.get("userinfo"))

        cookie_value = dict(user, origin=origin, is_logged_in=True)
        if user:
            self.set_auth_cookie(cookie_value)
        else:
            _LOGGER.error(
                "Error, missing user info.",
            )
        self.redirect_to_base()

    def _get_provider_by_state(self) -> str | None:
        state_code_from_url = self.get_argument("state")
        current_cache_keys = list(auth_cache.get_dict().keys())
        state_provider_mapping = {}
        for key in current_cache_keys:
            _, _, recorded_provider, code = key.split("_")
            state_provider_mapping[code] = recorded_provider

        provider: str | None = state_provider_mapping.get(state_code_from_url)
        return provider

    def _get_origin_from_secrets(self) -> str | None:
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
