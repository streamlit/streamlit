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

"""Common cache logic shared by st.cache_data and st.cache_resource."""

from __future__ import annotations

import contextlib
import functools
import hashlib
import inspect
import threading
import time
from abc import abstractmethod
from collections import defaultdict
from typing import TYPE_CHECKING, Any, Callable, Final, Generic, TypeVar, cast, overload

from typing_extensions import ParamSpec

from streamlit import type_util
from streamlit.dataframe_util import is_unevaluated_data_object
from streamlit.elements.spinner import spinner
from streamlit.logger import get_logger
from streamlit.runtime.caching.cache_errors import (
    CacheError,
    CacheKeyNotFoundError,
    UnevaluatedDataFrameError,
    UnhashableParamError,
    UnhashableTypeError,
    UnserializableReturnValueError,
    get_cached_func_name_md,
)
from streamlit.runtime.caching.cached_message_replay import (
    CachedMessageReplayContext,
    CachedResult,
    MsgData,
    replay_cached_messages,
)
from streamlit.runtime.caching.hashing import HashFuncsDict, update_hash
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    in_cached_function,
)

if TYPE_CHECKING:
    import types

    from streamlit.runtime.caching.cache_type import CacheType

_LOGGER: Final = get_logger(__name__)

# The timer function we use with TTLCache. This is the default timer func, but
# is exposed here as a constant so that it can be patched in unit tests.
TTLCACHE_TIMER = time.monotonic

# Type-annotate the cached function.
P = ParamSpec("P")
R = TypeVar("R")


class Cache(Generic[R]):
    """Function cache interface. Caches persist across script runs."""

    def __init__(self) -> None:
        self._value_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)
        self._value_locks_lock = threading.Lock()

    @abstractmethod
    def read_result(self, value_key: str) -> CachedResult[R]:
        """Read a value and associated messages from the cache.

        Raises
        ------
        CacheKeyNotFoundError
            Raised if value_key is not in the cache.

        """
        raise NotImplementedError

    @abstractmethod
    def write_result(self, value_key: str, value: R, messages: list[MsgData]) -> None:
        """Write a value and associated messages to the cache, overwriting any existing
        result that uses the value_key.
        """
        # We *could* `del self._value_locks[value_key]` here, since nobody will be taking
        # a compute_value_lock for this value_key after the result is written.
        raise NotImplementedError

    def compute_value_lock(self, value_key: str) -> threading.Lock:
        """Return the lock that should be held while computing a new cached value.
        In a popular app with a cache that hasn't been pre-warmed, many sessions may try
        to access a not-yet-cached value simultaneously. We use a lock to ensure that
        only one of those sessions computes the value, and the others block until
        the value is computed.
        """
        with self._value_locks_lock:
            return self._value_locks[value_key]

    def clear(self, key: str | None = None) -> None:
        """Clear values from this cache.
        If no argument is passed, all items are cleared from the cache.
        A key can be passed to clear that key from the cache only.
        """
        with self._value_locks_lock:
            if not key:
                self._value_locks.clear()
            elif key in self._value_locks:
                del self._value_locks[key]
        self._clear(key=key)

    @abstractmethod
    def _clear(self, key: str | None = None) -> None:
        """Subclasses must implement this to perform cache-clearing logic."""
        raise NotImplementedError


class CachedFuncInfo(Generic[P, R]):  # ty: ignore[invalid-argument-type]
    """Encapsulates data for a cached function instance.

    CachedFuncInfo instances are scoped to a single script run - they're not
    persistent.
    """

    def __init__(
        self,
        func: Callable[P, R],
        hash_funcs: HashFuncsDict | None,
        show_spinner: bool | str,
        show_time: bool = False,
    ) -> None:
        self.func = func
        self.hash_funcs = hash_funcs
        self.show_spinner = show_spinner
        self.show_time = show_time

    @property
    def cache_type(self) -> CacheType:
        raise NotImplementedError

    @property
    def cached_message_replay_ctx(self) -> CachedMessageReplayContext:
        raise NotImplementedError

    def get_function_cache(self, function_key: str) -> Cache[R]:
        """Get or create the function cache for the given key."""
        raise NotImplementedError


def make_cached_func_wrapper(info: CachedFuncInfo[P, R]) -> CachedFunc[P, R]:
    """Create a callable wrapper around a CachedFunctionInfo.

    Calling the wrapper will return the cached value if it's already been
    computed, and will call the underlying function to compute and cache the
    value otherwise.

    The wrapper also has a `clear` function that can be called to clear
    some or all of the wrapper's cached values.
    """
    cached_func = CachedFunc(info)
    return cast("CachedFunc[P, R]", functools.update_wrapper(cached_func, info.func))


