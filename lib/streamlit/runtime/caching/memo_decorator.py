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

"""@st.memo: pickle-based caching"""
import math
import os
import pickle
import shutil
import threading
import time
import types
from datetime import timedelta
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union, cast, overload

from cachetools import TTLCache

import streamlit as st
from streamlit import util
from streamlit.errors import StreamlitAPIException
from streamlit.file_util import get_streamlit_file_path, streamlit_read, streamlit_write
from streamlit.logger import get_logger
from streamlit.runtime.caching.cache_errors import (
    CacheError,
    CacheKeyNotFoundError,
    CacheType,
)
from streamlit.runtime.caching.cache_utils import (
    Cache,
    CachedFunction,
    CachedResult,
    CacheMessagesCallStack,
    CacheWarningCallStack,
    ElementMsgData,
    MsgData,
    MultiCacheResults,
    create_cache_wrapper,
)
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner.script_run_context import get_script_run_ctx
from streamlit.runtime.stats import CacheStat, CacheStatsProvider

_LOGGER = get_logger(__name__)

# The timer function we use with TTLCache. This is the default timer func, but
# is exposed here as a constant so that it can be patched in unit tests.
_TTLCACHE_TIMER = time.monotonic

# Streamlit directory where persisted memoized items live.
# (This is the same directory that @st.cache persisted items live. But memoized
# items have a different extension, so they don't overlap.)
_CACHE_DIR_NAME = "cache"

MEMO_CALL_STACK = CacheWarningCallStack(CacheType.MEMO)
MEMO_MESSAGE_CALL_STACK = CacheMessagesCallStack(CacheType.MEMO)


class MemoizedFunction(CachedFunction):
    """Implements the CachedFunction protocol for @st.memo"""

    def __init__(
        self,
        func: types.FunctionType,
        show_spinner: Union[bool, str],
        suppress_st_warning: bool,
        persist: Optional[str],
        max_entries: Optional[int],
        ttl: Optional[float],
        allow_widgets: bool,
    ):
        super().__init__(func, show_spinner, suppress_st_warning, allow_widgets)
        self.persist = persist
        self.max_entries = max_entries
        self.ttl = ttl

    @property
    def cache_type(self) -> CacheType:
        return CacheType.MEMO

    @property
    def warning_call_stack(self) -> CacheWarningCallStack:
        return MEMO_CALL_STACK

    @property
    def message_call_stack(self) -> CacheMessagesCallStack:
        return MEMO_MESSAGE_CALL_STACK

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
            allow_widgets=self.allow_widgets,
        )


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
        allow_widgets: bool,
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
                allow_widgets=allow_widgets,
            )
            self._function_caches[key] = cache
            return cache

    def clear_all(self) -> None:
        """Clear all in-memory and on-disk caches."""
        with self._caches_lock:
            self._function_caches = {}

            # TODO: Only delete disk cache for functions related to the user's
            #  current script.
            cache_path = get_cache_path()
            if os.path.isdir(cache_path):
                shutil.rmtree(cache_path)

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


