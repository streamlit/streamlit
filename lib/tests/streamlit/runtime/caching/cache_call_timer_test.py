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

"""Tests for the cache metrics and per-run cache totals recorded by cached calls."""

from __future__ import annotations

import asyncio
import contextvars
import pickle
import threading
import time
import timeit
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, patch

import pytest

import streamlit as st
from streamlit.connections import BaseConnection
from streamlit.runtime import Runtime, metrics_util
from streamlit.runtime.caching import cache_background_refresh, cache_metrics
from streamlit.runtime.caching.cache_metrics import (
    CACHE_COMPUTE_DURATION_FAMILY,
    CACHE_LOOKUPS_FAMILY,
    CACHE_WAIT_DURATION_FAMILY,
    CacheMetrics,
)
from streamlit.runtime.caching.cache_utils import _make_value_key
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)
from streamlit.runtime.parallel_coordinator import ParallelFragmentCoordinator
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.scriptrunner_utils.exceptions import (
    RerunException,
    StopException,
)
from streamlit.runtime.scriptrunner_utils.script_requests import RerunData
from streamlit.runtime.scriptrunner_utils.script_run_context_attr import (
    SCRIPT_RUN_CONTEXT_ATTR_NAME,
)
from tests.testutil import create_mock_script_run_ctx

if TYPE_CHECKING:
    from collections.abc import Callable, Iterator

    from streamlit.runtime.scriptrunner import ScriptRunContext
    from streamlit.runtime.scriptrunner_utils.cache_run_stats import CacheTotals

CACHE_DECORATORS: list[tuple[str, Any]] = [
    ("cache_data", st.cache_data),
    ("cache_resource", st.cache_resource),
]


class FakeClock:
    """A perf_counter replacement that only moves when advanced."""

    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture
def ctx(monkeypatch: pytest.MonkeyPatch) -> Iterator[ScriptRunContext]:
    """Attach a script run context that gathers usage stats, with empty caches."""
    run_ctx = create_mock_script_run_ctx()
    run_ctx.gather_usage_stats = True
    # monkeypatch restores the thread's previous context, or detaches this one.
    monkeypatch.setattr(
        threading.current_thread(), SCRIPT_RUN_CONTEXT_ATTR_NAME, run_ctx, raising=False
    )
    mock_runtime = MagicMock(spec=Runtime)
    mock_runtime.cache_storage_manager = MemoryCacheStorageManager()
    monkeypatch.setattr(Runtime, "_instance", mock_runtime)
    monkeypatch.setattr(cache_metrics, "_cache_metrics", CacheMetrics())
    st.cache_data.clear()
    st.cache_resource.clear()
    yield run_ctx
    st.cache_data.clear()
    st.cache_resource.clear()
    cache_background_refresh.reset()


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> FakeClock:
    """Drive both cache timing and command timing from one fake clock."""
    fake = FakeClock()
    monkeypatch.setattr(time, "perf_counter", fake)
    monkeypatch.setattr(timeit, "default_timer", fake)
    return fake


def _cache_totals_for(ctx: ScriptRunContext, cache_name: str) -> CacheTotals:
    totals = ctx.shared.cache_stats.totals(time.perf_counter())
    return totals.cache_data if cache_name == "cache_data" else totals.cache_resource


def _server_counts(func: Any) -> tuple[int, int, int, int]:
    """Return ``func``'s hits, misses, computes and waits from its cache metrics."""
    stats = func._metrics.get_stats(None)
    lookups = {
        stat.labels["result"]: stat.value for stat in stats[CACHE_LOOKUPS_FAMILY]
    }
    computes = sum(
        stat.observation_count for stat in stats[CACHE_COMPUTE_DURATION_FAMILY]
    )
    (waits,) = stats[CACHE_WAIT_DURATION_FAMILY]
    return lookups["hit"], lookups["miss"], computes, waits.observation_count


def _command_names(ctx: ScriptRunContext) -> list[str]:
    return [command.name for command in ctx.shared.tracked_commands]


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_miss_then_hit(
    ctx: ScriptRunContext, clock: FakeClock, name: str, decorator: Callable[..., Any]
) -> None:
    """A miss records its compute time, and a hit records only overhead."""

    @decorator(show_spinner=False)
    def load(x: int) -> int:
        clock.advance(2.0)
        return x

    assert load(1) == 1
    assert load(1) == 1

    totals = _cache_totals_for(ctx, name)
    assert (totals.calls, totals.hits, totals.misses, totals.stale_hits) == (
        2,
        1,
        1,
        0,
    )
    assert totals.compute_time == pytest.approx(2.0)
    assert totals.wait_time == pytest.approx(0.0)
    assert totals.overhead_time == pytest.approx(0.0)
    other = _cache_totals_for(
        ctx, "cache_resource" if name == "cache_data" else "cache_data"
    )
    assert other.calls == 0


