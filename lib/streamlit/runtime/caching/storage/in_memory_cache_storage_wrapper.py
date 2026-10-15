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

    The in-memory cache uses LRU eviction for a configured entry-count or
    serialized-byte limit. The ``server.maxCachedDataSize`` configuration
    option can also enable a process-wide data-cache budget across wrappers.

    If ``persist_storage`` implements its own maxsize strategy, it is recommended
    (but not necessary) that it implement the same LRU strategy,
    otherwise a situation may arise when different items are deleted from
    the memory cache and from the storage.

    Threading
    ---------
    ``_mem_cache_lock`` guards the TTL cache and entry generations.
    ``_mutation_lock`` guards mutations, close, read-through promotion, and
    underlying storage writes. Memory reads do not take ``_mutation_lock``.
    This deliberately serializes persistent I/O for one wrapper so clear,
    close, and read-through promotion cannot publish stale values.
    When ``server.maxCachedDataSize`` enables the process-wide budget, memory reads
    and writes take its enforcement lock before ``_mem_cache_lock``.
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
        self._global_budget = get_global_cache_budget()
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
        # Serialize mutations, close(), and read-through promotion.
        # _mem_cache_lock guards the memory cache and entry versions.
        self._mutation_lock = threading.Lock()
        self._mem_cache_lock = threading.Lock()
        self._invalidation_generation = 0
        # Track key mutations only while a persistent read is active. This avoids
        # retaining one version per key while letting unrelated writes proceed.
        self._active_persistent_reads: dict[str, tuple[int, int]] = {}
        self._closed = False
        self._persist_storage = persist_storage
        # Publish the storage only after every callback-visible attribute exists.
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
            return self._read_from_mem_cache(key)
        except CacheStorageKeyNotFoundError:
            pass

        # Record invalidations around the slow persistent read. If this key changes
        # meanwhile, don't copy disk bytes into memory because they may be stale.
        with self._mutation_lock:
            if self._closed:
                raise CacheStorageKeyNotFoundError("Cache storage is closed")
            try:
                return self._read_from_mem_cache(key)
            except CacheStorageKeyNotFoundError:
                pass
            invalidation_generation = self._invalidation_generation
            key_version = self._begin_persistent_read(key)

        try:
            entry_bytes = self._persist_storage.get(key)
        except BaseException:
            with self._mutation_lock:
                self._finish_persistent_read(key, key_version)
            raise

        with self._mutation_lock:
            key_is_current = self._finish_persistent_read(key, key_version)
            if (
                self._closed
                or invalidation_generation != self._invalidation_generation
                or not key_is_current
            ):
                try:
                    return self._read_from_mem_cache(key)
                except CacheStorageKeyNotFoundError:
                    raise CacheStorageKeyNotFoundError(
                        "Cache entry changed during persistent read"
                    ) from None
            try:
                return self._read_from_mem_cache(key)
            except CacheStorageKeyNotFoundError:
                pass
            self._write_to_mem_cache(key, entry_bytes)
        return entry_bytes

    def set(self, key: str, value: bytes) -> None:
        """Sets the value for a given key."""
        with self._mutation_lock:
            if self._closed:
                return
            self._invalidate_persistent_reads(key)
            self._write_to_mem_cache(key, value)
            self._persist_storage.set(key, value)

    def set_if_present(self, key: str, value: bytes) -> bool:
        """Replace an in-memory value only if it has not been evicted."""
        with self._mutation_lock:
            if self._closed:
                return False
            written = self._write_to_mem_cache(key, value, require_present=True)
            if written:
                self._invalidate_persistent_reads(key)
                self._persist_storage.set(key, value)
            return written

    def delete(self, key: str) -> None:
        """Delete a given key."""
        with self._mutation_lock:
            self._invalidate_persistent_reads(key)
            self._remove_from_mem_cache(key)
            self._persist_storage.delete(key)

    def clear(self) -> None:
        """Delete all keys for the in memory cache, and also the persistent storage."""
        with self._mutation_lock:
            self._invalidation_generation += 1
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
        with self._mutation_lock:
            if self._closed:
                return
            with self._mem_cache_lock:
                self._invalidation_generation += 1
                self._closed = True
                self._mem_cache.clear()
                removals = self._take_pending_removals()
                self._report_removals(removals)
            self._global_budget.unregister(self._global_storage_id)
            self._persist_storage.close()

    def _begin_persistent_read(self, key: str) -> int:
        """Register an active read and return the key's current mutation version."""
        count, version = self._active_persistent_reads.get(key, (0, 0))
        self._active_persistent_reads[key] = (count + 1, version)
        return version

    def _finish_persistent_read(self, key: str, expected_version: int) -> bool:
        """Unregister an active read and report whether its key stayed current."""
        count, version = self._active_persistent_reads[key]
        if count == 1:
            del self._active_persistent_reads[key]
        else:
            self._active_persistent_reads[key] = (count - 1, version)
        return version == expected_version

    def _invalidate_persistent_reads(self, key: str) -> None:
        """Mark active persistent reads for one key as stale."""
        state = self._active_persistent_reads.get(key)
        if state is not None:
            count, version = state
            self._active_persistent_reads[key] = (count, version + 1)

    def _read_from_mem_cache(self, key: str) -> bytes:
        # Enabled-budget reads share the enforcement lock with writes so their LRU
        # update cannot invalidate a selected victim and leave the budget exceeded.
        while True:
            enforcement_required = self._global_budget.read_enforcement_required
            with (
                self._global_budget.enforcement_lock(enabled=enforcement_required),
                self._mem_cache_lock,
            ):
                try:
                    entry = self._mem_cache[key]
                except KeyError:
                    _LOGGER.debug("Memory cache MISS: %s", key)
                    raise CacheStorageKeyNotFoundError(
                        "Key not found in mem cache"
                    ) from None
                else:
                    # Activation marks reconfiguration before taking a snapshot. A
                    # disabled-path read that overlaps that mark retries under the
                    # enforcement lock so its recency is accounted for.
                    if (
                        not enforcement_required
                        and self._global_budget.read_enforcement_required
                    ):
                        continue

                    budget_enabled = self._global_budget.is_enabled
                    if budget_enabled:
                        generation = self._generations[key]
                        self._global_budget.record_read(
                            self._global_storage_id,
                            key,
                            generation,
                        )
                    _LOGGER.debug("Memory cache HIT: %s", key)
                break

        return bytes(entry)

    def _write_to_mem_cache(
        self, key: str, entry_bytes: bytes, *, require_present: bool = False
    ) -> bool:
        should_warn = False
        with self._global_budget.enforcement_lock():
            with self._mem_cache_lock:
                if self._closed:
                    return False
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
                if self._global_budget.is_enabled:
                    self._next_generation += 1
                    generation = self._next_generation
                    self._generations[key] = generation
                    removals = self._take_pending_removals()
                    self._report_removals(removals)
                    self._global_budget.record_write(
                        self._global_storage_id,
                        key,
                        len(entry_bytes),
                        generation,
                    )
            self._global_budget.enforce_budget((self._global_storage_id, key))
        if should_warn:
            _LOGGER.warning(
                "A value from %s is larger than its max_size. Streamlit kept this "
                "value and will not keep another in-memory entry alongside it. "
                "Increase max_size to keep more than one value.",
                self.function_display_name,
                stack_info=True,
            )
        return True

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

    def _reap_expired_entries(self) -> None:
        """Remove expired memory entries and publish their released bytes."""
        with self._mem_cache_lock:
            self._mem_cache.expire()
            removals = self._take_pending_removals()
            self._report_removals(removals)

    def _activate_global_budget_entries(self) -> None:
        """Publish live pre-activation entries while holding their memory lock."""
        with self._mem_cache_lock:
            self._mem_cache.expire()
            self._take_pending_removals()
            for key, value in self._mem_cache.lru_items():
                self._next_generation += 1
                generation = self._next_generation
                self._generations[key] = generation
                self._global_budget.record_write(
                    self._global_storage_id,
                    key,
                    len(value),
                    generation,
                )

    def _evict_from_mem_cache(
        self,
        key: str,
        expected_generation: int,
    ) -> bool:
        """Remove the selected generation without touching persistent storage.

        Returns ``False`` if the entry changed or disappeared after selection.
        """
        with self._mem_cache_lock:
            if self._generations.get(key) != expected_generation:
                return False
            is_live = key in self._mem_cache
            # Release an expired entry that the global budget still counts.
            # TTLCache hides expired keys from "in", so delete it explicitly.
            with contextlib.suppress(KeyError):
                del self._mem_cache[key]
            removals = self._take_pending_removals()
            self._report_removals(removals)
        return is_live
