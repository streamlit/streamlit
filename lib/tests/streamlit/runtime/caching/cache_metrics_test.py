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

"""Tests for per-function cache lookup, compute-duration, and eviction metrics."""

from __future__ import annotations

import asyncio
import math
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, patch

import pytest

import streamlit as st
from streamlit.runtime import Runtime
from streamlit.runtime.caching import cache_metrics
from streamlit.runtime.caching.cache_metrics import (
    CACHE_COMPUTE_DURATION_FAMILY,
    CACHE_EVICTIONS_FAMILY,
    CACHE_LOOKUPS_FAMILY,
    COMPUTE_DURATION_BUCKETS,
    CacheMetrics,
    FunctionCacheMetrics,
)
from streamlit.runtime.caching.cache_type import CacheType
from streamlit.runtime.caching.global_cache_budget import GlobalCacheBudget
from streamlit.runtime.caching.storage.cache_storage_protocol import (
    CacheStorageContext,
)
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    DummyCacheStorage,
    MemoryCacheStorageManager,
)
from streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper import (
    InMemoryCacheStorageWrapper,
)
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.stats import CounterStat, HistogramStat
from tests.testutil import create_mock_script_run_ctx

if TYPE_CHECKING:
    from collections.abc import Callable, Iterator

CACHE_DECORATORS: list[tuple[str, Any]] = [
    ("cache_data", st.cache_data),
    ("cache_resource", st.cache_resource),
]


@pytest.fixture
def registry(monkeypatch: pytest.MonkeyPatch) -> Iterator[CacheMetrics]:
    """Install a fresh metrics registry and a mock runtime for each test."""
    fresh_registry = CacheMetrics()
    monkeypatch.setattr(cache_metrics, "_cache_metrics", fresh_registry)
    add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())
    mock_runtime = MagicMock(spec=Runtime)
    mock_runtime.cache_storage_manager = MemoryCacheStorageManager()
    monkeypatch.setattr(Runtime, "_instance", mock_runtime)
    st.cache_data.clear()
    st.cache_resource.clear()
    yield fresh_registry
    st.cache_data.clear()
    st.cache_resource.clear()


def _cache_label(func: Any) -> str:
    return func._metrics.labels["cache"]


def _lookups(registry: CacheMetrics, func: Any) -> dict[str, int]:
    """Return ``{"hit": n, "miss": m}`` for a cached function from the registry."""
    stats = registry.get_stats([CACHE_LOOKUPS_FAMILY])[CACHE_LOOKUPS_FAMILY]
    result: dict[str, int] = {}
    for stat in stats:
        assert isinstance(stat, CounterStat)
        assert stat.labels is not None
        if stat.labels["cache"] == _cache_label(func):
            result[stat.labels["result"]] = stat.value
    return result


def _evictions(registry: CacheMetrics, display_name: str) -> dict[str, int]:
    stats = registry.get_stats([CACHE_EVICTIONS_FAMILY])[CACHE_EVICTIONS_FAMILY]
    result: dict[str, int] = {}
    for stat in stats:
        assert isinstance(stat, CounterStat)
        assert stat.labels is not None
        if stat.labels["cache"] == display_name:
            result[stat.labels["reason"]] = stat.value
    return result


def _histogram(registry: CacheMetrics, func: Any) -> HistogramStat:
    stats = registry.get_stats([CACHE_COMPUTE_DURATION_FAMILY])[
        CACHE_COMPUTE_DURATION_FAMILY
    ]
    for stat in stats:
        assert isinstance(stat, HistogramStat)
        assert stat.labels is not None
        if stat.labels["cache"] == _cache_label(func):
            return stat
    raise AssertionError(f"No histogram for {_cache_label(func)}")


def _wait_for(condition: Callable[[], bool], timeout: float = 5.0) -> None:
    deadline = time.monotonic() + timeout
    while not condition():
        if time.monotonic() > deadline:
            raise AssertionError("Timed out waiting for condition")
        time.sleep(0.01)


