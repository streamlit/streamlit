# Copyright 2018 Streamlit Inc. All rights reserved.

"""A Python wrapper around Vega Lite.
"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import json

from streamlit import data_frame_proto, protobuf
from streamlit.dicttools import unflatten

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


def marshall(proto, data=None, spec=None, **kwargs):
    """Constructs a Vega Lite chart object.

    See DeltaGenerator.vega_lite_chart for docs.
    """
    if data is None:
        data = []

    if spec is None:
        spec = dict()

    # Merge spec with unflattened kwargs, where kwargs take precedence.
    # This only works for string keys, but kwarg keys are strings anyways.
    spec = dict(spec, **unflatten(kwargs, _ENCODINGS))

    proto.spec = json.dumps(spec)
    data_frame_proto.marshall_data_frame(data, proto.data)


# See https://vega.github.io/vega-lite/docs/encoding.html
_ENCODINGS = set([
    'x',
    'y',
    'x2',
    'y2',
    'longitude',
    'latitude',
    'color',
    'opacity',
    'size',
    'shape',
    'text',
    'tooltip',
    'href',
    'key',
    'order',
    'detail',
    'row',
    'column',
])
