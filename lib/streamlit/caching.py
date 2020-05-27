# Copyright 2018-2020 Streamlit Inc.
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

"""A library of caching utilities."""

import ast
import contextlib
import hashlib
import inspect
import math
import os
import pickle
import shutil
import struct
import textwrap
import threading
import time
from collections import namedtuple
from typing import Any, Dict, Optional

from cachetools import TTLCache

from streamlit import config
from streamlit import file_util
from streamlit import util
from streamlit.errors import StreamlitAPIWarning
from streamlit.errors import StreamlitDeprecationWarning
from streamlit.hashing import Context
from streamlit.hashing import update_hash
from streamlit.hashing import HashReason
from streamlit.logger import get_logger
from streamlit.util import functools_wraps
import streamlit as st


_LOGGER = get_logger(__name__)

# The timer function we use with TTLCache. This is the default timer func, but
# is exposed here as a constant so that it can be patched in unit tests.
_TTLCACHE_TIMER = time.monotonic


_CacheEntry = namedtuple("_CacheEntry", ["value", "hash"])
_DiskCacheEntry = namedtuple("_DiskCacheEntry", ["value"])


class _MemCaches(object):
    """Manages all in-memory st.cache caches"""

    def __init__(self):
        # Contains a cache object for each st.cache'd function
        self._lock = threading.RLock()
        self._function_caches = {}  # type: Dict[str, TTLCache]

    def get_cache(
        self, key: str, max_entries: Optional[float], ttl: Optional[float]
    ) -> TTLCache:
        """Return the mem cache for the given key.

        If it doesn't exist, create a new one with the given params.
        """

        if max_entries is None:
            max_entries = math.inf
        if ttl is None:
            ttl = math.inf

        if not isinstance(max_entries, (int, float)):
            raise RuntimeError("max_entries must be an int")
        if not isinstance(ttl, (int, float)):
            raise RuntimeError("ttl must be a float")

        # Get the existing cache, if it exists, and validate that its params
        # haven't changed.
        with self._lock:
            mem_cache = self._function_caches.get(key)
            if (
                mem_cache is not None
                and mem_cache.ttl == ttl
                and mem_cache.maxsize == max_entries
            ):
                return mem_cache

            # Create a new cache object and put it in our dict
            _LOGGER.debug(
                "Creating new mem_cache (key=%s, max_entries=%s, ttl=%s)",
                key,
                max_entries,
                ttl,
            )
            mem_cache = TTLCache(maxsize=max_entries, ttl=ttl, timer=_TTLCACHE_TIMER)
            self._function_caches[key] = mem_cache
            return mem_cache

    def clear(self) -> None:
        """Clear all caches"""
        with self._lock:
            self._function_caches = {}


# Our singleton _MemCaches instance
_mem_caches = _MemCaches()


# A thread-local counter that's incremented when we enter @st.cache
# and decremented when we exit.
class ThreadLocalCacheInfo(threading.local):
    def __init__(self):
        self.cached_func_stack = []
        self.suppress_st_function_warning = 0


_cache_info = ThreadLocalCacheInfo()


@contextlib.contextmanager
def _calling_cached_function(func):
    _cache_info.cached_func_stack.append(func)
    try:
        yield
    finally:
        _cache_info.cached_func_stack.pop()


@contextlib.contextmanager
def suppress_cached_st_function_warning():
    _cache_info.suppress_st_function_warning += 1
    try:
        yield
    finally:
        _cache_info.suppress_st_function_warning -= 1
        assert _cache_info.suppress_st_function_warning >= 0


def _show_cached_st_function_warning(dg, st_func_name, cached_func):
    # Avoid infinite recursion by suppressing additional cached
    # function warnings from within the cached function warning.
    with suppress_cached_st_function_warning():
        e = CachedStFunctionWarning(st_func_name, cached_func)
        dg.exception(e)


def maybe_show_cached_st_function_warning(dg, st_func_name):
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