class MemoAPI:
    """Implements the public st.memo API: the @st.memo decorator, and
    st.memo.clear().
    """

    # Type-annotate the decorator function.
    # (See https://mypy.readthedocs.io/en/stable/generics.html#decorator-factories)
    F = TypeVar("F", bound=Callable[..., Any])

    # Bare decorator usage
    @overload
    def __call__(self, func: F) -> F:
        ...

    # Decorator with arguments
    @overload
    def __call__(
        self,
        *,
        persist: Optional[str] = None,
        show_spinner: Union[bool, str] = True,
        suppress_st_warning: bool = False,
        max_entries: Optional[int] = None,
        ttl: Optional[Union[float, timedelta]] = None,
        experimental_allow_widgets: bool = False,
    ) -> Callable[[F], F]:
        ...

    # __call__ should be a static method, but there's a mypy bug that
    # breaks type checking for overloaded static functions:
    # https://github.com/python/mypy/issues/7781
    @gather_metrics
    def __call__(
        self,
        func: Optional[F] = None,
        *,
        persist: Optional[str] = None,
        show_spinner: Union[bool, str] = True,
        suppress_st_warning: bool = False,
        max_entries: Optional[int] = None,
        ttl: Optional[Union[float, timedelta]] = None,
        experimental_allow_widgets: bool = False,
    ):
        """Function decorator to memoize function executions.

        Memoized data is stored in "pickled" form, which means that the return
        value of a memoized function must be pickleable.

        Each caller of a memoized function gets its own copy of the cached data.

        You can clear a memoized function's cache with f.clear().

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

        ttl : float or timedelta or None
            The maximum number of seconds to keep an entry in the cache, or
            None if cache entries should not expire. The default is None.
            Note that ttl is incompatible with `persist="disk"` - `ttl` will be
            ignored if `persist` is specified.

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

        A memoized function's cache can be procedurally cleared:

        >>> @st.experimental_memo
        ... def fetch_and_clean_data(_db_connection, num_rows):
        ...     # Fetch data from _db_connection here, and then clean it up.
        ...     return data
        ...
        >>> fetch_and_clean_data.clear()
        >>> # Clear all cached entries for this function.

        """

        if persist not in (None, "disk"):
            # We'll eventually have more persist options.
            raise StreamlitAPIException(
                f"Unsupported persist option '{persist}'. Valid values are 'disk' or None."
            )

        ttl_seconds: Optional[float]

        if isinstance(ttl, timedelta):
            ttl_seconds = ttl.total_seconds()
        else:
            ttl_seconds = ttl

        def wrapper(f):
            # We use wrapper function here instead of lambda function to be able to log
            # warning in case both persist="disk" and ttl parameters specified
            if persist == "disk" and ttl is not None:
                _LOGGER.warning(
                    f"The memoized function '{f.__name__}' has a TTL that will be "
                    f"ignored. Persistent memo caches currently don't support TTL."
                )
            return create_cache_wrapper(
                MemoizedFunction(
                    func=f,
                    persist=persist,
                    show_spinner=show_spinner,
                    suppress_st_warning=suppress_st_warning,
                    max_entries=max_entries,
                    ttl=ttl_seconds,
                    allow_widgets=experimental_allow_widgets,
                )
            )

        # Support passing the params via function decorator, e.g.
        # @st.memo(persist=True, show_spinner=False)
        if func is None:
            return wrapper

        return create_cache_wrapper(
            MemoizedFunction(
                func=cast(types.FunctionType, func),
                persist=persist,
                show_spinner=show_spinner,
                suppress_st_warning=suppress_st_warning,
                max_entries=max_entries,
                ttl=ttl_seconds,
                allow_widgets=experimental_allow_widgets,
            )
        )

    @staticmethod
    @gather_metrics
    def clear() -> None:
        """Clear all in-memory and on-disk memo caches."""
        _memo_caches.clear_all()


