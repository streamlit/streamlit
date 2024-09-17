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

from typing import Final

import tornado.httputil as httputil
import tornado.iostream as iostream
import tornado.web

from streamlit import config
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

    async def get(self, path, include_body=True) -> None:
        # Set up our path instance variables.
        self.path = self.parse_url_path(path)
        del path  # make sure we don't refer to path instead of self.path again
        absolute_path = self.get_absolute_path(self.root, self.path)

        ################## BEGIN OVERRIDDEN SECTION OF TORNADO CODE ##################
        try:
            self.absolute_path = self.validate_absolute_path(self.root, absolute_path)
        except tornado.web.HTTPError as e:
            # If the file is not found, and it's clear we are not searching for a file
            # (by checking if there's an extension) try to serve index.html instead.
            if e.status_code == 404 and "." not in self.path:
                self.path = self.parse_url_path(self.default_filename or "")
                absolute_path = self.get_absolute_path(self.root, self.path)
                self.absolute_path = self.validate_absolute_path(
                    self.root, absolute_path
                )
            else:
                raise
        ################## END OVERRIDDEN SECTION OF TORNADO CODE ##################

        if self.absolute_path is None:
            return

        self.modified = self.get_modified_time()
        self.set_headers()

        if self.should_return_304():
            self.set_status(304)
            return

        request_range = None
        range_header = self.request.headers.get("Range")
        if range_header:
            # As per RFC 2616 14.16, if an invalid Range header is specified,
            # the request will be treated as if the header didn't exist.
            request_range = httputil._parse_request_range(range_header)

        size = self.get_content_size()
        if request_range:
            start, end = request_range
            if start is not None and start < 0:
                start += size
                if start < 0:
                    start = 0
            if (
                start is not None
                and (start >= size or (end is not None and start >= end))
            ) or end == 0:
                # As per RFC 2616 14.35.1, a range is not satisfiable only: if
                # the first requested byte is equal to or greater than the
                # content, or when a suffix with length 0 is specified.
                # https://tools.ietf.org/html/rfc7233#section-2.1
                # A byte-range-spec is invalid if the last-byte-pos value is present
                # and less than the first-byte-pos.
                self.set_status(416)  # Range Not Satisfiable
                self.set_header("Content-Type", "text/plain")
                self.set_header("Content-Range", "bytes */%s" % (size,))
                return
            if end is not None and end > size:
                # Clients sometimes blindly use a large range to limit their
                # download size; cap the endpoint at the actual file size.
                end = size
            # Note: only return HTTP 206 if less than the entire range has been
            # requested. Not only is this semantically correct, but Chrome
            # refuses to play audio if it gets an HTTP 206 in response to
            # ``Range: bytes=0-``.
            if size != (end or size) - (start or 0):
                self.set_status(206)  # Partial Content
                self.set_header(
                    "Content-Range", httputil._get_content_range(start, end, size)
                )
        else:
            start = end = None

        if start is not None and end is not None:
            content_length = end - start
        elif end is not None:
            content_length = end
        elif start is not None:
            content_length = size - start
        else:
            content_length = size

        ################## BEGIN OVERRIDDEN SECTION OF TORNADO CODE ##################

        if (
            include_body
            and self.default_filename
            and self.absolute_path.endswith(self.default_filename)
        ):
            self.render_index_template()
        else:
            self.set_header("Content-Length", content_length)
            if include_body:
                content = self.get_content(self.absolute_path, start, end)
                if isinstance(content, bytes):  # type:ignore[unreachable]
                    content = [content]  # type:ignore[unreachable]
                for chunk in content:
                    try:
                        self.write(chunk)
                        await self.flush()
                    except iostream.StreamClosedError:
                        return
            else:
                assert self.request.method == "HEAD"
        ################## END OVERRIDDEN SECTION OF TORNADO CODE ##################

    def render_index_template(self):
        """This method renders the Tornado template when static file is not found or the request is for index.html."""
        base_path = config.get_option("server.baseUrlPath").strip("/")
        if base_path:
            base_path = f"/{base_path}/"
        else:
            base_path = "/"
        self.render("index.html", ROOT_PATH=base_path)


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
