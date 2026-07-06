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

"""A minimal LRU + TTL cache.

This is a small, purpose-built replacement for the subset of ``cachetools.TTLCache``
that Streamlit relies on. It keeps the exact observable behavior Streamlit depends on
while dropping the generality of the library (variable item sizes, pickling support,
the re-entrant timer, and the multi-class hierarchy):

- Items live for ``ttl`` seconds (measured with ``timer``); ``maxsize`` bounds the
  number of entries. Both may be ``math.inf``.
- **LRU on read and write:** reading or writing a key marks it most-recently-used, so
  under ``maxsize`` pressure the least-recently-used entry is evicted first.
- **Expire-before-write:** every write (and ``__len__``/``currsize`` access) first
  drops already-expired entries, then applies ``maxsize`` eviction.
- Expired entries are reported as absent by ``in``/``[]`` but are only actually removed
  by :meth:`expire` (which returns them) or by eviction — never on read. This lets
  subclasses (see ``TTLCleanupCache``) run release hooks at removal time.

Thread-safety: this class is **not** internally synchronized. Callers that share an
instance across threads must hold their own lock (as Streamlit's callers do).

Two ordered maps are maintained: ``_data`` in access (LRU) order and ``_expiry`` in
insertion/refresh order. Because the TTL is uniform per cache, insertion order equals
expiration order, so expiry is an O(number-expired) sweep from the front of
``_expiry`` while eviction pops the front (LRU) of ``_data``.
"""

from __future__ import annotations

import time
from collections import OrderedDict
from collections.abc import MutableMapping
from typing import TYPE_CHECKING, TypeVar, cast

if TYPE_CHECKING:
    from collections.abc import Callable, Iterator

_KT = TypeVar("_KT")
_VT = TypeVar("_VT")


class TTLCache(MutableMapping[_KT, _VT]):
    """An LRU cache whose entries expire after a fixed time-to-live."""

    def __init__(
        self,
        maxsize: float,
        ttl: float,
        timer: Callable[[], float] = time.monotonic,
    ) -> None:
        """Create a cache.

        Parameters
        ----------
        maxsize
            Maximum number of entries to hold (may be ``math.inf``).
        ttl
            Time-to-live for each entry, in ``timer`` units (may be ``math.inf``).
        timer
            Callable returning the current time. Defaults to ``time.monotonic``.
        """
        self._maxsize = maxsize
        self._ttl = ttl
        self._timer = timer
        # Values, kept in least-recently-used order (reordered on read and write).
        self._data: OrderedDict[_KT, _VT] = OrderedDict()
        # Per-key expiration times, kept in insertion/refresh order. Since the TTL is
        # uniform, this is also ascending-expiration order, so expiry sweeps the front.
        self._expiry: OrderedDict[_KT, float] = OrderedDict()

    def __repr__(self) -> str:
        return (
            f"{type(self).__name__}(maxsize={self._maxsize!r}, ttl={self._ttl!r}, "
            f"currsize={len(self._data)!r})"
        )

    def __getitem__(self, key: _KT) -> _VT:
        if key not in self._data:
            raise KeyError(key)
        # Mark as most-recently-used before the expiry check (matching cachetools).
        self._data.move_to_end(key)
        if not (self._timer() < self._expiry[key]):
            # Expired: report as missing but leave the entry for expire()/eviction.
            raise KeyError(key)
        return self._data[key]

    def __setitem__(self, key: _KT, value: _VT) -> None:
        if self._maxsize < 1:
            raise ValueError("value too large")
        now = self._timer()
        # Drop expired entries first (dispatches to subclass release hooks, if any).
        self.expire(now)
        if key not in self._data:
            while len(self._data) >= self._maxsize:
                self.popitem()
        self._data[key] = value
        self._data.move_to_end(key)
        self._expiry[key] = now + self._ttl
        self._expiry.move_to_end(key)

    def __delitem__(self, key: _KT) -> None:
        now = self._timer()
        del self._data[key]
        expire_at = self._expiry.pop(key)
        # Matches cachetools: deleting an already-expired entry still removes it but
        # raises KeyError to signal it was not "present".
        if not (now < expire_at):
            raise KeyError(key)

    def __contains__(self, key: object) -> bool:
        expire_at = self._expiry.get(cast("_KT", key))
        return expire_at is not None and self._timer() < expire_at

    def __iter__(self) -> Iterator[_KT]:
        now = self._timer()
        # Snapshot so callers can read values (which reorders _data) while iterating.
        return iter([key for key, expire_at in self._expiry.items() if now < expire_at])

    def __len__(self) -> int:
        self.expire()
        return len(self._data)

    def expire(self, time: float | None = None) -> list[tuple[_KT, _VT]]:
        """Remove and return all currently-expired ``(key, value)`` pairs."""
        now = self._timer() if time is None else time
        expired: list[tuple[_KT, _VT]] = []
        while self._expiry:
            key = next(iter(self._expiry))
            if now < self._expiry[key]:
                break
            del self._expiry[key]
            expired.append((key, self._data.pop(key)))
        return expired

    def popitem(self) -> tuple[_KT, _VT]:
        """Remove and return the least-recently-used non-expired ``(key, value)``."""
        self.expire()
        try:
            key = next(iter(self._data))
        except StopIteration:
            raise KeyError(f"{type(self).__name__} is empty") from None
        value = self._data.pop(key)
        del self._expiry[key]
        return (key, value)

    def clear(self) -> None:
        self._data.clear()
        self._expiry.clear()

    @property
    def maxsize(self) -> float:
        """The maximum number of entries the cache can hold."""
        return self._maxsize

    @property
    def ttl(self) -> float:
        """The time-to-live for the cache's entries."""
        return self._ttl

    @property
    def currsize(self) -> int:
        """The current number of (non-expired) entries in the cache."""
        self.expire()
        return len(self._data)
