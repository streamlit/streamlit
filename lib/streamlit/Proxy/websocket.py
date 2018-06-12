"""Proxy Tornado Handlers."""
import json
import urllib

from tornado.websocket import WebSocketHandler
from tornado import gen

from streamlit import config
from streamlit.logger import get_logger
from streamlit.ProxyConnection import ProxyConnection
from streamlit import protobuf
from streamlit.streamlit_msg_proto import new_report_msg
import webbrowser

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
                except asyncio.TimeoutError:
                    pass
        except concurrent.futures.CancelledError:
            pass

        if connection != None:
            self._remove_client(connection, queue)
        return ws
        '''


class LocalWebSocket(WebSocketHandler):
    """Websocket handler class which the web client connects to."""

    def initialize(self, connections):
        """Initialize self._connections."""
        self._connections = connections

    def check_origin(self, origin):
        """Ignore CORS."""
        # WARNING.  EXTREMELY UNSECURE.
        # See http://www.tornadoweb.org/en/stable/websocket.html#configuration
        return True

    # @_stop_proxy_on_exception
    def open(self, *args):
        """Handle connection to "local" instance of Streamlit.

        i.e. one producing deltas to display on the client.
        """
        # Parse out the control information.
        self._local_id = args[0]
        self._report_name = args[1]
        self._report_name = urllib.parse.unquote_plus(self._report_name)
        self._connection = None
        LOGGER.info('Local websocket opened for "{}/{}"'.format(
            self._local_id, self._report_name))

    # @_stop_proxy_on_exception
    def on_message(self, message):
        """Run callback for websocket messages."""
        # LOGGER.debug(repr(message))

        msg = protobuf.ForwardMsg()
        msg.ParseFromString(message)

        msg_type = msg.WhichOneof('type')
        if msg_type == 'new_report':
            assert not self._connection, 'Cannot send `new_report` twice.'
            report_id = msg.new_report
            LOGGER.debug('the report_id is %s', report_id)
            self._connection = ProxyConnection(report_id, self._report_name)
            self._connections[self._connection.name] = self._connection
            new_name = self._connection.name not in self._connections
            self._launch_web_client(self._connection.name)
        elif msg_type == 'delta_list':
            assert self._connection, 'No `delta_list` before `new_report`.'
            for delta in msg.delta_list.deltas:
                self._connection.enqueue(delta)
    '''
        else:
            raise RuntimeError(f'Cannot parse message type: {msg_type}')
        except concurrent.futures.CancelledError:
            pass

        # Deregister this connection and see if we can close the proxy.
        if connection:
            connection.finished_local_connection()
            self._try_to_deregister(connection)
        self._potentially_stop_proxy()
        return ws
    '''

    def _launch_web_client(self, name):
        """Launch web browser to connect to the proxy to get the named report.

        Args
        ----
        name : string
            The name of the report to which the web browser should connect.
        """
        if config.get_option('proxy.useNode'):
            host, port = 'localhost', '3000'
        else:
            host = config.get_option('proxy.server')
            port = config.get_option('proxy.port')
        quoted_name = urllib.parse.quote_plus(name)
        url = 'http://{}:{}/?name={}'.format(
            host, port, quoted_name)
        webbrowser.open(url)
