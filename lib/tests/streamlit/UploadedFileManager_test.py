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

"""Unit tests for UploadedFileManager"""

import unittest

from streamlit.UploadedFileManager import UploadedFile
from streamlit.UploadedFileManager import UploadedFileList
from streamlit.UploadedFileManager import UploadedFileManager

file1 = UploadedFile(name="file1", data=b"file1")
file2 = UploadedFile(name="file2", data=b"file2")


class UploadedFileManagerTest(unittest.TestCase):
    def setUp(self):
        self.mgr = UploadedFileManager()
        self.filemgr_events = []
        self.mgr.on_files_added.connect(self._on_files_added)

    def _on_files_added(self, file_list, **kwargs):
        self.filemgr_events.append(file_list)

    def test_add_file(self):
        self.assertIsNone(self.mgr.get_files("non-report", "non-widget"))

        event1 = UploadedFileList("session", "widget", [file1])
        event2 = UploadedFileList("session", "widget", [file2])

        self.mgr.add_files("session", "widget", [file1])
        self.assertEqual([file1], self.mgr.get_files("session", "widget"))
        self.assertEqual([event1], self.filemgr_events)

        # Add another file with the same ID
        self.mgr.add_files("session", "widget", [file2])
        self.assertEqual([file2], self.mgr.get_files("session", "widget"))
        self.assertEqual([event1, event2], self.filemgr_events)

    def test_remove_file(self):
        # This should not error.
        self.mgr.remove_files("non-report", "non-widget")

        self.mgr.add_files("session", "widget", [file1])
        self.assertEqual([file1], self.mgr.get_files("session", "widget"))

        self.mgr.remove_files("session", "widget")
        self.assertIsNone(self.mgr.get_files("session", "widget"))

    def test_remove_all_files(self):
        # This should not error.
        self.mgr.remove_session_files("non-report")

        # Add two files with different session IDs, but the same widget ID.
        self.mgr.add_files("session1", "widget", [file1])
        self.mgr.add_files("session2", "widget", [file1])

        event1 = UploadedFileList("session1", "widget", [file1])
        event2 = UploadedFileList("session2", "widget", [file1])

        self.mgr.remove_session_files("session1")
        self.assertIsNone(self.mgr.get_files("session1", "widget"))
        self.assertEqual([file1], self.mgr.get_files("session2", "widget"))
        self.assertEqual([event1, event2], self.filemgr_events)
