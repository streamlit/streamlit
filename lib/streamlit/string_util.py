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

import decimal
import fractions
import numbers
import re
import textwrap
from typing import TYPE_CHECKING, Any, Final, NoReturn, TypeAlias, Union, cast

from streamlit.errors import StreamlitAPIException, StreamlitInvalidParameterTypeError

if TYPE_CHECKING:
    from collections.abc import Callable

    import numpy as np

    from streamlit.type_util import SupportsStr

# Matches GitHub-style shortcodes (:rocket:, :+1:) so we can reject them.
# Anchors are omitted; callers use ``fullmatch``.
_EMOJI_SHORTCODE_RE: Final = re.compile(r":[a-zA-Z0-9_+-]+:")
# Zero-width space keeps Markdown from rewriting the slash in this example.
_ICON_FORMAT_HINT: Final = (
    "Please use a single emoji or a Material icon shortcode "
    "like `:material\u200b/thumb_up:`."
)


def clean_text(text: SupportsStr) -> str:
    """Convert an object to text, dedent it, and strip whitespace."""
    return textwrap.dedent(str(text)).strip()


def to_str(value: object) -> str:
    """Coerce ``value`` to ``str`` for protobuf string fields.

    Existing strings are returned unchanged so we do not allocate a copy.
    """
    return value if isinstance(value, str) else str(value)


def to_help_str(help: object) -> str:
    """Coerce ``help`` to ``str`` and dedent it for protobuf assignment."""
    return textwrap.dedent(to_str(help))


def is_emoji(text: str) -> bool:
    """Check if input string is a valid emoji."""
    # ASCII cannot contain emoji, so skip loading the catalog.
    if not text or text.isascii():
        return False

    from streamlit.emojis import ALL_EMOJIS

    # Only the variation selector is normalized; ZWJ, skin-tone, and
    # regional-indicator code points are part of valid sequences and must
    # be preserved.
    return text.replace("\U0000fe0f", "") in ALL_EMOJIS


def is_material_icon(maybe_icon: str) -> bool:
    """Check if input string is a valid Material icon."""
    from streamlit.material_icon_names import ALL_MATERIAL_ICONS

    return maybe_icon in ALL_MATERIAL_ICONS


def _raise_invalid_image(icon: str) -> NoReturn:
    shown = icon if len(icon) <= 60 else f"{icon[:60]}…"
    raise StreamlitAPIException(
        f'The value "{shown}" looks like a URL. Images are not supported '
        f"for `icon`. {_ICON_FORMAT_HINT} To follow support for image icons, "
        "see https://github.com/streamlit/streamlit/issues/9770.",
        error_id="invalid-image",
    )


def _looks_like_url(icon: str) -> bool:
    """True for ``scheme://``, ``data:``, or scheme-relative ``//`` values."""
    return "://" in icon or icon[:5].lower() == "data:" or icon.startswith("//")


def validate_icon_or_emoji(icon: str | None) -> str:
    """Validate an icon or emoji and return it in normalized form if valid.

    ``None`` and whitespace-only strings mean no icon. URL-shaped values
    raise ``StreamlitAPIException`` with ``error_id="invalid-image"``
    without fetching.
    """
    if icon is None:
        return ""
    if not isinstance(icon, str):
        raise StreamlitInvalidParameterTypeError(
            "icon",
            type(icon).__name__,
            ["str", "None"],
        )

    icon = icon.strip()
    if not icon:
        return ""

    # "spinner" is a built-in icon name, not an emoji or Material shortcode.
    if icon == "spinner":
        return "spinner"

    # Only values starting with ":" can be Material or emoji shortcodes.
    if icon.startswith(":"):
        # Prefer Material so unknown names raise invalid-material-icon, not
        # invalid-emoji.
        if icon.lower().startswith(":material"):
            return validate_material_icon(icon)

        if _EMOJI_SHORTCODE_RE.fullmatch(icon):
            raise StreamlitAPIException(
                f'The value "{icon}" is not a valid icon. Emoji shortcodes are '
                f"not supported. {_ICON_FORMAT_HINT}",
                error_id="invalid-emoji-shortcode",
            )

    if _looks_like_url(icon):
        _raise_invalid_image(icon)

    # Remaining ASCII cannot be emoji; fail without loading the catalog.
    if icon.isascii():
        raise StreamlitAPIException(
            f'The value "{icon}" is not a valid icon. {_ICON_FORMAT_HINT}',
            error_id="invalid-icon",
        )

    return validate_emoji(icon)