def test_hit_overhead_includes_replay(ctx: ScriptRunContext, clock: FakeClock) -> None:
    """Time spent replaying cached elements on a hit counts as overhead."""

    @st.cache_data(show_spinner=False)
    def load() -> int:
        st.text("cached output")
        return 1

    load()
    with patch(
        "streamlit.runtime.caching.cache_utils.replay_cached_messages",
        side_effect=lambda *_args: clock.advance(0.25),
    ):
        load()

    assert _cache_totals_for(ctx, "cache_data").overhead_time == pytest.approx(0.25)


@patch(
    "streamlit.runtime.caching.cache_background_refresh.get_background_refresh_manager"
)
@patch("streamlit.runtime.caching.cache_utils.TTLCACHE_TIMER")
@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_stale_value_counts_as_stale_hit(
    timer_patch: MagicMock,
    refresh_manager_patch: MagicMock,
    ctx: ScriptRunContext,
    name: str,
    decorator: Callable[..., Any],
) -> None:
    """A stale value served in background mode is a hit and a stale hit."""
    # Declining the refresh keeps it off this thread, as it is in production.
    refresh_manager_patch.return_value.submit.return_value = False
    timer_patch.return_value = 0

    @decorator(ttl=10, refresh_mode="background", show_spinner=False)
    def load() -> int:
        return 1

    load()
    timer_patch.return_value = 15
    load()

    refresh_manager_patch.return_value.submit.assert_called_once()
    totals = _cache_totals_for(ctx, name)
    assert (totals.calls, totals.hits, totals.misses, totals.stale_hits) == (
        2,
        1,
        1,
        1,
    )


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_waiter_on_compute_lock_counts_as_hit(
    ctx: ScriptRunContext, name: str, decorator: Callable[..., Any]
) -> None:
    """A caller that waits on the compute lock and then reads the value is a hit
    whose wait goes into wait_time.
    """
    computing = threading.Event()
    release = threading.Event()

    @decorator(show_spinner=False)
    def load() -> int:
        computing.set()
        release.wait(5)
        return 1

    # Another session computes the value on its own thread.
    other_ctx = create_mock_script_run_ctx()
    other_ctx.gather_usage_stats = True
    owner = add_script_run_ctx(threading.Thread(target=load), other_ctx)
    owner.start()
    assert computing.wait(5)
    threading.Timer(0.1, release.set).start()

    assert load() == 1
    owner.join(5)

    totals = _cache_totals_for(ctx, name)
    assert (totals.calls, totals.hits, totals.misses, totals.waits) == (1, 1, 0, 1)
    assert totals.wait_time >= 0.05
    assert totals.compute_time == 0
    # The waiting time is not overhead.
    assert totals.overhead_time < totals.wait_time
    other_totals = _cache_totals_for(other_ctx, name)
    assert (other_totals.calls, other_totals.hits, other_totals.misses) == (1, 0, 1)
    # Taking a compute lock no one else holds is not waiting.
    assert (other_totals.waits, other_totals.wait_time) == (0, 0)
    # The server's metrics count both sessions' calls the same way.
    assert _server_counts(load) == (1, 1, 1, 1)


def test_async_waiter_counts_as_hit_and_overlap_is_scaled(
    ctx: ScriptRunContext,
) -> None:
    """Concurrent same-key async callers on one event loop split into one miss and
    one waiting hit, and their summed times never exceed the time they ran.
    """

    @st.cache_data(show_spinner=False)
    async def load() -> int:
        await asyncio.sleep(0.1)
        return 1

    async def main() -> list[int]:
        return await asyncio.gather(load(), load())

    start = time.perf_counter()
    assert asyncio.run(main()) == [1, 1]
    elapsed = time.perf_counter() - start

    totals = _cache_totals_for(ctx, "cache_data")
    assert (totals.calls, totals.hits, totals.misses, totals.waits) == (2, 1, 1, 1)
    assert totals.wait_time > 0
    assert totals.compute_time > 0
    # Unscaled, compute (0.1s) plus the waiter's wait (0.1s) would be about twice
    # the elapsed time.
    assert totals.total_time <= elapsed
    assert _server_counts(load) == (1, 1, 1, 1)


