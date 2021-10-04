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

import threading
import types
from typing import Optional, Any, Dict

import streamlit as st
from streamlit.logger import get_logger
from .cache_utils import (
    Cache,
    create_cache_wrapper,
    CachedFunctionCallStack,
    CachedFunction,
)
from .cache_errors import CacheKeyNotFoundError, CacheType

_LOGGER = get_logger(__name__)


SINGLETON_CALL_STACK = CachedFunctionCallStack(CacheType.SINGLETON)


class SingletonFunction(CachedFunction):
    """Implements the CachedFunction protocol for @st.singleton"""

    @property
    def cache_type(self) -> CacheType:
        return CacheType.SINGLETON

    @property
    def call_stack(self) -> CachedFunctionCallStack:
        return SINGLETON_CALL_STACK

    def get_function_cache(self, function_key: str) -> Cache:
        return SingletonCache.get_cache(key=function_key)


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
        return lambda f: create_cache_wrapper(
            SingletonFunction(
                func=f,
                show_spinner=show_spinner,
                suppress_st_warning=suppress_st_warning,
            )
        )

    return create_cache_wrapper(
        SingletonFunction(
            func=func,
            show_spinner=show_spinner,
            suppress_st_warning=suppress_st_warning,
        )
    )


class SingletonCache(Cache):
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
        """
        with self._mem_cache_lock:
            if key in self._mem_cache:
                entry = self._mem_cache[key]
                return entry

            else:
                raise CacheKeyNotFoundError()

    def write_value(self, key: str, value: Any) -> None:
        """Write a value to the cache."""
        with self._mem_cache_lock:
            self._mem_cache[key] = value
