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

"""streamlit.LocalSourcesWatcher unit test."""

from unittest.mock import MagicMock, patch
import os
import sys
import unittest

from streamlit import config
from streamlit.watcher import local_sources_watcher
from streamlit.watcher.path_watcher import NoOpPathWatcher, watchdog_available

import tests.streamlit.watcher.test_data.dummy_module1 as DUMMY_MODULE_1
import tests.streamlit.watcher.test_data.dummy_module2 as DUMMY_MODULE_2
import tests.streamlit.watcher.test_data.misbehaved_module as MISBEHAVED_MODULE
import tests.streamlit.watcher.test_data.nested_module_parent as NESTED_MODULE_PARENT
import tests.streamlit.watcher.test_data.nested_module_child as NESTED_MODULE_CHILD

SCRIPT_PATH = os.path.join(os.path.dirname(__file__), "test_data/not_a_real_script.py")

DUMMY_MODULE_1_FILE = os.path.abspath(DUMMY_MODULE_1.__file__)
DUMMY_MODULE_2_FILE = os.path.abspath(DUMMY_MODULE_2.__file__)

NESTED_MODULE_CHILD_FILE = os.path.abspath(NESTED_MODULE_CHILD.__file__)


def NOOP_CALLBACK(_filepath):
    pass


@patch("streamlit.source_util._cached_pages", new=None)
@patch("streamlit.file_util.file_in_pythonpath", return_value=False)
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

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_just_script(self, fob, _):
        lso = local_sources_watcher.LocalSourcesWatcher(SCRIPT_PATH)
        lso.register_file_change_callback(NOOP_CALLBACK)

        fob.assert_called_once()
        args, _ = fob.call_args
        self.assertEqual(args[0], SCRIPT_PATH)
        method_type = type(self.setUp)
        self.assertEqual(type(args[1]), method_type)

        fob.reset_mock()
        lso.update_watched_modules()
        lso.update_watched_modules()
        lso.update_watched_modules()
        lso.update_watched_modules()

        self.assertEqual(fob.call_count, 1)  # __init__.py

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_permission_error(self, fob, _):
        fob.side_effect = PermissionError("This error should be caught!")
        lso = local_sources_watcher.LocalSourcesWatcher(SCRIPT_PATH)
        lso.register_file_change_callback(NOOP_CALLBACK)

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_script_and_2_modules_at_once(self, fob, _):
        lso = local_sources_watcher.LocalSourcesWatcher(SCRIPT_PATH)
        lso.register_file_change_callback(NOOP_CALLBACK)

        fob.assert_called_once()

        sys.modules["DUMMY_MODULE_1"] = DUMMY_MODULE_1
        sys.modules["DUMMY_MODULE_2"] = DUMMY_MODULE_2

        fob.reset_mock()
        lso.update_watched_modules()

        self.assertEqual(fob.call_count, 3)  # dummy modules and __init__.py

        method_type = type(self.setUp)

        call_args_list = sort_args_list(fob.call_args_list)

        args, _ = call_args_list[0]
        self.assertTrue("__init__.py" in args[0])
        args, _ = call_args_list[1]
        self.assertEqual(args[0], DUMMY_MODULE_1_FILE)
        self.assertEqual(type(args[1]), method_type)
        args, _ = call_args_list[2]
        self.assertEqual(args[0], DUMMY_MODULE_2_FILE)
        self.assertEqual(type(args[1]), method_type)

        fob.reset_mock()
        lso.update_watched_modules()

        self.assertEqual(fob.call_count, 0)

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_script_and_2_modules_in_series(self, fob, _):
        lso = local_sources_watcher.LocalSourcesWatcher(SCRIPT_PATH)
        lso.register_file_change_callback(NOOP_CALLBACK)

        fob.assert_called_once()

        sys.modules["DUMMY_MODULE_1"] = DUMMY_MODULE_1
        fob.reset_mock()

        lso.update_watched_modules()

        self.assertEqual(fob.call_count, 2)  # dummy module and __init__.py

        method_type = type(self.setUp)

        call_args_list = sort_args_list(fob.call_args_list)

        args, _ = call_args_list[0]
        self.assertTrue("__init__.py" in args[0])

        args, _ = call_args_list[1]
        self.assertEqual(args[0], DUMMY_MODULE_1_FILE)
        self.assertEqual(type(args[1]), method_type)

        sys.modules["DUMMY_MODULE_2"] = DUMMY_MODULE_2
        fob.reset_mock()
        lso.update_watched_modules()

        args, _ = fob.call_args
        self.assertEqual(args[0], DUMMY_MODULE_2_FILE)
        self.assertEqual(type(args[1]), method_type)

        fob.assert_called_once()

    @patch("streamlit.watcher.local_sources_watcher.LOGGER")
    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_misbehaved_module(self, fob, patched_logger, _):
        lso = local_sources_watcher.LocalSourcesWatcher(SCRIPT_PATH)
        lso.register_file_change_callback(NOOP_CALLBACK)

        fob.assert_called_once()

        sys.modules["MISBEHAVED_MODULE"] = MISBEHAVED_MODULE.MisbehavedModule
        fob.reset_mock()
        lso.update_watched_modules()

        fob.assert_called_once()  # Just __init__.py

        patched_logger.warning.assert_called_once_with(
            "Examining the path of MisbehavedModule raised: Oh noes!"
        )

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_nested_module_parent_unloaded(self, fob, _):
        lso = local_sources_watcher.LocalSourcesWatcher(SCRIPT_PATH)
        lso.register_file_change_callback(NOOP_CALLBACK)

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

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_config_blacklist(self, fob, _):
        """Test server.folderWatchBlacklist"""
        prev_blacklist = config.get_option("server.folderWatchBlacklist")

        config.set_option(
            "server.folderWatchBlacklist", [os.path.dirname(DUMMY_MODULE_1.__file__)]
        )

        lso = local_sources_watcher.LocalSourcesWatcher(SCRIPT_PATH)
        lso.register_file_change_callback(NOOP_CALLBACK)

        fob.assert_called_once()

        sys.modules["DUMMY_MODULE_1"] = DUMMY_MODULE_1
        fob.reset_mock()

        lso.update_watched_modules()

        fob.assert_not_called()

        # Reset the config object.
        config.set_option("server.folderWatchBlacklist", prev_blacklist)

    def test_config_watcherType(self, _):
        """Test server.fileWatcherType"""

        config.set_option("server.fileWatcherType", "none")
        self.assertEqual(
            local_sources_watcher.get_default_path_watcher_class().__name__,
            "NoOpPathWatcher",
        )

        config.set_option("server.fileWatcherType", "poll")
        self.assertEqual(
            local_sources_watcher.get_default_path_watcher_class().__name__,
            "PollingPathWatcher",
        )

        config.set_option("server.fileWatcherType", "watchdog")
        self.assertEqual(
            local_sources_watcher.get_default_path_watcher_class().__name__,
            "EventBasedPathWatcher" if watchdog_available else "NoOpPathWatcher",
        )

        config.set_option("server.fileWatcherType", "auto")
        self.assertIsNotNone(local_sources_watcher.get_default_path_watcher_class())

        if sys.modules["streamlit.watcher.event_based_path_watcher"] is not None:
            self.assertEqual(
                local_sources_watcher.get_default_path_watcher_class().__name__,
                "EventBasedPathWatcher",
            )
        else:
            self.assertEqual(
                local_sources_watcher.get_default_path_watcher_class().__name__,
                "PollingPathWatcher",
            )

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher", new=NoOpPathWatcher)
    def test_does_nothing_if_NoOpPathWatcher(self, _):
        lsw = local_sources_watcher.LocalSourcesWatcher(SCRIPT_PATH)
        lsw.register_file_change_callback(NOOP_CALLBACK)
        lsw.update_watched_modules()
        self.assertEqual(len(lsw._watched_modules), 0)

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_namespace_package_unloaded(self, fob, _):
        import tests.streamlit.watcher.test_data.namespace_package as pkg

        pkg_path = os.path.abspath(pkg.__path__._path[0])

        lsw = local_sources_watcher.LocalSourcesWatcher(SCRIPT_PATH)
        lsw.register_file_change_callback(NOOP_CALLBACK)

        fob.assert_called_once()

        with patch("sys.modules", {"pkg": pkg}):
            lsw.update_watched_modules()

            # Simulate a change to the child module
            lsw.on_file_changed(pkg_path)

            # Assert that both the parent and child are unloaded, ready for reload
            self.assertNotIn("pkg", sys.modules)

        del sys.modules["tests.streamlit.watcher.test_data.namespace_package"]

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_module_caching(self, _fob, _):
        lso = local_sources_watcher.LocalSourcesWatcher(SCRIPT_PATH)
        lso.register_file_change_callback(NOOP_CALLBACK)

        register = MagicMock()
        lso._register_necessary_watchers = register

        # Updates modules on first run
        lso.update_watched_modules()
        register.assert_called_once()

        # Skips update when module list hasn't changed
        register.reset_mock()
        lso.update_watched_modules()
        register.assert_not_called()

        # Invalidates cache when a new module is imported
        register.reset_mock()
        sys.modules["DUMMY_MODULE_2"] = DUMMY_MODULE_2
        lso.update_watched_modules()
        register.assert_called_once()

        # Skips update when new module is part of cache
        register.reset_mock()
        lso.update_watched_modules()
        register.assert_not_called()

    @patch(
        "streamlit.watcher.local_sources_watcher.get_pages",
        MagicMock(
            return_value={
                "someHash1": {
                    "page_name": "streamlit_app",
                    "script_path": "streamlit_app.py",
                },
                "someHash2": {
                    "page_name": "streamlit_app2",
                    "script_path": "streamlit_app2.py",
                },
            }
        ),
    )
    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_watches_all_page_scripts(self, fob, _):
        lsw = local_sources_watcher.LocalSourcesWatcher(SCRIPT_PATH)
        lsw.register_file_change_callback(NOOP_CALLBACK)

        args1, _ = fob.call_args_list[0]
        args2, _ = fob.call_args_list[1]

        assert args1[0] == "streamlit_app.py"
        assert args2[0] == "streamlit_app2.py"

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_passes_filepath_to_callback(self, fob, _):
        saved_filepath = None

        def callback(filepath):
            nonlocal saved_filepath

            saved_filepath = filepath

        lso = local_sources_watcher.LocalSourcesWatcher(SCRIPT_PATH)
        lso.register_file_change_callback(callback)

        # Simulate a change to the report script
        lso.on_file_changed(SCRIPT_PATH)

        self.assertEqual(saved_filepath, SCRIPT_PATH)


def test_get_module_paths_outputs_abs_paths():
    mock_module = MagicMock()
    mock_module.__file__ = os.path.relpath(DUMMY_MODULE_1_FILE)

    module_paths = local_sources_watcher.get_module_paths(mock_module)
    assert module_paths == {DUMMY_MODULE_1_FILE}


def sort_args_list(args_list):
    return sorted(args_list, key=lambda args: args[0])
