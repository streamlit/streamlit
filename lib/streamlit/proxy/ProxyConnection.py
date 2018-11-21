# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

"""Stores information about local and client connections for a report."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import json

from streamlit.ReportQueue import ReportQueue

from streamlit.logger import get_logger
from streamlit.util import get_local_id
LOGGER = get_logger()


class ProxyConnection(object):
    """Represents a connection.

    The lifetime of a ProxyConnection is tied to the lifetime of client and
    browser connections.
    """

    def __init__(self, new_report_msg, name):
        """Constructor.

        Parameters
        ----------
        new_report_msg : NewReport proto
            Protobuf with all sorts of useful information about this report.
        name : str
            The report's name.

        """
        # The uuid of this report.
        self.id = new_report_msg.id

        # The current working directory from which this report was launched.
        self.cwd = new_report_msg.cwd

        # The command and command-line arguments used to launch this
        # connection.
        self.command_line = list(new_report_msg.command_line)

        # Full path of the file that caused this connection to be initiated,
        # or empty string if in REPL.
        self.source_file_path = new_report_msg.source_file_path

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

    def close_local_connection(self):
        """Close local connection."""
        self._has_local = False
        self._master_queue.close()
        for queue in self._client_queues:
            queue.close()

    def end_grace_period(self):
        """End the grace period, during which we don't close the connection.

        This indicates that the connection can be closed when it no longer has
        any client or browser connections.
        """
        self._in_grace_period = False

    def has_browser_connections(self):
        """Check whether any browsers are connected to this ProxyConnection.

        Returns
        -------
        boolean
            True if any browsers maintain connections to this queue.

        """
        return len(self._client_queues) > 0

    def can_be_deregistered(self):
        """Check whether we can deregister this connection.

        Returns
        -------
        boolean
            All conditions are met to remove this ProxyConnection from the
            Proxy's _connections table.

        """
        return not (
            self._in_grace_period or
            self._has_local or
            self.has_browser_connections())

    def enqueue(self, delta):
        """Enqueue a delta.

        Stores the delta in the master queue and transmits to all browsers
        via browser_queues.

        Parameters
        ----------
        delta : Delta
            The delta protobuf to enqueue.

        """
        self._master_queue(delta)
        for queue in self._client_queues:
            queue(delta)

    def add_client_queue(self):
        """Add a queue for a new browser by cloning the master queue.

        Returns
        -------
        ReportQueue
            The new queue.

        """
        self.end_grace_period()
        new_queue = self._master_queue.clone()
        self._client_queues.append(new_queue)
        return new_queue

    def remove_client_queue(self, queue):
        """Remove the browser queue.

        Returns
        -------
        boolean
            True iff the browser queue list is empty.

        """
        self._client_queues.remove(queue)

    def serialize_report_to_files(self):
        """Return the report as an easily-serializable list of tuples.

        Returns
        -------
        list of tuples
            A list of pairs of the form:

            [
                (filename_1, data_1),
                (filename_2, data_2), etc..
            ]

        """
        # Get the deltas. Need to clone() becuase get_deltas() clears the queue.
        deltas = self._master_queue.clone().get_deltas()
        local_id = str(get_local_id())
        manifest = dict(
            name=self.name,
            local_id=local_id,
            nDeltas=len(deltas)
        )
        return (
            [(f'reports/{self.id}/manifest.json', json.dumps(manifest))] +
            [(f'reports/{self.id}/{idx}.delta', delta.SerializeToString())
                for idx, delta in enumerate(deltas)]
        )
