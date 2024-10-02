# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
from typing import Any
from urllib.parse import urlparse

import tornado.web

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.secrets import secrets_singleton
from streamlit.user_info import decode_provider_token
from streamlit.web.server.oidc_mixin import TornadoOAuth, TornadoOAuth2App
from streamlit.web.server.server_util import AUTH_COOKIE_NAME


class AuthCache:
    def __init__(self):
        self.cache = {}

    def get(self, key):
        return self.cache.get(key)

    def set(self, key, value, expires_in):
        self.cache[key] = value

    def get_dict(self):
        return self.cache

    def delete(self, key):
        self.cache.pop(key, None)


auth_cache = AuthCache()


def create_oauth_client(provider: str) -> tuple[TornadoOAuth2App, str]:
    if secrets_singleton.load_if_toml_exists():
        auth_section = secrets_singleton.get("auth")
        if auth_section:
            redirect_uri = auth_section.get("redirect_uri", None)
            config = dict(auth_section.to_dict())
        else:
            config = {}
            redirect_uri = "/"
    else:
        config = {}
        redirect_uri = "/"

    provider_section = config.setdefault(provider, {})
    provider_client_kwargs = provider_section.setdefault("client_kwargs", {})
    if "scope" not in provider_client_kwargs:
        provider_client_kwargs["scope"] = "openid email profile"
    if "prompt" not in provider_client_kwargs:
        provider_client_kwargs["prompt"] = "select_account"

    oauth = TornadoOAuth(config, cache=auth_cache)
    oauth.register(provider)
    return oauth.create_client(provider), redirect_uri


class AuthLoginHandler(tornado.web.RequestHandler):
    async def get(self):
        provider_token = self.get_argument("provider", None)
        try:
            if provider_token is None:
                raise StreamlitAPIException("Missing provider token")
            payload = decode_provider_token(provider_token)
        except StreamlitAPIException:
            self.redirect("/")
            return
        client, redirect_uri = create_oauth_client(payload["provider"])
        return client.authorize_redirect(self, redirect_uri)


class AuthHandlerMixin(tornado.web.RequestHandler):
    def set_auth_cookie(self, user_info: dict[str, Any]) -> None:
        self.set_signed_cookie(AUTH_COOKIE_NAME, json.dumps(user_info), httpOnly=True)

    def clear_auth_cookie(self) -> None:
        self.clear_cookie(AUTH_COOKIE_NAME)


class LogoutHandler(AuthHandlerMixin, tornado.web.RequestHandler):
    def get(self):
        self.clear_auth_cookie()
        self.redirect("/")


class AuthCallbackHandler(AuthHandlerMixin, tornado.web.RequestHandler):
    async def get(self):
        state_code_from_url = self.get_argument("state")
        current_cache_keys = list(auth_cache.get_dict().keys())
        state_provider_mapping = {}
        for key in current_cache_keys:
            _, _, provider, code = key.split("_")
            state_provider_mapping[code] = provider
        provider = state_provider_mapping.get(state_code_from_url, None)

        redirect_uri = None
        if secrets_singleton.load_if_toml_exists():
            auth_section = secrets_singleton.get("auth")
            if auth_section:
                redirect_uri = auth_section.get("redirect_uri", None)

        if not redirect_uri:
            self.redirect("/")
            return

        redirect_uri_parsed = urlparse(redirect_uri)
        origin_from_redirect_uri = (
            redirect_uri_parsed.scheme + "://" + redirect_uri_parsed.netloc
        )

        error = self.get_argument("error", None)

        if error:
            dict_for_cookie = {
                "provider": provider,
                "error": error,
                "email": None,
                "origin": origin_from_redirect_uri,
            }
            self.set_auth_cookie(dict_for_cookie)
            self.redirect("/")
            return

        if provider is None:
            dict_for_cookie = {
                "provider": None,
                "error": "Missing provider",
                "email": None,
                "origin": origin_from_redirect_uri,
            }
            self.set_auth_cookie(dict_for_cookie)
            self.redirect("/")
            return

        client, _ = create_oauth_client(provider)
        token = client.authorize_access_token(self)
        user = token.get("userinfo")

        cookie_dict = dict(user)
        cookie_dict["origin"] = origin_from_redirect_uri

        if user:
            self.set_auth_cookie(cookie_dict)
        self.redirect("/")
