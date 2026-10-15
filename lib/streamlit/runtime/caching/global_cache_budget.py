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

import math
import queue
import threading
import weakref
from collections import OrderedDict
from contextlib import AbstractContextManager, nullcontext
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from streamlit import config
from streamlit.byte_util import config_max_cached_data_size_to_bytes
from streamlit.logger import get_logger
from streamlit.runtime.stats import CounterStat, StatsProvider

if TYPE_CHECKING:
    from collections.abc import Sequence

    from streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper import (
        InMemoryCacheStorageWrapper,
    )
    from streamlit.runtime.stats import Stat

_LOGGER: Final = get_logger(__name__)
CACHE_DATA_EVICTIONS_FAMILY: Final = "cache_data_evictions"
_NO_ENFORCEMENT: Final = nullcontext()


@dataclass
class _EntryRecord:
    """Bookkeeping used to reject a stale eviction candidate.

    ``generation`` changes on every rewrite, so an entry selected without its
    storage lock is evicted only if it has not changed.
    """

    size: int
    generation: int


class GlobalCacheBudget(StatsProvider):
    """Enforce one LRU byte budget across in-memory ``st.cache_data`` storages.

    Storages report every write, read, and removal. Enabled-budget reads and writes
    are serialized with eviction. Because a victim is chosen without holding its
    storage's lock, each record carries the entry's write generation. The storage
    validates that generation before deletion.
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
    def is_enabled(self) -> bool:
        """Whether the process-wide byte budget is enabled."""
        return self._max_bytes is not None

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
        while not self._pending_unregisters.empty():
            try:
                storage_id = self._pending_unregisters.get_nowait()
            except queue.Empty:
                # SimpleQueue.empty() is advisory because weakref callbacks can run
                # concurrently. A newly queued ID is drained on the next operation.
                return
            self._unregister_locked(storage_id)

    def _unregister_locked(self, storage_id: int) -> None:
        self._storages.pop(storage_id, None)
        for key in self._storage_entries.pop(storage_id, set()):
            record = self._entries.pop((storage_id, key), None)
            if record is not None:
                self._total_bytes -= record.size

    def enforcement_lock(self) -> AbstractContextManager[object]:
        """Serialize enabled-budget LRU reads, writes, and eviction."""
        if self._max_bytes is None:
            return _NO_ENFORCEMENT
        return self._enforcement_lock

    def record_write(
        self,
        storage_id: int,
        key: str,
        size: int,
        generation: int,
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
    ) -> None:
        if self._max_bytes is None:
            return
        entry_key = (storage_id, key)
        with self._lock:
            self._drain_pending_unregisters_locked()
            current = self._entries.get(entry_key)
            if current is not None and current.generation == generation:
                self._entries.move_to_end(entry_key)

    def record_removals(
        self, storage_id: int, removals: Sequence[tuple[str, int]]
    ) -> None:
        if self._max_bytes is None:
            return
        with self._lock:
            self._drain_pending_unregisters_locked()
            storage_entries = self._storage_entries.get(storage_id)
            for key, generation in removals:
                entry_key = (storage_id, key)
                current = self._entries.get(entry_key)
                if current is None or current.generation != generation:
                    continue
                self._total_bytes -= self._entries.pop(entry_key).size
                if storage_entries is not None:
                    storage_entries.discard(key)

    def _warn_once(self, function_display_name: str) -> None:
        with self._lock:
            if self._warned:
                return
            self._warned = True
        _LOGGER.warning(
            "A value from %s is larger than server.maxCachedDataSize. Streamlit "
            "kept that value and evicted every other in-memory st.cache_data entry. "
            "Raise server.maxCachedDataSize, or set it to "
            '"0" to disable the process-wide budget. This warning is logged once '
            "per process.",
            function_display_name,
            stack_info=True,
        )

    def _storage_display_name(self, storage_id: int) -> str:
        with self._lock:
            storage_ref = self._storages.get(storage_id)
            storage = storage_ref() if storage_ref is not None else None
        return (
            storage.function_display_name
            if storage is not None
            else "an unknown cached function"
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
                and math.isfinite(storage.ttl_seconds)
            ]
        for storage in storages:
            storage._reap_expired_entries()

    def _select_victim_snapshot(
        self,
        protected: tuple[int, str],
        excluded: set[tuple[int, str]],
    ) -> tuple[InMemoryCacheStorageWrapper, str, _EntryRecord] | None:
        """Select the global LRU, excluding the protected write and tried victims."""
        with self._lock:
            self._drain_pending_unregisters_locked()
            if self._max_bytes is None or self._total_bytes <= self._max_bytes:
                return None

            while self._entries:
                stale_storage_id = None
                for entry_key, record in self._entries.items():
                    if entry_key == protected or entry_key in excluded:
                        continue
                    storage_ref = self._storages.get(entry_key[0])
                    storage = storage_ref() if storage_ref is not None else None
                    if storage is None:
                        stale_storage_id = entry_key[0]
                        break
                    # Snapshot the generation while holding the budget lock. The
                    # storage validates it under its own lock before deletion.
                    return (
                        storage,
                        entry_key[1],
                        _EntryRecord(
                            record.size,
                            record.generation,
                        ),
                    )
                if stale_storage_id is None:
                    return None
                # Restart after dropping a garbage-collected storage because its
                # entries may account for all bytes above the budget.
                self._unregister_locked(stale_storage_id)
                if self._total_bytes <= self._max_bytes:
                    return None
            return None

    def _protected_entry_alone_exceeds_budget(self, protected: tuple[int, str]) -> bool:
        with self._lock:
            self._drain_pending_unregisters_locked()
            return (
                self._max_bytes is not None
                and self._total_bytes > self._max_bytes
                and len(self._entries) == 1
                and protected in self._entries
            )

    def enforce_budget(self, protected: tuple[int, str]) -> None:
        """Evict LRU entries without evicting the write currently being enforced.

        ``protected`` identifies the storage and key for that write. The entry stays
        cached even when it alone exceeds the process-wide budget.
        """
        if self._max_bytes is None:
            return
        with self._enforcement_lock:
            if self.total_bytes <= self._max_bytes:
                return
            # TTL expiry is local to each memory cache. Reconcile all expired entries
            # before selecting from the remaining live global LRU.
            self._reap_expired_entries()
            attempted: set[tuple[int, str]] = set()
            while True:
                victim = self._select_victim_snapshot(protected, attempted)
                if victim is None:
                    if self._protected_entry_alone_exceeds_budget(protected):
                        self._warn_once(self._storage_display_name(protected[0]))
                    return
                storage, key, record = victim
                attempted.add((storage._global_storage_id, key))
                evicted = storage._evict_from_mem_cache(
                    key,
                    expected_generation=record.generation,
                )
                if evicted:
                    with self._lock:
                        self._global_evictions += 1
                else:
                    # A concurrent delete, clear, expiry, or teardown changed or
                    # removed this entry. Continue with a fresh candidate.
                    continue

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


class _GlobalCacheBudgetHolder:
    """Mutable holder for the lazily created process-wide budget."""

    budget: GlobalCacheBudget | None = None


_GLOBAL_CACHE_BUDGET_HOLDER = _GlobalCacheBudgetHolder()
_GLOBAL_CACHE_BUDGET_LOCK = threading.Lock()


def get_global_cache_budget() -> GlobalCacheBudget:
    """Return the lazily configured process-wide data-cache budget."""
    budget = _GLOBAL_CACHE_BUDGET_HOLDER.budget
    if budget is None:
        with _GLOBAL_CACHE_BUDGET_LOCK:
            budget = _GLOBAL_CACHE_BUDGET_HOLDER.budget
            if budget is None:
                budget = GlobalCacheBudget.from_config()
                _GLOBAL_CACHE_BUDGET_HOLDER.budget = budget
    return budget
