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

Signal-safety
~~~~~~~~~~~~~
Signal handlers run between Python bytecodes when a signal interrupts a
blocking C-level call (via ``EINTR``).  If the handler tries to acquire a
non-reentrant ``threading.Lock`` that the interrupted code already holds,
the process **deadlocks**.  To avoid this, the SIGUSR1 handler is kept
entirely *lock-free* and *I/O-free*: it sets a ``threading.Event`` (backed
by a reentrant ``RLock``, so ``.set()`` is safe) and triggers the server
shutdown mechanism (``call_soon_threadsafe`` / ``os.kill`` — both
async-signal-safe).  All state-machine transitions and logging are deferred
to the normal main-thread execution path.
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

# Set by the SIGUSR1 signal handler.  Checked by ``is_checkpoint_requested``
# on the main thread after the server stops.  The handler never touches
# ``_state`` or ``_state_lock``; this event is the *only* cross-boundary
# communication from signal context to normal context.
#
# ``threading.Event`` is backed by ``threading.Condition(RLock())``, so
# ``.set()`` is reentrant and safe to call from a signal handler even if the
# same thread already holds the internal lock (e.g. inside ``.wait()``).
_checkpoint_signaled: Final = threading.Event()

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
    """Return True if the last server stop was triggered by a checkpoint request.

    This is lock-free: it reads the ``_checkpoint_signaled`` event that was
    set by the signal handler without touching ``_state_lock``.
    """
    return _checkpoint_signaled.is_set()


def wait_for_restore_signal() -> None:
    """Block the calling thread until SIGUSR2 is received.

    This should be called on the main thread after the server has been fully
    torn down.  The function performs the deferred state transitions that the
    signal handler intentionally skipped (PREPARING, then
    READY_FOR_CHECKPOINT) and blocks until SIGUSR2 arrives.

    The status file (if enabled) is updated at each transition so that a
    sidecar process can observe the quiesced state.
    """
    from streamlit.runtime.status_file import get_status_file_manager

    # Deferred from the signal handler (which only sets _checkpoint_signaled).
    with _state_lock:
        global _state  # noqa: PLW0603
        _state = CheckpointState.PREPARING

    _LOGGER.info("Received SIGUSR1 -- preparing for checkpoint.")

    with _state_lock:
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

    _checkpoint_signaled.clear()

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
    """SIGUSR1 handler -- prepare for checkpoint.

    This handler is intentionally **lock-free** and **I/O-free** so it is
    safe to execute in signal context (where the main thread may be inside a
    blocking C call that holds internal locks).

    All state-machine transitions and logging are deferred to
    ``wait_for_restore_signal`` which runs on the main thread in normal
    (non-signal) context.
    """
    if _checkpoint_signaled.is_set():
        return
    _checkpoint_signaled.set()

    if _active_server is not None:
        _active_server.stop()
    elif _stop_callback is not None:
        _stop_callback()


def _handle_sigusr2(signum: int, frame: FrameType | None) -> None:  # noqa: ARG001
    """SIGUSR2 handler -- resume after restore."""
    _LOGGER.info("Received SIGUSR2 -- signalling restore.")
    _restore_event.set()


def _reset_module_state() -> None:
    """Reset all module-level state to initial values.

    This is intended for **test isolation only** — it must not be called
    during normal operation.
    """
    global _state, _active_server, _stop_callback  # noqa: PLW0603

    _checkpoint_signaled.clear()
    _restore_event.clear()

    with _state_lock:
        _state = CheckpointState.NORMAL

    _active_server = None
    _stop_callback = None


def install_checkpoint_signal_handlers() -> None:
    """Install SIGUSR1 / SIGUSR2 signal handlers.

    This is a no-op on Windows where these signals do not exist.
    """
    if sys.platform == "win32":
        return

    signal.signal(signal.SIGUSR1, _handle_sigusr1)
    signal.signal(signal.SIGUSR2, _handle_sigusr2)
    _LOGGER.debug("Checkpoint/restore signal handlers installed (SIGUSR1/SIGUSR2).")
