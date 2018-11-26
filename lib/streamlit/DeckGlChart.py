# Copyright 2018 Streamlit Inc. All rights reserved.

"""A Python wrapper around DeckGl."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import json

from streamlit import data_frame_proto
from streamlit.caseconverters import to_lower_camel_case, convert_dict_keys
from streamlit.dicttools import unflatten

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


def marshall(proto, data=None, spec=None, **kwargs):
    """Marshall a proto with DeckGL chart info.

    See DeltaGenerator.deck_gl_chart for docs.
    """
    if data is None:
        data = []

    if spec is None:
        spec = dict()

    # Merge spec with unflattened kwargs, where kwargs take precedence.
    # This only works for string keys, but kwarg keys are strings anyways.
    spec = dict(spec, **unflatten(kwargs, _ENCODINGS))

    if 'layers' not in spec:
        spec['layers'] = []

        # Syntax sugar: if no layers defined and data is passed at the top
        # level, create a scatterplot layer with the top-level data by default.
        if data is not None:
            spec['layers'].append({
                'data': data,
                'type': 'ScatterplotLayer',
            })

    for layer in spec['layers']:
        # Don't add layers that have no data.
        if 'data' not in layer:
            continue

        # Remove DataFrame because it's not JSON-serializable
        data = layer.pop('data')

        layer_proto = proto.layers.add()
        fixed_layer = convert_dict_keys(to_lower_camel_case, layer)
        layer_proto.spec = json.dumps(fixed_layer)
        # TODO: If several layers use the same data frame, the data gets resent
        # for each layer. Need to improve this.
        data_frame_proto.marshall_data_frame(data, layer_proto.data)

    del spec['layers']

    # Dump JSON after removing DataFrames (see loop above), because DataFrames
    # are not JSON-serializable.
    proto.spec = json.dumps(spec)


# See accessors for layers at
# https://github.com/uber/deck.gl/tree/master/docs/layers
_ENCODINGS = set([
    'getAlignmentBaseline',
    'getAngle',
    'getCentroid',
    'getColor',
    'getColorValue',
    'getDashArray',
    'getElevation',
    'getElevationValue',
    'getFillColor',
    'getIcon',
    'getLineColor',
    'getLineDashArray',
    'getNormal',
    'getPath',
    'getPolygon',
    'getPosition',
    'getRadius',
    'getSize',
    'getSourceColor',
    'getSourcePosition',
    'getStrokeWidth',
    'getTargetColor',
    'getTargetPosition',
    'getText',
    'getTextAnchor',
    'getWeight',

    # Streamlit-specific:
    'getLatitude',
    'getLongitude',
    'getTargetLatitude',
    'getTargetLongitude',
])
