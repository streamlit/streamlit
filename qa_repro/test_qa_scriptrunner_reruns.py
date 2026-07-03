"""Faithful ScriptRunner-level tests for fragment-scoped reruns.

AppTest converts every widget interaction into a *full* app rerun (its
RerunData never carries a fragment_id), so it cannot drive a fragment-scoped
rerun the way the real frontend does when a widget *inside* a fragment changes.

Here we use a real ``ScriptRunner`` whose thread loop stays alive as long as
rerun requests are pending. To deterministically inject a *second*
(fragment-scoped) rerun that references a fragment id only known after the first
run, the script publishes its fragment id and blocks on a barrier until the test
has queued the fragment-scoped ``RerunData`` (exactly what the browser sends for
an in-fragment widget change). This faithfully exercises scenarios #3, #13, #14.

Run:  uv run pytest work-tmp/qa/test_qa_scriptrunner_reruns.py -v
"""

from __future__ import annotations

import os
import tempfile
import threading
from typing import Any
from unittest.mock import MagicMock

import pytest

from streamlit.runtime import Runtime
from streamlit.runtime.forward_msg_queue import ForwardMsgQueue
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner import RerunData, ScriptRunner, ScriptRunnerEvent
from streamlit.runtime.scriptrunner.script_cache import ScriptCache
from streamlit.runtime.state import SessionState

# Cross-thread barrier shared with the temp scripts (imported by path below).
BARRIER: dict[str, Any] = {
    "id_ready": threading.Event(),
    "proceed": threading.Event(),
    "target_id": None,
}


@pytest.fixture(autouse=True)
def _mock_runtime():
    """Provide a mock Runtime instance required by ScriptRunner lifecycle."""
    mock_runtime = MagicMock(spec=Runtime)
    mock_runtime.media_file_mgr = MagicMock()
    Runtime._instance = mock_runtime
    BARRIER["id_ready"].clear()
    BARRIER["proceed"].clear()
    BARRIER["target_id"] = None
    yield
    Runtime._instance = None


class _Runner(ScriptRunner):
    __test__ = False

    def __init__(self, script_path: str) -> None:
        self.forward_msg_queue = ForwardMsgQueue()
        script_cache = ScriptCache()
        self.session_state = SessionState()
        self.script_thread_exceptions: list[Exception] = []
        super().__init__(
            session_id="qa session",
            main_script_path=script_path,
            session_state=self.session_state,
            uploaded_file_mgr=MemoryUploadedFileManager("/mock/upload"),
            script_cache=script_cache,
            initial_rerun_data=RerunData(),
            user_info={"email": "test@example.com"},
            fragment_storage=MemoryFragmentStorage(),
            pages_manager=PagesManager(script_path, script_cache),
        )
        self.events: list[ScriptRunnerEvent] = []

        def record_event(sender, event, **kwargs):  # noqa: ANN001
            self.events.append(event)
            if event == ScriptRunnerEvent.ENQUEUE_FORWARD_MSG:
                self.forward_msg_queue.enqueue(kwargs["forward_msg"])

        self.on_event.connect(record_event, weak=False)

    def _run_script_thread(self) -> None:
        try:
            super()._run_script_thread()
        except Exception as e:
            self.script_thread_exceptions.append(e)

    def join(self) -> None:
        if self._script_thread is not None:
            self._script_thread.join()


# Preamble injected into every temp script: makes BARRIER importable.
_PREAMBLE = f"""
import sys
sys.path.insert(0, {os.path.dirname(__file__)!r})
from test_qa_scriptrunner_reruns import BARRIER
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
"""


def _write_script(body: str) -> str:
    fd, path = tempfile.mkstemp(suffix=".py", dir=os.path.dirname(__file__))
    with os.fdopen(fd, "w") as f:
        f.write(_PREAMBLE + body)
    return path


def _counter(runner: _Runner, key: str) -> int:
    try:
        return runner.session_state[key]
    except KeyError:
        return 0


