# -*- coding: future_fstrings -*-

# Python 2/3 compatibility
from __future__ import print_function
from __future__ import division
from __future__ import unicode_literals
from __future__ import absolute_import
from builtins import range, map, str, dict, object, zip, int
from io import open
from future.standard_library import install_aliases
install_aliases()

from streamlit import protobuf
from tornado import gen

@gen.coroutine
def new_report_msg(report_id, ws):
    """
    Sends a message indicating a new report across the websocket wire.

    Args
    ----
    report_id : BSON ObjectId
        ID of the new report
    report_name : string
        name of the report
    ws : websocket
        the websocket
    """
    msg = protobuf.ForwardMsg()
    msg.new_report = str(report_id)
    yield ws.send_bytes(msg.SerializeToString())

def streamlit_msg_iter(ws):
    pass
'''
async def streamlit_msg_iter(ws):
    """Takes a websocket and yields a series of DeltaLists."""
    async for binary_msg in ws:
        if binary_msg.type == aiohttp.WSMsgType.BINARY:
            streamlit_msg = protobuf.ForwardMsg()
            try:
                streamlit_msg.ParseFromString(binary_msg.data)
            except Exception as e:
                print(f'Cannot parse binary message: {e}')
                continue
            yield streamlit_msg
        elif binary_msg.type == aiohttp.WSMsgType.CLOSE:
            ws.close()
        elif binary_msg.type == aiohttp.aiohttp.WSMsgType.ERROR:
            print('ws connection closed with exception %s' %
                  ws.exception())
        else:
            print(f'Received incorrect message type {binary_msg.type.name}.')
'''
