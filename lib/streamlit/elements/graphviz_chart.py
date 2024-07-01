# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Streamlit support for GraphViz charts."""

from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING, Union, cast

from typing_extensions import TypeAlias

from streamlit import type_util
from streamlit.errors import StreamlitAPIException
from streamlit.proto.GraphVizChart_pb2 import GraphVizChart as GraphVizChartProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.util import HASHLIB_KWARGS

if TYPE_CHECKING:
    import graphviz

    from streamlit.delta_generator import DeltaGenerator

FigureOrDot: TypeAlias = Union[
    "graphviz.Graph", "graphviz.Digraph", "graphviz.Source", str
]


class GraphvizMixin:
    @gather_metrics("graphviz_chart")
    def graphviz_chart(
        self,
        figure_or_dot: FigureOrDot,
        use_container_width: bool = False,
    ) -> DeltaGenerator:
        """Display a graph using the dagre-d3 library.

        Parameters
        ----------
        figure_or_dot : graphviz.dot.Graph, graphviz.dot.Digraph, graphviz.sources.Source, str
            The Graphlib graph object or dot string to display

        use_container_width : bool
            Whether to override the figure's native width with the width of
            the parent container. If ``use_container_width`` is ``False``
            (default), Streamlit sets the width of the chart to fit its contents
            according to the plotting library, up to the width of the parent
            container. If ``use_container_width`` is ``True``, Streamlit sets
            the width of the figure to match the width of the parent container.

        Example
        -------
        >>> import streamlit as st
        >>> import graphviz
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
           https://doc-graphviz-chart.streamlit.app/
           height: 600px

        """
        # Generate element ID from delta path
        delta_path = self.dg._get_delta_path_str()
        element_id = hashlib.md5(delta_path.encode(), **HASHLIB_KWARGS).hexdigest()

        graphviz_chart_proto = GraphVizChartProto()

        marshall(graphviz_chart_proto, figure_or_dot, use_container_width, element_id)
        return self.dg._enqueue("graphviz_chart", graphviz_chart_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def marshall(
    proto: GraphVizChartProto,
    figure_or_dot: FigureOrDot,
    use_container_width: bool,
    element_id: str,
) -> None:
    """Construct a GraphViz chart object.

    See DeltaGenerator.graphviz_chart for docs.
    """

    if type_util.is_graphviz_chart(figure_or_dot):
        dot = figure_or_dot.source
        engine = figure_or_dot.engine
    elif isinstance(figure_or_dot, str):
        dot = figure_or_dot
        engine = "dot"
    else:
        raise StreamlitAPIException(
            "Unhandled type for graphviz chart: %s" % type(figure_or_dot)
        )

    proto.spec = dot
    proto.engine = engine
    proto.use_container_width = use_container_width
    proto.element_id = element_id
