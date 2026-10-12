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
from typing import Final

from streamlit.errors import (
    StreamlitAPIException,
    StreamlitInvalidParameterTypeError,
    StreamlitValueError,
)

_BYTE_SIZE_RE: Final = re.compile(
    r"^\s*(?P<value>(?:\d+(?:\.\d*)?|\.\d+))\s*"
    r"(?P<unit>b|(?:k|ki)b|(?:m|mi)b|(?:g|gi)b|(?:t|ti)b)\s*$",
    re.IGNORECASE,
)
_MULTIPLIERS: Final = {
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
_CONFIG_MAX_CACHED_DATA_SIZE_ERROR: Final = (
    "`server.maxCachedDataSize` requires an explicit unit string, such as "
    '"2gb" or "500mb". Use "0" to disable the global cache budget.'
)
_CONFIG_MAX_CACHED_DATA_SIZE_ZERO_ERROR: Final = (
    '`server.maxCachedDataSize` must be positive. Use "0" without a unit to '
    "disable the global cache budget."
)
_CONFIG_MAX_CACHED_DATA_SIZE_MINIMUM_ERROR: Final = (
    "`server.maxCachedDataSize` must be at least 1 byte."
)


def cache_data_max_size_to_bytes(value: int | str | None) -> int | None:
    """Convert an ``st.cache_data`` max-size value to bytes.

    Integers are interpreted as bytes. Strings require an explicit binary unit
    (for example, ``"500MB"`` or ``"1.5GiB"``).
    """
    if value is None:
        return None

    if isinstance(value, bool):
        raise StreamlitInvalidParameterTypeError(
            "max_size", type(value).__name__, ["int", "str"]
        )

    if isinstance(value, int):
        size = value
    elif isinstance(value, str):
        match = _BYTE_SIZE_RE.fullmatch(value)
        if match is None:
            raise StreamlitValueError(
                "max_size",
                ["a positive byte size"],
                detail=(
                    "Use a positive value with an explicit unit, such as "
                    '"500MB", "1.5GB", or "200KiB".'
                ),
            )
        value_text = match.group("value")
        whole, _, fraction = value_text.partition(".")
        digits = f"{whole or '0'}{fraction}"
        denominator = 10 ** len(fraction)
        size = int(digits) * _MULTIPLIERS[match.group("unit").lower()] // denominator
    else:
        raise StreamlitInvalidParameterTypeError(
            "max_size", type(value).__name__, ["int", "str"]
        )

    if size <= 0:
        raise StreamlitValueError("max_size", ["a positive byte size"])
    return size


def config_max_cached_data_size_to_bytes(value: object) -> int | None:
    """Parse ``server.maxCachedDataSize`` and return ``None`` when disabled."""
    if (
        isinstance(value, int) and not isinstance(value, bool) and value == 0
    ) or value == "0":
        return None
    if not isinstance(value, str):
        raise StreamlitAPIException(
            _CONFIG_MAX_CACHED_DATA_SIZE_ERROR,
            error_id="config-max-cached-data-size-invalid",
        )
    match = _BYTE_SIZE_RE.fullmatch(value)
    if match is None:
        raise StreamlitAPIException(
            _CONFIG_MAX_CACHED_DATA_SIZE_ERROR,
            error_id="config-max-cached-data-size-invalid",
        )
    # Reject an explicit zero with a unit ("0gb"); only a bare "0" disables.
    if int(match.group("value").replace(".", "")) == 0:
        raise StreamlitAPIException(
            _CONFIG_MAX_CACHED_DATA_SIZE_ZERO_ERROR,
            error_id="config-max-cached-data-size-invalid",
        )
    try:
        return cache_data_max_size_to_bytes(value)
    except StreamlitValueError as exc:
        raise StreamlitAPIException(
            _CONFIG_MAX_CACHED_DATA_SIZE_MINIMUM_ERROR,
            error_id="config-max-cached-data-size-invalid",
        ) from exc
