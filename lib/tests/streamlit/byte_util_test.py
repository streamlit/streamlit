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

import pytest

from streamlit.byte_util import config_max_cached_data_size_to_bytes, to_bytes
from streamlit.errors import StreamlitAPIException


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
def test_to_bytes(value: int | str | None, expected: int | None) -> None:
    assert to_bytes(value) == expected


@pytest.mark.parametrize(
    "value",
    [True, False, 0, -1, 1.5, "", "1", "1XB", "-1MB", "0MB", ".0001B", "nanMB"],
)
def test_to_bytes_rejects_invalid_values(value: object) -> None:
    with pytest.raises(StreamlitAPIException):
        to_bytes(value)  # type: ignore[arg-type]


@pytest.mark.parametrize("value", [0, "0"])
def test_config_parser_accepts_disable_sentinel(value: object) -> None:
    assert config_max_cached_data_size_to_bytes(value) is None


def test_config_parser_uses_explicit_units() -> None:
    assert config_max_cached_data_size_to_bytes("2gb") == 2 * 1024**3

    for value in (1, "1", True, "0MB"):
        with pytest.raises(StreamlitAPIException, match="explicit unit"):
            config_max_cached_data_size_to_bytes(value)
