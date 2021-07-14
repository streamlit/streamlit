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
import contextlib
import functools
import hashlib
import math
import os
import pickle
import shutil
import threading
import time
import types
from collections import namedtuple
from typing import Optional, Any, Dict, List, Iterator

from cachetools import TTLCache

from streamlit import config, util, file_util
from streamlit.errors import StreamlitAPIWarning
from streamlit.logger import get_logger
from streamlit.memo.memo_hashing import update_memo_hash, HashReason
import streamlit as st

_LOGGER = get_logger(__name__)

# The timer function we use with TTLCache. This is the default timer func, but
# is exposed here as a constant so that it can be patched in unit tests.
_TTLCACHE_TIMER = time.monotonic


_DiskCacheEntry = namedtuple("_DiskCacheEntry", ["value"])


class _MemCaches:
    """Manages all in-memory st.cache caches"""

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


# A thread-local counter that's incremented when we enter @st.cache
# and decremented when we exit.
class ThreadLocalCacheInfo(threading.local):
    def __init__(self):
        self.cached_func_stack: List[types.FunctionType] = []
        self.suppress_st_function_warning = 0

    def __repr__(self) -> str:
        return util.repr_(self)


_cache_info = ThreadLocalCacheInfo()


@contextlib.contextmanager
def _calling_cached_function(func: types.FunctionType) -> Iterator[None]:
    _cache_info.cached_func_stack.append(func)
    try:
        yield
    finally:
        _cache_info.cached_func_stack.pop()


@contextlib.contextmanager
def suppress_cached_st_function_warning() -> Iterator[None]:
    _cache_info.suppress_st_function_warning += 1
    try:
        yield
    finally:
        _cache_info.suppress_st_function_warning -= 1
        assert _cache_info.suppress_st_function_warning >= 0


def _show_cached_st_function_warning(
    dg: "st.delta_generator.DeltaGenerator",
    st_func_name: str,
    cached_func: types.FunctionType,
) -> None:
    # Avoid infinite recursion by suppressing additional cached
    # function warnings from within the cached function warning.
    with suppress_cached_st_function_warning():
        e = CachedStFunctionWarning(st_func_name, cached_func)
        dg.exception(e)


