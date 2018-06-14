# -*- coding: future_fstrings -*-

"""A Report Object which exposes a print method which can be used to
write objects out to a wbpage."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

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

    _ws = None

    # Queue to store deltas as they flow across.
    _queue = ReportQueue()

    _is_open = False

    # This is the class through which we can add elements to the Report
    def __init__(self):
        """
        Creates a new connection to the server.
        """
        # Create an ID for this Report
        self._report_id = uuid.uuid4()

        # Create a name for this report.
        self._name = self._create_name()
        LOGGER.debug(f'Created a connection with name "{self._name}"')

        assert self._name != '-c', "This connection should not be created!" # DEBUG

        '''
        # This is the event loop to talk with the serverself.
        self._loop = asyncst.new_event_loop()
        '''

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
        type(self)._connection = self
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
            current_thread.join()
            sys.excepthook = original_excepthook
            '''
            self._loop.call_soon_threadsafe(setattr, self, '_is_open', False)
            '''
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
        self._queue(delta)
        #ioloop = IOLoop.current()
        #ioloop.spawn_callback(self._queue, delta)

    @_assert_singleton
    def _connect_to_proxy(self):
        """Opens a connection to the server in a separate thread. Returns
        the event loop for that thread."""
        def connection_thread():
            '''
            self._loop.run_until_complete(self._attempt_connection())
            self._loop.close()
            '''
            # TODO(armando): Figure out how to get event loop to start
            #                in 3.6 only.
            # asyncst.set_event_loop(asyncst.new_event_loop())
            ioloop = IOLoop.current()
            ioloop.run_sync(self._attempt_connection)
            self.unregister()
            LOGGER.debug('exit')
        connection_thread = threading.Thread(target=connection_thread)
        connection_thread.daemon = False
        connection_thread.start()

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

        LOGGER.debug(f'Attempt to connect to proxy at {uri}.')
        try:
            # Try to connect to the proxy for the first time.
            try:
                ws = yield websocket_connect(uri)
                type(self)._ws = ws
                type(self)._connection = self
                type(self)._is_open = True
                yield self._transmit_through_websocket(ws)
                return
            except IOError:
                LOGGER.info(f'Failed to connect to proxy at {uri}.  Attempting to start proxy.')

            # Connecting to the proxy failed, so let's start the proxy manually.
            yield self._launch_proxy()

            # Try again to transmit data through the proxy
            try:
                ws = yield websocket_connect(uri)
                type(self)._connection = self
                type(self)._is_open = True
                yield self._transmit_through_websocket(ws)
            except IOError:
                LOGGER.error(f'Failed to connect to {uri}.')
        finally:
            # Closing the session.
            pass

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
        yield new_report_msg(self._report_id, ws)

        # Send other information across.
        throttle_secs = config.get_option('local.throttleSecs')
        LOGGER.debug(f'Websocket Transmit ws = {ws}')
        LOGGER.debug(f'Websocket Transmit queue = {type(self)._connection._queue}')
        while self._is_open:
            yield type(self)._queue.flush_queue(ws)
            yield gen.sleep(throttle_secs)
        yield type(self)._queue.flush_queue(ws)

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
