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

"""streamlit.black_list unit test."""
import os
import sys
import unittest

from streamlit import config
from streamlit.black_list import BlackList

if sys.version_info[0] == 2:
    import test_data.dummy_module1 as DUMMY_MODULE_1
    import test_data.dummy_module2 as DUMMY_MODULE_2
else:
    import tests.streamlit.watcher.test_data.dummy_module1 as DUMMY_MODULE_1
    import tests.streamlit.watcher.test_data.dummy_module2 as DUMMY_MODULE_2

REPORT_PATH = os.path.join(os.path.dirname(__file__), "test_data/not_a_real_script.py")
NOOP_CALLBACK = lambda x: x

DUMMY_MODULE_1_FILE = os.path.abspath(DUMMY_MODULE_1.__file__)
DUMMY_MODULE_2_FILE = os.path.abspath(DUMMY_MODULE_2.__file__)

class FileIsInFolderTest(unittest.TestCase):
    def test_do_blacklist(self):
        """
        miniconda, anaconda, and .*/ folders should be blacklisted.
        """
        black_list = BlackList([])
        is_blacklisted = black_list.is_blacklisted

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
        black_list = BlackList(["/bar/some_folder"])
        is_blacklisted = black_list.is_blacklisted
        self.assertTrue(is_blacklisted("/bar/some_folder/script.py"))


    def test_do_not_blacklist(self):
        """
        Ensure we're not accidentally blacklisting things we shouldn't be.
        """
        black_list = BlackList([])
        is_blacklisted = black_list.is_blacklisted

        self.assertFalse(is_blacklisted("/foo/not_blacklisted/script.py"))
        self.assertFalse(is_blacklisted("/foo/not_blacklisted/.hidden_script.py"))

        # Reset the config object.
        config.set_option("server.folderWatchBlacklist", prev_blacklist)
