# Copyright 2019 Streamlit Inc. All rights reserved.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

try:
    from streamlit.proxy.FileEventObserver import FileEventObserver as FileObserver
except ImportError:
    from streamlit.proxy.PollingFileObserver import PollingFileObserver as FileObserver


class ReportObserver(object):
    """Wraps a FileObserver and allows observation to be enabled and
    disabled"""

    def __init__(self, initially_enabled, file_path, on_file_changed):
        """Creates a new ReportObserver

        Parameters
        ----------
        initially_enabled : bool
            True if this object should be created in the enabled state

        file_path : str
            Absolute path of the file to observe.

        on_file_changed : callable
            Function to call when the file changes.
        """
        self._enabled = initially_enabled
        self._file_path = file_path
        self._on_file_changed = on_file_changed
        self._browser_keys = set()
        self._file_observer = None

    def register_browser(self, browser_key):
        """Registers a browser as interested in the report."""
        self._browser_keys.add(browser_key)
        self._update_file_observer()

    def deregister_browser(self, browser_key):
        """Deregisters a browser from the wrapped ReportObserver."""
        self._browser_keys.remove(browser_key)
        self._update_file_observer()

    def close(self):
        """Closes the wrapped ReportObserver and clears all
        registered browsers."""
        self._browser_keys.clear()
        self._update_file_observer()

    @property
    def has_registered_browsers(self):
        """True if this object has any registered browser keys"""
        return len(self._browser_keys) > 0

    def get_enabled(self):
        return self._enabled

    def set_enabled(self, enable):
        """Sets this object's enabled state. The wrapped FileObserver
        will be created or destroyed as appropriate.
        """
        self._enabled = enable
        self._update_file_observer()

    def _update_file_observer(self):
        """Creates the file observer if it should exist; destroys
        it if it should not.

        The observer should exist if self._enabled is True and we
        have at least one registered browser.
        """
        should_observe = self._enabled and len(self._browser_keys) > 0
        if should_observe and self._file_observer is None:
            self._file_observer = self._create_file_observer()
        elif not should_observe and self._file_observer is not None:
            self._file_observer.close()
            self._file_observer = None

    def _create_file_observer(self):
        return FileObserver(self._file_path, self._on_file_changed)
