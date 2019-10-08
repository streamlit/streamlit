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

import fnmatch
import os
import sys
import collections

try:
    # Python 2
    import imp as importlib
except ImportError:
    # Python 3
    import importlib

from streamlit import config
from streamlit import util
from streamlit.folder_black_list import FolderBlackList

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)

try:
    # If the watchdog module is installed.
    from streamlit.watcher.EventBasedFileWatcher import (
        EventBasedFileWatcher as FileWatcher,
    )
except ImportError:
    # Fallback that doesn't use watchdog.
    from streamlit.watcher.PollingFileWatcher import PollingFileWatcher as FileWatcher

    if not config.get_option("global.disableWatchdogWarning"):
        msg = "\n  $ xcode-select --install" if util.is_darwin() else ""

        LOGGER.warning(
            """
  For better performance, install the Watchdog module:
  %s
  $ pip install watchdog

        """
            % msg
        )


# Streamlit never watches files in the folders below.
DEFAULT_FOLDER_BLACKLIST = [
    "**/.*",
    "**/anaconda2",
    "**/anaconda3",
    "**/miniconda2",
    "**/miniconda3",
]


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
            LOGGER.error("Received event for non-watched file", filepath)
            return

        wm = self._watched_modules[filepath]

        if wm.module_name is not None and wm.module_name in sys.modules:
            del sys.modules[wm.module_name]

        self._on_file_changed()

    def close(self):
        for wm in self._watched_modules.values():
            wm.watcher.close()
        self._watched_modules = {}
        self._is_closed = True

    def _register_watcher(self, filepath, module_name):
        wm = WatchedModule(
            watcher=FileWatcher(filepath, self.on_file_changed), module_name=module_name
        )
        self._watched_modules[filepath] = wm

    def _deregister_watcher(self, filepath):
        if filepath not in self._watched_modules:
            return

        if filepath == self._report.script_path:
            return

        wm = self._watched_modules[filepath]
        wm.watcher.close()
        del self._watched_modules[filepath]

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

                file_is_new = filepath not in self._watched_modules
                file_is_local = util.file_is_in_folder_glob(
                    filepath, self._report.script_folder
                )

                local_filepaths.append(filepath)

                if file_is_local and file_is_new:
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
