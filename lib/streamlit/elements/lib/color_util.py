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

from collections.abc import Collection
from typing import Any, Callable, Union, cast

from typing_extensions import TypeAlias

from streamlit.errors import StreamlitInvalidColorError

# components go from 0.0 to 1.0
# Supported by Pillow and pretty common.
FloatRGBColorTuple: TypeAlias = tuple[float, float, float]
FloatRGBAColorTuple: TypeAlias = tuple[float, float, float, float]

# components go from 0 to 255
# DeckGL uses these.
IntRGBColorTuple: TypeAlias = tuple[int, int, int]
IntRGBAColorTuple: TypeAlias = tuple[int, int, int, int]

# components go from 0 to 255, except alpha goes from 0.0 to 1.0
# CSS uses these.
MixedRGBAColorTuple: TypeAlias = tuple[int, int, int, float]

Color4Tuple: TypeAlias = Union[
    FloatRGBAColorTuple,
    IntRGBAColorTuple,
    MixedRGBAColorTuple,
]

Color3Tuple: TypeAlias = Union[
    FloatRGBColorTuple,
    IntRGBColorTuple,
]

ColorTuple: TypeAlias = Union[Color4Tuple, Color3Tuple]

IntColorTuple = Union[IntRGBColorTuple, IntRGBAColorTuple]
CSSColorStr = Union[IntRGBAColorTuple, MixedRGBAColorTuple]

ColorStr: TypeAlias = str

Color: TypeAlias = Union[ColorTuple, ColorStr]
MaybeColor: TypeAlias = Union[str, Collection[Any]]


def to_int_color_tuple(color: MaybeColor) -> IntColorTuple:
    """Convert input into color tuple of type (int, int, int, int)."""
    color_tuple = _to_color_tuple(
        color,
        rgb_formatter=_int_formatter,
        alpha_formatter=_int_formatter,
    )
    return cast("IntColorTuple", color_tuple)


def to_css_color(color: MaybeColor) -> Color:
    """Convert input into a CSS-compatible color that Vega can use.

    Inputs must be a hex string, rgb()/rgba() string, or a color tuple. Inputs may not be a CSS
    color name, other CSS color function (like "hsl(...)"), etc.

    See tests for more info.
    """
    if is_css_color_like(color):
        return cast("Color", color)

    if is_color_tuple_like(color):
        ctuple = cast("ColorTuple", color)
        ctuple = _normalize_tuple(ctuple, _int_formatter, _float_formatter)
        if len(ctuple) == 3:
            return f"rgb({ctuple[0]}, {ctuple[1]}, {ctuple[2]})"
        if len(ctuple) == 4:
            c4tuple = cast("MixedRGBAColorTuple", ctuple)
            return f"rgba({c4tuple[0]}, {c4tuple[1]}, {c4tuple[2]}, {c4tuple[3]})"

    raise StreamlitInvalidColorError(color)


def is_css_color_like(color: MaybeColor) -> bool:
    """Check whether the input looks like something Vega can use.

    This is meant to be lightweight, and not a definitive answer. The definitive solution is to try
    to convert and see if an error is thrown.

    NOTE: We only accept hex colors and color tuples as user input. So do not use this function to
    validate user input! Instead use is_hex_color_like and is_color_tuple_like.
    """
    return is_hex_color_like(color) or _is_cssrgb_color_like(color)


def is_hex_color_like(color: MaybeColor) -> bool:
    """Check whether the input looks like a hex color.

    This is meant to be lightweight, and not a definitive answer. The definitive solution is to try
    to convert and see if an error is thrown.
    """
    return (
        isinstance(color, str)
        and color.startswith("#")
        and color[1:].isalnum()  # Alphanumeric
        and len(color) in {4, 5, 7, 9}
    )


def _is_cssrgb_color_like(color: MaybeColor) -> bool:
    """Check whether the input looks like a CSS rgb() or rgba() color string.

    This is meant to be lightweight, and not a definitive answer. The definitive solution is to try
    to convert and see if an error is thrown.

    NOTE: We only accept hex colors and color tuples as user input. So do not use this function to
    validate user input! Instead use is_hex_color_like and is_color_tuple_like.
    """
    return isinstance(color, str) and color.startswith(("rgb(", "rgba("))


