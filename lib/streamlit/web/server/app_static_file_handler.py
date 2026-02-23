# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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
from typing import Final

import tornado.web

from streamlit.logger import get_logger
from streamlit.path_security import is_unsafe_path_pattern
from streamlit.web.server.component_file_utils import guess_content_type

_LOGGER: Final = get_logger(__name__)

# The maximum possible size of single serving static file.
MAX_APP_STATIC_FILE_SIZE: Final = 200 * 1024 * 1024  # 200 MB


class AppStaticFileHandler(tornado.web.StaticFileHandler):
    def initialize(self, path: str, default_filename: str | None = None) -> None:
        super().initialize(path, default_filename)

    @classmethod
    def get_absolute_path(cls, root: str, path: str) -> str:
        # SECURITY: Validate path pattern BEFORE any filesystem operations.
        # See is_unsafe_path_pattern() docstring for details.
        if is_unsafe_path_pattern(path):
            raise tornado.web.HTTPError(400, "Bad Request")
        return super().get_absolute_path(root, path)

    def validate_absolute_path(self, root: str, absolute_path: str) -> str | None:
        full_path = os.path.abspath(absolute_path)

        ret_val = super().validate_absolute_path(root, absolute_path)

        if os.path.isdir(full_path):
            # we don't want to serve directories, and serve only files
            raise tornado.web.HTTPError(404)

        if os.path.commonpath([full_path, root]) != root:
            # Don't allow misbehaving clients to break out of the static files directory
            _LOGGER.warning(
                "Serving files outside of the static directory is not supported"
            )
            raise tornado.web.HTTPError(404)

        if (
            os.path.exists(full_path)
            and os.path.getsize(full_path) > MAX_APP_STATIC_FILE_SIZE
        ):
            raise tornado.web.HTTPError(
                404,
                "File is too large, its size should not exceed "
                f"{MAX_APP_STATIC_FILE_SIZE} bytes",
                reason="File is too large",
            )

        return ret_val

    def set_default_headers(self) -> None:
        # CORS protection is disabled because we need access to this endpoint
        # from the inner iframe.
        self.set_header("Access-Control-Allow-Origin", "*")

    def set_extra_headers(self, path: str) -> None:  # noqa: ARG002
        # `path` is required by the Tornado StaticFileHandler interface but
        # is not needed here because we only set a generic security header.
        self.set_header("X-Content-Type-Options", "nosniff")

    def get_content_type(self) -> str:
        # Use guess_content_type for consistent behavior with Starlette handler.
        # absolute_path is always set by the time this method is called.
        return guess_content_type(self.absolute_path or "")
