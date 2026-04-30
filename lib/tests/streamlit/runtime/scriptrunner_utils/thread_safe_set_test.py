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
from concurrent.futures import ThreadPoolExecutor

import pytest

from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner_utils.script_run_context import ScriptRunContext
from streamlit.runtime.scriptrunner_utils.thread_safe_set import ThreadSafeSet
from streamlit.runtime.state import SafeSessionState, SessionState


class TestThreadSafeSetBasics:
    def test_check_and_add_returns_true_for_new_value(self):
        s = ThreadSafeSet()
        assert s.check_and_add("a") is True

    def test_check_and_add_returns_false_for_existing_value(self):
        s = ThreadSafeSet()
        s.check_and_add("a")
        assert s.check_and_add("a") is False

    def test_contains_after_add(self):
        s = ThreadSafeSet()
        assert "x" not in s
        s.check_and_add("x")
        assert "x" in s

    def test_clear_removes_all_values(self):
        s = ThreadSafeSet()
        s.check_and_add("a")
        s.check_and_add("b")
        s.clear()
        assert "a" not in s
        assert "b" not in s

    def test_snapshot_returns_frozenset(self):
        s = ThreadSafeSet()
        s.check_and_add("x")
        s.check_and_add("y")
        snap = s.snapshot()
        assert isinstance(snap, frozenset)
        assert snap == frozenset({"x", "y"})

    def test_snapshot_is_immutable(self):
        s = ThreadSafeSet()
        s.check_and_add("a")
        snap = s.snapshot()
        with pytest.raises(AttributeError):
            snap.add("b")  # type: ignore[attr-defined]
        with pytest.raises(AttributeError):
            snap.clear()  # type: ignore[attr-defined]


class TestThreadSafeSetEncapsulation:
    def test_no_iter(self):
        s = ThreadSafeSet()
        assert not hasattr(s, "__iter__")
        with pytest.raises(TypeError):
            iter(s)  # type: ignore[call-overload]

    def test_no_len(self):
        s = ThreadSafeSet()
        assert not hasattr(s, "__len__")
        with pytest.raises(TypeError):
            len(s)  # type: ignore[arg-type]

    def test_no_direct_data_access(self):
        s = ThreadSafeSet()
        s.check_and_add("secret")
        assert not hasattr(s, "add")
        assert not hasattr(s, "remove")
        assert not hasattr(s, "discard")


class TestThreadSafeSetConcurrency:
    # NOTE: Under standard CPython with the GIL, these tests verify the API contract
    # but cannot actually trigger race conditions (the GIL serializes bytecode ops).
    # They become load-bearing under free-threaded Python (--disable-gil / PEP 703).

    def test_concurrent_check_and_add_exactly_one_winner_per_key(self):
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

    def test_concurrent_check_and_add_and_snapshot(self):
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


def _make_ctx() -> ScriptRunContext:
    """Helper to create a minimal ScriptRunContext for integration tests."""
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


class TestScriptRunContextIntegration:
    def test_fields_are_thread_safe_set_instances(self):
        ctx = _make_ctx()
        assert isinstance(ctx.widget_ids_this_run, ThreadSafeSet)
        assert isinstance(ctx.widget_user_keys_this_run, ThreadSafeSet)
        assert isinstance(ctx.form_ids_this_run, ThreadSafeSet)

    def test_reset_replaces_with_fresh_thread_safe_set(self):
        ctx = _make_ctx()
        ctx.widget_ids_this_run.check_and_add("old_id")
        ctx.widget_user_keys_this_run.check_and_add("old_key")
        ctx.form_ids_this_run.check_and_add("old_form")

        ctx.reset()

        assert isinstance(ctx.widget_ids_this_run, ThreadSafeSet)
        assert isinstance(ctx.widget_user_keys_this_run, ThreadSafeSet)
        assert isinstance(ctx.form_ids_this_run, ThreadSafeSet)
        assert "old_id" not in ctx.widget_ids_this_run
        assert "old_key" not in ctx.widget_user_keys_this_run
        assert "old_form" not in ctx.form_ids_this_run

    def test_on_script_finished_receives_frozenset(self):
        """The snapshot passed to on_script_finished must be a frozenset."""
        ctx = _make_ctx()
        ctx.widget_ids_this_run.check_and_add("w1")
        ctx.widget_ids_this_run.check_and_add("w2")

        snap = ctx.widget_ids_this_run.snapshot()
        assert isinstance(snap, frozenset)
        assert snap == frozenset({"w1", "w2"})

        # SessionState.on_script_finished accepts this without assertion error
        session_state = SessionState()
        session_state.on_script_finished(snap)

    def test_on_script_finished_accepts_frozenset(self):
        """on_script_finished type signature requires frozenset[str]."""
        session_state = SessionState()
        session_state.on_script_finished(frozenset({"w1", "w2"}))
