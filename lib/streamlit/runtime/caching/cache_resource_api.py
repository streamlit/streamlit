# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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


"""@st.cache_resource implementation."""

from __future__ import annotations

import math
import threading
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Final,
    TypeVar,
    overload,
)

from cachetools import TTLCache
from typing_extensions import ParamSpec, TypeAlias

import streamlit as st
from streamlit.logger import get_logger
from streamlit.runtime.caching import cache_utils
from streamlit.runtime.caching.cache_errors import CacheKeyNotFoundError
from streamlit.runtime.caching.cache_type import CacheType
from streamlit.runtime.caching.cache_utils import (
    Cache,
    CachedFunc,
    CachedFuncInfo,
    make_cached_func_wrapper,
)
from streamlit.runtime.caching.cached_message_replay import (
    CachedMessageReplayContext,
    CachedResult,
    MsgData,
)
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.stats import CacheStat, CacheStatsProvider, group_stats
from streamlit.time_util import time_to_seconds

if TYPE_CHECKING:
    from datetime import timedelta

    from streamlit.runtime.caching.hashing import HashFuncsDict

_LOGGER: Final = get_logger(__name__)


CACHE_RESOURCE_MESSAGE_REPLAY_CTX = CachedMessageReplayContext(CacheType.RESOURCE)

ValidateFunc: TypeAlias = Callable[[Any], bool]


def _equal_validate_funcs(a: ValidateFunc | None, b: ValidateFunc | None) -> bool:
    """True if the two validate functions are equal for the purposes of
    determining whether a given function cache needs to be recreated.
    """
    # To "properly" test for function equality here, we'd need to compare function bytecode.
    # For performance reasons, We've decided not to do that for now.
    return (a is None and b is None) or (a is not None and b is not None)


class ResourceCaches(CacheStatsProvider):
    """Manages all ResourceCache instances."""

    def __init__(self) -> None:
        self._caches_lock = threading.Lock()
        self._function_caches: dict[str, ResourceCache[Any]] = {}

    def get_cache(
        self,
        key: str,
        display_name: str,
        max_entries: int | float | None,
        ttl: float | timedelta | str | None,
        validate: ValidateFunc | None,
    ) -> ResourceCache[Any]:
        """Return the mem cache for the given key.

        If it doesn't exist, create a new one with the given params.
        """
        if max_entries is None:
            max_entries = math.inf

        ttl_seconds = time_to_seconds(ttl)

        # Get the existing cache, if it exists, and validate that its params
        # haven't changed.
        with self._caches_lock:
            cache = self._function_caches.get(key)
            if (
                cache is not None
                and cache.ttl_seconds == ttl_seconds
                and cache.max_entries == max_entries
                and _equal_validate_funcs(cache.validate, validate)
            ):
                return cache

            # Create a new cache object and put it in our dict
            _LOGGER.debug("Creating new ResourceCache (key=%s)", key)
            cache = ResourceCache(
                key=key,
                display_name=display_name,
                max_entries=max_entries,
                ttl_seconds=ttl_seconds,
                validate=validate,
            )
            self._function_caches[key] = cache
            return cache

    def clear_all(self) -> None:
        """Clear all resource caches."""
        with self._caches_lock:
            self._function_caches = {}

    def get_stats(self) -> list[CacheStat]:
        with self._caches_lock:
            # Shallow-clone our caches. We don't want to hold the global
            # lock during stats-gathering.
            function_caches = self._function_caches.copy()

        stats: list[CacheStat] = []
        for cache in function_caches.values():
            stats.extend(cache.get_stats())
        return group_stats(stats)


# Singleton ResourceCaches instance
_resource_caches = ResourceCaches()


def get_resource_cache_stats_provider() -> CacheStatsProvider:
    """Return the StatsProvider for all @st.cache_resource functions."""
    return _resource_caches


P = ParamSpec("P")
R = TypeVar("R")


