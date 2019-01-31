# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

"""Abstract file observer.

All this does is implement some basic browser-management modules, and declare
a few common abstract methods.
"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


class AbstractObserver(object):
    """Abstract file observer, meant to be overriden."""

    @staticmethod
    def close():
        """Close top-level observer object.

        IF OVERRIDEN, MUST CALL AbstractObserver.close().
        """
        LOGGER.debug('Observer closed')

    def __init__(self, file_path, callback):
        """Constructor.

        IF OVERRIDEN, MUST CALL super.__init__().

        Arguments
        ---------
        file_path : str
            Absolute path of the file to observe.

        callback : callable
            Function to call when the file changes.

        """
        self._file_path = file_path
        self._callback = callback
        LOGGER.debug('Observer created for %s', self._file_path)

        # Set of browsers which are interested in this observer being up. When
        # this is empty and deregister_browser() is called, the observer stops
        # watching for filesystem updates.
        self._browsers = set()

    def register_browser(self, browser_key):
        """Tell observer that it's in use by a certain browser tab.

        While at least one browser tab is interested in this observer, it will
        not be disposed of.

        IF OVERRIDEN, MUST CALL super.register_browser().

        Parameters
        ----------
        browser_key : str
            An opaque unique identifier of the browser tab.

        """
        self._browsers.add(browser_key)
        LOGGER.debug('Registered browser. Now have %s', len(self._browsers))

    def deregister_browser(self, browser_key):
        """Tell observer that it's no longer in use by a given browser tab.

        When no more browsers are interested in this observer, it will be
        disposed of.

        IF OVERRIDEN, MUST CALL super.deregister_browser().

        Parameters
        ----------
        browser_key : str
            An opaque unique identifier of the browser.

        """
        if browser_key in self._browsers:
            self._browsers.remove(browser_key)

        LOGGER.debug('Deregistered browser. Now have %s', len(self._browsers))

        if len(self._browsers) == 0:
            self._close()

    def is_observing_file(self):
        """Return whether this observer is "closed" (i.e. no longer observing).

        MUST BE OVERRIDEN!

        Returns
        -------
        boolean
            True if closed.

        """
        raise NotImplementedError()

    def _close(self):
        """Stop observing the file system.

        IF OVERRIDEN, MUST CALL super._close().
        """
        LOGGER.debug('Closing observer for %s', self._file_path)
