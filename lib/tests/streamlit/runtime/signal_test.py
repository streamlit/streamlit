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

"""Tests for st.signal and its runtime pieces (Signal, SignalStorage)."""

from __future__ import annotations

import copy
from typing import TYPE_CHECKING, Any, cast
from unittest.mock import MagicMock, patch

import pytest

from streamlit.errors import StreamlitAPIException
from streamlit.runtime import signal as signal_module
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState
from streamlit.runtime.signal import MemorySignalStorage, Signal, signal

if TYPE_CHECKING:
    from collections.abc import Iterator


@pytest.fixture(autouse=True)
def _fresh_thread_state() -> Iterator[None]:
    """Give every test a clean FragmentThreadState binding."""
    ThreadState.initialize()
    yield
    ThreadState.initialize()


def _make_ctx(
    fragment_ids_this_run: list[str] | None = None,
    signal_storage: MemorySignalStorage | None = None,
) -> MagicMock:
    """Create a mock ScriptRunContext with real signal-related fields."""
    ctx = MagicMock()
    ctx.signal_storage = (
        signal_storage if signal_storage is not None else MemorySignalStorage()
    )
    ctx.fragment_storage = MemoryFragmentStorage()
    ctx.signal_keys_declared_this_run = set()
    ctx.signals_fired_this_pass = set()
    ctx.fragment_ids_consumed = set()
    ctx.fragment_ids_this_run = fragment_ids_this_run
    return ctx


# =============================================================================
# MemorySignalStorage
# =============================================================================


def test_storage_declare_and_contains() -> None:
    """declare() creates a record that contains() can find."""
    storage = MemorySignalStorage()
    assert not storage.contains("k")

    storage.declare("k", 1, reset_watchers=False)
    assert storage.contains("k")


def test_storage_get_state_resolves_lazy_initial_once() -> None:
    """A callable initial is invoked lazily on first access only."""
    calls: list[int] = []

    def make_value() -> str:
        calls.append(1)
        return "computed"

    storage = MemorySignalStorage()
    storage.declare("k", make_value, reset_watchers=False)
    assert calls == []

    assert storage.get_state("k") == "computed"
    assert storage.get_state("k") == "computed"
    assert len(calls) == 1


def test_storage_value_initial_is_not_called() -> None:
    """A non-callable initial is used as-is."""
    storage = MemorySignalStorage()
    storage.declare("k", "plain", reset_watchers=False)
    assert storage.get_state("k") == "plain"


def test_storage_missing_key_raises_key_error() -> None:
    """State access and watcher registration require a declared record."""
    storage = MemorySignalStorage()

    with pytest.raises(KeyError):
        storage.get_state("missing")
    with pytest.raises(KeyError):
        storage.set_state("missing", 1)
    with pytest.raises(KeyError):
        storage.register_watcher("missing", "fragment_id")


def test_storage_redeclare_preserves_state_and_updates_initial() -> None:
    """Re-declaration keeps the resolved state but refreshes the initial."""
    storage = MemorySignalStorage()
    storage.declare("k", 1, reset_watchers=False)
    storage.set_state("k", 99)

    storage.declare("k", 2, reset_watchers=True)
    assert storage.get_state("k") == 99


def test_storage_declare_reset_watchers_clears_subscriptions() -> None:
    """Full-run declaration rebuilds the watcher list from scratch."""
    storage = MemorySignalStorage()
    storage.declare("k", 1, reset_watchers=False)
    storage.register_watcher("k", "f1")

    storage.declare("k", 1, reset_watchers=True)
    assert storage.watchers("k") == []

    storage.declare("k", 1, reset_watchers=False)
    assert storage.watchers("k") == []


def test_storage_register_watcher_keeps_order_and_position() -> None:
    """Watchers keep registration order; re-registration keeps the position."""
    storage = MemorySignalStorage()
    storage.declare("k", 1, reset_watchers=False)
    storage.register_watcher("k", "f1")
    storage.register_watcher("k", "f2")
    storage.register_watcher("k", "f3")
    # Re-registration (e.g. during a fragment-only pass) must not move f1.
    storage.register_watcher("k", "f1")

    assert storage.watchers("k") == ["f1", "f2", "f3"]


def test_storage_watchers_returns_copy_and_empty_for_unknown_key() -> None:
    """The returned watcher list is a copy; unknown keys yield an empty list."""
    storage = MemorySignalStorage()
    storage.declare("k", 1, reset_watchers=False)
    storage.register_watcher("k", "f1")

    watchers = storage.watchers("k")
    watchers.append("mutated")
    assert storage.watchers("k") == ["f1"]

    assert storage.watchers("unknown") == []


