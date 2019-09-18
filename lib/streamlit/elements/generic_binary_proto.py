# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

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
    if type(data) in string_types:
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
    elif type(data).__name__ == "ndarray":
        b64encodable = data
    else:
        raise RuntimeError("Invalid binary data format: %s" % type(data))

    data_b64 = base64.b64encode(b64encodable)
    proto.data = data_b64.decode("utf-8")
