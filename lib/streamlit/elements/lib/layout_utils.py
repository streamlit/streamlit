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
from typing import Literal, Union

from typing_extensions import TypeAlias

from streamlit.errors import StreamlitInvalidHeightError, StreamlitInvalidWidthError
from streamlit.proto.HeightConfig_pb2 import HeightConfig
from streamlit.proto.WidthConfig_pb2 import WidthConfig

WidthWithoutContent: TypeAlias = Union[int, Literal["stretch"]]
Width: TypeAlias = Union[int, Literal["stretch", "content"]]
HeightWithoutContent: TypeAlias = Union[int, Literal["stretch"]]
Height: TypeAlias = Union[int, Literal["stretch", "content"]]


@dataclass
class LayoutConfig:
    width: Width | None = None
    height: Height | None = None


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


def validate_height(height: Height, allow_content: bool = False) -> None:
    """Validate the height parameter.

    Parameters
    ----------
    height : Any
        The height value to validate.
    allow_content : bool
        Whether to allow "content" as a valid height value.

    Raises
    ------
    StreamlitInvalidHeightError
        If the height value is invalid.
    """
    if not isinstance(height, (int, str)):
        raise StreamlitInvalidHeightError(height, allow_content)

    if isinstance(height, str):
        valid_strings = ["stretch"]
        if allow_content:
            valid_strings.append("content")

        if height not in valid_strings:
            raise StreamlitInvalidHeightError(height, allow_content)

    elif height <= 0:
        raise StreamlitInvalidHeightError(height, allow_content)


def get_width_config(width: Width) -> WidthConfig:
    width_config = WidthConfig()
    if isinstance(width, int):
        width_config.pixel_width = width
    elif width == "content":
        width_config.use_content = True
    else:
        width_config.use_stretch = True
    return width_config


def get_height_config(height: Height) -> HeightConfig:
    height_config = HeightConfig()
    if isinstance(height, int):
        height_config.pixel_height = height
    elif height == "content":
        height_config.use_content = True
    else:
        height_config.use_stretch = True
    return height_config
