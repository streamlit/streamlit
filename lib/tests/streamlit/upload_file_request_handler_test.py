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

"""UploadFileHandler.py unit tests"""

from typing import NamedTuple

import requests
import tornado.gen
import tornado.testing
import tornado.web
import tornado.websocket

from streamlit.logger import get_logger
from streamlit.server.upload_file_request_handler import (
    UploadFileRequestHandler,
    UPLOAD_FILE_ROUTE,
)
from streamlit.uploaded_file_manager import UploadedFileManager

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
        self.file_mgr = UploadedFileManager()
        self._get_session_info = lambda x: True
        return tornado.web.Application(
            [
                (
                    UPLOAD_FILE_ROUTE,
                    UploadFileRequestHandler,
                    dict(
                        file_mgr=self.file_mgr,
                        get_session_info=self._get_session_info,
                    ),
                ),
            ]
        )

    def _upload_files(self, params):
        # We use requests.Request to construct our multipart/form-data request
        # here, because they are absurdly fiddly to compose, and Tornado
        # doesn't include a utility for building them. We then use self.fetch()
        # to actually send the request to the test server.
        req = requests.Request(
            method="POST", url=self.get_url("/upload_file"), files=params
        ).prepare()

        return self.fetch(
            "/upload_file", method=req.method, headers=req.headers, body=req.body
        )

    def test_upload_one_file(self):
        """Uploading a file should populate our file_mgr."""
        file = MockFile("filename", b"123")
        params = {
            file.name: file.data,
            "sessionId": (None, "fooReport"),
            "widgetId": (None, "barWidget"),
            "totalFiles": (None, "1"),
        }
        response = self._upload_files(params)
        self.assertEqual(200, response.code)
        self.assertEqual(
            [(file.name, file.data)],
            [
                (rec.name, rec.data)
                for rec in self.file_mgr.get_files("fooReport", "barWidget")
            ],
        )

    def test_upload_multiple_files(self):
        file_1 = MockFile("file1", b"123")
        file_2 = MockFile("file2", b"456")
        file_3 = MockFile("file3", b"789")

        params = {
            file_1.name: file_1.data,
            file_2.name: file_2.data,
            file_3.name: file_3.data,
            "sessionId": (None, "fooReport"),
            "widgetId": (None, "barWidget"),
            "totalFiles": (None, "1"),
        }
        response = self._upload_files(params)
        self.assertEqual(200, response.code)
        self.assertEqual(
            sorted([file_1, file_2, file_3]),
            sorted(
                [
                    (rec.name, rec.data)
                    for rec in self.file_mgr.get_files("fooReport", "barWidget")
                ]
            ),
        )

    def test_upload_missing_params(self):
        """Missing params in the body should fail with 400 status."""
        params = {
            "image.png": ("image.png", b"1234"),
            "sessionId": (None, "fooReport"),
            # "widgetId": (None, 'barWidget'),
            "totalFiles": (None, "1"),
        }

        response = self._upload_files(params)
        self.assertEqual(400, response.code)
        self.assertIn("Missing 'widgetId'", response.reason)

    def test_upload_missing_file(self):
        """Missing file should fail with 400 status."""
        params = {
            # "image.png": ("image.png", b"1234"),
            "sessionId": (None, "fooReport"),
            "widgetId": (None, "barWidget"),
            "totalFiles": (None, "1"),
        }
        response = self._upload_files(params)
        self.assertEqual(400, response.code)
        self.assertIn("Expected at least 1 file, but got 0", response.reason)


class UploadFileRequestHandlerInvalidSessionTest(tornado.testing.AsyncHTTPTestCase):
    """Tests the /upload_file endpoint."""

    def get_app(self):
        self.file_mgr = UploadedFileManager()
        self._get_session_info = lambda x: None
        return tornado.web.Application(
            [
                (
                    UPLOAD_FILE_ROUTE,
                    UploadFileRequestHandler,
                    dict(
                        file_mgr=self.file_mgr,
                        get_session_info=self._get_session_info,
                    ),
                ),
            ]
        )

    def _upload_files(self, params):
        # We use requests.Request to construct our multipart/form-data request
        # here, because they are absurdly fiddly to compose, and Tornado
        # doesn't include a utility for building them. We then use self.fetch()
        # to actually send the request to the test server.
        req = requests.Request(
            method="POST", url=self.get_url("/upload_file"), files=params
        ).prepare()

        return self.fetch(
            "/upload_file", method=req.method, headers=req.headers, body=req.body
        )

    def test_upload_one_file(self):
        """Uploading a file should populate our file_mgr."""
        file = MockFile("filename", b"123")
        params = {
            file.name: file.data,
            "sessionId": (None, "fooReport"),
            "widgetId": (None, "barWidget"),
            "totalFiles": (None, "1"),
        }
        response = self._upload_files(params)
        self.assertEqual(400, response.code)
        self.assertIsNone(self.file_mgr.get_files("fooReport", "barWidget"))

    def test_upload_multiple_files(self):
        file_1 = MockFile("file1", b"123")
        file_2 = MockFile("file2", b"456")
        file_3 = MockFile("file3", b"789")

        params = {
            file_1.name: file_1.data,
            file_2.name: file_2.data,
            file_3.name: file_3.data,
            "sessionId": (None, "fooReport"),
            "widgetId": (None, "barWidget"),
            "totalFiles": (None, "1"),
        }
        response = self._upload_files(params)
        self.assertEqual(400, response.code)
        self.assertIsNone(self.file_mgr.get_files("fooReport", "barWidget"))
