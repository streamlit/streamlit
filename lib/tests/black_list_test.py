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

"""streamlit.black_list unit test."""
import unittest

from streamlit.folder_black_list import FolderBlackList


class FileIsInFolderTest(unittest.TestCase):
    def test_do_blacklist(self):
        """
        miniconda, anaconda, and .*/ folders should be blacklisted.
        """
        folder_black_list = FolderBlackList([])
        is_blacklisted = folder_black_list.is_blacklisted

        self.assertTrue(is_blacklisted("/foo/miniconda2/script.py"))
        self.assertTrue(is_blacklisted("/foo/miniconda3/script.py"))
        self.assertTrue(is_blacklisted("/foo/anaconda2/script.py"))
        self.assertTrue(is_blacklisted("/foo/anaconda3/script.py"))
        self.assertTrue(is_blacklisted("/foo/.virtualenv/script.py"))
        self.assertTrue(is_blacklisted("/foo/.venv/script.py"))
        self.assertTrue(is_blacklisted("/foo/.random_hidden_folder/script.py"))

    def test_do_blacklist_user_configured_folders(self):
        """
        Files inside user configured folders should be blacklisted.
        """
        folder_black_list = FolderBlackList(["/bar/some_folder"])
        is_blacklisted = folder_black_list.is_blacklisted
        self.assertTrue(is_blacklisted("/bar/some_folder/script.py"))

    def test_do_not_blacklist(self):
        """
        Ensure we're not accidentally blacklisting things we shouldn't be.
        """
        folder_black_list = FolderBlackList([])
        is_blacklisted = folder_black_list.is_blacklisted

        self.assertFalse(is_blacklisted("/foo/not_blacklisted/script.py"))
        self.assertFalse(is_blacklisted("/foo/not_blacklisted/.hidden_script.py"))
