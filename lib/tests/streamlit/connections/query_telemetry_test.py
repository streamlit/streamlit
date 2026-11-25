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

"""Tests for the per-run query totals recorded by the query hooks."""

from __future__ import annotations

import asyncio
import contextvars
import sys
import threading
import time
import timeit
import types
import weakref
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, patch

import pytest

import streamlit as st
from streamlit.connections import SnowflakeConnection, query_telemetry
from streamlit.runtime import Runtime, metrics_util
from streamlit.runtime.caching import cache_background_refresh, cache_metrics
from streamlit.runtime.caching.cache_metrics import CacheMetrics
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)
from streamlit.runtime.parallel_coordinator import ParallelFragmentCoordinator
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.scriptrunner_utils.cache_run_stats import RunCacheTotals
from streamlit.runtime.scriptrunner_utils.query_run_stats import (
    QueryTotals,
    ThreadQueryStats,
)
from streamlit.runtime.scriptrunner_utils.script_run_context_attr import (
    SCRIPT_RUN_CONTEXT_ATTR_NAME,
)
from tests.testutil import create_mock_script_run_ctx, patch_config_options

if TYPE_CHECKING:
    from collections.abc import Iterator

    from streamlit.runtime.scriptrunner import ScriptRunContext
    from streamlit.runtime.scriptrunner_utils.query_run_stats import (
        QuerySource,
    )
    from streamlit.runtime.scriptrunner_utils.run_stats import RunStats


class FakeClock:
    """A perf_counter replacement that only moves when advanced."""

    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


class FakeSnowflakeError(Exception):
    """Stands in for a Snowflake connector error."""


class FakeSnowflakeCursor:
    """Stands in for a Snowflake connector cursor. Each query takes 0.5 s on
    ``clock``.
    """

    def __init__(self, clock: FakeClock, error: Exception | None) -> None:
        self.clock = clock
        self.error = error
        self.executed = 0

    def execute(self, command: str, params: Any = None, **kwargs: Any) -> Any:
        self.clock.advance(0.5)
        self.executed += 1
        if self.error is not None:
            raise self.error
        return self

    def fetch_pandas_all(self) -> str:
        return "a dataframe"


class FakeSnowflakeConnection:
    """Stands in for a Snowflake connector connection."""

    def __init__(self, clock: FakeClock) -> None:
        self.clock = clock
        self.error: Exception | None = None
        self.cursors: list[FakeSnowflakeCursor] = []

    def cursor(self) -> FakeSnowflakeCursor:
        cursor = FakeSnowflakeCursor(self.clock, self.error)
        self.cursors.append(cursor)
        return cursor


@dataclass
class FakeQueryRecord:
    is_describe: bool = False


class FakeQueryListener:
    """Stands in for ``snowflake.snowpark.query_history.QueryListener``."""


class FakeServerConnection:
    """Stands in for a Snowpark session's internal connection, and notifies its
    listeners the way Snowpark does.
    """

    def __init__(self) -> None:
        self.listeners: list[Any] = []
        self._thread_safe_session_enabled = True

    def add_query_listener(self, listener: Any) -> None:
        self.listeners.append(listener)

    def run(self, record: FakeQueryRecord, *, failed: bool = False) -> None:
        for listener in self.listeners:
            if record.is_describe and not listener.include_describe:
                continue
            if failed and not listener.include_error:
                continue
            kwargs = {"exception": FakeSnowflakeError()} if failed else {}
            listener._notify(record, **kwargs)


class FakeSnowparkSession:
    def __init__(self) -> None:
        self._conn = FakeServerConnection()


