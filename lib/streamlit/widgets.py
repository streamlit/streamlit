# Copyright 2018-2021 Streamlit Inc.
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

from pprint import pprint
from typing import Any, Optional, Dict, Callable

from streamlit.proto.ClientState_pb2 import ClientState
from streamlit.proto.WidgetStates_pb2 import WidgetStates, WidgetState
import json


def coalesce_widget_states(
    old_states: WidgetStates, new_states: WidgetStates
) -> WidgetStates:
    """Coalesce an older WidgetStates into a newer one, and return a new
    WidgetStates containing the result.

    For most widget values, we just take the latest version.

    However, any trigger_values (the state set by buttons) that are True in
    `old_states` will be set to True in the coalesced result, so that button
    presses don't go missing.
    """
    states_by_id = {}  # type: Dict[str, WidgetState]
    for new_state in new_states.widgets:
        states_by_id[new_state.id] = new_state

    for old_state in old_states.widgets:
        if old_state.WhichOneof("value") == "trigger_value" and old_state.trigger_value:

            # Ensure the corresponding new_state is also a trigger;
            # otherwise, a widget that was previously a button but no longer is
            # could get a bad value.
            new_trigger_val = states_by_id.get(old_state.id)
            if (
                new_trigger_val
                and new_trigger_val.WhichOneof("value") == "trigger_value"
            ):
                states_by_id[old_state.id] = old_state

    coalesced = WidgetStates()
    coalesced.widgets.extend(states_by_id.values())

    return coalesced


class WidgetStateManager(object):
    def __init__(self):
        self._widget_states: Dict[str, WidgetState] = {}
        self._previous_widget_states: Dict[str, WidgetState] = {}
        self._widget_callbacks: Dict[str, Callable[..., None]] = {}
        self._widget_deserializers: Dict[str, Callable[..., Any]] = {}

    def get_widget_value(self, widget_id: str) -> Optional[Any]:
        """Return the value of a widget, or None if no value has been set."""
        wstate = self._widget_states.get(widget_id, None)
        if wstate is None:
            return None

        value_type = wstate.WhichOneof("value")
        if value_type == "json_value":
            return json.loads(getattr(wstate, value_type))

        return getattr(wstate, value_type)

    def get_previous_widget_value(self, widget_id: str) -> Optional[Any]:
        """Return the previous value of a widget, or None if no value was set."""
        wstate = self._previous_widget_states.get(widget_id, None)
        if wstate is None:
            return None

        value_type = wstate.WhichOneof("value")
        if value_type == "json_value":
            return json.loads(getattr(wstate, value_type))

        return getattr(wstate, value_type)

    def set_state(self, widget_states: WidgetStates) -> None:
        """Copy the state from a WidgetStates protobuf into our state dict."""
        self._previous_widget_states = self._widget_states
        self._widget_states = {}
        for wstate in widget_states.widgets:
            self._widget_states[wstate.id] = wstate

    def add_callback(
        self,
        widget_id: str,
        deserializer: Callable[..., Any],
        callback: Callable[..., None],
    ) -> None:
        """Add a callback that will be called immediately before the app's
        next rerun if the given widget's value has changed.
        """
        self._widget_callbacks[widget_id] = callback
        self._widget_deserializers[widget_id] = deserializer

    def get_callback(self, widget_id: str) -> Optional[Callable[..., None]]:
        return self._widget_callbacks.get(widget_id, None)

    def call_callbacks(self, new_widget_states: WidgetStates) -> None:
        """Call all callbacks based on changes in the widget state. We are
        assuming that widgets send the same state value each time if unchanged.
        """
        for new_state in new_widget_states.widgets:
            callback = self._widget_callbacks.get(new_state.id, None)
            if callback is None:
                # The widget does not have an on_change callback.
                continue

            old_value = self.get_previous_widget_value(new_state.id)
            new_value = _get_widget_value(new_state)
            deserializer = self._widget_deserializers.get(new_state.id, None)

            if deserializer is not None:
                old_value = deserializer(old_value)
                new_value = deserializer(new_value)

            if new_value == old_value:
                # The widget's value has not changed.
                continue

            # The widget's value has changed - call its on_change callback.
            callback(new_value)

    def clear_callbacks(self) -> None:
        """Clear all registered callbacks"""
        self._widget_callbacks = {}
        self._widget_deserializers = {}

    def marshall(self, client_state: ClientState) -> None:
        """Populate a ClientState proto with the widget values stored in this
        object.
        """
        client_state.widget_states.widgets.extend(self._widget_states.values())

    def reset_triggers(self) -> None:
        """Remove all trigger values in our state dictionary.

        (All trigger values default to False, so removing them is equivalent
        to resetting them from True to False.)

        """
        prev_state = self._widget_states
        self._widget_states = {}
        for wstate in prev_state.values():
            if wstate.WhichOneof("value") != "trigger_value":
                self._widget_states[wstate.id] = wstate

    def dump(self) -> None:
        """Pretty-print widget state to the console, for debugging."""
        pprint(self._widget_states)


def _get_widget_value(state: Optional[WidgetState]) -> Optional[Any]:
    """Return the value of a widget, or None if no value has been set."""
    if state is None:
        return None

    value_type = state.WhichOneof("value")
    if value_type == "json_value":
        return json.loads(getattr(state, value_type))

    return getattr(state, value_type)


def beta_widget_value(key: str) -> Any:
    """Returns the value of a widget with a given id, for use in
    state update callbacks.
    """
    import streamlit.report_thread as ReportThread
    from streamlit.server.server import Server
    import streamlit.elements.utils as utils

    ctx = ReportThread.get_report_ctx()

    if ctx is None:
        return None

    this_session = Server.get_current().get_session_by_id(ctx.session_id)
    this_widget_state = this_session.get_widget_states()
    return this_widget_state.get_widget_value(utils._get_widget_id("", None, key))
