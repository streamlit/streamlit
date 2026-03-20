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

import threading
import time

import pytest

from streamlit.runtime.fragment import ParallelFragmentCoordinator


def _noop_yield_check() -> None:
    pass


def test_join_returns_immediately_when_no_threads() -> None:
    """join() with no registered threads should return without blocking."""
    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    coordinator.join()


def test_join_waits_for_registered_threads() -> None:
    """join() should block until all registered threads have completed."""
    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    results: list[str] = []

    def worker() -> None:
        time.sleep(0.1)
        results.append("done")

    thread = threading.Thread(target=worker)
    coordinator.register(thread)
    thread.start()

    coordinator.join()
    assert results == ["done"]


def test_cancel_sets_event() -> None:
    """cancel() should set the cancel event so is_cancelled() returns True."""
    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    assert not coordinator.is_cancelled()
    coordinator.cancel()
    assert coordinator.is_cancelled()


def test_join_calls_yield_check_when_threads_alive() -> None:
    """join() should invoke yield_check while waiting for threads."""
    call_count = 0

    def counting_yield_check() -> None:
        nonlocal call_count
        call_count += 1

    coordinator = ParallelFragmentCoordinator(
        yield_check=counting_yield_check, poll_interval=0.01
    )

    thread = threading.Thread(target=lambda: time.sleep(0.05))
    coordinator.register(thread)
    thread.start()

    coordinator.join()
    assert call_count > 0


def test_join_skips_yield_check_when_cancelled() -> None:
    """join() with cancelled coordinator should not call yield_check."""
    call_count = 0

    def counting_yield_check() -> None:
        nonlocal call_count
        call_count += 1

    coordinator = ParallelFragmentCoordinator(
        yield_check=counting_yield_check, poll_interval=0.01
    )

    thread = threading.Thread(target=lambda: time.sleep(0.05))
    coordinator.register(thread)
    thread.start()
    coordinator.cancel()

    coordinator.join()
    assert call_count == 0


def test_join_without_check_requests_skips_yield_check() -> None:
    """join(check_requests=False) should never call yield_check."""
    call_count = 0

    def counting_yield_check() -> None:
        nonlocal call_count
        call_count += 1

    coordinator = ParallelFragmentCoordinator(
        yield_check=counting_yield_check, poll_interval=0.01
    )

    thread = threading.Thread(target=lambda: time.sleep(0.05))
    coordinator.register(thread)
    thread.start()

    coordinator.join(check_requests=False)
    assert call_count == 0


def test_yield_check_exception_propagates() -> None:
    """If yield_check raises, the exception should propagate from join()."""

    class YieldInterrupt(Exception):
        pass

    def raising_yield_check() -> None:
        raise YieldInterrupt("stop")

    coordinator = ParallelFragmentCoordinator(
        yield_check=raising_yield_check, poll_interval=0.01
    )

    thread = threading.Thread(target=lambda: time.sleep(1.0))
    coordinator.register(thread)
    thread.start()

    with pytest.raises(YieldInterrupt):
        coordinator.join()

    coordinator.cancel()
    thread.join(timeout=2.0)


def test_multiple_threads_all_joined() -> None:
    """All registered threads should be joined before join() returns."""
    coordinator = ParallelFragmentCoordinator(
        yield_check=_noop_yield_check, poll_interval=0.01
    )
    results: list[int] = []
    lock = threading.Lock()

    def worker(idx: int) -> None:
        time.sleep(0.05 * idx)
        with lock:
            results.append(idx)

    threads = []
    for i in range(3):
        t = threading.Thread(target=worker, args=(i,))
        coordinator.register(t)
        threads.append(t)

    for t in threads:
        t.start()

    coordinator.join()
    assert sorted(results) == [0, 1, 2]
