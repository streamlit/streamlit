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
from __future__ import (absolute_import, division, print_function,
                        unicode_literals)

import ast
import hashlib
import inspect
import os
import shutil
import struct
from collections import namedtuple
from functools import wraps

import astor

import streamlit as st
from streamlit import config, util
from streamlit.compatibility import setup_2_3_shims
from streamlit.hashing import CodeHasher, get_hash
from streamlit.logger import get_logger

setup_2_3_shims(globals())


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


CacheEntry = namedtuple('CacheEntry', ['value', 'hash', 'args_mutated'])
DiskCacheEntry = namedtuple('DiskCacheEntry', ['value', 'args_mutated'])


# The in memory cache.
_mem_cache = {}  # type: Dict[string, CacheEntry]


class _AddCopy(ast.NodeTransformer):
    """
    An AST transformer that wraps function calls with copy.deepcopy.
    Use this transformer if you will convert the AST back to code.
    The code won't work without importing copy.
    """

    def __init__(self, func_name):
        self.func_name = func_name

    def visit_Call(self, node):
        if (hasattr(node.func, 'func') and hasattr(node.func.func, 'value')
                and node.func.func.value.id == 'st'
                and node.func.func.attr == 'cache'):
            # Wrap st.cache(func(...))().
            return ast.copy_location(ast.Call(
                func=ast.Attribute(
                    value=ast.Name(id='copy', ctx=ast.Load()),
                    attr='deepcopy', ctx=ast.Load()
                ), args=[node], keywords=[]
            ), node)
        elif hasattr(node.func, 'id') and node.func.id == self.func_name:
            # Wrap func(...) where func is the cached function.

            # Add caching to nested calls.
            self.generic_visit(node)

            return ast.copy_location(ast.Call(
                func=ast.Attribute(
                    value=ast.Name(id='copy', ctx=ast.Load()),
                    attr='deepcopy', ctx=ast.Load()
                ), args=[node], keywords=[]), node)

        self.generic_visit(node)
        return node


def _build_caching_error_message(persisted, func, caller_frame):
    name = func.__name__

    frameinfo = inspect.getframeinfo(caller_frame)
    caller_file_name, caller_lineno, _, lines, _ = frameinfo

    try:
        # only works if calling code is a single line
        parsed_context = ast.parse(lines[0])
        parsed_context = _AddCopy(name).visit(parsed_context)
        copy_code = astor.to_source(parsed_context)
    except SyntaxError:
        LOGGER.debug('Could not parse calling code `%s`.', lines[0])
        copy_code = '... = copy.deepcopy(%s(...))' % name

    if persisted:
        load_or_rerun = 'load the value from disk'
    else:
        load_or_rerun = 'rerun the function'

    message = (
        '### ⚠️ Your Code Mutated a Return Value\n'
        'Since your program subsequently mutated the return value of the '
        'cached function `{name}`, Streamlit has to {load_or_rerun} in '
        '`{file_name}` line {lineno}.\n\n'
        'To dismiss this warning, you could copy the return value. '
        'For example by changing `{caller_file_name}` line {caller_lineno} to:'
        '\n```python\nimport copy\n{copy_code}\n```\n\n'

        'Or add `ignore_hash=True` to the `streamlit.cache` decorator for '
        '`{name}`.\n\n'

        'Learn more about caching and copying in the '
        '[Streamlit docs](https://streamlit.io/secret/docs/tutorial/caching_mapping_more.html).'
    )

    return message.format(
        name=name,
        load_or_rerun=load_or_rerun,
        file_name=os.path.relpath(func.__code__.co_filename),
        lineno=func.__code__.co_firstlineno,
        caller_file_name=os.path.relpath(caller_file_name),
        caller_lineno=caller_lineno,
        copy_code=copy_code
    )


def _build_args_mutated_message(func):
    message = (
        '**Cached function mutated its input arguments**\n\n'
        'When decorating a function with `@st.cache`, the arguments should not '
        'be mutated inside the function body, as that breaks the caching '
        'mechanism. Please update the code of `{name}` to bypass the mutation.\n\n'
        'See the [Streamlit docs](https://streamlit.io/secret/docs/tutorial/caching_mapping_more.html) for more info.'
    )

    return message.format(
        name=func.__name__
    )


def _read_from_mem_cache(key, ignore_hash):
    if key in _mem_cache:
        entry = _mem_cache[key]

        if ignore_hash or get_hash(entry.value) == entry.hash:
            LOGGER.debug('Memory cache HIT: %s', type(entry.value))
            return entry.value, entry.args_mutated
        else:
            LOGGER.debug('Cache object was mutated: %s', key)
            raise CachedObjectWasMutatedError()
    else:
        LOGGER.debug('Memory cache MISS: %s', key)
        raise CacheKeyNotFoundError('Key not found in mem cache')


def _write_to_mem_cache(key, value, ignore_hash, args_mutated):
    _mem_cache[key] = CacheEntry(
        value=value,
        hash=None if ignore_hash else get_hash(value),
        args_mutated=args_mutated
    )