@pytest.fixture
def ctx(monkeypatch: pytest.MonkeyPatch) -> Iterator[ScriptRunContext]:
    """Attach a script run context that gathers usage stats, with empty caches."""
    run_ctx = create_mock_script_run_ctx()
    run_ctx.gather_usage_stats = True
    monkeypatch.setattr(
        threading.current_thread(), SCRIPT_RUN_CONTEXT_ATTR_NAME, run_ctx, raising=False
    )
    mock_runtime = MagicMock(spec=Runtime)
    mock_runtime.cache_storage_manager = MemoryCacheStorageManager()
    monkeypatch.setattr(Runtime, "_instance", mock_runtime)
    monkeypatch.setattr(cache_metrics, "_cache_metrics", CacheMetrics())
    st.cache_data.clear()
    with patch_config_options({"browser.gatherUsageStats": True}):
        yield run_ctx
    st.cache_data.clear()
    cache_background_refresh.reset()


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> FakeClock:
    """Drive query, cache and command timing from one fake clock."""
    fake = FakeClock()
    monkeypatch.setattr(time, "perf_counter", fake)
    monkeypatch.setattr(timeit, "default_timer", fake)
    return fake


@pytest.fixture
def snowflake_connection(clock: FakeClock) -> SnowflakeConnection:
    """Return a ``SnowflakeConnection`` on a fake connector connection."""
    with patch.object(SnowflakeConnection, "_connect", return_value=None):
        conn = SnowflakeConnection("my_snowflake_connection")
    conn._raw_instance = FakeSnowflakeConnection(clock)
    return conn


@pytest.fixture
def snowpark(monkeypatch: pytest.MonkeyPatch) -> Iterator[types.ModuleType]:
    """Install a fake ``snowflake.snowpark`` with a query listener interface,
    and return its ``context`` module.
    """
    snowflake_mod = sys.modules.get("snowflake") or types.ModuleType("snowflake")
    snowpark_mod = types.ModuleType("snowflake.snowpark")
    history_mod = types.ModuleType("snowflake.snowpark.query_history")
    history_mod.QueryListener = FakeQueryListener  # type: ignore[attr-defined]
    context_mod = types.ModuleType("snowflake.snowpark.context")
    context_mod.get_active_session = MagicMock(  # type: ignore[attr-defined]
        side_effect=RuntimeError("No default Session is found.")
    )
    monkeypatch.setitem(sys.modules, "snowflake", snowflake_mod)
    monkeypatch.setitem(sys.modules, "snowflake.snowpark", snowpark_mod)
    monkeypatch.setitem(sys.modules, "snowflake.snowpark.query_history", history_mod)
    monkeypatch.setitem(sys.modules, "snowflake.snowpark.context", context_mod)
    monkeypatch.setattr(
        query_telemetry,
        "_watched_snowpark_connections",
        weakref.WeakSet(),
    )
    query_telemetry._snowpark_query_listener.cache_clear()
    yield context_mod
    query_telemetry._snowpark_query_listener.cache_clear()


def _run_totals(run_stats: RunStats, source: QuerySource) -> QueryTotals:
    return ThreadQueryStats.combine(
        stats.query for stats in run_stats.all_thread_stats()
    ).totals_for(source)


def _totals(ctx: ScriptRunContext, source: QuerySource) -> QueryTotals:
    return _run_totals(ctx.shared.stats, source)


def _all_queries(ctx: ScriptRunContext) -> QueryTotals:
    return ThreadQueryStats.combine(
        stats.query for stats in ctx.shared.stats.all_thread_stats()
    ).all_sources()


def _counts(totals: QueryTotals) -> tuple[int, int, int]:
    return (totals.queries, totals.failed, totals.describe_queries)


def _overlap_counts(totals: QueryTotals) -> tuple[int, int]:
    return (totals.queries_in_cache, totals.queries_in_commands)


def _timed_query(clock: FakeClock, seconds: float = 0.5) -> None:
    """Run one Snowflake connector query that takes ``seconds``."""
    with query_telemetry.record_query("snowflake_connector"):
        clock.advance(seconds)


# Timing a query


