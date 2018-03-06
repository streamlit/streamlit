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

def to_component_list(comp_tuples):
    return [ChartComponent(k, v) for (k, v) in comp_tuples]

# A dict mapping each chart type to a dict of all components that should be set
# by default for that chart. These defaults only apply to the type-specific
# builder functions (e.g. LineChart rather than Chart(foo, 'line_chart').
DEFAULT_COMPONENTS = {
    'line_chart': to_component_list((
        ('x_axis', {}),
        ('y_axis', {}),
        ('cartesian_grid', {'stroke_dasharray': '3 3'}),
        ('tooltip', {}),
        ('legend', {}),
    )),
}

class ColumnAtIndex:
    """
    This is used to specify that a certain property should point to whichever
    column is at this index.
    """
    def __init__(self, index):
        self.index = index

class ForEachColumn:
    """
    This is used to include a certain property as many times as there are
    columns in the dataset.
    """
    def __init__(self, prop):
        self.prop = prop

class ColumnAtCurrentIndex:
    """
    This is used within a ForEachColumn to specify that a certain property
    should point to the column that the ForEachColumn is cycling through right
    now.
    """
    pass

class ValueCycler:
    """
    This is used within a ForEachColumn to specify values that should be cycled
    through, as we iterate through the columns.
    """
    def __init__(self, *items):
        self._items = items

    def get(self, index):
        return self._items[index % len(self._items)]

# A dict mapping each chart type to a tuple with all components that are
# required for that chart type. The components themselves are expressed here as
# 2-tuples. Here you can use special types ColumnAtIndex, ColumnAtCurrentIndex,
# ForEachColumn, and ValueCycler.
REQUIRED_COMPONENTS = {
    'line_chart': (
        ForEachColumn(('line', {
            'type': 'monotone',
            'data_key': ColumnAtCurrentIndex(),
            'stroke': ValueCycler('#8884d8', '#82ca9d'),
            'dot': 'false',
        })),
    ),
}
