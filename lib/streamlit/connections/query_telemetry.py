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

# NOTE: snowflake.snowpark and sqlalchemy aren't always installed, so their
# imports need `type: ignore` comments, which would be reported as unused when
# the packages are available.
# mypy: no-warn-unused-ignores

"""Records database queries for the page profile's per-run query totals.

Recording never changes the objects an app gets from Streamlit, such as
cursors, engines or sessions, and uses only hooks the libraries provide, so
some queries aren't recorded. Recorded queries, by source:

- ``snowflake_connector``: the query that ``SnowflakeConnection.query()``
  runs, timed around Streamlit's own ``execute`` call. Queries the app runs on
  a cursor, including one from ``SnowflakeConnection.cursor()``, aren't
  recorded, because the connector has no hook for them.
- ``sqlalchemy``: queries on the engine behind a ``SQLConnection``, including
  its ``session``, through SQLAlchemy's cursor execute events on that engine.
  Engines the app creates itself aren't recorded.
- ``snowpark``: queries on Snowpark sessions from
  ``SnowflakeConnection.session()``, and on the active Snowpark session found
  when a Snowflake connection connects or a script run starts. They're
  recorded through the query listener that ``Session.query_history()`` also
  uses. Snowpark notifies listeners only after a query finishes, so these
  queries aren't timed. Requires Snowpark 1.26 or later, the first version
  with query listeners.

A query is recorded only if it runs on a thread attached to a script run that
gathers usage stats, and finishes before the run's page profile is built. No
hooks are installed when ``browser.gatherUsageStats`` is off. A failure in the
instrumentation is logged at debug level and never changes a query's result or
error.

A query that overlaps other recorded times is counted, with its time, in
``queries_in_commands`` if it runs inside a listed command, or else in
``queries_in_cache`` if it runs on a thread while a recorded cached call is
open there. Threads a cached function attaches with ``add_script_run_ctx``
record their queries as their own, like their cached calls and commands. A
parallel fragment's queries on its worker thread also count toward the
fragment's own run in the page profile.
"""

from __future__ import annotations

import contextlib
import functools
import sys
import threading
import time
import weakref
from typing import TYPE_CHECKING, Any, Final

from streamlit import config
from streamlit.logger import get_logger
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    ThreadState,
    get_script_run_ctx,
)

if TYPE_CHECKING:
    from collections.abc import Generator

    from snowflake.snowpark.session import Session  # type: ignore[import]
    from sqlalchemy.engine import Engine  # type: ignore[import]

    from streamlit.runtime.scriptrunner_utils.query_run_stats import (
        QuerySource,
        QueryTotals,
    )
    from streamlit.runtime.scriptrunner_utils.run_stats import ThreadRunStats
    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        ScriptRunContext,
    )

_LOGGER: Final = get_logger(__name__)

# The attribute of a SQLAlchemy execution context that holds its query's timer.
_SQLALCHEMY_TIMER_ATTR: Final = "_streamlit_query_timer"

_install_lock = threading.Lock()
# Snowpark server connections that already have the query listener.
_watched_snowpark_connections: weakref.WeakSet[Any] = weakref.WeakSet()


class QueryTimer:
    """Times one query and adds it to the current thread's run totals.

    Use ``start_query()`` to create one, and call ``finish()`` once when the
    query ends.
    """

    __slots__ = ("_in_cache", "_in_command", "_start", "_totals")

    def __init__(
        self,
        totals: QueryTotals,
        *,
        in_command: bool,
        in_cache: bool,
    ) -> None:
        self._totals = totals
        self._in_command = in_command
        self._in_cache = in_cache
        self._start = time.perf_counter()

    def finish(self, *, failed: bool = False) -> None:
        elapsed = time.perf_counter() - self._start
        totals = self._totals
        totals.time += elapsed
        if self._in_command:
            totals.time_in_commands += elapsed
        elif self._in_cache:
            totals.time_in_cache += elapsed
        _count_query(
            totals,
            failed=failed,
            is_describe=False,
            in_command=self._in_command,
            in_cache=self._in_cache,
        )


