# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

# Python 2/3 compatibility
from __future__ import absolute_import, division, print_function

import ast
import contextlib
import hashlib
import inspect
import os
import shutil
import struct
import textwrap
import threading
from collections import namedtuple

import streamlit as st
from streamlit.util import functools_wraps
from streamlit import config
from streamlit import file_util
from streamlit import util
from streamlit.compatibility import setup_2_3_shims
from streamlit.hashing import CodeHasher
from streamlit.hashing import Context
from streamlit.hashing import get_hash
from streamlit.logger import get_logger

setup_2_3_shims(globals())

CACHED_ST_FUNCTION_WARNING = """
Your script writes to your Streamlit app from within a cached function. This
code will only be called when we detect a cache "miss", which can lead to
unexpected results.

How to resolve this warning:
* Move the streamlit function call outside the cached function.
* Or, if you know what you're doing, use `@st.cache(suppress_st_warning=True)`
to suppress the warning.
"""

try:
    # cPickle, if available, is much faster than pickle.
    # Source: https://pymotw.com/2/pickle/
    import cPickle as pickle
except ImportError:
    import pickle


LOGGER = get_logger(__name__)


class CacheError(Exception):
    pass


class CacheKeyNotFoundError(Exception):
    pass


class CachedObjectWasMutatedError(ValueError):
    pass


CacheEntry = namedtuple("CacheEntry", ["value", "hash"])
DiskCacheEntry = namedtuple("DiskCacheEntry", ["value"])


# The in memory cache.
_mem_cache = {}  # Type: Dict[string, CacheEntry]


# A thread-local counter that's incremented when we enter @st.cache
# and decremented when we exit.
class ThreadLocalCacheInfo(threading.local):
    def __init__(self):
        self.within_cached_func = 0
        self.suppress_st_function_warning = 0


_cache_info = ThreadLocalCacheInfo()


@contextlib.contextmanager
def _calling_cached_function():
    _cache_info.within_cached_func += 1
    try:
        yield
    finally:
        _cache_info.within_cached_func -= 1


@contextlib.contextmanager
def suppress_cached_st_function_warning():
    _cache_info.suppress_st_function_warning += 1
    try:
        yield
    finally:
        _cache_info.suppress_st_function_warning -= 1
        assert _cache_info.suppress_st_function_warning >= 0


def _show_cached_st_function_warning(dg):
    # Avoid infinite recursion by suppressing additional cached
    # function warnings from within the cached function warning.
    with suppress_cached_st_function_warning():
        dg.warning(CACHED_ST_FUNCTION_WARNING)


def maybe_show_cached_st_function_warning(dg):
    """If appropriate, warn about calling st.foo inside @cache.

    DeltaGenerator's @_with_element and @_widget wrappers use this to warn
    the user when they're calling st.foo() from within a function that is
    wrapped in @st.cache.

    Parameters
    ----------
    dg : DeltaGenerator
        The DeltaGenerator to publish the warning to.

    """
    if (
        _cache_info.within_cached_func > 0
        and _cache_info.suppress_st_function_warning <= 0
    ):
        _show_cached_st_function_warning(dg)


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


def _build_caching_func_error_message(persisted, func, caller_frame):
    name = func.__name__

    frameinfo = inspect.getframeinfo(caller_frame)
    caller_file_name, caller_lineno, _, lines, _ = frameinfo

    try:
        import astor

        # only works if calling code is a single line
        parsed_context = ast.parse(lines[0].lstrip())
        parsed_context = _AddCopy(name).visit(parsed_context)
        copy_code = astor.to_source(parsed_context)
    except SyntaxError:
        LOGGER.debug("Could not parse calling code `%s`.", lines[0])
        copy_code = "... = copy.deepcopy(%s(...))" % name

    if persisted:
        load_or_rerun = "loading the value back from the disk cache"
    else:
        load_or_rerun = "rerunning the function"

    message = textwrap.dedent(
        """
        **Your code mutated a cached return value**

        Streamlit detected the mutation of a return value of `{name}`, which is
        a cached function. This happened in `{file_name}` line {lineno}. Since
        `persist` is `{persisted}`, Streamlit will make up for this by
        {load_or_rerun}, so your code will still work, but with reduced
        performance.

        To dismiss this warning, try one of the following:

        1. *Preferred:* fix the code by removing the mutation. The simplest way
        to do this is to copy the cached value to a new variable, which you are
        allowed to mutate. For example, try changing `{caller_file_name}` line
        {caller_lineno} to:

        ```python
        import copy
        {copy_code}
        ```

        2. Add `allow_output_mutation=True` to the `@streamlit.cache` decorator for
        `{name}`.  This is an escape hatch for advanced users who really know
        what they're doing.

        Learn more about caching and copying in the [Streamlit documentation]
        (https://streamlit.io/docs/tutorial/create_a_data_explorer_app.html).
        """
    ).strip("\n")

    return message.format(
        name=name,
        load_or_rerun=load_or_rerun,
        file_name=os.path.relpath(func.__code__.co_filename),
        lineno=func.__code__.co_firstlineno,
        persisted=persisted,
        caller_file_name=os.path.relpath(caller_file_name),
        caller_lineno=caller_lineno,
        copy_code=copy_code,
    )


