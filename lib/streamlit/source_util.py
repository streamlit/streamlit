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

import re
from typing import TYPE_CHECKING, TextIO, TypeAlias, TypedDict

from typing_extensions import NotRequired

from streamlit.string_util import extract_leading_emoji

if TYPE_CHECKING:
    from pathlib import Path

PageHash: TypeAlias = str
PageName: TypeAlias = str
ScriptPath: TypeAlias = str
Icon: TypeAlias = str


class PageInfo(TypedDict):
    script_path: ScriptPath
    page_script_hash: PageHash
    icon: NotRequired[Icon]
    page_name: NotRequired[PageName]
    url_pathname: NotRequired[str]


def open_python_file(filename: str) -> TextIO:
    """Open a read-only Python file taking proper care of its encoding.

    In Python 3, we would like all files to be opened with utf-8 encoding.
    However, some author like to specify PEP263 headers in their source files
    with their own encodings. In that case, we should respect the author's
    encoding.
    """
    import tokenize

    if hasattr(tokenize, "open"):  # Added in Python 3.2
        # Open file respecting PEP263 encoding. If no encoding header is
        # found, opens as utf-8.
        return tokenize.open(filename)
    return open(filename, encoding="utf-8")


PAGE_FILENAME_REGEX = re.compile(r"([0-9]*)[_ -]*(.*)\.py")


def page_sort_key(script_path: Path) -> tuple[float, str]:
    matches = re.findall(PAGE_FILENAME_REGEX, script_path.name)

    # Failing this should only be possible if script_path isn't a Python
    # file, which should never happen.
    if len(matches) == 0:
        raise ValueError(
            f"{script_path} is not a Python file. This should never happen."
        )

    [(number, label)] = matches
    label = label.lower()

    if number == "":
        return (float("inf"), label)

    return (float(number), label)


def page_icon_and_name(script_path: Path) -> tuple[str, str]:
    """Compute the icon and name of a page from its script path.

    This is *almost* the page name displayed in the nav UI, but it has
    underscores instead of spaces. The reason we do this is because having
    spaces in URLs both looks bad and is hard to deal with due to the need to
    URL-encode them. To solve this, we only swap the underscores for spaces
    right before we render page names.
    """
    extraction: re.Match[str] | None = re.search(PAGE_FILENAME_REGEX, script_path.name)
    if extraction is None:
        return "", ""

    icon_and_name = re.sub(
        r"[_ ]+", "_", extraction.group(2)
    ).strip() or extraction.group(1)

    return extract_leading_emoji(icon_and_name)