def _drive(runner: _Runner, publish_target_key: str) -> None:
    """Start the runner, wait for the script to publish its fragment id, queue a
    fragment-scoped rerun for it, then release the script and wait for shutdown.
    """
    runner.request_rerun(RerunData())
    runner.start()

    assert BARRIER["id_ready"].wait(timeout=5), "script never published fragment id"
    target_id = BARRIER["target_id"]
    assert target_id is not None
    runner.request_rerun(
        RerunData(fragment_id_queue=[target_id], is_fragment_scoped_rerun=True)
    )
    BARRIER["proceed"].set()
    runner.join()


# ---------------------------------------------------------------------------


def test_s14_widget_inside_keyed_fragment_fragment_rerun():
    """#14 A fragment-scoped rerun of a keyed fragment reruns ONLY the fragment."""
    body = """
import streamlit as st

st.session_state.setdefault("main_runs", 0)
st.session_state.setdefault("frag_runs", 0)
st.session_state["main_runs"] += 1

@st.fragment(key="charts")
def charts():
    st.session_state["frag_runs"] += 1
    st.checkbox("cb")

charts()

if st.session_state["main_runs"] == 1:
    BARRIER["target_id"] = get_script_run_ctx().fragment_storage.resolve_target("charts")[0]
    BARRIER["id_ready"].set()
    BARRIER["proceed"].wait(timeout=5)
"""
    path = _write_script(body)
    try:
        runner = _Runner(path)
        _drive(runner, "charts")
        assert runner.script_thread_exceptions == []
        assert _counter(runner, "main_runs") == 1  # main did NOT rerun
        assert _counter(runner, "frag_runs") == 2  # fragment reran once
    finally:
        os.unlink(path)


def test_s13_scope_fragment_from_inside_fragment():
    """#13 st.rerun(scope='fragment') inside a fragment rerun re-runs just it."""
    body = """
import streamlit as st

st.session_state.setdefault("main_runs", 0)
st.session_state.setdefault("frag_runs", 0)
st.session_state["main_runs"] += 1

@st.fragment(key="charts")
def charts():
    st.session_state["frag_runs"] += 1
    # On the first *fragment* rerun (frag_runs == 2) trigger one more
    # fragment-scoped rerun of ourselves, then stop.
    if st.session_state["frag_runs"] == 2:
        st.rerun(scope="fragment")

charts()

if st.session_state["main_runs"] == 1:
    BARRIER["target_id"] = get_script_run_ctx().fragment_storage.resolve_target("charts")[0]
    BARRIER["id_ready"].set()
    BARRIER["proceed"].wait(timeout=5)
"""
    path = _write_script(body)
    try:
        runner = _Runner(path)
        _drive(runner, "charts")
        assert runner.script_thread_exceptions == []
        assert _counter(runner, "main_runs") == 1
        # fragment: initial(1) + injected rerun(2) + self scope-fragment rerun(3)
        assert _counter(runner, "frag_runs") == 3
    finally:
        os.unlink(path)


def test_s3_target_from_another_fragment():
    """#3 A fragment rerun that targets ANOTHER fragment by name re-runs both,
    without re-running the main body.
    """
    body = """
import streamlit as st

st.session_state.setdefault("main_runs", 0)
st.session_state.setdefault("a_runs", 0)
st.session_state.setdefault("b_runs", 0)
st.session_state["main_runs"] += 1

@st.fragment(key="a")
def frag_a():
    st.session_state["a_runs"] += 1

@st.fragment(key="b")
def frag_b():
    st.session_state["b_runs"] += 1
    # On b's fragment rerun (b_runs == 2), target a by name.
    if st.session_state["b_runs"] == 2:
        st.rerun(target="a")

frag_a()
frag_b()

if st.session_state["main_runs"] == 1:
    BARRIER["target_id"] = get_script_run_ctx().fragment_storage.resolve_target("b")[0]
    BARRIER["id_ready"].set()
    BARRIER["proceed"].wait(timeout=5)
"""
    path = _write_script(body)
    try:
        runner = _Runner(path)
        _drive(runner, "b")
        assert runner.script_thread_exceptions == []
        assert _counter(runner, "main_runs") == 1  # main body did NOT rerun
        assert _counter(runner, "b_runs") == 2  # b reran
        assert _counter(runner, "a_runs") == 2  # a reran because b targeted it
    finally:
        os.unlink(path)
