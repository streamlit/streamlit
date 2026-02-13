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

"""Status file for sidecar process introspection.

When the ``STREAMLIT_STATUS_FILE`` environment variable is set, Streamlit
atomically writes a JSON status file whenever its operational state changes.
A sidecar (parent) process can poll this file to determine:

- Whether the service is idle (no connected browser sessions).
- How long the service has been idle.
- Whether the service has entered a quiesced (checkpoint-safe) state.

The status file contains::

    {
        "lastActiveTimestamp": 1707500000.123,
        "currentIdleStatus": "ACTIVE",
        "checkpointState": "NORMAL",
        "activeSessions": 3,
        "lastUpdated": 1707500005.456,
    }

**Idle status values**:

- ``ACTIVE``: At least one WebSocket session is connected, *or* sessions
  recently disconnected and the grace period has not yet elapsed.
- ``INACTIVE``: No sessions connected and the grace period has elapsed.
- ``QUIET``: The process is in a checkpoint-safe state
  (``READY_FOR_CHECKPOINT``).

**Grace period**: After the last session disconnects, the status remains
``ACTIVE`` for a configurable period (env var ``STREAMLIT_IDLE_GRACE_PERIOD``,
default 30 s).  This prevents premature idle detection from brief
disconnects/reconnects.

**Race-condition mitigations** (see plan for full details):

1. The SIGUSR1 signal handler never writes the status file.  All checkpoint-
   related writes happen on the main thread in :mod:`bootstrap`.
2. An epoch counter guards the grace-period ``threading.Timer`` callback so
   that stale timers (e.g. after a gvisor restore where the wall clock jumps)
   silently no-op instead of writing incorrect state.
3. ``wait_for_restore_signal`` writes ``RESTORING`` immediately after
   unblocking to overwrite the stale ``QUIET`` file left on disk by the
   filesystem snapshot.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
import time
from enum import Enum
from typing import TYPE_CHECKING, Final

from streamlit.logger import get_logger

if TYPE_CHECKING:
    from streamlit.runtime.checkpoint import CheckpointState

_LOGGER: Final = get_logger(__name__)

# Default grace period (seconds) before transitioning from ACTIVE to INACTIVE
# after the last session disconnects.
_DEFAULT_GRACE_PERIOD: Final[float] = 30.0

# Environment variable names.
_ENV_STATUS_FILE: Final = "STREAMLIT_STATUS_FILE"
_ENV_IDLE_GRACE_PERIOD: Final = "STREAMLIT_IDLE_GRACE_PERIOD"


class IdleStatus(Enum):
    """Idle status reported in the status file."""

    # At least one session is connected, or the grace period has not elapsed
    # since the last session disconnected.
    ACTIVE = "ACTIVE"

    # No sessions connected and the grace period has elapsed.
    INACTIVE = "INACTIVE"

    # The process is in a checkpoint-safe state.
    QUIET = "QUIET"


class StatusFileManager:
    """Manages the JSON status file written for sidecar introspection.

    All public methods are thread-safe.  The ``_write`` helper acquires
    ``_lock`` to serialise file I/O.  The grace-period timer uses an epoch
    counter so that stale callbacks (from cancelled-but-already-woken timers)
    are safely ignored.
    """

    def __init__(
        self, file_path: str, grace_period: float = _DEFAULT_GRACE_PERIOD
    ) -> None:
        self._file_path = file_path
        self._grace_period = grace_period

        # Protected by ``_lock``.
        self._lock = threading.Lock()
        self._idle_status: IdleStatus = IdleStatus.ACTIVE
        self._checkpoint_state_value: str = "NORMAL"
        self._active_sessions: int = 0
        self._last_active_timestamp: float | None = None

        # Epoch counter for the grace-period timer.  Incremented each time a
        # new timer is started or timers are invalidated (e.g. on checkpoint).
        self._timer_epoch: int = 0
        self._timer: threading.Timer | None = None

        # Write the initial status file so the sidecar sees it immediately.
        self._write()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def on_sessions_changed(self, num_active: int) -> None:
        """Called when the number of active WebSocket sessions changes.

        Parameters
        ----------
        num_active
            The current number of active sessions (post-change).

        """
        with self._lock:
            self._active_sessions = num_active

            if num_active > 0:
                # Sessions are connected — cancel any pending grace timer and
                # transition to ACTIVE.
                self._cancel_timer_locked()
                self._idle_status = IdleStatus.ACTIVE
                self._last_active_timestamp = None
                self._write_locked()
            elif self._idle_status != IdleStatus.QUIET:
                # Last session disconnected.  Record the timestamp and start
                # the grace period timer.  Status remains ACTIVE until the
                # timer fires.
                self._last_active_timestamp = time.time()
                self._start_grace_timer_locked()
                self._write_locked()

    def set_checkpoint_state(self, state: CheckpointState) -> None:
        """Called from the main thread when the checkpoint lifecycle state changes.

        When ``READY_FOR_CHECKPOINT``, sets the idle status to ``QUIET`` and
        invalidates any pending grace-period timer.

        .. warning::
            This must **not** be called from a signal handler.  All calls
            originate from the main-thread flow in ``bootstrap.py`` or
            ``checkpoint.py``.
        """
        from streamlit.runtime.checkpoint import CheckpointState

        with self._lock:
            self._checkpoint_state_value = state.value

            if state == CheckpointState.READY_FOR_CHECKPOINT:
                self._idle_status = IdleStatus.QUIET
                # Invalidate any pending grace timer so it cannot fire during
                # or after the checkpoint.
                self._cancel_timer_locked()
            elif state == CheckpointState.NORMAL:
                # Restore from QUIET.  Determine idle status from session count.
                if self._active_sessions > 0:
                    self._idle_status = IdleStatus.ACTIVE
                    self._last_active_timestamp = None
                else:
                    # No sessions — mark as INACTIVE immediately (the grace
                    # period is not meaningful after a restore).
                    self._idle_status = IdleStatus.INACTIVE
                    if self._last_active_timestamp is None:
                        self._last_active_timestamp = time.time()

            self._write_locked()

    def shutdown(self) -> None:
        """Cancel timers and delete the status file."""
        with self._lock:
            self._cancel_timer_locked()

        try:
            os.unlink(self._file_path)
        except OSError:
            pass

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _write(self) -> None:
        """Atomically write the status file (acquires ``_lock``)."""
        with self._lock:
            self._write_locked()

    def _write_locked(self) -> None:
        """Atomically write the status file.  Caller must hold ``_lock``."""
        payload = {
            "lastActiveTimestamp": self._last_active_timestamp,
            "currentIdleStatus": self._idle_status.value,
            "checkpointState": self._checkpoint_state_value,
            "activeSessions": self._active_sessions,
            "lastUpdated": time.time(),
        }

        dir_name = os.path.dirname(self._file_path) or "."
        try:
            fd, tmp_path = tempfile.mkstemp(dir=dir_name, suffix=".tmp")
            try:
                with os.fdopen(fd, "w") as f:
                    json.dump(payload, f)
                os.replace(tmp_path, self._file_path)
            except BaseException:
                # Clean up the temp file if the rename failed.
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
                raise
        except Exception:
            _LOGGER.warning("Failed to write status file %s", self._file_path)

    def _start_grace_timer_locked(self) -> None:
        """Start (or restart) the grace-period timer.  Caller must hold ``_lock``."""
        # Cancel any existing timer.
        self._cancel_timer_locked()

        self._timer_epoch += 1
        epoch = self._timer_epoch

        timer = threading.Timer(
            self._grace_period, self._grace_timer_expired, args=(epoch,)
        )
        timer.daemon = True
        timer.start()
        self._timer = timer

    def _cancel_timer_locked(self) -> None:
        """Cancel the grace-period timer and bump the epoch.

        Caller must hold ``_lock``.
        """
        self._timer_epoch += 1
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None

    def _grace_timer_expired(self, epoch: int) -> None:
        """Callback for the grace-period timer.

        Only transitions to ``INACTIVE`` if the epoch matches (i.e. the timer
        has not been invalidated by a concurrent session-change or checkpoint
        event).
        """
        with self._lock:
            if epoch != self._timer_epoch:
                # Timer was invalidated — ignore.
                return

            if self._active_sessions == 0 and self._idle_status == IdleStatus.ACTIVE:
                self._idle_status = IdleStatus.INACTIVE
                self._write_locked()

            self._timer = None


# Module-level singleton -------------------------------------------------------

_manager: StatusFileManager | None = None


def get_status_file_manager() -> StatusFileManager | None:
    """Return the singleton ``StatusFileManager``, or ``None`` if disabled."""
    return _manager


def init_status_file_manager() -> None:
    """Initialise the ``StatusFileManager`` singleton from environment variables.

    Reads ``STREAMLIT_STATUS_FILE`` for the file path and
    ``STREAMLIT_IDLE_GRACE_PERIOD`` for the grace period (seconds).

    If ``STREAMLIT_STATUS_FILE`` is not set or empty, the feature is disabled
    and ``get_status_file_manager()`` will return ``None``.
    """
    global _manager  # noqa: PLW0603

    file_path = os.environ.get(_ENV_STATUS_FILE, "").strip()
    if not file_path:
        _LOGGER.debug(
            "Status file disabled (%s not set).",
            _ENV_STATUS_FILE,
        )
        return

    grace_str = os.environ.get(_ENV_IDLE_GRACE_PERIOD, "").strip()
    grace_period = _DEFAULT_GRACE_PERIOD
    if grace_str:
        try:
            grace_period = float(grace_str)
        except ValueError:
            _LOGGER.warning(
                "Invalid value for %s: %r. Using default %s s.",
                _ENV_IDLE_GRACE_PERIOD,
                grace_str,
                _DEFAULT_GRACE_PERIOD,
            )

    _manager = StatusFileManager(file_path, grace_period)
    _LOGGER.info(
        "Status file enabled: %s (grace period: %s s)",
        file_path,
        grace_period,
    )


def shutdown_status_file_manager() -> None:
    """Shut down the singleton ``StatusFileManager`` (if any) and clear it."""
    global _manager  # noqa: PLW0603
    if _manager is not None:
        _manager.shutdown()
        _manager = None
