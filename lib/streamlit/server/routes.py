# Copyright 2018-2022 Streamlit Inc.
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
from urllib.parse import quote, unquote_plus

from streamlit import config
from streamlit.logger import get_logger
from streamlit.server.server_util import serialize_forward_msg
from streamlit.string_util import generate_download_filename_from_title
from streamlit.in_memory_file_manager import _get_extension_for_mimetype
from streamlit.in_memory_file_manager import in_memory_file_manager
from streamlit.in_memory_file_manager import FILE_TYPE_DOWNLOADABLE

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
    def initialize(self, path, default_filename, get_pages):
        self._pages = get_pages()

        super().initialize(path=path, default_filename=default_filename)

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

    def parse_url_path(self, url_path: str) -> str:
        url_parts = url_path.split("/")

        maybe_page_name = url_parts[0]
        if maybe_page_name in self._pages:
            # If we're trying to navigate to a page, we return "index.html"
            # directly here instead of defering to the superclass below after
            # modifying the url_path. The reason why is that tornado handles
            # requests to "directories" (which is what navigating to a page
            # looks like) by appending a trailing '/' if there is none and
            # redirecting.
            #
            # This would work, but it
            #   * adds an unnecessary redirect+roundtrip
            #   * adds a trailing '/' to the URL appearing in the browser, which
            #     looks bad
            if len(url_parts) == 1:
                return "index.html"

            url_path = "/".join(url_parts[1:])

        return super().parse_url_path(url_path)


class AssetsFileHandler(tornado.web.StaticFileHandler):
    # CORS protection should be disabled as we need access
    # to this endpoint from the inner iframe.
    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*")


class AddSlashHandler(tornado.web.RequestHandler):
    @tornado.web.addslash
    def get(self):
        pass


class MediaFileHandler(tornado.web.StaticFileHandler):
    def set_default_headers(self):
        if allow_cross_origin_requests():
            self.set_header("Access-Control-Allow-Origin", "*")

    def set_extra_headers(self, path: str) -> None:
        """Add Content-Disposition header for downloadable files.

        Set header value to "attachment" indicating that file should be saved
        locally instead of displaying inline in browser.

        We also set filename to specify filename for  downloaded file.
        Used for serve downloadable files, like files stored
        via st.download_button widget
        """
        in_memory_file = in_memory_file_manager.get(path)

        if in_memory_file and in_memory_file.file_type == FILE_TYPE_DOWNLOADABLE:
            file_name = in_memory_file.file_name

            if not file_name:
                title = self.get_argument("title", "", True)
                title = unquote_plus(title)
                filename = generate_download_filename_from_title(title)
                file_name = (
                    f"{filename}{_get_extension_for_mimetype(in_memory_file.mimetype)}"
                )

            try:
                file_name.encode("ascii")
                file_expr = 'filename="{}"'.format(file_name)
            except UnicodeEncodeError:
                file_expr = "filename*=utf-8''{}".format(quote(file_name))

            self.set_header("Content-Disposition", f"attachment; {file_expr}")

    # Overriding StaticFileHandler to use the InMemoryFileManager
    #
    # From the Torndado docs:
    # To replace all interaction with the filesystem (e.g. to serve
    # static content from a database), override `get_content`,
    # `get_content_size`, `get_modified_time`, `get_absolute_path`, and
    # `validate_absolute_path`.
    def validate_absolute_path(self, root, absolute_path):
        try:
            in_memory_file_manager.get(absolute_path)
        except KeyError:
            LOGGER.error("InMemoryFileManager: Missing file %s" % absolute_path)
            raise tornado.web.HTTPError(404, "not found")

        return absolute_path

    def get_content_size(self):
        abspath = self.absolute_path
        if abspath is None:
            return 0

        in_memory_file = in_memory_file_manager.get(abspath)
        return in_memory_file.content_size

    def get_modified_time(self):
        # We do not track last modified time, but this can be improved to
        # allow caching among files in the InMemoryFileManager
        return None

    @classmethod
    def get_absolute_path(cls, root, path):
        # All files are stored in memory, so the absolute path is just the
        # path itself. In the MediaFileHandler, it's just the filename
        return path

    @classmethod
    def get_content(cls, abspath, start=None, end=None):
        LOGGER.debug("MediaFileHandler: GET %s" % abspath)

        try:
            # abspath is the hash as used `get_absolute_path`
            in_memory_file = in_memory_file_manager.get(abspath)
        except:
            LOGGER.error("InMemoryFileManager: Missing file %s" % abspath)
            return

        LOGGER.debug(
            "InMemoryFileManager: Sending %s file %s"
            % (in_memory_file.mimetype, abspath)
        )

        # If there is no start and end, just return the full content
        if start is None and end is None:
            return in_memory_file.content

        if start is None:
            start = 0
        if end is None:
            end = len(in_memory_file.content)

        # content is bytes that work just by slicing supplied by start and end
        return in_memory_file.content[start:end]


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
        ok, msg = await self._callback()
        if ok:
            self.write(msg)
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
            self.write(msg)


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
