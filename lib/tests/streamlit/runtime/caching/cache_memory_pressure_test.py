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

import threading
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import Mock

import pytest

from streamlit.runtime.caching import cache_memory_pressure
from streamlit.runtime.caching.cache_data_api import DataCache
from streamlit.runtime.caching.storage import CacheStorageContext
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)
from streamlit.runtime.stats import CacheStat


@pytest.fixture(autouse=True)
def reset_diagnostic_state() -> None:
    cache_memory_pressure._reset_state_for_testing()


def _summary() -> cache_memory_pressure.CacheUsageSummary:
    return cache_memory_pressure.CacheUsageSummary(
        total_bytes=300,
        entry_count=3,
        contributors=(
            cache_memory_pressure.CacheContributor("largest", 200, 2),
            cache_memory_pressure.CacheContributor("smaller", 100, 1),
        ),
    )


def _install_files(monkeypatch: pytest.MonkeyPatch, files: dict[str, str]) -> None:
    monkeypatch.setattr(cache_memory_pressure.platform, "system", lambda: "Linux")
    monkeypatch.setattr(
        cache_memory_pressure,
        "_read_text",
        lambda path: files.get(str(path)),
    )


def test_reads_cgroup_v2_memory(monkeypatch: pytest.MonkeyPatch) -> None:
    _install_files(
        monkeypatch,
        {
            "/proc/self/cgroup": "0::/app.slice\n",
            "/sys/fs/cgroup/memory.current": "800\n",
            "/sys/fs/cgroup/memory.max": "1000\n",
        },
    )

    assert cache_memory_pressure._read_memory_sample() == (
        cache_memory_pressure.MemorySample(800, 1000, "cgroup v2 memory")
    )


def test_uses_most_constrained_cgroup_ancestor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_files(
        monkeypatch,
        {
            "/proc/self/cgroup": "0::/parent/app\n",
            "/sys/fs/cgroup/memory.current": "100\n",
            "/sys/fs/cgroup/memory.max": "max\n",
            "/sys/fs/cgroup/parent/app/memory.current": "800\n",
            "/sys/fs/cgroup/parent/app/memory.max": "1000\n",
            "/sys/fs/cgroup/parent/memory.current": "700\n",
            "/sys/fs/cgroup/parent/memory.max": "900\n",
        },
    )

    assert cache_memory_pressure._read_memory_sample() == (
        cache_memory_pressure.MemorySample(700, 900, "cgroup v2 memory")
    )


def test_reads_nested_cgroup_v1_memory(monkeypatch: pytest.MonkeyPatch) -> None:
    _install_files(
        monkeypatch,
        {
            "/proc/self/cgroup": "8:cpu:/app\n7:memory:/container/app\n",
            ("/sys/fs/cgroup/memory/container/app/memory.usage_in_bytes"): "750",
            ("/sys/fs/cgroup/memory/container/app/memory.limit_in_bytes"): "1000",
        },
    )

    assert cache_memory_pressure._read_memory_sample() == (
        cache_memory_pressure.MemorySample(750, 1000, "cgroup v1 memory")
    )


@pytest.mark.parametrize("limit", ["max", "9223372036854771712", "bad"])
def test_unlimited_or_malformed_cgroup_limit(
    monkeypatch: pytest.MonkeyPatch, limit: str
) -> None:
    _install_files(
        monkeypatch,
        {
            "/proc/self/cgroup": "0::/\n",
            "/sys/fs/cgroup/memory.current": "123",
            "/sys/fs/cgroup/memory.max": limit,
        },
    )

    sample = cache_memory_pressure._read_memory_sample()

    assert sample == cache_memory_pressure.MemorySample(123, None, "cgroup v2 memory")


