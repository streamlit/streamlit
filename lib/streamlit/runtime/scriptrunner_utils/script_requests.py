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
from dataclasses import dataclass, field, replace
from enum import Enum
from typing import TYPE_CHECKING, cast

from streamlit import util
from streamlit.proto.Common_pb2 import ChatInputValue as ChatInputValueProto
from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates

if TYPE_CHECKING:
    from streamlit.proto.ClientState_pb2 import ContextInfo


class ScriptRequestType(Enum):
    # The ScriptRunner should continue running its script.
    CONTINUE = "CONTINUE"

    # If the script is running, it should be stopped as soon
    # as the ScriptRunner reaches an interrupt point.
    # This is a terminal state.
    STOP = "STOP"

    # A script rerun has been requested. The ScriptRunner should
    # handle this request as soon as it reaches an interrupt point.
    RERUN = "RERUN"


@dataclass(frozen=True)
class RerunData:
    """Data attached to RERUN requests. Immutable."""

    query_string: str = ""
    widget_states: WidgetStates | None = None
    page_script_hash: str = ""
    page_name: str = ""

    # A single fragment_id to append to fragment_id_queue.
    fragment_id: str | None = None
    # The queue of fragment_ids waiting to be run.
    fragment_id_queue: list[str] = field(default_factory=list)
    is_fragment_scoped_rerun: bool = False
    # set to true when a script is rerun by the fragment auto-rerun mechanism
    is_auto_rerun: bool = False
    # Hashes of messages that are cached in the client browser:
    cached_message_hashes: set[str] = field(default_factory=set)
    # context_info is used to store information from the user browser (e.g. timezone)
    context_info: ContextInfo | None = None

    def __repr__(self) -> str:
        return util.repr_(self)


@dataclass(frozen=True)
class ScriptRequest:
    """A STOP or RERUN request and associated data."""

    type: ScriptRequestType
    _rerun_data: RerunData | None = None

    @property
    def rerun_data(self) -> RerunData:
        if self.type is not ScriptRequestType.RERUN:
            raise RuntimeError("RerunData is only set for RERUN requests.")
        return cast("RerunData", self._rerun_data)

    def __repr__(self) -> str:
        return util.repr_(self)


def _fragment_run_should_not_preempt_script(
    fragment_id_queue: list[str],
    is_fragment_scoped_rerun: bool,
) -> bool:
    """Returns whether the currently running script should be preempted due to a
    fragment rerun.

    Reruns corresponding to fragment runs that weren't caused by calls to
    `st.rerun(scope="fragment")` should *not* cancel the current script run
    as doing so will affect elements outside of the fragment.
    """
    return bool(fragment_id_queue) and not is_fragment_scoped_rerun


def _coalesce_widget_states(
    old_states: WidgetStates | None, new_states: WidgetStates | None
) -> WidgetStates | None:
    """Coalesce an older WidgetStates into a newer one, and return a new
    WidgetStates containing the result.

    For most widget values, we just take the latest version.

    However, any trigger_values (which are set by buttons) that are True in
    `old_states` will be set to True in the coalesced result, so that button
    presses don't go missing.
    """
    if not old_states and not new_states:
        return None
    if not old_states:
        return new_states
    if not new_states:
        return old_states

    states_by_id: dict[str, WidgetState] = {
        wstate.id: wstate for wstate in new_states.widgets
    }

    trigger_value_types = [
        ("trigger_value", False),
        ("chat_input_value", ChatInputValueProto(data=None)),
    ]
    for old_state in old_states.widgets:
        for trigger_value_type, unset_value in trigger_value_types:
            if (
                old_state.WhichOneof("value") == trigger_value_type
                and getattr(old_state, trigger_value_type) != unset_value
            ):
                new_trigger_val = states_by_id.get(old_state.id)
                # It should nearly always be the case that new_trigger_val is None
                # here as trigger values are deleted from the client's WidgetStateManager
                # as soon as a rerun_script BackMsg is sent to the server. Since it's
                # impossible to test that the client sends us state in the expected
                # format in a unit test, we test for this behavior in
                # e2e_playwright/test_fragment_queue_test.py
                if not new_trigger_val or (
                    # Ensure the corresponding new_state is also a trigger;
                    # otherwise, a widget that was previously a button/chat_input but no
                    # longer is could get a bad value.
                    new_trigger_val.WhichOneof("value") == trigger_value_type
                    # We only want to take the value of old_state if new_trigger_val is
                    # unset as the old value may be stale if a newer one was entered.
                    and getattr(new_trigger_val, trigger_value_type) == unset_value
                ):
                    states_by_id[old_state.id] = old_state

    coalesced = WidgetStates()
    coalesced.widgets.extend(states_by_id.values())

    return coalesced


