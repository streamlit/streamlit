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

"""Common cache logic shared by st.cache_data and st.cache_resource."""

from __future__ import annotations

import functools
import hashlib
import inspect
import math
import time
import types
from abc import abstractmethod
from datetime import timedelta
from typing import Any, Callable

from streamlit import type_util
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
from streamlit.runtime.caching.cache_type import CacheType
from streamlit.runtime.caching.cached_message_replay import (
    CachedMessageReplayContext,
    CachedResult,
    MsgData,
    replay_cached_messages,
)
from streamlit.runtime.caching.hashing import update_hash

_LOGGER = get_logger(__name__)

# The timer function we use with TTLCache. This is the default timer func, but
# is exposed here as a constant so that it can be patched in unit tests.
TTLCACHE_TIMER = time.monotonic


def ttl_to_seconds(ttl: float | timedelta | None) -> float:
    """Convert a ttl value to a float representing "number of seconds".
    If ttl is None, return Infinity.
    """
    if ttl is None:
        return math.inf
    if isinstance(ttl, timedelta):
        return ttl.total_seconds()
    return ttl


# We show a special "UnevaluatedDataFrame" warning for cached funcs
# that attempt to return one of these unserializable types:
UNEVALUATED_DATAFRAME_TYPES = (
    "snowflake.snowpark.table.Table",
    "snowflake.snowpark.dataframe.DataFrame",
    "pyspark.sql.dataframe.DataFrame",
)


class Cache:
    """Function cache interface. Caches persist across script runs."""

    @abstractmethod
    def read_result(self, value_key: str) -> CachedResult:
        """Read a value and associated messages from the cache.

        Raises
        ------
        CacheKeyNotFoundError
            Raised if value_key is not in the cache.

        """
        raise NotImplementedError

    @abstractmethod
    def write_result(self, value_key: str, value: Any, messages: list[MsgData]) -> None:
        """Write a value and associated messages to the cache, overwriting any existing
        result that uses the value_key.
        """
        raise NotImplementedError

    @abstractmethod
    def clear(self) -> None:
        """Clear all values from this function cache."""
        raise NotImplementedError


class CachedFunction:
    """Encapsulates data for a cached function instance.

    CachedFunction instances are scoped to a single script run - they're not
    persistent.
    """

    def __init__(
        self,
        func: types.FunctionType,
        show_spinner: bool | str,
        allow_widgets: bool,
    ):
        self.func = func
        self.show_spinner = show_spinner
        self.allow_widgets = allow_widgets

    @property
    def cache_type(self) -> CacheType:
        raise NotImplementedError

    @property
    def cached_message_replay_ctx(self) -> CachedMessageReplayContext:
        raise NotImplementedError

    def get_function_cache(self, function_key: str) -> Cache:
        """Get or create the function cache for the given key."""
        raise NotImplementedError


