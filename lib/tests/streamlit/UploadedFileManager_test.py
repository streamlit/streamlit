# -*- coding: utf-8 -*-
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
from streamlit.UploadedFileManager import UploadedFileManager

FILE_1A = UploadedFile(
    session_id="session",
    widget_id="widget",
    name="FILE_1A",
    data=b"FILE_1A",
)

FILE_1B = UploadedFile(
    session_id="session",
    widget_id="widget",
    name="FILE_1B",
    data=b"FILE_1B",
)

FILE_2 = UploadedFile(
    session_id="session2",
    widget_id="widget",
    name="FILE_2",
    data=b"FILE_2",
)


class UploadedFileManagerTest(unittest.TestCase):
    def setUp(self):
        self.mgr = UploadedFileManager()
        self.file_added_events = []
        self.mgr.on_file_added.connect(self._on_file_added)

    def _on_file_added(self, file, **kwargs):
        self.file_added_events.append(file)

    def test_add_file(self):
        self.assertIsNone(self.mgr.get_file_data("non-report", "non-widget"))

        self.mgr.add_file(FILE_1A)
        self.assertEqual(b"FILE_1A", self.mgr.get_file_data("session", "widget"))
        self.assertEqual([FILE_1A], self.file_added_events)

        # Add another file with the same ID
        self.mgr.add_file(FILE_1B)
        self.assertEqual([FILE_1A, FILE_1B], self.file_added_events)
        self.assertEqual(b"FILE_1B", self.mgr.get_file_data("session", "widget"))

    def test_remove_file(self):
        # This should not error.
        self.mgr.remove_file("non-report", "non-widget")

        self.mgr.add_file(FILE_1A)
        self.assertEqual(b"FILE_1A", self.mgr.get_file_data("session", "widget"))

        self.mgr.remove_file("session", "widget")
        self.assertIsNone(self.mgr.get_file_data("session", "widget"))
        self.assertEqual([FILE_1A], self.file_added_events)

    def test_remove_all_files(self):
        self.mgr.remove_session_files("non-report")

        self.mgr.add_file(FILE_1A)
        self.mgr.add_file(FILE_2)

        self.mgr.remove_session_files("session")
        self.assertIsNone(self.mgr.get_file_data("session", "widget"))
        self.assertEqual(b"FILE_2", self.mgr.get_file_data("session2", "widget"))
        self.assertEqual([FILE_1A, FILE_2], self.file_added_events)
