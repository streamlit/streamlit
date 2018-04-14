import aiohttp
from streamlit.shared import protobuf

async def new_report_msg(report_id, report_name, ws):
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
    msg = protobuf.StreamlitMsg()
    msg.new_report.id = str(report_id)
    msg.new_report.name = report_name
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
