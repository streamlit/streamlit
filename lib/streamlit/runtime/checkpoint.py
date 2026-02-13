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

"""Checkpoint/restore support for gvisor memory snapshots.

This module manages the lifecycle of preparing Streamlit for a gvisor
checkpoint and resuming after a restore. The protocol uses Unix signals:

- **SIGUSR1**: Tells Streamlit to enter a checkpoint-safe state by tearing
  down all OS-level resources (sockets, file watchers, threads). After
  teardown the process is quiescent and safe for an external checkpoint.
- **SIGUSR2**: Tells Streamlit to resume normal operations after a restore.
  This re-creates the server, runtime, and all associated resources.

The checkpoint/restore cycle looks like this::

    Normal operation
        |
        v
    SIGUSR1 received  -->  server.stop()  -->  singletons reset
        |
        v
    Process is quiescent (checkpoint-safe)
        |
        v
    gvisor checkpoint / restore
        |
        v
    SIGUSR2 received  -->  main loop re-creates server  -->  normal operation
"""

from __future__ import annotations

import signal
import sys
import threading
from enum import Enum
from typing import TYPE_CHECKING, Final

from streamlit.logger import get_logger

if TYPE_CHECKING:
    from collections.abc import Callable
    from types import FrameType

    from streamlit.web.server import Server

_LOGGER: Final = get_logger(__name__)


class CheckpointState(Enum):
    """The current state of the checkpoint/restore lifecycle."""

    # Normal operation -- no checkpoint in progress.
    NORMAL = "NORMAL"

    # SIGUSR1 received; the server is being torn down.
    PREPARING = "PREPARING"

    # Teardown complete. The process is quiescent and safe for checkpoint.
    READY_FOR_CHECKPOINT = "READY_FOR_CHECKPOINT"

    # SIGUSR2 received; the server is being re-created.
    RESTORING = "RESTORING"


# Module-level state --------------------------------------------------------

_state: CheckpointState = CheckpointState.NORMAL
_state_lock: Final = threading.Lock()

# This event is *set* when SIGUSR2 is received, unblocking the main thread
# so it can restart the server.
_restore_event: Final = threading.Event()

# Reference to the active Server so the SIGUSR1 handler can call stop().
_active_server: Server | None = None

# Generic stop callback for server modes that don't use a Server object
# (e.g. the UvicornRunner ASGI path).
_stop_callback: Callable[[], None] | None = None


# Public helpers ------------------------------------------------------------


def get_state() -> CheckpointState:
    """Return the current checkpoint state."""
    with _state_lock:
        return _state


def is_checkpoint_requested() -> bool:
    """Return True if the last server stop was triggered by a checkpoint request."""
    with _state_lock:
        return _state in {
            CheckpointState.PREPARING,
            CheckpointState.READY_FOR_CHECKPOINT,
        }


def wait_for_restore_signal() -> None:
    """Block the calling thread until SIGUSR2 is received.

    This should be called on the main thread after the server has been fully
    torn down.  The function sets the state to READY_FOR_CHECKPOINT while
    waiting and transitions to RESTORING when the signal arrives.

    The status file (if enabled) is updated at each transition so that a
    sidecar process can observe the quiesced state.
    """
    from streamlit.runtime.status_file import get_status_file_manager

    with _state_lock:
        global _state  # noqa: PLW0603
        _state = CheckpointState.READY_FOR_CHECKPOINT

    # Write QUIET / READY_FOR_CHECKPOINT to the status file.  This runs on the
    # main thread (not in a signal handler) so file I/O is safe.
    mgr = get_status_file_manager()
    if mgr is not None:
        mgr.set_checkpoint_state(CheckpointState.READY_FOR_CHECKPOINT)

    _LOGGER.info(
        "Streamlit is now in a checkpoint-safe state. Waiting for SIGUSR2 to resume..."
    )

    _restore_event.wait()
    _restore_event.clear()

    with _state_lock:
        _state = CheckpointState.RESTORING

    # Immediately overwrite the stale QUIET file left on disk by the
    # filesystem snapshot so the sidecar sees RESTORING as early as possible.
    if mgr is not None:
        mgr.set_checkpoint_state(CheckpointState.RESTORING)

    _LOGGER.info("SIGUSR2 received -- resuming Streamlit server.")


def mark_normal() -> None:
    """Transition back to NORMAL after the server has been re-started."""
    from streamlit.runtime.status_file import get_status_file_manager

    with _state_lock:
        global _state  # noqa: PLW0603
        _state = CheckpointState.NORMAL

    mgr = get_status_file_manager()
    if mgr is not None:
        mgr.set_checkpoint_state(CheckpointState.NORMAL)


def set_active_server(server: Server | None) -> None:
    """Register (or clear) the active Server instance.

    The SIGUSR1 handler uses this reference to call ``server.stop()``.
    """
    global _active_server  # noqa: PLW0603
    _active_server = server


def set_stop_callback(callback: Callable[[], None] | None) -> None:
    """Register (or clear) a generic stop callback.

    This is used by server modes that don't use a ``Server`` object (e.g. the
    ``UvicornRunner`` ASGI path).  The SIGUSR1 handler will invoke this
    callback to trigger a graceful shutdown.
    """
    global _stop_callback  # noqa: PLW0603
    _stop_callback = callback


# Signal handlers -----------------------------------------------------------


def _handle_sigusr1(signum: int, frame: FrameType | None) -> None:  # noqa: ARG001
    """SIGUSR1 handler -- prepare for checkpoint."""
    with _state_lock:
        global _state  # noqa: PLW0603
        if _state != CheckpointState.NORMAL:
            _LOGGER.warning(
                "Received SIGUSR1 but checkpoint state is already %s; ignoring.",
                _state.value,
            )
            return
        _state = CheckpointState.PREPARING

    _LOGGER.info("Received SIGUSR1 -- preparing for checkpoint.")

    if _active_server is not None:
        _active_server.stop()
    elif _stop_callback is not None:
        _stop_callback()
    else:
        _LOGGER.warning(
            "SIGUSR1 received but no active server or stop callback is registered. "
            "The process may not be in a checkpoint-safe state."
        )


def _handle_sigusr2(signum: int, frame: FrameType | None) -> None:  # noqa: ARG001
    """SIGUSR2 handler -- resume after restore."""
    _LOGGER.info("Received SIGUSR2 -- signalling restore.")
    _restore_event.set()


def install_checkpoint_signal_handlers() -> None:
    """Install SIGUSR1 / SIGUSR2 signal handlers.

    This is a no-op on Windows where these signals do not exist.
    """
    if sys.platform == "win32":
        return

    signal.signal(signal.SIGUSR1, _handle_sigusr1)
    signal.signal(signal.SIGUSR2, _handle_sigusr2)
    _LOGGER.debug("Checkpoint/restore signal handlers installed (SIGUSR1/SIGUSR2).")
