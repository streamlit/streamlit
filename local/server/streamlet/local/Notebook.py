"""A Notebook Object which exposes a print method which can be used to
write objects out to a wbpage."""

from aiohttp import web, ClientSession
import asyncio
import bson
import copy
import os
import threading
import time
import traceback

from streamlet.shared import protobuf
from streamlet.local.DeltaQueue import DeltaQueue
from streamlet.local.DeltaGenerator import DeltaGenerator
from streamlet.local import config as local_config
from streamlet.shared.config import get_config as get_shared_config

LAUNCH_BROWSER_SCRIPT = \
    'osascript ' \
    './local/client/node_modules/react-dev-utils/openChrome.applescript ' \
    'http://localhost:3000/'
SHUTDOWN_DELAY_SECS = 1.0

class Notebook:
    def __init__(self, save=False):
        """
        Creates a new notebook object.

        save - stream the notebook to the streamlet.io server for storage
        """
        # Create objects for the server.
        self._server_loop = asyncio.new_event_loop()
        self._server_running = False

        # Here is where we can create text
        self._delta_queues = [DeltaQueue()]
        self._delta_generator = DeltaGenerator(self._add_delta)

        # Remember whether or not we want to write to the server.
        self._save_to_cloud = save

        # Create an ID for this Notebook
        self._notebook_id = bson.ObjectId()

    def __enter__(self):
        # start the webserver
        self._launch_server()

        # Connect to streamlet.io if necessary.
        if self._save_to_cloud:
            self._connect_to_cloud()

        # launch the webbrowser
        os.system(LAUNCH_BROWSER_SCRIPT)

        # the generator allows the user to create new deltas
        return self._delta_generator

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Shut down the server."""
        # Display the stack trace if necessary.
        if exc_type != None:
            tb_list = traceback.format_list(traceback.extract_tb(exc_tb))
            tb_list.append(f'{exc_type.__name__}: {exc_val}')
            self._delta_generator.alert('\n'.join(tb_list))
            time.sleep(0.1)

        # close down the server
        print("About to send out an asynchronous stop.")
        self._stop()
        print("Sent out the stop")

        # We should rewrite the queue to no longer need this.
        time.sleep(SHUTDOWN_DELAY_SECS)

    def _launch_server(self):
        """Launches the server and runs an asyncio loop forever."""
        def run_server():
            print("Starting server in separate thread.")
            self._server_running = True
            asyncio.set_event_loop(self._server_loop)
            handler = self._get_connection_handler()
            port = get_shared_config()['local']['port']
            print(f'Launching on port {port}')
            app = web.Application()
            app.router.add_get('/websocket', handler)
            try:
                # self._server_loop.run_until_complete(start_server)
                print('Starting the server loop...')
                web.run_app(app, port=port, loop=self._server_loop,
                    handle_signals=False)
                # self._server_loop.run_forever()
            finally:
                print('About to close the loop.')
                self._server_loop.close()

        threading.Thread(target=run_server, daemon=True).start()

    def _add_delta(self, delta):
        """Distributes this delta into all queues."""
        # Distribute the delta into every queue. The first queue
        # is special: it's the master queue from which all others derive.
        async def async_add_delta():
            for queue in self._delta_queues:
                queue.add_delta(delta)

        # All code touching an queue must be run in the server even loop.
        # asyncio.run_coroutine_threadsafe(async_add_delta(), self._server_loop)
        self._enqueue_coroutine(async_add_delta)

    def _get_connection_handler(self):
        """Handles a websocket connection."""
        async def async_handle_connection(request):
            # Create a websocket connection.
            ws = web.WebSocketResponse()
            await ws.prepare(request)

            # Sends data from this connection
            await self._async_transmit_through_websocket(ws)

            print('Naturally finished handle connection.')
            return ws

        return async_handle_connection

    def _stop(self):
        """Stops the server loop."""
        # Stops the server loop.
        async def async_stop():
            # First, gracefully stop connections with _server_running = False.
            throttleSecs = get_shared_config()['local']['throttleSecs']
            self._server_loop.call_later(throttleSecs * 2,
                lambda: setattr(self, '_server_running', False))

            # After a short delay, hard-stop the server loop.
            self._server_loop.call_later(SHUTDOWN_DELAY_SECS / 2,
                self._server_loop.stop)

        # Code to stop the thread must be run in the server loop.
        self._enqueue_coroutine(async_stop)

    def _connect_to_cloud(self):
        async def async_connect_to_cloud():
            # Create a connection URI.
            server = get_shared_config()['cloud']['server']
            port = get_shared_config()['cloud']['port']
            local_id = local_config.get_local_id()
            notebook_id = self._notebook_id
            uri = f'htts://{server}:{port}/api/new/{local_id}/{notebook_id}'
            print('Connecting to', uri) # debug

            # Transmit data through this websocket.
            async with ClientSession().ws_connect(uri) as ws:
                await self._async_transmit_through_websocket(ws)
                print('Naturally finished handle connection.')

        # Code to connect to the cloud must be done in a separate thread.
        self._enqueue_coroutine(async_connect_to_cloud)

    def _enqueue_coroutine(self, coroutine):
        async def wrapped_coroutine():
            try:
                await coroutine()
            except:
                print(f'Got exception in {coroutine}.')
                traceback.print_exc()
                import sys
                sys.exit(-1)
        asyncio.run_coroutine_threadsafe(wrapped_coroutine(), self._server_loop)

    async def _async_transmit_through_websocket(self, ws):
        """Sends queue data across the websocket as it becomes available.
        Only returns after self._server_running becomes false."""
        # Create a new queue.
        queue = copy.deepcopy(self._delta_queues[0])
        self._delta_queues.append(queue)

        # Send queue data over the wire until _server_running becomes False.
        throttleSecs = get_shared_config()['local']['throttleSecs']
        async def send_deltas():
            deltas = queue.get_deltas()
            if deltas:
                delta_list = protobuf.DeltaList()
                delta_list.deltas.extend(deltas)
                await ws.send_bytes(delta_list.SerializeToString())
        while self._server_running:
            await send_deltas()
            await asyncio.sleep(throttleSecs)
        await send_deltas()
