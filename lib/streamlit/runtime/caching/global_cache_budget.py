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
from collections import OrderedDict, deque
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from streamlit import config
from streamlit.byte_util import config_max_cache_data_size_to_bytes
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


@dataclass
class _EntryRecord:
    """Bookkeeping used to reject a stale eviction candidate.

    ``generation`` changes on every rewrite, so an entry selected without its
    storage lock is evicted only if it has not changed.
    """

    size: int
    generation: int


@dataclass
class _EvictionCandidate:
    """An entry reserved for physical removal after releasing the budget lock."""

    storage: InMemoryCacheStorageWrapper
    storage_id: int
    key: str
    generation: int


class GlobalCacheBudget(StatsProvider):
    """Enforce one LRU byte budget across in-memory ``st.cache_data`` storages.

    Storages report every write, read, and removal. Reads append to a bounded,
    lock-free hint buffer; writers drain those hints before selecting a victim.
    Buffer overflow drops the oldest hints, so cross-cache recency is approximate
    under heavy read load.
    Because a victim is chosen without holding its storage's lock, each record
    carries the entry's write generation. The storage validates that generation
    before deletion.

    Lock order for ordinary mutations is storage memory, then budget bookkeeping.
    Victims are reserved under the budget lock and physically removed after it is
    released. Reconfiguration first takes the configuration lock. Persistent I/O
    does not run while a storage-memory or budget lock is held.
    """

    def __init__(self, max_bytes: int | None) -> None:
        self._max_bytes = max_bytes
        # Serialize registration and configuration so activation sees every
        # published storage before taking their mutation locks.
        self._configuration_lock = threading.Lock()
        self._lock = threading.Lock()
        self._next_storage_id = 0
        self._storages: dict[
            int, weakref.ReferenceType[InMemoryCacheStorageWrapper]
        ] = {}
        self._pending_unregisters: queue.SimpleQueue[int] = queue.SimpleQueue()
        self._entries: OrderedDict[tuple[int, str], _EntryRecord] = OrderedDict()
        self._storage_entries: dict[int, set[str]] = {}
        self._recency_hints: deque[tuple[int, str, int]] = deque(maxlen=4096)
        self._total_bytes = 0
        self._global_evictions = 0
        self._eviction_warning_emitted = False

    @property
    def stats_families(self) -> Sequence[str]:
        return (CACHE_DATA_EVICTIONS_FAMILY,)

    @property
    def is_enabled(self) -> bool:
        """Whether the process-wide byte budget is enabled."""
        return self._max_bytes is not None

    @property
    def max_bytes(self) -> int | None:
        """The configured byte budget, or ``None`` when disabled."""
        return self._max_bytes

    @property
    def total_bytes(self) -> int:
        with self._lock:
            self._drain_pending_unregisters_locked()
            self._drain_recency_hints_locked()
            return self._total_bytes

    def register(self, storage: InMemoryCacheStorageWrapper) -> int:
        with self._configuration_lock:
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

    def reconfigure(self, max_bytes: int | None) -> None:
        """Apply a server-start budget to this process and existing storages."""
        with self._configuration_lock:
            with self._lock:
                current_max_bytes = self._max_bytes
                if current_max_bytes == max_bytes:
                    return
                storages = [
                    storage
                    for storage_ref in self._storages.values()
                    if (storage := storage_ref()) is not None
                ]
                self._max_bytes = max_bytes
                if current_max_bytes is None or max_bytes is None:
                    self._entries.clear()
                    self._recency_hints.clear()
                    self._total_bytes = 0
                    for storage_entries in self._storage_entries.values():
                        storage_entries.clear()

            if max_bytes is None:
                return

            if current_max_bytes is None:
                for storage in storages:
                    storage._activate_global_budget_entries()

            # Pre-activation entries are ordered first by storage registration and
            # then by each storage's local LRU. Exact cross-storage recency begins
            # when the budget is enabled.
            with self._lock:
                candidates = self._reserve_victims_locked(protected=None)
            self._evict_candidates(candidates)

    def _drain_pending_unregisters_locked(self) -> None:
        while not self._pending_unregisters.empty():
            try:
                storage_id = self._pending_unregisters.get_nowait()
            except queue.Empty:
                # SimpleQueue.empty() is advisory because weakref callbacks can run
                # concurrently. A newly queued ID is drained on the next operation.
                return
            self._unregister_locked(storage_id)

    def _drain_recency_hints_locked(self) -> None:
        for _ in range(len(self._recency_hints)):
            storage_id, key, generation = self._recency_hints.popleft()
            entry_key = (storage_id, key)
            current = self._entries.get(entry_key)
            if current is not None and current.generation == generation:
                self._entries.move_to_end(entry_key)

    def _unregister_locked(self, storage_id: int) -> None:
        self._storages.pop(storage_id, None)
        for key in self._storage_entries.pop(storage_id, set()):
            record = self._entries.pop((storage_id, key), None)
            if record is not None:
                self._total_bytes -= record.size

    def record_write_and_reserve_victims(
        self,
        storage_id: int,
        key: str,
        size: int,
        generation: int,
        removals: Sequence[tuple[str, int]],
    ) -> list[_EvictionCandidate]:
        """Publish a write and atomically reserve victims, protecting that write."""
        if self._max_bytes is None:
            return []
        entry_key = (storage_id, key)
        with self._lock:
            self._drain_pending_unregisters_locked()
            self._drain_recency_hints_locked()
            storage_entries = self._storage_entries.get(storage_id)
            if self._max_bytes is None or storage_entries is None:
                return []
            self._record_removals_locked(storage_id, removals)
            current = self._entries.get(entry_key)
            if current is not None:
                self._total_bytes -= current.size
            self._entries[entry_key] = _EntryRecord(
                size=size,
                generation=generation,
            )
            storage_entries.add(key)
            self._entries.move_to_end(entry_key)
            self._total_bytes += size
            return self._reserve_victims_locked(protected=entry_key)

    def activate_storage_entries(
        self,
        storage_id: int,
        entries: Sequence[tuple[str, int, int]],
    ) -> None:
        """Publish one storage's pre-activation entries as a single snapshot."""
        if self._max_bytes is None:
            return
        with self._lock:
            self._drain_pending_unregisters_locked()
            self._drain_recency_hints_locked()
            storage_entries = self._storage_entries.get(storage_id)
            if self._max_bytes is None or storage_entries is None:
                return
            for old_key in storage_entries:
                record = self._entries.pop((storage_id, old_key), None)
                if record is not None:
                    self._total_bytes -= record.size
            storage_entries.clear()
            for key, size, generation in entries:
                self._entries[storage_id, key] = _EntryRecord(size, generation)
                storage_entries.add(key)
                self._total_bytes += size

    def record_read(
        self,
        storage_id: int,
        key: str,
        generation: int,
    ) -> None:
        if self._max_bytes is None:
            return
        self._recency_hints.append((storage_id, key, generation))

    def record_removals(
        self, storage_id: int, removals: Sequence[tuple[str, int]]
    ) -> None:
        if self._max_bytes is None:
            return
        with self._lock:
            self._drain_pending_unregisters_locked()
            self._drain_recency_hints_locked()
            self._record_removals_locked(storage_id, removals)

    def _record_removals_locked(
        self, storage_id: int, removals: Sequence[tuple[str, int]]
    ) -> None:
        storage_entries = self._storage_entries.get(storage_id)
        for key, generation in removals:
            entry_key = (storage_id, key)
            current = self._entries.get(entry_key)
            if current is None or current.generation != generation:
                continue
            self._total_bytes -= self._entries.pop(entry_key).size
            if storage_entries is not None:
                storage_entries.discard(key)

    def _warn_eviction_once(self) -> None:
        with self._lock:
            if self._eviction_warning_emitted:
                return
            self._eviction_warning_emitted = True
            max_bytes = self._max_bytes
        if max_bytes is None:  # pragma: no cover - defensive
            return
        _LOGGER.warning(
            "st.cache_data reached its %s serialized-size budget "
            "(server.maxCacheDataSize) and is evicting least-recently-used "
            "entries, which are recomputed on their next use, or reloaded from "
            "disk if they were persisted. Set server.maxCacheDataSize to change "
            "the budget, or to '0' to disable it. Per-function sizes are on the "
            "cache_memory_bytes metric.",
            _format_byte_size(max_bytes),
        )

    def _reserve_victims_locked(
        self,
        protected: tuple[int, str] | None,
    ) -> list[_EvictionCandidate]:
        """Reserve LRU victims and subtract them while holding the budget lock."""
        self._drain_pending_unregisters_locked()
        self._drain_recency_hints_locked()
        candidates: list[_EvictionCandidate] = []
        while (
            self._max_bytes is not None
            and self._total_bytes > self._max_bytes
            and self._entries
        ):
            stale_storage_id = None
            selected: (
                tuple[
                    tuple[int, str],
                    _EntryRecord,
                    InMemoryCacheStorageWrapper,
                ]
                | None
            ) = None
            for entry_key, record in self._entries.items():
                if entry_key == protected:
                    continue
                storage_ref = self._storages.get(entry_key[0])
                storage = storage_ref() if storage_ref is not None else None
                if storage is None:
                    stale_storage_id = entry_key[0]
                    break
                selected = (entry_key, record, storage)
                break
            if stale_storage_id is not None:
                self._unregister_locked(stale_storage_id)
                continue
            if selected is None:
                break
            entry_key, record, storage = selected
            self._entries.pop(entry_key)
            self._storage_entries[entry_key[0]].discard(entry_key[1])
            self._total_bytes -= record.size
            candidates.append(
                _EvictionCandidate(
                    storage=storage,
                    storage_id=entry_key[0],
                    key=entry_key[1],
                    generation=record.generation,
                )
            )
        return candidates

    def can_evict_reserved(self, storage_id: int, key: str) -> bool:
        """Validate a reserved victim while its storage memory lock is held."""
        with self._lock:
            self._drain_pending_unregisters_locked()
            if storage_id not in self._storage_entries:
                return False
            return (storage_id, key) not in self._entries

    def _evict_candidates(self, candidates: Sequence[_EvictionCandidate]) -> None:
        """Physically remove reserved victims without holding the budget lock."""
        for candidate in candidates:
            evicted = candidate.storage._evict_from_mem_cache(
                candidate.key,
                expected_generation=candidate.generation,
            )
            if evicted:
                with self._lock:
                    self._global_evictions += 1
                self._warn_eviction_once()

    def evict_candidates(self, candidates: Sequence[_EvictionCandidate]) -> None:
        """Remove victims returned by ``record_write_and_reserve_victims``."""
        self._evict_candidates(candidates)

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
    """Return the process-wide data-cache budget."""
    budget = _GLOBAL_CACHE_BUDGET_HOLDER.budget
    if budget is None:
        with _GLOBAL_CACHE_BUDGET_LOCK:
            budget = _GLOBAL_CACHE_BUDGET_HOLDER.budget
            if budget is None:
                # Raw-mode caches can exist before server config is loaded. Start
                # disabled so creating one cannot freeze an incomplete config
                # snapshot; server startup reconfigures this shared instance.
                budget = GlobalCacheBudget(max_bytes=None)
                _GLOBAL_CACHE_BUDGET_HOLDER.budget = budget
    return budget


def reconfigure_global_cache_budget_from_config() -> None:
    """Configure the process-wide budget after server config is loaded."""
    with _GLOBAL_CACHE_BUDGET_LOCK:
        budget = _GLOBAL_CACHE_BUDGET_HOLDER.budget
        max_bytes = config_max_cache_data_size_to_bytes(
            config.get_option("server.maxCacheDataSize")
        )
        if budget is None:
            _GLOBAL_CACHE_BUDGET_HOLDER.budget = GlobalCacheBudget(max_bytes=max_bytes)
        else:
            budget.reconfigure(max_bytes)


def _format_byte_size(size: int) -> str:
    """Format a configured budget for its console warning."""
    for unit, divisor in (
        ("TB", 1024**4),
        ("GB", 1024**3),
        ("MB", 1024**2),
        ("KB", 1024),
    ):
        if size >= divisor:
            return f"{size / divisor:.1f} {unit}"
    return f"{size} {'byte' if size == 1 else 'bytes'}"
