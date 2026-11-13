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

    Besides the per-type totals, this tracks the wall-clock time during which
    at least one recorded cached call was running on the thread, minus the time
    of tracked commands in that period. Async cached calls awaited concurrently
    on one event loop overlap, so their summed times can exceed that span;
    ``time_scale`` shrinks them to fit so they never exceed the time that is
    otherwise counted as user code.
    """

    __slots__ = (
        "_open_calls",
        "_span_command_start",
        "_span_command_time",
        "_span_start",
        "_span_time",
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
        self._span_start = 0.0
        self._span_command_start = 0.0
        self._span_time = 0.0
        self._span_command_time = 0.0

    @property
    def is_in_call(self) -> bool:
        return self._open_calls > 0

    def open_call(self, now: float) -> None:
        if self._open_calls == 0:
            self._span_start = now
            self._span_command_start = self.tracked_command_time
        self._open_calls += 1

    def close_call(self, now: float) -> None:
        self._open_calls -= 1
        if self._open_calls == 0:
            self._span_time += now - self._span_start
            self._span_command_time += (
                self.tracked_command_time - self._span_command_start
            )

    def time_scale(self, now: float) -> float:
        """The factor that keeps this thread's cache times within its call span."""
        recorded = self.cache_data.total_time + self.cache_resource.total_time
        span = self._span_time - self._span_command_time
        if self._open_calls > 0:
            span += (now - self._span_start) - (
                self.tracked_command_time - self._span_command_start
            )
        if recorded <= span:
            return 1.0
        return max(span, 0.0) / recorded


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
            scale = stats.time_scale(now)
            cache_data.add(stats.cache_data, time_scale=scale)
            cache_resource.add(stats.cache_resource, time_scale=scale)
        return cache_data, cache_resource
