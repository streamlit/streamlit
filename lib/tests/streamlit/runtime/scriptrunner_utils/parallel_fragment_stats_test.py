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
from copy import deepcopy

import pytest

from streamlit.runtime.scriptrunner_utils.cache_run_stats import RunCacheStats
from streamlit.runtime.scriptrunner_utils.parallel_fragment_stats import (
    ParallelFragmentRun,
    RunParallelFragmentStats,
)


def test_recording_run_records_its_span_and_cached_calls() -> None:
    """A run's cached calls go to its own stats and still count toward the
    run's totals.
    """
    cache_stats = RunCacheStats()
    stats = RunParallelFragmentStats(cache_stats)

    with stats.recording_run() as run:
        assert run.end is None
        thread_stats = cache_stats.current_thread_stats()
        thread_stats.cache_data.calls = 1

    assert thread_stats is run.cache_stats
    assert run.end is not None
    assert run.end >= run.start
    assert stats.runs == (run,)
    assert cache_stats.totals(run.end).cache_data.calls == 1


def test_recording_run_ends_the_run_when_the_fragment_raises() -> None:
    stats = RunParallelFragmentStats(RunCacheStats())

    with pytest.raises(RuntimeError), stats.recording_run():
        raise RuntimeError

    (run,) = stats.runs
    assert run.end is not None


def test_runs_on_one_worker_thread_keep_their_calls_apart() -> None:
    """A worker thread that runs one fragment after another gives each its own
    cache stats, and goes back to the thread's own stats afterwards.
    """
    cache_stats = RunCacheStats()
    stats = RunParallelFragmentStats(cache_stats)
    worker_stats = cache_stats.current_thread_stats()

    with stats.recording_run() as first:
        cache_stats.current_thread_stats().cache_data.calls = 1
    with stats.recording_run() as second:
        cache_stats.current_thread_stats().cache_data.calls = 2

    assert (
        first.cache_stats.cache_data.calls,
        second.cache_stats.cache_data.calls,
    ) == (
        1,
        2,
    )
    assert stats.runs == (first, second)
    assert cache_stats.current_thread_stats() is worker_stats
    assert cache_stats.totals(0.0).cache_data.calls == 3


def test_command_time_counts_only_on_the_worker_thread() -> None:
    """Threads the fragment attaches count toward the main script."""
    run = ParallelFragmentRun(0.0)
    run.add_command_time(0.5)

    attached = threading.Thread(target=lambda: run.add_command_time(1.0))
    attached.start()
    attached.join()

    assert run.command_time == 0.5


def test_deepcopy_shares_the_run() -> None:
    """add_script_run_ctx deep-copies the thread state, which holds the run."""
    run = ParallelFragmentRun(0.0)

    assert deepcopy({"run": run})["run"] is run


def test_wait_time_adds_up() -> None:
    stats = RunParallelFragmentStats(RunCacheStats())
    stats.add_wait_time(0.25)
    stats.add_wait_time(0.5)

    assert stats.wait_time == 0.75
