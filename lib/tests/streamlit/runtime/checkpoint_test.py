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

"""streamlit.runtime.checkpoint unit tests."""

from __future__ import annotations

import sys
import threading
from unittest.mock import MagicMock, patch

import pytest

from streamlit.runtime.checkpoint import (
    CheckpointState,
    _checkpoint_signaled,
    _handle_sigusr1,
    _handle_sigusr2,
    _reset_module_state,
    _restore_event,
    get_state,
    install_checkpoint_signal_handlers,
    is_checkpoint_requested,
    mark_normal,
    set_active_server,
    set_stop_callback,
    wait_for_restore_signal,
)


@pytest.fixture(autouse=True)
def _clean_state() -> None:
    """Reset module-level checkpoint state before each test."""
    _reset_module_state()


# ---------------------------------------------------------------------------
# Signal handler tests
# ---------------------------------------------------------------------------


class TestHandleSigusr1:
    """Tests for the SIGUSR1 signal handler."""

    def test_sets_checkpoint_signaled_event(self) -> None:
        """The handler must set the ``_checkpoint_signaled`` event."""
        assert not _checkpoint_signaled.is_set()
        _handle_sigusr1(0, None)
        assert _checkpoint_signaled.is_set()

    def test_does_not_mutate_state(self) -> None:
        """The handler must NOT touch ``_state`` (deferred to main thread)."""
        _handle_sigusr1(0, None)
        assert get_state() == CheckpointState.NORMAL

    def test_calls_server_stop(self) -> None:
        """When a server is registered, the handler calls ``server.stop()``."""
        server = MagicMock()
        set_active_server(server)

        _handle_sigusr1(0, None)

        server.stop.assert_called_once()

    def test_calls_stop_callback_when_no_server(self) -> None:
        """When no server but a stop callback is registered, calls the callback."""
        callback = MagicMock()
        set_stop_callback(callback)

        _handle_sigusr1(0, None)

        callback.assert_called_once()

    def test_prefers_server_over_callback(self) -> None:
        """When both server and callback are registered, only ``server.stop()`` runs."""
        server = MagicMock()
        callback = MagicMock()
        set_active_server(server)
        set_stop_callback(callback)

        _handle_sigusr1(0, None)

        server.stop.assert_called_once()
        callback.assert_not_called()

    def test_no_server_no_callback_is_noop(self) -> None:
        """When neither is registered, the handler sets the event and returns."""
        _handle_sigusr1(0, None)
        assert _checkpoint_signaled.is_set()

    def test_duplicate_signal_is_ignored(self) -> None:
        """A second SIGUSR1 must not call stop again."""
        server = MagicMock()
        set_active_server(server)

        _handle_sigusr1(0, None)
        _handle_sigusr1(0, None)

        server.stop.assert_called_once()

    def test_handler_does_not_acquire_state_lock(self) -> None:
        """Verify the handler is lock-free by holding _state_lock during the call.

        If the handler tried to acquire the non-reentrant lock, this would
        deadlock (and the test would hang / timeout).
        """
        from streamlit.runtime.checkpoint import _state_lock

        server = MagicMock()
        set_active_server(server)

        with _state_lock:
            _handle_sigusr1(0, None)

        assert _checkpoint_signaled.is_set()
        server.stop.assert_called_once()


class TestHandleSigusr2:
    """Tests for the SIGUSR2 signal handler."""

    def test_sets_restore_event(self) -> None:
        """The handler must set the ``_restore_event``."""
        assert not _restore_event.is_set()
        _handle_sigusr2(0, None)
        assert _restore_event.is_set()


# ---------------------------------------------------------------------------
# Public helper tests
# ---------------------------------------------------------------------------


