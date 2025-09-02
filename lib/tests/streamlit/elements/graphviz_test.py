# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""Graphviz unit test."""

import graphviz
from parameterized import parameterized

import streamlit as st
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class GraphvizTest(DeltaGeneratorTestCase):
    """Test ability to marshall graphviz_chart protos."""

    def test_spec(self):
        """Test that it can be called with spec."""
        graph = graphviz.Graph(comment="The Round Table")
        graph.node("A", "King Arthur")
        graph.node("B", "Sir Bedevere the Wise")
        graph.edges(["AB"])

        st.graphviz_chart(graph)

        c = self.get_delta_from_queue().new_element.graphviz_chart
        assert hasattr(c, "spec")

    def test_dot(self):
        """Test that it can be called with dot string."""
        graph = graphviz.Graph(comment="The Round Table")
        graph.node("A", "King Arthur")
        graph.node("B", "Sir Bedevere the Wise")
        graph.edges(["AB"])

        st.graphviz_chart(graph)

        c = self.get_delta_from_queue().new_element.graphviz_chart
        assert hasattr(c, "spec")

    @parameterized.expand(
        [
            (True, "use_stretch", True),
            (False, "use_content", True),
        ]
    )
    def test_use_container_width(
        self, use_container_width_value, expected_field, expected_value
    ):
        """Test that use_container_width is properly converted to width parameter."""
        graph = graphviz.Graph(comment="The Round Table")
        graph.node("A", "King Arthur")
        graph.node("B", "Sir Bedevere the Wise")
        graph.edges(["AB"])

        st.graphviz_chart(graph, use_container_width=use_container_width_value)

        delta = self.get_delta_from_queue()
        assert getattr(delta.new_element.width_config, expected_field) == expected_value

    def test_engines(self):
        """Test that it can be called with engines."""
        engines = ["dot", "neato", "twopi", "circo", "fdp", "osage", "patchwork"]
        for engine in engines:
            graph = graphviz.Graph(comment="The Round Table", engine=engine)
            graph.node("A", "King Arthur")
            graph.node("B", "Sir Bedevere the gWise")
            graph.edges(["AB"])

            st.graphviz_chart(graph)

            c = self.get_delta_from_queue().new_element.graphviz_chart
            assert hasattr(c, "engine")
            assert c.engine == engine

    def test_source(self):
        """Test that it can be called with graphviz.sources.Source object."""
        graph = graphviz.Source(
            'digraph "the holy hand grenade" { rankdir=LR; 1 -> 2 -> 3 -> lob }'
        )

        st.graphviz_chart(graph)

        c = self.get_delta_from_queue().new_element.graphviz_chart
        assert "grenade" in c.spec

    @parameterized.expand(
        [
            ("content", "use_content", True),
            ("stretch", "use_stretch", True),
            (400, "pixel_width", 400),
        ]
    )
    def test_width_parameter(self, width_value, expected_field, expected_value):
        """Test that it can be called with different width values."""
        graph = graphviz.Graph(comment="The Round Table")
        graph.node("A", "King Arthur")
        graph.node("B", "Sir Bedevere the Wise")
        graph.edges(["AB"])

        st.graphviz_chart(graph, width=width_value)

        delta = self.get_delta_from_queue()
        assert getattr(delta.new_element.width_config, expected_field) == expected_value
