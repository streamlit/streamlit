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

"""Unit tests for MediaFileManager"""

import random
from typing import Optional
from unittest import TestCase, mock
from unittest.mock import MagicMock, call, mock_open

from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.media_file_storage import MediaFileKind
from streamlit.runtime.memory_media_file_storage import (
    MemoryFile,
    MemoryMediaFileStorage,
    _calculate_file_id,
)


def random_coordinates():
    return "{}.{}.{}".format(
        random.randint(1, 4),
        (random.randint(1, 12), random.randint(1, 12)),
        random.randint(1, 99),
    )


# Smallest possible "real" media files for a handful of different formats.
# Sourced from https://github.com/mathiasbynens/small
AUDIO_FIXTURES = {
    "wav": {
        "content": b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00",
        "mimetype": "audio/wav",
    },
    "mp3": {
        "content": b"\xff\xe3\x18\xc4\x00\x00\x00\x03H\x00\x00\x00\x00LAME3.98.2\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00",
        "mimetype": "audio/mp3",
    },
}


VIDEO_FIXTURES = {
    "mp4": {
        "content": b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2mp41\x00\x00\x00\x08free\x00\x00\x02\xefmdat!\x10\x05",
        "mimetype": "video/mp4",
    },
    "webm": {
        "content": b'\x1aE\xdf\xa3@ B\x86\x81\x01B\xf7\x81\x01B\xf2\x81\x04B\xf3\x81\x08B\x82@\x04webmB\x87\x81\x02B\x85\x81\x02\x18S\x80g@\x8d\x15I\xa9f@(*\xd7\xb1@\x03\x0fB@M\x80@\x06whammyWA@\x06whammyD\x89@\x08@\x8f@\x00\x00\x00\x00\x00\x16T\xaek@1\xae@.\xd7\x81\x01c\xc5\x81\x01\x9c\x81\x00"\xb5\x9c@\x03und\x86@\x05V_VP8%\x86\x88@\x03VP8\x83\x81\x01\xe0@\x06\xb0\x81\x08\xba\x81\x08\x1fC\xb6u@"\xe7\x81\x00\xa3@\x1c\x81\x00\x00\x800\x01\x00\x9d\x01*\x08\x00\x08\x00\x01@&%\xa4\x00\x03p\x00\xfe\xfc\xf4\x00\x00',
        "mimetype": "video/webm",
    },
}


IMAGE_FIXTURES = {
    "png": {
        "content": b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82",
        "mimetype": "image/png",
    },
    "jpg": {
        "content": b"\xff\xd8\xff\xdb\x00C\x00\x03\x02\x02\x02\x02\x02\x03\x02\x02\x02\x03\x03\x03\x03\x04\x06\x04\x04\x04\x04\x04\x08\x06\x06\x05\x06\t\x08\n\n\t\x08\t\t\n\x0c\x0f\x0c\n\x0b\x0e\x0b\t\t\r\x11\r\x0e\x0f\x10\x10\x11\x10\n\x0c\x12\x13\x12\x10\x13\x0f\x10\x10\x10\xff\xc9\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xcc\x00\x06\x00\x10\x10\x05\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xd2\xcf \xff\xd9",
        "mimetype": "image/jpg",
    },
}

TEXT_FIXTURES = {
    "txt": {"content": b"Hello world", "mimetype": "text/plain"},
    "csv": {
        "content": b"""
                    Foo, Bar
                    123, 456
                    789, 111""",
        "mimetype": "text/csv",
    },
}

ALL_FIXTURES = dict()
ALL_FIXTURES.update(AUDIO_FIXTURES)
ALL_FIXTURES.update(VIDEO_FIXTURES)
ALL_FIXTURES.update(IMAGE_FIXTURES)
ALL_FIXTURES.update(TEXT_FIXTURES)