class _AddCopy(ast.NodeTransformer):
    """
    An AST transformer that wraps function calls with copy.deepcopy.
    Use this transformer if you will convert the AST back to code.
    The code won't work without importing copy.
    """

    def __init__(self, func_name):
        self.func_name = func_name

    def visit_Call(self, node):
        if (
            hasattr(node.func, "func")
            and hasattr(node.func.func, "value")
            and node.func.func.value.id == "st"
            and node.func.func.attr == "cache"
        ):
            # Wrap st.cache(func(...))().
            return ast.copy_location(
                ast.Call(
                    func=ast.Attribute(
                        value=ast.Name(id="copy", ctx=ast.Load()),
                        attr="deepcopy",
                        ctx=ast.Load(),
                    ),
                    args=[node],
                    keywords=[],
                ),
                node,
            )
        elif hasattr(node.func, "id") and node.func.id == self.func_name:
            # Wrap func(...) where func is the cached function.

            # Add caching to nested calls.
            self.generic_visit(node)

            return ast.copy_location(
                ast.Call(
                    func=ast.Attribute(
                        value=ast.Name(id="copy", ctx=ast.Load()),
                        attr="deepcopy",
                        ctx=ast.Load(),
                    ),
                    args=[node],
                    keywords=[],
                ),
                node,
            )

        self.generic_visit(node)
        return node


def _read_from_mem_cache(
    mem_cache, key, allow_output_mutation, func_or_code, hash_funcs
):
    if key in mem_cache:
        entry = mem_cache[key]

        if not allow_output_mutation:
            computed_output_hash = _get_output_hash(
                entry.value, func_or_code, hash_funcs
            )
            stored_output_hash = entry.hash

            if computed_output_hash != stored_output_hash:
                _LOGGER.debug("Cached object was mutated: %s", key)
                raise CachedObjectMutationError(entry.value, func_or_code)

        _LOGGER.debug("Memory cache HIT: %s", type(entry.value))
        return entry.value

    else:
        _LOGGER.debug("Memory cache MISS: %s", key)
        raise CacheKeyNotFoundError("Key not found in mem cache")


def _write_to_mem_cache(
    mem_cache, key, value, allow_output_mutation, func_or_code, hash_funcs
):
    if allow_output_mutation:
        hash = None
    else:
        hash = _get_output_hash(value, func_or_code, hash_funcs)

    mem_cache[key] = _CacheEntry(value=value, hash=hash)


def _get_output_hash(value, func_or_code, hash_funcs):
    hasher = hashlib.new("md5")
    update_hash(
        value,
        hasher=hasher,
        hash_funcs=hash_funcs,
        hash_reason=HashReason.CACHING_FUNC_OUTPUT,
        hash_source=func_or_code,
    )
    return hasher.digest()


def _read_from_disk_cache(key):
    path = file_util.get_streamlit_file_path("cache", "%s.pickle" % key)
    try:
        with file_util.streamlit_read(path, binary=True) as input:
            entry = pickle.load(input)
            value = entry.value
            _LOGGER.debug("Disk cache HIT: %s", type(value))
    except util.Error as e:
        _LOGGER.error(e)
        raise CacheError("Unable to read from cache: %s" % e)

    except FileNotFoundError:
        raise CacheKeyNotFoundError("Key not found in disk cache")
    return value


def _write_to_disk_cache(key, value):
    path = file_util.get_streamlit_file_path("cache", "%s.pickle" % key)

    try:
        with file_util.streamlit_write(path, binary=True) as output:
            entry = _DiskCacheEntry(value=value)
            pickle.dump(entry, output, pickle.HIGHEST_PROTOCOL)
    except util.Error as e:
        _LOGGER.debug(e)
        # Clean up file so we don't leave zero byte files.
        try:
            os.remove(path)
        except (FileNotFoundError, IOError, OSError):
            pass
        raise CacheError("Unable to write to cache: %s" % e)


def _read_from_cache(
    mem_cache, key, persist, allow_output_mutation, func_or_code, hash_funcs=None
):
    """Read a value from the cache.

    Our goal is to read from memory if possible. If the data was mutated (hash
    changed), we show a warning. If reading from memory fails, we either read
    from disk or rerun the code.
    """
    try:
        return _read_from_mem_cache(
            mem_cache, key, allow_output_mutation, func_or_code, hash_funcs
        )

    except CachedObjectMutationError as e:
        st.exception(CachedObjectMutationWarning(e))
        return e.cached_value

    except CacheKeyNotFoundError as e:
        if persist:
            value = _read_from_disk_cache(key)
            _write_to_mem_cache(
                mem_cache, key, value, allow_output_mutation, func_or_code, hash_funcs
            )
            return value
        raise e


def _write_to_cache(
    mem_cache, key, value, persist, allow_output_mutation, func_or_code, hash_funcs=None
):
    _write_to_mem_cache(
        mem_cache, key, value, allow_output_mutation, func_or_code, hash_funcs
    )
    if persist:
        _write_to_disk_cache(key, value)


