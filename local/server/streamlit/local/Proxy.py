"""A proxy server between the Streamlit local client and browser.

The basic invariant is that so long as as the browswer connection stays open,
so does this server.

"""

from aiohttp import web, WSMsgType
import asyncio
import os
import urllib
import webbrowser

from streamlit.shared import config
from streamlit.shared.ReportQueue import ReportQueue
from streamlit.shared.streamlit_msg_proto import new_report_msg
from streamlit.shared.streamlit_msg_proto import streamlit_msg_iter

def _stop_proxy_on_exception(coroutine):
    """Coroutine decorator which stops the the proxy if an exception
    propagates out of the inner coroutine."""
    async def wrapped_coroutine(*args, **kwargs):
        try:
            return await coroutine(*args, **kwargs)
        except:
            asyncio.get_event_loop().stop()
            raise
    wrapped_coroutine.__name__ = coroutine.__name__
    wrapped_coroutine.__doc__ = coroutine.__doc__
    return wrapped_coroutine

class Proxy:
    """The main base class for the streamlit server."""

    def __init__(self):
        # Set up the server.
        self._app = web.Application()
        self._app.router.add_routes([
            # Local connection to stream a new report.
            web.get('/new/{local_id}/{report_name}', self._local_ws_handler),

            # Client connection (serves up index.html)
            web.get('/report/{report_name}', self._client_html_handler),

            # Outgoing endpoint to get the latest report.
            web.get('/stream/{report_name}', self._client_ws_handler)
        ])

        # If we're not using the node development server, then the proxy
        # will serve up the development pages.
        if not config.get_option('proxy.useNode'):
            static_path = config.get_path('proxy.staticRoot')
            self._app.router.add_static('/', path=static_path)

        # Counter for the number of incoming connections.
        # self._n_inbound_connections = 0

        # Launch startup scripts.
        # self._lauch_web_client_on_startup()
        # self._close_server_on_connection_timeout()

        # This table from names to ReportConnections stores all the information
        # about our connections. When the number of connections drops to zero,
        # then the proxy shuts down.
        self._connections = {}

    def run_app(self):
        """Runs the web app."""
        port = config.get_option('proxy.port')
        web.run_app(self._app, port=port)
        print('Closing down the Streamlit proxy server.')

    # def _close_server_on_connection_timeout(self):
    #     """Closes the server if we haven't received a connection in a certain
    #     amount of time."""
    #     # Init the state for the timeout
    #     timeout_secs = config.get_option('proxy.waitForConnectionSecs')
    #     loop = asyncio.get_event_loop()
    #
    #     # Enqueue the timeout in the event loop.
    #     def close_server_if_necessary():
    #         if self._n_inbound_connections < 1:
    #             loop.stop()
    #     loop.call_later(timeout_secs, close_server_if_necessary)

    @_stop_proxy_on_exception
    async def _local_ws_handler(self, request):
        """Handles a connection to a "local" instance of Streamlit, i.e.
        one producing deltas to display on the client."""
        # Parse out the control information.
        local_id = request.match_info.get('local_id')
        report_name = urllib.parse.unquote_plus(
            request.match_info.get('report_name'))

        print(f'Got a connection with UNQUOTED name="{report_name}".')

        # Establishe the websocket.
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        # Instantiate a new queue and stream data into it.
        connection = None
        async for msg in streamlit_msg_iter(ws):
            msg_type = msg.WhichOneof('type')
            if msg_type == 'new_report':
                connection = ReportConnection(msg.new_report)
                new_name = report_name not in self._connections
                self._connections[report_name] = connection
                if new_name:
                    self._lauch_web_client(report_name)
                print(f'Launched web client with name="{report_name}" and id={msg.new_report}')
            elif msg_type == 'delta_list':
                assert connection != None, \
                    'The protocol prohibits delta_list before new_report.'
                for delta in msg.delta_list.deltas:
                    connection.enqueue(delta)
            else:
                raise RuntimeError(f'Cannot parse message type: {msg_type}')
        return ws

    @_stop_proxy_on_exception
    async def _client_html_handler(self, request):
        static_root = config.get_path('proxy.staticRoot')
        return web.FileResponse(os.path.join(static_root, 'index.html'))

    @_stop_proxy_on_exception
    async def _client_ws_handler(self, request):
        """This is what the web client connects to."""
        # How long we wait between sending more data.
        throttle_secs = config.get_option('local.throttleSecs')

        # Get the report name
        report_name = request.match_info.get('report_name')
        # raise RuntimeError(f'Got incoming websocket connection with name="{report_name}"')

        # Establishe the websocket.
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        # Stream the data across.
        connection, queue = await self._add_queue(report_name, ws)
        while True:
            # See if the queue has changed.
            if connection != self._connections[report_name]:
                print('GOT A NEW CONNECTION')
                self._remove_queue(report_name, connection, queue)
                connection, queue = await self._add_queue(report_name, ws)

            # Send any new deltas across the wire.
            await queue.flush_deltas(ws)

            # Watch for a CLOSE method as we sleep for throttle_secs.
            try:
                msg = await ws.receive(timeout=throttle_secs)
                if msg.type != WSMsgType.CLOSE:
                    print('Unknown message type:', msg.type)
                self._remove_queue(report_name, connection, queue)
                break
            except asyncio.TimeoutError:
                pass
        print('Received the close message for "%s". Now removing the final queue.' % report_name)

        return ws

    def _lauch_web_client(self, name):
        """Launches a web browser to connect to the proxy to get the named
        report.

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
        url = f'http://{host}:{port}/report/{name}'
        webbrowser.open(url)

    async def _add_queue(self, report_name, ws):
        """Adds a queue to the connection for the given report_name."""
        connection = self._connections[report_name]
        queue = connection.add_client_queue()
        print('sending new report with id=', connection.id)
        await new_report_msg(connection.id, ws)
        return (connection, queue)

    def _remove_queue(self, report_name, connection, queue):
        """Removes the queue from the connection, and closes the connection if
        necessary."""
        connection.remove_client_queue(queue)
        is_current = (connection == self._connections[report_name])
        if is_current and not connection.has_clients():
            print('Removing the connection with name "%s"' % report_name)
            del self._connections[report_name]
            if not self._connections:
                print('No more connections. Closing down the proxy.')
                asyncio.get_event_loop().stop()

class ReportConnection:
    """Stores information shared by both local_connections and
    client_connections related to a particular report."""

    def __init__(self, id):
        # The unique BSON ID of this Report.
        self.id = id

        # A master queue for incoming deltas, replicated for each connection.
        self._master_queue = ReportQueue()

        # Each connection additionally gets its own queue.
        self._client_queues = []

    def enqueue(self, delta):
        """Stores the delta in the master queue and transmits to all clients
        via client_queues."""
        self._master_queue(delta)
        for queue in self._client_queues:
            queue(delta)

    def add_client_queue(self):
        """Adds a queue for a new client by cloning the master queue."""
        new_queue = self._master_queue.clone()
        self._client_queues.append(new_queue)
        return new_queue

    def remove_client_queue(self, queue):
        """Removes the client queue. Returns True iff the client queue list is
        empty."""
        print('BEFORE REMOVE', len(self._client_queues))
        self._client_queues.remove(queue)
        print('AFTER REMOVE', len(self._client_queues))

    def has_clients(self):
        """Indicates that there are still clients connected here."""
        return len(self._client_queues) > 0

def main():
    """
    Creates a proxy server and launches the browser to connect to it.
    The proxy server will close when the browswer connection closes (or if
    it times out waiting for the browser connection.)
    """
    proxy_server = Proxy()
    proxy_server.run_app()

if __name__ == '__main__':
    main()
