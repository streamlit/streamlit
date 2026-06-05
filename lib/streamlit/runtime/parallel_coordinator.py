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

"""ParallelFragmentCoordinator and supporting helpers.

Manages a thread pool for parallel fragment execution. The coordinator
receives the caller's ``ScriptRunContext`` explicitly via ``submit()``
so that worker threads can access the correct context.
"""

from __future__ import annotations

import contextlib
import contextvars
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import TYPE_CHECKING, Any

from streamlit.runtime.scriptrunner_utils.exceptions import (
    RerunException,
    StopException,
)
from streamlit.runtime.scriptrunner_utils.script_run_context_attr import (
    SCRIPT_RUN_CONTEXT_ATTR_NAME,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Iterator

    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        ScriptRunContext,
    )


@contextlib.contextmanager
def _scoped_ctx_attach(ctx: ScriptRunContext | None) -> Iterator[None]:
    """Bind *ctx* as the active ScriptRunContext on the current thread for
    the duration of the block; restore the prior binding on exit.

    Used by ``ParallelFragmentCoordinator.submit()`` so a pool thread that
    executes successive submissions sees the right ctx for each call and
    never carries a stale ctx across submissions.
    """
    thread = threading.current_thread()
    prev = getattr(thread, SCRIPT_RUN_CONTEXT_ATTR_NAME, None)
    setattr(thread, SCRIPT_RUN_CONTEXT_ATTR_NAME, ctx)
    try:
        yield
    finally:
        if prev is None:
            try:
                delattr(thread, SCRIPT_RUN_CONTEXT_ATTR_NAME)
            except AttributeError:
                pass
        else:
            setattr(thread, SCRIPT_RUN_CONTEXT_ATTR_NAME, prev)


class ParallelFragmentCoordinator:
    """Manages the lifecycle of parallel fragment workers for one script run.

    Owned by ScriptRunContext (created in ctx.reset()) and exposed as
    ctx.parallel_coordinator. The coordinator is single-use: a fresh
    instance is created at the start of every script run, joined or drained
    before the run ends, and discarded.

    Workers submitted via :meth:`submit` run inside a
    ``contextvars.copy_context()`` snapshot of the caller's context with a
    scoped ``ScriptRunContext`` attach so ``get_script_run_ctx()`` and
    ``ThreadState.get()`` return the parent's values. Worker-side
    ``ThreadState.update()`` writes stay local to the copied context.
    """

    def __init__(
        self,
        yield_check: Callable[[], None],
        max_workers: int | None = None,
        poll_interval: float = 0.1,
    ) -> None:
        if max_workers is not None and max_workers < 1:
            raise ValueError(
                f"runner.parallelMaxWorkers must be None or a positive "
                f"integer, got {max_workers!r}"
            )
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._outstanding = 0
        self._join_condition = threading.Condition(threading.Lock())
        self._stop_event = threading.Event()
        self._worker_exception: RerunException | StopException | None = None
        self._exception_lock = threading.Lock()
        self._yield_check = yield_check
        self._poll_interval = poll_interval

    def submit(
        self,
        fn: Callable[..., Any],
        ctx: ScriptRunContext | None,
        *args: Any,
    ) -> None:
        """Submit a worker function to the thread pool.

        Captures the caller's full ``contextvars.Context`` (which includes
        ``FragmentThreadState``) at submit time.  The worker runs inside
        ``copy_context().run(...)`` with a scoped ctx attach so
        ``get_script_run_ctx()`` and ``ThreadState.get()`` return the parent's
        values for the duration of the call.  Worker-side
        ``ThreadState.update()`` writes stay local to the captured copy — they
        never leak back to the parent thread.

        Increments the outstanding counter before submitting so a nested
        submit() from inside a running worker is visible to join() before
        the parent's tracked() decrement runs. May be called from any
        thread (main thread or worker threads for nested fragments).

        Parameters
        ----------
        fn : Callable[..., Any]
            The worker function to execute in the thread pool.
        ctx : ScriptRunContext | None
            The ScriptRunContext to propagate to the worker thread so that
            ``get_script_run_ctx()`` returns the correct context inside the
            worker.
        *args : Any
            Positional arguments forwarded to ``fn``.
        """
        captured = contextvars.copy_context()

        with self._join_condition:
            self._outstanding += 1

        def tracked() -> None:
            try:
                with _scoped_ctx_attach(ctx):
                    captured.run(fn, *args)
            finally:
                with self._join_condition:
                    self._outstanding -= 1
                    self._join_condition.notify_all()

        try:
            self._executor.submit(tracked)
        except RuntimeError:
            with self._join_condition:
                self._outstanding -= 1
                self._join_condition.notify_all()
            raise

    def request_stop(self) -> None:
        """Record an st.stop() from a worker. First writer wins."""
        with self._exception_lock:
            if self._worker_exception is None:
                self._worker_exception = StopException()
        self._stop_event.set()
        self.notify_yield_waiters()

    def request_rerun(self, exc: RerunException) -> None:
        """Record an st.rerun(scope='app') from a worker. First writer wins."""
        with self._exception_lock:
            if self._worker_exception is None:
                self._worker_exception = exc
        self._stop_event.set()
        self.notify_yield_waiters()

    def should_stop(self) -> bool:
        """Whether worker threads should cooperatively exit at their next
        yield point.
        """
        return self._stop_event.is_set()

    @property
    def worker_exception(self) -> RerunException | StopException | None:
        """The exception stored by the first worker to call request_stop()
        or request_rerun().
        """
        with self._exception_lock:
            return self._worker_exception

    def _raise_if_worker_exception(self) -> None:
        """Re-raise the stored worker exception if one exists."""
        stored = self.worker_exception
        if stored is not None:
            raise stored

    def notify_yield_waiters(self) -> None:
        """Wake the thread blocked in :meth:`join` so ``yield_check`` runs promptly.

        Called from workers (:meth:`request_stop` / :meth:`request_rerun`) and from
        ``ScriptRunner`` when a rerun/stop request is enqueued from another thread
        while the script thread is blocked inside :meth:`join`.
        """
        with self._join_condition:
            self._join_condition.notify_all()

    def join(self) -> None:
        """Block until all outstanding work completes.

        Uses ``_join_condition`` so the script thread wakes immediately when a
        worker finishes (via ``notify_all`` on ``_outstanding`` decrement) or when
        :meth:`notify_yield_waiters` is called.  Falls back to
        ``poll_interval`` as a worst-case ceiling so ``yield_check()`` still runs
        periodically even when ``_outstanding`` is unchanged (e.g. one slow
        fragment still running).

        If a worker stored an exception, raises it instead of returning normally.
        If join() raises (worker exception or yield-check exception), the
        executor is left running and the caller is responsible for calling
        drain() to shut down in-flight workers.
        """
        while True:
            with self._join_condition:
                if self._outstanding == 0:
                    break
            self._yield_check()
            self._raise_if_worker_exception()
            with self._join_condition:
                if self._outstanding > 0:
                    self._join_condition.wait(timeout=self._poll_interval)
        self._raise_if_worker_exception()
        self._executor.shutdown(wait=False)

    def drain(self) -> None:
        """Cleanup join after cancellation.

        Sets the stop event so workers at their next yield point exit, then
        shuts down the executor synchronously, cancelling queued futures.
        Does NOT call _yield_check — safe to call from except blocks
        without risking recursive RerunException/StopException.
        """
        self._stop_event.set()
        self._executor.shutdown(wait=True, cancel_futures=True)
