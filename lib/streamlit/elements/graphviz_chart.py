# Copyright 2018-2020 Streamlit Inc.
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

"""Streamlit support for GraphViz charts."""

from streamlit import type_util
from streamlit.logger import get_logger
from streamlit.proto.GraphVizChart_pb2 import GraphVizChart as GraphVizChartProto
from streamlit.errors import StreamlitAPIException

LOGGER = get_logger(__name__)


class GraphvizMixin:
    def graphviz_chart(dg, figure_or_dot, width=0, height=0, use_container_width=False):
        """Display a graph using the dagre-d3 library.

        Parameters
        ----------
        figure_or_dot : graphviz.dot.Graph, graphviz.dot.Digraph, str
            The Graphlib graph object or dot string to display

        width : number
            Deprecated. If != 0 (default), will show an alert.
            From now on you should set the width directly in the Graphviz
            spec. Please refer to the Graphviz documentation for details.

        height : number
            Deprecated. If != 0 (default), will show an alert.
            From now on you should set the height directly in the Graphviz
            spec. Please refer to the Graphviz documentation for details.

        use_container_width : bool
            If True, set the chart width to the column width. This takes
            precedence over the figure's native `width` value.

        Example
        -------

        >>> import streamlit as st
        >>> import graphviz as graphviz
        >>>
        >>> # Create a graphlib graph object
        >>> graph = graphviz.Digraph()
        >>> graph.edge('run', 'intr')
        >>> graph.edge('intr', 'runbl')
        >>> graph.edge('runbl', 'run')
        >>> graph.edge('run', 'kernel')
        >>> graph.edge('kernel', 'zombie')
        >>> graph.edge('kernel', 'sleep')
        >>> graph.edge('kernel', 'runmem')
        >>> graph.edge('sleep', 'swap')
        >>> graph.edge('swap', 'runswap')
        >>> graph.edge('runswap', 'new')
        >>> graph.edge('runswap', 'runmem')
        >>> graph.edge('new', 'runmem')
        >>> graph.edge('sleep', 'runmem')
        >>>
        >>> st.graphviz_chart(graph)

        Or you can render the chart from the graph using GraphViz's Dot
        language:

        >>> st.graphviz_chart('''
            digraph {
                run -> intr
                intr -> runbl
                runbl -> run
                run -> kernel
                kernel -> zombie
                kernel -> sleep
                kernel -> runmem
                sleep -> swap
                swap -> runswap
                runswap -> new
                runswap -> runmem
                new -> runmem
                sleep -> runmem
            }
        ''')

        .. output::
           https://share.streamlit.io/0.56.0-xTAd/index.html?id=GBn3GXZie5K1kXuBKe4yQL
           height: 400px

        """
        if width != 0 and height != 0:
            import streamlit as st

            st.warning(
                "The `width` and `height` arguments in `st.graphviz` are deprecated and will be removed on 2020-03-04"
            )
        elif width != 0:
            import streamlit as st

            st.warning(
                "The `width` argument in `st.graphviz` is deprecated and will be removed on 2020-03-04"
            )
        elif height != 0:
            import streamlit as st

            st.warning(
                "The `height` argument in `st.graphviz` is deprecated and will be removed on 2020-03-04"
            )

        graphviz_chart_proto = GraphVizChartProto()
        marshall(graphviz_chart_proto, figure_or_dot, use_container_width)
        return dg._enqueue("graphviz_chart", graphviz_chart_proto)  # type: ignore


def marshall(proto, figure_or_dot, use_container_width):
    """Construct a GraphViz chart object.

    See DeltaGenerator.graphviz_chart for docs.
    """

    if type_util.is_graphviz_chart(figure_or_dot):
        dot = figure_or_dot.source
    elif isinstance(figure_or_dot, str):
        dot = figure_or_dot
    else:
        raise StreamlitAPIException(
            "Unhandled type for graphviz chart: %s" % type(figure_or_dot)
        )

    proto.spec = dot
    proto.use_container_width = use_container_width
