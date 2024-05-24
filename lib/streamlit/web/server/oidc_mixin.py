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

import tornado.web
from authlib.integrations.base_client import (
    BaseApp,
    BaseOAuth,
    OAuth2Mixin,
    OAuthError,
    OpenIDMixin,
)
from authlib.integrations.requests_client import OAuth2Session

from streamlit.web.server.authlib_tornado_integration import TornadoIntegration


class TornadoOAuth2App(OAuth2Mixin, OpenIDMixin, BaseApp):
    client_cls = OAuth2Session

    def save_authorize_data(self, **kwargs):
        state = kwargs.pop("state", None)
        if state:
            assert self.framework.cache is not None
            session = None
            self.framework.set_state_data(session, state, kwargs)
        else:
            raise RuntimeError("Missing state value")

    def authorize_redirect(
        self, request_handler: tornado.web.RequestHandler, redirect_uri=None, **kwargs
    ):
        """Create a HTTP Redirect for Authorization Endpoint.

        :param request: HTTP request instance from Starlette view.
        :param redirect_uri: Callback or redirect URI for authorization.
        :param kwargs: Extra parameters to include.
        :return: A HTTP redirect response.
        """
        rv = self.create_authorization_url(redirect_uri, **kwargs)
        self.save_authorize_data(redirect_uri=redirect_uri, **rv)
        request_handler.redirect(rv["url"], status=302)

    def authorize_access_token(
        self, request_handler: tornado.web.RequestHandler, **kwargs
    ):
        error = request_handler.get_argument("error", None)
        if error:
            description = request_handler.get_argument("error_description", None)
            raise OAuthError(error=error, description=description)

        params = {
            "code": request_handler.get_argument("code"),
            "state": request_handler.get_argument("state"),
        }

        assert self.framework.cache is not None
        session = None

        claims_options = kwargs.pop("claims_options", None)
        state_data = self.framework.get_state_data(session, params.get("state"))
        self.framework.clear_state_data(session, params.get("state"))
        params = self._format_state_params(state_data, params)
        token = self.fetch_access_token(**params, **kwargs)

        if "id_token" in token and "nonce" in state_data:
            userinfo = self.parse_id_token(
                token, nonce=state_data["nonce"], claims_options=claims_options
            )
            token["userinfo"] = userinfo
        return token


class TornadoOAuth(BaseOAuth):
    oauth2_client_cls = TornadoOAuth2App
    framework_integration_cls = TornadoIntegration

    def __init__(self, config=None, cache=None, fetch_token=None, update_token=None):
        super().__init__(
            cache=cache, fetch_token=fetch_token, update_token=update_token
        )
        self.config = config
