# Copyright 2018 Streamlit Inc. All rights reserved.

"""A class that watches the file system"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import os

from tornado.ioloop import IOLoop
from streamlit.watcher import util

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


_POLLING_PERIOD_SECS = 0.2


class PollingFileWatcher(object):
    """Watches a single file on disk via a polling loop"""

    @staticmethod
    def close_all():
        """Close top-level watcher object.

        This is a no-op, and exists for interface parity with
        EventBasedFileWatcher.
        """
        LOGGER.debug('Watcher closed')

    def __init__(self, file_path, on_file_changed):
        """Constructor.

        Arguments
        ---------
        file_path : str
            Absolute path of the file to watch.

        on_file_changed : callable
            Function to call when the file changes. This function should
            take the changed file's path as a parameter.

        """
        self._file_path = file_path
        self._on_file_changed = on_file_changed

        self._active = True
        self._modification_time = os.stat(self._file_path).st_mtime
        self._md5 = util.calc_md5_with_blocking_retries(self._file_path)
        self._schedule()

    def _schedule(self):
        loop = IOLoop.current()
        loop.call_later(_POLLING_PERIOD_SECS, self._check_if_file_changed)

    def _check_if_file_changed(self):
        if not self._active:
            # Don't call self._schedule()
            return

        modification_time = os.stat(self._file_path).st_mtime
        if modification_time <= self._modification_time:
            self._schedule()
            return

        self._modification_time = modification_time

        md5 = util.calc_md5_with_blocking_retries(self._file_path)
        if md5 == self._md5:
            self._schedule()
            return

        self._md5 = md5

        LOGGER.debug('Change detected: %s', self._file_path)

        loop = IOLoop.current()
        loop.spawn_callback(self._on_file_changed, self._file_path)

        self._schedule()

    def close(self):
        """Stop watching the file system."""
        self._active = False
