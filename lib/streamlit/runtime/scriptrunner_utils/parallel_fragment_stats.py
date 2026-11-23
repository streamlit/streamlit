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
the run totals alone. Each fragment run records its own wall time and
``ThreadRunStats`` instead, so the page profile can report them apart from the
main script's.
"""

from __future__ import annotations

import contextlib
import threading
import time
from typing import TYPE_CHECKING

from streamlit.runtime.scriptrunner_utils.run_stats import ThreadRunStats

if TYPE_CHECKING:
    from collections.abc import Generator

    from streamlit.runtime.scriptrunner_utils.run_stats import RunStats


class ParallelFragmentRun:
    """One parallel fragment's run, recorded on its worker thread.

    Only the worker thread counts toward the run. Threads the fragment attaches
    with ``add_script_run_ctx`` record into their own ``ThreadRunStats``, so
    they count toward the main script, like other threads a user starts.
    """

    __slots__ = ("end", "start", "stats")

    def __init__(self, start: float) -> None:
        # perf_counter times; end is None until the fragment finishes.
        self.start = start
        self.end: float | None = None
        # What the worker thread records while the fragment runs.
        self.stats = ThreadRunStats()


class RunParallelFragmentStats:
    """The parallel fragment runs of one script run."""

    def __init__(self, stats: RunStats) -> None:
        self._stats = stats
        # Guards the list of runs, which workers append to as they start.
        self._lock = threading.Lock()
        self._runs: list[ParallelFragmentRun] = []
        # Time the script thread waited for the workers, written only by the
        # script thread.
        self.wait_time = 0.0

    @contextlib.contextmanager
    def recording_run(self) -> Generator[ParallelFragmentRun, None, None]:
        """Record a parallel fragment's run on the calling worker thread.

        Everything the worker records while the fragment runs goes to the run's
        own stats, which still count toward the run's totals.
        """
        run = ParallelFragmentRun(time.perf_counter())
        with self._lock:
            self._runs.append(run)
        try:
            with self._stats.recording_into(run.stats):
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
