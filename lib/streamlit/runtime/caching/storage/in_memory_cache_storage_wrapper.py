# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from cachetools import TTLCache

from streamlit.logger import get_logger
from streamlit.runtime.caching import cache_utils
from streamlit.runtime.caching.storage.cache_storage_protocol import (
    CacheStorage,
    CacheStorageContext,
    CacheStorageKeyNotFoundError,
)

_LOGGER = get_logger(__name__)


class InMemoryCacheStorageWrapper(CacheStorage):
    def __init__(self, persist_storage: CacheStorage, context: CacheStorageContext):
        self.function_key = context.function_key
        self.persist = context.persist
        self._ttl_seconds = context.ttl_seconds
        self._max_entries = context.max_entries
        self._mem_cache: TTLCache[str, bytes] = TTLCache(
            maxsize=self.max_entries,
            ttl=self.ttl_seconds,
            timer=cache_utils.TTLCACHE_TIMER,
        )
        self._mem_cache_lock = threading.Lock()
        self._persist_storage = persist_storage

    @property
    def ttl_seconds(self) -> float:
        return self._ttl_seconds if self._ttl_seconds is not None else math.inf

    @property
    def max_entries(self) -> float:
        return float(self._max_entries) if self._max_entries is not None else math.inf

    def get(self, key: str) -> bytes:
        """Returns the stored value for the key or None if the key is not present"""
        try:
            entry_bytes = self._read_from_mem_cache(key)

        except CacheStorageKeyNotFoundError as e:
            if self.persist == "disk":
                entry_bytes = self._persist_storage.get(key)
                self._write_to_mem_cache(key, entry_bytes)
            else:
                raise e
        return entry_bytes

    def set(self, key: str, value: bytes) -> None:
        """Sets the value for a given key"""
        self._write_to_mem_cache(key, value)
        if self.persist == "disk":
            self._persist_storage.set(key, value)

    def delete(self, key: str) -> None:
        """Delete a given key"""
        self._remove_from_mem_cache(key)
        if self.persist == "disk":
            self._persist_storage.delete(key)

    def clear(self) -> None:
        """Delete all keys for the current storage"""  # TODO[Karen]: Rewrite docstring
        with self._mem_cache_lock:
            self._mem_cache.clear()
        self._persist_storage.clear()

    def get_stats(self) -> list[int]:
        """Returns a list of stats in bytes for the cache memory storage per item"""

        with self._mem_cache_lock:
            return [len(item_value) for item_value in self._mem_cache.values()]

    def close(self) -> None:
        """Closes the cache storage"""
        self._persist_storage.close()

    def _read_from_mem_cache(self, key: str) -> bytes:
        with self._mem_cache_lock:
            if key in self._mem_cache:
                entry = bytes(self._mem_cache[key])
                _LOGGER.debug("Memory cache first stage HIT: %s", key)
                return entry

            else:
                _LOGGER.debug("Memory cache first stage MISS: %s", key)
                raise CacheStorageKeyNotFoundError("Key not found in mem cache")

    def _write_to_mem_cache(self, key: str, entry_bytes: bytes) -> None:
        with self._mem_cache_lock:
            self._mem_cache[key] = entry_bytes

    def _remove_from_mem_cache(self, key: str) -> None:
        with self._mem_cache_lock:
            self._mem_cache.pop(key, None)
