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

"""Off-thread execution of cached functions, shared across sessions.

A *task* runs a cached function on a process-wide thread pool instead of blocking
the script thread. Execution and deduplication are app-wide: every session that
asks for the same ``(function_key, value_key)`` while a computation is in flight
joins the running task rather than starting a second one. Status is tracked
per session, so each session holds its own handle on the shared computation and
is independently woken when that computation settles.

When a task settles, every subscribed session is asked to rerun. Fanning out to
all subscribers (not just the session that started the task) is what makes
deduplication safe: a session that joined an in-flight task must still be woken
when it finishes.

A successful task writes its value into the function's cache and is then dropped
from the registry, so a later cache miss for the same key starts a fresh
computation. A failed task stays in the registry so the failure is reported
instead of retried on every rerun; clearing the cached function clears it.

The pool size is controlled by the hidden ``runner.taskMaxWorkers`` config option
(default 4). Unlike background cache refresh, a saturated pool queues tasks rather
than dropping them: a dropped task would leave the session waiting forever.
"""

from __future__ import annotations

import copy
import enum
import threading
import weakref
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Generic,
    Literal,
    TypeAlias,
    TypeVar,
    cast,
)

from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.runtime.app_session import AppSession

_LOGGER: Final = get_logger(__name__)

T = TypeVar("T")

# Identifies one cached computation: the cached function plus its arguments.
TaskEntryKey: TypeAlias = tuple[str, str]

_TaskState: TypeAlias = Literal["running", "done", "error"]

# Fallback pool size used only if the config option can't be read (it normally
# provides the default). Tasks are typically I/O-bound (database/API/model calls),
# so a small, predictable bound is preferable; some runtimes (e.g. SiS) also
# restrict thread counts.
_DEFAULT_MAX_WORKERS: Final = 4


@dataclass(frozen=True)
class _TaskSnapshot:
    """One session's view of a task at the moment its handle was created."""

    state: _TaskState
    value: Any
    exception: BaseException | None


class Task(Generic[T]):
    """A handle on a cached function that runs off the script thread.

    The handle reflects the task's state at the point in the script run where it
    was obtained, so a task that settles mid-run cannot make a single run report
    two different states. The session is rerun when the task settles, and the
    handle obtained on that run reports the new state.
    """

    def __init__(self, snapshot: _TaskSnapshot) -> None:
        self._snapshot = snapshot

    def __repr__(self) -> str:
        return f"<Task: {self._snapshot.state}>"

    @property
    def running(self) -> bool:
        """Whether the task is still computing."""
        return self._snapshot.state == "running"

    @property
    def done(self) -> bool:
        """Whether the task finished successfully and its result is available."""
        return self._snapshot.state == "done"

    @property
    def error(self) -> BaseException | None:
        """The exception the task raised, or ``None`` if it did not fail."""
        return self._snapshot.exception

    @property
    def result(self) -> T:
        """The task's return value.

        Raises
        ------
        StreamlitAPIException
            Raised if the task is still running.
        BaseException
            The exception raised by the cached function, if the task failed.
        """
        exception = self._snapshot.exception
        if exception is not None:
            raise exception
        if self._snapshot.state != "done":
            raise StreamlitAPIException(
                "This task is still running, so it has no result yet. Check "
                "`task.done` before reading `task.result`."
            )
        # Each reader gets its own copy so that sessions sharing one task can't
        # observe each other's mutations, matching st.cache_data's copy semantics.
        return cast("T", copy.deepcopy(self._snapshot.value))


class Running(enum.Enum):
    """The type of ``st.RUNNING``, the placeholder for an unfinished task.

    A single-member enum rather than a bare object, so that type checkers narrow
    ``value is st.RUNNING`` and leave the function's own return type in the
    other branch.
    """

    RUNNING = "RUNNING"

    def __repr__(self) -> str:
        return "RUNNING"


RUNNING: Final = Running.RUNNING


@dataclass(frozen=True)
class TaskError:
    """The placeholder a task-mode cached function returns after it raised."""

    exception: BaseException

    def __repr__(self) -> str:
        return f"TaskError({self.exception!r})"


def completed_task(value: T) -> Task[T]:
    """Wrap an already-available value in a settled handle.

    Used for cache hits, which need no pool worker and no rerun.
    """
    return Task(_TaskSnapshot("done", value, None))


