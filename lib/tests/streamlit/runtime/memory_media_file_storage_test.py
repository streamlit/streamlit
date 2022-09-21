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

"""Unit tests for MemoryMediaFileStorage"""

import unittest
from unittest import mock
from unittest.mock import mock_open

from parameterized import parameterized

from streamlit.runtime.media_file_storage import MediaFileStorageError, MediaFileKind
from streamlit.runtime.memory_media_file_storage import (
    MemoryMediaFileStorage,
    MemoryFile,
)


class MemoryMediaFileStorageTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.storage = MemoryMediaFileStorage(media_endpoint="/mock/media")

    @mock.patch(
        "streamlit.runtime.memory_media_file_storage.open",
        mock_open(read_data=b"mock_bytes"),
    )
    def test_load_with_path(self):
        """Adding a file by path creates a MemoryFile instance."""
        file_id = self.storage.load_and_get_id(
            "mock/file/path",
            mimetype="video/mp4",
            kind=MediaFileKind.MEDIA,
            filename="file.mp4",
        )
        self.assertEqual(
            MemoryFile(
                content=b"mock_bytes",
                mimetype="video/mp4",
                kind=MediaFileKind.MEDIA,
                filename="file.mp4",
            ),
            self.storage.get_file(file_id),
        )

    def test_load_with_bytes(self):
        """Adding a file with bytes creates a MemoryFile instance."""
        file_id = self.storage.load_and_get_id(
            b"mock_bytes",
            mimetype="video/mp4",
            kind=MediaFileKind.MEDIA,
            filename="file.mp4",
        )
        self.assertEqual(
            MemoryFile(
                content=b"mock_bytes",
                mimetype="video/mp4",
                kind=MediaFileKind.MEDIA,
                filename="file.mp4",
            ),
            self.storage.get_file(file_id),
        )

    def test_identical_files_have_same_id(self):
        """Two files with the same content, mimetype, and filename should share an ID."""
        # Create 2 identical files. We'll just get one ID.
        file_id1 = self.storage.load_and_get_id(
            b"mock_bytes",
            mimetype="video/mp4",
            kind=MediaFileKind.MEDIA,
            filename="file.mp4",
        )
        file_id2 = self.storage.load_and_get_id(
            b"mock_bytes",
            mimetype="video/mp4",
            kind=MediaFileKind.MEDIA,
            filename="file.mp4",
        )
        self.assertEqual(file_id1, file_id2)

        # Change file content -> different ID
        changed_content = self.storage.load_and_get_id(
            b"mock_bytes_2",
            mimetype="video/mp4",
            kind=MediaFileKind.MEDIA,
            filename="file.mp4",
        )
        self.assertNotEqual(file_id1, changed_content)

        # Change mimetype -> different ID
        changed_mimetype = self.storage.load_and_get_id(
            b"mock_bytes",
            mimetype="image/png",
            kind=MediaFileKind.MEDIA,
            filename="file.mp4",
        )
        self.assertNotEqual(file_id1, changed_mimetype)

        # Change (or omit) filename -> different ID
        changed_filename = self.storage.load_and_get_id(
            b"mock_bytes", mimetype="video/mp4", kind=MediaFileKind.MEDIA
        )
        self.assertNotEqual(file_id1, changed_filename)

    @mock.patch(
        "streamlit.runtime.memory_media_file_storage.open", side_effect=Exception
    )
    def test_load_with_bad_path(self, _):
        """Adding a file by path raises a MediaFileStorageError if the file can't be read."""
        with self.assertRaises(MediaFileStorageError):
            self.storage.load_and_get_id(
                "mock/file/path",
                mimetype="video/mp4",
                kind=MediaFileKind.MEDIA,
                filename="file.mp4",
            )

    @parameterized.expand(
        [
            ("video/mp4", ".mp4"),
            ("audio/wav", ".wav"),
            ("image/png", ".png"),
            ("image/jpeg", ".jpeg"),
        ]
    )
    def test_get_url(self, mimetype, extension):
        """URLs should be formatted correctly, and have the right extension for
        the file's mimetype.
        """
        file_id = self.storage.load_and_get_id(
            b"mock_bytes", mimetype=mimetype, kind=MediaFileKind.MEDIA
        )
        url = self.storage.get_url(file_id)
        self.assertEqual(f"/mock/media/{file_id}{extension}", url)

    def test_get_url_invalid_fileid(self):
        """get_url raises if it gets a bad file_id."""
        with self.assertRaises(MediaFileStorageError):
            self.storage.get_url("not_a_file_id")

    def test_delete_file(self):
        """delete_file removes the file with the given ID."""
        file_id1 = self.storage.load_and_get_id(
            b"mock_bytes_1",
            mimetype="video/mp4",
            kind=MediaFileKind.MEDIA,
            filename="file.mp4",
        )
        file_id2 = self.storage.load_and_get_id(
            b"mock_bytes_2",
            mimetype="video/mp4",
            kind=MediaFileKind.MEDIA,
            filename="file.mp4",
        )

        # delete file 1. It should not exist, but file2 should.
        self.storage.delete_file(file_id1)
        with self.assertRaises(BaseException):
            self.storage.get_file(file_id1)

        self.assertIsNotNone(self.storage.get_file(file_id2))

        # delete file 2
        self.storage.delete_file(file_id2)
        with self.assertRaises(BaseException):
            self.storage.get_file(file_id2)

    def test_delete_invalid_file_is_a_noop(self):
        """deleting a file that doesn't exist doesn't raise an error."""
        self.storage.delete_file("mock_file_id")

    def test_cache_stats(self):
        """Test our CacheStatsProvider implementation."""
        self.assertEqual(0, len(self.storage.get_stats()))

        # Add several files to storage. We'll unique-ify them by filename.
        mock_data = b"some random mock binary data"
        num_files = 5
        for ii in range(num_files):
            self.storage.load_and_get_id(
                mock_data,
                mimetype="video/mp4",
                kind=MediaFileKind.MEDIA,
                filename=f"{ii}.mp4",
            )

        stats = self.storage.get_stats()
        self.assertEqual(num_files, len(stats))
        self.assertEqual("st_memory_media_file_storage", stats[0].category_name)
        self.assertEqual(
            len(mock_data) * num_files, sum(stat.byte_length for stat in stats)
        )

        # Remove files, and ensure our cache doesn't report they still exist
        for file_id in list(self.storage._files_by_id.keys()):
            self.storage.delete_file(file_id)

        self.assertEqual(0, len(self.storage.get_stats()))
