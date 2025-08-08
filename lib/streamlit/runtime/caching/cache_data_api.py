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

"""@st.cache_data: pickle-based caching."""

from __future__ import annotations

import pickle
import threading
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Final,
    Literal,
    TypeVar,
    Union,
    overload,
)

from typing_extensions import ParamSpec, TypeAlias

import streamlit as st
from streamlit import runtime
from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger
from streamlit.runtime.caching.cache_errors import CacheError, CacheKeyNotFoundError
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
    show_widget_replay_deprecation,
)
from streamlit.runtime.caching.storage import (
    CacheStorage,
    CacheStorageContext,
    CacheStorageError,
    CacheStorageKeyNotFoundError,
    CacheStorageManager,
)
from streamlit.runtime.caching.storage.cache_storage_protocol import (
    InvalidCacheStorageContextError,
)
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.stats import CacheStat, CacheStatsProvider, group_stats
from streamlit.time_util import time_to_seconds

if TYPE_CHECKING:
    from datetime import timedelta

    from streamlit.runtime.caching.hashing import HashFuncsDict

_LOGGER: Final = get_logger(__name__)

CACHE_DATA_MESSAGE_REPLAY_CTX = CachedMessageReplayContext(CacheType.DATA)

# The cache persistence options we support: "disk" or None
CachePersistType: TypeAlias = Union[Literal["disk"], None]


P = ParamSpec("P")
R = TypeVar("R")


class CachedDataFuncInfo(CachedFuncInfo[P, R]):
    """Implements the CachedFuncInfo interface for @st.cache_data."""

    persist: CachePersistType
    max_entries: int | None
    ttl: float | timedelta | str | None

    def __init__(
        self,
        func: Callable[P, R],
        persist: CachePersistType,
        max_entries: int | None,
        ttl: float | timedelta | str | None,
        show_spinner: bool | str,
        show_time: bool = False,
        hash_funcs: HashFuncsDict | None = None,
    ) -> None:
        super().__init__(
            func,
            hash_funcs=hash_funcs,
            show_spinner=show_spinner,
            show_time=show_time,
        )
        self.persist = persist
        self.max_entries = max_entries
        self.ttl = ttl

        self.validate_params()

    @property
    def cache_type(self) -> CacheType:
        return CacheType.DATA

    @property
    def cached_message_replay_ctx(self) -> CachedMessageReplayContext:
        return CACHE_DATA_MESSAGE_REPLAY_CTX

    @property
    def display_name(self) -> str:
        """A human-readable name for the cached function."""
        return f"{self.func.__module__}.{self.func.__qualname__}"

    def get_function_cache(self, function_key: str) -> Cache[R]:
        return _data_caches.get_cache(
            key=function_key,
            persist=self.persist,
            max_entries=self.max_entries,
            ttl=self.ttl,
            display_name=self.display_name,
        )

    def validate_params(self) -> None:
        """
        Validate the params passed to @st.cache_data are compatible with cache storage.

        When called, this method could log warnings if cache params are invalid
        for current storage.
        """
        _data_caches.validate_cache_params(
            function_name=self.func.__name__,
            persist=self.persist,
            max_entries=self.max_entries,
            ttl=self.ttl,
        )


