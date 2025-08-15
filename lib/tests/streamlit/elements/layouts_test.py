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

from typing import Literal
from unittest.mock import patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.dialog_decorator import dialog_decorator
from streamlit.errors import (
    FragmentHandledException,
    StreamlitAPIException,
    StreamlitInvalidColumnGapError,
    StreamlitInvalidHorizontalAlignmentError,
    StreamlitInvalidVerticalAlignmentError,
)
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.GapSize_pb2 import GapSize
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


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
        assert len(all_deltas) == 7

        # Check the defaults have been applied correctly for the first column
        assert (
            columns_blocks[0].add_block.column.vertical_alignment
            == BlockProto.Column.VerticalAlignment.TOP
        )
        assert columns_blocks[0].add_block.column.gap_config.gap_size == GapSize.SMALL
        assert not columns_blocks[0].add_block.column.show_border

        # Check the weights are correct
        assert columns_blocks[0].add_block.column.weight == 1.0 / 3
        assert columns_blocks[1].add_block.column.weight == 1.0 / 3
        assert columns_blocks[2].add_block.column.weight == 1.0 / 3

    @parameterized.expand(
        [
            ("bottom", BlockProto.Column.VerticalAlignment.BOTTOM),
            ("top", BlockProto.Column.VerticalAlignment.TOP),
            ("center", BlockProto.Column.VerticalAlignment.CENTER),
        ]
    )
    def test_columns_with_vertical_alignment(
        self, vertical_alignment: Literal["top", "bottom", "center"], expected_alignment
    ):
        """Test that it works correctly with vertical_alignment argument"""

        st.columns(3, vertical_alignment=vertical_alignment)

        all_deltas = self.get_all_deltas_from_queue()

        # 7 elements will be created: 1 horizontal block, 3 columns, 3 markdown
        columns_blocks = all_deltas[1:4]

        # Check that the vertical alignment is correct for all columns
        assert (
            columns_blocks[0].add_block.column.vertical_alignment == expected_alignment
        )
        assert (
            columns_blocks[1].add_block.column.vertical_alignment == expected_alignment
        )
        assert (
            columns_blocks[2].add_block.column.vertical_alignment == expected_alignment
        )

    def test_columns_with_invalid_vertical_alignment(self):
        """Test that it throws an error on invalid vertical_alignment argument"""
        with pytest.raises(StreamlitAPIException):
            st.columns(3, vertical_alignment="invalid")

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
        assert len(all_deltas) == 7
        assert columns_blocks[0].add_block.column.weight == 3.0 / sum_weights
        assert columns_blocks[1].add_block.column.weight == 2.0 / sum_weights
        assert columns_blocks[2].add_block.column.weight == 1.0 / sum_weights

    def test_not_equal_width_float_columns(self):
        """Test that it works correctly when spec is list of floats or ints"""
        weights = [7.5, 2.5, 5]
        sum_weights = sum(weights)
        columns = st.columns(weights)

        for column in columns:
            with column:
                # Noop
                pass

        all_deltas = self.get_all_deltas_from_queue()

        columns_blocks = all_deltas[1:]
        # 4 elements will be created: 1 horizontal block, 3 columns
        assert len(all_deltas) == 4
        assert len(columns_blocks) == 3
        assert columns_blocks[0].add_block.column.weight == 7.5 / sum_weights
        assert columns_blocks[1].add_block.column.weight == 2.5 / sum_weights
        assert columns_blocks[2].add_block.column.weight == 5.0 / sum_weights

    def test_columns_with_default_small_gap(self):
        """Test that it works correctly with no gap argument
        (gap size is default of small)"""

        st.columns(3)

        all_deltas = self.get_all_deltas_from_queue()

        horizontal_container = all_deltas[0]
        columns_blocks = all_deltas[1:4]

        # 4 elements will be created: 1 horizontal block, 3 columns, each receives
        # "small" gap arg
        assert len(all_deltas) == 4
        assert (
            horizontal_container.add_block.flex_container.gap_config.WhichOneof(
                "gap_spec"
            )
            == "gap_size"
        )
        assert (
            horizontal_container.add_block.flex_container.gap_config.gap_size
            == GapSize.SMALL
        )

        for col_block in columns_blocks:
            assert (
                col_block.add_block.column.gap_config.WhichOneof("gap_spec")
                == "gap_size"
            )
            assert col_block.add_block.column.gap_config.gap_size == GapSize.SMALL

    def test_columns_with_medium_gap(self):
        """Test that it works correctly with "medium" gap argument"""

        st.columns(3, gap="medium")

        all_deltas = self.get_all_deltas_from_queue()

        horizontal_container = all_deltas[0]
        columns_blocks = all_deltas[1:4]

        # 4 elements will be created: 1 horizontal block, 3 columns, each receives
        # "medium" gap arg
        assert len(all_deltas) == 4
        assert (
            horizontal_container.add_block.flex_container.gap_config.WhichOneof(
                "gap_spec"
            )
            == "gap_size"
        )
        assert (
            horizontal_container.add_block.flex_container.gap_config.gap_size
            == GapSize.MEDIUM
        )

        for col_block in columns_blocks:
            assert (
                col_block.add_block.column.gap_config.WhichOneof("gap_spec")
                == "gap_size"
            )
            assert col_block.add_block.column.gap_config.gap_size == GapSize.MEDIUM

    def test_columns_with_large_gap(self):
        """Test that it works correctly with "large" gap argument"""

        st.columns(3, gap="LARGE")

        all_deltas = self.get_all_deltas_from_queue()

        horizontal_container = all_deltas[0]
        columns_blocks = all_deltas[1:4]

        # 4 elements will be created: 1 horizontal block, 3 columns, each receives
        # "large" gap arg
        assert len(all_deltas) == 4
        assert (
            horizontal_container.add_block.flex_container.gap_config.WhichOneof(
                "gap_spec"
            )
            == "gap_size"
        )
        assert (
            horizontal_container.add_block.flex_container.gap_config.gap_size
            == GapSize.LARGE
        )

        for col_block in columns_blocks:
            assert (
                col_block.add_block.column.gap_config.WhichOneof("gap_spec")
                == "gap_size"
            )
            assert col_block.add_block.column.gap_config.gap_size == GapSize.LARGE

    def test_columns_with_none_gap(self):
        """Test that it works correctly with "none" gap argument"""

        st.columns(3, gap=None)

        all_deltas = self.get_all_deltas_from_queue()

        horizontal_container = all_deltas[0]
        columns_blocks = all_deltas[1:4]

        # 4 elements will be created: 1 horizontal block, 3 columns, each receives
        # "none" gap arg
        assert (
            horizontal_container.add_block.flex_container.gap_config.WhichOneof(
                "gap_spec"
            )
            == "gap_size"
        )
        assert (
            horizontal_container.add_block.flex_container.gap_config.gap_size
            == GapSize.NONE
        )

        for col_block in columns_blocks:
            assert (
                col_block.add_block.column.gap_config.WhichOneof("gap_spec")
                == "gap_size"
            )
            assert col_block.add_block.column.gap_config.gap_size == GapSize.NONE

    @parameterized.expand(
        [
            "invalid",
            5,
            "5rem",
            "10px",
        ]
    )
    def test_columns_with_invalid_gap(self, invalid_gap):
        """Test that it throws an error on invalid gap argument"""
        with pytest.raises(StreamlitInvalidColumnGapError):
            st.columns(3, gap=invalid_gap)

    def test_columns_with_border(self):
        """Test that it works correctly with border argument"""

        st.columns(3, border=True)

        all_deltas = self.get_all_deltas_from_queue()

        columns_blocks = all_deltas[1:4]

        # 4 elements will be created: 1 horizontal block, 3 columns,
        # each receives: border=True
        assert len(all_deltas) == 4
        assert columns_blocks[0].add_block.column.show_border
        assert columns_blocks[1].add_block.column.show_border
        assert columns_blocks[2].add_block.column.show_border

    def test_width_config_pixel_width(self):
        """Test that width configuration works correctly"""
        st.columns(3, width=200)
        columns_block = self.get_delta_from_queue(0)
        assert columns_block.add_block.width_config.pixel_width == 200

    def test_width_config_stretch(self):
        """Test that width configuration works correctly"""
        st.columns(3, width="stretch")
        columns_block = self.get_delta_from_queue(0)
        assert columns_block.add_block.width_config.use_stretch

    @parameterized.expand(
        [
            (None,),
            ("invalid",),
            (-100,),
            (0,),
            ("content",),
        ]
    )
    def test_invalid_width(self, invalid_width):
        """Test that invalid width values raise an error"""
        with pytest.raises(StreamlitAPIException):
            st.columns(3, width=invalid_width)


