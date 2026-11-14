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


def _read_totals(stats: ThreadCacheStats, now: float) -> tuple[CacheTotals, ...]:
    cache_data, cache_resource = CacheTotals(), CacheTotals()
    stats.add_to(cache_data, cache_resource, now)
    return cache_data, cache_resource


@pytest.mark.parametrize(
    ("recorded", "expected"),
    [
        # The calls span 2s, 0.5s of which is commands. Times up to 1.5s are
        # kept as recorded.
        (1.5, 1.5),
        (1.0, 1.0),
        # Overlapping calls recorded 3s in a 1.5s span: halve them.
        (3.0, 1.5),
    ],
)
def test_overlapping_calls_are_scaled_to_their_span(
    recorded: float, expected: float
) -> None:
    """Times from overlapping calls are scaled to the span they ran in."""
    stats = ThreadCacheStats()
    stats.open_call(10.0)
    stats.open_call(10.5)
    stats.tracked_command_time += 0.5
    stats.totals_for_finished_call(stats.cache_data).compute_time += recorded
    stats.close_call(11.0)
    stats.close_call(12.0)

    cache_data, _ = _read_totals(stats, 12.0)
    assert cache_data.compute_time == pytest.approx(expected)


def test_calls_that_dont_overlap_are_not_scaled() -> None:
    """A call after an overlapping group keeps its time, even if the group was
    scaled down.
    """
    stats = ThreadCacheStats()
    # Two overlapping cache_data calls record 2s in 1s.
    stats.open_call(0.0)
    stats.open_call(0.0)
    stats.totals_for_finished_call(stats.cache_data).compute_time += 1.0
    stats.close_call(1.0)
    stats.totals_for_finished_call(stats.cache_data).compute_time += 1.0
    stats.close_call(1.0)
    # Then one cache_resource call records 2s in 2s.
    stats.open_call(1.0)
    stats.totals_for_finished_call(stats.cache_resource).compute_time += 2.0
    stats.close_call(3.0)

    cache_data, cache_resource = _read_totals(stats, 3.0)
    assert cache_data.compute_time == pytest.approx(1.0)
    assert cache_resource.compute_time == pytest.approx(2.0)


def test_open_overlapping_group_counts_up_to_now() -> None:
    """Finished calls of a group that is still open are scaled to the time the
    group has run so far.
    """
    stats = ThreadCacheStats()
    stats.open_call(0.0)
    stats.open_call(0.0)
    stats.totals_for_finished_call(stats.cache_data).overhead_time += 2.0
    stats.close_call(2.0)

    assert _read_totals(stats, 1.0)[0].overhead_time == pytest.approx(1.0)
    assert _read_totals(stats, 4.0)[0].overhead_time == pytest.approx(2.0)


def test_closed_group_keeps_its_own_span() -> None:
    """A page profile that read a group before it closed scales it to that
    group's span, even if the thread has started another call since.
    """
    stats = ThreadCacheStats()
    stats.open_call(0.0)
    stats.open_call(0.0)
    group = stats._overlap
    assert group is not None
    stats.totals_for_finished_call(stats.cache_data).compute_time += 1.0
    stats.close_call(1.0)
    stats.totals_for_finished_call(stats.cache_data).compute_time += 1.0
    stats.close_call(1.0)
    # The next call starts later and runs a tracked command.
    stats.open_call(5.0)
    stats.tracked_command_time += 0.5

    cache_data, cache_resource = CacheTotals(), CacheTotals()
    group.add_scaled_to(
        cache_data, cache_resource, now=6.0, command_time=stats.tracked_command_time
    )
    assert cache_data.compute_time == pytest.approx(1.0)


def test_group_with_no_recorded_time_is_not_scaled() -> None:
    """A group whose commands took longer than its span doesn't divide by zero."""
    stats = ThreadCacheStats()
    stats.open_call(0.0)
    stats.open_call(0.0)
    stats.tracked_command_time += 2.0
    stats.totals_for_finished_call(stats.cache_data).calls += 1
    stats.close_call(1.0)
    stats.close_call(1.0)

    cache_data, _ = _read_totals(stats, 1.0)
    assert (cache_data.calls, cache_data.total_time) == (1, 0)


def test_cache_code_excludes_waiting_and_computing() -> None:
    """``is_in_cache_code`` is True only while an open call isn't waiting or
    computing.
    """
    stats = ThreadCacheStats()
    assert not stats.is_in_cache_code
    stats.open_call(0.0)
    assert stats.is_in_cache_code
    stats.leave_cache_code()
    assert not stats.is_in_cache_code
    stats.enter_cache_code()
    assert stats.is_in_cache_code
    stats.close_call(1.0)
    assert not stats.is_in_cache_code


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
