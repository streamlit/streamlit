# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

"""Declarative configuration for Streamlit's native ReCharts-based charts."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from streamlit import dict_builder
from streamlit import case_converters

# Set of ReChart chart types accepted by Streamlit.
CHART_TYPES = set([
    'AreaChart',
    'BarChart',
    'LineChart',
    # 'ComposedChart',
    # 'PieChart',
    # 'RadarChart',
    # 'RadialBarChart',
    # 'ScatterChart',
    # 'Treemap',
])

# Set of snake-case strings containing the ReChart chart types accepted by
# Streamlit.
CHART_TYPES_SNAKE = set(map(case_converters.to_snake_case, CHART_TYPES))

# Map of string->boolean, mapping ReChart component names to true/false
# depending on whether Streamlit supports that component.
# See http://recharts.org/#/en-US/api
CHART_COMPONENTS = {
    # General Components

    'ResponsiveContainer': False,
    'Legend': True,
    'Tooltip': True,
    'Cell': False,
    'Text': False,
    'Label': False,
    'LabelList': False,

    # Cartesian Components

    'Area': True,
    'Bar': True,
    'Line': True,
    'Scatter': True,
    'XAxis': True,
    'YAxis': True,
    'ZAxis': True,
    'Brush': True,
    'CartesianAxis': True,
    'CartesianGrid': True,
    'ReferenceLine': True,
    'ReferenceDot': True,
    'ReferenceArea': True,
    'ErrorBar': True,

    # Polar Components

    'Pie': True,
    'Radar': True,
    'RadialBar': True,
    'PolarAngleAxis': True,
    'PolarGrid': True,
    'PolarRadiusAxis': True,

    # Shapes

    'Cross': False,
    'Curve': False,
    'Dot': False,
    'Polygon': False,
    'Rectangle': False,
    'Sector': False,
}


BASIC_REQUIRED_COMPONENTS = (
    ('cartesian_grid', {
        'stroke': '#E6E9EF',
    }),
    ('x_axis', {
        'stroke': '#101620',
        'data_key': dict_builder.INDEX_COLUMN_NAME,
    }),
    ('y_axis', {
        'stroke': '#101620',
    }),
    ('tooltip', {}),
    ('legend', {}),
)


# A dict mapping each chart type to a tuple with all components that are
# required for that chart type. The components themselves are expressed here as
# 2-tuples. Here you can use special types CURRENT_COLUMN_NAME,
# ForEachColumn, ValueCycler, etc.
REQUIRED_COMPONENTS = {
    'line_chart': (
        BASIC_REQUIRED_COMPONENTS +
        (dict_builder.ForEachColumn(('line', {
            'data_key': dict_builder.CURRENT_COLUMN_NAME,
            'dot': 'false',
            'stroke': dict_builder.ColorCycler(),
            'type': 'linear',
            'is_animation_active': 'false',
        })),)
    ),

    'area_chart': (
        BASIC_REQUIRED_COMPONENTS +
        (dict_builder.ForEachColumn(('area', {
            'data_key': dict_builder.CURRENT_COLUMN_NAME,
            'fill': dict_builder.ColorCycler(),
            'stroke': dict_builder.ColorCycler(),
            'type': 'linear',
            'is_animation_active': 'false',
        })),)
    ),

    'bar_chart': (
        BASIC_REQUIRED_COMPONENTS +
        (dict_builder.ForEachColumn(('bar', {
            'data_key': dict_builder.CURRENT_COLUMN_NAME,
            'fill': dict_builder.ColorCycler(),
            'is_animation_active': 'false',
        })),)
    ),

    'composed_chart': (
        BASIC_REQUIRED_COMPONENTS,
    ),
}