def validate_emoji(maybe_emoji: str | None) -> str:
    if maybe_emoji is None:
        return ""

    if is_emoji(maybe_emoji):
        return maybe_emoji
    raise StreamlitAPIException(
        f'The value "{maybe_emoji}" is not a valid emoji. Please use a single emoji.',
        error_id="invalid-emoji",
    )


def validate_material_icon(maybe_material_icon: str | None) -> str:
    """Validate a Material icon shortcode and return the icon in
    normalized format if valid.
    """

    supported_icon_packs = [
        "material",
    ]

    if maybe_material_icon is None:
        return ""

    icon_regex = r"^\s*:(.+)\/(.+):\s*$"
    icon_match = re.match(icon_regex, maybe_material_icon)
    # Since our markdown processing needs to change the `/` to `_` in order to
    # correctly render the icon, we need to add a zero-width space before the
    # `/` to avoid this transformation here.
    invisible_white_space = "\u200b"

    if not icon_match:
        raise StreamlitAPIException(
            f'The value `"{maybe_material_icon.replace("/", invisible_white_space + "/")}"` is '
            "not a valid Material icon. Please use a Material icon shortcode like "
            f"**`:material{invisible_white_space}/thumb_up:`**",
            error_id="invalid-material-icon",
        )

    pack_name, icon_name = icon_match.groups()

    if (
        pack_name not in supported_icon_packs
        or not icon_name
        or not is_material_icon(icon_name)
    ):
        raise StreamlitAPIException(
            f'The value `"{maybe_material_icon.replace("/", invisible_white_space + "/")}"` is not a '
            "valid Material icon. Please use a Material icon shortcode like "
            f"**`:material{invisible_white_space}/thumb_up:`**.",
            error_id="invalid-material-icon",
        )

    return f":{pack_name}/{icon_name}:"


def extract_leading_emoji(text: str) -> tuple[str, str]:
    """Return a tuple containing the first emoji found in the given string and
    the rest of the string (minus an optional separator between the two).
    """

    if not text or text.isascii():
        # ASCII strings cannot contain emoji, so skip loading the catalog.
        return "", text

    from streamlit.emojis import EMOJI_EXTRACTION_REGEX

    re_match = re.search(EMOJI_EXTRACTION_REGEX, text)
    if re_match is None:
        return "", text

    return re_match.group(1), re_match.group(2)


def extract_leading_icon(text: str) -> tuple[str, str]:
    """Extract a leading emoji or material icon from text.

    Returns a tuple of (icon, remaining_text) where icon is either an emoji,
    a validated material icon string (e.g., ":material/thumb_up:"), or an
    empty string if no icon was found. The remaining_text has the icon and
    any separator whitespace removed.

    This function is used to auto-detect icons at the start of text content,
    allowing users to include an icon inline rather than via a separate parameter.

    Examples
    --------
    >>> extract_leading_icon("🚨 Error occurred")
    ('🚨', 'Error occurred')
    >>> extract_leading_icon(":material/warning: Caution")
    (':material/warning:', 'Caution')
    >>> extract_leading_icon("No icon here")
    ('', 'No icon here')
    """
    if not text:
        return "", text

    # First, check for material icon at the start
    if text.startswith(":material"):
        # Find the closing colon
        # Material icon format: :material/icon_name:
        match = re.match(r"^(:[^:]+:)\s*(.*)", text, re.DOTALL)
        if match:
            maybe_icon = match.group(1)
            try:
                validated_icon = validate_material_icon(maybe_icon)
                return validated_icon, match.group(2)
            except StreamlitAPIException:
                # Not a valid material icon, continue to check for emoji
                pass

    # Check for leading emoji
    return extract_leading_emoji(text)


