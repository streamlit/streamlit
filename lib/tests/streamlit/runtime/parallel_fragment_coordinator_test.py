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

"""Tests for ParallelFragmentCoordinator.

The coordinator owns a ThreadPoolExecutor plus the bookkeeping that lets the
script thread block on outstanding worker fragments and surface
worker-initiated rerun/stop intent. These tests exercise the public surface
in isolation; integration with ScriptRunContext / ScriptRunner lives in
``script_runner_test.py`` and ``script_run_context_test.py``.
"""

from __future__ import annotations

import threading
import time
from unittest.mock import MagicMock

import pytest

from streamlit.runtime.parallel_coordinator import ParallelFragmentCoordinator
from streamlit.runtime.scriptrunner_utils.exceptions import (
    RerunException,
    StopException,
)
from streamlit.runtime.scriptrunner_utils.script_requests import RerunData
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    SCRIPT_RUN_CONTEXT_ATTR_NAME,
    ThreadState,
    get_script_run_ctx,
)


def _wait_for_outstanding_zero(
    c: ParallelFragmentCoordinator, timeout: float = 1.0
) -> None:
    """Spin-wait until the coordinator's outstanding counter drains to zero.

    Used by tests that submit a worker but don't drive ``join()`` themselves;
    the executor's ``finally`` block runs asynchronously so we need to poll.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with c._join_condition:
            if c._outstanding == 0:
                return
        time.sleep(0.01)
    with c._join_condition:
        last_value = c._outstanding
    raise AssertionError(
        f"outstanding never reached 0 within {timeout}s (last value: {last_value})"
    )


@pytest.fixture
def coordinator():
    """Yield a coordinator with a no-op yield check; drain on teardown."""
    c = ParallelFragmentCoordinator(yield_check=lambda: None)
    yield c
    c.drain()


@pytest.fixture
def _attach_mock_ctx():
    """Set a MagicMock as the current thread's ScriptRunContext and
    initialize ThreadState for tests that exercise submit() propagation.
    Cleans up on teardown.
    """
    main_thread = threading.current_thread()
    setattr(main_thread, SCRIPT_RUN_CONTEXT_ATTR_NAME, MagicMock())
    ThreadState.initialize()
    yield
    try:
        delattr(main_thread, SCRIPT_RUN_CONTEXT_ATTR_NAME)
    except AttributeError:
        pass


# --- Construction ---


def test_construction_defaults(coordinator):
    """A freshly constructed coordinator is idle: no outstanding work,
    no captured worker exception, no stop requested."""
    assert coordinator._outstanding == 0
    assert coordinator.worker_exception is None
    assert coordinator.should_stop() is False


@pytest.mark.parametrize("bad_value", [0, -1, -100])
def test_construction_rejects_non_positive_max_workers(bad_value):
    """max_workers must be None or a positive integer."""
    with pytest.raises(ValueError, match="positive integer"):
        ParallelFragmentCoordinator(yield_check=lambda: None, max_workers=bad_value)


# --- Submit / counter ---


def test_submit_counter_round_trip(coordinator):
    """submit() must restore _outstanding to zero even when the worker
    raises, otherwise join() would hang forever on a worker error."""

    def explodes() -> None:
        raise ValueError("boom")

    coordinator.submit(explodes)
    _wait_for_outstanding_zero(coordinator)
    assert coordinator._outstanding == 0


def test_submit_passes_args(coordinator):
    """submit() forwards positional args to the worker function so
    callers can capture per-fragment context."""
    captured: list[tuple[int, str]] = []
    done = threading.Event()

    def worker(value: int, label: str) -> None:
        captured.append((value, label))
        done.set()

    coordinator.submit(worker, 42, "hello")
    assert done.wait(timeout=1.0)
    _wait_for_outstanding_zero(coordinator)
    assert captured == [(42, "hello")]


def test_submit_after_shutdown_rolls_back_outstanding():
    """If ``submit()`` races with a concurrent ``drain()`` and the
    executor is already shut down, the outstanding counter must be
    rolled back so a subsequent ``join()`` doesn't hang."""
    c = ParallelFragmentCoordinator(yield_check=lambda: None)
    c.drain()
    with pytest.raises(RuntimeError):
        c.submit(lambda: None)
    assert c._outstanding == 0


