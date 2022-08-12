import re
import textwrap
from typing import Any, cast, Tuple, TYPE_CHECKING

from datetime import datetime
from streamlit.errors import StreamlitAPIException
from streamlit.emojis import ALL_EMOJIS

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
    return text in ALL_EMOJIS


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
    """Returns a new string which escapes all markdown metacharacters.

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


def clean_filename(name: str) -> str:
    """
    Taken from https://github.com/django/django/blob/196a99da5d9c4c33a78259a58d38fb114a4d2ee8/django/utils/text.py#L225-L238

    Return the given string converted to a string that can be used for a clean
    filename. Remove leading and trailing spaces; convert other spaces to
    underscores; and remove anything that is not an alphanumeric, dash,
    underscore, or dot.
    """
    s = str(name).strip().replace(" ", "_")
    s = re.sub(r"(?u)[^-\w.]", "", s)

    if s in {"", ".", ".."}:
        raise StreamlitAPIException("Could not derive file name from '%s'" % name)
    return s


def snake_case_to_camel_case(snake_case_string: str) -> str:
    """Transform input string from snake_case to CamelCase."""
    words = snake_case_string.split("_")
    capitalized_words_arr = []

    for word in words:
        if word:
            try:
                capitalized_words_arr.append(word.title())
            except Exception:
                capitalized_words_arr.append(word)
    return "".join(capitalized_words_arr)


def append_date_time_to_string(input_string: str) -> str:
    """Append datetime string to input string.
    Returns datetime string if input is empty string.
    """
    now = datetime.now()

    if not input_string:
        return now.strftime("%Y-%m-%d_%H-%M-%S")
    else:
        return f'{input_string}_{now.strftime("%Y-%m-%d_%H-%M-%S")}'


def generate_download_filename_from_title(title_string: str) -> str:
    """Generated download filename from page title string."""

    title_string = title_string.replace(" · Streamlit", "")
    file_name_string = clean_filename(title_string)
    title_string = snake_case_to_camel_case(file_name_string)
    return append_date_time_to_string(title_string)
