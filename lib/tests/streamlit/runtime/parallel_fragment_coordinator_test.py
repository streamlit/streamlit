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

from __future__ import annotations

import contextvars
import threading
import time

import pytest

from streamlit.runtime.fragment import (
    ParallelFragmentCoordinator,
    _run_parallel_fragment,
)
from streamlit.runtime.scriptrunner_utils.exceptions import (
    RerunException,
    StopException,
)
from streamlit.runtime.scriptrunner_utils.script_requests import RerunData


def _noop_yield_check() -> None:
    pass


def test_join_returns_immediately_when_no_workers() -> None:
    """join() with no submitted workers should return without blocking."""
    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    coordinator.join()


def test_join_waits_for_submitted_workers() -> None:
    """join() should block until all submitted workers have completed."""
    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    results: list[str] = []

    def worker() -> None:
        time.sleep(0.1)
        results.append("done")

    coordinator.submit(worker)
    coordinator.join()
    assert results == ["done"]


def test_request_stop_sets_event() -> None:
    """request_stop() should set the stop event so should_stop() returns True."""
    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    assert not coordinator.should_stop()
    coordinator.request_stop()
    assert coordinator.should_stop()


def test_request_stop_stores_stop_exception() -> None:
    """request_stop() should store a StopException as worker_exception."""
    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    assert coordinator.worker_exception is None
    coordinator.request_stop()
    assert isinstance(coordinator.worker_exception, StopException)


def test_request_rerun_stores_exception() -> None:
    """request_rerun() should store the RerunException and set stop event."""
    from streamlit.runtime.scriptrunner_utils.script_requests import RerunData

    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    exc = RerunException(RerunData())
    coordinator.request_rerun(exc)
    assert coordinator.should_stop()
    assert coordinator.worker_exception is exc


def test_first_writer_wins() -> None:
    """Only the first exception should be stored (first-writer-wins)."""
    from streamlit.runtime.scriptrunner_utils.script_requests import RerunData

    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    first_exc = RerunException(RerunData())
    coordinator.request_rerun(first_exc)
    coordinator.request_stop()
    assert coordinator.worker_exception is first_exc


def test_join_calls_yield_check_when_workers_alive() -> None:
    """join() should invoke yield_check while waiting for workers."""
    call_count = 0

    def counting_yield_check() -> None:
        nonlocal call_count
        call_count += 1

    coordinator = ParallelFragmentCoordinator(
        yield_check=counting_yield_check, poll_interval=0.01
    )
    coordinator.submit(lambda: time.sleep(0.05))
    coordinator.join()
    assert call_count > 0


def test_join_raises_worker_exception() -> None:
    """join() should raise if a worker stored an exception."""
    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )

    def worker() -> None:
        coordinator.request_stop()

    coordinator.submit(worker)
    with pytest.raises(StopException):
        coordinator.join()


def test_worker_exception_propagates_rerun() -> None:
    """join() should propagate a RerunException from a worker."""
    from streamlit.runtime.scriptrunner_utils.script_requests import RerunData

    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    exc = RerunException(RerunData())

    def worker() -> None:
        coordinator.request_rerun(exc)

    coordinator.submit(worker)
    with pytest.raises(RerunException) as exc_info:
        coordinator.join()
    assert exc_info.value is exc


def test_yield_check_exception_propagates() -> None:
    """If yield_check raises, the exception should propagate from join()."""

    class YieldInterrupt(Exception):
        pass

    def raising_yield_check() -> None:
        raise YieldInterrupt("stop")

    coordinator = ParallelFragmentCoordinator(
        yield_check=raising_yield_check, poll_interval=0.01
    )
    coordinator.submit(lambda: time.sleep(1.0))

    with pytest.raises(YieldInterrupt):
        coordinator.join()

    coordinator.drain()


