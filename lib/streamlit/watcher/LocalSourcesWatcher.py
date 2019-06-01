# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import os
import sys
import collections

try:
    # Python 2
    import imp as importlib
except ImportError:
    # Python 3
    import importlib

try:
    # If the watchdog module is installed.
    from streamlit.watcher.EventBasedFileWatcher import EventBasedFileWatcher as FileWatcher
except ImportError:
    # Fallback that doesn't use watchdog.
    from streamlit.watcher.PollingFileWatcher import PollingFileWatcher as FileWatcher

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


WatchedModule = collections.namedtuple(
    'WatchedModule', ['watcher', 'module_name'])


class LocalSourcesWatcher(object):
    def __init__(self, report, on_file_changed):
        self._report = report
        self._on_file_changed = on_file_changed
        self._is_closed = False

        # A dict of filepath -> WatchedModule.
        self._watched_modules = {}

        self._register_watcher(
            self._report.script_path,
            module_name=None,  # Only the root script has None here.
        )

    def on_file_changed(self, filepath):
        if filepath not in self._watched_modules:
            LOGGER.error('Received event for non-watched file', filepath)
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
            watcher=FileWatcher(filepath, self.on_file_changed),
            module_name=module_name,
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
            spec = getattr(module, '__spec__', None)

            if spec is None:
                filepath = getattr(module, '__file__', None)
                if filepath is None:
                    # Some modules have neither a spec nor a file. But we can
                    # ignore those since they're not the user-created modules
                    # we want to watch anyway.
                    continue
            else:
                filepath = spec.origin

            if filepath is None:
                # Built-in modules (and other stuff) don't have origins.
                continue

            filepath = os.path.abspath(filepath)

            if not os.path.isfile(filepath):
                # There are some modules that have a .origin, but don't point
                # to real files. For example, there's a module where .origin is
                # 'built-in'.
                continue

            file_is_new = filepath not in self._watched_modules
            file_is_local = _file_is_in_folder(
                filepath, self._report.script_folder)

            local_filepaths.append(filepath)

            if file_is_local and file_is_new:
                self._register_watcher(filepath, name)

        # Remove no-longer-depended-on files from self._watched_modules
        # Will this ever happen?
        for filepath in self._watched_modules:
            if filepath not in local_filepaths:
                self._deregister_watcher(filepath)


def _file_is_in_folder(filepath, folderpath):
    filepath = os.path.abspath(filepath)
    return filepath.startswith(folderpath)
