# Copyright 2018-2022 Streamlit Inc.
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
import contextlib
import functools
import os
import pickle
import shutil
import threading
import time
import types
from typing import (
    Optional,
    Any,
    Dict,
    cast,
    List,
    Callable,
    TypeVar,
    overload,
    TYPE_CHECKING,
    Iterator,
    Tuple,
)
from typing import Union

import math
from cachetools import TTLCache
from attrs import define

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
    CachedStFunctionWarning,
)
from .cache_utils import (
    Cache,
    CachedFunction,
    CachedFunctionCallStack,
    _make_function_key,
    _make_value_key,
)

if TYPE_CHECKING:
    from google.protobuf.message import Message

_LOGGER = get_logger(__name__)

# The timer function we use with TTLCache. This is the default timer func, but
# is exposed here as a constant so that it can be patched in unit tests.
_TTLCACHE_TIMER = time.monotonic

# Streamlit directory where persisted memoized items live.
# (This is the same directory that @st.cache persisted items live. But memoized
# items have a different extension, so they don't overlap.)
_CACHE_DIR_NAME = "cache"

MsgPair = Tuple[str, "Message"]


@define
class MemoStackframeData:
    fn: types.FunctionType
    messages: List[MsgPair]


class MemoCachedFunctionCallStack(threading.local):
    """A utility for warning users when they call `st` commands inside
    a cached function. Internally, this is just a counter that's incremented
    when we enter a cache function, and decremented when we exit.

    Data is stored in a thread-local object, so it's safe to use an instance
    of this class across multiple threads.
    """

    def __init__(self, cache_type: CacheType):
        self._cached_func_stack: List[MemoStackframeData] = []
        self._suppress_st_function_warning = 0
        self._cache_type = cache_type

    def __repr__(self) -> str:
        return util.repr_(self)

    @contextlib.contextmanager
    def calling_cached_function(self, func: types.FunctionType) -> Iterator[None]:
        self._cached_func_stack.append(MemoStackframeData(func, []))
        try:
            yield
        finally:
            self._cached_func_stack.pop()

    @contextlib.contextmanager
    def suppress_cached_st_function_warning(self) -> Iterator[None]:
        self._suppress_st_function_warning += 1
        try:
            yield
        finally:
            self._suppress_st_function_warning -= 1
            assert self._suppress_st_function_warning >= 0

    def maybe_show_cached_st_function_warning(
        self, dg: "st.delta_generator.DeltaGenerator", st_func_name: str
    ) -> None:
        """If appropriate, warn about calling st.foo inside @memo.

        DeltaGenerator's @_with_element and @_widget wrappers use this to warn
        the user when they're calling st.foo() from within a function that is
        wrapped in @st.cache.

        Parameters
        ----------
        dg : DeltaGenerator
            The DeltaGenerator to publish the warning to.

        st_func_name : str
            The name of the Streamlit function that was called.

        """
        if len(self._cached_func_stack) > 0 and self._suppress_st_function_warning <= 0:
            cached_func = self._cached_func_stack[-1].fn
            self._show_cached_st_function_warning(dg, st_func_name, cached_func)

    def _show_cached_st_function_warning(
        self,
        dg: "st.delta_generator.DeltaGenerator",
        st_func_name: str,
        cached_func: types.FunctionType,
    ) -> None:
        # Avoid infinite recursion by suppressing additional cached
        # function warnings from within the cached function warning.
        with self.suppress_cached_st_function_warning():
            e = CachedStFunctionWarning(self._cache_type, st_func_name, cached_func)
            dg.exception(e)

    def maybe_save_element_message(self, delta_type: str, element_proto: "Message"):
        if len(self._cached_func_stack) > 0 and self._suppress_st_function_warning <= 0:
            self._cached_func_stack[-1].messages.append((delta_type, element_proto))


MEMO_CALL_STACK = MemoCachedFunctionCallStack(CacheType.MEMO)


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


class MemoizedFunction(CachedFunction):
    """Implements the CachedFunction protocol for @st.memo"""

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