class ExpanderTest(DeltaGeneratorTestCase):
    def test_label_required(self):
        """Test that label is required"""
        with pytest.raises(TypeError):
            st.expander()

    def test_just_label(self):
        """Test that it can be called with no params"""
        expander = st.expander("label")

        with expander:
            # Noop
            pass

        expander_block = self.get_delta_from_queue()
        assert expander_block.add_block.expandable.label == "label"
        assert not expander_block.add_block.expandable.expanded

    def test_allow_empty(self):
        """Test that it correctly applies allow_empty param."""
        st.expander("label")
        expander_block = self.get_delta_from_queue()
        assert expander_block.add_block.allow_empty

    def test_width_config(self):
        """Test that width configuration works correctly"""
        st.expander("label", width=200)
        expander_block = self.get_delta_from_queue()
        assert expander_block.add_block.width_config.pixel_width == 200

        st.expander("label", width="stretch")
        expander_block = self.get_delta_from_queue()
        assert expander_block.add_block.width_config.use_stretch

    @parameterized.expand(
        [
            (None,),
            ("invalid",),
            (-100,),
            (0,),
            ("content",),
        ]
    )
    def test_invalid_width(self, invalid_width):
        """Test that invalid width values raise an error"""
        with pytest.raises(StreamlitAPIException):
            st.expander("label", width=invalid_width)

    def test_valid_emoji_icon(self):
        """Test that it can be called with an emoji icon"""
        expander = st.expander("label", icon="🦄")

        with expander:
            # Noop
            pass

        expander_block = self.get_delta_from_queue()
        assert expander_block.add_block.expandable.label == "label"
        assert expander_block.add_block.expandable.icon == "🦄"

    def test_valid_material_icon(self):
        """Test that it can be called with a material icon"""
        expander = st.expander("label", icon=":material/download:")

        with expander:
            # Noop
            pass

        expander_block = self.get_delta_from_queue()
        assert expander_block.add_block.expandable.label == "label"
        assert expander_block.add_block.expandable.icon == ":material/download:"

    def test_invalid_emoji_icon(self):
        """Test that it throws an error on invalid emoji icon"""
        with pytest.raises(StreamlitAPIException) as e:
            st.expander("label", icon="invalid")
        assert (
            str(e.value)
            == 'The value "invalid" is not a valid emoji. Shortcodes are not allowed, '
            "please use a single character instead."
        )

    def test_invalid_material_icon(self):
        """Test that it throws an error on invalid material icon"""
        icon = ":material/invalid:"
        with pytest.raises(StreamlitAPIException) as e:
            st.expander("label", icon=icon)
        assert "is not a valid Material icon" in str(e.value)


