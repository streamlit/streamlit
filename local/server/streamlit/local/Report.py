"""A Report Object which exposes a print method which can be used to
write objects out to a wbpage."""

import aiohttp
from aiohttp import web, ClientSession
from aiohttp.client_exceptions import ClientConnectorError
import asyncio
import bson
# import contextlib
import subprocess
import sys
import threading
import traceback

from streamlit.local.util import get_local_id
from streamlit.shared import config
from streamlit.shared.DeltaGenerator import DeltaGenerator
from streamlit.shared.ReportQueue import ReportQueue
from streamlit.shared.streamlit_msg_proto import new_report_msg

# This is a stack of open reports.
__report_stack = []

class Report:
    """This encapsulates a single Report which contains data which it sent to
    the Streamlit server."""

    def __init__(self, save=False):
        """
        Creates a new report object.

        save  - Stream the report to the streamlit.io server for storage.
        """
        # Create an ID for this Report
        self._report_id = bson.ObjectId()

        # Queue to store deltas as they flow across.
        self._queue = ReportQueue()

        # Set to false when the connection should close.
        self._connection_open = True

        # # This is the context manager for "with Report() as write:"
        # self._context_manager = self._get_context_manager()

        # This is the event loop to talk with the serverself.
        self._loop = asyncio.new_event_loop()

        # This is the class through which we can add elements to the Report
        self._delta_generator = DeltaGenerator(self._enqueue_delta)

    def register(self):
        """Registers this report as the currently open Report and opens
        a connection with the server."""
        print('Registering the Report... so OPENING the connection.')
        self._connect_to_proxy()

    def unregister(self):
        """Closes the server connection and unregisters this report."""
        print('Unregistering the Report... so closing the connection.')
        self._loop.call_soon_threadsafe(setattr, self,
            '_connection_open', False)

    def get_delta_generator(self):
        """Returns the DeltaGenerator for this report. This is the object
        that allows you to dispatch toplevel deltas to the Report, e.g.
        adding new elements."""
        return self._delta_generator

    # def __enter__(self):
    #     """Opens up the context for this report so that the user can write."""
    #     return self._context_manager.__enter__()
    #
    # def __exit__(self, exc_type, exc_val, exc_tb):
    #     """Closes down the context for this report."""
    #     self._context_manager.__exit__(exc_type, exc_val, exc_tb)

    def _enqueue_delta(self, delta):
        """Enqueues the given delta for transmission to the server."""
        self._loop.call_soon_threadsafe(self._queue, delta)

    def _connect_to_proxy(self):
        """Opens a connection to the server in a separate thread. Returns
        the event loop for that thread."""
        def connection_thread():
            self._loop.run_until_complete(self._attempt_connection())
            self._loop.close()
        threading.Thread(target=connection_thread, daemon=False).start()

    async def _attempt_connection(self):
        """Tries to establish a connection to the proxy (launching the
        proxy if necessary). Then, pumps deltas through the connection."""
        # Create a connection URI.
        server = config.get_option('proxy.server')
        port = config.get_option('proxy.port')
        local_id = get_local_id()
        report_id = self._report_id
        uri = f'http://{server}:{port}/new/{local_id}/{report_id}'

        # Try to connect twice to the websocket
        session = ClientSession(loop=self._loop)
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
        wait_for_proxy_secs = config.get_option('local.waitForProxySecs')
        print('about to launch the proxy in a separate process', __file__)
        import os
        os.system('python -m streamlit.local.Proxy &')
        print('launched the proxy in a separate process.')
        print('sleeping while waiting for the proxy', wait_for_proxy_secs)
        await asyncio.sleep(wait_for_proxy_secs)
        print('Finished sleeping.')

    async def _transmit_through_websocket(self, ws):
        """Sends queue data across the websocket as it becomes available."""
        # Send the header information across.
        await new_report_msg(self._report_id, ws)

        # Send other information across.
        throttle_secs = config.get_option('local.throttleSecs')
        while self._connection_open:
            await self._queue.flush_deltas(ws)
            await asyncio.sleep(throttle_secs)
        await self._queue.flush_deltas(ws)

    # @contextlib.contextmanager
    # def _get_context_manager(self):
    #     """Returns a context manager for this Report which will be invoked
    #     when we say:
    #
    #     with Report() as write:
    #         ...
    #     """
    #     try:
    #         # Open a connection to the proxy.
    #         loop = self._connect_to_proxy()
    #
    #         # Create the DeltaGenerator
    #         enqueue_delta = lambda d:
    #
    #
    #         # Yield the DeltaGenerator as the write function.
    #         try:
    #             yield delta_generator
    #         except:
    #             exc_type, exc_val, tb = sys.exc_info()
    #             tb_list = traceback.format_list(traceback.extract_tb(tb))
    #             tb_list.append(f'{exc_type.__name__}: {exc_val}')
    #             delta_generator.alert('\n'.join(tb_list))
    #
    #     finally:
    #         # Close the local webserver.