class _SessionTasks:
    """The tasks one session is subscribed to.

    Doubles as the cleanup index: when the session disconnects, its entries are
    the exact set of tasks it needs to be unsubscribed from.
    """

    def __init__(self, session: AppSession) -> None:
        self.session_id = session.id
        # Weak so that a session which is never released cleanly still becomes
        # collectable once the runtime drops it.
        self._session_ref = weakref.ref(session)
        self._lock = threading.Lock()
        self._entries: dict[TaskEntryKey, _TaskEntry] = {}

    def __repr__(self) -> str:
        return f"<_SessionTasks: {self.session_id}>"

    def track(self, entry: _TaskEntry) -> None:
        with self._lock:
            self._entries[entry.key] = entry

    def forget(self, key: TaskEntryKey) -> None:
        with self._lock:
            self._entries.pop(key, None)

    def drain(self) -> list[_TaskEntry]:
        """Remove and return every entry this session is subscribed to."""
        with self._lock:
            entries = list(self._entries.values())
            self._entries.clear()
        return entries

    def request_rerun(self) -> None:
        """Ask this session to rerun, if it is still connected."""
        session = self._session_ref()
        if session is None:
            return
        session.request_rerun_threadsafe()


class _TaskEntry:
    """App-wide record of one deduplicated computation."""

    def __init__(self, key: TaskEntryKey) -> None:
        self.key = key
        self._lock = threading.Lock()
        self._state: _TaskState = "running"
        self._value: Any = None
        self._exception: BaseException | None = None
        self._subscribers: set[_SessionTasks] = set()

    def __repr__(self) -> str:
        return f"<_TaskEntry: {self.key} ({self._state})>"

    def snapshot(self) -> _TaskSnapshot:
        with self._lock:
            return _TaskSnapshot(self._state, self._value, self._exception)

    def subscribe(self, session_tasks: _SessionTasks) -> None:
        with self._lock:
            self._subscribers.add(session_tasks)

    def unsubscribe(self, session_tasks: _SessionTasks) -> bool:
        """Drop a subscriber and report whether any remain."""
        with self._lock:
            self._subscribers.discard(session_tasks)
            return bool(self._subscribers)

    def settle(
        self, value: Any, exception: BaseException | None
    ) -> list[_SessionTasks]:
        """Record the outcome and return the subscribers to wake."""
        with self._lock:
            self._state = "error" if exception is not None else "done"
            self._value = value
            self._exception = exception
            return list(self._subscribers)


def _request_rerun(session_tasks: _SessionTasks) -> None:
    """Wake one subscriber, keeping a failure from stranding the others."""
    try:
        session_tasks.request_rerun()
    except Exception:
        _LOGGER.warning(
            "Failed to notify session %s that a task finished.",
            session_tasks.session_id,
            exc_info=True,
        )