def test_storage_clear_keeps_only_listed_keys() -> None:
    """clear(keep_keys=...) drops all records that were not re-declared."""
    storage = MemorySignalStorage()
    storage.declare("kept", 1, reset_watchers=False)
    storage.declare("dropped", 2, reset_watchers=False)
    storage.set_state("kept", 11)

    storage.clear(keep_keys=frozenset({"kept"}))

    assert storage.contains("kept")
    assert storage.get_state("kept") == 11
    assert not storage.contains("dropped")


def test_storage_clear_without_keys_drops_everything() -> None:
    """clear() without keep_keys empties the storage."""
    storage = MemorySignalStorage()
    storage.declare("k", 1, reset_watchers=False)

    storage.clear()
    assert not storage.contains("k")


def test_storage_copy_and_deepcopy_raise() -> None:
    """The storage holds a lock and must not be copied."""
    storage = MemorySignalStorage()
    with pytest.raises(TypeError, match="deepcopy"):
        copy.deepcopy(storage)
    with pytest.raises(TypeError, match="copy"):
        copy.copy(storage)


# =============================================================================
# st.signal command
# =============================================================================


def test_signal_returns_handle_and_declares_record() -> None:
    """st.signal declares a record and returns a working handle."""
    ctx = _make_ctx()
    with patch.object(signal_module, "get_script_run_ctx", return_value=ctx):
        sig = signal("US", key="country")

        assert isinstance(sig, Signal)
        assert sig.key == "country"
        assert ctx.signal_storage.contains("country")
        assert sig.value == "US"


def test_signal_duplicate_key_in_same_run_raises() -> None:
    """Creating two signals with the same key in one run fails fast."""
    ctx = _make_ctx()
    with patch.object(signal_module, "get_script_run_ctx", return_value=ctx):
        signal(0, key="dup")
        with pytest.raises(StreamlitAPIException, match="already created"):
            signal(1, key="dup")


def test_signal_same_key_redeclares_across_runs() -> None:
    """Re-declaring the same key in a later run is the normal case."""
    storage = MemorySignalStorage()

    first_run_ctx = _make_ctx(signal_storage=storage)
    with patch.object(signal_module, "get_script_run_ctx", return_value=first_run_ctx):
        sig = signal(0, key="k")
        sig.send(5)

    second_run_ctx = _make_ctx(signal_storage=storage)
    with patch.object(signal_module, "get_script_run_ctx", return_value=second_run_ctx):
        redeclared = signal(0, key="k")
        assert redeclared.value == 5


@pytest.mark.parametrize("bad_key", ["", 123, None])
def test_signal_invalid_key_raises(bad_key: Any) -> None:
    """The key must be a non-empty string."""
    with pytest.raises(StreamlitAPIException, match="non-empty string"):
        signal(0, key=cast("Any", bad_key))


def test_signal_full_run_declare_resets_watchers() -> None:
    """Watcher lists rebuild from scratch on full runs.

    A watcher behind a false conditional is therefore absent after the run.
    """
    storage = MemorySignalStorage()

    first_run_ctx = _make_ctx(signal_storage=storage)
    with patch.object(signal_module, "get_script_run_ctx", return_value=first_run_ctx):
        signal(0, key="k")
        storage.register_watcher("k", "conditional_fragment")

    # Next full run: the fragment is behind a false conditional and never
    # re-registers.
    second_run_ctx = _make_ctx(signal_storage=storage)
    with patch.object(signal_module, "get_script_run_ctx", return_value=second_run_ctx):
        signal(0, key="k")
        assert storage.watchers("k") == []


def test_signal_fragment_pass_declare_preserves_watchers_and_state() -> None:
    """A signal declared inside a rerunning fragment keeps its record."""
    storage = MemorySignalStorage()

    full_run_ctx = _make_ctx(signal_storage=storage)
    with patch.object(signal_module, "get_script_run_ctx", return_value=full_run_ctx):
        sig = signal(0, key="k")
        storage.register_watcher("k", "w1")
        sig.send(5)

    fragment_pass_ctx = _make_ctx(fragment_ids_this_run=["w1"], signal_storage=storage)
    with patch.object(
        signal_module, "get_script_run_ctx", return_value=fragment_pass_ctx
    ):
        redeclared = signal(0, key="k")
        assert storage.watchers("k") == ["w1"]
        assert redeclared.value == 5


