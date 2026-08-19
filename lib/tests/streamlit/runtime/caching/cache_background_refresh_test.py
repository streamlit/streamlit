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

"""Unit tests for the shared background-refresh executor."""

from __future__ import annotations

import threading
import time
from unittest.mock import Mock, patch

from streamlit.runtime.caching.cache_background_refresh import _BackgroundRefreshManager


def test_submit_runs_task_and_releases_slot() -> None:
    """A submitted task runs on the pool and its semaphore slot is released afterwards."""
    manager = _BackgroundRefreshManager(max_workers=2)
    done = threading.Event()
    try:
        assert manager.submit(done.set) is True
        assert done.wait(timeout=5)

        # Poll until the slot is released (release happens in the worker's finally).
        deadline = time.time() + 5
        while manager._slots._value != 2 and time.time() < deadline:
            time.sleep(0.01)
        assert manager._slots._value == 2
    finally:
        manager.shutdown()


def test_submit_skips_when_saturated() -> None:
    """When every worker slot is taken, submit returns False without queueing."""
    manager = _BackgroundRefreshManager(max_workers=2)
    try:
        # Occupy both slots so no worker is available.
        assert manager._slots.acquire(blocking=False) is True
        assert manager._slots.acquire(blocking=False) is True

        ran = Mock()
        assert manager.submit(ran) is False
        ran.assert_not_called()

        # Freeing a slot lets a subsequent submit succeed again.
        manager._slots.release()
        done = threading.Event()
        assert manager.submit(done.set) is True
        assert done.wait(timeout=5)
    finally:
        manager.shutdown()


def test_submit_degrades_when_threads_unavailable() -> None:
    """A RuntimeError starting a thread latches degradation; later submits skip safely."""
    manager = _BackgroundRefreshManager(max_workers=2)
    try:
        # Simulate a runtime that forbids thread creation.
        failing_executor = Mock()
        failing_executor.submit.side_effect = RuntimeError("can't start new thread")
        manager._executor = failing_executor

        ran = Mock()
        assert manager.submit(ran) is False
        assert manager.threads_unavailable is True
        ran.assert_not_called()
        # The slot acquired for the failed submission must be released again.
        assert manager._slots._value == 2

        # Once degraded, further submissions are skipped without touching the executor.
        failing_executor.submit.reset_mock()
        assert manager.submit(Mock()) is False
        failing_executor.submit.assert_not_called()
    finally:
        manager.shutdown()


def test_submit_releases_slot_on_unexpected_schedule_error() -> None:
    """Non-RuntimeError scheduling failures release the slot without latching degradation."""
    manager = _BackgroundRefreshManager(max_workers=2)
    try:
        failing_executor = Mock()
        failing_executor.submit.side_effect = ValueError("pool exploded")
        manager._executor = failing_executor

        ran = Mock()
        assert manager.submit(ran) is False
        assert manager.threads_unavailable is False
        ran.assert_not_called()
        assert manager._slots._value == 2
    finally:
        manager.shutdown()


def test_slot_released_on_task_failure() -> None:
    """A task that raises still releases its semaphore slot."""
    manager = _BackgroundRefreshManager(max_workers=1)
    finished = threading.Event()

    def boom() -> None:
        try:
            raise RuntimeError("boom")
        finally:
            finished.set()

    try:
        assert manager.submit(boom) is True
        assert finished.wait(timeout=5)

        # The single slot should become available again despite the failure.
        deadline = time.time() + 5
        while manager._slots._value != 1 and time.time() < deadline:
            time.sleep(0.01)
        assert manager._slots._value == 1

        # The pool is still usable after a failed task.
        done = threading.Event()
        assert manager.submit(done.set) is True
        assert done.wait(timeout=5)
    finally:
        manager.shutdown()


def test_shutdown_resets_state() -> None:
    """shutdown() clears the degradation latch and restores all slots."""
    manager = _BackgroundRefreshManager(max_workers=2)
    manager._threads_unavailable = True
    manager._slots.acquire(blocking=False)

    manager.shutdown()

    assert manager.threads_unavailable is False
    assert manager._slots._value == 2


def test_pool_size_read_from_config() -> None:
    """The config-backed manager reads its pool size from config on first use."""
    manager = _BackgroundRefreshManager()
    try:
        with patch("streamlit.config.get_option", return_value=7) as get_option:
            manager._ensure_initialized()
        get_option.assert_called_once_with("runner.cacheBackgroundRefreshMaxWorkers")
        assert manager._max_workers == 7
        assert manager._slots is not None
        assert manager._slots._value == 7
    finally:
        manager.shutdown()


def test_zero_workers_disables_background_refresh() -> None:
    """A configured pool size of 0 disables background refresh: submit always skips."""
    manager = _BackgroundRefreshManager()
    ran = Mock()
    try:
        with patch("streamlit.config.get_option", return_value=0):
            assert manager.submit(ran) is False
        ran.assert_not_called()
        assert manager._slots is None
    finally:
        manager.shutdown()