class DataCaches(CacheStatsProvider):
    """Manages all DataCache instances."""

    def __init__(self) -> None:
        self._caches_lock = threading.Lock()
        self._function_caches: dict[str, DataCache[Any]] = {}

    def get_cache(
        self,
        key: str,
        persist: CachePersistType,
        max_entries: int | None,
        ttl: int | float | timedelta | str | None,
        display_name: str,
    ) -> DataCache[Any]:
        """Return the mem cache for the given key.

        If it doesn't exist, create a new one with the given params.
        """

        ttl_seconds = time_to_seconds(ttl, coerce_none_to_inf=False)

        # Get the existing cache, if it exists, and validate that its params
        # haven't changed.
        with self._caches_lock:
            cache = self._function_caches.get(key)
            if (
                cache is not None
                and cache.ttl_seconds == ttl_seconds
                and cache.max_entries == max_entries
                and cache.persist == persist
            ):
                return cache

            # Close the existing cache's storage, if it exists.
            if cache is not None:
                _LOGGER.debug(
                    "Closing existing DataCache storage "
                    "(key=%s, persist=%s, max_entries=%s, ttl=%s) "
                    "before creating new one with different params",
                    key,
                    persist,
                    max_entries,
                    ttl,
                )
                cache.storage.close()

            # Create a new cache object and put it in our dict
            _LOGGER.debug(
                "Creating new DataCache (key=%s, persist=%s, max_entries=%s, ttl=%s)",
                key,
                persist,
                max_entries,
                ttl,
            )

            cache_context = self.create_cache_storage_context(
                function_key=key,
                function_name=display_name,
                ttl_seconds=ttl_seconds,
                max_entries=max_entries,
                persist=persist,
            )
            cache_storage_manager = self.get_storage_manager()
            storage = cache_storage_manager.create(cache_context)

            cache = DataCache(
                key=key,
                storage=storage,
                persist=persist,
                max_entries=max_entries,
                ttl_seconds=ttl_seconds,
                display_name=display_name,
            )
            self._function_caches[key] = cache
            return cache

    def clear_all(self) -> None:
        """Clear all in-memory and on-disk caches."""
        with self._caches_lock:
            try:
                # try to remove in optimal way if such ability provided by
                # storage manager clear_all method;
                # if not implemented, fallback to remove all
                # available storages one by one
                self.get_storage_manager().clear_all()
            except NotImplementedError:
                for data_cache in self._function_caches.values():
                    data_cache.clear()
                    data_cache.storage.close()
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

    def validate_cache_params(
        self,
        function_name: str,
        persist: CachePersistType,
        max_entries: int | None,
        ttl: int | float | timedelta | str | None,
    ) -> None:
        """Validate that the cache params are valid for given storage.

        Raises
        ------
        InvalidCacheStorageContext
            Raised if the cache storage manager is not able to work with provided
            CacheStorageContext.
        """

        ttl_seconds = time_to_seconds(ttl, coerce_none_to_inf=False)

        cache_context = self.create_cache_storage_context(
            function_key="DUMMY_KEY",
            function_name=function_name,
            ttl_seconds=ttl_seconds,
            max_entries=max_entries,
            persist=persist,
        )
        try:
            self.get_storage_manager().check_context(cache_context)
        except InvalidCacheStorageContextError:
            _LOGGER.exception(
                "Cache params for function %s are incompatible with current "
                "cache storage manager.",
                function_name,
            )
            raise

    def create_cache_storage_context(
        self,
        function_key: str,
        function_name: str,
        persist: CachePersistType,
        ttl_seconds: float | None,
        max_entries: int | None,
    ) -> CacheStorageContext:
        return CacheStorageContext(
            function_key=function_key,
            function_display_name=function_name,
            ttl_seconds=ttl_seconds,
            max_entries=max_entries,
            persist=persist,
        )

    def get_storage_manager(self) -> CacheStorageManager:
        if runtime.exists():
            return runtime.get_instance().cache_storage_manager
        # When running in "raw mode", we can't access the CacheStorageManager,
        # so we're falling back to InMemoryCache.
        _LOGGER.warning("No runtime found, using MemoryCacheStorageManager")
        return MemoryCacheStorageManager()


# Singleton DataCaches instance
_data_caches = DataCaches()


def get_data_cache_stats_provider() -> CacheStatsProvider:
    """Return the StatsProvider for all @st.cache_data functions."""
    return _data_caches


