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

from streamlit.proto.Widget_pb2 import WidgetStates


def coalesce_widget_states(old_states, new_states):
    """Coalesces an older WidgetStates into a newer one,
    and returns a new WidgetState containing the result.

    For most widget values, we just take the latest version.

    However, any trigger_values (the state set by buttons)
    that are True in the older WidgetStates will be set to
    True in the coalesced result, so that button presses
    don't go missing.


    Parameters
    ----------
    old_states : WidgetStates
        The older WidgetStates protobuf
    new_states : WidgetStates
        The newer WidgetStates protobuf

    Returns
    -------
    WidgetStates
        The resulting coalesced protobuf

    """
    states_by_id = {}
    for new_state in new_states.widgets:
        states_by_id[new_state.id] = new_state

    for old_state in old_states.widgets:
        if old_state.WhichOneof("value") == "trigger_value" and old_state.trigger_value:

            # Ensure the corresponding new_state is also a trigger;
            # otherwise, a widget that was previously a button but no longer is
            # could get a bad value.
            new_state = states_by_id.get(old_state.id)
            if new_state and new_state.WhichOneof("value") == "trigger_value":
                states_by_id[old_state.id] = old_state

    coalesced = WidgetStates()
    coalesced.widgets.extend(states_by_id.values())

    return coalesced


class Widgets(object):
    def __init__(self):
        """Initialize class."""
        self._state = {}

    def get_widget_value(self, id):
        """Returns the value of a widget

        Parameters
        ----------
        id : str
            The widget's ID

        Returns
        -------
        Any | None
            The widget's current value, or None if the widget's value hasn't
            been set.

        """
        wstate = self._state.get(id, None)
        if wstate is None:
            return None

        value_type = wstate.WhichOneof("value")
        if value_type is None:
            return None

        return getattr(wstate, value_type)

    def set_state(self, widget_states):
        """Sets the state dictionary for all widgets

        Parameters
        ----------
        widget_states : WidgetStates
            A WidgetStates protobuf

        """
        self._state = {}
        for wstate in widget_states.widgets:
            self._state[wstate.id] = wstate

    def get_state(self):
        """
        Returns
        -------
        WidgetStates
            A new WidgetStates protobuf containing the contents of
            our widget state dictionary.

        """
        states = WidgetStates()
        states.widgets.extend(self._state.values())
        return states

    def reset_triggers(self):
        """Removes all trigger values in our state dictionary.

        (All trigger values default to False, so removing them is equivalent
        to resetting them from True to False.)

        """
        prev_state = self._state
        self._state = {}
        for wstate in prev_state.values():
            if wstate.WhichOneof("value") != "trigger_value":
                self._state[wstate.id] = wstate

    def set_item(self, key, value):
        self._state[key] = value

    def dump(self):
        pprint(self._state)
