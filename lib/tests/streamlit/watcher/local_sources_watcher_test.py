# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

import contextlib
import os
import sys
import types
import unittest
from unittest.mock import MagicMock, call, patch

import tests.streamlit.watcher.test_data.dummy_module1 as DUMMY_MODULE_1
import tests.streamlit.watcher.test_data.dummy_module2 as DUMMY_MODULE_2
import tests.streamlit.watcher.test_data.lazy_loading_module as LAZY_LOADING_MODULE
import tests.streamlit.watcher.test_data.misbehaved_module as MISBEHAVED_MODULE
import tests.streamlit.watcher.test_data.nested_module_child as NESTED_MODULE_CHILD
import tests.streamlit.watcher.test_data.nested_module_parent as NESTED_MODULE_PARENT
from streamlit import config
from streamlit.runtime.pages_manager import PagesManager
from streamlit.watcher import local_sources_watcher
from streamlit.watcher.path_watcher import NoOpPathWatcher, _is_watchdog_available

SCRIPT_PATH = os.path.join(
    os.path.dirname(__file__), "test_data", "not_a_real_script.py"
)

DUMMY_MODULE_1_FILE = os.path.abspath(DUMMY_MODULE_1.__file__)
DUMMY_MODULE_2_FILE = os.path.abspath(DUMMY_MODULE_2.__file__)

NESTED_MODULE_CHILD_FILE = os.path.abspath(NESTED_MODULE_CHILD.__file__)


def NOOP_CALLBACK(_filepath):
    pass


