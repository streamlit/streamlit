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

"""JSON encodings for values that leave the app through the agent API.

Widget values and element props are arbitrary Python objects. This module pins
their JSON form. A list, tuple, or set becomes a JSON array, and so does any
other sequence except ``str``, ``bytes``, and mappings. Anything else,
including a dataframe or a mapping that is not a dict, becomes ``str(value)``,
so one odd cell does not fail the whole description. A value that contains
itself becomes text instead of recursing.
"""

from __future__ import annotations

import collections.abc
import datetime as dt
import decimal
import enum
import math
from typing import Any


def _is_pandas_missing(value: Any) -> bool:
    """True for the pandas missing scalars ``pd.NA`` and ``pd.NaT``."""
    type_name = type(value).__name__
    if type_name not in {"NAType", "NaTType"}:
        return False

    import pandas as pd

    return value is pd.NA or value is pd.NaT


def to_json_value(value: Any) -> Any:
    """Convert a Python value into its JSON representation.

    A list, tuple, or set becomes an array, as does any other sequence except
    ``str``, ``bytes``, and mappings. Anything else becomes ``str(value)``, so
    one odd cell does not fail the snapshot. A value that contains itself
    becomes text instead of recursing.
    """
    return _to_json_value(value, set())


def _to_json_value(value: Any, seen: set[int]) -> Any:
    """Encode ``value``, treating ``seen`` as the containers currently on the stack."""
    if value is None or isinstance(value, (str, bool, int)):
        return value

    if isinstance(value, float):
        # JSON has no NaN or Infinity. Report them as null rather than emitting
        # invalid JSON or a string a client would have to sniff for.
        return value if math.isfinite(value) else None

    if isinstance(value, bytes):
        # Report the length. Base64 would spend the reader's context on bytes
        # the author did not write as text.
        return {"bytes": len(value)}

    if isinstance(value, enum.Enum):
        return _to_json_value(value.value, seen)

    if isinstance(value, decimal.Decimal):
        # Strings, because a float round-trip loses the precision that made
        # someone choose Decimal. Non-finite values are null, same as float
        # NaN and infinity: JSON has no other form for them.
        if not value.is_finite():
            return None
        return str(value)

    # pd.NaT subclasses datetime, so this identity check has to run before
    # isoformat(). pd.NA is not a float and would otherwise become "<NA>".
    # Identity only: pd.isna on an array returns an array and the truth test
    # raises.
    if _is_pandas_missing(value):
        return None

    # ISO 8601, which is also what the public API accepts back.
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat()
    if isinstance(value, dt.timedelta):
        return value.total_seconds()

    if isinstance(value, dict):
        return _encode_items(
            value,
            seen,
            lambda: {
                str(key): _to_json_value(item, seen) for key, item in value.items()
            },
        )

    # numpy scalars and arrays. Before the sequence fallback: a matrix is a
    # sequence, and tolist() is the form the previous encoding used.
    # The source is marked first: tolist() may return the object itself, or a
    # structure that points back at it, and either one would recurse forever.
    if hasattr(value, "tolist"):
        marker = id(value)
        if marker in seen:
            return str(value)
        seen.add(marker)
        try:
            converted = value.tolist()
            if converted is value:
                return str(value)
            return _to_json_value(converted, seen)
        except Exception:
            return str(value)
        finally:
            seen.remove(marker)

    # Sets are not sequences. Lists and tuples are, and are included below.
    if isinstance(value, (set, frozenset)) or _is_described_sequence(value):
        return _encode_sequence(value, seen)

    return str(value)


def _is_described_sequence(value: Any) -> bool:
    """True when ``value`` is a sequence of items, not text, bytes, or a mapping.

    Other iterables, including a dataframe or an endless iterator, are left to
    ``str(value)``. Listing them would turn a dataframe into its column names
    or never return.
    """
    return (
        isinstance(value, collections.abc.Sequence)
        and not isinstance(value, (str, bytes))
        and not isinstance(value, collections.abc.Mapping)
    )


def _encode_sequence(value: Any, seen: set[int]) -> Any:
    """A sequence or set as an array, or ``str(value)`` when it cannot be listed."""
    marker = id(value)
    if marker in seen:
        return str(value)
    seen.add(marker)
    try:
        try:
            items = list(value)
        except Exception:
            return str(value)
        return [_to_json_value(item, seen) for item in items]
    finally:
        seen.remove(marker)


def _encode_items(
    value: Any,
    seen: set[int],
    encode: collections.abc.Callable[[], Any],
) -> Any:
    """Encode a container, or ``str(value)`` when it contains itself."""
    marker = id(value)
    if marker in seen:
        return str(value)
    seen.add(marker)
    try:
        return encode()
    finally:
        seen.remove(marker)
