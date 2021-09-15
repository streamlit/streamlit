import functools
import types
import typing
from abc import abstractmethod
from typing import Any, Callable

import streamlit as st
from streamlit.caching.cache_errors import CacheType, CacheKeyNotFoundError
from streamlit.caching.cache_utils import (
    make_function_key,
    make_value_key,
    ThreadLocalCacheInfo,
)
from streamlit.logger import get_logger

_LOGGER = get_logger(__name__)


class Cache(typing.Protocol):
    """Cache interface."""

    def read_value(self, value_key: str) -> Any:
        ...

    def write_value(self, value_key: str, value: Any) -> None:
        ...


class CachedFunction(typing.Protocol):
    func: types.FunctionType
    show_spinner: bool
    suppress_st_warning: bool

    @property
    @abstractmethod
    def cache_type(self) -> CacheType:
        ...

    @property
    @abstractmethod
    def cache_info(self) -> ThreadLocalCacheInfo:
        ...

    def get_function_cache(self, function_key: str) -> Cache:
        """Get or create the function cache for the given key."""
        ...


def create_cache_wrapper(record: CachedFunction) -> Callable[..., Any]:
    # Generate the key for this function's cache.
    func = typing.cast(types.FunctionType, record.func)
    function_key = make_function_key(record.cache_type, func)

    @functools.wraps(func)
    def wrapped_func(*args, **kwargs):
        """This function wrapper will only call the underlying function in
        the case of a cache miss.
        """

        # Retrieve the function's cache object. We must do this inside the
        # wrapped function, because caches can be invalidated at any time.
        cache = record.get_function_cache(function_key)

        name = func.__qualname__

        if len(args) == 0 and len(kwargs) == 0:
            message = "Running `%s()`." % name
        else:
            message = "Running `%s(...)`." % name

        def get_or_create_cached_value():
            # Generate the key for the cached value. This is based on the
            # arguments passed to the function.
            value_key = make_value_key(record.cache_type, func, *args, **kwargs)

            try:
                return_value = cache.read_value(value_key)
                _LOGGER.debug("Cache hit: %s", func)

            except CacheKeyNotFoundError:
                _LOGGER.debug("Cache miss: %s", func)

                with record.cache_info.calling_cached_function(func):
                    if record.suppress_st_warning:
                        with record.cache_info.suppress_cached_st_function_warning():
                            return_value = func(*args, **kwargs)
                    else:
                        return_value = func(*args, **kwargs)

                cache.write_value(value_key, return_value)

            return return_value

        if record.show_spinner:
            with st.spinner(message):
                return get_or_create_cached_value()
        else:
            return get_or_create_cached_value()

    return wrapped_func
