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

if sys.version_info[0] == 2:
    import test_data.dummy_module1 as DUMMY_MODULE_1
    import test_data.dummy_module2 as DUMMY_MODULE_2
    import test_data.misbehaved_module as MISBEHAVED_MODULE

    import test_data.nested_module_parent as NESTED_MODULE_PARENT
    import test_data.nested_module_child as NESTED_MODULE_CHILD
else:
    import tests.streamlit.watcher.test_data.dummy_module1 as DUMMY_MODULE_1
    import tests.streamlit.watcher.test_data.dummy_module2 as DUMMY_MODULE_2
    import tests.streamlit.watcher.test_data.misbehaved_module as MISBEHAVED_MODULE

    import tests.streamlit.watcher.test_data.nested_module_parent as NESTED_MODULE_PARENT
    import tests.streamlit.watcher.test_data.nested_module_child as NESTED_MODULE_CHILD

REPORT_PATH = os.path.join(os.path.dirname(__file__), "test_data/not_a_real_script.py")
REPORT = Report(REPORT_PATH, "test command line")

DUMMY_MODULE_1_FILE = os.path.abspath(DUMMY_MODULE_1.__file__)
DUMMY_MODULE_2_FILE = os.path.abspath(DUMMY_MODULE_2.__file__)

NESTED_MODULE_CHILD_FILE = os.path.abspath(NESTED_MODULE_CHILD.__file__)


def NOOP_CALLBACK():
    pass


class LocalSourcesWatcherTest(unittest.TestCase):
    def setUp(self):
        modules = [
            "DUMMY_MODULE_1",
            "DUMMY_MODULE_2",
            "MISBEHAVED_MODULE",
            "NESTED_MODULE_PARENT",
            "NESTED_MODULE_CHILD",
        ]

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
    def test_permission_error(self, fob):
        from streamlit import compatibility

        if compatibility.is_running_py3():
            ErrorType = PermissionError
        else:
            ErrorType = OSError

        fob.side_effect = ErrorType("This error should be caught!")
        lso = LocalSourcesWatcher.LocalSourcesWatcher(REPORT, NOOP_CALLBACK)

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
    def test_nested_module_parent_unloaded(self, fob):
        lso = LocalSourcesWatcher.LocalSourcesWatcher(REPORT, NOOP_CALLBACK)

        fob.assert_called_once()

        with patch(
            "sys.modules",
            {
                "DUMMY_MODULE_1": DUMMY_MODULE_1,
                "NESTED_MODULE_PARENT": NESTED_MODULE_PARENT,
                "NESTED_MODULE_CHILD": NESTED_MODULE_CHILD,
            },
        ):
            lso.update_watched_modules()

            # Simulate a change to the child module
            lso.on_file_changed(NESTED_MODULE_CHILD_FILE)

            # Assert that both the parent and child are unloaded, ready for reload
            self.assertNotIn("NESTED_MODULE_CHILD", sys.modules)
            self.assertNotIn("NESTED_MODULE_PARENT", sys.modules)

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


def sort_args_list(args_list):
    return sorted(args_list, key=lambda args: args[0])