def test_signal_bare_mode_returns_detached_working_handle() -> None:
    """Without a script run context, the handle manages its own state."""
    with patch.object(signal_module, "get_script_run_ctx", return_value=None):
        sig = signal(1, key="k")
        assert sig.value == 1

        sig.send(2)
        assert sig.value == 2

        # A bare fire is a no-op without watchers; the state is unchanged.
        sig()
        assert sig.value == 2


def test_stale_handle_self_heals_after_lifecycle_reset() -> None:
    """A handle whose record was dropped resets to its declared initial."""
    storage = MemorySignalStorage()
    ctx = _make_ctx(signal_storage=storage)
    with patch.object(signal_module, "get_script_run_ctx", return_value=ctx):
        sig = signal("initial", key="k")
        sig.send("updated")

        # End of a full run that did not re-declare the signal:
        storage.clear(keep_keys=frozenset())

        assert sig.value == "initial"


def test_lazy_initial_re_resolves_after_lifecycle_reset() -> None:
    """A callable initial runs again after the signal's state was reset."""
    calls: list[int] = []

    def make_value() -> str:
        calls.append(1)
        return "computed"

    ctx = _make_ctx()
    with patch.object(signal_module, "get_script_run_ctx", return_value=ctx):
        sig = signal(make_value, key="k")
        assert calls == []
        assert sig.value == "computed"

        ctx.signal_storage.clear(keep_keys=frozenset())
        assert sig.value == "computed"
        assert len(calls) == 2


# =============================================================================
# Signal.send / Signal.__call__ semantics
# =============================================================================


def test_send_during_full_run_is_state_update_only() -> None:
    """During full runs there is no queue: send() only replaces the state."""
    ctx = _make_ctx(fragment_ids_this_run=None)
    with patch.object(signal_module, "get_script_run_ctx", return_value=ctx):
        sig = signal(0, key="k")
        sig.send(3)

        assert sig.value == 3
        assert ctx.signals_fired_this_pass == set()


def test_send_appends_watchers_to_live_queue_in_declared_order() -> None:
    """In a fragment pass, send() queues the watchers in page order."""
    ctx = _make_ctx(fragment_ids_this_run=["trigger"])
    with patch.object(signal_module, "get_script_run_ctx", return_value=ctx):
        sig = signal(0, key="k")
        ctx.signal_storage.register_watcher("k", "w1")
        ctx.signal_storage.register_watcher("k", "w2")

        sig.send(42)

    assert ctx.fragment_ids_this_run == ["trigger", "w1", "w2"]
    assert ctx.signal_storage.get_state("k") == 42
    assert "k" in ctx.signals_fired_this_pass


def test_send_with_zero_watchers_is_state_update_only() -> None:
    """A fire with no registered watchers leaves the queue untouched."""
    ctx = _make_ctx(fragment_ids_this_run=["trigger"])
    with patch.object(signal_module, "get_script_run_ctx", return_value=ctx):
        sig = signal(0, key="k")
        sig.send(9)

    assert ctx.fragment_ids_this_run == ["trigger"]
    assert ctx.signal_storage.get_state("k") == 9
    assert "k" in ctx.signals_fired_this_pass


def test_send_dedups_against_queued_and_consumed_ids() -> None:
    """Watchers that already ran or are already queued aren't re-queued."""
    ctx = _make_ctx(fragment_ids_this_run=["already_ran", "still_queued"])
    ctx.fragment_ids_consumed.add("already_ran")
    with patch.object(signal_module, "get_script_run_ctx", return_value=ctx):
        sig = signal(0, key="k")
        for watcher_id in ("already_ran", "still_queued", "fresh"):
            ctx.signal_storage.register_watcher("k", watcher_id)

        with patch.object(signal_module._LOGGER, "warning") as mock_warning:
            sig.send(1)

    assert ctx.fragment_ids_this_run == ["already_ran", "still_queued", "fresh"]
    # Skipping an already-run watcher on the first fire is not a cycle.
    mock_warning.assert_not_called()


