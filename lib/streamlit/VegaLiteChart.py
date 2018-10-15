"""A Python wrapper around Vega Lite.
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

# setup logging
from streamlit.logger import get_logger
LOGGER = get_logger()


class VegaLiteChart:
    def __init__(self, data=None, spec=None, **kwargs):
        """Constructs a Vega Lite chart object.

        Args
        ----
        data : np.Array or pd.DataFrame or None
            Data to be plotted.

        spec : Dict
            The Vega Lite spec for the chart.

        **kwargs : any type
            Syntactic sugar notation to add items to the Vega Lite spec. Keys
            are "unflattened" at the underscore characters. For example,
            foo_bar_baz=123 becomes foo={'bar': {'bar': 123}}.
        """
        if data is None:
            data = pd.DataFrame([])

        elif type(data) is not pd.DataFrame:
            data = pd.DataFrame(data)

        if spec is None:
            spec = dict()

        # Merge spec with unflattened kwargs, where kwargs take precedence.
        # This only works for string keys, but kwarg keys are strings anyways.
        spec = dict(spec, **vega_unflatten(kwargs))

        self._data = data
        self._spec = json.dumps(spec)

    def marshall(self, proto):
        """Loads this chart data into a vega_lite_chart protobuf."""
        proto.spec = self._spec

        data_frame_proto.marshall_data_frame(self._data, proto.data)


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


# TODO: Figure out how to make this work with layers
def vega_unflatten(flat_dict):
    """Converts a flat dict of key-value pairs to a spec tree.

    Example:
        vega_unflatten({
          foo_bar_baz: 123,
          foo_bar_biz: 456,
          x_bonks: 'hi',
        })

        # Returns:
        # {
        #   foo: {
        #     bar: {
        #       baz: 123,
        #       biz: 456,
        #     },
        #   },
        #   encoding: {  # This gets added automatically
        #     x: {
        #       bonks: 'hi'
        #     }
        #   }
        # }

    Args:
    -----
    flat_dict: Dict
        A flat dict where keys are fully-qualified paths separated by
        underscores.

    Returns:
    --------
    A tree made of dicts inside of dicts.
    """
    out_dict = unflatten(flat_dict)

    for k, v in list(out_dict.items()):
        if k in _ENCODINGS:
            if 'encoding' not in out_dict:
                out_dict['encoding'] = dict() 
            out_dict['encoding'][k] = v
            out_dict.pop(k)

    return out_dict
