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

"""Tests for the per-run cache totals recorded by cached calls."""

from __future__ import annotations

import asyncio
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
from streamlit.runtime.caching import cache_background_refresh
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)
from streamlit.runtime.parallel_coordinator import ParallelFragmentCoordinator
from streamlit.runtime.scriptrunner import add_script_run_ctx
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


def _totals(ctx: ScriptRunContext, name: str) -> CacheTotals:
    cache_data, cache_resource = ctx.shared.cache_stats.totals(time.perf_counter())
    return cache_data if name == "cache_data" else cache_resource


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

    totals = _totals(ctx, name)
    assert (totals.calls, totals.hits, totals.misses, totals.stale_hits) == (
        2,
        1,
        1,
        0,
    )
    assert totals.compute_time == pytest.approx(2.0)
    assert totals.wait_time == pytest.approx(0.0)
    assert totals.overhead_time == pytest.approx(0.0)
    other = _totals(ctx, "cache_resource" if name == "cache_data" else "cache_data")
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

    assert _totals(ctx, "cache_data").overhead_time == pytest.approx(0.25)


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
    totals = _totals(ctx, name)
    assert (totals.calls, totals.hits, totals.misses, totals.stale_hits) == (
        2,
        1,
        1,
        1,
    )


@pytest.mark.parametrize(("name", "decorator"), CACHE_DECORATORS)
def test_waiting_for_another_callers_computation(
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

    totals = _totals(ctx, name)
    assert (totals.calls, totals.hits, totals.misses) == (1, 1, 0)
    assert totals.wait_time >= 0.05
    assert totals.compute_time == 0
    # The waiting time is not overhead.
    assert totals.overhead_time < totals.wait_time
    other_totals = _totals(other_ctx, name)
    assert (other_totals.calls, other_totals.hits, other_totals.misses) == (1, 0, 1)


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

    totals = _totals(ctx, "cache_data")
    assert (totals.calls, totals.hits, totals.misses) == (2, 1, 1)
    assert totals.wait_time > 0
    assert totals.compute_time > 0
    # Unscaled, compute (0.1s) plus the waiter's wait (0.1s) would be about twice
    # the elapsed time.
    assert totals.total_time <= elapsed


def test_cached_call_inside_tracked_command_is_not_recorded(
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

    assert _totals(ctx, "cache_resource").calls == 0
    assert "external:tests:make_client" in _command_names(ctx)


class _FakeConnection(BaseConnection[str]):
    def _connect(self, **kwargs: Any) -> str:
        return "raw connection"


def test_st_connection_cache_resource_is_not_recorded(ctx: ScriptRunContext) -> None:
    """The st.cache_resource call inside st.connection is part of its command time."""
    st.connection("my_connection", type=_FakeConnection)
    st.connection("my_connection", type=_FakeConnection)

    assert _totals(ctx, "cache_resource").calls == 0
    assert "connection" in _command_names(ctx)


def test_tracked_commands_inside_cached_function_are_excluded(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """Tracked command time inside a cached function is not compute time."""

    @metrics_util.gather_metrics("slow_command")
    def slow_command() -> None:
        clock.advance(3.0)

    @st.cache_data(show_spinner=False)
    def load() -> int:
        clock.advance(0.5)
        slow_command()
        return 1

    load()

    totals = _totals(ctx, "cache_data")
    assert totals.compute_time == pytest.approx(0.5)
    assert totals.overhead_time == pytest.approx(0.0)
    command = next(
        command
        for command in ctx.shared.tracked_commands
        if command.name == "external:tests:slow_command"
    )
    assert command.time == 3_000_000


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

    totals = _totals(ctx, "cache_data")
    assert totals.overhead_time == pytest.approx(0.0)
    write = next(
        command
        for command in ctx.shared.tracked_commands
        if command.name == "_cache_data_object"
    )
    assert write.time == 750_000


def test_commands_left_out_of_the_profile_stay_in_compute_time(
    ctx: ScriptRunContext, clock: FakeClock, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Commands past the per-command limit aren't subtracted from user code, so
    their time stays in the cached call's compute time.
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
    assert _totals(ctx, "cache_data").compute_time == pytest.approx(1.0)


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

    data = _totals(ctx, "cache_data")
    assert (data.calls, data.misses) == (1, 1)
    assert data.compute_time == pytest.approx(1.5)
    assert _totals(ctx, "cache_resource").calls == 0


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

    totals = _totals(ctx, "cache_data")
    assert (totals.calls, totals.hits, totals.misses) == (20, 16, 4)
    # The main thread and each of the four workers keep their own totals.
    assert len(ctx.shared.cache_stats._threads) == 5


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

    assert _totals(ctx, "cache_data").calls == 0
    assert ctx.shared.cache_stats._threads == []


def test_nothing_is_recorded_without_usage_stats(ctx: ScriptRunContext) -> None:
    """Respect browser.gatherUsageStats by not recording when it's off."""
    ctx.gather_usage_stats = False

    @st.cache_data(show_spinner=False)
    def load() -> int:
        return 1

    load()

    assert ctx.shared.cache_stats._threads == []


def test_failed_call_counts_as_call_only(ctx: ScriptRunContext) -> None:
    """A call that fails before a value is read or computed is neither a hit nor
    a miss.
    """

    @st.cache_data(show_spinner=False)
    def load(_x: object, y: object) -> int:
        return 1

    with pytest.raises(st.errors.StreamlitAPIException):
        load(None, threading.Lock())

    totals = _totals(ctx, "cache_data")
    assert (totals.calls, totals.hits, totals.misses) == (1, 0, 0)


def test_failed_compute_counts_as_miss(ctx: ScriptRunContext, clock: FakeClock) -> None:
    """A cached function that raises still counts as a miss with compute time."""

    @st.cache_data(show_spinner=False)
    def load() -> int:
        clock.advance(1.0)
        raise ValueError("boom")

    with pytest.raises(ValueError, match="boom"):
        load()

    totals = _totals(ctx, "cache_data")
    assert (totals.calls, totals.misses) == (1, 1)
    assert totals.compute_time == pytest.approx(1.0)


def test_new_run_starts_from_zero(ctx: ScriptRunContext) -> None:
    """Totals are per run."""

    @st.cache_data(show_spinner=False)
    def load() -> int:
        return 1

    load()
    ctx.shared.reset()
    load()

    totals = _totals(ctx, "cache_data")
    assert (totals.calls, totals.hits, totals.misses) == (1, 1, 0)
