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

import hashlib
import json
import textwrap
from pprint import pprint
from typing import Any, Callable, cast, Dict, Optional, Set, Tuple, Union

import attr

from streamlit import report_thread
from streamlit import util
from streamlit.errors import DuplicateWidgetID
from streamlit.proto.Button_pb2 import Button
from streamlit.proto.Checkbox_pb2 import Checkbox
from streamlit.proto.ClientState_pb2 import ClientState
from streamlit.proto.ColorPicker_pb2 import ColorPicker
from streamlit.proto.Components_pb2 import ComponentInstance
from streamlit.proto.DateInput_pb2 import DateInput
from streamlit.proto.DownloadButton_pb2 import DownloadButton
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
from streamlit.state.session_state import (
    GENERATED_WIDGET_KEY_PREFIX,
    WidgetMetadata,
    WidgetSerializer,
    WidgetArgs,
    WidgetCallback,
    WidgetDeserializer,
    WidgetKwargs,
)

# Protobuf types for all widgets.
WidgetProto = Union[
    Button,
    Checkbox,
    ColorPicker,
    ComponentInstance,
    DateInput,
    DownloadButton,
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


def register_widget(
    element_type: str,
    element_proto: WidgetProto,
    deserializer: WidgetDeserializer,
    serializer: WidgetSerializer,
    user_key: Optional[str] = None,
    widget_func_name: Optional[str] = None,
    on_change_handler: Optional[WidgetCallback] = None,
    args: Optional[WidgetArgs] = None,
    kwargs: Optional[WidgetKwargs] = None,
) -> Tuple[Any, bool]:
    """Register a widget with Streamlit, and return its current value.
    NOTE: This function should be called after the proto has been filled.

    Parameters
    ----------
    element_type : str
        The type of the element as stored in proto.
    element_proto : proto
        The proto of the specified type (e.g. Button/Multiselect/Slider proto)
    user_key : Optional[str]
        Optional user-specified string to use as the widget ID.
        If this is None, we'll generate an ID by hashing the element.
    widget_func_name : Optional[str]
        The widget's DeltaGenerator function name, if it's different from
        its element_type. Custom components are a special case: they all have
        the element_type "component_instance", but are instantiated with
        dynamically-named functions.
    on_change_handler : Optional[WidgetCallback]
        An optional callback invoked when the widget's value changes.
    deserializer : Optional[WidgetDeserializer]
        Called to convert a widget's protobuf value to the value returned by
        its st.<widget_name> function.
    args : Optional[WidgetArgs]
        args to pass to on_change_handler when invoked
    kwargs : Optional[WidgetKwargs]
        kwargs to pass to on_change_handler when invoked

    Returns
    -------
    ui_value : Tuple[Any, bool]
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
        return (deserializer(None, ""), False)

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

    session_state = ctx.session_state

    metadata = WidgetMetadata(
        widget_id,
        deserializer,
        serializer,
        value_type=element_type_to_value_type[element_type],
        callback=on_change_handler,
        callback_args=args,
        callback_kwargs=kwargs,
    )
    # TODO: should these be merged into a more generic call so this code doesn't need to know about keyed vs unkeyed?
    if user_key is not None:
        session_state.set_keyed_widget(metadata, widget_id, user_key)
    else:
        session_state.set_unkeyed_widget(metadata, widget_id)
    value_changed = session_state.should_set_frontend_state_value(widget_id, user_key)

    val = session_state.get_value_for_registration(widget_id)

    return (val, value_changed)


# NOTE: We use this table to start with a best-effort guess for the value_type
# of each widget. Once we actually receive a proto for a widget from the
# frontend, the guess is updated to be the correct type. Unfortuantely, we're
# not able to always rely on the proto as the type may be needed earlier.
# Thankfully, in these cases (when value_type == "trigger_value"), the static
# table here being slightly inaccurate should never pose a problem.
element_type_to_value_type = {
    "button": "trigger_value",
    "download_button": "trigger_value",
    "checkbox": "bool_value",
    "color_picker": "string_value",
    "date_input": "string_array_value",
    "file_uploader": "file_uploader_state_value",
    "multiselect": "int_array_value",
    "number_input": "double_value",
    "radio": "int_value",
    "selectbox": "int_value",
    "slider": "double_array_value",
    "text_area": "string_value",
    "text_input": "string_value",
    "time_input": "string_value",
    "component_instance": "json_value",
}


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
    states_by_id: Dict[str, WidgetState] = {
        wstate.id: wstate for wstate in new_states.widgets
    }

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

    The widget id includes the user_key so widgets with identical arguments can
    use it to be distinct.

    The widget id includes an easily identified prefix, and the user_key as a
    suffix, to make it easy to identify it and know if a key maps to it.

    Does not mutate the element_proto object.
    """
    h = hashlib.new("md5")
    h.update(element_type.encode("utf-8"))
    h.update(element_proto.SerializeToString())
    return f"{GENERATED_WIDGET_KEY_PREFIX}-{h.hexdigest()}-{user_key}"
