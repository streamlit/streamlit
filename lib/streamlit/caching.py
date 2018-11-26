# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

"""A library of useful utilities."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import hashlib
import inspect
import os
import pickle
import re
import shutil

from functools import wraps

import streamlit as st
from streamlit import config
from streamlit import util
from streamlit.logger import get_logger

LOGGER = get_logger(__name__)

def cache(func):
    """Function decorator to memoize input function, saving to disk.

    Parameters
    ----------
    func : callable
        The function that cache.

    """
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
            message = f'Running {func.__name__}().'
        else:
            message = f'Running {func.__name__}(...).'
        with st.spinner(message):
            # Calculate the filename hash.
            hasher = hashlib.new('md5')
            LOGGER.debug('Created the hasher. (%s)' % func.__name__)
            arg_string = pickle.dumps([argc, argv], pickle.HIGHEST_PROTOCOL)
            LOGGER.debug('Hashing %i bytes. (%s)' % (len(arg_string), func.__name__))
            hasher.update(arg_string)
            hasher.update(inspect.getsource(func).encode('utf-8'))
            path = f'cache/f{hasher.hexdigest()}.pickle'
            LOGGER.debug('Cache filename: ' + path)

            # Load the file (hit) or compute the function (miss).
            try:
                with util.streamlit_read(path, binary=True) as input:
                    rv = pickle.load(input)
                    LOGGER.debug('Cache HIT: ' + str(type(rv)))
            except FileNotFoundError:
                rv = func(*argc, **argv)
                with util.streamlit_write(path, binary=True) as output:
                    pickle.dump(rv, output, pickle.HIGHEST_PROTOCOL)
                LOGGER.debug('Cache MISS: ' + str(type(rv)))
        return rv

    # Make this a well-behaved decorator by preserving important function
    # attributes.
    try:
        wrapped_func.__dict__.update(func.__dict__)
    except AttributeError:
        pass

    # Return the funciton which wraps our function.
    return wrapped_func


def clear_cache(verbose=False):
    """Clear the memoization cache."""
    cache_path = os.path.join(util.STREAMLIT_ROOT_DIRECTORY, 'cache')
    if os.path.isdir(cache_path):
        shutil.rmtree(cache_path)
        if verbose:
            print(f'Cleared {cache_path} directory.')
    elif verbose:
        print(f'No such directory {cache_path} so nothing to clear. :)')
