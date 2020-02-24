"""New caching experiments"""

import functools
import hashlib
import pickle
from pickle import PicklingError

from streamlit import config
from streamlit.caching import CacheError
from streamlit.caching import CacheKeyNotFoundError
from streamlit.hashing import CodeHasher
from streamlit.logger import get_logger

LOGGER = get_logger(__name__)

mem_cache = {}


def _write_to_cache(key, value):
    try:
        pickled = pickle.dumps(value)
    except PicklingError as e:
        raise CacheError(e)
    mem_cache[key] = pickled


def _read_from_cache(key):
    try:
        pickled = mem_cache[key]
    except KeyError:
        raise CacheKeyNotFoundError("Key not found in mem cache")

    try:
        return pickle.loads(pickled)
    except PicklingError as e:
        raise CacheError(e)


def new_cache(
    func=None, persist=False, show_spinner=True, hash_funcs=None,
):
    # Support passing the params via function decorator, e.g.
    # @st.cache(persist=True, allow_output_mutation=True)
    if func is None:
        return lambda f: new_cache(
            func=f, persist=persist, show_spinner=show_spinner, hash_funcs=hash_funcs,
        )

    @functools.wraps(func)
    def wrapped_func(*args, **kwargs):
        if not config.get_option("client.caching"):
            LOGGER.debug("Purposefully skipping cache")
            return func(*args, **kwargs)

        name = func.__name__

        hasher = hashlib.new("md5")

        args_hasher = CodeHasher("md5", hasher, hash_funcs)
        args_hasher.update([args, kwargs])
        LOGGER.debug("Hashing arguments to %s of %i bytes.", name, args_hasher.size)

        code_hasher = CodeHasher("md5", hasher, hash_funcs)
        code_hasher.update(func)
        LOGGER.debug("Hashing function %s in %i bytes.", name, code_hasher.size)

        key = hasher.hexdigest()
        LOGGER.debug("Cache key: %s", key)

        try:
            return_value = _read_from_cache(key)
            LOGGER.debug("Cache hit: %s", func)
        except CacheKeyNotFoundError:
            LOGGER.debug("Cache miss: %s", func)

            return_value = func(*args, **kwargs)
            _write_to_cache(key, return_value)

        return return_value

    # Make this a well-behaved decorator by preserving important function
    # attributes.
    try:
        wrapped_func.__dict__.update(func.__dict__)
    except AttributeError:
        pass

    return wrapped_func
