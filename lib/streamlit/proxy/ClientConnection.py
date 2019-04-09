# Copyright 2018 Streamlit Inc. All rights reserved.

"""Stores information about client and browser connections for a report."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from blinker import Signal
import json
import os
import urllib

from streamlit import config
from streamlit import util
from streamlit.ReportQueue import ReportQueue

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


def _get_source_file_path(file_path, command_line):
    """The path of the file on disk that should be observed for changes.
    This is sometimes equal to the input file_path, but there are
    instances when it's not (e.g. when the report is run from the REPL,
    or launched as a python module).

    This value can be None.

    Parameters
    ----------
    file_path : str
        The file_path that the report was launched with

    command_line : [str]
        The command line that the report was launched with
    """
    # If running as a module, ie python -m foo.bar, then the file_path
    # is actually /path/to/runpy.py  Instead we should use the
    # command_line which would be /path/to/foo/bar.py
    if os.path.basename(file_path) == 'runpy.py':
        file_path = command_line[0]

    if len(file_path) == 0:
        # DeltaConnection.py sets source_file_path to '' when running from
        # the REPL.
        return None

    return file_path


class ClientConnection(object):
    """Represents a connection between the client and proxy.

    A new ClientConnection is created when a client connects to the Proxy via
    ClientWebSocket. The lifetime of the ClientConnection is tied to the
    lifetime of the client and all browser connections observing the client's
    report.

    When a report is re-run, a new ClientConnection is created, replacing
    the existing ClientConnection for that report.
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

        # The source file path of the report. A FileObserver can watch this
        # path and trigger a re-run of the report if it changes.
        # This value can be None.
        self.source_file_path = _get_source_file_path(
            new_report_msg.source_file_path,
            self.command_line)

        # The name for this report.
        self.name = name

        # When the client connection ends, this flag becomes false.
        self._is_connected = True

        # Before receiving connection and the timeout hits, the connection
        # is in a "grace period" in which it can't be deregistered.
        self._in_grace_period = True

        # A master queue for incoming deltas, replicated for each connection.
        self._master_queue = ReportQueue()

        # Each connection additionally gets its own queue.
        self._browser_queues = []

        # Signal that's emitted when the client disconnects
        self.on_closed = Signal(
            doc="""Emitted when self.is_connected becomes False""")

    @property
    def is_connected(self):
        """True while the client is running its report, and is therefore
        connected to the proxy. Becomes False when the report finishes running
        and the client disconnects."""
        return self._is_connected

    def close_connection(self):
        """Close the client connection."""
        self._is_connected = False
        self._master_queue.close()
        for queue in self._browser_queues:
            queue.close()
        self.on_closed.send(self)

    def end_grace_period(self):
        """End the grace period, during which we don't close the connection.

        This indicates that the connection can be closed when it no longer has
        any client or browser connections.
        """
        self._in_grace_period = False

    def has_browser_connections(self):
        """Check whether any browsers are connected to this ClientConnection.

        Returns
        -------
        boolean
            True if any browsers maintain connections to this queue.

        """
        return len(self._browser_queues) > 0

    def can_be_deregistered(self):
        """Check whether we can deregister this connection.

        Returns
        -------
        boolean
            All conditions are met to remove this ClientConnection from the
            Proxy's _connections table.

        """
        return not (
            self._in_grace_period or
            self._is_connected or
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
        for queue in self._browser_queues:
            queue(delta)

    def add_browser_queue(self):
        """Add a queue for a new browser by cloning the master queue.

        Returns
        -------
        ReportQueue
            The new queue.

        """
        self.end_grace_period()
        new_queue = self._master_queue.clone()
        self._browser_queues.append(new_queue)
        return new_queue

    def remove_browser_queue(self, queue):
        """Remove the browser queue.

        Returns
        -------
        boolean
            True iff the browser queue list is empty.

        """
        self._browser_queues.remove(queue)

    def get_url(self, proxy_address):
        """Get the URL for this report, for access from inside this LAN.

        Parameters
        ----------
        proxy_address : str
            The IP or DNS address to use for the proxy.

        Returns
        -------
        str
            The URL.

        """
        port = _get_browser_address_bar_port()
        quoted_name = urllib.parse.quote_plus(self.name)
        return ('http://%(proxy_address)s:%(port)s/?name=%(quoted_name)s' % {
            'proxy_address': proxy_address,
            'port': port,
            'quoted_name': quoted_name,
        })

    def serialize_running_report_to_files(self):
        """Return a running report as an easily-serializable list of tuples.

        Returns
        -------
        list of tuples
            See `CloudStorage.save_report_files()` for schema. But as to the
            output of this method, it's just a manifest pointing to the Proxy
            so browsers who go to the shareable report URL can connect to it
            live.

        """
        LOGGER.debug('Serializing running report')
        manifest = self._build_manifest(
            status=_Status.RUNNING,
            external_proxy_ip=util.get_external_ip(),
            internal_proxy_ip=util.get_internal_ip(),
        )

        manifest_json = json.dumps(manifest).encode('utf-8')
        return [(
            'reports/%s/manifest.json' % self.id,
            manifest_json
        )]

    def serialize_final_report_to_files(self):
        """Return the report as an easily-serializable list of tuples.

        Returns
        -------
        list of tuples
            See `CloudStorage.save_report_files()` for schema. But as to the
            output of this method, it's (1) a simple manifest and (2) a bunch
            of serialized Deltas.

        """
        LOGGER.debug('Serializing final report')

        # Get the deltas. Need to clone() becuase get_deltas() clears the queue.
        deltas = self._master_queue.clone().get_deltas()
        manifest = self._build_manifest(
            status=_Status.DONE,
            n_deltas=len(deltas)
        )
        manifest_json = json.dumps(manifest).encode('utf-8')

        delta_tuples = [(
            'reports/%(id)s/%(idx)s.delta' % {'id': self.id, 'idx': idx},
            delta.SerializeToString()
        ) for idx, delta in enumerate(deltas)]

        manifest_tuples = [(
            'reports/%(id)s/manifest.json' % {'id': self.id}, manifest_json)]

        # Manifest must be at the end, so clients don't connect and read the
        # manifest while the deltas haven't been saved yet.
        return delta_tuples + manifest_tuples

    def _build_manifest(
            self, status, n_deltas=None, external_proxy_ip=None,
            internal_proxy_ip=None):
        """Build a manifest dict for this report.

        Parameters
        ----------
        status : _Status.DONE | _Status.RUNNING
            The report status. If the script is still executing, then the
            status should be RUNNING. Otherwise, DONE.
        n_deltas : int | None
            Only when status is DONE. The number of deltas that this report
            is made of.
        external_proxy_ip : str | None
            Only when status is RUNNING. The IP of the Proxy's websocket.
        internal_proxy_ip : str | None
            Only when status is RUNNING. The IP of the Proxy's websocket.

        Returns
        -------
        dict
            The actual manifest. Schema:
            - name: str,
            - localId: str,
            - nDeltas: int | None,
            - proxyStatus: 'running' | 'done',
            - externalProxyIP: str | None,
            - internalProxyIP: str | None,
            - proxyPort: int

        """
        if status == _Status.RUNNING:
            configured_proxy_address = config.get_option('browser.proxyAddress')
        else:
            configured_proxy_address = None

        return dict(
            name=self.name,
            nDeltas=n_deltas,
            proxyStatus=status,
            configuredProxyAddress=configured_proxy_address,
            externalProxyIP=external_proxy_ip,
            internalProxyIP=internal_proxy_ip,
            # Don't use _get_browser_address_bar_port() here, since we want the
            # websocket port, not the web server port. (These are the same in
            # prod, but different in dev)
            proxyPort=config.get_option('browser.proxyPort'),
        )


class _Status(object):
    DONE = 'done'
    RUNNING = 'running'


def _get_browser_address_bar_port():
    """Get the report URL that will be shown in the browser's address bar.

    That is, this is the port where static assets will be served from. In dev,
    this is different from the URL that will be used to connect to the
    proxy-browser websocket.

    """
    if config.get_option('proxy.useNode'):
        return 3000
    return config.get_option('browser.proxyPort')
