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

"""Process-wide serialized-byte budget for ``st.cache_data``."""

from __future__ import annotations

import queue
import threading
import weakref
from collections import OrderedDict
from contextlib import contextmanager
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from streamlit import config
from streamlit.byte_util import config_max_cached_data_size_to_bytes
from streamlit.logger import get_logger
from streamlit.runtime.stats import CounterStat, StatsProvider

if TYPE_CHECKING:
    from collections.abc import Generator, Sequence

    from streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper import (
        InMemoryCacheStorageWrapper,
    )
    from streamlit.runtime.stats import Stat

_LOGGER: Final = get_logger(__name__)
CACHE_DATA_EVICTIONS_FAMILY: Final = "cache_data_evictions"


@dataclass
class _EntryRecord:
    size: int
    generation: int
    access_version: int


class GlobalCacheBudget(StatsProvider):
    """Enforce one LRU byte budget across in-memory ``st.cache_data`` storages.

    Storages report every write, read, and removal. Because a victim is chosen
    without holding its storage's lock, each record carries the entry's write
    generation and access version. Eviction is skipped if either changed, so a
    concurrent read or rewrite cannot make the budget evict the wrong entry.
    """

    def __init__(self, max_bytes: int | None) -> None:
        self._max_bytes = max_bytes
        self._lock = threading.Lock()
        # Serialize insertion accounting and enforcement so an entry cannot become
        # eligible for another writer's eviction before its own write is enforced.
        self._enforcement_lock = threading.RLock()
        self._next_storage_id = 0
        self._storages: dict[
            int, weakref.ReferenceType[InMemoryCacheStorageWrapper]
        ] = {}
        self._pending_unregisters: queue.SimpleQueue[int] = queue.SimpleQueue()
        self._entries: OrderedDict[tuple[int, str], _EntryRecord] = OrderedDict()
        self._storage_entries: dict[int, set[str]] = {}
        self._total_bytes = 0
        self._global_evictions = 0
        self._warned = False

    @classmethod
    def from_config(cls) -> GlobalCacheBudget:
        """Create a budget from ``server.maxCachedDataSize``."""
        return cls(
            config_max_cached_data_size_to_bytes(
                config.get_option("server.maxCachedDataSize")
            )
        )

    @property
    def stats_families(self) -> Sequence[str]:
        return (CACHE_DATA_EVICTIONS_FAMILY,)

    @property
    def total_bytes(self) -> int:
        with self._lock:
            self._drain_pending_unregisters_locked()
            return self._total_bytes

    def register(self, storage: InMemoryCacheStorageWrapper) -> int:
        with self._lock:
            self._drain_pending_unregisters_locked()
            storage_id = self._next_storage_id
            self._next_storage_id += 1

            def unregister_storage(_ref: object) -> None:
                self._pending_unregisters.put(storage_id)

            self._storages[storage_id] = weakref.ref(storage, unregister_storage)
            self._storage_entries[storage_id] = set()
        return storage_id

    def unregister(self, storage_id: int) -> None:
        with self._lock:
            self._drain_pending_unregisters_locked()
            self._unregister_locked(storage_id)

    def _drain_pending_unregisters_locked(self) -> None:
        while True:
            try:
                storage_id = self._pending_unregisters.get_nowait()
            except queue.Empty:
                return
            self._unregister_locked(storage_id)

    def _unregister_locked(self, storage_id: int) -> None:
        self._storages.pop(storage_id, None)
        for key in self._storage_entries.pop(storage_id, set()):
            record = self._entries.pop((storage_id, key), None)
            if record is not None:
                self._total_bytes -= record.size

    @contextmanager
    def write_enforcement(self) -> Generator[None, None, None]:
        """Serialize writes until each new entry completes its own budget check."""
        if self._max_bytes is None:
            yield
            return
        with self._enforcement_lock:
            yield

    def record_write(
        self,
        storage_id: int,
        key: str,
        size: int,
        generation: int,
        access_version: int,
    ) -> None:
        if self._max_bytes is None:
            return
        entry_key = (storage_id, key)
        with self._lock:
            self._drain_pending_unregisters_locked()
            current = self._entries.get(entry_key)
            if current is not None:
                self._total_bytes -= current.size
            self._entries[entry_key] = _EntryRecord(
                size=size,
                generation=generation,
                access_version=access_version,
            )
            storage_entries = self._storage_entries.get(storage_id)
            if storage_entries is None:
                self._entries.pop(entry_key)
                return
            storage_entries.add(key)
            self._entries.move_to_end(entry_key)
            self._total_bytes += size

    def record_read(
        self,
        storage_id: int,
        key: str,
        generation: int,
        access_version: int,
    ) -> None:
        if self._max_bytes is None:
            return
        entry_key = (storage_id, key)
        with self._lock:
            self._drain_pending_unregisters_locked()
            current = self._entries.get(entry_key)
            if (
                current is not None
                and current.generation == generation
                and access_version >= current.access_version
            ):
                current.access_version = access_version
                self._entries.move_to_end(entry_key)

    def record_removal(self, storage_id: int, key: str, generation: int) -> None:
        if self._max_bytes is None:
            return
        entry_key = (storage_id, key)
        with self._lock:
            self._drain_pending_unregisters_locked()
            current = self._entries.get(entry_key)
            if current is not None and current.generation == generation:
                self._total_bytes -= self._entries.pop(entry_key).size
                storage_entries = self._storage_entries.get(storage_id)
                if storage_entries is not None:
                    storage_entries.discard(key)

    def _warn_once(self) -> None:
        with self._lock:
            if self._warned:
                return
            self._warned = True
        _LOGGER.warning(
            "A st.cache_data value larger than server.maxCachedDataSize was kept. "
            "Streamlit does not reject cache writes. Raise the limit, or set it to "
            '"0" to disable the process-wide budget.'
        )

    def _reap_expired_entries(self) -> None:
        # Snapshot weak references without taking a storage lock while the budget
        # lock is held. Each storage reports removals back under its own lock.
        with self._lock:
            self._drain_pending_unregisters_locked()
            storages = [
                storage
                for storage_ref in self._storages.values()
                if (storage := storage_ref()) is not None
            ]
        for storage in storages:
            storage._reap_expired_entries()

    def _reserve_victim(
        self, protected: tuple[int, str]
    ) -> tuple[InMemoryCacheStorageWrapper, str, _EntryRecord] | None:
        with self._lock:
            self._drain_pending_unregisters_locked()
            if self._max_bytes is None or self._total_bytes <= self._max_bytes:
                return None

            while self._entries:
                entries = iter(self._entries.items())
                entry_key, record = next(entries)
                if entry_key == protected:
                    candidate = next(entries, None)
                    if candidate is None:
                        return None
                    entry_key, record = candidate

                storage_ref = self._storages.get(entry_key[0])
                storage = storage_ref() if storage_ref is not None else None
                if storage is None:
                    self._unregister_locked(entry_key[0])
                    if self._total_bytes <= self._max_bytes:
                        return None
                    continue
                # Snapshot versions while holding the budget lock. The live record is
                # mutated in place on reads to keep allocations off the hit path.
                return (
                    storage,
                    entry_key[1],
                    _EntryRecord(record.size, record.generation, record.access_version),
                )
            return None

    def enforce_budget(self, protected: tuple[int, str]) -> None:
        if self._max_bytes is None:
            return
        with self._enforcement_lock:
            if self.total_bytes <= self._max_bytes:
                return
            # TTL expiry is local to each memory cache. Reconcile all expired entries
            # before selecting from the remaining live global LRU.
            self._reap_expired_entries()
            while True:
                victim = self._reserve_victim(protected)
                if victim is None:
                    if self.total_bytes > self._max_bytes:
                        self._warn_once()
                    return
                storage, key, record = victim
                evicted = storage._evict_from_mem_cache(
                    key,
                    expected_generation=record.generation,
                    expected_access_version=record.access_version,
                )
                if evicted:
                    with self._lock:
                        self._global_evictions += 1
                # If the entry changed since selection, eviction is skipped. Storages
                # publish every change before releasing their lock, so the next
                # selection sees current state and the loop makes progress.

    def get_stats(
        self, family_names: Sequence[str] | None = None
    ) -> dict[str, list[Stat]]:
        if family_names is not None and CACHE_DATA_EVICTIONS_FAMILY not in family_names:
            return {}
        with self._lock:
            self._drain_pending_unregisters_locked()
            count = self._global_evictions
        return {
            CACHE_DATA_EVICTIONS_FAMILY: [
                CounterStat(
                    family_name=CACHE_DATA_EVICTIONS_FAMILY,
                    value=count,
                    labels={"reason": "global_budget"},
                    help="Total st.cache_data entries evicted by the global byte budget.",
                )
            ]
        }


_global_cache_budget: GlobalCacheBudget | None = None
_GLOBAL_CACHE_BUDGET_LOCK = threading.Lock()


def get_global_cache_budget() -> GlobalCacheBudget:
    """Return the lazily configured process-wide data-cache budget."""
    global _global_cache_budget  # noqa: PLW0603

    budget = _global_cache_budget
    if budget is None:
        with _GLOBAL_CACHE_BUDGET_LOCK:
            budget = _global_cache_budget
            if budget is None:
                budget = GlobalCacheBudget.from_config()
                _global_cache_budget = budget
    return budget
