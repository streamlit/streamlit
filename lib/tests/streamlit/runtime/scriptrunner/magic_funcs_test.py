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

"""Tests for magic-rewritten write helpers."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

from streamlit.runtime.scriptrunner.magic_funcs import transparent_write


@pytest.mark.parametrize(
    ("args", "expected"),
    [
        ((42,), 42),
        (("a", "b"), ("a", "b")),
    ],
    ids=["single", "multiple"],
)
def test_transparent_write_returns_arguments(
    args: tuple[Any, ...], expected: Any
) -> None:
    """Arguments are written and then returned unchanged (or as a tuple)."""
    with patch("streamlit.write") as mock_write:
        assert transparent_write(*args) == expected
        mock_write.assert_called_once_with(*args)
