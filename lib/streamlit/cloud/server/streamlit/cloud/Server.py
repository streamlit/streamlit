"""Represents the streamlit.io cloud server."""

from aiohttp import web, WSMsgType
from streamlit.cloud.delta_proto import delta_list_iter
from streamlit.shared.config import get_config as get_shared_config
from streamlit.shared.Switchboard import Switchboard
import asyncio

class Server:
    """The main base class for the streamlit server."""

    def __init__(self):
        # Set up the server.
        self._app = web.Application()
        # app.on_startup.append(init_database(config['mongodb']))
        # app.on_cleanup.append(close_database())
        self._app.router.add_get('/', self._index_handler)
        self._app.router.add_get('/api/new/{local_id}/{report_id}',
            self._new_stream_handler)
        self._app.router.add_get('/api/get/{report_id}',
            self._get_report_handler)
        self._app.router.add_get('/api/getx/',
            self._cross_handler)

        # The switchboard maintains "live" reports, that is, those with
        # open connections.
        self._switchboard = Switchboard(asyncio.get_event_loop(),
            remove_master_queues=False)

    def run_app(self):
        """Runs the web app."""
        port = get_shared_config('cloud.port')
        web.run_app(self._app, port=port)

    async def _index_handler(self, request):
        """Handler for the main index calls."""
        return web.Response(text='Hello streamlit!')

    async def _new_stream_handler(self, request):
        # Parse out the control information.
        local_id = request.match_info.get('local_id')
        report_id = request.match_info.get('report_id')
        print(f"Got a connection with local_id={local_id} and report_id={report_id}.")

        # Establishe the websocket.
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        with self._switchboard.stream_to(report_id) as add_deltas:
            async for delta_list in delta_list_iter(ws):
                add_deltas(delta_list)

        print('Closing the connection.')
        return ws

    async def _get_report_handler(self, request):
        # Parse out control information.
        report_id = request.match_info.get('report_id')

        # Establishe the websocket.
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        async for delta_list in self._switchboard.stream_from(report_id):
            await ws.send_bytes(delta_list.SerializeToString())

        # with self._switchboard.stream_to(report_id) as add_deltas:
        #     async for delta_list in delta_list_iter(ws):
        #         print(f'Got a delta_list with {len(delta_list.deltas)} deltas.')
        #         add_deltas(delta_list)

        print('Closing the connection.')
        return ws

    async def _cross_handler(self, request):
        # Establishe the websocket.
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        async for delta_list in self._switchboard.cross_stream():
            await ws.send_bytes(delta_list.SerializeToString())

        # with self._switchboard.stream_to(report_id) as add_deltas:
        #     async for delta_list in delta_list_iter(ws):
        #         print(f'Got a delta_list with {len(delta_list.deltas)} deltas.')
        #         add_deltas(delta_list)

        print('Closing the connection.')
        return ws
