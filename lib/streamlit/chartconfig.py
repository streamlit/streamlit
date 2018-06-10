# -*- coding: future_fstrings -*-

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from .caseconverters import to_snake_case
from .ChartComponent import ChartComponent

# Set of ReChart chart types accepted by Streamlit.
CHART_TYPES = set([
    'AreaChart',
    'BarChart',
    'LineChart',
    'ComposedChart',
    # 'PieChart',
    'RadarChart',
    # 'RadialBarChart',
    # 'ScatterChart',
    'Treemap',
])

# Set of snake-case strings containing the ReChart chart types accepted by
# Streamlit.
CHART_TYPES_SNAKE = set(map(to_snake_case, CHART_TYPES))

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

class ForEachColumn(object):
    """
    This is used to include a certain component as many times as there are
    columns in the dataset.
    """
    def __init__(self, comp):
        self.comp = comp

class ColumnAtIndex(object):
    """
    This is used to specify that a certain property should point to whichever
    column is at this index.
    """
    def __init__(self, index):
        self.index = index

class ColumnAtCurrentIndex(object):
    """
    This is used within a ForEachColumn to specify that a certain property
    should point to the column that the ForEachColumn is cycling through right
    now.
    """
    pass

class IndexColumn(object):
    """
    This is used to specify that a certain property should point to the index of
    the dataframe.
    """
    pass

class ValueCycler(object):
    """
    This is used within a ForEachColumn to specify values that should be cycled
    through, as we iterate through the columns.
    """
    def __init__(self, *items):
        self._items = items

    def get(self, index):
        return self._items[index % len(self._items)]

class ColorCycler(ValueCycler):
    """
    Cycles some pretty colors.
    """
    def __init__(self):
        super(ColorCycler, self).__init__(
            '#e41a1c',
            '#377eb8',
            '#4daf4a',
            '#984ea3',
            '#ff7f00',
            '#cccc33',
            '#a65628',
            '#f781bf')

DASH_STR = '3 3'


BASIC_REQUIRED_COMPONENTS = (
    ('cartesian_grid', {'stroke_dasharray': DASH_STR}),
    ('x_axis', {
        'data_key': IndexColumn(),
    }),
    ('y_axis', {}),
    ('tooltip', {}),
    ('legend', {}),
)


# A dict mapping each chart type to a tuple with all components that are
# required for that chart type. The components themselves are expressed here as
# 2-tuples. Here you can use special types ColumnAtIndex, ColumnAtCurrentIndex,
# ForEachColumn, ValueCycler, etc.
REQUIRED_COMPONENTS = {
    'line_chart': (
        BASIC_REQUIRED_COMPONENTS + 
        (ForEachColumn(('line', {
            'data_key': ColumnAtCurrentIndex(),
            'dot': 'false',
            'stroke': ColorCycler(),
            'type': 'linear',
            'is_animation_active': 'false',
        })),)
    ),

    'area_chart': (
        BASIC_REQUIRED_COMPONENTS +
        (ForEachColumn(('area', {
            'data_key': ColumnAtCurrentIndex(),
            'fill': ColorCycler(),
            'stroke': ColorCycler(),
            'type': 'linear',
            'is_animation_active': 'false',
        })),)
    ),

    'bar_chart': (
        BASIC_REQUIRED_COMPONENTS +
        (ForEachColumn(('bar', {
            'data_key': ColumnAtCurrentIndex(),
            'fill': ColorCycler(),
            'is_animation_active': 'false',
        })),)
    ),

    'composed_chart': (
        BASIC_REQUIRED_COMPONENTS,
    ),
}