class MemoCache(Cache):
    """Manages cached values for a single st.memo-ized function."""

    def __init__(
        self,
        key: str,
        persist: Optional[str],
        max_entries: float,
        ttl: float,
        display_name: str,
        allow_widgets: bool = False,
    ):
        self.key = key
        self.display_name = display_name
        self.persist = persist
        self._mem_cache: TTLCache[str, bytes] = TTLCache(
            maxsize=max_entries, ttl=ttl, timer=_TTLCACHE_TIMER
        )
        self._mem_cache_lock = threading.Lock()
        self.allow_widgets = allow_widgets

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

    def read_result(self, key: str) -> CachedResult:
        """Read a value and messages from the cache. Raise `CacheKeyNotFoundError`
        if the value doesn't exist, and `CacheError` if the value exists but can't
        be unpickled.
        """
        try:
            pickled_entry = self._read_from_mem_cache(key)

        except CacheKeyNotFoundError as e:
            if self.persist == "disk":
                pickled_entry = self._read_from_disk_cache(key)
                self._write_to_mem_cache(key, pickled_entry)
            else:
                raise e

        try:
            entry = pickle.loads(pickled_entry)
            if not isinstance(entry, MultiCacheResults):
                # Loaded an old cache file format, remove it and let the caller
                # rerun the function.
                self._remove_from_disk_cache(key)
                raise CacheKeyNotFoundError()

            ctx = get_script_run_ctx()
            if not ctx:
                raise CacheKeyNotFoundError()

            widget_key = entry.get_current_widget_key(ctx, CacheType.MEMO)
            if widget_key in entry.results:
                return entry.results[widget_key]
            else:
                raise CacheKeyNotFoundError()
        except pickle.UnpicklingError as exc:
            raise CacheError(f"Failed to unpickle {key}") from exc

    @gather_metrics
    def write_result(self, key: str, value: Any, messages: List[MsgData]) -> None:
        """Write a value and associated messages to the cache.
        The value must be pickleable.
        """
        ctx = get_script_run_ctx()
        if ctx is None:
            return

        main_id = st._main.id
        sidebar_id = st.sidebar.id

        if self.allow_widgets:
            widgets = {
                msg.widget_metadata.widget_id
                for msg in messages
                if isinstance(msg, ElementMsgData) and msg.widget_metadata is not None
            }
        else:
            widgets = set()

        first_stage_results: Optional[MultiCacheResults] = None

        # Try to find in mem cache, falling back to disk, then falling back
        # to a new result instance
        try:
            first_stage_results = self._read_multi_results_from_mem_cache(key)
        except (CacheKeyNotFoundError, pickle.UnpicklingError):
            if self.persist == "disk":
                try:
                    first_stage_results = self._read_multi_results_from_disk_cache(key)
                except CacheKeyNotFoundError:
                    pass

        if first_stage_results is None:
            first_stage_results = MultiCacheResults(widget_ids=widgets, results={})
        first_stage_results.widget_ids.update(widgets)
        widget_key = first_stage_results.get_current_widget_key(ctx, CacheType.MEMO)

        result = CachedResult(value, messages, main_id, sidebar_id)
        first_stage_results.results[widget_key] = result

        try:
            pickled_entry = pickle.dumps(first_stage_results)
        except pickle.PicklingError as exc:
            raise CacheError(f"Failed to pickle {key}") from exc

        self._write_to_mem_cache(key, pickled_entry)
        if self.persist == "disk":
            self._write_to_disk_cache(key, pickled_entry)

    def clear(self) -> None:
        with self._mem_cache_lock:
            # We keep a lock for the entirety of the clear operation to avoid
            # disk cache race conditions.
            for key in self._mem_cache.keys():
                self._remove_from_disk_cache(key)

            self._mem_cache.clear()

    def _read_from_mem_cache(self, key: str) -> bytes:
        with self._mem_cache_lock:
            if key in self._mem_cache:
                entry = bytes(self._mem_cache[key])
                _LOGGER.debug("Memory cache first stage HIT: %s", key)
                return entry

            else:
                _LOGGER.debug("Memory cache MISS: %s", key)
                raise CacheKeyNotFoundError("Key not found in mem cache")

    def _read_multi_results_from_mem_cache(self, key: str) -> MultiCacheResults:
        """Look up the results and ensure it has the right type.

        Raises a `CacheKeyNotFoundError` if the key has no entry, or if the
        entry is malformed.
        """
        pickled = self._read_from_mem_cache(key)
        maybe_results = pickle.loads(pickled)
        if isinstance(maybe_results, MultiCacheResults):
            return maybe_results
        else:
            with self._mem_cache_lock:
                del self._mem_cache[key]
            raise CacheKeyNotFoundError()

    def _read_from_disk_cache(self, key: str) -> bytes:
        path = self._get_file_path(key)
        try:
            with streamlit_read(path, binary=True) as input:
                value = input.read()
                _LOGGER.debug("Disk cache first stage HIT: %s", key)
                # The value is a pickled CachedResult, but we don't unpickle it yet
                # so we can avoid having to repickle it when writing to the mem_cache
                return bytes(value)
        except FileNotFoundError:
            raise CacheKeyNotFoundError("Key not found in disk cache")
        except BaseException as e:
            _LOGGER.error(e)
            raise CacheError("Unable to read from cache") from e

    def _read_multi_results_from_disk_cache(self, key: str) -> MultiCacheResults:
        """Look up the results from disk and ensure it has the right type.

        Raises a `CacheKeyNotFoundError` if the key has no entry, or if the
        entry is the wrong type, which usually means it was written by another
        version of streamlit.
        """
        pickled = self._read_from_disk_cache(key)
        maybe_results = pickle.loads(pickled)
        if isinstance(maybe_results, MultiCacheResults):
            return maybe_results
        else:
            self._remove_from_disk_cache(key)
            raise CacheKeyNotFoundError("Key not found in disk cache")

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

    def _remove_from_disk_cache(self, key: str) -> None:
        """Delete a cache file from disk. If the file does not exist on disk,
        return silently. If another exception occurs, log it. Does not throw.
        """
        path = self._get_file_path(key)
        try:
            os.remove(path)
        except FileNotFoundError:
            pass
        except BaseException as e:
            _LOGGER.exception("Unable to remove a file from the disk cache", e)

    def _get_file_path(self, value_key: str) -> str:
        """Return the path of the disk cache file for the given value."""
        return get_streamlit_file_path(_CACHE_DIR_NAME, f"{self.key}-{value_key}.memo")


def get_cache_path() -> str:
    return get_streamlit_file_path(_CACHE_DIR_NAME)