def create_cache_wrapper(cached_func: CachedFunction) -> Callable[..., Any]:
    """Create a wrapper for a CachedFunction. This implements the common
    plumbing for both st.cache_data and st.cache_resource.
    """
    func = cached_func.func
    function_key = _make_function_key(cached_func.cache_type, func)

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        """Wrapper function that only calls the underlying function on a cache miss."""

        # Retrieve the function's cache object. We must do this inside the
        # wrapped function, because caches can be invalidated at any time.
        cache = cached_func.get_function_cache(function_key)

        name = func.__qualname__

        if isinstance(cached_func.show_spinner, bool):
            if len(args) == 0 and len(kwargs) == 0:
                message = f"Running `{name}()`."
            else:
                message = f"Running `{name}(...)`."
        else:
            message = cached_func.show_spinner

        def get_or_create_cached_value():
            # Generate the key for the cached value. This is based on the
            # arguments passed to the function.
            value_key = _make_value_key(cached_func.cache_type, func, *args, **kwargs)

            try:
                result = cache.read_result(value_key)
                _LOGGER.debug("Cache hit: %s", func)

                replay_cached_messages(result, cached_func.cache_type, func)

                return_value = result.value

            except CacheKeyNotFoundError:
                _LOGGER.debug("Cache miss: %s", func)

                with cached_func.cached_message_replay_ctx.calling_cached_function(
                    func, cached_func.allow_widgets
                ):
                    return_value = func(*args, **kwargs)

                messages = cached_func.cached_message_replay_ctx._most_recent_messages
                try:
                    cache.write_result(value_key, return_value, messages)
                except (
                    CacheError,
                    RuntimeError,
                ):  # RuntimeError will be raised by Apache Spark, if we do not collect dataframe before using st.experimental_memo
                    if True in [
                        type_util.is_type(return_value, type_name)
                        for type_name in UNEVALUATED_DATAFRAME_TYPES
                    ]:
                        raise UnevaluatedDataFrameError(
                            f"""
                            The function {get_cached_func_name_md(func)} is decorated with `st.experimental_memo` but it returns an unevaluated dataframe
                            of type `{type_util.get_fqn_type(return_value)}`. Please call `collect()` or `to_pandas()` on the dataframe before returning it,
                            so `st.experimental_memo` can serialize and cache it."""
                        )
                    raise UnserializableReturnValueError(
                        return_value=return_value, func=cached_func.func
                    )

            return return_value

        if cached_func.show_spinner or isinstance(cached_func.show_spinner, str):
            with spinner(message):
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


def _make_value_key(
    cache_type: CacheType, func: types.FunctionType, *args, **kwargs
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
    for arg_idx in range(len(args)):
        arg_name = _get_positional_arg_name(func, arg_idx)
        arg_pairs.append((arg_name, args[arg_idx]))

    for kw_name, kw_val in kwargs.items():
        # **kwargs ordering is preserved, per PEP 468
        # https://www.python.org/dev/peps/pep-0468/, so this iteration is
        # deterministic.
        arg_pairs.append((kw_name, kw_val))

    # Create the hash from each arg value, except for those args whose name
    # starts with "_". (Underscore-prefixed args are deliberately excluded from
    # hashing.)
    args_hasher = hashlib.new("md5")
    for arg_name, arg_value in arg_pairs:
        if arg_name is not None and arg_name.startswith("_"):
            _LOGGER.debug("Not hashing %s because it starts with _", arg_name)
            continue

        try:
            update_hash(
                (arg_name, arg_value),
                hasher=args_hasher,
                cache_type=cache_type,
            )
        except UnhashableTypeError as exc:
            raise UnhashableParamError(cache_type, func, arg_name, arg_value, exc)

    value_key = args_hasher.hexdigest()
    _LOGGER.debug("Cache key: %s", value_key)

    return value_key


def _make_function_key(cache_type: CacheType, func: types.FunctionType) -> str:
    """Create the unique key for a function's cache.

    A function's key is stable across reruns of the app, and changes when
    the function's source code changes.
    """
    func_hasher = hashlib.new("md5")

    # Include the function's __module__ and __qualname__ strings in the hash.
    # This means that two identical functions in different modules
    # will not share a hash; it also means that two identical *nested*
    # functions in the same module will not share a hash.
    update_hash(
        (func.__module__, func.__qualname__),
        hasher=func_hasher,
        cache_type=cache_type,
    )

    # Include the function's source code in its hash. If the source code can't
    # be retrieved, fall back to the function's bytecode instead.
    source_code: str | bytes
    try:
        source_code = inspect.getsource(func)
    except OSError as e:
        _LOGGER.debug(
            "Failed to retrieve function's source code when building its key; falling back to bytecode. err={0}",
            e,
        )
        source_code = func.__code__.co_code

    update_hash(
        source_code,
        hasher=func_hasher,
        cache_type=cache_type,
    )

    cache_key = func_hasher.hexdigest()
    return cache_key


def _get_positional_arg_name(func: types.FunctionType, arg_index: int) -> str | None:
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
