# Copyright 2018-2020 Streamlit Inc.
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
from typing import Any, Optional, Dict

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
    states_by_id = {}
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


class Widgets(object):
    def __init__(self):
        self._state = {}  # type: Dict[str, WidgetState]

    def get_widget_value(self, widget_id: str) -> Optional[Any]:
        """Return the value of a widget, or None if no value has been set."""
        wstate = self._state.get(widget_id, None)
        if wstate is None:
            return None

        value_type = wstate.WhichOneof("value")
        if value_type == "json_value":
            return json.loads(getattr(wstate, value_type))

        return getattr(wstate, value_type)

    def set_state(self, widget_states: WidgetStates) -> None:
        """Copy the state from a WidgetStates protobuf into our state dict."""
        self._state = {}
        for wstate in widget_states.widgets:
            self._state[wstate.id] = wstate

    def marshall(self, client_state: ClientState) -> None:
        """Populate a ClientState proto with the widget values stored in this
        object.
        """
        client_state.widget_states.widgets.extend(self._state.values())

    def reset_triggers(self) -> None:
        """Remove all trigger values in our state dictionary.

        (All trigger values default to False, so removing them is equivalent
        to resetting them from True to False.)

        """
        prev_state = self._state
        self._state = {}
        for wstate in prev_state.values():
            if wstate.WhichOneof("value") != "trigger_value":
                self._state[wstate.id] = wstate

    def dump(self) -> None:
        """Pretty-print widget state to the console, for debugging."""
        pprint(self._state)
