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

# NOTE: snowflake.connector, snowflake.snowpark and sqlalchemy aren't always
# installed, so their imports need `type: ignore` comments, which would be
# reported as unused when the packages are available.
# mypy: no-warn-unused-ignores

"""Records database queries for the page profile's per-run query totals.

Recorded queries, by source:

- ``snowflake_connector``: queries on the Snowflake Connector for Python
  cursors that ``SnowflakeConnection.query()`` and
  ``SnowflakeConnection.cursor()`` create. Streamlit creates them with a
  ``SnowflakeCursor`` subclass that times ``execute``, which ``executemany``,
  ``execute_async`` and ``describe`` call too. Cursors created any other way,
  such as from ``raw_connection`` or inside ``write_pandas``, aren't recorded.
- ``sqlalchemy``: queries on any SQLAlchemy engine, through SQLAlchemy's
  cursor execute events. The events are registered on the ``Engine`` class
  when a ``SQLConnection`` connects, or at the start of a script run once the
  app has imported SQLAlchemy, so engines the app creates itself are recorded
  too.
- ``snowpark``: queries on Snowpark sessions from
  ``SnowflakeConnection.session()``, and on the active Snowpark session found
  when a Snowflake connection connects or a script run starts. They're
  recorded through the query listener that ``Session.query_history()`` also
  uses. Snowpark notifies listeners only after a query finishes, so these
  queries aren't timed. Requires Snowpark 1.26 or later, the first version that
  registers listeners under a lock.

A query is recorded only if it runs on a thread attached to a script run that
gathers usage stats, and finishes before the run's page profile is built. No
hooks are installed when ``browser.gatherUsageStats`` is off. A failure in the
instrumentation is logged at debug level and never changes a query's result or
error.

A timed query's time also counts toward ``time_in_commands`` if it runs inside
a listed command, or else toward ``time_in_cache`` if it runs inside a cached
function, because those times already include it.
"""

from __future__ import annotations

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
    in_cached_function,
)

if TYPE_CHECKING:
    from snowflake.connector import (  # type: ignore[import]
        SnowflakeConnection as InternalSnowflakeConnection,
    )
    from snowflake.connector.cursor import SnowflakeCursor  # type: ignore[import]
    from snowflake.snowpark.session import Session  # type: ignore[import]

    from streamlit.runtime.scriptrunner_utils.query_run_stats import (
        QuerySource,
        QueryTotals,
        RunQueryStats,
    )

_LOGGER: Final = get_logger(__name__)

# The attribute of a SQLAlchemy execution context that holds its query's timer.
_SQLALCHEMY_TIMER_ATTR: Final = "_streamlit_query_timer"

_install_lock = threading.Lock()
_sqlalchemy_hooks_installed = False
# Snowpark server connections that already have the query listener.
_watched_snowpark_connections: weakref.WeakSet[Any] = weakref.WeakSet()


class QueryTimer:
    """Times one query and adds it to the current thread's run totals.

    Use ``start_query()`` to create one, and call ``finish()`` once when the
    query ends.
    """

    __slots__ = ("_in_cache", "_in_command", "_run_stats", "_start", "_totals")

    def __init__(
        self,
        run_stats: RunQueryStats,
        totals: QueryTotals,
        *,
        in_command: bool,
        in_cache: bool,
    ) -> None:
        self._run_stats = run_stats
        self._totals = totals
        self._in_command = in_command
        self._in_cache = in_cache
        self._start = time.perf_counter()

    def finish(
        self,
        *,
        failed: bool = False,
        is_async: bool = False,
        is_describe: bool = False,
        query_id: str | None = None,
    ) -> None:
        elapsed = time.perf_counter() - self._start
        totals = self._totals
        totals.timed_queries += 1
        totals.time += elapsed
        if self._in_command:
            totals.time_in_commands += elapsed
        elif self._in_cache:
            totals.time_in_cache += elapsed
        _count_query(
            self._run_stats,
            totals,
            failed=failed,
            is_async=is_async,
            is_describe=is_describe,
            query_id=query_id,
        )


def _count_query(
    run_stats: RunQueryStats,
    totals: QueryTotals,
    *,
    failed: bool,
    is_async: bool,
    is_describe: bool,
    query_id: str | None,
) -> None:
    totals.queries += 1
    if failed:
        totals.failed += 1
    if is_async:
        totals.async_queries += 1
    if is_describe:
        totals.describe_queries += 1
    if query_id:
        run_stats.add_query_id(query_id)


def _current_run_stats() -> RunQueryStats | None:
    """Return the query totals of the calling thread's script run, if the run
    gathers usage stats.
    """
    ctx = get_script_run_ctx(suppress_warning=True)
    if ctx is None or not ctx.gather_usage_stats:
        return None
    return ctx.shared.query_stats


def start_query(source: QuerySource) -> QueryTimer | None:
    """Start timing a query from ``source``, or return None if the page profile
    doesn't record it.
    """
    run_stats = _current_run_stats()
    if run_stats is None:
        return None
    try:
        in_command = ThreadState.get().in_listed_command
    except RuntimeError:
        # A thread with a ScriptRunContext but no ThreadState.
        in_command = False
    totals = run_stats.current_thread_stats().totals_for(source)
    return QueryTimer(
        run_stats, totals, in_command=in_command, in_cache=in_cached_function.get()
    )


def record_untimed_query(
    source: QuerySource,
    *,
    failed: bool = False,
    is_describe: bool = False,
    query_id: str | None = None,
) -> None:
    """Count a finished query whose time isn't known, if the page profile
    records it.
    """
    run_stats = _current_run_stats()
    if run_stats is None:
        return
    _count_query(
        run_stats,
        run_stats.current_thread_stats().totals_for(source),
        failed=failed,
        is_async=False,
        is_describe=is_describe,
        query_id=query_id,
    )