def _build_caching_block_error_message(persisted, code, line_number_range):
    if persisted:
        load_or_rerun = "loading the value back from the disk cache"
    else:
        load_or_rerun = "rerunning the code"

    [start, end] = line_number_range
    if start == end:
        lines = "line {start}".format(start=start)
    else:
        lines = "lines {start} to {end}".format(start=start, end=end)

    message = textwrap.dedent(
        """
        **Your code mutated a cached value**

        Streamlit detected the mutation of a cached value in `{file_name}` in
        {lines}.  Since `persist` is `{persisted}`, Streamlit will make up for
        this by {load_or_rerun}, so your code will still work, but with reduced
        performance.

        To dismiss this warning, try one of the following:

        1. *Preferred:* fix the code by removing the mutation. The simplest way
        to do this is to copy the cached value to a new variable, which you are
        allowed to mutate.
        2. Add `allow_output_mutation=True` to the constructor of `streamlit.Cache`. This
        is an escape hatch for advanced users who really know what they're
        doing.

        Learn more about caching and copying in the [Streamlit documentation]
        (https://streamlit.io/docs/tutorial/create_a_data_explorer_app.html).
    """
    ).strip("\n")

    return message.format(
        load_or_rerun=load_or_rerun,
        file_name=os.path.relpath(code.co_filename),
        lines=lines,
        persisted=persisted,
    )


def _read_from_mem_cache(key, allow_output_mutation, hash_funcs):
    if key in _mem_cache:
        entry = _mem_cache[key]

        if (
            allow_output_mutation
            or get_hash(entry.value, hash_funcs=hash_funcs) == entry.hash
        ):
            LOGGER.debug("Memory cache HIT: %s", type(entry.value))
            return entry.value
        else:
            LOGGER.debug("Cache object was mutated: %s", key)
            raise CachedObjectWasMutatedError()
    else:
        LOGGER.debug("Memory cache MISS: %s", key)
        raise CacheKeyNotFoundError("Key not found in mem cache")


def _write_to_mem_cache(key, value, allow_output_mutation, hash_funcs):
    if allow_output_mutation:
        hash = None
    else:
        hash = get_hash(value, hash_funcs=hash_funcs)

    _mem_cache[key] = CacheEntry(value=value, hash=hash)


def _read_from_disk_cache(key):
    path = file_util.get_streamlit_file_path("cache", "%s.pickle" % key)
    try:
        with file_util.streamlit_read(path, binary=True) as input:
            entry = pickle.load(input)
            value = entry.value
            LOGGER.debug("Disk cache HIT: %s", type(value))
    except util.Error as e:
        LOGGER.error(e)
        raise CacheError("Unable to read from cache: %s" % e)

    except (OSError, FileNotFoundError):  # Python 2  # Python 3
        raise CacheKeyNotFoundError("Key not found in disk cache")
    return value


def _write_to_disk_cache(key, value):
    path = file_util.get_streamlit_file_path("cache", "%s.pickle" % key)

    try:
        with file_util.streamlit_write(path, binary=True) as output:
            entry = DiskCacheEntry(value=value)
            pickle.dump(entry, output, pickle.HIGHEST_PROTOCOL)
    # In python 2, it's pickle struct error.
    # In python 3, it's an open error in util.
    except (util.Error, struct.error) as e:
        LOGGER.debug(e)
        # Clean up file so we don't leave zero byte files.
        try:
            os.remove(path)
        except (FileNotFoundError, IOError, OSError):
            pass
        raise CacheError("Unable to write to cache: %s" % e)


def _read_from_cache(
    key, persisted, allow_output_mutation, func_or_code, message_opts, hash_funcs
):
    """
    Read the value from the cache. Our goal is to read from memory
    if possible. If the data was mutated (hash changed), we show a
    warning. If reading from memory fails, we either read from disk
    or rerun the code.
    """
    try:
        return _read_from_mem_cache(key, allow_output_mutation, hash_funcs)
    except (CacheKeyNotFoundError, CachedObjectWasMutatedError) as e:
        if isinstance(e, CachedObjectWasMutatedError):
            if inspect.isroutine(func_or_code):
                message = _build_caching_func_error_message(
                    persisted, func_or_code, message_opts
                )
            else:
                message = _build_caching_block_error_message(
                    persisted, func_or_code, message_opts
                )
            st.warning(message)

        if persisted:
            value = _read_from_disk_cache(key)
            _write_to_mem_cache(key, value, allow_output_mutation, hash_funcs)
            return value
        raise e


def _write_to_cache(key, value, persist, allow_output_mutation, hash_funcs):
    _write_to_mem_cache(key, value, allow_output_mutation, hash_funcs)
    if persist:
        _write_to_disk_cache(key, value)