class TestIsCheckpointRequested:
    """Tests for ``is_checkpoint_requested``."""

    def test_false_initially(self) -> None:
        """Must return False when no SIGUSR1 has been received."""
        assert is_checkpoint_requested() is False

    def test_true_after_signal(self) -> None:
        """Must return True after the signal handler fires."""
        _handle_sigusr1(0, None)
        assert is_checkpoint_requested() is True

    def test_false_after_mark_normal(self) -> None:
        """Must return False after a full checkpoint/restore cycle."""
        _handle_sigusr1(0, None)
        assert is_checkpoint_requested() is True

        with patch(
            "streamlit.runtime.status_file.get_status_file_manager", return_value=None
        ):
            mark_normal()

        assert is_checkpoint_requested() is False


class TestGetState:
    """Tests for ``get_state``."""

    def test_initial_state_is_normal(self) -> None:
        """The initial state must be NORMAL."""
        assert get_state() == CheckpointState.NORMAL

    def test_state_unchanged_by_signal_handler(self) -> None:
        """The signal handler must not change ``_state``."""
        _handle_sigusr1(0, None)
        assert get_state() == CheckpointState.NORMAL


# ---------------------------------------------------------------------------
# State machine / lifecycle tests
# ---------------------------------------------------------------------------


class TestWaitForRestoreSignal:
    """Tests for ``wait_for_restore_signal``."""

    def test_transitions_through_preparing_to_ready(self) -> None:
        """The function must transition NORMAL -> PREPARING -> READY_FOR_CHECKPOINT."""
        _handle_sigusr1(0, None)

        observed_states: list[CheckpointState] = []

        # Pre-set the restore event so the function doesn't block.
        _restore_event.set()

        original_wait = threading.Event.wait

        def spy_wait(self: threading.Event, timeout: float | None = None) -> bool:
            observed_states.append(get_state())
            return original_wait(self, timeout)

        with (
            patch(
                "streamlit.runtime.status_file.get_status_file_manager",
                return_value=None,
            ),
            patch.object(threading.Event, "wait", spy_wait),
        ):
            wait_for_restore_signal()

        assert CheckpointState.READY_FOR_CHECKPOINT in observed_states
        assert get_state() == CheckpointState.RESTORING

    def test_ends_in_restoring_state(self) -> None:
        """After SIGUSR2 unblocks the wait, state must be RESTORING."""
        _handle_sigusr1(0, None)
        _restore_event.set()

        with patch(
            "streamlit.runtime.status_file.get_status_file_manager", return_value=None
        ):
            wait_for_restore_signal()

        assert get_state() == CheckpointState.RESTORING
        assert get_state() != CheckpointState.NORMAL

    def test_updates_status_file_manager(self) -> None:
        """The status file manager must see READY_FOR_CHECKPOINT and RESTORING."""
        _handle_sigusr1(0, None)
        _restore_event.set()

        mock_mgr = MagicMock()
        with patch(
            "streamlit.runtime.status_file.get_status_file_manager",
            return_value=mock_mgr,
        ):
            wait_for_restore_signal()

        calls = [c.args[0] for c in mock_mgr.set_checkpoint_state.call_args_list]
        assert CheckpointState.READY_FOR_CHECKPOINT in calls
        assert CheckpointState.RESTORING in calls

    def test_blocks_until_restore_event(self) -> None:
        """The function must block until ``_restore_event`` is set."""
        _handle_sigusr1(0, None)
        unblocked = threading.Event()

        def run() -> None:
            with patch(
                "streamlit.runtime.status_file.get_status_file_manager",
                return_value=None,
            ):
                wait_for_restore_signal()
            unblocked.set()

        t = threading.Thread(target=run, daemon=True)
        t.start()

        assert not unblocked.wait(timeout=0.1), "Should still be blocked"

        _restore_event.set()
        assert unblocked.wait(timeout=2.0), "Should have unblocked after SIGUSR2"
        t.join(timeout=2.0)


