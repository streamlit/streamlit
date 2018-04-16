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
                self._connections[report_name] = connection
                self._lauch_web_client(report_name)
                print(f'Launched web client with name="{report_name}" and id={msg.new_report}')
                # raise RuntimeError('Testing stopping things here.')
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
        raise RuntimeError(f'Got incoming websocket connection with name="{report_name}"')

        # Establishe the websocket.
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        try:
            current_report_id = self._report_id
            while True:
                # See if the queue has changed.
                if self._report_id != current_report_id:
                    current_report_id = self._report_id
                    await new_report_msg(self._report_id, ws)

                # See if we got any new deltas and send them across the wire.
                if current_report_id != None:
                    await self._queue.flush_deltas(ws)

                # Watch for a CLOSE method as we sleep for throttle_secs.
                try:
                    msg = await ws.receive(timeout=throttle_secs)
                    if msg.type != WSMsgType.CLOSE:
                        print('Unknown message type:', msg.type)
                    break
                except asyncio.TimeoutError:
                    pass

        # Close the server if there are no more connections.
        finally:
            self._n_inbound_connections -= 1
            if self._n_inbound_connections < 1:
                asyncio.get_event_loop().stop()

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
