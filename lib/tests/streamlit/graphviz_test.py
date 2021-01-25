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

"""Graphviz unit test."""

import graphviz as graphviz

from tests import testutil
import streamlit as st


class GraphvizTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall graphviz_chart protos."""

    def test_spec(self):
        """Test that it can be called with spec."""
        graph = graphviz.Graph(comment="The Round Table")
        graph.node("A", "King Arthur")
        graph.node("B", "Sir Bedevere the Wise")
        graph.edges(["AB"])

        st.graphviz_chart(graph)

        c = self.get_delta_from_queue().new_element.graphviz_chart
        self.assertEqual(hasattr(c, "spec"), True)

    def test_dot(self):
        """Test that it can be called with dot string."""
        graph = graphviz.Graph(comment="The Round Table")
        graph.node("A", "King Arthur")
        graph.node("B", "Sir Bedevere the Wise")
        graph.edges(["AB"])

        st.graphviz_chart(graph)

        c = self.get_delta_from_queue().new_element.graphviz_chart
        self.assertEqual(hasattr(c, "spec"), True)

    def test_use_container_width_true(self):
        """Test that it can be called with use_container_width."""
        graph = graphviz.Graph(comment="The Round Table")
        graph.node("A", "King Arthur")
        graph.node("B", "Sir Bedevere the Wise")
        graph.edges(["AB"])

        st.graphviz_chart(graph, use_container_width=True)

        c = self.get_delta_from_queue().new_element.graphviz_chart
        self.assertEqual(c.use_container_width, True)
