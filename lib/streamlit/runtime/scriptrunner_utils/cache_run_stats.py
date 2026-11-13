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

"""Per-run cached-call totals reported in the page profile.

Each thread that makes a cached call during a script run gets its own
``ThreadCacheStats``, written only by that thread, so concurrent cache hits
(for example from parallel fragments) never contend on a lock. The totals are
combined when the run's page profile is built.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass


@dataclass(slots=True)
class CacheTotals:
    """Cached-call counts and times (in seconds) for one cache type."""

    calls: int = 0
    hits: int = 0
    misses: int = 0
    stale_hits: int = 0
    compute_time: float = 0.0
    wait_time: float = 0.0
    overhead_time: float = 0.0

    def add(self, other: CacheTotals, *, time_scale: float = 1.0) -> None:
        """Add ``other`` to these totals, multiplying its times by ``time_scale``."""
        self.calls += other.calls
        self.hits += other.hits
        self.misses += other.misses
        self.stale_hits += other.stale_hits
        self.compute_time += other.compute_time * time_scale
        self.wait_time += other.wait_time * time_scale
        self.overhead_time += other.overhead_time * time_scale

    @property
    def total_time(self) -> float:
        return self.compute_time + self.wait_time + self.overhead_time


class ThreadCacheStats:
    """Cached-call totals recorded by one thread during one script run.

    Async cached calls awaited concurrently on one event loop overlap, so their
    summed times can exceed the wall-clock time they ran, which is the most
    they can take from user code. So the calls of each overlapping group (from
    when the thread's first open call starts until no call is open) are added
    up separately, and scaled down to that group's wall-clock time, minus the
    tracked commands in it, before they join the per-type totals. Calls that
    run one at a time are added as recorded.
    """

    __slots__ = (
        "_calls_in_cache_code",
        "_open_calls",
        "_overlap",
        "_span_command_start",
        "_span_start",
        "cache_data",
        "cache_resource",
        "tracked_command_time",
    )

    def __init__(self) -> None:
        self.cache_data = CacheTotals()
        self.cache_resource = CacheTotals()
        # Time of the tracked commands that ran on this thread while a recorded
        # cached call was running. Only commands listed in the page profile count.
        self.tracked_command_time = 0.0
        self._open_calls = 0
        # Open calls that aren't waiting for another caller or computing.
        self._calls_in_cache_code = 0
        # When the thread's current open calls started.
        self._span_start = 0.0
        self._span_command_start = 0.0
        # The (cache_data, cache_resource) totals of the current group of
        # overlapping calls, or None while calls run one at a time.
        self._overlap: tuple[CacheTotals, CacheTotals] | None = None

    @property
    def is_in_call(self) -> bool:
        return self._open_calls > 0

    @property
    def is_in_cache_code(self) -> bool:
        """Whether a recorded call is hashing, reading, or replaying on this thread.

        Those steps never yield the thread, so a cached call started meanwhile
        is nested inside that call, for example in a ``hash_funcs`` function.
        """
        return self._calls_in_cache_code > 0

    def open_call(self, now: float) -> None:
        if self._open_calls == 0:
            self._span_start = now
            self._span_command_start = self.tracked_command_time
        elif self._overlap is None:
            self._overlap = (CacheTotals(), CacheTotals())
        self._open_calls += 1
        self._calls_in_cache_code += 1

    def close_call(self, now: float) -> None:
        self._calls_in_cache_code -= 1
        self._open_calls -= 1
        if self._open_calls == 0 and self._overlap is not None:
            overlap, self._overlap = self._overlap, None
            self._add_scaled(overlap, self.cache_data, self.cache_resource, now)

    def leave_cache_code(self) -> None:
        """Mark that an open call started waiting or computing."""
        self._calls_in_cache_code -= 1

    def enter_cache_code(self) -> None:
        """Mark that an open call stopped waiting or computing."""
        self._calls_in_cache_code += 1

    def totals_for_finished_call(self, totals: CacheTotals) -> CacheTotals:
        """Where a finishing call adds what it recorded for ``totals``' type."""
        if self._overlap is None:
            return totals
        return self._overlap[0] if totals is self.cache_data else self._overlap[1]

    def add_to(
        self, cache_data: CacheTotals, cache_resource: CacheTotals, now: float
    ) -> None:
        """Add this thread's totals to ``cache_data`` and ``cache_resource``.

        An overlapping group still open is scaled to the time it has run so far.
        """
        cache_data.add(self.cache_data)
        cache_resource.add(self.cache_resource)
        # Read after the totals above, so a group that closes meanwhile is left
        # out rather than counted twice.
        overlap = self._overlap
        if overlap is not None:
            self._add_scaled(overlap, cache_data, cache_resource, now)

    def _add_scaled(
        self,
        overlap: tuple[CacheTotals, CacheTotals],
        cache_data: CacheTotals,
        cache_resource: CacheTotals,
        now: float,
    ) -> None:
        overlap_data, overlap_resource = overlap
        recorded = overlap_data.total_time + overlap_resource.total_time
        span = max(
            (now - self._span_start)
            - (self.tracked_command_time - self._span_command_start),
            0.0,
        )
        scale = 1.0 if recorded <= span else span / recorded
        cache_data.add(overlap_data, time_scale=scale)
        cache_resource.add(overlap_resource, time_scale=scale)


class RunCacheStats:
    """The cached-call totals of every thread that made a cached call this run."""

    def __init__(self) -> None:
        self._local = threading.local()
        # Guards the list of threads, which changes once per thread and run.
        self._threads_lock = threading.Lock()
        self._threads: list[ThreadCacheStats] = []

    def current_thread_stats(self) -> ThreadCacheStats:
        """Return the calling thread's totals, creating them on first use."""
        stats: ThreadCacheStats | None = getattr(self._local, "stats", None)
        if stats is None:
            stats = ThreadCacheStats()
            self._local.stats = stats
            with self._threads_lock:
                self._threads.append(stats)
        return stats

    def record_tracked_command_time(self, seconds: float) -> None:
        """Record the time of a tracked command that ran on the calling thread.

        Only counts while a recorded cached call is running on the thread, so
        that time can be subtracted from the call's cache times.
        """
        stats: ThreadCacheStats | None = getattr(self._local, "stats", None)
        if stats is not None and stats.is_in_call:
            stats.tracked_command_time += seconds

    def totals(self, now: float) -> tuple[CacheTotals, CacheTotals]:
        """Return the combined ``(cache_data, cache_resource)`` totals."""
        with self._threads_lock:
            threads = list(self._threads)
        cache_data = CacheTotals()
        cache_resource = CacheTotals()
        for stats in threads:
            stats.add_to(cache_data, cache_resource, now)
        return cache_data, cache_resource
