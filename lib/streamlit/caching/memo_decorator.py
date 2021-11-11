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

"""@st.memo: pickle-based caching"""
import os
import pickle
import shutil
import threading
import time
import types
from typing import Optional, Any, Dict, cast, List
from typing import Union

import math
from cachetools import TTLCache

import streamlit as st
from streamlit import util
from streamlit.errors import StreamlitAPIException
from streamlit.file_util import (
    streamlit_read,
    streamlit_write,
    get_streamlit_file_path,
)
from streamlit.logger import get_logger
from streamlit.stats import CacheStatsProvider, CacheStat
from .cache_errors import (
    CacheError,
    CacheKeyNotFoundError,
    CacheType,
)
from .cache_utils import (
    Cache,
    create_cache_wrapper,
    CachedFunctionCallStack,
    CachedFunction,
)

_LOGGER = get_logger(__name__)

# The timer function we use with TTLCache. This is the default timer func, but
# is exposed here as a constant so that it can be patched in unit tests.
_TTLCACHE_TIMER = time.monotonic

# Streamlit directory where persisted memoized items live.
# (This is the same directory that @st.cache persisted items live. But memoized
# items have a different extension, so they don't overlap.)
_CACHE_DIR_NAME = "cache"


MEMO_CALL_STACK = CachedFunctionCallStack(CacheType.MEMO)


class MemoCaches(CacheStatsProvider):
    """Manages all MemoCache instances"""

    def __init__(self):
        self._caches_lock = threading.Lock()
        self._function_caches: Dict[str, "MemoCache"] = {}

    def get_cache(
        self,
        key: str,
        persist: Optional[str],
        max_entries: Optional[Union[int, float]],
        ttl: Optional[Union[int, float]],
        display_name: str,
    ) -> "MemoCache":
        """Return the mem cache for the given key.

        If it doesn't exist, create a new one with the given params.
        """
        if max_entries is None:
            max_entries = math.inf
        if ttl is None:
            ttl = math.inf

        # Get the existing cache, if it exists, and validate that its params
        # haven't changed.
        with self._caches_lock:
            cache = self._function_caches.get(key)
            if (
                cache is not None
                and cache.ttl == ttl
                and cache.max_entries == max_entries
                and cache.persist == persist
            ):
                return cache

            # Create a new cache object and put it in our dict
            _LOGGER.debug(
                "Creating new MemoCache (key=%s, persist=%s, max_entries=%s, ttl=%s)",
                key,
                persist,
                max_entries,
                ttl,
            )
            cache = MemoCache(
                key=key,
                persist=persist,
                max_entries=max_entries,
                ttl=ttl,
                display_name=display_name,
            )
            self._function_caches[key] = cache
            return cache

    def clear_all(self) -> bool:
        """Clear all in-memory and on-disk caches.

        Returns
        -------
        bool
            True if the disk cache was cleared; False otherwise (i.e cache file
            doesn't exist on disk).
        """
        with self._caches_lock:
            self._function_caches = {}

            # TODO: Only delete disk cache for functions related to the user's
            #  current script.
            cache_path = get_cache_path()
            if os.path.isdir(cache_path):
                shutil.rmtree(cache_path)
                return True
            return False

    def get_stats(self) -> List[CacheStat]:
        with self._caches_lock:
            # Shallow-clone our caches. We don't want to hold the global
            # lock during stats-gathering.
            function_caches = self._function_caches.copy()

        stats: List[CacheStat] = []
        for cache in function_caches.values():
            stats.extend(cache.get_stats())
        return stats


# Singleton MemoCaches instance
_memo_caches = MemoCaches()


def get_memo_stats_provider() -> CacheStatsProvider:
    """Return the StatsProvider for all memoized functions."""
    return _memo_caches


class MemoizedFunction(CachedFunction):
    """Implements the FunctionCache protocol for @st.memo"""

    def __init__(
        self,
        func: types.FunctionType,
        show_spinner: bool,
        suppress_st_warning: bool,
        persist: Optional[str],
        max_entries: Optional[int],
        ttl: Optional[float],
    ):
        super().__init__(func, show_spinner, suppress_st_warning)
        self.persist = persist
        self.max_entries = max_entries
        self.ttl = ttl

    @property
    def cache_type(self) -> CacheType:
        return CacheType.MEMO

    @property
    def call_stack(self) -> CachedFunctionCallStack:
        return MEMO_CALL_STACK

    @property
    def display_name(self) -> str:
        """A human-readable name for the cached function"""
        return f"{self.func.__module__}.{self.func.__qualname__}"

    def get_function_cache(self, function_key: str) -> Cache:
        return _memo_caches.get_cache(
            key=function_key,
            persist=self.persist,
            max_entries=self.max_entries,
            ttl=self.ttl,
            display_name=self.display_name,
        )


