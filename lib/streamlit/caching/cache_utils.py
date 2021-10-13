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

"""Common cache logic shared by st.memo and st.singleton."""

import contextlib
import functools
import hashlib
import inspect
import threading
import types
from typing import Callable, List, Iterator, Tuple, Optional, Any, Union

import streamlit as st
from streamlit import util
from streamlit.caching.cache_errors import CacheKeyNotFoundError
from streamlit.logger import get_logger
from .cache_errors import (
    CacheType,
    CachedStFunctionWarning,
)
from .cache_errors import (
    UnhashableParamError,
    UnhashableTypeError,
)
from .hashing import update_hash

_LOGGER = get_logger(__name__)


class Cache:
    """Cache interface."""

    def read_value(self, value_key: str) -> Any:
        raise NotImplementedError()

    def write_value(self, value_key: str, value: Any) -> None:
        raise NotImplementedError()


class CachedFunction:
    """Encapsulates data for a cached function instance."""

    def __init__(
        self, func: types.FunctionType, show_spinner: bool, suppress_st_warning: bool
    ):
        self.func = func
        self.show_spinner = show_spinner
        self.suppress_st_warning = suppress_st_warning

    @property
    def cache_type(self) -> CacheType:
        raise NotImplementedError()

    @property
    def call_stack(self) -> "CachedFunctionCallStack":
        raise NotImplementedError()

    def get_function_cache(self, function_key: str) -> Cache:
        """Get or create the function cache for the given key."""
        raise NotImplementedError()


def create_cache_wrapper(cached_func: CachedFunction) -> Callable[..., Any]:
    """Create a wrapper for a CachedFunction. This implements the common
    plumbing for both st.memo and st.singleton.
    """
    func = cached_func.func
    function_key = _make_function_key(cached_func.cache_type, func)

    @functools.wraps(func)
    def wrapped_func(*args, **kwargs):
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
                return_value = cache.read_value(value_key)
                _LOGGER.debug("Cache hit: %s", func)

            except CacheKeyNotFoundError:
                _LOGGER.debug("Cache miss: %s", func)

                with cached_func.call_stack.calling_cached_function(func):
                    if cached_func.suppress_st_warning:
                        with cached_func.call_stack.suppress_cached_st_function_warning():
                            return_value = func(*args, **kwargs)
                    else:
                        return_value = func(*args, **kwargs)

                cache.write_value(value_key, return_value)

            return return_value

        if cached_func.show_spinner:
            with st.spinner(message):
                return get_or_create_cached_value()
        else:
            return get_or_create_cached_value()

    return wrapped_func


class CachedFunctionCallStack(threading.local):
    """A utility for warning users when they call `st` commands inside
    a cached function. Internally, this is just a counter that's incremented
    when we enter a cache function, and decremented when we exit.

    Data is stored in a thread-local object, so it's safe to use an instance
    of this class across multiple threads.
    """

    def __init__(self, cache_type: CacheType):
        self._cached_func_stack: List[types.FunctionType] = []
        self._suppress_st_function_warning = 0
        self._cache_type = cache_type

    def __repr__(self) -> str:
        return util.repr_(self)

    @contextlib.contextmanager
    def calling_cached_function(self, func: types.FunctionType) -> Iterator[None]:
        self._cached_func_stack.append(func)
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
            cached_func = self._cached_func_stack[-1]
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
    arg_pairs: List[Tuple[Optional[str], Any]] = []
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
    source_code: Union[str, types.CodeType]
    try:
        source_code = inspect.getsource(func)
    except OSError as e:
        _LOGGER.debug(
            "Failed to retrieve function's source code when building its key; falling back to bytecode. err={0}",
            e,
        )
        source_code = func.__code__

    update_hash(
        source_code,
        hasher=func_hasher,
        cache_type=cache_type,
    )

    cache_key = func_hasher.hexdigest()
    return cache_key


def _get_positional_arg_name(func: types.FunctionType, arg_index: int) -> Optional[str]:
    """Return the name of a function's positional argument.

    If arg_index is out of range, or refers to a parameter that is not a
    named positional argument (e.g. an *args, **kwargs, or keyword-only param),
    return None instead.
    """
    if arg_index < 0:
        return None

    params: List[inspect.Parameter] = list(inspect.signature(func).parameters.values())
    if arg_index >= len(params):
        return None

    if params[arg_index].kind in (
        inspect.Parameter.POSITIONAL_OR_KEYWORD,
        inspect.Parameter.POSITIONAL_ONLY,
    ):
        return params[arg_index].name

    return None
