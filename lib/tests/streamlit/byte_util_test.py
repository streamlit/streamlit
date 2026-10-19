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

import numpy as np
import pytest

from streamlit.byte_util import _parse_byte_size, cache_data_max_size_to_bytes
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
        ("2 MB", 2 * 1024**2),
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


def test_private_parser_returns_only_byte_count() -> None:
    """The per-function parser does not expose unused parsing metadata."""
    assert _parse_byte_size("1.5KiB") == 1536


@pytest.mark.parametrize(
    ("value", "expected"),
    [(np.int64(1024), 1024), (np.uint64(2048), 2048)],
)
def test_cache_data_max_size_to_bytes_accepts_integral_types(
    value: object, expected: int
) -> None:
    """Non-bool Integral values are converted to built-in byte counts."""
    assert cache_data_max_size_to_bytes(value) == expected  # type: ignore[arg-type]


@pytest.mark.parametrize("value", [np.int64(0), np.int64(-1)])
def test_cache_data_max_size_to_bytes_rejects_nonpositive_integral_types(
    value: object,
) -> None:
    """Non-builtin Integral values still require a positive byte count."""
    with pytest.raises(StreamlitValueError, match="integer number of bytes"):
        cache_data_max_size_to_bytes(value)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "value",
    [True, False, 0, -1, 1.5, "", "1", "1XB", "-1MB", "0MB", ".0001B", "nanMB"],
)
def test_cache_data_max_size_to_bytes_rejects_invalid_values(value: object) -> None:
    """Malformed, nonpositive, and incorrectly typed values are rejected."""
    with pytest.raises(StreamlitAPIException):
        cache_data_max_size_to_bytes(value)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "value",
    [
        " 2MB",
        "2MB ",
        "2  MB",
        "2\tMB",
        "2\nMB",
        "2MB\n",
        "\uff12MB",
        "1K\u0131B",
        "1K\u0130B",
    ],
)
def test_cache_data_max_size_to_bytes_rejects_invalid_string_grammar(
    value: str,
) -> None:
    """Size strings use strict ASCII grammar with at most one literal space."""
    with pytest.raises(StreamlitValueError):
        cache_data_max_size_to_bytes(value)


@pytest.mark.parametrize("value", [True, False, 1.5])
def test_cache_data_max_size_to_bytes_uses_shared_type_error(value: object) -> None:
    """Incorrect value types use the shared parameter-type error."""
    with pytest.raises(StreamlitInvalidParameterTypeError):
        cache_data_max_size_to_bytes(value)  # type: ignore[arg-type]


def test_float_max_size_error_explains_how_to_repair_value() -> None:
    """Float errors recommend an integer byte count or unit string."""
    with pytest.raises(StreamlitInvalidParameterTypeError) as exc_info:
        cache_data_max_size_to_bytes(5e8)

    assert "int(5e8)" in str(exc_info.value)
    assert '"500MB"' in str(exc_info.value)


@pytest.mark.parametrize("value", [0, -1, "0MB", ".0001B"])
def test_cache_data_max_size_to_bytes_uses_shared_value_error(
    value: int | str,
) -> None:
    """Nonpositive byte counts use the shared parameter-value error."""
    with pytest.raises(StreamlitValueError, match="integer number of bytes"):
        cache_data_max_size_to_bytes(value)


def test_cache_data_max_size_to_bytes_ignores_decimal_context() -> None:
    """App decimal settings cannot round or reject a valid byte size."""
    with localcontext() as context:
        context.prec = 2
        context.traps[Inexact] = True
        assert cache_data_max_size_to_bytes("1.1MB") == 11 * 1024**2 // 10


def test_parser_rejects_long_numeric_tokens_with_streamlit_error() -> None:
    """Very long numbers raise Streamlit errors instead of Python's integer error."""
    value = f"{'1' * 5000}MB"

    with pytest.raises(StreamlitValueError, match="at most 100 digits"):
        cache_data_max_size_to_bytes(value)
