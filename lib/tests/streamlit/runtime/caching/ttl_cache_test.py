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

from __future__ import annotations

import math

import pytest

from streamlit.runtime.caching.ttl_cache import TTLCache


class _Clock:
    """A controllable timer for deterministic TTL tests."""

    def __init__(self, now: float = 1000.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now


def test_basic_set_get_len_contains():
    """Basic mapping behavior: set, get, len, and membership."""
    cache = TTLCache(maxsize=10, ttl=100, timer=_Clock())
    cache["a"] = 1
    cache["b"] = 2

    assert cache["a"] == 1
    assert len(cache) == 2
    assert "a" in cache
    assert "missing" not in cache


def test_lru_eviction_respects_reads():
    """Reads mark an entry most-recently-used, so eviction skips read entries."""
    cache = TTLCache(maxsize=3, ttl=100, timer=_Clock())
    cache["a"] = 1
    cache["b"] = 2
    cache["c"] = 3

    # Read "a" to bump its recency; LRU order becomes b, c, a.
    assert cache["a"] == 1

    # Inserting a 4th entry evicts the least-recently-used, which is now "b".
    cache["d"] = 4

    assert "b" not in cache
    assert set(cache) == {"a", "c", "d"}


def test_setitem_existing_key_does_not_evict():
    """Updating an existing key must not trigger maxsize eviction."""
    cache = TTLCache(maxsize=2, ttl=100, timer=_Clock())
    cache["a"] = 1
    cache["b"] = 2

    cache["a"] = 11

    assert cache.currsize == 2
    assert cache["a"] == 11
    assert cache["b"] == 2


def test_unbounded_maxsize_never_evicts():
    """An infinite maxsize should never evict entries."""
    cache = TTLCache(maxsize=math.inf, ttl=math.inf, timer=_Clock())
    for i in range(100):
        cache[i] = i
    assert cache.currsize == 100


def test_expired_entries_are_absent_but_not_removed_on_read():
    """Expired entries read as absent, yet are only reaped by expire()."""
    clock = _Clock(1000.0)
    cache = TTLCache(maxsize=10, ttl=10, timer=clock)
    cache["a"] = 1
    cache["b"] = 2

    clock.now = 1011.0  # past the expiry time (1010)

    assert "a" not in cache
    with pytest.raises(KeyError):
        _ = cache["a"]

    # Reads did not remove the entries: expire() still returns them.
    assert sorted(cache.expire()) == [("a", 1), ("b", 2)]
    assert len(cache) == 0


def test_expire_only_removes_expired_and_preserves_order():
    """expire() removes just the expired entries, oldest first."""
    clock = _Clock(1000.0)
    cache = TTLCache(maxsize=10, ttl=10, timer=clock)
    cache["a"] = 1
    clock.now = 1005.0
    cache["b"] = 2  # "a" expires at 1010, "b" at 1015

    clock.now = 1012.0  # "a" expired, "b" still valid

    assert cache.expire() == [("a", 1)]
    assert "b" in cache
    assert list(cache) == ["b"]


def test_write_expires_stale_entries_first():
    """A write drops already-expired entries before inserting the new one."""
    clock = _Clock(1000.0)
    cache = TTLCache(maxsize=10, ttl=10, timer=clock)
    cache["a"] = 1

    clock.now = 1011.0
    cache["b"] = 2

    assert "a" not in cache
    assert list(cache) == ["b"]


def test_iter_yields_only_non_expired_keys():
    """Iteration skips expired keys."""
    clock = _Clock(1000.0)
    cache = TTLCache(maxsize=10, ttl=10, timer=clock)
    cache["a"] = 1
    clock.now = 1005.0
    cache["b"] = 2

    clock.now = 1011.0  # "a" expired, "b" valid
    assert list(cache) == ["b"]


def test_values_iteration_is_safe():
    """values() works even though reading each value reorders the LRU map."""
    cache = TTLCache(maxsize=10, ttl=100, timer=_Clock())
    for i in range(5):
        cache[i] = i * 10
    assert sorted(cache.values()) == [0, 10, 20, 30, 40]


def test_popitem_returns_lru_and_raises_when_empty():
    """popitem() removes the least-recently-used entry, then raises when empty."""
    cache = TTLCache(maxsize=10, ttl=100, timer=_Clock())
    cache["a"] = 1
    cache["b"] = 2
    assert cache["a"] == 1  # bump "a"; "b" is now least-recently-used

    assert cache.popitem() == ("b", 2)
    assert cache.popitem() == ("a", 1)
    with pytest.raises(KeyError):
        cache.popitem()


def test_delitem_of_expired_removes_but_raises():
    """Deleting an expired entry removes it but signals absence via KeyError."""
    clock = _Clock(1000.0)
    cache = TTLCache(maxsize=10, ttl=10, timer=clock)
    cache["a"] = 1

    clock.now = 1011.0
    with pytest.raises(KeyError):
        del cache["a"]

    # It was still removed, so there is nothing left to expire.
    assert cache.expire() == []


def test_delitem_missing_raises():
    """Deleting a key that was never present raises KeyError."""
    cache = TTLCache(maxsize=10, ttl=10, timer=_Clock())
    with pytest.raises(KeyError):
        del cache["missing"]


def test_maxsize_below_one_rejects_writes():
    """A maxsize below one cannot hold any entry, so writes raise ValueError."""
    cache = TTLCache(maxsize=0, ttl=10, timer=_Clock())
    with pytest.raises(ValueError, match="value too large"):
        cache["a"] = 1


def test_get_and_pop_defaults():
    """get()/pop() honor defaults for missing keys and remove on pop."""
    cache = TTLCache(maxsize=10, ttl=100, timer=_Clock())
    cache["a"] = 1

    assert cache.get("a") == 1
    assert cache.get("missing") is None
    assert cache.pop("a") == 1
    assert "a" not in cache
    assert cache.pop("missing", "default") == "default"


def test_clear_empties_cache():
    """clear() removes all entries."""
    cache = TTLCache(maxsize=10, ttl=100, timer=_Clock())
    cache["a"] = 1
    cache["b"] = 2

    cache.clear()

    assert len(cache) == 0
    assert "a" not in cache


def test_config_properties():
    """maxsize/ttl/currsize expose the cache configuration and size."""
    cache = TTLCache(maxsize=5, ttl=30, timer=_Clock())
    cache["a"] = 1
    cache["b"] = 2

    assert cache.maxsize == 5
    assert cache.ttl == 30
    assert cache.currsize == 2
