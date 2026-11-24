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
    """Stands in for a Snowflake connector error, which carries a query ID."""

    def __init__(self, sfqid: str | None) -> None:
        super().__init__("query failed")
        self.sfqid = sfqid


class FakeSnowflakeConnection:
    """Stands in for a Snowflake connector connection. Each query takes
    ``query_seconds`` on ``clock`` and gets the next query ID.
    """

    def __init__(self, clock: FakeClock) -> None:
        self.clock = clock
        self.query_seconds = 0.5
        self.error: Exception | None = None
        self._next_id = 0

    def next_query_id(self) -> str:
        self._next_id += 1
        return f"01b2-query-{self._next_id}"

    def cursor(self, cursor_class: type[Any] | None = None) -> Any:
        return (cursor_class or FakeSnowflakeCursor)(self)


class FakeSnowflakeCursor:
    """Stands in for ``snowflake.connector.cursor.SnowflakeCursor``, whose
    ``executemany``, ``execute_async`` and ``describe`` call ``execute``.
    """

    def __init__(self, connection: FakeSnowflakeConnection) -> None:
        self.connection = connection
        self.sfqid: str | None = None

    def execute(self, command: str, params: Any = None, **kwargs: Any) -> Any:
        if command == "CALL nested":
            # A query that runs another statement through execute.
            self.execute("SELECT inner")
        conn = self.connection
        conn.clock.advance(conn.query_seconds)
        if conn.error is not None:
            raise conn.error
        self.sfqid = conn.next_query_id()
        return self

    def executemany(self, command: str, seqparams: list[Any]) -> Any:
        for params in seqparams:
            self.execute(command, params)
        return self

    def execute_async(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        kwargs["_exec_async"] = True
        self.execute(*args, **kwargs)
        return {"queryId": self.sfqid}

    def describe(self, *args: Any, **kwargs: Any) -> list[Any]:
        kwargs["_describe_only"] = True
        self.execute(*args, **kwargs)
        return []

    def fetch_pandas_all(self) -> str:
        return "a dataframe"


class FakeQueryRecord:
    def __init__(self, query_id: str | None, is_describe: bool = False) -> None:
        self.query_id = query_id
        self.sql_text = "SELECT 1"
        self.is_describe = is_describe


class FakeQueryListener:
    """Stands in for ``snowflake.snowpark.query_history.QueryListener``."""


class FakeServerConnection:
    """Stands in for a Snowpark session's internal connection, and notifies its
    listeners the way Snowpark does.
    """

    def __init__(self) -> None:
        self.listeners: list[Any] = []

    def add_query_listener(self, listener: Any) -> None:
        self.listeners.append(listener)

    def run(self, record: FakeQueryRecord, *, failed: bool = False) -> None:
        for listener in self.listeners:
            if record.is_describe and not listener.include_describe:
                continue
            if failed and not listener.include_error:
                continue
            kwargs = (
                {"exception": FakeSnowflakeError(record.query_id)} if failed else {}
            )
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
def snowflake_connection(
    monkeypatch: pytest.MonkeyPatch, clock: FakeClock
) -> Iterator[FakeSnowflakeConnection]:
    """Install a fake ``snowflake.connector`` and return a connection on it."""
    snowflake_mod = types.ModuleType("snowflake")
    connector_mod = types.ModuleType("snowflake.connector")
    cursor_mod = types.ModuleType("snowflake.connector.cursor")
    cursor_mod.SnowflakeCursor = FakeSnowflakeCursor  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "snowflake", snowflake_mod)
    monkeypatch.setitem(sys.modules, "snowflake.connector", connector_mod)
    monkeypatch.setitem(sys.modules, "snowflake.connector.cursor", cursor_mod)
    query_telemetry._recording_cursor_class.cache_clear()
    yield FakeSnowflakeConnection(clock)
    query_telemetry._recording_cursor_class.cache_clear()


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
    ).combined()


