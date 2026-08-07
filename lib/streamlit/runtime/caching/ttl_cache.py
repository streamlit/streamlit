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

"""A minimal LRU cache with per-item time-to-live (TTL) support.

This is a small, dependency-free replacement for ``cachetools.TTLCache`` that
preserves the exact subset of behavior Streamlit relies on:

- Entries are evicted least-recently-used first once ``maxsize`` is exceeded,
  where recency is refreshed both on read and on write.
- Every entry shares the same ``ttl``, so write order is also expiry order.
  Expired entries are reported as absent on reads (``__getitem__`` /
  ``in``) but are only actually removed by a write, by ``expire()``, or by a
  length/size query. Some of Streamlit's cache-cleanup hooks depend on this.

Like ``cachetools.TTLCache``, this cache is **not** thread-safe. Callers that
share an instance across threads must provide their own locking.
"""

from __future__ import annotations

import time
from collections import OrderedDict
from collections.abc import Callable, ItemsView, Iterator, MutableMapping, ValuesView
from typing import Final, TypeVar, overload

K = TypeVar("K")
V = TypeVar("V")
_T = TypeVar("_T")

# Sentinel used to detect whether a default was passed to pop().
_MISSING: Final = object()


class TTLCache(MutableMapping[K, V]):
    """LRU cache with a uniform per-item time-to-live."""

    def __init__(
        self,
        maxsize: float,
        ttl: float,
        timer: Callable[[], float] = time.monotonic,
    ) -> None:
        """Create a new TTLCache.

        Parameters
        ----------
        maxsize : float
            The maximum number of entries the cache may hold. Use ``math.inf``
            for an unbounded cache.
        ttl : float
            The time in seconds that an entry remains valid after it is written.
        timer : Callable[[], float]
            A zero-argument callable returning the current time. Defaults to
            ``time.monotonic``.
        """
        self._maxsize = maxsize
        self._ttl = ttl
        self._timer = timer
        # Maps key -> value in least-recently-used order (oldest first). The LRU
        # position is refreshed on both reads and writes.
        self._data: OrderedDict[K, V] = OrderedDict()
        # Maps key -> expiry timestamp in write order (soonest-to-expire first).
        # Because the TTL is uniform, write order is also expiry order, which
        # lets expire() stop at the first still-valid entry.
        self._expirations: OrderedDict[K, float] = OrderedDict()

    @property
    def maxsize(self) -> float:
        """The maximum number of entries the cache may hold."""
        return self._maxsize

    @property
    def ttl(self) -> float:
        """The time-to-live value of the cache's entries, in seconds."""
        return self._ttl

    @property
    def timer(self) -> Callable[[], float]:
        """The timer function used by the cache."""
        return self._timer

    @property
    def currsize(self) -> int:
        """The current number of (non-expired) entries in the cache."""
        return len(self)

    def __repr__(self) -> str:
        # Report the raw number of stored entries rather than currsize/len(),
        # which would reap expired entries (and, in TTLCleanupCache, fire
        # release hooks) as a side effect. __repr__ must never mutate the cache.
        return (
            f"{type(self).__name__}(maxsize={self._maxsize!r}, "
            f"ttl={self._ttl!r}, currsize={len(self._data)!r})"
        )

    def __contains__(self, key: object) -> bool:
        # Membership never reorders entries and never reaps expired ones, which
        # matches cachetools (and keeps `in` checks free of LRU side effects).
        expires = self._expirations.get(key)  # type: ignore[arg-type]
        return expires is not None and self._timer() < expires

    def __getitem__(self, key: K) -> V:
        try:
            expires = self._expirations[key]
        except KeyError:
            raise KeyError(key) from None
        # Bump recency on read, matching cachetools (which reorders even when the
        # entry turns out to be expired but not yet reaped).
        self._data.move_to_end(key)
        if not (self._timer() < expires):
            # Expired entries are treated as absent, but left in place to be
            # reaped later by expire()/eviction.
            raise KeyError(key)
        return self._data[key]

    def __setitem__(self, key: K, value: V) -> None:
        if self._maxsize < 1:
            raise ValueError("value too large")
        now = self._timer()
        # Reap expired entries first so freed capacity is reused before evicting.
        self.expire(now)
        if key not in self._data:
            # Count-based sizing: each entry counts as one.
            while len(self._data) + 1 > self._maxsize:
                self.popitem()
        self._data[key] = value
        self._data.move_to_end(key)
        self._expirations[key] = now + self._ttl
        self._expirations.move_to_end(key)

    def __delitem__(self, key: K) -> None:
        try:
            del self._data[key]
        except KeyError:
            raise KeyError(key) from None
        expires = self._expirations.pop(key)
        # Mirror cachetools: deleting an already-expired entry removes it but
        # still signals a miss by raising KeyError.
        if not (self._timer() < expires):
            raise KeyError(key)

    def __iter__(self) -> Iterator[K]:
        now = self._timer()
        # Iterate in expiry (write) order, yielding only still-valid keys.
        # Snapshot the items so a caller reading values mid-iteration can't
        # disturb the iteration.
        for key, expires in list(self._expirations.items()):
            if now < expires:
                yield key

    def _live_snapshot(self) -> dict[K, V]:
        # Capture the non-expired entries against a single timer reading. The
        # default MutableMapping items()/values() views re-read the timer via
        # __getitem__ for every key, so an entry that expires between __iter__
        # yielding it and the follow-up __getitem__ would raise KeyError mid-
        # iteration. cachetools avoids this by freezing its timer for the
        # duration of iteration; reading everything against one timestamp gives
        # the same consistent view. Entries are returned in expiry (write) order,
        # matching __iter__.
        now = self._timer()
        return {
            key: self._data[key]
            for key, expires in list(self._expirations.items())
            if now < expires
        }

    def items(self) -> ItemsView[K, V]:
        return self._live_snapshot().items()

    def values(self) -> ValuesView[V]:
        return self._live_snapshot().values()

    def __len__(self) -> int:
        # Matches cachetools: querying the length reaps expired entries first.
        self.expire()
        return len(self._data)

    @overload
    def pop(self, key: K) -> V: ...
    @overload
    def pop(self, key: K, default: V) -> V: ...
    @overload
    def pop(self, key: K, default: _T) -> V | _T: ...
    def pop(self, key: K, default: object = _MISSING) -> object:
        # Read the timer once so the entry cannot flip from valid to expired
        # between the membership check and the removal. This preserves the
        # cachetools contract that pop() with a default never raises for an
        # entry that was present-and-valid at the start of the call.
        now = self._timer()
        expires = self._expirations.get(key)
        if expires is not None and now < expires:
            del self._expirations[key]
            return self._data.pop(key)
        if default is _MISSING:
            raise KeyError(key)
        return default

    def popitem(self) -> tuple[K, V]:
        """Remove and return the least-recently-used non-expired ``(key, value)``."""
        self.expire()
        try:
            key = next(iter(self._data))
        except StopIteration:
            raise KeyError(f"{type(self).__name__} is empty") from None
        value = self._data.pop(key)
        del self._expirations[key]
        return key, value

    def expire(self, at_time: float | None = None) -> list[tuple[K, V]]:
        """Remove expired entries and return the removed ``(key, value)`` pairs."""
        now = self._timer() if at_time is None else at_time
        expired_keys: list[K] = []
        for key, expires in self._expirations.items():
            if now < expires:
                # Uniform TTL means every later entry is also still valid.
                break
            expired_keys.append(key)
        removed: list[tuple[K, V]] = []
        for key in expired_keys:
            value = self._data.pop(key)
            del self._expirations[key]
            removed.append((key, value))
        return removed

    def clear(self) -> None:
        self._data.clear()
        self._expirations.clear()