@pytest.mark.usefixtures("registry")
@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_labels_match_cache_memory_bytes(name: str, decorator: Callable) -> None:
    """The ``cache_type`` and ``cache`` labels join with ``cache_memory_bytes``."""

    @decorator
    def load() -> int:
        return 1

    assert load._metrics.labels == {
        "cache_type": f"st_{name}",
        "cache": load._info.display_name,
    }


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_sync_hit_and_miss_counted_once_per_call(
    registry: CacheMetrics, name: str, decorator: Callable
) -> None:
    """The first call is a miss; repeat calls with the same arguments are hits."""

    @decorator
    def load(x: int) -> int:
        return x

    load(1)
    load(1)
    load(1)
    load(2)

    assert _lookups(registry, load) == {"hit": 2, "miss": 2}


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_async_hit_and_miss_counted_once_per_call(
    registry: CacheMetrics, name: str, decorator: Callable
) -> None:
    """Coroutine functions count one lookup per awaited call."""

    @decorator
    async def load(x: int) -> int:
        await asyncio.sleep(0)
        return x

    async def run() -> None:
        await load(1)
        await load(1)
        await load(2)

    asyncio.run(run())

    assert _lookups(registry, load) == {"hit": 1, "miss": 2}
    assert _histogram(registry, load).observation_count == 2


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_concurrent_sync_misses_count_one_miss_per_caller(
    registry: CacheMetrics, name: str, decorator: Callable
) -> None:
    """Callers that wait on another caller's computation count as misses only."""
    callers = 4

    @decorator(show_spinner=False)
    def load(x: int) -> int:
        # Hold the computation until every caller has made its first lookup, so
        # the others are waiting on the compute lock and re-read under it.
        _wait_for(lambda: _lookups(registry, load)["miss"] == callers)
        return x

    with ThreadPoolExecutor(max_workers=callers) as executor:
        results = list(executor.map(lambda _: load(1), range(callers)))

    assert results == [1] * callers
    assert _lookups(registry, load) == {"hit": 0, "miss": callers}
    assert _histogram(registry, load).observation_count == 1


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_concurrent_async_misses_count_one_miss_per_caller(
    registry: CacheMetrics, name: str, decorator: Callable
) -> None:
    """Async callers that await another caller's computation count as misses only."""
    callers = 4

    @decorator(show_spinner=False)
    async def load(x: int) -> int:
        deadline = time.monotonic() + 5
        while _lookups(registry, load)["miss"] < callers:
            assert time.monotonic() < deadline
            await asyncio.sleep(0.01)
        return x

    async def run() -> list[int]:
        return list(await asyncio.gather(*(load(1) for _ in range(callers))))

    assert asyncio.run(run()) == [1] * callers
    assert _lookups(registry, load) == {"hit": 0, "miss": callers}
    assert _histogram(registry, load).observation_count == 1


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_concurrent_hits_are_all_counted(
    registry: CacheMetrics, name: str, decorator: Callable
) -> None:
    """Increments from many threads are not lost."""

    @decorator(show_spinner=False)
    def load() -> int:
        return 1

    load()
    threads = 8
    calls_per_thread = 500

    def call_many() -> None:
        for _ in range(calls_per_thread):
            load()

    with ThreadPoolExecutor(max_workers=threads) as executor:
        for future in [executor.submit(call_many) for _ in range(threads)]:
            future.result()

    assert _lookups(registry, load) == {
        "hit": threads * calls_per_thread,
        "miss": 1,
    }


@patch(
    "streamlit.runtime.caching.cache_background_refresh.get_background_refresh_manager"
)
@patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_stale_value_served_in_background_mode_is_a_hit(
    timer_patch: MagicMock,
    refresh_manager_patch: MagicMock,
    registry: CacheMetrics,
    name: str,
    decorator: Callable,
) -> None:
    """A stale value returned while a background refresh is pending is a hit."""
    refresh_manager_patch.return_value.submit.return_value = False
    timer_patch.return_value = 0

    @decorator(ttl=10, refresh_mode="background")
    def load() -> int:
        return 1

    load()
    # Past the freshness TTL but within the hard-expiration TTL.
    timer_patch.return_value = 15
    load()

    refresh_manager_patch.return_value.submit.assert_called_once()
    assert _lookups(registry, load) == {"hit": 1, "miss": 1}
    assert _histogram(registry, load).observation_count == 1


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_compute_duration_recorded_on_miss_only(
    registry: CacheMetrics, name: str, decorator: Callable
) -> None:
    """A miss records how long the function ran; a hit records nothing."""
    sleep_seconds = 0.03

    @decorator
    def load() -> int:
        time.sleep(sleep_seconds)
        return 1

    load()
    load()

    histogram = _histogram(registry, load)
    assert histogram.observation_count == 1
    assert histogram.observation_sum >= sleep_seconds
    buckets = dict(histogram.buckets)
    # time.sleep never returns early, so the observation is above 25 ms.
    assert buckets[0.025] == 0
    assert buckets[math.inf] == 1


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_compute_duration_recorded_when_function_raises(
    registry: CacheMetrics, name: str, decorator: Callable
) -> None:
    """Time spent in a failing computation still counts toward compute time."""

    @decorator
    def load() -> int:
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError, match="boom"):
        load()

    assert _lookups(registry, load) == {"hit": 0, "miss": 1}
    assert _histogram(registry, load).observation_count == 1


