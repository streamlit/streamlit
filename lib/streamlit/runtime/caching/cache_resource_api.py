# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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
from collections.abc import Callable, Sequence
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    TypeAlias,
    TypeVar,
    overload,
)

from typing_extensions import ParamSpec

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger
from streamlit.runtime.caching import cache_utils
from streamlit.runtime.caching.cache_errors import CacheKeyNotFoundError
from streamlit.runtime.caching.cache_type import CacheType
from streamlit.runtime.caching.cache_utils import (
    Cache,
    CachedFunc,
    CachedFuncInfo,
    CacheScope,
    OnRelease,
    get_session_id_or_throw,
    make_cached_func_wrapper,
)
from streamlit.runtime.caching.cached_message_replay import (
    CachedMessageReplayContext,
    CachedResult,
    MsgData,
)
from streamlit.runtime.caching.ttl_cleanup_cache import TTLCleanupCache
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.stats import (
    CACHE_MEMORY_FAMILY,
    CacheStat,
    StatsProvider,
    group_cache_stats,
)
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


def _no_op_release(ignored: Any) -> None:
    """No-op OnRelease function."""


class ResourceCaches(StatsProvider):
    """Manages all ResourceCache instances."""

    def __init__(self) -> None:
        self._caches_lock = threading.Lock()
        # Map of session IDs to map of function keys to caches.
        self._function_caches: dict[str | None, dict[str, ResourceCache[Any]]] = {}

    @property
    def stats_families(self) -> Sequence[str]:
        return (CACHE_MEMORY_FAMILY,)

    def get_cache(
        self,
        key: str,
        display_name: str,
        max_entries: int | float | None,
        ttl: float | timedelta | str | None,
        validate: ValidateFunc | None,
        on_release: OnRelease,
        scope: CacheScope = "global",
    ) -> ResourceCache[Any]:
        """Return the mem cache for the given key.

        If it doesn't exist, create a new one with the given params.

        Raises
        ------
        StreamlitAPIException
            Raised when ``scope`` is ``"session"`` and there is no thread-local run
            context.
        """
        if max_entries is None:
            max_entries = math.inf

        ttl_seconds = time_to_seconds(ttl)

        # Fetch the session ID. Note that this will throw an exception if there is no
        # session associated with the current thread.
        session_id: str | None
        if scope == "global":
            session_id = None
        else:
            session_id = get_session_id_or_throw()

        # Get the existing cache, if it exists, and validate that its params
        # haven't changed.
        with self._caches_lock:
            session_caches = self._function_caches.get(session_id)
            if session_caches is None:
                session_caches = self._function_caches[session_id] = {}

            cache = session_caches.get(key)
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
                on_release=on_release,
            )
            self._function_caches[session_id][key] = cache
            return cache

    def clear_session(self, session_id: str) -> None:
        """Clears all caches for the given session ID."""
        # Hold the lock while removing the cache, but release it while clearing.
        with self._caches_lock:
            session_caches = self._function_caches.get(session_id)
            if session_caches is not None:
                del self._function_caches[session_id]

        if session_caches is not None:
            for cache in session_caches.values():
                cache.clear()

    def clear_all(self) -> None:
        """Clear all resource caches."""
        # Hold the lock long enough to copy the caches.
        with self._caches_lock:
            caches = [
                cache
                for caches in self._function_caches.values()
                for cache in caches.values()
            ]
            self._function_caches = {}

        # Clear each cache to ensure any on_release functions are called.
        for cache in caches:
            cache.clear()

    def get_stats(
        self, _family_names: Sequence[str] | None = None
    ) -> dict[str, list[CacheStat]]:
        function_caches: list[ResourceCache[Any]]
        with self._caches_lock:
            # Shallow-clone our caches. We don't want to hold the global
            # lock during stats-gathering.
            function_caches = [
                cache
                for caches in self._function_caches.values()
                for cache in caches.values()
            ]

        stats: list[CacheStat] = []
        for cache in function_caches:
            cache_stats = cache.get_stats()
            for family_stats in cache_stats.values():
                stats.extend(family_stats)
        if not stats:
            return {}
        # In general, get_stats methods need to be able to return only requested stat
        # families, but this method only returns a single family, and we're guaranteed
        # that it was one of those requested if we make it here.
        return {CACHE_MEMORY_FAMILY: group_cache_stats(stats)}


# Singleton ResourceCaches instance
_resource_caches = ResourceCaches()


