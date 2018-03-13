"""A Notebook Object which exposes a print method which can be used to
write objects out to a wbpage."""

import aiohttp
from aiohttp import web, ClientSession
import asyncio
import bson
import contextlib
import subprocess
# import sys
import threading
# import time
# import traceback
# import webbrowser

# print('version', aiohttp.__version__)
# import sys
# sys.exit(-1)

from streamlet.local import config as local_config
from streamlet.shared.config import get_config as get_shared_config
from streamlet.shared.DeltaGenerator import DeltaGenerator
from streamlet.shared.NotebookQueue import NotebookQueue
# from streamlet.shared.Switchboard import Switchboard

# LAUNCH_BROWSER_SCRIPT = \
#     'osascript ' \
#     './local/client/node_modules/react-dev-utils/openChrome.applescript ' \
#     'http://localhost:3000/'
# SHUTDOWN_DELAY_SECS = 4.0
# LAUNCH_BROWSER_DELAY_SECS = 3.0

class Notebook:
    def __init__(self, save=False):
        """
        Creates a new notebook object.

        save  - Stream the notebook to the astreamlet.io server for storage.
        """
        # Create an ID for this Notebook
        self._notebook_id = bson.ObjectId()

        # Queue to store deltas as they flow across.
        self._queue = NotebookQueue()

        # Set to false when the connection should close.
        self._connection_open = True

        # This is the context manager for "with Notebook() as write:"
        self._context_manager = self._get_context_manager()

    def __enter__(self):
        """Opens up the context for this notebook so that the user can write."""
        return self._context_manager.__enter__()

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Closes down the context for this notebook."""
        self._context_manager.__exit__(exc_type, exc_val, exc_tb)

    def _connect_to_proxy(self):
        """Opens a connection to the server in a separate thread. Returns
        the event loop for that thread."""
        loop = asyncio.new_event_loop()
        def connection_thread():
            # asyncio.set_event_loop(loop)
            loop.run_until_complete(self._attempt_connection(loop))
            loop.close()
            print('THE LOCAL THREAD CLOSED NATURALLY!')
        threading.Thread(target=connection_thread, daemon=False).start()
        return loop

    async def _attempt_connection(self, loop):
        """Tries to establish a connection to the proxy (launching the
        proxy if necessary). Then, pumps deltas through the connection."""
        # Create a connection URI.
        server = get_shared_config('proxy.server')
        port = get_shared_config('proxy.port')
        local_id = local_config.get_local_id()
        notebook_id = self._notebook_id
        uri = f'http://{server}:{port}/new/{local_id}/{notebook_id}'
        print('Connecting to', uri) # debug

        # Try to connect twice to the websocket
        session = ClientSession(loop=loop)
        try:
            # Try to connect to the proxy for the first time.
            try:
                async with session.ws_connect(uri) as ws:
                    print('Got a websocket', ws)
                    await self._transmit_through_websocket(ws)
                    print('Naturally finished handle connection.')
                    return
            except aiohttp.client_exceptions.ClientConnectorError as err:
                print(f'Exception connecting to {uri}.')
                print(f'type: {type(err)}')
                print(f'message: {str(err)}')

            # Connecting to the proxy failed, so let's start the proxy manually.
            await self._launch_proxy()

            # Try again to transmit data through the proxy
            try:
                async with session.ws_connect(uri) as ws:
                    print('Got a websocket', ws)
                    await self._transmit_through_websocket(ws)
                    print('Naturally finished handle connection.')
            except aiohttp.client_exceptions.ClientConnectorError as err:
                print(f'SECOND Exception connecting to {uri}.')
                print(f'type: {type(err)}')
                print(f'message: {str(err)}')

        finally:
            # Closing the session.
            await session.close()

            # # Set up the webserver.
            # handler = self._get_connection_handler()
            # app = web.Application(loop=self._loop)
            # app.router.add_get('/websocket', handler)
            # static_route = app.router.add_static('/',
            #     path=(os.path.split(__file__)[0] + '/../../../client/build'))
            #
            # # Actually start the server.
            # try:
            #     print('About to do run_app')
            #     web.run_app(app, port=get_shared_config('local.port'),
            #         handle_signals=False)
            #     print('Finished run_app.')
            # finally:
            #     print('About to close the loop.')
            #     self._loop.close()


    async def _launch_proxy(self):
        """Launches the proxy server."""
        print('about to launch the proxy in a separate process', __file__)
        import os
        os.system('./proxy &')
        # subprocess.Popen('proxy')
        print('launched the proxy in a separate process.')
        print('sleeping while waiting for the proxy', get_shared_config('local.waitForProxySecs'))
        await asyncio.sleep(get_shared_config('local.waitForProxySecs'))
        print('Finished sleeping.')

    # def _get_connection_handler(self):
    #     """Handles a websocket connection."""
    #     async def async_handle_connection(request):
    #         # Create a websocket connection.
    #         ws = web.WebSocketResponse()
    #         await ws.prepare(request)
    #
    #         # Remember that we've got a connection so we don't open a browser.
    #         self._received_connection = True
    #
    #         # Sends data from this connection
    #         await self._transmit_through_websocket(ws)
    #         return ws
    #
    #     return async_handle_connection

    # def _connect_to_cloud(self):
    #     async def async_connect_to_cloud():

    #
    #     # Code to connect to the cloud must be done in a separate thread.
    #     self._enqueue_coroutine(async_connect_to_cloud)
    #
    #
    async def _transmit_through_websocket(self, ws):
        """Sends queue data across the websocket as it becomes available."""
        print(f'About to stream from {self._notebook_id} through {ws}')
        throttle_secs = get_shared_config('local.throttleSecs')
        while self._connection_open:
            await self._queue.flush_deltas(ws)
            print('Just sent deltas through _transmit_through_websocket.')
            await asyncio.sleep(throttle_secs)
        await self._queue.flush_deltas(ws)
        print('Naturally finished transmitting through the websocket.')
        # delta_list_aiter = self._switchboard.stream_from(self._notebook_id)
        # async for delta_list in delta_list_aiter:
        #

    # def _enqueue_coroutine(self, coroutine):
    #     """Runs a coroutine in the server loop."""
    #     async def wrapped_coroutine():
    #         try:
    #             await coroutine()
    #         except:
    #             print(f'Caught exception in {coroutine}.')
    #             traceback.print_exc()
    #             import sys
    #             sys.exit(-1)
    #     asyncio.run_coroutine_threadsafe(wrapped_coroutine(), self._loop)

    @contextlib.contextmanager
    def _get_context_manager(self):
        """Returns a context manager for this Notebook which will be invoked
        when we say:

        with Notebook() as write:
            ...
        """
        print('Entering _get_context_manager()')
        try:
            # Open a connection to the proxy.
            loop = self._connect_to_proxy()

            # Create the DeltaGenerator
            enqueue_delta = lambda d: loop.call_soon_threadsafe(self._queue, d)
            delta_generator = DeltaGenerator(enqueue_delta)
            print('Created a DeltaGenerator with asynchronous add_delta.')
#
#             # Start the local webserver.
#             self._launch_server()
#             print(f'Launched server: _display_locally={self._display_locally}')
#             if self._display_locally:
#                 self._loop.call_later(LAUNCH_BROWSER_DELAY_SECS,
#                     self._open_browser_if_necessary)
#                 # os.system(LAUNCH_BROWSER_SCRIPT)
#
#             # Connect to streamlet.io if necessary.
#             if self._save_to_cloud:
#                 self._connect_to_cloud()
#
            # Yield the DeltaGenerator as the write function.
            try:
                yield delta_generator
            except:
                exc_type, exc_val, tb = sys.exc_info()
                tb_list = traceback.format_list(traceback.extract_tb(tb))
                tb_list.append(f'{exc_type.__name__}: {exc_val}')
                delta_generator.alert('\n'.join(tb_list))
#
#             # Give the client a little time to connect.
#             if self._display_locally:
#                 time.sleep(SHUTDOWN_DELAY_SECS)
#
        finally:
            # Close the local webserver.
            print('Dispatching asynchronous stop to the loop.')
            loop.call_soon_threadsafe(setattr, self, '_connection_open', False)
            print('Dispatched asynchronous stop to the loop.')

    #         # # We should rewrite the queue to no longer need this.
    #         # print(f'About to sleep for {SHUTDOWN_DELAY_SECS} seconds.')
    #         # time.sleep(SHUTDOWN_DELAY_SECS)
    #         # print(f'Finished sleeping for {SHUTDOWN_DELAY_SECS} seconds.')
    #         print('Exiting _get_context_manager()')
    #
    # def _open_browser_if_necessary(self):
    #     """This is called after a timeout and it opens a browser window if
    #     enough time has gone by and we haven't gotten a connection."""
    #     print('Entered _open_browser_if_necessary')
    #     if not self._received_connection:
    #         print('Opening the local connection.')
    #         host = get_shared_config('local.server')
    #         port = get_shared_config('local.port')
    #         webbrowser.open(f'http://{host}:{port}/index.html')
    #         print(f'opening http://{host}:{port}/index.html')