class _TaskManager:
    """The process-wide registry and thread pool backing cached-function tasks."""

    def __init__(self, max_workers: int | None = None) -> None:
        """Create the manager.

        Parameters
        ----------
        max_workers : int or None
            When ``None`` (the default, used by the process-wide singleton), the pool
            size is read from the ``runner.taskMaxWorkers`` config option on first use
            — config isn't parsed yet at module import time. Tests pass an explicit
            value to bypass config and size the pool eagerly.
        """
        self._configured_max_workers = max_workers
        self._lock = threading.Lock()
        self._executor: ThreadPoolExecutor | None = None
        self._max_workers: int | None = max_workers
        self._entries: dict[TaskEntryKey, _TaskEntry] = {}
        self._sessions: dict[str, _SessionTasks] = {}

    @staticmethod
    def _resolve_configured_max_workers() -> int:
        from streamlit import config

        try:
            max_workers = int(config.get_option("runner.taskMaxWorkers"))
        except (TypeError, ValueError):  # pragma: no cover - defensive
            return _DEFAULT_MAX_WORKERS
        # Unlike background refresh, tasks cannot be skipped, so the pool always
        # needs at least one worker.
        return max(1, max_workers)

    def _ensure_executor(self) -> ThreadPoolExecutor:
        with self._lock:
            if self._executor is None:
                if self._max_workers is None:
                    self._max_workers = self._resolve_configured_max_workers()
                self._executor = ThreadPoolExecutor(
                    max_workers=self._max_workers,
                    thread_name_prefix="CachedFunctionTask",
                )
            return self._executor

    def _session_tasks(self, session: AppSession) -> _SessionTasks:
        with self._lock:
            session_tasks = self._sessions.get(session.id)
            if session_tasks is None:
                session_tasks = _SessionTasks(session)
                self._sessions[session.id] = session_tasks
            return session_tasks

    def get_or_submit(
        self,
        entry_key: TaskEntryKey,
        compute: Callable[[], Any],
        *,
        session: AppSession | None,
    ) -> _TaskEntry:
        """Join the task for ``entry_key``, starting it if nothing is in flight.

        ``compute`` runs on a pool worker without a ScriptRunContext, so the cached
        function must be context-free. ``session``, when given, is subscribed to the
        task and rerun once it settles.
        """
        session_tasks = self._session_tasks(session) if session is not None else None

        with self._lock:
            entry = self._entries.get(entry_key)
            is_new = entry is None
            if entry is None:
                entry = _TaskEntry(entry_key)
                self._entries[entry_key] = entry

        if session_tasks is not None:
            entry.subscribe(session_tasks)
            session_tasks.track(entry)

        if is_new:
            self._start(entry, compute)
        return entry

    def _start(self, entry: _TaskEntry, compute: Callable[[], Any]) -> None:
        def run() -> None:
            try:
                value = compute()
            except BaseException as ex:
                # Surfaced through the handle rather than lost on the worker thread.
                self._settle(entry, None, ex)
            else:
                self._settle(entry, value, None)

        try:
            self._ensure_executor().submit(run)
        except RuntimeError as ex:
            # ThreadPoolExecutor starts worker threads lazily on submit, so a runtime
            # that forbids new threads fails here. Report it through the handle rather
            # than raising into the script run that happened to start the task.
            _LOGGER.warning("Failed to start a cached-function task.", exc_info=True)
            self._settle(entry, None, ex)

    def _settle(
        self, entry: _TaskEntry, value: Any, exception: BaseException | None
    ) -> None:
        subscribers = entry.settle(value, exception)

        if exception is None:
            # The value now lives in the cache, so keeping the entry would make a
            # later miss (ttl expiry, eviction) replay this result forever.
            self._discard(entry, subscribers)

        for session_tasks in subscribers:
            _request_rerun(session_tasks)

    def _discard(self, entry: _TaskEntry, subscribers: list[_SessionTasks]) -> None:
        with self._lock:
            if self._entries.get(entry.key) is entry:
                del self._entries[entry.key]
        for session_tasks in subscribers:
            session_tasks.forget(entry.key)

    def clear(self, function_key: str, value_key: str | None = None) -> None:
        """Forget task state for a cached function, or for one of its keys.

        Mirrors clearing the function's cache: a failed task is otherwise sticky,
        and clearing is how the app asks for a retry.
        """
        with self._lock:
            stale_keys = [
                key
                for key in self._entries
                if key[0] == function_key and (value_key is None or key[1] == value_key)
            ]
            entries = [self._entries.pop(key) for key in stale_keys]
        for session_tasks in self._sessions.values():
            for entry in entries:
                session_tasks.forget(entry.key)

    def release_session(self, session_id: str) -> None:
        """Unsubscribe a disconnected session and reap tasks nobody is waiting on."""
        with self._lock:
            session_tasks = self._sessions.pop(session_id, None)
        if session_tasks is None:
            return
        for entry in session_tasks.drain():
            if not entry.unsubscribe(session_tasks):
                self._discard(entry, [])

    def shutdown(self) -> None:
        """Shut down the pool and drop all task state. Intended for use in tests."""
        with self._lock:
            executor = self._executor
            self._executor = None
            self._entries.clear()
            self._sessions.clear()
            self._max_workers = self._configured_max_workers
        if executor is not None:
            executor.shutdown(wait=True)


# Process-wide singleton.
_task_manager = _TaskManager()


def get_task_manager() -> _TaskManager:
    """Return the process-wide task manager."""
    return _task_manager


def release_session(session_id: str) -> None:
    """Drop a disconnected session's task subscriptions."""
    _task_manager.release_session(session_id)


def get_current_session() -> AppSession | None:
    """Return the AppSession running the current script, if there is one.

    Returns ``None`` outside a session (bare mode, ``AppTest``, a worker thread),
    in which case a task still runs but nothing is rerun when it settles.
    """
    from streamlit import runtime
    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        get_script_run_ctx,
    )

    ctx = get_script_run_ctx()
    if ctx is None or not runtime.exists():
        return None
    return runtime.get_instance().get_active_session(ctx.session_id)


def reset() -> None:
    """Reset the process-wide manager. Intended for use in tests."""
    _task_manager.shutdown()
