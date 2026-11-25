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
from unittest.mock import MagicMock, patch

import pytest

from streamlit.runtime.scriptrunner_utils import run_stats as run_stats_module
from streamlit.runtime.scriptrunner_utils.run_stats import (
    RunStats,
    ThreadRunStats,
    read_thread_cpu_time,
)


def test_each_thread_gets_its_own_stats() -> None:
    """Threads never share stats, and each is listed once."""
    run_stats = RunStats()
    main_stats = run_stats.current_thread_stats()
    assert run_stats.current_thread_stats() is main_stats

    worker_stats: list[ThreadRunStats] = []
    thread = threading.Thread(
        target=lambda: worker_stats.append(run_stats.current_thread_stats())
    )
    thread.start()
    thread.join()

    assert worker_stats[0] is not main_stats
    assert run_stats.all_thread_stats() == (main_stats, worker_stats[0])


def test_recording_into_swaps_the_threads_stats_and_lists_them() -> None:
    """Inside the block the thread records into the given stats, which are
    listed for the totals, and afterwards it goes back to its own.
    """
    run_stats = RunStats()
    own = run_stats.current_thread_stats()
    swapped = ThreadRunStats()

    with run_stats.recording_into(swapped):
        assert run_stats.current_thread_stats() is swapped

    assert run_stats.current_thread_stats() is own
    assert run_stats.all_thread_stats() == (own, swapped)


def test_recording_into_restores_the_stats_when_the_block_raises() -> None:
    """The thread's own stats come back even when the block raises."""
    run_stats = RunStats()
    own = run_stats.current_thread_stats()

    with pytest.raises(RuntimeError), run_stats.recording_into(ThreadRunStats()):
        raise RuntimeError

    assert run_stats.current_thread_stats() is own


def test_recording_into_affects_only_the_calling_thread() -> None:
    """Other threads keep their own stats while one thread records into a
    swapped record.
    """
    run_stats = RunStats()
    swapped = ThreadRunStats()
    other: list[ThreadRunStats] = []

    with run_stats.recording_into(swapped):
        thread = threading.Thread(
            target=lambda: other.append(run_stats.current_thread_stats())
        )
        thread.start()
        thread.join()

    assert other[0] is not swapped


def test_new_thread_stats_dont_count_cpu() -> None:
    """A thread's stats count toward CPU time only once marked, as the script
    thread's and fragment runs' are.
    """
    stats = ThreadRunStats()

    assert not stats.counts_cpu
    assert stats.command_cpu_time == 0.0


@pytest.mark.parametrize(
    "time_module",
    [
        pytest.param(MagicMock(spec=[]), id="missing"),
        pytest.param(
            MagicMock(thread_time=MagicMock(side_effect=OSError)), id="failing"
        ),
    ],
)
def test_resolve_thread_cpu_clock_handles_unsupported_platforms(
    time_module: MagicMock,
) -> None:
    """A missing or failing ``time.thread_time`` disables CPU times."""
    with patch.object(run_stats_module, "time", time_module):
        assert run_stats_module._resolve_thread_cpu_clock() is None


@pytest.mark.parametrize(
    "clock",
    [
        pytest.param(None, id="no clock"),
        pytest.param(MagicMock(side_effect=RuntimeError("clock")), id="failing"),
    ],
)
def test_read_thread_cpu_time_gives_none_without_a_working_clock(
    clock: MagicMock | None,
) -> None:
    """A missing clock or a failed read gives None instead of raising."""
    with patch.object(run_stats_module, "_thread_cpu_clock", clock):
        assert read_thread_cpu_time() is None


def test_read_thread_cpu_time_reads_the_clock() -> None:
    with patch.object(
        run_stats_module, "_thread_cpu_clock", MagicMock(return_value=1.5)
    ):
        assert read_thread_cpu_time() == 1.5
