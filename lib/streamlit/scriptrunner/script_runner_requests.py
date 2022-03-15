# Copyright 2018-2022 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import threading
from enum import Enum
from typing import Optional

from attr import attr

from streamlit.proto.WidgetStates_pb2 import WidgetStates
from streamlit.scriptrunner import RerunData
from streamlit.state import coalesce_widget_states


class ScriptRunnerRequestState(Enum):
    # The ScriptRunner is running its script.
    RUNNING = "RUNNING"

    # The ScriptRunner has stopped running its script.
    # This is a terminal state.
    STOPPED = "STOPPED"

    # A script rerun has been requested. The ScriptRunner will
    # handle this request as soon as it reaches an interrupt point.
    RERUN_REQUESTED = "RERUN_REQUESTED"


@attr.s(auto_attribs=True, slots=True, frozen=True)
class RerunData:
    """Data attached to RERUN requests. Immutable."""

    query_string: str = ""
    widget_states: Optional[WidgetStates] = None


class ScriptRunnerRequests:
    """An interface for communicating with a ScriptRunner. Thread-safe.

    AppSession makes requests of a ScriptRunner through this class, and
    ScriptRunner handles those requests.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._state = ScriptRunnerRequestState.RUNNING
        self._rerun_data = RerunData()

    @property
    def state(self) -> ScriptRunnerRequestState:
        # No lock necessary
        return self._state

    def stop(self) -> None:
        """Request that the ScriptRunner stop running. A stopped ScriptRunner
        can't be used anymore.
        """
        with self._lock:
            self._state = ScriptRunnerRequestState.STOPPED

    def request_rerun(self, new_data: RerunData) -> bool:
        """Request that the ScriptRunner rerun its script.

        If the ScriptRunner has been stopped, this request can't be honored:
        return False.

        Otherwise, record the request and return True. The ScriptRunner will
        handle the rerun request as soon as it reaches an interrupt point.
        """

        with self._lock:
            if self._state == ScriptRunnerRequestState.STOPPED:
                # We can't rerun after being stopped.
                return False

            if self._state == ScriptRunnerRequestState.RUNNING:
                # If we're running, we can handle a rerun request
                # unconditionally.
                self._state = ScriptRunnerRequestState.RERUN_REQUESTED
                self._rerun_data = new_data
                return True

            if self._state == ScriptRunnerRequestState.RERUN_REQUESTED:
                # If we have an existing Rerun request, we coalesce this
                # new request into it.
                if self._rerun_data.widget_states is None:
                    # The existing request's widget_states is None, which
                    # means it wants to rerun with whatever the most
                    # recent script execution's widget state was.
                    # We have no meaningful state to merge with, and
                    # so we simply overwrite the existing request.
                    self._rerun_data = new_data
                    return True

                if new_data.widget_states is not None:
                    # Both the existing and the new request have
                    # non-null widget_states. Merge them together.
                    coalesced_states = coalesce_widget_states(
                        self._rerun_data.widget_states, new_data.widget_states
                    )
                    self._rerun_data = RerunData(
                        query_string=new_data.query_string,
                        widget_states=coalesced_states,
                    )
                    return True

                # `old_data.widget_states is not None and data.widget_states is None` -
                # this new request is entirely redundant, and so we leave
                # our existing rerun_data as is
                return True

            # We'll never get here
            raise RuntimeError(f"Unrecognized ScriptRunnerState: {self._state}")

    def pop_rerun_request_or_stop(self) -> Optional[RerunData]:
        """Called by ScriptRunner when it's ready to handle a pending rerun
        request. If there is a request, return that request and change
        state to RUNNING. Otherwise, return None and change state to
        STOPPED.
        """
        with self._lock:
            if self._state == ScriptRunnerRequestState.RERUN_REQUESTED:
                self._state = ScriptRunnerRequestState.RUNNING
                return self._rerun_data

            self._state = ScriptRunnerRequestState.STOPPED
            return None
