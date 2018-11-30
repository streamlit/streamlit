# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

"""A Python wrapper around ReChart charts.

See: recharts.org

Usage
-----
All CamelCase names from ReCharts are converted to snake_case, for example::

    AreaChart -> area_chart
    CartesianGrid -> cartesian_grid

For example this React code:

    <LineChart width={600} height={300} data={data}
        margin={{top: 5, right: 30, left: 20, bottom: 5}}>
            <XAxis dataKey='name'/>
            <YAxis/>
            <CartesianGrid strokeDasharray='3 3'/>
            <Tooltip/>
            <Legend/>
            <Line type='monotone' dataKey='pv' stroke='#8884d8' strokeDasharray='5 5'/>
            <Line type='monotone' dataKey='uv' stroke='#82ca9d' strokeDasharray='3 4 5 2'/>
    </LineChart>

Becomes::

    line_chart = Chart(data, 'line_chart', width=600, height=300)
    line_chart.x_axis(data_key='name')
    line_chart.y_axis()
    line_chart.cartesian_grid(stroke_dasharray='3 3')
    line_chart.tooltip()
    line_chart.legend()
    line_chart.line(type='monotone', data_key='pv', stroke='#8884d8',
        stroke_dasharray='5 5')
    line_chart.line(type='monotone', data_key='uv', stroke='#82ca9d',
        stroke_dasharray='3 4 5 2')

Or, with syntax sugar type-specific builders::

    LineChart(data, width=600, height=300).x_axis(data_key='name')
    # These sugary builders already have all sorts of defaults set
    # so usually there's no need to call any additional methods on them :)

    LineChart(data, width=600, height=300)
    # You don't even need to specify data keys. These are selected automatically
    # for you from the data.
"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from streamlit import data_frame_proto
from streamlit.ChartComponent import ChartComponent
from streamlit.DictBuilder import ForEachColumn, ValueCycler, CURRENT_COLUMN_NAME, INDEX_COLUMN_NAME, INDEX_COLUMN_DESIGNATOR
from streamlit.caseconverters import to_upper_camel_case, to_lower_camel_case, to_snake_case
from streamlit.chartconfig import CHART_TYPES, CHART_COMPONENTS, CHART_TYPES_SNAKE, REQUIRED_COMPONENTS
from streamlit.logger import get_logger

current_module = __import__(__name__)

LOGGER = get_logger(__name__)


class Chart(object):
    """Chart object."""

    def __init__(self, data, type, width=0, height=0, **kwargs):
        """Construct a chart object.

        Parameters
        ----------
        type : str
            A string with the snake-case chart type. Example: 'area_chart',
            'bar_chart', etc...

        data : np.Array or pd.DataFrame
            Data to be plotted. Series are referenced by column name.

        width : int
            The chart's width. Defaults to 0, which means "the default width"
            rather than actually 0px.

        height : int
            The chart's height. Defaults to 0, which means "the default height"
            rather than actually 0px.

        kwargs : anything
            Keyword arguments containg properties to be added to the ReChart's
            top-level element.

        """
        import pandas as pd
        assert type in CHART_TYPES_SNAKE, f'Did not recognize "{type}" type.'
        self._data = pd.DataFrame(data)
        self._type = type
        self._width = width
        self._height = height
        self._components = list()
        self._props = [(str(k), str(v)) for (k, v) in kwargs.items()]

    def append_component(self, component_name, props):
        """Set a chart component.

        Parameters
        ----------
        component_name : str
            A snake-case string with the ReCharts component name.
        props : anything
            The ReCharts component value.

        """
        self._components.append(ChartComponent(component_name, props))

    def marshall(self, proto_chart):
        """Load this chart data into that proto_chart."""
        proto_chart.type = to_upper_camel_case(self._type)
        data_frame_proto.marshall_data_frame(self._data, proto_chart.data)
        proto_chart.width = self._width
        proto_chart.height = self._height

        self._append_missing_data_components()

        for component in self._components:
            proto_component = proto_chart.components.add()
            component.marshall(proto_component)

        for (key, value) in self._props:
            proto_prop = proto_chart.props.add()
            proto_prop.key = to_lower_camel_case(key)
            proto_prop.value = value

    def _append_missing_data_components(self):
        """Append all required data components that have not been specified.

        This uses the REQUIRED_COMPONENTS dict, which points each chart type to
        a tuple of all components that are required for that chart. Required
        components themselves are either normal tuples or a repeated tuple
        (specified via ForEachColumn), and their children can use special
        identifiers such as ColumnAtCurrentIndex, and ValueCycler.
        """
        required_components = REQUIRED_COMPONENTS.get(self._type, None)

        if required_components is None:
            return

        existing_component_names = set(c.type for c in self._components)

        for required_component in required_components:

            if isinstance(required_component, ForEachColumn):
                numRepeats = len(self._data.columns)
                comp_name, comp_value = required_component.content_to_repeat
            else:
                numRepeats = 1
                comp_name, comp_value = required_component

            if comp_name in existing_component_names:
                continue

            for i in range(numRepeats):
                if isinstance(comp_value, dict_types):  # noqa: F821
                    props = dict(
                        (k, self._materializeValue(v, i))
                        for (k, v) in comp_value.items()
                    )
                else:
                    props = self._materializeValue(comp_value, i)
                self.append_component(comp_name, props)

    def _materializeValue(self, value, currCycle):
        """Replace ColumnAtCurrentIndex, etc with a column name if needed.

        Parameters
        ----------
        value : anything
            If value is a ColumnAtCurrentIndex then it gets replaces with a
            column name. If ValueCycler, it returns the current item in the
            cycler's list. If it's anything else, it just passes through.

        currCycle : int
            For repeated fields (denoted via ForEachColumn) this is the number
            of the current column.

        """
        if value == CURRENT_COLUMN_NAME:
            i = currCycle
            if i >= len(self._data.columns):
                raise IndexError('Index {} out of bounds'.format(i))
            return self._data.columns[i]

        elif value == INDEX_COLUMN_NAME:
            return INDEX_COLUMN_DESIGNATOR

        elif isinstance(value, ValueCycler):
            return value.get(currCycle)

        else:
            return value


def register_component(component_name, implemented):
    """Add a method to the Chart class to set the given component.

    Parameters
    ----------
    component_name : str
        A snake-case string containing the name of a chart component accepted by
        ReCharts.

    implemented : boolean
        True/false depending on whether Streamlit supports the given
        component_name or not.

    Examples
    --------
    register_component('foo_bar', False)
    c = Chart(myData, 'line_chart')
    c.foo_bar(stuff='other stuff', etc='you get the gist')

    In addition, the methods created by this function return the Chart
    instance for builder-style chaining:

    register_component('baz', False)
    c = Chart(myData, 'line_chart').foo_bar(stuff='yes!').baz()

    """
    def append_component_method(self, **props):
        if implemented:
            self.append_component(component_name, props)
        else:
            raise NotImplementedError(component_name + ' not implemented.')
        return self  # For builder-style chaining.

    setattr(Chart, component_name, append_component_method)


# Add methods to Chart class, for each component in CHART_COMPONENTS.
for component_name, implemented in CHART_COMPONENTS.items():
    register_component(to_snake_case(component_name), implemented)


def register_type_builder(chart_type):
    """Add a builder function to this module to build a specific chart type.

    These sugary builders also set up some nice defaults from the
    DEFAULT_COMPONENTS dict, that can be overriden after the instance is built.

    Parameters
    ----------
    chart_type : str
        A string with the upper-camel-case name of the chart type to add.

    """
    chart_type_snake = to_snake_case(chart_type)

    def type_builder(data, **kwargs):
        kwargs.pop('type', None)  # Ignore 'type' key from kwargs, if exists.
        return Chart(data, type=chart_type_snake, **kwargs)

    setattr(current_module, chart_type, type_builder)


# Add syntax-sugar builder functions to this module, to allow us to do things
# like FooChart(data) instead of Chart(data, 'foo_chart').
for chart_type in CHART_TYPES:
    register_type_builder(chart_type)
