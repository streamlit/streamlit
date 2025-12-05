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

from __future__ import annotations

from typing import TYPE_CHECKING, Final, cast

import tornado.web

import streamlit.web.server.routes
from streamlit.logger import get_logger
from streamlit.web.server.component_file_utils import (
    build_safe_abspath,
    guess_content_type,
)

if TYPE_CHECKING:
    from streamlit.components.types.base_component_registry import BaseComponentRegistry

_LOGGER: Final = get_logger(__name__)


class ComponentRequestHandler(tornado.web.RequestHandler):
    def initialize(self, registry: BaseComponentRegistry) -> None:
        self._registry = registry

    def get(self, path: str) -> None:
        parts = path.split("/")
        component_name = parts[0]
        component_root = self._registry.get_component_path(component_name)
        if component_root is None:
            self.write("not found")
            self.set_status(404)
            return

        # Build a safe absolute path within the component root
        filename = "/".join(parts[1:])
        abspath = build_safe_abspath(component_root, filename)
        if abspath is None:
            self.write("forbidden")
            self.set_status(403)
            return
        try:
            with open(abspath, "rb") as file:
                contents = file.read()
        except OSError:
            sanitized_abspath = abspath.replace("\n", "").replace("\r", "")
            _LOGGER.exception(
                "ComponentRequestHandler: GET %s read error", sanitized_abspath
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
        if streamlit.web.server.routes.allow_all_cross_origin_requests():
            self.set_header("Access-Control-Allow-Origin", "*")
        elif streamlit.web.server.routes.is_allowed_origin(
            origin := self.request.headers.get("Origin")
        ):
            self.set_header("Access-Control-Allow-Origin", cast("str", origin))

    def options(self) -> None:
        """/OPTIONS handler for preflight CORS checks."""
        self.set_status(204)
        self.finish()

    @staticmethod
    def get_content_type(abspath: str) -> str:
        """Returns the ``Content-Type`` header to be used for this request.
        From tornado.web.StaticFileHandler.
        """
        return guess_content_type(abspath)

    @staticmethod
    def get_url(file_id: str) -> str:
        """Return the URL for a component file with the given ID."""
        return f"components/{file_id}"
