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


"""Utilities for safely resolving component asset paths and content types.

These helpers are used by server handlers to construct safe absolute paths for
component files and to determine the appropriate ``Content-Type`` header for
responses. Path resolution prevents directory traversal by normalizing and
checking real paths against a component's root directory.
"""

from __future__ import annotations

import mimetypes
import os
from typing import Final

_OCTET_STREAM: Final[str] = "application/octet-stream"


def build_safe_abspath(component_root: str, relative_url_path: str) -> str | None:
    """Build an absolute path inside ``component_root`` if safe.

    The function joins ``relative_url_path`` with ``component_root`` and
    normalizes and resolves symlinks. If the resulting path escapes the
    component root, ``None`` is returned to indicate a forbidden traversal.

    Parameters
    ----------
    component_root : str
        Absolute path to the component's root directory.
    relative_url_path : str
        Relative URL path from the component root to the requested file.

    Returns
    -------
    str or None
        The resolved absolute path if it stays within ``component_root``;
        otherwise ``None`` when the path would traverse outside the root.
    """
    root_real = os.path.realpath(component_root)
    candidate = os.path.normpath(os.path.join(root_real, relative_url_path))
    candidate_real = os.path.realpath(candidate)

    try:
        # Ensure the candidate stays within the real component root
        if os.path.commonpath([root_real, candidate_real]) != root_real:
            return None
    except ValueError:
        # On some platforms, commonpath can raise if drives differ; treat as forbidden.
        return None

    return candidate_real


def guess_content_type(abspath: str) -> str:
    """Guess the HTTP ``Content-Type`` for a file path.

    This logic mirrors Tornado's ``StaticFileHandler`` by respecting encoding
    metadata from ``mimetypes.guess_type`` and falling back to
    ``application/octet-stream`` when no specific type can be determined.

    Parameters
    ----------
    abspath : str
        Absolute file path used for type detection (only the suffix matters).

    Returns
    -------
    str
        Guessed content type string suitable for the ``Content-Type`` header.
    """
    mime_type, encoding = mimetypes.guess_type(abspath)
    # per RFC 6713, use the appropriate type for a gzip compressed file
    if encoding == "gzip":
        return "application/gzip"
    # As of 2015-07-21 there is no bzip2 encoding defined at
    # http://www.iana.org/assignments/media-types/media-types.xhtml
    # So for that (and any other encoding), use octet-stream.
    if encoding is not None:
        return _OCTET_STREAM
    if mime_type is not None:
        return mime_type
    # if mime_type not detected, use application/octet-stream
    return _OCTET_STREAM
