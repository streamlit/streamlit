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

"""Unit tests for the app-wide cached-function task manager."""

from __future__ import annotations

import threading
from typing import Any
from unittest.mock import Mock, patch

import pytest

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching.cache_task import Task, _TaskManager, completed_task


class _FakeSession:
    """Stands in for an AppSession: an id plus the threadsafe rerun requests."""

    def __init__(self, session_id: str) -> None:
        self.id = session_id
        self.rerun_requested = threading.Event()
        self.rerun_fragment_ids: list[str] = []

    def request_rerun_threadsafe(self) -> None:
        self.rerun_requested.set()

    def request_fragment_rerun_threadsafe(self, fragment_id: str) -> None:
        self.rerun_fragment_ids.append(fragment_id)
        self.rerun_requested.set()


def _wait_for_settle(manager: _TaskManager, entry: Any) -> None:
    """Block until a task entry leaves the running state."""
    deadline = threading.Event()
    for _ in range(500):
        if entry.snapshot().state != "running":
            return
        deadline.wait(0.01)
    pytest.fail("Task did not settle in time")


def test_completed_task_exposes_a_copy_of_its_value() -> None:
    value = [1, 2, 3]
    task = completed_task(value)

    assert task.done is True
    assert task.running is False
    assert task.error is None
    assert task.result == value
    # Copy-on-read: mutating the result must not corrupt the shared value.
    task.result.append(4)
    assert value == [1, 2, 3]


def test_result_raises_while_running() -> None:
    manager = _TaskManager(max_workers=1)
    release = threading.Event()
    try:
        entry = manager.get_or_submit(
            ("f", "k"), lambda: release.wait(timeout=5), session=None
        )
        task = Task(entry.snapshot())
        assert task.running is True
        with pytest.raises(StreamlitAPIException):
            _ = task.result
    finally:
        release.set()
        manager.shutdown()


def test_second_submission_joins_the_running_task() -> None:
    """Two sessions asking for the same key run the function once and both rerun."""
    manager = _TaskManager(max_workers=2)
    release = threading.Event()
    calls: list[int] = []

    def compute() -> str:
        calls.append(1)
        release.wait(timeout=5)
        return "value"

    session_a = _FakeSession("a")
    session_b = _FakeSession("b")
    try:
        entry_a = manager.get_or_submit(("f", "k"), compute, session=session_a)
        entry_b = manager.get_or_submit(("f", "k"), compute, session=session_b)
        assert entry_a is entry_b

        release.set()
        _wait_for_settle(manager, entry_a)

        assert len(calls) == 1
        assert entry_a.snapshot().state == "done"
        assert session_a.rerun_requested.wait(timeout=5)
        assert session_b.rerun_requested.wait(timeout=5)
    finally:
        release.set()
        manager.shutdown()


def test_successful_task_is_dropped_so_the_next_miss_recomputes() -> None:
    """A settled success leaves the registry; its value lives in the cache instead."""
    manager = _TaskManager(max_workers=1)
    calls: list[int] = []
    try:
        for _ in range(2):
            entry = manager.get_or_submit(
                ("f", "k"), lambda: calls.append(1), session=None
            )
            _wait_for_settle(manager, entry)
        assert len(calls) == 2
    finally:
        manager.shutdown()


def test_failed_task_is_sticky_until_cleared() -> None:
    """A failure is reported through the handle and not retried on every call."""
    manager = _TaskManager(max_workers=1)
    calls: list[int] = []

    def compute() -> None:
        calls.append(1)
        raise ValueError("boom")

    try:
        entry = manager.get_or_submit(("f", "k"), compute, session=None)
        _wait_for_settle(manager, entry)
        task: Task[None] = Task(entry.snapshot())
        assert task.done is False
        assert isinstance(task.error, ValueError)
        with pytest.raises(ValueError, match="boom"):
            _ = task.result

        # Re-asking returns the same failure without rerunning the function.
        manager.get_or_submit(("f", "k"), compute, session=None)
        assert len(calls) == 1

        # Clearing the function's cache is how an app asks for a retry.
        manager.clear("f")
        entry = manager.get_or_submit(("f", "k"), compute, session=None)
        _wait_for_settle(manager, entry)
        assert len(calls) == 2
    finally:
        manager.shutdown()


