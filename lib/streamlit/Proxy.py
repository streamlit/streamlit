"""A proxy server between the Streamlit libs and web client.

Internally, the Proxy basically does bookkeeping for a set of ProxyConnection
objects. A ProxyConnection always has:

    - One "local" connection to the python libs.
    - Zero or more "client" connections to the web client.

Essentially, the ProxyConnection stays open so long as any of those connections
do. When the final ProxyConnection closes, then the whole proxy does too.

To ensure the proxy closes, a short timeout is launched for each connection
which closes the proxy if no connections were established.
"""

from aiohttp import web, WSMsgType
import asyncio
import os
import urllib
import webbrowser
import secrets
import concurrent.futures

from streamlit import config
from streamlit import protobuf
from streamlit.ProxyConnection import ProxyConnection
from streamlit.streamlit_msg_proto import new_report_msg
from streamlit.streamlit_msg_proto import streamlit_msg_iter
from streamlit.S3Connection import S3Connection

def _stop_proxy_on_exception(coroutine):
    """Coroutine decorator which stops the the proxy if an exception
    propagates out of the inner coroutine."""
    async def wrapped_coroutine(proxy, *args, **kwargs):
        try:
            return await coroutine(proxy, *args, **kwargs)
        except:
            proxy.stop()
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
            web.get('/', self._client_html_handler),

            # Outgoing endpoint to get the latest report.
            web.get('/stream/{report_name}', self._client_ws_handler)
        ])

        # If we're not using the node development server, then the proxy
        # will serve up the development pages.
        if not config.get_option('proxy.useNode'):
            static_path = config.get_path('proxy.staticRoot')
            self._app.router.add_static('/', path=static_path)

        # Avoids an exception by guarding against twice stopping the event loop.
        self._stopped = False

        # This table from names to ProxyConnections stores all the information
        # about our connections. When the number of connections drops to zero,
        # then the proxy shuts down.
        self._connections = {}

        # Initialized things that the proxy will need to do cloud things.
        self._cloud = S3Connection()

    def run_app(self):
        """Runs the web app."""
        port = config.get_option('proxy.port')
        web.run_app(self._app, port=port)

    def stop(self):
        """Stops the proxy. Allowing all current handler to exit normally."""
        if not self._stopped:
            asyncio.get_event_loop().stop()
        self._stopped = True

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
            # Establishe the websocket.
            ws = web.WebSocketResponse()
            await ws.prepare(request)

            async for msg in streamlit_msg_iter(ws):
                msg_type = msg.WhichOneof('type')
                if msg_type == 'new_report':
                    assert not connection, 'Cannot send `new_report` twice.'
                    report_id = msg.new_report
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

        # Manages our connection to the local client.
        connection, queue = None, None

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
        quoted_name = urllib.parse.quote_plus(name)
        url = f'http://{host}:{port}/?name={quoted_name}'
        webbrowser.open(url)

    def _register(self, connection):
        """Registers this connection under it's name so that client connections
        will connect to it."""
        # Register the connection and launch a web client if this is a new name.
        new_name = connection.name not in self._connections
        self._connections[connection.name] = connection
        if new_name:
            self._lauch_web_client(connection.name)
            # self._cloud.create(connection.name)

        # Clean up the connection we don't get an incoming connection.
        def connection_timeout():
            connection.end_grace_period()
            self._try_to_deregister(connection)
            self._potentially_stop_proxy()
        timeout_secs = config.get_option('proxy.waitForConnectionSecs')
        loop = asyncio.get_event_loop()
        loop.call_later(timeout_secs, connection_timeout)

    def _try_to_deregister(self, connection):
        """Deregisters this ProxyConnection so long as there aren't any open
        connection (local or client), and the connection is no longer in its
        grace period."""
        if self._is_registered(connection) and connection.can_be_deregistered():
            del self._connections[connection.name]

    def _is_registered(self, connection):
        """Returns true if this connection is registered to its name."""
        return self._connections.get(connection.name, None) is connection

    async def _add_client(self, report_name, ws):
        """Adds a queue to the connection for the given report_name."""
        connection = self._connections[report_name]
        queue = connection.add_client_queue()
        await new_report_msg(connection.id, ws)
        return (connection, queue)

    def _remove_client(self, connection, queue):
        """Removes the queue from the connection, and closes the connection if
        necessary."""
        connection.remove_client_queue(queue)
        self._try_to_deregister(connection)
        self._potentially_stop_proxy()

    def _potentially_stop_proxy(self):
        """Checks to see if we have any open connections. If not,
        close the proxy."""
        if not self._connections:
            self.stop()

    async def _handle_backend_msg(self, payload, connection, ws):
        backend_msg = protobuf.BackMsg()
        try:
            backend_msg.ParseFromString(payload)
            command  = backend_msg.command
            if command == protobuf.BackMsg.Command.Value('HELP'):
                os.system('python -m streamlit help &')
            elif command == protobuf.BackMsg.Command.Value('CLOUD_UPLOAD'):
                await self._save_cloud(connection, ws)
            else:
                print("no handler for",
                    protobuf.BackMsg.Command.Name(backend_msg.command))
        except Exception as e:
            print(f'Cannot parse binary message: {e}')

    async def _save_cloud(self, connection, ws):
        """Saves a serialized version of this report's deltas to the cloud."""
        # Indicate that the save is starting.
        progress_msg = protobuf.ForwardMsg()
        progress_msg.upload_report_progress = 100
        await ws.send_bytes(progress_msg.SerializeToString())

        # COMMENTED OUT FOR THIAGO (becuase he doesn't have AWS creds)
        report = connection.get_report_proto()
        print(f'Saving report of size {len(report.SerializeToString())} and type {type(report.SerializeToString())}')
        url = await self._cloud.upload_report(connection.id, report)

        # # Pretend to upload something.
        # await asyncio.sleep(3.0)
        # url = 'https://s3-us-west-2.amazonaws.com/streamlit-test10/streamlit-static/0.9.0-b5a7d29ec8d0469961e5e5f050944dd4/index.html?id=90a3ef64-7a67-4f90-88c9-8161934af74a'

        # Indicate that the save is done.
        progress_msg.Clear()
        progress_msg.report_uploaded = url
        await ws.send_bytes(progress_msg.SerializeToString())

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
