# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""'Next-gen' caching"""

import math
import os
import pickle
import shutil
import threading
import time
from typing import Optional, Any, Dict, cast

from cachetools import TTLCache

from streamlit import util, file_util
from streamlit.logger import get_logger

_LOGGER = get_logger(__name__)

# The timer function we use with TTLCache. This is the default timer func, but
# is exposed here as a constant so that it can be patched in unit tests.
_TTLCACHE_TIMER = time.monotonic

# Streamlit directory where persisted cached items live.
_CACHE_DIR_NAME = "cache"


class CacheError(Exception):
    pass


class CacheKeyNotFoundError(Exception):
    pass


class MemoCache:
    """Manages cached values for a single st.memo-ized function."""

    _caches_lock = threading.Lock()
    _function_caches: Dict[str, "MemoCache"] = {}

    @classmethod
    def get_cache(
        cls, key: str, max_entries: Optional[float], ttl: Optional[float]
    ) -> "MemoCache":
        """Return the mem cache for the given key.

        If it doesn't exist, create a new one with the given params.
        """

        if max_entries is None:
            max_entries = math.inf
        if ttl is None:
            ttl = math.inf

        if not isinstance(max_entries, (int, float)):
            raise RuntimeError("max_entries must be an int")
        if not isinstance(ttl, (int, float)):
            raise RuntimeError("ttl must be a float")

        # Get the existing cache, if it exists, and validate that its params
        # haven't changed.
        with cls._caches_lock:
            cache = cls._function_caches.get(key)
            if (
                cache is not None
                and cache.ttl == ttl
                and cache.max_entries == max_entries
            ):
                return cache

            # Create a new cache object and put it in our dict
            _LOGGER.debug(
                "Creating new MemoCache (key=%s, max_entries=%s, ttl=%s)",
                key,
                max_entries,
                ttl,
            )
            cache = MemoCache(key=key, max_entries=max_entries, ttl=ttl)
            cls._function_caches[key] = cache
            return cache

    @classmethod
    def clear_all(cls) -> bool:
        """Clear all in-memory and on-disk caches.

        Returns
        -------
        bool
            True if the disk cache was cleared; False otherwise (i.e cache file
            doesn't exist on disk).
        """
        with cls._caches_lock:
            cls._function_caches = {}

            # TODO: Only delete disk cache for functions related to the user's
            #  current script.
            cache_path = get_cache_path()
            if os.path.isdir(cache_path):
                shutil.rmtree(cache_path)
                return True
            return False

    def __init__(self, key: str, max_entries: float, ttl: float):
        self.key = key
        self._mem_cache = TTLCache(maxsize=max_entries, ttl=ttl, timer=_TTLCACHE_TIMER)
        self._mem_cache_lock = threading.Lock()

    @property
    def max_entries(self) -> float:
        return cast(float, self._mem_cache.maxsize)

    @property
    def ttl(self) -> float:
        return cast(float, self._mem_cache.ttl)

    def read_value(self, key: str, persist: bool) -> Any:
        """Read a value from the cache. Raise `CacheKeyNotFoundError` if the
        value doesn't exist.

        Parameters
        ----------
        key : value's unique key
        persist : if True, and the value is missing from the memory cache,
            try reading it from disk.

        Returns
        -------
        The cached value.

        Raises
        ------
        CacheKeyNotFoundError
            Raised if the value doesn't exist in the cache.
        CacheError
            Raised if the value exists in the cache but can't be unpickled.

        """
        try:
            pickled_value = self._read_from_mem_cache(key)

        except CacheKeyNotFoundError as e:
            if persist:
                pickled_value = self._read_from_disk_cache(key)
                self._write_to_mem_cache(key, pickled_value)
            else:
                raise e

        try:
            return pickle.loads(pickled_value)
        except pickle.UnpicklingError as exc:
            raise CacheError(f"Failed to unpickle {key}") from exc

    def write_value(self, key: str, value: Any, persist: bool) -> None:
        """Write a value to the cache. Value must be pickleable.

        Parameters
        ----------
        key : value's unique key
        value : value to write
        persist : if True, also persist the value to disk.

        Raises
        ------
        CacheError
            Raised if the value is not pickleable.
        """
        try:
            pickled_value = pickle.dumps(value)
        except pickle.PicklingError as exc:
            raise CacheError(f"Failed to pickle {key}") from exc

        self._write_to_mem_cache(key, pickled_value)
        if persist:
            self._write_to_disk_cache(key, pickled_value)

    def _read_from_mem_cache(self, key: str) -> bytes:
        with self._mem_cache_lock:
            if key in self._mem_cache:
                entry = bytes(self._mem_cache[key])
                _LOGGER.debug("Memory cache HIT: %s", key)
                return entry

            else:
                _LOGGER.debug("Memory cache MISS: %s", key)
                raise CacheKeyNotFoundError("Key not found in mem cache")

    def _read_from_disk_cache(self, key: str) -> bytes:
        path = self._get_file_path(key)
        try:
            with file_util.streamlit_read(path, binary=True) as input:
                value = input.read()
                _LOGGER.debug("Disk cache HIT: %s", key)
                return bytes(value)
        except util.Error as e:
            _LOGGER.error(e)
            raise CacheError("Unable to read from cache") from e

        except FileNotFoundError:
            raise CacheKeyNotFoundError("Key not found in disk cache")

    def _write_to_mem_cache(self, key: str, pickled_value: bytes) -> None:
        with self._mem_cache_lock:
            self._mem_cache[key] = pickled_value

    def _write_to_disk_cache(self, key: str, pickled_value: bytes) -> None:
        path = self._get_file_path(key)
        try:
            with file_util.streamlit_write(path, binary=True) as output:
                output.write(pickled_value)
        except util.Error as e:
            _LOGGER.debug(e)
            # Clean up file so we don't leave zero byte files.
            try:
                os.remove(path)
            except (FileNotFoundError, IOError, OSError):
                pass
            raise CacheError("Unable to write to cache") from e

    def _get_file_path(self, value_key: str):
        """Return the path of the disk cache file for the given value."""
        return file_util.get_streamlit_file_path(
            _CACHE_DIR_NAME, f"{self.key}-{value_key}.memo"
        )


def get_cache_path() -> str:
    return file_util.get_streamlit_file_path(_CACHE_DIR_NAME)