def cache(
    func=None,
    persist=False,
    allow_output_mutation=False,
    show_spinner=True,
    suppress_st_warning=False,
    hash_funcs=None,
    **kwargs
):
    """Function decorator to memoize function executions.

    Parameters
    ----------
    func : callable
        The function to cache. Streamlit hashes the function and dependent code.
        Streamlit can only hash nested objects (e.g. `bar` in `foo.bar`) in
        Python 3.4+.

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
        Mapping of types to hash functions. This is used to override the behavior of the hasher
        inside Streamlit's caching mechanism: when the hasher encounters an object, it will first
        check to see if its type matches a key in this dict and, if so, will use the provided
        function to generate a hash for it. See below for an example of how this can be used.

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


    To override the default hashing behavior, pass a mapping of type to hash function:

    >>> @st.cache(hash_funcs={MongoClient: id})
    ... def connect_to_database(url):
    ...     return MongoClient(url)

    """
    # Help users migrate to the new kwarg
    # Remove this warning after 2020-03-16.
    if "ignore_hash" in kwargs:
        raise Exception(
            "The `ignore_hash` argument has been renamed to `allow_output_mutation`."
        )

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
        )

    @functools_wraps(func)
    def wrapped_func(*args, **kwargs):
        """This function wrapper will only call the underlying function in
        the case of a cache miss. Cached objects are stored in the cache/
        directory."""

        if not config.get_option("client.caching"):
            LOGGER.debug("Purposefully skipping cache")
            return func(*args, **kwargs)

        name = func.__name__

        if len(args) == 0 and len(kwargs) == 0:
            message = "Running %s()." % name
        else:
            message = "Running %s(...)." % name

        def get_or_set_cache():
            hasher = hashlib.new("md5")

            args_hasher = CodeHasher("md5", hasher, hash_funcs)
            args_hasher.update([args, kwargs])
            LOGGER.debug("Hashing arguments to %s of %i bytes.", name, args_hasher.size)

            code_hasher = CodeHasher("md5", hasher, hash_funcs)
            code_hasher.update(func)
            LOGGER.debug("Hashing function %s in %i bytes.", name, code_hasher.size)

            key = hasher.hexdigest()
            LOGGER.debug("Cache key: %s", key)

            caller_frame = inspect.currentframe().f_back
            try:
                return_value = _read_from_cache(
                    key, persist, allow_output_mutation, func, caller_frame, hash_funcs
                )
            except (CacheKeyNotFoundError, CachedObjectWasMutatedError):
                with _calling_cached_function():
                    if suppress_st_warning:
                        with suppress_cached_st_function_warning():
                            return_value = func(*args, **kwargs)
                    else:
                        return_value = func(*args, **kwargs)

                _write_to_cache(
                    key=key,
                    value=return_value,
                    persist=persist,
                    allow_output_mutation=allow_output_mutation,
                    hash_funcs=hash_funcs,
                )

            return return_value

        if show_spinner:
            with st.spinner(message):
                return get_or_set_cache()
        else:
            return get_or_set_cache()

    # Make this a well-behaved decorator by preserving important function
    # attributes.
    try:
        wrapped_func.__dict__.update(func.__dict__)
    except AttributeError:
        pass

    return wrapped_func


class Cache(dict):
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

        dict.__init__(self)

    def has_changes(self):
        current_frame = inspect.currentframe()
        caller_frame = current_frame.f_back

        current_file = inspect.getfile(current_frame)
        caller_file = inspect.getfile(caller_frame)
        real_caller_is_parent_frame = current_file == caller_file
        if real_caller_is_parent_frame:
            caller_frame = caller_frame.f_back

        frameinfo = inspect.getframeinfo(caller_frame)
        filename, caller_lineno, _, code_context, _ = frameinfo

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

        code_hasher = CodeHasher("md5")
        code_hasher.update(code, context)
        LOGGER.debug("Hashing block in %i bytes.", code_hasher.size)

        key = code_hasher.hexdigest()
        LOGGER.debug("Cache key: %s", key)

        try:
            value, _ = _read_from_cache(
                key,
                self._persist,
                self._allow_output_mutation,
                code,
                [caller_lineno + 1, caller_lineno + len(lines)],
            )
            self.update(value)
        except (CacheKeyNotFoundError, CachedObjectWasMutatedError):
            if self._allow_output_mutation and not self._persist:
                # If we don't hash the results, we don't need to use exec and just return True.
                # This way line numbers will be correct.
                _write_to_cache(
                    key=key, value=self, persist=False, allow_output_mutation=True
                )
                return True

            exec(code, caller_frame.f_globals, caller_frame.f_locals)
            _write_to_cache(
                key=key,
                value=self,
                persist=self._persist,
                allow_output_mutation=self._allow_output_mutation,
            )

        # Return False so that we have control over the execution.
        return False

    def __bool__(self):
        return self.has_changes()

    # Python 2 doesn't have __bool__
    def __nonzero__(self):
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
    global _mem_cache
    _mem_cache = {}