class CachedResourceFuncInfo(CachedFuncInfo[P, R]):
    """Implements the CachedFuncInfo interface for @st.cache_resource."""

    def __init__(
        self,
        func: Callable[P, R],
        show_spinner: bool | str,
        max_entries: int | None,
        ttl: float | timedelta | str | None,
        validate: ValidateFunc | None,
        hash_funcs: HashFuncsDict | None = None,
        show_time: bool = False,
    ) -> None:
        super().__init__(
            func,
            hash_funcs=hash_funcs,
            show_spinner=show_spinner,
            show_time=show_time,
        )
        self.max_entries = max_entries
        self.ttl = ttl
        self.validate = validate

    @property
    def cache_type(self) -> CacheType:
        return CacheType.RESOURCE

    @property
    def cached_message_replay_ctx(self) -> CachedMessageReplayContext:
        return CACHE_RESOURCE_MESSAGE_REPLAY_CTX

    @property
    def display_name(self) -> str:
        """A human-readable name for the cached function."""
        return f"{self.func.__module__}.{self.func.__qualname__}"

    def get_function_cache(self, function_key: str) -> Cache[R]:
        return _resource_caches.get_cache(
            key=function_key,
            display_name=self.display_name,
            max_entries=self.max_entries,
            ttl=self.ttl,
            validate=self.validate,
        )


