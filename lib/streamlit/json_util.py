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

"""Fast JSON serialization utilities using orjson when available.

This module provides a thin wrapper around orjson (when available) that
falls back to the standard library json module. It handles orjson's
differences (returns bytes, strict mode) transparently.

Usage:
    from streamlit.json_util import dumps, loads, JSONDecodeError

    # These work identically whether orjson is installed or not
    json_str = dumps({"key": "value"})  # Always returns str
    data = loads(json_str)  # Accepts str or bytes

    try:
        data = loads(invalid_json)
    except JSONDecodeError:
        # Handle error
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

# Try to import orjson for faster JSON operations. Falls back to json if not available.
_ORJSON_AVAILABLE: bool
orjson: Any  # Module or None, depending on availability
try:
    import orjson as _orjson

    orjson = _orjson
    _ORJSON_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dep
    _ORJSON_AVAILABLE = False
    orjson = None

# Export JSONDecodeError for use in exception handling.
# When orjson is available, both json.JSONDecodeError and orjson.JSONDecodeError
# should be caught. orjson.JSONDecodeError is a subclass of ValueError, not
# json.JSONDecodeError. For simplicity, we expose only json.JSONDecodeError
# since it covers the standard case, and the orjson case will be caught by the
# ValueError parent (which json.JSONDecodeError also inherits from).
JSONDecodeError = json.JSONDecodeError

if TYPE_CHECKING:
    from collections.abc import Callable


def dumps(
    obj: Any,
    *,
    default: Callable[[Any], Any] | None = None,
) -> str:
    """Serialize obj to a JSON string.

    Uses orjson when available for ~3-10x faster serialization,
    automatically falling back to standard json module.

    Parameters
    ----------
    obj
        The object to serialize to JSON.
    default
        A function called for objects that can't be serialized.
        It should return a JSON-serializable version of the object
        or raise a TypeError.

    Returns
    -------
    str
        The JSON string representation of obj.
    """
    if _ORJSON_AVAILABLE:
        # orjson.dumps returns bytes, we decode to str for compatibility
        # Use OPT_NON_STR_KEYS to handle integer keys like standard json
        try:
            return orjson.dumps(  # type: ignore[no-any-return]
                obj,
                default=default,
                option=orjson.OPT_NON_STR_KEYS,
            ).decode("utf-8")
        except TypeError:
            # If orjson fails (e.g., circular reference or unsupported type),
            # fall back to standard json which may have different error handling
            pass  # pragma: no cover - defensive fallback

    # Fall back to standard json
    return json.dumps(obj, default=default)


def loads(s: str | bytes) -> Any:
    """Deserialize a JSON string or bytes to a Python object.

    Uses orjson when available for ~2-3x faster deserialization,
    automatically falling back to standard json module.

    Parameters
    ----------
    s
        The JSON string or bytes to deserialize.

    Returns
    -------
    Any
        The deserialized Python object.
    """
    if _ORJSON_AVAILABLE:
        # orjson.loads accepts both str and bytes
        return orjson.loads(s)

    # Standard json.loads accepts both str and bytes in Python 3.6+
    return json.loads(s)


def is_orjson_available() -> bool:
    """Check if orjson is available.

    Returns
    -------
    bool
        True if orjson is installed and available.
    """
    return _ORJSON_AVAILABLE
