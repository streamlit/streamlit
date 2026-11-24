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

Each thread records its cached calls in the ``ThreadCacheStats`` of its own
``ThreadRunStats`` (see ``run_stats.py``), written only by that thread, so
concurrent cache hits (for example from parallel fragments) never contend on a
lock. The totals are combined when the run's page profile is built.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Iterable


@dataclass(slots=True)
class CacheTotals:
    """Cached-call counts and times (in seconds) for one cache type."""

    calls: int = 0
    hits: int = 0
    misses: int = 0
    stale_hits: int = 0
    waits: int = 0
    compute_time: float = 0.0
    wait_time: float = 0.0
    overhead_time: float = 0.0

    def add(self, other: CacheTotals) -> None:
        self.calls += other.calls
        self.hits += other.hits
        self.misses += other.misses
        self.stale_hits += other.stale_hits
        self.waits += other.waits
        self.compute_time += other.compute_time
        self.wait_time += other.wait_time
        self.overhead_time += other.overhead_time


@dataclass(slots=True)
class RunCacheTotals:
    """Cached-call totals combined across threads or fragment runs."""

    cache_data: CacheTotals = field(default_factory=CacheTotals)
    cache_resource: CacheTotals = field(default_factory=CacheTotals)
    # Time that overlapping async calls counted more than once, which analysis
    # subtracts from the cache times.
    async_overlap_time: float = 0.0

    def add(self, other: RunCacheTotals) -> None:
        self.cache_data.add(other.cache_data)
        self.cache_resource.add(other.cache_resource)
        self.async_overlap_time += other.async_overlap_time

    @classmethod
    def combine(cls, threads: Iterable[ThreadCacheStats], now: float) -> RunCacheTotals:
        """Return the totals of ``threads`` added together.

        ``now`` is the current ``time.perf_counter()`` value. It ends the span of
        any overlap group that is still open, so that group counts the overlap
        it has had so far.
        """
        totals = cls()
        for stats in threads:
            stats.add_to(totals, now)
        return totals


class _OverlapGroup:
    """Async cached calls that overlap on one thread's event loop.

    Overlapping calls each count the wall-clock time they share, so their summed
    times can exceed the time that passed. The group adds up the times of the
    calls that finish while it's open, and ``overlap_time`` returns how much
    that sum exceeds the group's span.
    """

    __slots__ = ("command_end", "command_start", "end", "recorded_time", "start")

    def __init__(self, start: float, command_start: float) -> None:
        # perf_counter time and the thread's listed command time when the
        # group's first call started.
        self.start = start
        self.command_start = command_start
        # The same values when the group's last call finished. end stays None
        # while the group is open.
        self.end: float | None = None
        self.command_end = 0.0
        # Compute, wait and overhead time, for both cache types, of the calls
        # that finished while the group was open.
        self.recorded_time = 0.0

    def overlap_time(self, *, now: float, command_time: float) -> float:
        """Return how much the calls' times exceed the group's span: its
        wall-clock time minus listed command time. Command time is left out of
        the span because the calls' own times already leave it out.

        For a group that is still open, ``now`` and ``command_time`` mark the
        end of its span so far.
        """
        if self.end is not None:
            now, command_time = self.end, self.command_end
        span = max((now - self.start) - (command_time - self.command_start), 0.0)
        return max(self.recorded_time - span, 0.0)


class ThreadCacheStats:
    """Cached-call totals recorded by one thread during one script run.

    Concurrent async cached calls on one event loop overlap, so their summed
    times can exceed the wall-clock time they took. Overlapping calls form a
    group that lasts from the first call opening until no call is open. The
    calls' times are added to the totals as usual. When the group closes,
    ``close_call`` adds whatever their times exceed its span by (wall-clock
    time minus listed command time) to ``async_overlap_time``.
    """

    __slots__ = (
        "_calls_in_cache_code",
        "_calls_open",
        "_overlap",
        "_span_command_start",
        "_span_start",
        "async_overlap_time",
        "cache_data",
        "cache_resource",
        "tracked_command_time",
    )

    def __init__(self) -> None:
        self.cache_data = CacheTotals()
        self.cache_resource = CacheTotals()
        self.async_overlap_time = 0.0
        # Time of listed commands that ran on this thread during a recorded
        # cached call.
        self.tracked_command_time = 0.0
        self._calls_open = 0
        # Open calls running the cache's own code (hashing, reading the result,
        # replaying elements), rather than waiting or running the cached function.
        self._calls_in_cache_code = 0
        # When the first currently open call began, and the thread's listed
        # command time then. If a second call opens before it closes, the
        # overlap group starts here.
        self._span_start = 0.0
        self._span_command_start = 0.0
        # The current group of overlapping calls, or None while calls run one
        # at a time.
        self._overlap: _OverlapGroup | None = None

    @property
    def is_in_call(self) -> bool:
        """Whether a recorded cached call is open on this thread."""
        return self._calls_open > 0

    @property
    def is_in_cache_code(self) -> bool:
        """Whether an open call on this thread is running the cache's own code:
        hashing, reading the result, or replaying elements.

        That code never yields to the event loop, so a cached call that starts
        meanwhile must come from inside it, for example from a ``hash_funcs``
        function.
        """
        return self._calls_in_cache_code > 0

    def record_tracked_command_time(self, seconds: float) -> None:
        """Record the time of a listed command that ran on this thread.

        Only counts while a recorded cached call is open on the thread, so the
        call's cache times leave it out.
        """
        if self._calls_open > 0:
            self.tracked_command_time += seconds

    def open_call(self, now: float) -> None:
        if self._calls_open == 0:
            # Remember when this call started, in case another opens before it
            # finishes.
            self._span_start = now
            self._span_command_start = self.tracked_command_time
        elif self._overlap is None:
            # A second call opened while the first is still open: start a group
            # that spans back to when the first call started.
            self._overlap = _OverlapGroup(self._span_start, self._span_command_start)
        self._calls_open += 1
        self._calls_in_cache_code += 1

    def close_call(self, now: float, call_time: float) -> None:
        """Close a call whose compute, wait and overhead times add up to
        ``call_time``, after its times were added to the totals.
        """
        self._calls_in_cache_code -= 1
        self._calls_open -= 1
        group = self._overlap
        if group is None:
            return
        group.recorded_time += call_time
        if self._calls_open == 0:
            # Set the end first: a page profile built on another thread may
            # already hold this group, and must measure it to this span rather
            # than to its own `now`.
            group.command_end = self.tracked_command_time
            group.end = now
            self._overlap = None
            self.async_overlap_time += group.overlap_time(
                now=now, command_time=self.tracked_command_time
            )

    def leave_cache_code(self) -> None:
        """Mark that an open call left the cache's own code to wait or run the
        cached function.
        """
        self._calls_in_cache_code -= 1

    def enter_cache_code(self) -> None:
        """Mark that an open call returned to the cache's own code."""
        self._calls_in_cache_code += 1

    def add_to(self, totals: RunCacheTotals, now: float) -> None:
        """Add this thread's totals to ``totals``, measuring an overlap group
        that is still open up to ``now``.
        """
        totals.cache_data.add(self.cache_data)
        totals.cache_resource.add(self.cache_resource)
        totals.async_overlap_time += self.async_overlap_time
        # Read the open group after async_overlap_time. close_call clears the
        # group before adding its overlap, so a group that closes in between is
        # left out rather than counted twice.
        group = self._overlap
        if group is not None:
            totals.async_overlap_time += group.overlap_time(
                now=now, command_time=self.tracked_command_time
            )
