"""A Notebook Object which exposes a print method which can be used to
write objects out to a wbpage."""

from aiohttp import web, ClientSession
import asyncio
import bson
import contextlib
import os
import threading
import time
import traceback

from streamlet.shared import protobuf
from streamlet.local.DeltaGenerator import DeltaGenerator
from streamlet.local import config as local_config
from streamlet.shared.config import get_config as get_shared_config
from streamlet.shared.Switchboard import Switchboard

LAUNCH_BROWSER_SCRIPT = \
    'osascript ' \
    './local/client/node_modules/react-dev-utils/openChrome.applescript ' \
    'http://localhost:3000/'
SHUTDOWN_DELAY_SECS = 1.0

class Notebook:
    def __init__(self, local=True, save=False):
        """
        Creates a new notebook object.

        local - Display the stream locally.
        save  - Stream the notebook to the astreamlet.io server for storage.
        """
        # These flags determine where the data is sent
        self._display_locally = local
        self._save_to_cloud = save

        # Create an ID for this Notebook
        self._notebook_id = bson.ObjectId()

        # Create an event loop for the local _server_running
        self._loop = asyncio.new_event_loop()

        # Where we send delta queue data to
        self._switchboard = Switchboard(self._loop)

        # This is the context manager for "with Notebook() as write:"
        self._context_manager = self._get_context_manager()

    def __enter__(self):
        """Opens up the context for this notebook so that the user can write."""
        return self._context_manager.__enter__()

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Closes down the context for this notebook."""
        self._context_manager.__exit__(exc_type, exc_val, exc_tb)

    def _launch_server(self):
        """Launches the server and runs an asyncio loop forever."""
        def run_server():
            # Create an event loop for this thread.
            asyncio.set_event_loop(self._loop)

            # Set up the webserver.
            handler = self._get_connection_handler()
            app = web.Application()
            app.router.add_get('/websocket', handler)

            # Actually start the server.
            try:
                print('About to do run_app')
                web.run_app(app, port=get_shared_config('local.port'),
                    loop=self._loop, handle_signals=False)
                print('Finished run_app.')
            finally:
                print('About to close the loop.')
                self._loop.close()

        threading.Thread(target=run_server, daemon=False).start()

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
        pass

        # async def async_stop():
        #     # After a short delay, hard-stop the server loop.
        #
        #
        #
        # # Code to stop the thread must be run in the server loop.
        # self._enqueue_coroutine(async_stop)

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


    async def _async_transmit_through_websocket(self, ws):
        """Sends queue data across the websocket as it becomes available."""
        delta_list_aiter = self._switchboard.stream_from(self._notebook_id)
        async for delta_list in delta_list_aiter:
            await ws.send_bytes(delta_list.SerializeToString())

    def _enqueue_coroutine(self, coroutine):
        """Runs a coroutine in the server loop."""
        async def wrapped_coroutine():
            try:
                await coroutine()
            except:
                print(f'Got exception in {coroutine}.')
                traceback.print_exc()
                import sys
                sys.exit(-1)
        asyncio.run_coroutine_threadsafe(wrapped_coroutine(), self._loop)

    @contextlib.contextmanager
    def _get_context_manager(self):
        """Returns a context manager for this Notebook which will be invoked
        when we say:

        with Notebook() as write:
            ...
        """
        print('Entering _get_context_manager()')
        try:
            with self._switchboard.stream_to(self._notebook_id) as stream_to:
                # Create the DeltaGenerator
                def add_delta(delta):
                    delta_list = protobuf.DeltaList()
                    delta_list.deltas.extend([delta])
                    stream_to(delta_list)
                delta_generator = DeltaGenerator(add_delta)
                print('Created a DeltaGenerator with asynchronous add_delta.')

                # Start the local webserver.
                self._launch_server()
                if self._display_locally:
                    os.system(LAUNCH_BROWSER_SCRIPT)

                # Connect to streamlet.io if necessary.
                if self._save_to_cloud:
                    self._connect_to_cloud()

                # Yield the DeltaGenerator as the write function.
                try:
                    yield delta_generator
                except:
                    exc_type, exc_val, tb = sys.exc_info()
                    tb_list = traceback.format_list(traceback.extract_tb(tb))
                    tb_list.append(f'{exc_type.__name__}: {exc_val}')
                    delta_generator.alert('\n'.join(tb_list))

                # Give the client a little time to connect.
                if self._display_locally:
                    time.sleep(SHUTDOWN_DELAY_SECS)

        finally:
            # Close the local webserver.
            print('Dispatching asynchronous stop to the loop.')
            def stop_loop():
                print('Calling stop on loop.')
                self._loop.stop()
                print('Called stop on loop.')
            self._loop.call_later(SHUTDOWN_DELAY_SECS / 2, stop_loop)
            print('Dispatched asynchronous stop to the loop.')

            # # We should rewrite the queue to no longer need this.
            # print(f'About to sleep for {SHUTDOWN_DELAY_SECS} seconds.')
            # time.sleep(SHUTDOWN_DELAY_SECS)
            # print(f'Finished sleeping for {SHUTDOWN_DELAY_SECS} seconds.')
            print('Exiting _get_context_manager()')
