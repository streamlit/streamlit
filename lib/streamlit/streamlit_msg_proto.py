# -*- coding: future_fstrings -*-

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from streamlit import protobuf
from tornado import gen
import sys

@gen.coroutine
def new_report_msg(report_id, cwd, command_line, ws):
    """
    Sends a message indicating a new report across the websocket wire.

    Args
    ----
    report_id : uuid
        ID of the new report
    cwd : string
        The current working directory from which this report was launched.
    command_line : list of strings
        the command line arguments used to launch the report
    ws : websocket
        the websocket
    """
    # Pack it into a ForwardMsg
    msg = protobuf.ForwardMsg()
    msg.new_report.id = str(report_id)
    msg.new_report.cwd = cwd
    msg.new_report.command_line.extend(command_line)
    yield ws.write_message(msg.SerializeToString(), binary=True)
