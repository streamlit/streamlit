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

"""Serve static assets for Custom Components v2.

This module defines a Tornado ``RequestHandler`` that serves static files for
Custom Components v2 from their registered component directories. Requests are
resolved safely within the component's root to avoid directory traversal and are
served with appropriate content type and cache headers. CORS headers are applied
based on the server configuration.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Final, cast

import tornado.web

import streamlit.web.server.routes
from streamlit.logger import get_logger
from streamlit.web.server.component_file_utils import (
    build_safe_abspath,
    guess_content_type,
)

if TYPE_CHECKING:
    from streamlit.components.v2.component_manager import BidiComponentManager

_LOGGER: Final = get_logger(__name__)


class BidiComponentRequestHandler(tornado.web.RequestHandler):
    """Request handler for serving Custom Components v2 static assets.

    The handler resolves a requested path to a registered component's asset
    within its component root, writes the file contents to the response, and
    sets appropriate ``Content-Type`` and cache headers. If the component or
    asset cannot be found, a suitable HTTP status is returned.
    """

    def initialize(self, component_manager: BidiComponentManager) -> None:
        """Initialize the handler with the given component manager.

        Parameters
        ----------
        component_manager : BidiComponentManager
            Manager used to look up registered components and their root paths.
        """
        self._component_manager = component_manager

    def get(self, path: str) -> None:
        """Serve a component asset for the given URL path.

        The first path segment is interpreted as the component name. The rest
        of the path is resolved to a file within that component's root
        directory. If the file exists and is readable, its bytes are written to
        the response and the ``Content-Type`` header is set based on the file
        type.

        Parameters
        ----------
        path : str
            Request path in the form ``"<component_name>/<relative_file>"``.

        Notes
        -----
        This method writes directly to the response and sets appropriate HTTP
        status codes on error (``404`` for missing components/files, ``403`` for
        forbidden paths).
        """
        parts = path.split("/")
        component_name = parts[0]
        component_def = self._component_manager.get(component_name)
        if component_def is None:
            self.write("not found")
            self.set_status(404)
            return

        # Get the component path from the component manager
        component_path = self._component_manager.get_component_path(component_name)
        if component_path is None:
            self.write("not found")
            self.set_status(404)
            return

        # Build a safe absolute path within the component root
        filename = "/".join(parts[1:])
        # If no file segment is provided (e.g. only component name or trailing slash),
        # treat as not found rather than attempting to open a directory.
        if not filename or filename.endswith("/"):
            self.write("not found")
            self.set_status(404)
            return
        abspath = build_safe_abspath(component_path, filename)
        if abspath is None:
            self.write("forbidden")
            self.set_status(403)
            return

        # If the resolved path is a directory, return 404 not found.
        if os.path.isdir(abspath):
            self.write("not found")
            self.set_status(404)
            return

        try:
            with open(abspath, "rb") as file:
                contents = file.read()
        except OSError:
            sanitized_abspath = abspath.replace("\n", "").replace("\r", "")
            _LOGGER.exception(
                "BidiComponentRequestHandler: GET %s read error", sanitized_abspath
            )
            self.write("read error")
            self.set_status(404)
            return

        self.write(contents)
        self.set_header("Content-Type", guess_content_type(abspath))

        self.set_extra_headers(path)

    def set_extra_headers(self, path: str) -> None:
        """Disable cache for HTML files.

        We assume other assets like JS and CSS are suffixed with their hash, so
        they can be cached indefinitely.
        """
        if path.endswith(".html"):
            self.set_header("Cache-Control", "no-cache")
        else:
            self.set_header("Cache-Control", "public")

    def set_default_headers(self) -> None:
        """Set default CORS headers based on server configuration.

        If cross-origin requests are fully allowed, ``Access-Control-Allow-
        Origin`` is set to ``"*"``. Otherwise, if the request ``Origin`` header
        is an allowed origin, the header is echoed back.
        """
        if streamlit.web.server.routes.allow_all_cross_origin_requests():
            self.set_header("Access-Control-Allow-Origin", "*")
        elif streamlit.web.server.routes.is_allowed_origin(
            origin := self.request.headers.get("Origin")
        ):
            self.set_header("Access-Control-Allow-Origin", cast("str", origin))

    def options(self) -> None:
        """Handle preflight CORS requests.

        Returns
        -------
        None
            Responds with HTTP ``204 No Content`` to indicate that the actual
            request can proceed.
        """
        self.set_status(204)
        self.finish()

    @staticmethod
    def get_url(file_id: str) -> str:
        """Return the URL for a component asset identified by ``file_id``.

        Parameters
        ----------
        file_id : str
            Component file identifier (typically a relative path or hashed
            filename).

        Returns
        -------
        str
            Relative URL path for the resource, to be joined with the server
            base URL.

        Examples
        --------
        >>> BidiComponentRequestHandler.get_url("my_component/main.js")
        '_stcore/bidi-components/my_component/main.js'
        """
        return f"_stcore/bidi-components/{file_id}"
