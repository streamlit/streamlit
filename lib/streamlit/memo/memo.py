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
import inspect
import threading
import types
from typing import Optional, List, Iterator, Callable, Any, Tuple

import streamlit as st
from streamlit import config, util
from streamlit.errors import StreamlitAPIWarning
from streamlit.logger import get_logger
from streamlit.memo.memo_cache import CacheKeyNotFoundError, MemoCache
from streamlit.memo.memo_hashing import update_memo_hash, HashReason

_LOGGER = get_logger(__name__)


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
                cache_key = _make_cache_key(func)

            # Get the cache that's attached to this function.
            # This cache's key is generated (above) from the function's code.
            cache = MemoCache.get_cache(cache_key, max_entries, ttl)

            # Generate the key for the cached value. This is based on the
            # arguments passed to the function.
            value_key = _make_value_key(func, *args, **kwargs)

            try:
                return_value = cache.read_value(
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

                cache.write_value(
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


def _make_cache_key(func: types.FunctionType) -> str:
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


def _get_positional_arg_name(func: Callable[..., Any], arg_index: int) -> Optional[str]:
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


def _make_value_key(func: Callable[..., Any], *args, **kwargs) -> str:
    """Create the key for a value within a cache.

    This key is generated from both the function's code and the arguments that
    are passed into it.
    """

    # Create a (name, value) list of all *args and **kwargs passed to the
    # function, except for those args whose name starts with "_". Underscore-
    # prefixed args are deliberately excluded from hashing.
    arg_pairs: List[Tuple[Optional[str], Any]] = []
    for arg_idx in range(len(args)):
        arg_name = _get_positional_arg_name(func, arg_idx)
        if arg_name is not None and arg_name.startswith("_"):
            _LOGGER.debug("Not hashing %s because it starts with _", arg_name)
            continue
        arg_pairs.append((arg_name, args[arg_idx]))

    for kw_name, kw_val in kwargs.items():
        if kw_name.startswith("_"):
            _LOGGER.debug("Not hashing %s because it starts with _", kw_name)
            continue
        arg_pairs.append((kw_name, kw_val))

    # Create a hash from the (name, value) arg pairs
    args_hasher = hashlib.new("md5")
    update_memo_hash(
        arg_pairs,
        hasher=args_hasher,
        hash_reason=HashReason.CACHING_FUNC_ARGS,
        hash_source=func,
    )

    value_key = args_hasher.hexdigest()
    _LOGGER.debug("Cache key: %s", value_key)

    return value_key


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
