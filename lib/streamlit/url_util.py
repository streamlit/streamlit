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

import re
from typing import Final, Literal, TypeAlias
from urllib.parse import urlparse

UrlSchema: TypeAlias = Literal["http", "https", "mailto", "data"]


# Regular expression for process_gitblob_url
_GITBLOB_RE: Final = re.compile(
    r"(?P<base>https:\/\/?(gist\.)?github.com\/)"
    r"(?P<account>([\w\.]+\/){1,2})"
    r"(?P<blob_or_raw>(blob|raw))?"
    r"(?P<suffix>(.+)?)"
)


def process_gitblob_url(url: str) -> str:
    """Check url to see if it describes a GitHub Gist "blob" URL.

    If so, returns a new URL to get the "raw" script.
    If not, returns URL unchanged.
    """
    # Matches github.com and gist.github.com.  Will not match githubusercontent.com.
    # See this regex with explainer and sample text here: https://regexr.com/4odk3
    match = _GITBLOB_RE.match(url)
    if match:
        mdict = match.groupdict()
        # If it has "blob" in the url, replace this with "raw" and we're done.
        if mdict["blob_or_raw"] == "blob":
            return "{base}{account}raw{suffix}".format(**mdict)

        # If it is a "raw" url already, return untouched.
        if mdict["blob_or_raw"] == "raw":
            return url

        # It's a gist. Just tack "raw" on the end.
        return url + "/raw"

    return url


def get_hostname(url: str) -> str | None:
    """Return the hostname of a URL (with or without protocol)."""
    # Just so urllib can parse the URL, make sure there's a protocol.
    # (The actual protocol doesn't matter to us)
    if "://" not in url:
        url = f"http://{url}"

    parsed = urlparse(url)
    return parsed.hostname


def is_url(
    url: str,
    allowed_schemas: tuple[UrlSchema, ...] = ("http", "https"),
) -> bool:
    """Check if a string looks like an URL.

    This doesn't check if the URL is actually valid or reachable.

    Parameters
    ----------
    url : str
        The URL to check.

    allowed_schemas : Tuple[str]
        The allowed URL schemas. Default is ("http", "https").
    """
    try:
        result = urlparse(str(url))
        if result.scheme not in allowed_schemas:
            return False

        if result.scheme in ["http", "https"]:
            return bool(result.netloc)
        if result.scheme in ["mailto", "data"]:
            return bool(result.path)

    except ValueError:
        return False
    return False


def make_url_path(base_url: str, path: str) -> str:
    """Make a URL from a base URL and a path.

    Parameters
    ----------
    base_url : str
        The base URL.
    path : str
        The path to append to the base URL.

    Returns
    -------
    str
        The resulting URL.
    """
    base_url = base_url.strip("/")
    if base_url:
        base_url = "/" + base_url

    path = path.lstrip("/")
    return f"{base_url}/{path}"