class MemoAPI:
    """Implements the public st.memo API: the @st.memo decorator, and
    st.memo.clear().
    """

    # Type-annotate the decorator function.
    # (See https://mypy.readthedocs.io/en/stable/generics.html#decorator-factories)
    F = TypeVar("F", bound=Callable[..., Any])

    # Bare decorator usage
    @overload
    @staticmethod
    def __call__(func: F) -> F:
        ...

    # Decorator with arguments
    @overload
    @staticmethod
    def __call__(
        *,
        persist: Optional[str] = None,
        show_spinner: bool = True,
        suppress_st_warning: bool = False,
        max_entries: Optional[int] = None,
        ttl: Optional[float] = None,
    ) -> Callable[[F], F]:
        ...

    @staticmethod
    def __call__(
        func: Optional[F] = None,
        *,
        persist: Optional[str] = None,
        show_spinner: bool = True,
        suppress_st_warning: bool = False,
        max_entries: Optional[int] = None,
        ttl: Optional[float] = None,
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
                func=cast(types.FunctionType, func),
                persist=persist,
                show_spinner=show_spinner,
                suppress_st_warning=suppress_st_warning,
                max_entries=max_entries,
                ttl=ttl,
            )
        )

    @staticmethod
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
    ):
        self.key = key
        self.display_name = display_name
        self.persist = persist
        self._mem_cache = TTLCache(maxsize=max_entries, ttl=ttl, timer=_TTLCACHE_TIMER)
        self._mem_cache_lock = threading.Lock()
        self._message_cache = TTLCache(
            maxsize=max_entries, ttl=ttl, timer=_TTLCACHE_TIMER
        )

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

    def read_value(self, key: str) -> Tuple[Any, List[MsgPair]]:
        """Read a value from the cache. Raise `CacheKeyNotFoundError` if the
        value doesn't exist, and `CacheError` if the value exists but can't
        be unpickled.
        """
        try:
            pickled_value, messages = self._read_from_mem_cache(key)

        except CacheKeyNotFoundError as e:
            if self.persist == "disk":
                pickled_value = self._read_from_disk_cache(key)
                messages = []
                self._write_to_mem_cache(key, pickled_value, messages)
            else:
                raise e

        try:
            return pickle.loads(pickled_value), messages
        except pickle.UnpicklingError as exc:
            raise CacheError(f"Failed to unpickle {key}") from exc

    def write_value(self, key: str, value: Any, msgs: List[MsgPair]) -> None:
        """Write a value to the cache. It must be pickleable."""
        try:
            pickled_value = pickle.dumps(value)
        except pickle.PicklingError as exc:
            raise CacheError(f"Failed to pickle {key}") from exc

        self._write_to_mem_cache(key, pickled_value, msgs)
        if self.persist == "disk":
            self._write_to_disk_cache(key, pickled_value)

    def clear(self) -> None:
        with self._mem_cache_lock:
            # We keep a lock for the entirety of the clear operation to avoid
            # disk cache race conditions.
            for key in self._mem_cache.keys():
                self._remove_from_disk_cache(key)

            self._mem_cache.clear()
            self._message_cache.clear()

    def _read_from_mem_cache(self, key: str) -> Tuple[bytes, List[MsgPair]]:
        with self._mem_cache_lock:
            if key in self._mem_cache:
                entry = bytes(self._mem_cache[key])
                messages = self._message_cache[key]
                _LOGGER.debug("Memory cache HIT: %s", key)
                return (entry, messages)

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

    def _write_to_mem_cache(
        self, key: str, pickled_value: bytes, msgs: List[MsgPair]
    ) -> None:
        with self._mem_cache_lock:
            self._mem_cache[key] = pickled_value
            self._message_cache[key] = msgs

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


def create_cache_wrapper(cached_func: CachedFunction) -> Callable[..., Any]:
    """Create a wrapper for a CachedFunction. This implements the common
    plumbing for both st.memo and st.singleton.
    """
    func = cached_func.func
    function_key = _make_function_key(cached_func.cache_type, func)

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        """This function wrapper will only call the underlying function in
        the case of a cache miss.
        """

        # Retrieve the function's cache object. We must do this inside the
        # wrapped function, because caches can be invalidated at any time.
        cache = cached_func.get_function_cache(function_key)

        name = func.__qualname__

        if len(args) == 0 and len(kwargs) == 0:
            message = f"Running `{name}()`."
        else:
            message = f"Running `{name}(...)`."

        def get_or_create_cached_value():
            # Generate the key for the cached value. This is based on the
            # arguments passed to the function.
            value_key = _make_value_key(cached_func.cache_type, func, *args, **kwargs)

            try:
                return_value, messages = cache.read_value(value_key)
                _LOGGER.debug("Cache hit: %s", func)

                dg = st._main
                for delta_type, proto in messages:
                    dg._enqueue(delta_type, proto)

            except CacheKeyNotFoundError:
                _LOGGER.debug("Cache miss: %s", func)

                with cached_func.call_stack.calling_cached_function(func):
                    if cached_func.suppress_st_warning:
                        with cached_func.call_stack.suppress_cached_st_function_warning():
                            return_value = func(*args, **kwargs)
                    else:
                        return_value = func(*args, **kwargs)

                    messages = cached_func.call_stack._cached_func_stack[-1].messages

                cache.write_value(value_key, return_value, messages)

            return return_value

        if cached_func.show_spinner:
            with st.spinner(message):
                return get_or_create_cached_value()
        else:
            return get_or_create_cached_value()

    def clear():
        """Clear the wrapped function's associated cache."""
        cache = cached_func.get_function_cache(function_key)
        cache.clear()

    # Mypy doesn't support declaring attributes of function objects,
    # so we have to suppress a warning here. We can remove this suppression
    # when this issue is resolved: https://github.com/python/mypy/issues/2087
    wrapper.clear = clear  # type: ignore

    return wrapper
