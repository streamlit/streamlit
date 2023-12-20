# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

"""Unit tests for UploadedFileManager"""

import unittest

from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.stats import CacheStat
from streamlit.runtime.uploaded_file_manager import UploadedFileRec
from tests.exception_capturing_thread import call_on_threads

FILE_1 = UploadedFileRec(file_id="url1", name="file1", type="type", data=b"file1")
FILE_2 = UploadedFileRec(file_id="url2", name="file2", type="type", data=b"file222")


class UploadedFileManagerTest(unittest.TestCase):
    def setUp(self):
        self.mgr = MemoryUploadedFileManager("/mock/upload")

    def test_added_file_id(self):
        """Presigned file URL should have a unique ID."""
        info1, info2 = self.mgr.get_upload_urls("session", ["name1", "name1"])
        self.assertNotEqual(info1.file_id, info2.file_id)

    def test_retrieve_added_file(self):
        """An added file should maintain all its source properties
        except its ID."""
        self.mgr.add_file("session", FILE_1)
        self.mgr.add_file("session", FILE_2)

        file1_from_storage, *rest_files = self.mgr.get_files("session", ["url1"])
        self.assertEqual(len(rest_files), 0)
        self.assertEqual(file1_from_storage.file_id, FILE_1.file_id)
        self.assertEqual(file1_from_storage.name, FILE_1.name)
        self.assertEqual(file1_from_storage.type, FILE_1.type)
        self.assertEqual(file1_from_storage.data, FILE_1.data)

        file2_from_storage, *other_files = self.mgr.get_files("session", ["url2"])
        self.assertEqual(len(other_files), 0)
        self.assertEqual(file2_from_storage.file_id, FILE_2.file_id)
        self.assertEqual(file2_from_storage.name, FILE_2.name)
        self.assertEqual(file2_from_storage.type, FILE_2.type)
        self.assertEqual(file2_from_storage.data, FILE_2.data)

    def test_remove_file(self):
        # This should not error.
        self.mgr.remove_file("non-session", "non-file-id")

        self.mgr.add_file("session", FILE_1)
        self.mgr.remove_file("session", FILE_1.file_id)
        self.assertEqual([], self.mgr.get_files("session", [FILE_1.file_id]))

        # Remove the file again. It doesn't exist, but this isn't an error.
        self.mgr.remove_file("session", FILE_1.file_id)
        self.assertEqual([], self.mgr.get_files("session", [FILE_1.file_id]))

        self.mgr.add_file("session", FILE_1)
        self.mgr.add_file("session", FILE_2)
        self.mgr.remove_file("session", FILE_1.file_id)
        self.assertEqual(
            [FILE_2], self.mgr.get_files("session", [FILE_1.file_id, FILE_2.file_id])
        )

    def test_remove_session_files(self):
        # This should not error.
        self.mgr.remove_session_files("non-report")

        # Add two files with different session IDs, but the same widget ID.
        self.mgr.add_file("session1", FILE_1)
        self.mgr.add_file("session1", FILE_2)

        self.mgr.add_file("session2", FILE_1)

        self.mgr.remove_session_files("session1")
        self.assertEqual(
            [], self.mgr.get_files("session1", [FILE_1.file_id, FILE_2.file_id])
        )
        self.assertEqual([FILE_1], self.mgr.get_files("session2", [FILE_1.file_id]))

    def test_cache_stats_provider(self):
        """Test CacheStatsProvider implementation."""

        # Test empty manager
        self.assertEqual([], self.mgr.get_stats())

        # Test manager with files
        self.mgr.add_file("session1", FILE_1)
        self.mgr.add_file("session1", FILE_2)

        expected = [
            CacheStat(
                category_name="UploadedFileManager",
                cache_name="",
                byte_length=len(FILE_1.data),
            ),
            CacheStat(
                category_name="UploadedFileManager",
                cache_name="",
                byte_length=len(FILE_2.data),
            ),
        ]
        self.assertEqual(expected, self.mgr.get_stats())


class UploadedFileManagerThreadingTest(unittest.TestCase):
    # The number of threads to run our tests on
    NUM_THREADS = 50

    def setUp(self) -> None:
        self.mgr = MemoryUploadedFileManager("/mock/upload")

    def test_add_file(self):
        """`add_file` is thread-safe."""
        # Call `add_file` from a bunch of threads
        added_files = []

        def add_file(index: int) -> None:
            file = UploadedFileRec(
                file_id=f"id_{index}",
                name=f"file_{index}",
                type="type",
                data=bytes(f"{index}", "utf-8"),
            )

            self.mgr.add_file("session", file)
            files_from_storage = self.mgr.get_files("session", [file.file_id])
            added_files.extend(files_from_storage)

        call_on_threads(add_file, num_threads=self.NUM_THREADS)

        # Ensure all our files are present
        for ii in range(self.NUM_THREADS):
            files = self.mgr.get_files("session", [f"id_{ii}"])
            self.assertEqual(1, len(files))
            self.assertEqual(bytes(f"{ii}", "utf-8"), files[0].data)

        # Ensure all files have unique IDs
        file_ids = set()
        for file_rec in self.mgr.file_storage["session"].values():
            file_ids.add(file_rec.file_id)
        self.assertEqual(self.NUM_THREADS, len(file_ids))

    def test_remove_file(self):
        """`remove_file` is thread-safe."""
        # Add a bunch of files to a single widget
        file_ids = []
        for ii in range(self.NUM_THREADS):
            file = UploadedFileRec(
                file_id=f"id_{ii}",
                name=f"file_{ii}",
                type="type",
                data=b"123",
            )
            self.mgr.add_file("session", file)
            file_ids.append(file.file_id)

        # Have each thread remove a single file
        def remove_file(index: int) -> None:
            file_id = file_ids[index]

            # Ensure our file exists
            get_files_result = self.mgr.get_files("session", [file_id])
            self.assertEqual(1, len(get_files_result))

            # Remove our file and ensure our file no longer exists
            self.mgr.remove_file("session", file_id)
            get_files_result = self.mgr.get_files("session", [file_id])
            self.assertEqual(0, len(get_files_result))

        call_on_threads(remove_file, self.NUM_THREADS)

        self.assertEqual(0, len(self.mgr.file_storage["session"]))

    def test_remove_session_files(self):
        """`remove_session_files` is thread-safe."""
        # Add a bunch of files, each to a different session
        file_ids = []
        for ii in range(self.NUM_THREADS):
            file = UploadedFileRec(
                file_id=f"id_{ii}",
                name=f"file_{ii}",
                type="type",
                data=b"123",
            )
            self.mgr.add_file(f"session_{ii}", file)
            file_ids.append(file.file_id)

        # Have each thread remove its session's file
        def remove_session_files(index: int) -> None:
            session_id = f"session_{index}"
            # Our file should exist
            session_files = self.mgr.get_files(session_id, [f"id_{index}"])
            self.assertEqual(1, len(session_files))
            self.assertEqual(file_ids[index], session_files[0].file_id)

            # Remove session files
            self.mgr.remove_session_files(session_id)

            # Our file should no longer exist
            session_files = self.mgr.get_files(session_id, [f"id_{index}"])
            self.assertEqual(0, len(session_files))

        call_on_threads(remove_session_files, num_threads=self.NUM_THREADS)
