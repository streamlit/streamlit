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

"""Per-run times of parallel fragments, reported in the page profile.

Fragments with ``parallel=True`` run on worker threads alongside the main
script, so their times would overlap the main script's if they were added to
the run totals alone. Each fragment run records its own wall time, listed
command time and cached calls instead, so the page profile can report them
apart from the main script's.
"""

from __future__ import annotations

import contextlib
import threading
import time
from typing import TYPE_CHECKING

from streamlit.runtime.scriptrunner_utils.cache_run_stats import ThreadCacheStats

if TYPE_CHECKING:
    from collections.abc import Generator

    from streamlit.runtime.scriptrunner_utils.cache_run_stats import RunCacheStats


class ParallelFragmentRun:
    """One parallel fragment's run, recorded on its worker thread.

    Only the worker thread counts toward the run. Threads the fragment attaches
    with ``add_script_run_ctx`` count toward the main script, like other
    threads a user starts.
    """

    __slots__ = ("_worker_id", "cache_stats", "command_time", "end", "start")

    def __init__(self, start: float) -> None:
        # perf_counter times; end is None until the fragment finishes.
        self.start = start
        self.end: float | None = None
        # Time of listed commands that ran on the worker thread.
        self.command_time = 0.0
        self.cache_stats = ThreadCacheStats()
        self._worker_id = threading.get_ident()

    def add_command_time(self, seconds: float) -> None:
        """Add a listed command's time, if it ran on the worker thread."""
        if threading.get_ident() == self._worker_id:
            self.command_time += seconds

    def __deepcopy__(self, memo: dict[int, object]) -> ParallelFragmentRun:
        # add_script_run_ctx deep-copies the worker's FragmentThreadState for
        # threads it attaches. Returning the same run avoids copying its cache
        # stats, and add_command_time's worker-thread check then ignores those
        # threads.
        return self


class RunParallelFragmentStats:
    """The parallel fragment runs of one script run."""

    def __init__(self, cache_stats: RunCacheStats) -> None:
        self._cache_stats = cache_stats
        # Guards the list of runs, which workers append to as they start.
        self._lock = threading.Lock()
        self._runs: list[ParallelFragmentRun] = []
        # Time the script thread waited for the workers, written only by the
        # script thread.
        self.wait_time = 0.0

    @contextlib.contextmanager
    def recording_run(self) -> Generator[ParallelFragmentRun, None, None]:
        """Record a parallel fragment's run on the calling worker thread.

        The worker's cached calls go to the run's own cache stats while it
        runs, and still count toward the run's cache totals.
        """
        run = ParallelFragmentRun(time.perf_counter())
        with self._lock:
            self._runs.append(run)
        try:
            with self._cache_stats.recording_into(run.cache_stats):
                yield run
        finally:
            run.end = time.perf_counter()

    def add_wait_time(self, seconds: float) -> None:
        """Add time the script thread spent waiting for the workers to finish."""
        self.wait_time += seconds

    @property
    def runs(self) -> tuple[ParallelFragmentRun, ...]:
        """The runs so far, in the order they started."""
        with self._lock:
            return tuple(self._runs)