class CacheResourceAPI:
    """Implements the public st.cache_resource API: the @st.cache_resource decorator,
    and st.cache_resource.clear().
    """

    def __init__(self, decorator_metric_name: str) -> None:
        """Create a CacheResourceAPI instance.

        Parameters
        ----------
        decorator_metric_name
            The metric name to record for decorator usage.
        """

        # Parameterize the decorator metric name.
        # (Ignore spurious mypy complaints - https://github.com/python/mypy/issues/2427)
        self._decorator = gather_metrics(decorator_metric_name, self._decorator)  # type: ignore

    # Type-annotate the decorator function.
    # (See https://mypy.readthedocs.io/en/stable/generics.html#decorator-factories)

    # Bare decorator usage
    @overload
    def __call__(self, func: Callable[P, R]) -> CachedFunc[P, R]: ...

    # Decorator with arguments
    @overload
    def __call__(
        self,
        *,
        ttl: float | timedelta | str | None = None,
        max_entries: int | None = None,
        show_spinner: bool | str = True,
        show_time: bool = False,
        validate: ValidateFunc | None = None,
        hash_funcs: HashFuncsDict | None = None,
    ) -> Callable[[Callable[P, R]], CachedFunc[P, R]]: ...

    def __call__(
        self,
        func: Callable[P, R] | None = None,
        *,
        ttl: float | timedelta | str | None = None,
        max_entries: int | None = None,
        show_spinner: bool | str = True,
        show_time: bool = False,
        validate: ValidateFunc | None = None,
        hash_funcs: HashFuncsDict | None = None,
    ) -> CachedFunc[P, R] | Callable[[Callable[P, R]], CachedFunc[P, R]]:
        return self._decorator(
            func,
            ttl=ttl,
            max_entries=max_entries,
            show_spinner=show_spinner,
            show_time=show_time,
            validate=validate,
            hash_funcs=hash_funcs,
        )

    def _decorator(
        self,
        func: Callable[P, R] | None,
        *,
        ttl: float | timedelta | str | None,
        max_entries: int | None,
        show_spinner: bool | str,
        show_time: bool = False,
        validate: ValidateFunc | None,
        hash_funcs: HashFuncsDict | None = None,
    ) -> CachedFunc[P, R] | Callable[[Callable[P, R]], CachedFunc[P, R]]:
        """Decorator to cache functions that return global resources (e.g. database connections, ML models).

        Cached objects are shared across all users, sessions, and reruns. They
        must be thread-safe because they can be accessed from multiple threads
        concurrently. If thread safety is an issue, consider using ``st.session_state``
        to store resources per session instead.

        You can clear a function's cache with ``func.clear()`` or clear the entire
        cache with ``st.cache_resource.clear()``.

        A function's arguments must be hashable to cache it. If you have an
        unhashable argument (like a database connection) or an argument you
        want to exclude from caching, use an underscore prefix in the argument
        name. In this case, Streamlit will return a cached value when all other
        arguments match a previous function call. Alternatively, you can
        declare custom hashing functions with ``hash_funcs``.

        Cached values are available to all users of your app. If you need to
        save results that should only be accessible within a session, use
        `Session State
        <https://docs.streamlit.io/develop/concepts/architecture/session-state>`_
        instead. Within each user session, an ``@st.cache_resource``-decorated
        function returns the cached instance of the return value (if the value
        is already cached). Therefore, objects cached by ``st.cache_resource``
        act like singletons and can mutate. To cache data and return copies,
        use ``st.cache_data`` instead. To learn more about caching, see
        `Caching overview
        <https://docs.streamlit.io/develop/concepts/architecture/caching>`_.

        .. warning::
            Async objects are not officially supported in Streamlit. Caching
            async objects or objects that reference async objects may have
            unintended consequences. For example, Streamlit may close event
            loops in its normal operation and make the cached object raise an
            ``Event loop closed`` error.

            To upvote official ``asyncio`` support, see GitHub issue `#8488
            <https://github.com/streamlit/streamlit/issues/8488>`_. To upvote
            support for caching async functions, see GitHub issue `#8308
            <https://github.com/streamlit/streamlit/issues/8308>`_.

        Parameters
        ----------
        func : callable
            The function that creates the cached resource. Streamlit hashes the
            function's source code.

        ttl : float, timedelta, str, or None
            The maximum time to keep an entry in the cache. Can be one of:

            - ``None`` if cache entries should never expire (default).
            - A number specifying the time in seconds.
            - A string specifying the time in a format supported by `Pandas's
              Timedelta constructor <https://pandas.pydata.org/docs/reference/api/pandas.Timedelta.html>`_,
              e.g. ``"1d"``, ``"1.5 days"``, or ``"1h23s"``.
            - A ``timedelta`` object from `Python's built-in datetime library
              <https://docs.python.org/3/library/datetime.html#timedelta-objects>`_,
              e.g. ``timedelta(days=1)``.

        max_entries : int or None
            The maximum number of entries to keep in the cache, or None
            for an unbounded cache. When a new entry is added to a full cache,
            the oldest cached entry will be removed. Defaults to None.

        show_spinner : bool or str
            Enable the spinner. Default is True to show a spinner when there is
            a "cache miss" and the cached resource is being created. If string,
            value of show_spinner param will be used for spinner text.

        show_time : bool
            Whether to show the elapsed time next to the spinner text. If this is
            ``False`` (default), no time is displayed. If this is ``True``,
            elapsed time is displayed with a precision of 0.1 seconds. The time
            format is not configurable.

        validate : callable or None
            An optional validation function for cached data. ``validate`` is called
            each time the cached value is accessed. It receives the cached value as
            its only parameter and it must return a boolean. If ``validate`` returns
            False, the current cached value is discarded, and the decorated function
            is called to compute a new value. This is useful e.g. to check the
            health of database connections.

        hash_funcs : dict or None
            Mapping of types or fully qualified names to hash functions.
            This is used to override the behavior of the hasher inside Streamlit's
            caching mechanism: when the hasher encounters an object, it will first
            check to see if its type matches a key in this dict and, if so, will use
            the provided function to generate a hash for it. See below for an example
            of how this can be used.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> @st.cache_resource
        ... def get_database_session(url):
        ...     # Create a database session object that points to the URL.
        ...     return session
        >>>
        >>> s1 = get_database_session(SESSION_URL_1)
        >>> # Actually executes the function, since this is the first time it was
        >>> # encountered.
        >>>
        >>> s2 = get_database_session(SESSION_URL_1)
        >>> # Does not execute the function. Instead, returns its previously computed
        >>> # value. This means that now the connection object in s1 is the same as in s2.
        >>>
        >>> s3 = get_database_session(SESSION_URL_2)
        >>> # This is a different URL, so the function executes.

        By default, all parameters to a cache_resource function must be hashable.
        Any parameter whose name begins with ``_`` will not be hashed. You can use
        this as an "escape hatch" for parameters that are not hashable:

        >>> import streamlit as st
        >>>
        >>> @st.cache_resource
        ... def get_database_session(_sessionmaker, url):
        ...     # Create a database connection object that points to the URL.
        ...     return connection
        >>>
        >>> s1 = get_database_session(create_sessionmaker(), DATA_URL_1)
        >>> # Actually executes the function, since this is the first time it was
        >>> # encountered.
        >>>
        >>> s2 = get_database_session(create_sessionmaker(), DATA_URL_1)
        >>> # Does not execute the function. Instead, returns its previously computed
        >>> # value - even though the _sessionmaker parameter was different
        >>> # in both calls.

        A cache_resource function's cache can be procedurally cleared:

        >>> import streamlit as st
        >>>
        >>> @st.cache_resource
        ... def get_database_session(_sessionmaker, url):
        ...     # Create a database connection object that points to the URL.
        ...     return connection
        >>>
        >>> fetch_and_clean_data.clear(_sessionmaker, "https://streamlit.io/")
        >>> # Clear the cached entry for the arguments provided.
        >>>
        >>> get_database_session.clear()
        >>> # Clear all cached entries for this function.

        To override the default hashing behavior, pass a custom hash function.
        You can do that by mapping a type (e.g. ``Person``) to a hash
        function (``str``) like this:

        >>> import streamlit as st
        >>> from pydantic import BaseModel
        >>>
        >>> class Person(BaseModel):
        ...     name: str
        >>>
        >>> @st.cache_resource(hash_funcs={Person: str})
        ... def get_person_name(person: Person):
        ...     return person.name

        Alternatively, you can map the type's fully-qualified name
        (e.g. ``"__main__.Person"``) to the hash function instead:

        >>> import streamlit as st
        >>> from pydantic import BaseModel
        >>>
        >>> class Person(BaseModel):
        ...     name: str
        >>>
        >>> @st.cache_resource(hash_funcs={"__main__.Person": str})
        ... def get_person_name(person: Person):
        ...     return person.name
        """

        # Support passing the params via function decorator, e.g.
        # @st.cache_resource(show_spinner=False)
        if func is None:
            return lambda f: make_cached_func_wrapper(
                CachedResourceFuncInfo(
                    func=f,
                    show_spinner=show_spinner,
                    show_time=show_time,
                    max_entries=max_entries,
                    ttl=ttl,
                    validate=validate,
                    hash_funcs=hash_funcs,
                )
            )

        return make_cached_func_wrapper(
            CachedResourceFuncInfo(
                func=func,
                show_spinner=show_spinner,
                show_time=show_time,
                max_entries=max_entries,
                ttl=ttl,
                validate=validate,
                hash_funcs=hash_funcs,
            )
        )

    @gather_metrics("clear_resource_caches")
    def clear(self) -> None:
        """Clear all cache_resource caches."""
        _resource_caches.clear_all()


