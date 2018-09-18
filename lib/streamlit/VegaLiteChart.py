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
from streamlit.DictBuilder import DictBuilder, ParamBuilder, ForEachColumn, ColorCycler, ColumnFinder, CURRENT_COLUMN_TYPE, CURRENT_COLUMN_NAME, INDEX_COLUMN_NAME
from streamlit.dicttools import unflatten

# setup logging
from streamlit.logger import get_logger
LOGGER = get_logger()


STACKED_COLUMN_NAME = '(layer)'


class VegaLiteChart:
    def __init__(self, data=None, spec=None, data_transform_str=None, **kwargs):
        """Constructs a Vega Lite chart object.

        Args
        ----
        data : np.Array or pd.DataFrame or None
            Data to be plotted.

        spec : Dict
            The Vega Lite spec for the chart.

        data_transform_str : string
            The data transform that was applied to the data (e.g. "stack"),
            or None if no transformation.

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
        self._data_transform_str = data_transform_str

    def marshall(self, proto):
        """Loads this chart data into a vega_lite_chart protobuf."""
        proto.spec = self._spec

        if self._data_transform_str == 'stack':
            proto.data_transform = protobuf.DataTransform.STACK
        else:
            proto.data_transform = protobuf.DataTransform.NONE

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

    
def transform_dataframe(df, transform_name):
    if transform_name == protobuf.DataTransform.STACK:
        df = df.stack()
        df = df.reset_index(level=1)
        df.columns = [STACKED_COLUMN_NAME, 'values']
        df = df[['values', STACKED_COLUMN_NAME]]
    return df


_SELECTION_DECLARATION = DictBuilder({
    'grid': DictBuilder({
        'type': 'interval',
        'bind': 'scales',
    }, shallow=True),
}, shallow=True)


_CHART_DECLARATIONS = {
    # Usage:
    #  vega_lite.line_chart(df)
    #  vega_lite.line_chart(df, x_axis_title='Time (s)', etc...)
    'line_chart': {
        'data_transform': protobuf.DataTransform.STACK,
        'user_params': [],
        'spec_builder': DictBuilder({
            'selection': _SELECTION_DECLARATION,
            'mark': DictBuilder({
                'type': 'line',
            }),
            'encoding': DictBuilder({
                'x': DictBuilder({
                    'field': INDEX_COLUMN_NAME,
                    'type': CURRENT_COLUMN_TYPE,
                    'axis': {'title': ''},
                }),
                'y': DictBuilder({
                    'field': CURRENT_COLUMN_NAME,
                    'type': CURRENT_COLUMN_TYPE,
                    'axis': {'title': ''},
                }, column=0),
                'color': DictBuilder({
                    'field': CURRENT_COLUMN_NAME,
                    'type': 'nominal',
                    'legend': {'title': ''},
                }, column=1, shallow=True),
            }),
        }),
    },

    # Usage:
    #  vega_lite.area_chart(df)
    #  vega_lite.area_chart(df, x_axis_title='Time (s)', etc...)
    'area_chart': {
        'data_transform': protobuf.DataTransform.STACK,
        'user_params': [],
        'spec_builder': DictBuilder({
            'selection': _SELECTION_DECLARATION,
            'mark': DictBuilder({
                'type': 'area',
            }),
            'encoding': DictBuilder({
                'x': DictBuilder({
                    'field': INDEX_COLUMN_NAME,
                    'type': CURRENT_COLUMN_TYPE,
                    'axis': {'title': ''},
                }),
                'y': DictBuilder({
                    'field': CURRENT_COLUMN_NAME,
                    'type': CURRENT_COLUMN_TYPE,
                    'axis': {'title': ''},
                }, column=0),
                'color': DictBuilder({
                    'field': CURRENT_COLUMN_NAME,
                    'type': 'nominal',
                    'legend': {'title': ''},
                }, column=1, shallow=True),
                'opacity': DictBuilder({
                    'value': 0.75,
                }, shallow=True),
            }),
        }),
    },

    # Usage:
    #  vega_lite.scatter_chart(df)
    #  vega_lite.scatter_chart(df, x_axis_title='Time (s)', etc...)
    'scatter_chart': {
        'data_transform': None,
        'user_params': [],
        'spec_builder': DictBuilder({
            'selection': _SELECTION_DECLARATION,
            'mark': DictBuilder({
                'type': 'circle',
            }),
            'encoding': DictBuilder({
                'x': DictBuilder({
                    'field': INDEX_COLUMN_NAME,
                    'type': CURRENT_COLUMN_TYPE,
                    'axis': {'title': ''},
                    'scale': DictBuilder({
                        'zero': False,
                    }, shallow=True),
                }),
                'y': DictBuilder({
                    'field': CURRENT_COLUMN_NAME,
                    'type': CURRENT_COLUMN_TYPE,
                    'axis': {'title': ''},
                    'scale': DictBuilder({
                        'zero': False,
                    }, shallow=True),
                }, column=0),
                'size': DictBuilder({
                    'field': CURRENT_COLUMN_NAME,
                    'type': CURRENT_COLUMN_TYPE,
                    'legend': {'title': ''},
                }, column=1, shallow=True),
                'color': DictBuilder({
                    'field': CURRENT_COLUMN_NAME,
                    'type': CURRENT_COLUMN_TYPE,
                    'legend': {'title': ''},
                }, column=2, shallow=True),
                'opacity': DictBuilder({
                    'value': 0.75,
                }, shallow=True),
            }),
        }),
    },

    # Usage:
    #  vega_lite.binned_scatter_chart(df)
    #  vega_lite.binned_scatter_chart(df, x_bin_maxbins=20, etc...)
    'binned_scatter_chart': {
        'data_transform': None,
        'user_params': [],
        'spec_builder': DictBuilder({
            'selection': _SELECTION_DECLARATION,
            'mark': DictBuilder({
                'type': 'circle',
            }),
            'encoding': DictBuilder({
                'x': DictBuilder({
                    'field': INDEX_COLUMN_NAME,
                    'type': CURRENT_COLUMN_TYPE,
                    'bin': DictBuilder({
                        'maxbins': 10,
                    }),
                }, column=0),
                'y': DictBuilder({
                    'field': CURRENT_COLUMN_NAME,
                    'type': CURRENT_COLUMN_TYPE,
                    'bin': DictBuilder({
                        'maxbins': 10,
                    }),
                }, column=0),
                'size': DictBuilder({
                    'aggregate': 'count',
                    'type': 'quantitative',
                }),
            }),
        }),
    },

    # Usage:
    #  vega_lite.bar_chart(df)
    #  vega_lite.bar_chart(df, x_axis_title='Quarters' etc...)
    'bar_chart': {
        'data_transform': protobuf.DataTransform.STACK,
        'user_params': [],
        'spec_builder': DictBuilder({
            'selection': _SELECTION_DECLARATION,
            'mark': DictBuilder({
                'type': 'bar',
            }),
            'encoding': DictBuilder({
                'x': {
                    'field': INDEX_COLUMN_NAME,
                    'type': 'nominal',
                    'axis': {'title': ''},
                },
                'y': DictBuilder({
                    'field': CURRENT_COLUMN_NAME,
                    'type': 'quantitative',
                    'stack': None,
                    'axis': {'title': ''},
                }, column=0),
                'color': DictBuilder({
                    'field': CURRENT_COLUMN_NAME,
                    'type': 'nominal',
                    'legend': {'title': ''},
                }, column=1),
                'opacity': DictBuilder({
                    'value': 0.75,
                }, shallow=True),
            }),
        }),
    },

    # Usage:
    #  vega_lite.geo_scatter_chart(df)
    #  vega_lite.geo_scatter_chart(df,
    #      map='http://foo.com/map.json',
    #      feature='my_feature',
    #  )
    'geo_scatter_chart': {
        'data_transform': None,
        'user_params': set(['map', 'feature']),
        'spec_builder': DictBuilder({
            'height': 500,
            'layer': [
                DictBuilder({
                    'data': DictBuilder({
                        # TODO: Change default.
                        'url': ParamBuilder('map', 'https://unpkg.com/world-atlas@1/world/50m.json'),
                        'format': DictBuilder({
                            'type': 'topojson',
                            'feature': ParamBuilder('feature', 'countries'),
                        }),
                    }),
                    'mark': DictBuilder({
                        'type': 'geoshape',
                        'stroke': 'white',
                        'strokeWidth': 1
                    }),
                    'encoding': DictBuilder({
                        'color': DictBuilder({
                            'value': '#E6E9EF',
                        }),
                    }),
                }),
                ForEachColumn(DictBuilder({
                    #'selection': _SELECTION_DECLARATION,
                    'mark': DictBuilder({
                        'type': 'circle',
                    }),
                    'encoding': DictBuilder({
                        'latitude': DictBuilder({
                            'field': ColumnFinder('lat', 'latitude'),
                            'type': CURRENT_COLUMN_TYPE,
                            'axis': {'title': ''},
                        }),
                        'longitude': DictBuilder({
                            'field': ColumnFinder('lon', 'longitude'),
                            'type': CURRENT_COLUMN_TYPE,
                        }),
                        'size': DictBuilder({
                            'value': 1,
                        }),
                        'opacity': DictBuilder({
                            'value': 0.1,
                        }),
                        'color': DictBuilder({
                            'value': ColorCycler(),
                        }, shallow=True),
                    }),
                })),
            ],
        }),
    },
}


CHART_TYPES = set(_CHART_DECLARATIONS)


def _get_builder(chart_type, chart_declaration):
    """Adds pretty builders line line_chart() to this module.

    Args
    ----
    chart_type : The name of the builder (e.g. "line_chart").

    chart_declaration : A "chart declaration" dict. Contains keys:
    'data_transform' (a DataTransform proto enum value or None), and
    'spec_builder' (a DictBuilder with the Vega Lite spec), 'user_params' (a
    set with names of custom parameters accepted by this builder -- see
    ParamBuilder).
    """
    def chart_constructor(data=None, **kwargs):
        if data is None:
            data = pd.DataFrame([])

        elif type(data) is not pd.DataFrame:
            data = pd.DataFrame(data)

        data_transform_str = chart_declaration['data_transform']

        data = transform_dataframe(
            data, data_transform_str)

        user_params = {
            k: v for (k, v) in kwargs.items()
            if k in chart_declaration['user_params']}

        non_param_args = {
            k: v for (k, v) in kwargs.items()
            if k not in chart_declaration['user_params']}

        user_spec = vega_unflatten(non_param_args)

        merged_spec = chart_declaration['spec_builder'].build(
            data, spec_override=user_spec, user_params=user_params)

        LOGGER.debug(merged_spec)

        return VegaLiteChart(data, merged_spec, data_transform_str)

    return chart_constructor


VEGA_LITE_BUILDERS = [
    (k, _get_builder(k, v))
    for k, v in _CHART_DECLARATIONS.items()
]
