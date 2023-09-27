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

import re
import textwrap
from typing import TYPE_CHECKING, Any, Optional, Tuple, cast

from streamlit.emojis import ALL_EMOJIS
from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    from streamlit.type_util import SupportsStr


# The ESCAPED_EMOJI list is sorted in descending order to make that longer emoji appear
# first in the regex compiled below. This ensures that we grab the full emoji in a
# multi-character emoji sequence that starts with a shorter emoji (emoji are weird...).
ESCAPED_EMOJI = [re.escape(e) for e in sorted(ALL_EMOJIS, reverse=True)]
EMOJI_EXTRACTION_REGEX = re.compile(f"^({'|'.join(ESCAPED_EMOJI)})[_ -]*(.*)")


def decode_ascii(string: bytes) -> str:
    """Decodes a string as ascii."""
    return string.decode("ascii")


def clean_text(text: "SupportsStr") -> str:
    """Convert an object to text, dedent it, and strip whitespace."""
    return textwrap.dedent(str(text)).strip()


def is_emoji(text: str) -> bool:
    """Check if input string is a valid emoji."""
    return text.replace("\U0000FE0F", "") in ALL_EMOJIS


def validate_emoji(maybe_emoji: Optional[str]) -> str:
    if maybe_emoji is None:
        return ""
    elif is_emoji(maybe_emoji):
        return maybe_emoji
    else:
        raise StreamlitAPIException(
            f'The value "{maybe_emoji}" is not a valid emoji. Shortcodes are not allowed, please use a single character instead.'
        )


def extract_leading_emoji(text: str) -> Tuple[str, str]:
    """Return a tuple containing the first emoji found in the given string and
    the rest of the string (minus an optional separator between the two).
    """
    re_match = re.search(EMOJI_EXTRACTION_REGEX, text)
    if re_match is None:
        return "", text

    # This cast to Any+type annotation weirdness is done because
    # cast(re.Match[str], ...) explodes at runtime since Python interprets it
    # as an attempt to index into re.Match instead of as a type annotation.
    re_match: re.Match[str] = cast(Any, re_match)
    return re_match.group(1), re_match.group(2)


def escape_markdown(raw_string: str) -> str:
    r"""Returns a new string which escapes all markdown metacharacters.

    Args
    ----
    raw_string : str
        A string, possibly with markdown metacharacters, e.g. "1 * 2"

    Returns
    -------
    A string with all metacharacters escaped.

    Examples
    --------
    ::
        escape_markdown("1 * 2") -> "1 \\* 2"
    """
    metacharacters = ["\\", "*", "-", "=", "`", "!", "#", "|"]
    result = raw_string
    for character in metacharacters:
        result = result.replace(character, "\\" + character)
    return result


TEXTCHARS = bytearray({7, 8, 9, 10, 12, 13, 27} | set(range(0x20, 0x100)) - {0x7F})


def is_binary_string(inp):
    """Guess if an input bytesarray can be encoded as a string."""
    # From https://stackoverflow.com/a/7392391
    return bool(inp.translate(None, TEXTCHARS))


def simplify_number(num: int) -> str:
    """Simplifies number into Human readable format, returns str"""
    num_converted = float("{:.2g}".format(num))
    magnitude = 0
    while abs(num_converted) >= 1000:
        magnitude += 1
        num_converted /= 1000.0
    return "{}{}".format(
        "{:f}".format(num_converted).rstrip("0").rstrip("."),
        ["", "k", "m", "b", "t"][magnitude],
    )


_OBJ_MEM_ADDRESS = re.compile(r"^\<[a-zA-Z_]+[a-zA-Z0-9<>._ ]* at 0x[0-9a-f]+\>$")


def is_mem_address_str(string):
    """Returns True if the string looks like <foo blarg at 0x15ee6f9a0>."""
    if _OBJ_MEM_ADDRESS.match(string):
        return True

    return False


_RE_CONTAINS_HTML = re.compile(r"(?:</[^<]+>)|(?:<[^<]+/>)")


def probably_contains_html_tags(s: str) -> bool:
    """Returns True if the given string contains what seem to be HTML tags.

    Note that false positives/negatives are possible, so this function should not be
    used in contexts where complete correctness is required."""
    return bool(_RE_CONTAINS_HTML.search(s))
