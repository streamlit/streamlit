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

"""@st.singleton implementation"""

import contextlib
import functools
import threading
import types
from typing import Optional, Iterator, Any, Dict

import streamlit as st
from streamlit.logger import get_logger

from .cache_errors import CachedStFunctionWarning, CacheKeyNotFoundError, CacheType
from .cache_utils import ThreadLocalCacheInfo, make_function_key, make_value_key

_LOGGER = get_logger(__name__)


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
        e = CachedStFunctionWarning(CacheType.SINGLETON, st_func_name, cached_func)
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


def singleton(
    func: Optional[types.FunctionType] = None,
    show_spinner: bool = True,
    suppress_st_warning=False,
):
    """Function decorator to store singleton objects.

    Each singleton object is shared across all users connected to the app.
    Singleton objects *must* be thread-safe, because they can be accessed from
    multiple threads concurrently.

    (If thread-safety is an issue, consider using ``st.session_state`` to
    store per-session singleton objects instead.)

    Parameters
    ----------
    func : callable
        The function that creates the singleton. Streamlit hashes the
        function's source code.

    show_spinner : boolean
        Enable the spinner. Default is True to show a spinner when there is
        a "cache miss" and the singleton is being created.

    suppress_st_warning : boolean
        Suppress warnings about calling Streamlit functions from within
        the singleton function.

    Example
    -------
    >>> @st.experimental_singleton
    ... def get_database_session(url):
    ...     # Create a database session object that points to the URL.
    ...     return session
    ...
    >>> s1 = get_database_session(DATA_URL_1)
    >>> # Actually executes the function, since this is the first time it was
    >>> # encountered.
    >>>
    >>> s2 = get_database_session(DATA_URL_1)
    >>> # Does not execute the function. Instead, returns its previously computed
    >>> # value. This means that now the connection object in d1 is the same as in d2.
    >>>
    >>> s3 = get_database_session(DATA_URL_2)
    >>> # This is a different URL, so the function executes.

    By default, all parameters to a singleton function must be hashable.
    Any parameter whose name begins with ``_`` will not be hashed. You can use
    this as an "escape hatch" for parameters that are not hashable:

    >>> @st.experimental_singleton
    ... def get_database_session(_sessionmaker, url):
    ...     # Create a database connection object that points to the URL.
    ...     return connection
    ...
    >>> s1 = get_database_session(create_sessionmaker(), DATA_URL_1)
    >>> # Actually executes the function, since this is the first time it was
    >>> # encountered.
    >>>
    >>> s2 = get_database_session(create_sessionmaker(), DATA_URL_1)
    >>> # Does not execute the function. Instead, returns its previously computed
    >>> # value - even though the _sessionmaker parameter was different
    >>> # in both calls.

    """
    # Support passing the params via function decorator, e.g.
    # @st.singleton(show_spinner=False)
    if func is None:
        return lambda f: _make_singleton_wrapper(
            func=f,
            show_spinner=show_spinner,
            suppress_st_warning=suppress_st_warning,
        )

    return _make_singleton_wrapper(
        func=func,
        show_spinner=show_spinner,
        suppress_st_warning=suppress_st_warning,
    )


def _make_singleton_wrapper(
    func: types.FunctionType,
    show_spinner: bool = True,
    suppress_st_warning=False,
):
    # Generate the key for this function's cache.
    function_key = make_function_key(CacheType.SINGLETON, func)

    @functools.wraps(func)
    def wrapped_func(*args, **kwargs):
        """This function wrapper will only call the underlying function in
        the case of a cache miss."""

        name = func.__qualname__

        if len(args) == 0 and len(kwargs) == 0:
            message = "Running `%s()`." % name
        else:
            message = "Running `%s(...)`." % name

        def get_or_create_cached_value():
            # Get the cache that's attached to this function.
            # This cache's key is generated (above) from the function's code.
            cache = SingletonCache.get_cache(function_key)

            # Generate the key for the cached value. This is based on the
            # arguments passed to the function.
            value_key = make_value_key(CacheType.SINGLETON, func, *args, **kwargs)

            try:
                return_value = cache.read_value(key=value_key)
                _LOGGER.debug("Cache hit: %s", func)

            except CacheKeyNotFoundError:
                _LOGGER.debug("Cache miss: %s", func)

                with _calling_cached_function(func):
                    if suppress_st_warning:
                        with suppress_cached_st_function_warning():
                            return_value = func(*args, **kwargs)
                    else:
                        return_value = func(*args, **kwargs)

                cache.write_value(key=value_key, value=return_value)

            return return_value

        if show_spinner:
            with st.spinner(message):
                return get_or_create_cached_value()
        else:
            return get_or_create_cached_value()

    return wrapped_func


class SingletonCache:
    """Manages cached values for a single st.singleton function."""

    _caches_lock = threading.Lock()
    _function_caches: Dict[str, "SingletonCache"] = {}

    @classmethod
    def get_cache(cls, key: str) -> "SingletonCache":
        """Return the mem cache for the given key.

        If it doesn't exist, create a new one with the given params.
        """

        # Get the existing cache, if it exists, and validate that its params
        # haven't changed.
        with cls._caches_lock:
            cache = cls._function_caches.get(key)
            if cache is not None:
                return cache

            # Create a new cache object and put it in our dict
            _LOGGER.debug("Creating new SingletonCache (key=%s)", key)
            cache = SingletonCache(key=key)
            cls._function_caches[key] = cache
            return cache

    @classmethod
    def clear_all(cls) -> None:
        """Clear all singleton caches."""
        with cls._caches_lock:
            cls._function_caches = {}

    def __init__(self, key: str):
        self.key = key
        self._mem_cache: Dict[str, Any] = {}
        self._mem_cache_lock = threading.Lock()

    def read_value(self, key: str) -> Any:
        """Read a value from the cache. Raise `CacheKeyNotFoundError` if the
        value doesn't exist.

        Parameters
        ----------
        key : value's unique key

        Returns
        -------
        The cached value.

        Raises
        ------
        CacheKeyNotFoundError
            Raised if the value doesn't exist in the cache.

        """
        with self._mem_cache_lock:
            if key in self._mem_cache:
                entry = self._mem_cache[key]
                _LOGGER.debug("Memory cache HIT: %s", key)
                return entry

            else:
                _LOGGER.debug("Memory cache MISS: %s", key)
                raise CacheKeyNotFoundError("Key not found in mem cache")

    def write_value(self, key: str, value: Any) -> None:
        """Write a value to the cache. Value must be pickleable.

        Parameters
        ----------
        key : value's unique key
        value : value to write
        """
        with self._mem_cache_lock:
            self._mem_cache[key] = value