def maybe_show_cached_st_function_warning(
    dg: "st.delta_generator.DeltaGenerator", st_func_name: str
) -> None:
    """If appropriate, warn about calling st.foo inside @cache.

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
    if (
        len(_cache_info.cached_func_stack) > 0
        and _cache_info.suppress_st_function_warning <= 0
    ):
        cached_func = _cache_info.cached_func_stack[-1]
        _show_cached_st_function_warning(dg, st_func_name, cached_func)


def _read_from_mem_cache(mem_cache: TTLCache, key: str) -> bytes:
    if key in mem_cache:
        entry = mem_cache[key]

        _LOGGER.debug("Memory cache HIT: %s", key)
        return entry

    else:
        _LOGGER.debug("Memory cache MISS: %s", key)
        raise CacheKeyNotFoundError("Key not found in mem cache")


def _write_to_mem_cache(mem_cache: TTLCache, key: str, data: bytes) -> None:
    mem_cache[key] = data


def _read_from_disk_cache(key: str) -> Any:
    path = file_util.get_streamlit_file_path("cache", "%s.pickle" % key)
    try:
        with file_util.streamlit_read(path, binary=True) as input:
            entry = pickle.load(input)
            value = entry.value
            _LOGGER.debug("Disk cache HIT: %s", type(value))
    except util.Error as e:
        _LOGGER.error(e)
        raise CacheError("Unable to read from cache: %s" % e)

    except FileNotFoundError:
        raise CacheKeyNotFoundError("Key not found in disk cache")
    return value


def _write_to_disk_cache(key: str, value: Any) -> None:
    path = file_util.get_streamlit_file_path("cache", "%s.pickle" % key)

    try:
        with file_util.streamlit_write(path, binary=True) as output:
            entry = _DiskCacheEntry(value=value)
            pickle.dump(entry, output, pickle.HIGHEST_PROTOCOL)
    except util.Error as e:
        _LOGGER.debug(e)
        # Clean up file so we don't leave zero byte files.
        try:
            os.remove(path)
        except (FileNotFoundError, IOError, OSError):
            pass
        raise CacheError("Unable to write to cache: %s" % e)


def _read_from_cache(mem_cache: TTLCache, key: str, persist: bool) -> Any:
    """Read a value from the cache."""
    try:
        return _read_from_mem_cache(mem_cache, key)

    except CacheKeyNotFoundError as e:
        if persist:
            value = _read_from_disk_cache(key)
            _write_to_mem_cache(mem_cache, key, value)
            return value
        raise e


def _write_to_cache(
    mem_cache: TTLCache,
    key: str,
    value: Any,
    persist: bool,
):
    _write_to_mem_cache(mem_cache, key, value)
    if persist:
        _write_to_disk_cache(key, value)


def memo(
    func=None,  # TODO: is there a reasonable type for this?
    persist: bool = False,
    show_spinner: bool = True,
    suppress_st_warning=False,
    max_entries: Optional[int] = None,
    ttl: Optional[float] = None,
):
    # Support passing the params via function decorator, e.g.
    # @st.memo(persist=True, show_spinner=False)
    if func is None:
        return lambda f: memo(
            func=f,
            persist=persist,
            show_spinner=show_spinner,
            suppress_st_warning=suppress_st_warning,
            max_entries=max_entries,
            ttl=ttl,
        )

    cache_key = None

    @functools.wraps(func)
    def wrapped_func(*args, **kwargs):
        """This function wrapper will only call the underlying function in
        the case of a cache miss. Cached objects are stored in the cache/
        directory."""

        if not config.get_option("client.caching"):
            _LOGGER.debug("Purposefully skipping cache")
            return func(*args, **kwargs)

        name = func.__qualname__

        if len(args) == 0 and len(kwargs) == 0:
            message = "Running `%s()`." % name
        else:
            message = "Running `%s(...)`." % name

            def get_or_create_cached_value():
                nonlocal cache_key
                if cache_key is None:
                    # Delay generating the cache key until the first call.
                    # This way we can see values of globals, including functions
                    # defined after this one.
                    # If we generated the key earlier we would only hash those
                    # globals by name, and miss changes in their code or value.
                    cache_key = _hash_func(func)

                # First, get the cache that's attached to this function.
                # This cache's key is generated (above) from the function's code.
                mem_cache = _mem_caches.get_cache(cache_key, max_entries, ttl)

                # Next, calculate the key for the value we'll be searching for
                # within that cache. This key is generated from both the function's
                # code and the arguments that are passed into it. (Even though this
                # key is used to index into a per-function cache, it must be
                # globally unique, because it is *also* used for a global on-disk
                # cache that is *not* per-function.)
                value_hasher = hashlib.new("md5")

                if args:
                    update_memo_hash(
                        args,
                        hasher=value_hasher,
                        hash_reason=HashReason.CACHING_FUNC_ARGS,
                        hash_source=func,
                    )

                if kwargs:
                    update_memo_hash(
                        kwargs,
                        hasher=value_hasher,
                        hash_reason=HashReason.CACHING_FUNC_ARGS,
                        hash_source=func,
                    )

                value_key = value_hasher.hexdigest()

                # Avoid recomputing the body's hash by just appending the
                # previously-computed hash to the arg hash.
                value_key = "%s-%s" % (value_key, cache_key)

                _LOGGER.debug("Cache key: %s", value_key)

                try:
                    return_value = _read_from_cache(
                        mem_cache=mem_cache,
                        key=value_key,
                        persist=persist,
                    )
                    _LOGGER.debug("Cache hit: %s", func)

                except CacheKeyNotFoundError:
                    _LOGGER.debug("Cache miss: %s", func)

                    with _calling_cached_function(func):
                        if suppress_st_warning:
                            with suppress_cached_st_function_warning():
                                return_value = func(*args, **kwargs)
                        else:
                            return_value = func(*args, **kwargs)

                    _write_to_cache(
                        mem_cache=mem_cache,
                        key=value_key,
                        value=return_value,
                        persist=persist,
                    )

                return return_value

            if show_spinner:
                with st.spinner(message):
                    return get_or_create_cached_value()
            else:
                return get_or_create_cached_value()

        # Make this a well-behaved decorator by preserving important function
        # attributes.
        try:
            wrapped_func.__dict__.update(func.__dict__)
        except AttributeError:
            pass

        return wrapped_func


def _hash_func(func: types.FunctionType) -> str:
    # Create the unique key for a function's cache. The cache will be retrieved
    # from inside the wrapped function.
    #
    # A naive implementation would involve simply creating the cache object
    # right in the wrapper, which in a normal Python script would be executed
    # only once. But in Streamlit, we reload all modules related to a user's
    # app when the app is re-run, which means that - among other things - all
    # function decorators in the app will be re-run, and so any decorator-local
    # objects will be recreated.
    #
    # Furthermore, our caches can be destroyed and recreated (in response to
    # cache clearing, for example), which means that retrieving the function's
    # cache in the decorator (so that the wrapped function can save a lookup)
    # is incorrect: the cache itself may be recreated between
    # decorator-evaluation time and decorated-function-execution time. So we
    # must retrieve the cache object *and* perform the cached-value lookup
    # inside the decorated function.
    func_hasher = hashlib.new("md5")

    # Include the function's __module__ and __qualname__ strings in the hash.
    # This means that two identical functions in different modules
    # will not share a hash; it also means that two identical *nested*
    # functions in the same module will not share a hash.
    # We do not pass `hash_funcs` here, because we don't want our function's
    # name to get an unexpected hash.
    update_memo_hash(
        (func.__module__, func.__qualname__),
        hasher=func_hasher,
        hash_reason=HashReason.CACHING_FUNC_BODY,
        hash_source=func,
    )

    # Include the function's body in the hash.
    update_memo_hash(
        func,
        hasher=func_hasher,
        hash_reason=HashReason.CACHING_FUNC_BODY,
        hash_source=func,
    )
    cache_key = func_hasher.hexdigest()
    _LOGGER.debug(
        "mem_cache key for %s.%s: %s", func.__module__, func.__qualname__, cache_key
    )
    return cache_key


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