def test_record_query_records_count_and_time(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A recorded block adds one query with its time."""
    _timed_query(clock)

    totals = _totals(ctx, "snowflake_connector")
    assert _counts(totals) == (1, 0, 0)
    assert totals.time == pytest.approx(0.5)
    assert totals.time_in_cache == totals.time_in_commands == 0


def test_record_query_records_failed_query_and_reraises(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A block that raises counts as a failed query and raises the original
    error.
    """
    error = FakeSnowflakeError()

    with (
        pytest.raises(FakeSnowflakeError) as raised,
        query_telemetry.record_query("snowflake_connector"),
    ):
        clock.advance(0.5)
        raise error

    assert raised.value is error
    totals = _totals(ctx, "snowflake_connector")
    assert _counts(totals) == (1, 1, 0)
    assert totals.time == pytest.approx(0.5)


def test_instrumentation_failure_never_affects_the_query(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """Errors while recording are swallowed, the block still runs, and the
    block's own error still propagates unchanged.
    """
    ran: list[str] = []
    with patch.object(
        query_telemetry, "start_query", side_effect=RuntimeError("telemetry broke")
    ):
        with query_telemetry.record_query("snowflake_connector"):
            ran.append("start failed")
    with patch.object(
        query_telemetry.QueryTimer, "finish", side_effect=RuntimeError("broke")
    ):
        with query_telemetry.record_query("snowflake_connector"):
            ran.append("finish failed")
        with (
            pytest.raises(FakeSnowflakeError),
            query_telemetry.record_query("snowflake_connector"),
        ):
            raise FakeSnowflakeError

    assert ran == ["start failed", "finish failed"]
    assert _totals(ctx, "snowflake_connector").queries == 0


# Snowflake connector


def test_connection_query_records_its_query_inside_the_cache(
    ctx: ScriptRunContext, snowflake_connection: SnowflakeConnection
) -> None:
    """``SnowflakeConnection.query()`` records its query on a miss, inside the
    cache's compute time, and a hit runs no query.
    """
    assert snowflake_connection.query("SELECT 1", show_spinner=False) == "a dataframe"
    assert snowflake_connection.query("SELECT 1", show_spinner=False) == "a dataframe"

    totals = _totals(ctx, "snowflake_connector")
    assert _counts(totals) == (1, 0, 0)
    assert _overlap_counts(totals) == (1, 0)
    assert totals.time == totals.time_in_cache == pytest.approx(0.5)
    cache_data = RunCacheTotals.combine(
        (stats.cache for stats in ctx.shared.stats.all_thread_stats()),
        time.perf_counter(),
    ).cache_data
    assert (cache_data.hits, cache_data.misses) == (1, 1)
    assert cache_data.compute_time == pytest.approx(0.5)


def test_connection_query_failure_is_recorded_and_raised(
    ctx: ScriptRunContext, snowflake_connection: SnowflakeConnection
) -> None:
    """A query that fails in ``SnowflakeConnection.query()`` counts as failed,
    and its error reaches the app.
    """
    error = FakeSnowflakeError()
    snowflake_connection._raw_instance.error = error  # type: ignore[attr-defined]

    with pytest.raises(FakeSnowflakeError) as raised:
        snowflake_connection.query("SELECT broken", show_spinner=False)

    assert raised.value is error
    assert _counts(_totals(ctx, "snowflake_connector")) == (1, 1, 0)


def test_connection_cursor_is_unchanged_and_not_recorded(
    ctx: ScriptRunContext, snowflake_connection: SnowflakeConnection
) -> None:
    """``SnowflakeConnection.cursor()`` returns the connector's own cursor, and
    the app's queries on it aren't recorded.
    """
    cursor = snowflake_connection.cursor()
    cursor.execute("INSERT INTO t VALUES (1)")

    assert type(cursor) is FakeSnowflakeCursor
    assert cursor.executed == 1
    assert _all_queries(ctx) == QueryTotals()


# Attribution to cached functions, commands, threads and runs


def test_query_in_hash_funcs_counts_in_time_in_cache(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A query from a hash_funcs function is in the cached call's overhead time,
    on a miss and on a hit.
    """

    class Key:
        pass

    def hash_key(_key: Key) -> str:
        _timed_query(clock)
        return "key"

    @st.cache_data(show_spinner=False, hash_funcs={Key: hash_key})
    def load(key: Key) -> str:
        return "rows"

    load(Key())
    load(Key())

    totals = _totals(ctx, "snowflake_connector")
    assert totals.queries == 2
    assert _overlap_counts(totals) == (2, 0)
    assert totals.time_in_cache == totals.time == pytest.approx(1.0)


def test_other_tasks_query_while_an_async_cached_call_awaits_counts_in_cache(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """Another task's query while an async cached call awaits is in that call's
    time, and a query after the call finishes isn't.
    """
    events: dict[str, asyncio.Event] = {}

    @st.cache_data(show_spinner=False)
    async def load() -> str:
        events["started"].set()
        await events["queried"].wait()
        return "rows"

    async def query_meanwhile() -> None:
        await events["started"].wait()
        _timed_query(clock)
        events["queried"].set()

    async def main() -> None:
        events["started"] = asyncio.Event()
        events["queried"] = asyncio.Event()
        await asyncio.gather(load(), query_meanwhile())
        _timed_query(clock)

    asyncio.run(main())

    totals = _totals(ctx, "snowflake_connector")
    assert totals.queries == 2
    assert _overlap_counts(totals) == (1, 0)
    assert totals.time_in_cache == pytest.approx(0.5)


def test_queries_on_a_thread_a_cached_function_attaches_are_its_own(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A thread a cached function attaches records its queries as its own,
    outside the cache's compute time, like its cached calls and commands.
    """

    @st.cache_data(show_spinner=False)
    def load() -> str:
        thread = add_script_run_ctx(
            threading.Thread(target=_timed_query, args=(clock,)), ctx
        )
        thread.start()
        thread.join(5)
        return "rows"

    load()

    totals = _totals(ctx, "snowflake_connector")
    assert totals.queries == 1
    assert _overlap_counts(totals) == (0, 0)
    assert totals.time_in_cache == 0


def test_query_in_listed_command_counts_in_time_in_commands(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A query inside a listed command is in that command's time, even inside a
    cached function.
    """

    @st.cache_data(show_spinner=False)
    def load() -> str:
        _timed_query(clock)
        return "rows"

    @metrics_util.gather_metrics("show_rows")
    def show_rows() -> str:
        return load()

    show_rows()

    totals = _totals(ctx, "snowflake_connector")
    assert totals.queries == 1
    assert _overlap_counts(totals) == (0, 1)
    assert totals.time_in_commands == totals.time == pytest.approx(0.5)
    assert totals.time_in_cache == 0


def test_parallel_fragment_queries_go_to_the_fragment_run(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A parallel fragment's queries on its worker thread count toward its own
    run as well as the run totals, with the same attribution.
    """

    @st.cache_data(show_spinner=False)
    def load() -> str:
        _timed_query(clock)
        return "rows"

    _timed_query(clock)
    with ctx.shared.parallel_fragments.recording_run() as run:
        load()
        _timed_query(clock)

    fragment = run.stats.query.snowflake_connector
    assert (fragment.queries, fragment.queries_in_cache) == (2, 1)
    assert fragment.time == pytest.approx(1.0)
    assert fragment.time_in_cache == pytest.approx(0.5)
    assert _totals(ctx, "snowflake_connector").queries == 3


def test_parallel_worker_queries_are_added_to_the_run(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """Queries from parallel fragment workers count toward the run, per thread."""
    _timed_query(clock)

    coordinator = ParallelFragmentCoordinator(yield_check=lambda: None, max_workers=4)
    barrier = threading.Barrier(4)

    def worker() -> None:
        barrier.wait(5)
        _timed_query(clock)
        _timed_query(clock)

    for _ in range(4):
        coordinator.submit(worker, ctx)
    coordinator.join()

    assert _totals(ctx, "snowflake_connector").queries == 9
    assert len(ctx.shared.stats.all_thread_stats()) == 5


def test_queries_without_a_script_run_are_not_recorded(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """Threads without a ScriptRunContext run the query but record nothing."""
    ran: list[bool] = []

    def query() -> None:
        with query_telemetry.record_query("snowflake_connector"):
            ran.append(True)

    thread = threading.Thread(target=query)
    thread.start()
    thread.join(5)

    assert ran == [True]
    assert _all_queries(ctx) == QueryTotals()


def test_query_without_thread_state_is_recorded_outside_commands(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A thread with a ScriptRunContext but no ThreadState still records the
    query, as not inside a command.
    """
    contextvars.Context().run(_timed_query, clock)

    totals = _totals(ctx, "snowflake_connector")
    assert totals.queries == 1
    assert totals.time_in_commands == 0


def test_nothing_is_recorded_without_usage_stats(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A run that doesn't gather usage stats records nothing."""
    ctx.gather_usage_stats = False

    _timed_query(clock)
    query_telemetry.record_untimed_query("snowpark")

    assert _all_queries(ctx) == QueryTotals()


def test_previous_and_new_run_record_queries_into_their_own_totals_at_the_same_time(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A query left running from the previous run keeps adding to that run's
    totals while the new run's queries add to the new run's.
    """
    started = threading.Event()
    release = threading.Event()

    def query_in_previous_run() -> None:
        with query_telemetry.record_query("snowflake_connector"):
            started.set()
            release.wait(5)

    previous_stats = ctx.shared.stats
    thread = add_script_run_ctx(threading.Thread(target=query_in_previous_run), ctx)
    thread.start()
    assert started.wait(5)
    ctx.shared.reset()
    _timed_query(clock)
    clock.advance(1.0)
    release.set()
    thread.join(5)
    assert not thread.is_alive()

    previous = _run_totals(previous_stats, "snowflake_connector")
    assert previous.queries == 1
    assert previous.time == pytest.approx(1.5)
    new = _totals(ctx, "snowflake_connector")
    assert new.queries == 1
    assert new.time == pytest.approx(0.5)


# SQLAlchemy


def _sqlalchemy_execute(
    clock: FakeClock, *, cursor: Any = None, error: Exception | None = None
) -> Any:
    """Fire the SQLAlchemy events around one cursor execute."""
    context = types.SimpleNamespace()
    cursor = cursor if cursor is not None else object()
    query_telemetry._before_cursor_execute(None, cursor, "SELECT 1", {}, context, False)
    clock.advance(0.25)
    if error is None:
        query_telemetry._after_cursor_execute(
            None, cursor, "SELECT 1", {}, context, False
        )
    else:
        query_telemetry._handle_sqlalchemy_error(
            types.SimpleNamespace(
                execution_context=context, original_exception=error, cursor=cursor
            )
        )
    return context


def test_sqlalchemy_events_record_query_time(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A SQLAlchemy cursor execute adds its count and time."""
    _sqlalchemy_execute(clock)

    totals = _totals(ctx, "sqlalchemy")
    assert _counts(totals) == (1, 0, 0)
    assert totals.time == pytest.approx(0.25)


def test_sqlalchemy_error_records_failed_query(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A query that raises counts as failed, once."""
    context = _sqlalchemy_execute(clock, error=FakeSnowflakeError())
    # A later after_cursor_execute for the same context records nothing more.
    query_telemetry._after_cursor_execute(None, object(), "", {}, context, False)

    totals = _totals(ctx, "sqlalchemy")
    assert _counts(totals) == (1, 1, 0)


def test_sqlalchemy_events_without_context_record_nothing(
    ctx: ScriptRunContext,
) -> None:
    """SQLAlchemy events with no execution context record nothing and don't raise."""
    query_telemetry._before_cursor_execute(None, object(), "", {}, None, False)
    query_telemetry._after_cursor_execute(None, object(), "", {}, None, False)
    query_telemetry._handle_sqlalchemy_error(
        types.SimpleNamespace(execution_context=None, original_exception=None)
    )

    assert _all_queries(ctx) == QueryTotals()


@pytest.fixture
def fake_sqlalchemy(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """Install a fake ``sqlalchemy`` and return its ``event`` module."""
    event_mod = MagicMock(name="sqlalchemy.event")
    sqlalchemy_mod = types.ModuleType("sqlalchemy")
    sqlalchemy_mod.event = event_mod  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "sqlalchemy", sqlalchemy_mod)
    monkeypatch.setitem(sys.modules, "sqlalchemy.event", event_mod)
    return event_mod


def test_sqlalchemy_hooks_are_installed_on_the_given_engine(
    ctx: ScriptRunContext, fake_sqlalchemy: MagicMock
) -> None:
    """The execute and error events are registered on the given engine only."""
    engine = object()

    query_telemetry.install_sqlalchemy_hooks(engine)  # type: ignore[arg-type]

    assert [call.args[:2] for call in fake_sqlalchemy.listen.call_args_list] == [
        (engine, "before_cursor_execute"),
        (engine, "after_cursor_execute"),
        (engine, "handle_error"),
    ]


def test_sqlalchemy_hooks_are_not_installed_without_usage_stats(
    ctx: ScriptRunContext, fake_sqlalchemy: MagicMock
) -> None:
    """No SQLAlchemy events are registered when usage stats are off."""
    with patch_config_options({"browser.gatherUsageStats": False}):
        query_telemetry.install_sqlalchemy_hooks(object())  # type: ignore[arg-type]

    fake_sqlalchemy.listen.assert_not_called()


def test_sqlalchemy_hook_install_failure_is_swallowed(
    ctx: ScriptRunContext, fake_sqlalchemy: MagicMock
) -> None:
    """A failure registering SQLAlchemy events doesn't raise."""
    fake_sqlalchemy.listen.side_effect = RuntimeError("no events")

    query_telemetry.install_sqlalchemy_hooks(object())  # type: ignore[arg-type]


# Snowpark


def test_snowpark_session_queries_are_counted_without_time(
    ctx: ScriptRunContext, snowpark: types.ModuleType
) -> None:
    """A watched session's queries add counts, but no time."""
    session = FakeSnowparkSession()
    query_telemetry.watch_snowpark_session(session)  # type: ignore[arg-type]
    query_telemetry.watch_snowpark_session(session)  # type: ignore[arg-type]

    session._conn.run(FakeQueryRecord())
    session._conn.run(FakeQueryRecord(is_describe=True))
    session._conn.run(FakeQueryRecord(), failed=True)

    assert len(session._conn.listeners) == 1
    totals = _totals(ctx, "snowpark")
    assert _counts(totals) == (3, 1, 1)
    assert totals.time == 0


def test_snowpark_queries_in_cached_functions_and_commands_are_counted_there(
    ctx: ScriptRunContext, snowpark: types.ModuleType
) -> None:
    """Snowpark queries are attributed like timed ones, without times."""
    session = FakeSnowparkSession()
    query_telemetry.watch_snowpark_session(session)  # type: ignore[arg-type]

    @st.cache_data(show_spinner=False)
    def load() -> str:
        session._conn.run(FakeQueryRecord())
        return "rows"

    @metrics_util.gather_metrics("show_rows")
    def show_rows() -> None:
        session._conn.run(FakeQueryRecord())

    load()
    show_rows()
    session._conn.run(FakeQueryRecord())

    totals = _totals(ctx, "snowpark")
    assert totals.queries == 3
    assert _overlap_counts(totals) == (1, 1)
    assert totals.time == totals.time_in_cache == totals.time_in_commands == 0


def test_snowpark_listener_errors_never_reach_snowpark(
    ctx: ScriptRunContext, snowpark: types.ModuleType
) -> None:
    """Neither a recording error nor arguments from a different Snowpark
    version raise into Snowpark.
    """
    session = FakeSnowparkSession()
    query_telemetry.watch_snowpark_session(session)  # type: ignore[arg-type]
    (listener,) = session._conn.listeners

    with patch.object(
        query_telemetry, "record_untimed_query", side_effect=RuntimeError("broke")
    ):
        session._conn.run(FakeQueryRecord())

    listener._notify()
    listener._notify(FakeQueryRecord(is_describe=True), "extra", new_option=1)

    assert _counts(_totals(ctx, "snowpark")) == (2, 0, 1)


def test_old_snowpark_is_not_watched(
    ctx: ScriptRunContext, snowpark: types.ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Snowpark before 1.26 has no QueryListener, so sessions aren't watched."""
    monkeypatch.delattr(
        sys.modules["snowflake.snowpark.query_history"], "QueryListener"
    )
    session = FakeSnowparkSession()

    query_telemetry.watch_snowpark_session(session)  # type: ignore[arg-type]

    assert session._conn.listeners == []


def test_snowpark_session_is_not_watched_without_usage_stats(
    ctx: ScriptRunContext, snowpark: types.ModuleType
) -> None:
    """No listener is added to a Snowpark session when usage stats are off."""
    session = FakeSnowparkSession()
    with patch_config_options({"browser.gatherUsageStats": False}):
        query_telemetry.watch_snowpark_session(session)  # type: ignore[arg-type]

    assert session._conn.listeners == []


@pytest.mark.parametrize("thread_safe", [False, "missing"])
def test_snowpark_session_is_not_watched_without_thread_safe_sessions(
    ctx: ScriptRunContext, snowpark: types.ModuleType, thread_safe: bool | str
) -> None:
    """Without thread-safe sessions, adding a listener could break a query
    another thread is running, so the session isn't watched.
    """
    session = FakeSnowparkSession()
    if thread_safe == "missing":
        del session._conn._thread_safe_session_enabled
    else:
        session._conn._thread_safe_session_enabled = thread_safe

    query_telemetry.watch_snowpark_session(session)  # type: ignore[arg-type]

    assert session._conn.listeners == []


def test_run_start_watches_the_active_snowpark_session(
    ctx: ScriptRunContext, snowpark: types.ModuleType
) -> None:
    """The active session is watched at run start, and having none is fine."""
    query_telemetry.install_hooks_for_run()

    session = FakeSnowparkSession()
    snowpark.get_active_session.side_effect = None  # type: ignore[attr-defined]
    snowpark.get_active_session.return_value = session  # type: ignore[attr-defined]
    query_telemetry.install_hooks_for_run()
    query_telemetry.install_hooks_for_run()

    assert len(session._conn.listeners) == 1


def test_run_start_skips_snowpark_if_the_app_hasnt_imported_it(
    ctx: ScriptRunContext, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Run start doesn't import Snowpark for an app that doesn't use it."""
    monkeypatch.delitem(sys.modules, "snowflake.snowpark", raising=False)
    watch_active_session = MagicMock()
    monkeypatch.setattr(
        query_telemetry, "_watch_active_snowpark_session", watch_active_session
    )

    query_telemetry.install_hooks_for_run()

    watch_active_session.assert_not_called()


def test_snowpark_watch_failure_is_swallowed(
    ctx: ScriptRunContext, snowpark: types.ModuleType
) -> None:
    """A session the listener can't be added to is returned to the app as is."""
    query_telemetry.watch_snowpark_session(object())  # type: ignore[arg-type]


def test_connection_session_is_watched(
    ctx: ScriptRunContext, snowpark: types.ModuleType
) -> None:
    """Sessions from ``SnowflakeConnection.session()`` are watched."""
    session = FakeSnowparkSession()
    session_mod = types.ModuleType("snowflake.snowpark.session")
    session_mod.Session = MagicMock()  # type: ignore[attr-defined]
    session_mod.Session.builder.configs.return_value.create.return_value = session  # type: ignore[attr-defined]
    with (
        patch.dict(sys.modules, {"snowflake.snowpark.session": session_mod}),
        patch.object(SnowflakeConnection, "_connect", return_value=MagicMock()),
        patch(
            "streamlit.connections.snowflake_connection.running_in_sis",
            return_value=False,
        ),
    ):
        conn = SnowflakeConnection("my_snowflake_connection")
        assert conn.session() is session

    assert len(session._conn.listeners) == 1


# Integration tests against the real libraries


@pytest.mark.require_integration
def test_real_snowpark_notifies_the_listener(
    ctx: ScriptRunContext, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Snowpark's execute path notifies the listener of finished and failed
    queries.
    """
    from snowflake.connector.errors import ProgrammingError
    from snowflake.snowpark._internal.server_connection import ServerConnection

    monkeypatch.setattr(
        query_telemetry, "_watched_snowpark_connections", weakref.WeakSet()
    )
    query_telemetry._snowpark_query_listener.cache_clear()
    server_connection = ServerConnection.__new__(ServerConnection)
    server_connection._thread_safe_session_enabled = True
    server_connection._lock = threading.RLock()
    server_connection._query_listeners = set()
    results_cursor = MagicMock()
    # Snowpark keeps one connector cursor per thread.
    server_connection._thread_store = threading.local()
    server_connection._thread_store.cursor = MagicMock()
    server_connection._thread_store.cursor.execute.return_value = results_cursor

    query_telemetry.watch_snowpark_session(
        types.SimpleNamespace(_conn=server_connection)  # type: ignore[arg-type]
    )
    server_connection.execute_and_notify_query_listener("SELECT 1")
    server_connection._thread_store.cursor.execute.side_effect = ProgrammingError(
        "bad query"
    )
    with pytest.raises(ProgrammingError):
        server_connection.execute_and_notify_query_listener("SELECT x")

    assert _counts(_totals(ctx, "snowpark")) == (2, 1, 0)
    query_telemetry._snowpark_query_listener.cache_clear()


@pytest.mark.require_integration
@pytest.mark.parametrize("thread_safe", [True, False, None])
def test_real_snowpark_is_watched_only_with_thread_safe_sessions(
    ctx: ScriptRunContext, monkeypatch: pytest.MonkeyPatch, thread_safe: bool | None
) -> None:
    """A real Snowpark connection gets the listener only when the session
    parameter turns thread-safe sessions on, which Snowpark defaults to off.
    """
    from snowflake.snowpark._internal.server_connection import ServerConnection

    monkeypatch.setattr(
        query_telemetry, "_watched_snowpark_connections", weakref.WeakSet()
    )
    connector_connection = MagicMock()
    connector_connection.is_closed.return_value = False
    connector_connection._session_parameters = (
        {}
        if thread_safe is None
        else {"PYTHON_SNOWPARK_ENABLE_THREAD_SAFE_SESSION": thread_safe}
    )
    server_connection = ServerConnection({}, connector_connection)

    query_telemetry.watch_snowpark_session(
        types.SimpleNamespace(_conn=server_connection)  # type: ignore[arg-type]
    )

    assert bool(server_connection._query_listeners) is (thread_safe is True)


@pytest.mark.require_integration
def test_real_sql_connection_records_query_and_session(ctx: ScriptRunContext) -> None:
    """SQLConnection.query() records its query on a miss, inside the cache's
    compute time, and its session's queries are recorded too.
    """
    import sqlalchemy

    from streamlit.connections import SQLConnection

    conn = SQLConnection("sql", url="sqlite://")
    conn.query("SELECT 1 AS a", show_spinner=False)
    conn.query("SELECT 1 AS a", show_spinner=False)
    with conn.session as session:
        session.execute(sqlalchemy.text("SELECT 2"))
    conn.engine.dispose()

    totals = _totals(ctx, "sqlalchemy")
    # Only the session's query runs outside the cache.
    assert totals.queries_in_cache >= 1
    assert totals.queries - totals.queries_in_cache == 1
    assert 0 < totals.time_in_cache < totals.time


@pytest.mark.require_integration
def test_real_sqlalchemy_records_only_sql_connection_engines(
    ctx: ScriptRunContext,
) -> None:
    """Queries on an autocommit SQLConnection are recorded, including failed
    ones, and queries on an engine the app creates itself aren't.
    """
    import sqlalchemy

    from streamlit.connections import SQLConnection

    app_engine = sqlalchemy.create_engine("sqlite://")
    with app_engine.connect() as connection:
        connection.execute(sqlalchemy.text("SELECT 1"))
    app_engine.dispose()
    conn = SQLConnection("sql", url="sqlite://", autocommit=True)
    with conn.engine.connect() as connection:
        connection.execute(sqlalchemy.text("SELECT 1"))
        with pytest.raises(sqlalchemy.exc.OperationalError):
            connection.execute(sqlalchemy.text("SELECT * FROM missing_table"))
    conn.engine.dispose()

    totals = _totals(ctx, "sqlalchemy")
    assert (totals.queries, totals.failed) == (2, 1)
    assert totals.time > 0