class ContainerTest(DeltaGeneratorTestCase):
    def test_border_parameter(self):
        """Test that it can be called with border parameter"""
        st.container(border=True)
        container_block = self.get_delta_from_queue()
        assert container_block.add_block.flex_container.border

    def test_allow_empty_with_border(self):
        """Test that it allows empty when the container has a border."""
        st.container(border=True)
        container_block = self.get_delta_from_queue()
        assert container_block.add_block.allow_empty

    def test_disallow_empty_without_border_or_height(self):
        """Test that it disallows empty when no border or height is set."""
        st.container()
        container_block = self.get_delta_from_queue()
        assert not container_block.add_block.allow_empty

    def test_without_parameters(self):
        """Test that it can be called without any parameters."""
        st.container()
        container_block = self.get_delta_from_queue()
        assert not container_block.add_block.flex_container.border
        assert not container_block.add_block.allow_empty
        assert container_block.add_block.id == ""

    def test_setting_key(self):
        """Test that the key can be set and that it is included in the
        generated element ID."""
        st.container(key="container_key")
        container_block = self.get_delta_from_queue()
        assert "container_key" in container_block.add_block.id

    def test_height_parameter(self):
        """Test that it can be called with height parameter"""
        st.container(height=100)

        container_block = self.get_delta_from_queue()
        assert container_block.add_block.height_config.pixel_height == 100
        # Should allow empty and have a border as default:
        assert container_block.add_block.flex_container.border
        assert container_block.add_block.allow_empty

    def test_width_config(self):
        """Test that width configuration works correctly"""
        st.container(width=200)
        container_block = self.get_delta_from_queue()
        assert container_block.add_block.width_config.pixel_width == 200

        st.container(width="stretch")
        container_block = self.get_delta_from_queue()
        assert container_block.add_block.width_config.use_stretch

    @parameterized.expand(
        [
            (None,),
            ("invalid",),
            (-100,),
            (0,),
        ]
    )
    def test_invalid_width(self, invalid_width):
        """Test that invalid width values raise an error"""
        with pytest.raises(StreamlitAPIException):
            st.container(width=invalid_width)

    def test_height_config(self):
        """Test that height configuration works correctly"""
        st.container(height=200)
        container_block = self.get_delta_from_queue()
        assert container_block.add_block.height_config.pixel_height == 200

        st.container(height="stretch")
        container_block = self.get_delta_from_queue()
        assert container_block.add_block.height_config.use_stretch

        st.container(height="content")
        container_block = self.get_delta_from_queue()
        assert container_block.add_block.height_config.use_content

    @parameterized.expand(
        [
            (None,),
            ("invalid",),
            (-100,),
            (0,),
        ]
    )
    def test_invalid_height(self, invalid_height):
        """Test that invalid height values raise an error"""
        with pytest.raises(StreamlitAPIException):
            st.container(height=invalid_height)

    @parameterized.expand(
        [
            (False, BlockProto.FlexContainer.Direction.VERTICAL),
            (True, BlockProto.FlexContainer.Direction.HORIZONTAL),
        ],
    )
    def test_container_direction(
        self, direction: bool, expected_direction: int
    ) -> None:
        """Test that st.container sets the correct direction."""
        st.container(horizontal=direction)
        container_block = self.get_delta_from_queue()
        assert container_block.add_block.flex_container.direction == expected_direction

    @parameterized.expand(
        [
            ("left", BlockProto.FlexContainer.Justify.JUSTIFY_START),
            ("center", BlockProto.FlexContainer.Justify.JUSTIFY_CENTER),
            ("right", BlockProto.FlexContainer.Justify.JUSTIFY_END),
            ("distribute", BlockProto.FlexContainer.Justify.SPACE_BETWEEN),
        ]
    )
    def test_container_horizontal_alignment(
        self, horizontal_alignment: str, expected_justify: int
    ) -> None:
        """Test that st.container sets the correct horizontal alignment (justify)."""
        st.container(horizontal=True, horizontal_alignment=horizontal_alignment)
        container_block = self.get_delta_from_queue()
        assert container_block.add_block.flex_container.justify == expected_justify

    @parameterized.expand(
        [
            ("top", BlockProto.FlexContainer.Align.ALIGN_START),
            ("center", BlockProto.FlexContainer.Align.ALIGN_CENTER),
            ("bottom", BlockProto.FlexContainer.Align.ALIGN_END),
            ("distribute", BlockProto.FlexContainer.Align.ALIGN_UNDEFINED),
        ],
    )
    def test_container_vertical_alignment(
        self, vertical_alignment: str, expected_align: int
    ) -> None:
        """Test that st.container sets the correct vertical alignment (align)."""
        st.container(horizontal=True, vertical_alignment=vertical_alignment)
        container_block = self.get_delta_from_queue()
        assert container_block.add_block.flex_container.align == expected_align

    @parameterized.expand(
        [
            ("top", BlockProto.FlexContainer.Justify.JUSTIFY_START),
            ("center", BlockProto.FlexContainer.Justify.JUSTIFY_CENTER),
            ("bottom", BlockProto.FlexContainer.Justify.JUSTIFY_END),
            ("distribute", BlockProto.FlexContainer.Justify.SPACE_BETWEEN),
        ]
    )
    def test_container_vertical_direction_vertical_alignment(
        self, vertical_alignment: str, expected_justify: int
    ) -> None:
        """Test that st.container with direction='vertical' sets the correct justify value for vertical_alignment."""
        st.container(horizontal=False, vertical_alignment=vertical_alignment)
        container_block = self.get_delta_from_queue()
        assert container_block.add_block.flex_container.justify == expected_justify

    @parameterized.expand(
        [
            ("left", BlockProto.FlexContainer.Align.ALIGN_START),
            ("center", BlockProto.FlexContainer.Align.ALIGN_CENTER),
            ("right", BlockProto.FlexContainer.Align.ALIGN_END),
            ("distribute", BlockProto.FlexContainer.Align.ALIGN_UNDEFINED),
        ]
    )
    def test_container_vertical_direction_horizontal_alignment(
        self, horizontal_alignment: str, expected_align: int
    ) -> None:
        """Test that st.container with direction='vertical' sets the correct align value for horizontal_alignment."""
        st.container(horizontal=False, horizontal_alignment=horizontal_alignment)
        container_block = self.get_delta_from_queue()
        assert container_block.add_block.flex_container.align == expected_align

    @parameterized.expand(
        [
            (True, True),
            (False, False),
        ],
    )
    def test_container_wrap(self, direction: bool, wrap: bool) -> None:
        """Test that st.container sets the wrap property correctly."""
        st.container(horizontal=direction)
        container_block = self.get_delta_from_queue()
        assert container_block.add_block.flex_container.wrap == wrap

    @parameterized.expand(
        [
            ("small", GapSize.SMALL),
            ("medium", GapSize.MEDIUM),
            ("large", GapSize.LARGE),
            (None, GapSize.NONE),
        ],
    )
    def test_container_gap(self, gap, expected_gap) -> None:
        """Test that st.container sets the gap property correctly."""
        st.container(gap=gap)
        container_block = self.get_delta_from_queue()
        assert (
            container_block.add_block.flex_container.gap_config.gap_size == expected_gap
        )

    @parameterized.expand(
        [
            "invalid",
            None,
        ],
    )
    def test_container_invalid_horizontal_alignment(self, horizontal_alignment) -> None:
        """Test that st.container raises on invalid horizontal_alignment."""
        import streamlit as st

        with pytest.raises(StreamlitInvalidHorizontalAlignmentError):
            st.container(horizontal=True, horizontal_alignment=horizontal_alignment)

    @parameterized.expand(
        [
            "invalid",
            None,
        ],
    )
    def test_container_invalid_vertical_alignment(self, vertical_alignment) -> None:
        """Test that st.container raises on invalid vertical_alignment."""
        import streamlit as st

        with pytest.raises(StreamlitInvalidVerticalAlignmentError):
            st.container(horizontal=True, vertical_alignment=vertical_alignment)


