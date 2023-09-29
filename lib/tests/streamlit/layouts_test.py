# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class ColumnsTest(DeltaGeneratorTestCase):
    """Test columns."""

    def test_equal_width_columns(self):
        """Test that it works correctly when spec is int"""
        columns = st.columns(3)

        for column in columns:
            with column:
                st.write("Hello")

        all_deltas = self.get_all_deltas_from_queue()

        columns_blocks = all_deltas[1:4]
        # 7 elements will be created: 1 horizontal block, 3 columns, 3 markdown
        self.assertEqual(len(all_deltas), 7)
        self.assertEqual(columns_blocks[0].add_block.column.weight, 1.0 / 3)
        self.assertEqual(columns_blocks[1].add_block.column.weight, 1.0 / 3)
        self.assertEqual(columns_blocks[2].add_block.column.weight, 1.0 / 3)

    def test_not_equal_width_int_columns(self):
        """Test that it works correctly when spec is list of ints"""
        weights = [3, 2, 1]
        sum_weights = sum(weights)
        columns = st.columns(weights)

        for column in columns:
            with column:
                st.write("Hello")

        all_deltas = self.get_all_deltas_from_queue()

        columns_blocks = all_deltas[1:4]
        # 7 elements will be created: 1 horizontal block, 3 columns, 3 markdown
        self.assertEqual(len(all_deltas), 7)
        self.assertEqual(columns_blocks[0].add_block.column.weight, 3.0 / sum_weights)
        self.assertEqual(columns_blocks[1].add_block.column.weight, 2.0 / sum_weights)
        self.assertEqual(columns_blocks[2].add_block.column.weight, 1.0 / sum_weights)

    def test_not_equal_width_float_columns(self):
        """Test that it works correctly when spec is list of floats or ints"""
        weights = [7.5, 2.5, 5]
        sum_weights = sum(weights)
        columns = st.columns(weights)

        for column in columns:
            with column:
                pass

        all_deltas = self.get_all_deltas_from_queue()

        columns_blocks = all_deltas[1:]
        # 4 elements will be created: 1 horizontal block, 3 columns
        self.assertEqual(len(all_deltas), 4)
        self.assertEqual(len(columns_blocks), 3)
        self.assertEqual(columns_blocks[0].add_block.column.weight, 7.5 / sum_weights)
        self.assertEqual(columns_blocks[1].add_block.column.weight, 2.5 / sum_weights)
        self.assertEqual(columns_blocks[2].add_block.column.weight, 5.0 / sum_weights)

    def test_columns_with_default_small_gap(self):
        """Test that it works correctly with no gap argument (gap size is default of small)"""

        st.columns(3)

        all_deltas = self.get_all_deltas_from_queue()

        horizontal_block = all_deltas[0]
        columns_blocks = all_deltas[1:4]

        # 4 elements will be created: 1 horizontal block, 3 columns, each receives "small" gap arg
        self.assertEqual(len(all_deltas), 4)
        self.assertEqual(horizontal_block.add_block.horizontal.gap, "small")
        self.assertEqual(columns_blocks[0].add_block.column.gap, "small")
        self.assertEqual(columns_blocks[1].add_block.column.gap, "small")
        self.assertEqual(columns_blocks[2].add_block.column.gap, "small")

    def test_columns_with_medium_gap(self):
        """Test that it works correctly with "medium" gap argument"""

        columns = st.columns(3, gap="medium")

        all_deltas = self.get_all_deltas_from_queue()

        horizontal_block = all_deltas[0]
        columns_blocks = all_deltas[1:4]

        # 4 elements will be created: 1 horizontal block, 3 columns, each receives "medium" gap arg
        self.assertEqual(len(all_deltas), 4)
        self.assertEqual(horizontal_block.add_block.horizontal.gap, "medium")
        self.assertEqual(columns_blocks[0].add_block.column.gap, "medium")
        self.assertEqual(columns_blocks[1].add_block.column.gap, "medium")
        self.assertEqual(columns_blocks[2].add_block.column.gap, "medium")

    def test_columns_with_large_gap(self):
        """Test that it works correctly with "large" gap argument"""

        columns = st.columns(3, gap="LARGE")

        all_deltas = self.get_all_deltas_from_queue()

        horizontal_block = all_deltas[0]
        columns_blocks = all_deltas[1:4]

        # 4 elements will be created: 1 horizontal block, 3 columns, each receives "large" gap arg
        self.assertEqual(len(all_deltas), 4)
        self.assertEqual(horizontal_block.add_block.horizontal.gap, "large")
        self.assertEqual(columns_blocks[0].add_block.column.gap, "large")
        self.assertEqual(columns_blocks[1].add_block.column.gap, "large")
        self.assertEqual(columns_blocks[2].add_block.column.gap, "large")


class ExpanderTest(DeltaGeneratorTestCase):
    def test_label_required(self):
        """Test that label is required"""
        with self.assertRaises(TypeError):
            st.expander()

    def test_just_label(self):
        """Test that it can be called with no params"""
        expander = st.expander("label")

        with expander:
            pass

        expander_block = self.get_delta_from_queue()
        self.assertEqual(expander_block.add_block.expandable.label, "label")
        self.assertEqual(expander_block.add_block.expandable.expanded, False)


