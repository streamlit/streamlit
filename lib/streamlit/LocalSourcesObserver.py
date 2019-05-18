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
    from streamlit.proxy.FileEventObserver import FileEventObserver as FileObserver
except ImportError:
    # Fallback that doesn't use watchdog.
    from streamlit.proxy.PollingFileObserver import PollingFileObserver as FileObserver

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


ObservedModule = collections.namedtuple(
    'ObservedModule', ['observer', 'module_name'])


class LocalSourcesObserver(object):
    def __init__(self, report, on_file_changed):
        self._report = report
        self._on_file_changed = on_file_changed
        self._is_closed = False

        # A dict of filepath -> ObservedModule.
        self._observed_modules = {}

        self._register_observer(
            self._report.script_path,
            module_name=None,  # Only the root script has None here.
        )

    def on_file_changed(self, filepath):
        if filepath not in self._observed_modules:
            LOGGER.error('Received event for non-observed file', filepath)
            return

        om = self._observed_modules[filepath]

        if om.module_name is not None and om.module_name in sys.modules:
            del sys.modules[om.module_name]

        self._on_file_changed()

    def close(self):
        for om in self._observed_modules.values():
            om.observer.close()
        self._observed_modules = {}
        self._is_closed = True

    def _register_observer(self, filepath, module_name):
        om = ObservedModule(
            observer=FileObserver(filepath, self.on_file_changed),
            module_name=module_name,
        )
        self._observed_modules[filepath] = om

    def _deregister_observer(self, filepath):
        if filepath not in self._observed_modules:
            return

        if filepath == self._report.script_path:
            return

        om = self._observed_modules[filepath]
        om.observer.close()
        del self._observed_modules[filepath]

    def update_watched_modules(self):
        if self._is_closed:
            return

        local_filepaths = []

        for name, module in sys.modules.items():
            spec = getattr(module, '__spec__', None)

            if spec is None:
                filepath = getattr(module, '__file__', None)
                if filepath is None:
                    # Some modules have neither a spec nor a file. But we can
                    # ignore those since they're not the user-created modules
                    # we want to observe anyway.
                    continue
            else:
                filepath = spec.origin

            if filepath is None:
                # Built-in modules (and other stuff) don't have origins.
                continue

            filepath = os.path.abspath(filepath)

            file_is_new = filepath not in self._observed_modules
            file_is_local = _file_is_in_folder(
                filepath, self._report.script_folder)

            local_filepaths.append(filepath)

            if file_is_local and file_is_new:
                self._register_observer(filepath, name)

        # Remove no-longer-depended-on files from self._observed_modules
        # Will this ever happen?
        for filepath in self._observed_modules:
            if filepath not in local_filepaths:
                self._deregister_observer(filepath)


def _file_is_in_folder(filepath, folderpath):
    filepath = os.path.abspath(filepath)
    return filepath.startswith(folderpath)