class PopoverContainerTest(DeltaGeneratorTestCase):
    def test_label_required(self):
        """Test that label is required"""
        with pytest.raises(TypeError):
            st.popover()

    def test_just_label(self):
        """Test that it correctly applies label param."""
        popover = st.popover("label")
        with popover:
            # Noop
            pass

        popover_block = self.get_delta_from_queue()
        assert popover_block.add_block.popover.label == "label"
        assert not popover_block.add_block.popover.disabled
        assert popover_block.add_block.popover.help == ""
        assert popover_block.add_block.allow_empty
        # Default width should be "content"
        assert popover_block.add_block.width_config.use_content

    def test_use_container_width_true(self):
        """Test use_container_width=True is mapped to width='stretch'."""
        test_widths = [200, "content", "stretch", None]

        for width in test_widths:
            with self.subTest(width=width):
                if width is None:
                    st.popover("label", use_container_width=True)
                else:
                    st.popover("label", use_container_width=True, width=width)

                popover_block = self.get_delta_from_queue()
                assert (
                    popover_block.add_block.width_config.WhichOneof("width_spec")
                    == WidthConfigFields.USE_STRETCH.value
                )
                assert popover_block.add_block.width_config.use_stretch is True

    def test_use_container_width_false(self):
        """Test use_container_width=False is mapped to width='content'."""
        test_widths = [200, "stretch", "content", None]

        for width in test_widths:
            with self.subTest(width=width):
                if width is None:
                    st.popover("label", use_container_width=False)
                else:
                    st.popover("label", use_container_width=False, width=width)

                popover_block = self.get_delta_from_queue()
                assert (
                    popover_block.add_block.width_config.WhichOneof("width_spec")
                    == WidthConfigFields.USE_CONTENT.value
                )
                assert popover_block.add_block.width_config.use_content is True

    def test_disabled(self):
        """Test that it correctly applies disabled param."""
        popover = st.popover("label", disabled=True)
        with popover:
            # Noop
            pass

        popover_block = self.get_delta_from_queue()
        assert popover_block.add_block.popover.label == "label"
        assert popover_block.add_block.popover.disabled

    def test_help(self):
        """Test that it correctly applies help param."""
        popover = st.popover("label", help="help text")
        with popover:
            # Noop
            pass

        popover_block = self.get_delta_from_queue()
        assert popover_block.add_block.popover.label == "label"
        assert popover_block.add_block.popover.help == "help text"

    def test_valid_emoji_icon(self):
        """Test that it can be called with an emoji icon"""
        popover = st.popover("label", icon="🦄")

        with popover:
            # Noop
            pass

        popover_block = self.get_delta_from_queue()
        assert popover_block.add_block.popover.label == "label"
        assert popover_block.add_block.popover.icon == "🦄"

    def test_valid_material_icon(self):
        """Test that it can be called with a material icon"""
        popover = st.popover("label", icon=":material/download:")

        with popover:
            # Noop
            pass

        popover_block = self.get_delta_from_queue()
        assert popover_block.add_block.popover.label == "label"
        assert popover_block.add_block.popover.icon == ":material/download:"

    def test_invalid_emoji_icon(self):
        """Test that it throws an error on invalid emoji icon"""
        with pytest.raises(StreamlitAPIException) as e:
            st.popover("label", icon="invalid")
        assert (
            str(e.value)
            == 'The value "invalid" is not a valid emoji. Shortcodes are not allowed, '
            "please use a single character instead."
        )

    def test_invalid_material_icon(self):
        """Test that it throws an error on invalid material icon"""
        icon = ":material/invalid:"
        with pytest.raises(StreamlitAPIException) as e:
            st.popover("label", icon=icon)
        assert "is not a valid Material icon" in str(e.value)

    def test_width_pixel_value(self):
        """Test that pixel width configuration works correctly"""
        st.popover("label", width=200)
        popover_block = self.get_delta_from_queue()
        assert popover_block.add_block.width_config.pixel_width == 200

    def test_width_stretch(self):
        """Test that stretch width configuration works correctly"""
        st.popover("label", width="stretch")
        popover_block = self.get_delta_from_queue()
        assert popover_block.add_block.width_config.use_stretch

    def test_width_content(self):
        """Test that content width configuration works correctly"""
        st.popover("label", width="content")
        popover_block = self.get_delta_from_queue()
        assert popover_block.add_block.width_config.use_content

    @parameterized.expand(["invalid", -100, 0])
    def test_invalid_width(self, invalid_width):
        """Test that invalid width values raise an error"""
        with pytest.raises(StreamlitAPIException):
            st.popover("label", width=invalid_width)


