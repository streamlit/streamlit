# -*- coding: future_fstrings -*-

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

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
    yield ws.write_message(msg.SerializeToString(), binary=True)