def _counts(totals: QueryTotals) -> tuple[int, int, int, int]:
    return (
        totals.queries,
        totals.failed,
        totals.async_queries,
        totals.describe_queries,
    )


def _overlap_counts(totals: QueryTotals) -> tuple[int, int]:
    return (totals.queries_in_cache, totals.queries_in_commands)


# Snowflake connector cursors


def test_cursor_records_query_time(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """A query on a recording cursor adds its count and time."""
    cursor = query_telemetry.create_snowflake_cursor(snowflake_connection)

    assert isinstance(cursor, FakeSnowflakeCursor)
    assert type(cursor) is not FakeSnowflakeCursor
    assert cursor.execute("SELECT 1") is cursor

    totals = _totals(ctx, "snowflake_connector")
    assert _counts(totals) == (1, 0, 0, 0)
    assert totals.time == pytest.approx(0.5)
    assert totals.time_in_cache == totals.time_in_commands == 0


def test_cursor_records_failed_query_and_reraises(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """A failed query counts as failed and raises the original error."""
    error = FakeSnowflakeError("01b2-failed")
    snowflake_connection.error = error
    cursor = query_telemetry.create_snowflake_cursor(snowflake_connection)

    with pytest.raises(FakeSnowflakeError) as raised:
        cursor.execute("SELECT broken")

    assert raised.value is error
    totals = _totals(ctx, "snowflake_connector")
    assert _counts(totals) == (1, 1, 0, 0)
    assert totals.time == pytest.approx(0.5)


def test_cursor_records_async_describe_and_executemany(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """Async and describe queries are flagged, and each statement that
    executemany runs is a query.
    """
    cursor = query_telemetry.create_snowflake_cursor(snowflake_connection)

    cursor.execute_async("SELECT slow")
    cursor.describe("SELECT 1")
    cursor.executemany("INSERT INTO t VALUES (?)", [[1], [2]])

    assert _counts(_totals(ctx, "snowflake_connector")) == (4, 0, 1, 1)


def test_cursor_counts_a_nested_execute_once(
    ctx: ScriptRunContext,
    snowflake_connection: FakeSnowflakeConnection,
    clock: FakeClock,
) -> None:
    """An execute call from inside execute is part of the outer query."""
    cursor = query_telemetry.create_snowflake_cursor(snowflake_connection)

    cursor.execute("CALL nested")

    totals = _totals(ctx, "snowflake_connector")
    assert _counts(totals) == (1, 0, 0, 0)
    assert totals.time == pytest.approx(1.0)


def test_cursor_without_cursor_class_support_is_a_plain_cursor(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """A connection whose cursor() takes no cursor class still returns a cursor."""
    plain_cursor = FakeSnowflakeCursor(snowflake_connection)

    class ConnectionWithoutCursorClass:
        def cursor(self) -> FakeSnowflakeCursor:
            return plain_cursor

    connection = ConnectionWithoutCursorClass()

    assert query_telemetry.create_snowflake_cursor(connection) is plain_cursor  # type: ignore[arg-type]


def test_cursor_is_plain_without_usage_stats(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """No recording cursor is created when browser.gatherUsageStats is off."""
    with patch_config_options({"browser.gatherUsageStats": False}):
        cursor = query_telemetry.create_snowflake_cursor(snowflake_connection)

    assert type(cursor) is FakeSnowflakeCursor


def test_cursor_is_plain_without_the_connector(ctx: ScriptRunContext) -> None:
    """Without the Snowflake connector installed, the connection's own cursor is
    returned.
    """
    query_telemetry._recording_cursor_class.cache_clear()
    connection = MagicMock()
    with patch.dict(sys.modules, {"snowflake.connector.cursor": None}):
        cursor = query_telemetry.create_snowflake_cursor(connection)

    assert cursor is connection.cursor.return_value
    connection.cursor.assert_called_once_with()


def test_instrumentation_failure_never_affects_the_query(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """Errors while recording are swallowed, and the query's result is kept."""
    cursor = query_telemetry.create_snowflake_cursor(snowflake_connection)

    with patch.object(
        query_telemetry, "start_query", side_effect=RuntimeError("telemetry broke")
    ):
        assert cursor.execute("SELECT 1") is cursor
    with patch.object(
        query_telemetry.QueryTimer, "finish", side_effect=RuntimeError("broke")
    ):
        assert cursor.execute("SELECT 2") is cursor

    assert _totals(ctx, "snowflake_connector").queries == 0


def test_connection_query_and_cursor_record_queries(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """``SnowflakeConnection.query()`` records its query on a miss, inside the
    cache's compute time, and ``cursor()`` returns a recording cursor.
    """
    with patch.object(SnowflakeConnection, "_connect", return_value=None):
        conn = SnowflakeConnection("my_snowflake_connection")
    conn._raw_instance = snowflake_connection

    assert conn.query("SELECT 1", show_spinner=False) == "a dataframe"
    assert conn.query("SELECT 1", show_spinner=False) == "a dataframe"
    conn.cursor().execute("INSERT INTO t VALUES (1)")

    totals = _totals(ctx, "snowflake_connector")
    # The second query() call is a cache hit, so it runs no query.
    assert _counts(totals) == (2, 0, 0, 0)
    assert _overlap_counts(totals) == (1, 0)
    assert totals.time == pytest.approx(1.0)
    assert totals.time_in_cache == pytest.approx(0.5)
    cache_data = RunCacheTotals.combine(
        (stats.cache for stats in ctx.shared.stats.all_thread_stats()),
        time.perf_counter(),
    ).cache_data
    assert (cache_data.hits, cache_data.misses) == (1, 1)
    assert cache_data.compute_time == pytest.approx(0.5)


# Attribution to cached functions, commands, threads and runs


def test_query_in_cached_function_counts_in_time_in_cache(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """A query inside a cached function on a miss is in the cache's compute
    time, and a hit runs no query.
    """

    @st.cache_data(show_spinner=False)
    def load() -> str:
        cursor = query_telemetry.create_snowflake_cursor(snowflake_connection)
        cursor.execute("SELECT 1")
        return "rows"

    load()
    load()

    totals = _totals(ctx, "snowflake_connector")
    assert totals.queries == 1
    assert _overlap_counts(totals) == (1, 0)
    assert totals.time_in_cache == totals.time == pytest.approx(0.5)
    assert totals.time_in_commands == 0


def test_query_in_hash_funcs_counts_in_time_in_cache(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """A query from a hash_funcs function is in the cached call's overhead time,
    on a miss and on a hit.
    """
    cursor = query_telemetry.create_snowflake_cursor(snowflake_connection)

    class Key:
        pass

    def hash_key(_key: Key) -> str:
        cursor.execute("SELECT 1")
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
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """Another task's query while an async cached call awaits is in that call's
    time, and a query after the call finishes isn't.
    """
    cursor = query_telemetry.create_snowflake_cursor(snowflake_connection)
    events: dict[str, asyncio.Event] = {}

    @st.cache_data(show_spinner=False)
    async def load() -> str:
        events["started"].set()
        await events["queried"].wait()
        return "rows"

    async def query_meanwhile() -> None:
        await events["started"].wait()
        cursor.execute("SELECT 1")
        events["queried"].set()

    async def main() -> None:
        events["started"] = asyncio.Event()
        events["queried"] = asyncio.Event()
        await asyncio.gather(load(), query_meanwhile())
        cursor.execute("SELECT 2")

    asyncio.run(main())

    totals = _totals(ctx, "snowflake_connector")
    assert totals.queries == 2
    assert _overlap_counts(totals) == (1, 0)
    assert totals.time_in_cache == pytest.approx(0.5)


def test_queries_on_a_thread_a_cached_function_attaches_are_its_own(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """A thread a cached function attaches records its queries as its own,
    outside the cache's compute time, like its cached calls and commands.
    """
    cursor = query_telemetry.create_snowflake_cursor(snowflake_connection)

    @st.cache_data(show_spinner=False)
    def load() -> str:
        thread = add_script_run_ctx(
            threading.Thread(target=cursor.execute, args=("SELECT 1",)), ctx
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
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """A query inside a listed command is in that command's time, even inside a
    cached function.
    """

    @st.cache_data(show_spinner=False)
    def load() -> str:
        query_telemetry.create_snowflake_cursor(snowflake_connection).execute(
            "SELECT 1"
        )
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
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """A parallel fragment's queries on its worker thread count toward its own
    run as well as the run totals, with the same attribution.
    """
    cursor = query_telemetry.create_snowflake_cursor(snowflake_connection)

    @st.cache_data(show_spinner=False)
    def load() -> str:
        cursor.execute("SELECT 1")
        return "rows"

    cursor.execute("SELECT main")
    with ctx.shared.parallel_fragments.recording_run() as run:
        load()
        cursor.execute("SELECT 2")

    fragment = run.stats.query.snowflake_connector
    assert (fragment.queries, fragment.queries_in_cache) == (2, 1)
    assert fragment.time == pytest.approx(1.0)
    assert fragment.time_in_cache == pytest.approx(0.5)
    assert _totals(ctx, "snowflake_connector").queries == 3


def test_parallel_worker_queries_are_added_to_the_run(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """Queries from parallel fragment workers count toward the run, per thread."""
    query_telemetry.create_snowflake_cursor(snowflake_connection).execute("SELECT 1")

    coordinator = ParallelFragmentCoordinator(yield_check=lambda: None, max_workers=4)
    barrier = threading.Barrier(4)

    def worker() -> None:
        barrier.wait(5)
        connection = FakeSnowflakeConnection(FakeClock())
        cursor = query_telemetry.create_snowflake_cursor(connection)
        cursor.execute("SELECT 1")
        cursor.execute("SELECT 2")

    for _ in range(4):
        coordinator.submit(worker, ctx)
    coordinator.join()

    assert _totals(ctx, "snowflake_connector").queries == 9
    assert len(ctx.shared.stats.all_thread_stats()) == 5


def test_queries_without_a_script_run_are_not_recorded(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """Threads without a ScriptRunContext record nothing."""
    cursor = query_telemetry.create_snowflake_cursor(snowflake_connection)
    thread = threading.Thread(target=cursor.execute, args=("SELECT 1",))
    thread.start()
    thread.join(5)

    assert _all_queries(ctx) == QueryTotals()
    assert snowflake_connection._next_id == 1


def test_query_without_thread_state_is_recorded_outside_commands(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """A thread with a ScriptRunContext but no ThreadState still records the
    query, as not inside a command.
    """
    cursor = query_telemetry.create_snowflake_cursor(snowflake_connection)

    contextvars.Context().run(cursor.execute, "SELECT 1")

    totals = _totals(ctx, "snowflake_connector")
    assert totals.queries == 1
    assert totals.time_in_commands == 0


def test_attached_thread_queries_are_recorded(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """Threads attached with add_script_run_ctx record into the run."""
    cursor = query_telemetry.create_snowflake_cursor(snowflake_connection)
    thread = add_script_run_ctx(
        threading.Thread(target=cursor.execute, args=("SELECT 1",)), ctx
    )
    thread.start()
    thread.join(5)

    assert _totals(ctx, "snowflake_connector").queries == 1


def test_nothing_is_recorded_without_usage_stats(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """A run that doesn't gather usage stats records nothing."""
    cursor = query_telemetry.create_snowflake_cursor(snowflake_connection)
    ctx.gather_usage_stats = False

    cursor.execute("SELECT 1")
    query_telemetry.record_untimed_query("snowpark")

    assert _all_queries(ctx) == QueryTotals()


def test_query_running_across_a_reset_finishes_into_the_previous_run(
    ctx: ScriptRunContext, snowflake_connection: FakeSnowflakeConnection
) -> None:
    """A query that started before a new run began counts toward its own run."""
    previous_stats = ctx.shared.stats
    timer = query_telemetry.start_query("snowflake_connector")
    assert timer is not None

    ctx.shared.reset()
    timer.finish()

    assert _run_totals(previous_stats, "snowflake_connector").queries == 1
    assert _totals(ctx, "snowflake_connector").queries == 0


def test_previous_and_new_run_record_queries_into_their_own_totals_at_the_same_time(
    ctx: ScriptRunContext,
    snowflake_connection: FakeSnowflakeConnection,
    clock: FakeClock,
) -> None:
    """A query left running from the previous run keeps adding to that run's
    totals while the new run's queries add to the new run's.
    """
    started = threading.Event()
    release = threading.Event()

    def query_in_previous_run() -> None:
        timer = query_telemetry.start_query("snowflake_connector")
        assert timer is not None
        started.set()
        release.wait(5)
        timer.finish()

    previous_stats = ctx.shared.stats
    thread = add_script_run_ctx(threading.Thread(target=query_in_previous_run), ctx)
    thread.start()
    assert started.wait(5)
    ctx.shared.reset()
    query_telemetry.create_snowflake_cursor(snowflake_connection).execute("SELECT 1")
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
    assert _counts(totals) == (1, 0, 0, 0)
    assert totals.time == pytest.approx(0.25)


def test_sqlalchemy_error_records_failed_query(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """A query that raises counts as failed, once."""
    context = _sqlalchemy_execute(clock, error=FakeSnowflakeError("01b2-sa-failed"))
    # A later after_cursor_execute for the same context records nothing more.
    query_telemetry._after_cursor_execute(None, object(), "", {}, context, False)

    totals = _totals(ctx, "sqlalchemy")
    assert _counts(totals) == (1, 1, 0, 0)


def test_sqlalchemy_events_without_context_record_nothing(
    ctx: ScriptRunContext,
) -> None:
    query_telemetry._before_cursor_execute(None, object(), "", {}, None, False)
    query_telemetry._after_cursor_execute(None, object(), "", {}, None, False)
    query_telemetry._handle_sqlalchemy_error(
        types.SimpleNamespace(execution_context=None, original_exception=None)
    )

    assert _all_queries(ctx) == QueryTotals()


@pytest.fixture
def fake_sqlalchemy(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """Install a fake ``sqlalchemy`` and reset whether the hooks are installed."""
    event_mod = MagicMock(name="sqlalchemy.event")
    engine_mod = types.ModuleType("sqlalchemy.engine")
    engine_mod.Engine = type("Engine", (), {})  # type: ignore[attr-defined]
    sqlalchemy_mod = types.ModuleType("sqlalchemy")
    sqlalchemy_mod.event = event_mod  # type: ignore[attr-defined]
    sqlalchemy_mod.engine = engine_mod  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "sqlalchemy", sqlalchemy_mod)
    monkeypatch.setitem(sys.modules, "sqlalchemy.event", event_mod)
    monkeypatch.setitem(sys.modules, "sqlalchemy.engine", engine_mod)
    monkeypatch.setattr(query_telemetry, "_sqlalchemy_hooks_installed", False)
    return event_mod


def test_sqlalchemy_hooks_are_installed_once_on_the_engine_class(
    ctx: ScriptRunContext, fake_sqlalchemy: MagicMock
) -> None:
    query_telemetry.install_hooks_for_run()
    query_telemetry.install_sqlalchemy_hooks()

    engine_class = sys.modules["sqlalchemy.engine"].Engine  # type: ignore[attr-defined]
    assert [call.args[:2] for call in fake_sqlalchemy.listen.call_args_list] == [
        (engine_class, "before_cursor_execute"),
        (engine_class, "after_cursor_execute"),
        (engine_class, "handle_error"),
    ]


def test_sqlalchemy_hooks_are_not_installed_without_usage_stats(
    ctx: ScriptRunContext, fake_sqlalchemy: MagicMock
) -> None:
    with patch_config_options({"browser.gatherUsageStats": False}):
        query_telemetry.install_sqlalchemy_hooks()

    fake_sqlalchemy.listen.assert_not_called()


def test_sqlalchemy_hook_install_failure_is_swallowed(
    ctx: ScriptRunContext, fake_sqlalchemy: MagicMock
) -> None:
    fake_sqlalchemy.listen.side_effect = RuntimeError("no events")

    query_telemetry.install_sqlalchemy_hooks()
    query_telemetry.install_sqlalchemy_hooks()

    fake_sqlalchemy.listen.assert_called_once()


# Snowpark


def test_snowpark_session_queries_are_counted_without_time(
    ctx: ScriptRunContext, snowpark: types.ModuleType
) -> None:
    """A watched session's queries add counts, but no time."""
    session = FakeSnowparkSession()
    query_telemetry.watch_snowpark_session(session)  # type: ignore[arg-type]
    query_telemetry.watch_snowpark_session(session)  # type: ignore[arg-type]

    session._conn.run(FakeQueryRecord("01b2-sp-1"))
    session._conn.run(FakeQueryRecord("01b2-sp-2", is_describe=True))
    session._conn.run(FakeQueryRecord("01b2-sp-3"), failed=True)

    assert len(session._conn.listeners) == 1
    totals = _totals(ctx, "snowpark")
    assert _counts(totals) == (3, 1, 0, 1)
    assert totals.time == 0


def test_snowpark_queries_in_cached_functions_and_commands_are_counted_there(
    ctx: ScriptRunContext, snowpark: types.ModuleType
) -> None:
    """Snowpark queries are attributed like timed ones, without times."""
    session = FakeSnowparkSession()
    query_telemetry.watch_snowpark_session(session)  # type: ignore[arg-type]

    @st.cache_data(show_spinner=False)
    def load() -> str:
        session._conn.run(FakeQueryRecord("01b2-sp-cached"))
        return "rows"

    @metrics_util.gather_metrics("show_rows")
    def show_rows() -> None:
        session._conn.run(FakeQueryRecord("01b2-sp-command"))

    load()
    show_rows()
    session._conn.run(FakeQueryRecord("01b2-sp-plain"))

    totals = _totals(ctx, "snowpark")
    assert totals.queries == 3
    assert _overlap_counts(totals) == (1, 1)
    assert totals.time == totals.time_in_cache == totals.time_in_commands == 0


def test_snowpark_listener_errors_never_reach_snowpark(
    ctx: ScriptRunContext, snowpark: types.ModuleType
) -> None:
    """A recording error inside the listener doesn't raise into Snowpark."""
    session = FakeSnowparkSession()
    query_telemetry.watch_snowpark_session(session)  # type: ignore[arg-type]

    with patch.object(
        query_telemetry, "record_untimed_query", side_effect=RuntimeError("broke")
    ):
        session._conn.run(FakeQueryRecord("01b2-sp"))


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
    session = FakeSnowparkSession()
    with patch_config_options({"browser.gatherUsageStats": False}):
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
def test_real_snowflake_cursor_records_execute_async_and_describe(
    ctx: ScriptRunContext, clock: FakeClock
) -> None:
    """The connector's execute_async and describe go through execute, so the
    recording cursor sees them with their flags.
    """
    from snowflake.connector.connection import (
        SnowflakeConnection as ConnectorConnection,
    )
    from snowflake.connector.cursor import SnowflakeCursor

    query_telemetry._recording_cursor_class.cache_clear()
    executed: list[dict[str, Any]] = []

    def fake_execute(self: Any, *args: Any, **kwargs: Any) -> Any:
        executed.append(kwargs)
        clock.advance(0.1)
        self._sfqid = f"01b2-real-{len(executed)}"
        return self

    connection = MagicMock()
    connection.cursor = lambda cursor_class=SnowflakeCursor: ConnectorConnection.cursor(
        connection, cursor_class=cursor_class
    )
    with patch.object(SnowflakeCursor, "execute", fake_execute):
        cursor = query_telemetry.create_snowflake_cursor(connection)
        assert isinstance(cursor, SnowflakeCursor)
        cursor.execute("SELECT 1")
        cursor.execute_async("SELECT 2")
        cursor.describe("SELECT 3")

    assert len(executed) == 3
    totals = _totals(ctx, "snowflake_connector")
    assert _counts(totals) == (3, 0, 1, 1)
    assert totals.time == pytest.approx(0.3)
    query_telemetry._recording_cursor_class.cache_clear()


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
    server_connection._lock = threading.RLock()
    server_connection._query_listeners = set()
    results_cursor = MagicMock(sfqid="01b2-sp-ok", query="SELECT 1")
    # Snowpark keeps one connector cursor per thread.
    server_connection._thread_store = threading.local()
    server_connection._thread_store.cursor = MagicMock()
    server_connection._thread_store.cursor.execute.return_value = results_cursor

    query_telemetry.watch_snowpark_session(
        types.SimpleNamespace(_conn=server_connection)  # type: ignore[arg-type]
    )
    server_connection.execute_and_notify_query_listener("SELECT 1")
    server_connection._thread_store.cursor.execute.side_effect = ProgrammingError(
        "bad query", sfqid="01b2-sp-failed", query="SELECT x"
    )
    with pytest.raises(ProgrammingError):
        server_connection.execute_and_notify_query_listener("SELECT x")

    assert _counts(_totals(ctx, "snowpark")) == (2, 1, 0, 0)
    query_telemetry._snowpark_query_listener.cache_clear()


@pytest.fixture
def real_sqlalchemy_hooks(
    ctx: ScriptRunContext, monkeypatch: pytest.MonkeyPatch
) -> Iterator[None]:
    """Install the SQLAlchemy hooks on the real Engine class, and remove them
    afterwards so that no other test sees them.
    """
    from sqlalchemy import event
    from sqlalchemy.engine import Engine

    monkeypatch.setattr(query_telemetry, "_sqlalchemy_hooks_installed", False)
    query_telemetry.install_sqlalchemy_hooks()
    yield
    event.remove(
        Engine, "before_cursor_execute", query_telemetry._before_cursor_execute
    )
    event.remove(Engine, "after_cursor_execute", query_telemetry._after_cursor_execute)
    event.remove(Engine, "handle_error", query_telemetry._handle_sqlalchemy_error)


@pytest.mark.require_integration
@pytest.mark.usefixtures("real_sqlalchemy_hooks")
def test_real_sqlalchemy_engine_records_queries(ctx: ScriptRunContext) -> None:
    """Queries on an engine the app creates itself are recorded, including
    failed ones.
    """
    import sqlalchemy

    engine = sqlalchemy.create_engine("sqlite://")
    with engine.connect() as connection:
        connection.execute(sqlalchemy.text("SELECT 1"))
        with pytest.raises(sqlalchemy.exc.OperationalError):
            connection.execute(sqlalchemy.text("SELECT * FROM missing_table"))
    engine.dispose()

    totals = _totals(ctx, "sqlalchemy")
    assert totals.queries >= 2
    assert totals.failed == 1
    assert totals.time > 0


@pytest.mark.require_integration
@pytest.mark.usefixtures("real_sqlalchemy_hooks")
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
    assert totals.queries >= 2
    assert 0 < totals.time_in_cache < totals.time
