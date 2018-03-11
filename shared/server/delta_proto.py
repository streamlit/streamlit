import aiohttp
from streamlet.shared import protobuf

async def delta_list_iter(ws):
    """Takes a websocket and yields a series of DeltaLists."""
    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.BINARY:
            delta_list = protobuf.DeltaList()
            try:
                delta_list.ParseFromString(msg.data)
            except Exception as e:
                print(f'Cannot parse binary message: {e}')
                continue
            yield delta_list
        elif msg.type == aiohttp.WSMsgType.CLOSE:
            ws.close()
        elif msg.type == aiohttp.aiohttp.WSMsgType.ERROR:
            print('ws connection closed with exception %s' %
                  ws.exception())
        else:
            print(f'Received incorrect message type {msg.type.name}.')
    print('websocket connection closed')
