# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Unit tests for the internal ``TTLCache`` implementation."""

from __future__ import annotations

import math

import pytest

from streamlit.runtime.caching.ttl_cache import TTLCache


class _FakeClock:
    """A controllable timer that returns whatever time we set."""

    def __init__(self, start: float = 0.0) -> None:
        self.now = start

    def __call__(self) -> float:
        return self.now


def test_basic_mapping_operations() -> None:
    """The cache supports the core get/set/contains/delete/len operations."""
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=100, timer=_FakeClock())

    cache["a"] = 1
    cache["b"] = 2

    assert cache["a"] == 1
    assert "a" in cache
    assert "missing" not in cache
    assert len(cache) == 2

    del cache["a"]
    assert "a" not in cache
    assert len(cache) == 1


def test_getitem_missing_raises_key_error() -> None:
    """Reading an absent key raises ``KeyError``."""
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=100, timer=_FakeClock())

    with pytest.raises(KeyError):
        _ = cache["missing"]


def test_get_and_pop_defaults() -> None:
    """``get`` and ``pop`` return defaults for absent keys, and ``pop`` removes."""
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=100, timer=_FakeClock())
    cache["a"] = 1

    assert cache.get("a") == 1
    assert cache.get("missing") is None
    assert cache.get("missing", -1) == -1

    assert cache.pop("a") == 1
    assert "a" not in cache
    assert cache.pop("missing", -1) == -1
    with pytest.raises(KeyError):
        cache.pop("missing")


def test_lru_eviction_when_exceeding_maxsize() -> None:
    """Once ``maxsize`` is exceeded, the least-recently-used entry is evicted."""
    cache: TTLCache[str, int] = TTLCache(maxsize=3, ttl=100, timer=_FakeClock())

    cache["a"] = 1
    cache["b"] = 2
    cache["c"] = 3

    # A read refreshes recency, so "a" is no longer the least recently used.
    assert cache["a"] == 1

    # Adding a 4th entry evicts "b" (now the least recently used), not "a".
    cache["d"] = 4

    assert "b" not in cache
    assert set(cache) == {"a", "c", "d"}


def test_overwrite_existing_key_does_not_evict() -> None:
    """Overwriting an existing key updates the value and recency without eviction."""
    cache: TTLCache[str, int] = TTLCache(maxsize=2, ttl=100, timer=_FakeClock())

    cache["a"] = 1
    cache["b"] = 2

    # Overwriting "a" must not evict "b", and bumps "a" to most-recently-used.
    cache["a"] = 10
    assert cache["a"] == 10
    assert "b" in cache

    # Adding "c" now evicts "b" (the least recently used), keeping "a".
    cache["c"] = 3
    assert "b" not in cache
    assert cache["a"] == 10
    assert cache["c"] == 3


def test_unbounded_maxsize_never_evicts() -> None:
    """A cache with ``math.inf`` maxsize never evicts on size."""
    cache: TTLCache[int, int] = TTLCache(maxsize=math.inf, ttl=100, timer=_FakeClock())

    for i in range(1000):
        cache[i] = i

    assert len(cache) == 1000


def test_maxsize_below_one_raises_on_write() -> None:
    """Writing to a cache that cannot hold a single entry raises ``ValueError``."""
    cache: TTLCache[str, int] = TTLCache(maxsize=0, ttl=100, timer=_FakeClock())

    with pytest.raises(ValueError, match="value too large"):
        cache["a"] = 1


def test_expired_entries_are_absent_on_read_but_not_reaped() -> None:
    """Expired entries look absent on reads yet remain until reaped by a write/query."""
    clock = _FakeClock()
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=10, timer=clock)

    cache["a"] = 1  # expires at t=10

    clock.now = 5
    assert "a" in cache
    assert cache["a"] == 1

    # At the TTL boundary the entry is considered expired.
    clock.now = 10
    assert "a" not in cache
    with pytest.raises(KeyError):
        _ = cache["a"]

    # It is still physically present (not yet reaped) until a length/size query.
    assert "a" in cache._data
    assert len(cache) == 0
    assert "a" not in cache._data


def test_expire_reaps_in_write_order_and_returns_pairs() -> None:
    """``expire`` removes entries whose TTL has passed and returns the pairs."""
    clock = _FakeClock()
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=10, timer=clock)

    cache["a"] = 1  # expires at 10
    clock.now = 1
    cache["b"] = 2  # expires at 11
    clock.now = 2
    cache["c"] = 3  # expires at 12

    clock.now = 11
    removed = cache.expire()

    # "a" and "b" have expired; "c" is still valid.
    assert removed == [("a", 1), ("b", 2)]
    assert set(cache) == {"c"}


def test_expire_with_explicit_time() -> None:
    """``expire`` honors an explicitly passed time instead of the timer."""
    clock = _FakeClock()
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=10, timer=clock)
    cache["a"] = 1  # expires at 10

    # Timer still reads 0, but we force expiry using an explicit time.
    assert cache.expire(time=10) == [("a", 1)]
    assert len(cache) == 0


def test_iteration_uses_write_order_not_lru_order() -> None:
    """Iteration yields still-valid keys in write order, unaffected by reads."""
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=100, timer=_FakeClock())

    cache["a"] = 1
    cache["b"] = 2
    cache["c"] = 3

    # Reading "a" changes LRU order but must not change iteration (write) order.
    assert cache["a"] == 1

    assert list(cache) == ["a", "b", "c"]
    assert list(cache.keys()) == ["a", "b", "c"]
    assert list(cache.values()) == [1, 2, 3]


