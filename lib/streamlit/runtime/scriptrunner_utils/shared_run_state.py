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

import collections
import threading
from typing import TYPE_CHECKING

from streamlit.runtime.scriptrunner_utils.thread_safe_set import ThreadSafeSet

if TYPE_CHECKING:
    from streamlit.proto.PageProfile_pb2 import Command


class SharedRunState:
    """Thread-safe container for shared mutable state during a script run.

    A single instance is shared across the main thread and all worker threads.
    Callers access state only through synchronized methods — direct field
    access to the underlying data structures is not exposed.
    """

    def __init__(self) -> None:
        self.widget_ids_this_run: ThreadSafeSet[str] = ThreadSafeSet()
        self.widget_user_keys_this_run: ThreadSafeSet[str] = ThreadSafeSet()
        self.form_ids_this_run: ThreadSafeSet[str] = ThreadSafeSet()
        self.new_fragment_ids: ThreadSafeSet[str] = ThreadSafeSet()

         self._element_ids_by_delta_path_lock = threading.Lock()
        self._element_ids_by_delta_path: dict[tuple[int, ...], set[str]] = {}
        self._user_keys_by_delta_path: dict[tuple[int, ...], set[str]] = {}

        self._telemetry_lock = threading.Lock()
        self._tracked_commands: list[Command] = []
        self._tracked_commands_counter: collections.Counter[str] = collections.Counter()

    def reset(self) -> None:
        """Re-initialize all shared mutable state for a new script run.

        Must only be called from the main script thread before parallel
        dispatch.
        """
        self.widget_ids_this_run.clear()
        self.widget_user_keys_this_run.clear()
        self.form_ids_this_run.clear()
        self.new_fragment_ids.clear()

        with self._element_ids_by_delta_path_lock:
            self._element_ids_by_delta_path.clear()
            self._user_keys_by_delta_path.clear()

        with self._telemetry_lock:
            self._tracked_commands = []
            self._tracked_commands_counter = collections.Counter()

    def track_element_id_delta_path(
        self,
        element_id: str,
        user_key: str | None,
        delta_path: tuple[int, ...] | None,
    ) -> None:
        """Associate an element ID with the delta path it occupies."""
        if delta_path is None:
            return

        with self._element_ids_by_delta_path_lock:
            self._element_ids_by_delta_path.setdefault(delta_path, set()).add(
                element_id
            )
            if user_key is not None:
                self._user_keys_by_delta_path.setdefault(delta_path, set()).add(
                    user_key
                )

    def clear_widget_registrations_at_delta_path(
        self, delta_path: tuple[int, ...]
    ) -> None:
        """Clear same-run widget registrations at the given delta path.

        ``st.empty`` replaces the element tree at its own delta path. Any
        widgets registered at that path or beneath it no longer exist in the
        visible app and should not block new widgets created later in the same
        script run.
        """
        element_ids: set[str] = set()
        user_keys: set[str] = set()
        with self._element_ids_by_delta_path_lock:
            for path in list(self._element_ids_by_delta_path):
                if path[: len(delta_path)] == delta_path:
                    element_ids.update(self._element_ids_by_delta_path.pop(path))
                    user_keys.update(self._user_keys_by_delta_path.pop(path, set()))

        if not element_ids:
            return

        self.widget_ids_this_run.difference_update(element_ids)
        self.widget_user_keys_this_run.difference_update(user_keys)

    @property
    def tracked_commands(self) -> tuple[Command, ...]:
        """An immutable snapshot of tracked commands."""
        with self._telemetry_lock:
            return tuple(self._tracked_commands)

    @property
    def tracked_commands_count(self) -> int:
        """The number of commands stored in the tracked list (capped)."""
        with self._telemetry_lock:
            return len(self._tracked_commands)

    def track_command(self, command: Command, max_per_command: int) -> None:
        """Atomically track a command.

        Appends the command to the list if it is under the per-command cap, and
        always updates the counter.
        """
        with self._telemetry_lock:
            if self._tracked_commands_counter[command.name] < max_per_command:
                self._tracked_commands.append(command)
            self._tracked_commands_counter.update([command.name])

    def command_count_for(self, name: str) -> int:
        """Return how many times a command name has been tracked."""
        with self._telemetry_lock:
            return self._tracked_commands_counter[name]
