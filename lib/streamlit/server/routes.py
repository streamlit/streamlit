# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import json

import tornado.web

from streamlit import config
from streamlit import metrics
from streamlit.logger import get_logger
from streamlit.server.server_util import serialize_forward_msg
from streamlit.media_file_manager import media_file_manager


LOGGER = get_logger(__name__)


def allow_cross_origin_requests():
    """True if cross-origin requests are allowed.

    We only allow cross-origin requests when CORS protection has been disabled
    with server.enableCORS=False or if using the Node server. When using the
    Node server, we have a dev and prod port, which count as two origins.

    """
    return not config.get_option("server.enableCORS") or config.get_option(
        "global.developmentMode"
    )


class StaticFileHandler(tornado.web.StaticFileHandler):
    def set_extra_headers(self, path):
        """Disable cache for HTML files.

        Other assets like JS and CSS are suffixed with their hash, so they can
        be cached indefinitely.
        """
        is_index_url = len(path) == 0

        if is_index_url or path.endswith(".html"):
            self.set_header("Cache-Control", "no-cache")
        else:
            self.set_header("Cache-Control", "public")


class AssetsFileHandler(tornado.web.StaticFileHandler):
    # CORS protection should be disabled as we need access
    # to this endpoint from the inner iframe.
    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*")


class AddSlashHandler(tornado.web.RequestHandler):
    @tornado.web.addslash
    def get(self):
        pass


class MediaFileHandler(tornado.web.RequestHandler):
    def set_default_headers(self):
        if allow_cross_origin_requests():
            self.set_header("Access-Control-Allow-Origin", "*")

    def get(self, filename):
        # Filename is {requested_hash}.{extension} but MediaFileManager
        # is indexed by requested_hash.
        requested_hash = filename.split(".")[0]
        LOGGER.debug("MediaFileHandler: GET %s" % filename)

        try:
            media = media_file_manager.get(requested_hash)
        except:
            LOGGER.error("MediaFileManager: Missing file %s" % requested_hash)
            self.write("%s not found" % requested_hash)
            self.set_status(404)
            return

        LOGGER.debug(
            "MediaFileManager: Sending %s file %s" % (media.mimetype, requested_hash)
        )
        self.write(media.content)
        self.set_header("Content-Type", media.mimetype)
        self.set_status(200)


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

    def get(self):
        if self._callback():
            self.write("ok")
            self.set_status(200)

            # Tornado will set the _xsrf cookie automatically for the page on
            # request for the document. However, if the server is reset and
            # server.enableXsrfProtection is updated, the browser does not reload the document.
            # Manually setting the cookie on /healthz since it is pinged when the
            # browser is disconnected from the server.
            if config.get_option("server.enableXsrfProtection"):
                self.set_cookie("_xsrf", self.xsrf_token)

        else:
            # 503 = SERVICE_UNAVAILABLE
            self.set_status(503)
            self.write("unavailable")


class MetricsHandler(_SpecialRequestHandler):
    def get(self):
        if config.get_option("global.metrics"):
            self.add_header("Cache-Control", "no-cache")
            self.set_header("Content-Type", "text/plain")
            self.write(metrics.Client.get_current().generate_latest())
        else:
            self.set_status(404)
            raise tornado.web.Finish()


class DebugHandler(_SpecialRequestHandler):
    def initialize(self, server):
        self._server = server

    def get(self):
        self.add_header("Cache-Control", "no-cache")
        self.write(
            "<code><pre>%s</pre><code>" % json.dumps(self._server.get_debug(), indent=2)
        )


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
        if msg_hash is None:
            # Hash is missing! This is a malformed request.
            LOGGER.error(
                "HTTP request for cached message is " "missing the hash attribute."
            )
            self.set_status(404)
            raise tornado.web.Finish()

        message = self._cache.get_message(msg_hash)
        if message is None:
            # Message not in our cache.
            LOGGER.error(
                "HTTP request for cached message could not be fulfilled. "
                "No such message: %s" % msg_hash
            )
            self.set_status(404)
            raise tornado.web.Finish()

        LOGGER.debug("MessageCache HIT [hash=%s]" % msg_hash)
        msg_str = serialize_forward_msg(message)
        self.set_header("Content-Type", "application/octet-stream")
        self.write(msg_str)
        self.set_status(200)

    def options(self):
        """/OPTIONS handler for preflight CORS checks."""
        self.set_status(204)
        self.finish()
