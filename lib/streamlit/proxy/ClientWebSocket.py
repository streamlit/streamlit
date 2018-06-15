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
from streamlit.proxy import Proxy
# from streamlit.streamlit_msg_proto import new_report_msg

LOGGER = get_logger()

class ClientWebSocket(WebSocketHandler):
    """Websocket handler class which the web client connects to."""

    def initialize(self, proxy):
        self._proxy = proxy
        self._connection = None
        self._queue = None
        self._is_open = False

    def check_origin(self, origin):
        """Ignore CORS."""
        # WARNING.  EXTREMELY UNSECURE.
        # See http://www.tornadoweb.org/en/stable/websocket.html#configuration
        return True

    @Proxy.stop_proxy_on_exception(is_coroutine=True)
    @gen.coroutine
    def open(self, report_name):
        """Get and return websocket."""
        # Indicate that the websocket is open.
        self._is_open = True

        # Get the report name from the url
        self._report_name = report_name
        LOGGER.debug(f'The Report name is "{self._report_name}"')

        # How long we wait between sending more data.
        throttle_secs = config.get_option('local.throttleSecs')

        # # Manages our connection to the local client.
        # LOGGER.debug(f'Opening connection with self._connections: {id(self._connections)}')
        # LOGGER.debug(f'Existing keys: {list(self._connections.keys())}')
        # self._connection = self._connections[self._report_name]
        # self._queue = self._connection.add_client_queue()
        # yield new_report_msg(self._connection.id, self)

        LOGGER.info(f'Browser websocket opened for "{self._report_name}"')
        self._connection, self._queue = yield self._proxy.add_client(self._report_name, self)
        LOGGER.debug(f'Got a new connection ("{self._connection.name}") : {self._connection}')
        LOGGER.debug(f'Got a new queue : {self._queue}')

        LOGGER.debug(f'Starting loop for "{self._connection.name}"')
        while self._is_open:
            if not self._proxy.proxy_connection_is_registered(self._connection):
                LOGGER.debug(f'The proxy connection for "{self._report_name}" is not registered.')
                self._proxy.remove_client(self._connection, self._queue)
                self._connection, self._queue = yield self._proxy.add_client(self._report_name, self)
                LOGGER.debug(f'Got a new connection ("{self._connection.name}") : {self._connection}')
                LOGGER.debug(f'Got a new queue : {self._queue}')

            if not self._queue.is_closed():
                yield self._queue.flush_queue(self)

            yield gen.sleep(throttle_secs)

        LOGGER.debug(f'Closing loop for "{self._connection.name}"')
        self._proxy.remove_client(self._connection, self._queue)
        LOGGER.debug(f'FINALLY removed the client for "{self._connection.name}"')

    @Proxy.stop_proxy_on_exception(is_coroutine=True)
    @gen.coroutine
    def on_message(self, msg):
        LOGGER.debug(f'Received message of length {len(msg)}.')
        backend_msg = protobuf.BackMsg()
        try:
            backend_msg.ParseFromString(payload)
            command  = backend_msg.command
            if command == protobuf.BackMsg.Command.Value('HELP'):
                os.system('python -m streamlit help &')
            elif command == protobuf.BackMsg.Command.Value('CLOUD_UPLOAD'):
                LOGGER.debug("CLOUD_UPLOAD!!!")
                yield self._save_cloud(connection, ws)
            else:
                LOGGER.warning("no handler for %s",
                    protobuf.BackMsg.Command.Name(backend_msg.command))
        except Exception as e:
            LOGGER.error('Cannot parse binary message: %s', e)

    @Proxy.stop_proxy_on_exception()
    def on_close(self):
        LOGGER.debug('Received close message.')
        self._is_open = False

    @gen.coroutine
    def _save_cloud(self, connection, ws):
        """Saves a serialized version of this report's deltas to the cloud."""
        # Indicate that the save is starting.
        progress_msg = protobuf.ForwardMsg()
        progress_msg.upload_report_progress = 100
        yield ws.write_message(progress_msg.SerializeToString(), binary=True)

        report = connection.get_report_proto()
        LOGGER.debug('Saving report of size %d and type %s',
            len(report.SerializeToString()),
            type(report.SerializeToString()))
        url = yield self._cloud.upload_report(connection.id, report)

        # Indicate that the save is done.
        progress_msg.Clear()
        progress_msg.report_uploaded = url
        yield ws.write_message(progress_msg.SerializeToString(), binary=True)
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
