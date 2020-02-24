from collections import namedtuple
from threading import RLock
from typing import Any
from typing import Dict
from typing import Union

SENTINEL = object()  # unique object used to signal cache misses


CacheInfo = namedtuple("CacheInfo", ["hits", "misses", "maxsize", "currsize"])


class _Link(object):
    """Element in our doubly-linked list."""
    def __init__(self):
        self.prev = self  # type: _Link
        self.next = self  # type: _Link
        self.key = None  # type: Any
        self.result = None  # type: Any

    def set(self, prev, next, key, result):
        """Set the Link's values.

        Parameters
        ----------
        prev : _Link
        next : _Link
        key : Any
        result : Any

        """
        self.prev = prev
        self.next = next
        self.key = key
        self.result = result


class LRUCache(object):
    def __init__(self, maxsize):
        """
        Parameters
        ----------
        maxsize : int or None
            Maximum number of entries in the cache, or None for an unbounded
            cache.
        """
        self._maxsize = maxsize
        self._cache = {}  # type: Dict[Any, Union[_Link, Any]]
        self._lock = RLock()
        self._root = _Link()
        self._hits = self._misses = 0
        self._full = False

    def get(self, key, f, *args, **kwargs):
        """Return the value for the given key, computing it if necessary.

        Parameters
        ----------
        key : Any
        f : callable
            Function to compute the value if it's not already cached.
            *args and **kwargs will be passed to the function.

        Returns
        -------
        Any
            The value for the given key.

        """
        if self._maxsize == 0:
            # No caching -- just a statistics update
            self._misses += 1
            return f(*args, **kwargs)

        elif self._maxsize is None:
            # Simple caching without ordering or size limit
            result = self._cache.get(key, SENTINEL)
            if result is not SENTINEL:
                self._hits += 1
                return result

            self._misses += 1
            result = f(*args, **kwargs)
            self._cache[key] = result
            return result

        # LRU cache
        with self._lock:
            link = self._cache.get(key)
            if link is not None:
                # Move the link to the front of the circular queue
                link_prev, link_next, _key, result = link
                link_prev.next = link_next
                link_next.prev = link_prev
                last = self._root.prev
                last.next = self._root.prev = link
                link.prev = last
                link.next = self._root
                self._hits += 1
                return result

            self._misses += 1
            result = f(*args, **kwargs)
            with self._lock:
                if key in self._cache:
                    # Getting here means that this same key was added to the
                    # cache while the lock was released.  Since the link
                    # update is already done, we need only return the
                    # computed result and update the count of misses.
                    pass
                elif self._full:
                    # Use the old root to store the new key and result.
                    oldroot = self._root
                    oldroot.key = key
                    oldroot.result = result
                    # Empty the oldest link and make it the new root.
                    # Keep a reference to the old key and old result to
                    # prevent their ref counts from going to zero during the
                    # update. That will prevent potentially arbitrary object
                    # clean-up code (i.e. __del__) from running while we're
                    # still adjusting the links.
                    root = oldroot.next
                    oldkey = root.key
                    oldresult = root.result
                    root.key = root.result = None
                    # Now update the cache dictionary.
                    del self._cache[oldkey]
                    # Save the potentially reentrant cache[key] assignment
                    # for last, after the root and links have been put in
                    # a consistent state.
                    self._cache[key] = oldroot
                else:
                    # Put result in a new link at the front of the queue.
                    last = self._root.prev
                    link.set(prev=last, next=self._root, key=key, result=result)
                    last.next = self._root.prev = self._cache[key] = link
                    self._full = len(self._cache) >= self._maxsize

            return result

    def cache_info(self):
        """Report cache statistics.

        Returns
        -------
        CacheInfo
        """
        with self._lock:
            return CacheInfo(self._hits, self._misses, self._maxsize, len(self._cache))

    def cache_clear(self):
        """Clear the cache and cache statistics."""
        with self._lock:
            self._cache.clear()
            self._root = _Link()
            self._hits = self._misses = 0
            self._full = False
