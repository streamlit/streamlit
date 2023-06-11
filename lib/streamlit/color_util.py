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

from typing import Callable, Tuple, Union, cast

from typing_extensions import TypeAlias

from streamlit.errors import StreamlitAPIException, StreamlitModuleNotFoundError

# components go from 0.0 to 1.0
# Supported by Pillow and pretty common.
FloatRGBColorTuple: TypeAlias = Tuple[float, float, float]
FloatRGBAColorTuple: TypeAlias = Tuple[float, float, float, float]

# components go from 0 to 255
# DeckGL uses these.
IntRGBColorTuple: TypeAlias = Tuple[int, int, int]
IntRGBAColorTuple: TypeAlias = Tuple[int, int, int, int]

# components go from 0 to 255, except alpha goes from 0.0 to 1.0
# CSS uses these.
MixedRGBAColorTuple: TypeAlias = Tuple[int, int, int, float]

ColorTuple: TypeAlias = Union[
    FloatRGBColorTuple,
    FloatRGBAColorTuple,
    IntRGBColorTuple,
    IntRGBAColorTuple,
    MixedRGBAColorTuple,
]

IntColorTuple = Union[IntRGBColorTuple, IntRGBAColorTuple]
CSSColorStr = Union[IntRGBAColorTuple, MixedRGBAColorTuple]

ColorStr: TypeAlias = str

Color: TypeAlias = Union[ColorTuple, ColorStr]
MaybeColor: TypeAlias = Union[str, Tuple]


def to_int_color_tuple(color: MaybeColor) -> IntColorTuple:
    """Convert input into color tuple of type (int, int, int, int)."""
    color_tuple = _to_color_tuple(
        color,
        rgb_formatter=_int_formatter,
        alpha_formatter=_int_formatter,
    )
    return cast(IntColorTuple, color_tuple)


def to_css_color(color: MaybeColor) -> Color:
    """Convert input into a CSS-compatible color that Vega can use.

    Inputs must be a hex string, rgb()/rgba() string, or a color tuple. Inputs may not be a CSS
    color name, other CSS color function (like "hsl(...)"), etc.

    See tests for more info.
    """
    if is_css_color_like(color):
        return color

    if is_color_tuple_like(color):
        color = _normalize_tuple(color, _int_formatter, _float_formatter)
        if len(color) == 3:
            return f"rgb({color[0]}, {color[1]}, {color[2]})"
        else:
            return f"rgba({color[0]}, {color[1]}, {color[2]}, {color[3]})"

    raise InvalidColorException(color)


def is_css_color_like(color: MaybeColor) -> bool:
    """Check whether the input looks like something to_css_color() can produce.

    This is meant to be lightweight, and not a definitive answer. The definitive solution is to try
    to convert and see if an error is thrown.
    """
    return is_hex_color_like(color) or _is_cssrgb_color_like(color)


def is_hex_color_like(color: MaybeColor) -> bool:
    """Check whether the input looks like a hex color.

    NOTE: We only accept hex colors and color tuples as user input. So you should use
    is_hex_color_like and is_color_tuple_like whenever checking your inputs.

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

    NOTE: We only accept hex colors and color tuples as user input. So you should use
    is_hex_color_like and is_color_tuple_like whenever checking your inputs.

    This is meant to be lightweight, and not a definitive answer. The definitive solution is to try
    to convert and see if an error is thrown.
    """
    return isinstance(color, str) and (
        color.startswith("rgb(") or color.startswith("rgba(")
    )


def is_color_tuple_like(color: MaybeColor) -> bool:
    """Check whether the input looks like a tuple color.

    NOTE: We only accept hex colors and color tuples as user input. So you should use
    is_hex_color_like and is_color_tuple_like whenever checking your inputs.

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
    rgb_formatter: Callable[[float], float],
    alpha_formatter: Callable[[float], float],
):
    if is_css_color_like(color):
        hex_len = len(color)

        if hex_len == 4:
            r, g, b = color[1:4]
            r = 2 * r
            g = 2 * g
            b = 2 * b
            a = "ff"
        elif hex_len == 5:
            r, g, b, a = color[1:5]
            r = 2 * r
            g = 2 * g
            b = 2 * b
            a = 2 * a
        elif hex_len == 7:
            r = color[1:3]
            g = color[3:5]
            b = color[5:7]
            a = "ff"
        elif hex_len == 9:
            r = color[1:3]
            g = color[3:5]
            b = color[5:7]
            a = color[7:9]
        else:
            raise InvalidColorException(color)

        try:
            color = int(r, 16), int(g, 16), int(b, 16), int(a, 16)
        except:
            raise InvalidColorException(color)

    if is_color_tuple_like(color):
        return _normalize_tuple(color, rgb_formatter, alpha_formatter)

    raise InvalidColorException(color)


def _normalize_tuple(
    color: Tuple,
    rgb_formatter: Callable[[float], float],
    alpha_formatter: Callable[[float], float],
) -> ColorTuple:
    if 3 <= len(color) <= 4:
        rgb = [rgb_formatter(c, color) for c in color[:3]]
        if len(color) == 4:
            alpha = alpha_formatter(color[3], color)
            return [*rgb, alpha]
        return rgb

    raise InvalidColorException(color)


def _int_formatter(component: float, color: MaybeColor) -> int:
    if isinstance(component, float):
        component = int(component * 255)

    if isinstance(component, int):
        return min(255, max(component, 0))

    raise InvalidColorException(color)


def _float_formatter(component: float, color: MaybeColor) -> float:
    if isinstance(component, int):
        component = component / 255.0

    if isinstance(component, float):
        return min(1.0, max(component, 0.0))

    raise InvalidColorException(color)


class InvalidColorException(StreamlitAPIException):
    def __init__(self, color, *args):
        message = f"""This does not look like a valid color: {repr(color)}.

Colors must be in one of the following formats:

* Hex string with 3, 4, 6, or 8 digits. Example: `'#00ff00'`
* List or tuple with 3 or 4 components. Example: `[1.0, 0.5, 0, 0.2]`
            """
        super().__init__(message, *args)