class MediaFileManagerTest(TestCase):
    def setUp(self):
        super().setUp()
        self.storage = MemoryMediaFileStorage("/mock/endpoint")
        self.media_file_manager = MediaFileManager(self.storage)
        random.seed(1337)

    def _add_file_and_get_object(
        self,
        content: bytes,
        mimetype: str,
        coordinates: str,
        filename: Optional[str] = None,
    ) -> MemoryFile:
        """Add a new file to our test manager and return its MediaFile object."""
        file_id = _calculate_file_id(content, mimetype, filename)
        self.media_file_manager.add(content, mimetype, coordinates, filename)
        return self.storage.get_file(file_id)

    def test_calculate_file_id(self):
        """Test that file_id generation from data works as expected."""

        fake_bytes = "\x00\x00\xff\x00\x00\xff\x00\x00\xff\x00\x00\xff\x00".encode(
            "utf-8"
        )
        test_hash = "2ba850426b188d25adc5a37ad313080c346f5e88e069e0807d0cdb2b"
        self.assertEqual(test_hash, _calculate_file_id(fake_bytes, "media/any"))

        # Make sure we get different file ids for files with same bytes but diff't mimetypes.
        self.assertNotEqual(
            _calculate_file_id(fake_bytes, "audio/wav"),
            _calculate_file_id(fake_bytes, "video/mp4"),
        )

        # Make sure we get different file ids for files with same bytes and mimetypes but diff't filenames.
        self.assertNotEqual(
            _calculate_file_id(fake_bytes, "audio/wav", filename="name1.wav"),
            _calculate_file_id(fake_bytes, "audio/wav", filename="name2.wav"),
        )

    @mock.patch(
        "streamlit.runtime.media_file_manager._get_session_id",
        return_value="mock_session_id",
    )
    def test_reject_null_files(self, _):
        """MediaFileManager.add raises a TypeError if it's passed None."""
        with self.assertRaises(TypeError):
            self.media_file_manager.add(None, "media/any", random_coordinates())

    @mock.patch(
        "streamlit.runtime.media_file_manager._get_session_id",
        return_value="mock_session",
    )
    def test_add_binary_files(self, _):
        """Test that we can add binary files to the manager."""
        storage_load_spy = MagicMock(side_effect=self.storage.load_and_get_id)
        self.storage.load_and_get_id = storage_load_spy

        sample_coords = set()
        while len(sample_coords) < len(ALL_FIXTURES):
            sample_coords.add(random_coordinates())

        for sample in ALL_FIXTURES.values():
            content = sample["content"]
            self.assertIsInstance(content, bytes)
            mimetype = sample["mimetype"]
            media_file = self._add_file_and_get_object(
                content, mimetype, sample_coords.pop()
            )
            self.assertIsNotNone(media_file)

            # Ensure MediaFileStorage.load_and_get_id was called as expected.
            storage_load_spy.assert_called_once_with(
                content, mimetype, MediaFileKind.MEDIA, None
            )
            storage_load_spy.reset_mock()

        # There should be as many files in MFM as we added.
        self.assertEqual(len(self.media_file_manager._file_metadata), len(ALL_FIXTURES))

        # There should only be 1 session with registered files.
        self.assertEqual(len(self.media_file_manager._files_by_session_and_coord), 1)

    @mock.patch(
        "streamlit.runtime.media_file_manager._get_session_id",
        return_value="mock_session",
    )
    @mock.patch(
        "streamlit.runtime.memory_media_file_storage.open",
        mock_open(read_data=b"mock_test_file"),
        create=True,
    )
    def test_add_file_by_name(self, _1):
        """Test that we can add files by filename."""
        storage_load_spy = MagicMock(side_effect=self.storage.load_and_get_id)
        self.storage.load_and_get_id = storage_load_spy

        self.media_file_manager.add(
            "mock/file/path.png", "image/png", random_coordinates()
        )

        # We should have a single file in the MFM.
        self.assertEqual(len(self.media_file_manager._file_metadata), 1)

        # And it should be registered to our session
        self.assertEqual(
            len(self.media_file_manager._files_by_session_and_coord["mock_session"]), 1
        )

        # Ensure MediaFileStorage.load_and_get_id was called as expected.
        storage_load_spy.assert_called_once_with(
            "mock/file/path.png", "image/png", MediaFileKind.MEDIA, None
        )

    @mock.patch(
        "streamlit.runtime.media_file_manager._get_session_id",
        return_value="mock_session_id",
    )
    def test_add_files_same_coord(self, _):
        """We can add multiple files that share the same coordinate."""
        coord = random_coordinates()

        for sample in ALL_FIXTURES.values():
            self.media_file_manager.add(sample["content"], sample["mimetype"], coord)

        # There should be 6 files in MFM.
        self.assertEqual(len(self.media_file_manager._file_metadata), len(ALL_FIXTURES))

        # There should only be 1 session with registered files.
        self.assertEqual(len(self.media_file_manager._files_by_session_and_coord), 1)

        # There should only be 1 coord in that session.
        self.assertEqual(
            len(self.media_file_manager._files_by_session_and_coord["mock_session_id"]),
            1,
        )

        self.media_file_manager.clear_session_refs()
        self.media_file_manager.remove_orphaned_files()

        # There should be only 0 file in MFM.
        self.assertEqual(len(self.media_file_manager._file_metadata), 0)

        # There should only be 0 session with registered files.
        self.assertEqual(len(self.media_file_manager._files_by_session_and_coord), 0)

    @mock.patch(
        "streamlit.runtime.media_file_manager._get_session_id",
        return_value="mock_session_id",
    )
    def test_add_file_already_exists_same_coord(self, _):
        """Adding a file that already exists results in just a single file in
        the manager.
        """
        sample = IMAGE_FIXTURES["png"]
        coord = random_coordinates()

        self.media_file_manager.add(sample["content"], sample["mimetype"], coord)
        file_id = _calculate_file_id(sample["content"], sample["mimetype"])
        self.assertTrue(file_id in self.media_file_manager._file_metadata)

        self.media_file_manager.add(sample["content"], sample["mimetype"], coord)
        self.assertTrue(file_id in self.media_file_manager._file_metadata)

        # There should only be 1 file in MFM.
        self.assertEqual(len(self.media_file_manager._file_metadata), 1)

        # There should only be 1 session with registered files.
        self.assertEqual(len(self.media_file_manager._files_by_session_and_coord), 1)

    @mock.patch(
        "streamlit.runtime.media_file_manager._get_session_id",
        return_value="mock_session_id",
    )
    def test_add_file_already_exists_different_coord(self, _):
        """Adding a file that already exists, but with different coordinates,
        results in just a single file in the manager.
        """
        sample = IMAGE_FIXTURES["png"]

        coord = random_coordinates()
        self.media_file_manager.add(sample["content"], sample["mimetype"], coord)
        file_id = _calculate_file_id(sample["content"], sample["mimetype"])
        self.assertTrue(file_id in self.media_file_manager._file_metadata)

        coord = random_coordinates()
        self.media_file_manager.add(sample["content"], sample["mimetype"], coord)
        self.assertTrue(file_id in self.media_file_manager._file_metadata)

        # There should only be 1 file in MFM.
        self.assertEqual(len(self.media_file_manager._file_metadata), 1)

        # There should only be 1 session with registered files.
        self.assertEqual(len(self.media_file_manager._files_by_session_and_coord), 1)

    @mock.patch(
        "streamlit.runtime.media_file_manager._get_session_id",
        return_value="mock_session_id",
    )
    def test_remove_orphaned_files_in_empty_manager(self, _):
        """Calling clear_session_refs/remove_orphaned_files in an empty manager
        is a no-op.
        """
        storage_delete_spy = MagicMock(side_effect=self.storage.delete_file)
        self.storage.delete_file = storage_delete_spy

        self.assertEqual(len(self.media_file_manager._file_metadata), 0)
        self.assertEqual(len(self.media_file_manager._files_by_session_and_coord), 0)

        self.media_file_manager.clear_session_refs()
        self.media_file_manager.remove_orphaned_files()

        self.assertEqual(len(self.media_file_manager._file_metadata), 0)
        self.assertEqual(len(self.media_file_manager._files_by_session_and_coord), 0)

        # MediaFileStorage.delete_file should not have been called, because
        # no files were actually deleted.
        storage_delete_spy.assert_not_called()

    @mock.patch("streamlit.runtime.media_file_manager._get_session_id")
    def test_remove_orphaned_files_multiple_sessions(self, mock_get_session_id):
        """clear_session_refs/remove_orphaned_files behaves correctly when multiple
        sessions are referencing some of the same files.
        """
        storage_delete_spy = MagicMock(side_effect=self.storage.delete_file)
        self.storage.delete_file = storage_delete_spy

        # Have two sessions add the same set of files
        for session_id in ("mock_session_1", "mock_session_2"):
            mock_get_session_id.return_value = session_id
            for sample in VIDEO_FIXTURES.values():
                coord = random_coordinates()
                self.media_file_manager.add(
                    sample["content"], sample["mimetype"], coord
                )

        self.assertEqual(
            len(self.media_file_manager._file_metadata), len(VIDEO_FIXTURES)
        )

        file_ids = list(self.media_file_manager._file_metadata.keys())

        # Remove session1's references
        mock_get_session_id.return_value = "mock_session_1"
        self.media_file_manager.clear_session_refs()
        self.media_file_manager.remove_orphaned_files()

        # The files are all still referenced by session_2
        self.assertEqual(
            len(self.media_file_manager._file_metadata), len(VIDEO_FIXTURES)
        )

        # MediaFileStorage.delete_file should not have been called yet...
        storage_delete_spy.assert_not_called()

        # Remove session2's references, but don't call "remove_orphaned_files" yet...
        mock_get_session_id.return_value = "mock_session_2"
        self.media_file_manager.clear_session_refs()

        # The files still exist, because they've only been de-referenced and not
        # removed.
        self.assertEqual(
            len(self.media_file_manager._file_metadata), len(VIDEO_FIXTURES)
        )

        # MediaFileStorage.delete_file should not have been called yet...
        storage_delete_spy.assert_not_called()

        # After a final call to remove_orphaned_files, the files should be gone.
        self.media_file_manager.remove_orphaned_files()
        self.assertEqual(len(self.media_file_manager._file_metadata), 0)

        # MediaFileStorage.delete_file should have been called once for each
        # file.
        storage_delete_spy.assert_has_calls(
            [call(file_id) for file_id in file_ids], any_order=True
        )