def test_nested_submit_counter():
    """A worker that calls submit() must increment the counter before
    the parent's tracked() finally runs, so join() waits for the
    grandchild rather than returning when the parent finishes."""
    c = ParallelFragmentCoordinator(yield_check=lambda: None, poll_interval=0.01)
    child_done = threading.Event()

    def parent() -> None:
        c.submit(lambda: child_done.set())

    c.submit(parent)
    c.join()
    assert child_done.is_set()


# --- Join ---


def test_join_returns_immediately_when_idle():
    """If no work was submitted, join() must not invoke yield_check.

    Calling yield_check with no outstanding work could surface external
    cancellation requests at the wrong time relative to the script
    runner's existing yield logic.
    """
    yields: list[int] = []
    c = ParallelFragmentCoordinator(yield_check=lambda: yields.append(1))
    c.join()
    assert yields == []


def test_join_waits_and_yields():
    """While work is outstanding, join() polls and calls yield_check
    each interval so the script thread stays responsive."""
    yields: list[int] = []
    c = ParallelFragmentCoordinator(
        yield_check=lambda: yields.append(1),
        poll_interval=0.01,
    )
    gate = threading.Event()
    c.submit(lambda: gate.wait(timeout=2.0))
    threading.Timer(0.05, gate.set).start()
    c.join()
    assert len(yields) >= 1


def test_join_raises_stored_rerun_exception_with_data():
    """A worker's RerunException must surface from join() with its
    original RerunData attached so the script runner's rerun loop sees
    the correct request."""
    rerun_data = RerunData()
    c = ParallelFragmentCoordinator(yield_check=lambda: None)
    c.request_rerun(RerunException(rerun_data))
    with pytest.raises(RerunException) as excinfo:
        c.join()
    assert excinfo.value.rerun_data is rerun_data


def test_join_raises_stored_stop_exception():
    """request_stop() stores a StopException that join() re-raises."""
    c = ParallelFragmentCoordinator(yield_check=lambda: None)
    c.request_stop()
    with pytest.raises(StopException):
        c.join()


def test_join_after_drain_is_safe():
    """drain() shuts the executor down; calling join() afterwards on
    an idle coordinator must not crash."""
    c = ParallelFragmentCoordinator(yield_check=lambda: None)
    c.drain()
    c.join()


def test_join_propagates_yield_check_exception():
    """If yield_check raises (e.g. an external RERUN arrived while
    join() was polling), the exception must propagate so the caller's
    try/except can run drain()."""

    def yield_raises() -> None:
        raise RerunException(RerunData())

    c = ParallelFragmentCoordinator(yield_check=yield_raises, poll_interval=0.01)
    gate = threading.Event()
    c.submit(lambda: gate.wait(timeout=2.0))
    try:
        with pytest.raises(RerunException):
            c.join()
    finally:
        gate.set()
        c.drain()


def test_yield_check_exception_preempts_stored_worker_exception():
    """If both ``_yield_check`` raises and a worker exception is already
    stored, the yield-check exception wins because ``join()`` calls
    ``_yield_check()`` before checking ``worker_exception``. This pins
    the precedence ordering — symmetric to the script-thread branch
    contract where the worker exception wins over an external
    ``ScriptRequests`` entry.
    """
    external_rerun = RerunException(RerunData(query_string="external"))

    def yield_raises() -> None:
        raise external_rerun

    c = ParallelFragmentCoordinator(yield_check=yield_raises, poll_interval=0.01)
    worker_rerun = RerunException(RerunData(query_string="from_worker"))
    c.request_rerun(worker_rerun)
    gate = threading.Event()
    c.submit(lambda: gate.wait(timeout=2.0))
    try:
        with pytest.raises(RerunException) as excinfo:
            c.join()
        assert excinfo.value is external_rerun
    finally:
        gate.set()
        c.drain()