def test_iteration_skips_expired_entries() -> None:
    """Iteration skips entries whose TTL has passed without reaping them."""
    clock = _FakeClock()
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=10, timer=clock)

    cache["a"] = 1  # expires at 10
    clock.now = 5
    cache["b"] = 2  # expires at 15

    clock.now = 12
    # "a" is expired, "b" is not.
    assert list(cache) == ["b"]


def test_popitem_removes_least_recently_used() -> None:
    """``popitem`` removes the least-recently-used non-expired entry."""
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=100, timer=_FakeClock())

    cache["a"] = 1
    cache["b"] = 2
    cache["c"] = 3

    # Reading "a" makes "b" the least recently used.
    assert cache["a"] == 1

    assert cache.popitem() == ("b", 2)
    assert cache.popitem() == ("c", 3)
    assert cache.popitem() == ("a", 1)


def test_popitem_on_empty_cache_raises() -> None:
    """``popitem`` raises ``KeyError`` when there is nothing to remove."""
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=100, timer=_FakeClock())

    with pytest.raises(KeyError):
        cache.popitem()


def test_len_reaps_expired_entries() -> None:
    """Querying the length reaps expired entries first."""
    clock = _FakeClock()
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=10, timer=clock)

    cache["a"] = 1
    cache["b"] = 2
    assert len(cache) == 2

    clock.now = 10
    assert len(cache) == 0


def test_delete_expired_entry_removes_it_but_raises() -> None:
    """Deleting an already-expired entry removes it yet still signals a miss."""
    clock = _FakeClock()
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=10, timer=clock)
    cache["a"] = 1

    clock.now = 10
    with pytest.raises(KeyError):
        del cache["a"]

    # Even though it raised, the entry was physically removed.
    assert "a" not in cache._data


def test_delete_missing_key_raises() -> None:
    """Deleting an absent key raises ``KeyError``."""
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=100, timer=_FakeClock())

    with pytest.raises(KeyError):
        del cache["missing"]


def test_clear_empties_cache() -> None:
    """``clear`` removes all entries."""
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=100, timer=_FakeClock())
    cache["a"] = 1
    cache["b"] = 2

    cache.clear()

    assert len(cache) == 0
    assert list(cache) == []


def test_properties_expose_configuration() -> None:
    """The cache exposes its ``maxsize``, ``ttl`` and ``timer`` configuration."""
    clock = _FakeClock()
    cache: TTLCache[str, int] = TTLCache(maxsize=5, ttl=42, timer=clock)

    assert cache.maxsize == 5
    assert cache.ttl == 42
    assert cache.timer is clock


def test_currsize_reflects_non_expired_entries() -> None:
    """``currsize`` counts only entries that have not expired."""
    clock = _FakeClock()
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=10, timer=clock)

    cache["a"] = 1
    cache["b"] = 2
    assert cache.currsize == 2

    clock.now = 10
    assert cache.currsize == 0


def test_contains_does_not_affect_eviction_order() -> None:
    """A membership check must not refresh LRU recency (unlike a read)."""
    cache: TTLCache[str, int] = TTLCache(maxsize=3, ttl=100, timer=_FakeClock())

    cache["a"] = 1
    cache["b"] = 2
    cache["c"] = 3

    # Probing "a" with `in` must NOT bump its recency.
    assert "a" in cache

    # Since "a" was not refreshed, it remains the least recently used and is
    # evicted when "d" is added.
    cache["d"] = 4
    assert "a" not in cache
    assert set(cache) == {"b", "c", "d"}


def test_expired_entry_frees_capacity_before_evicting_valid_entry() -> None:
    """A write reaps expired entries first, so it won't evict a valid LRU entry."""
    clock = _FakeClock()
    cache: TTLCache[str, int] = TTLCache(maxsize=2, ttl=10, timer=clock)

    cache["a"] = 1  # expires at 10
    clock.now = 5
    cache["b"] = 2  # expires at 15 (cache now full)

    # "a" has expired; adding "c" should reap "a" rather than evict the still
    # valid, least-recently-used "b".
    clock.now = 11
    cache["c"] = 3

    assert set(cache) == {"b", "c"}


def test_popitem_reaps_expired_before_returning_lru() -> None:
    """``popitem`` first reaps expired entries, then returns the LRU survivor."""
    clock = _FakeClock()
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=10, timer=clock)

    cache["a"] = 1  # expires at 10
    clock.now = 1
    cache["b"] = 2  # expires at 11
    clock.now = 5
    cache["c"] = 3  # expires at 15

    clock.now = 11
    # "a" and "b" are expired and silently reaped; "c" is the only survivor.
    assert cache.popitem() == ("c", 3)
    assert len(cache) == 0


def test_get_and_pop_return_default_for_expired_keys() -> None:
    """Expired-but-unreaped entries behave like absent keys for ``get``/``pop``."""
    clock = _FakeClock()
    cache: TTLCache[str, int] = TTLCache(maxsize=10, ttl=10, timer=clock)
    cache["a"] = 1

    clock.now = 10
    assert cache.get("a") is None
    assert cache.get("a", -1) == -1
    # pop() with a default must not raise at the exact expiry boundary.
    assert cache.pop("a", -1) == -1
    # pop() without a default raises for an expired entry.
    with pytest.raises(KeyError):
        cache.pop("a")
