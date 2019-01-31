# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

"""A class that watches the file system"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import os

from tornado.ioloop import IOLoop
from streamlit.proxy import proxy_util
from streamlit.proxy.AbstractObserver import AbstractObserver

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


_POLLING_PERIOD_SECS = 0.2


class ReportObserver(AbstractObserver):
    """Observes single files so long as there's a browser interested in it."""

    def __init__(self, file_path, callback):
        """Constructor.

        See super for docs.
        """
        super(ReportObserver, self).__init__(file_path, callback)
        self._active = False
        self._modification_time = os.stat(self._file_path).st_mtime
        self._md5 = proxy_util.calc_md5_with_blocking_retries(self._file_path)

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

        md5 = proxy_util.calc_md5_with_blocking_retries(self._file_path)
        if md5 == self._md5:
            self._schedule()
            return

        self._md5 = md5

        LOGGER.debug('Change detected: %s', self._file_path)

        loop = IOLoop.current()
        loop.call_later(0, self._callback)

        self._schedule()

    def register_browser(self, browser_key):
        """Tell observer that it's in use by browser identified by key.

        While at least one browser is interested in this observer, it will not
        be disposed of.

        Parameters
        ----------
        browser_key : str
            A unique identifier of the browser.

        """
        self._active = True

        if len(self._browsers) == 0:
            self._schedule()

        super(ReportObserver, self).register_browser(browser_key)

    # No need to override:
    # def register_browser(self, browser_key):

    def is_observing_file(self):
        """Return whether this observer is "closed" (i.e. no longer observing).

        Returns
        -------
        boolean
            True if closed.

        """
        return self._active

    def _close(self):
        """Stop observing the file system."""
        self._active = False
        super(ReportObserver, self)._close()
