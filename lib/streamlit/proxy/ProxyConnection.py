# -*- coding: future_fstrings -*-

"""Stores information shared by both local_connections and
client_connections related to a particular report."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import json

from streamlit.ReportQueue import ReportQueue
from streamlit import protobuf

from streamlit.logger import get_logger
from streamlit.util import get_local_id
LOGGER = get_logger()

class ProxyConnection(object):
    """Stores information shared by both local_connections and
    client_connections related to a particular report."""

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
