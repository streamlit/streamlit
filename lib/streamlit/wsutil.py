# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

"""Utilities for use with WebSockets."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())


def write_proto(ws, msg):
    """Writes a proto to a websocket.

    Parameters
    ----------
    ws : WebSocket
    msg : Proto
    """
    return ws.write_message(msg.SerializeToString(), binary=True)