class BoundCachedFunc(Generic[P, R]):  # ty: ignore[invalid-argument-type]
    """A wrapper around a CachedFunc that binds it to a specific instance in case of
    decorated function is a class method.
    """

    def __init__(self, cached_func: CachedFunc[P, R], instance: Any) -> None:
        self._cached_func = cached_func
        self._instance = instance

    def __call__(self, *args: P.args, **kwargs: P.kwargs) -> R:
        return self._cached_func(self._instance, *args, **kwargs)

    def __repr__(self) -> str:
        return f"<BoundCachedFunc: {self._cached_func._info.func} of {self._instance}>"

    def clear(self, *args: Any, **kwargs: Any) -> None:
        if args or kwargs:
            # The instance is required as first parameter to allow
            # args to be correctly resolved to the parameter names:
            self._cached_func.clear(self._instance, *args, **kwargs)
        else:
            # if no args/kwargs are specified, we just want to clear the
            # entire cache of this method:
            self._cached_func.clear()


class CachedFunc(Generic[P, R]):  # ty: ignore[invalid-argument-type]
    def __init__(self, info: CachedFuncInfo[P, R]) -> None:
        self._info = info
        self._function_key = _make_function_key(info.cache_type, info.func)

    def __repr__(self) -> str:
        return f"<CachedFunc: {self._info.func}>"

    def __get__(self, instance: Any, owner: Any | None = None) -> Any:
        """CachedFunc implements descriptor protocol to support cache methods."""
        if instance is None:
            return self

        return functools.update_wrapper(BoundCachedFunc(self, instance), self)

    def __call__(self, *args: P.args, **kwargs: P.kwargs) -> R:
        """The wrapper. We'll only call our underlying function on a cache miss."""

        spinner_message: str | None = None
        if isinstance(self._info.show_spinner, str):
            spinner_message = self._info.show_spinner
        elif self._info.show_spinner is True:
            name = self._info.func.__qualname__
            if len(args) == 0 and len(kwargs) == 0:
                spinner_message = f"Running `{name}()`."
            else:
                spinner_message = f"Running `{name}(...)`."

        return self._get_or_create_cached_value(args, kwargs, spinner_message)

    def _get_or_create_cached_value(
        self,
        func_args: tuple[Any, ...],
        func_kwargs: dict[str, Any],
        spinner_message: str | None = None,
    ) -> R:
        # Retrieve the function's cache object. We must do this "just-in-time"
        # (as opposed to in the constructor), because caches can be invalidated
        # at any time.
        cache = self._info.get_function_cache(self._function_key)

        # Generate the key for the cached value. This is based on the
        # arguments passed to the function.
        value_key = _make_value_key(
            cache_type=self._info.cache_type,
            func=self._info.func,
            func_args=func_args,
            func_kwargs=func_kwargs,
            hash_funcs=self._info.hash_funcs,
        )

        with contextlib.suppress(CacheKeyNotFoundError):
            cached_result = cache.read_result(value_key)
            return self._handle_cache_hit(cached_result)

        # only show spinner if there is a message to show and always only for the
        # outermost cache function if cache functions are nested, because the outermost
        # function has to wait for the inner functions anyways. This avoids surprising
        # users with slowdowned apps in case the inner functions are called very often,
        # which would lead to a ton of (empty/spinner) proto messages that will make the
        # app slow (see https://github.com/streamlit/streamlit/issues/9951). This is
        # basically like auto-setting "show_spinner=False" on the @st.cache decorators
        # on behalf of the user.
        is_nested_cache_function = in_cached_function.get()
        spinner_or_no_context = (
            spinner(spinner_message, _cache=True, show_time=self._info.show_time)
            if spinner_message is not None and not is_nested_cache_function
            else contextlib.nullcontext()
        )
        with spinner_or_no_context:
            return self._handle_cache_miss(cache, value_key, func_args, func_kwargs)

    def _handle_cache_hit(self, result: CachedResult[R]) -> R:
        """Handle a cache hit: replay the result's cached messages, and return its
        value.
        """
        replay_cached_messages(
            result,
            self._info.cache_type,
            self._info.func,
        )
        return result.value

    def _handle_cache_miss(
        self,
        cache: Cache[R],
        value_key: str,
        func_args: tuple[Any, ...],
        func_kwargs: dict[str, Any],
    ) -> R:
        """Handle a cache miss: compute a new cached value, write it back to the cache,
        and return that newly-computed value.
        """

        # Implementation notes:
        # - We take a "compute_value_lock" before computing our value. This ensures that
        #   multiple sessions don't try to compute the same value simultaneously.
        #
        # - We use a different lock for each value_key, as opposed to a single lock for
        #   the entire cache, so that unrelated value computations don't block on each other.
        #
        # - When retrieving a cache entry that may not yet exist, we use a "double-checked locking"
        #   strategy: first we try to retrieve the cache entry without taking a value lock. (This
        #   happens in `_get_or_create_cached_value()`.) If that fails because the value hasn't
        #   been computed yet, we take the value lock and then immediately try to retrieve cache entry
        #   *again*, while holding the lock. If the cache entry exists at this point, it means that
        #   another thread computed the value before us.
        #
        #   This means that the happy path ("cache entry exists") is a wee bit faster because
        #   no lock is acquired. But the unhappy path ("cache entry needs to be recomputed") is
        #   a wee bit slower, because we do two lookups for the entry.

        with cache.compute_value_lock(value_key):
            # We've acquired the lock - but another thread may have acquired it first
            # and already computed the value. So we need to test for a cache hit again,
            # before computing.
            try:
                cached_result = cache.read_result(value_key)
                # Another thread computed the value before us. Early exit!
                return self._handle_cache_hit(cached_result)
            except CacheKeyNotFoundError:
                # No cache hit -> we will call the cached function
                # below.
                pass

            # We acquired the lock before any other thread. Compute the value!
            with self._info.cached_message_replay_ctx.calling_cached_function(
                self._info.func
            ):
                computed_value = self._info.func(*func_args, **func_kwargs)

            # We've computed our value, and now we need to write it back to the cache
            # along with any "replay messages" that were generated during value computation.
            messages = self._info.cached_message_replay_ctx._most_recent_messages
            try:
                cache.write_result(value_key, computed_value, messages)
                return computed_value
            except (CacheError, RuntimeError) as ex:
                # An exception was thrown while we tried to write to the cache. Report
                # it to the user. (We catch `RuntimeError` here because it will be
                # raised by Apache Spark if we do not collect dataframe before
                # using `st.cache_data`.)
                if is_unevaluated_data_object(computed_value):
                    # If the returned value is an unevaluated dataframe, raise an error.
                    # Unevaluated dataframes are not yet in the local memory, which also
                    # means they cannot be properly cached (serialized).
                    raise UnevaluatedDataFrameError(
                        f"The function {get_cached_func_name_md(self._info.func)} is "
                        "decorated with `st.cache_data` but it returns an unevaluated "
                        f"data object of type `{type_util.get_fqn_type(computed_value)}`. "
                        "Please convert the object to a serializable format "
                        "(e.g. Pandas DataFrame) before returning it, so "
                        "`st.cache_data` can serialize and cache it."
                    ) from ex
                raise UnserializableReturnValueError(
                    return_value=computed_value, func=self._info.func
                )

    @overload
    def clear(self) -> None: ...

    @overload
    def clear(self, *args: P.args, **kwargs: P.kwargs) -> None: ...

    @overload
    def clear(self, *args: Any, **kwargs: Any) -> None: ...

    def clear(self, *args: Any, **kwargs: Any) -> None:
        """Clear the cached function's associated cache.

        If no arguments are passed, Streamlit will clear all values cached for
        the function. If arguments are passed, Streamlit will clear the cached
        value for these arguments only.

        Parameters
        ----------
        *args: Any
            Arguments of the cached functions.

        **kwargs: Any
            Keyword arguments of the cached function.

        Example
        -------
        >>> import streamlit as st
        >>> import time
        >>>
        >>> @st.cache_data
        >>> def foo(bar):
        >>>     time.sleep(2)
        >>>     st.write(f"Executed foo({bar}).")
        >>>     return bar
        >>>
        >>> if st.button("Clear all cached values for `foo`", on_click=foo.clear):
        >>>     foo.clear()
        >>>
        >>> if st.button("Clear the cached value of `foo(1)`"):
        >>>     foo.clear(1)
        >>>
        >>> foo(1)
        >>> foo(2)

        """
        cache = self._info.get_function_cache(self._function_key)
        if args or kwargs:
            key = _make_value_key(
                cache_type=self._info.cache_type,
                func=self._info.func,
                func_args=args,
                func_kwargs=kwargs,
                hash_funcs=self._info.hash_funcs,
            )
        else:
            key = None
        cache.clear(key=key)


