from unittest.mock import patch

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests import testutil


class ColumnsTest(testutil.DeltaGeneratorTestCase):
    """Test columns."""

    def test_equal_width_columns(self):
        """Test that it works correctly when spec is int"""
        columns = st.columns(3)

        for column in columns:
            with column:
                st.write("Hello")

        all_deltas = self.get_all_deltas_from_queue()

        horizontal_block = all_deltas[0]
        columns_blocks = all_deltas[1:4]
        widgets = all_deltas[4:]
        # 7 elements will be created: 1 horizontal block, 3 columns, 3 markdown
        self.assertEqual(len(all_deltas), 7)
        self.assertEqual(horizontal_block.add_block.horizontal.total_weight, 3.0)

    def test_not_equal_width_int_columns(self):
        """Test that it works correctly when spec is list of ints"""
        columns = st.columns([3, 2, 1])

        for column in columns:
            with column:
                st.write("Hello")

        all_deltas = self.get_all_deltas_from_queue()

        horizontal_block = all_deltas[0]
        columns_blocks = all_deltas[1:4]
        widgets = all_deltas[4:]
        # 7 elements will be created: 1 horizontal block, 3 columns, 3 markdown
        self.assertEqual(len(all_deltas), 7)
        self.assertEqual(horizontal_block.add_block.horizontal.total_weight, 6.0)
        self.assertEqual(columns_blocks[0].add_block.column.weight, 3.0)
        self.assertEqual(columns_blocks[1].add_block.column.weight, 2.0)
        self.assertEqual(columns_blocks[2].add_block.column.weight, 1.0)

    def test_not_equal_width_float_columns(self):
        """Test that it works correctly when spec is list of floats or ints"""
        columns = st.columns([7.5, 2.5, 5])

        for column in columns:
            with column:
                pass

        all_deltas = self.get_all_deltas_from_queue()

        horizontal_block = all_deltas[0]
        columns_blocks = all_deltas[1:]
        # 4 elements will be created: 1 horizontal block, 3 columns
        self.assertEqual(len(all_deltas), 4)
        self.assertEqual(len(columns_blocks), 3)
        self.assertEqual(horizontal_block.add_block.horizontal.total_weight, 15.0)
        self.assertEqual(columns_blocks[0].add_block.column.weight, 7.5)
        self.assertEqual(columns_blocks[1].add_block.column.weight, 2.5)
        self.assertEqual(columns_blocks[2].add_block.column.weight, 5.0)


class ExpanderTest(testutil.DeltaGeneratorTestCase):
    def test_label_required(self):
        """Test that label is required"""
        with self.assertRaises(TypeError):
            expander = st.expander()

    def test_just_label(self):
        """Test that it can be called with no params"""
        expander = st.expander("label")

        with expander:
            pass

        expander_block = self.get_delta_from_queue()
        self.assertEqual(expander_block.add_block.expandable.label, "label")
        self.assertEqual(expander_block.add_block.expandable.expanded, False)
