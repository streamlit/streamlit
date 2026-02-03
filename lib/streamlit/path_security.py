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

"""Shared path security utilities for preventing path traversal and SSRF attacks.

This module provides a centralized implementation for path validation that is
used by multiple parts of the codebase. Having a single implementation ensures
consistent security checks and avoids divergent behavior between components.

Security Context
----------------
These checks are designed to run BEFORE any filesystem operations (like
``os.path.realpath()``) to prevent Windows from triggering SMB connections
to attacker-controlled servers when resolving UNC paths. This prevents
SSRF attacks and NTLM hash disclosure.
"""

from __future__ import annotations

import os
import string


def is_unsafe_path_pattern(path: str) -> bool:
    r"""Return True if path contains UNC, absolute, drive, or traversal patterns.

    This function checks for dangerous path patterns that could lead to:
    - SSRF attacks via Windows UNC path resolution
    - NTLM hash disclosure via SMB connections
    - Path traversal outside intended directories
    - Path truncation via null bytes

    IMPORTANT: This check must run BEFORE any ``os.path.realpath()`` calls
    to prevent Windows from triggering SMB connections to attacker-controlled
    servers.

    Parameters
    ----------
    path : str
        The path string to validate.

    Returns
    -------
    bool
        True if the path contains unsafe patterns, False if it appears safe
        for further processing.

    Examples
    --------
    >>> is_unsafe_path_pattern("subdir/file.js")
    False
    >>> is_unsafe_path_pattern("\\\\server\\share")
    True
    >>> is_unsafe_path_pattern("../../../etc/passwd")
    True
    >>> is_unsafe_path_pattern("C:\\Windows\\system32")
    True
    """
    # Null bytes can be used for path truncation attacks
    if "\x00" in path:
        return True

    # UNC paths (Windows network shares, including \\?\ and \\.\ prefixes)
    if path.startswith(("\\\\", "//")):
        return True

    # Windows drive paths (e.g. C:\, D:foo) - on Windows, os.path.realpath() on a
    # drive path can trigger SMB connections if the drive is mapped to a network share.
    # This enables SSRF attacks and NTLM hash disclosure. We reject all drive-qualified
    # paths including drive-relative paths like "C:foo" which resolve against the current
    # directory of that drive. Checked on all platforms for defense-in-depth and
    # testability (CI runs on Linux).
    if len(path) >= 2 and path[0] in string.ascii_letters and path[1] == ":":
        return True

    # Rooted backslash or forward slash (absolute paths)
    if path.startswith(("\\", "/")):
        return True

    # Also check os.path.isabs for platform-specific absolute path detection
    if os.path.isabs(path):
        return True

    # Path traversal - check segments after normalizing separators
    normalized = path.replace("\\", "/")
    segments = [seg for seg in normalized.split("/") if seg]
    return ".." in segments