@pytest.mark.parametrize(
    ("seconds", "first_bucket"),
    [
        pytest.param(0.0, 0.005, id="zero"),
        pytest.param(0.3, 0.5, id="between_bounds"),
        pytest.param(1.0, 1.0, id="exactly_on_bound"),
        pytest.param(45.0, 60.0, id="slow"),
        pytest.param(1000.0, math.inf, id="above_last_bound"),
    ],
)
def test_compute_duration_lands_in_expected_bucket(
    seconds: float, first_bucket: float
) -> None:
    """Buckets are cumulative and inclusive of their upper bound."""
    metrics = FunctionCacheMetrics(CacheType.DATA, "module.load")
    metrics.record_compute_duration(seconds)

    stat = metrics.get_stats([CACHE_COMPUTE_DURATION_FAMILY])[
        CACHE_COMPUTE_DURATION_FAMILY
    ][0]
    assert isinstance(stat, HistogramStat)
    assert [bound for bound, _ in stat.buckets] == [
        *COMPUTE_DURATION_BUCKETS,
        math.inf,
    ]
    assert stat.buckets == tuple(
        (bound, 1 if bound >= first_bucket else 0) for bound, _ in stat.buckets
    )
    assert stat.observation_sum == seconds
    assert stat.observation_count == 1


def test_histogram_buckets_are_cumulative() -> None:
    """Each bucket counts every observation at or below its bound."""
    metrics = FunctionCacheMetrics(CacheType.RESOURCE, "module.load")
    for seconds in (0.001, 0.2, 0.2, 3.0, 400.0):
        metrics.record_compute_duration(seconds)

    stat = metrics.get_stats(None)[CACHE_COMPUTE_DURATION_FAMILY][0]
    assert isinstance(stat, HistogramStat)
    buckets = dict(stat.buckets)
    assert buckets[0.005] == 1
    assert buckets[0.25] == 3
    assert buckets[5.0] == 4
    assert buckets[300.0] == 4
    assert buckets[math.inf] == 5
    counts = [bucket_count for _, bucket_count in stat.buckets]
    assert counts == sorted(counts)
    assert stat.observation_count == 5
    assert stat.observation_sum == pytest.approx(403.401)


@patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_ttl_expiry_counts_as_ttl_eviction(
    timer_patch: MagicMock, registry: CacheMetrics, name: str, decorator: Callable
) -> None:
    """An entry that expires is counted when the cache reaps it."""
    timer_patch.return_value = 0

    @decorator(ttl=10)
    def load() -> int:
        return 1

    load()
    timer_patch.return_value = 11
    load()

    assert _lookups(registry, load) == {"hit": 0, "miss": 2}
    evictions = _evictions(registry, _cache_label(load))
    assert evictions["ttl"] == 1
    assert evictions["max_entries"] == 0


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_max_entries_counts_as_max_entries_eviction(
    registry: CacheMetrics, name: str, decorator: Callable
) -> None:
    """Writing past max_entries evicts the least-recently-used entry."""

    @decorator(max_entries=1)
    def load(x: int) -> int:
        return x

    load(1)
    load(2)
    load(1)

    assert _lookups(registry, load) == {"hit": 0, "miss": 3}
    evictions = _evictions(registry, _cache_label(load))
    assert evictions["max_entries"] == 2
    assert evictions["ttl"] == 0


def test_max_size_counts_as_max_size_eviction(registry: CacheMetrics) -> None:
    """Writing past a cache_data max_size evicts by size, not by entry count."""

    @st.cache_data(max_size=1)
    def load(x: int) -> int:
        return x

    load(1)
    load(2)

    evictions = _evictions(registry, _cache_label(load))
    assert evictions["max_size"] == 1
    assert evictions["max_entries"] == 0


def test_validate_failure_counts_as_validate_eviction(registry: CacheMetrics) -> None:
    """A cache_resource entry rejected by validate is evicted and recomputed."""

    @st.cache_resource(validate=lambda _: False)
    def load() -> int:
        return 1

    load()
    load()

    assert _lookups(registry, load) == {"hit": 0, "miss": 2}
    assert _evictions(registry, _cache_label(load))["validate"] == 1