def _count_query(
    totals: QueryTotals,
    *,
    failed: bool,
    is_describe: bool,
    in_command: bool,
    in_cache: bool,
) -> None:
    totals.queries += 1
    if failed:
        totals.failed += 1
    if is_describe:
        totals.describe_queries += 1
    if in_command:
        totals.queries_in_commands += 1
    elif in_cache:
        totals.queries_in_cache += 1


def _overlapping_times(thread_stats: ThreadRunStats) -> tuple[bool, bool]:
    """Return whether a query on the calling thread is inside a listed command,
    and if it isn't, whether it's inside a recorded cached call.

    A cached call's times leave out the listed commands it runs, while a
    command's time includes everything it runs, so a query inside both counts
    toward the command. A recorded call's times include everything on the
    thread while it's open: its computation, the cache's own work such as a
    ``hash_funcs`` function, and in async code, other tasks while it awaits.
    """
    try:
        in_listed_command = ThreadState.get().in_listed_command
    except RuntimeError:
        # A thread with a ScriptRunContext but no ThreadState.
        in_listed_command = False
    if in_listed_command:
        return True, False
    return False, thread_stats.cache.is_in_call


def _recording_run_ctx() -> ScriptRunContext | None:
    """Return the calling thread's script run context, if the run gathers usage
    stats.
    """
    ctx = get_script_run_ctx(suppress_warning=True)
    if ctx is None or not ctx.gather_usage_stats:
        return None
    return ctx


def start_query(source: QuerySource) -> QueryTimer | None:
    """Start timing a query from ``source``, or return None if the page profile
    doesn't record it.
    """
    ctx = _recording_run_ctx()
    if ctx is None:
        return None
    thread_stats = ctx.shared.stats.current_thread_stats()
    in_command, in_cache = _overlapping_times(thread_stats)
    totals = thread_stats.query.totals_for(source)
    return QueryTimer(totals, in_command=in_command, in_cache=in_cache)


def record_untimed_query(
    source: QuerySource,
    *,
    failed: bool = False,
    is_describe: bool = False,
) -> None:
    """Count a finished query whose time isn't known, if the page profile
    records it.
    """
    ctx = _recording_run_ctx()
    if ctx is None:
        return
    thread_stats = ctx.shared.stats.current_thread_stats()
    in_command, in_cache = _overlapping_times(thread_stats)
    _count_query(
        thread_stats.query.totals_for(source),
        failed=failed,
        is_describe=is_describe,
        in_command=in_command,
        in_cache=in_cache,
    )


def _start_query_safely(source: QuerySource) -> QueryTimer | None:
    try:
        return start_query(source)
    except Exception as ex:
        _LOGGER.debug("Failed to start query telemetry", exc_info=ex)
        return None


def _finish_safely(timer: QueryTimer, *, failed: bool = False) -> None:
    try:
        timer.finish(failed=failed)
    except Exception as ex:
        _LOGGER.debug("Failed to record query telemetry", exc_info=ex)


@contextlib.contextmanager
def record_query(source: QuerySource) -> Generator[None, None, None]:
    """Time the block as one query from ``source``, if the page profile records
    it.

    Errors while recording are swallowed, and an error raised by the block
    always propagates unchanged.
    """
    timer = _start_query_safely(source)
    try:
        yield
    except Exception:
        if timer is not None:
            _finish_safely(timer, failed=True)
        raise
    if timer is not None:
        _finish_safely(timer)


def _gathers_usage_stats() -> bool:
    return bool(config.get_option("browser.gatherUsageStats"))


def _pop_sqlalchemy_timer(context: Any) -> QueryTimer | None:
    timer: QueryTimer | None = getattr(context, _SQLALCHEMY_TIMER_ATTR, None)
    if timer is not None:
        setattr(context, _SQLALCHEMY_TIMER_ATTR, None)
    return timer


def _before_cursor_execute(
    conn: Any,  # noqa: ARG001
    cursor: Any,  # noqa: ARG001
    statement: Any,  # noqa: ARG001
    parameters: Any,  # noqa: ARG001
    context: Any,
    executemany: Any,  # noqa: ARG001
) -> None:
    if context is None:
        return
    timer = _start_query_safely("sqlalchemy")
    if timer is None:
        return
    try:
        setattr(context, _SQLALCHEMY_TIMER_ATTR, timer)
    except Exception as ex:
        _LOGGER.debug("Failed to start query telemetry", exc_info=ex)


