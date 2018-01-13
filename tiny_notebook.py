"""
A notebook that can be used to print rich data to a local website.
"""

import asyncio
import websockets
import threading
import json

WEBSOCKET_PORT = 8315

async def handle_connection(websocket, path):
    print('Got a connection.')
    for progress in range(100):
        await asyncio.sleep(0.01)
        await websocket.send(json.dumps({'progress': progress}))

async def stop_loop(loop):
    loop.stop()

def launch_server(loop):
    """Launches the server and runs an asyncio loop forever."""
    asyncio.set_event_loop(loop)
    start_server = websockets.serve(handle_connection, '', WEBSOCKET_PORT)
    try:
        loop.run_until_complete(start_server)
        print('Starting the server loop...')
        loop.run_forever()
    finally:
        print('About to close the loop.')
        loop.close()

loop = asyncio.new_event_loop()
try:
    server_thread = threading.Thread(target=launch_server, args=(loop,))
    server_thread.start()
    while True:
        pass
except KeyboardInterrupt:
    print('Received keyboard interrupt. Shutting down.')
    if loop.is_running():
        asyncio.run_coroutine_threadsafe(stop_loop(loop), loop)