class ScriptRequests:
    """An interface for communicating with a ScriptRunner. Thread-safe.

    AppSession makes requests of a ScriptRunner through this class, and
    ScriptRunner handles those requests.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state = ScriptRequestType.CONTINUE
        self._rerun_data = RerunData()

    def request_stop(self) -> None:
        """Request that the ScriptRunner stop running. A stopped ScriptRunner
        can't be used anymore. STOP requests succeed unconditionally.
        """
        with self._lock:
            self._state = ScriptRequestType.STOP

    def request_rerun(self, new_data: RerunData) -> bool:
        """Request that the ScriptRunner rerun its script.

        If the ScriptRunner has been stopped, this request can't be honored:
        return False.

        Otherwise, record the request and return True. The ScriptRunner will
        handle the rerun request as soon as it reaches an interrupt point.
        """

        with self._lock:
            if self._state == ScriptRequestType.STOP:
                # We can't rerun after being stopped.
                return False

            if self._state == ScriptRequestType.CONTINUE:
                # The script is currently running, and we haven't received a request to
                # rerun it as of yet. We can handle a rerun request unconditionally so
                # just change self._state and set self._rerun_data.
                self._state = ScriptRequestType.RERUN

                # Convert from a single fragment_id into fragment_id_queue.
                if new_data.fragment_id:
                    new_data = replace(
                        new_data,
                        fragment_id=None,
                        fragment_id_queue=[new_data.fragment_id],
                    )

                self._rerun_data = new_data
                return True

            if self._state == ScriptRequestType.RERUN:
                # We already have an existing Rerun request, so we can coalesce the new
                # rerun request into the existing one.

                coalesced_states = _coalesce_widget_states(
                    self._rerun_data.widget_states, new_data.widget_states
                )

                if new_data.fragment_id:
                    # This RERUN request corresponds to a new fragment run. We append
                    # the new fragment ID to the end of the current fragment_id_queue if
                    # it isn't already contained in it.
                    fragment_id_queue = [*self._rerun_data.fragment_id_queue]

                    if new_data.fragment_id not in fragment_id_queue:
                        fragment_id_queue.append(new_data.fragment_id)
                elif new_data.fragment_id_queue:
                    # new_data contains a new fragment_id_queue, so we just use it.
                    fragment_id_queue = new_data.fragment_id_queue
                else:
                    # Otherwise, this is a request to rerun the full script, so we want
                    # to clear out any fragments we have queued to run since they'll all
                    # be run with the full script anyway.
                    fragment_id_queue = []

                self._rerun_data = RerunData(
                    query_string=new_data.query_string,
                    widget_states=coalesced_states,
                    page_script_hash=new_data.page_script_hash,
                    page_name=new_data.page_name,
                    fragment_id_queue=fragment_id_queue,
                    cached_message_hashes=new_data.cached_message_hashes,
                    is_fragment_scoped_rerun=new_data.is_fragment_scoped_rerun,
                    is_auto_rerun=new_data.is_auto_rerun,
                    context_info=new_data.context_info,
                )

                return True

            # We'll never get here
            raise RuntimeError(f"Unrecognized ScriptRunnerState: {self._state}")

    def on_scriptrunner_yield(self) -> ScriptRequest | None:
        """Called by the ScriptRunner when it's at a yield point.

        If we have no request or a RERUN request corresponding to one or more fragments
        (that is not a fragment-scoped rerun), return None.

        If we have a (full script or fragment-scoped) RERUN request, return the request
        and set our internal state to CONTINUE.

        If we have a STOP request, return the request and remain stopped.
        """
        if self._state == ScriptRequestType.CONTINUE or (
            self._state == ScriptRequestType.RERUN
            and _fragment_run_should_not_preempt_script(
                self._rerun_data.fragment_id_queue,
                self._rerun_data.is_fragment_scoped_rerun,
            )
        ):
            # We avoid taking the lock in the common cases described above. If a STOP or
            # preempting RERUN request is received after we've taken this code path, it
            # will be handled at the next `on_scriptrunner_yield`, or when
            # `on_scriptrunner_ready` is called.
            return None

        with self._lock:
            if self._state == ScriptRequestType.RERUN:
                # We already made this check in the fast-path above but need to do so
                # again in case our state changed while we were waiting on the lock.
                if _fragment_run_should_not_preempt_script(
                    self._rerun_data.fragment_id_queue,
                    self._rerun_data.is_fragment_scoped_rerun,
                ):
                    return None

                self._state = ScriptRequestType.CONTINUE
                return ScriptRequest(ScriptRequestType.RERUN, self._rerun_data)

            if self._state != ScriptRequestType.STOP:
                raise RuntimeError(
                    f"Unrecognized ScriptRunnerState: {self._state}. This should never happen."
                )
            return ScriptRequest(ScriptRequestType.STOP)

    def on_scriptrunner_ready(self) -> ScriptRequest:
        """Called by the ScriptRunner when it's about to run its script for
        the first time, and also after its script has successfully completed.

        If we have a RERUN request, return the request and set
        our internal state to CONTINUE.

        If we have a STOP request or no request, set our internal state
        to STOP.
        """
        with self._lock:
            if self._state == ScriptRequestType.RERUN:
                self._state = ScriptRequestType.CONTINUE
                return ScriptRequest(ScriptRequestType.RERUN, self._rerun_data)

            # If we don't have a rerun request, unconditionally change our
            # state to STOP.
            self._state = ScriptRequestType.STOP
            return ScriptRequest(ScriptRequestType.STOP)
