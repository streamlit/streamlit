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

# mypy: disable-error-code="no-untyped-call"
# ruff: noqa: ANN201

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Callable, cast

from authlib.integrations.base_client import (
    BaseApp,
    BaseOAuth,
    OAuth2Mixin,
    OAuthError,
    OpenIDMixin,
)
from authlib.integrations.requests_client import (
    OAuth2Session,
)

from streamlit.web.server.authlib_tornado_integration import TornadoIntegration

if TYPE_CHECKING:
    import tornado.web

    from streamlit.auth_util import AuthCache


class TornadoOAuth2App(OAuth2Mixin, OpenIDMixin, BaseApp):
    client_cls = OAuth2Session

    def load_server_metadata(self) -> dict[str, Any]:
        """We enforce S256 code challenge method if it is supported by the server."""
        result = cast("dict[str, Any]", super().load_server_metadata())
        if "S256" in result.get("code_challenge_methods_supported", []):
            self.client_kwargs["code_challenge_method"] = "S256"
        return result

    def authorize_redirect(
        self,
        request_handler: tornado.web.RequestHandler,
        redirect_uri: Any = None,
        **kwargs: Any,
    ) -> None:
        """Create a HTTP Redirect for Authorization Endpoint.

        :param request_handler: HTTP request instance from Tornado.
        :param redirect_uri: Callback or redirect URI for authorization.
        :param kwargs: Extra parameters to include.
        :return: A HTTP redirect response.
        """
        auth_context = self.create_authorization_url(redirect_uri, **kwargs)
        self._save_authorize_data(redirect_uri=redirect_uri, **auth_context)
        request_handler.redirect(auth_context["url"], status=302)

    def authorize_access_token(
        self, request_handler: tornado.web.RequestHandler, **kwargs: Any
    ) -> dict[str, Any]:
        """
        :param request_handler: HTTP request instance from Tornado.
        :return: A token dict.
        """
        error = request_handler.get_argument("error", None)
        if error:
            description = request_handler.get_argument("error_description", None)
            raise OAuthError(error=error, description=description)

        params = {
            "code": request_handler.get_argument("code"),
            "state": request_handler.get_argument("state"),
        }

        session = None

        claims_options = kwargs.pop("claims_options", None)
        state_data = self.framework.get_state_data(session, params.get("state"))
        self.framework.clear_state_data(session, params.get("state"))
        params = self._format_state_params(state_data, params)  # type: ignore[attr-defined]
        token = self.fetch_access_token(**params, **kwargs)

        if "id_token" in token and "nonce" in state_data:
            userinfo = self.parse_id_token(
                token, nonce=state_data["nonce"], claims_options=claims_options
            )
            token = {**token, "userinfo": userinfo}
        return cast("dict[str, Any]", token)

    def _save_authorize_data(self, **kwargs: Any) -> None:
        """Authlib underlying uses the concept of "session" to store state data.
        In Tornado, we don't have a session, so we use the framework's cache option.
        """
        state = kwargs.pop("state", None)
        if state:
            session = None
            self.framework.set_state_data(session, state, kwargs)
        else:
            raise RuntimeError("Missing state value")


class TornadoOAuth(BaseOAuth):
    oauth2_client_cls = TornadoOAuth2App
    framework_integration_cls = TornadoIntegration

    def __init__(
        self,
        config: dict[str, Any] | None = None,
        cache: AuthCache | None = None,
        fetch_token: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
        update_token: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
    ):
        super().__init__(
            cache=cache, fetch_token=fetch_token, update_token=update_token
        )
        self.config = config