def test_missing_cgroup_data_falls_back_to_process_rss(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_files(
        monkeypatch,
        {
            "/proc/self/cgroup": "",
            "/proc/self/statm": "100 7 0 0 0 0 0",
        },
    )
    monkeypatch.setattr(cache_memory_pressure.os, "sysconf", lambda _name: 4096)

    assert cache_memory_pressure._read_memory_sample() == (
        cache_memory_pressure.MemorySample(7 * 4096, None, "process RSS")
    )


def test_pending_entry_crosses_pressure_threshold(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    logger = Mock()
    monkeypatch.setattr(cache_memory_pressure, "_LOGGER", logger)
    monkeypatch.setattr(
        cache_memory_pressure,
        "_read_memory_sample",
        lambda: cache_memory_pressure.MemorySample(70, 100, "test memory"),
    )

    cache_memory_pressure.maybe_log_cache_memory_pressure(
        current_function="current_function",
        pending_entry_bytes=15,
        get_cache_summary=_summary,
    )

    message = logger.warning.call_args.args[1]
    assert "70.0 B of 100.0 B (70.0%)" in message
    assert "85.0 B (85.0%)" in message
    assert "current_function" in message
    assert "pending serialized entry 15.0 B" in message


def test_probe_is_rate_limited(monkeypatch: pytest.MonkeyPatch) -> None:
    probe = Mock(return_value=cache_memory_pressure.MemorySample(1, 100, "test memory"))
    monkeypatch.setattr(cache_memory_pressure, "_read_memory_sample", probe)
    monkeypatch.setattr(
        cache_memory_pressure.time,
        "monotonic",
        Mock(side_effect=[0, 1, 5]),
    )

    for _ in range(3):
        reservation = cache_memory_pressure.maybe_log_cache_memory_pressure(
            current_function="function",
            pending_entry_bytes=0,
            get_cache_summary=_summary,
        )
        cache_memory_pressure.record_cache_write_result(reservation, succeeded=True)

    assert probe.call_count == 2


def test_cumulative_writes_force_probe_before_interval_expires(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    logger = Mock()
    probe = Mock(
        side_effect=[
            cache_memory_pressure.MemorySample(40, 100, "test memory"),
            cache_memory_pressure.MemorySample(76, 100, "test memory"),
        ]
    )
    monkeypatch.setattr(cache_memory_pressure, "_LOGGER", logger)
    monkeypatch.setattr(cache_memory_pressure, "_read_memory_sample", probe)
    monkeypatch.setattr(
        cache_memory_pressure.time,
        "monotonic",
        Mock(side_effect=[0, 1, 2, 3]),
    )

    for _ in range(4):
        reservation = cache_memory_pressure.maybe_log_cache_memory_pressure(
            current_function="function",
            pending_entry_bytes=15,
            get_cache_summary=_summary,
        )
        cache_memory_pressure.record_cache_write_result(reservation, succeeded=True)

    assert probe.call_count == 2
    logger.warning.assert_called_once()
    assert "76.0 B of 100.0 B" in logger.warning.call_args.args[1]
    assert "91.0 B (91.0%)" in logger.warning.call_args.args[1]


def test_write_growth_is_counted_once_and_failed_write_is_removed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        cache_memory_pressure,
        "_read_memory_sample",
        lambda: cache_memory_pressure.MemorySample(20, 100, "test memory"),
    )
    monkeypatch.setattr(
        cache_memory_pressure.time,
        "monotonic",
        Mock(side_effect=[0, 1, 2]),
    )

    sampled_reservation = cache_memory_pressure.maybe_log_cache_memory_pressure(
        current_function="function",
        pending_entry_bytes=10,
        get_cache_summary=_summary,
    )
    cache_memory_pressure.record_cache_write_result(sampled_reservation, succeeded=True)
    counted_reservation = cache_memory_pressure.maybe_log_cache_memory_pressure(
        current_function="function",
        pending_entry_bytes=10,
        get_cache_summary=_summary,
    )
    cache_memory_pressure.record_cache_write_result(counted_reservation, succeeded=True)

    assert cache_memory_pressure._state.unobserved_growth_bytes == 10

    failed_reservation = cache_memory_pressure.maybe_log_cache_memory_pressure(
        current_function="function",
        pending_entry_bytes=15,
        get_cache_summary=_summary,
    )
    assert cache_memory_pressure._state.unobserved_growth_bytes == 25

    cache_memory_pressure.record_cache_write_result(failed_reservation, succeeded=False)

    assert cache_memory_pressure._state.unobserved_growth_bytes == 10


def test_warning_uses_hysteresis(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    logger = Mock()
    monkeypatch.setattr(cache_memory_pressure, "_LOGGER", logger)
    samples = iter(
        [
            cache_memory_pressure.MemorySample(85, 100, "test memory"),
            cache_memory_pressure.MemorySample(82, 100, "test memory"),
            cache_memory_pressure.MemorySample(65, 100, "test memory"),
            cache_memory_pressure.MemorySample(85, 100, "test memory"),
        ]
    )
    monkeypatch.setattr(cache_memory_pressure, "_PROBE_INTERVAL_SECONDS", 0)
    monkeypatch.setattr(
        cache_memory_pressure, "_read_memory_sample", lambda: next(samples)
    )
    monkeypatch.setattr(
        cache_memory_pressure.time,
        "monotonic",
        Mock(side_effect=[0, 1, 2, 3]),
    )

    for _ in range(4):
        cache_memory_pressure.maybe_log_cache_memory_pressure(
            current_function="function",
            pending_entry_bytes=0,
            get_cache_summary=_summary,
        )

    assert logger.warning.call_count == 2


def test_large_entry_fallback_is_rate_limited(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    logger = Mock()
    monkeypatch.setattr(cache_memory_pressure, "_LOGGER", logger)
    monkeypatch.setattr(cache_memory_pressure, "_read_memory_sample", lambda: None)
    monkeypatch.setattr(cache_memory_pressure, "_PROBE_INTERVAL_SECONDS", 0)
    monkeypatch.setattr(
        cache_memory_pressure.time,
        "monotonic",
        Mock(side_effect=[0, 1, 3601]),
    )

    for _ in range(3):
        cache_memory_pressure.maybe_log_cache_memory_pressure(
            current_function="function",
            pending_entry_bytes=cache_memory_pressure._LARGE_ENTRY_BYTES,
            get_cache_summary=_summary,
        )

    assert logger.warning.call_count == 2
    assert (
        "No finite cgroup memory limit was detected"
        in (logger.warning.call_args.args[1])
    )


def test_contributors_are_ordered_and_limited() -> None:
    summary = cache_memory_pressure.summarize_cache_stats(
        [
            CacheStat("st_cache_data", "second", 100),
            CacheStat("st_cache_data", "first", 150),
            CacheStat("st_cache_data", "second", 100),
            CacheStat("st_cache_data", "fourth", 10),
            CacheStat("st_cache_data", "third", 50),
            CacheStat("st_cache_resource", "ignored", 1000),
        ]
    )

    assert summary.total_bytes == 410
    assert summary.entry_count == 5
    assert summary.contributors == (
        cache_memory_pressure.CacheContributor("second", 200, 2),
        cache_memory_pressure.CacheContributor("first", 150, 1),
        cache_memory_pressure.CacheContributor("third", 50, 1),
    )


def test_concurrent_writes_emit_one_warning(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    logger = Mock()
    monkeypatch.setattr(cache_memory_pressure, "_LOGGER", logger)
    monkeypatch.setattr(
        cache_memory_pressure,
        "_read_memory_sample",
        lambda: cache_memory_pressure.MemorySample(90, 100, "test memory"),
    )
    barrier = threading.Barrier(8)

    def warn() -> None:
        barrier.wait()
        cache_memory_pressure.maybe_log_cache_memory_pressure(
            current_function="function",
            pending_entry_bytes=0,
            get_cache_summary=_summary,
        )

    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(lambda _index: warn(), range(8)))

    logger.warning.assert_called_once()


def test_concurrent_cumulative_writes_force_one_probe_and_warning(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    logger = Mock()
    probe = Mock(
        side_effect=[
            cache_memory_pressure.MemorySample(10, 100, "test memory"),
            cache_memory_pressure.MemorySample(75, 100, "test memory"),
        ]
    )
    monkeypatch.setattr(cache_memory_pressure, "_LOGGER", logger)
    monkeypatch.setattr(cache_memory_pressure, "_read_memory_sample", probe)
    monkeypatch.setattr(cache_memory_pressure.time, "monotonic", lambda: 1)

    initial_reservation = cache_memory_pressure.maybe_log_cache_memory_pressure(
        current_function="function",
        pending_entry_bytes=0,
        get_cache_summary=_summary,
    )
    cache_memory_pressure.record_cache_write_result(initial_reservation, succeeded=True)

    start_barrier = threading.Barrier(8)
    reserved_barrier = threading.Barrier(8)

    def reserve_write() -> None:
        start_barrier.wait()
        reservation = cache_memory_pressure.maybe_log_cache_memory_pressure(
            current_function="function",
            pending_entry_bytes=10,
            get_cache_summary=_summary,
        )
        reserved_barrier.wait()
        cache_memory_pressure.record_cache_write_result(reservation, succeeded=True)

    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(lambda _index: reserve_write(), range(8)))

    assert probe.call_count == 2
    logger.warning.assert_called_once()


def test_warning_is_private_and_cache_write_is_unchanged(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    logger = Mock()
    monkeypatch.setattr(cache_memory_pressure, "_LOGGER", logger)
    monkeypatch.setattr(
        cache_memory_pressure,
        "_read_memory_sample",
        lambda: cache_memory_pressure.MemorySample(90, 100, "test memory"),
    )
    context = CacheStorageContext(
        function_key="function-hash",
        function_display_name="safe_function",
    )
    cache = DataCache(
        key="function-hash",
        storage=MemoryCacheStorageManager().create(context),
        persist=None,
        max_entries=None,
        ttl_seconds=None,
        display_name="safe_function",
    )

    cache.write_result(
        "secret-cache-key",
        {"password": "secret-value", "argument": "secret-argument"},
        [],
    )

    message = logger.warning.call_args.args[1]
    assert cache.read_result("secret-cache-key").value["password"] == "secret-value"
    assert "safe_function" in message
    assert "secret-cache-key" not in message
    assert "secret-value" not in message
    assert "secret-argument" not in message


def test_diagnostic_failure_never_breaks_cache_write(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        cache_memory_pressure,
        "_read_memory_sample",
        Mock(side_effect=OSError("unavailable")),
    )
    context = CacheStorageContext(
        function_key="function-hash",
        function_display_name="function",
    )
    cache = DataCache(
        key="function-hash",
        storage=MemoryCacheStorageManager().create(context),
        persist=None,
        max_entries=None,
        ttl_seconds=None,
        display_name="function",
    )

    cache.write_result("key", 42, [])

    assert cache.read_result("key").value == 42
