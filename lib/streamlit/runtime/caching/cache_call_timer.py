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

"""Times cached calls for the page profile's per-run cache totals.

A call is recorded only if its time would otherwise count as user code in the
page profile, so the cache times can be subtracted from user code:

- It runs on a thread attached to a script run that gathers usage stats.
  Background refreshes and other threads without a script run are not recorded.
- It is not inside another cached function. A nested call is part of the
  outer call's compute time.
- It is not inside a tracked command, such as the ``st.cache_resource`` call
  inside ``st.connection``, whose time is already counted as command time.
- It finishes before the run's page profile is built. Counts and times are
  added together when the call finishes.

Each recorded call's time is split into waiting for another caller's
computation, computing the value, and the remaining cache overhead (hashing
arguments, reading results, and replaying cached elements). The time of
tracked commands that run during the call, such as ``st.*`` calls inside the
cached function or the cache write, is excluded from all three.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Final

from streamlit.runtime.caching.cache_type import CacheType
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    ThreadState,
    get_script_run_ctx,
    in_cached_function,
)

if TYPE_CHECKING:
    from streamlit.runtime.scriptrunner_utils.cache_run_stats import (
        CacheTotals,
        ThreadCacheStats,
    )


class CacheCallTimer:
    """Records one cached call into the current thread's run totals.

    Use ``start_call()`` to create one. The phase methods may be called in any
    order; ``finish()`` closes a phase left open by an exception.
    """

    # Class-level defaults for the per-call state, so a hit only pays for the
    # attributes it sets.
    _is_hit: bool = False
    _is_stale: bool = False
    _is_miss: bool = False
    _wait_start: float | None = None
    _wait_time: float = 0.0
    _compute_start: float | None = None
    _compute_time: float = 0.0
    _compute_command_start: float = 0.0
    _compute_command_time: float = 0.0

    def __init__(
        self, thread_stats: ThreadCacheStats | None, totals: CacheTotals | None
    ) -> None:
        self._thread_stats = thread_stats
        self._totals = totals
        if thread_stats is None or totals is None:
            self._start = 0.0
            self._command_time_at_start = 0.0
            return
        self._start = time.perf_counter()
        self._command_time_at_start = thread_stats.tracked_command_time
        thread_stats.open_call(self._start)

    def record_hit(self, *, is_stale: bool = False) -> None:
        if self._totals is None:
            return
        self._is_hit = True
        self._is_stale = is_stale

    def begin_wait(self) -> None:
        if self._totals is not None:
            self._wait_start = time.perf_counter()

    def end_wait(self) -> None:
        if self._wait_start is not None:
            self._wait_time += time.perf_counter() - self._wait_start
            self._wait_start = None

    def begin_compute(self) -> None:
        """Start timing the cached function, and count the call as a miss."""
        if self._thread_stats is None:
            return
        self._is_miss = True
        self._compute_start = time.perf_counter()
        self._compute_command_start = self._thread_stats.tracked_command_time

    def end_compute(self) -> None:
        if self._thread_stats is None or self._compute_start is None:
            return
        self._compute_time += time.perf_counter() - self._compute_start
        self._compute_command_time += (
            self._thread_stats.tracked_command_time - self._compute_command_start
        )
        self._compute_start = None

    def finish(self) -> None:
        """Add the call's counts and times to the run totals.

        Nothing is added before this, so a call still running when the run's
        page profile is built is left out of it entirely.
        """
        thread_stats, totals = self._thread_stats, self._totals
        if thread_stats is None or totals is None:
            return
        totals.calls += 1
        if self._is_hit:
            totals.hits += 1
            if self._is_stale:
                totals.stale_hits += 1
        if self._is_miss:
            totals.misses += 1
        if self._wait_start is not None:
            self.end_wait()
        if self._compute_start is not None:
            self.end_compute()
        now = time.perf_counter()
        command_time = thread_stats.tracked_command_time - self._command_time_at_start
        totals.compute_time += max(self._compute_time - self._compute_command_time, 0)
        totals.wait_time += self._wait_time
        # Wall-clock overlap between concurrent async calls on one event loop can
        # make the remainder negative.
        totals.overhead_time += max(
            (now - self._start)
            - self._wait_time
            - self._compute_time
            - (command_time - self._compute_command_time),
            0,
        )
        thread_stats.close_call(now)


_NOT_RECORDED: Final = CacheCallTimer(None, None)


def start_call(cache_type: CacheType) -> CacheCallTimer:
    """Start timing a cached call, or return a no-op timer if it isn't recorded."""
    if in_cached_function.get():
        return _NOT_RECORDED
    ctx = get_script_run_ctx(suppress_warning=True)
    if ctx is None or not ctx.gather_usage_stats:
        return _NOT_RECORDED
    try:
        if ThreadState.get().command_tracking_deactivated:
            return _NOT_RECORDED
    except RuntimeError:
        # A thread with a ScriptRunContext but no ThreadState.
        return _NOT_RECORDED
    thread_stats = ctx.shared.cache_stats.current_thread_stats()
    totals = (
        thread_stats.cache_resource
        if cache_type is CacheType.RESOURCE
        else thread_stats.cache_data
    )
    return CacheCallTimer(thread_stats, totals)
