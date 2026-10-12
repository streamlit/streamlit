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

from decimal import Inexact, localcontext

import pytest

from streamlit.byte_util import (
    cache_data_max_size_to_bytes,
    config_max_cached_data_size_to_bytes,
)
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitInvalidParameterTypeError,
    StreamlitValueError,
)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (None, None),
        (1, 1),
        (1024, 1024),
        ("1B", 1),
        ("1kb", 1024),
        ("1KiB", 1024),
        (" 2 MB ", 2 * 1024**2),
        ("1.5GiB", 3 * 1024**3 // 2),
        ("1TB", 1024**4),
        (".5 kib", 512),
    ],
)
def test_cache_data_max_size_to_bytes(
    value: int | str | None, expected: int | None
) -> None:
    """Supported byte-size values convert to their binary byte count."""
    assert cache_data_max_size_to_bytes(value) == expected


@pytest.mark.parametrize(
    "value",
    [True, False, 0, -1, 1.5, "", "1", "1XB", "-1MB", "0MB", ".0001B", "nanMB"],
)
def test_cache_data_max_size_to_bytes_rejects_invalid_values(value: object) -> None:
    """Malformed, nonpositive, and incorrectly typed values are rejected."""
    with pytest.raises(StreamlitAPIException):
        cache_data_max_size_to_bytes(value)  # type: ignore[arg-type]


@pytest.mark.parametrize("value", [True, False, 1.5])
def test_cache_data_max_size_to_bytes_uses_shared_type_error(value: object) -> None:
    """Incorrect value types use the shared parameter-type error."""
    with pytest.raises(StreamlitInvalidParameterTypeError):
        cache_data_max_size_to_bytes(value)  # type: ignore[arg-type]


@pytest.mark.parametrize("value", [0, -1, "0MB", ".0001B"])
def test_cache_data_max_size_to_bytes_uses_shared_value_error(
    value: int | str,
) -> None:
    """Nonpositive byte counts use the shared parameter-value error."""
    with pytest.raises(StreamlitValueError):
        cache_data_max_size_to_bytes(value)


def test_cache_data_max_size_to_bytes_ignores_decimal_context() -> None:
    """App decimal settings cannot round or reject a valid byte size."""
    with localcontext() as context:
        context.prec = 2
        context.traps[Inexact] = True
        assert cache_data_max_size_to_bytes("1.1MB") == 11 * 1024**2 // 10


def test_parsers_reject_long_numeric_tokens_with_streamlit_errors() -> None:
    """Pathological digit counts cannot leak Python's native int error."""
    value = f"{'1' * 5000}MB"

    with pytest.raises(StreamlitValueError):
        cache_data_max_size_to_bytes(value)
    with pytest.raises(StreamlitAPIException, match="supported byte-size range"):
        config_max_cached_data_size_to_bytes(value)


@pytest.mark.parametrize("value", [0, "0"])
def test_config_parser_accepts_disable_sentinel(value: object) -> None:
    """The config parser accepts numeric and string disable sentinels."""
    assert config_max_cached_data_size_to_bytes(value) is None


def test_config_parser_uses_explicit_units() -> None:
    """The config parser requires binary unit strings for nonzero values."""
    assert config_max_cached_data_size_to_bytes("2gb") == 2 * 1024**3

    for value in (1, "1", True):
        with pytest.raises(StreamlitAPIException, match="explicit unit"):
            config_max_cached_data_size_to_bytes(value)

    with pytest.raises(StreamlitAPIException, match="without a unit"):
        config_max_cached_data_size_to_bytes("0MB")


def test_config_parser_rejects_sub_byte_values_accurately() -> None:
    """A unit-bearing value below one byte reports the actual constraint."""
    with pytest.raises(StreamlitAPIException, match="at least 1 byte"):
        config_max_cached_data_size_to_bytes("0.5b")
