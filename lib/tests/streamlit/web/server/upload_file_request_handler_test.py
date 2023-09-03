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

"""UploadFileHandler.py unit tests"""

from typing import NamedTuple

import requests
import tornado.testing
import tornado.web
import tornado.websocket

from streamlit.logger import get_logger
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.uploaded_file_manager import UploadedFileManager
from streamlit.web.server.server import UPLOAD_FILE_ENDPOINT
from streamlit.web.server.upload_file_request_handler import UploadFileRequestHandler

LOGGER = get_logger(__name__)


class MockFile(NamedTuple):
    name: str
    data: bytes


def _get_filename(file):
    """Sort key for lists of UploadedFiles"""
    return file.name


class UploadFileRequestHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Tests the /upload_file endpoint."""

    def get_app(self):
        self.file_mgr = MemoryUploadedFileManager(upload_endpoint=UPLOAD_FILE_ENDPOINT)
        return tornado.web.Application(
            [
                (
                    f"{UPLOAD_FILE_ENDPOINT}/(?P<session_id>[^/]+)/(?P<file_id>[^/]+)",
                    UploadFileRequestHandler,
                    dict(
                        file_mgr=self.file_mgr,
                        is_active_session=lambda session_id: True,
                    ),
                ),
            ]
        )

    def _upload_files(self, files_body, session_id, file_id):
        # We use requests.Request to construct our multipart/form-data request
        # here, because they are absurdly fiddly to compose, and Tornado
        # doesn't include a utility for building them. We then use self.fetch()
        # to actually send the request to the test server.
        req = requests.Request(
            method="PUT",
            url=self.get_url(f"{UPLOAD_FILE_ENDPOINT}/{session_id}/{file_id}"),
            files=files_body,
        ).prepare()

        return self.fetch(
            req.url,
            method=req.method,
            headers=req.headers,
            body=req.body,
        )

    def test_upload_one_file(self):
        """Uploading a file should populate our file_mgr."""
        file = MockFile("filename", b"123")
        params = {file.name: file.data}
        response = self._upload_files(
            params, session_id="test_session_id", file_id=file.name
        )

        self.assertEqual(204, response.code, response.reason)

        self.assertEqual(
            [(file.name, file.name, file.data)],
            [
                (rec.file_id, rec.name, rec.data)
                for rec in self.file_mgr.get_files("test_session_id", [file.name])
            ],
        )

    def test_upload_multiple_files_error(self):
        """Uploading multiple files will error"""
        file_1 = MockFile("file1", b"123")
        file_2 = MockFile("file2", b"456")

        files_body = {
            file_1.name: file_1.data,
            file_2.name: file_2.data,
        }
        response = self._upload_files(
            files_body, session_id="some-session-id", file_id="some-file-id"
        )
        self.assertEqual(400, response.code)
        self.assertIn("Expected 1 file, but got 2", response.reason)

    def test_upload_missing_session_id_error(self):
        """Missing session_id in the path should fail with 404 status."""
        file_body = {
            "image.png": ("image.png", b"1234"),
        }

        response = self._upload_files(file_body, session_id="", file_id="file_id")
        self.assertEqual(404, response.code)
        self.assertIn("Not Found", response.reason)

    def test_upload_missing_file_id_error(self):
        """Missing file_id in the path should fail with 404 status."""
        file_body = {
            "image.png": ("image.png", b"1234"),
        }

        response = self._upload_files(file_body, session_id="session_id", file_id="")
        self.assertEqual(404, response.code)
        self.assertIn("Not Found", response.reason)

    def test_upload_missing_file_error(self):
        """Missing file should fail with 400 status."""
        file_body = {
            "file1": (None, b"123"),
        }
        response = self._upload_files(
            file_body, session_id="sessionId", file_id="fileId"
        )

        self.assertEqual(400, response.code)
        self.assertIn("Expected 1 file, but got 0", response.reason)


class UploadFileRequestHandlerInvalidSessionTest(tornado.testing.AsyncHTTPTestCase):
    """Tests the /upload_file endpoint."""

    def get_app(self):
        self.file_mgr = MemoryUploadedFileManager(upload_endpoint=UPLOAD_FILE_ENDPOINT)
        return tornado.web.Application(
            [
                (
                    f"{UPLOAD_FILE_ENDPOINT}/(?P<session_id>[^/]+)/(?P<file_id>[^/]+)",
                    UploadFileRequestHandler,
                    dict(
                        file_mgr=self.file_mgr,
                        is_active_session=lambda session_id: False,
                    ),
                ),
            ]
        )

    def _upload_files(self, files_body, session_id, file_id):
        # We use requests.Request to construct our multipart/form-data request
        # here, because they are absurdly fiddly to compose, and Tornado
        # doesn't include a utility for building them. We then use self.fetch()
        # to actually send the request to the test server.
        req = requests.Request(
            method="PUT",
            url=self.get_url(f"{UPLOAD_FILE_ENDPOINT}/{session_id}/{file_id}"),
            files=files_body,
        ).prepare()

        return self.fetch(
            req.url,
            method=req.method,
            headers=req.headers,
            body=req.body,
        )

    def test_upload_one_file(self):
        """Upload should fail if the sessionId doesn't exist."""
        file = MockFile("filename", b"123")
        params = {file.name: file.data}
        response = self._upload_files(params, session_id="sessionId", file_id="fileId")
        self.assertEqual(400, response.code)
        self.assertIn("Invalid session_id", response.reason)
        self.assertEqual(self.file_mgr.get_files("sessionId", ["fileId"]), [])
