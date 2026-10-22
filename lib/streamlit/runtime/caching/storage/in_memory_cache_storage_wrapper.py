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
from __future__ import annotations

import contextlib
import math
import threading
import weakref
from typing import TYPE_CHECKING

from streamlit.logger import get_logger
from streamlit.runtime.caching import cache_utils
from streamlit.runtime.caching.global_cache_budget import get_global_cache_budget
from streamlit.runtime.caching.storage.cache_storage_protocol import (
    CacheStorage,
    CacheStorageContext,
    CacheStorageKeyNotFoundError,
)
from streamlit.runtime.caching.ttl_cache import TTLCache
from streamlit.runtime.stats import CACHE_MEMORY_FAMILY, CacheStat

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence

_LOGGER = get_logger(__name__)


def _create_on_remove_callback(
    storage: InMemoryCacheStorageWrapper,
) -> Callable[[str, bytes], None]:
    """Create a removal callback that does not keep its storage alive."""
    storage_ref = weakref.ref(storage)

    def on_remove(key: str, value: bytes) -> None:
        # Keep a strong reference for the full callback after the safe dereference.
        live_storage = storage_ref()
        if live_storage is not None:
            live_storage._on_mem_cache_remove(key, value)

    return on_remove


class InMemoryCacheStorageWrapper(CacheStorage):
    """
    In-memory cache storage wrapper.

    This class wraps a cache storage and adds an in-memory cache front layer,
    which is used to reduce the number of calls to the storage.

    The in-memory cache is a TTL cache, which means that the entries are
    automatically removed if a given time to live (TTL) has passed.

    The in-memory cache uses LRU eviction for a configured entry-count or
    serialized-byte limit.

    If the storage implements its strategy for maxsize, it is recommended
    (but not necessary) that the storage implement the same LRU strategy,
    otherwise a situation may arise when different items are deleted from
    the memory cache and from the storage.

    Notes
    -----
    Threading: in-memory caching layer is thread safe: we hold self._mem_cache_lock for
    working with this self._mem_cache object.
    However, we do not hold this lock when calling into the underlying storage,
    so it is the responsibility of the that storage to ensure that it is safe to use
    it from multiple threads.
    """

    def __init__(
        self, persist_storage: CacheStorage, context: CacheStorageContext
    ) -> None:
        self.function_key = context.function_key
        self.function_display_name = context.function_display_name
        self._ttl_seconds = context.ttl_seconds
        self._max_entries = context.max_entries
        self._max_size_bytes = context.max_size_bytes
        # TTLCache invokes on_remove under _mem_cache_lock. Buffer removals until
        # the mutation completes, then report them to the global budget in one batch.
        self._pending_removals: list[tuple[str, int]] = []
        self._generations: dict[str, int] = {}
        self._next_generation = 0
        self._oversized_warning_emitted = False
        self._mem_cache: TTLCache[str, bytes] = TTLCache[str, bytes](
            maxsize=self.max_entries,
            ttl=self.ttl_seconds,
            timer=cache_utils.TTLCACHE_TIMER,
            max_total_size=self._max_size_bytes,
            getsizeof=None if self._max_size_bytes is None else len,
            on_remove=_create_on_remove_callback(self),
        )
        self._mem_cache_lock = threading.Lock()
        self._persist_storage = persist_storage
        self._global_budget = get_global_cache_budget()
        self._global_storage_id = self._global_budget.register(self)

    @property
    def ttl_seconds(self) -> float:
        return self._ttl_seconds if self._ttl_seconds is not None else math.inf

    @property
    def max_entries(self) -> float:
        return float(self._max_entries) if self._max_entries is not None else math.inf

    @property
    def max_size_bytes(self) -> int | None:
        return self._max_size_bytes

    @property
    def stats_families(self) -> Sequence[str]:
        return (CACHE_MEMORY_FAMILY,)

    def has(self, key: str) -> bool:
        """Return whether the key is in memory or the underlying storage."""
        with self._mem_cache_lock:
            if key in self._mem_cache:
                return True
        return self._persist_storage.has(key)

    def get(self, key: str) -> bytes:
        """
        Returns the stored value for the key or raise CacheStorageKeyNotFoundError if
        the key is not found.
        """
        try:
            entry_bytes = self._read_from_mem_cache(key)
        except CacheStorageKeyNotFoundError:
            entry_bytes = self._persist_storage.get(key)
            self._write_to_mem_cache(key, entry_bytes)
        return entry_bytes

    def set(self, key: str, value: bytes) -> None:
        """Sets the value for a given key."""
        self._write_to_mem_cache(key, value)
        self._persist_storage.set(key, value)

    def delete(self, key: str) -> None:
        """Delete a given key."""
        self._remove_from_mem_cache(key)
        self._persist_storage.delete(key)

    def clear(self) -> None:
        """Delete all keys for the in memory cache, and also the persistent storage."""
        with self._mem_cache_lock:
            self._mem_cache.clear()
            removals = self._take_pending_removals()
            self._report_removals(removals)
        self._persist_storage.clear()

    def get_stats(
        self, _family_names: Sequence[str] | None = None
    ) -> dict[str, list[CacheStat]]:
        """Returns stats in bytes for the cache memory storage per item."""
        with self._mem_cache_lock:
            stats = [
                CacheStat(
                    category_name="st_cache_data",
                    cache_name=self.function_display_name,
                    byte_length=len(item),
                )
                for item in self._mem_cache.values()
            ]
        if not stats:
            return {}
        # In general, get_stats methods need to be able to return only requested stat
        # families, but this method only returns a single family, and we're guaranteed
        # that it was one of those requested if we make it here.
        return {CACHE_MEMORY_FAMILY: stats}

    def close(self) -> None:
        """Closes the cache storage."""
        # Keep unregister ordered after the storage lock so a reserved global
        # victim cannot pass validation while this storage is being dropped.
        with self._mem_cache_lock:
            self._global_budget.unregister(self._global_storage_id)
        self._persist_storage.close()

    def _read_from_mem_cache(self, key: str) -> bytes:
        with self._mem_cache_lock:
            try:
                entry = bytes(self._mem_cache[key])
            except KeyError:
                _LOGGER.debug("Memory cache MISS: %s", key)
                raise CacheStorageKeyNotFoundError(
                    "Key not found in mem cache"
                ) from None

            generation = self._generations.get(key)
            if generation is not None and self._global_budget.is_enabled:
                self._global_budget.record_read(
                    self._global_storage_id,
                    key,
                    generation,
                )
            _LOGGER.debug("Memory cache HIT: %s", key)
            return entry

    def _write_to_mem_cache(self, key: str, entry_bytes: bytes) -> None:
        should_warn = False
        candidates = []
        with self._mem_cache_lock:
            if (
                (
                    self._max_size_bytes is not None
                    and len(entry_bytes) > self._max_size_bytes
                )
                or (
                    self._global_budget.max_bytes is not None
                    and len(entry_bytes) > self._global_budget.max_bytes
                )
            ) and not self._oversized_warning_emitted:
                self._oversized_warning_emitted = True
                should_warn = True
            self._mem_cache[key] = entry_bytes
            removals = self._take_pending_removals()
            if self._global_budget.is_enabled:
                self._next_generation += 1
                generation = self._next_generation
                self._generations[key] = generation
                candidates = self._global_budget.record_write_and_reserve_victims(
                    self._global_storage_id,
                    key,
                    len(entry_bytes),
                    generation,
                    removals,
                )
        self._global_budget.evict_candidates(candidates)
        if should_warn:
            _LOGGER.warning(
                "A cached result is larger than the st.cache_data size limit and "
                "was stored anyway."
            )

    def _remove_from_mem_cache(self, key: str) -> None:
        with self._mem_cache_lock:
            with contextlib.suppress(KeyError):
                del self._mem_cache[key]
            removals = self._take_pending_removals()
            self._report_removals(removals)

    def _on_mem_cache_remove(self, key: str, _value: bytes) -> None:
        generation = self._generations.pop(key, None)
        if generation is not None:
            self._pending_removals.append((key, generation))

    def _take_pending_removals(self) -> list[tuple[str, int]]:
        removals = self._pending_removals
        self._pending_removals = []
        return removals

    def _report_removals(self, removals: list[tuple[str, int]]) -> None:
        if removals:
            self._global_budget.record_removals(self._global_storage_id, removals)

    def _activate_global_budget_entries(self) -> None:
        """Publish live pre-activation entries while holding their memory lock."""
        with self._mem_cache_lock:
            self._mem_cache.expire()
            self._take_pending_removals()
            entries: list[tuple[str, int, int]] = []
            for key, value in self._mem_cache.lru_items():
                self._next_generation += 1
                generation = self._next_generation
                self._generations[key] = generation
                entries.append((key, len(value), generation))
            self._global_budget.activate_storage_entries(
                self._global_storage_id, entries
            )

    def _evict_from_mem_cache(
        self,
        key: str,
        expected_generation: int,
    ) -> bool:
        """Remove a matching in-memory generation without touching disk."""
        with self._mem_cache_lock:
            if self._generations.get(key) != expected_generation:
                return False
            if not self._global_budget.can_evict_reserved(self._global_storage_id, key):
                return False
            is_live = key in self._mem_cache
            with contextlib.suppress(KeyError):
                del self._mem_cache[key]
            removals = self._take_pending_removals()
            self._report_removals(removals)
        return is_live
