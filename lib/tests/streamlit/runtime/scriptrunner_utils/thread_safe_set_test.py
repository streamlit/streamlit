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

import copy
import threading
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy

import pytest

from streamlit.elements.lib.utils import _register_element_id
from streamlit.errors import StreamlitDuplicateElementId, StreamlitDuplicateElementKey
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner_utils.script_run_context import ScriptRunContext
from streamlit.runtime.scriptrunner_utils.thread_safe_set import ThreadSafeSet
from streamlit.runtime.state import SafeSessionState, SessionState

# --- Basics ---


def test_check_and_add_returns_true_for_new_value() -> None:
    """Verify that check_and_add returns True when the value is new."""
    s = ThreadSafeSet()
    assert s.check_and_add("a") is True


def test_check_and_add_returns_false_for_existing_value() -> None:
    """Verify that check_and_add returns False for a duplicate value."""
    s = ThreadSafeSet()
    s.check_and_add("a")
    assert s.check_and_add("a") is False


def test_contains_after_add() -> None:
    """Verify __contains__ reflects values added via check_and_add."""
    s = ThreadSafeSet()
    assert "x" not in s
    s.check_and_add("x")
    assert "x" in s


def test_clear_removes_all_values() -> None:
    """Verify that clear empties the set."""
    s = ThreadSafeSet()
    s.check_and_add("a")
    s.check_and_add("b")
    s.clear()
    assert "a" not in s
    assert "b" not in s


def test_snapshot_returns_frozenset() -> None:
    """Verify snapshot returns a frozenset with the expected contents."""
    s = ThreadSafeSet()
    s.check_and_add("x")
    s.check_and_add("y")
    snap = s.snapshot()
    assert isinstance(snap, frozenset)
    assert snap == frozenset({"x", "y"})


def test_snapshot_is_immutable() -> None:
    """Verify that the frozenset returned by snapshot cannot be mutated."""
    s = ThreadSafeSet()
    s.check_and_add("a")
    snap = s.snapshot()
    with pytest.raises(AttributeError):
        snap.add("b")  # type: ignore[attr-defined]
    with pytest.raises(AttributeError):
        snap.clear()  # type: ignore[attr-defined]


# --- Encapsulation ---


def test_no_iter() -> None:
    """Verify that ThreadSafeSet does not expose __iter__."""
    s = ThreadSafeSet()
    with pytest.raises(TypeError):
        iter(s)  # type: ignore[call-overload]


def test_no_len() -> None:
    """Verify that ThreadSafeSet does not expose __len__."""
    s = ThreadSafeSet()
    with pytest.raises(TypeError):
        len(s)  # type: ignore[arg-type]


def test_no_direct_data_access() -> None:
    """Verify that raw set methods (add, remove, discard) are not exposed."""
    s = ThreadSafeSet()
    s.check_and_add("secret")
    assert not hasattr(s, "add")
    assert not hasattr(s, "remove")
    assert not hasattr(s, "discard")


# --- Copy prevention ---


def test_deepcopy_raises_type_error() -> None:
    """Verify that deepcopy raises TypeError with a helpful message."""
    s = ThreadSafeSet()
    s.check_and_add("a")

    with pytest.raises(TypeError, match=r"use \.snapshot\(\)"):
        deepcopy(s)


def test_shallow_copy_raises_type_error() -> None:
    """Verify that shallow copy raises TypeError with a helpful message."""
    s = ThreadSafeSet()
    s.check_and_add("a")

    with pytest.raises(TypeError, match=r"use \.snapshot\(\)"):
        copy.copy(s)


# --- Concurrency ---
# Even under the GIL, the previous `if x not in s: s.add(x)` pattern was
# vulnerable to thread switches between bytecodes; under free-threaded Python
# (PEP 703) the lock additionally protects against true parallel mutation.


def test_concurrent_check_and_add_exactly_one_winner_per_key() -> None:
    """N threads calling check_and_add with overlapping keys.

    Exactly one thread should get True (new) per key.
    """
    s = ThreadSafeSet()
    num_threads = 50
    num_keys = 20
    keys = [f"key_{i}" for i in range(num_keys)]
    results: dict[str, list[bool]] = {k: [] for k in keys}
    results_lock = threading.Lock()

    def worker(key: str) -> None:
        result = s.check_and_add(key)
        with results_lock:
            results[key].append(result)

    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = []
        for key in keys:
            for _ in range(num_threads):
                futures.append(executor.submit(worker, key))
        for f in futures:
            f.result()

    for key in keys:
        true_count = sum(1 for r in results[key] if r is True)
        assert true_count == 1, f"Key {key!r} had {true_count} winners (expected 1)"
        assert len(results[key]) == num_threads


