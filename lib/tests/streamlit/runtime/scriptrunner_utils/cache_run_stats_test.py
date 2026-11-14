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

from streamlit.runtime.scriptrunner_utils.cache_run_stats import (
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
    main_stats.open_call()
    main_stats.cache_data.calls = 2
    main_stats.cache_data.compute_time = 1.0
    main_stats.close_call()

    def worker() -> None:
        stats = run_stats.current_thread_stats()
        stats.open_call()
        stats.cache_data.calls = 1
        stats.cache_resource.calls = 1
        stats.cache_resource.overhead_time = 0.5
        stats.close_call()

    thread = threading.Thread(target=worker)
    thread.start()
    thread.join()

    cache_data, cache_resource = run_stats.totals()
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

    stats.open_call()
    run_stats.record_tracked_command_time(0.25)
    stats.close_call()

    assert stats.tracked_command_time == 0.25
