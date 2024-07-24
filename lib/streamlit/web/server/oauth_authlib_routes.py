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
import json

import tornado.web

from streamlit.runtime.secrets import secrets_singleton
from streamlit.web.server.oidc_mixin import TornadoOAuth


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


my_cache = AuthCache()

if secrets_singleton.load_if_toml_exists():
    auth_section = secrets_singleton.get("auth")
    if auth_section:
        redirect_uri = auth_section.get("redirect_uri", None)
        config = dict(auth_section)
    else:
        config = {}
        redirect_uri = "/"
else:
    config = {}
    redirect_uri = "/"

oauth = TornadoOAuth(config, cache=my_cache)

if secrets_singleton.load_if_toml_exists():
    auth_section = secrets_singleton.get("auth", None)

    if auth_section is not None:
        for key in auth_section.keys():
            if key == "redirect_uri":
                continue

            if auth_section.get(key, {}).get("client_kwargs", {}).get("scope", None):
                oauth.register(key)
            else:
                oauth.register(
                    key,
                    client_kwargs={
                        "scope": "openid email profile",
                        "prompt": "select_account",  # force to select account
                    },
                )


class AuthlibLoginHandler(tornado.web.RequestHandler):
    async def get(self):
        provider = self.get_argument("provider", None)
        client = oauth.create_client(provider)
        return client.authorize_redirect(self, redirect_uri)


class LogoutHandler(tornado.web.RequestHandler):
    def get(self):
        self.clear_cookie("_streamlit_uzer")
        self.redirect("/")


class AuthlibCallbackHandler(tornado.web.RequestHandler):
    async def get(self):
        state_code_from_url = self.get_argument("state")

        current_cache_keys = list(my_cache.get_dict().keys())
        state_provider_mapping = {}
        for key in current_cache_keys:
            _, _, provider, code = key.split("_")
            state_provider_mapping[code] = provider
        provider = state_provider_mapping.get(state_code_from_url, None)

        client = oauth.create_client(provider)
        token = client.authorize_access_token(self)
        user = token.get("userinfo")
        if user:
            self.set_signed_cookie("_streamlit_uzer", json.dumps(user), httpOnly=True)
        if not user:
            access_token = token.get("access_token")
            dict_for_cookie = {
                "access_token": access_token,
                "provider": provider,
            }
            self.set_signed_cookie(
                "_streamlit_uzer",
                json.dumps(dict_for_cookie),
            )
        self.redirect("/")