def _after_cursor_execute(
    conn: Any,  # noqa: ARG001
    cursor: Any,  # noqa: ARG001
    statement: Any,  # noqa: ARG001
    parameters: Any,  # noqa: ARG001
    context: Any,
    executemany: Any,  # noqa: ARG001
) -> None:
    try:
        timer = _pop_sqlalchemy_timer(context)
        if timer is not None:
            _finish_safely(timer)
    except Exception as ex:
        _LOGGER.debug("Failed to record query telemetry", exc_info=ex)


def _handle_sqlalchemy_error(exception_context: Any) -> None:
    try:
        timer = _pop_sqlalchemy_timer(exception_context.execution_context)
        if timer is not None:
            _finish_safely(timer, failed=True)
    except Exception as ex:
        _LOGGER.debug("Failed to record query telemetry", exc_info=ex)


def install_sqlalchemy_hooks(engine: Engine) -> None:
    """Record the queries on ``engine``, if usage stats are gathered.

    The events are registered on this engine only, so engines the app creates
    itself are unaffected. Engines derived from it with ``execution_options()``
    share its events.
    """
    if not _gathers_usage_stats():
        return
    try:
        from sqlalchemy import event  # type: ignore[import]

        event.listen(engine, "before_cursor_execute", _before_cursor_execute)
        event.listen(engine, "after_cursor_execute", _after_cursor_execute)
        event.listen(engine, "handle_error", _handle_sqlalchemy_error)
    except Exception as ex:
        _LOGGER.debug("Failed to install SQLAlchemy query telemetry", exc_info=ex)


def _record_snowpark_query(query_record: Any, **kwargs: Any) -> None:
    try:
        record_untimed_query(
            "snowpark",
            # Snowpark passes the exception only for some failures.
            failed="exception" in kwargs,
            is_describe=bool(query_record.is_describe),
        )
    except Exception as ex:
        _LOGGER.debug("Failed to record query telemetry", exc_info=ex)


@functools.cache
def _snowpark_query_listener() -> Any:
    """Return the listener added to Snowpark sessions, or None if the installed
    Snowpark is older than 1.26.
    """
    try:
        from snowflake.snowpark.query_history import (  # type: ignore[import]
            QueryListener,
        )
    except ImportError:
        return None

    class StreamlitQueryListener(QueryListener):  # type: ignore[misc]
        """Records the queries of the Snowpark sessions it's added to."""

        # Snowpark reads these to decide which queries to report.
        include_describe = True
        include_error = True

        def _notify(self, query_record: Any, **kwargs: Any) -> None:
            _record_snowpark_query(query_record, **kwargs)

    return StreamlitQueryListener()


def watch_snowpark_session(session: Session) -> None:
    """Record the queries on ``session``, if usage stats are gathered and the
    installed Snowpark supports it.
    """
    if not _gathers_usage_stats():
        return
    try:
        listener = _snowpark_query_listener()
        if listener is None:
            return
        server_connection = session._conn
        with _install_lock:
            if server_connection in _watched_snowpark_connections:
                return
            server_connection.add_query_listener(listener)
            _watched_snowpark_connections.add(server_connection)
    except Exception as ex:
        _LOGGER.debug("Failed to install Snowpark query telemetry", exc_info=ex)


def _watch_active_snowpark_session() -> None:
    try:
        if _snowpark_query_listener() is None:
            return
        from snowflake.snowpark.context import (  # type: ignore[import]
            get_active_session,
        )

        session = get_active_session()
    except Exception:
        # No active session, or more than one.
        return
    watch_snowpark_session(session)


def install_hooks_for_run() -> None:
    """Watch the active Snowpark session, if the app has imported Snowpark.

    Call this at the start of each script run that gathers usage stats.
    """
    try:
        if "snowflake.snowpark" in sys.modules:
            _watch_active_snowpark_session()
    except Exception as ex:
        _LOGGER.debug("Failed to install query telemetry", exc_info=ex)
