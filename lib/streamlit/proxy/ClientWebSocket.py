# -*- coding: future_fstrings -*-

"""Websocket handler class which the web client connects to."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from tornado import gen
from tornado.websocket import WebSocketHandler
import urllib
import webbrowser

from streamlit import config
from streamlit import protobuf
from streamlit.logger import get_logger
# from streamlit.proxy import ProxyConnection
from streamlit.streamlit_msg_proto import new_report_msg

LOGGER = get_logger()

class ClientWebSocket(WebSocketHandler):
    """Websocket handler class which the web client connects to."""

    def initialize(self, connections):
        """Initialize self._connections."""
        self._connections = connections

    def check_origin(self, origin):
        """Ignore CORS."""
        # WARNING.  EXTREMELY UNSECURE.
        # See http://www.tornadoweb.org/en/stable/websocket.html#configuration
        return True

    @gen.coroutine
    def open(self, *args):
        """Get and return websocket."""
        self._report_name = args[0]
        # How long we wait between sending more data.
        throttle_secs = config.get_option('local.throttleSecs')

        # Manages our connection to the local client.
        self._connection = self._connections[self._report_name]
        self._queue = self._connection.add_client_queue()
        yield new_report_msg(self._connection.id, self)

        LOGGER.info('Browser websocket opened for "{}"'.format(
            self._report_name))
        while True:
            if not self._queue.is_closed():
                yield self._queue.flush_queue(self)
                yield gen.sleep(throttle_secs)

    def on_message(self, msg):
        """Run callback for websocket messages."""
        data = json.loads(msg)
        payload = json.dumps(data)
        self.write_message(payload, binary=False)
        LOGGER.debug('Sent payload "{}"'.format(payload))
        '''
        try:
            # Establishe the websocket.
            ws = web.WebSocketResponse()
            await ws.prepare(request)

            # Stream the data across.
            connection, queue = await self._add_client(report_name, ws)
            while True:
                # See if the queue has changed.
                if not self._is_registered(connection):
                    self._remove_client(connection, queue)
                    connection, queue = await self._add_client(report_name, ws)

                # Send any new deltas across the wire.
                if not queue.is_closed():
                    await queue.flush_queue(ws)

                # Watch for a CLOSE method as we sleep for throttle_secs.
                try:
                    msg = await ws.receive(timeout=throttle_secs)
                    if msg.type == WSMsgType.BINARY:
                        await self._handle_backend_msg( msg.data, connection, ws)  # noqa: E501
                    elif msg.type == WSMsgType.CLOSE:
                        break
                    else:
                        print('Unknown message type:', msg.type)
                except asyncst.TimeoutError:
                    pass
        except concurrent.futures.CancelledError:
            pass

        if connection != None:
            self._remove_client(connection, queue)
        return ws
        '''
