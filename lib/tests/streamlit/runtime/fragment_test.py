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
import sys
import threading
import types
import unittest
from collections.abc import Callable
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.delta_generator import DeltaGenerator
from streamlit.delta_generator_singletons import context_dg_stack
from streamlit.errors import (
    FragmentHandledException,
    FragmentStorageKeyError,
    StreamlitAPIException,
    StreamlitFragmentWidgetsNotAllowedOutsideError,
)
from streamlit.runtime.fragment import (
    FragmentStorage,
    MemoryFragmentStorage,
    _check_not_parallel_worker,
    _dispatch_parallel_fragment,
    _fragment,
    _run_parallel_fragment,
    fragment,
)
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner_utils.exceptions import (
    RerunException,
    StopException,
)
from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState
from streamlit.runtime.scriptrunner_utils.thread_safe_set import ThreadSafeSet
from tests.conftest import enable_mpa_v2_mode
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.element_mocks import (
    ELEMENT_PRODUCER,
    NON_WIDGET_ELEMENTS,
    WIDGET_ELEMENTS,
)


class MemoryFragmentStorageTest(unittest.TestCase):
    """Sanity checks for MemoryFragmentStorage.

    These tests may be a bit excessive given that MemoryFragmentStorage is currently
    just a wrapper around a Python dict, but we include them for completeness.
    """

    def setUp(self):
        self._storage = MemoryFragmentStorage()
        self._set_fragment("some_key", value="some_fragment")

    def _set_fragment(
        self,
        fragment_id: str,
        *,
        parent_fragment_id: str | None = None,
        value: str | None = None,
    ) -> None:
        fragment_value = fragment_id if value is None else value
        self._storage.register(
            fragment_id,
            fragment_value,
            parent_fragment_id=parent_fragment_id,
        )

    def _set_fragment_chain(self, *fragment_ids: str) -> None:
        parent_fragment_id = None
        for fragment_id in fragment_ids:
            self._set_fragment(
                fragment_id,
                parent_fragment_id=parent_fragment_id,
            )
            parent_fragment_id = fragment_id

    def test_lookup(self):
        assert self._storage.lookup("some_key") == "some_fragment"

    def test_lookup_FragmentStorageKeyError(self):
        with pytest.raises(FragmentStorageKeyError):
            self._storage.lookup("nonexistent_key")

    def test_register(self):
        self._storage.register("some_key", "new_fragment")
        self._storage.register("some_other_key", "some_other_fragment")

        assert self._storage.lookup("some_key") == "new_fragment"
        assert self._storage.lookup("some_other_key") == "some_other_fragment"

    def test_register_with_parent_fragment_id_preserves_nesting(self):
        """register() should support nested fragment ancestry."""
        self._set_fragment("outer")

        self._storage.register(
            "inner",
            "inner_fragment",
            parent_fragment_id="outer",
        )

        # Directly assert the parent map so a regression in the ancestry
        # bookkeeping is caught independently of order_fragment_ids.
        assert self._storage._parent_by_id["inner"] == "outer"
        assert self._storage._parent_by_id["outer"] is None

        assert self._storage.order_fragment_ids(["inner", "outer"]) == [
            "outer",
            "inner",
        ]

    def test_delete(self):
        self._storage.delete("some_key")
        with pytest.raises(FragmentStorageKeyError):
            self._storage.lookup("some_key")

    def test_del_FragmentStorageKeyError(self):
        with pytest.raises(FragmentStorageKeyError):
            self._storage.delete("nonexistent_key")

    def test_clear(self):
        self._set_fragment("some_other_key", value="some_other_fragment")
        assert len(self._storage._fragments) == 2

        self._storage.clear()
        assert len(self._storage._fragments) == 0
        assert len(self._storage._parent_by_id) == 0

    def test_clear_with_new_fragment_ids(self):
        self._set_fragment("some_other_key", value="some_other_fragment")
        assert len(self._storage._fragments) == 2

        self._storage.clear(new_fragment_ids=frozenset({"some_key"}))
        assert len(self._storage._fragments) == 1
        assert self._storage._fragments["some_key"] == "some_fragment"
        assert "some_other_key" not in self._storage._parent_by_id

    def test_clear_stale_descendants_removes_orphan_nested(self):
        """Descendants of root not re-registered this run are removed."""
        self._set_fragment_chain("outer", "inner", "leaf")

        self._storage.clear_stale_descendants("outer", frozenset({"outer"}))

        assert self._storage.contains("outer")
        assert not self._storage.contains("inner")
        assert not self._storage.contains("leaf")

    def test_clear_stale_descendants_keeps_reregistered_child(self):
        """Descendants re-registered during this run are preserved."""
        self._set_fragment_chain("outer", "inner")

        self._storage.clear_stale_descendants("outer", frozenset({"outer", "inner"}))

        assert self._storage.contains("outer")
        assert self._storage.contains("inner")

    def test_clear_stale_descendants_preserves_sibling_branch(self):
        """Only siblings missing from this run are removed."""
        self._set_fragment("outer")
        self._set_fragment("inner_a", parent_fragment_id="outer")
        self._set_fragment("inner_b", parent_fragment_id="outer")

        self._storage.clear_stale_descendants("outer", frozenset({"outer", "inner_a"}))

        assert self._storage.contains("outer")
        assert self._storage.contains("inner_a")
        assert not self._storage.contains("inner_b")

    def test_clear_stale_descendants_child_only_does_not_remove_parent(self):
        """Cleanup rooted at a child must not evict ancestors."""
        self._set_fragment_chain("outer", "inner")

        self._storage.clear_stale_descendants("inner", frozenset({"inner"}))

        assert self._storage.contains("outer")
        assert self._storage.contains("inner")

    def test_clear_stale_descendants_does_not_remove_unrelated_top_level(self):
        """Top-level fragments in other branches are unaffected."""
        self._set_fragment("a")
        self._set_fragment("b")

        self._storage.clear_stale_descendants("a", frozenset({"a"}))

        assert self._storage.contains("a")
        assert self._storage.contains("b")

    def test_delete_removes_parent_metadata(self):
        """Deleting a fragment also drops its parent-id bookkeeping."""
        self._set_fragment("k", parent_fragment_id="p")
        self._storage.delete("k")
        assert "k" not in self._storage._parent_by_id

    def test_registration_sequence_advances_monotonically_on_register(self):
        """Each ``register`` advances ``registration_sequence`` by exactly one."""
        # ``setUp`` already registered ``some_key`` (sequence == 1).
        initial = self._storage.registration_sequence()
        assert initial == 1

        self._set_fragment("a", value="a_value")
        self._set_fragment("b", value="b_value")
        assert self._storage.registration_sequence() == initial + 2

    def test_registration_sequence_unchanged_by_reads(self):
        """Read-only operations must not advance ``registration_sequence``."""
        snapshot = self._storage.registration_sequence()

        self._storage.lookup("some_key")
        self._storage.contains("some_key")
        self._storage.ids_registered_after(0)
        self._storage.order_fragment_ids(["some_key"])
        self._storage.clear_stale_descendants("some_key", frozenset({"some_key"}))

        assert self._storage.registration_sequence() == snapshot

    def test_registration_sequence_advances_on_reset_of_existing_key(self):
        """Re-registering an existing key still advances ``registration_sequence``."""
        snapshot = self._storage.registration_sequence()
        self._set_fragment("some_key", value="replacement")
        assert self._storage.registration_sequence() == snapshot + 1

    def test_ids_registered_after_returns_only_newer_ids(self):
        """Only ids whose latest registration is strictly newer are returned."""
        snapshot = self._storage.registration_sequence()
        self._set_fragment("new_a", value="a")
        self._set_fragment("new_b", value="b", parent_fragment_id="new_a")

        registered = self._storage.ids_registered_after(snapshot)
        assert registered == frozenset({"new_a", "new_b"})
        assert "some_key" not in registered

    def test_ids_registered_after_is_empty_when_nothing_new(self):
        """No registrations after the snapshot yields an empty frozenset."""
        snapshot = self._storage.registration_sequence()
        # Read-only operations must not register anything.
        self._storage.lookup("some_key")

        assert self._storage.ids_registered_after(snapshot) == frozenset()

    def test_ids_registered_after_includes_replaced_existing_id(self):
        """Re-registering an existing id surfaces it in ``ids_registered_after``."""
        snapshot = self._storage.registration_sequence()
        self._set_fragment("some_key", value="replacement")

        assert self._storage.ids_registered_after(snapshot) == frozenset({"some_key"})

    def test_order_fragment_ids_empty_input_returns_empty_list(self):
        """An empty input list yields an empty ordering."""
        assert self._storage.order_fragment_ids([]) == []

    def test_order_fragment_ids_preserves_fifo_for_top_level_ids(self):
        """All-top-level fragments retain their input order."""
        self._set_fragment("a")
        self._set_fragment("b")
        self._set_fragment("c")

        assert self._storage.order_fragment_ids(["b", "a", "c"]) == ["b", "a", "c"]

    def test_order_fragment_ids_promotes_ancestor_before_descendant(self):
        """A queued ancestor runs before its queued descendant."""
        self._set_fragment_chain("outer", "inner")

        # Child queued first must still run after the parent.
        assert self._storage.order_fragment_ids(["inner", "outer"]) == [
            "outer",
            "inner",
        ]

    def test_order_fragment_ids_keeps_fifo_between_unrelated_branches(self):
        """Unrelated fragments keep input FIFO while each branch stays ancestor-first."""
        self._set_fragment("p1")
        self._set_fragment("c1", parent_fragment_id="p1")
        self._set_fragment("p2")

        # ``c1`` arrives first but ``p1`` must precede it; ``p2`` is unrelated and
        # should retain its input position relative to the other roots.
        assert self._storage.order_fragment_ids(["c1", "p2", "p1"]) == [
            "p2",
            "p1",
            "c1",
        ]

    def test_order_fragment_ids_unknown_ids_treated_as_roots(self):
        """Ids with no recorded parent are ordered as if they were roots."""
        # No registrations beyond ``some_key`` from ``setUp``; both are unknown to
        # the parent map.
        assert self._storage.order_fragment_ids(["unknown_b", "unknown_a"]) == [
            "unknown_b",
            "unknown_a",
        ]

    def test_order_fragment_ids_orphan_descendant_uses_input_order(self):
        """When the queued ancestor isn't itself queued, FIFO is preserved."""
        self._set_fragment_chain("outer", "inner")

        # ``outer`` isn't in the queue, so ``inner`` has no queued ancestor and
        # should keep its input position relative to its siblings.
        self._set_fragment("other")
        assert self._storage.order_fragment_ids(["inner", "other"]) == [
            "inner",
            "other",
        ]

    def test_clear_stale_descendants_handles_parent_cycle_without_hanging(self):
        """A malformed parent cycle must not trap ``clear_stale_descendants``."""
        # Manufacture a cycle a -> b -> a in the parent map. This shouldn't
        # happen in practice but we guard against it defensively.
        self._set_fragment("a")
        self._set_fragment("b", parent_fragment_id="a")
        self._storage._parent_by_id["a"] = "b"

        # Should terminate (no hang) without removing either fragment, since
        # neither is a strict descendant of an unrelated root.
        self._storage.clear_stale_descendants(
            "unrelated_root", frozenset({"unrelated_root"})
        )
        assert self._storage.contains("a")
        assert self._storage.contains("b")

    def test_contains(self):
        assert self._storage.contains("some_key")
        assert not self._storage.contains("some_other_key")


