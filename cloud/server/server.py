"""This is a webserver for the streamlet project."""

import sys

sys.path.append('cloud/server')
import streamlet.shared.config

##################
# Database Stuff #
##################

import traceback
import sys
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from streamlet.shared import protobuf

def handle_coroutine_exceptions(coroutine):
    async def wrapped(*args, **kwargs):
        try:
            return await coroutine(*args, **kwargs)
        except:
            print(f'Exception in coroutine: {coroutine.__name__}')
            exc_type, exc_val, exc_tb = sys.exc_info()
            tb_list = traceback.format_list(traceback.extract_tb(exc_tb))
            tb_list.append(f'{exc_type.__name__}: {exc_val}')
            print(''.join(tb_list))
            sys.exit(-1)
    return wrapped

async def find_all(app):
    # raise RuntimeError('Testing exception handling AGAIN again.')
    print('Entered find_all')
    visits = app['db_main']['visits']
    print('visits', visits)
    async for doc in visits.find({}):
        print(doc)
    print('Finished the async for loop.')

def init_database(mongo_db_config):
    async def async_init_database(app):
        username, password, servers, args = (mongo_db_config[k]
            for k in ('username', 'password', 'servers', 'args'))
        uri = f'mongodb://{username}:{password}@{",".join(servers)}/{args}'
        app['db'] = AsyncIOMotorClient(uri)
        app['db_main'] = app['db']['main']
        await find_all(app)
    return handle_coroutine_exceptions(async_init_database)

def close_database():
    async def aync_close_database(app):
        print('Closing the database.')
        app['db'].close()
        print('Closed the database.')
    return handle_coroutine_exceptions(aync_close_database)

# loop = asyncio.get_event_loop()
# loop.run_until_complete(find_all())

# # debug - begin
# sys.exit(-1)
# # debug - end

####################
# Web Server Stuff #
####################

from aiohttp import web, WSMsgType
from streamlet.cloud.BinaryWebsocketHandler import BinaryWebsocketHandler

async def index(request):
    """Handler for the main index calls."""
    return web.Response(text='Hello printf!')

class StreamletWebsocketHandler(BinaryWebsocketHandler):
    async def on_open(self, request):
        """Called when the stream is opened."""
        local_id = request.match_info.get('local_id')
        notebook_id = request.match_info.get('notebook_id')
        print(f"Got a connection with local_id={local_id} and notebook_id={notebook_id}.")

    async def on_message(self, data):
        """Called everytime a message is received."""
        print('Received BINARY message '
            f'type={type(data)} '
            f'len={len(data)//1024}k.')
        delta_list = protobuf.DeltaList()
        delta_list.ParseFromString(data)
        print(f'Got a delta_list with {len(delta_list.deltas)} deltas.')
        for delta in delta_list.deltas:
            print(f'Delta {delta.id} is {len(delta.SerializeToString())/1024}k.')

    async def on_close(self):
        print('Closing the connection.')

def main():
    config = streamlet.shared.config.get_config()
    port = config['cloud']['port']
    assert set(config.keys()).issuperset(('mongodb', 'cloud')), \
        "config.yaml must include `mongodb` and `cloud` sections."
    app = web.Application()
    app.on_startup.append(init_database(config['mongodb']))
    app.on_cleanup.append(close_database())
    app.router.add_get('/', index)
    app.router.add_get('/api/new/{local_id}/{notebook_id}',
        StreamletWebsocketHandler.get_handler())
    print(f"Starting webserver at port {port}.")
    web.run_app(app, port=port)
    print('Closed webserver.')

if __name__ == '__main__':
    main()
