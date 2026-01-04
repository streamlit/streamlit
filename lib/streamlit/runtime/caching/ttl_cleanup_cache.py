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

"""LRU cache supporting TTL and max entry count, as well as release hooks for cleanup."""

from collections.abc import Callable
from typing import TypeVar

from cachetools import TTLCache

# override is in typing after Python 3.12 and can be imported from there after 3.11
# support is retired.
from typing_extensions import override

from streamlit.runtime.caching.cache_utils import OnRelease

K = TypeVar("K")
V = TypeVar("V")


class TTLCleanupCache(TTLCache[K, V]):
    """A TTLCache that supports hooks called when items are released.

    Note that item release only happens reliably when done automatically due to TTL
    or maxsize expiration - and specifically does not happen when using ``del``. To
    remove an item and have on_release be called, use safe_del.
    """

    def __init__(
        self,
        maxsize: float,
        ttl: float,
        timer: Callable[[], float],
        on_release: OnRelease,
    ) -> None:
        """Create a cache with the given size, TTL, and release hook.

        Parameters
        ----------
        maxsize : float
            The maximum number of elements this cache should hold.
        ttl : float
            The amount of time a cache entry should remain valid, in seconds.
        timer : Callable[[], float]
            The timer function to use to fetch the current time.
        on_release : OnRelease
            The function to call with cache entries when they are removed from the
            cache.
        """
        super().__init__(maxsize=maxsize, ttl=ttl, timer=timer)
        self._on_release = on_release

    @override
    def popitem(self) -> tuple[K, V]:
        key, value = super().popitem()
        self._on_release(value)
        return key, value

    @override
    def expire(self, time: float | None = None) -> list[tuple[K, V]]:
        items = super().expire(time)
        for _, value in items:
            self._on_release(value)

        return items

    def safe_del(self, key: K) -> None:
        """Delete that calls _on_release."""
        has_value = key in self
        old_value = self.get(key)
        del self[key]
        # Check has_value, not None, to allow for None values.
        if has_value:
            self._on_release(old_value)
