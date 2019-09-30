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

"""streamlit.LocalSourcesWatcher unit test."""

import os
import sys
import unittest

from mock import patch

from streamlit import config
from streamlit.Report import Report
from streamlit.watcher import LocalSourcesWatcher
from streamlit.watcher.LocalSourcesWatcher import _file_is_in_folder


class FileIsInFolderTest(unittest.TestCase):
    def test_file_in_folder(self):
        # Test with and without trailing slash
        ret = LocalSourcesWatcher._file_is_in_folder("/a/b/c/foo.py", "/a/b/c/")
        self.assertTrue(ret)
        ret = LocalSourcesWatcher._file_is_in_folder("/a/b/c/foo.py", "/a/b/c")
        self.assertTrue(ret)

    def test_file_not_in_folder(self):
        # Test with and without trailing slash
        ret = LocalSourcesWatcher._file_is_in_folder("/a/b/c/foo.py", "/d/e/f/")
        self.assertFalse(ret)
        ret = LocalSourcesWatcher._file_is_in_folder("/a/b/c/foo.py", "/d/e/f")
        self.assertFalse(ret)

    def test_rel_file_not_in_folder(self):
        # Test with and without trailing slash
        ret = LocalSourcesWatcher._file_is_in_folder("foo.py", "/d/e/f/")
        self.assertFalse(ret)
        ret = LocalSourcesWatcher._file_is_in_folder("foo.py", "/d/e/f")
        self.assertFalse(ret)

    def test_file_in_folder_glob(self):
        ret = LocalSourcesWatcher._file_is_in_folder("/a/b/c/foo.py", "**/c")
        self.assertTrue(ret)

    def test_file_not_in_folder_glob(self):
        ret = LocalSourcesWatcher._file_is_in_folder("/a/b/c/foo.py", "**/f")
        self.assertFalse(ret)

    def test_rel_file_not_in_folder_glob(self):
        ret = LocalSourcesWatcher._file_is_in_folder("foo.py", "**/f")
        self.assertFalse(ret)


if sys.version_info[0] == 2:
    import test_data.dummy_module1 as DUMMY_MODULE_1
    import test_data.dummy_module2 as DUMMY_MODULE_2
    import test_data.misbehaved_module as MISBEHAVED_MODULE
else:
    import tests.streamlit.watcher.test_data.dummy_module1 as DUMMY_MODULE_1
    import tests.streamlit.watcher.test_data.dummy_module2 as DUMMY_MODULE_2
    import tests.streamlit.watcher.test_data.misbehaved_module as MISBEHAVED_MODULE

REPORT_PATH = os.path.join(os.path.dirname(__file__), "test_data/not_a_real_script.py")
REPORT = Report(REPORT_PATH, "test command line")
NOOP_CALLBACK = lambda x: x

DUMMY_MODULE_1_FILE = os.path.abspath(DUMMY_MODULE_1.__file__)
DUMMY_MODULE_2_FILE = os.path.abspath(DUMMY_MODULE_2.__file__)