class TestMarkNormal:
    """Tests for ``mark_normal``."""

    def test_resets_state_to_normal(self) -> None:
        """``mark_normal`` must set state to NORMAL."""
        _handle_sigusr1(0, None)
        _restore_event.set()

        with patch(
            "streamlit.runtime.status_file.get_status_file_manager", return_value=None
        ):
            wait_for_restore_signal()
            mark_normal()

        assert get_state() == CheckpointState.NORMAL
        assert get_state() != CheckpointState.RESTORING

    def test_clears_checkpoint_signaled(self) -> None:
        """``mark_normal`` must clear the checkpoint-signaled event."""
        _handle_sigusr1(0, None)
        assert _checkpoint_signaled.is_set()

        with patch(
            "streamlit.runtime.status_file.get_status_file_manager", return_value=None
        ):
            mark_normal()

        assert not _checkpoint_signaled.is_set()

    def test_allows_new_checkpoint_cycle(self) -> None:
        """After ``mark_normal``, a new SIGUSR1 must be accepted."""
        server = MagicMock()
        set_active_server(server)

        _handle_sigusr1(0, None)
        _restore_event.set()

        with patch(
            "streamlit.runtime.status_file.get_status_file_manager", return_value=None
        ):
            wait_for_restore_signal()
            mark_normal()

        server.reset_mock()
        _handle_sigusr1(0, None)
        server.stop.assert_called_once()

    def test_updates_status_file_manager(self) -> None:
        """``mark_normal`` must write NORMAL to the status file manager."""
        mock_mgr = MagicMock()
        with patch(
            "streamlit.runtime.status_file.get_status_file_manager",
            return_value=mock_mgr,
        ):
            mark_normal()

        mock_mgr.set_checkpoint_state.assert_called_once_with(CheckpointState.NORMAL)


# ---------------------------------------------------------------------------
# Registration helpers
# ---------------------------------------------------------------------------


class TestSetActiveServer:
    """Tests for ``set_active_server``."""

    def test_register_and_clear(self) -> None:
        """Registering a server makes it available to the handler; clearing removes it."""
        server = MagicMock()
        set_active_server(server)
        _handle_sigusr1(0, None)
        server.stop.assert_called_once()

        _reset_module_state()
        set_active_server(None)
        _handle_sigusr1(0, None)
        assert server.stop.call_count == 1


class TestSetStopCallback:
    """Tests for ``set_stop_callback``."""

    def test_register_and_clear(self) -> None:
        """Registering a callback makes it available; clearing removes it."""
        cb = MagicMock()
        set_stop_callback(cb)
        _handle_sigusr1(0, None)
        cb.assert_called_once()

        _reset_module_state()
        set_stop_callback(None)
        _handle_sigusr1(0, None)
        assert cb.call_count == 1


# ---------------------------------------------------------------------------
# Signal installation
# ---------------------------------------------------------------------------


@pytest.mark.skipif(sys.platform == "win32", reason="Unix signals not available")
class TestInstallCheckpointSignalHandlers:
    """Tests for ``install_checkpoint_signal_handlers``."""

    def test_installs_handlers(self) -> None:
        """Handlers must be installed for SIGUSR1 and SIGUSR2 on Unix."""
        import signal as signal_mod

        with patch.object(signal_mod, "signal") as mock_signal:
            install_checkpoint_signal_handlers()

        handler_map = {
            call.args[0]: call.args[1] for call in mock_signal.call_args_list
        }
        assert signal_mod.SIGUSR1 in handler_map
        assert signal_mod.SIGUSR2 in handler_map
        assert handler_map[signal_mod.SIGUSR1] is _handle_sigusr1
        assert handler_map[signal_mod.SIGUSR2] is _handle_sigusr2


# ---------------------------------------------------------------------------
# Reset helper
# ---------------------------------------------------------------------------


class TestResetModuleState:
    """Tests for ``_reset_module_state``."""

    def test_clears_all_state(self) -> None:
        """``_reset_module_state`` must return the module to its pristine state."""
        server = MagicMock()
        set_active_server(server)
        set_stop_callback(lambda: None)
        _handle_sigusr1(0, None)
        _restore_event.set()

        _reset_module_state()

        assert get_state() == CheckpointState.NORMAL
        assert not is_checkpoint_requested()
        assert not _checkpoint_signaled.is_set()
        assert not _restore_event.is_set()