def _make_value_key(
    cache_type: CacheType,
    func: Callable[..., Any],
    func_args: tuple[Any, ...],
    func_kwargs: dict[str, Any],
    hash_funcs: HashFuncsDict | None,
) -> str:
    """Create the key for a value within a cache.

    This key is generated from the function's arguments. All arguments
    will be hashed, except for those named with a leading "_".

    Raises
    ------
    StreamlitAPIException
        Raised (with a nicely-formatted explanation message) if we encounter
        an un-hashable arg.
    """

    # Create a (name, value) list of all *args and **kwargs passed to the
    # function.
    arg_pairs: list[tuple[str | None, Any]] = []
    for arg_idx in range(len(func_args)):
        arg_name = _get_positional_arg_name(func, arg_idx)
        arg_pairs.append((arg_name, func_args[arg_idx]))

    for kw_name, kw_val in func_kwargs.items():
        # **kwargs ordering is preserved, per PEP 468
        # https://www.python.org/dev/peps/pep-0468/, so this iteration is
        # deterministic.
        arg_pairs.append((kw_name, kw_val))

    # Create the hash from each arg value, except for those args whose name
    # starts with "_". (Underscore-prefixed args are deliberately excluded from
    # hashing.)
    args_hasher = hashlib.new("md5", usedforsecurity=False)
    for arg_name, arg_value in arg_pairs:
        if arg_name is not None and arg_name.startswith("_"):
            _LOGGER.debug("Not hashing %s because it starts with _", arg_name)
            continue

        try:
            update_hash(
                arg_name,
                hasher=args_hasher,
                cache_type=cache_type,
                hash_source=func,
            )
            # we call update_hash twice here, first time for `arg_name`
            # without `hash_funcs`, and second time for `arg_value` with hash_funcs
            # to evaluate user defined `hash_funcs` only for computing `arg_value` hash.
            update_hash(
                arg_value,
                hasher=args_hasher,
                cache_type=cache_type,
                hash_funcs=hash_funcs,
                hash_source=func,
            )
        except UnhashableTypeError as exc:
            raise UnhashableParamError(cache_type, func, arg_name, arg_value, exc)

    value_key = args_hasher.hexdigest()
    _LOGGER.debug("Cache key: %s", value_key)

    return value_key


