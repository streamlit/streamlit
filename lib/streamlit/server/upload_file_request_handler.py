# Copyright 2018-2021 Streamlit Inc.
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

from typing import Any, Callable, Dict, List

import tornado.httputil
import tornado.web

from streamlit.uploaded_file_manager import UploadedFileRec, UploadedFileManager
from streamlit import config
from streamlit.logger import get_logger
from streamlit.report import Report
from streamlit.server import routes


# /upload_file/(optional session id)/(optional widget id)/(optional file_id)
UPLOAD_FILE_ROUTE = (
    "/upload_file/?(?P<session_id>[^/]*)?/?(?P<widget_id>[^/]*)?/?(?P<file_id>[^/]*)?"
)
LOGGER = get_logger(__name__)


class UploadFileRequestHandler(tornado.web.RequestHandler):
    """
    Implements the POST and DELETE /upload_file endpoint.
    """

    def initialize(
        self, file_mgr: UploadedFileManager, get_session_info: Callable[[str], bool]
    ):
        """
        Parameters
        ----------
        file_mgr : UploadedFileManager
            The server's singleton UploadedFileManager. All file uploads
            go here.
        get_session_info: Server.get_session_info. Used to validate session IDs
        """
        self._file_mgr = file_mgr
        self._get_session_info = get_session_info

    def _is_valid_session_id(self, session_id: str) -> bool:
        """True if the given session_id refers to an active session."""
        return self._get_session_info(session_id) is not None

    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS")
        self.set_header("Access-Control-Allow-Headers", "Content-Type")
        if config.get_option("server.enableXsrfProtection"):
            self.set_header(
                "Access-Control-Allow-Origin",
                Report.get_url(config.get_option("browser.serverAddress")),
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

    @staticmethod
    def _require_arg(args: Dict[str, List[bytes]], name: str) -> str:
        """Return the value of the argument with the given name.

        A human-readable exception will be raised if the argument doesn't
        exist. This will be used as the body for the error response returned
        from the request.
        """
        try:
            arg = args[name]
        except KeyError:
            raise Exception("Missing '%s'" % name)

        if len(arg) != 1:
            raise Exception("Expected 1 '%s' arg, but got %s" % (name, len(arg)))

        # Convert bytes to string
        return arg[0].decode("utf-8")

    def post(self, **kwargs):
        """Receive 1 or more uploaded files and add them to our
        UploadedFileManager.
        """
        args: Dict[str, List[bytes]] = {}
        files: Dict[str, List[Any]] = {}

        tornado.httputil.parse_body_arguments(
            content_type=self.request.headers["Content-Type"],
            body=self.request.body,
            arguments=args,
            files=files,
        )

        try:
            session_id = self._require_arg(args, "sessionId")
            widget_id = self._require_arg(args, "widgetId")
            if not self._is_valid_session_id(session_id):
                raise Exception(f"Invalid session_id: '{session_id}'")

        except Exception as e:
            self.send_error(400, reason=str(e))
            return

        LOGGER.debug(
            f"{len(files)} file(s) received for session {session_id} widget {widget_id}"
        )

        # Create an UploadedFile object for each file.
        uploaded_files: List[UploadedFileRec] = []
        for id, flist in files.items():
            for file in flist:
                uploaded_files.append(
                    UploadedFileRec(
                        id=id,
                        name=file["filename"],
                        type=file["content_type"],
                        data=file["body"],
                    )
                )

        if len(uploaded_files) == 0:
            self.send_error(400, reason="Expected at least 1 file, but got 0")
            return

        replace = self.get_argument("replace", "false") == "true"
        if replace:
            self._file_mgr.replace_files(
                session_id=session_id, widget_id=widget_id, files=uploaded_files
            )
        else:
            self._file_mgr.add_files(
                session_id=session_id, widget_id=widget_id, files=uploaded_files
            )

        LOGGER.debug(
            f"{len(files)} file(s) uploaded for session {session_id} widget {widget_id}. replace {replace}"
        )

        self.set_status(200)

    def delete(self, session_id, widget_id, file_id):
        """Delete the file with the given (session_id, widget_id, file_id)."""
        if (
            session_id is None
            or widget_id is None
            or file_id is None
            or not self._is_valid_session_id(session_id)
        ):
            self.send_error(404)
            return

        removed = self._file_mgr.remove_file(
            session_id=session_id,
            widget_id=widget_id,
            file_id=file_id,
        )

        if not removed:
            # If the file didn't exist, it won't be removed and we
            # return a 404
            self.send_error(404)
            return

        self.set_status(200)
