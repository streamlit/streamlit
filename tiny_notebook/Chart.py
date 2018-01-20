"""
A python wrapper around charts.

See: recharts.org

All CamelCase names are convert to snake_case, for example:

AreaChart -> area_chart
CartesianGrid -> cartesian_grid

For example this React code:

<LineChart width={600} height={300} data={data}
    margin={{top: 5, right: 30, left: 20, bottom: 5}}>
        <XAxis dataKey="name"/>
        <YAxis/>
        <CartesianGrid strokeDasharray="3 3"/>
        <Tooltip/>
        <Legend />
        <Line type="monotone" dataKey="pv" stroke="#8884d8" strokeDasharray="5 5"/>
        <Line type="monotone" dataKey="uv" stroke="#82ca9d" strokeDasharray="3 4 5 2"/>
</LineChart>

Would become:

line_chart = Chart(data, 'line_chart', width=600, height=300)
line_chart.x_axis(data_key="name")
line_chart.y_axis()
line_chart.cartesian_grid(stroke_dasharray='3 3')
line_chart.tooltip()
line_chart.legend()
line_chart.line(type='monotone', data_key='pv', stroke='#8884d8',
    strokeDasharray='5 5')
line_chart.line(type='monotone', data_key='uv', stroke='#82ca9d',
    strokeDasharray='3 4 5 2')
"""

import re
import pandas as pd

from tiny_notebook import data_frame_io

class Chart:
    def __init__(self, data, type, width=0, height=0):
        """
        Constructs a chart object.

        type - 'area_chart', 'bar_chart', etc...
        data - a np.Array or pd.DataFrame, series are reference by colum names.
        """
        assert type in CHART_CHARTS, f'Did not recognize "{type}" chart type.'
        self._data = pd.DataFrame(data)
        self._type = type
        self._width = width
        self._height = height
        self._components = []

    def marshall(self, proto_chart):
        """Loads this chart data into that proto_chart."""
        # debug - begin
        print('Marshalling:')
        print(self._data)
        print(self._type)
        print(self._width)
        print(self._height)
        for c in self._components:
            print(' ' + c._type)
            for item in c._props:
                print('  %s : "%s"' % item)
        # debug - end

        proto_chart.type = self._type
        data_frame_io.marshall_data_frame(self._data, proto_chart.data)
        proto_chart.width = self._width
        proto_chart.height = self._height
        for component in self._components:
            proto_component = proto_chart.components.add()
            component.marshall(proto_component)

        # debug - begin
        print('Succesfully marshalled.')
        print(proto_chart)
        import sys
        sys.exit(-1)
        # debug - end

    @classmethod
    def add_component(cls, type, implemented):
        def add_component(self, **props):
            if implemented:
                self._components.append(ChartComponent(type, props))
            else:
                raise NotImplementedError(type + ' not implemented.')
        setattr(cls, type, add_component)

    @staticmethod
    def to_upper_camel_case(snake_case_str):
        """foo_bar -> FooBar"""
        return ''.join(map(str.title, snake_case_str.split('_')))

    @staticmethod
    def to_lower_camel_case(snake_case_str):
        """foo_bar -> fooBar"""
        upperCamelCase = Chart.to_upper_camel_case(snake_case_str)
        if upperCamelCase:
            upperCamelCase[0].lower() + upperCamelCase[1:]
        else:
            return ''

    @staticmethod
    def to_snake_case(camel_case_str):
        """
        fooBar -> foo_bar
        BazBang -> baz_bang
        """
        s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', camel_case_str)
        return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

class ChartComponent:
    def __init__(self, type, props):
        self._type = type
        self._props = [(str(k), str(v)) for (k,v) in props.items()]

    def marshall(self, proto_component):
        proto_component.type = self._type
        for (key, value) in self._props:
            proto_prop = proto_component.props.add()
            proto_prop.key = key
            proto_prop.value = value

CHART_CHARTS = map(Chart.to_snake_case, [
    'AreaChart',
    'BarChart',
    'LineChart',
    'ComposedChart',
    'PieChart',
    'RadarChart',
    'RadialBarChart',
    'ScatterChart',
    'Treemap',
])

# see http://recharts.org/#/en-US/api
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

# Update the Chart class to accept these components, where implemented.
for type, implemented in CHART_COMPONENTS.items():
    Chart.add_component(Chart.to_snake_case(type), implemented)