def cache(
    func=None,
    persist=False,
    allow_output_mutation=False,
    show_spinner=True,
    suppress_st_warning=False,
    hash_funcs=None,
    max_entries=None,
    ttl=None,
):
    """Function decorator to memoize function executions.

    Parameters
    ----------
    func : callable
        The function to cache. Streamlit hashes the function and dependent code.

    persist : boolean
        Whether to persist the cache on disk.

    allow_output_mutation : boolean
        Streamlit normally shows a warning when return values are not mutated, as that
        can have unintended consequences. This is done by hashing the return value internally.

        If you know what you're doing and would like to override this warning, set this to True.

    show_spinner : boolean
        Enable the spinner. Default is True to show a spinner when there is
        a cache miss.

    suppress_st_warning : boolean
        Suppress warnings about calling Streamlit functions from within
        the cached function.

    hash_funcs : dict or None
        Mapping of types or fully qualified names to hash functions. This is used to override
        the behavior of the hasher inside Streamlit's caching mechanism: when the hasher
        encounters an object, it will first check to see if its type matches a key in this
        dict and, if so, will use the provided function to generate a hash for it. See below
        for an example of how this can be used.

    max_entries : int or None
        The maximum number of entries to keep in the cache, or None
        for an unbounded cache. (When a new entry is added to a full cache,
        the oldest cached entry will be removed.) The default is None.

    ttl : float or None
        The maximum number of seconds to keep an entry in the cache, or
        None if cache entries should not expire. The default is None.

    Example
    -------
    >>> @st.cache
    ... def fetch_and_clean_data(url):
    ...     # Fetch data from URL here, and then clean it up.
    ...     return data
    ...
    >>> d1 = fetch_and_clean_data(DATA_URL_1)
    >>> # Actually executes the function, since this is the first time it was
    >>> # encountered.
    >>>
    >>> d2 = fetch_and_clean_data(DATA_URL_1)
    >>> # Does not execute the function. Just returns its previously computed
    >>> # value. This means that now the data in d1 is the same as in d2.
    >>>
    >>> d3 = fetch_and_clean_data(DATA_URL_2)
    >>> # This is a different URL, so the function executes.

    To set the `persist` parameter, use this command as follows:

    >>> @st.cache(persist=True)
    ... def fetch_and_clean_data(url):
    ...     # Fetch data from URL here, and then clean it up.
    ...     return data

    To disable hashing return values, set the `allow_output_mutation` parameter to `True`:

    >>> @st.cache(allow_output_mutation=True)
    ... def fetch_and_clean_data(url):
    ...     # Fetch data from URL here, and then clean it up.
    ...     return data


    To override the default hashing behavior, pass a custom hash function.
    You can do that by mapping a type (e.g. `MongoClient`) to a hash function (`id`) like this:

    >>> @st.cache(hash_funcs={MongoClient: id})
    ... def connect_to_database(url):
    ...     return MongoClient(url)

    Alternatively, you can map the type's fully-qualified name
    (e.g. `"pymongo.mongo_client.MongoClient"`) to the hash function instead:

    >>> @st.cache(hash_funcs={"pymongo.mongo_client.MongoClient": id})
    ... def connect_to_database(url):
    ...     return MongoClient(url)

    """
    _LOGGER.debug("Entering st.cache: %s", func)

    # Support passing the params via function decorator, e.g.
    # @st.cache(persist=True, allow_output_mutation=True)
    if func is None:
        return lambda f: cache(
            func=f,
            persist=persist,
            allow_output_mutation=allow_output_mutation,
            show_spinner=show_spinner,
            suppress_st_warning=suppress_st_warning,
            hash_funcs=hash_funcs,
            max_entries=max_entries,
            ttl=ttl,
        )

    # Create the unique key for this function's cache. The cache will be
    # retrieved from inside the wrapped function.
    #
    # A naive implementation would involve simply creating the cache object
    # right here in the wrapper, which in a normal Python script would be
    # executed only once. But in Streamlit, we reload all modules related to a
    # user's app when the app is re-run, which means that - among other
    # things - all function decorators in the app will be re-run, and so any
    # decorator-local objects will be recreated.
    #
    # Furthermore, our caches can be destroyed and recreated (in response
    # to cache clearing, for example), which means that retrieving the
    # function's cache here (so that the wrapped function can save a lookup)
    # is incorrect: the cache itself may be recreated between
    # decorator-evaluation time and decorated-function-execution time. So
    # we must retrieve the cache object *and* perform the cached-value lookup
    # inside the decorated function.

    func_hasher = hashlib.new("md5")

    # Include the function's module and qualified name in the hash.
    # This means that two identical functions in different modules
    # will not share a hash; it also means that two identical *nested*
    # functions in the same module will not share a hash.
    update_hash(
        (func.__module__, func.__qualname__, func),
        hasher=func_hasher,
        hash_funcs=hash_funcs,
        hash_reason=HashReason.CACHING_FUNC_BODY,
        hash_source=func,
    )

    cache_key = func_hasher.hexdigest()
    _LOGGER.debug(
        "mem_cache key for %s.%s: %s", func.__module__, func.__qualname__, cache_key
    )

    @functools_wraps(func)
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
            # First, get the cache that's attached to this function.
            # This cache's key is generated (above) from the function's code.
            mem_cache = _mem_caches.get_cache(cache_key, max_entries, ttl)

            # Next, calculate the key for the value we'll be searching for
            # within that cache. This key is generated from both the function's
            # code and the arguments that are passed into it. (Even though this
            # key is used to index into a per-function cache, it must be
            # globally unique, because it is *also* used for a global on-disk
            # cache that is *not* per-function.)
            value_hasher = hashlib.new("md5")

            if args:
                update_hash(
                    args,
                    hasher=value_hasher,
                    hash_funcs=hash_funcs,
                    hash_reason=HashReason.CACHING_FUNC_ARGS,
                    hash_source=func,
                )

            if kwargs:
                update_hash(
                    kwargs,
                    hasher=value_hasher,
                    hash_funcs=hash_funcs,
                    hash_reason=HashReason.CACHING_FUNC_ARGS,
                    hash_source=func,
                )

            value_key = value_hasher.hexdigest()

            # Avoid recomputing the body's hash by just appending the
            # previously-computed hash to the arg hash.
            value_key = "%s-%s" % (value_key, cache_key)

            _LOGGER.debug("Cache key: %s", value_key)

            try:
                return_value = _read_from_cache(
                    mem_cache=mem_cache,
                    key=value_key,
                    persist=persist,
                    allow_output_mutation=allow_output_mutation,
                    func_or_code=func,
                    hash_funcs=hash_funcs,
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

                _write_to_cache(
                    mem_cache=mem_cache,
                    key=value_key,
                    value=return_value,
                    persist=persist,
                    allow_output_mutation=allow_output_mutation,
                    func_or_code=func,
                    hash_funcs=hash_funcs,
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


class Cache(Dict[Any, Any]):
    """Cache object to persist data across reruns.

    Parameters
    ----------

    Example
    -------
    >>> c = st.Cache()
    ... if c:
    ...     # Fetch data from URL here, and then clean it up. Finally assign to c.
    ...     c.data = ...
    ...
    >>> # c.data will always be defined but the code block only runs the first time

    The only valid side effect inside the if code block are changes to c. Any
    other side effect has undefined behavior.

    In Python 3.8 and above, you can combine the assignment and if-check with an
    assignment expression (`:=`).

    >>> if c := st.Cache():
    ...     # Fetch data from URL here, and then clean it up. Finally assign to c.
    ...     c.data = ...


    """

    def __init__(self, persist=False, allow_output_mutation=False):
        self._persist = persist
        self._allow_output_mutation = allow_output_mutation
        self._mem_cache = {}

        dict.__init__(self)

    def has_changes(self) -> bool:
        current_frame = inspect.currentframe()

        assert current_frame is not None
        caller_frame = current_frame.f_back

        current_file = inspect.getfile(current_frame)
        caller_file = inspect.getfile(caller_frame)
        real_caller_is_parent_frame = current_file == caller_file
        if real_caller_is_parent_frame:
            caller_frame = caller_frame.f_back

        filename, caller_lineno, code_context = _get_frame_info(caller_frame)

        assert code_context is not None
        code_context = code_context[0]

        context_indent = len(code_context) - len(code_context.lstrip())

        lines = []
        # TODO: Memoize open(filename, 'r') in a way that clears the memoized
        # version with each run of the user's script. Then use the memoized
        # text here, in st.echo, and other places.
        with open(filename, "r") as f:
            for line in f.readlines()[caller_lineno:]:
                if line.strip() == "":
                    lines.append(line)
                indent = len(line) - len(line.lstrip())
                if indent <= context_indent:
                    break
                if line.strip() and not line.lstrip().startswith("#"):
                    lines.append(line)

        while lines[-1].strip() == "":
            lines.pop()

        code_block = "".join(lines)
        program = textwrap.dedent(code_block)

        context = Context(dict(caller_frame.f_globals, **caller_frame.f_locals), {}, {})
        code = compile(program, filename, "exec")

        hasher = hashlib.new("md5")
        update_hash(
            code,
            hasher=hasher,
            context=context,
            hash_reason=HashReason.CACHING_BLOCK,
            hash_source=code,
        )

        key = hasher.hexdigest()
        _LOGGER.debug("Cache key: %s", key)

        try:
            value, _ = _read_from_cache(
                mem_cache=self._mem_cache,
                key=key,
                persist=self._persist,
                allow_output_mutation=self._allow_output_mutation,
                func_or_code=code,
            )
            self.update(value)

        except CacheKeyNotFoundError:
            if self._allow_output_mutation and not self._persist:
                # If we don't hash the results, we don't need to use exec and just return True.
                # This way line numbers will be correct.
                _write_to_cache(
                    mem_cache=self._mem_cache,
                    key=key,
                    value=self,
                    persist=False,
                    allow_output_mutation=True,
                    func_or_code=code,
                )
                return True

            exec(code, caller_frame.f_globals, caller_frame.f_locals)
            _write_to_cache(
                mem_cache=self._mem_cache,
                key=key,
                value=self,
                persist=self._persist,
                allow_output_mutation=self._allow_output_mutation,
                func_or_code=code,
            )

        # Return False so that we have control over the execution.
        return False

    def __bool__(self):
        return self.has_changes()

    def __getattr__(self, key):
        if key not in self:
            raise AttributeError("Cache has no atribute %s" % key)
        return self.__getitem__(key)

    def __setattr__(self, key, value):
        dict.__setitem__(self, key, value)


def clear_cache():
    """Clear the memoization cache.

    Returns
    -------
    boolean
        True if the disk cache was cleared. False otherwise (e.g. cache file
        doesn't exist on disk).
    """
    _clear_mem_cache()
    return _clear_disk_cache()


def get_cache_path():
    return file_util.get_streamlit_file_path("cache")


def _clear_disk_cache():
    # TODO: Only delete disk cache for functions related to the user's current
    # script.
    cache_path = get_cache_path()
    if os.path.isdir(cache_path):
        shutil.rmtree(cache_path)
        return True
    return False


def _clear_mem_cache():
    _mem_caches.clear()


def _get_frame_info(caller_frame):
    frameinfo = inspect.getframeinfo(caller_frame)
    filename, caller_lineno, _, code_context, _ = frameinfo
    return filename, caller_lineno, code_context


class CacheError(Exception):
    pass


class CacheKeyNotFoundError(Exception):
    pass


class CachedObjectMutationError(ValueError):
    """This is used internally, but never shown to the user.

    Users see CachedObjectMutationWarning instead.
    """

    def __init__(self, cached_value, func_or_code):
        self.cached_value = cached_value
        if inspect.iscode(func_or_code):
            self.cached_func_name = "a code block"
        else:
            self.cached_func_name = _get_cached_func_name_md(func_or_code)


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


class CachedObjectMutationWarning(StreamlitAPIWarning):
    def __init__(self, orig_exc):
        msg = self._get_message(orig_exc)
        super(CachedObjectMutationWarning, self).__init__(msg)

    def _get_message(self, orig_exc):
        return (
            """
Return value of %(func_name)s was mutated between runs.

By default, Streamlit's cache should be treated as immutable, or it may behave
in unexpected ways. You received this warning because Streamlit detected
that an object returned by %(func_name)s was mutated outside of %(func_name)s.

How to fix this:
* If you did not mean to mutate that return value:
  - If possible, inspect your code to find and remove that mutation.
  - Otherwise, you could also clone the returned value so you can freely
    mutate it.
* If you actually meant to mutate the return value and know the consequences of
doing so, just annotate the function with `@st.cache(allow_output_mutation=True)`.

For more information and detailed solutions check out [our documentation.]
(https://docs.streamlit.io/en/latest/advanced_caching.html)
            """
            % {"func_name": orig_exc.cached_func_name}
        ).strip("\n")


def _get_cached_func_name_md(func):
    """Get markdown representation of the function name."""
    if hasattr(func, "__name__"):
        return "`%s()`" % func.__name__
    else:
        return "a cached function"