def is_color_tuple_like(color: MaybeColor) -> bool:
    """Check whether the input looks like a tuple color.

    This is meant to be lightweight, and not a definitive answer. The definitive solution is to try
    to convert and see if an error is thrown.
    """
    return (
        isinstance(color, (tuple, list))
        and len(color) in {3, 4}
        and all(isinstance(c, (int, float)) for c in color)
    )


def is_color_like(color: MaybeColor) -> bool:
    """A fairly lightweight check of whether the input is a color.

    This isn't meant to be a definitive answer. The definitive solution is to
    try to convert and see if an error is thrown.
    """
    return is_css_color_like(color) or is_color_tuple_like(color)


# Wrote our own hex-to-tuple parser to avoid bringing in a dependency.
def _to_color_tuple(
    color: MaybeColor,
    rgb_formatter: Callable[[float, MaybeColor], float],
    alpha_formatter: Callable[[float, MaybeColor], float],
) -> ColorTuple:
    """Convert a potential color to a color tuple.

    The exact type of color tuple this outputs is dictated by the formatter parameters.

    The R, G, B components are transformed by rgb_formatter, and the alpha component is transformed
    by alpha_formatter.

    For example, to output a (float, float, float, int) color tuple, set rgb_formatter
    to _float_formatter and alpha_formatter to _int_formatter.
    """
    if is_hex_color_like(color):
        hex_len = len(color)
        color_hex = cast("str", color)

        if hex_len == 4:
            r = 2 * color_hex[1]
            g = 2 * color_hex[2]
            b = 2 * color_hex[3]
            a = "ff"
        elif hex_len == 5:
            r = 2 * color_hex[1]
            g = 2 * color_hex[2]
            b = 2 * color_hex[3]
            a = 2 * color_hex[4]
        elif hex_len == 7:
            r = color_hex[1:3]
            g = color_hex[3:5]
            b = color_hex[5:7]
            a = "ff"
        elif hex_len == 9:
            r = color_hex[1:3]
            g = color_hex[3:5]
            b = color_hex[5:7]
            a = color_hex[7:9]
        else:
            raise StreamlitInvalidColorError(color)

        try:
            color = int(r, 16), int(g, 16), int(b, 16), int(a, 16)
        except Exception as ex:
            raise StreamlitInvalidColorError(color) from ex

    if is_color_tuple_like(color):
        color_tuple = cast("ColorTuple", color)
        return _normalize_tuple(color_tuple, rgb_formatter, alpha_formatter)

    raise StreamlitInvalidColorError(color)


def _normalize_tuple(
    color: ColorTuple,
    rgb_formatter: Callable[[float, MaybeColor], float],
    alpha_formatter: Callable[[float, MaybeColor], float],
) -> ColorTuple:
    """Parse color tuple using the specified color formatters.

    The R, G, B components are transformed by rgb_formatter, and the alpha component is transformed
    by alpha_formatter.

    For example, to output a (float, float, float, int) color tuple, set rgb_formatter
    to _float_formatter and alpha_formatter to _int_formatter.
    """
    if len(color) == 3:
        r = rgb_formatter(color[0], color)
        g = rgb_formatter(color[1], color)
        b = rgb_formatter(color[2], color)
        return r, g, b

    if len(color) == 4:
        color_4tuple = color
        r = rgb_formatter(color_4tuple[0], color_4tuple)
        g = rgb_formatter(color_4tuple[1], color_4tuple)
        b = rgb_formatter(color_4tuple[2], color_4tuple)
        alpha = alpha_formatter(color_4tuple[3], color_4tuple)
        return r, g, b, alpha

    raise StreamlitInvalidColorError(color)


def _int_formatter(component: float, color: MaybeColor) -> int:
    """Convert a color component (float or int) to an int from 0 to 255.

    Anything too small will become 0, and anything too large will become 255.
    """
    if isinstance(component, float):
        component = int(component * 255)

    if isinstance(component, int):
        return min(255, max(component, 0))

    raise StreamlitInvalidColorError(color)


def _float_formatter(component: float, color: MaybeColor) -> float:
    """Convert a color component (float or int) to a float from 0.0 to 1.0.

    Anything too small will become 0.0, and anything too large will become 1.0.
    """
    if isinstance(component, int):
        component = component / 255.0

    if isinstance(component, float):
        return min(1.0, max(component, 0.0))

    raise StreamlitInvalidColorError(color)
