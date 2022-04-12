# Copyright 2018-2022 Streamlit Inc.
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
from pathlib import Path
from typing import Any, cast, Dict, List, Tuple


def open_python_file(filename):
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
    else:
        return open(filename, "r", encoding="utf-8")


PAGE_FILENAME_REGEX = re.compile(r"([0-9]*)[_ -]*(.*)\.py")
# Regex pattern to extract emoji taken from https://gist.github.com/Alex-Just/e86110836f3f93fe7932290526529cd1#gistcomment-3208085
# We may eventually want to swap this out for https://pypi.org/project/emoji,
# but I want to avoid adding a dependency if possible.
PAGE_ICON_REGEX = re.compile(
    "(^[\U0001F1E0-\U0001F1FF"
    "\U0001F300-\U0001F5FF"
    "\U0001F600-\U0001F64F"
    "\U0001F680-\U0001F6FF"
    "\U0001F700-\U0001F77F"
    "\U0001F780-\U0001F7FF"
    "\U0001F800-\U0001F8FF"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FA6F"
    "\U0001FA70-\U0001FAFF"
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251])[_-]*"
)


def page_sort_key(script_path: Path) -> Tuple[float, str]:
    matches = re.findall(PAGE_FILENAME_REGEX, script_path.name)

    # Failing this assert should only be possible if script_path isn't a Python
    # file, which should never happen.
    assert len(matches) > 0, f"{script_path} is not a Python file"

    [(number, label)] = matches

    if number == "":
        return (float("inf"), label)

    return (float(number), label)


def page_name_and_icon(script_path: Path) -> Tuple[str, str]:
    """Compute the name of a page from its script path.

    This is *almost* the page name displayed in the nav UI, but it has
    underscores instead of spaces. The reason we do this is because having
    spaces in URLs both looks bad and is hard to deal with due to the need to
    URL-encode them. To solve this, we only swap the underscores for spaces
    right before we render page names.
    """
    extraction = re.search(PAGE_FILENAME_REGEX, script_path.name)
    if extraction is None:
        return "", ""

    # This cast to Any+type annotation weirdness is done because
    # cast(re.Match[str], ...) explodes at runtime since Python interprets it
    # as an attempt to index into re.Match instead of as a type annotation.
    extraction: re.Match[str] = cast(Any, extraction)

    name = re.sub(r"[_ ]+", "_", extraction.group(2)).strip()
    if not name:
        name = extraction.group(1)

    extracted_icon = re.search(PAGE_ICON_REGEX, name)
    if extracted_icon is not None:
        icon = str(extracted_icon.group(1))
        name = re.sub(PAGE_ICON_REGEX, "", name)
    else:
        icon = ""

    return str(name), icon


# TODO(vdonato): Eventually, have this function cache its return value and
# avoid re-scanning the file system unless a page has been added/removed.
def get_pages(main_script_path: str) -> List[Dict[str, str]]:
    main_script_path = Path(main_script_path)
    main_page_name, main_page_icon = page_name_and_icon(main_script_path)

    used_page_names = {main_page_name}
    pages = [
        {
            "page_name": main_page_name,
            "icon": main_page_icon,
            "script_path": str(main_script_path),
        }
    ]

    pages_dir = main_script_path.parent / "pages"
    page_scripts = sorted(pages_dir.glob("*.py"), key=page_sort_key)

    for script_path in page_scripts:
        pn, pi = page_name_and_icon(script_path)
        if pn in used_page_names:
            continue

        used_page_names.add(pn)
        pages.append({"page_name": pn, "icon": pi, "script_path": str(script_path)})

    return pages
