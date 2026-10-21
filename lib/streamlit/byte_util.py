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

"""Utilities for parsing byte-size values."""

from __future__ import annotations

import re
from numbers import Integral
from typing import Final

from streamlit.errors import StreamlitInvalidParameterTypeError, StreamlitValueError

_BYTE_SIZE_RE: Final[re.Pattern[str]] = re.compile(
    r"(?P<value>(?:\d+(?:\.\d*)?|\.\d+)) ?"
    r"(?P<unit>b|(?:k|ki)b|(?:m|mi)b|(?:g|gi)b|(?:t|ti)b)",
    re.ASCII | re.IGNORECASE,
)
_MULTIPLIERS: Final[dict[str, int]] = {
    "b": 1,
    "kb": 1024,
    "kib": 1024,
    "mb": 1024**2,
    "mib": 1024**2,
    "gb": 1024**3,
    "gib": 1024**3,
    "tb": 1024**4,
    "tib": 1024**4,
}
# Prevent unbounded integer-conversion work from pathological size strings.
_MAX_BYTE_SIZE_DIGITS: Final = 100
_MAX_SIZE_DETAIL: Final = (
    "Use an integer number of bytes or a positive value with an explicit unit, "
    'such as "500MB", "1.5GB", or "200KiB".'
)
_MAX_SIZE_TYPE_DETAIL: Final = (
    'Pass an integer byte count such as int(5e8), or a unit string such as "500MB".'
)


class _InvalidByteSizeError(ValueError):
    pass


class _ByteSizeTooLongError(ValueError):
    pass


def _parse_byte_size(value: str) -> int:
    """Parse a unit-bearing size and return its whole-byte count."""
    match = _BYTE_SIZE_RE.fullmatch(value)
    if match is None:
        raise _InvalidByteSizeError
    value_text: str = match.group("value")
    unit: str = match.group("unit")
    whole, _, fraction = value_text.partition(".")
    digits = f"{whole or '0'}{fraction}"
    if len(digits) > _MAX_BYTE_SIZE_DIGITS:
        raise _ByteSizeTooLongError
    denominator = 10 ** len(fraction)
    size: int = int(digits) * _MULTIPLIERS[unit.lower()] // denominator
    return size


def cache_data_max_size_to_bytes(value: int | Integral | str | None) -> int | None:
    """Convert an ``st.cache_data`` max-size value to a positive byte count.

    Integers represent byte counts directly. Strings require an explicit binary
    unit, such as ``"500MB"`` or ``"1.5GiB"``. Units are powers of 1024, and
    fractional values are rounded down to whole bytes.
    """
    if value is None:
        return None

    if isinstance(value, bool):
        raise StreamlitInvalidParameterTypeError(
            "max_size",
            type(value).__name__,
            ["int", "str"],
            detail=_MAX_SIZE_TYPE_DETAIL,
        )

    if isinstance(value, int):
        size = value
    elif isinstance(value, Integral):
        size = int(value)
    elif isinstance(value, str):
        try:
            size = _parse_byte_size(value)
        except _InvalidByteSizeError:
            raise StreamlitValueError(
                "max_size",
                ["a positive byte size"],
                detail=_MAX_SIZE_DETAIL,
            ) from None
        except _ByteSizeTooLongError:
            raise StreamlitValueError(
                "max_size",
                ["a positive byte size"],
                detail=(
                    f"Use a byte size with at most {_MAX_BYTE_SIZE_DIGITS} digits."
                ),
            ) from None
    else:
        raise StreamlitInvalidParameterTypeError(
            "max_size",
            type(value).__name__,
            ["int", "str"],
            detail=_MAX_SIZE_TYPE_DETAIL,
        )

    if size <= 0:
        raise StreamlitValueError(
            "max_size", ["a positive byte size"], detail=_MAX_SIZE_DETAIL
        )
    return size
