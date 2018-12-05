# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

"""Stores information about client and browser connections for a report."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import json
import urllib

from streamlit import config
from streamlit import util
from streamlit.ReportQueue import ReportQueue

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


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

        # When the client connection ends, this flag becomes false.
        self._has_client_connection = True

        # Before recieving connection and the the timeout hits, the connection
        # is in a "grace period" in which it can't be deregistered.
        self._in_grace_period = True

        # A master queue for incoming deltas, replicated for each connection.
        self._master_queue = ReportQueue()

        # Each connection additionally gets its own queue.
        self._browser_queues = []

    def close_client_connection(self):
        """Close the client connection."""
        self._has_client_connection = False
        self._master_queue.close()
        for queue in self._browser_queues:
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
        return len(self._browser_queues) > 0

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
            self._has_client_connection or
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

    def get_url_for_client_webbrowser(self):
        """Get URL for this report, for access from client machine's browser.

        Returns
        -------
        str
            The URL.

        """
        return _get_report_url(
            config.get_option('client.proxyAddress'), self.name)

    def get_external_url(self):
        """Get the URL for this report, for access from outside this LAN.

        Returns
        -------
        str
            The URL.

        """
        external_ip = config.get_option('proxy.externalIP')

        if external_ip:
            LOGGER.debug(f'proxy.externalIP set to {external_ip}')
        else:
            LOGGER.debug('proxy.externalIP not set, attempting to autodetect IP')
            external_ip = util.get_external_ip()

        return _get_report_url(external_ip, self.name)

    def get_internal_url(self):
        """Get the URL for this report, for access from inside this LAN.

        Returns
        -------
        str
            The URL.

        """
        internal_ip = util.get_internal_ip()
        return _get_report_url(internal_ip, self.name)

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
        LOGGER.debug(f'Serializing running report')
        manifest = self._build_manifest(
            status=_Status.RUNNING,
            external_proxy_ip=util.get_external_ip(),
            internal_proxy_ip=util.get_internal_ip(),
        )

        manifest_json = json.dumps(manifest).encode('utf-8')
        return [(f'reports/{self.id}/manifest.json', manifest_json)]

    def serialize_final_report_to_files(self):
        """Return the report as an easily-serializable list of tuples.

        Returns
        -------
        list of tuples
            See `CloudStorage.save_report_files()` for schema. But as to the
            output of this method, it's (1) a simple manifest and (2) a bunch
            of serialized Deltas.

        """
        LOGGER.debug(f'Serializing final report')
        # Get the deltas. Need to clone() becuase get_deltas() clears the queue.
        deltas = self._master_queue.clone().get_deltas()
        manifest = self._build_manifest(
            status=_Status.DONE,
            n_deltas=len(deltas)
        )
        manifest_json = json.dumps(manifest).encode('utf-8')
        return (
            [(f'reports/{self.id}/{idx}.delta', delta.SerializeToString())
                for idx, delta in enumerate(deltas)] +
            # Must be at the end, so clients don't connect and read the
            # manifest while the deltas haven't been saved yet.
            [(f'reports/{self.id}/manifest.json', manifest_json)]
        )

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


def _get_report_url(host, name):
    """Return the URL of report defined by (host, name).

    Parameters
    ----------
    host : str
        The hostname or IP address of the current machine.

    name : str
        The name of the report.

    Returns
    -------
    string
        The report's URL.

    """
    port = _get_browser_address_bar_port()

    quoted_name = urllib.parse.quote_plus(name)
    return 'http://{}:{}/?name={}'.format(host, port, quoted_name)


def _get_browser_address_bar_port():
    """Get the report URL that will be shown in the browser's address bar.

    That is, this is the port where static assets will be served from. In dev,
    this is different from the URL that will be used to connect to the
    proxy-browser websocket.

    """
    if config.get_option('proxy.useNode'):
        return 3000
    return config.get_option('browser.proxyPort')