class ResourceCache(Cache[R]):
    """Manages cached values for a single st.cache_resource function."""

    def __init__(
        self,
        key: str,
        max_entries: float,
        ttl_seconds: float,
        validate: ValidateFunc | None,
        display_name: str,
    ) -> None:
        super().__init__()
        self.key = key
        self.display_name = display_name
        self._mem_cache: TTLCache[str, CachedResult[R]] = TTLCache(
            maxsize=max_entries, ttl=ttl_seconds, timer=cache_utils.TTLCACHE_TIMER
        )
        self._mem_cache_lock = threading.Lock()
        self.validate = validate

    @property
    def max_entries(self) -> float:
        return self._mem_cache.maxsize

    @property
    def ttl_seconds(self) -> float:
        return self._mem_cache.ttl

    def read_result(self, key: str) -> CachedResult[R]:
        """Read a value and associated messages from the cache.
        Raise `CacheKeyNotFoundError` if the value doesn't exist.
        """
        with self._mem_cache_lock:
            if key not in self._mem_cache:
                # key does not exist in cache.
                raise CacheKeyNotFoundError()

            result = self._mem_cache[key]

            if self.validate is not None and not self.validate(result.value):
                # Validate failed: delete the entry and raise an error.
                del self._mem_cache[key]
                raise CacheKeyNotFoundError()

            return result

    @gather_metrics("_cache_resource_object")
    def write_result(self, key: str, value: R, messages: list[MsgData]) -> None:
        """Write a value and associated messages to the cache."""
        main_id = st._main.id
        sidebar_id = st.sidebar.id

        with self._mem_cache_lock:
            self._mem_cache[key] = CachedResult(value, messages, main_id, sidebar_id)

    def _clear(self, key: str | None = None) -> None:
        with self._mem_cache_lock:
            if key is None:
                self._mem_cache.clear()
            elif key in self._mem_cache:
                del self._mem_cache[key]

    def get_stats(self) -> list[CacheStat]:
        # Shallow clone our cache. Computing item sizes is potentially
        # expensive, and we want to minimize the time we spend holding
        # the lock.
        with self._mem_cache_lock:
            cache_entries = list(self._mem_cache.values())

        # Lazy-load vendored package to prevent import of numpy
        from streamlit.vendor.pympler.asizeof import asizeof

        return [
            CacheStat(
                category_name="st_cache_resource",
                cache_name=self.display_name,
                byte_length=asizeof(entry),
            )
            for entry in cache_entries
        ]
