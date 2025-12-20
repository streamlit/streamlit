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

from dataclasses import dataclass
from typing import Literal, TypeAlias, cast

from streamlit.errors import (
    StreamlitInvalidColumnGapError,
    StreamlitInvalidHeightError,
    StreamlitInvalidHorizontalAlignmentError,
    StreamlitInvalidSizeError,
    StreamlitInvalidVerticalAlignmentError,
    StreamlitInvalidWidthError,
)
from streamlit.proto.Block_pb2 import Block
from streamlit.proto.GapSize_pb2 import GapConfig, GapSize
from streamlit.proto.HeightConfig_pb2 import HeightConfig
from streamlit.proto.WidthConfig_pb2 import WidthConfig

WidthWithoutContent: TypeAlias = int | Literal["stretch"]
Width: TypeAlias = int | Literal["stretch", "content"]
HeightWithoutContent: TypeAlias = int | Literal["stretch"]
Height: TypeAlias = int | Literal["stretch", "content"]
SpaceSize: TypeAlias = int | Literal["stretch", "small", "medium", "large"]
Gap: TypeAlias = int | Literal["small", "medium", "large"]
HorizontalAlignment: TypeAlias = Literal["left", "center", "right", "distribute"]
VerticalAlignment: TypeAlias = Literal["top", "center", "bottom", "distribute"]

# Mapping of size literals to rem values for st.space
# If changing these, also check streamlit/frontend/lib/src/theme/primitives/sizes.ts
# to ensure sizes are kept in sync.
SIZE_TO_REM_MAPPING = {
    "small": 0.75,  # Height of widget label minus gap
    "medium": 2.5,  # Height of button/input field
    "large": 4.25,  # Height of large widget without label
}

# Integer gap values are clamped to this maximum
MAX_PIXEL_GAP = 1000


@dataclass
class LayoutConfig:
    width: Width | SpaceSize | None = None
    height: Height | SpaceSize | None = None


def validate_width(width: Width, allow_content: bool = False) -> None:
    """Validate the width parameter.

    Parameters
    ----------
    width : Any
        The width value to validate.
    allow_content : bool
        Whether to allow "content" as a valid width value.

    Raises
    ------
    StreamlitInvalidWidthError
        If the width value is invalid.
    """
    if not isinstance(width, (int, str)):
        raise StreamlitInvalidWidthError(width, allow_content)

    if isinstance(width, str):
        valid_strings = ["stretch"]
        if allow_content:
            valid_strings.append("content")

        if width not in valid_strings:
            raise StreamlitInvalidWidthError(width, allow_content)
    elif width <= 0:
        raise StreamlitInvalidWidthError(width, allow_content)


def validate_height(
    height: Height | Literal["auto"],
    allow_content: bool = False,
    allow_stretch: bool = True,
    additional_allowed: list[str] | None = None,
) -> None:
    """Validate the height parameter.

    Parameters
    ----------
    height : Any
        The height value to validate.
    allow_content : bool
        Whether to allow "content" as a valid height value.
    allow_stretch : bool
        Whether to allow "stretch" as a valid height value.
    additional_allowed : list[str] or None
        Additional string values to allow beyond the base allowed values.

    Raises
    ------
    StreamlitInvalidHeightError
        If the height value is invalid.
    """
    if not isinstance(height, (int, str)):
        raise StreamlitInvalidHeightError(height, allow_content)

    if isinstance(height, str):
        valid_strings = []
        if allow_stretch:
            valid_strings.append("stretch")
        if allow_content:
            valid_strings.append("content")
        if additional_allowed:
            valid_strings.extend(additional_allowed)

        if height not in valid_strings:
            raise StreamlitInvalidHeightError(height, allow_content)

    elif height <= 0:
        raise StreamlitInvalidHeightError(height, allow_content)


def validate_space_size(size: SpaceSize) -> None:
    """Validate the size parameter for st.space.

    Parameters
    ----------
    size : Any
        The size value to validate.

    Raises
    ------
    StreamlitInvalidSizeError
        If the size value is invalid.
    """
    if not isinstance(size, (int, str)):
        raise StreamlitInvalidSizeError(size)

    if isinstance(size, str):
        valid_strings = ["stretch", "small", "medium", "large"]
        if size not in valid_strings:
            raise StreamlitInvalidSizeError(size)
    elif isinstance(size, int) and size <= 0:
        raise StreamlitInvalidSizeError(size)


