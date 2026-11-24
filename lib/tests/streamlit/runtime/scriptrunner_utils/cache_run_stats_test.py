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

import pytest

from streamlit.runtime.scriptrunner_utils.cache_run_stats import (
    CacheTotals,
    RunCacheTotals,
    ThreadCacheStats,
)


def _record_call(
    stats: ThreadCacheStats, now: float, *, compute_time: float = 0.0
) -> None:
    """Add a finished cache_data call's compute time and close it, as
    ``CacheCallTimer.finish`` does.
    """
    stats.cache_data.calls += 1
    stats.cache_data.compute_time += compute_time
    stats.close_call(now, compute_time)


def test_combine_adds_every_threads_totals() -> None:
    """``combine()`` adds every thread's counts, times and overlap per cache
    type.
    """
    first = ThreadCacheStats()
    first.open_call(0.0)
    first.cache_data.waits = 1
    _record_call(first, 3.0, compute_time=1.0)
    first.async_overlap_time = 0.25

    second = ThreadCacheStats()
    second.open_call(0.0)
    second.cache_data.waits = 1
    second.cache_resource.calls = 1
    second.cache_resource.overhead_time = 0.5
    _record_call(second, 3.0)

    totals = RunCacheTotals.combine((first, second), 3.0)
    cache_data, cache_resource = totals.cache_data, totals.cache_resource
    assert (cache_data.calls, cache_data.waits, cache_data.compute_time) == (2, 2, 1.0)
    assert (cache_resource.calls, cache_resource.overhead_time) == (1, 0.5)
    assert totals.async_overlap_time == 0.25


def test_tracked_command_time_counts_only_inside_calls() -> None:
    """Command time is recorded only while a cached call is open on the thread."""
    stats = ThreadCacheStats()
    stats.record_tracked_command_time(1.0)
    assert stats.tracked_command_time == 0

    stats.open_call(0.0)
    stats.record_tracked_command_time(0.25)
    stats.close_call(1.0, 0.0)
    stats.record_tracked_command_time(1.0)

    assert stats.tracked_command_time == 0.25


@pytest.mark.parametrize(
    ("recorded", "expected_overlap"),
    [
        # The calls span 2s, 0.5s of which is commands, so up to 1.5s of cache
        # time fits without overlap.
        (1.5, 0.0),
        (1.0, 0.0),
        # Overlapping calls recorded 3s in a 1.5s span.
        (3.0, 1.5),
    ],
)
def test_overlap_is_the_time_beyond_the_groups_span(
    recorded: float, expected_overlap: float
) -> None:
    """Overlapping calls keep their times, and the time they exceed their span
    by is reported as overlap.
    """
    stats = ThreadCacheStats()
    stats.open_call(10.0)
    stats.open_call(10.5)
    stats.tracked_command_time += 0.5
    _record_call(stats, 11.0, compute_time=recorded)
    _record_call(stats, 12.0)

    totals = RunCacheTotals.combine((stats,), 12.0)
    assert totals.cache_data.compute_time == pytest.approx(recorded)
    assert totals.async_overlap_time == pytest.approx(expected_overlap)


def test_calls_that_dont_overlap_add_no_overlap() -> None:
    """A call after an overlapping group adds nothing to the overlap."""
    stats = ThreadCacheStats()
    # Two overlapping calls record 2s in 1s.
    stats.open_call(0.0)
    stats.open_call(0.0)
    _record_call(stats, 1.0, compute_time=1.0)
    _record_call(stats, 1.0, compute_time=1.0)
    # Then one call records 2s in 2s.
    stats.open_call(1.0)
    _record_call(stats, 3.0, compute_time=2.0)

    totals = RunCacheTotals.combine((stats,), 3.0)
    assert totals.cache_data.compute_time == pytest.approx(4.0)
    assert totals.async_overlap_time == pytest.approx(1.0)


def test_overlap_adds_up_across_cache_types() -> None:
    """A group compares the calls' times of both cache types with its span."""
    stats = ThreadCacheStats()
    stats.open_call(0.0)
    stats.open_call(0.0)
    _record_call(stats, 1.0, compute_time=1.0)
    stats.cache_resource.calls += 1
    stats.cache_resource.wait_time += 1.0
    stats.close_call(1.0, 1.0)

    assert stats.async_overlap_time == pytest.approx(1.0)


def test_open_overlapping_group_counts_up_to_now() -> None:
    """A group that is still open counts the overlap its finished calls have
    had so far.
    """
    stats = ThreadCacheStats()
    for _ in range(3):
        stats.open_call(0.0)
    # Two calls record 4s in 2s while the third is still open.
    _record_call(stats, 2.0, compute_time=2.0)
    _record_call(stats, 2.0, compute_time=2.0)

    assert stats.async_overlap_time == 0
    assert RunCacheTotals.combine((stats,), 2.0).async_overlap_time == pytest.approx(
        2.0
    )
    assert RunCacheTotals.combine((stats,), 3.0).async_overlap_time == pytest.approx(
        1.0
    )


def test_closed_group_keeps_its_own_span() -> None:
    """A page profile that read a group before it closed measures it to that
    group's span, even if the thread has started another call since.
    """
    stats = ThreadCacheStats()
    stats.open_call(0.0)
    stats.open_call(0.0)
    group = stats._overlap
    assert group is not None
    _record_call(stats, 1.0, compute_time=1.5)
    _record_call(stats, 1.0, compute_time=1.5)
    # The next call starts later and runs a tracked command.
    stats.open_call(5.0)
    stats.tracked_command_time += 0.5

    assert group.overlap_time(
        now=6.0, command_time=stats.tracked_command_time
    ) == pytest.approx(2.0)
    assert stats.async_overlap_time == pytest.approx(2.0)


def test_group_whose_commands_fill_its_span_counts_all_its_time_as_overlap() -> None:
    """When listed commands fill a group's span, all of its calls' time counts
    as overlap.
    """
    stats = ThreadCacheStats()
    stats.open_call(0.0)
    stats.open_call(0.0)
    stats.tracked_command_time += 2.0
    _record_call(stats, 1.0, compute_time=0.25)
    _record_call(stats, 1.0)

    assert stats.async_overlap_time == pytest.approx(0.25)


def test_is_in_cache_code_is_false_while_waiting_or_computing() -> None:
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
    stats.close_call(1.0, 0.0)
    assert not stats.is_in_cache_code


def test_totals_add_every_count_and_time() -> None:
    """Adding run totals sums every count and time, and the overlap."""
    totals = RunCacheTotals()
    other = RunCacheTotals(
        cache_data=CacheTotals(calls=4, hits=3, misses=1, stale_hits=1, waits=2),
        cache_resource=CacheTotals(
            calls=1, compute_time=2.0, wait_time=1.0, overhead_time=0.5
        ),
        async_overlap_time=0.25,
    )

    totals.add(other)
    totals.add(other)

    assert totals.cache_data == CacheTotals(
        calls=8, hits=6, misses=2, stale_hits=2, waits=4
    )
    assert totals.cache_resource == CacheTotals(
        calls=2, compute_time=4.0, wait_time=2.0, overhead_time=1.0
    )
    assert totals.async_overlap_time == 0.5
