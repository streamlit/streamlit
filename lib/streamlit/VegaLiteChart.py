"""A Python wrapper around Vega Lite.
"""

import json
import pandas as pd
import sys

from streamlit import data_frame_proto, protobuf
from streamlit.DictBuilder import DictBuilder, ParamBuilder, ForEachColumn, ColorCycler


# XXX TODO use unflatten to accept non-dict specs.

class VegaLiteChart:
    def __init__(self, data=None, spec=None, data_transform_str=None):
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
        """
        if data is None:
            data = pd.DataFrame([])

        elif type(data) is not pd.DataFrame:
            data = pd.DataFrame(data)

        if spec is None:
            spec = {}

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
def unflatten(flat_dict):
    """Converts a flat dict of key-value pairs to a spec tree.

    Example:
        unflatten({
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
    out = {}
    for pathstr, v in flat_dict.items():
        path = pathstr.split('_')

        if path[0] in _ENCODINGS:
            path.insert(0, 'encoding')

        prev_dict = None
        curr_dict = out

        for k in path:
            if k not in curr_dict:
                curr_dict[k] = {}
            prev_dict = curr_dict
            curr_dict = curr_dict[k]

        prev_dict[k] = v

    return out


def transform_dataframe(df, transform_name):
    if transform_name == protobuf.DataTransform.STACK:
        df = df.stack()
        df = df.reset_index(level=1)
        df.columns = ['__stacked_column__', 'values']
        df = df[['values', '__stacked_column__']]
    return df


_SELECTION_DECLARATION = DictBuilder({
    'grid': DictBuilder({
        'type': 'interval',
        'bind': 'scales',
    }, shallow=True),
}, shallow=True)


_CHART_DECLARATIONS = {
    'line_chart': {
        'data_transform': protobuf.DataTransform.STACK,
        'params': [],
        'spec_builder': DictBuilder({
            'selection': _SELECTION_DECLARATION,
            'mark': DictBuilder({
                'type': 'line',
            }),
            'encoding': DictBuilder({
                'x': DictBuilder({
                    'field': '__index__',
                    'type': '__column_type__',
                    'axis': {'title': ''},
                }),
                'y': DictBuilder({
                    'field': '__current_column_name__',
                    'type': '__column_type__',
                    'axis': {'title': ''},
                }, column=0),
                'color': DictBuilder({
                    'field': '__current_column_name__',
                    'type': 'nominal',
                    'legend': {'title': ''},
                }, column=1, shallow=True),
            }),
        }),
    },

    'area_chart': {
        'data_transform': protobuf.DataTransform.STACK,
        'params': [],
        'spec_builder': DictBuilder({
            'selection': _SELECTION_DECLARATION,
            'mark': DictBuilder({
                'type': 'area',
            }),
            'encoding': DictBuilder({
                'x': DictBuilder({
                    'field': '__index__',
                    'type': '__column_type__',
                    'axis': {'title': ''},
                }),
                'y': DictBuilder({
                    'field': '__current_column_name__',
                    'type': '__column_type__',
                    'axis': {'title': ''},
                }, column=0),
                'color': DictBuilder({
                    'field': '__current_column_name__',
                    'type': 'nominal',
                    'legend': {'title': ''},
                }, column=1, shallow=True),
                'opacity': DictBuilder({
                    'value': 0.75,
                }, shallow=True),
            }),
        }),
    },

    'scatter_chart': {
        'data_transform': None,
        'params': [],
        'spec_builder': DictBuilder({
            'selection': _SELECTION_DECLARATION,
            'mark': DictBuilder({
                'type': 'circle',
            }),
            'encoding': DictBuilder({
                'x': DictBuilder({
                    'field': '__index__',
                    'type': '__column_type__',
                    'axis': {'title': ''},
                    'scale': DictBuilder({
                        'zero': False,
                    }, shallow=True),
                }),
                'y': DictBuilder({
                    'field': '__current_column_name__',
                    'type': '__column_type__',
                    'axis': {'title': ''},
                    'scale': DictBuilder({
                        'zero': False,
                    }, shallow=True),
                }, column=0),
                'size': DictBuilder({
                    'field': '__current_column_name__',
                    'type': '__column_type__',
                    'legend': {'title': ''},
                }, column=1, shallow=True),
                'color': DictBuilder({
                    'field': '__current_column_name__',
                    'type': '__column_type__',
                    'legend': {'title': ''},
                }, column=2, shallow=True),
                'opacity': DictBuilder({
                    'value': 0.75,
                }, shallow=True),
            }),
        }),
    },

    'binned_scatter_chart': {
        'data_transform': None,
        'params': [],
        'spec_builder': DictBuilder({
            'selection': _SELECTION_DECLARATION,
            'mark': DictBuilder({
                'type': 'circle',
            }),
            'encoding': DictBuilder({
                'x': DictBuilder({
                    'field': '__index__',
                    'type': '__column_type__',
                    'bin': DictBuilder({
                        'maxbins': 10,
                    }),
                }, column=0),
                'y': DictBuilder({
                    'field': '__current_column_name__',
                    'type': '__column_type__',
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

    'bar_chart': {
        'data_transform': protobuf.DataTransform.STACK,
        'params': [],
        'spec_builder': DictBuilder({
            'selection': _SELECTION_DECLARATION,
            'mark': DictBuilder({
                'type': 'bar',
            }),
            'encoding': DictBuilder({
                'x': {
                    'field': '__index__',
                    'type': 'nominal',
                    'axis': {'title': ''},
                },
                'y': DictBuilder({
                    'field': '__current_column_name__',
                    'type': 'quantitative',
                    'stack': None,
                    'axis': {'title': ''},
                }, column=0),
                'color': DictBuilder({
                    'field': '__current_column_name__',
                    'type': 'nominal',
                    'legend': {'title': ''},
                }, column=1),
                'opacity': DictBuilder({
                    'value': 0.75,
                }, shallow=True),
            }),
        }),
    },

    'geo_chart': {
        'data_transform': None,
        'params': set(['map']),
        'spec_builder': DictBuilder({
            'layer': [
                DictBuilder({
                    'data': DictBuilder({
                        'url': ParamBuilder('map', '/geo/nyc.json'),
                        'format': DictBuilder({
                            'type': 'topojson',
                            'feature': 'nyc_boroughs',
                        }),
                    }),
                    'mark': DictBuilder({
                        'type': 'geoshape',
                        'stroke': 'white',
                        'strokeWidth': 2
                    }),
                    'encoding': DictBuilder({
                        'color': DictBuilder({
                            'value': '#888',
                        }),
                    }),
                }),
                ForEachColumn(DictBuilder({
                    #'selection': _SELECTION_DECLARATION,
                    'mark': DictBuilder({
                        'type': 'circle',
                    }),
                    'encoding': DictBuilder({
                        'latitude': {
                            'field': '__index__',
                            'type': '__column_type__',
                            'axis': {'title': ''},
                        },
                        'longitude': DictBuilder({
                            'field': '__current_column_name__',
                            'type': '__column_type__',
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
    'spec_builder' (a DictBuilder with the Vega Lite spec), 'params' (a set with
    names of custom parameters accepted by this builder -- see ParamBuilder).
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
            if k in chart_declaration['params']}

        non_param_args = {
            k: v for (k, v) in kwargs.items()
            if k not in chart_declaration['params']}

        user_spec = unflatten(non_param_args)

        merged_spec = chart_declaration['spec_builder'].build(
            data, spec_override=user_spec, user_params=user_params)

        # Useful for debugging:
        #import json
        #print(json.dumps(
        #    merged_spec,
        #    sort_keys=True,
        #    indent=2,
        #    separators=(',', ': ')))

        return VegaLiteChart(data, merged_spec, data_transform_str)

    return chart_constructor


VEGA_LITE_BUILDERS = [
    (k, _get_builder(k, v))
    for k, v in _CHART_DECLARATIONS.items()
]
