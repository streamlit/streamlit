"""A proxy server between the Streamlit local client and browser.

The basic invariant is that so long as as the browswer connection stays open,
so does this server.

"""

from aiohttp import web, WSMsgType
import asyncio
import os
import webbrowser

from streamlet.shared.config import get_config as get_shared_config
from streamlet.shared.delta_proto import delta_list_iter
from streamlet.shared.NotebookQueue import NotebookQueue

class Proxy:
    """The main base class for the streamlet server."""

    def __init__(self):
        # Set up the server.
        self._app = web.Application()
        self._app.router.add_routes([
            # Incoming endpoint to create a new notebook.
            web.get('/new/{local_id}/{notebook_id}', self._new_stream_handler),

            # Outgoing endpoint to get the latest notebook.
            web.get('/latest', self._latest_handler)
        ])

        # # Outgoing endpoint to get a notebook.
        # self._app.router.add_get('/get/{local_id}/{notebook_id}',
        #     self._new_stream_handler)

        # TODO: Move this into the route table above.
        # Serve up all the local pages here.
        static_route = self._app.router.add_static('/',
            path=(os.path.split(__file__)[0] + '/../../../client/build'))

        # Counter for the number of incoming connections.
        self._n_inbound_connections = 0

        # Launch startup scripts.
        self._launch_browser_on_startup()
        self._close_server_on_connection_timeout()

        # The queue will be instantiated each time we see a new incoming
        # connection.
        self._queue = None

    def run_app(self):
        """Runs the web app."""
        port = get_shared_config('proxy.port')
        web.run_app(self._app, port=port)
        print('THE EVENT LOOP STOPPED NATURALLY!!!')

    def _launch_browser_on_startup(self):
        """Launches a web browser to connect to the proxy."""
        async def async_launch_broswer(app):
            if get_shared_config('proxy.useNode'):
                host, port = 'localhost', '3000'
            else:
                host = get_shared_config('proxy.server')
                port = get_shared_config('proxy.port')
            url = f'http://{host}:{port}/index.html'
            print('Opening browser at', url)
            webbrowser.open(url)
        self._app.on_startup.append(async_launch_broswer)

    def _close_server_on_connection_timeout(self):
        """Closes the server if we haven't received a connection in a certain
        amount of time."""
        # Init the state for the timeout
        timeout_secs = get_shared_config('proxy.waitForConnectionSecs')
        loop = asyncio.get_event_loop()

        # Enqueue the timeout in the event loop.
        def close_server_if_necessary():
            if self._n_inbound_connections < 1:
                print('Timeout reached. Closing proxy server.')
                loop.stop()
            else:
                print('Got a connection, not timing out.')
        loop.call_later(timeout_secs, close_server_if_necessary)

    async def _new_stream_handler(self, request):
        # Parse out the control information.
        local_id = request.match_info.get('local_id')
        notebook_id = request.match_info.get('notebook_id')
        print(f"Got a connection with local_id={local_id} and notebook_id={notebook_id}.")

        # Establishe the websocket.
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        # Instantiate a new queue and stream data into it.
        self._queue = NotebookQueue()
        async for delta_list in delta_list_iter(ws):
            for delta in delta_list.deltas:
                print('In _new_stream_handler, adding a delta to the queue.')
                self._queue(delta)
        #     print('Received a delta list in the proxy.')
        #
        # # with self._switchboard.stream_to(notebook_id) as add_deltas:
        # #     async for delta_list in delta_list_iter(ws):
        # #         add_deltas(delta_list)

        print('Closing the connection in _new_stream_handler.')
        return ws

    async def _latest_handler(self, request):
        """This is what the web client connects to."""
        # Indicate that we got this connection
        self._n_inbound_connections += 1
        throttle_secs = get_shared_config('local.throttleSecs')

        try:
            # Establishe the websocket.
            ws = web.WebSocketResponse()
            await ws.prepare(request)

            print('got a client websocket connection.')
            current_queue = self._queue
            while True:
                # See if the queue has changed.
                if id(self._queue) != id(current_queue):
                    print('We got a new queue!')
                    current_queue = self._queue

                # See if we got any new deltas and send them across the wire.
                if current_queue != None:
                    await current_queue.flush_deltas(ws)

                # Watch for a CLOSE method as we sleep for throttle_secs.
                try:
                    msg = await ws.receive(timeout=throttle_secs)
                    if msg.type != WSMsgType.CLOSE:
                        print('Unknown message type:', msg.type)
                    print('Received close message. Breaking out of loop.')
                    break
                except asyncio.TimeoutError:
                    pass

            print('The connection closed naturally.')

            # with self._switchboard.stream_to(notebook_id) as add_deltas:
            #     async for delta_list in delta_list_iter(ws):
            #         add_deltas(delta_list)

            return ws

        # Close the server if there are no more connections.
        finally:
            self._n_inbound_connections -= 1
            if self._n_inbound_connections < 1:
                asyncio.get_event_loop().stop()

    #
    # async def _get_notebook_handler(self, request):
    #     # Parse out control information.
    #     notebook_id = request.match_info.get('notebook_id')
    #
    #     # Establishe the websocket.
    #     ws = web.WebSocketResponse()
    #     await ws.prepare(request)
    #
    #     async for delta_list in self._switchboard.stream_from(notebook_id):
    #         await ws.send_bytes(delta_list.SerializeToString())
    #
    #     # with self._switchboard.stream_to(notebook_id) as add_deltas:
    #     #     async for delta_list in delta_list_iter(ws):
    #     #         print(f'Got a delta_list with {len(delta_list.deltas)} deltas.')
    #     #         add_deltas(delta_list)
    #
    #     print('Closing the connection.')
    #     return ws


def main():
    """
    Creates a proxy server and launches the browser to connect to it.
    The proxy server will close when the browswer connection closes (or if
    it times out waiting for the browser connection.)
    """
    print('About to create a proxy.')
    proxy_server = Proxy()
    proxy_server.run_app()

if __name__ == '__main__':
    main()
