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

"""ScriptRunners sharing one session rerun mailbox, as AppSession runs them."""

from __future__ import annotations

import asyncio
import os
import time
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock

import pytest

from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime import Runtime
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner import RerunData, ScriptRunner, ScriptRunnerEvent
from streamlit.runtime.scriptrunner.script_cache import ScriptCache
from streamlit.runtime.scriptrunner_utils.session_rerun_coordinator import (
    AcceptDecision,
    RunGenerationLease,
    SessionRerunCoordinator,
)
from streamlit.runtime.state.session_state import SessionState

if TYPE_CHECKING:
    from collections.abc import Callable, Iterator

_SCRIPT_PATH = os.path.join(
    os.path.dirname(__file__), "test_data", "mailbox_callbacks.py"
)
_TIMEOUT_SECS = 5


class _Session:
    """The AppSession-owned objects that successive runners share."""

    def __init__(self) -> None:
        self.session_state = SessionState()
        self.coordinator = SessionRerunCoordinator(
            widget_has_callback=self.session_state.widget_has_callback
        )
        self.fragment_storage = MemoryFragmentStorage()
        self.script_cache = ScriptCache()
        self.pages_manager = PagesManager(_SCRIPT_PATH, self.script_cache)
        self.runners: list[_Runner] = []

    def accept(self, rerun_data: RerunData) -> AcceptDecision:
        decision = self.coordinator.accept(rerun_data, fast_reruns=True)
        if decision.run_generation is not None:
            self.start_runner(decision.run_generation)
        return decision.kind

    def start_runner(self, run_generation: RunGenerationLease) -> _Runner:
        runner = _Runner(self, run_generation)
        self.runners.append(runner)
        runner.start()
        return runner

    def join_all(self) -> None:
        for runner in self.runners:
            runner.join()


class _Runner(ScriptRunner):
    def __init__(self, session: _Session, run_generation: RunGenerationLease) -> None:
        self._test_loop = asyncio.new_event_loop()
        super().__init__(
            session_id="test session id",
            main_script_path=_SCRIPT_PATH,
            session_state=session.session_state,
            uploaded_file_mgr=MemoryUploadedFileManager("/mock/upload"),
            script_cache=session.script_cache,
            initial_rerun_data=None,
            user_info={"email": "test@example.com"},
            fragment_storage=session.fragment_storage,
            pages_manager=session.pages_manager,
            event_loop=self._test_loop,
            coordinator=session.coordinator,
            run_generation=run_generation,
        )
        self.events: list[ScriptRunnerEvent] = []
        self.button_ids: list[str] = []
        self.thread_exceptions: list[BaseException] = []
        self.on_event.connect(self._record_event, weak=False)

    def _record_event(
        self, sender: ScriptRunner | None, event: ScriptRunnerEvent, **kwargs: Any
    ) -> None:
        self.events.append(event)
        forward_msg = kwargs.get("forward_msg")
        if forward_msg is not None and forward_msg.HasField("delta"):
            element = forward_msg.delta.new_element
            if element.WhichOneof("type") == "button":
                self.button_ids.append(element.button.id)

    def _run_script_thread(self) -> None:
        try:
            super()._run_script_thread()
        except BaseException as ex:
            self.thread_exceptions.append(ex)
        finally:
            self._test_loop.close()

    def join(self) -> None:
        assert self._script_thread is not None
        self._script_thread.join(timeout=_TIMEOUT_SECS)
        assert not self._script_thread.is_alive(), "ScriptRunner did not stop"
        assert self.thread_exceptions == []


def _click(widget_id: str) -> WidgetStates:
    states = WidgetStates()
    state = WidgetState(id=widget_id)
    state.trigger_value = True
    states.widgets.append(state)
    return states


def _wait_for(predicate: Callable[[], bool]) -> None:
    deadline = time.monotonic() + _TIMEOUT_SECS
    while not predicate():
        assert time.monotonic() < deadline, "Timed out waiting for condition"
        time.sleep(0.005)


@pytest.fixture(autouse=True)
def mock_runtime() -> Iterator[None]:
    runtime = MagicMock(spec=Runtime)
    runtime.media_file_mgr = MediaFileManager(MemoryMediaFileStorage("/mock/media"))
    Runtime._instance = runtime
    yield
    Runtime._instance = None


@pytest.fixture
def session() -> _Session:
    """A session whose first run has registered the button and finished."""
    session = _Session()
    assert session.accept(RerunData()) == AcceptDecision.START
    session.join_all()
    assert session.session_state["body_runs"] == 1
    return session


def _button_id(session: _Session) -> str:
    return session.runners[0].button_ids[0]


def test_click_during_callback_commits_after_it(session: _Session) -> None:
    """A full-app click during a callback waits instead of superseding it."""
    button_id = _button_id(session)
    session.session_state["callback_sleep"] = 0.2

    assert session.accept(RerunData(widget_states=_click(button_id))) == (
        AcceptDecision.START
    )
    _wait_for(lambda: "start0" in session.session_state["log"])
    second = session.accept(RerunData(widget_states=_click(button_id)))
    session.join_all()

    assert second == AcceptDecision.ABSORBED_DEFERRED
    assert session.session_state["log"] == ["start0", "end0", "start1", "end1"]
    assert len(session.runners) == 2


def test_superseding_runner_commits_unclaimed_click(session: _Session) -> None:
    """A click accepted for a superseded runner still dispatches its callback."""
    button_id = _button_id(session)
    first = session.coordinator.accept(
        RerunData(widget_states=_click(button_id)), fast_reruns=True
    )
    second = session.coordinator.accept(
        RerunData(widget_states=_click(button_id)), fast_reruns=True
    )
    assert first.run_generation is not None
    assert second.run_generation is not None
    assert second.kind == AcceptDecision.SUPERSEDE

    old_runner = session.start_runner(first.run_generation)
    session.start_runner(second.run_generation)
    session.join_all()

    assert session.session_state["log"] == ["start0", "end0", "start1", "end1"]
    assert ScriptRunnerEvent.SCRIPT_STARTED not in old_runner.events


def test_superseded_body_stops_and_new_runner_dispatches_once(
    session: _Session,
) -> None:
    """A click during a long body supersedes it; the callback runs exactly once."""
    button_id = _button_id(session)
    session.session_state["body_spins"] = 500

    assert session.accept(RerunData()) == AcceptDecision.START
    body_runner = session.runners[-1]
    _wait_for(lambda: ScriptRunnerEvent.SCRIPT_STARTED in body_runner.events)
    assert session.accept(RerunData(widget_states=_click(button_id))) == (
        AcceptDecision.SUPERSEDE
    )
    session.join_all()

    assert session.session_state["log"] == ["start0", "end0"]
    # Only the superseding runner reaches the end of the body.
    assert session.session_state["body_runs"] == 2
    assert session.coordinator.snapshot()["pending_commit_count"] == 0
