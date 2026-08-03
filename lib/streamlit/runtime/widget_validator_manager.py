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

"""Session-scoped manager for server-side widget validation callables.

This mirrors the reference/prune lifecycle of
:class:`~streamlit.runtime.dataframe_source_manager.DataframeSourceManager`, but
stores validation callables (e.g. the ``validate`` argument of
``st.text_input``) instead of lazy dataframe sources.

Lifecycle:
- ``register_validator`` is called while a script runs, keyed by the widget's
  delta-path coordinates. Re-registering at the same coordinates replaces the
  previous validator with a new ``validator_id`` so stale in-flight validation
  responses are ignored by the frontend.
- ``clear_session_refs`` drops a session's coordinate references at the start of
  a full rerun (or the matching fragments' references on a fragment rerun).
- ``remove_orphaned_validators`` prunes validators no longer referenced by any
  session after a script finishes.
- ``clear_all_for_session`` removes everything for a session on shutdown.

The manager is runtime-scoped with session-keyed internal maps. ``validator_id``
is an unguessable token and validation requests are validated against the
requesting session.

Validators run on a worker thread with no ``ScriptRunContext``, so ``st.*``
commands and ``st.session_state`` are not available inside them.
"""

from __future__ import annotations

import collections
import threading
import uuid
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from streamlit.logger import get_logger

if TYPE_CHECKING:
    from collections.abc import Callable

_LOGGER: Final = get_logger(__name__)


@dataclass(frozen=True)
class ValidationOutcome:
    """The result of running a server-side validation callable."""

    is_valid: bool
    # Only meaningful when ``is_valid`` is False. An empty string tells the
    # frontend to show its generic validation error message; a non-empty string
    # is the custom message to display.
    error_message: str = ""


@dataclass(frozen=True)
class RegisteredValidator:
    """Metadata stored for a registered validation callable."""

    validator: Callable[[str], bool | str]
    validator_id: str
    session_id: str
    coordinates: str
    fragment_id: str | None


def _get_session_id() -> str:
    """Return the active AppSession's session id (mirrors MediaFileManager)."""
    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        get_script_run_ctx,
    )

    ctx = get_script_run_ctx()
    if ctx is None:
        # Only None when running "python myscript.py" rather than
        # "streamlit run myscript.py"; the session id doesn't matter then.
        return "dontcare"
    return ctx.session_id


def _get_fragment_id() -> str | None:
    """Return the active fragment id, if registration happens inside one."""
    from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState

    try:
        return ThreadState.get().fragment_id
    except RuntimeError:
        return None