def test_has_lock() -> None:
    """MemoryFragmentStorage should expose a threading.Lock for concurrent register/clear."""
    storage = MemoryFragmentStorage()
    # threading.Lock is a class in Python 3.13+ and a factory function in 3.10-3.12,
    # so we compare against type(threading.Lock()) for portability across both.
    assert isinstance(storage._lock, type(threading.Lock()))


def test_concurrent_register_smoke() -> None:
    """Smoke test: many threads calling register() concurrently with distinct
    keys do not deadlock and do not drop entries.

    Note: under CPython's GIL, ``dict[key] = value`` is already atomic, and the
    free-threaded build (PEP 703) preserves that via per-object locking on
    built-in dicts. With distinct keys per thread, this test would therefore
    pass even without ``self._lock``. The value of this test is as a regression
    guard against a wildly broken register() that loses writes or deadlocks. The
    lock's real purpose — serializing register() with clear()'s multi-op
    snapshot-then-delete sequence — is exercised more directly by
    ``test_lock_contention_under_load`` below.
    """
    storage = MemoryFragmentStorage()
    num_threads = 10
    ids_per_thread = 100
    barrier = threading.Barrier(num_threads)

    def worker(thread_idx: int) -> None:
        barrier.wait()
        for i in range(ids_per_thread):
            fid = f"fragment_{thread_idx}_{i}"
            storage.register(fid, lambda: None)

    threads = [threading.Thread(target=worker, args=(t,)) for t in range(num_threads)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(storage._fragments) == num_threads * ids_per_thread


def test_clear_preserves_kept_fragments_after_register() -> None:
    """clear() should retain fragments listed in new_fragment_ids when the storage was
    populated via register() (rather than the internal dict directly).
    """
    storage = MemoryFragmentStorage()
    keep_ids: set[str] = set()

    for i in range(100):
        fid = f"fragment_{i}"
        storage.register(fid, lambda: None)
        if i % 2 == 0:
            keep_ids.add(fid)

    storage.clear(new_fragment_ids=frozenset(keep_ids))
    assert len(storage._fragments) == 50
    for fid in keep_ids:
        assert storage.contains(fid)


def test_lock_contention_under_load() -> None:
    """register() and clear() should not deadlock under concurrent access."""
    storage = MemoryFragmentStorage()
    num_threads = 5
    ops_per_thread = 200
    barrier = threading.Barrier(num_threads + 1)

    def register_worker(idx: int) -> None:
        barrier.wait()
        for i in range(ops_per_thread):
            storage.register(f"frag_{idx}_{i}", lambda: None)

    def clear_worker() -> None:
        barrier.wait()
        for _ in range(ops_per_thread):
            storage.clear(new_fragment_ids=frozenset())

    threads: list[threading.Thread] = [
        threading.Thread(target=register_worker, args=(t,)) for t in range(num_threads)
    ]
    threads.append(threading.Thread(target=clear_worker))
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    # No assertion on final count — the point is no deadlock or crash.


def test_deepcopy_raises_type_error() -> None:
    """deepcopy should raise TypeError, not silently produce a half-broken clone."""
    storage = MemoryFragmentStorage()
    storage.register("a", lambda: None)

    with pytest.raises(TypeError, match="does not support deepcopy"):
        copy.deepcopy(storage)


def test_shallow_copy_raises_type_error() -> None:
    """copy.copy should raise TypeError so callers don't end up sharing _fragments
    while allocating a fresh _lock.
    """
    storage = MemoryFragmentStorage()
    storage.register("a", lambda: None)

    with pytest.raises(TypeError, match="does not support copy"):
        copy.copy(storage)


class FragmentTest(unittest.TestCase):
    def setUp(self):
        self.original_dg_stack = context_dg_stack.get()
        root_container = MagicMock()
        context_dg_stack.set(
            (
                DeltaGenerator(
                    root_container=root_container,
                    cursor=MagicMock(root_container=root_container),
                ),
            )
        )
        ThreadState.initialize()

    def tearDown(self):
        context_dg_stack.set(self.original_dg_stack)

    @patch("streamlit.runtime.fragment.get_script_run_ctx", MagicMock())
    def test_wrapped_fragment_calls_original_function(self):
        called = False

        dg_stack_len = len(context_dg_stack.get())

        @fragment
        def my_fragment():
            nonlocal called
            called = True

            # Verify that a new container gets created for the contents of this
            # fragment to be written to.
            assert len(context_dg_stack.get()) == dg_stack_len + 1

        my_fragment()
        assert called

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_resets_fragment_id_on_success(self, patched_get_script_run_ctx):
        ctx = MagicMock()
        patched_get_script_run_ctx.return_value = ctx

        @fragment
        def my_fragment():
            assert ThreadState.get().fragment_id != "my_fragment_id"

        ThreadState.update(fragment_id="my_fragment_id")
        my_fragment()
        assert ThreadState.get().fragment_id == "my_fragment_id"

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_resets_fragment_id_on_exception(self, patched_get_script_run_ctx):
        ctx = MagicMock()
        patched_get_script_run_ctx.return_value = ctx

        exception_message = "oh no"

        @fragment
        def my_exploding_fragment():
            assert ThreadState.get().fragment_id != "my_fragment_id"
            raise Exception(exception_message)

        ThreadState.update(fragment_id="my_fragment_id")
        with pytest.raises(Exception, match=exception_message):
            my_exploding_fragment()

        assert ThreadState.get().fragment_id == "my_fragment_id"

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_nested_fragment_restores_outer_delta_path(
        self, patched_get_script_run_ctx
    ):
        """After an inner fragment returns from inside an outer fragment,
        ``ThreadState.get().delta_path`` is restored to the outer's prior
        value.
        """
        ctx = MagicMock()
        ctx.cursors = {}
        ctx.fragment_ids_this_run = []
        ctx.new_fragment_ids = ThreadSafeSet()
        ctx.fragment_storage = MemoryFragmentStorage()
        patched_get_script_run_ctx.return_value = ctx

        captured: dict[str, object] = {}

        @fragment
        def inner_fragment():
            captured["inner_delta_path"] = ThreadState.get().delta_path

        @fragment
        def outer_fragment():
            # Sentinel so the assertion below is unambiguous.
            ThreadState.update(delta_path=(0, 1, 2))
            captured["outer_before_inner"] = ThreadState.get().delta_path
            inner_fragment()
            captured["outer_after_inner"] = ThreadState.get().delta_path

        outer_fragment()

        assert captured["outer_before_inner"] == (0, 1, 2)
        # Sanity check: inner must actually mutate delta_path, otherwise the
        # restoration assertion below would pass trivially.
        assert captured["inner_delta_path"] != (0, 1, 2)
        assert captured["outer_after_inner"] == (0, 1, 2)

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_wrapped_fragment_not_saved_in_FragmentStorage(
        self, patched_get_script_run_ctx
    ):
        ctx = MagicMock()
        # Override the auto-generated MagicMock for fragment_storage with an explicit
        # one so that deepcopy(ctx.cursors) cannot reach a real MemoryFragmentStorage,
        # which holds a threading.Lock and is therefore not deepcopy-able.
        ctx.fragment_storage = MagicMock()

        patched_get_script_run_ctx.return_value = ctx

        @fragment
        def my_fragment():
            pass

        # Call the fragment-decorated function twice, and verify that each execution
        # refreshes the registered closure.
        my_fragment()
        my_fragment()
        assert ctx.fragment_storage.register.call_count == 2

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_sets_dg_stack_and_cursor_to_snapshots_if_fragment_ids_this_run(
        self, patched_get_script_run_ctx
    ):
        ctx = MagicMock()
        ctx.fragment_ids_this_run = ["my_fragment_id"]
        ctx.fragment_storage = MemoryFragmentStorage()
        patched_get_script_run_ctx.return_value = ctx

        dg = MagicMock()
        dg.my_random_field = 7
        context_dg_stack.set((dg,))
        # Use a plain SimpleNamespace (not the auto-generated MagicMock) so that
        # deepcopy(ctx.cursors) does not traverse back to the real fragment_storage
        # above, whose threading.Lock cannot be deepcopied.
        ctx.cursors = types.SimpleNamespace()
        ctx.cursors.my_other_random_field = 8

        call_count = 0

        @fragment
        def my_fragment():
            nonlocal call_count

            assert ThreadState.get().fragment_id is not None

            curr_dg_stack = context_dg_stack.get()
            # Verify that mutations made in previous runs of my_fragment aren't
            # persisted.
            assert curr_dg_stack[0].my_random_field == 7
            assert ctx.cursors.my_other_random_field == 8

            # Attempt to mutate cursors and the dg_stack.
            curr_dg_stack[0].my_random_field += 1
            ctx.cursors.my_other_random_field += 1

            call_count += 1

        my_fragment()

        # Reach inside our MemoryFragmentStorage internals to pull out our saved
        # fragment.
        saved_fragment = next(iter(ctx.fragment_storage._fragments.values()))

        # Verify that we can't mutate our dg_stack from within my_fragment. If a
        # mutation is persisted between fragment runs, the assert on `my_random_field`
        # will fail.
        saved_fragment()
        saved_fragment()

        # Called once when calling my_fragment and three times calling the saved
        # fragment.
        assert call_count == 3

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_sets_current_fragment_id_in_full_script_runs(
        self, patched_get_script_run_ctx
    ):
        ctx = MagicMock()
        ctx.cursors = {}
        ctx.fragment_ids_this_run = []
        ctx.new_fragment_ids = ThreadSafeSet()
        ctx.fragment_storage = MemoryFragmentStorage()
        patched_get_script_run_ctx.return_value = ctx

        dg = MagicMock()
        dg.my_random_field = 0
        context_dg_stack.set((dg,))

        @fragment
        def my_fragment():
            assert ThreadState.get().fragment_id is not None

            curr_dg_stack = context_dg_stack.get()
            curr_dg_stack[0].my_random_field += 1

        assert len(ctx.new_fragment_ids.snapshot()) == 0
        my_fragment()

        # Verify that `my_fragment`'s id was added to the `new_fragment_id`s set.
        assert len(ctx.new_fragment_ids.snapshot()) == 1

        # Reach inside our MemoryFragmentStorage internals to pull out our saved
        # fragment.
        saved_fragment = next(iter(ctx.fragment_storage._fragments.values()))
        saved_fragment()
        saved_fragment()

        # This time, dg should have been mutated since we don't restore it from a
        # snapshot in a regular script run.
        assert dg.my_random_field == 3
        assert ThreadState.get().fragment_id is None

    @parameterized.expand(
        [
            (None, None),
            (3, 3.0),
            (5.0, 5.0),
            ("1 minute", 60.0),
        ]
    )
    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_run_every_arg_handling(
        self,
        run_every,
        expected_interval,
        patched_get_script_run_ctx,
    ):
        called = False

        ctx = MagicMock()
        ctx.fragment_storage = MagicMock()
        patched_get_script_run_ctx.return_value = ctx

        @fragment(run_every=run_every)
        def my_fragment():
            nonlocal called

            called = True

        my_fragment()

        assert called

        if expected_interval is not None:
            [(args, _)] = ctx.enqueue.call_args_list
            msg = args[0]
            assert msg.auto_rerun.interval == expected_interval
            assert isinstance(msg.auto_rerun.fragment_id, str)
            assert msg.auto_rerun.fragment_id != ""
        else:
            ctx.enqueue.assert_not_called()

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_sets_active_script_hash_if_needed(self, patched_get_script_run_ctx):
        ctx = MagicMock()
        patched_run_with_active_hash = MagicMock()
        ctx.run_with_active_hash = patched_run_with_active_hash
        ctx.fragment_storage = MemoryFragmentStorage()
        ctx.pages_manager = PagesManager("")
        enable_mpa_v2_mode(ctx.pages_manager)
        ThreadState.update(active_script_hash="some_hash")
        # Use a plain dict (not the auto-generated MagicMock) so that deepcopy(ctx.cursors)
        # does not traverse back to the real fragment_storage above, whose threading.Lock
        # cannot be deepcopied.
        ctx.cursors = {}
        patched_get_script_run_ctx.return_value = ctx

        @fragment
        def my_fragment():
            pass

        my_fragment()

        # Reach inside our MemoryFragmentStorage internals to pull out our saved
        # fragment.
        saved_fragment = next(iter(ctx.fragment_storage._fragments.values()))

        # set the hash to something different for subsequent calls
        ThreadState.update(active_script_hash="a_different_hash")

        # Verify subsequent calls will run with the original active script hash
        saved_fragment()
        patched_run_with_active_hash.assert_called_with("some_hash")
        patched_run_with_active_hash.reset_mock()
        saved_fragment()
        patched_run_with_active_hash.assert_called_with("some_hash")

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_fragment_code_returns_value(
        self,
        patched_get_script_run_ctx,
    ):
        ctx = MagicMock()
        ctx.fragment_storage = MagicMock()
        patched_get_script_run_ctx.return_value = ctx

        @fragment
        def my_fragment():
            return 42

        assert my_fragment() == 42

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_fragment_raises_rerun_exception_in_main_execution_context(
        self, patched_get_script_run_ctx
    ):
        """Ensure that a rerun exception raised in a fragment when executed in the main
        execution context (meaning first execution in the app flow, not via a
        fragment-only rerun) is raised in the main execution context.
        """
        ctx = MagicMock()
        ctx.fragment_storage = MagicMock()
        patched_get_script_run_ctx.return_value = ctx

        @fragment
        def my_fragment():
            raise RerunException(rerun_data=None)

        with pytest.raises(RerunException):
            my_fragment()

    @parameterized.expand([(ValueError), (TypeError), (RuntimeError), (Exception)])
    def test_fragment_raises_FragmentHandledException_in_full_app_run(
        self, exception_type: type[Exception]
    ):
        """Ensures that during full-app run the exceptions are raised."""
        with patch(
            "streamlit.runtime.fragment.get_script_run_ctx"
        ) as patched_get_script_run_ctx:
            ctx = MagicMock()
            ctx.fragment_storage = MagicMock()
            patched_get_script_run_ctx.return_value = ctx

            @fragment
            def my_fragment():
                raise exception_type()

            with pytest.raises(FragmentHandledException):
                my_fragment()

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_fragment_additional_hash_info_param_used_for_generating_id(
        self, patched_get_script_run_ctx
    ):
        """Test that the internal function can be called with an
        additional hash info parameter."""
        ctx = MagicMock()
        patched_get_script_run_ctx.return_value = ctx

        def my_function():
            return ThreadState.get().fragment_id

        fragment_id1 = _fragment(my_function)()
        fragment_id2 = _fragment(my_function, additional_hash_info="some_hash_info")()
        assert fragment_id1 != fragment_id2

        # countercheck
        fragment_id2 = _fragment(my_function, additional_hash_info="")()
        assert fragment_id1 == fragment_id2

    @patch("streamlit.error_util.show_uncaught_app_exception")
    @patch("streamlit.error_util._log_uncaught_app_exception")
    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_on_script_error_handler_called_with_exception(
        self,
        patched_get_script_run_ctx,
        mock_log: MagicMock,
        mock_show: MagicMock,
    ):
        """Test that the on_script_error handler is called with the exception in fragment."""
        ctx = MagicMock()
        ctx.fragment_storage = MagicMock()
        handler = MagicMock(return_value=None)
        ctx.on_script_error = handler
        patched_get_script_run_ctx.return_value = ctx

        test_exception = ValueError("fragment error")

        @fragment
        def my_fragment():
            raise test_exception

        with pytest.raises(FragmentHandledException):
            my_fragment()

        handler.assert_called_once_with(test_exception)
        mock_log.assert_called_once_with(test_exception)
        mock_show.assert_called_once_with(test_exception)

    @patch("streamlit.error_util.show_uncaught_app_exception")
    @patch("streamlit.error_util._log_uncaught_app_exception")
    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_on_script_error_handler_returns_true_suppresses_ui(
        self,
        patched_get_script_run_ctx,
        mock_log: MagicMock,
        mock_show: MagicMock,
    ):
        """Test that returning True from handler suppresses UI display in fragment."""
        ctx = MagicMock()
        ctx.fragment_storage = MagicMock()
        handler = MagicMock(return_value=True)
        ctx.on_script_error = handler
        patched_get_script_run_ctx.return_value = ctx

        @fragment
        def my_fragment():
            raise ValueError("fragment error")

        with pytest.raises(FragmentHandledException):
            my_fragment()

        handler.assert_called_once()
        mock_log.assert_called_once()
        mock_show.assert_not_called()

    @patch("streamlit.error_util._LOGGER")
    @patch("streamlit.error_util.show_uncaught_app_exception")
    @patch("streamlit.error_util._log_uncaught_app_exception")
    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_on_script_error_handler_exception_logged_and_ui_shown(
        self,
        patched_get_script_run_ctx,
        mock_log: MagicMock,
        mock_show: MagicMock,
        mock_logger: MagicMock,
    ):
        """Test that handler exceptions are logged and default UI is shown in fragment."""
        ctx = MagicMock()
        ctx.fragment_storage = MagicMock()
        patched_get_script_run_ctx.return_value = ctx

        def raising_handler(exc: Exception) -> bool | None:
            raise RuntimeError("handler error")

        ctx.on_script_error = raising_handler
        test_exception = ValueError("original error")

        @fragment
        def my_fragment():
            raise test_exception

        with pytest.raises(FragmentHandledException):
            my_fragment()

        mock_logger.exception.assert_called_once_with(
            "on_script_error handler raised an exception"
        )
        mock_show.assert_called_once_with(test_exception)


# TESTS FOR WRITING TO CONTAINERS OUTSIDE AND INSIDE OF FRAGMENT

APP_FUNCTION = Callable[[ELEMENT_PRODUCER], None]


def _run_fragment_writes_to_outside_container_app(
    element_producer: ELEMENT_PRODUCER,
) -> None:
    """App with container outside of fragment."""

    outside_container = st.container()

    @fragment
    def _some_method():
        st.write("Hello")
        # this is forbidden
        with outside_container:
            element_producer()

    _some_method()


def _run_fragment_writes_to_nested_outside_container_app(
    element_producer: ELEMENT_PRODUCER,
) -> None:
    """App with nested container outside of fragment."""
    with st.container():
        outside_container = st.container()

    @fragment
    def _some_method():
        st.write("Hello")
        # this is forbidden
        with outside_container:
            element_producer()

    _some_method()


def _run_fragment_writes_to_nested_outside_container_app2(
    element_producer: ELEMENT_PRODUCER,
) -> None:
    """App with nested container outside of fragment writing from nested container."""
    with st.container():
        outside_container = st.container()

    @fragment
    def _some_method():
        st.write("Hello")
        # this is forbidden
        with outside_container, st.container():
            element_producer()

    _some_method()


def _run_fragment_writes_to_nested_outside_container_app3(
    element_producer: ELEMENT_PRODUCER,
) -> None:
    """App with nested container outside of fragment writing from nested container."""
    with st.container():
        outside_container = st.container()

    @fragment
    def _some_method():
        st.write("Hello")
        with st.container():
            # this is forbidden
            with outside_container:
                element_producer()

    _some_method()


def _run_fragment_writes_to_inside_container_app(
    element_producer: ELEMENT_PRODUCER,
) -> None:
    """App with container inside of fragment."""

    @fragment
    def _some_method():
        inside_container = st.container()

        st.write("Hello")
        with inside_container:
            element_producer()

    _some_method()


def _run_fragment_writes_to_nested_inside_container_app(
    element_producer: ELEMENT_PRODUCER,
) -> None:
    """App with container inside of fragment."""

    @fragment
    def _some_method():
        inside_container = st.container()

        st.write("Hello")
        with st.container(), inside_container:
            element_producer()

    _some_method()


outside_container_writing_apps: list[APP_FUNCTION] = [
    _run_fragment_writes_to_outside_container_app,
    _run_fragment_writes_to_nested_outside_container_app,
    _run_fragment_writes_to_nested_outside_container_app2,
    _run_fragment_writes_to_nested_outside_container_app3,
]

inside_container_writing_apps: list[APP_FUNCTION] = [
    _run_fragment_writes_to_inside_container_app,
    _run_fragment_writes_to_nested_inside_container_app,
]

TEST_TUPLE = tuple[str, APP_FUNCTION, ELEMENT_PRODUCER]


def get_test_tuples(
    app_functions: list[APP_FUNCTION],
    elements: list[tuple[str, Callable[[], DeltaGenerator]]],
) -> list[TEST_TUPLE]:
    """Create a tuple of (name, app-to-run, element-producer), so that each passed app runs with every passed element.

    Parameters
    ----------
    app_functions : list[APP_FUNCTION]
        Functions that run Streamlit elements like they are an app.
    elements : list[tuple[str, Callable[[], DeltaGenerator]]]
        Tuples of (name, element-producer) where name describes the produced element and element_producer
        is a function that executes a Streamlit element.
    """
    return [
        (_element_producer[0], _app, _element_producer[1])
        for _app in app_functions
        for _element_producer in elements
    ]


class FragmentCannotWriteToOutsidePathTest(DeltaGeneratorTestCase):
    # Suppress unawaited coroutine warning from MagicMock(spec=Runtime). This occurs
    # when rich's exception formatter accesses auto-created AsyncMock attributes.
    pytestmark = pytest.mark.filterwarnings(
        "ignore:coroutine.*was never awaited:RuntimeWarning"
    )

    @parameterized.expand(
        get_test_tuples(outside_container_writing_apps, WIDGET_ELEMENTS)
    )
    def test_write_element_outside_container_raises_exception_for_widgets(
        self,
        _: str,  # the test name argument used by pytest
        _app: Callable[[Callable[[], DeltaGenerator]], None],
        _element_producer: ELEMENT_PRODUCER,
    ):
        with pytest.raises(FragmentHandledException) as ex:
            _app(_element_producer)

        inner_exception = ex.value.__cause__ or ex.value.__context__

        assert isinstance(
            inner_exception, StreamlitFragmentWidgetsNotAllowedOutsideError
        )

    @parameterized.expand(
        get_test_tuples(outside_container_writing_apps, NON_WIDGET_ELEMENTS)
    )
    def test_write_element_outside_container_succeeds_for_nonwidgets(
        self,
        _: str,  # the test name argument used by pytest
        _app: Callable[[Callable[[], DeltaGenerator]], None],
        element_producer: ELEMENT_PRODUCER,
    ):
        _app(element_producer)

    @parameterized.expand(
        get_test_tuples(
            inside_container_writing_apps, WIDGET_ELEMENTS + NON_WIDGET_ELEMENTS
        )
    )
    def test_write_elements_inside_container_succeeds_for_all(
        self,
        _: str,  # the test name argument used by pytest
        _app: Callable[[Callable[[], DeltaGenerator]], None],
        element_producer: ELEMENT_PRODUCER,
    ):
        _app(element_producer)


@pytest.mark.skipif(
    sys.version_info < (3, 14),
    reason="PEP 649 deferred annotation evaluation is only in Python 3.14+",
)
def test_fragment_decorator_handles_pep649_annotations() -> None:
    """Handles PEP 649 deferred annotations when preserving function signature.

    On Python 3.14+, inspect.signature() raises NameError for annotations
    referencing types imported under TYPE_CHECKING. Our fix catches NameError
    via contextlib.suppress when setting __signature__ on decorated functions.

    See: https://github.com/streamlit/streamlit/issues/14324
    """
    import inspect
    from unittest.mock import MagicMock

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.delta_generator_singletons import context_dg_stack
    from streamlit.runtime.fragment import fragment
    from tests.testutil import create_pep649_function

    def base_func(items: object) -> None:
        pass

    func = create_pep649_function(
        base_func, {"items": "UndefinedType", "return": "None"}
    )

    # Verify that inspect.signature() without STRING format raises NameError
    with pytest.raises(NameError, match="UndefinedType"):
        inspect.signature(func)

    # Set up the required context for fragment to work
    root_container = MagicMock()
    original_dg_stack = context_dg_stack.get()
    context_dg_stack.set(
        (
            DeltaGenerator(
                root_container=root_container,
                cursor=MagicMock(root_container=root_container),
            ),
        )
    )

    try:
        # Apply the fragment decorator - should not raise NameError
        decorated = fragment(func)

        # The decorator should complete without error, even though __signature__
        # couldn't be set due to NameError. The function should still work.
        assert decorated.__name__ == "base_func"
    finally:
        context_dg_stack.set(original_dg_stack)


@pytest.mark.parametrize(
    ("method_name", "args", "kwargs"),
    [
        ("clear", (), {}),
        ("lookup", ("key",), {}),
        ("register", ("key", "fragment"), {"parent_fragment_id": None}),
        ("clear_stale_descendants", ("root", frozenset()), {}),
        ("registration_sequence", (), {}),
        ("ids_registered_after", (0,), {}),
        ("order_fragment_ids", ([],), {}),
        ("delete", ("key",), {}),
        ("contains", ("key",), {}),
    ],
)
def test_fragment_storage_abstract_methods_raise_not_implemented(
    method_name: str, args: tuple, kwargs: dict
) -> None:
    """Each abstract ``FragmentStorage`` method raises ``NotImplementedError``.

    ``FragmentStorage`` is a ``Protocol`` with ``@abstractmethod`` markers,
    so we call the unbound method on a sentinel ``self`` to exercise the body.
    """
    unbound = getattr(FragmentStorage, method_name)
    with pytest.raises(NotImplementedError):
        unbound(object(), *args, **kwargs)


@pytest.mark.parametrize("op", [copy.copy, copy.deepcopy], ids=["copy", "deepcopy"])
def test_memory_fragment_storage_rejects_copy_and_deepcopy(
    op: Callable[[MemoryFragmentStorage], MemoryFragmentStorage],
) -> None:
    """``MemoryFragmentStorage`` rejects ``copy`` and ``deepcopy`` since it
    holds a lock and shared mutable state that would silently desync."""
    with pytest.raises(TypeError):
        op(MemoryFragmentStorage())


def test_order_fragment_ids_preserves_order_on_malformed_cycle() -> None:
    """When every queued fragment has a queued ancestor (e.g. a parent cycle),
    ``order_fragment_ids`` preserves the original order rather than looping."""
    storage = MemoryFragmentStorage()
    storage.register("a", lambda: None)
    storage.register("b", lambda: None)
    # Hand-construct a cycle in the parent map: a <-> b.
    storage._parent_by_id["a"] = "b"
    storage._parent_by_id["b"] = "a"

    assert storage.order_fragment_ids(["a", "b"]) == ["a", "b"]
    assert storage.order_fragment_ids(["b", "a"]) == ["b", "a"]


# PARALLEL FRAGMENT TESTS


@patch("streamlit.runtime.fragment.get_script_run_ctx")
def test_fragment_parallel_parameter_accepted(
    patched_get_script_run_ctx: MagicMock,
) -> None:
    """@st.fragment(parallel=True) decorates without error and registers the fragment."""
    ctx = MagicMock()
    ctx.fragment_storage = MagicMock()
    ctx.fragment_ids_this_run = None
    patched_get_script_run_ctx.return_value = ctx

    ThreadState.initialize()

    @fragment(parallel=True)
    def my_parallel_fragment() -> None:
        pass

    my_parallel_fragment()
    assert ctx.fragment_storage.register.call_count == 1


@patch("streamlit.runtime.fragment.get_script_run_ctx")
def test_parallel_fragment_dispatches_to_coordinator(
    patched_get_script_run_ctx: MagicMock,
) -> None:
    """Mock coordinator.submit(), call a parallel fragment during a full-app run."""
    ctx = MagicMock()
    ctx.fragment_storage = MemoryFragmentStorage()
    ctx.fragment_ids_this_run = None
    ctx.new_fragment_ids = ThreadSafeSet()
    ctx.cursors = {}
    mock_coordinator = MagicMock()
    ctx.parallel_coordinator = mock_coordinator
    patched_get_script_run_ctx.return_value = ctx

    ThreadState.initialize()

    @fragment(parallel=True)
    def my_parallel_fragment() -> None:
        pass

    my_parallel_fragment()

    mock_coordinator.submit.assert_called_once()
    call_args = mock_coordinator.submit.call_args
    assert call_args[0][0] == _run_parallel_fragment


@patch("streamlit.runtime.fragment.get_script_run_ctx")
def test_parallel_fragment_returns_none(
    patched_get_script_run_ctx: MagicMock,
) -> None:
    """Parallel fragment call returns None."""
    ctx = MagicMock()
    ctx.fragment_storage = MemoryFragmentStorage()
    ctx.fragment_ids_this_run = None
    ctx.new_fragment_ids = ThreadSafeSet()
    ctx.cursors = {}
    ctx.parallel_coordinator = MagicMock()
    patched_get_script_run_ctx.return_value = ctx

    ThreadState.initialize()

    @fragment(parallel=True)
    def my_parallel_fragment() -> str:
        return "result"

    result = my_parallel_fragment()
    assert result is None


@patch("streamlit.runtime.fragment.get_script_run_ctx")
def test_parallel_fragment_sequential_during_fragment_rerun(
    patched_get_script_run_ctx: MagicMock,
) -> None:
    """Skip coordinator dispatch whenever ``fragment_ids_this_run`` is set.

    The runtime populates ``fragment_ids_this_run`` during fragment-only script
    portions so DG/cursor snapshots restore correctly (see ``wrapped_fragment``
    guard). `_fragment(..., parallel=True)` only dispatches via
    ``_dispatch_parallel_fragment`` when this field is falsy. A mocked non-empty
    list proxies that rerun mode without invoking the production runner wiring.
    """
    ctx = MagicMock()
    ctx.fragment_storage = MagicMock()
    # Non-empty ⇒ fragment rerun path; mocked stand-in ID is irrelevant to the assertion.
    ctx.fragment_ids_this_run = ["some_fragment_id"]
    ctx.new_fragment_ids = ThreadSafeSet()
    ctx.cursors = {}
    mock_coordinator = MagicMock()
    ctx.parallel_coordinator = mock_coordinator
    patched_get_script_run_ctx.return_value = ctx

    called = False

    @fragment(parallel=True)
    def my_parallel_fragment() -> None:
        nonlocal called
        called = True

    my_parallel_fragment()

    assert called
    mock_coordinator.submit.assert_not_called()


@patch("streamlit.runtime.fragment.get_script_run_ctx")
def test_wrapped_fragment_skips_container_when_pre_allocated(
    patched_get_script_run_ctx: MagicMock,
) -> None:
    """When skip signal is set, no st.container() is created but fragment body runs.

    If pre_allocated_container_fragment_id matches the fragment's ID, the fragment
    skips creating a container (since one was pre-allocated) but still executes
    its body.
    """
    ctx = MagicMock()
    ctx.fragment_storage = MemoryFragmentStorage()
    ctx.fragment_ids_this_run = None
    ctx.new_fragment_ids = ThreadSafeSet()
    ctx.cursors = {}
    patched_get_script_run_ctx.return_value = ctx

    ThreadState.initialize()

    fragment_body_called = False

    @fragment
    def my_fragment() -> None:
        nonlocal fragment_body_called
        fragment_body_called = True

    my_fragment()
    fragment_body_called = False

    saved_fragment = next(iter(ctx.fragment_storage._fragments.values()))
    fragment_id = next(iter(ctx.fragment_storage._fragments.keys()))

    with patch("streamlit.container") as mock_container:
        mock_container.return_value.__enter__ = MagicMock()
        mock_container.return_value.__exit__ = MagicMock()

        ThreadState.update(pre_allocated_container_fragment_id=fragment_id)
        saved_fragment()
        mock_container.assert_not_called()

    assert fragment_body_called


@patch("streamlit.runtime.fragment.get_script_run_ctx")
def test_wrapped_fragment_clears_skip_signal_after_use(
    patched_get_script_run_ctx: MagicMock,
) -> None:
    """Skip signal is cleared after wrapped_fragment runs."""
    ctx = MagicMock()
    ctx.fragment_storage = MemoryFragmentStorage()
    ctx.fragment_ids_this_run = None
    ctx.new_fragment_ids = ThreadSafeSet()
    ctx.cursors = {}
    patched_get_script_run_ctx.return_value = ctx

    ThreadState.initialize()

    @fragment
    def my_fragment() -> None:
        pass

    my_fragment()

    saved_fragment = next(iter(ctx.fragment_storage._fragments.values()))
    fragment_id = next(iter(ctx.fragment_storage._fragments.keys()))

    ThreadState.update(pre_allocated_container_fragment_id=fragment_id)
    with patch("streamlit.container"):
        saved_fragment()

    assert ThreadState.get().pre_allocated_container_fragment_id is None


@patch("streamlit.runtime.fragment.get_script_run_ctx")
def test_nested_sequential_fragment_creates_own_container(
    patched_get_script_run_ctx: MagicMock,
) -> None:
    """Nested sequential fragments both register and each creates its own container.

    Both fragments are sequential (no parallel=True) and run on the main thread.
    The inner fragment must call st.container() to create its own container.
    """
    ctx = MagicMock()
    ctx.fragment_storage = MemoryFragmentStorage()
    ctx.fragment_ids_this_run = None
    ctx.new_fragment_ids = ThreadSafeSet()
    ctx.cursors = {}
    patched_get_script_run_ctx.return_value = ctx

    ThreadState.initialize()

    inner_called = False

    @fragment
    def inner_fragment() -> None:
        nonlocal inner_called
        inner_called = True

    with patch("streamlit.container") as mock_container:
        mock_container.return_value.__enter__ = MagicMock()
        mock_container.return_value.__exit__ = MagicMock()

        @fragment
        def outer_fragment() -> None:
            inner_fragment()

        outer_fragment()

        # Outer creates a container, then inner creates its own container
        assert mock_container.call_count == 2

    assert inner_called
    assert len(ctx.fragment_storage._fragments) == 2


def test_run_parallel_fragment_handles_rerun_exception() -> None:
    """_run_parallel_fragment calls coordinator.request_rerun() on RerunException."""
    mock_coordinator = MagicMock()
    mock_ctx = MagicMock()
    mock_ctx.parallel_coordinator = mock_coordinator

    rerun_exc = RerunException(rerun_data=None)

    def raising_fragment() -> None:
        raise rerun_exc

    with (
        patch("streamlit.runtime.fragment.get_script_run_ctx", return_value=mock_ctx),
        patch("streamlit.delta_generator_singletons.context_dg_stack"),
    ):
        ThreadState.initialize()
        _run_parallel_fragment("test_id", raising_fragment, [])

    mock_coordinator.request_rerun.assert_called_once_with(rerun_exc)


def test_run_parallel_fragment_handles_stop_exception() -> None:
    """_run_parallel_fragment calls coordinator.request_stop() on StopException."""
    mock_coordinator = MagicMock()
    mock_ctx = MagicMock()
    mock_ctx.parallel_coordinator = mock_coordinator

    def raising_fragment() -> None:
        raise StopException()

    with (
        patch("streamlit.runtime.fragment.get_script_run_ctx", return_value=mock_ctx),
        patch("streamlit.delta_generator_singletons.context_dg_stack"),
    ):
        ThreadState.initialize()
        _run_parallel_fragment("test_id", raising_fragment, [])

    mock_coordinator.request_stop.assert_called_once()


def test_run_parallel_fragment_handles_fragment_handled_exception() -> None:
    """_run_parallel_fragment swallows FragmentHandledException."""
    mock_coordinator = MagicMock()
    mock_ctx = MagicMock()
    mock_ctx.parallel_coordinator = mock_coordinator

    def raising_fragment() -> None:
        raise FragmentHandledException(ValueError("test"))

    with (
        patch("streamlit.runtime.fragment.get_script_run_ctx", return_value=mock_ctx),
        patch("streamlit.delta_generator_singletons.context_dg_stack"),
    ):
        ThreadState.initialize()
        _run_parallel_fragment("test_id", raising_fragment, [])

    mock_coordinator.request_rerun.assert_not_called()
    mock_coordinator.request_stop.assert_not_called()


def test_nested_parallel_fragment_dispatches_from_worker() -> None:
    """Nested parallel fragment inside a worker also dispatches to the coordinator.

    When _run_parallel_fragment executes a wrapped_fragment whose body calls
    a nested @fragment(parallel=True), that nested fragment should also dispatch
    via coordinator.submit() (since fragment_ids_this_run is None in full-app runs).
    """
    mock_coordinator = MagicMock()
    mock_ctx = MagicMock()
    mock_ctx.fragment_storage = MemoryFragmentStorage()
    mock_ctx.fragment_ids_this_run = None
    mock_ctx.new_fragment_ids = ThreadSafeSet()
    mock_ctx.cursors = {}
    mock_ctx.parallel_coordinator = mock_coordinator

    inner_fragment_called = False

    @fragment(parallel=True)
    def inner_parallel() -> None:
        nonlocal inner_fragment_called
        inner_fragment_called = True

    def outer_wrapped_fragment() -> None:
        inner_parallel()

    with (
        patch("streamlit.runtime.fragment.get_script_run_ctx", return_value=mock_ctx),
        patch("streamlit.delta_generator_singletons.context_dg_stack"),
    ):
        ThreadState.initialize()
        _run_parallel_fragment("outer_id", outer_wrapped_fragment, [])

    # The inner parallel fragment dispatches to the coordinator
    assert mock_coordinator.submit.call_count == 1
    # The inner fragment body does not run inline (it's dispatched)
    assert not inner_fragment_called


@patch("streamlit.runtime.fragment.get_script_run_ctx")
def test_dispatch_restores_calling_thread_dg_stack(
    patched_get_script_run_ctx: MagicMock,
) -> None:
    """After dispatch, calling thread's dg_stack doesn't contain the pre-allocated container."""
    ctx = MagicMock()
    ctx.fragment_storage = MemoryFragmentStorage()
    ctx.new_fragment_ids = ThreadSafeSet()
    ctx.parallel_coordinator = MagicMock()
    patched_get_script_run_ctx.return_value = ctx

    original_dg_stack = context_dg_stack.get()
    original_len = len(original_dg_stack)

    ThreadState.initialize()

    def wrapped_fragment() -> None:
        pass

    _dispatch_parallel_fragment(ctx, "test_fragment_id", wrapped_fragment)

    assert len(context_dg_stack.get()) == original_len


@patch("streamlit.runtime.fragment.get_script_run_ctx")
def test_worker_dg_stack_points_at_pre_allocated_container(
    patched_get_script_run_ctx: MagicMock,
) -> None:
    """Worker's context_dg_stack includes the pre-allocated container.

    The dg_stack passed to the worker should have exactly one more entry than
    the original stack (the pre-allocated container for the fragment).
    """
    ctx = MagicMock()
    ctx.fragment_storage = MemoryFragmentStorage()
    ctx.new_fragment_ids = ThreadSafeSet()
    mock_coordinator = MagicMock()
    ctx.parallel_coordinator = mock_coordinator
    patched_get_script_run_ctx.return_value = ctx

    ThreadState.initialize()
    original_len = len(context_dg_stack.get())

    def wrapped_fragment() -> None:
        pass

    _dispatch_parallel_fragment(ctx, "test_fragment_id", wrapped_fragment)

    call_args = mock_coordinator.submit.call_args[0]
    dg_stack_snapshot = call_args[3]
    assert len(dg_stack_snapshot) == original_len + 1


@patch("streamlit.runtime.fragment.get_script_run_ctx")
def test_run_every_parallel_fragment_reruns_sequentially(
    patched_get_script_run_ctx: MagicMock,
) -> None:
    """run_every + parallel=True dispatches on initial run, reruns inline on timer.

    Phase 1: Initial full-app run dispatches to coordinator.
    Phase 2: Subsequent fragment rerun (fragment_ids_this_run is set) executes inline,
    not dispatched to coordinator.
    """
    ctx = MagicMock()
    ctx.fragment_storage = MemoryFragmentStorage()
    ctx.fragment_ids_this_run = None
    ctx.new_fragment_ids = ThreadSafeSet()
    ctx.cursors = {}
    mock_coordinator = MagicMock()
    ctx.parallel_coordinator = mock_coordinator
    patched_get_script_run_ctx.return_value = ctx

    ThreadState.initialize()

    call_count = 0

    @fragment(parallel=True, run_every=5)
    def my_fragment() -> None:
        nonlocal call_count
        call_count += 1

    # Phase 1: Initial run dispatches (body does not execute inline)
    my_fragment()
    assert mock_coordinator.submit.call_count == 1
    assert call_count == 0

    # Phase 2: Fragment rerun executes inline
    saved_fragment = next(iter(ctx.fragment_storage._fragments.values()))
    ctx.fragment_ids_this_run = ["some_id"]
    mock_coordinator.submit.reset_mock()
    saved_fragment()
    mock_coordinator.submit.assert_not_called()
    assert call_count == 1


def test_sequential_fragment_inside_parallel_worker_creates_own_container() -> None:
    """Sequential fragment inside a parallel worker creates its own container.

    When _run_parallel_fragment executes a wrapped_fragment whose body calls
    a sequential @fragment, that inner fragment must create its own container
    via st.container() because the outer's pre_allocated_container_fragment_id
    skip signal has already been consumed (and is cleared after use).
    """
    mock_coordinator = MagicMock()
    mock_ctx = MagicMock()
    mock_ctx.fragment_storage = MemoryFragmentStorage()
    mock_ctx.fragment_ids_this_run = None
    mock_ctx.new_fragment_ids = ThreadSafeSet()
    mock_ctx.cursors = {}
    mock_ctx.parallel_coordinator = mock_coordinator

    inner_called = False

    @fragment
    def inner_sequential() -> None:
        nonlocal inner_called
        inner_called = True

    def outer_wrapped_fragment() -> None:
        inner_sequential()

    with (
        patch("streamlit.runtime.fragment.get_script_run_ctx", return_value=mock_ctx),
        patch("streamlit.delta_generator_singletons.context_dg_stack"),
        patch("streamlit.container") as mock_container,
    ):
        mock_container.return_value.__enter__ = MagicMock(return_value=None)
        mock_container.return_value.__exit__ = MagicMock(return_value=False)

        ThreadState.initialize()
        _run_parallel_fragment("outer_id", outer_wrapped_fragment, [])

        # Inner sequential fragment creates its own container
        assert mock_container.call_count == 1
        assert inner_called


@patch("streamlit.runtime.fragment.get_script_run_ctx")
def test_skip_signal_isolation_inner_fragment_sees_none_after_outer_consumes(
    patched_get_script_run_ctx: MagicMock,
) -> None:
    """Skip signal is isolated: inner fragment sees None after outer consumes it.

    When the outer fragment runs with pre_allocated_container_fragment_id set
    to the outer's ID, the outer consumes (clears) the signal. A nested inner
    fragment should then see None, confirming the skip signal doesn't leak to
    nested fragments.
    """
    mock_ctx = MagicMock()
    mock_ctx.fragment_storage = MemoryFragmentStorage()
    mock_ctx.fragment_ids_this_run = None
    mock_ctx.new_fragment_ids = ThreadSafeSet()
    mock_ctx.cursors = {}
    patched_get_script_run_ctx.return_value = mock_ctx

    ThreadState.initialize()

    captured_inner_skip_signal: list[str | None] = []

    @fragment
    def inner_fragment() -> None:
        captured_inner_skip_signal.append(
            ThreadState.get().pre_allocated_container_fragment_id
        )

    @fragment
    def outer_fragment() -> None:
        inner_fragment()

    # First call registers fragments and gets their IDs
    outer_fragment()
    outer_fragment_id = next(iter(mock_ctx.fragment_storage._fragments.keys()))

    # Get saved wrapped_fragment for outer
    outer_saved = mock_ctx.fragment_storage._fragments[outer_fragment_id]

    # Reset and set up for second call with skip signal
    captured_inner_skip_signal.clear()
    ThreadState.update(pre_allocated_container_fragment_id=outer_fragment_id)

    with patch("streamlit.container") as mock_container:
        mock_container.return_value.__enter__ = MagicMock(return_value=None)
        mock_container.return_value.__exit__ = MagicMock(return_value=False)

        outer_saved()

    # Inner fragment should see None because outer consumed the signal
    assert len(captured_inner_skip_signal) == 1
    assert captured_inner_skip_signal[0] is None


def test_parallel_fragment_nested_inside_rerun_executes_sequentially() -> None:
    """Parallel fragment nested inside a fragment rerun executes sequentially.

    When ctx.fragment_ids_this_run is set (indicating a fragment rerun), any
    nested @fragment(parallel=True) should execute inline rather than dispatch
    to the coordinator. The sequential fallback propagates into nested parallel
    fragments during reruns.
    """
    mock_ctx = MagicMock()
    mock_ctx.fragment_storage = MemoryFragmentStorage()
    mock_ctx.fragment_ids_this_run = ["outer_id"]
    mock_ctx.new_fragment_ids = ThreadSafeSet()
    mock_ctx.cursors = {}
    mock_coordinator = MagicMock()
    mock_ctx.parallel_coordinator = mock_coordinator

    inner_called = False

    @fragment(parallel=True)
    def inner_parallel() -> None:
        nonlocal inner_called
        inner_called = True

    with patch("streamlit.runtime.fragment.get_script_run_ctx", return_value=mock_ctx):
        ThreadState.initialize()

        inner_parallel()

        # During fragment rerun, parallel fragments execute inline
        mock_coordinator.submit.assert_not_called()
        assert inner_called


def test_rerun_exception_propagates_from_nested_fragment_inside_worker() -> None:
    """RerunException from nested fragment inside worker triggers request_rerun.

    When _run_parallel_fragment executes a wrapped_fragment whose body calls
    an inner fragment that raises RerunException, the exception propagates up:
    1. Inner fragment's wrapped_fragment re-raises RerunException (lines 420-427)
    2. Outer _run_parallel_fragment catches it and calls coordinator.request_rerun()

    This documents the actual exception propagation path through nested fragments.
    """
    mock_coordinator = MagicMock()
    mock_ctx = MagicMock()
    mock_ctx.fragment_storage = MemoryFragmentStorage()
    mock_ctx.fragment_ids_this_run = None
    mock_ctx.new_fragment_ids = ThreadSafeSet()
    mock_ctx.cursors = {}
    mock_ctx.parallel_coordinator = mock_coordinator

    rerun_exc = RerunException(rerun_data=None)

    @fragment
    def inner_fragment_raises_rerun() -> None:
        raise rerun_exc

    def outer_wrapped_fragment() -> None:
        inner_fragment_raises_rerun()

    with (
        patch("streamlit.runtime.fragment.get_script_run_ctx", return_value=mock_ctx),
        patch("streamlit.delta_generator_singletons.context_dg_stack"),
        patch("streamlit.container") as mock_container,
    ):
        mock_container.return_value.__enter__ = MagicMock(return_value=None)
        mock_container.return_value.__exit__ = MagicMock(return_value=False)

        ThreadState.initialize()
        _run_parallel_fragment("outer_id", outer_wrapped_fragment, [])

    # RerunException propagates from inner fragment to _run_parallel_fragment
    # which catches it and calls coordinator.request_rerun()
    mock_coordinator.request_rerun.assert_called_once_with(rerun_exc)


# PARALLEL FRAGMENT API RESTRICTIONS TESTS


class ParallelFragmentAPIRestrictionsTest(unittest.TestCase):
    """Tests for API restrictions in parallel fragment workers."""

    def test_check_not_parallel_worker_raises_when_flag_is_true(self) -> None:
        """_check_not_parallel_worker raises StreamlitAPIException when is_parallel_worker=True."""
        ThreadState.initialize(is_parallel_worker=True)
        try:
            with pytest.raises(StreamlitAPIException) as exc_info:
                _check_not_parallel_worker("st.test_api")

            assert "st.test_api" in str(exc_info.value)
            assert "parallel fragment" in str(exc_info.value)
        finally:
            ThreadState.initialize(is_parallel_worker=False)

    def test_check_not_parallel_worker_allows_when_flag_is_false(self) -> None:
        """_check_not_parallel_worker does not raise when is_parallel_worker=False."""
        ThreadState.initialize(is_parallel_worker=False)

        _check_not_parallel_worker("st.test_api")

    def test_check_not_parallel_worker_allows_when_no_thread_state(self) -> None:
        """_check_not_parallel_worker does not raise when ThreadState is not initialized."""
        import contextvars

        ctx = contextvars.copy_context()

        def run_in_fresh_context() -> None:
            _check_not_parallel_worker("st.test_api")

        ctx.run(run_in_fresh_context)

    def test_run_parallel_fragment_sets_is_parallel_worker(self) -> None:
        """_run_parallel_fragment sets is_parallel_worker=True."""
        mock_coordinator = MagicMock()
        mock_ctx = MagicMock()
        mock_ctx.parallel_coordinator = mock_coordinator

        captured_is_parallel_worker: bool | None = None

        def capturing_fragment() -> None:
            nonlocal captured_is_parallel_worker
            captured_is_parallel_worker = ThreadState.get().is_parallel_worker

        with (
            patch(
                "streamlit.runtime.fragment.get_script_run_ctx", return_value=mock_ctx
            ),
            patch("streamlit.delta_generator_singletons.context_dg_stack"),
        ):
            ThreadState.initialize()
            _run_parallel_fragment("test_id", capturing_fragment, [])

        assert captured_is_parallel_worker is True

    def test_nested_sequential_fragment_inherits_is_parallel_worker(self) -> None:
        """Nested sequential fragment via ThreadState.scoped() inherits is_parallel_worker."""
        ThreadState.initialize(is_parallel_worker=True)

        assert ThreadState.get().is_parallel_worker is True

        with ThreadState.scoped(fragment_id="inner"):
            assert ThreadState.get().is_parallel_worker is True
            with pytest.raises(StreamlitAPIException):
                _check_not_parallel_worker("@st.dialog")

        assert ThreadState.get().is_parallel_worker is True