def max_char_sequence(string: str, char: str) -> int:
    """Returns the count of the max sequence of a given char in a string."""
    max_sequence = 0
    current_sequence = 0
    for c in string:
        if c == char:
            current_sequence += 1
            max_sequence = max(max_sequence, current_sequence)
        else:
            current_sequence = 0

    return max_sequence


TEXTCHARS: Final = bytearray(
    {7, 8, 9, 10, 12, 13, 27} | set(range(0x20, 0x100)) - {0x7F}
)


def is_binary_string(inp: bytes) -> bool:
    """Guess if an input bytesarray can be encoded as a string."""
    # From https://stackoverflow.com/a/7392391
    return bool(inp.translate(None, TEXTCHARS))


def simplify_number(num: int) -> str:
    """Simplifies number into Human readable format, returns str."""
    num_converted = float(f"{num:.2g}")
    magnitude = 0
    suffixes = ["", "k", "m", "b", "t"]
    # Stop at the largest available suffix so numbers beyond a trillion stay in
    # trillions (e.g. "1000t") rather than raising an IndexError.
    while abs(num_converted) >= 1000 and magnitude < len(suffixes) - 1:
        magnitude += 1
        num_converted /= 1000.0
    return "{}{}".format(
        f"{num_converted:f}".rstrip("0").rstrip("."),
        suffixes[magnitude],
    )


# Match both hex casings: CPython formats the address with the platform C
# runtime's "%p" (glibc lowercase, MSVC uppercase). Use a character class
# rather than re.IGNORECASE so " AT 0X" still fails to match.
_OBJ_MEM_ADDRESS: Final = re.compile(
    r"^\<[a-zA-Z_]+[a-zA-Z0-9<>._ ]* at 0x[0-9a-fA-F]+\>$"
)


def is_mem_address_str(string: str) -> bool:
    """Returns True if the string looks like <foo blarg at 0x15ee6f9a0>."""
    return bool(_OBJ_MEM_ADDRESS.match(string))


def to_snake_case(camel_case_str: str) -> str:
    """Converts UpperCamelCase and lowerCamelCase to snake_case.

    Examples
    --------
        fooBar -> foo_bar
        BazBang -> baz_bang

    """
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", camel_case_str)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


AnyNumber: TypeAlias = Union[
    "np.integer[Any]",
    "np.floating[Any]",
    int,
    float,
    decimal.Decimal,
    fractions.Fraction,
    numbers.Real,
    numbers.Number,
]


def from_number(value: AnyNumber) -> str:
    """Render a real numeric type as a string for display.

    Parameters
    ----------
    value : AnyNumber
        The numeric value to convert to a string. Can be an ``int``, ``float``,
        any ``numbers.Number`` (e.g., ``decimal.Decimal``), or a NumPy numeric type
        with an ``item()`` method.

    Returns
    -------
    str
        String representation of the numeric value.

    Raises
    ------
    TypeError
        If the value is not of an accepted numeric type.
    """
    if isinstance(value, numbers.Number):
        return str(value)
    if hasattr(value, "item"):
        # Add support for numpy values (e.g. int16, float64, etc.)
        try:
            # Item could also be just a variable, so we use try, except
            item_value = cast("Callable[[], Any]", value.item)()
            if isinstance(item_value, (float, int)):
                return str(item_value)
        except Exception:  # noqa: S110
            # If the numpy item is not a valid value, the TypeError below will be raised.
            pass

    raise TypeError(
        f"'{value}' is of type {type(value)}, which is not an accepted type. "
        "Please convert the value to an accepted number type."
    )