# --- First-writer-wins ---


def test_first_writer_wins_rerun_then_stop():
    """The first request_rerun/request_stop wins; later calls are
    ignored. Both unconditionally set the stop event."""
    c = ParallelFragmentCoordinator(yield_check=lambda: None)
    try:
        assert not c.should_stop()
        rerun_exc = RerunException(RerunData())
        c.request_rerun(rerun_exc)
        c.request_stop()
        assert c.worker_exception is rerun_exc
        assert c.should_stop() is True
    finally:
        c.drain()


def test_first_writer_wins_stop_then_rerun():
    """Symmetric to test_first_writer_wins_rerun_then_stop: first
    request_stop wins over a later request_rerun."""
    c = ParallelFragmentCoordinator(yield_check=lambda: None)
    try:
        c.request_stop()
        assert isinstance(c.worker_exception, StopException)
        c.request_rerun(RerunException(RerunData()))
        assert isinstance(c.worker_exception, StopException)
        assert c.should_stop() is True
    finally:
        c.drain()


# --- Drain ---


def test_drain_silent_and_synchronous():
    """drain() must not call yield_check (it's invoked from except
    blocks where re-raising would shadow the original exception) and
    must wait synchronously for in-flight workers to exit."""
    yields: list[int] = []
    c = ParallelFragmentCoordinator(yield_check=lambda: yields.append(1))
    gate = threading.Event()
    worker_done = threading.Event()

    def worker() -> None:
        gate.wait(timeout=2.0)
        worker_done.set()

    c.submit(worker)
    threading.Timer(0.05, gate.set).start()
    c.drain()
    assert worker_done.is_set()
    assert yields == []


def test_drain_sets_stop_event():
    """drain() must set the stop event so any worker that reaches a
    yield point during drain notices and exits cooperatively."""
    c = ParallelFragmentCoordinator(yield_check=lambda: None)
    assert not c.should_stop()
    c.drain()
    assert c.should_stop()


# --- submit() propagation ---


@pytest.mark.usefixtures("_attach_mock_ctx")
def test_submit_propagates_ctx_to_worker():
    """submit() captures the parent's ScriptRunContext at submit time
    and the worker sees it via get_script_run_ctx()."""
    mock_ctx = MagicMock()
    main_thread = threading.current_thread()
    setattr(main_thread, SCRIPT_RUN_CONTEXT_ATTR_NAME, mock_ctx)

    c = ParallelFragmentCoordinator(yield_check=lambda: None)
    holder: list[object] = []
    done = threading.Event()

    def worker() -> None:
        holder.append(get_script_run_ctx())
        done.set()

    try:
        c.submit(worker)
        assert done.wait(timeout=1.0)
        _wait_for_outstanding_zero(c)
        assert holder[0] is mock_ctx
    finally:
        c.drain()


@pytest.mark.usefixtures("_attach_mock_ctx")
def test_submit_propagates_thread_state_to_worker():
    """submit() captures the parent's ContextVars (including
    FragmentThreadState) so the worker sees the parent's snapshot."""
    ThreadState.initialize(fragment_id="parent_frag", active_script_hash="abc")

    c = ParallelFragmentCoordinator(yield_check=lambda: None)
    holder: list[object] = []
    done = threading.Event()

    def worker() -> None:
        holder.append(ThreadState.get())
        done.set()

    try:
        c.submit(worker)
        assert done.wait(timeout=1.0)
        _wait_for_outstanding_zero(c)
        ts = holder[0]
        assert ts.fragment_id == "parent_frag"
        assert ts.active_script_hash == "abc"
    finally:
        c.drain()


