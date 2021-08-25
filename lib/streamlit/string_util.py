# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import re
import textwrap

from datetime import datetime
from streamlit.errors import StreamlitAPIException


def decode_ascii(string):
    """Decodes a string as ascii."""
    return string.decode("ascii")


def clean_text(text):
    return textwrap.dedent(str(text)).strip()


def escape_markdown(raw_string):
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


def clean_filename(name):
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


def snake_case_to_camel_case(string):
    """DOCS HERE"""
    # [KAREN] TODO Write docsting and unit tests
    words = string.split("_")
    capitalized_arr = []

    for word in words:
        if word:
            try:
                capitalized_arr.append(word.title())
            except Exception:
                capitalized_arr.append(word)
    return "".join(capitalized_arr)


def append_date_time_to_string(string):
    """DOCS HERE"""
    # [KAREN] TODO Write docstring and unit tests
    now = datetime.now()

    if not string:
        return now.strftime("%Y-%m-%d_%H-%M-%S")
    else:
        return f'{string}_{now.strftime("%Y-%m-%d_%H-%M-%S")}'


def generate_download_filename_from_title(title_string):
    """DOCS HERE"""
    # [KAREN] TODO Write docstring and unit tests

    title_string = title_string.replace(" · Streamlit", "")
    file_name_string = clean_filename(title_string)
    title_string = snake_case_to_camel_case(file_name_string)
    return append_date_time_to_string(title_string)