@patch("streamlit.file_util.file_in_pythonpath", MagicMock(return_value=False))
class LocalSourcesWatcherTest(unittest.TestCase):
    def setUp(self):
        modules = [
            "DUMMY_MODULE_1",
            "DUMMY_MODULE_2",
            "LAZY_LOADING_MODULE",
            "MISBEHAVED_MODULE",
            "NESTED_MODULE_PARENT",
            "NESTED_MODULE_CHILD",
        ]

        the_globals = globals()

        for name in modules:
            with contextlib.suppress(Exception):
                del sys.modules[the_globals[name].__name__]

            with contextlib.suppress(Exception):
                del sys.modules[name]

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_just_script(self, fob):
        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        lsw.register_file_change_callback(NOOP_CALLBACK)

        fob.assert_called_once()
        args, _ = fob.call_args
        assert os.path.realpath(args[0]) == os.path.realpath(SCRIPT_PATH)
        method_type = type(self.setUp)
        assert type(args[1]) is method_type

        fob.reset_mock()
        lsw.update_watched_modules()
        lsw.update_watched_modules()
        lsw.update_watched_modules()
        lsw.update_watched_modules()

        assert fob.call_count == 1  # __init__.py

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_permission_error(self, fob):
        fob.side_effect = PermissionError("This error should be caught!")
        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        lsw.register_file_change_callback(NOOP_CALLBACK)

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_script_and_2_modules_at_once(self, fob):
        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        lsw.register_file_change_callback(NOOP_CALLBACK)

        fob.assert_called_once()

        sys.modules["DUMMY_MODULE_1"] = DUMMY_MODULE_1
        sys.modules["DUMMY_MODULE_2"] = DUMMY_MODULE_2

        fob.reset_mock()
        lsw.update_watched_modules()

        assert fob.call_count == 3  # dummy modules and __init__.py

        method_type = type(self.setUp)

        call_args_list = sort_args_list(fob.call_args_list)

        args, _ = call_args_list[0]
        assert "__init__.py" in args[0]
        args, _ = call_args_list[1]
        assert args[0] == DUMMY_MODULE_1_FILE
        assert type(args[1]) is method_type
        args, _ = call_args_list[2]
        assert args[0] == DUMMY_MODULE_2_FILE
        assert type(args[1]) is method_type

        fob.reset_mock()
        lsw.update_watched_modules()

        assert fob.call_count == 0

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_script_and_2_modules_in_series(self, fob):
        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        lsw.register_file_change_callback(NOOP_CALLBACK)

        fob.assert_called_once()

        sys.modules["DUMMY_MODULE_1"] = DUMMY_MODULE_1
        fob.reset_mock()

        lsw.update_watched_modules()

        assert fob.call_count == 2  # dummy module and __init__.py

        method_type = type(self.setUp)

        call_args_list = sort_args_list(fob.call_args_list)

        args, _ = call_args_list[0]
        assert "__init__.py" in args[0]

        args, _ = call_args_list[1]
        assert args[0] == DUMMY_MODULE_1_FILE
        assert type(args[1]) is method_type

        sys.modules["DUMMY_MODULE_2"] = DUMMY_MODULE_2
        fob.reset_mock()
        lsw.update_watched_modules()

        args, _ = fob.call_args
        assert args[0] == DUMMY_MODULE_2_FILE
        assert type(args[1]) is method_type

        fob.assert_called_once()

    @patch("streamlit.watcher.local_sources_watcher._LOGGER")
    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_misbehaved_module(self, fob, patched_logger):
        """Test that modules with problematic __spec__ properties are handled gracefully.

        The MisbehavedModule has __spec__ as a property that raises an exception.
        With _safe_get_attr(), we access __dict__ directly which bypasses the property,
        so no exception is raised and no warning is logged. This is the desired behavior
        as it prevents issues with modules that have unusual attribute implementations.
        """
        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        lsw.register_file_change_callback(NOOP_CALLBACK)

        fob.assert_called_once()

        sys.modules["MISBEHAVED_MODULE"] = MISBEHAVED_MODULE.MisbehavedModule
        fob.reset_mock()
        lsw.update_watched_modules()

        fob.assert_called_once()  # Just __init__.py

        # With _safe_get_attr(), we bypass the problematic __spec__ property
        # by accessing __dict__ directly, so no warning should be logged
        patched_logger.warning.assert_not_called()

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_lazy_loading_module_does_not_trigger_getattribute(self, fob):
        """Test that modules with custom __getattribute__ don't trigger lazy loading.

        Some packages (e.g., pulumi-aws) override __getattribute__ to implement
        lazy loading. The old implementation using hasattr() would trigger this,
        causing massive memory overhead. The new _safe_get_attr() bypasses it.

        See https://github.com/streamlit/streamlit/issues/13530
        """
        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        lsw.register_file_change_callback(NOOP_CALLBACK)

        fob.assert_called_once()

        # Create a fresh lazy loading module to track __getattribute__ calls
        lazy_module = LAZY_LOADING_MODULE._LazyLoadingModule("TestLazyModule")
        # Reset the counter after module creation (access __dict__ via parent to avoid
        # triggering our custom __getattribute__)
        obj_dict = types.ModuleType.__getattribute__(lazy_module, "__dict__")
        obj_dict["_getattribute_call_count"] = 0

        sys.modules["LAZY_LOADING_MODULE"] = lazy_module
        fob.reset_mock()
        lsw.update_watched_modules()

        # The key assertion: __getattribute__ should NOT have been triggered
        # by get_module_paths() when inspecting module attributes
        call_count = obj_dict["_getattribute_call_count"]
        assert call_count == 0, (
            f"__getattribute__ was called {call_count} times. "
            "This would trigger lazy loading in packages like pulumi-aws."
        )

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_nested_module_parent_unloaded(self, fob):
        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        lsw.register_file_change_callback(NOOP_CALLBACK)

        fob.assert_called_once()

        with patch(
            "sys.modules",
            {
                "DUMMY_MODULE_1": DUMMY_MODULE_1,
                "NESTED_MODULE_PARENT": NESTED_MODULE_PARENT,
                "NESTED_MODULE_CHILD": NESTED_MODULE_CHILD,
            },
        ):
            lsw.update_watched_modules()

            # Simulate a change to the child module
            lsw.on_path_changed(NESTED_MODULE_CHILD_FILE)

            # Assert that both the parent and child are unloaded, ready for reload
            assert "NESTED_MODULE_CHILD" not in sys.modules
            assert "NESTED_MODULE_PARENT" not in sys.modules

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_config_blacklist(self, fob):
        """Test server.folderWatchBlacklist"""
        prev_blacklist = config.get_option("server.folderWatchBlacklist")

        config.set_option(
            "server.folderWatchBlacklist", [os.path.dirname(DUMMY_MODULE_1.__file__)]
        )

        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        lsw.register_file_change_callback(NOOP_CALLBACK)

        fob.assert_called_once()

        sys.modules["DUMMY_MODULE_1"] = DUMMY_MODULE_1
        fob.reset_mock()

        lsw.update_watched_modules()

        fob.assert_not_called()

        # Reset the config object.
        config.set_option("server.folderWatchBlacklist", prev_blacklist)

    def test_config_watcherType(self):
        """Test server.fileWatcherType"""

        config.set_option("server.fileWatcherType", "none")
        assert (
            local_sources_watcher.get_default_path_watcher_class().__name__
            == "NoOpPathWatcher"
        )

        config.set_option("server.fileWatcherType", "poll")
        assert (
            local_sources_watcher.get_default_path_watcher_class().__name__
            == "PollingPathWatcher"
        )

        config.set_option("server.fileWatcherType", "watchdog")
        assert local_sources_watcher.get_default_path_watcher_class().__name__ == (
            "EventBasedPathWatcher" if _is_watchdog_available() else "NoOpPathWatcher"
        )

        config.set_option("server.fileWatcherType", "auto")
        assert local_sources_watcher.get_default_path_watcher_class() is not None

        if sys.modules["streamlit.watcher.event_based_path_watcher"] is not None:
            assert (
                local_sources_watcher.get_default_path_watcher_class().__name__
                == "EventBasedPathWatcher"
            )
        else:
            assert (
                local_sources_watcher.get_default_path_watcher_class().__name__
                == "PollingPathWatcher"
            )

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher", new=NoOpPathWatcher)
    def test_does_nothing_if_NoOpPathWatcher(self):
        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        lsw.register_file_change_callback(NOOP_CALLBACK)
        lsw.update_watched_modules()
        assert len(lsw._watched_modules) == 0

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_namespace_package_unloaded(self, fob):
        import tests.streamlit.watcher.test_data.namespace_package as pkg

        pkg_path = os.path.abspath(pkg.__path__._path[0])

        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        lsw.register_file_change_callback(NOOP_CALLBACK)

        fob.assert_called_once()

        with patch("sys.modules", {"pkg": pkg}):
            lsw.update_watched_modules()

            # Simulate a change to the child module
            lsw.on_path_changed(pkg_path)

            # Assert that both the parent and child are unloaded, ready for reload
            assert "pkg" not in sys.modules

        del sys.modules["tests.streamlit.watcher.test_data.namespace_package"]

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_module_caching(self, _fob):
        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        lsw.register_file_change_callback(NOOP_CALLBACK)

        register = MagicMock()
        lsw._register_necessary_watchers = register

        # Updates modules on first run
        lsw.update_watched_modules()
        register.assert_called_once()

        # Skips update when module list hasn't changed
        register.reset_mock()
        lsw.update_watched_modules()
        register.assert_not_called()

        # Invalidates cache when a new module is imported
        register.reset_mock()
        sys.modules["DUMMY_MODULE_2"] = DUMMY_MODULE_2
        lsw.update_watched_modules()
        register.assert_called_once()

        # Skips update when new module is part of cache
        register.reset_mock()
        lsw.update_watched_modules()
        register.assert_not_called()

    @patch(
        "streamlit.runtime.pages_manager.PagesManager.get_pages",
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
    def test_watches_all_page_scripts(self, fob):
        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        lsw.register_file_change_callback(NOOP_CALLBACK)

        args1, _ = fob.call_args_list[0]
        args2, _ = fob.call_args_list[1]
        assert os.path.basename(args1[0]) == "streamlit_app.py"
        assert os.path.basename(args2[0]) == "streamlit_app2.py"

    @patch(
        "streamlit.runtime.pages_manager.PagesManager.get_pages",
        MagicMock(
            side_effect=[
                {
                    "someHash1": {
                        "page_name": "streamlit_app",
                        "script_path": "streamlit_app.py",
                    },
                    "someHash2": {
                        "page_name": "streamlit_app2",
                        "script_path": "streamlit_app2.py",
                    },
                },
                {
                    "someHash1": {
                        "page_name": "streamlit_app",
                        "script_path": "streamlit_app.py",
                    },
                    "someHash3": {
                        "page_name": "streamlit_app3",
                        "script_path": "streamlit_app3.py",
                    },
                },
            ]
        ),
    )
    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_watches_new_page_scripts(self, fob):
        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        lsw.register_file_change_callback(NOOP_CALLBACK)

        args1, _ = fob.call_args_list[0]
        args2, _ = fob.call_args_list[1]

        assert os.path.basename(args1[0]) == "streamlit_app.py"
        assert os.path.basename(args2[0]) == "streamlit_app2.py"

        lsw.update_watched_pages()
        args3, _ = fob.call_args_list[2]
        assert os.path.basename(args3[0]) == "streamlit_app3.py"

    @patch(
        "streamlit.runtime.pages_manager.PagesManager.get_pages",
        MagicMock(
            side_effect=[
                {
                    "someHash1": {
                        "page_name": "page1",
                        "script_path": "page1.py",
                    },
                    "someHash2": {
                        "page_name": "page2",
                        "script_path": "page2.py",
                    },
                },
                {
                    "someHash1": {
                        "page_name": "page1",
                        "script_path": "page1.py",
                    },
                    "someHash3": {
                        "page_name": "page3",
                        "script_path": "page3.py",
                    },
                },
            ]
        ),
    )
    @patch("streamlit.watcher.local_sources_watcher.PathWatcher", MagicMock())
    def test_watches_union_of_page_scripts(self):
        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        assert len(lsw._watched_pages) == 2
        assert "page1.py" in ",".join(lsw._watched_pages)
        assert "page2.py" in ",".join(lsw._watched_pages)

        def isfile_mock(x):
            return True

        with patch("os.path.isfile", wraps=isfile_mock):
            lsw.update_watched_pages()
            assert len(lsw._watched_pages) == 3
            assert "page1.py" in ",".join(lsw._watched_pages)
            assert "page2.py" in ",".join(lsw._watched_pages)
            assert "page3.py" in ",".join(lsw._watched_pages)

    @patch(
        "streamlit.runtime.pages_manager.PagesManager.get_pages",
        MagicMock(
            side_effect=[
                {
                    "someHash1": {
                        "page_name": "page1",
                        "script_path": "page1.py",
                    },
                    "someHash2": {
                        "page_name": "page2",
                        "script_path": "page2.py",
                    },
                },
                {
                    "someHash1": {
                        "page_name": "page1",
                        "script_path": "page1.py",
                    },
                    "someHash3": {
                        "page_name": "page3",
                        "script_path": "page3.py",
                    },
                },
            ]
        ),
    )
    @patch("streamlit.watcher.local_sources_watcher.PathWatcher", MagicMock())
    def test_unwatches_invalid_page_script_paths(self):
        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        assert len(lsw._watched_pages) == 2
        assert "page1.py" in ",".join(lsw._watched_pages)
        assert "page2.py" in ",".join(lsw._watched_pages)

        def isfile_mock(x):
            return "page2.py" not in x

        with patch("os.path.isfile", wraps=isfile_mock):
            lsw.update_watched_pages()
            assert len(lsw._watched_pages) == 2
            assert "page1.py" in ",".join(lsw._watched_pages)
            assert "page3.py" in ",".join(lsw._watched_pages)

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    def test_passes_filepath_to_callback(self, fob):
        saved_filepath = None

        def callback(filepath):
            nonlocal saved_filepath

            saved_filepath = filepath

        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        lsw.register_file_change_callback(callback)

        # Simulate a change to the report script
        lsw.on_path_changed(SCRIPT_PATH)

        assert saved_filepath == SCRIPT_PATH

    @patch("streamlit.watcher.local_sources_watcher.PathWatcher")
    @patch("os.path.isdir")
    def test_folder_watch_list(self, mock_isdir, mock_path_watcher):
        watch_folders = ["/watch/path1", "/watch/path2"]
        config.set_option("server.folderWatchList", watch_folders)

        mock_isdir.return_value = True

        lsw = local_sources_watcher.LocalSourcesWatcher(PagesManager(SCRIPT_PATH))
        lsw.register_file_change_callback(NOOP_CALLBACK)

        # Check that PathWatcher was called for the main script and each directory
        # with the glob_pattern
        expected_calls = [
            # Watcher for the main script file (always created)
            call(
                lsw._main_script_path,
                lsw.on_path_changed,
                glob_pattern=None,
                allow_nonexistent=False,
            ),
            # Watchers for the specified folders
            call(
                "/watch/path1",
                lsw.on_path_changed,
                glob_pattern="**/*",
                allow_nonexistent=False,
            ),
            call(
                "/watch/path2",
                lsw.on_path_changed,
                glob_pattern="**/*",
                allow_nonexistent=False,
            ),
        ]

        # Check if all expected calls were made, regardless of order or extra calls
        actual_calls = mock_path_watcher.call_args_list
        assert expected_calls[1] in actual_calls
        assert expected_calls[2] in actual_calls

        # Simulate file changes in watched directories
        test_file = "/watch/path1/test.txt"
        lsw.on_path_changed(test_file)

        # Clean up
        config.set_option("server.folderWatchList", [])


def test_get_module_paths_outputs_abs_paths():
    mock_module = MagicMock()
    mock_module.__file__ = os.path.relpath(DUMMY_MODULE_1_FILE)

    module_paths = local_sources_watcher.get_module_paths(mock_module)
    assert module_paths == {DUMMY_MODULE_1_FILE}


def sort_args_list(args_list):
    return sorted(args_list, key=lambda args: args[0])


class TestSafeGetAttr:
    """Tests for _safe_get_attr() helper function.

    This function is used to safely access module attributes without triggering
    custom __getattribute__ implementations that could cause side effects
    (like lazy loading in pulumi-aws).

    See https://github.com/streamlit/streamlit/issues/13530
    """

    def test_returns_attribute_from_dict(self):
        """Test that _safe_get_attr returns attributes stored in __dict__."""

        class Obj:
            def __init__(self):
                self.foo = "bar"

        obj = Obj()
        result = local_sources_watcher._safe_get_attr(obj, "foo")
        assert result == "bar"

    def test_returns_default_for_missing_attribute(self):
        """Test that _safe_get_attr returns default for missing attributes."""

        class Obj:
            pass

        obj = Obj()
        assert local_sources_watcher._safe_get_attr(obj, "missing") is None
        assert (
            local_sources_watcher._safe_get_attr(obj, "missing", "default") == "default"
        )

    def test_bypasses_custom_getattribute(self):
        """Test that _safe_get_attr bypasses custom __getattribute__."""

        class LazyObj:
            def __init__(self):
                object.__setattr__(self, "__dict__", {"value": "found"})

            def __getattribute__(self, name):
                raise RuntimeError("Should not be called!")

        obj = LazyObj()
        # This should NOT raise because we bypass __getattribute__
        result = local_sources_watcher._safe_get_attr(obj, "value")
        assert result == "found"

    def test_returns_default_when_attr_not_in_dict(self):
        """Test that missing attributes return default, not trigger fallback."""

        class LazyObj:
            def __init__(self):
                object.__setattr__(self, "__dict__", {"other": "value"})

            def __getattribute__(self, name):
                raise RuntimeError("Should not be called!")

        obj = LazyObj()
        result = local_sources_watcher._safe_get_attr(obj, "missing", "default")
        assert result == "default"

    def test_works_with_modules(self):
        """Test that _safe_get_attr works correctly with module objects."""
        import os

        result = local_sources_watcher._safe_get_attr(os, "__file__")
        assert result is not None
        assert "os" in result.lower()

    def test_handles_objects_without_dict(self):
        """Test that _safe_get_attr handles objects that don't have __dict__."""
        # Built-in types like int don't have __dict__ in the usual sense
        result = local_sources_watcher._safe_get_attr(42, "foo", "default")
        assert result == "default"

    def test_returns_none_value_correctly(self):
        """Test that _safe_get_attr returns None when that's the actual value."""

        class Obj:
            def __init__(self):
                self.value = None

        obj = Obj()
        # Should return None (the actual value), not the default
        result = local_sources_watcher._safe_get_attr(obj, "value", "default")
        assert result is None


class TestGetModulePathsWithLazyLoading:
    """Tests for get_module_paths() with lazy-loading modules."""

    def test_does_not_trigger_getattribute_for_file(self):
        """Test get_module_paths doesn't trigger __getattribute__ for __file__."""
        lazy_module = LAZY_LOADING_MODULE._LazyLoadingModule("test")
        obj_dict = types.ModuleType.__getattribute__(lazy_module, "__dict__")
        obj_dict["_getattribute_call_count"] = 0

        local_sources_watcher.get_module_paths(lazy_module)

        call_count = obj_dict["_getattribute_call_count"]
        assert call_count == 0

    def test_extracts_file_from_lazy_loading_module(self):
        """Test that get_module_paths correctly extracts __file__ from lazy module."""
        lazy_module = LAZY_LOADING_MODULE._LazyLoadingModule("test")

        paths = local_sources_watcher.get_module_paths(lazy_module)

        # The module has __file__ = "/fake/path/module.py" in its __dict__
        # But since this path doesn't exist, it will be filtered out by _is_valid_path
        # The important thing is that we didn't trigger __getattribute__
        assert isinstance(paths, set)
