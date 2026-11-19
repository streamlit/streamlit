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
- It isn't nested inside another cached call, whose time covers it. Nested
  calls include calls made:

  - while the outer function computes, including on threads it attaches with
    ``add_script_run_ctx``;
  - while the outer call hashes its arguments or reads its result, such as
    from a ``hash_funcs`` function.

  A thread that calls ``add_script_run_ctx()`` on itself doesn't inherit the
  outer call's state, so its calls are recorded.
- It isn't inside a command listed in the page profile, such as the
  ``st.cache_resource`` call inside ``st.connection``, whose command time covers
  it. A command past the listing limits in ``metrics_util.py`` isn't listed, so
  a cached call inside it is recorded.
- It finishes before the run's page profile is built.

A recorded call's time is split into waiting for another caller's computation,
computing the value, and the remaining overhead (hashing the arguments, reading
the result, and replaying cached elements). Listed commands that run during the
call, such as ``st.*`` calls inside the cached function or the cache write, are
left out of all three. That includes commands on threads the cached function
attaches, until its computation ends.
"""

from __future__ import annotations

import contextlib
import time
from typing import TYPE_CHECKING

from streamlit.runtime.caching.cache_type import CacheType
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    CacheComputeScope,
    ThreadState,
    get_script_run_ctx,
    in_cached_function,
)

if TYPE_CHECKING:
    from collections.abc import Generator

    from streamlit.runtime.caching.cache_metrics import FunctionCacheMetrics
    from streamlit.runtime.scriptrunner_utils.cache_run_stats import (
        CacheTotals,
        ThreadCacheStats,
    )


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
    _attached_command_time: float = 0.0

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
        thread_stats.open_call(self._start)

    def record_hit(self, *, is_stale: bool = False) -> None:
        self._metrics.record_hit()
        if self._totals is None:
            return
        self._is_hit = True
        self._is_stale = is_stale

    def begin_wait(self) -> None:
        self._waited = True
        self._wait_start = time.perf_counter()
        if self._thread_stats is not None:
            self._thread_stats.leave_cache_code()

    def end_wait(self) -> None:
        if self._wait_start is None:
            return
        self._wait_time += time.perf_counter() - self._wait_start
        self._wait_start = None
        if self._thread_stats is not None:
            self._thread_stats.enter_cache_code()

    def begin_compute(self) -> None:
        """Start timing the cached function, and count the call as a miss."""
        self._metrics.record_miss()
        self._compute_start = time.perf_counter()
        if self._thread_stats is None:
            return
        self._is_miss = True
        self._command_time_at_compute_start = self._thread_stats.tracked_command_time
        self._thread_stats.leave_cache_code()

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
        self._thread_stats.enter_cache_code()

    def exclude_attached_command_time(self, seconds: float) -> None:
        """Subtract ``seconds`` of listed commands that attached threads ran
        during the computation from the compute time.
        """
        self._attached_command_time += seconds

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
        totals = thread_stats.totals_for_finished_call(totals)
        totals.calls += 1
        if self._is_hit:
            totals.hits += 1
            if self._is_stale:
                totals.stale_hits += 1
        if self._is_miss:
            totals.misses += 1
        if self._waited:
            totals.waits += 1
        now = time.perf_counter()
        command_time = thread_stats.tracked_command_time - self._command_time_at_start
        # Attached threads' commands aren't in this thread's command time, so only
        # compute time leaves them out, not the overhead below.
        totals.compute_time += max(
            self._compute_time
            - self._command_time_in_compute
            - self._attached_command_time,
            0,
        )
        totals.wait_time += self._wait_time
        # Command time during the compute is already excluded from compute_time,
        # so only the rest of command_time comes out of the overhead. Wall-clock
        # overlap between concurrent async calls on one event loop can make the
        # remainder negative.
        totals.overhead_time += max(
            (now - self._start)
            - self._wait_time
            - self._compute_time
            - (command_time - self._command_time_in_compute),
            0,
        )
        thread_stats.close_call(now)


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
        thread_state = ThreadState.get()
    except RuntimeError:
        # A thread with a ScriptRunContext but no ThreadState.
        return CacheCallTimer(metrics)
    if thread_state.in_listed_command:
        return CacheCallTimer(metrics)
    # Nested inside another cached call's computation, possibly on a thread it
    # attached.
    if thread_state.in_cache_compute:
        return CacheCallTimer(metrics)
    thread_stats = ctx.shared.cache_stats.current_thread_stats()
    # Nested inside another recorded call's hashing or result reading.
    if thread_stats.is_in_cache_code:
        return CacheCallTimer(metrics)
    totals = (
        thread_stats.cache_resource
        if cache_type is CacheType.RESOURCE
        else thread_stats.cache_data
    )
    return CacheCallTimer(metrics, thread_stats, totals)


@contextlib.contextmanager
def computing_cached_value(call_timer: CacheCallTimer) -> Generator[None, None, None]:
    """Mark the current context as computing ``call_timer``'s value.

    Threads attached with ``add_script_run_ctx`` during the computation inherit
    the mark, so:

    - their cached calls are part of this computation, not recorded separately;
    - their listed commands' time comes out of ``call_timer``'s compute time.

    A context that is already marked keeps the outer computation's mark. A
    thread without script-run thread state has nothing to mark.
    """
    try:
        thread_state = ThreadState.get()
    except RuntimeError:
        # A thread that isn't attached to a script run.
        thread_state = None
    if thread_state is None or thread_state.in_cache_compute:
        yield
        return
    scope = CacheComputeScope()
    try:
        with ThreadState.scoped(cache_compute=scope):
            yield
    finally:
        call_timer.exclude_attached_command_time(scope.end())
