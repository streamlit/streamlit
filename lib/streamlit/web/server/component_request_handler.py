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

import mimetypes
import os
from typing import TYPE_CHECKING, Final

import tornado.web

import streamlit.web.server.routes
from streamlit.logger import get_logger

if TYPE_CHECKING:
    from streamlit.components.types.base_component_registry import BaseComponentRegistry

_LOGGER: Final = get_logger(__name__)


class ComponentRequestHandler(tornado.web.RequestHandler):
    def initialize(self, registry: BaseComponentRegistry):
        self._registry = registry

        # This ensures that common mime-types are robust against
        # system misconfiguration.
        mimetypes.add_type("text/html", ".html")
        mimetypes.add_type("application/javascript", ".js")
        mimetypes.add_type("text/css", ".css")

    def get(self, path: str) -> None:
        parts = path.split("/")
        component_name = parts[0]
        component_root = self._registry.get_component_path(component_name)
        if component_root is None:
            self.write("not found")
            self.set_status(404)
            return

        # follow symlinks to get an accurate normalized path
        component_root = os.path.realpath(component_root)
        filename = "/".join(parts[1:])
        abspath = os.path.normpath(os.path.join(component_root, filename))

        # Do NOT expose anything outside of the component root.
        if os.path.commonpath([component_root, abspath]) != component_root:
            self.write("forbidden")
            self.set_status(403)
            return
        try:
            with open(abspath, "rb") as file:
                contents = file.read()
        except OSError as e:
            _LOGGER.error(
                "ComponentRequestHandler: GET %s read error", abspath, exc_info=e
            )
            self.write("read error")
            self.set_status(404)
            return

        self.write(contents)
        self.set_header("Content-Type", self.get_content_type(abspath))

        self.set_extra_headers(path)

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

    def set_default_headers(self) -> None:
        if streamlit.web.server.routes.allow_cross_origin_requests():
            self.set_header("Access-Control-Allow-Origin", "*")

    def options(self) -> None:
        """/OPTIONS handler for preflight CORS checks."""
        self.set_status(204)
        self.finish()

    @staticmethod
    def get_content_type(abspath: str) -> str:
        """Returns the ``Content-Type`` header to be used for this request.
        From tornado.web.StaticFileHandler.
        """
        mime_type, encoding = mimetypes.guess_type(abspath)
        # per RFC 6713, use the appropriate type for a gzip compressed file
        if encoding == "gzip":
            return "application/gzip"
        # As of 2015-07-21 there is no bzip2 encoding defined at
        # http://www.iana.org/assignments/media-types/media-types.xhtml
        # So for that (and any other encoding), use octet-stream.
        elif encoding is not None:
            return "application/octet-stream"
        elif mime_type is not None:
            return mime_type
        # if mime_type not detected, use application/octet-stream
        else:
            return "application/octet-stream"

    @staticmethod
    def get_url(file_id: str) -> str:
        """Return the URL for a component file with the given ID."""
        return f"components/{file_id}"
