# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import os
from urllib.parse import urljoin

import tornado.web
from PIL import Image, UnidentifiedImageError

from streamlit import config, file_util
from streamlit.logger import get_logger
from streamlit.runtime.runtime_util import serialize_forward_msg
from streamlit.web.server.server_util import emit_endpoint_deprecation_notice

_LOGGER = get_logger(__name__)


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
            # directly here instead of deferring to the superclass below after
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


# NOTE: We eventually want to get rid of this hard-coded list entirely as we don't want
# to have links to Community Cloud live in the open source library in a way that affects
# functionality (links advertising Community Cloud are probably okay 🙂). In the long
# run, this list will most likely be replaced by a config option allowing us to more
# granularly control what domains a Streamlit app should accept cross-origin iframe
# messages from.
ALLOWED_MESSAGE_ORIGINS = [
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


class AllowedMessageOriginsHandler(_SpecialRequestHandler):
    def initialize(self):
        self.allowed_message_origins = [*ALLOWED_MESSAGE_ORIGINS]
        if config.get_option("global.developmentMode"):
            # Allow messages from localhost in dev mode for testing of host <-> guest communication
            self.allowed_message_origins.append("http://localhost")

    async def get(self) -> None:
        # ALLOWED_MESSAGE_ORIGINS must be wrapped in a dictionary because Tornado
        # disallows writing lists directly into responses due to potential XSS
        # vulnerabilities.
        # See https://www.tornadoweb.org/en/stable/web.html#tornado.web.RequestHandler.write
        self.write(
            {
                "allowedOrigins": self.allowed_message_origins,
                "useExternalAuthToken": False,
            }
        )
        self.set_status(200)


class MetadataWebManifestHandler(_SpecialRequestHandler):
    VALID_ICON_TYPES = {
        "PNG": "image/png",
        "GIF": "image/gif",
        "JPG": "image/jpeg",
        "JPEG": "image/jpeg",
        "WEBP": "image/webp",
        "SVG": "image/svg+xml",
    }

    VALID_ICON_SIZES = [
        70,  # 70x70 pixels for Windows 8.1 and Windows 10 tiles with small icons
        120,  # 120x120 pixels for Windows 8.1 and Windows 10 tiles
        152,  # 152x152 pixels for Windows 8.1 and Windows 10 tiles
        180,  # 180x180 pixels for Apple touch icons on iOS devices
        192,  # 192x192 pixels for Android devices
        310,  # 310x310 pixels for Windows 8.1 and Windows 10 tiles with large icons
        512,  # 512x512 pixels for Android devices with high-resolution displays
    ]

    def initialize(self, path: str, base: str):
        self.main_script_path = path
        self.base_url = base

    async def get(self) -> None:
        icon_mime_type = "image/png"
        icon_metadata = {
            "src": "/logo512.png",
            "sizes": "512x512",
            "type": icon_mime_type,
        }
        icon_relative_filepath = config.get_option("metadata.icon")

        if icon_relative_filepath is not None:
            if not config.get_option("server.enableStaticServing"):
                _LOGGER.error(
                    "Static file serving is not enabled. To serve a custom Streamlit application icon, make sure you set the `enableStaticServing` config option. "
                    + "Please refer to the online documentation for more information: https://docs.streamlit.io/library/advanced-features/static-file-serving."
                )

                self.write("Static file serving is not enabled.")
                self.set_status(500)

                raise tornado.web.Finish()

            static_folder = file_util.get_app_static_dir(self.main_script_path)
            icon_filepath = os.path.normpath(
                os.path.join(static_folder, icon_relative_filepath)
            )

            if not os.path.isfile(icon_filepath):
                _LOGGER.error(
                    f"The custom icon file not found at path: `{icon_filepath}`. Make sure you put icon file relatively to the static content folder: `./static/`."
                )

                self.write("The custom icon file not found.")
                self.set_status(500)

                raise tornado.web.Finish()

            try:
                with Image.open(
                    icon_filepath, "r", list(self.VALID_ICON_TYPES.keys())
                ) as icon:
                    if icon.format is None:
                        _LOGGER.error(
                            "The custom icon file format is undefined. Choose another icon file."
                        )

                        self.write("The custom icon file format is undefined.")
                        self.set_status(500)

                        raise tornado.web.Finish()

                    icon_mime_type = self.VALID_ICON_TYPES.get(icon.format)
                    icon_size = icon.size
            except UnidentifiedImageError:
                _LOGGER.error(
                    "The custom icon file is corrupted or has an unidentified extension. Choose another icon file."
                )

                self.write(
                    "The custom icon file is corrupted or has an unidentified extension."
                )
                self.set_status(500)

                raise tornado.web.Finish()
            except KeyError as ke:
                invalid_extension = "`*." + str(ke).strip("'").lower() + "`"
                valid_extensions = ", ".join(
                    [
                        "`*." + str(_type).strip("'").lower() + "`"
                        for _type in self.VALID_ICON_TYPES.keys()
                    ]
                )
                _LOGGER.error(
                    f"Invalid icon extension: {invalid_extension}. Valid extensions are: [{valid_extensions}]."
                )

                self.write("The custom icon has invalid extension.")
                self.set_status(500)

                raise tornado.web.Finish()

            icon_width, icon_height = icon_size

            if (
                icon_width not in self.VALID_ICON_SIZES
                or icon_height not in self.VALID_ICON_SIZES
            ):
                valid_sizes = ", ".join(
                    [f"`{size}x{size}`" for size in self.VALID_ICON_SIZES]
                )
                _LOGGER.error(
                    f"Invalid icon size: {icon_width}x{icon_height}. Valid sizes are: [{valid_sizes}]."
                )

                self.write("Custom icon has invalid size.")
                self.set_status(500)

                raise tornado.web.Finish()

            static_file_url = urljoin(self.base_url, "/app/static/")
            icon_metadata = {
                "src": urljoin(static_file_url, icon_relative_filepath),
                "sizes": f"{icon_width}x{icon_height}",
                "type": icon_mime_type,
            }

        manifest = {
            "$schema": "https://json.schemastore.org/web-manifest-combined.json",
            "name": config.get_option("metadata.name"),
            "short_name": config.get_option("metadata.shortName"),
            "description": config.get_option("metadata.description"),
            "start_url": config.get_option("metadata.startUrl"),
            "display": config.get_option("metadata.display"),
            "theme_color": config.get_option("metadata.themeColor"),
            "background_color": config.get_option("metadata.backgroundColor"),
            "serviceworker": {"src": "./sw.js", "scope": "/"},
            "icons": [icon_metadata],
        }

        self.set_header("Content-Type", "application/manifest+json")
        self.set_header("Cache-Control", "max-age=0, must-revalidate")

        self.write(json.dumps(manifest))
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
