# -*- coding: future_fstrings -*-

"""A Report Object which exposes a print method which can be used to
write objects out to a wbpage."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import base58
import os
import sys
import threading
import time
import traceback
import urllib
import uuid

from functools import wraps

from tornado import gen
from tornado.ioloop import IOLoop
from tornado.websocket import websocket_connect

from streamlit.util import get_local_id
from streamlit import config
from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.ReportQueue import ReportQueue
from streamlit.streamlit_msg_proto import new_report_msg
from streamlit import protobuf

from streamlit.logger import get_logger
LOGGER = get_logger()

def _assert_singleton(method):
    """Asserts that this method is called on the singleton instance of
    Connection."""
    @wraps(method)
    def inner(self, *args, **kwargs):
        assert self == Connection._connection, \
            f'Can only call {method.__name__}() on the singleton Connection.'
        return method(self, *args, **kwargs)
    return inner

'''
def _assert_singleton_async(method):
    """Asserts that this coroutine is called on the singleton instance of
    Connection."""
    async def inner(self, *args, **kwargs):
        assert self == Connection._connection, \
            f'Can only call {method.__name__}() on the singleton Connection.'
        return await method(self, *args, **kwargs)
    inner.__name__ = method.__name__
    inner.__doc__ = method.__doc__
    return inner
'''

class Connection(object):
    """This encapsulates a single connection the to the server for a single
    report."""

    # This is the singleton connection object.
    _connection = None

    # This is the class through which we can add elements to the Report
    def __init__(self):
        """
        Creates a new connection to the server.
        """
        # Create an ID for this Report
        self._report_id = base58.b58encode(uuid.uuid4().bytes).decode("utf-8")

        # Create a name for this report.
        self._name = self._create_name()
        LOGGER.debug(f'Created a connection with name "{self._name}"')

        # This is the event loop to talk with the proxy.
        self._loop = IOLoop(make_current=False)
        LOGGER.debug(f'Created io loop {self._loop}.')

        # This ReportQueue stores deltas until they're ready to be transmitted
        # over the websocket.
        #
        # VERY IMPORTANT: The key to understanding local threading in Streamlit
        # is that self._queue acts like a thread-safe channel for data (in this
        # case deltas) from the main thread (e.g. st.write()) to the proxy
        # connection thread (e.g. flush_queue()). To ensure the thread-safety of
        # this channel, ALL methods called on this ReportQueue must happen in a
        # coroutine executed on self._loop. For example, the ReportQueue is
        # filled by calling _enqueue_delta which schedules a callback on
        # self._loop. The ReportQueue is drained in _transmit_through_websocket
        # which also runs on self._loop. Directly manipulating self._queue
        # from other threads could cause rare, subtle race conditions!
        self._queue = ReportQueue()

        # Will stay open until the main thread closes. Then gets set to false to
        # cleanly close down the connection. Like self._queue, this variable
        # is only ever accessed
        self._is_open = True

        # This is the class through which we can add elements to the Report
        self._delta_generator = DeltaGenerator(self._enqueue_delta)

    @classmethod
    def get_connection(cls):
        """Returns the singleton Connection object, instantiating one if
        necessary."""
        # Instantiate the singleton connection if necessary.
        if cls._connection == None:
            LOGGER.debug('No connection. Registering one.')

            # Create the new connection.
            Connection().register()

        # Now that we're sure to have a connection, return it.
        return cls._connection

    def register(self):
        """Sets up this connection to be the singelton connection."""
        # Establish this connection and connect to the proxy server.
        assert type(self)._connection == None, \
            'Cannot register two connections'
        Connection._connection = self
        self._connect_to_proxy()

        # Override the default exception handler.
        original_excepthook = sys.excepthook
        def streamlit_excepthook(exc_type, exc_value, exc_tb):
            self.get_delta_generator().exception(exc_value, exc_tb)
            original_excepthook(exc_type, exc_value, exc_tb)
        sys.excepthook = streamlit_excepthook

        # When the current thread closes, then close down the connection.
        current_thread = threading.current_thread()
        def cleanup_on_exit():
            LOGGER.debug('Cleanup thread waiting for main thread to end.')
            current_thread.join()
            LOGGER.debug('Cleanup thread waiting for main thread to end.')
            # TODO(armando): Fix with something that checks if the proxy
            #                ran once and only sleep if we're waiting
            #                for the proxy to startup.  https://trello.com/c/1WECpDht
            LOGGER.debug('Sleeping 5 seconds in case the local script ran very quickly.')
            time.sleep(5)
            LOGGER.debug('Main thread ended. Restoring excepthook.')
            sys.excepthook = original_excepthook
            self._loop.add_callback(setattr, self, '_is_open', False)
            LOGGER.debug('Submitted callback to stop the connection thread.')
        cleanup_thread = threading.Thread(target=cleanup_on_exit)
        cleanup_thread.daemon = False
        cleanup_thread.start()

    @_assert_singleton
    def unregister(self):
        """Removes this connection from being the singleton connection."""
        Connection._connection = None

    @_assert_singleton
    def get_delta_generator(self):
        """Returns the DeltaGenerator for this report. This is the object
        that allows you to dispatch toplevel deltas to the Report, e.g.
        adding new elements."""
        return self._delta_generator

    def _create_name(self):
        """Creates a name for this report."""
        name = ''
        if len(sys.argv) >= 2 and sys.argv[0] == '-m':
            name = sys.argv[1]
        elif len(sys.argv) >= 1:
            name = os.path.split(sys.argv[0])[1]
            if name.endswith('.py'):
                name = name[:-3]
            if name == '__main__' and len(sys.argv) >= 2:
                name = sys.argv[1]

        if name == '':
            name = str(self._report_id)
        return name

    @_assert_singleton
    def _enqueue_delta(self, delta):
        """Enqueues the given delta for transmission to the server."""
        def queue_the_delta():
            self._queue(delta)
        self._loop.add_callback(queue_the_delta)

    @_assert_singleton
    def _connect_to_proxy(self):
        """Opens a connection to the server in a separate thread. Returns
        the event loop for that thread."""
        def connection_thread():
            self._loop.make_current()
            LOGGER.debug(f'Running proxy on loop {IOLoop.current()}.')
            self._loop.run_sync(self._attempt_connection)
            self._loop.close()
            self.unregister()
            LOGGER.debug('Exit.. (deltas remaining = %s)' % len(self._queue._deltas))
        connection_thread = threading.Thread(target=connection_thread)
        connection_thread.daemon = False
        connection_thread.start()

    @_assert_singleton
    @gen.coroutine
    def _attempt_connection(self):
        """Tries to establish a connection to the proxy (launching the
        proxy if necessary). Then, pumps deltas through the connection."""
        # Create a connection URI.
        server = config.get_option('proxy.server')
        port = config.get_option('proxy.port')
        local_id = get_local_id()
        report_name = urllib.parse.quote_plus(self._name)
        uri = f'ws://{server}:{port}/new/{local_id}/{report_name}'

        LOGGER.debug(f'First attempt to connect to proxy at {uri}.')
        try:
            ws = yield websocket_connect(uri)
            yield self._transmit_through_websocket(ws)
            return
        except IOError:
            LOGGER.info(f'First connection to {uri} failed.')

        LOGGER.info('Starting the proxy manually.')
        yield self._launch_proxy()

        LOGGER.debug(f'Second attempt to connect to proxy at {uri}.')
        try:
            ws = yield websocket_connect(uri)
            yield self._transmit_through_websocket(ws)
        except IOError:
            raise ProxyConnectionError(uri)

    @_assert_singleton
    @gen.coroutine
    def _launch_proxy(self):
        """Launches the proxy server."""
        wait_for_proxy_secs = config.get_option('local.waitForProxySecs')
        os.system('python -m streamlit.proxy &')
        LOGGER.debug('Sleeping %f seconds while waiting Proxy to start', wait_for_proxy_secs)
        yield gen.sleep(wait_for_proxy_secs)

    @_assert_singleton
    @gen.coroutine
    def _transmit_through_websocket(self, ws):
        """Sends queue data across the websocket as it becomes available."""
        # Send the header information across.
        yield new_report_msg(self._report_id,
            os.getcwd(), ['python'] + sys.argv, ws)
        LOGGER.debug('Just sent a new_report_msg with: ' + str(sys.argv))

        # Send other information across.
        throttle_secs = config.get_option('local.throttleSecs')
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

class ProxyConnectionError(Exception):
    def __init__(self, uri):
        msg = f'Unable to connect to proxy at {uri}.'
        super(ProxyConnectionError, self).__init__(msg)

if __name__ == '__main__':
    c = Connection().get_connection()
    queue = Connection()._queue
    _id = 0
    LOGGER.debug(queue)
    while True:
        delta = protobuf.Delta()
        delta.id = _id
        delta.new_element.text.format = protobuf.Text.MARKDOWN
        delta.new_element.text.body = '{}'.format(
            time.time())
        queue(delta)
        _id += 1

        time.sleep(5)
