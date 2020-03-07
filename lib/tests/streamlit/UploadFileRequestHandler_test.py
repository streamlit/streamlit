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

from streamlit.UploadedFileManager import UploadedFileManager
from streamlit.logger import get_logger
from streamlit.server.UploadFileRequestHandler import UploadFileRequestHandler

LOGGER = get_logger(__name__)


class UploadFileRequestHandlerTest(tornado.testing.AsyncHTTPTestCase):
    """Tests the /upload_file endpoint."""

    def get_app(self):
        self.file_mgr = UploadedFileManager()
        return tornado.web.Application(
            [("/upload_file", UploadFileRequestHandler, dict(file_mgr=self.file_mgr))]
        )

    def _upload_file(self, params):
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

    def test_upload(self):
        """Uploading a file should populate our file_mgr."""
        params = {
            "image.png": ("image.png", b"1234"),
            "sessionId": (None, "fooReport"),
            "widgetId": (None, "barWidget"),
        }
        response = self._upload_file(params)
        self.assertEqual(200, response.code)
        self.assertEqual(b"1234", self.file_mgr.get_file_data("fooReport", "barWidget"))

    def test_missing_params(self):
        """Missing params in the body should fail with 400 status."""
        params = {
            "image.png": ("image.png", b"1234"),
            "sessionId": (None, "fooReport"),
            # "widgetId": (None, 'barWidget'),
        }

        response = self._upload_file(params)
        self.assertEqual(400, response.code)
        self.assertIn("Missing 'widgetId'", response.reason)

    def test_missing_file(self):
        """Missing file should fail with 400 status."""
        params = {
            # "image.png": ("image.png", b"1234"),
            "sessionId": (None, "fooReport"),
            "widgetId": (None, "barWidget"),
        }
        response = self._upload_file(params)
        self.assertEqual(400, response.code)
        self.assertIn("Expected 1 file, but got 0", response.reason)