def get_width_config(width: Width | SpaceSize) -> WidthConfig:
    width_config = WidthConfig()
    if isinstance(width, str) and width in SIZE_TO_REM_MAPPING:
        width_config.rem_width = SIZE_TO_REM_MAPPING[width]
    elif isinstance(width, (int, float)):
        width_config.pixel_width = int(width)
    elif width == "content":
        width_config.use_content = True
    else:
        width_config.use_stretch = True
    return width_config


def get_height_config(height: Height | SpaceSize) -> HeightConfig:
    height_config = HeightConfig()
    if isinstance(height, str) and height in SIZE_TO_REM_MAPPING:
        height_config.rem_height = SIZE_TO_REM_MAPPING[height]
    elif isinstance(height, (int, float)):
        height_config.pixel_height = int(height)
    elif height == "content":
        height_config.use_content = True
    else:
        height_config.use_stretch = True
    return height_config


def get_gap_config(gap: Gap | None, element_type: str) -> GapConfig:
    """
    Convert a gap specification into a GapConfig proto message.

    Parameters
    ----------
    gap : {"small", "medium", "large", int} or None
        Named gaps map to the matching :class:`GapSize` enum value.
        Integer inputs specify the gap in pixels and must be between 0 and
        ``MAX_PIXEL_GAP`` (inclusive). ``0`` or ``None`` remove the gap entirely.
    element_type : str
        The element requesting the gap. Used for contextualizing error messages.

    Returns
    -------
    GapConfig
        A proto with either ``gap_size`` or ``pixel_gap`` populated.

    Raises
    ------
    StreamlitInvalidColumnGapError
        If ``gap`` is not a supported string, is a boolean, or falls outside the
        allowed integer range.
    """
    gap_mapping = {
        "small": GapSize.SMALL,
        "medium": GapSize.MEDIUM,
        "large": GapSize.LARGE,
    }

    gap_config = GapConfig()

    if isinstance(gap, str):
        gap_size = gap.lower()
        valid_sizes = gap_mapping.keys()

        if gap_size in valid_sizes:
            gap_config.gap_size = gap_mapping[gap_size]
            return gap_config
    elif gap is None:
        gap_config.gap_size = GapSize.NONE
        return gap_config
    elif isinstance(gap, int) and not isinstance(gap, bool):
        if 0 <= gap <= MAX_PIXEL_GAP:
            if gap == 0:
                gap_config.gap_size = GapSize.NONE
            else:
                gap_config.pixel_gap = int(gap)
            return gap_config

    raise StreamlitInvalidColumnGapError(
        gap=gap, element_type=element_type, max_pixel_gap=MAX_PIXEL_GAP
    )


def validate_horizontal_alignment(horizontal_alignment: HorizontalAlignment) -> None:
    valid_horizontal_alignments = ["left", "center", "right", "distribute"]
    if horizontal_alignment not in valid_horizontal_alignments:
        raise StreamlitInvalidHorizontalAlignmentError(
            horizontal_alignment, "st.container"
        )


def validate_vertical_alignment(vertical_alignment: VerticalAlignment) -> None:
    valid_vertical_alignments = ["top", "center", "bottom", "distribute"]
    if vertical_alignment not in valid_vertical_alignments:
        raise StreamlitInvalidVerticalAlignmentError(vertical_alignment, "st.container")


map_to_flex_terminology = {
    "left": "start",
    "center": "center",
    "right": "end",
    "top": "start",
    "bottom": "end",
    "distribute": "space_between",
}


def get_justify(
    alignment: HorizontalAlignment | VerticalAlignment,
) -> Block.FlexContainer.Justify.ValueType:
    valid_justify = ["start", "center", "end", "space_between"]
    justify = map_to_flex_terminology[alignment]
    if justify not in valid_justify:
        return Block.FlexContainer.Justify.JUSTIFY_UNDEFINED
    if justify in ["start", "end", "center"]:
        return cast(
            "Block.FlexContainer.Justify.ValueType",
            getattr(Block.FlexContainer.Justify, f"JUSTIFY_{justify.upper()}"),
        )
    return cast(
        "Block.FlexContainer.Justify.ValueType",
        getattr(Block.FlexContainer.Justify, f"{justify.upper()}"),
    )


def get_align(
    alignment: HorizontalAlignment | VerticalAlignment,
) -> Block.FlexContainer.Align.ValueType:
    valid_align = ["start", "end", "center"]
    align = map_to_flex_terminology[alignment]
    if align not in valid_align:
        return Block.FlexContainer.Align.ALIGN_UNDEFINED
    return cast(
        "Block.FlexContainer.Align.ValueType",
        getattr(Block.FlexContainer.Align, f"ALIGN_{align.upper()}"),
    )
