# Copyright 2018-2020 Streamlit Inc.
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

import requests
import tornado.gen
import tornado.testing
import tornado.web
import tornado.websocket

from parameterized import parameterized

from streamlit.uploaded_file_manager import UploadedFile
from streamlit.uploaded_file_manager import UploadedFileManager
from streamlit.logger import get_logger
from streamlit.server.upload_file_request_handler import UploadFileRequestHandler

LOGGER = get_logger(__name__)


def _get_filename(file):
    """Sort key for lists of UploadedFiles"""
    return file.name


class UploadFileRequestHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Tests the /upload_file endpoint."""

    def get_app(self):
        self.file_mgr = UploadedFileManager()
        return tornado.web.Application(
            [
                (
                    "/upload_file/(.*)/(.*)/([0-9]*)?",
                    UploadFileRequestHandler,
                    dict(file_mgr=self.file_mgr),
                ),
                (
                    "/upload_file",
                    UploadFileRequestHandler,
                    dict(file_mgr=self.file_mgr),
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
        file = UploadedFile("id", "image.png", "type", b"123")
        params = {
            file.name: file,
            "sessionId": (None, "fooReport"),
            "widgetId": (None, "barWidget"),
            "totalFiles": (None, "1"),
        }
        response = self._upload_files(params)
        self.assertEqual(200, response.code)
        self.assertEqual(
            [file.getvalue()],
            [
                file.getvalue()
                for file in self.file_mgr.get_files("fooReport", "barWidget")
            ],
        )

    def test_upload_multiple_files(self):
        file1 = UploadedFile("id1", "image1.png", "type", b"123")
        file2 = UploadedFile("id2", "image2.png", "type", b"456")
        file3 = UploadedFile("id3", "image3.png", "type", b"789")

        params = {
            file1.name: file1,
            file2.name: file2,
            file3.name: file3,
            "sessionId": (None, "fooReport"),
            "widgetId": (None, "barWidget"),
            "totalFiles": (None, "1"),
        }
        response = self._upload_files(params)
        self.assertEqual(200, response.code)
        self.assertEqual(
            sorted([file1.name, file2.name, file3.name]),
            sorted(
                [
                    file.name
                    for file in self.file_mgr.get_files("fooReport", "barWidget")
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

    def test_delete_file(self):
        """File should be able to be deleted successfully"""
        file1 = UploadedFile("1234", "name", "type", b"1234")
        file2 = UploadedFile("4567", "name", "type", b"1234")

        self.file_mgr.add_files("session1", "widget1", [file1])
        self.file_mgr.add_files("session2", "widget2", [file2])

        response = self.fetch(f"/upload_file/session1/widget1/1234", method="DELETE")
        self.assertEqual(200, response.code)
        self.assertFalse(len(self.file_mgr.get_files("session1", "widget1")))
        self.assertTrue(len(self.file_mgr.get_files("session2", "widget2")))

    def test_delete_file_across_sessions(self):
        """Deleting file param mismatch should fail with 404 status."""
        file1 = UploadedFile("1234", "name", "type", b"1234")
        file2 = UploadedFile("4567", "name", "type", b"1234")

        self.file_mgr.add_files("session1", "widget1", [file1])
        self.file_mgr.add_files("session2", "widget2", [file2])

        response = self.fetch(f"/upload_file/session2/widget1/1234", method="DELETE")
        self.assertEqual(404, response.code)
        self.assertTrue(len(self.file_mgr.get_files("session1", "widget1")))
        self.assertTrue(len(self.file_mgr.get_files("session2", "widget2")))

    @parameterized.expand(
        [
            (None, "widget_id", "123"),
            ("session_id", None, "123"),
            ("session_id", "widget_id", None),
        ]
    )
    def test_delete_missing_param(self, session_id, widget_id, file_id):
        """Missing param should fail with 404 status."""
        response = self.fetch(
            f"/upload_file/{session_id}/{widget_id}/{file_id}", method="DELETE"
        )

        self.assertEqual(404, response.code)
