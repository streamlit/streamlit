"""A Python wrapper around DeckGl.
"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import json
import pandas as pd
import sys

from streamlit import data_frame_proto, protobuf
from streamlit.dicttools import unflatten
from streamlit.caseconverters import to_lower_camel_case, convert_dict_keys

# setup logging
from streamlit.logger import get_logger
LOGGER = get_logger()

def marshall(proto, data, layers, spec):
    """Marshall a proto with DeckGL chart info.

    See DeltaGenerator.deck_gl_chart for docs.
    """
    if layers is None:
        layers = []

    # Syntax sugar: if no layers defined and data is passed at the top
    # level, created a scatterplot layer with the top-level data by default.
    if data is not None and not layers:
        layers.append({
            'data': data,
            'type': 'ScatterplotLayer',
        })

    for layer in layers:
        # Don't add layers that have no data.
        if 'data' not in layer: continue

        # Remove DataFrame because it's not JSON-serializable
        data = layer.pop('data')

        layer_proto = proto.deck_gl_chart.layers.add()
        fixed_layer = convert_dict_keys(
            to_lower_camel_case, layer)
        print('XXX', fixed_layer)
        layer_proto.spec = json.dumps(fixed_layer)
        data_frame_proto.marshall_data_frame(data, layer_proto.data)

    # Dump JSON after removing DataFrames (see loop above), because DataFrames
    # are not JSON-serializable.
    proto.deck_gl_chart.spec = json.dumps(spec)
