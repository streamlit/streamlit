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

from streamlit.runtime.scriptrunner_utils.parallel_fragment_stats import (
    ParallelFragmentUsageStats,
)
from streamlit.runtime.scriptrunner_utils.run_stats import RunStats, ThreadRunStats


def test_recording_run_records_its_span_and_stats() -> None:
    """What the worker records goes to the run's own stats, which still count
    toward the run's totals.
    """
    run_stats = RunStats()
    stats = ParallelFragmentUsageStats(run_stats)

    with stats.recording_run() as run:
        assert run.end is None
        thread_stats = run_stats.current_thread_stats()
        thread_stats.command_time = 0.5
        thread_stats.cache.cache_data.calls = 1

    assert thread_stats is run.stats
    assert run.end is not None
    assert run.end >= run.start
    assert stats.runs == (run,)
    assert run_stats.all_thread_stats() == (run.stats,)


def test_recording_run_ends_the_run_when_the_fragment_raises() -> None:
    """A fragment run records its end time even when its body raises."""
    stats = ParallelFragmentUsageStats(RunStats())

    with pytest.raises(RuntimeError), stats.recording_run():
        raise RuntimeError

    (run,) = stats.runs
    assert run.end is not None


def test_runs_on_one_worker_thread_keep_their_stats_apart() -> None:
    """A worker thread that runs one fragment after another gives each its own
    stats, and goes back to the thread's own stats afterwards.
    """
    run_stats = RunStats()
    stats = ParallelFragmentUsageStats(run_stats)
    worker_stats = run_stats.current_thread_stats()

    with stats.recording_run() as first:
        run_stats.current_thread_stats().command_time = 1.0
    with stats.recording_run() as second:
        run_stats.current_thread_stats().command_time = 2.0

    assert (first.stats.command_time, second.stats.command_time) == (1.0, 2.0)
    assert stats.runs == (first, second)
    assert run_stats.current_thread_stats() is worker_stats
    assert run_stats.all_thread_stats() == (worker_stats, first.stats, second.stats)


def test_threads_the_fragment_attaches_record_into_their_own_stats() -> None:
    """Only the worker thread counts toward the run; other threads count toward
    the main script.
    """
    run_stats = RunStats()
    stats = ParallelFragmentUsageStats(run_stats)
    attached_stats: list[ThreadRunStats] = []

    with stats.recording_run() as run:
        attached = threading.Thread(
            target=lambda: attached_stats.append(run_stats.current_thread_stats())
        )
        attached.start()
        attached.join()

    assert attached_stats[0] is not run.stats
    assert attached_stats[0] in run_stats.all_thread_stats()


def test_wait_time_accumulates_across_waits() -> None:
    """Join and drain wait times add up within one run."""
    stats = ParallelFragmentUsageStats(RunStats())
    stats.add_wait_time(0.25)
    stats.add_wait_time(0.5)

    assert stats.wait_time == 0.75
