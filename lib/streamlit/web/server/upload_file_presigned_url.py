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
import uuid

import tornado.httputil
import tornado.web

from streamlit import config
from streamlit.logger import get_logger
from streamlit.runtime.uploaded_file_manager import UploadedFileManager, UploadedFileRec
from streamlit.web.server import routes, server_util

# /_stcore/upload_file/(optional session id)/(optional widget id)
UPLOAD_FILE_PRESIGNED_URL_ROUTE = r"/_stcore/upload_urls/"
LOGGER = get_logger(__name__)


class UploadFilePresignedUrlRequestHandler(tornado.web.RequestHandler):
    """Implements the POST /upload_urls/ endpoint to get upload urls."""

    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.set_header("Access-Control-Allow-Headers", "Content-Type")
        self.set_header("Content-Type", "application/json")

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

    def post(self, **kwargs):
        """
        Receive an number of uploaded file and return a list of presigned urls and file_ids.
        """

        json_data = tornado.escape.json_decode(self.request.body)
        number_of_files = int(json_data["numberOfFiles"])
        session_id = json_data["sessionId"]
        response_body = []

        for i in range(number_of_files):
            file_id = str(uuid.uuid4())
            presigned_url = (
                f"http://localhost:8501/_stcore/upload_fileZZ/{session_id}/{file_id}"
            )
            response_body.append({"presigned_url": presigned_url})

        self.write(tornado.escape.json_encode(response_body))
        self.set_status(201)
        self.finish()