class LocalSourcesWatcherTest(unittest.TestCase):
    def setUp(self):
        modules = ["DUMMY_MODULE_1", "DUMMY_MODULE_2", "MISBEHAVED_MODULE"]

        the_globals = globals()

        for name in modules:
            try:
                del sys.modules[the_globals[name].__name__]
            except:
                pass

            try:
                del sys.modules[name]
            except:
                pass

    @patch("streamlit.watcher.LocalSourcesWatcher.FileWatcher")
    def test_just_script(self, fob):
        lso = LocalSourcesWatcher.LocalSourcesWatcher(REPORT, NOOP_CALLBACK)

        fob.assert_called_once()
        args = fob.call_args.args
        self.assertEqual(args[0], REPORT_PATH)
        method_type = type(self.test_just_script)
        self.assertEqual(type(args[1]), method_type)

        fob.reset_mock()
        lso.update_watched_modules()
        lso.update_watched_modules()
        lso.update_watched_modules()
        lso.update_watched_modules()

        self.assertEqual(fob.call_count, 1)  # __init__.py

    @patch("streamlit.watcher.LocalSourcesWatcher.FileWatcher")
    def test_script_and_2_modules_at_once(self, fob):
        lso = LocalSourcesWatcher.LocalSourcesWatcher(REPORT, NOOP_CALLBACK)

        fob.assert_called_once()

        sys.modules["DUMMY_MODULE_1"] = DUMMY_MODULE_1
        sys.modules["DUMMY_MODULE_2"] = DUMMY_MODULE_2

        fob.reset_mock()
        lso.update_watched_modules()

        self.assertEqual(fob.call_count, 3)  # dummy modules and __init__.py

        method_type = type(self.test_just_script)

        call_args_list = sort_args_list(fob.call_args_list)

        args = call_args_list[0].args
        self.assertTrue("__init__.py" in args[0])
        args = call_args_list[1].args
        self.assertEqual(args[0], DUMMY_MODULE_1_FILE)
        self.assertEqual(type(args[1]), method_type)
        args = call_args_list[2].args
        self.assertEqual(args[0], DUMMY_MODULE_2_FILE)
        self.assertEqual(type(args[1]), method_type)

        fob.reset_mock()
        lso.update_watched_modules()

        self.assertEqual(fob.call_count, 0)

    @patch("streamlit.watcher.LocalSourcesWatcher.FileWatcher")
    def test_script_and_2_modules_in_series(self, fob):
        lso = LocalSourcesWatcher.LocalSourcesWatcher(REPORT, NOOP_CALLBACK)

        fob.assert_called_once()

        sys.modules["DUMMY_MODULE_1"] = DUMMY_MODULE_1
        fob.reset_mock()

        lso.update_watched_modules()

        self.assertEqual(fob.call_count, 2)  # dummy module and __init__.py

        method_type = type(self.test_just_script)

        call_args_list = sort_args_list(fob.call_args_list)

        args = call_args_list[0].args
        self.assertTrue("__init__.py" in args[0])

        args = call_args_list[1].args
        self.assertEqual(args[0], DUMMY_MODULE_1_FILE)
        self.assertEqual(type(args[1]), method_type)

        sys.modules["DUMMY_MODULE_2"] = DUMMY_MODULE_2
        fob.reset_mock()
        lso.update_watched_modules()

        args = fob.call_args.args
        self.assertEqual(args[0], DUMMY_MODULE_2_FILE)
        self.assertEqual(type(args[1]), method_type)

        fob.assert_called_once()

    @patch("streamlit.watcher.LocalSourcesWatcher.FileWatcher")
    def test_misbehaved_module(self, fob):
        lso = LocalSourcesWatcher.LocalSourcesWatcher(REPORT, NOOP_CALLBACK)

        fob.assert_called_once()

        sys.modules["MISBEHAVED_MODULE"] = MISBEHAVED_MODULE.MisbehavedModule
        fob.reset_mock()
        lso.update_watched_modules()

        fob.assert_called_once()  # Just __init__.py

    @patch("streamlit.watcher.LocalSourcesWatcher.FileWatcher")
    def test_config_blacklist(self, fob):
        """Test server.folderWatchBlacklist"""
        prev_blacklist = config.get_option("server.folderWatchBlacklist")

        config.set_option(
            "server.folderWatchBlacklist", [os.path.dirname(DUMMY_MODULE_1.__file__)]
        )

        lso = LocalSourcesWatcher.LocalSourcesWatcher(REPORT, NOOP_CALLBACK)

        fob.assert_called_once()

        sys.modules["DUMMY_MODULE_1"] = DUMMY_MODULE_1
        fob.reset_mock()

        lso.update_watched_modules()

        fob.assert_not_called()

        # Reset the config object.
        config.set_option("server.folderWatchBlacklist", prev_blacklist)

    @patch("streamlit.watcher.LocalSourcesWatcher.FileWatcher")
    def test_auto_blacklist(self, _):
        prev_blacklist = config.get_option("server.folderWatchBlacklist")
        config.set_option("server.folderWatchBlacklist", [])

        lso = LocalSourcesWatcher.LocalSourcesWatcher(REPORT, NOOP_CALLBACK)

        def is_blacklisted(filepath):
            return any(
                _file_is_in_folder(filepath, blacklisted_folder)
                for blacklisted_folder in lso._folder_blacklist
            )

        # miniconda, anaconda, and .*/ folders should be blacklisted
        self.assertTrue(is_blacklisted("/foo/miniconda2/script.py"))
        self.assertTrue(is_blacklisted("/foo/miniconda3/script.py"))
        self.assertTrue(is_blacklisted("/foo/anaconda2/script.py"))
        self.assertTrue(is_blacklisted("/foo/anaconda3/script.py"))
        self.assertTrue(is_blacklisted("/foo/.virtualenv/script.py"))
        self.assertTrue(is_blacklisted("/foo/.venv/script.py"))
        self.assertTrue(is_blacklisted("/foo/.random_hidden_folder/script.py"))

        # Ensure we're not accidentally blacklisting things we shouldn't be
        self.assertFalse(is_blacklisted("/foo/not_blacklisted/script.py"))
        self.assertFalse(is_blacklisted("/foo/not_blacklisted/.hidden_script.py"))

        # Reset the config object.
        config.set_option("server.folderWatchBlacklist", prev_blacklist)


def sort_args_list(args_list):
    return sorted(args_list, key=lambda args: args[0])
