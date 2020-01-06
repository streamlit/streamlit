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

from streamlit.UploadedFileManager import UploadedFileManager
from datetime import date


class UploadedFileManagerTest(unittest.TestCase):
    def test_msg_hash(self):
        """Test that ForwardMsg hash generation works as expected"""

        widget_idA = "A0123456789"
        widget_idB = "B0123456789"
        file_name = "example_file.png"
        file_bytes = bytearray(
            "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789",
            "utf-8",
        )
        uploaded_file_mgr = UploadedFileManager()

        uploaded_file_mgr.create_or_clear_file(
            widget_idA, file_name, len(file_bytes), date.today(), 1
        )
        uploaded_file_mgr.create_or_clear_file(
            widget_idB, file_name, len(file_bytes), date.today(), 2
        )

        progress_a = uploaded_file_mgr.process_chunk(widget_idA, 0, file_bytes)
        self.assertEqual(progress_a, 1)

        progress_b = uploaded_file_mgr.process_chunk(widget_idB, 0, file_bytes[0:50])
        self.assertEqual(progress_b, 0.5)

        progress_b = uploaded_file_mgr.process_chunk(widget_idB, 1, file_bytes[50:100])
        self.assertEqual(progress_b, 1)

        progress_a, data_a = uploaded_file_mgr.get_data(widget_idA)
        progress_b, data_b = uploaded_file_mgr.get_data(widget_idB)
        self.assertEqual(progress_a, 100)
        self.assertEqual(progress_b, 100)
        self.assertEqual(len(data_a), len(file_bytes))
        self.assertEqual(data_a, file_bytes)
        self.assertEqual(data_a, data_b)

        uploaded_file_mgr.delete_file(widget_idA)

        progress_a, data_a = uploaded_file_mgr.get_data(widget_idA)
        self.assertEqual(progress_a, 0)
        self.assertEqual(data_a, None)

        uploaded_file_mgr.delete_all_files()
        progress_b, data_b = uploaded_file_mgr.get_data(widget_idB)
        self.assertEqual(progress_b, 0)
        self.assertEqual(data_b, None)
