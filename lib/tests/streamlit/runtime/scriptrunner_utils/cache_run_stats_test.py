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

import pytest

from streamlit.runtime.scriptrunner_utils.cache_run_stats import (
    CacheTotals,
    RunCacheStats,
    ThreadCacheStats,
)


def test_each_thread_gets_its_own_stats() -> None:
    """Threads never share totals, and each is listed once."""
    run_stats = RunCacheStats()
    main_stats = run_stats.current_thread_stats()
    assert run_stats.current_thread_stats() is main_stats

    worker_stats: list[ThreadCacheStats] = []
    thread = threading.Thread(
        target=lambda: worker_stats.append(run_stats.current_thread_stats())
    )
    thread.start()
    thread.join()

    assert worker_stats[0] is not main_stats
    assert run_stats._threads == [main_stats, worker_stats[0]]


def test_totals_combine_threads() -> None:
    """``totals()`` adds every thread's counts and times per cache type."""
    run_stats = RunCacheStats()
    main_stats = run_stats.current_thread_stats()
    main_stats.open_call(0.0)
    main_stats.cache_data.calls = 2
    main_stats.cache_data.compute_time = 1.0
    main_stats.close_call(3.0)

    def worker() -> None:
        stats = run_stats.current_thread_stats()
        stats.open_call(0.0)
        stats.cache_data.calls = 1
        stats.cache_resource.calls = 1
        stats.cache_resource.overhead_time = 0.5
        stats.close_call(3.0)

    thread = threading.Thread(target=worker)
    thread.start()
    thread.join()

    cache_data, cache_resource = run_stats.totals(3.0)
    assert (cache_data.calls, cache_data.compute_time) == (3, 1.0)
    assert (cache_resource.calls, cache_resource.overhead_time) == (1, 0.5)


def test_tracked_command_time_counts_only_inside_calls() -> None:
    """Command time is recorded only while a cached call runs on the thread."""
    run_stats = RunCacheStats()
    # Before the thread has any stats.
    run_stats.record_tracked_command_time(1.0)
    stats = run_stats.current_thread_stats()
    # Outside a call.
    run_stats.record_tracked_command_time(1.0)
    assert stats.tracked_command_time == 0

    stats.open_call(0.0)
    run_stats.record_tracked_command_time(0.25)
    stats.close_call(1.0)

    assert stats.tracked_command_time == 0.25


@pytest.mark.parametrize(
    ("recorded", "expected_scale"),
    [
        # The calls span 2s, 0.5s of which is commands. Times up to 1.5s are
        # kept as recorded.
        (1.5, 1.0),
        (1.0, 1.0),
        # Overlapping calls recorded 3s in a 1.5s span: halve them.
        (3.0, 0.5),
    ],
)
def test_time_scale_fits_times_into_the_call_span(
    recorded: float, expected_scale: float
) -> None:
    """Times from overlapping calls are scaled to the span they ran in."""
    stats = ThreadCacheStats()
    stats.open_call(10.0)
    stats.open_call(10.5)
    stats.tracked_command_time += 0.5
    stats.close_call(11.0)
    stats.close_call(12.0)
    stats.cache_data.compute_time = recorded

    assert stats.time_scale(12.0) == pytest.approx(expected_scale)


def test_time_scale_counts_a_call_still_running() -> None:
    """A call still open when the totals are read counts up to ``now``."""
    stats = ThreadCacheStats()
    stats.open_call(0.0)
    stats.cache_data.overhead_time = 2.0

    assert stats.time_scale(1.0) == pytest.approx(0.5)
    assert stats.time_scale(4.0) == 1.0


def test_cache_totals_add_scales_only_times() -> None:
    """``add()`` scales the times by ``time_scale`` but never the counts."""
    totals = CacheTotals()
    totals.add(
        CacheTotals(
            calls=4,
            hits=3,
            misses=1,
            stale_hits=1,
            compute_time=2.0,
            wait_time=1.0,
            overhead_time=0.5,
        ),
        time_scale=0.5,
    )

    assert totals == CacheTotals(
        calls=4,
        hits=3,
        misses=1,
        stale_hits=1,
        compute_time=1.0,
        wait_time=0.5,
        overhead_time=0.25,
    )
    assert totals.total_time == pytest.approx(1.75)
