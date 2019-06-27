# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import copy
from pprint import pprint


def reset_widget_triggers(widget_states):
    """Resets all widget trigger values to False.

    Parameters
    ----------
    widget_states : WidgetStates
        A WidgetStates protobuf

    Returns
    -------
    WidgetStates
        A copy of the passed-in value, with triggers set to False
    """
    widget_states = copy.deepcopy(widget_states)
    for wstate in widget_states.widgets:
        if wstate.WhichOneof('value') == 'trigger_value':
            wstate.trigger_value = False

    return widget_states


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

        value_type = wstate.WhichOneof('value')
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

    def set_item(self, key, value):
        self._state[key] = value

    def dump(self):
        pprint(self._state)
