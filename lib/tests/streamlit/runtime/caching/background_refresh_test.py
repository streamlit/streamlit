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

"""Tests for the background refresh coordinator."""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING

import pytest

from streamlit.runtime.caching.background_refresh import (
    _DEFAULT_MAX_WORKERS,
    BackgroundRefreshCoordinator,
)

if TYPE_CHECKING:
    from collections.abc import Iterator


@pytest.fixture
def coordinator() -> Iterator[BackgroundRefreshCoordinator]:
    """Provide a fresh coordinator and shut it down after the test."""
    coord = BackgroundRefreshCoordinator()
    try:
        yield coord
    finally:
        coord.shutdown()


def test_runs_refresh_in_background(
    coordinator: BackgroundRefreshCoordinator,
) -> None:
    """A scheduled refresh function is executed."""
    done = threading.Event()
    coordinator.schedule("key", done.set)
    assert done.wait(timeout=2)


def test_clears_in_flight_after_completion(
    coordinator: BackgroundRefreshCoordinator,
) -> None:
    """After a refresh finishes, the key is removed from the in-flight set."""
    done = threading.Event()
    coordinator.schedule("key", done.set)
    assert done.wait(timeout=2)

    # Wait briefly for the finally block to clear the in-flight set.
    for _ in range(100):
        if "key" not in coordinator._in_flight:
            break
        threading.Event().wait(0.01)
    assert "key" not in coordinator._in_flight


def test_deduplicates_concurrent_refreshes(
    coordinator: BackgroundRefreshCoordinator,
) -> None:
    """Only one refresh runs per key while a refresh is already in flight."""
    started = threading.Event()
    release = threading.Event()
    call_count = [0]

    def slow_refresh() -> None:
        call_count[0] += 1
        started.set()
        release.wait(timeout=2)

    # First schedule starts and blocks inside slow_refresh.
    coordinator.schedule("key", slow_refresh)
    assert started.wait(timeout=2)

    # Subsequent schedules for the same key while in flight are no-ops.
    coordinator.schedule("key", slow_refresh)
    coordinator.schedule("key", slow_refresh)

    release.set()

    # Give the worker time to finish.
    for _ in range(100):
        if "key" not in coordinator._in_flight:
            break
        threading.Event().wait(0.01)

    assert call_count[0] == 1


def test_different_keys_run_independently(
    coordinator: BackgroundRefreshCoordinator,
) -> None:
    """Refreshes for different keys are not deduplicated against each other."""
    done_a = threading.Event()
    done_b = threading.Event()
    coordinator.schedule("a", done_a.set)
    coordinator.schedule("b", done_b.set)
    assert done_a.wait(timeout=2)
    assert done_b.wait(timeout=2)


def test_sync_fallback_when_threads_unavailable(
    coordinator: BackgroundRefreshCoordinator,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If submitting to the executor fails, the refresh runs synchronously."""

    class _FailingExecutor:
        def submit(self, *args: object, **kwargs: object) -> None:
            raise RuntimeError("can't start new thread")

    monkeypatch.setattr(coordinator, "_get_executor", lambda: _FailingExecutor())

    ran_on: list[int] = []
    main_thread = threading.get_ident()

    def refresh() -> None:
        ran_on.append(threading.get_ident())

    coordinator.schedule("key", refresh)

    # Ran synchronously on the calling thread.
    assert ran_on == [main_thread]
    # The coordinator remembers threading is unavailable.
    assert coordinator._threading_available is False

    # A subsequent schedule also runs synchronously.
    coordinator.schedule("key2", refresh)
    assert ran_on == [main_thread, main_thread]


def test_shutdown_resets_state(
    coordinator: BackgroundRefreshCoordinator,
) -> None:
    """shutdown clears the in-flight set and the executor."""
    done = threading.Event()
    coordinator.schedule("key", done.set)
    assert done.wait(timeout=2)

    coordinator.shutdown()
    assert coordinator._executor is None
    assert coordinator._in_flight == set()


def test_executor_respects_configured_max_workers(
    coordinator: BackgroundRefreshCoordinator,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The executor uses runner.cacheRefreshMaxWorkers when it is a positive int."""
    monkeypatch.setattr(
        "streamlit.config.get_option",
        lambda name: 7 if name == "runner.cacheRefreshMaxWorkers" else None,
    )
    assert coordinator._get_executor()._max_workers == 7


@pytest.mark.parametrize("invalid_value", [None, 0, -3])
def test_executor_falls_back_to_default_for_invalid_config(
    coordinator: BackgroundRefreshCoordinator,
    monkeypatch: pytest.MonkeyPatch,
    invalid_value: int | None,
) -> None:
    """Invalid worker counts fall back to the default instead of raising."""
    monkeypatch.setattr(
        "streamlit.config.get_option",
        lambda name: invalid_value if name == "runner.cacheRefreshMaxWorkers" else None,
    )
    assert coordinator._get_executor()._max_workers == _DEFAULT_MAX_WORKERS