class CacheDataAPI:
    """Implements the public st.cache_data API: the @st.cache_data decorator, and
    st.cache_data.clear().
    """

    def __init__(self, decorator_metric_name: str) -> None:
        """Create a CacheDataAPI instance.

        Parameters
        ----------
        decorator_metric_name
            The metric name to record for decorator usage.
        """

        # Parameterize the decorator metric name.
        # (Ignore spurious mypy complaints - https://github.com/python/mypy/issues/2427)
        self._decorator = gather_metrics(  # type: ignore
            decorator_metric_name, self._decorator
        )

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
        persist: CachePersistType | bool = None,
        experimental_allow_widgets: bool = False,
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
        persist: CachePersistType | bool = None,
        experimental_allow_widgets: bool = False,
        hash_funcs: HashFuncsDict | None = None,
    ) -> CachedFunc[P, R] | Callable[[Callable[P, R]], CachedFunc[P, R]]:
        return self._decorator(
            func,
            ttl=ttl,
            max_entries=max_entries,
            persist=persist,
            show_spinner=show_spinner,
            show_time=show_time,
            experimental_allow_widgets=experimental_allow_widgets,
            hash_funcs=hash_funcs,
        )

    def _decorator(
        self,
        func: Callable[P, R] | None = None,
        *,
        ttl: float | timedelta | str | None,
        max_entries: int | None,
        show_spinner: bool | str,
        show_time: bool = False,
        persist: CachePersistType | bool,
        experimental_allow_widgets: bool,
        hash_funcs: HashFuncsDict | None = None,
    ) -> CachedFunc[P, R] | Callable[[Callable[P, R]], CachedFunc[P, R]]:
        """Decorator to cache functions that return data (e.g. dataframe transforms, database queries, ML inference).

        Cached objects are stored in "pickled" form, which means that the return
        value of a cached function must be pickleable. Each caller of the cached
        function gets its own copy of the cached data.

        You can clear a function's cache with ``func.clear()`` or clear the entire
        cache with ``st.cache_data.clear()``.

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
        instead. Within each user session, an ``@st.cache_data``-decorated
        function returns a *copy* of the cached return value (if the value is
        already cached). To cache shared global resources (singletons), use
        ``st.cache_resource`` instead. To learn more about caching, see
        `Caching overview
        <https://docs.streamlit.io/develop/concepts/architecture/caching>`_.

        .. note::
            Caching async functions is not supported. To upvote this feature,
            see GitHub issue `#8308
            <https://github.com/streamlit/streamlit/issues/8308>`_.

        Parameters
        ----------
        func : callable
            The function to cache. Streamlit hashes the function's source code.

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

            Note that ``ttl`` will be ignored if ``persist="disk"`` or ``persist=True``.

        max_entries : int or None
            The maximum number of entries to keep in the cache, or None
            for an unbounded cache. When a new entry is added to a full cache,
            the oldest cached entry will be removed. Defaults to None.

        show_spinner : bool or str
            Enable the spinner. Default is True to show a spinner when there is
            a "cache miss" and the cached data is being created. If string,
            value of show_spinner param will be used for spinner text.

        show_time : bool
            Whether to show the elapsed time next to the spinner text. If this is
            ``False`` (default), no time is displayed. If this is ``True``,
            elapsed time is displayed with a precision of 0.1 seconds. The time
            format is not configurable.

        persist : "disk", bool, or None
            Optional location to persist cached data to. Passing "disk" (or True)
            will persist the cached data to the local disk. None (or False) will disable
            persistence. The default is None.

        experimental_allow_widgets : bool
            Allow widgets to be used in the cached function. Defaults to False.

        hash_funcs : dict or None
            Mapping of types or fully qualified names to hash functions.
            This is used to override the behavior of the hasher inside Streamlit's
            caching mechanism: when the hasher encounters an object, it will first
            check to see if its type matches a key in this dict and, if so, will use
            the provided function to generate a hash for it. See below for an example
            of how this can be used.

        .. deprecated::
            The cached widget replay functionality was removed in 1.38. Please
            remove the ``experimental_allow_widgets`` parameter from your
            caching decorators. This parameter will be removed in a future
            version.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> @st.cache_data
        ... def fetch_and_clean_data(url):
        ...     # Fetch data from URL here, and then clean it up.
        ...     return data
        >>>
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

        >>> import streamlit as st
        >>>
        >>> @st.cache_data(persist="disk")
        ... def fetch_and_clean_data(url):
        ...     # Fetch data from URL here, and then clean it up.
        ...     return data

        By default, all parameters to a cached function must be hashable.
        Any parameter whose name begins with ``_`` will not be hashed. You can use
        this as an "escape hatch" for parameters that are not hashable:

        >>> import streamlit as st
        >>>
        >>> @st.cache_data
        ... def fetch_and_clean_data(_db_connection, num_rows):
        ...     # Fetch data from _db_connection here, and then clean it up.
        ...     return data
        >>>
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

        A cached function's cache can be procedurally cleared:

        >>> import streamlit as st
        >>>
        >>> @st.cache_data
        ... def fetch_and_clean_data(_db_connection, num_rows):
        ...     # Fetch data from _db_connection here, and then clean it up.
        ...     return data
        >>>
        >>> fetch_and_clean_data.clear(_db_connection, 50)
        >>> # Clear the cached entry for the arguments provided.
        >>>
        >>> fetch_and_clean_data.clear()
        >>> # Clear all cached entries for this function.

        To override the default hashing behavior, pass a custom hash function.
        You can do that by mapping a type (e.g. ``datetime.datetime``) to a hash
        function (``lambda dt: dt.isoformat()``) like this:

        >>> import streamlit as st
        >>> import datetime
        >>>
        >>> @st.cache_data(hash_funcs={datetime.datetime: lambda dt: dt.isoformat()})
        ... def convert_to_utc(dt: datetime.datetime):
        ...     return dt.astimezone(datetime.timezone.utc)

        Alternatively, you can map the type's fully-qualified name
        (e.g. ``"datetime.datetime"``) to the hash function instead:

        >>> import streamlit as st
        >>> import datetime
        >>>
        >>> @st.cache_data(hash_funcs={"datetime.datetime": lambda dt: dt.isoformat()})
        ... def convert_to_utc(dt: datetime.datetime):
        ...     return dt.astimezone(datetime.timezone.utc)

        """

        # Parse our persist value into a string
        persist_string: CachePersistType
        if persist is True:
            persist_string = "disk"
        elif persist is False:
            persist_string = None
        else:
            persist_string = persist

        if persist_string not in (None, "disk"):
            # We'll eventually have more persist options.
            raise StreamlitAPIException(
                f"Unsupported persist option '{persist}'. Valid values are 'disk' or None."
            )

        if experimental_allow_widgets:
            show_widget_replay_deprecation("cache_data")

        def wrapper(f: Callable[P, R]) -> CachedFunc[P, R]:
            return make_cached_func_wrapper(
                CachedDataFuncInfo(
                    func=f,
                    persist=persist_string,
                    show_spinner=show_spinner,
                    show_time=show_time,
                    max_entries=max_entries,
                    ttl=ttl,
                    hash_funcs=hash_funcs,
                )
            )

        if func is None:
            return wrapper

        return make_cached_func_wrapper(
            CachedDataFuncInfo(
                func=func,
                persist=persist_string,
                show_spinner=show_spinner,
                show_time=show_time,
                max_entries=max_entries,
                ttl=ttl,
                hash_funcs=hash_funcs,
            )
        )

    @gather_metrics("clear_data_caches")
    def clear(self) -> None:
        """Clear all in-memory and on-disk data caches."""
        _data_caches.clear_all()


