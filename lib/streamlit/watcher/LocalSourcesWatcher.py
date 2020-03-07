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

import fnmatch
import importlib
import os
import sys
import collections

from streamlit import config
from streamlit import env_util
from streamlit import file_util
from streamlit.folder_black_list import FolderBlackList

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)

try:
    # If the watchdog module is installed.
    from streamlit.watcher.EventBasedFileWatcher import EventBasedFileWatcher

    watchdog_available = True
except ImportError:
    watchdog_available = False
    if not config.get_option("global.disableWatchdogWarning"):
        msg = "\n  $ xcode-select --install" if env_util.IS_DARWIN else ""

        LOGGER.warning(
            """
  For better performance, install the Watchdog module:
  %s
  $ pip install watchdog

        """
            % msg
        )


def get_file_watcher_class():
    watcher_type = config.get_option("server.fileWatcherType")

    if watcher_type == "auto":
        if watchdog_available:
            return EventBasedFileWatcher
        else:
            from streamlit.watcher.PollingFileWatcher import PollingFileWatcher

            return PollingFileWatcher
    elif watcher_type == "watchdog" and watchdog_available:
        return EventBasedFileWatcher
    elif watcher_type == "poll":
        from streamlit.watcher.PollingFileWatcher import PollingFileWatcher

        return PollingFileWatcher
    else:
        return None


FileWatcher = get_file_watcher_class()

WatchedModule = collections.namedtuple("WatchedModule", ["watcher", "module_name"])


class LocalSourcesWatcher(object):
    def __init__(self, report, on_file_changed):
        self._report = report
        self._on_file_changed = on_file_changed
        self._is_closed = False

        # Blacklist for folders that should not be watched
        self._folder_black_list = FolderBlackList(
            config.get_option("server.folderWatchBlacklist")
        )

        # A dict of filepath -> WatchedModule.
        self._watched_modules = {}

        self._register_watcher(
            self._report.script_path,
            module_name=None,  # Only the root script has None here.
        )

    def on_file_changed(self, filepath):
        if filepath not in self._watched_modules:
            LOGGER.error("Received event for non-watched file: %s", filepath)
            return

        # Workaround:
        # Delete all watched modules so we can guarantee changes to the
        # updated module are reflected on reload.
        #
        # In principle, for reloading a given module, we only need to unload
        # the module itself and all of the modules which import it (directly
        # or indirectly) such that when we exec the application code, the
        # changes are reloaded and reflected in the running application.
        #
        # However, determining all import paths for a given loaded module is
        # non-trivial, and so as a workaround we simply unload all watched
        # modules.
        for wm in self._watched_modules.values():
            if wm.module_name is not None and wm.module_name in sys.modules:
                del sys.modules[wm.module_name]

        self._on_file_changed()

    def close(self):
        for wm in self._watched_modules.values():
            wm.watcher.close()
        self._watched_modules = {}
        self._is_closed = True

    def _register_watcher(self, filepath, module_name):
        if FileWatcher is None:
            return

        try:
            wm = WatchedModule(
                watcher=FileWatcher(filepath, self.on_file_changed),
                module_name=module_name,
            )
        except PermissionError:
            # If you don't have permission to read this file, don't even add it
            # to watchers.
            return

        self._watched_modules[filepath] = wm

    def _deregister_watcher(self, filepath):
        if filepath not in self._watched_modules:
            return

        if filepath == self._report.script_path:
            return

        wm = self._watched_modules[filepath]
        wm.watcher.close()
        del self._watched_modules[filepath]

    def _file_is_new(self, filepath):
        return filepath not in self._watched_modules

    def _file_should_be_watched(self, filepath):
        # Using short circuiting for performance.
        return self._file_is_new(filepath) and (
            file_util.file_is_in_folder_glob(filepath, self._report.script_folder)
            or file_util.file_in_pythonpath(filepath)
        )

    def update_watched_modules(self):
        if self._is_closed:
            return

        local_filepaths = []

        # Clone modules dict here because we may alter the original dict inside
        # the loop.
        modules = dict(sys.modules)

        for name, module in modules.items():
            try:
                spec = getattr(module, "__spec__", None)

                if spec is None:
                    filepath = getattr(module, "__file__", None)
                    if filepath is None:
                        # Some modules have neither a spec nor a file. But we
                        # can ignore those since they're not the user-created
                        # modules we want to watch anyway.
                        continue
                else:
                    filepath = spec.origin

                if filepath is None:
                    # Built-in modules (and other stuff) don't have origins.
                    continue

                filepath = os.path.abspath(filepath)

                if not os.path.isfile(filepath):
                    # There are some modules that have a .origin, but don't
                    # point to real files. For example, there's a module where
                    # .origin is 'built-in'.
                    continue

                if self._folder_black_list.is_blacklisted(filepath):
                    continue

                local_filepaths.append(filepath)

                if self._file_should_be_watched(filepath):
                    self._register_watcher(filepath, name)

            except Exception:
                # In case there's a problem introspecting some specific module,
                # let's not stop the entire loop from running.  For example,
                # the __spec__ field in some modules (like IPython) is actually
                # a dynamic property, which can crash if the underlying
                # module's code has a bug (as discovered by one of our users).
                continue

        # Clone dict here because we may alter the original dict inside the
        # loop.
        watched_modules = dict(self._watched_modules)

        # Remove no-longer-depended-on files from self._watched_modules
        # Will this ever happen?
        for filepath in watched_modules:
            if filepath not in local_filepaths:
                self._deregister_watcher(filepath)
