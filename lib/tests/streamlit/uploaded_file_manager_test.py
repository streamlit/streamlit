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

"""Unit tests for UploadedFileManager"""

import unittest

from streamlit.uploaded_file_manager import UploadedFileManager
from streamlit.uploaded_file_manager import UploadedFileRec

file1 = UploadedFileRec(id="id1", name="file1", type="type", data=b"file1")
file2 = UploadedFileRec(id="id2", name="file2", type="type", data=b"file2")


class UploadedFileManagerTest(unittest.TestCase):
    def setUp(self):
        self.mgr = UploadedFileManager()
        self.filemgr_events = []
        self.mgr.on_files_updated.connect(self._on_files_updated)

    def _on_files_updated(self, file_list, **kwargs):
        self.filemgr_events.append(file_list)

    def test_add_file(self):
        self.assertIsNone(self.mgr.get_files("non-report", "non-widget"))

        self.mgr.add_files("session", "widget", [file1])
        self.assertEqual([file1], self.mgr.get_files("session", "widget"))
        self.assertEqual(len(self.filemgr_events), 1)

        # Add another file with the same ID
        self.mgr.add_files("session", "widget", [file2])
        self.assertEqual([file1, file2], self.mgr.get_files("session", "widget"))
        self.assertEqual(len(self.filemgr_events), 2)

    def test_remove_file(self):
        # This should not error.
        self.mgr.remove_files("non-report", "non-widget")

        self.mgr.add_files("session", "widget", [file1])
        self.mgr.remove_file("session", "widget", file1.id)
        self.assertEqual([], self.mgr.get_files("session", "widget"))

        self.mgr.remove_file("session", "widget", file1.id)
        self.assertEqual([], self.mgr.get_files("session", "widget"))

        self.mgr.add_files("session", "widget", [file1])
        self.mgr.add_files("session", "widget", [file2])
        self.mgr.remove_file("session", "widget", file1.id)
        self.assertEqual([file2], self.mgr.get_files("session", "widget"))

    def test_remove_widget_files(self):
        # This should not error.
        self.mgr.remove_session_files("non-report")

        # Add two files with different session IDs, but the same widget ID.
        self.mgr.add_files("session1", "widget", [file1])
        self.mgr.add_files("session2", "widget", [file1])

        self.mgr.remove_files("session1", "widget")
        self.assertIsNone(self.mgr.get_files("session1", "widget"))
        self.assertEqual([file1], self.mgr.get_files("session2", "widget"))

    def test_remove_session_files(self):
        # This should not error.
        self.mgr.remove_session_files("non-report")

        # Add two files with different session IDs, but the same widget ID.
        self.mgr.add_files("session1", "widget1", [file1])
        self.mgr.add_files("session1", "widget2", [file1])
        self.mgr.add_files("session2", "widget", [file1])

        self.mgr.remove_session_files("session1")
        self.assertIsNone(self.mgr.get_files("session1", "widget1"))
        self.assertIsNone(self.mgr.get_files("session1", "widget2"))
        self.assertEqual([file1], self.mgr.get_files("session2", "widget"))

    def test_replace_widget_files(self):
        self.mgr.add_files("session1", "widget", [file1])
        self.mgr.replace_files("session1", "widget", [file2])

        self.assertEqual(len(self.mgr.get_files("session1", "widget")), 1)
        self.assertEqual([file2], self.mgr.get_files("session1", "widget"))
