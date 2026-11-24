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

"""Records cached calls for the server's cache metrics and the page profile's
per-run cache totals.

Every call reports its hit or miss, compute time and wait to its function's
``FunctionCacheMetrics``. A hit returned a stored value, including one that
another caller computed while this call waited. A miss ran the function.

The page profile records a call only if it ran as part of the script run and no
other recorded time already covers it:

- It runs on a thread attached to a script run that gathers usage stats, so
  cached calls made from background refreshes, ``st.App`` lifespan tasks and
  other threads without a script run aren't recorded. A background refresh
  itself isn't a lookup; its compute time and result go only to the server
  metrics.
- It isn't nested inside another cached call on the same thread, whose time
  covers it. Nested calls include calls made:

  - while the outer function computes;
  - while the outer call hashes its arguments or reads its result, such as
    from a ``hash_funcs`` function.

  Threads that a cached function attaches with ``add_script_run_ctx`` record
  their cached calls as their own, so the run totals count that time twice. A
  task that an async cached function starts with ``asyncio.create_task()``
  inherits the outer call's state for good, so its cached calls aren't
  recorded even after the outer computation ends.
- It isn't inside a command listed in the page profile, such as the
  ``st.cache_resource`` call inside ``st.connection``, whose command time covers
  it. A command past the listing limits in ``metrics_util.py`` isn't listed, so
  a cached call inside it is recorded.
- It finishes before the run's page profile is built.

A recorded call's time is split into waiting for another caller's computation,
computing the value, and the remaining overhead (hashing the arguments, reading
the result, and replaying cached elements). Listed commands that run during the
call, such as ``st.*`` calls inside the cached function or the cache write, are
left out of all three.

Async cached calls awaited at the same time on one event loop each count the
time they share. Their times aren't changed; the run's ``async_overlap_time``
reports how much they counted more than once.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Final

from streamlit.logger import get_logger
from streamlit.runtime.caching.cache_type import CacheType
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    ThreadState,
    get_script_run_ctx,
    in_cached_function,
)

if TYPE_CHECKING:
    from streamlit.runtime.caching.cache_metrics import FunctionCacheMetrics
    from streamlit.runtime.scriptrunner_utils.cache_run_stats import (
        CacheTotals,
        ThreadCacheStats,
    )

_LOGGER: Final = get_logger(__name__)


class CacheCallTimer:
    """Records one cached call in its function's metrics and, if the page
    profile records the call, in the current thread's run totals.

    Use ``start_call()`` to create one. Each ``begin_*`` is paired with its
    ``end_*``, and a phase may run more than once (an async waiter can retry);
    ``finish()`` closes a phase left open by an exception.
    """

    # Class-level defaults for the per-call state, so a hit only pays for the
    # attributes it sets.
    _is_hit: bool = False
    _is_stale: bool = False
    _is_miss: bool = False
    _waited: bool = False
    _wait_start: float | None = None
    _wait_time: float = 0.0
    _compute_start: float | None = None
    _compute_time: float = 0.0
    _command_time_at_compute_start: float = 0.0
    _command_time_in_compute: float = 0.0

    def __init__(
        self,
        metrics: FunctionCacheMetrics,
        thread_stats: ThreadCacheStats | None = None,
        totals: CacheTotals | None = None,
    ) -> None:
        self._metrics = metrics
        self._thread_stats = thread_stats
        self._totals = totals
        if thread_stats is None or totals is None:
            self._start = 0.0
            self._command_time_at_start = 0.0
            return
        self._start = time.perf_counter()
        self._command_time_at_start = thread_stats.tracked_command_time
        try:
            thread_stats.open_call(self._start)
        except Exception as ex:
            # Telemetry must never reach the cached function's caller. The call
            # then goes only to the server metrics.
            _LOGGER.debug("Failed to record a cached call", exc_info=ex)
            self._thread_stats = self._totals = None

    def record_hit(self, *, is_stale: bool = False) -> None:
        self._metrics.record_hit()
        if self._totals is None:
            return
        self._is_hit = True
        self._is_stale = is_stale

    def begin_wait(self) -> None:
        self._waited = True
        self._wait_start = time.perf_counter()
        self._leave_cache_code()

    def end_wait(self) -> None:
        if self._wait_start is None:
            return
        self._wait_time += time.perf_counter() - self._wait_start
        self._wait_start = None
        self._enter_cache_code()

    def begin_compute(self) -> None:
        """Start timing the cached function, and count the call as a miss."""
        self._metrics.record_miss()
        self._compute_start = time.perf_counter()
        if self._thread_stats is None:
            return
        self._is_miss = True
        self._command_time_at_compute_start = self._thread_stats.tracked_command_time
        self._leave_cache_code()

    def end_compute(self) -> None:
        if self._compute_start is None:
            return
        elapsed = time.perf_counter() - self._compute_start
        self._compute_start = None
        # The server metrics get the full duration, including st.* calls in the
        # function. Only the page profile totals leave command time out.
        self._metrics.record_compute_duration(elapsed)
        if self._thread_stats is None:
            return
        self._compute_time += elapsed
        self._command_time_in_compute += (
            self._thread_stats.tracked_command_time
            - self._command_time_at_compute_start
        )
        self._enter_cache_code()

    def _leave_cache_code(self) -> None:
        if self._thread_stats is None:
            return
        try:
            self._thread_stats.leave_cache_code()
        except Exception as ex:
            # Telemetry must never reach the cached function's caller.
            _LOGGER.debug("Failed to record a cached call", exc_info=ex)

    def _enter_cache_code(self) -> None:
        if self._thread_stats is None:
            return
        try:
            self._thread_stats.enter_cache_code()
        except Exception as ex:
            # Telemetry must never reach the cached function's caller.
            _LOGGER.debug("Failed to record a cached call", exc_info=ex)

    def finish(self) -> None:
        """Record the call's wait, and add its counts and times to the run totals.

        Nothing is added to the run totals before this, so a call still running
        when the run's page profile is built is left out of it entirely. This
        updates the totals one field at a time without a lock, so a page profile
        built while another thread runs this can include part of that call.
        """
        if self._wait_start is not None:
            self.end_wait()
        if self._compute_start is not None:
            self.end_compute()
        if self._waited:
            self._metrics.record_wait_duration(self._wait_time)
        thread_stats, totals = self._thread_stats, self._totals
        if thread_stats is None or totals is None:
            return
        # finish() runs in a finally block around every recorded call, so
        # telemetry must never raise into it.
        now = time.perf_counter()
        call_time = 0.0
        try:
            call_time = self._add_to_run_totals(thread_stats, totals, now)
        except Exception as ex:
            _LOGGER.debug("Failed to record a cached call", exc_info=ex)
        try:
            # Close the call even if adding it failed. Otherwise the thread
            # would stay in cache code and skip its later cached calls.
            thread_stats.close_call(now, call_time)
        except Exception as ex:
            _LOGGER.debug("Failed to record a cached call", exc_info=ex)

    def _add_to_run_totals(
        self, thread_stats: ThreadCacheStats, totals: CacheTotals, now: float
    ) -> float:
        """Add the call to ``totals`` and return its compute, wait and overhead
        time added together.
        """
        totals.calls += 1
        if self._is_hit:
            totals.hits += 1
            if self._is_stale:
                totals.stale_hits += 1
        if self._is_miss:
            totals.misses += 1
        if self._waited:
            totals.waits += 1
        command_time = thread_stats.tracked_command_time - self._command_time_at_start
        compute_time = max(self._compute_time - self._command_time_in_compute, 0)
        # Command time during the compute is already excluded from compute_time,
        # so only the rest of command_time comes out of the overhead. Wall-clock
        # overlap between concurrent async calls on one event loop can make the
        # remainder negative.
        overhead_time = max(
            (now - self._start)
            - self._wait_time
            - self._compute_time
            - (command_time - self._command_time_in_compute),
            0,
        )
        totals.compute_time += compute_time
        totals.wait_time += self._wait_time
        totals.overhead_time += overhead_time
        return compute_time + self._wait_time + overhead_time


def start_call(cache_type: CacheType, metrics: FunctionCacheMetrics) -> CacheCallTimer:
    """Start timing a cached call.

    The timer adds the call to the run totals only if the page profile records
    it (see the module docstring).
    """
    if in_cached_function.get():
        return CacheCallTimer(metrics)
    ctx = get_script_run_ctx(suppress_warning=True)
    if ctx is None or not ctx.gather_usage_stats:
        return CacheCallTimer(metrics)
    try:
        if ThreadState.get().in_listed_command:
            return CacheCallTimer(metrics)
    except RuntimeError:
        # A thread with a ScriptRunContext but no ThreadState.
        return CacheCallTimer(metrics)
    thread_stats = ctx.shared.stats.current_thread_stats().cache
    # Skip calls made while another call on this thread hashes its arguments or
    # reads its result, such as from hash_funcs; that call's overhead covers them.
    if thread_stats.is_in_cache_code:
        return CacheCallTimer(metrics)
    totals = (
        thread_stats.cache_resource
        if cache_type is CacheType.RESOURCE
        else thread_stats.cache_data
    )
    return CacheCallTimer(metrics, thread_stats, totals)
