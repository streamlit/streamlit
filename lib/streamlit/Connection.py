# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

"""Connection management methods."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import os
import sys
import threading
import time

from tornado import gen
from tornado.ioloop import IOLoop
from tornado.websocket import websocket_connect

from streamlit import config
from streamlit import util
from streamlit.ReportQueue import ReportQueue, MESSAGE_SIZE_LIMIT

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)

# Websocket arguments.
WS_ARGS = {
    # Max size of the message to send via the websocket.
    'max_message_size': MESSAGE_SIZE_LIMIT,
}


class Connection(object):
    """Represents/manages the actual websocket connection to the server.

    This class should be strictly about handling the actual websocket
    connection lifetime and data transfer, without any knowledge of what is
    actually being transferred.
    """

    # The _proxy_connection_status can take one of these three values:
    _PROXY_CONNECTION_DISCONNECTED = 'disconnected'
    _PROXY_CONNECTION_CONNECTED = 'connected'
    _PROXY_CONNECTION_FAILED = 'failed'

    # This is the class through which we can add elements to the Report
    def __init__(self, uri, initial_msg, on_connect, on_cleanup):
        """Create a new connection to the server.

        Parameters
        ----------
        uri : str
            The Proxy URI for this WebSocket connection.
        initial_msg : protobuf.ForwardMsg
            First message to send via the connection, as soon as the connection
            is established.
        on_connect : callable
            Function to call when the connection is made.
        on_cleanup : callable
            Function to call when the connection is destroyed.
        """
        # This is the event loop to talk with the proxy.
        self._loop = IOLoop(make_current=False)
        LOGGER.debug(f'Created io loop {self._loop}.')

        # This ReportQueue stores deltas until they're ready to be transmitted
        # over the websocket.
        #
        # VERY IMPORTANT: The key to understanding client threading in Streamlit
        # is that self._queue acts like a thread-safe channel for data (in this
        # case deltas) from the main thread (e.g. st.write()) to the proxy
        # connection thread (e.g. flush_queue()). To ensure the thread-safety
        # of this channel, ALL methods called on this ReportQueue must happen
        # in a coroutine executed on self._loop. For example, the ReportQueue
        # is filled by calling enqueue_delta, which schedules a callback on
        # self._loop. The ReportQueue is drained in _transmit_through_websocket
        # which also runs on self._loop. Directly manipulating self._queue from
        # other threads could cause rare, subtle race conditions!
        self._queue = ReportQueue()

        # Will stay open until the main thread closes. Then gets set to false to
        # cleanly close down the connection. Like self._queue, this variable
        # is only ever accessed
        self._is_open = True

        # Keep track of whether we've connected to the proxy.
        #
        # Necessary for very short lived scripts that terminate before the
        # proxy is even started. In this case, we try to delay the cleanup
        # thread until the proxy has started.
        self._proxy_connection_status = (
            Connection._PROXY_CONNECTION_DISCONNECTED)

        self._connect(uri, initial_msg, on_connect, on_cleanup)

    def _connect(self, uri, initial_msg, on_connect, on_cleanup):
        """Connect to the proxy and set up output thread."""
        # Establish this connection and connect to the proxy server.
        self._connect_to_proxy(uri, initial_msg)

        # When the current thread closes, then close down the connection.
        main_thread = threading.current_thread()
        cleanup_thread = threading.Thread(
            target=self._cleanup_on_exit,
            args=(main_thread, on_cleanup),
        )
        cleanup_thread.daemon = False
        cleanup_thread.start()

        on_connect()

    def enqueue_delta(self, delta):
        """Enqueue the given delta for transmission to the server."""
        self._loop.add_callback(lambda: self._queue(delta))

    def _connect_to_proxy(self, uri, initial_msg):
        """Open a connection to the server in a separate thread."""
        def connection_thread():
            self._loop.make_current()
            LOGGER.debug(f'Running proxy on loop {IOLoop.current()}.')
            self._loop.run_sync(
                lambda: self._attempt_connection(uri, initial_msg))
            self._loop.close()
            LOGGER.debug(
                'Exit. (deltas remaining = %s)' % len(self._queue._deltas))

        connection_thread = threading.Thread(target=connection_thread)
        connection_thread.daemon = False
        connection_thread.start()

    @gen.coroutine
    def _attempt_connection(self, uri, initial_msg):
        """Try to establish a connection to the proxy.

        Launches the proxy (if necessary), then pumps deltas through the
        connection. Updates self._proxy_connection_status to indicate whether
        we succeeded in connecting to the proxy.
        """
        already_connected = (
            self._proxy_connection_status ==
            Connection._PROXY_CONNECTION_DISCONNECTED)
        assert already_connected, 'Already connectd to the proxy.'

        LOGGER.debug(f'First attempt to connect to proxy at {uri}.')
        try:
            ws = yield websocket_connect(uri, **WS_ARGS)
            self._proxy_connection_status = (
                Connection._PROXY_CONNECTION_CONNECTED)
            yield self._transmit_through_websocket(ws, initial_msg)
            return
        except IOError:
            LOGGER.debug(
                f'First connection to {uri} failed. No proxy running?')

        LOGGER.debug('Starting proxy.')
        yield self._launch_proxy()

        LOGGER.debug(f'Second attempt to connect to proxy at {uri}.')
        try:
            ws = yield websocket_connect(uri, **WS_ARGS)
            self._proxy_connection_status = (
                Connection._PROXY_CONNECTION_CONNECTED)
            yield self._transmit_through_websocket(ws, initial_msg)
        except IOError:
            # Indicate that we failed to connect to the proxy so that the
            # cleanup thread can now run.
            LOGGER.error(f'Failed to connect to proxy at {uri}.')
            self._proxy_connection_status = Connection._PROXY_CONNECTION_FAILED
            raise ProxyConnectionError(uri)

    @gen.coroutine
    def _launch_proxy(self):
        """Launch the proxy server."""
        wait_for_proxy_secs = config.get_option('client.waitForProxySecs')
        os.system('python -m streamlit.proxy &')
        LOGGER.debug('Sleeping %f seconds while waiting Proxy to start', wait_for_proxy_secs)
        yield gen.sleep(wait_for_proxy_secs)

    @gen.coroutine
    def _transmit_through_websocket(self, ws, initial_msg):
        """Send queue data across the websocket as it becomes available."""
        # Send the header information across.
        yield util.write_proto(ws, initial_msg)
        LOGGER.debug('Just sent an initial_msg with: ' + str(sys.argv))

        # Send other information across.
        throttle_secs = config.get_option('client.throttleSecs')
        LOGGER.debug(f'Websocket Transmit ws = {ws}')
        LOGGER.debug(f'Websocket Transmit queue = {self._queue}')

        while self._is_open:
            yield self._queue.flush_queue(ws)
            yield gen.sleep(throttle_secs)

        LOGGER.debug('Connection closing. Flushing queue for the last time.')
        yield self._queue.flush_queue(ws)
        LOGGER.debug('Finished flusing the queue writing=%s' % ws.stream.writing())
        yield ws.close()
        LOGGER.debug('Closed the connection object.')

    def _cleanup_on_exit(self, main_thread, on_cleanup):
        """Perform final cleanup after main thread finishes.

        This thread waits for the main thread to exit, then does some final
        cleanup.
        """
        # Wait for the main thread to end.
        LOGGER.debug('Cleanup thread waiting for main thread to end.')
        main_thread.join()

        # Then wait for a certain number of seconds to connect to the proxy
        # to make sure that we can flush the connection queue.
        start_time = time.time()
        FINAL_WAIT_SECONDS = 5.0
        PROXY_CONNECTION_POLL_INTERVAL_SECONDS = 0.1
        FLUSH_QUEUE_SECONDS = 0.1
        while True:
            elapsed_time = time.time() - start_time

            if elapsed_time > FINAL_WAIT_SECONDS:
                LOGGER.debug(
                    f'Waited {FINAL_WAIT_SECONDS} for proxy to connect. Exiting.')
                break
            elif self._proxy_connection_status == Connection._PROXY_CONNECTION_DISCONNECTED:
                time.sleep(PROXY_CONNECTION_POLL_INTERVAL_SECONDS)
            elif self._proxy_connection_status == Connection._PROXY_CONNECTION_CONNECTED:
                # Sleep for a tiny bit to make sure we flush everything to the proxy.
                LOGGER.debug('The proxy was connected. Preparing to cleanup.')
                time.sleep(FLUSH_QUEUE_SECONDS)
                break
            elif self._proxy_connection_status == Connection._PROXY_CONNECTION_FAILED:
                LOGGER.debug('Proxy connection failed. Ending the client script.')
                break
            else:
                LOGGER.error(
                    '_proxy_connection_status illegal value: ' +
                    str(self._proxy_connection_status))
                break

        on_cleanup()

        self._loop.add_callback(setattr, self, '_is_open', False)
        LOGGER.debug('Submitted callback to stop the connection thread.')

        if config.get_option('client.tryToOutliveProxy'):
            self._wait_for_proxy_to_close()

        LOGGER.debug('Allowing script to exit')

    def _wait_for_proxy_to_close(self):
        host = config.get_option('client.proxyAddress')
        port = config.get_option('client.proxyPort')
        url = f'http://{host}:{port}/healthz'

        LOGGER.debug('Waiting for proxy to close...')

        MAX_WAIT = 10  # Wait at most 10 seconds.
        SLEEP_TIME = 0.25
        total_wait_so_far = 0

        while True:
            result = util.make_blocking_http_get(url, timeout=1)

            if result is None:
                break

            time.sleep(SLEEP_TIME)
            total_wait_so_far += SLEEP_TIME

            if total_wait_so_far > MAX_WAIT:
                break


class ProxyConnectionError(Exception):
    """Error raised whenever something goes wrong in the Connection."""

    def __init__(self, uri):
        """Constructor.

        Parameters
        ----------
        uri : str
            The URI of the Streamlit Proxy that errored out.

        """
        msg = f'Unable to connect to proxy at {uri}.'
        super(ProxyConnectionError, self).__init__(msg)
