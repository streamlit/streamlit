# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""A Python wrapper around Bokeh."""

import json
from typing import cast

import streamlit
from streamlit.proto.BokehChart_pb2 import BokehChart as BokehChartProto


class BokehMixin:
    def bokeh_chart(self, figure, use_container_width=False):
        """Display an interactive Bokeh chart.

        Bokeh is a charting library for Python. The arguments to this function
        closely follow the ones for Bokeh's `show` function. You can find
        more about Bokeh at https://bokeh.pydata.org.

        Parameters
        ----------
        figure : bokeh.plotting.figure.Figure
            A Bokeh figure to plot.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over Bokeh's native `width` value.

        To show Bokeh charts in Streamlit, call `st.bokeh_chart`
        wherever you would call Bokeh's `show`.

        Example
        -------
        >>> import streamlit as st
        >>> from bokeh.plotting import figure
        >>>
        >>> x = [1, 2, 3, 4, 5]
        >>> y = [6, 7, 2, 4, 5]
        >>>
        >>> p = figure(
        ...     title='simple line example',
        ...     x_axis_label='x',
        ...     y_axis_label='y')
        ...
        >>> p.line(x, y, legend='Trend', line_width=2)
        >>>
        >>> st.bokeh_chart(p, use_container_width=True)

        .. output::
           https://static.streamlit.io/0.56.0-xTAd/index.html?id=Fdhg51uMbGMLRRxXV6ubzp
           height: 600px

        """
        bokeh_chart_proto = BokehChartProto()
        marshall(bokeh_chart_proto, figure, use_container_width)
        return self.dg._enqueue("bokeh_chart", bokeh_chart_proto)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)


def marshall(proto, figure, use_container_width):
    """Construct a Bokeh chart object.

    See DeltaGenerator.bokeh_chart for docs.
    """
    from bokeh.embed import json_item

    data = json_item(figure)
    proto.figure = json.dumps(data)
    proto.use_container_width = use_container_width