def test_global_budget_eviction_is_attributed_to_function(
    registry: CacheMetrics,
) -> None:
    """Entries dropped by server.maxCacheDataSize count against their function."""
    budget = GlobalCacheBudget(max_bytes=6)
    with patch(
        "streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper."
        "get_global_cache_budget",
        return_value=budget,
    ):
        storage = InMemoryCacheStorageWrapper(
            DummyCacheStorage(),
            CacheStorageContext(
                function_key="key",
                function_display_name="module.load",
                ttl_seconds=None,
                max_entries=None,
            ),
        )

    storage.set("a", b"aaaa")
    storage.set("b", b"bbbb")

    assert _evictions(registry, "module.load")["global_budget"] == 1


def test_persisted_cache_evictions_are_not_counted(registry: CacheMetrics) -> None:
    """Dropping a disk-persisted entry from memory does not remove it from the cache."""
    storage = InMemoryCacheStorageWrapper(
        DummyCacheStorage(),
        CacheStorageContext(
            function_key="key",
            function_display_name="module.persisted",
            ttl_seconds=None,
            max_entries=1,
            persist="disk",
        ),
    )

    storage.set("a", b"a")
    storage.set("b", b"b")

    assert "module.persisted" not in {
        stat.labels["cache"]
        for stat in registry.get_stats().get(CACHE_EVICTIONS_FAMILY, [])
        if stat.labels is not None
    }


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_counts_survive_clears_and_clears_are_not_evictions(
    registry: CacheMetrics, name: str, decorator: Callable
) -> None:
    """Clearing caches never resets counters or counts as an eviction."""

    @decorator
    def load(x: int) -> int:
        return x

    load(1)
    load(1)
    load.clear(1)
    load(1)
    load.clear()
    load(1)
    st.cache_data.clear()
    st.cache_resource.clear()
    load(1)

    assert _lookups(registry, load) == {"hit": 1, "miss": 4}
    assert _histogram(registry, load).observation_count == 4
    assert set(_evictions(registry, _cache_label(load)).values()) == {0}


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_counts_survive_cache_replacement(
    registry: CacheMetrics, name: str, decorator: Callable
) -> None:
    """Replacing a function's cache by changing its parameters keeps its counts."""

    def make(ttl: int) -> Any:
        @decorator(ttl=ttl)
        def load() -> int:
            return 1

        return load

    first = make(ttl=10)
    first()
    first()
    second = make(ttl=20)
    second()

    assert _cache_label(first) == _cache_label(second)
    assert _lookups(registry, second) == {"hit": 1, "miss": 2}


@pytest.mark.parametrize(
    ("name", "decorator", "reasons"),
    [
        (
            "cache_data",
            st.cache_data,
            {"ttl", "max_entries", "max_size", "global_budget"},
        ),
        ("cache_resource", st.cache_resource, {"ttl", "max_entries", "validate"}),
    ],
)
def test_zero_valued_series_emitted_for_called_function(
    registry: CacheMetrics, name: str, decorator: Callable, reasons: set[str]
) -> None:
    """Every hit, miss, and eviction-reason series exists even at zero."""

    @decorator
    def load() -> int:
        return 1

    load()

    assert _lookups(registry, load) == {"hit": 0, "miss": 1}
    assert _evictions(registry, _cache_label(load)) == dict.fromkeys(reasons, 0)
    assert len(_histogram(registry, load).buckets) == len(COMPUTE_DURATION_BUCKETS) + 1


def test_get_stats_filters_families(registry: CacheMetrics) -> None:
    """Only the requested families are computed and returned."""

    @st.cache_data
    def load() -> int:
        return 1

    load()

    assert set(registry.get_stats()) == {
        CACHE_LOOKUPS_FAMILY,
        CACHE_COMPUTE_DURATION_FAMILY,
        CACHE_EVICTIONS_FAMILY,
    }
    for family in registry.stats_families:
        assert set(registry.get_stats([family])) == {family}


def test_empty_registry_returns_no_families() -> None:
    """With no cached functions, no families (and no empty headers) are emitted."""
    assert CacheMetrics().get_stats() == {}


def test_registry_returns_same_metrics_for_same_labels() -> None:
    """Every cache object for one function shares a single set of counters."""
    registry = CacheMetrics()
    data_metrics = registry.get_function_metrics(CacheType.DATA, "module.load")

    assert registry.get_function_metrics(CacheType.DATA, "module.load") is data_metrics
    assert (
        registry.get_function_metrics(CacheType.RESOURCE, "module.load")
        is not data_metrics
    )
