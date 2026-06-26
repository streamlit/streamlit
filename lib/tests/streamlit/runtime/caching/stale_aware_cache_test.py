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

"""Tests for StaleAwareCache."""

from __future__ import annotations

import math

import pytest

from streamlit.runtime.caching.stale_aware_cache import StaleAwareCache


class _FakeTimer:
    """A controllable monotonic timer for tests."""

    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_fresh_entry_not_stale() -> None:
    """A freshly written entry is reported as not stale and is retrievable."""
    timer = _FakeTimer()
    cache: StaleAwareCache[str, int] = StaleAwareCache(
        maxsize=math.inf, ttl=10, timer=timer
    )
    cache["a"] = 1

    value, is_stale = cache.get_with_status("a")
    assert value == 1
    assert is_stale is False


def test_entry_becomes_stale_but_is_retained() -> None:
    """After the ttl elapses, the entry is stale but still retrievable."""
    timer = _FakeTimer()
    cache: StaleAwareCache[str, int] = StaleAwareCache(
        maxsize=math.inf, ttl=10, timer=timer
    )
    cache["a"] = 1

    timer.now = 10
    value, is_stale = cache.get_with_status("a")
    assert value == 1
    assert is_stale is True
    # The stale entry must still be present (unlike TTLCache).
    assert "a" in cache


def test_get_with_status_missing_raises_key_error() -> None:
    """Reading a missing key raises KeyError."""
    cache: StaleAwareCache[str, int] = StaleAwareCache(
        maxsize=math.inf, ttl=10, timer=_FakeTimer()
    )
    with pytest.raises(KeyError):
        cache.get_with_status("missing")


def test_overwrite_resets_expiry() -> None:
    """Re-writing a key resets its expiry timestamp."""
    timer = _FakeTimer()
    cache: StaleAwareCache[str, int] = StaleAwareCache(
        maxsize=math.inf, ttl=10, timer=timer
    )
    cache["a"] = 1
    timer.now = 5
    cache["a"] = 2  # expires at 15 now

    timer.now = 12
    value, is_stale = cache.get_with_status("a")
    assert value == 2
    assert is_stale is False


def test_infinite_ttl_never_stale() -> None:
    """With an infinite ttl, entries never become stale."""
    timer = _FakeTimer()
    cache: StaleAwareCache[str, int] = StaleAwareCache(
        maxsize=math.inf, ttl=math.inf, timer=timer
    )
    cache["a"] = 1
    timer.now = 1e12
    _, is_stale = cache.get_with_status("a")
    assert is_stale is False


def test_lru_eviction_calls_on_release() -> None:
    """Exceeding maxsize evicts the least-recently-used entry and calls on_release."""
    released: list[int] = []
    cache: StaleAwareCache[str, int] = StaleAwareCache(
        maxsize=2, ttl=10, timer=_FakeTimer(), on_release=released.append
    )
    cache["a"] = 1
    cache["b"] = 2
    # Touch "a" so "b" is the least-recently-used entry.
    cache.get_with_status("a")
    cache["c"] = 3

    assert released == [2]
    assert "b" not in cache
    assert "a" in cache
    assert "c" in cache


def test_safe_del_calls_on_release() -> None:
    """safe_del removes the entry and calls on_release."""
    released: list[int] = []
    cache: StaleAwareCache[str, int] = StaleAwareCache(
        maxsize=math.inf, ttl=10, timer=_FakeTimer(), on_release=released.append
    )
    cache["a"] = 1
    cache.safe_del("a")
    assert released == [1]
    assert "a" not in cache


def test_safe_del_missing_is_noop() -> None:
    """safe_del on a missing key does not call on_release."""
    released: list[int] = []
    cache: StaleAwareCache[str, int] = StaleAwareCache(
        maxsize=math.inf, ttl=10, timer=_FakeTimer(), on_release=released.append
    )
    cache.safe_del("missing")
    assert released == []


def test_delitem_does_not_call_on_release() -> None:
    """Plain deletion does not call on_release (matching TTLCleanupCache)."""
    released: list[int] = []
    cache: StaleAwareCache[str, int] = StaleAwareCache(
        maxsize=math.inf, ttl=10, timer=_FakeTimer(), on_release=released.append
    )
    cache["a"] = 1
    del cache["a"]
    assert released == []
    assert "a" not in cache


def test_pop_returns_value_without_on_release() -> None:
    """pop returns the value (or default) and does not call on_release."""
    released: list[int] = []
    cache: StaleAwareCache[str, int] = StaleAwareCache(
        maxsize=math.inf, ttl=10, timer=_FakeTimer(), on_release=released.append
    )
    cache["a"] = 1
    assert cache.pop("a") == 1
    assert cache.pop("missing", -1) == -1
    assert released == []


def test_clear_calls_on_release_for_each_entry() -> None:
    """clear empties the cache and calls on_release for every entry."""
    released: list[int] = []
    cache: StaleAwareCache[str, int] = StaleAwareCache(
        maxsize=math.inf, ttl=10, timer=_FakeTimer(), on_release=released.append
    )
    cache["a"] = 1
    cache["b"] = 2
    cache.clear()
    assert sorted(released) == [1, 2]
    assert len(cache) == 0


def test_values_returns_unwrapped_values() -> None:
    """values() returns the stored values, not the internal entry wrappers."""
    cache: StaleAwareCache[str, int] = StaleAwareCache(
        maxsize=math.inf, ttl=10, timer=_FakeTimer()
    )
    cache["a"] = 1
    cache["b"] = 2
    assert sorted(cache.values()) == [1, 2]


def test_len_and_contains() -> None:
    """__len__ and __contains__ reflect the current entries."""
    cache: StaleAwareCache[str, int] = StaleAwareCache(
        maxsize=math.inf, ttl=10, timer=_FakeTimer()
    )
    assert len(cache) == 0
    assert "a" not in cache
    cache["a"] = 1
    assert len(cache) == 1
    assert "a" in cache


def test_maxsize_and_ttl_properties() -> None:
    """maxsize and ttl properties expose the configured values."""
    cache: StaleAwareCache[str, int] = StaleAwareCache(
        maxsize=5, ttl=10, timer=_FakeTimer()
    )
    assert cache.maxsize == 5
    assert cache.ttl == 10