def test_release_session_reaps_tasks_with_no_other_subscriber() -> None:
    manager = _TaskManager(max_workers=1)
    release = threading.Event()
    session = _FakeSession("a")
    try:
        entry = manager.get_or_submit(
            ("f", "k"), lambda: release.wait(timeout=5), session=session
        )
        assert manager._entries["f", "k"] is entry

        manager.release_session(session.id)
        assert ("f", "k") not in manager._entries
        assert session.id not in manager._sessions
    finally:
        release.set()
        manager.shutdown()


def test_release_session_keeps_tasks_another_session_still_waits_on() -> None:
    manager = _TaskManager(max_workers=1)
    release = threading.Event()
    session_a = _FakeSession("a")
    session_b = _FakeSession("b")
    try:
        manager.get_or_submit(
            ("f", "k"), lambda: release.wait(timeout=5), session=session_a
        )
        manager.get_or_submit(
            ("f", "k"), lambda: release.wait(timeout=5), session=session_b
        )

        manager.release_session(session_a.id)
        assert ("f", "k") in manager._entries

        release.set()
        assert session_b.rerun_requested.wait(timeout=5)
    finally:
        release.set()
        manager.shutdown()


def test_task_requested_inside_a_fragment_reruns_only_that_fragment() -> None:
    manager = _TaskManager(max_workers=1)
    session = _FakeSession("a")
    try:
        with patch(
            "streamlit.runtime.caching.cache_task._current_fragment_id",
            return_value="frag-1",
        ):
            entry = manager.get_or_submit(("f", "k"), lambda: "value", session=session)
        _wait_for_settle(manager, entry)

        assert session.rerun_requested.wait(timeout=5)
        assert session.rerun_fragment_ids == ["frag-1"]
    finally:
        manager.shutdown()


def test_task_requested_outside_a_fragment_reruns_the_whole_app() -> None:
    manager = _TaskManager(max_workers=1)
    session = _FakeSession("a")
    try:
        entry = manager.get_or_submit(("f", "k"), lambda: "value", session=session)
        _wait_for_settle(manager, entry)

        assert session.rerun_requested.wait(timeout=5)
        assert session.rerun_fragment_ids == []
    finally:
        manager.shutdown()


def test_a_key_wanted_by_both_a_fragment_and_the_script_reruns_the_whole_app() -> None:
    """A main-script caller can only be refreshed by a whole-app rerun."""
    manager = _TaskManager(max_workers=1)
    release = threading.Event()
    session = _FakeSession("a")
    try:
        with patch(
            "streamlit.runtime.caching.cache_task._current_fragment_id",
            return_value="frag-1",
        ):
            manager.get_or_submit(
                ("f", "k"), lambda: release.wait(timeout=5), session=session
            )
        entry = manager.get_or_submit(
            ("f", "k"), lambda: release.wait(timeout=5), session=session
        )
        release.set()
        _wait_for_settle(manager, entry)

        assert session.rerun_requested.wait(timeout=5)
        assert session.rerun_fragment_ids == []
    finally:
        release.set()
        manager.shutdown()


def test_rerun_failure_does_not_block_other_subscribers() -> None:
    """One session failing to rerun must not stop the others from being woken."""
    manager = _TaskManager(max_workers=1)
    broken = Mock(
        spec=["id", "request_rerun_threadsafe", "request_fragment_rerun_threadsafe"]
    )
    broken.id = "broken"
    broken.request_rerun_threadsafe.side_effect = RuntimeError("loop closed")
    healthy = _FakeSession("healthy")
    try:
        manager.get_or_submit(("f", "k"), lambda: "value", session=broken)
        entry = manager.get_or_submit(("f", "k"), lambda: "value", session=healthy)
        _wait_for_settle(manager, entry)
        assert healthy.rerun_requested.wait(timeout=5)
    finally:
        manager.shutdown()
