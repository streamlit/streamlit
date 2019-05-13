# Copyright 2019 Streamlit Inc. All rights reserved.

"""Graphviz unit test."""

import unittest

import graphviz as graphviz

from streamlit.DeltaGenerator import DeltaGenerator


class GraphvizTest(unittest.TestCase):
    """Test ability to marshall graphviz_chart protos."""

    def test_spec(self):
        """Test that it can be called with spec."""
        graph = graphviz.Graph(comment='The Round Table')
        graph.node('A', 'King Arthur')
        graph.node('B', 'Sir Bedevere the Wise')
        graph.edges(['AB'])

        queue = []
        dg = DeltaGenerator(queue.append)
        dg.graphviz_chart(graph)

        c = queue[-1].new_element.graphviz_chart
        self.assertEqual(hasattr(c, 'spec'), True)

    def test_dot(self):
        """Test that it can be called with dot string."""
        graph = graphviz.Graph(comment='The Round Table')
        graph.node('A', 'King Arthur')
        graph.node('B', 'Sir Bedevere the Wise')
        graph.edges(['AB'])

        queue = []
        dg = DeltaGenerator(queue.append)
        dg.graphviz_chart(graph.source)

        c = queue[-1].new_element.graphviz_chart
        self.assertEqual(hasattr(c, 'spec'), True)
