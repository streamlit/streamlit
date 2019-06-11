# Copyright 2018 Streamlit Inc. All rights reserved.

"""A library of useful utilities."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import copy
import hashlib
import inspect
import os
import re
import shutil
import struct

try:
    # cPickle, if available, is much faster than pickle.
    # Source: https://pymotw.com/2/pickle/
    #
    # In many situations it's even faster than deepcopy (used for the in-memory
    # cache), but deepcopy is more general.
    # Source: https://stackoverflow.com/a/1411229
    #
    import cPickle as pickle
except ImportError:
    import pickle

from functools import wraps

import streamlit as st
from streamlit import config
from streamlit import util
from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


class CacheError(Exception):
  pass


mem_cache = {}


def read_from_mem_cache(key):
    if key in mem_cache:
        rv = mem_cache[key]
        LOGGER.debug('Cache HIT: %s', type(rv))
        return rv
    else:
        LOGGER.debug('Cache MISS: %s', key)
        raise FileNotFoundError('Key not found in mem cache')


def write_to_mem_cache(key, rv):
    mem_cache[key] = copy.deepcopy(rv)


def read_from_disk_cache(key):
    path = util.get_streamlit_file_path('cache', '%s.pickle' % key)

    try:
        with util.streamlit_read(path, binary=True) as input:
            rv = pickle.load(input)
            LOGGER.debug('Cache HIT: ' + str(type(rv)))
    except util.Error as e:
        LOGGER.debug(e)
        raise CacheError('Unable to read from cache: %s' % e)
    return rv


def write_to_disk_cache(key, rv):
    path = util.get_streamlit_file_path('cache', '%s.pickle' % key)

    try:
        with util.streamlit_write(path, binary=True) as output:
            pickle.dump(rv, output, pickle.HIGHEST_PROTOCOL)
    # In python 2, its pickle struct error.
    # In python 3, its an open error in util.
    except (util.Error, struct.error) as e:
        LOGGER.debug(e)
        # Cleanup file so we don't leave zero byte files.
        try:
            os.remove(path)
        except (FileNotFoundError, IOError, OSError):
            pass
        raise CacheError('Unable to write to cache: %s' % e)


def read_from_cache(key, use_disk_cache=False):
    if use_disk_cache:
        return read_from_disk_cache(key)
    else:
        return read_from_mem_cache(key)


def write_to_cache(key, rv, use_disk_cache=False):
    if use_disk_cache:
        return write_to_disk_cache(key, rv)
    else:
        return write_to_mem_cache(key, rv)


def cache(func=None, on_disk=False):
    """Function decorator to memoize input function, saving to disk.

    Parameters
    ----------
    func : callable
        The function to cache.

    on_disk : boolean
        Whether to cache on disk. If false (default) caches on volatile memory.

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

    To set the `on_disk` parameter, use this command as follows:

    >>> @st.cache(on_disk=True)
    ... def fetch_and_clean_data(url):
    ...     # Fetch data from URL here, and then clean it up.
    ...     return data


    """
    # Support setting on_disk parameter via @st.cache(on_disk=True)
    if func is None:
        return lambda f: cache(func=f, on_disk=on_disk)

    @wraps(func)
    def wrapped_func(*argc, **argv):
        """This function wrapper will only call the underlying function in
        the case of a cache miss. Cached objects are stored in the cache/
        directory."""
        if not config.get_option('client.caching'):
            LOGGER.debug('Purposefully skipping cache')
            return func(*argc, **argv)

        # Temporarily display this message while computing this function.
        if len(argc) == 0 and len(argv) == 0:
            message = 'Running %s().' % func.__name__
        else:
            message = 'Running %s(...).' % func.__name__
        with st.spinner(message):
            # Calculate the filename hash.
            hasher = hashlib.new('md5')
            LOGGER.debug('Created the hasher. (%s)', func.__name__)
            arg_string = pickle.dumps([argc, argv], pickle.HIGHEST_PROTOCOL)
            LOGGER.debug('Hashing %i bytes. %s',
                len(arg_string), func.__name__)
            hasher.update(arg_string)
            hasher.update(inspect.getsource(func).encode('utf-8'))
            key = hasher.hexdigest()
            LOGGER.debug('Cache key: %s', key)

            # Load the file (hit) or compute the function (miss).
            try:
                rv = read_from_cache(key, on_disk)
            except (FileNotFoundError, IOError, OSError):
                rv = func(*argc, **argv)
                write_to_cache(key, rv, on_disk)
        return rv

    # Make this a well-behaved decorator by preserving important function
    # attributes.
    try:
        wrapped_func.__dict__.update(func.__dict__)
    except AttributeError:
        pass

    # Return the funciton which wraps our function.
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
    global mem_cache
    mem_cache = {}
