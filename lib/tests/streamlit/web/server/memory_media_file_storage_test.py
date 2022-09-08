# Copyright 2018-2022 Streamlit Inc.
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

"""Unit tests for MemoryMediaFileManager"""

import unittest
from unittest import mock
from unittest.mock import mock_open

from streamlit.runtime.media_file_storage import MediaFileStorageError
from streamlit.web.server.memory_media_file_storage import (
    MemoryMediaFileStorage,
    MemoryFile,
)


class MemoryMediaFileStorageTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.storage = MemoryMediaFileStorage(media_endpoint="/mock/media")

    @mock.patch(
        "streamlit.web.server.memory_media_file_storage.open",
        mock_open(read_data=b"mock_test_file"),
    )
    def test_load_with_path(self):
        """Adding a file by path should open the file and read it into memory."""
        file_id = self.storage.load_and_get_id(
            "mock/file/path.mp4", mimetype="video.mp4"
        )
        file = self.storage.get_file(file_id)
        self.assertEqual(
            MemoryFile(content=b"mock_test_file", mimetype="video.mp4", filename=None),
            file,
        )

    def test_load_with_bytes(self):
        """Adding a file with bytes should work."""
        file_id = self.storage.load_and_get_id(b"mock_test_file", mimetype="video.mp4")
        file = self.storage.get_file(file_id)
        self.assertEqual(
            MemoryFile(content=b"mock_test_file", mimetype="video.mp4", filename=None),
            file,
        )

    @mock.patch(
        "streamlit.web.server.memory_media_file_storage.open", side_effect=Exception
    )
    def test_load_with_path_raises_on_file_error(self, _):
        """Adding a file by path raises a MediaFileStorageError if the file can't be read."""
        with self.assertRaises(MediaFileStorageError):
            self.storage.load_and_get_id("mock/file/path.mp4", mimetype="video.mp4")