class StatusContainerTest(DeltaGeneratorTestCase):
    def test_label_required(self):
        """Test that label is required"""
        with pytest.raises(TypeError):
            st.status()

    def test_throws_error_on_wrong_state(self):
        """Test that it throws an error on unknown state."""
        with pytest.raises(StreamlitAPIException):
            st.status("label", state="unknown")

    def test_just_label(self):
        """Test that it correctly applies label param."""
        st.status("label")
        status_block = self.get_delta_from_queue()
        assert status_block.add_block.expandable.label == "label"
        assert not status_block.add_block.expandable.expanded
        assert status_block.add_block.expandable.icon == "spinner"

    def test_expanded_param(self):
        """Test that it correctly applies expanded param."""
        st.status("label", expanded=True)

        status_block = self.get_delta_from_queue()
        assert status_block.add_block.expandable.label == "label"
        assert status_block.add_block.expandable.expanded
        assert status_block.add_block.expandable.icon == "spinner"

    def test_state_param_complete(self):
        """Test that it correctly applies state param with `complete`."""
        st.status("label", state="complete")

        status_block = self.get_delta_from_queue()
        assert status_block.add_block.expandable.label == "label"
        assert not status_block.add_block.expandable.expanded
        assert status_block.add_block.expandable.icon == ":material/check:"

    def test_state_param_error(self):
        """Test that it correctly applies state param with `error`."""
        st.status("label", state="error")

        status_block = self.get_delta_from_queue()
        assert status_block.add_block.expandable.label == "label"
        assert not status_block.add_block.expandable.expanded
        assert status_block.add_block.expandable.icon == ":material/error:"

    def test_usage_with_context_manager(self):
        """Test that it correctly switches to complete state when used as
        context manager."""
        status = st.status("label")

        with status:
            # Noop
            pass

        status_block = self.get_delta_from_queue()
        assert status_block.add_block.expandable.label == "label"
        assert not status_block.add_block.expandable.expanded
        assert status_block.add_block.expandable.icon == ":material/check:"

    def test_mutation_via_update(self):
        """Test that update can be used to change the label, state and expand."""
        status = st.status("label", expanded=False)
        status.update(label="new label", state="error", expanded=True)

        status_block = self.get_delta_from_queue()
        assert status_block.add_block.expandable.label == "new label"
        assert status_block.add_block.expandable.expanded
        assert status_block.add_block.expandable.icon == ":material/error:"

    def test_mutation_via_update_in_cm(self):
        """Test that update can be used in context manager to change the label, state
        and expand."""
        with st.status("label", expanded=False) as status:
            status.update(label="new label", state="error", expanded=True)

        status_block = self.get_delta_from_queue()
        assert status_block.add_block.expandable.label == "new label"
        assert status_block.add_block.expandable.expanded
        assert status_block.add_block.expandable.icon == ":material/error:"

    def test_width_config(self):
        """Test that width configuration works correctly"""
        st.status("label", width=200)
        status_block = self.get_delta_from_queue()
        assert status_block.add_block.width_config.pixel_width == 200

        st.expander("label", width="stretch")
        status_block = self.get_delta_from_queue()
        assert status_block.add_block.width_config.use_stretch

    @parameterized.expand(
        [
            (None,),
            ("invalid",),
            (-100,),
            (0,),
            ("content",),
        ]
    )
    def test_invalid_width(self, invalid_width):
        """Test that invalid width values raise an error"""
        with pytest.raises(StreamlitAPIException):
            st.status("label", width=invalid_width)


