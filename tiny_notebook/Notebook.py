"""A Notebook Object which exposes a print method which can be used to
write objects out to a wbpage."""

import asyncio
import copy
import os
import threading
import traceback
import websockets
import time

from tiny_notebook import protobuf
from tiny_notebook.DeltaQueue import DeltaQueue
from tiny_notebook.DeltaGenerator import DeltaGenerator

WEBSOCKET_PORT = 8315
LAUNCH_BROWSER_SCRIPT = \
    'osascript ' \
    './web-client/node_modules/react-dev-utils/openChrome.applescript ' \
    'http://localhost:3000/'
SHUTDOWN_DELAY_SECS = 1.0
THROTTLE_SECS = 0.01

class Notebook:
    def __init__(self):
        # Create objects for the server.
        self._server_loop = asyncio.new_event_loop()
        self._server_running = False

        # Here is where we can create text
        self._delta_queues = [DeltaQueue()]
        self._delta_generator = DeltaGenerator(self._add_delta)

    def __enter__(self):
        # start the webserver
        self._launch_server()

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

        # # A small delay to flush anything left.
        # time.sleep(Notebook._OPEN_WEBPAGE_SECS)
        #
        # # Delay server shutdown if we haven't transmitted everything yet
        # if not (self._received_GET and self._transmitted_final_state()):
        #     print(f'Sleeping for {Notebook._FINAL_SHUTDOWN_SECS} '
        #         'seconds to flush all elements.')
        #     time.sleep(Notebook._FINAL_SHUTDOWN_SECS)
        # self._keep_running = False
        # self._httpd.server_close()
        # print('Closed down server.')

    def _launch_server(self):
        """Launches the server and runs an asyncio loop forever."""
        def run_server():
            print("Starting server in separate thread.")
            self._server_running = True
            asyncio.set_event_loop(self._server_loop)
            handler = self._get_connection_handler()
            start_server = websockets.serve(handler, '', WEBSOCKET_PORT)
            try:
                self._server_loop.run_until_complete(start_server)
                print('Starting the server loop...')
                self._server_loop.run_forever()
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
        asyncio.run_coroutine_threadsafe(async_add_delta(), self._server_loop)

    def _get_connection_handler(self):
        """Handles a websocket connection."""
        async def async_handle_connection(websocket, path):
            # Creates a new queue for this connection.
            queue = copy.deepcopy(self._delta_queues[0])
            self._delta_queues.append(queue)

            # Go into an endless loop.
            async def send_deltas():
                deltas = queue.get_deltas()
                if deltas:
                    delta_list = protobuf.DeltaList()
                    delta_list.deltas.extend(deltas)
                    await websocket.send(delta_list.SerializeToString())
            while self._server_running:
                await send_deltas()
                await asyncio.sleep(THROTTLE_SECS)
            await send_deltas()

            print('Naturally finished handle connection.')
        return async_handle_connection

    def _stop(self):
        """Stops the server loop."""
        # Stops the server loop.
        async def async_stop():
            # First, gracefully stop connections with _server_running = False.
            self._server_loop.call_later(THROTTLE_SECS * 2,
                lambda: setattr(self, '_server_running', False))

            # After a short delay, hard-stop the server loop.
            self._server_loop.call_later(SHUTDOWN_DELAY_SECS,
                self._server_loop.stop)

        # Code to stop the thread must be run in the server loop.
        asyncio.run_coroutine_threadsafe(async_stop(), self._server_loop)