class DataCache(Cache[R]):
    """Manages cached values for a single st.cache_data function."""

    def __init__(
        self,
        key: str,
        storage: CacheStorage,
        persist: CachePersistType,
        max_entries: int | None,
        ttl_seconds: float | None,
        display_name: str,
    ) -> None:
        super().__init__()
        self.key = key
        self.display_name = display_name
        self.storage = storage
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self.persist = persist

    def get_stats(self) -> list[CacheStat]:
        if isinstance(self.storage, CacheStatsProvider):
            return self.storage.get_stats()
        return []

    def read_result(self, key: str) -> CachedResult[R]:
        """Read a value and messages from the cache. Raise `CacheKeyNotFoundError`
        if the value doesn't exist, and `CacheError` if the value exists but can't
        be unpickled.
        """
        try:
            pickled_entry = self.storage.get(key)
        except CacheStorageKeyNotFoundError as e:
            raise CacheKeyNotFoundError(str(e)) from e
        except CacheStorageError as e:
            raise CacheError(str(e)) from e

        try:
            entry = pickle.loads(pickled_entry)  # noqa: S301
            if not isinstance(entry, CachedResult):
                # Loaded an old cache file format, remove it and let the caller
                # rerun the function.
                self.storage.delete(key)
                raise CacheKeyNotFoundError()
            return entry
        except pickle.UnpicklingError as exc:
            raise CacheError(f"Failed to unpickle {key}") from exc

    @gather_metrics("_cache_data_object")
    def write_result(self, key: str, value: R, messages: list[MsgData]) -> None:
        """Write a value and associated messages to the cache.
        The value must be pickleable.
        """
        try:
            main_id = st._main.id
            sidebar_id = st.sidebar.id
            entry = CachedResult(value, messages, main_id, sidebar_id)
            pickled_entry = pickle.dumps(entry)
        except (pickle.PicklingError, TypeError) as exc:
            raise CacheError(f"Failed to pickle {key}") from exc
        self.storage.set(key, pickled_entry)

    def _clear(self, key: str | None = None) -> None:
        if not key:
            self.storage.clear()
        else:
            self.storage.delete(key)
