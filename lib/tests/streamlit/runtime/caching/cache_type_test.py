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

"""Unit tests for streamlit.runtime.caching.cache_type."""

from __future__ import annotations

from typing import cast

import pytest

from streamlit.runtime.caching.cache_type import CacheType, get_decorator_api_name


@pytest.mark.parametrize(
    ("cache_type", "expected"),
    [
        (CacheType.DATA, "cache_data"),
        (CacheType.RESOURCE, "cache_resource"),
    ],
)
def test_get_decorator_api_name_returns_public_name(
    cache_type: CacheType, expected: str
) -> None:
    """Return the public decorator API name for each known cache type."""
    assert get_decorator_api_name(cache_type) == expected


def test_get_decorator_api_name_rejects_unknown_cache_type() -> None:
    """Raise RuntimeError for a value that is not a recognized CacheType."""
    with pytest.raises(RuntimeError, match="Unrecognized CacheType"):
        get_decorator_api_name(cast("CacheType", "not-a-cache-type"))