def _make_function_key(cache_type: CacheType, func: Callable[..., Any]) -> str:
    """Create the unique key for a function's cache.

    A function's key is stable across reruns of the app, and changes when
    the function's source code changes.
    """
    func_hasher = hashlib.new("md5", usedforsecurity=False)
    func = cast("types.FunctionType", func)

    # Include the function's __module__ and __qualname__ strings in the hash.
    # This means that two identical functions in different modules
    # will not share a hash.
    # It also means that two identical *nested* functions in the same module
    # *will* share a hash (see https://github.com/streamlit/streamlit/issues/11157).
    update_hash(
        (func.__module__, func.__qualname__),
        hasher=func_hasher,
        cache_type=cache_type,
        hash_source=func,
    )

    # Include the function's source code in its hash. If the source code can't
    # be retrieved, fall back to the function's bytecode instead.
    source_code: str | bytes
    try:
        source_code = inspect.getsource(func)
    except (OSError, TypeError) as ex:
        _LOGGER.debug(
            "Failed to retrieve function's source code when building its key; "
            "falling back to bytecode.",
            exc_info=ex,
        )
        source_code = func.__code__.co_code

    update_hash(
        source_code, hasher=func_hasher, cache_type=cache_type, hash_source=func
    )

    return func_hasher.hexdigest()


def _get_positional_arg_name(func: Callable[..., Any], arg_index: int) -> str | None:
    """Return the name of a function's positional argument.

    If arg_index is out of range, or refers to a parameter that is not a
    named positional argument (e.g. an *args, **kwargs, or keyword-only param),
    return None instead.
    """
    if arg_index < 0:
        return None

    params: list[inspect.Parameter] = list(inspect.signature(func).parameters.values())
    if arg_index >= len(params):
        return None

    if params[arg_index].kind in (
        inspect.Parameter.POSITIONAL_OR_KEYWORD,
        inspect.Parameter.POSITIONAL_ONLY,
    ):
        return params[arg_index].name

    return None
