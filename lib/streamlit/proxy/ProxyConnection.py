# -*- coding: future_fstrings -*-

"""Stores information shared by both local_connections and
client_connections related to a particular report."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import json
import subprocess

from watchdog.observers import Observer
from watchdog.events import PatternMatchingEventHandler

from streamlit import config
from streamlit.ReportQueue import ReportQueue
from streamlit import protobuf

from streamlit.logger import get_logger
from streamlit.util import get_local_id
LOGGER = get_logger()

class ProxyConnection(object):
    """Represents a connection.

    IMPORTANT: Always call .close() on this object when you're done with it.
    """

    def __init__(self, new_report_msg, name):
        # The uuid of this report.
        self.id = new_report_msg.id

        # The current working directory from which this report was launched.
        self.cwd = new_report_msg.cwd

        # The command line arguments used to launch this message
        self.command_line = list(new_report_msg.command_line)

        # The name for this report.
        self.name = name

        # When the local connection ends, this flag becomes false.
        self._has_local = True

        # Before recieving connection and the the timeout hits, the connection
        # is in a "grace period" in which it can't be deregistered.
        self._in_grace_period = True

        # A master queue for incoming deltas, replicated for each connection.
        self._master_queue = ReportQueue()

        # Each connection additionally gets its own queue.
        self._client_queues = []

        self._file_system_observer = self._initialize_file_system_observer()

    def close(self):
        """Close the connection."""
        LOGGER.info('Closing ProxyConnection')

        if self._file_system_observer is not None:
            LOGGER.info('Closing file system observer')
            self._file_system_observer.stop()

            # Wait til thread terminates. Should be quick.
            self._file_system_observer.join(timeout=5)

    def _initialize_file_system_observer(self):
        path_to_observe = self.cwd
        recursive = config.get_option('proxy.watchRecursively')
        patterns = config.get_option('proxy.watchPatterns')
        ignore_patterns = config.get_option('proxy.ignorePatterns')
        ignore_directories = config.get_option('proxy.ignoreSubfolders')

        handler = FSEventHandler(
            fn_to_run=self._on_file_system_event,
            patterns=patterns,
            ignore_patterns=ignore_patterns,
            ignore_directories=ignore_directories,
        )

        file_system_observer = Observer()
        file_system_observer.schedule(
            handler, path_to_observe, recursive=recursive)

        LOGGER.info(
            f'Will observe file system recursively at: {path_to_observe}')

        try:
            file_system_observer.start()
            LOGGER.info(
                f'Observing file system recursively at: {path_to_observe}')
        except OSError as e:
            file_system_observer = None
            LOGGER.error(f'Could not start file system observer: {e}')

        return file_system_observer

    def _on_file_system_event(self, event):
        LOGGER.info(f'File system event: [{event.event_type}] {event.src_path}')
        # TODO(tvst): Move this and similar code from ClientWebSocket.py to a
        # single file.
        process = subprocess.Popen(self.command_line, cwd=self.cwd)
        process.wait()

    def finished_local_connection(self):
        """Removes the flag indicating an active local connection."""
        self._has_local = False
        self._master_queue.close()
        for queue in self._client_queues:
            queue.close()

    def end_grace_period(self):
        """Inicates that the grace period is over and the connection can be
        closed when it no longer has any local or client connections."""
        self._in_grace_period = False

    def can_be_deregistered(self):
        """Indicates whether we can deregister this connection."""
        has_clients = len(self._client_queues) > 0
        return not (self._in_grace_period or self._has_local or has_clients)

    def enqueue(self, delta):
        """Stores the delta in the master queue and transmits to all clients
        via client_queues."""
        self._master_queue(delta)
        for queue in self._client_queues:
            queue(delta)

    def add_client_queue(self):
        """Adds a queue for a new client by cloning the master queue."""
        self.end_grace_period()
        new_queue = self._master_queue.clone()
        self._client_queues.append(new_queue)
        return new_queue

    def remove_client_queue(self, queue):
        """Removes the client queue. Returns True iff the client queue list is
        empty."""
        self._client_queues.remove(queue)

    def serialize_report_to_files(self):
        """Returns a list of pairs to be serialized of the form:
            [
                (filename_1, data_1),
                (filename_2, data_2), etc..
            ]
        """
        # Get the deltas. Need to clone() becuase get_deltas() clears the queue.
        deltas = self._master_queue.clone().get_deltas()
        local_id = str(get_local_id())
        manifest = dict(
            name = self.name,
            local_id = local_id,
            nDeltas = len(deltas)
        )
        return \
            [(f'reports/{self.id}/manifest.json', json.dumps(manifest))] + \
            [(f'reports/{self.id}/{idx}.delta', delta.SerializeToString())
                for idx, delta in enumerate(deltas)]


class FSEventHandler(PatternMatchingEventHandler):
    """Calls a function whenever a watched file changes."""

    def __init__(self, fn_to_run, *args, **kwargs):
        """Constructor.

        Parameters
        ----------
        fn_to_run : function
            The function to call whenever a watched file changes. Takes the
            FileSystemEvent as a parameter.

        Also accepts all parameters from PatternMatchingEventHandler, such as:
        patterns, ignore_patterns, ignore_directories.

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

