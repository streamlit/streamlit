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

import math
import threading
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
    from collections.abc import Sequence

_LOGGER = get_logger(__name__)


class InMemoryCacheStorageWrapper(CacheStorage):
    """
    In-memory cache storage wrapper.

    This class wraps a cache storage and adds an in-memory cache front layer,
    which is used to reduce the number of calls to the storage.

    The in-memory cache is a TTL cache, which means that the entries are
    automatically removed if a given time to live (TTL) has passed.

    The in-memory cache is also an LRU cache, which means that the entries
    are automatically removed if the cache size exceeds a given maxsize.

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
        self._pending_removals: list[tuple[str, int]] = []
        self._generations: dict[str, int] = {}
        self._access_versions: dict[str, int] = {}
        self._next_generation = 0
        self._next_access_version = 0
        self._next_event_sequence = 0
        self._oversized_warning_emitted = False
        self._global_budget = get_global_cache_budget()
        self._global_storage_id = self._global_budget.register(self)
        self._mem_cache: TTLCache[str, bytes] = TTLCache(
            maxsize=(
                self.max_entries
                if self._max_size_bytes is None
                else self._max_size_bytes
            ),
            ttl=self.ttl_seconds,
            timer=cache_utils.TTLCACHE_TIMER,
            getsizeof=None if self._max_size_bytes is None else len,
            max_count=None if self._max_size_bytes is None else self._max_entries,
            on_remove=self._on_mem_cache_remove,
        )
        self._mem_cache_lock = threading.Lock()
        self._persist_storage = persist_storage

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

    def set_if_present(self, key: str, value: bytes) -> bool:
        """Replace an in-memory value only if it has not been evicted."""
        written = self._write_to_mem_cache(key, value, require_present=True)
        if written:
            self._persist_storage.set(key, value)
        return written

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
            self._mem_cache.expire()
            stats = [
                CacheStat(
                    category_name="st_cache_data",
                    cache_name=self.function_display_name,
                    byte_length=len(item),
                )
                for item in self._mem_cache.values()
            ]
            removals = self._take_pending_removals()
            self._report_removals(removals)
        if not stats:
            return {}
        # In general, get_stats methods need to be able to return only requested stat
        # families, but this method only returns a single family, and we're guaranteed
        # that it was one of those requested if we make it here.
        return {CACHE_MEMORY_FAMILY: stats}

    def close(self) -> None:
        """Closes the cache storage."""
        with self._mem_cache_lock:
            self._mem_cache.clear()
            removals = self._take_pending_removals()
            self._report_removals(removals)
        self._global_budget.unregister(self._global_storage_id)
        self._persist_storage.close()

    def _read_from_mem_cache(self, key: str) -> bytes:
        with self._mem_cache_lock:
            if key in self._mem_cache:
                entry = bytes(self._mem_cache[key])
                generation = self._generations[key]
                self._next_access_version += 1
                access_version = self._next_access_version
                self._access_versions[key] = access_version
                self._global_budget.record_read(
                    self._global_storage_id,
                    key,
                    generation,
                    access_version,
                    self._new_event_sequence(),
                )
                _LOGGER.debug("Memory cache HIT: %s", key)
            else:
                _LOGGER.debug("Memory cache MISS: %s", key)
                raise CacheStorageKeyNotFoundError("Key not found in mem cache")

        return entry

    def _write_to_mem_cache(
        self, key: str, entry_bytes: bytes, *, require_present: bool = False
    ) -> bool:
        should_warn = False
        with self._global_budget.write_enforcement():
            with self._mem_cache_lock:
                if require_present and key not in self._mem_cache:
                    return False
                if (
                    self._max_size_bytes is not None
                    and len(entry_bytes) > self._max_size_bytes
                    and not self._oversized_warning_emitted
                ):
                    self._oversized_warning_emitted = True
                    should_warn = True
                self._mem_cache[key] = entry_bytes
                self._next_generation += 1
                generation = self._next_generation
                self._generations[key] = generation
                self._next_access_version += 1
                access_version = self._next_access_version
                self._access_versions[key] = access_version
                removals = self._take_pending_removals()
                self._report_removals(removals)
                self._global_budget.record_write(
                    self._global_storage_id,
                    key,
                    len(entry_bytes),
                    generation,
                    access_version,
                    self._new_event_sequence(),
                )
            if should_warn:
                _LOGGER.warning(
                    "A cached value for %s is larger than its configured max_size. "
                    "The value is retained because Streamlit never rejects a cache write.",
                    self.function_display_name,
                )
            self._global_budget.enforce_budget((self._global_storage_id, key))
            return True

    def _remove_from_mem_cache(self, key: str) -> None:
        with self._mem_cache_lock:
            try:
                del self._mem_cache[key]
            except KeyError:
                pass
            removals = self._take_pending_removals()
            self._report_removals(removals)

    def _on_mem_cache_remove(self, key: str, _value: bytes) -> None:
        generation = self._generations.pop(key, None)
        self._access_versions.pop(key, None)
        if generation is not None:
            self._pending_removals.append((key, generation))

    def _take_pending_removals(self) -> list[tuple[str, int]]:
        removals = self._pending_removals
        self._pending_removals = []
        return removals

    def _report_removals(self, removals: list[tuple[str, int]]) -> None:
        for key, generation in removals:
            self._global_budget.record_removal(
                self._global_storage_id,
                key,
                generation,
                self._new_event_sequence(),
            )

    def _new_event_sequence(self) -> int:
        self._next_event_sequence += 1
        return self._next_event_sequence

    def _evict_from_mem_cache(
        self,
        key: str,
        expected_generation: int,
        expected_access_version: int,
    ) -> bool:
        """Remove one in-memory entry without touching persistent storage."""
        with self._mem_cache_lock:
            if (
                self._generations.get(key) != expected_generation
                or self._access_versions.get(key) != expected_access_version
            ):
                return False
            if key not in self._mem_cache:
                try:
                    del self._mem_cache[key]
                except KeyError:
                    pass
                removals = self._take_pending_removals()
                self._report_removals(removals)
                return False
            try:
                del self._mem_cache[key]
            except KeyError:
                pass
            removals = self._take_pending_removals()
            self._report_removals(removals)
        return True