def _read_from_disk_cache(key):
    path = util.get_streamlit_file_path('cache', '%s.pickle' % key)

    try:
        with util.streamlit_read(path, binary=True) as input:
            value, args_mutated = pickle.load(input)
            LOGGER.debug('Disk cache HIT: %s', type(value))
    except util.Error as e:
        LOGGER.error(e)
        raise CacheError('Unable to read from cache: %s' % e)
    except FileNotFoundError:
        raise CacheKeyNotFoundError('Key not found in disk cache')
    return value


def _write_to_disk_cache(key, value, args_mutated):
    path = util.get_streamlit_file_path('cache', '%s.pickle' % key)

    try:
        with util.streamlit_write(path, binary=True) as output:
            entry = DiskCacheEntry(value=value, args_mutated=args_mutated)
            pickle.dump(entry, output, pickle.HIGHEST_PROTOCOL)
    # In python 2, it's pickle struct error.
    # In python 3, it's an open error in util.
    except (util.Error, struct.error) as e:
        LOGGER.debug(e)
        # Cleanup file so we don't leave zero byte files.
        try:
            os.remove(path)
        except (FileNotFoundError, IOError, OSError):
            pass
        raise CacheError('Unable to write to cache: %s' % e)


def _read_from_cache(key, persisted, ignore_hash, func, caller_frame):
    """
    Read the value from the cache. Our goal is to read from memory
    if possible. If the data was mutated (hash changed), we show a
    warning. If reading from memory fails, we either read from disk
    or rerun the code.
    """
    try:
        return _read_from_mem_cache(key, ignore_hash)
    except (CacheKeyNotFoundError, CachedObjectWasMutatedError) as e:
        if isinstance(e, CachedObjectWasMutatedError):
            message = _build_caching_error_message(
                persisted, func, caller_frame)
            st.warning(message)

        if persisted:
            value, args_mutated = _read_from_disk_cache(key)
            _write_to_mem_cache(key, value, ignore_hash)
            return value, args_mutated
        raise e


def _write_to_cache(key, value, persist, ignore_hash, args_mutated):
    _write_to_mem_cache(key, value, ignore_hash, args_mutated)
    if persist:
        _write_to_disk_cache(key, value, args_mutated)


def cache(func=None, persist=False, ignore_hash=False):
    """Function decorator to memoize input function, saving to disk.

    Parameters
    ----------
    func : callable
        The function to cache. Streamlit hashes the function and dependent code.
        Streamlit can only hash nested objects (e.g. `bar` in `foo.bar`) in
        Python 3.4+.

    persist : boolean
        Whether to persist the cache on disk.

    ignore_hash : boolean
        Disable hashing return values. These hash values are otherwise
        used to validate that return values are not mutated.

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

    To disable hashing return values, set the `ignore_hash` parameter to `True`:

    >>> @st.cache(ignore_hash=True)
    ... def fetch_and_clean_data(url):
    ...     # Fetch data from URL here, and then clean it up.
    ...     return data

    """
    # Support setting the persist and ignore_hash parameters via
    # @st.cache(persist=True, ignore_hash=True)
    if func is None:
        return lambda f: cache(func=f, persist=persist, ignore_hash=ignore_hash)

    @wraps(func)
    def wrapped_func(*argc, **argv):
        """This function wrapper will only call the underlying function in
        the case of a cache miss. Cached objects are stored in the cache/
        directory."""
        if not config.get_option('client.caching'):
            LOGGER.debug('Purposefully skipping cache')
            return func(*argc, **argv)

        name = func.__name__

        if len(argc) == 0 and len(argv) == 0:
            message = 'Running %s().' % name
        else:
            message = 'Running %s(...).' % name
        with st.spinner(message):
            hasher = hashlib.new('md5')

            args_hasher = CodeHasher('md5', hasher)
            args_hasher.update([argc, argv])
            LOGGER.debug('Hashing arguments to %s of %i bytes.',
                         name, args_hasher.size)

            args_digest_before = args_hasher.digest()

            code_hasher = CodeHasher('md5', hasher)
            code_hasher.update(func)
            LOGGER.debug('Hashing function %s in %i bytes.',
                         name, code_hasher.size)

            key = hasher.hexdigest()
            LOGGER.debug('Cache key: %s', key)

            caller_frame = inspect.currentframe().f_back
            try:
                return_value, args_mutated = _read_from_cache(
                    key, persist, ignore_hash, func, caller_frame)
            except (CacheKeyNotFoundError, CachedObjectWasMutatedError):
                return_value = func(*argc, **argv)

                args_hasher_after = CodeHasher('md5')
                args_hasher_after.update([argc, argv])
                args_mutated = args_digest_before != args_hasher_after.digest()

                _write_to_cache(
                    key, return_value, persist, ignore_hash, args_mutated)

            if args_mutated:
                st.warning(_build_args_mutated_message(func))

        return return_value

    # Make this a well-behaved decorator by preserving important function
    # attributes.
    try:
        wrapped_func.__dict__.update(func.__dict__)
    except AttributeError:
        pass

    return wrapped_func


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
    return util.get_streamlit_file_path('cache')


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