class WidgetValidatorManager:
    """Tracks server-side widget validation callables per session."""

    def __init__(self) -> None:
        # validator_id -> RegisteredValidator
        self._validators: dict[str, RegisteredValidator] = {}
        # session_id -> {coordinates -> validator_id}
        self._validators_by_session_and_coord: dict[str, dict[str, str]] = (
            collections.defaultdict(dict)
        )
        # Guards the maps above. Validation callables run outside the lock so a
        # slow validator doesn't block registration/cleanup.
        self._lock = threading.Lock()

    def register_validator(
        self,
        validator: Callable[[str], bool | str],
        coordinates: str,
    ) -> str:
        """Register ``validator`` for the current session at ``coordinates``.

        Returns a fresh, unguessable ``validator_id`` used by the frontend to
        request validation.
        """
        session_id = _get_session_id()
        fragment_id = _get_fragment_id()
        validator_id = uuid.uuid4().hex
        entry = RegisteredValidator(
            validator=validator,
            validator_id=validator_id,
            session_id=session_id,
            coordinates=coordinates,
            fragment_id=fragment_id,
        )

        with self._lock:
            self._validators[validator_id] = entry
            # Overwriting the coordinate mapping orphans any previous validator
            # at the same location; it is pruned by remove_orphaned_validators().
            self._validators_by_session_and_coord[session_id][coordinates] = (
                validator_id
            )

        return validator_id

    def run_validation(
        self,
        session_id: str,
        validator_id: str,
        value: str,
    ) -> ValidationOutcome:
        """Run the registered validator for ``value`` and interpret its result.

        Validates that ``validator_id`` belongs to ``session_id`` before running
        anything. Any failure to resolve or run the validator "fails closed"
        (returns an invalid outcome with the generic message) so an
        unvalidated value is never accepted.
        """
        with self._lock:
            entry = self._validators.get(validator_id)

        if entry is None:
            # Unknown or expired validator. This can happen if a concurrent full
            # rerun re-registered the widget (rotating its id) and pruned this
            # one between the frontend sending the request and it arriving. It's
            # unlikely (validation is fast and doesn't itself trigger a rerun),
            # and failing closed here is safe: the user simply retries. We prefer
            # rejecting over silently accepting an unvalidated value.
            _LOGGER.warning("Widget validator not found or expired: %s", validator_id)
            return ValidationOutcome(is_valid=False)
        if entry.session_id != session_id:
            _LOGGER.warning(
                "Widget validator %s does not belong to session", validator_id
            )
            return ValidationOutcome(is_valid=False)

        try:
            # Typed as ``object`` because, despite the declared return type,
            # a developer's validator can return any value at runtime; the
            # branches below defend against unexpected types.
            result: object = entry.validator(value)
        except Exception:
            # The developer's validator raised. Log the full traceback for the
            # developer, but never leak it to the frontend; show the generic
            # error message instead.
            _LOGGER.exception(
                "Error while running server-side validation callable for widget"
            )
            return ValidationOutcome(is_valid=False)

        if result is True:
            return ValidationOutcome(is_valid=True)
        if result is False:
            return ValidationOutcome(is_valid=False)
        if isinstance(result, str):
            # A non-empty string is a custom error message; an empty string
            # falls back to the frontend's generic message.
            return ValidationOutcome(is_valid=False, error_message=result)

        # Any other return type is treated as an internal validation error.
        _LOGGER.warning(
            "Server-side validation callable returned an unexpected type %s; "
            "expected bool or str. Treating the value as invalid.",
            type(result).__name__,
        )
        return ValidationOutcome(is_valid=False)

    def clear_session_refs(
        self,
        session_id: str | None = None,
        *,
        fragment_ids: set[str] | list[str] | tuple[str, ...] | None = None,
    ) -> None:
        """Drop coordinate references for a session (does not delete validators).

        Call without ``fragment_ids`` at the start of a full rerun and on
        session shutdown. For fragment reruns, pass the fragment ids that are
        about to run so refs owned by those fragments are dropped while refs in
        the app body and untouched fragments stay active. Validators are
        actually removed by ``remove_orphaned_validators``.
        """
        if session_id is None:
            session_id = _get_session_id()

        with self._lock:
            if fragment_ids is None:
                self._validators_by_session_and_coord.pop(session_id, None)
                return

            fragment_id_set = set(fragment_ids)
            if not fragment_id_set:
                return

            coord_map = self._validators_by_session_and_coord.get(session_id)
            if coord_map is None:
                return

            for coordinates, validator_id in list(coord_map.items()):
                entry = self._validators.get(validator_id)
                if entry is not None and entry.fragment_id in fragment_id_set:
                    del coord_map[coordinates]

            if not coord_map:
                self._validators_by_session_and_coord.pop(session_id, None)

    def remove_orphaned_validators(self) -> None:
        """Delete validators no longer referenced by any session."""
        with self._lock:
            referenced: set[str] = set()
            for coord_map in self._validators_by_session_and_coord.values():
                referenced.update(coord_map.values())

            orphaned = [
                validator_id
                for validator_id in self._validators
                if validator_id not in referenced
            ]
            for validator_id in orphaned:
                del self._validators[validator_id]

    def clear_all_for_session(self, session_id: str) -> None:
        """Remove all references and validators for a session (shutdown path)."""
        self.clear_session_refs(session_id)
        self.remove_orphaned_validators()

    def get_validator_count(self) -> int:
        """Return the number of registered validators (for tests/debugging)."""
        with self._lock:
            return len(self._validators)
