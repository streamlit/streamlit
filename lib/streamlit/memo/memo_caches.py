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
import types
from typing import Optional, Any, Dict

from cachetools import TTLCache

from streamlit import util, file_util
from streamlit.errors import StreamlitAPIWarning
from streamlit.logger import get_logger

_LOGGER = get_logger(__name__)

# The timer function we use with TTLCache. This is the default timer func, but
# is exposed here as a constant so that it can be patched in unit tests.
_TTLCACHE_TIMER = time.monotonic


class _MemCaches:
    """Manages all in-memory st.memo caches"""

    def __init__(self):
        # Contains a cache object for each st.cache'd function
        self._lock = threading.RLock()
        self._function_caches: Dict[str, TTLCache] = {}

    def __repr__(self) -> str:
        return util.repr_(self)

    def get_cache(
        self, key: str, max_entries: Optional[float], ttl: Optional[float]
    ) -> TTLCache:
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
        with self._lock:
            mem_cache = self._function_caches.get(key)
            if (
                mem_cache is not None
                and mem_cache.ttl == ttl
                and mem_cache.maxsize == max_entries
            ):
                return mem_cache

            # Create a new cache object and put it in our dict
            _LOGGER.debug(
                "Creating new mem_cache (key=%s, max_entries=%s, ttl=%s)",
                key,
                max_entries,
                ttl,
            )
            mem_cache = TTLCache(maxsize=max_entries, ttl=ttl, timer=_TTLCACHE_TIMER)
            self._function_caches[key] = mem_cache
            return mem_cache

    def clear(self) -> None:
        """Clear all caches"""
        with self._lock:
            self._function_caches = {}


# Our singleton _MemCaches instance
_mem_caches = _MemCaches()


def get_cache(key: str, max_entries: Optional[float], ttl: Optional[float]) -> TTLCache:
    """Get or create the cache with the given key."""
    return _mem_caches.get_cache(key, max_entries, ttl)


def _read_from_mem_cache(mem_cache: TTLCache, key: str) -> bytes:
    if key in mem_cache:
        entry = bytes(mem_cache[key])
        _LOGGER.debug("Memory cache HIT: %s", key)
        return entry

    else:
        _LOGGER.debug("Memory cache MISS: %s", key)
        raise CacheKeyNotFoundError("Key not found in mem cache")


def _write_to_mem_cache(mem_cache: TTLCache, key: str, pickled_value: bytes) -> None:
    mem_cache[key] = pickled_value


def _read_from_disk_cache(key: str) -> bytes:
    path = file_util.get_streamlit_file_path("cache", "%s.memo" % key)
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


def _write_to_disk_cache(key: str, pickled_value: bytes) -> None:
    path = file_util.get_streamlit_file_path("cache", "%s.memo" % key)
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


def read_from_cache(mem_cache: TTLCache, key: str, persist: bool) -> Any:
    """Read a value from the cache."""
    try:
        pickled_value = _read_from_mem_cache(mem_cache, key)

    except CacheKeyNotFoundError as e:
        if persist:
            pickled_value = _read_from_disk_cache(key)
            _write_to_mem_cache(mem_cache, key, pickled_value)
        else:
            raise e

    try:
        return pickle.loads(pickled_value)
    except pickle.UnpicklingError as exc:
        raise CacheError(f"Failed to unpickle {key}") from exc


def write_to_cache(
    mem_cache: TTLCache,
    key: str,
    value: Any,
    persist: bool,
):
    try:
        pickled_value = pickle.dumps(value)
    except pickle.PicklingError as exc:
        raise CacheError(f"Failed to pickle {key}") from exc

    _write_to_mem_cache(mem_cache, key, pickled_value)
    if persist:
        _write_to_disk_cache(key, pickled_value)


def clear_cache() -> bool:
    """Clear the memoization cache.

    Returns
    -------
    boolean
        True if the disk cache was cleared. False otherwise (e.g. cache file
        doesn't exist on disk).
    """
    _clear_mem_cache()
    return _clear_disk_cache()


def get_cache_path() -> str:
    return file_util.get_streamlit_file_path("cache")


def _clear_disk_cache() -> bool:
    # TODO: Only delete disk cache for functions related to the user's current
    # script.
    cache_path = get_cache_path()
    if os.path.isdir(cache_path):
        shutil.rmtree(cache_path)
        return True
    return False


def _clear_mem_cache() -> None:
    _mem_caches.clear()


class CacheError(Exception):
    pass


class CacheKeyNotFoundError(Exception):
    pass


class CachedStFunctionWarning(StreamlitAPIWarning):
    def __init__(self, st_func_name, cached_func):
        msg = self._get_message(st_func_name, cached_func)
        super(CachedStFunctionWarning, self).__init__(msg)

    def _get_message(self, st_func_name, cached_func):
        args = {
            "st_func_name": "`st.%s()` or `st.write()`" % st_func_name,
            "func_name": _get_cached_func_name_md(cached_func),
        }

        return (
            """
Your script uses %(st_func_name)s to write to your Streamlit app from within
some cached code at %(func_name)s. This code will only be called when we detect
a cache "miss", which can lead to unexpected results.

How to fix this:
* Move the %(st_func_name)s call outside %(func_name)s.
* Or, if you know what you're doing, use `@st.cache(suppress_st_warning=True)`
to suppress the warning.
            """
            % args
        ).strip("\n")


def _get_cached_func_name_md(func: types.FunctionType) -> str:
    """Get markdown representation of the function name."""
    if hasattr(func, "__name__"):
        return "`%s()`" % func.__name__
    else:
        return "a cached function"
