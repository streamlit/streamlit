# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

"""Unit tests for FileManager"""

import unittest

from streamlit.fileManager import FileManager
from datetime import date
import os

class FileManagerTest(unittest.TestCase):
    def test_msg_hash(self):
        """Test that ForwardMsg hash generation works as expected"""

        widget_idA = 'A0123456789'
        widget_idB = 'B0123456789'
        file_name = 'example_file.png'
        file_bytes = bytearray('0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789', 'utf-8')
        file_manager = FileManager()
        
        file_manager.locate_new_file(widget_idA, file_name, len(file_bytes), date.today(), 1)
        file_manager.locate_new_file(widget_idB, file_name, len(file_bytes), date.today(), 2)

        progress, name_fileA = file_manager.porcess_chunk(widget_idA, 0, file_bytes)
        self.assertEqual(progress, 1)
        self.assertTrue(os.path.isfile(name_fileA))

        progress, name_fileB = file_manager.porcess_chunk(widget_idB, 0, file_bytes[0:50])
        self.assertEqual(progress, 0.5)

        progress, name_fileB = file_manager.porcess_chunk(widget_idB, 1, file_bytes[50:100])
        self.assertEqual(progress, 1)
        self.assertTrue(os.path.isfile(name_fileB))

        with open(name_fileB, "rb") as f:
            data = f.read()
            f.close()
            self.assertEqual(file_bytes, data)
        
        file_manager.delete_file(widget_idA)
        self.assertFalse(os.path.isfile(name_fileA))

        file_manager.delete_all_files()
        self.assertFalse(os.path.isfile(name_fileB))