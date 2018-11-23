# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from future.types import newbytes
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import io
import base64


def marshall(proto, data):
    """Marshals a proto with binary data (converts to base64).

    Args
    ----
        proto: the proto to fill. Must have a string field called "data".
        data: a buffer with the binary data. Supported formats: str, bytes,
            BytesIO, NumPy array, or a file opened with io.open().
    """
    if type(data) is str:
        b64encodable = bytes(data)
    elif type(data) is newbytes:
        b64encodable = data
    elif type(data) is bytes:
        # Must come after str, since byte and str are equivalend in Python 2.7.
        b64encodable = data
    elif isinstance(data, io.BytesIO):
        data.seek(0)
        b64encodable = data.getvalue()
    elif isinstance(data, io.IOBase):
        data.seek(0)
        b64encodable = data.read()
    elif type(data).__name__ == 'ndarray':
        b64encodable = data
    else:
        raise RuntimeError('Invalid binary data format: %s' % type(data))

    data_b64 = base64.b64encode(b64encodable)
    proto.data = data_b64.decode('utf-8')
