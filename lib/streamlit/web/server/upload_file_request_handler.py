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

from typing import TYPE_CHECKING, Any, Callable

import tornado.httputil
import tornado.web

from streamlit import config
from streamlit.runtime.uploaded_file_manager import UploadedFileRec
from streamlit.web.server import routes, server_util
from streamlit.web.server.server_util import is_xsrf_enabled

if TYPE_CHECKING:
    from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager


class UploadFileRequestHandler(tornado.web.RequestHandler):
    """Implements the POST /upload_file endpoint."""

    def initialize(
        self,
        file_mgr: MemoryUploadedFileManager,
        is_active_session: Callable[[str], bool],
    ):
        """
        Parameters
        ----------
        file_mgr : UploadedFileManager
            The server's singleton UploadedFileManager. All file uploads
            go here.
        is_active_session:
            A function that returns true if a session_id belongs to an active
            session.
        """
        self._file_mgr = file_mgr
        self._is_active_session = is_active_session

    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Methods", "PUT, OPTIONS, DELETE")
        self.set_header("Access-Control-Allow-Headers", "Content-Type")
        if is_xsrf_enabled():
            self.set_header(
                "Access-Control-Allow-Origin",
                server_util.get_url(config.get_option("browser.serverAddress")),
            )
            self.set_header("Access-Control-Allow-Headers", "X-Xsrftoken, Content-Type")
            self.set_header("Vary", "Origin")
            self.set_header("Access-Control-Allow-Credentials", "true")
        elif routes.allow_cross_origin_requests():
            self.set_header("Access-Control-Allow-Origin", "*")

    def options(self, **kwargs):
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

    def put(self, **kwargs):
        """Receive an uploaded file and add it to our UploadedFileManager."""

        args: dict[str, list[bytes]] = {}
        files: dict[str, list[Any]] = {}

        session_id = self.path_kwargs["session_id"]
        file_id = self.path_kwargs["file_id"]

        tornado.httputil.parse_body_arguments(
            content_type=self.request.headers["Content-Type"],
            body=self.request.body,
            arguments=args,
            files=files,
        )

        try:
            if not self._is_active_session(session_id):
                raise Exception("Invalid session_id")
        except Exception as e:
            self.send_error(400, reason=str(e))
            return

        uploaded_files: list[UploadedFileRec] = []

        for _, flist in files.items():
            for file in flist:
                uploaded_files.append(
                    UploadedFileRec(
                        file_id=file_id,
                        name=file["filename"],
                        type=file["content_type"],
                        data=file["body"],
                    )
                )

        if len(uploaded_files) != 1:
            self.send_error(
                400, reason=f"Expected 1 file, but got {len(uploaded_files)}"
            )
            return

        self._file_mgr.add_file(session_id=session_id, file=uploaded_files[0])
        self.set_status(204)

    def delete(self, **kwargs):
        """Delete file request handler."""
        session_id = self.path_kwargs["session_id"]
        file_id = self.path_kwargs["file_id"]

        self._file_mgr.remove_file(session_id=session_id, file_id=file_id)
        self.set_status(204)