class ContainerTest(DeltaGeneratorTestCase):
    def test_border_parameter(self):
        """Test that it can be called with border parameter"""
        st.container(border=True)
        container_block = self.get_delta_from_queue()
        self.assertEqual(container_block.add_block.vertical.border, True)

    def test_without_parameters(self):
        """Test that it can be called without any parameters."""
        st.container()
        container_block = self.get_delta_from_queue()
        self.assertEqual(container_block.add_block.vertical.border, False)
        self.assertEqual(container_block.add_block.allow_empty, False)


class StatusContainerTest(DeltaGeneratorTestCase):
    def test_label_required(self):
        """Test that label is required"""
        with self.assertRaises(TypeError):
            st.status()

    def test_throws_error_on_wrong_state(self):
        """Test that it throws an error on unknown state."""
        with self.assertRaises(StreamlitAPIException):
            st.status("label", state="unknown")

    def test_just_label(self):
        """Test that it correctly applies label param."""
        st.status("label")
        status_block = self.get_delta_from_queue()
        self.assertEqual(status_block.add_block.expandable.label, "label")
        self.assertEqual(status_block.add_block.expandable.expanded, False)
        self.assertEqual(status_block.add_block.expandable.icon, "spinner")

    def test_expanded_param(self):
        """Test that it correctly applies expanded param."""
        st.status("label", expanded=True)

        status_block = self.get_delta_from_queue()
        self.assertEqual(status_block.add_block.expandable.label, "label")
        self.assertEqual(status_block.add_block.expandable.expanded, True)
        self.assertEqual(status_block.add_block.expandable.icon, "spinner")

    def test_state_param_complete(self):
        """Test that it correctly applies state param with `complete`."""
        st.status("label", state="complete")

        status_block = self.get_delta_from_queue()
        self.assertEqual(status_block.add_block.expandable.label, "label")
        self.assertEqual(status_block.add_block.expandable.expanded, False)
        self.assertEqual(status_block.add_block.expandable.icon, "check")

    def test_state_param_error(self):
        """Test that it correctly applies state param with `error`."""
        st.status("label", state="error")

        status_block = self.get_delta_from_queue()
        self.assertEqual(status_block.add_block.expandable.label, "label")
        self.assertEqual(status_block.add_block.expandable.expanded, False)
        self.assertEqual(status_block.add_block.expandable.icon, "error")

    def test_usage_with_context_manager(self):
        """Test that it correctly switches to complete state when used as context manager."""
        status = st.status("label")

        with status:
            pass

        status_block = self.get_delta_from_queue()
        self.assertEqual(status_block.add_block.expandable.label, "label")
        self.assertEqual(status_block.add_block.expandable.expanded, False)
        self.assertEqual(status_block.add_block.expandable.icon, "check")

    def test_mutation_via_update(self):
        """Test that update can be used to change the label, state and expand."""
        status = st.status("label", expanded=False)
        status.update(label="new label", state="error", expanded=True)

        status_block = self.get_delta_from_queue()
        self.assertEqual(status_block.add_block.expandable.label, "new label")
        self.assertEqual(status_block.add_block.expandable.expanded, True)
        self.assertEqual(status_block.add_block.expandable.icon, "error")

    def test_mutation_via_update_in_cm(self):
        """Test that update can be used in context manager to change the label, state and expand."""
        with st.status("label", expanded=False) as status:
            status.update(label="new label", state="error", expanded=True)

        status_block = self.get_delta_from_queue()
        self.assertEqual(status_block.add_block.expandable.label, "new label")
        self.assertEqual(status_block.add_block.expandable.expanded, True)
        self.assertEqual(status_block.add_block.expandable.icon, "error")


class TabsTest(DeltaGeneratorTestCase):
    def test_tab_required(self):
        """Test that at least one tab is required."""
        with self.assertRaises(TypeError):
            st.tabs()

        with self.assertRaises(StreamlitAPIException):
            st.tabs([])

    def test_only_label_strings_allowed(self):
        """Test that only strings are allowed as tab labels."""
        with self.assertRaises(StreamlitAPIException):
            st.tabs(["tab1", True])

        with self.assertRaises(StreamlitAPIException):
            st.tabs(["tab1", 10])

    def test_returns_all_expected_tabs(self):
        """Test that all labels are added in correct order."""
        tabs = st.tabs([f"tab {i}" for i in range(5)])

        self.assertEqual(len(tabs), 5)

        for tab in tabs:
            with tab:
                pass

        all_deltas = self.get_all_deltas_from_queue()

        tabs_block = all_deltas[1:]
        # 6 elements will be created: 1 horizontal block, 5 tabs
        self.assertEqual(len(all_deltas), 6)
        self.assertEqual(len(tabs_block), 5)
        for index, tabs_block in enumerate(tabs_block):
            self.assertEqual(tabs_block.add_block.tab.label, f"tab {index}")
