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


@dataclass(frozen=True)
class _EntryRecord:
    size: int
    generation: int
    access_version: int


class GlobalCacheBudget(StatsProvider):
    """Enforce one LRU byte budget across in-memory ``st.cache_data`` storages.

    Storages report events with a generation that changes on every write, an
    access version that changes on every read or write, and a per-storage event
    sequence. These counters prevent stale removals, stale eviction selections,
    and reordered notifications from corrupting global accounting.
    """

    def __init__(
        self, max_bytes: int | None = None, *, read_config: bool = True
    ) -> None:
        self._max_bytes = (
            config_max_cached_data_size_to_bytes(
                config.get_option("server.maxCachedDataSize")
            )
            if read_config
            else max_bytes
        )
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
        # Each storage publishes numbered events under its own lock. Keeping the
        # newest sequence per storage prevents a stale notification from
        # resurrecting a removed entry.
        self._last_event_sequences: dict[int, int] = {}
        self._total_bytes = 0
        self._global_evictions = 0
        self._warned = False

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
            self._last_event_sequences[storage_id] = 0
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
        self._last_event_sequences.pop(storage_id, None)
        for entry_key in [
            entry_key for entry_key in self._entries if entry_key[0] == storage_id
        ]:
            self._total_bytes -= self._entries.pop(entry_key).size

    def _accept_event_locked(self, storage_id: int, event_sequence: int) -> bool:
        last_sequence = self._last_event_sequences.get(storage_id)
        if last_sequence is None or event_sequence <= last_sequence:
            return False
        self._last_event_sequences[storage_id] = event_sequence
        return True

    @contextmanager
    def write_enforcement(self) -> Generator[None, None, None]:
        """Keep one insertion protected through its budget enforcement."""
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
        event_sequence: int,
    ) -> None:
        if self._max_bytes is None:
            return
        entry_key = (storage_id, key)
        with self._lock:
            self._drain_pending_unregisters_locked()
            if not self._accept_event_locked(storage_id, event_sequence):
                return
            current = self._entries.get(entry_key)
            if current is not None and current.generation > generation:
                return
            if current is not None:
                self._total_bytes -= current.size
            self._entries[entry_key] = _EntryRecord(
                size=size,
                generation=generation,
                access_version=access_version,
            )
            self._entries.move_to_end(entry_key)
            self._total_bytes += size

    def record_read(
        self,
        storage_id: int,
        key: str,
        generation: int,
        access_version: int,
        event_sequence: int,
    ) -> None:
        if self._max_bytes is None:
            return
        entry_key = (storage_id, key)
        with self._lock:
            self._drain_pending_unregisters_locked()
            if not self._accept_event_locked(storage_id, event_sequence):
                return
            current = self._entries.get(entry_key)
            if (
                current is not None
                and current.generation == generation
                and access_version >= current.access_version
            ):
                self._entries[entry_key] = _EntryRecord(
                    size=current.size,
                    generation=generation,
                    access_version=access_version,
                )
                self._entries.move_to_end(entry_key)

    def record_removal(
        self, storage_id: int, key: str, generation: int, event_sequence: int
    ) -> None:
        if self._max_bytes is None:
            return
        entry_key = (storage_id, key)
        with self._lock:
            self._drain_pending_unregisters_locked()
            if not self._accept_event_locked(storage_id, event_sequence):
                return
            current = self._entries.get(entry_key)
            if current is not None and current.generation > generation:
                return
            if current is not None:
                self._total_bytes -= self._entries.pop(entry_key).size

    def _warn_once(self) -> None:
        with self._lock:
            if self._warned:
                return
            self._warned = True
        _LOGGER.warning(
            "The combined st.cache_data in-memory cache exceeded "
            "server.maxCachedDataSize. Streamlit evicts older least-recently-used "
            "entries when available, but keeps a newly written value even when it "
            "alone exceeds the budget. Increase the config value or set it to "
            '"0" to disable this process-wide budget.'
        )

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
                    self._total_bytes -= self._entries.pop(entry_key).size
                    if self._total_bytes <= self._max_bytes:
                        return None
                    continue
                return storage, entry_key[1], record
            return None

    def enforce_budget(self, protected: tuple[int, str]) -> None:
        if self._max_bytes is None:
            return
        with self._enforcement_lock:
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
                    self._warn_once()
                # A read, write, clear, or expiry publishes its updated state
                # before releasing the wrapper lock. Select again from the
                # actual current global LRU until the budget is satisfied.

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


_GLOBAL_CACHE_BUDGET: list[GlobalCacheBudget | None] = [None]
_GLOBAL_CACHE_BUDGET_LOCK = threading.Lock()


def get_global_cache_budget() -> GlobalCacheBudget:
    """Return the lazily configured process-wide data-cache budget."""
    budget = _GLOBAL_CACHE_BUDGET[0]
    if budget is None:
        with _GLOBAL_CACHE_BUDGET_LOCK:
            budget = _GLOBAL_CACHE_BUDGET[0]
            if budget is None:
                budget = GlobalCacheBudget()
                _GLOBAL_CACHE_BUDGET[0] = budget
    return budget
