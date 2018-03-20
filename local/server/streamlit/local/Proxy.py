"""A proxy server between the Streamlit local client and browser.

The basic invariant is that so long as as the browswer connection stays open,
so does this server.

"""

from aiohttp import web, WSMsgType
import asyncio
import os
import webbrowser

from streamlit.shared import config
from streamlit.shared.NotebookQueue import NotebookQueue
from streamlit.shared.streamlit_msg_proto import new_notebook_msg
from streamlit.shared.streamlit_msg_proto import streamlit_msg_iter

class Proxy:
    """The main base class for the streamlit server."""

    def __init__(self):
        # Set up the server.
        self._app = web.Application()
        self._app.router.add_routes([
            # Incoming endpoint to create a new notebook.
            web.get('/new/{local_id}/{notebook_id}', self._new_stream_handler),

            # Outgoing endpoint to get the latest notebook.
            web.get('/latest', self._latest_handler)
        ])

        # If we're not using the node development server, then the proxy
        # will serve up the development pages.
        if not config.get_option('proxy.useNode'):
            static_path = config.get_path('proxy.staticRoot')
            self._app.router.add_static('/', path=static_path)
            print('using static route:', static_path)
            # import sys
            # sys.exit(-1)

        # Counter for the number of incoming connections.
        self._n_inbound_connections = 0

        # Launch startup scripts.
        self._launch_browser_on_startup()
        self._close_server_on_connection_timeout()

        # The queue will be instantiated each time we see a new incoming
        # connection.
        self._queue = None
        self._notebook_id = None

    def run_app(self):
        """Runs the web app."""
        port = config.get_option('proxy.port')
        web.run_app(self._app, port=port)
        # print('Closing down the Streamlit proxy server.')

    def _launch_browser_on_startup(self):
        """Launches a web browser to connect to the proxy."""
        async def async_launch_broswer(app):
            if config.get_option('proxy.useNode'):
                host, port = 'localhost', '3000'
            else:
                host = config.get_option('proxy.server')
                port = config.get_option('proxy.port')
            url = f'http://{host}:{port}/index.html'
            webbrowser.open(url)
        self._app.on_startup.append(async_launch_broswer)

    def _close_server_on_connection_timeout(self):
        """Closes the server if we haven't received a connection in a certain
        amount of time."""
        # Init the state for the timeout
        timeout_secs = config.get_option('proxy.waitForConnectionSecs')
        loop = asyncio.get_event_loop()

        # Enqueue the timeout in the event loop.
        def close_server_if_necessary():
            if self._n_inbound_connections < 1:
                loop.stop()
        loop.call_later(timeout_secs, close_server_if_necessary)

    async def _new_stream_handler(self, request):
        # Parse out the control information.
        local_id = request.match_info.get('local_id')
        notebook_id = request.match_info.get('notebook_id')

        # Establishe the websocket.
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        # Instantiate a new queue and stream data into it.
        async for msg in streamlit_msg_iter(ws):
            msg_type = msg.WhichOneof('type')
            if msg_type == 'new_notebook':
                self._queue = NotebookQueue()
                self._notebook_id = msg.new_notebook
            elif msg_type == 'delta_list':
                assert self._queue != None, \
                    'The protocol prohibits delta_list before new_notebook.'
                for delta in msg.delta_list.deltas:
                    self._queue(delta)
            else:
                raise RuntimeError(f'Cannot parse message type: {msg_type}')
        return ws

    async def _latest_handler(self, request):
        """This is what the web client connects to."""
        # Indicate that we got this connection
        self._n_inbound_connections += 1
        throttle_secs = config.get_option('local.throttleSecs')

        # Establishe the websocket.
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        try:
            current_notebook_id = self._notebook_id
            while True:
                # See if the queue has changed.
                if self._notebook_id != current_notebook_id:
                    current_notebook_id = self._notebook_id
                    await new_notebook_msg(current_notebook_id, ws)

                # See if we got any new deltas and send them across the wire.
                if current_notebook_id != None:
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
