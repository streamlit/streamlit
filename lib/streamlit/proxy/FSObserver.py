# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

"""A class that watches the file system"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import hashlib
import os
import time

from watchdog.observers import Observer
from watchdog.events import PatternMatchingEventHandler

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


class FSObserver(object):
    """A file system observer."""

    def __init__(self, source_file_path, callback):
        """Constructor.

        Parameters
        ----------
        source_file_path : str
            File that should be observed.
        callback: callback
            The function that should get called when something changes in
            source_file_path. This function will be called on the observer
            thread, which is created by the watchdog module. Parameters:
            - FileSystemEvent: the event.

        """
        self._file_path = source_file_path
        LOGGER.debug('Will observe file system for %s', self._file_path)

        self._observer = None
        self._callback = callback
        self._is_observing = False

        # Set of browser tabs which are interested in this observer being up.
        # When this is empty and deregister_browser() is called, the observer
        # stops watching for filesystem updates.
        self._browsers = set()

    def _initialize_observer(self):
        """Initialize the filesystem observer."""
        if len(self._file_path) == 0:
            LOGGER.debug('No source file to watch. Running from REPL?')
            return

        folder = os.path.dirname(self._file_path)

        fsev_handler = FSEventHandler(
            fn_to_run=self._on_event,
            file_to_observe=self._file_path)

        self._is_observing = True
        self._observer = Observer()
        self._observer.schedule(fsev_handler, folder, recursive=False)

        try:
            self._observer.start()
            LOGGER.debug('Observing file system at %s', folder)
        except OSError as e:
            self._observer = None
            LOGGER.error('Could not start file system observer %s', e)

    def _on_event(self, event):
        """Event handler for filesystem changes.

        This simply calls the callback function passed during construction.

        IMPORTANT: This method runs in a thread owned by the watchdog module
        (i.e. *not* in the Tornado IO loop).

        Parameters
        ----------
        event : FileSystemEvent

        """
        if self._is_observing:
            LOGGER.debug('Rerunning source script.')
            self._callback(event)
        else:
            LOGGER.debug('Will not rerun source script.')

    def register_browser(self, browser_key):
        """Tell observer that it's in use by browser identified by key.

        While at least one browser is interested in this observer, it will not
        be disposed of.

        Parameters
        ----------
        browser_key : str
            A unique identifier of the browser.

        """
        if len(self._browsers) == 0:
            self._initialize_observer()
        self._browsers.add(browser_key)
        LOGGER.debug('Registered browsers. Now have %s', len(self._browsers))

    def deregister_browser(self, browser_key):
        """Tell observer that it's no longer useful for a given browser.

        When no more browsers are interested in this observer, it will be
        disposed of.

        Parameters
        ----------
        browser_key : str
            A unique identifier of the browser.

        """
        if browser_key in self._browsers:
            self._browsers.remove(browser_key)

        LOGGER.debug('Deregistered browsers. Now have %s', len(self._browsers))

        if len(self._browsers) == 0:
            self._close()

    def is_closed(self):
        """Return whether this observer is "closed" (i.e. no longer observing).

        Returns
        -------
        boolean
            True if closed.

        """
        return not self._is_observing

    def _close(self):
        """Stop observing the file system."""
        if self._observer is None:
            return

        LOGGER.debug(
            'Closing file system observer for %s',
            self._file_path)

        self._is_observing = False
        self._observer.stop()

        # Wait til thread terminates.
        self._observer.join(timeout=5)


class FSEventHandler(PatternMatchingEventHandler):
    """Object that calls a function whenever a watched file changes.

    IMPORTANT: This object's methods run in a thread owned by the watchdog
    module (i.e. *not* in the Tornado IO loop).
    """

    def __init__(self, fn_to_run, file_to_observe):
        """Constructor.

        Parameters
        ----------
        fn_to_run : callable
            The function to call whenever a watched file changes. Takes the
            FileSystemEvent as a parameter.

        file_to_observe : str
            The full path fo the file to observe.

        """
        super(FSEventHandler, self).__init__(patterns=[file_to_observe])
        self._fn_to_run = fn_to_run
        self._file_to_observe = file_to_observe
        self._prev_md5 = _calc_md5(file_to_observe)

    def on_any_event(self, event):
        """Catch-all event handler.

        Parameters
        ----------
        event : FileSystemEvent
            The event object representing the file system event.

        """
        new_md5 = _calc_md5(self._file_to_observe)
        if new_md5 != self._prev_md5:
            LOGGER.debug('File MD5 changed.')
            self._prev_md5 = new_md5
            self._fn_to_run(event)
        else:
            LOGGER.debug('File MD5 did not change.')


# How many times to try to grab the MD5 hash.
MAX_RETRIES = 5

# How long to wait between retries.
RETRY_WAIT_SECS = 0.1


def _calc_md5(file_path):
    """Calculate the MD5 checksum of the given file.

    Parameters
    ----------
    file_path : str
        The path of the file to check.

    Returns
    -------
    str
        The MD5 checksum.

    """
    file_str = None

    # There's a race condition where sometimes file_path no longer exists when
    # we try to read it (since the file is in the process of being written).
    # So here we retry a few times using this loop. See issue #186.
    for i in range(MAX_RETRIES):
        try:
            with open(file_path) as f:
                file_str = f.read()
                break
        except FileNotFoundError as e:
            if i >= MAX_RETRIES - 1:
                raise e
            # OK to call time.sleep() here (instead of ioloop.sleep() because
            # this is running on another thread.
            time.sleep(RETRY_WAIT_SECS)

    md5 = hashlib.md5()
    md5.update(file_str.encode('utf-8'))
    return md5.digest()
