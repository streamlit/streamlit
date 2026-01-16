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
from typing import Any, Final, cast
from urllib.parse import urlencode, urlparse

import requests
import tornado.web
from authlib import jose

from streamlit.auth_util import (
    AuthCache,
    clear_cookie_and_chunks,
    decode_provider_token,
    generate_default_provider_section,
    get_cookie_with_chunks,
    get_redirect_uri,
    get_secrets_auth_section,
    set_cookie_with_chunks,
)
from streamlit.errors import StreamlitAuthError
from streamlit.logger import get_logger
from streamlit.url_util import make_url_path
from streamlit.web.server.oidc_mixin import TornadoOAuth, TornadoOAuth2App
from streamlit.web.server.server_util import AUTH_COOKIE_NAME, TOKENS_COOKIE_NAME

_LOGGER: Final = get_logger(__name__)

auth_cache = AuthCache()


def create_oauth_client(provider: str) -> tuple[TornadoOAuth2App, str]:
    """Create an OAuth client for the given provider based on secrets.toml configuration."""
    auth_section = get_secrets_auth_section()
    if auth_section:
        redirect_uri = get_redirect_uri(auth_section) or "/"
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

    def set_auth_cookie(
        self, user_info: dict[str, Any], tokens: dict[str, Any]
    ) -> None:
        set_cookie_with_chunks(
            self._set_single_cookie,
            self._create_signed_value,
            AUTH_COOKIE_NAME,
            user_info,
        )
        set_cookie_with_chunks(
            self._set_single_cookie,
            self._create_signed_value,
            TOKENS_COOKIE_NAME,
            tokens,
        )

    def _set_single_cookie(self, cookie_name: str, value: str) -> None:
        """Set a single cookie."""
        try:
            # We don't specify Tornado secure flag here because it leads to missing cookie on Safari.
            # The OIDC flow should work only on secure context anyway (localhost or HTTPS),
            # so specifying the secure flag here will not add anything in terms of security.
            self.set_signed_cookie(
                cookie_name,
                value,
                httpOnly=True,
            )
        except AttributeError:
            self.set_secure_cookie(
                cookie_name,
                value,
                httponly=True,
            )

    def _create_signed_value(self, cookie_name: str, value: str) -> bytes:
        """Create a signed cookie value."""
        try:
            return self.create_signed_value(cookie_name, value)
        except AttributeError:
            # Default to the older method for compatibility with Tornado < 6.3.0
            return cast("bytes", self.create_secure_cookie_value(cookie_name, value))  # type: ignore[attr-defined]

    def _get_signed_cookie(self, cookie_name: str) -> bytes | None:
        """Get a signed cookie."""
        try:
            return cast("bytes", self.get_signed_cookie(cookie_name))
        except AttributeError:
            # Default to the older method for compatibility with Tornado < 6.3.0
            return cast("bytes", self.get_secure_cookie(cookie_name))
        except Exception:
            # Handle cases where cookie_secret is not configured or other errors
            return None

    def clear_auth_cookie(self) -> None:
        """Clear auth cookies, including any split cookie chunks."""
        clear_cookie_and_chunks(
            self._get_signed_cookie,
            self.clear_cookie,
            AUTH_COOKIE_NAME,
        )
        clear_cookie_and_chunks(
            self._get_signed_cookie,
            self.clear_cookie,
            TOKENS_COOKIE_NAME,
        )


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

        provider_logout_url = self._get_provider_logout_url()
        if provider_logout_url:
            self.redirect(provider_logout_url)
        else:
            self.redirect_to_base()

    def _get_redirect_uri(self) -> str | None:
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

    def _get_provider_logout_url(self) -> str | None:
        """Get the OAuth provider's logout URL from OIDC metadata."""
        cookie_value = get_cookie_with_chunks(self._get_signed_cookie, AUTH_COOKIE_NAME)

        if not cookie_value:
            return None

        try:
            user_info = json.loads(cookie_value)
            provider = user_info.get("provider")
            if not provider:
                return None

            client, _ = create_oauth_client(provider)

            metadata = client.load_server_metadata()
            end_session_endpoint = metadata.get("end_session_endpoint")

            if not end_session_endpoint:
                _LOGGER.info("No end_session_endpoint found for provider %s", provider)
                return None

            # Use redirect_uri (i.e. /oauth2callback) for post_logout_redirect_uri
            # This is safer than redirecting to root as some providers seem to
            # require url to be in a whitelist /oauth2callback should be whitelisted
            redirect_uri = self._get_redirect_uri()
            if redirect_uri is None:
                _LOGGER.info("Redirect url could not be determined")
                return None

            logout_params = {
                "client_id": client.client_id,
                "post_logout_redirect_uri": redirect_uri,
            }

            # Add id_token_hint to logout params if it is available
            tokens_cookie_value = get_cookie_with_chunks(
                self._get_signed_cookie, TOKENS_COOKIE_NAME
            )
            if tokens_cookie_value:
                try:
                    tokens = json.loads(tokens_cookie_value)
                    id_token = tokens.get("id_token")
                    if id_token:
                        logout_params["id_token_hint"] = id_token
                except (json.JSONDecodeError, TypeError):
                    _LOGGER.exception(
                        "Error, invalid tokens cookie value.",
                    )
                    return None

            return f"{end_session_endpoint}?{urlencode(logout_params)}"

        except Exception as e:
            _LOGGER.warning("Failed to get provider logout URL: %s", e)
            return None