def clear_session_cache(session_id: str) -> None:
    """Clears all caches for the given session ID."""
    _resource_caches.clear_session(session_id)


def get_resource_cache_stats_provider() -> StatsProvider:
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
        on_release: OnRelease | None = None,
        scope: CacheScope = "global",
    ) -> None:
        super().__init__(
            func,
            hash_funcs=hash_funcs,
            show_spinner=show_spinner,
            show_time=show_time,
            scope=scope,
        )
        self.max_entries = max_entries
        self.ttl = ttl
        self.validate = validate
        self.on_release = on_release or _no_op_release

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
            on_release=self.on_release,
            scope=self.scope,
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
        on_release: OnRelease | None = None,
        scope: CacheScope = "global",
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
        on_release: OnRelease | None = None,
        scope: CacheScope = "global",
    ) -> CachedFunc[P, R] | Callable[[Callable[P, R]], CachedFunc[P, R]]:
        return self._decorator(  # ty: ignore[missing-argument]
            func,  # ty: ignore[invalid-argument-type]
            ttl=ttl,
            max_entries=max_entries,
            show_spinner=show_spinner,
            show_time=show_time,
            validate=validate,
            hash_funcs=hash_funcs,
            on_release=on_release,
            scope=scope,
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
        on_release: OnRelease | None = None,
        scope: CacheScope = "global",
    ) -> CachedFunc[P, R] | Callable[[Callable[P, R]], CachedFunc[P, R]]:
        """Decorator to cache functions that return resource objects (e.g. database connections, ML models).

        Cached objects can be global or session-scoped. Global resources are
        shared across all users, sessions, and reruns. Session-scoped resources are
        scoped to the current session and are removed when the session disconnects.
        Global resources must be thread-safe. If thread safety is an issue,
        consider using a session-scoped cache or storing the resource in
        ``st.session_state`` instead.

        You can clear a function's cache with ``func.clear()`` or clear the entire
        cache with ``st.cache_resource.clear()``.

        A function's arguments must be hashable to cache it. Streamlit makes a
        best effort to hash a variety of objects, but the fallback hashing method
        requires that the argument be pickleable, also. If you have an unhashable
        argument (like a database connection) or an argument you want to exclude
        from caching, use an underscore prefix in the argument name. In this case,
        Streamlit will return a cached value when all other arguments match a
        previous function call. Alternatively, you can declare custom hashing
        functions with ``hash_funcs``.

        Objects cached by ``st.cache_resource`` act like singletons and can
        mutate. To cache data and return copies, use ``st.cache_data`` instead.
        To learn more about caching, see `Caching overview
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
            The maximum age of a returned entry from the cache. This can be one
            of the following values:

            - ``None`` if cache entries should never expire (default).
            - A number specifying the time in seconds.
            - A string specifying the time in a format supported by `Pandas's
              Timedelta constructor <https://pandas.pydata.org/docs/reference/api/pandas.Timedelta.html>`_,
              e.g. ``"1d"``, ``"1.5 days"``, or ``"1h23s"``. Note that number strings
              without units are treated by Pandas as nanoseconds.
            - A ``timedelta`` object from `Python's built-in datetime library
              <https://docs.python.org/3/library/datetime.html#timedelta-objects>`_,
              e.g. ``timedelta(days=1)``.

            Changes to this value will trigger a new cache to be created.

        max_entries : int or None
            The maximum number of entries to keep in the cache, or None
            for an unbounded cache. When a new entry is added to a full cache,
            the oldest cached entry will be removed. Defaults to None.

            Changes to this value will trigger a new cache to be created.

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
            An optional validation function for cached resources. ``validate`` is called
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

        on_release : callable or None
            A function to call when an entry is removed from the cache.
            The removed item will be provided to the function as an argument.

            This is only useful for caches that remove entries normally.
            Most commonly, this is used session-scoped caches to release
            per-session resources. This can also be used with ``max_entries``
            or ``ttl`` settings.

            TTL expiration only happens when expired resources are accessed.
            Therefore, don't rely on TTL expiration to guarantee timely cleanup.
            Also, expiration can happen on any script run. Ensure that
            ``on_release`` functions are thread-safe and don't rely on session
            state.

            The ``on_release`` function isn't guaranteed to be called when an
            app is shut down.

        scope : "global" or "session"
            The scope for the resource cache. If this is ``"global"`` (default),
            the resource is cached globally. If this is ``"session"``, the
            resource is removed from the cache when the session disconnects.

            Because a session-scoped cache is cleared when a session disconnects,
            an unstable network connection can cause the cache to populate
            multiple times in a single session. If this is a problem, you might
            consider adjusting the ``server.websocketPingInterval``
            configuration option.

        Example
        -------
        **Example 1: Global cache**

        By default, an ``@st.cache_resource``-decorated function uses a global cache.

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

        **Example 2: Session-scoped cache**

        By passing ``scope="session"``, an ``@st.cache_resource``-decorated function
        uses a session-scoped cache. You can also use ``on_release`` to clean up
        resources when they are no longer needed.

        >>> import streamlit as st
        >>>
        >>> @st.cache_resource(scope="session", on_release=lambda sess: sess.close())
        ... def get_database_session(url):
        ...     # Create a database session object that points to the URL.
        ...     return session

        **Example 3: Unhashable arguments**

        By default, all parameters to a cached function must be hashable.
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

        **Example 4: Clearing a cache**

        A cached function's cache can be procedurally cleared:

        >>> import streamlit as st
        >>>
        >>> @st.cache_resource
        ... def get_database_session(_sessionmaker, url):
        ...     # Create a database connection object that points to the URL.
        ...     return connection
        >>>
        >>> get_database_session.clear(_sessionmaker, "https://streamlit.io/")
        >>> # Clear the cached entry for the arguments provided.
        >>>
        >>> get_database_session.clear()
        >>> # Clear all cached entries for this function.

        **Example 5: Custom hashing**

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

        if scope not in {"global", "session"}:
            raise StreamlitAPIException(
                f"Unsupported scope option '{scope}'. Valid values are 'global' or 'session'."
            )

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
                    on_release=on_release,
                    scope=scope,
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
                on_release=on_release,
                scope=scope,
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
        on_release: OnRelease,
    ) -> None:
        super().__init__()

        def wrapped_on_release(result: CachedResult[R]) -> None:
            # Note that exceptions raised here will bubble out to the calling scope,
            # which will then treat them as user script errors.
            # This is also how exceptions thrown when generating cache values are
            # treated.
            on_release(result.value)

        self.key = key
        self.display_name = display_name
        self._mem_cache: TTLCleanupCache[str, CachedResult[R]] = TTLCleanupCache(
            maxsize=max_entries,
            ttl=ttl_seconds,
            timer=cache_utils.TTLCACHE_TIMER,
            on_release=wrapped_on_release,
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
                # Clear the whole cache.
                # TTLCleanupCache will stop a clear() execution when an exception is
                # thrown by an on_release. To ensure that our clear() actually flushes
                # the cache and calls all cleanup functions, we clear each item
                # individually. We also collect exceptions for logging.
                errors: list[Exception] = []
                while len(self._mem_cache) > 0:
                    try:
                        # TTLCleanupCache only reliably calls on_release for popitem -
                        # so just use that.
                        self._mem_cache.popitem()
                    except Exception as e:  # noqa: PERF203 (we require a tight scope)
                        errors.append(e)

                # Log all errors encountered at warning. This could potentially result in a
                # lot of log spam in the worst case - but for resources, a huge cache is very
                # unlikely.
                for error in errors:
                    _LOGGER.warning("Error clearing resource cache: %s", error)
            elif key in self._mem_cache:
                # Note: This code path does not seem to be reachable through public APIs.
                self._mem_cache.safe_del(key)

    def get_stats(
        self, _family_names: Sequence[str] | None = None
    ) -> dict[str, list[CacheStat]]:
        # Shallow clone our cache. Computing item sizes is potentially
        # expensive, and we want to minimize the time we spend holding
        # the lock.
        with self._mem_cache_lock:
            cache_entries = list(self._mem_cache.values())

        if not cache_entries:
            return {}

        # Lazy-load vendored package to prevent import of numpy
        from streamlit.vendor.pympler.asizeof import asizeof

        stats = [
            CacheStat(
                category_name="st_cache_resource",
                cache_name=self.display_name,
                byte_length=asizeof(entry),
            )
            for entry in cache_entries
        ]
        # In general, get_stats methods need to be able to return only requested stat
        # families, but this method only returns a single family, and we're guaranteed
        # that it was one of those requested if we make it here.
        return {CACHE_MEMORY_FAMILY: stats}
