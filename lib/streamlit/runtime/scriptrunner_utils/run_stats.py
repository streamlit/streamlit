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

"""Per-thread page profile values recorded during a script run.

Each thread that records something during a run gets its own
``ThreadRunStats``, written only by that thread, so recording a command, a
cached call or a query takes no lock. The page profile adds the threads' values together
when it's built.
"""

from __future__ import annotations

import contextlib
import threading
from typing import TYPE_CHECKING

from streamlit.runtime.scriptrunner_utils.cache_run_stats import ThreadCacheStats
from streamlit.runtime.scriptrunner_utils.query_run_stats import QueryStats

if TYPE_CHECKING:
    from collections.abc import Generator


class ThreadRunStats:
    """Values recorded by one thread, or by one parallel fragment run on its
    worker thread, during one script run.
    """

    __slots__ = ("cache", "command_time", "query")

    def __init__(self) -> None:
        # Time of listed commands that ran on this thread. The page profile
        # reports it only for parallel fragment runs.
        self.command_time = 0.0
        self.cache = ThreadCacheStats()
        self.query = QueryStats()


class RunStats:
    """The ``ThreadRunStats`` of every thread that recorded something this run."""

    def __init__(self) -> None:
        # Holds each thread's own stats, visible only to that thread.
        self._local = threading.local()
        # Guards the list of every thread's stats, which changes once per thread
        # and parallel fragment run.
        self._threads_lock = threading.Lock()
        self._threads: list[ThreadRunStats] = []

    def current_thread_stats(self) -> ThreadRunStats:
        """Return the calling thread's stats, creating them on first use."""
        stats: ThreadRunStats | None = getattr(self._local, "stats", None)
        if stats is None:
            stats = ThreadRunStats()
            self._local.stats = stats
            with self._threads_lock:
                self._threads.append(stats)
        return stats

    @contextlib.contextmanager
    def recording_into(self, stats: ThreadRunStats) -> Generator[None, None, None]:
        """Record the calling thread's values into ``stats`` until the block
        exits.

        A parallel fragment uses this to keep its values apart from other
        fragments that run on the same worker thread. ``stats`` still counts
        toward ``all_thread_stats()``.
        """
        with self._threads_lock:
            self._threads.append(stats)
        previous: ThreadRunStats | None = getattr(self._local, "stats", None)
        self._local.stats = stats
        try:
            yield
        finally:
            self._local.stats = previous

    def all_thread_stats(self) -> tuple[ThreadRunStats, ...]:
        """Return the stats of every thread and parallel fragment run so far,
        including threads that have exited.
        """
        with self._threads_lock:
            return tuple(self._threads)