class AuthCallbackHandler(AuthHandlerMixin, tornado.web.RequestHandler):
    async def get(self) -> None:
        provider = self._get_provider_by_state()
        if provider is None:
            # This could be a logout redirect (no state parameter) or invalid state
            # In both cases, redirect to base
            self.redirect_to_base()
            return

        origin = self._get_origin_from_secrets()
        if origin is None:
            _LOGGER.error(
                "Error, misconfigured origin for `redirect_uri` in secrets.",
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

        client, _ = create_oauth_client(provider)
        token = client.authorize_access_token(self)
        user = cast("dict[str, Any]", token.get("userinfo"))

        cookie_value = dict(user, origin=origin, is_logged_in=True, provider=provider)
        tokens = {k: token[k] for k in ["id_token", "access_token"] if k in token}

        if user:
            self.set_auth_cookie(cookie_value, tokens)
            # Keep tokens in a separate cookie to avoid hitting the size limit
        else:
            _LOGGER.error("Error, missing user info.")
        self.redirect_to_base()

    def _get_provider_by_state(self) -> str | None:
        state_code_from_url = self.get_argument("state", None)
        if state_code_from_url is None:
            return None

        current_cache_keys = list(auth_cache.get_dict().keys())
        state_provider_mapping = {}
        for key in current_cache_keys:
            # Authlib stores OAuth state in the cache using keys in the format:
            # "_state_{provider}_{state_code}" (e.g., "_state_google_abc123").
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

    def _get_origin_from_secrets(self) -> str | None:
        redirect_uri = None
        auth_section = get_secrets_auth_section()
        if auth_section:
            redirect_uri = get_redirect_uri(auth_section)

        if not redirect_uri:
            return None

        redirect_uri_parsed = urlparse(redirect_uri)
        origin_from_redirect_uri: str = (
            redirect_uri_parsed.scheme + "://" + redirect_uri_parsed.netloc
        )
        return origin_from_redirect_uri


class AuthRefreshHandler(AuthHandlerMixin, tornado.web.RequestHandler):
    def get_new_tokens(
        self, client: TornadoOAuth2App, refresh_token: str
    ) -> dict[str, Any] | None:
        try:
            metadata = client.load_server_metadata()
            token_endpoint = metadata.get("token_endpoint")
            if not token_endpoint:
                _LOGGER.error("No token endpoint available for refresh")
                return None

            refresh_data = {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": client.client_id,
                "client_secret": client.client_secret,
            }

            response = requests.post(
                token_endpoint,
                data=refresh_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=10,
            )

            if response.status_code != 200:
                _LOGGER.error(
                    "Token refresh failed with status %i", response.status_code
                )
                return None

            new_tokens = response.json()
            new_tokens = {k: v for k, v in new_tokens.items() if k.endswith("_token")}
            return new_tokens
        except Exception:
            _LOGGER.exception("Token refresh failed")
            return None

    def decode_id_token(
        self, client: TornadoOAuth2App, id_token: str
    ) -> dict[str, Any]:
        jwks_uri = client.server_metadata.get("jwks_uri")
        jwks = requests.get(jwks_uri, timeout=10).json()
        return jose.jwt.decode(id_token, key=jwks)

    def get(self) -> None:
        """Handle token refresh requests."""
        try:
            user_cookie_value = self.get_signed_cookie(AUTH_COOKIE_NAME)
            tokens_cookie_value = self.get_signed_cookie(TOKENS_COOKIE_NAME)
        except AttributeError:  # Backward compatibility with Tornado < 6.3.0
            user_cookie_value = self.get_secure_cookie(AUTH_COOKIE_NAME)
            tokens_cookie_value = self.get_secure_cookie(TOKENS_COOKIE_NAME)

        if not user_cookie_value or not tokens_cookie_value:
            _LOGGER.error("Missing authentication cookies for token refresh")
            self.redirect_to_base()
            return

        try:
            current_user_info = json.loads(user_cookie_value)
            current_tokens = json.loads(tokens_cookie_value)
        except json.JSONDecodeError:
            _LOGGER.exception("Invalid authentication cookies for token refresh")
            self.redirect_to_base()
            return

        provider = current_user_info.get("provider")
        if provider is None:
            _LOGGER.error("Missing or invalid provider for token refresh")
            self.redirect_to_base()
            return
        client, _ = create_oauth_client(provider)

        refresh_token = current_tokens.get("refresh_token")
        if not refresh_token:
            _LOGGER.info("No refresh token found")
            self.redirect_to_base()
            return

        new_tokens = self.get_new_tokens(client, refresh_token)
        if not new_tokens:
            _LOGGER.info("Refreshing tokens failed")
            self.redirect_to_base()
            return

        updated_tokens = {**current_tokens, **new_tokens}
        updated_user_info = current_user_info.copy()

        if "id_token" in new_tokens:
            try:
                new_userinfo = self.decode_id_token(client, new_tokens["id_token"])
                updated_user_info.update(new_userinfo)
            except Exception:
                _LOGGER.exception("Failed to decode id token")
        else:
            _LOGGER.info("No id token in new tokens")

        self.set_auth_cookie(updated_user_info, updated_tokens)
        _LOGGER.info("Successfully refreshed user tokens")

        self.redirect_to_base()
