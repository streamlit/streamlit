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

import os
import threading

from cachetools import TTLCache

from streamlit import util
from streamlit.file_util import get_streamlit_file_path, streamlit_read, streamlit_write
from streamlit.logger import get_logger
from streamlit.runtime.caching import cache_utils
from streamlit.runtime.caching.storage.cache_storage_protocol import (
    CacheStorage,
    CacheStorageContext,
    CacheStorageError,
    CacheStorageKeyNotFoundError,
)

_LOGGER = get_logger(__name__)

# Streamlit directory where persisted @st.cache_data objects live.
# (This is the same directory that @st.cache persisted objects live.
# But @st.cache_data uses a different extension, so they don't overlap.)
_CACHE_DIR_NAME = "cache"

# The extension for our persisted @st.cache_data objects.
# (`@st.cache_data` was originally called `@st.memo`)
_CACHED_FILE_EXTENSION = "memo"


class OpenSourceCacheStorageFactory:
    def create(self, context: CacheStorageContext) -> OpenSourceCacheStorage:
        """Creates a new cache storage instance"""
        return OpenSourceCacheStorage(context)


class OpenSourceCacheStorage(CacheStorage):
    WORK_WITH_PERSIST_KEYWORD = True

    def __init__(self, context: CacheStorageContext):
        self.function_key = context.function_key
        self.persist = context.persist
        self.ttl_seconds = context.ttl_seconds
        self._mem_cache: TTLCache[str, bytes] = TTLCache(
            maxsize=context.max_entries,
            ttl=self.ttl_seconds,
            timer=cache_utils.TTLCACHE_TIMER,
        )
        self._mem_cache_lock = threading.Lock()

    def get(self, key: str) -> bytes:
        """Returns the stored value for the key or None if the key is not present"""
        try:
            entry_bytes = self._read_from_mem_cache(key)

        except CacheStorageKeyNotFoundError as e:
            if self.persist == "disk":
                entry_bytes = self._read_from_disk_cache(key)
                self._write_to_mem_cache(key, entry_bytes)
            else:
                raise e
        return entry_bytes

    def set(
        self,
        key: str,
        value: bytes,
    ) -> None:
        """Sets the value for a given key with a ttl expressed in milliseconds"""
        self._write_to_mem_cache(key, value)
        if self.persist == "disk":
            self._write_to_disk_cache(key, value)

    def delete(self, key: str) -> None:
        """Expires a given key"""
        self._remove_from_mem_cache(key)
        if self.persist == "disk":
            self._remove_from_disk_cache(key)

    def clear_all(self) -> None:
        """Expires all keys for the current storage"""

        with self._mem_cache_lock:
            # We keep a lock for the entirety of the clear operation to avoid
            # disk cache race conditions.
            for key in self._mem_cache.keys():
                self._remove_from_disk_cache(key)

            self._mem_cache.clear()

    def get_stats(self) -> list[int]:
        """Returns a list of stats in bytes for the cache storage per item"""
        return [1, 2, 3]

    def close(self) -> None:
        """Closes the cache storage"""

    def _read_from_disk_cache(self, key: str) -> bytes:
        path = self._get_file_path(key)
        try:
            with streamlit_read(path, binary=True) as input:
                value = input.read()
                _LOGGER.debug("Disk cache first stage HIT: %s!!!!!!!!!!!!!!!", key)
                # The value is a pickled CachedResult, but we don't unpickle it yet
                # so we can avoid having to repickle it when writing to the mem_cache
                return bytes(value)
        except FileNotFoundError:
            raise CacheStorageKeyNotFoundError("Key not found in disk cache")
        except Exception as ex:
            _LOGGER.error(ex)
            raise CacheStorageError("Unable to read from cache") from ex

    def _read_from_mem_cache(self, key: str) -> bytes:
        with self._mem_cache_lock:
            if key in self._mem_cache:
                entry = bytes(self._mem_cache[key])
                _LOGGER.debug("Memory cache first stage HIT: %s", key)
                return entry

            else:
                _LOGGER.debug("Memory cache MISS: %s", key)
                raise CacheStorageKeyNotFoundError("Key not found in mem cache")

    def _write_to_disk_cache(self, key: str, pickled_value: bytes) -> None:
        path = self._get_file_path(key)
        try:
            with streamlit_write(path, binary=True) as output:
                output.write(pickled_value)
        except util.Error as e:
            _LOGGER.debug(e)
            # Clean up file so we don't leave zero byte files.
            try:
                os.remove(path)
            except (FileNotFoundError, IOError, OSError):
                # If we can't remove the file, it's not a big deal.
                pass
            raise CacheStorageError("Unable to write to cache") from e

    def _write_to_mem_cache(self, key: str, entry_bytes: bytes) -> None:
        with self._mem_cache_lock:
            self._mem_cache[key] = entry_bytes

    def _remove_from_mem_cache(self, key: str) -> None:
        with self._mem_cache_lock:
            try:
                del self._mem_cache[key]
            except KeyError:
                pass

    def _remove_from_disk_cache(self, key: str) -> None:
        """Delete a cache file from disk. If the file does not exist on disk,
        return silently. If another exception occurs, log it. Does not throw.
        """
        path = self._get_file_path(key)
        try:
            os.remove(path)
        except FileNotFoundError:
            # The file is already removed.
            pass
        except Exception as ex:
            _LOGGER.exception(
                "Unable to remove a file from the disk cache", exc_info=ex
            )

    def _get_file_path(self, value_key: str) -> str:
        """Return the path of the disk cache file for the given value."""
        return get_streamlit_file_path(
            _CACHE_DIR_NAME,
            f"{self.function_key}-{value_key}.{_CACHED_FILE_EXTENSION}",
        )