def test_serial_call_after_overlapping_async_calls_is_not_scaled(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """Only the overlapping async calls are scaled to the time they ran; a later
    call on the same thread keeps its recorded time.
    """

    @st.cache_data(show_spinner=False)
    async def load(x: int) -> int:
        await asyncio.sleep(0)
        clock.advance(1.0)
        return x

    @st.cache_resource(show_spinner=False)
    def load_resource() -> int:
        clock.advance(2.0)
        return 1

    async def main() -> list[int]:
        return await asyncio.gather(load(1), load(2))

    # Both calls start at once, finish 1s and 2s later, and record 3s in 2s.
    assert asyncio.run(main()) == [1, 2]
    assert load_resource() == 1

    data = _cache_totals_for(ctx, "cache_data")
    assert (data.calls, data.misses) == (2, 2)
    assert data.compute_time == pytest.approx(2.0)
    resource = _cache_totals_for(ctx, "cache_resource")
    assert resource.compute_time == pytest.approx(2.0)


def test_call_started_while_another_async_call_waits_is_recorded(
    ctx: ScriptRunContext,
) -> None:
    """A waiting async call yields the event loop, so a call another task starts
    meanwhile isn't nested inside it and is recorded.
    """

    @st.cache_data(show_spinner=False)
    async def load() -> int:
        await asyncio.sleep(0.01)
        return 1

    @st.cache_resource(show_spinner=False)
    async def other() -> int:
        return 2

    async def main() -> list[int]:
        # The first load computes, the second waits for it, and other starts
        # during that wait.
        return await asyncio.gather(load(), load(), other())

    assert asyncio.run(main()) == [1, 1, 2]

    data = _cache_totals_for(ctx, "cache_data")
    assert (data.calls, data.misses, data.waits) == (2, 1, 1)
    assert _cache_totals_for(ctx, "cache_resource").calls == 1


def test_async_waiter_that_retries_after_owner_fails_is_a_miss(
    ctx: ScriptRunContext,
) -> None:
    """A waiter whose owner raised computes the value itself: a miss that also
    records its wait.
    """
    attempts = 0

    @st.cache_data(show_spinner=False)
    async def load() -> int:
        nonlocal attempts
        attempts += 1
        await asyncio.sleep(0.05)
        if attempts == 1:
            raise ValueError("boom")
        return 1

    async def main() -> list[Any]:
        return await asyncio.gather(load(), load(), return_exceptions=True)

    first, second = asyncio.run(main())
    assert isinstance(first, ValueError)
    assert second == 1

    totals = _cache_totals_for(ctx, "cache_data")
    assert (totals.calls, totals.hits, totals.misses, totals.waits) == (2, 0, 2, 1)
    assert totals.wait_time > 0
    assert _server_counts(load) == (0, 2, 2, 1)


def test_stop_while_waiting_counts_call_and_wait_only(
    ctx: ScriptRunContext,
) -> None:
    """A run stopped while waiting on another caller's compute records the call
    and its wait, but neither a hit nor a miss.
    """
    computing = threading.Event()
    release = threading.Event()

    @st.cache_data(show_spinner=False)
    def load() -> int:
        computing.set()
        release.wait(5)
        return 1

    other_ctx = create_mock_script_run_ctx()
    owner = add_script_run_ctx(threading.Thread(target=load), other_ctx)
    owner.start()
    assert computing.wait(5)

    with (
        patch(
            "streamlit.runtime.caching.cache_utils.get_run_yield_check",
            return_value=MagicMock(side_effect=StopException),
        ),
        pytest.raises(StopException),
    ):
        load()
    release.set()
    owner.join(5)

    totals = _cache_totals_for(ctx, "cache_data")
    assert (totals.calls, totals.hits, totals.misses, totals.waits) == (1, 0, 0, 1)
    assert totals.wait_time > 0
    # Only the owner's computation is a lookup, but the stopped wait still counts.
    assert _server_counts(load) == (0, 1, 1, 1)


def test_cached_call_inside_listed_command_is_not_recorded(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A cached call inside a tracked command is already in that command's time."""

    @st.cache_resource(show_spinner=False)
    def get_client() -> str:
        clock.advance(1.0)
        return "client"

    @metrics_util.gather_metrics("make_client")
    def make_client() -> str:
        return get_client()

    make_client()
    make_client()

    assert _cache_totals_for(ctx, "cache_resource").calls == 0
    assert "external:tests:make_client" in _command_names(ctx)


def test_cached_call_inside_command_past_the_limit_is_recorded(
    ctx: ScriptRunContext, clock: FakeClock, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A command past the per-command limit isn't listed, so the cached call
    inside it is recorded.
    """
    monkeypatch.setattr(metrics_util, "_MAX_TRACKED_PER_COMMAND", 1)

    @st.cache_resource(show_spinner=False)
    def get_client() -> str:
        clock.advance(1.0)
        return "client"

    @metrics_util.gather_metrics("make_client")
    def make_client() -> str:
        return get_client()

    make_client()
    make_client()

    assert _command_names(ctx).count("external:tests:make_client") == 1
    totals = _cache_totals_for(ctx, "cache_resource")
    assert totals.calls == 1
    assert totals.hits == 1
    assert totals.misses == 0


class _FakeConnection(BaseConnection[str]):
    def _connect(self, **kwargs: Any) -> str:
        return "raw connection"


def test_st_connection_cache_resource_is_not_recorded(ctx: ScriptRunContext) -> None:
    """The st.cache_resource call inside st.connection is part of its command time."""
    st.connection("my_connection", type=_FakeConnection)
    st.connection("my_connection", type=_FakeConnection)

    assert _cache_totals_for(ctx, "cache_resource").calls == 0
    assert "connection" in _command_names(ctx)


def test_listed_commands_inside_cached_function_are_not_compute_time(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """Tracked command time inside a cached function is not compute time, and is
    not taken out of the overhead a second time.
    """

    @metrics_util.gather_metrics("slow_command")
    def slow_command() -> None:
        clock.advance(3.0)

    @st.cache_data(show_spinner=False)
    def load() -> int:
        clock.advance(0.5)
        slow_command()
        return 1

    def slow_value_key(*args: Any, **kwargs: Any) -> str:
        clock.advance(0.25)
        return _make_value_key(*args, **kwargs)

    with patch(
        "streamlit.runtime.caching.cache_utils._make_value_key",
        side_effect=slow_value_key,
    ):
        load()

    totals = _cache_totals_for(ctx, "cache_data")
    assert totals.compute_time == pytest.approx(0.5)
    assert totals.overhead_time == pytest.approx(0.25)
    command = next(
        command
        for command in ctx.shared.tracked_commands
        if command.name == "external:tests:slow_command"
    )
    assert command.time == 3_000_000


def test_listed_command_that_reruns_inside_cached_function_is_not_compute_time(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A listed command that requests a rerun, like st.rerun, still leaves its time
    out of the failed call's compute time.
    """

    @metrics_util.gather_metrics("rerunning_command")
    def rerunning_command() -> None:
        clock.advance(2.0)
        raise RerunException(RerunData())

    @st.cache_data(show_spinner=False)
    def load() -> int:
        clock.advance(0.5)
        rerunning_command()
        return 1

    with pytest.raises(RerunException):
        load()

    totals = _cache_totals_for(ctx, "cache_data")
    assert (totals.calls, totals.misses) == (1, 1)
    assert totals.compute_time == pytest.approx(0.5)


def test_cache_write_command_time_is_excluded_from_overhead(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """The cache write is a tracked command, so its time is not overhead."""

    @st.cache_data(show_spinner=False)
    def load() -> int:
        return 1

    real_dumps = pickle.dumps

    def slow_dumps(value: Any) -> bytes:
        clock.advance(0.75)
        return real_dumps(value)

    with patch(
        "streamlit.runtime.caching.cache_data_api.pickle.dumps", side_effect=slow_dumps
    ):
        load()

    totals = _cache_totals_for(ctx, "cache_data")
    assert totals.overhead_time == pytest.approx(0.0)
    write = next(
        command
        for command in ctx.shared.tracked_commands
        if command.name == "_cache_data_object"
    )
    assert write.time == 750_000


def test_commands_past_the_limit_stay_in_compute_time(
    ctx: ScriptRunContext, clock: FakeClock, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A command past the per-command limit isn't listed, so the cached call
    keeps its time in compute time.
    """
    monkeypatch.setattr(metrics_util, "_MAX_TRACKED_PER_COMMAND", 1)

    @metrics_util.gather_metrics("repeated_command")
    def repeated_command() -> None:
        clock.advance(1.0)

    @st.cache_data(show_spinner=False)
    def load() -> int:
        repeated_command()
        repeated_command()
        return 1

    load()

    assert _command_names(ctx).count("external:tests:repeated_command") == 1
    assert _cache_totals_for(ctx, "cache_data").compute_time == pytest.approx(1.0)


def test_nested_cached_calls_count_only_the_outermost(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """Inner cached calls are part of the outer call's compute time."""

    @st.cache_resource(show_spinner=False)
    def inner() -> int:
        clock.advance(1.0)
        return 1

    @st.cache_data(show_spinner=False)
    def outer() -> int:
        clock.advance(0.5)
        return inner() + inner()

    assert outer() == 2

    data = _cache_totals_for(ctx, "cache_data")
    assert (data.calls, data.misses) == (1, 1)
    assert data.compute_time == pytest.approx(1.5)
    assert _cache_totals_for(ctx, "cache_resource").calls == 0
    # Per function, the server's metrics still count the inner calls.
    assert _server_counts(inner) == (1, 1, 1, 0)
    assert _server_counts(outer) == (0, 1, 1, 0)


def test_calls_on_threads_attached_inside_a_cached_function_are_not_recorded(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """Cached calls on a thread that a cached function attaches with
    add_script_run_ctx are part of the outer call's compute time, so they aren't
    recorded.
    """

    @st.cache_resource(show_spinner=False)
    def inner(x: int) -> int:
        clock.advance(1.0)
        return x

    @st.cache_data(show_spinner=False)
    def outer() -> int:
        results: list[int] = []
        thread = add_script_run_ctx(
            threading.Thread(target=lambda: results.append(inner(1)))
        )
        thread.start()
        thread.join(5)
        return results[0]

    assert outer() == 1
    # Outside a cached function, the same kind of thread is recorded.
    thread = add_script_run_ctx(threading.Thread(target=lambda: inner(2)))
    thread.start()
    thread.join(5)

    data = _cache_totals_for(ctx, "cache_data")
    assert (data.calls, data.misses) == (1, 1)
    assert data.compute_time == pytest.approx(1.0)
    resource = _cache_totals_for(ctx, "cache_resource")
    assert (resource.calls, resource.misses) == (1, 1)
    assert resource.compute_time == pytest.approx(1.0)
    # The server's metrics count both of inner's calls.
    assert _server_counts(inner) == (0, 2, 2, 0)


def test_commands_on_threads_attached_inside_a_cached_function_are_excluded(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A listed command on a thread the cached function attaches and joins is
    already command time, so it comes out of the call's compute time.
    """

    @metrics_util.gather_metrics("worker_command")
    def worker_command() -> None:
        clock.advance(3.0)

    @st.cache_data(show_spinner=False)
    def load() -> int:
        clock.advance(0.5)
        thread = add_script_run_ctx(threading.Thread(target=worker_command))
        thread.start()
        thread.join(5)
        return 1

    load()
    # Once the cached function returns, the thread's commands are not part of
    # its computation.
    thread = add_script_run_ctx(threading.Thread(target=worker_command))
    thread.start()
    thread.join(5)

    assert _command_names(ctx).count("external:tests:worker_command") == 2
    totals = _cache_totals_for(ctx, "cache_data")
    assert totals.compute_time == pytest.approx(0.5)
    assert totals.overhead_time == pytest.approx(0.0)
    # The server's compute duration still includes the attached thread's work.
    (miss_durations,) = [
        stat
        for stat in load._metrics.get_stats(None)[CACHE_COMPUTE_DURATION_FAMILY]
        if stat.labels["trigger"] == "miss"
    ]
    assert miss_durations.observation_sum == pytest.approx(3.5)


def test_commands_on_threads_attached_by_a_nested_cached_function_are_excluded(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A nested cached function's attached threads belong to the outermost
    computation, so their listed commands come out of the recorded call.
    """

    @metrics_util.gather_metrics("worker_command")
    def worker_command() -> None:
        clock.advance(3.0)

    @st.cache_resource(show_spinner=False)
    def inner() -> int:
        thread = add_script_run_ctx(threading.Thread(target=worker_command))
        thread.start()
        thread.join(5)
        return 1

    @st.cache_data(show_spinner=False)
    def outer() -> int:
        clock.advance(0.5)
        return inner()

    assert outer() == 1

    assert _command_names(ctx).count("external:tests:worker_command") == 1
    data = _cache_totals_for(ctx, "cache_data")
    assert (data.calls, data.misses) == (1, 1)
    assert data.compute_time == pytest.approx(0.5)
    assert _cache_totals_for(ctx, "cache_resource").calls == 0


def test_threads_attached_inside_an_async_cached_function_are_part_of_it(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """An async cached function's attached threads are part of its computation:
    their cached calls aren't recorded, and their listed commands come out of
    its compute time.
    """

    @metrics_util.gather_metrics("worker_command")
    def worker_command() -> None:
        clock.advance(3.0)

    @st.cache_resource(show_spinner=False)
    def inner() -> int:
        clock.advance(1.0)
        return 1

    def worker() -> None:
        inner()
        worker_command()

    @st.cache_data(show_spinner=False)
    async def load() -> int:
        clock.advance(0.5)
        thread = add_script_run_ctx(threading.Thread(target=worker))
        thread.start()
        thread.join(5)
        return 1

    assert asyncio.run(load()) == 1

    data = _cache_totals_for(ctx, "cache_data")
    assert (data.calls, data.misses) == (1, 1)
    # inner's 1s is part of the computation; the command's 3s isn't.
    assert data.compute_time == pytest.approx(1.5)
    assert _cache_totals_for(ctx, "cache_resource").calls == 0
    assert _server_counts(inner) == (0, 1, 1, 0)


def test_calls_on_attached_threads_after_the_cached_function_returns_are_recorded(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A long-lived thread attached inside a cached function records its cached
    calls once that function has returned.
    """
    release = threading.Event()

    @st.cache_data(show_spinner=False)
    def inner() -> int:
        clock.advance(1.0)
        return 1

    def worker() -> None:
        release.wait(5)
        inner()

    @st.cache_resource(show_spinner=False)
    def start_worker() -> threading.Thread:
        thread = add_script_run_ctx(threading.Thread(target=worker))
        thread.start()
        return thread

    thread = start_worker()
    release.set()
    thread.join(5)

    data = _cache_totals_for(ctx, "cache_data")
    assert (data.calls, data.misses) == (1, 1)
    assert data.compute_time == pytest.approx(1.0)


def test_cached_calls_from_hash_funcs_are_not_recorded(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A cached call made while another call hashes its arguments is part of
    that call's overhead.
    """

    class Key:
        pass

    @st.cache_resource(show_spinner=False)
    def key_hash() -> int:
        clock.advance(1.0)
        return 1

    @st.cache_data(show_spinner=False, hash_funcs={Key: lambda _key: key_hash()})
    def load(key: Key) -> int:
        return 1 if isinstance(key, Key) else 0

    assert load(Key()) == 1

    data = _cache_totals_for(ctx, "cache_data")
    assert (data.calls, data.misses) == (1, 1)
    assert data.overhead_time == pytest.approx(1.0)
    assert _cache_totals_for(ctx, "cache_resource").calls == 0
    assert _server_counts(key_hash) == (0, 1, 1, 0)


def test_parallel_worker_calls_are_added_to_the_run(ctx: ScriptRunContext) -> None:
    """Calls from parallel fragment workers count toward the run, per thread."""

    @st.cache_data(show_spinner=False)
    def load(x: int) -> int:
        return x

    for x in range(4):
        load(x)

    coordinator = ParallelFragmentCoordinator(yield_check=lambda: None, max_workers=4)
    barrier = threading.Barrier(4)

    def worker() -> None:
        barrier.wait(5)
        for x in range(4):
            load(x)

    for _ in range(4):
        coordinator.submit(worker, ctx)
    coordinator.join()

    totals = _cache_totals_for(ctx, "cache_data")
    assert (totals.calls, totals.hits, totals.misses) == (20, 16, 4)
    # The main thread and each of the four workers keep their own totals.
    assert len(ctx.shared.cache_stats._threads) == 5


def test_call_still_running_is_not_counted(ctx: ScriptRunContext) -> None:
    """A call on a thread that is still running when the totals are read, such
    as one the script started and didn't join, adds nothing until it finishes.
    """
    computing = threading.Event()
    release = threading.Event()

    @st.cache_data(show_spinner=False)
    def load() -> int:
        computing.set()
        release.wait(5)
        return 1

    thread = add_script_run_ctx(threading.Thread(target=load), ctx)
    thread.start()
    assert computing.wait(5)

    running = _cache_totals_for(ctx, "cache_data")
    assert (running.calls, running.hits, running.misses) == (0, 0, 0)
    assert running.total_time == 0

    release.set()
    thread.join(5)
    finished = _cache_totals_for(ctx, "cache_data")
    assert (finished.calls, finished.hits, finished.misses) == (1, 0, 1)
    assert finished.compute_time > 0


def test_calls_without_a_script_run_are_not_recorded(ctx: ScriptRunContext) -> None:
    """Threads without a ScriptRunContext, such as background refreshes and
    st.App lifespan tasks, record nothing.
    """

    @st.cache_data(show_spinner=False)
    def load() -> int:
        return 1

    thread = threading.Thread(target=load)
    thread.start()
    thread.join(5)

    assert _cache_totals_for(ctx, "cache_data").calls == 0
    assert ctx.shared.cache_stats._threads == []


def test_call_without_thread_state_is_not_recorded(ctx: ScriptRunContext) -> None:
    """A thread with a ScriptRunContext but no ThreadState still runs the cached
    function and reports it to the server metrics, but isn't recorded.
    """

    @st.cache_data(show_spinner=False)
    def load() -> int:
        return 1

    # An empty context has no ThreadState, while the thread keeps its
    # ScriptRunContext.
    assert contextvars.Context().run(load) == 1

    assert ctx.shared.cache_stats._threads == []
    assert _server_counts(load) == (0, 1, 1, 0)


def test_nothing_is_recorded_without_usage_stats(ctx: ScriptRunContext) -> None:
    """Respect browser.gatherUsageStats by not recording when it's off."""
    ctx.gather_usage_stats = False

    @st.cache_data(show_spinner=False)
    def load() -> int:
        return 1

    load()
    load()

    assert ctx.shared.cache_stats._threads == []
    assert _server_counts(load) == (1, 1, 1, 0)


def test_failed_call_counts_as_call_only(ctx: ScriptRunContext) -> None:
    """A call that fails before a value is read or computed is neither a hit nor
    a miss.
    """

    @st.cache_data(show_spinner=False)
    def load(_x: object, y: object) -> int:
        return 1

    with pytest.raises(st.errors.StreamlitAPIException):
        load(None, threading.Lock())

    totals = _cache_totals_for(ctx, "cache_data")
    assert (totals.calls, totals.hits, totals.misses) == (1, 0, 0)


def test_failed_compute_counts_as_miss(ctx: ScriptRunContext, clock: FakeClock) -> None:
    """A cached function that raises still counts as a miss with compute time."""

    @st.cache_data(show_spinner=False)
    def load() -> int:
        clock.advance(1.0)
        raise ValueError("boom")

    with pytest.raises(ValueError, match="boom"):
        load()

    totals = _cache_totals_for(ctx, "cache_data")
    assert (totals.calls, totals.misses) == (1, 1)
    assert totals.compute_time == pytest.approx(1.0)


def test_new_run_starts_from_zero(ctx: ScriptRunContext) -> None:
    """``SharedRunState.reset()`` starts a new totals object, so the next call
    does not include the previous run.
    """

    @st.cache_data(show_spinner=False)
    def load() -> int:
        return 1

    load()
    ctx.shared.reset()
    load()

    totals = _cache_totals_for(ctx, "cache_data")
    assert (totals.calls, totals.hits, totals.misses) == (1, 1, 0)


def test_call_running_across_a_reset_finishes_into_the_previous_run(
    ctx: ScriptRunContext,
) -> None:
    """A call that starts before ``SharedRunState.reset()`` and finishes after it
    adds to the previous run's totals, not the new run's.
    """
    computing = threading.Event()
    release = threading.Event()

    @st.cache_data(show_spinner=False)
    def load() -> int:
        computing.set()
        release.wait(5)
        return 1

    previous_run = ctx.shared.cache_stats
    thread = add_script_run_ctx(threading.Thread(target=load), ctx)
    thread.start()
    assert computing.wait(5)
    ctx.shared.reset()
    release.set()
    thread.join(5)

    previous_data = previous_run.totals(time.perf_counter()).cache_data
    assert (previous_data.calls, previous_data.misses) == (1, 1)
    assert _cache_totals_for(ctx, "cache_data").calls == 0
