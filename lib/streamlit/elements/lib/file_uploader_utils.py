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

import os
from typing import TYPE_CHECKING, Literal

from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    from collections.abc import Sequence

# Category shortcuts that expand to MIME type wildcards
CATEGORY_SHORTCUTS = frozenset({"image", "audio", "video", "text"})

# Extension pairs that are automatically paired together (common aliases)
TYPE_PAIRS = [
    (".jpg", ".jpeg"),
    (".mpg", ".mpeg"),
    (".mp4", ".mpeg4"),
    (".tif", ".tiff"),
    (".htm", ".html"),
]


def _get_main_filename_and_extension(filename: str) -> tuple[str, str]:
    """Returns the main part of a filename and its extension."""
    # Handle NTFS Alternate Data Streams (ADS) on Windows, e.g: "file.txt:ads" -> ("file.txt", ".txt")
    if os.name == "nt" and ":" in filename:
        main_filename, ads_part = filename.split(":", 1)
        # We only treat it as an ADS if the part after the colon has an extension.
        if os.path.splitext(ads_part)[1]:
            return main_filename, os.path.splitext(main_filename)[1]

    return filename, os.path.splitext(filename)[1]


def classify_file_type(value: str) -> Literal["shortcut", "mime", "extension"]:
    """Classify a file type specifier as a shortcut, MIME type, or extension.

    - Category shortcut: "image", "audio", "video", "text"
    - MIME type/wildcard: Contains "/" (e.g., "image/jpeg", "image/*")
    - File extension: Everything else (e.g., ".jpg", "pdf")

    Leading and trailing whitespace is ignored, and classification is
    case-insensitive for shortcut detection.
    """
    normalized = value.strip().lower()
    if normalized in CATEGORY_SHORTCUTS:
        return "shortcut"
    if "/" in value:
        return "mime"
    return "extension"


def normalize_upload_file_type(file_type: str | Sequence[str]) -> Sequence[str]:
    """Normalize file type specifiers to a consistent format.

    Accepts:
    - Category shortcuts: "image", "audio", "video", "text" (expanded to "image/*", etc.)
    - MIME types: "image/jpeg", "application/pdf" (passed through, lowercased)
    - MIME wildcards: "image/*", "audio/*" (passed through, lowercased)
    - Extensions: ".jpg", "pdf" (normalized to ".jpg", ".pdf" with automatic pairing)

    Returns a list of normalized file type specifiers.
    """
    if isinstance(file_type, str):
        file_type = [file_type]

    # Separate types into categories
    extensions: list[str] = []
    mime_types: list[str] = []

    for raw_entry in file_type:
        # Strip whitespace and handle empty strings
        entry = raw_entry.strip()
        if not entry:
            continue

        kind = classify_file_type(entry)

        if kind == "shortcut":
            # Expand shortcuts to MIME wildcards (e.g., "image" -> "image/*")
            mime_types.append(f"{entry.lower()}/*")
        elif kind == "mime":
            # Pass through MIME types/wildcards (lowercased)
            mime_types.append(entry.lower())
        else:
            # Normalize extension: ensure leading dot and lowercase
            ext = entry.lower()
            if not ext.startswith("."):
                ext = f".{ext}"
            extensions.append(ext)

    # Apply automatic pairing for extensions
    for x, y in TYPE_PAIRS:
        if x in extensions and y not in extensions:
            extensions.append(y)
        if y in extensions and x not in extensions:
            extensions.append(x)

    # Combine: MIME types first, then extensions (order for consistent output)
    return mime_types + extensions


def enforce_filename_restriction(filename: str, allowed_types: Sequence[str]) -> None:
    """Ensure the uploaded file's extension matches the allowed types.

    When MIME types or shortcuts are used (containing "/"), backend validation is
    skipped entirely and we trust the browser's accept attribute filtering. This
    includes mixed cases where both MIME types and extensions are specified,
    because the backend cannot determine whether a file was intended to match
    a MIME pattern.

    When only explicit file extensions are specified (starting with "."), we
    validate them server-side. This should rarely trigger since we enforce
    file type checks on the frontend, but protects against bypass attempts.
    """

    # Ensure that there isn't a null byte in a filename
    # since this could be a workaround to bypass the file type check.
    if "\0" in filename:
        raise StreamlitAPIException("Filename cannot contain null bytes.")

    # Check if any MIME types are present (contain "/")
    has_mime_types = any("/" in t for t in allowed_types)

    # Filter to only extension types (those starting with ".") for server-side validation.
    extension_types = [t.lower() for t in allowed_types if t.startswith(".")]

    # Skip validation if any MIME types are present, since the backend cannot determine
    # whether a file was intended to match a MIME pattern vs an extension.
    # Also skip if no explicit extensions are specified (only MIME types).
    if has_mime_types or not extension_types:
        return

    main_filename, extension = _get_main_filename_and_extension(filename)
    normalized_filename = main_filename.lower()

    if not any(
        normalized_filename.endswith(allowed_type) for allowed_type in extension_types
    ):
        raise StreamlitAPIException(
            f"Invalid file extension: `{extension}`. Allowed: {extension_types}"
        )
