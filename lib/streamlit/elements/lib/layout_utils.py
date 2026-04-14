# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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
    StreamlitInvalidTextAlignmentError,
    StreamlitInvalidVerticalAlignmentError,
    StreamlitInvalidWidthError,
)
from streamlit.proto.Block_pb2 import Block
from streamlit.proto.GapSize_pb2 import GapSize
from streamlit.proto.HeightConfig_pb2 import HeightConfig
from streamlit.proto.TextAlignmentConfig_pb2 import TextAlignmentConfig
from streamlit.proto.WidthConfig_pb2 import WidthConfig

WidthWithoutContent: TypeAlias = int | Literal["stretch"]
Width: TypeAlias = int | Literal["stretch", "content"]
HeightWithoutContent: TypeAlias = int | Literal["stretch"]
Height: TypeAlias = int | Literal["stretch", "content"]
SpaceSize: TypeAlias = (
    int
    | Literal[
        "stretch", "xxsmall", "xsmall", "small", "medium", "large", "xlarge", "xxlarge"
    ]
)
Gap: TypeAlias = Literal[
    "xxsmall", "xsmall", "small", "medium", "large", "xlarge", "xxlarge"
]
HorizontalAlignment: TypeAlias = Literal["left", "center", "right", "distribute"]
VerticalAlignment: TypeAlias = Literal["top", "center", "bottom", "distribute"]
TextAlignment: TypeAlias = Literal["left", "center", "right", "justify"]

# Mapping of size literals to rem values for st.space
# If changing these, also check streamlit/frontend/lib/src/theme/primitives/sizes.ts
# to ensure sizes are kept in sync.
SIZE_TO_REM_MAPPING = {
    "xxsmall": 0.25,  # Aligns with gap "xxsmall" (4px)
    "xsmall": 0.5,  # Aligns with gap "xsmall" (8px)
    "small": 0.75,  # Height of widget label minus gap
    "medium": 2.5,  # Height of button/input field
    "large": 4.25,  # Height of large widget without label
    "xlarge": 6,  # Aligns with gap "xlarge" (96px)
    "xxlarge": 8,  # Aligns with gap "xxlarge" (128px)
}


@dataclass
class LayoutConfig:
    """Pure data container bundling dimension and alignment config for ``_enqueue()``.

    Each field maps to a proto config (``WidthConfig``, ``HeightConfig``,
    ``TextAlignmentConfig``) that the frontend uses to size and align the
    element within its container.

    Prefer ``create_layout_config()`` for validated construction from
    user-supplied values.  Direct construction is appropriate for internal use
    with known-valid literals (e.g. hardcoded ``"content"`` or ``"stretch"``).

    See ``lib/streamlit/elements/plotly_chart.py`` for a reference example.
    """

    width: Width | SpaceSize | None = None
    height: Height | SpaceSize | None = None
    text_alignment: TextAlignment | None = None


_UNSET: Width | Height = cast("Width", object())


def create_layout_config(
    *,
    width: Width | None = _UNSET,
    height: Height | None = _UNSET,
    text_alignment: TextAlignment | None = None,
    allow_content_width: bool = False,
    allow_content_height: bool = False,
    allow_stretch_height: bool = True,
    additional_allowed_height: list[str] | None = None,
) -> LayoutConfig:
    """Validate inputs and construct a ``LayoutConfig`` in one step.

    Consolidates the common validate-then-construct pattern into a single call
    so that callers cannot accidentally skip validation.

    When ``width`` or ``height`` is omitted, no validation runs and the
    resulting ``LayoutConfig`` field is ``None``.  When the caller
    *explicitly* passes a value — including ``None`` — the corresponding
    validator runs (and will reject ``None`` as invalid).

    Parameters
    ----------
    width : Width | None
        Desired width.  Validated via ``validate_width`` when provided.
        Omit (or leave as default) to skip width validation entirely.
    height : Height | None
        Desired height.  Validated via ``validate_height`` when provided.
        Omit (or leave as default) to skip height validation entirely.
    text_alignment : TextAlignment | None
        Text alignment.  Validated via ``validate_text_alignment`` when not
        ``None``.
    allow_content_width : bool
        Passed as ``allow_content`` to ``validate_width``.
    allow_content_height : bool
        Passed as ``allow_content`` to ``validate_height``.
    allow_stretch_height : bool
        Passed as ``allow_stretch`` to ``validate_height``.
    additional_allowed_height : list[str] | None
        Passed as ``additional_allowed`` to ``validate_height``.

    Returns
    -------
    LayoutConfig
        A validated ``LayoutConfig`` instance.
    """
    actual_width: Width | None = None
    if width is not _UNSET:
        validate_width(width, allow_content=allow_content_width)
        actual_width = width

    actual_height: Height | None = None
    if height is not _UNSET:
        validate_height(
            height,
            allow_content=allow_content_height,
            allow_stretch=allow_stretch_height,
            additional_allowed=additional_allowed_height,
        )
        actual_height = height

    if text_alignment is not None:
        validate_text_alignment(text_alignment)
    return LayoutConfig(
        width=actual_width, height=actual_height, text_alignment=text_alignment
    )


def validate_width(width: Width | None, allow_content: bool = False) -> None:
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
    height: Height | Literal["auto"] | None,
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
        valid_strings = [
            "stretch",
            "xxsmall",
            "xsmall",
            "small",
            "medium",
            "large",
            "xlarge",
            "xxlarge",
        ]
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


def get_gap_size(gap: str | None, element_type: str) -> GapSize.ValueType:
    """Convert a gap string or None to a GapSize proto value."""
    gap_mapping = {
        "xxsmall": GapSize.XXSMALL,
        "xsmall": GapSize.XSMALL,
        "small": GapSize.SMALL,
        "medium": GapSize.MEDIUM,
        "large": GapSize.LARGE,
        "xlarge": GapSize.XLARGE,
        "xxlarge": GapSize.XXLARGE,
    }

    if isinstance(gap, str):
        gap_size = gap.lower()
        valid_sizes = gap_mapping.keys()

        if gap_size in valid_sizes:
            return gap_mapping[gap_size]
    elif gap is None:
        return GapSize.NONE

    raise StreamlitInvalidColumnGapError(gap=gap, element_type=element_type)


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


def validate_text_alignment(text_alignment: TextAlignment) -> None:
    """Validate the text_alignment parameter.

    Parameters
    ----------
    text_alignment : TextAlignment
        The text alignment value to validate.

    Raises
    ------
    StreamlitInvalidTextAlignmentError
        If the text_alignment value is invalid.
    """
    valid_alignments = ["left", "center", "right", "justify"]
    if text_alignment not in valid_alignments:
        raise StreamlitInvalidTextAlignmentError(text_alignment)


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
    if justify in {"start", "end", "center"}:
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


def get_text_alignment_config(
    text_alignment: TextAlignment,
) -> TextAlignmentConfig:
    """Convert text alignment string to proto config.

    Parameters
    ----------
    text_alignment : TextAlignment
        The text alignment value ("left", "center", "right", "justify").

    Returns
    -------
    TextAlignmentConfig
        Proto message with alignment set.
    """

    alignment_mapping = {
        "left": TextAlignmentConfig.Alignment.LEFT,
        "center": TextAlignmentConfig.Alignment.CENTER,
        "right": TextAlignmentConfig.Alignment.RIGHT,
        "justify": TextAlignmentConfig.Alignment.JUSTIFY,
    }

    config = TextAlignmentConfig()
    config.alignment = alignment_mapping[text_alignment]
    return config
