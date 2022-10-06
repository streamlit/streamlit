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

from unittest import mock
from unittest.mock import MagicMock

import tornado.testing
import tornado.web
from parameterized import parameterized
from typing_extensions import Final

from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.web.server.media_file_handler import MediaFileHandler

MOCK_ENDPOINT: Final = "/mock/media"


class MediaFileHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def setUp(self) -> None:
        super().setUp()
        # Create a new MediaFileManager and assign its storage to
        # MediaFileHandler.
        storage = MemoryMediaFileStorage(MOCK_ENDPOINT)
        self.media_file_manager = MediaFileManager(storage)
        MediaFileHandler.initialize_storage(storage)

    def get_app(self) -> tornado.web.Application:
        return tornado.web.Application(
            [(f"{MOCK_ENDPOINT}/(.*)", MediaFileHandler, {"path": ""})]
        )

    @mock.patch(
        "streamlit.runtime.media_file_manager._get_session_id",
        MagicMock(return_value="mock_session_id"),
    )
    def test_media_file(self) -> None:
        """Requests for media files in MediaFileManager should succeed."""
        # Add a media file and read it back
        url = self.media_file_manager.add(b"mock_data", "video/mp4", "mock_coords")
        rsp = self.fetch(url, method="GET")

        self.assertEqual(200, rsp.code)
        self.assertEqual(b"mock_data", rsp.body)
        self.assertEqual("video/mp4", rsp.headers["Content-Type"])
        self.assertEqual(str(len(b"mock_data")), rsp.headers["Content-Length"])

    @parameterized.expand(
        [
            ("MockVideo.mp4", 'attachment; filename="MockVideo.mp4"'),
            (
                b"\xe6\xbc\xa2\xe5\xad\x97.mp3".decode(),
                "attachment; filename*=utf-8''%E6%BC%A2%E5%AD%97.mp3",
            ),
        ]
    )
    @mock.patch(
        "streamlit.runtime.media_file_manager._get_session_id",
        MagicMock(return_value="mock_session_id"),
    )
    def test_downloadable_file(self, file_name, content_disposition_header) -> None:
        """Downloadable files get an additional 'Content-Disposition' header
        that includes their user-specified filename.
        """
        # Add a downloadable file with a filename
        url = self.media_file_manager.add(
            b"mock_data",
            "video/mp4",
            "mock_coords",
            file_name=file_name,
            is_for_static_download=True,
        )
        rsp = self.fetch(url, method="GET")

        self.assertEqual(200, rsp.code)
        self.assertEqual(b"mock_data", rsp.body)
        self.assertEqual("video/mp4", rsp.headers["Content-Type"])
        self.assertEqual(str(len(b"mock_data")), rsp.headers["Content-Length"])
        self.assertEqual(content_disposition_header, rsp.headers["Content-Disposition"])

    def test_invalid_file(self) -> None:
        """Requests for invalid files fail with 404."""
        url = f"{MOCK_ENDPOINT}/invalid_media_file.mp4"
        rsp = self.fetch(url, method="GET")
        self.assertEqual(404, rsp.code)
