# -*- coding: future_fstrings -*-

"""A class that watches the file system"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import os

from watchdog.observers import Observer
from watchdog.events import PatternMatchingEventHandler

from streamlit import config

from streamlit.logger import get_logger
from streamlit.util import get_local_id
LOGGER = get_logger()


class FSObserver(object):
    """A file system observer."""

    @staticmethod
    def get_key(connection):
        return (
            connection.cwd,
            connection.command_line[0],
            connection.command_line[1])

    def __init__(self, connection, callback):
        """Constructor.

        Parameters
        ----------
        connection : ProxyConnection
            The connection that is asking for an observer to be created.
        callback: function(FSObserver, FileSystemEvent)
            The function that should get called when something changes in
            path_to_observe. This function will be called on the observer
            thread, which is created by the watchdog module.

        This object also takes into account the following config settings:

            - proxy.watchUpdatesRecursively
            - proxy.watchPatterns
            - proxy.ignorePatterns

        """
        self.key = FSObserver.get_key(connection)
        LOGGER.info(f'Will observe file system for: {self.key}')

        self._observer = None
        self._callback = callback
        self._is_closed = False

        self.command_line = connection.command_line
        self.cwd = connection.cwd

        self._initialize_observer_with_fallback(connection.source_file_path)

        # Set of clients who are interested in this observer being up.  When
        # this is empty and deregister_consumer() is called, the observer stops
        # watching for filesystem updates.
        self._consumers = set()

    def _initialize_observer_with_fallback(self, source_file_path):
        """Start the filesystem observer.

        Fall back to non-recursive mode if needed.

        Parameters
        ----------
        source_file_path : str
            Full path of the file that initiated the report.
        """
        LOGGER.info(f'Opening file system observer for {self.key}')

        recursive = config.get_option('proxy.watchUpdatesRecursively')
        self._observer = self._initialize_observer(source_file_path, recursive)

        # If the previous command errors out, try a fallback command that is
        # less useful but also less likely to fail.
        if self._observer is None and recursive is True:
            self._observer = self._initialize_observer(
                source_file_path, recursive=False)  # No longer recursive.

    def _initialize_observer(self, source_file_path, recursive=True):
        """Initialize the filesystem observer.

        Parameters
        ----------
        source_file_path : str
            Full path of the file that initiated the report.
        recursive : boolean
            If true, will observe path_to_observe and its subfolders recursively.

        Passes kwargs to FSEventHandler.

        """
        path_to_observe = os.path.dirname(source_file_path)

        patterns = config.get_option('proxy.watchPatterns')
        ignore_patterns = config.get_option('proxy.ignorePatterns')
        watch_file_only = config.get_option('proxy.watchFileOnly')

        if watch_file_only:
            # proxy.watchFileOnly takes precedence over the following:
            patterns = [source_file_path]
            ignore_patterns = []

        fsev_handler = FSEventHandler(
            fn_to_run=self._on_event,
            patterns=patterns,
            ignore_patterns=ignore_patterns,
        )

        observer = Observer()
        observer.schedule(fsev_handler, path_to_observe, recursive)

        try:
            observer.start()
            LOGGER.info(f'Observing file system at {path_to_observe}')
        except OSError as e:
            observer = None
            LOGGER.error(f'Could not start file system observer: {e}')

        return observer

    def _on_event(self, event):
        """Function that gets called when filesystem changes are detected.

        This simply calls the callback function passed during construction.

        Parameters
        ----------
        event : FileSystemEvent
        """
        self._callback(self, event)

    def register_consumer(self, key):
        """Tell observer that it's in use by consumer identified by key.

        While at least one consumer is interested in this observer, it will not
        be disposed of.

        Parameters
        ----------
        key : any
            A unique identifier of the consumer that is interested in this
            observer.
        """
        self._consumers.add(key)

    def deregister_consumer(self, key):
        """Tell observer that it's no longer useful for a given consumer.

        When no more consumers are interested in this observer, it will be
        disposed of.

        Parameters
        ----------
        key : any
            A unique identifier of the consumer that is interested in this
            observer.
        """
        if key in self._consumers:
            self._consumers.remove(key)

        if len(self._consumers) == 0:
            self._close()

    def is_closed(self):
        """Return whether this observer is "closed" (i.e. no longer observing).

        Returns
        -------
        boolean
            True if closed.
        """
        return self._is_closed

    def _close(self):
        """Stops observing the file system."""
        LOGGER.info(f'Closing file system observer for {self.key}')

        if self._observer is not None:
            self._is_closed = True
            self._observer.stop()

            # Wait til thread terminates.
            self._observer.join(timeout=5)


class FSEventHandler(PatternMatchingEventHandler):
    """Calls a function whenever a watched file changes."""

    def __init__(self, fn_to_run, *args, **kwargs):
        """Constructor.

        Parameters
        ----------
        fn_to_run : function
            The function to call whenever a watched file changes. Takes the
            FileSystemEvent as a parameter.

        Also accepts the following parameters from PatternMatchingEventHandler:
        patterns and ignore_patterns.

        More information at https://pythonhosted.org/watchdog/api.html#watchdog.events.PatternMatchingEventHandler
        """
        LOGGER.info(f'Starting FSEventHandler with args={args} kwargs={kwargs}')

        super(FSEventHandler, self).__init__(*args, **kwargs)
        self._fn_to_run = fn_to_run

    def on_any_event(self, event):
        """Catch-all event handler.

        See https://pythonhosted.org/watchdog/api.html#watchdog.events.FileSystemEventHandler.on_any_event

        Parameters
        ----------
        event : FileSystemEvent
            The event object representing the file system event.

        """
        self._fn_to_run(event)
