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

import os
from typing import Final, Sequence

import tornado.web

from streamlit import config, file_util
from streamlit.logger import get_logger
from streamlit.runtime.runtime_util import serialize_forward_msg
from streamlit.web.server.server_util import emit_endpoint_deprecation_notice

_LOGGER: Final = get_logger(__name__)


def allow_cross_origin_requests() -> bool:
    """True if cross-origin requests are allowed.

    We only allow cross-origin requests when CORS protection has been disabled
    with server.enableCORS=False or if using the Node server. When using the
    Node server, we have a dev and prod port, which count as two origins.

    """
    return not config.get_option("server.enableCORS") or config.get_option(
        "global.developmentMode"
    )


class StaticFileHandler(tornado.web.StaticFileHandler):
    def initialize(
        self,
        path: str,
        default_filename: str | None = None,
        reserved_paths: Sequence[str] = (),
    ):
        self._reserved_paths = reserved_paths

        super().initialize(path, default_filename)

    def set_extra_headers(self, path: str) -> None:
        """Disable cache for HTML files.

        Other assets like JS and CSS are suffixed with their hash, so they can
        be cached indefinitely.
        """
        is_index_url = len(path) == 0

        if is_index_url or path.endswith(".html"):
            self.set_header("Cache-Control", "no-cache")
        else:
            self.set_header("Cache-Control", "public")

    def validate_absolute_path(self, root: str, absolute_path: str) -> str | None:
        try:
            return super().validate_absolute_path(root, absolute_path)
        except tornado.web.HTTPError as e:
            # If the file is not found, and there are no reserved paths,
            # we try to serve the default file and allow the frontend to handle the issue.
            if e.status_code == 404:
                if any(self.path.endswith(x) for x in self._reserved_paths):
                    raise e

                self.path = self.parse_url_path(self.default_filename or "index.html")
                absolute_path = self.get_absolute_path(self.root, self.path)
                return super().validate_absolute_path(root, absolute_path)

            raise e

    def write_error(self, status_code: int, **kwargs) -> None:
        if status_code == 404:
            index_file = os.path.join(file_util.get_static_dir(), "index.html")
            self.render(index_file)
        else:
            super().write_error(status_code, **kwargs)


class AddSlashHandler(tornado.web.RequestHandler):
    @tornado.web.addslash
    def get(self):
        pass


class _SpecialRequestHandler(tornado.web.RequestHandler):
    """Superclass for "special" endpoints, like /healthz."""

    def set_default_headers(self):
        self.set_header("Cache-Control", "no-cache")
        if allow_cross_origin_requests():
            self.set_header("Access-Control-Allow-Origin", "*")

    def options(self):
        """/OPTIONS handler for preflight CORS checks.

        When a browser is making a CORS request, it may sometimes first
        send an OPTIONS request, to check whether the server understands the
        CORS protocol. This is optional, and doesn't happen for every request
        or in every browser. If an OPTIONS request does get sent, and is not
        then handled by the server, the browser will fail the underlying
        request.

        The proper way to handle this is to send a 204 response ("no content")
        with the CORS headers attached. (These headers are automatically added
        to every outgoing response, including OPTIONS responses,
        via set_default_headers().)

        See https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request
        """
        self.set_status(204)
        self.finish()


class HealthHandler(_SpecialRequestHandler):
    def initialize(self, callback):
        """Initialize the handler

        Parameters
        ----------
        callback : callable
            A function that returns True if the server is healthy

        """
        self._callback = callback

    async def get(self):
        await self.handle_request()

    # Some monitoring services only support the HTTP HEAD method for requests to
    # healthcheck endpoints, so we support HEAD as well to play nicely with them.
    async def head(self):
        await self.handle_request()

    async def handle_request(self):
        if self.request.uri and "_stcore/" not in self.request.uri:
            new_path = (
                "/_stcore/script-health-check"
                if "script-health-check" in self.request.uri
                else "/_stcore/health"
            )
            emit_endpoint_deprecation_notice(self, new_path=new_path)

        ok, msg = await self._callback()
        if ok:
            self.write(msg)
            self.set_status(200)

            # Tornado will set the _streamlit_xsrf cookie automatically for the page on
            # request for the document. However, if the server is reset and
            # server.enableXsrfProtection is updated, the browser does not reload the document.
            # Manually setting the cookie on /healthz since it is pinged when the
            # browser is disconnected from the server.
            if config.get_option("server.enableXsrfProtection"):
                cookie_kwargs = self.settings.get("xsrf_cookie_kwargs", {})
                self.set_cookie(
                    self.settings.get("xsrf_cookie_name", "_streamlit_xsrf"),
                    self.xsrf_token,
                    **cookie_kwargs,
                )

        else:
            # 503 = SERVICE_UNAVAILABLE
            self.set_status(503)
            self.write(msg)


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


class HostConfigHandler(_SpecialRequestHandler):
    def initialize(self):
        # Make a copy of the allowedOrigins list, since we might modify it later:
        self._allowed_origins = _DEFAULT_ALLOWED_MESSAGE_ORIGINS.copy()

        if (
            config.get_option("global.developmentMode")
            and "http://localhost" not in self._allowed_origins
        ):
            # Allow messages from localhost in dev mode for testing of host <-> guest communication
            self._allowed_origins.append("http://localhost")

    async def get(self) -> None:
        self.write(
            {
                "allowedOrigins": self._allowed_origins,
                "useExternalAuthToken": False,
                # Default host configuration settings.
                "enableCustomParentMessages": False,
                "enforceDownloadInNewTab": False,
            }
        )
        self.set_status(200)


class MessageCacheHandler(tornado.web.RequestHandler):
    """Returns ForwardMsgs from our MessageCache"""

    def initialize(self, cache):
        """Initializes the handler.

        Parameters
        ----------
        cache : MessageCache

        """
        self._cache = cache

    def set_default_headers(self):
        if allow_cross_origin_requests():
            self.set_header("Access-Control-Allow-Origin", "*")

    def get(self):
        msg_hash = self.get_argument("hash", None)
        if not config.get_option("global.storeCachedForwardMessagesInMemory"):
            # We use rare status code here, to distinguish between normal 404s.
            self.set_status(418)
            self.finish()
            return
        if msg_hash is None:
            # Hash is missing! This is a malformed request.
            _LOGGER.error(
                "HTTP request for cached message is missing the hash attribute."
            )
            self.set_status(404)
            raise tornado.web.Finish()

        message = self._cache.get_message(msg_hash)
        if message is None:
            # Message not in our cache.
            _LOGGER.error(
                "HTTP request for cached message could not be fulfilled. "
                "No such message"
            )
            self.set_status(404)
            raise tornado.web.Finish()

        _LOGGER.debug("MessageCache HIT")
        msg_str = serialize_forward_msg(message)
        self.set_header("Content-Type", "application/octet-stream")
        self.write(msg_str)
        self.set_status(200)

    def options(self):
        """/OPTIONS handler for preflight CORS checks."""
        self.set_status(204)
        self.finish()
