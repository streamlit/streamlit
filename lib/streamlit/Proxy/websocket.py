import json

from tornado.websocket import WebSocketHandler

from streamlit import config
from streamlit.logger import get_logger

LOGGER = get_logger()


class ClientWebSocket(WebSocketHandler):
    """Websocket handler class which the web client connects to."""

    def open(self, *args):
        """Get and return websocket."""
        report_name = args[0]
        # How long we wait between sending more data.
        throttle_secs = config.get_option('local.throttleSecs')

        # Manages our connection to the local client.
        connection, queue = None, None

        LOGGER.info('Browser websocket opened for "{}"'.format(report_name))

    def on_message(self, msg):
        if type(msg) != unicode:
            LOGGER.info('Not handling non unicode payload "{}"'.format(repr(msg)))
            return
        data = json.loads(msg)
        payload = json.dumps(data)
        self.write_message(payload, binary=False)
        LOGGER.info('Sent payload "{}"'.format(payload))
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
                        await self._handle_backend_msg(msg.data, connection, ws)
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

    def open(self, *args):
        """Get and return websocket."""
        local_id = args[0]
        report_name = args[1]
        LOGGER.info('Local websocket opened for "{}/{}"'.format(local_id, report_name))

    '''
    @_stop_proxy_on_exception
    async def _local_ws_handler(self, request):
        """Handles a connection to a "local" instance of Streamlit, i.e.
        one producing deltas to display on the client."""
        # Parse out the control information.
        local_id = request.match_info.get('local_id')
        report_name = request.match_info.get('report_name')
        report_name = urllib.parse.unquote_plus(report_name)

        # This is the connection object we will register when we
        connection = None

        # Instantiate a new queue and stream data into it.
        try:
            Establishe the websocket.
            ws = web.WebSocketResponse()
            await ws.prepare(request)

            async for msg in streamlit_msg_iter(ws):
                msg_type = msg.WhichOneof('type')
                if msg_type == 'new_report':
                    assert not connection, 'Cannot send `new_report` twice.'
                    report_id = msg.new_report
                    print('the report_id is', report_id)
                    connection = ProxyConnection(report_id, report_name)
                    self._register(connection)
                elif msg_type == 'delta_list':
                    assert connection, 'No `delta_list` before `new_report`.'
                    for delta in msg.delta_list.deltas:
                        connection.enqueue(delta)
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
