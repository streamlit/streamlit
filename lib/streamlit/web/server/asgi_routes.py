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
from typing import Callable, Set

from starlette.endpoints import HTTPEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from streamlit import config


class ASGIHealthHandler(HTTPEndpoint):
    async def get(self, request: Request):
        return await self.handle_request(request)

    # Some monitoring services only support the HTTP HEAD method for requests to
    # healthcheck endpoints, so we support HEAD as well to play nicely with them.
    async def head(self, request: Request):
        return await self.handle_request(request)

    async def handle_request(self, request: Request):
        # if "_stcore/" not in request.url.path:
        #     new_path = (
        #         "/_stcore/script-health-check"
        #         if "script-health-check" in self.request.uri
        #         else "/_stcore/health"
        #     )
        # TODO(kajarenc): Rewrite emit_endpoint_deprecation_notice with Starlette
        # emit_endpoint_deprecation_notice(self, new_path=new_path)

        ok, msg = await request.state.runtime.is_ready_for_browser_connection

        if ok:
            response = PlainTextResponse(msg, status_code=200)
            return response

            # Tornado will set the _streamlit_xsrf cookie automatically for the page on
            # request for the document. However, if the server is reset and
            # server.enableXsrfProtection is updated, the browser does not reload the document.
            # Manually setting the cookie on /healthz since it is pinged when the
            # browser is disconnected from the server.
            # TODO(kajarenc): Rewrite this part with Starlette, set _streamlit_xsrf cookie
            # if config.get_option("server.enableXsrfProtection"):
            #     cookie_kwargs = self.settings.get("xsrf_cookie_kwargs", {})
            #     self.set_cookie(
            #         self.settings.get("xsrf_cookie_name", "_streamlit_xsrf"),
            #         self.xsrf_token,
            #         **cookie_kwargs,
            #     )

        else:
            # 503 = SERVICE_UNAVAILABLE
            return PlainTextResponse(msg, status_code=503)


_DEFAULT_ALLOWED_MESSAGE_ORIGINS = [
    # Community-cloud related domains.
    # We can remove these in the future if community cloud
    # provides those domains via the host-config endpoint.
    "https://devel.streamlit.test",
    "https://*.streamlit.apptest",
    "https://*.streamlitapp.test",
    "https://*.streamlitapp.com",
    "https://share.streamlit.io",
    "https://share-demo.streamlit.io",
    "https://share-head.streamlit.io",
    "https://share-staging.streamlit.io",
    "https://*.demo.streamlit.run",
    "https://*.head.streamlit.run",
    "https://*.staging.streamlit.run",
    "https://*.streamlit.run",
    "https://*.demo.streamlit.app",
    "https://*.head.streamlit.app",
    "https://*.staging.streamlit.app",
    "https://*.streamlit.app",
]


class ASGIHostConfigHandler(HTTPEndpoint):
    async def get(self, request: Request) -> JSONResponse:
        allowed_origins = _DEFAULT_ALLOWED_MESSAGE_ORIGINS.copy()

        if (
            config.get_option("global.developmentMode")
            and "http://localhost" not in allowed_origins
        ):
            allowed_origins.append("http://localhost")

        return JSONResponse(
            {
                "allowedOrigins": allowed_origins,
                "useExternalAuthToken": False,
                # Default host configuration settings.
                "enableCustomParentMessages": False,
            }
        )


class ASGIStaticFiles(StaticFiles):
    def __init__(self, *, get_pages: Callable[[], Set[str]], **kwargs):
        super().__init__(**kwargs)
        self._get_pages = get_pages

    @property
    def pages(self) -> Set[str]:
        return self._get_pages()

    def get_path(self, scope: Scope) -> str:
        url_parts = scope["path"].split("/")
        url_parts = url_parts[1:]  # Remove the leading slash

        maybe_page_name = url_parts[0]
        if maybe_page_name in self.pages:
            if len(url_parts) == 1:
                scope["path"] = "/index.html"
            else:
                scope["path"] = "/" + "/".join(url_parts[1:])
        return super().get_path(scope)
