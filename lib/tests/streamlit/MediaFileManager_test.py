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

"""Unit tests for MediaFileManager"""

import unittest

from streamlit.MediaFileManager import MediaFileManager
from streamlit.MediaFileManager import _get_file_id
from datetime import date


mfm = MediaFileManager()


class UploadedFileManagerTest(unittest.TestCase):
    def test__get_file_id(self):
        """Test that file_id generation from data works as expected."""

        fake_bytes = "\x00\x00\xff\x00\x00\xff\x00\x00\xff\x00\x00\xff\x00".encode("utf-8")
        test_hash = "70ac4b6fc5504e13e07eb33dfb5a0c2042c9bf02de3ec0bf49a4e7bc"

        self.assertEqual(test_hash, _get_file_id(fake_bytes))

    def test_add_file(self):



    def test_override_file(self):


    def test_delete_file(self):



    def test_clear_files(self):
        """Test that MediaFileManager removes all files when requested."""





