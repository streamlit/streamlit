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

import json
import textwrap
from pprint import pprint
from typing import Any, Optional, Dict, Set, Union

from attr import attrs

from streamlit import report_thread
from streamlit import util
from streamlit.errors import DuplicateWidgetID
from streamlit.proto.Button_pb2 import Button
from streamlit.proto.Checkbox_pb2 import Checkbox
from streamlit.proto.ClientState_pb2 import ClientState
from streamlit.proto.ColorPicker_pb2 import ColorPicker
from streamlit.proto.ComponentInstance_pb2 import ComponentInstance
from streamlit.proto.DateInput_pb2 import DateInput
from streamlit.proto.FileUploader_pb2 import FileUploader
from streamlit.proto.MultiSelect_pb2 import MultiSelect
from streamlit.proto.NumberInput_pb2 import NumberInput
from streamlit.proto.Radio_pb2 import Radio
from streamlit.proto.Selectbox_pb2 import Selectbox
from streamlit.proto.Slider_pb2 import Slider
from streamlit.proto.TextArea_pb2 import TextArea
from streamlit.proto.TextInput_pb2 import TextInput
from streamlit.proto.TimeInput_pb2 import TimeInput
from streamlit.proto.WidgetStates_pb2 import WidgetStates, WidgetState

# Protobuf types for all widgets.
WidgetProto = Union[
    Button,
    Checkbox,
    ColorPicker,
    ComponentInstance,
    DateInput,
    FileUploader,
    MultiSelect,
    NumberInput,
    Radio,
    Selectbox,
    Slider,
    TextArea,
    TextInput,
    TimeInput,
]


class NoValue:
    """Return this from DeltaGenerator.foo_widget() when you want the st.foo_widget()
    call to return None. This is needed because `DeltaGenerator._enqueue`
    replaces `None` with a `DeltaGenerator` (for use in non-widget elements).
    """

    pass


@attrs(auto_attribs=True)
class Widget:
    state: WidgetState

    def type(self) -> str:
        return self.state.WhichOneof("value")

    def id(self):
        return self.state.id

    def value(self) -> Any:
        if self.type() == "json_value":
            return json.loads(getattr(self.state, self.type()))

        return getattr(self.state, self.type())


def register_widget(
    element_type: str,
    element_proto: WidgetProto,
    user_key: Optional[str] = None,
    widget_func_name: Optional[str] = None,
) -> Optional[Any]:
    """Register a widget with Streamlit, and return its current value.
    NOTE: This function should be called after the proto has been filled.

    Parameters
    ----------
    element_type : str
        The type of the element as stored in proto.
    element_proto : proto
        The proto of the specified type (e.g. Button/Multiselect/Slider proto)
    user_key : str
        Optional user-specified string to use as the widget ID.
        If this is None, we'll generate an ID by hashing the element.
    widget_func_name : str or None
        The widget's DeltaGenerator function name, if it's different from
        its element_type. Custom components are a special case: they all have
        the element_type "component_instance", but are instantiated with
        dynamically-named functions.

    Returns
    -------
    ui_value : Any or None
        - If our ReportContext doesn't exist (meaning that we're running
        a "bare script" outside of streamlit), we'll return None.
        - Else if this is a new widget, it won't yet have a value and we'll
        return None.
        - Else if the widget has already been registered on a previous run but
        the user hasn't interacted with it on the client, it will have the
        default value it was first created with.
        - Else the widget has already been registered and the user *has*
        interacted with it, it will have that most recent user-specified value.

    """
    widget_id = _get_widget_id(element_type, element_proto, user_key)
    element_proto.id = widget_id

    ctx = report_thread.get_report_ctx()
    if ctx is None:
        # Early-out if we're not running inside a ReportThread (which
        # probably means we're running as a "bare" Python script, and
        # not via `streamlit run`).
        return None

    # Register the widget, and ensure another widget with the same id hasn't
    # already been registered.
    added = ctx.widget_ids_this_run.add(widget_id)
    if not added:
        raise DuplicateWidgetID(
            _build_duplicate_widget_message(
                widget_func_name if widget_func_name is not None else element_type,
                user_key,
            )
        )

    # Return the widget's current value.
    return ctx.widget_mgr.get_widget_value(widget_id)


def coalesce_widget_states(
    old_states: WidgetStates, new_states: WidgetStates
) -> WidgetStates:
    """Coalesce an older WidgetStates into a newer one, and return a new
    WidgetStates containing the result.

    For most widget values, we just take the latest version.

    However, any trigger_values (which are set by buttons) that are True in
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


class WidgetManager:
    """Stores widget values for a single connected session."""

    def __init__(self):
        self._state: Dict[str, Widget] = {}

    def __repr__(self) -> str:
        return util.repr_(self)

    def get_widget_value(self, widget_id: str) -> Optional[Any]:
        """Return the value of a widget, or None if no value has been set."""
        wstate = self._state.get(widget_id, None)
        if wstate is None:
            return None

        return wstate.value()

    def set_state(self, widget_states: WidgetStates) -> None:
        """Copy the state from a WidgetStates protobuf into our state dict."""
        self._state = {}
        for wstate in widget_states.widgets:
            widget = Widget(wstate)
            self._state[wstate.id] = widget

    def marshall(self, client_state: ClientState) -> None:
        """Populate a ClientState proto with the widget values stored in this
        object.
        """
        states = [widget.state for widget in self._state.values()]
        client_state.widget_states.widgets.extend(states)

    def cull_nonexistent(self, widget_ids: Set[str]) -> None:
        """Removes items in state that aren't present in a set of provided
        widget_ids.
        """
        self._state = {k: v for k, v in self._state.items() if k in widget_ids}

    def reset_triggers(self) -> None:
        """Remove all trigger values in our state dictionary.

        (All trigger values default to False, so removing them is equivalent
        to resetting them from True to False.)

        """
        prev_widgets = self._state
        self._state = {}
        for widget in prev_widgets.values():
            if widget.type() != "trigger_value":
                self._state[widget.id()] = widget

    def dump(self) -> None:
        """Pretty-print widget state to the console, for debugging."""
        pprint(self._state)


def _build_duplicate_widget_message(
    widget_func_name: str, user_key: Optional[str] = None
) -> str:
    if user_key is not None:
        message = textwrap.dedent(
            """
            There are multiple identical `st.{widget_type}` widgets with
            `key='{user_key}'`.

            To fix this, please make sure that the `key` argument is unique for
            each `st.{widget_type}` you create.
            """
        )
    else:
        message = textwrap.dedent(
            """
            There are multiple identical `st.{widget_type}` widgets with the
            same generated key.

            When a widget is created, it's assigned an internal key based on
            its structure. Multiple widgets with an identical structure will
            result in the same internal key, which causes this error.

            To fix this error, please pass a unique `key` argument to
            `st.{widget_type}`.
            """
        )

    return message.strip("\n").format(widget_type=widget_func_name, user_key=user_key)


def _get_widget_id(
    element_type: str, element_proto: WidgetProto, user_key: Optional[str] = None
) -> str:
    """Generate a widget id for the given widget.

    If user_key is defined, the widget_id returned is simply user_key.
    Otherwise, we return a hash of the widget element type and the
    string-serialized widget proto.

    Does not mutate the element_proto object.
    """
    if user_key is not None:
        return user_key
    else:
        return str(hash((element_type, element_proto.SerializeToString())))
