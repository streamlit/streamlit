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

"""Unit tests for UploadedFileManager"""

import unittest

from exception_capturing_thread import call_on_threads
from streamlit.runtime.stats import CacheStat
from streamlit.runtime.uploaded_file_manager import UploadedFileManager, UploadedFileRec

FILE_1 = UploadedFileRec(id=0, name="file1", type="type", data=b"file1")
FILE_2 = UploadedFileRec(id=0, name="file2", type="type", data=b"file222")


class UploadedFileManagerTest(unittest.TestCase):
    def setUp(self):
        self.mgr = UploadedFileManager()
        self.filemgr_events = []
        self.mgr.on_files_updated.connect(self._on_files_updated)

    def _on_files_updated(self, file_list, **kwargs):
        self.filemgr_events.append(file_list)

    def test_added_file_id(self):
        """An added file should have a unique ID."""
        f1 = self.mgr.add_file("session", "widget", FILE_1)
        f2 = self.mgr.add_file("session", "widget", FILE_1)
        self.assertNotEqual(FILE_1.id, f1.id)
        self.assertNotEqual(f1.id, f2.id)

    def test_added_file_properties(self):
        """An added file should maintain all its source properties
        except its ID."""
        added = self.mgr.add_file("session", "widget", FILE_1)
        self.assertNotEqual(added.id, FILE_1.id)
        self.assertEqual(added.name, FILE_1.name)
        self.assertEqual(added.type, FILE_1.type)
        self.assertEqual(added.data, FILE_1.data)

    def test_retrieve_added_file(self):
        """After adding a file to the mgr, we should be able to get it back."""
        self.assertEqual([], self.mgr.get_all_files("non-report", "non-widget"))

        file_1 = self.mgr.add_file("session", "widget", FILE_1)
        self.assertEqual([file_1], self.mgr.get_all_files("session", "widget"))
        self.assertEqual([file_1], self.mgr.get_files("session", "widget", [file_1.id]))
        self.assertEqual(len(self.filemgr_events), 1)

        # Add another file
        file_2 = self.mgr.add_file("session", "widget", FILE_2)
        self.assertEqual([file_1, file_2], self.mgr.get_all_files("session", "widget"))
        self.assertEqual([file_1], self.mgr.get_files("session", "widget", [file_1.id]))
        self.assertEqual([file_2], self.mgr.get_files("session", "widget", [file_2.id]))
        self.assertEqual(len(self.filemgr_events), 2)

    def test_remove_file(self):
        # This should not error.
        self.mgr.remove_files("non-report", "non-widget")

        f1 = self.mgr.add_file("session", "widget", FILE_1)
        self.mgr.remove_file("session", "widget", f1.id)
        self.assertEqual([], self.mgr.get_all_files("session", "widget"))

        # Remove the file again. It doesn't exist, but this isn't an error.
        self.mgr.remove_file("session", "widget", f1.id)
        self.assertEqual([], self.mgr.get_all_files("session", "widget"))

        f1 = self.mgr.add_file("session", "widget", FILE_1)
        f2 = self.mgr.add_file("session", "widget", FILE_2)
        self.mgr.remove_file("session", "widget", f1.id)
        self.assertEqual([f2], self.mgr.get_all_files("session", "widget"))

    def test_remove_widget_files(self):
        # This should not error.
        self.mgr.remove_session_files("non-report")

        # Add two files with different session IDs, but the same widget ID.
        f1 = self.mgr.add_file("session1", "widget", FILE_1)
        f2 = self.mgr.add_file("session2", "widget", FILE_1)

        self.mgr.remove_files("session1", "widget")
        self.assertEqual([], self.mgr.get_all_files("session1", "widget"))
        self.assertEqual([f2], self.mgr.get_all_files("session2", "widget"))

    def test_remove_session_files(self):
        # This should not error.
        self.mgr.remove_session_files("non-report")

        # Add two files with different session IDs, but the same widget ID.
        f1 = self.mgr.add_file("session1", "widget1", FILE_1)
        f2 = self.mgr.add_file("session1", "widget2", FILE_1)
        f3 = self.mgr.add_file("session2", "widget", FILE_1)

        self.mgr.remove_session_files("session1")
        self.assertEqual([], self.mgr.get_all_files("session1", "widget1"))
        self.assertEqual([], self.mgr.get_all_files("session1", "widget2"))
        self.assertEqual([f3], self.mgr.get_all_files("session2", "widget"))

    def test_remove_orphaned_files(self):
        """Test the remove_orphaned_files behavior"""
        f1 = self.mgr.add_file("session1", "widget1", FILE_1)
        f2 = self.mgr.add_file("session1", "widget1", FILE_1)
        f3 = self.mgr.add_file("session1", "widget1", FILE_1)
        self.assertEqual([f1, f2, f3], self.mgr.get_all_files("session1", "widget1"))

        # Nothing should be removed here (all files are active).
        self.mgr.remove_orphaned_files(
            "session1",
            "widget1",
            newest_file_id=f3.id,
            active_file_ids=[f1.id, f2.id, f3.id],
        )
        self.assertEqual([f1, f2, f3], self.mgr.get_all_files("session1", "widget1"))

        # Nothing should be removed here (no files are active, but they're all
        # "newer" than newest_file_id).
        self.mgr.remove_orphaned_files(
            "session1", "widget1", newest_file_id=f1.id - 1, active_file_ids=[]
        )
        self.assertEqual([f1, f2, f3], self.mgr.get_all_files("session1", "widget1"))

        # f2 should be removed here (it's not in the active file list)
        self.mgr.remove_orphaned_files(
            "session1", "widget1", newest_file_id=f3.id, active_file_ids=[f1.id, f3.id]
        )
        self.assertEqual([f1, f3], self.mgr.get_all_files("session1", "widget1"))

        # remove_orphaned_files on an untracked session/widget should not error
        self.mgr.remove_orphaned_files(
            "no_session", "no_widget", newest_file_id=0, active_file_ids=[]
        )

    def test_cache_stats_provider(self):
        """Test CacheStatsProvider implementation."""

        # Test empty manager
        self.assertEqual([], self.mgr.get_stats())

        # Test manager with files
        self.mgr.add_file("session1", "widget1", FILE_1)
        self.mgr.add_file("session1", "widget2", FILE_2)

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
    NUM_THREADS = 15

    def setUp(self) -> None:
        self.mgr = UploadedFileManager()

    def test_add_file(self):
        """add_file is thread-safe."""
        added_files = []

        def add_file(ii: int) -> None:
            # Invent a new file and add it to the mgr
            file = UploadedFileRec(
                id=0, name=f"file_{ii}", type="type", data=bytes(f"{ii}", "utf-8")
            )
            added_files.append(self.mgr.add_file("session", f"widget_{ii}", file))

        call_on_threads(add_file, num_threads=self.NUM_THREADS)
        for ii in range(self.NUM_THREADS):
            # Ensure all our files are present.
            files = self.mgr.get_all_files("session", f"widget_{ii}")
            self.assertEqual(1, len(files))
            self.assertEqual(bytes(f"{ii}", "utf-8"), files[0].data)

        # Ensure all files have unique IDs.
        file_ids = set()
        for file_list in self.mgr._files_by_id.values():
            file_ids.update(file.id for file in file_list)
        self.assertEqual(self.NUM_THREADS, len(file_ids))