def test_multiple_workers_all_joined() -> None:
    """All submitted workers should complete before join() returns."""
    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    results: list[int] = []
    lock = threading.Lock()

    def worker(idx: int) -> None:
        time.sleep(0.05 * idx)
        with lock:
            results.append(idx)

    for i in range(3):
        coordinator.submit(worker, i)

    coordinator.join()
    assert sorted(results) == [0, 1, 2]


def test_u17_cooperative_cancellation_blocks_join_until_thread_finishes() -> None:
    """U17: cancel() does not interrupt a worker sleeping — join waits ~sleep duration."""
    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    started = threading.Event()

    def slow_worker() -> None:
        started.set()
        time.sleep(0.35)

    thread = threading.Thread(target=slow_worker)
    coordinator.register(thread)
    thread.start()
    assert started.wait(timeout=5.0)
    coordinator.cancel()
    t0 = time.monotonic()
    coordinator.join()
    assert time.monotonic() - t0 >= 0.25


def test_u18_parallel_worker_stop_cancels_coordinator() -> None:
    """U18: StopException from a parallel worker triggers coordinator cancellation."""

    def wrapped() -> None:
        raise StopException()

    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    parent_context = contextvars.Context()

    runner = threading.Thread(
        target=_run_parallel_fragment,
        args=(
            coordinator,
            wrapped,
            "fragment-u18",
            parent_context,
        ),
    )
    runner.start()
    runner.join(timeout=5.0)
    assert coordinator.is_cancelled()


def test_u19_app_rerun_exception_cancels_coordinator() -> None:
    """U19: RerunException without fragment queue cancels coordinator (app-scope rerun)."""

    def wrapped() -> None:
        raise RerunException(RerunData())

    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    parent_context = contextvars.Context()

    runner = threading.Thread(
        target=_run_parallel_fragment,
        args=(
            coordinator,
            wrapped,
            "fragment-u19",
            parent_context,
        ),
    )
    runner.start()
    runner.join(timeout=5.0)
    assert coordinator.is_cancelled()


def test_u20_fragment_scoped_rerun_reruns_without_cancelling_coordinator() -> None:
    """U20: Fragment-scoped rerun loops on the same thread until success."""
    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    calls: list[int] = []

    def wrapped() -> None:
        calls.append(1)
        if len(calls) == 1:
            raise RerunException(RerunData(fragment_id_queue=["nested"]))

    parent_context = contextvars.Context()
    runner = threading.Thread(
        target=_run_parallel_fragment,
        args=(
            coordinator,
            wrapped,
            "fragment-u20",
            parent_context,
        ),
    )
    runner.start()
    runner.join(timeout=5.0)

    assert len(calls) == 2
    assert not coordinator.is_cancelled()


def test_drain_stops_workers() -> None:
    """drain() should set stop event and wait for running workers."""
    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    stopped = threading.Event()

    def worker() -> None:
        while not coordinator.should_stop():
            time.sleep(0.01)
        stopped.set()

    coordinator.submit(worker)
    time.sleep(0.05)
    coordinator.drain()
    assert stopped.is_set()


def test_outstanding_counter_with_nested_submit() -> None:
    """Outstanding counter handles submissions from within a submitted task."""
    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    results: list[str] = []
    lock = threading.Lock()

    def inner() -> None:
        time.sleep(0.05)
        with lock:
            results.append("inner")

    def outer() -> None:
        coordinator.submit(inner)
        with lock:
            results.append("outer")

    coordinator.submit(outer)
    coordinator.join()
    assert sorted(results) == ["inner", "outer"]


def test_max_workers_parameter() -> None:
    """max_workers should be passed to the ThreadPoolExecutor."""
    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, max_workers=2, poll_interval=0.01
    )
    active = threading.Semaphore(0)
    results: list[int] = []
    lock = threading.Lock()

    def worker(idx: int) -> None:
        active.release()
        time.sleep(0.05)
        with lock:
            results.append(idx)

    for i in range(4):
        coordinator.submit(worker, i)

    coordinator.join()
    assert sorted(results) == [0, 1, 2, 3]