class TabsTest(DeltaGeneratorTestCase):
    def test_tab_required(self):
        """Test that at least one tab is required."""
        with pytest.raises(TypeError):
            st.tabs()

        with pytest.raises(StreamlitAPIException):
            st.tabs([])

    def test_only_label_strings_allowed(self):
        """Test that only strings are allowed as tab labels."""
        with pytest.raises(StreamlitAPIException):
            st.tabs(["tab1", True])

        with pytest.raises(StreamlitAPIException):
            st.tabs(["tab1", 10])

    def test_returns_all_expected_tabs(self):
        """Test that all labels are added in correct order."""
        tabs = st.tabs([f"tab {i}" for i in range(5)])

        assert len(tabs) == 5

        for tab in tabs:
            with tab:
                # Noop
                pass

        all_deltas = self.get_all_deltas_from_queue()

        tabs_block = all_deltas[1:]
        # 6 elements will be created: 1 horizontal block, 5 tabs
        assert len(all_deltas) == 6
        assert len(tabs_block) == 5
        for index, tab_block in enumerate(tabs_block):
            assert tab_block.add_block.tab.label == f"tab {index}"


class DialogTest(DeltaGeneratorTestCase):
    """Run unit tests for the non-public delta-generator dialog and also the dialog
    decorator."""

    title = "Test Dialog"

    def test_dialog_deltagenerator_usage_with_context_manager(self):
        """Test that the delta-generator dialog works as a context manager"""

        dialog = st._main._dialog(DialogTest.title)

        with dialog:
            """No content so that 'get_delta_from_queue' returns the dialog."""
            pass

        dialog_block = self.get_delta_from_queue()
        assert dialog_block.add_block.dialog.title == DialogTest.title
        assert not dialog_block.add_block.dialog.is_open
        assert dialog_block.add_block.dialog.dismissible
        assert not dialog_block.add_block.dialog.id

    @parameterized.expand(
        [
            ("medium", BlockProto.Dialog.DialogWidth.MEDIUM),
            ("large", BlockProto.Dialog.DialogWidth.LARGE),
            ("small", BlockProto.Dialog.DialogWidth.SMALL),
        ]
    )
    def test_dialog_width(
        self, width: str, expected_width: BlockProto.Dialog.DialogWidth.ValueType
    ):
        """Test that the dialog width parameter works correctly for all supported values"""
        dialog = st._main._dialog(DialogTest.title, width=width)
        with dialog:
            # No content so that 'get_delta_from_queue' returns the dialog.
            pass
        dialog_block = self.get_delta_from_queue()
        assert dialog_block.add_block.dialog.width == expected_width

    def test_dialog_deltagenerator_opens_and_closes(self):
        """Test that dialog opens and closes"""
        dialog = st._main._dialog(DialogTest.title)

        assert dialog is not None
        dialog_block = self.get_delta_from_queue()
        assert not dialog_block.add_block.dialog.is_open

        dialog.open()
        dialog_block = self.get_delta_from_queue()
        assert dialog_block.add_block.dialog.is_open

        dialog.close()
        dialog_block = self.get_delta_from_queue()
        assert not dialog_block.add_block.dialog.is_open

    def test_dialog_deltagenerator_only_call_open_once(self):
        """Test that only a single dialog can be opened"""
        dialog = st._main._dialog(DialogTest.title)

        assert dialog is not None

        # Open first time
        dialog.open()
        with pytest.raises(StreamlitAPIException):
            # Cannot call open while the dialog is already open
            dialog.open()
        dialog.close()
        with pytest.raises(StreamlitAPIException):
            # Close does not reset the dialog-flag as this is handled per script-run
            # context
            dialog.open()

    def test_dialog_decorator_with_title_opens(self):
        """Test that the dialog decorator having a title does not throw an error"""

        @st.dialog("example title")
        def dialog():
            return None

        dialog()

    def test_dialog_decorator_title_required(self):
        """Test that the title is required in decorator"""
        with pytest.raises(TypeError) as e:

            @st.dialog()
            def dialog():
                return None

            dialog()

        assert e.value.args[0].startswith(
            "dialog_decorator() missing 1 required positional argument: 'title'"
        )

        with pytest.raises(TypeError) as e:

            @st.dialog()
            def dialog_with_arguments(a, b):
                return None

            dialog_with_arguments("", "")

        assert e.value.args[0].startswith(
            "dialog_decorator() missing 1 required positional argument: 'title'"
        )

        with pytest.raises(StreamlitAPIException) as e:

            @st.dialog("")
            def dialog():
                return None

            dialog()

        assert e.value.args[0].startswith("A non-empty `title`")

    def test_dialog_decorator_must_be_called_like_a_function_with_a_title(self):
        """Test that the decorator must be called like a function."""
        with pytest.raises(StreamlitAPIException):

            @st.dialog
            def dialog():
                return None

            dialog()

        with pytest.raises(StreamlitAPIException):

            @st.dialog
            def dialog_with_arg(a):
                return None

            dialog_with_arg("a")

        with pytest.raises(StreamlitAPIException):

            @st.dialog
            def dialog_with_args(a, b):
                return None

            dialog_with_args("a", "b")

    def test_nested_dialog_raises_error(self):
        """Test that dialogs cannot be called nested."""

        @st.dialog("Level2 dialog")
        def level2_dialog():
            st.empty()

        @st.dialog("Level1 dialog")
        def level1_dialog():
            level2_dialog()

        with pytest.raises(FragmentHandledException) as e:
            level1_dialog()
        assert str(e.value) == "Dialogs may not be nested inside other dialogs."

    def test_only_one_dialog_can_be_opened_at_same_time(self):
        @st.dialog("Dialog1")
        def dialog1():
            st.empty()

        @st.dialog("Dialog2")
        def dialog2():
            st.empty()

        with pytest.raises(StreamlitAPIException) as e:
            dialog1()
            dialog2()

        assert e.value.args[0].startswith(
            "Only one dialog is allowed to be opened at the same time."
        )

    def test_dialog_deltagenerator_dismissible_false(self):
        """Test that the delta-generator dialog properly handles dismissible=False"""

        dialog = st._main._dialog(DialogTest.title, dismissible=False)

        with dialog:
            """No content so that 'get_delta_from_queue' returns the dialog."""
            pass

        dialog_block = self.get_delta_from_queue()
        assert dialog_block.add_block.dialog.title == DialogTest.title
        assert not dialog_block.add_block.dialog.is_open
        assert dialog_block.add_block.dialog.dismissible is False

    def test_dialog_decorator_invalid_on_dismiss(self):
        """Test dialog decorator with invalid on_dismiss raises error"""
        with pytest.raises(StreamlitAPIException) as exc_info:

            @dialog_decorator("Test Dialog", on_dismiss="invalid")
            def test_dialog():
                pass

            test_dialog()

        assert "You have passed invalid to `on_dismiss`" in str(exc_info.value)

    def test_dialog_on_dismiss_rerun(self):
        """Test that the dialog decorator with on_dismiss='rerun'."""

        with patch("streamlit.elements.lib.dialog.register_widget") as mock_register:
            dialog = st._main._dialog(DialogTest.title, on_dismiss="rerun")

            with dialog:
                # No content so that 'get_delta_from_queue' returns the dialog.
                pass

            mock_register.assert_called_once()

        dialog_block = self.get_delta_from_queue()
        assert dialog_block.add_block.dialog.id

    def test_dialog_on_dismiss_callback(self):
        """Test that the dialog decorator with on_dismiss=callback."""

        def callback():
            pass

        with patch("streamlit.elements.lib.dialog.register_widget") as mock_register:
            dialog = st._main._dialog(DialogTest.title, on_dismiss=callback)

            with dialog:
                # No content so that 'get_delta_from_queue' returns the dialog.
                pass
            mock_register.assert_called_once()

        dialog_block = self.get_delta_from_queue()
        assert dialog_block.add_block.dialog.id
