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

import threading
from typing import Any, Dict

from streamlit.logger import get_logger

_LOGGER = get_logger(__name__)


class CacheError(Exception):
    pass


class CacheKeyNotFoundError(Exception):
    pass


class SingletonCache:
    """Manages cached values for a single st.memo-ized function."""

    _caches_lock = threading.Lock()
    _function_caches: Dict[str, "SingletonCache"] = {}

    @classmethod
    def get_cache(cls, key: str) -> "SingletonCache":
        """Return the mem cache for the given key.

        If it doesn't exist, create a new one with the given params.
        """

        # Get the existing cache, if it exists, and validate that its params
        # haven't changed.
        with cls._caches_lock:
            cache = cls._function_caches.get(key)
            if cache is not None:
                return cache

            # Create a new cache object and put it in our dict
            _LOGGER.debug("Creating new SingletonCache (key=%s)", key)
            cache = SingletonCache(key=key)
            cls._function_caches[key] = cache
            return cache

    @classmethod
    def clear_all(cls) -> None:
        """Clear all singleton caches."""
        with cls._caches_lock:
            cls._function_caches = {}

    def __init__(self, key: str):
        self.key = key
        self._mem_cache: Dict[str, Any] = {}
        self._mem_cache_lock = threading.Lock()

    def read_value(self, key: str) -> Any:
        """Read a value from the cache. Raise `CacheKeyNotFoundError` if the
        value doesn't exist.

        Parameters
        ----------
        key : value's unique key

        Returns
        -------
        The cached value.

        Raises
        ------
        CacheKeyNotFoundError
            Raised if the value doesn't exist in the cache.

        """
        with self._mem_cache_lock:
            if key in self._mem_cache:
                entry = self._mem_cache[key]
                _LOGGER.debug("Memory cache HIT: %s", key)
                return entry

            else:
                _LOGGER.debug("Memory cache MISS: %s", key)
                raise CacheKeyNotFoundError("Key not found in mem cache")

    def write_value(self, key: str, value: Any) -> None:
        """Write a value to the cache. Value must be pickleable.

        Parameters
        ----------
        key : value's unique key
        value : value to write
        """
        with self._mem_cache_lock:
            self._mem_cache[key] = value
