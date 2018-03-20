"""A Notebook Object which exposes a print method which can be used to
write objects out to a wbpage."""

import aiohttp
from aiohttp import web, ClientSession
from aiohttp.client_exceptions import ClientConnectorError
import asyncio
import bson
import contextlib
import subprocess
import sys
import threading
import traceback

from streamlit.local import config as local_config
from streamlit.shared import config
from streamlit.shared.DeltaGenerator import DeltaGenerator
from streamlit.shared.NotebookQueue import NotebookQueue
from streamlit.shared.streamlit_msg_proto import new_notebook_msg

class Notebook:
    def __init__(self, save=False):
        """
        Creates a new notebook object.

        save  - Stream the notebook to the astreamlit.io server for storage.
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
            loop.run_until_complete(self._attempt_connection(loop))
            loop.close()
        threading.Thread(target=connection_thread, daemon=False).start()
        return loop

    async def _attempt_connection(self, loop):
        """Tries to establish a connection to the proxy (launching the
        proxy if necessary). Then, pumps deltas through the connection."""
        # Create a connection URI.
        server = config.get_option('proxy.server')
        port = config.get_option('proxy.port')
        local_id = local_config.get_local_id()
        notebook_id = self._notebook_id
        uri = f'http://{server}:{port}/new/{local_id}/{notebook_id}'

        # Try to connect twice to the websocket
        session = ClientSession(loop=loop)
        try:
            # Try to connect to the proxy for the first time.
            try:
                async with session.ws_connect(uri) as ws:
                    await self._transmit_through_websocket(ws)
                    return
            except ClientConnectorError:
                pass

            # Connecting to the proxy failed, so let's start the proxy manually.
            await self._launch_proxy()

            # Try again to transmit data through the proxy
            try:
                async with session.ws_connect(uri) as ws:
                    await self._transmit_through_websocket(ws)
            except ClientConnectorError:
                print(f'Failed to attent to connect to {uri}.')

        finally:
            # Closing the session.
            await session.close()

    async def _launch_proxy(self):
        """Launches the proxy server."""
        print('about to launch the proxy in a separate process', __file__)
        import os
        os.system('python -m streamlit.local.Proxy &')
        print('launched the proxy in a separate process.')
        print('sleeping while waiting for the proxy', config.get_option('local.waitForProxySecs'))
        await asyncio.sleep(config.get_option('local.waitForProxySecs'))
        print('Finished sleeping.')

    async def _transmit_through_websocket(self, ws):
        """Sends queue data across the websocket as it becomes available."""
        # Send the header information across.
        await new_notebook_msg(self._notebook_id, ws)

        # Send other information across.
        throttle_secs = config.get_option('local.throttleSecs')
        while self._connection_open:
            await self._queue.flush_deltas(ws)
            await asyncio.sleep(throttle_secs)
        await self._queue.flush_deltas(ws)

    @contextlib.contextmanager
    def _get_context_manager(self):
        """Returns a context manager for this Notebook which will be invoked
        when we say:

        with Notebook() as write:
            ...
        """
        try:
            # Open a connection to the proxy.
            loop = self._connect_to_proxy()

            # Create the DeltaGenerator
            enqueue_delta = lambda d: loop.call_soon_threadsafe(self._queue, d)
            delta_generator = DeltaGenerator(enqueue_delta)

            # Yield the DeltaGenerator as the write function.
            try:
                yield delta_generator
            except:
                exc_type, exc_val, tb = sys.exc_info()
                tb_list = traceback.format_list(traceback.extract_tb(tb))
                tb_list.append(f'{exc_type.__name__}: {exc_val}')
                delta_generator.alert('\n'.join(tb_list))

        finally:
            # Close the local webserver.
            loop.call_soon_threadsafe(setattr, self, '_connection_open', False)