def test_repeated_sends_coalesce_to_last_value_without_warning() -> None:
    """Multiple sends in one pass queue watchers once; last value wins."""
    ctx = _make_ctx(fragment_ids_this_run=["trigger"])
    with patch.object(signal_module, "get_script_run_ctx", return_value=ctx):
        sig = signal(0, key="k")
        ctx.signal_storage.register_watcher("k", "w1")

        with patch.object(signal_module._LOGGER, "warning") as mock_warning:
            sig.send(1)
            sig.send(2)

    assert ctx.fragment_ids_this_run == ["trigger", "w1"]
    assert ctx.signal_storage.get_state("k") == 2
    mock_warning.assert_not_called()


def test_refire_within_own_cascade_warns_and_does_not_requeue() -> None:
    """A signal can't re-fire from within its own cascade (cycle guard)."""
    ctx = _make_ctx(fragment_ids_this_run=["w1"])
    with patch.object(signal_module, "get_script_run_ctx", return_value=ctx):
        sig = signal(0, key="k")
        ctx.signal_storage.register_watcher("k", "w1")

        sig.send(1)
        # w1 runs as part of the cascade...
        ctx.fragment_ids_consumed.add("w1")
        # ...and a downstream watcher fires the signal again.
        with patch.object(signal_module._LOGGER, "warning") as mock_warning:
            sig.send(2)

    mock_warning.assert_called_once()
    assert ctx.fragment_ids_this_run == ["w1"]
    # The state update is kept even though the fire was a no-op.
    assert ctx.signal_storage.get_state("k") == 2


def test_appended_watchers_respect_ancestor_ordering() -> None:
    """The unconsumed queue tail is re-ordered ancestors-before-descendants."""
    ctx = _make_ctx(fragment_ids_this_run=["trigger"])
    ctx.fragment_storage.register("parent", lambda: None)
    ctx.fragment_storage.register("child", lambda: None, parent_fragment_id="parent")
    with patch.object(signal_module, "get_script_run_ctx", return_value=ctx):
        sig = signal(0, key="k")
        # Registered child-first to prove the re-ordering happens.
        ctx.signal_storage.register_watcher("k", "child")
        ctx.signal_storage.register_watcher("k", "parent")

        sig.send(1)

    assert ctx.fragment_ids_this_run == ["trigger", "parent", "child"]


def test_reorder_keeps_consumed_prefix_intact() -> None:
    """Re-ordering only touches the unconsumed tail of the queue."""
    ctx = _make_ctx(fragment_ids_this_run=["done", "running"])
    ctx.fragment_ids_consumed.update({"done", "running"})
    ctx.fragment_storage.register("parent", lambda: None)
    ctx.fragment_storage.register("child", lambda: None, parent_fragment_id="parent")
    with patch.object(signal_module, "get_script_run_ctx", return_value=ctx):
        sig = signal(0, key="k")
        ctx.signal_storage.register_watcher("k", "child")
        ctx.signal_storage.register_watcher("k", "parent")

        sig.send(1)

    assert ctx.fragment_ids_this_run == ["done", "running", "parent", "child"]


def test_bare_call_fires_with_state_unchanged() -> None:
    """sig() pokes the watchers without replacing the state."""
    ctx = _make_ctx(fragment_ids_this_run=["trigger"])
    with patch.object(signal_module, "get_script_run_ctx", return_value=ctx):
        sig = signal(7, key="k")
        ctx.signal_storage.register_watcher("k", "w1")

        sig()

        assert ctx.fragment_ids_this_run == ["trigger", "w1"]
        assert sig.value == 7


def test_call_with_value_is_equivalent_to_send() -> None:
    """sig(value) behaves exactly like sig.send(value)."""
    ctx = _make_ctx(fragment_ids_this_run=["trigger"])
    with patch.object(signal_module, "get_script_run_ctx", return_value=ctx):
        sig = signal(7, key="k")
        ctx.signal_storage.register_watcher("k", "w1")

        sig(99)

        assert ctx.fragment_ids_this_run == ["trigger", "w1"]
        assert sig.value == 99


def test_send_from_parallel_worker_raises() -> None:
    """send() is prohibited on parallel fragment worker threads."""
    ctx = _make_ctx(fragment_ids_this_run=None)
    with patch.object(signal_module, "get_script_run_ctx", return_value=ctx):
        sig = signal(0, key="k")

        ThreadState.update(is_parallel_worker=True)
        with pytest.raises(StreamlitAPIException, match=r"Signal\.send"):
            sig.send(1)
        with pytest.raises(StreamlitAPIException, match=r"Signal\.send"):
            sig()

        # The state was not modified by the rejected sends.
        ThreadState.update(is_parallel_worker=False)
        assert sig.value == 0