def _start_query_safely(source: QuerySource) -> QueryTimer | None:
    try:
        return start_query(source)
    except Exception as ex:
        _LOGGER.debug("Failed to start query telemetry", exc_info=ex)
        return None


def _finish_safely(
    timer: QueryTimer,
    *,
    failed: bool = False,
    is_async: bool = False,
    is_describe: bool = False,
    query_id: Any = None,
) -> None:
    try:
        timer.finish(
            failed=failed,
            is_async=is_async,
            is_describe=is_describe,
            query_id=query_id if isinstance(query_id, str) else None,
        )
    except Exception as ex:
        _LOGGER.debug("Failed to record query telemetry", exc_info=ex)


def _gathers_usage_stats() -> bool:
    return bool(config.get_option("browser.gatherUsageStats"))


@functools.cache
def _recording_cursor_class() -> type[SnowflakeCursor]:
    from snowflake.connector.cursor import SnowflakeCursor  # type: ignore[import]

    class StreamlitSnowflakeCursor(SnowflakeCursor):  # type: ignore[misc]
        """A ``SnowflakeCursor`` that records its queries in the page profile."""

        # Set while execute runs, so a call from inside it isn't counted again.
        _streamlit_in_execute = False

        def execute(self, *args: Any, **kwargs: Any) -> Any:
            timer = (
                None
                if self._streamlit_in_execute
                else _start_query_safely("snowflake_connector")
            )
            if timer is None:
                return super().execute(*args, **kwargs)
            is_async = bool(kwargs.get("_exec_async"))
            is_describe = bool(kwargs.get("_describe_only"))
            self._streamlit_in_execute = True
            try:
                result = super().execute(*args, **kwargs)
            except Exception as ex:
                _finish_safely(
                    timer,
                    failed=True,
                    is_async=is_async,
                    is_describe=is_describe,
                    query_id=getattr(ex, "sfqid", None),
                )
                raise
            finally:
                self._streamlit_in_execute = False
            _finish_safely(
                timer,
                is_async=is_async,
                is_describe=is_describe,
                query_id=self.sfqid,
            )
            return result

    return StreamlitSnowflakeCursor


def create_snowflake_cursor(
    connection: InternalSnowflakeConnection,
) -> SnowflakeCursor:
    """Return a new cursor on ``connection`` that records its queries in the
    page profile when usage stats are gathered.
    """
    if not _gathers_usage_stats():
        return connection.cursor()
    try:
        cursor_class = _recording_cursor_class()
    except Exception as ex:
        _LOGGER.debug("Failed to create the recording cursor class", exc_info=ex)
        return connection.cursor()
    try:
        return connection.cursor(cursor_class=cursor_class)
    except TypeError:
        # A connection whose cursor() doesn't take a cursor class.
        return connection.cursor()


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
    cursor: Any,
    statement: Any,  # noqa: ARG001
    parameters: Any,  # noqa: ARG001
    context: Any,
    executemany: Any,  # noqa: ARG001
) -> None:
    try:
        timer = _pop_sqlalchemy_timer(context)
        if timer is not None:
            # Snowflake's SQLAlchemy dialect runs queries on Snowflake connector
            # cursors, which have a query ID.
            _finish_safely(timer, query_id=getattr(cursor, "sfqid", None))
    except Exception as ex:
        _LOGGER.debug("Failed to record query telemetry", exc_info=ex)


def _handle_sqlalchemy_error(exception_context: Any) -> None:
    try:
        timer = _pop_sqlalchemy_timer(exception_context.execution_context)
        if timer is not None:
            _finish_safely(
                timer,
                failed=True,
                query_id=getattr(exception_context.original_exception, "sfqid", None),
            )
    except Exception as ex:
        _LOGGER.debug("Failed to record query telemetry", exc_info=ex)


def install_sqlalchemy_hooks() -> None:
    """Record queries on every SQLAlchemy engine, if usage stats are gathered.

    Only call this once SQLAlchemy has been imported.
    """
    global _sqlalchemy_hooks_installed  # noqa: PLW0603
    if not _gathers_usage_stats():
        return
    with _install_lock:
        if _sqlalchemy_hooks_installed:
            return
        # Set first, so that a failure isn't retried on every run.
        _sqlalchemy_hooks_installed = True
        try:
            from sqlalchemy import event  # type: ignore[import]
            from sqlalchemy.engine import Engine  # type: ignore[import]

            event.listen(Engine, "before_cursor_execute", _before_cursor_execute)
            event.listen(Engine, "after_cursor_execute", _after_cursor_execute)
            event.listen(Engine, "handle_error", _handle_sqlalchemy_error)
        except Exception as ex:
            _LOGGER.debug("Failed to install SQLAlchemy query telemetry", exc_info=ex)


def _record_snowpark_query(query_record: Any, **kwargs: Any) -> None:
    try:
        query_id = query_record.query_id
        record_untimed_query(
            "snowpark",
            # Snowpark passes the exception only for some failures.
            failed="exception" in kwargs,
            is_describe=bool(query_record.is_describe),
            query_id=query_id if isinstance(query_id, str) else None,
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
    """Install the query hooks for libraries the app has imported.

    Call this at the start of each script run that gathers usage stats.
    """
    try:
        if "sqlalchemy" in sys.modules:
            install_sqlalchemy_hooks()
        if "snowflake.snowpark" in sys.modules:
            _watch_active_snowpark_session()
    except Exception as ex:
        _LOGGER.debug("Failed to install query telemetry", exc_info=ex)
