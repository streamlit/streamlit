# Copyright 2018 Streamlit Inc. All rights reserved.

"""A Python wrapper around Vega Lite."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import json

from streamlit import data_frame_proto
from streamlit.dicttools import unflatten

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


def marshall(proto, data=None, spec=None, **kwargs):
    """Construct a Vega Lite chart object.

    See DeltaGenerator.vega_lite_chart for docs.
    """
    if type(data) in dict_types and spec is None:
        spec = data
        data = None

    if spec is None:
        spec = dict()

    # Merge spec with unflattened kwargs, where kwargs take precedence.
    # This only works for string keys, but kwarg keys are strings anyways.
    spec = dict(spec, **unflatten(kwargs, _ENCODINGS))

    # Support this API:
    #   {datasets: {foo: df1, bar: df2}, ...}
    if 'datasets' in spec:
        for k, v in spec['datasets'].items():
            dataset = proto.datasets.add()
            dataset.name = str(k)
            data_frame_proto.marshall_data_frame(v, dataset.data)
        del spec['datasets']

    # Support these APIs:
    #   {data: df}
    #   {data: {value: df, ...}}
    #   {data: {url: 'url'}}
    if 'data' in spec:
        data_spec = spec['data']

        if type(data_spec) in dict_types:
            if 'value' in data_spec:
                data = data_spec['value']
                del data_spec['value']
        else:
            data = data_spec
            del spec['data']

    proto.spec = json.dumps(spec)

    if data is not None:
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
