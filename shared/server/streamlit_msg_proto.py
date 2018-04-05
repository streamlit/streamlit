import aiohttp
from streamlit.shared import protobuf

async def new_report_msg(report_id, ws):
    """Sends a message indicating a new report across the websocket wire.

    report_id - the BSON ObjectId of the new report
    ws          - the websocket
    """
    msg = protobuf.StreamlitMsg()
    msg.new_report = str(report_id)
    # object_id_proto.marshall_object_id(report_id, msg.new_report)
    await ws.send_bytes(msg.SerializeToString())

async def streamlit_msg_iter(ws):
    """Takes a websocket and yields a series of DeltaLists."""
    async for binary_msg in ws:
        if binary_msg.type == aiohttp.WSMsgType.BINARY:
            streamlit_msg = protobuf.StreamlitMsg()
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
