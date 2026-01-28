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

import tornado.web

from streamlit.auth_util import (
    AuthCache,
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
            redirect_uri = get_validated_redirect_uri()
            if redirect_uri is None:
                _LOGGER.info("Redirect url could not be determined")
                return None

            # Get id_token_hint from tokens cookie if available
            id_token: str | None = None
            tokens_cookie_value = get_cookie_with_chunks(
                self._get_signed_cookie, TOKENS_COOKIE_NAME
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
        return get_origin_from_redirect_uri()
