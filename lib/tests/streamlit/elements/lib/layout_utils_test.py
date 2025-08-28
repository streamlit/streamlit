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

from __future__ import annotations

import unittest

import pytest
from parameterized import parameterized

from streamlit.elements.lib.layout_utils import (
    get_align,
    get_gap_size,
    get_height_config,
    get_justify,
    get_width_config,
    validate_height,
    validate_horizontal_alignment,
    validate_vertical_alignment,
    validate_width,
)
from streamlit.errors import (
    StreamlitInvalidColumnGapError,
    StreamlitInvalidHeightError,
    StreamlitInvalidHorizontalAlignmentError,
    StreamlitInvalidVerticalAlignmentError,
    StreamlitInvalidWidthError,
)
from streamlit.proto.Block_pb2 import Block
from streamlit.proto.GapSize_pb2 import GapSize


class LayoutUtilsTest(unittest.TestCase):
    @parameterized.expand(
        [
            (1, False),
            (100, False),
            (10, True),
            ("stretch", False),
            ("content", True),
        ]
    )
    def test_validate_width_valid(self, width: int | str, allow_content: bool):
        """validate_width accepts positive ints, 'stretch', and optionally 'content'."""

        validate_width(width, allow_content=allow_content)

    @parameterized.expand(
        [
            (0, False),
            (-1, False),
            ("content", False),
            ("invalid", False),
            (10.5, False),
            (None, False),
        ]
    )
    def test_validate_width_invalid(self, width: object, allow_content: bool):
        """validate_width raises for non-positive ints, disallowed strings, and wrong types."""

        with pytest.raises(StreamlitInvalidWidthError):
            validate_width(width, allow_content=allow_content)  # type: ignore[arg-type]

    @parameterized.expand(
        [
            (1, False, True, None),
            (10, False, False, None),
            ("stretch", False, True, None),
            ("content", True, True, None),
            ("auto", False, True, ["auto"]),
        ]
    )
    def test_validate_height_valid(
        self,
        height: int | str,
        allow_content: bool,
        allow_stretch: bool,
        additional_allowed: list[str] | None,
    ):
        """validate_height accepts allowed ints and strings based on flags provided."""

        validate_height(
            height,
            allow_content=allow_content,
            allow_stretch=allow_stretch,
            additional_allowed=additional_allowed,
        )

    @parameterized.expand(
        [
            (0, False, True, None),
            (-5, False, True, None),
            ("content", False, True, None),
            ("stretch", False, False, None),
            ("invalid", False, True, None),
            (5.5, False, True, None),
            ("auto", False, True, None),
        ]
    )
    def test_validate_height_invalid(
        self,
        height: object,
        allow_content: bool,
        allow_stretch: bool,
        additional_allowed: list[str] | None,
    ):
        """validate_height raises for invalid values or when flags disallow certain strings."""

        with pytest.raises(StreamlitInvalidHeightError):
            validate_height(
                height,  # type: ignore[arg-type]
                allow_content=allow_content,
                allow_stretch=allow_stretch,
                additional_allowed=additional_allowed,
            )

    @parameterized.expand(
        [
            (100, 100),
            (100.9, 100),
        ]
    )
    def test_get_width_config_numeric(self, width: float | int, expected_px: int):
        """get_width_config produces pixel_width for numeric inputs (floats are truncated)."""

        config = get_width_config(width)
        assert config.pixel_width == expected_px
        assert not config.use_content
        assert not config.use_stretch

    @parameterized.expand(
        [
            ("content", True, False),
            ("stretch", False, True),
        ]
    )
    def test_get_width_config_string(
        self, width: str, expect_content: bool, expect_stretch: bool
    ):
        """get_width_config sets the appropriate flags for string inputs."""

        config = get_width_config(width)
        assert config.pixel_width == 0
        assert config.use_content is expect_content
        assert config.use_stretch is expect_stretch

    @parameterized.expand(
        [
            (200, 200),
            (200.7, 200),
        ]
    )
    def test_get_height_config_numeric(self, height: float | int, expected_px: int):
        """get_height_config produces pixel_height for numeric inputs (floats are truncated)."""

        config = get_height_config(height)
        assert config.pixel_height == expected_px
        assert not config.use_content
        assert not config.use_stretch

    @parameterized.expand(
        [
            ("content", True, False),
            ("stretch", False, True),
        ]
    )
    def test_get_height_config_string(
        self, height: str, expect_content: bool, expect_stretch: bool
    ):
        """get_height_config sets the appropriate flags for string inputs."""

        config = get_height_config(height)
        assert config.pixel_height == 0
        assert config.use_content is expect_content
        assert config.use_stretch is expect_stretch

    @parameterized.expand(
        [
            ("small", GapSize.SMALL),
            ("medium", GapSize.MEDIUM),
            ("large", GapSize.LARGE),
            (None, GapSize.NONE),
        ]
    )
    def test_get_gap_size_valid(self, gap: str | None, expected: GapSize.ValueType):
        """get_gap_size maps valid inputs to GapSize values, None to GapSize.NONE."""

        assert get_gap_size(gap, "st.columns") == expected

    def test_get_gap_size_invalid(self):
        """get_gap_size raises for invalid gap strings."""

        with pytest.raises(StreamlitInvalidColumnGapError):
            get_gap_size("tiny", "st.columns")

    @parameterized.expand(
        [
            ("left",),
            ("center",),
            ("right",),
            ("distribute",),
        ]
    )
    def test_validate_horizontal_alignment_valid(self, align: str):
        """validate_horizontal_alignment accepts known horizontal alignment values."""

        validate_horizontal_alignment(align)  # type: ignore[arg-type]

    def test_validate_horizontal_alignment_invalid(self):
        """validate_horizontal_alignment raises for unknown values."""

        with pytest.raises(StreamlitInvalidHorizontalAlignmentError):
            validate_horizontal_alignment("middle")  # type: ignore[arg-type]

    @parameterized.expand(
        [
            ("top",),
            ("center",),
            ("bottom",),
            ("distribute",),
        ]
    )
    def test_validate_vertical_alignment_valid(self, align: str):
        """validate_vertical_alignment accepts known vertical alignment values."""

        validate_vertical_alignment(align)  # type: ignore[arg-type]

    def test_validate_vertical_alignment_invalid(self):
        """validate_vertical_alignment raises for unknown values."""

        with pytest.raises(StreamlitInvalidVerticalAlignmentError):
            validate_vertical_alignment("middle")  # type: ignore[arg-type]

    @parameterized.expand(
        [
            ("left", Block.FlexContainer.Justify.JUSTIFY_START),
            ("center", Block.FlexContainer.Justify.JUSTIFY_CENTER),
            ("right", Block.FlexContainer.Justify.JUSTIFY_END),
            ("top", Block.FlexContainer.Justify.JUSTIFY_START),
            ("bottom", Block.FlexContainer.Justify.JUSTIFY_END),
            ("distribute", Block.FlexContainer.Justify.SPACE_BETWEEN),
        ]
    )
    def test_get_justify(self, align: str, expected) -> None:
        """get_justify maps alignments to the correct Justify enum values."""

        assert get_justify(align) == expected  # type: ignore[arg-type]

    @parameterized.expand(
        [
            ("left", Block.FlexContainer.Align.ALIGN_START),
            ("center", Block.FlexContainer.Align.ALIGN_CENTER),
            ("right", Block.FlexContainer.Align.ALIGN_END),
            ("top", Block.FlexContainer.Align.ALIGN_START),
            ("bottom", Block.FlexContainer.Align.ALIGN_END),
            ("distribute", Block.FlexContainer.Align.ALIGN_UNDEFINED),
        ]
    )
    def test_get_align(self, align: str, expected) -> None:
        """get_align maps alignments to the correct Align enum values (or UNDEFINED)."""

        assert get_align(align) == expected  # type: ignore[arg-type]