@pytest.mark.usefixtures("_attach_mock_ctx")
def test_submit_isolates_worker_thread_state_writes():
    """Worker-side ThreadState.update() writes stay local to the
    captured copy_context() and never leak back to the parent."""
    ThreadState.initialize(fragment_id="parent_frag", active_script_hash="abc")

    c = ParallelFragmentCoordinator(yield_check=lambda: None)
    done = threading.Event()

    def worker() -> None:
        ThreadState.update(fragment_id="worker_frag")
        done.set()

    try:
        c.submit(worker)
        assert done.wait(timeout=1.0)
        _wait_for_outstanding_zero(c)
        assert ThreadState.get().fragment_id == "parent_frag"
    finally:
        c.drain()


def test_submit_clears_ctx_attribute_between_pool_submissions():
    """With max_workers=1, two submissions with different ctxs each
    see the correct ctx, and the pool thread's attribute is cleaned
    up after both complete."""
    main_thread = threading.current_thread()
    ThreadState.initialize()

    ctx_a = MagicMock(name="ctx_a")
    ctx_b = MagicMock(name="ctx_b")

    c = ParallelFragmentCoordinator(yield_check=lambda: None, max_workers=1)
    holder_a: list[object] = []
    holder_b: list[object] = []
    pool_thread_ref: list[threading.Thread] = []
    gate = threading.Event()
    done_a = threading.Event()
    done_b = threading.Event()

    def worker_a() -> None:
        holder_a.append(get_script_run_ctx())
        pool_thread_ref.append(threading.current_thread())
        gate.wait(timeout=2.0)
        done_a.set()

    def worker_b() -> None:
        holder_b.append(get_script_run_ctx())
        done_b.set()

    try:
        setattr(main_thread, SCRIPT_RUN_CONTEXT_ATTR_NAME, ctx_a)
        c.submit(worker_a)
        gate.set()
        assert done_a.wait(timeout=1.0)
        _wait_for_outstanding_zero(c)

        setattr(main_thread, SCRIPT_RUN_CONTEXT_ATTR_NAME, ctx_b)
        c.submit(worker_b)
        assert done_b.wait(timeout=1.0)
        _wait_for_outstanding_zero(c)

        assert holder_a[0] is ctx_a
        assert holder_b[0] is ctx_b

        pool_thread = pool_thread_ref[0]
        remaining = getattr(pool_thread, SCRIPT_RUN_CONTEXT_ATTR_NAME, None)
        assert remaining is not ctx_a
        assert remaining is not ctx_b
    finally:
        delattr(main_thread, SCRIPT_RUN_CONTEXT_ATTR_NAME)
        c.drain()


def test_submit_with_max_workers_1_serializes_distinct_thread_states():
    """With max_workers=1, two submissions see their respective
    parent ThreadState snapshots, not each other's."""
    main_thread = threading.current_thread()
    setattr(main_thread, SCRIPT_RUN_CONTEXT_ATTR_NAME, MagicMock())

    c = ParallelFragmentCoordinator(yield_check=lambda: None, max_workers=1)
    holder_a: list[object] = []
    holder_b: list[object] = []
    done_a = threading.Event()
    done_b = threading.Event()

    def worker_a() -> None:
        holder_a.append(ThreadState.get())
        done_a.set()

    def worker_b() -> None:
        holder_b.append(ThreadState.get())
        done_b.set()

    try:
        ThreadState.initialize(fragment_id="state_a", active_script_hash="hash_a")
        c.submit(worker_a)
        assert done_a.wait(timeout=1.0)
        _wait_for_outstanding_zero(c)

        ThreadState.update(fragment_id="state_b", active_script_hash="hash_b")
        c.submit(worker_b)
        assert done_b.wait(timeout=1.0)
        _wait_for_outstanding_zero(c)

        ts_a = holder_a[0]
        assert ts_a.fragment_id == "state_a"
        assert ts_a.active_script_hash == "hash_a"

        ts_b = holder_b[0]
        assert ts_b.fragment_id == "state_b"
        assert ts_b.active_script_hash == "hash_b"
    finally:
        delattr(main_thread, SCRIPT_RUN_CONTEXT_ATTR_NAME)
        c.drain()
