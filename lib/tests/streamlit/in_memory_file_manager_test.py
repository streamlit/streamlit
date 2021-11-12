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

"""Unit tests for InMemoryFileManager"""

from unittest import mock
import unittest
import random
import time

from tornado.testing import AsyncTestCase

from streamlit.in_memory_file_manager import (
    InMemoryFileManager,
    _calculate_file_id,
    InMemoryFile,
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


class InMemoryFileManagerTest(AsyncTestCase):
    def setUp(self):
        super(InMemoryFileManagerTest, self).setUp()
        self.in_memory_file_manager = InMemoryFileManager()
        random.seed(1337)

    def tearDown(self):
        self.in_memory_file_manager._files_by_id.clear()
        self.in_memory_file_manager._files_by_session_and_coord.clear()

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
            _calculate_file_id(fake_bytes, "audio/wav", file_name="name1.wav"),
            _calculate_file_id(fake_bytes, "audio/wav", file_name="name2.wav"),
        )

    @mock.patch("streamlit.in_memory_file_manager._get_session_id")
    def test_add_files(self, _get_session_id):
        """Test that InMemoryFileManager.add works as expected."""
        _get_session_id.return_value = "SESSION1"

        coord = random_coordinates()

        # Make sure we reject files containing None
        with self.assertRaises(TypeError):
            self.in_memory_file_manager.add(None, "media/any", coord)

        sample_coords = set()
        while len(sample_coords) < len(ALL_FIXTURES):
            sample_coords.add(random_coordinates())

        for sample in ALL_FIXTURES.values():
            f = self.in_memory_file_manager.add(
                sample["content"], sample["mimetype"], sample_coords.pop()
            )
            self.assertTrue(f.id in self.in_memory_file_manager)

        # There should be as many files in MFM as we added.
        self.assertEqual(len(self.in_memory_file_manager), len(ALL_FIXTURES))

        # There should only be 1 session with registered files.
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord), 1
        )

    @mock.patch("streamlit.in_memory_file_manager._get_session_id")
    @mock.patch("time.time")
    def test_add_files_same_coord(self, _time, _get_session_id):
        """Test that InMemoryFileManager.add works as expected."""
        _get_session_id.return_value = "SESSION1"

        coord = random_coordinates()

        for sample in ALL_FIXTURES.values():
            f = self.in_memory_file_manager.add(
                sample["content"], sample["mimetype"], coord
            )
            self.assertTrue(f.id in self.in_memory_file_manager)

        # There should be 6 files in MFM.
        self.assertEqual(len(self.in_memory_file_manager), len(ALL_FIXTURES))

        # There should only be 1 session with registered files.
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord), 1
        )

        # There should only be 1 coord in that session.
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord["SESSION1"]), 1
        )

        self.in_memory_file_manager.clear_session_files()
        self.in_memory_file_manager.del_expired_files()

        # There should be only 0 file in MFM.
        self.assertEqual(len(self.in_memory_file_manager), 0)

        # There should only be 0 session with registered files.
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord), 0
        )

    @mock.patch("streamlit.in_memory_file_manager._get_session_id")
    def test_add_file_already_exists_same_coord(self, _get_session_id):
        _get_session_id.return_value = "SESSION1"

        sample = IMAGE_FIXTURES["png"]
        coord = random_coordinates()

        self.in_memory_file_manager.add(sample["content"], sample["mimetype"], coord)
        file_id = _calculate_file_id(sample["content"], sample["mimetype"])
        self.assertTrue(file_id in self.in_memory_file_manager)

        mediafile = self.in_memory_file_manager.add(
            sample["content"], sample["mimetype"], coord
        )
        self.assertTrue(file_id in self.in_memory_file_manager)
        self.assertEqual(mediafile.id, file_id)

        # There should only be 1 file in MFM.
        self.assertEqual(len(self.in_memory_file_manager), 1)

        # There should only be 1 session with registered files.
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord), 1
        )

    @mock.patch("streamlit.in_memory_file_manager._get_session_id")
    def test_add_file_already_exists_different_coord(self, _get_session_id):
        _get_session_id.return_value = "SESSION1"

        sample = IMAGE_FIXTURES["png"]

        coord = random_coordinates()
        self.in_memory_file_manager.add(sample["content"], sample["mimetype"], coord)
        file_id = _calculate_file_id(sample["content"], sample["mimetype"])
        self.assertTrue(file_id in self.in_memory_file_manager)

        coord = random_coordinates()
        mediafile = self.in_memory_file_manager.add(
            sample["content"], sample["mimetype"], coord
        )
        self.assertTrue(file_id in self.in_memory_file_manager)
        self.assertEqual(mediafile.id, file_id)

        # There should only be 1 file in MFM.
        self.assertEqual(len(self.in_memory_file_manager), 1)

        # There should only be 1 session with registered files.
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord), 1
        )

    @mock.patch("streamlit.in_memory_file_manager._get_session_id")
    def test_add_file_different_mimetypes(self, _get_session_id):
        """Test that we create a new file if new mimetype, even with same bytes for content."""
        _get_session_id.return_value = "SESSION1"
        coord = random_coordinates()

        sample = AUDIO_FIXTURES["mp3"]
        f1 = self.in_memory_file_manager.add(sample["content"], "audio/mp3", coord)
        self.assertTrue(f1.id in self.in_memory_file_manager)

        f2 = self.in_memory_file_manager.add(sample["content"], "video/mp4", coord)
        self.assertNotEqual(f1.id, f2.id)
        self.assertTrue(f2.id in self.in_memory_file_manager)

        # There should be only 2 files in MFM, one for each mimetye.
        self.assertEqual(len(self.in_memory_file_manager), 2)

        # There should be only 1 session with registered files.
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord), 1
        )

    @mock.patch("streamlit.in_memory_file_manager._get_session_id")
    @mock.patch("time.time")
    def test_clear_session_files(self, _time, _get_session_id):
        """Test that InMemoryFileManager removes session maps when requested (even if empty)."""
        _get_session_id.return_value = "SESSION1"

        self.assertEqual(len(self.in_memory_file_manager), 0)
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord), 0
        )

        self.in_memory_file_manager.clear_session_files()

        self.assertEqual(len(self.in_memory_file_manager), 0)
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord), 0
        )

        self.in_memory_file_manager.del_expired_files()

        self.assertEqual(len(self.in_memory_file_manager), 0)
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord), 0
        )

        for sample in VIDEO_FIXTURES.values():
            coord = random_coordinates()
            self.in_memory_file_manager.add(
                sample["content"], sample["mimetype"], coord
            )

        self.assertEqual(len(self.in_memory_file_manager), len(VIDEO_FIXTURES))
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord), 1
        )

        self.in_memory_file_manager.clear_session_files()

        self.assertEqual(
            len(self.in_memory_file_manager), len(VIDEO_FIXTURES)
        )  # Clears later
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord), 0
        )  # Clears immediately

        self.in_memory_file_manager.del_expired_files()

        self.assertEqual(
            len(self.in_memory_file_manager), 0
        )  # Now this is cleared too!
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord), 0
        )

    @mock.patch("streamlit.in_memory_file_manager._get_session_id")
    def test_add_file_multiple_sessions_then_clear(self, _get_session_id):
        _get_session_id.return_value = "SESSION1"

        sample = next(iter(ALL_FIXTURES.values()))

        coord = random_coordinates()
        f = self.in_memory_file_manager.add(
            sample["content"], sample["mimetype"], coord
        )
        self.assertTrue(f.id in self.in_memory_file_manager)

        _get_session_id.return_value = "SESSION2"

        coord = random_coordinates()
        f = self.in_memory_file_manager.add(
            sample["content"], sample["mimetype"], coord
        )
        self.assertTrue(f.id in self.in_memory_file_manager)

        # There should be only 1 file in MFM.
        self.assertEqual(len(self.in_memory_file_manager), 1)

        # There should be 2 sessions with registered files.
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord), 2
        )

        # force every InMemoryFile to have a TTD of now, so we can see it get deleted w/o waiting.
        for imf in self.in_memory_file_manager._files_by_id.values():
            imf.ttd = time.time()

        self.in_memory_file_manager.clear_session_files()

        # There should be 1 session with registered files.
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord), 1
        )

        _get_session_id.return_value = "SESSION1"
        self.in_memory_file_manager.clear_session_files()

        # There should be 0 session with registered files.
        self.assertEqual(
            len(self.in_memory_file_manager._files_by_session_and_coord), 0
        )

    def test_media_file_url(self):
        self.assertEqual(InMemoryFile("abcd", None, "audio/wav").url, "/media/abcd.wav")
        self.assertEqual(
            InMemoryFile("abcd", None, "image/jpeg").url, "/media/abcd.jpeg"
        )
        self.assertEqual(InMemoryFile("abcd", None, "video/mp4").url, "/media/abcd.mp4")
        self.assertEqual(
            InMemoryFile("abcd", None, "video/webm").url, "/media/abcd.webm"
        )

    @mock.patch("streamlit.in_memory_file_manager._get_session_id")
    def test_stats_provider(self, _get_session_id):
        _get_session_id.return_value = "SESSION1"
        manager = self.in_memory_file_manager
        assert len(manager.get_stats()) == 0

        for sample in VIDEO_FIXTURES.values():
            coord = random_coordinates()
            self.in_memory_file_manager.add(
                sample["content"], sample["mimetype"], coord
            )

        stats = manager.get_stats()
        assert len(stats) == 2
        assert stats[0].category_name == "st_in_memory_file_manager"
        assert sum(stat.byte_length for stat in stats) == 232

        manager.clear_session_files("SESSION1")
        manager.del_expired_files()
        assert len(manager.get_stats()) == 0