def test_concurrent_check_and_add_and_snapshot() -> None:
    """Concurrent adds and snapshots should not raise."""
    s = ThreadSafeSet()
    barrier = threading.Barrier(10)

    def adder(i: int) -> None:
        barrier.wait()
        s.check_and_add(f"val_{i}")

    def snapshotter() -> frozenset[str]:
        barrier.wait()
        return s.snapshot()

    with ThreadPoolExecutor(max_workers=10) as executor:
        add_futures = [executor.submit(adder, i) for i in range(8)]
        snap_futures = [executor.submit(snapshotter) for _ in range(2)]

        for f in add_futures:
            f.result()
        for f in snap_futures:
            snap = f.result()
            assert isinstance(snap, frozenset)


# --- ScriptRunContext integration ---


def _make_ctx() -> ScriptRunContext:
    """Create a minimal ScriptRunContext for integration tests."""
    return ScriptRunContext(
        session_id="test",
        _enqueue=lambda _: None,
        query_string="",
        session_state=SafeSessionState(SessionState(), lambda: None),
        uploaded_file_mgr=MemoryUploadedFileManager("/mock/upload"),
        main_script_path="",
        user_info={"email": "test@test.com"},
        fragment_storage=MemoryFragmentStorage(),
        pages_manager=PagesManager(""),
    )


def test_fields_are_thread_safe_set_instances() -> None:
    """Verify ScriptRunContext registration fields are ThreadSafeSet instances."""
    ctx = _make_ctx()
    assert isinstance(ctx.shared.widget_ids_this_run, ThreadSafeSet)
    assert isinstance(ctx.shared.widget_user_keys_this_run, ThreadSafeSet)
    assert isinstance(ctx.shared.form_ids_this_run, ThreadSafeSet)


def test_reset_clears_thread_safe_sets() -> None:
    """Verify reset() clears ThreadSafeSet fields in place."""
    ctx = _make_ctx()
    ctx.shared.widget_ids_this_run.check_and_add("old_id")
    ctx.shared.widget_user_keys_this_run.check_and_add("old_key")
    ctx.shared.form_ids_this_run.check_and_add("old_form")

    ctx.reset()

    assert isinstance(ctx.shared.widget_ids_this_run, ThreadSafeSet)
    assert isinstance(ctx.shared.widget_user_keys_this_run, ThreadSafeSet)
    assert isinstance(ctx.shared.form_ids_this_run, ThreadSafeSet)
    assert "old_id" not in ctx.shared.widget_ids_this_run
    assert "old_key" not in ctx.shared.widget_user_keys_this_run
    assert "old_form" not in ctx.shared.form_ids_this_run


def test_on_script_finished_receives_frozenset() -> None:
    """Verify the snapshot passed to on_script_finished is a frozenset."""
    ctx = _make_ctx()
    ctx.shared.widget_ids_this_run.check_and_add("w1")
    ctx.shared.widget_ids_this_run.check_and_add("w2")

    snap = ctx.shared.widget_ids_this_run.snapshot()
    assert isinstance(snap, frozenset)
    assert snap == frozenset({"w1", "w2"})

    session_state = SessionState()
    session_state.on_script_finished(snap)


def test_on_script_finished_accepts_frozenset() -> None:
    """Verify on_script_finished type signature accepts frozenset[str]."""
    session_state = SessionState()
    session_state.on_script_finished(frozenset({"w1", "w2"}))


# --- Caller-level concurrent registration ---


def test_concurrent_duplicate_user_key_registration() -> None:
    """Multiple threads registering the same user_key — exactly one succeeds.

    Exercises the compound two-step check_and_add logic in _register_element_id
    under contention: user_key registration (step 1) must produce exactly one
    winner, with all other threads raising StreamlitDuplicateElementKey.
    """
    ctx = _make_ctx()
    successes: list[bool] = []
    duplicates: list[bool] = []
    results_lock = threading.Lock()

    element_id = "$$ID-text_input-my_key"

    def register() -> None:
        try:
            _register_element_id(ctx, "text_input", element_id)
            with results_lock:
                successes.append(True)
        except StreamlitDuplicateElementKey:
            with results_lock:
                duplicates.append(True)

    num_threads = 10
    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(register) for _ in range(num_threads)]
        for f in futures:
            f.result()

    assert len(successes) == 1, f"Expected 1 success, got {len(successes)}"
    assert len(duplicates) == num_threads - 1


def test_concurrent_duplicate_element_id_registration() -> None:
    """Multiple threads registering the same element_id (no user_key).

    When there is no user_key, only the element_id check fires. Exactly one
    thread should succeed; the rest raise StreamlitDuplicateElementId.
    """
    ctx = _make_ctx()
    successes: list[bool] = []
    duplicates: list[bool] = []
    results_lock = threading.Lock()

    element_id = "$$ID-text_input-None"

    def register() -> None:
        try:
            _register_element_id(ctx, "text_input", element_id)
            with results_lock:
                successes.append(True)
        except StreamlitDuplicateElementId:
            with results_lock:
                duplicates.append(True)

    num_threads = 10
    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(register) for _ in range(num_threads)]
        for f in futures:
            f.result()

    assert len(successes) == 1, f"Expected 1 success, got {len(successes)}"
    assert len(duplicates) == num_threads - 1