def memo(
    func: Optional[types.FunctionType] = None,
    persist: Optional[str] = None,
    show_spinner: bool = True,
    suppress_st_warning=False,
    max_entries: Optional[int] = None,
    ttl: Optional[float] = None,
):
    """Function decorator to memoize function executions.

    Memoized data is stored in "pickled" form, which means that the return
    value of a memoized function must be pickleable.

    Each caller of a memoized function gets its own copy of the cached data.

    Parameters
    ----------
    func : callable
        The function to memoize. Streamlit hashes the function's source code.

    persist : str or None
        Optional location to persist cached data to. Currently, the only
        valid value is "disk", which will persist to the local disk.

    show_spinner : boolean
        Enable the spinner. Default is True to show a spinner when there is
        a cache miss.

    suppress_st_warning : boolean
        Suppress warnings about calling Streamlit functions from within
        the cached function.

    max_entries : int or None
        The maximum number of entries to keep in the cache, or None
        for an unbounded cache. (When a new entry is added to a full cache,
        the oldest cached entry will be removed.) The default is None.

    ttl : float or None
        The maximum number of seconds to keep an entry in the cache, or
        None if cache entries should not expire. The default is None.

    Example
    -------
    >>> @st.experimental_memo
    ... def fetch_and_clean_data(url):
    ...     # Fetch data from URL here, and then clean it up.
    ...     return data
    ...
    >>> d1 = fetch_and_clean_data(DATA_URL_1)
    >>> # Actually executes the function, since this is the first time it was
    >>> # encountered.
    >>>
    >>> d2 = fetch_and_clean_data(DATA_URL_1)
    >>> # Does not execute the function. Instead, returns its previously computed
    >>> # value. This means that now the data in d1 is the same as in d2.
    >>>
    >>> d3 = fetch_and_clean_data(DATA_URL_2)
    >>> # This is a different URL, so the function executes.

    To set the ``persist`` parameter, use this command as follows:

    >>> @st.experimental_memo(persist="disk")
    ... def fetch_and_clean_data(url):
    ...     # Fetch data from URL here, and then clean it up.
    ...     return data

    By default, all parameters to a memoized function must be hashable.
    Any parameter whose name begins with ``_`` will not be hashed. You can use
    this as an "escape hatch" for parameters that are not hashable:

    >>> @st.experimental_memo
    ... def fetch_and_clean_data(_db_connection, num_rows):
    ...     # Fetch data from _db_connection here, and then clean it up.
    ...     return data
    ...
    >>> connection = make_database_connection()
    >>> d1 = fetch_and_clean_data(connection, num_rows=10)
    >>> # Actually executes the function, since this is the first time it was
    >>> # encountered.
    >>>
    >>> another_connection = make_database_connection()
    >>> d2 = fetch_and_clean_data(another_connection, num_rows=10)
    >>> # Does not execute the function. Instead, returns its previously computed
    >>> # value - even though the _database_connection parameter was different
    >>> # in both calls.

    """

    if persist not in (None, "disk"):
        # We'll eventually have more persist options.
        raise StreamlitAPIException(
            f"Unsupported persist option '{persist}'. Valid values are 'disk' or None."
        )

    # Support passing the params via function decorator, e.g.
    # @st.memo(persist=True, show_spinner=False)
    if func is None:
        return lambda f: create_cache_wrapper(
            MemoizedFunction(
                func=f,
                persist=persist,
                show_spinner=show_spinner,
                suppress_st_warning=suppress_st_warning,
                max_entries=max_entries,
                ttl=ttl,
            )
        )

    return create_cache_wrapper(
        MemoizedFunction(
            func=func,
            persist=persist,
            show_spinner=show_spinner,
            suppress_st_warning=suppress_st_warning,
            max_entries=max_entries,
            ttl=ttl,
        )
    )


class MemoCache(Cache):
    """Manages cached values for a single st.memo-ized function."""

    def __init__(
        self,
        key: str,
        persist: Optional[str],
        max_entries: float,
        ttl: float,
        display_name: str,
    ):
        self.key = key
        self.display_name = display_name
        self.persist = persist
        self._mem_cache = TTLCache(maxsize=max_entries, ttl=ttl, timer=_TTLCACHE_TIMER)
        self._mem_cache_lock = threading.Lock()

    @property
    def max_entries(self) -> float:
        return cast(float, self._mem_cache.maxsize)

    @property
    def ttl(self) -> float:
        return cast(float, self._mem_cache.ttl)

    def get_stats(self) -> List[CacheStat]:
        stats: List[CacheStat] = []
        with self._mem_cache_lock:
            for item_key, item_value in self._mem_cache.items():
                stats.append(
                    CacheStat(
                        category_name="st_memo",
                        cache_name=self.display_name,
                        byte_length=len(item_value),
                    )
                )
        return stats

    def read_value(self, key: str) -> Any:
        """Read a value from the cache. Raise `CacheKeyNotFoundError` if the
        value doesn't exist, and `CacheError` if the value exists but can't
        be unpickled.
        """
        try:
            pickled_value = self._read_from_mem_cache(key)

        except CacheKeyNotFoundError as e:
            if self.persist == "disk":
                pickled_value = self._read_from_disk_cache(key)
                self._write_to_mem_cache(key, pickled_value)
            else:
                raise e

        try:
            return pickle.loads(pickled_value)
        except pickle.UnpicklingError as exc:
            raise CacheError(f"Failed to unpickle {key}") from exc

    def write_value(self, key: str, value: Any) -> None:
        """Write a value to the cache. It must be pickleable."""
        try:
            pickled_value = pickle.dumps(value)
        except pickle.PicklingError as exc:
            raise CacheError(f"Failed to pickle {key}") from exc

        self._write_to_mem_cache(key, pickled_value)
        if self.persist == "disk":
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
            with streamlit_read(path, binary=True) as input:
                value = input.read()
                _LOGGER.debug("Disk cache HIT: %s", key)
                return bytes(value)
        except FileNotFoundError:
            raise CacheKeyNotFoundError("Key not found in disk cache")
        except BaseException as e:
            _LOGGER.error(e)
            raise CacheError("Unable to read from cache") from e

    def _write_to_mem_cache(self, key: str, pickled_value: bytes) -> None:
        with self._mem_cache_lock:
            self._mem_cache[key] = pickled_value

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
                pass
            raise CacheError("Unable to write to cache") from e

    def _get_file_path(self, value_key: str):
        """Return the path of the disk cache file for the given value."""
        return get_streamlit_file_path(_CACHE_DIR_NAME, f"{self.key}-{value_key}.memo")


def get_cache_path() -> str:
    return get_streamlit_file_path(_CACHE_DIR_NAME)
