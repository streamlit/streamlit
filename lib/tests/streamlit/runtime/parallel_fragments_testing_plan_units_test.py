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

"""Unit tests U5-U15 and U11-U12 from the parallel fragments testing plan."""

from __future__ import annotations

import copy
import threading
import time
from collections import Counter

import pytest

from streamlit.cursor import RunningCursor, make_delta_path
from streamlit.elements.lib.utils import _register_element_id
from streamlit.errors import StreamlitAPIException, StreamlitDuplicateElementKey
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.runtime.forward_msg_queue import ForwardMsgQueue
from streamlit.runtime.fragment import (
    ParallelFragmentCoordinator,
    _check_not_parallel_worker,
)
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    FragmentThreadState,
    ThreadSafeSet,
    _thread_state,
)
from streamlit.runtime.state.common import GENERATED_ELEMENT_ID_PREFIX
from tests.testutil import create_mock_script_run_ctx

# Reuse sample delta messages (same pattern as forward_msg_queue_test).
_TEXT_BASE = ForwardMsg()
_TEXT_BASE.delta.new_element.text.body = "text0"


def test_u5_threadsafe_set_concurrent_check_and_add_one_winner() -> None:
    """U5: exactly one thread wins check_and_add for the same key under contention."""
    ts: ThreadSafeSet = ThreadSafeSet()
    n_threads = 100
    results: list[bool] = []
    lock = threading.Lock()

    def try_add() -> None:
        won = ts.check_and_add("shared_key")
        with lock:
            results.append(won)

    threads = [threading.Thread(target=try_add) for _ in range(n_threads)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sum(results) == 1
    assert len(results) == n_threads


def test_u6_duplicate_widget_key_detection_under_concurrency() -> None:
    """U6: concurrent registration of the same user key raises at most once successfully."""
    ctx = create_mock_script_run_ctx()
    element_id = f"{GENERATED_ELEMENT_ID_PREFIX}-deadbeef-dupuserkey"
    errors: list[StreamlitDuplicateElementKey] = []
    lock = threading.Lock()

    def register() -> None:
        try:
            _register_element_id(ctx, "button", element_id)
        except StreamlitDuplicateElementKey as e:
            with lock:
                errors.append(e)

    threads = [threading.Thread(target=register) for _ in range(30)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(errors) == 29


def test_u7_running_cursor_enforces_ownership_with_parallel_coordinator() -> None:
    """U7: cross-thread cursor use raises when parallel_coordinator is active."""
    cursor = RunningCursor(RootContainer.MAIN)
    ctx = create_mock_script_run_ctx()
    ctx.parallel_coordinator = ParallelFragmentCoordinator(
        yield_check=lambda: None, poll_interval=0.05
    )
    violations: list[RuntimeError] = []
    a_ready = threading.Event()
    release_a = threading.Event()

    def thread_a_lock() -> None:
        add_script_run_ctx(threading.current_thread(), ctx)
        cursor.lock_element()
        a_ready.set()
        release_a.wait(timeout=5.0)

    def thread_b_lock() -> None:
        assert a_ready.wait(timeout=5.0)
        add_script_run_ctx(threading.current_thread(), ctx)
        try:
            cursor.lock_element()
        except RuntimeError as e:
            violations.append(e)
        finally:
            release_a.set()

    t_a = threading.Thread(target=thread_a_lock)
    t_b = threading.Thread(target=thread_b_lock)
    t_a.start()
    t_b.start()
    t_a.join(timeout=10.0)
    t_b.join(timeout=10.0)

    assert len(violations) == 1
    assert "doesn't own it" in str(violations[0])


def test_u8_running_cursor_reclaims_without_parallel_coordinator() -> None:
    """U8: without parallel_coordinator, a different thread may claim the cursor."""
    cursor = RunningCursor(RootContainer.MAIN)
    ctx = create_mock_script_run_ctx()
    ctx.parallel_coordinator = None

    def thread_a_lock() -> None:
        add_script_run_ctx(threading.current_thread(), ctx)
        cursor.lock_element()

    def thread_b_lock() -> None:
        add_script_run_ctx(threading.current_thread(), ctx)
        cursor.lock_element()

    t_a = threading.Thread(target=thread_a_lock)
    t_a.start()
    t_a.join()

    t_b = threading.Thread(target=thread_b_lock)
    t_b.start()
    t_b.join()


def test_u9_forward_msg_queue_concurrent_enqueue_is_safe() -> None:
    """U9: many threads enqueuing composable messages do not lose entries."""
    fmq = ForwardMsgQueue()
    barrier = threading.Barrier(10)

    def worker(wid: int) -> None:
        barrier.wait()
        for i in range(100):
            msg = copy.deepcopy(_TEXT_BASE)
            msg.delta.new_element.text.body = f"t{wid}-{i}"
            msg.metadata.delta_path[:] = make_delta_path(RootContainer.MAIN, (wid,), i)
            fmq.enqueue(msg)

    threads = [threading.Thread(target=worker, args=(k,)) for k in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(fmq) == 1000


def test_u10_forward_msg_queue_delta_composition_under_concurrency() -> None:
    """U10: concurrent enqueues on the same delta_path still compose to one delta."""
    fmq = ForwardMsgQueue()
    delta_path = make_delta_path(RootContainer.MAIN, (), 0)
    lock = threading.Lock()
    errors: list[BaseException] = []

    def first() -> None:
        try:
            msg = copy.deepcopy(_TEXT_BASE)
            msg.delta.new_element.text.body = "empty_slot"
            msg.metadata.delta_path[:] = delta_path
            fmq.enqueue(msg)
        except BaseException as e:
            with lock:
                errors.append(e)

    def second() -> None:
        try:
            time.sleep(0.02)
            msg = copy.deepcopy(_TEXT_BASE)
            msg.delta.new_element.text.body = "markdown_replacement"
            msg.metadata.delta_path[:] = delta_path
            fmq.enqueue(msg)
        except BaseException as e:
            with lock:
                errors.append(e)

    t1 = threading.Thread(target=first)
    t2 = threading.Thread(target=second)
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    assert not errors
    queue = fmq.flush()
    text_msgs = [m for m in queue if m.HasField("delta")]
    assert len(text_msgs) == 1
    assert text_msgs[0].delta.new_element.text.body == "markdown_replacement"


def test_u11_session_state_single_operation_atomicity() -> None:
    """U11: unique keys written from many threads are all present."""
    ctx = create_mock_script_run_ctx()
    add_script_run_ctx(threading.current_thread(), ctx)

    def writer(idx: int) -> None:
        add_script_run_ctx(threading.current_thread(), ctx)
        ctx.session_state[f"k{idx}"] = idx

    threads = [threading.Thread(target=writer, args=(i,)) for i in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    for i in range(10):
        assert ctx.session_state[f"k{i}"] == i


def test_u12_session_state_increment_is_not_atomic() -> None:
    """U12: read-modify-write races mean the counter may be below the naive total."""
    ctx = create_mock_script_run_ctx()
    add_script_run_ctx(threading.current_thread(), ctx)
    ctx.session_state["counter"] = 0
    iterations = 30
    barrier = threading.Barrier(10)

    def bump() -> None:
        add_script_run_ctx(threading.current_thread(), ctx)
        for _ in range(iterations):
            barrier.wait()
            snapshot = ctx.session_state["counter"]
            barrier.wait()
            ctx.session_state["counter"] = snapshot + 1

    threads = [threading.Thread(target=bump) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Perfect atomicity would be 10 * iterations; races should drop the total.
    assert ctx.session_state["counter"] < 10 * iterations


def test_u13_parallel_fragment_id_is_isolated_per_context() -> None:
    """U13: fragment_id in _thread_state contextvar is not shared across logical workers."""
    observed: list[str | None] = []
    lock = threading.Lock()

    def record(fid: str) -> None:
        _thread_state.set(FragmentThreadState(fragment_id=fid))
        time.sleep(0.01)
        with lock:
            observed.append(_thread_state.get().fragment_id)

    t1 = threading.Thread(target=record, args=("frag-a",))
    t2 = threading.Thread(target=record, args=("frag-b",))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    assert Counter(observed) == Counter({"frag-a", "frag-b"})


def test_u14_is_parallel_worker_default_false_on_main_thread() -> None:
    """U14: is_parallel_worker is False unless set for a worker context."""
    assert _thread_state.get().is_parallel_worker is False

    token = _thread_state.set(FragmentThreadState(is_parallel_worker=True))
    try:
        assert _thread_state.get().is_parallel_worker is True
    finally:
        _thread_state.reset(token)


def test_u15_check_not_parallel_worker_raises_in_worker_context() -> None:
    """U15: gated APIs raise when is_parallel_worker is True."""
    token = _thread_state.set(FragmentThreadState(is_parallel_worker=True))
    try:
        with pytest.raises(StreamlitAPIException, match="cannot be called from"):
            _check_not_parallel_worker("st.switch_page")
    finally:
        _thread_state.reset(token)
