# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
from dataclasses import dataclass, field
from enum import Enum
from typing import cast

from streamlit import util
from streamlit.proto.WidgetStates_pb2 import WidgetStates
from streamlit.runtime.state import coalesce_widget_states


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
    fragment_id_queue: list[str] = field(default_factory=list)

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
        return cast(RerunData, self._rerun_data)

    def __repr__(self) -> str:
        return util.repr_(self)


class ScriptRequests:
    """An interface for communicating with a ScriptRunner. Thread-safe.

    AppSession makes requests of a ScriptRunner through this class, and
    ScriptRunner handles those requests.
    """

    def __init__(self):
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
                self._rerun_data = new_data
                return True

            if self._state == ScriptRequestType.RERUN:
                # We already have an existing Rerun request, so we can coalesce the new
                # rerun request into the existing one.

                coalesced_states = coalesce_widget_states(
                    self._rerun_data.widget_states, new_data.widget_states
                )

                if new_data.fragment_id_queue:
                    # This RERUN request corresponds to a fragment run. We append the
                    # new fragment ID to the end of the current fragment_id_queue if it
                    # isn't already contained in it.
                    fragment_id_queue = [*self._rerun_data.fragment_id_queue]
                    if (
                        # new_data.fragment_id_queue is always a singleton
                        (new_fragment_id := new_data.fragment_id_queue[0])
                        not in fragment_id_queue
                    ):
                        fragment_id_queue.append(new_fragment_id)
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
                )

                return True

            # We'll never get here
            raise RuntimeError(f"Unrecognized ScriptRunnerState: {self._state}")

    def on_scriptrunner_yield(self) -> ScriptRequest | None:
        """Called by the ScriptRunner when it's at a yield point.

        If we have no request or a RERUN request corresponding to one or more fragments,
        return None.

        If we have a (full script) RERUN request, return the request and set our internal
        state to CONTINUE.

        If we have a STOP request, return the request and remain stopped.
        """
        if self._state == ScriptRequestType.CONTINUE or (
            # Reruns corresponding to fragments should *not* cancel the current script
            # run as doing so will affect elements outside of the fragment.
            self._state == ScriptRequestType.RERUN
            and self._rerun_data.fragment_id_queue
        ):
            # We avoid taking the lock in the common cases of having no request and
            # having a RERUN request corresponding to >=1 fragments. If a STOP or
            # (full script) RERUN request is received between the `if` and `return`, it
            # will be handled at the next `on_scriptrunner_yield`, or when
            # `on_scriptrunner_ready` is called.
            return None

        with self._lock:
            if self._state == ScriptRequestType.RERUN:
                if self._rerun_data.fragment_id_queue:
                    return None

                self._state = ScriptRequestType.CONTINUE
                return ScriptRequest(ScriptRequestType.RERUN, self._rerun_data)

            assert self._state == ScriptRequestType.STOP
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
