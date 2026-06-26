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

"""An LRU cache that keeps entries past their TTL so callers can serve a stale
value while a fresh value is computed in the background.

Unlike ``cachetools.TTLCache``, expired entries are not automatically evicted on
access. They are retained (and reported as stale) until they are replaced by a
background refresh, explicitly deleted, or evicted by the LRU max-size policy.
This is what enables ``refresh_type="background"`` to immediately return a stale
value instead of blocking on recomputation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Generic, TypeVar

from cachetools import LRUCache

# override is in typing after Python 3.12 and can be imported from there after 3.11
# support is retired.
from typing_extensions import override

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.runtime.caching.cache_utils import OnRelease

K = TypeVar("K")
V = TypeVar("V")


@dataclass
class _StaleAwareEntry(Generic[V]):
    """A cache entry together with its monotonic expiry timestamp."""

    value: V
    expires_at: float


class _ReleasingLRUCache(LRUCache[K, "_StaleAwareEntry[V]"]):
    """An ``LRUCache`` that calls an ``on_release`` hook when an entry is evicted
    via ``popitem`` (for example, when the cache exceeds its max size).
    """

    def __init__(self, maxsize: float, on_release: OnRelease | None) -> None:
        super().__init__(maxsize=maxsize)
        self._on_release = on_release

    @override
    def popitem(self) -> tuple[K, _StaleAwareEntry[V]]:
        key, entry = super().popitem()
        if self._on_release is not None:
            self._on_release(entry.value)
        return key, entry


class StaleAwareCache(Generic[K, V]):
    """A bounded LRU cache that retains entries after their TTL has elapsed.

    The cache is not thread safe; callers are expected to guard access with their
    own lock (mirroring how ``cachetools`` caches are used elsewhere in the
    caching code).
    """

    def __init__(
        self,
        *,
        maxsize: float,
        ttl: float,
        timer: Callable[[], float],
        on_release: OnRelease | None = None,
    ) -> None:
        """Create a stale-aware cache.

        Parameters
        ----------
        maxsize : float
            The maximum number of entries to keep. Use ``math.inf`` for an
            unbounded cache.
        ttl : float
            The time-to-live for an entry, in seconds. After this duration an
            entry is reported as stale but is still retained.
        timer : Callable[[], float]
            The timer function used to compute and check expiry timestamps.
        on_release : OnRelease or None
            An optional function called with an entry's value when it is removed
            from the cache via LRU eviction, ``safe_del``, or ``clear``.
        """
        self._cache: _ReleasingLRUCache[K, V] = _ReleasingLRUCache(maxsize, on_release)
        self._ttl = ttl
        self._timer = timer
        self._on_release = on_release

    @property
    def maxsize(self) -> float:
        return self._cache.maxsize

    @property
    def ttl(self) -> float:
        return self._ttl

    def __contains__(self, key: K) -> bool:
        return key in self._cache

    def __len__(self) -> int:
        return len(self._cache)

    def __getitem__(self, key: K) -> V:
        return self._cache[key].value

    def __setitem__(self, key: K, value: V) -> None:
        self._cache[key] = _StaleAwareEntry(value, self._timer() + self._ttl)

    def __delitem__(self, key: K) -> None:
        # Plain deletion does not call ``on_release`` (mirrors TTLCleanupCache).
        del self._cache[key]

    def get_with_status(self, key: K) -> tuple[V, bool]:
        """Return the ``(value, is_stale)`` tuple for ``key``.

        Accessing an entry marks it as recently used.

        Raises
        ------
        KeyError
            Raised if ``key`` is not in the cache.
        """
        entry = self._cache[key]
        is_stale = self._timer() >= entry.expires_at
        return entry.value, is_stale

    def values(self) -> list[V]:
        """Return the (unwrapped) values currently held in the cache."""
        return [entry.value for entry in self._cache.values()]

    def pop(self, key: K, default: V | None = None) -> V | None:
        """Remove ``key`` and return its value, or ``default`` if absent.

        Does not call ``on_release``.
        """
        entry = self._cache.pop(key, None)
        if entry is None:
            return default
        return entry.value

    def safe_del(self, key: K) -> None:
        """Delete ``key``, calling ``on_release`` if a value was present."""
        entry = self._cache.pop(key, None)
        if entry is not None and self._on_release is not None:
            self._on_release(entry.value)

    def popitem(self) -> tuple[K, V]:
        """Evict and return the least-recently-used ``(key, value)`` entry.

        Calls ``on_release`` for the evicted entry.
        """
        key, entry = self._cache.popitem()
        return key, entry.value

    def clear(self) -> None:
        """Remove all entries, calling ``on_release`` for each one."""
        # Pop items individually so ``on_release`` fires for each entry, matching
        # TTLCleanupCache.clear().
        while True:
            try:
                self._cache.popitem()
            except KeyError:  # noqa: PERF203
                break
