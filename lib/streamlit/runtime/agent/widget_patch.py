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

"""Validate an agent's widget-state patch and encode it as ``WidgetStates``.

Nothing from the request reaches a protobuf until it has been checked, and the
whole request is rejected before any callback runs.

Checks come from two places. The session's widget registry records each
widget's value type and legal options; the last snapshot records what the
client was actually shown, including what is disabled or unsupported, form
membership, and a trigger's options. The snapshot has the final say, because it
is the document the client wrote against.

Bounds, whole numbers, and `max_chars` are not checked here: the runtime resets
or trims a value that breaks them, and #16203 moves those checks into the
widgets for every client.
"""

from __future__ import annotations

import datetime
import json
import math
from typing import TYPE_CHECKING, Any, Final

from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime.agent.errors import AgentRequestError
from streamlit.runtime.state.common import (
    GENERATED_ELEMENT_ID_PREFIX,
    is_array_value_field_name,
)

if TYPE_CHECKING:
    from collections.abc import Mapping

    from streamlit.runtime.agent.snapshot import ElementState
    from streamlit.runtime.state.common import ValueFieldName, WidgetMetadata
    from streamlit.runtime.state.session_state import SessionState


# Value types that reset after the run that observed them. These are the only
# ones a `trigger` may address.
_TRIGGER_VALUE_TYPES: Final[frozenset[str]] = frozenset(
    {
        "trigger_value",
        "string_trigger_value",
        "json_trigger_value",
        "chat_input_value",
    }
)

# Value types that carry bytes or uploads, which a JSON patch cannot express.
_UNSETTABLE_VALUE_TYPES: Final[frozenset[str]] = frozenset(
    {"bytes_value", "arrow_value", "file_uploader_state_value"}
)

# How many legal options an `invalid_value` error spells out.
_LISTED_OPTIONS: Final = 20

# What each wire type takes, for errors that cannot quote the value.
_EXPECTED: Final[dict[str, str]] = {
    "bool_value": "true or false",
    "double_value": "a finite number",
    "int_value": "a whole number",
    "string_value": "a string",
    "string_array_value": "a string or a list of strings",
    "double_array_value": "a number or a list of numbers",
    "int_array_value": "a whole number or a list of them",
}


def resolve_element_id(
    session_state: SessionState,
    key: str,
    element_states: Mapping[str, ElementState],
) -> str:
    """Map a snapshot key to the element ID the runtime uses.

    A key is either the author's ``key=`` or, for a keyless element, the
    generated element ID the snapshot reported. This is the same addressing rule
    ``st.session_state`` uses. A keyed display element registers no widget, so
    its authored key is how the snapshot recorded it.
    """
    if key.startswith(GENERATED_ELEMENT_ID_PREFIX):
        return key

    element_id = session_state._key_id_mapper.get_id_from_key(key)
    if element_id is None and key in element_states:
        return key
    if element_id is None:
        raise AgentRequestError(
            "unknown_key",
            f"No element with key {key!r} exists in the current app state.",
        )
    return element_id


def _metadata(
    session_state: SessionState,
    element_id: str,
    key: str,
    element_states: Mapping[str, ElementState],
) -> WidgetMetadata[Any]:
    """Look up a widget, rejecting anything the last snapshot did not offer.

    The snapshot is the authority here, not the widget registry. Widget
    metadata outlives the widget that registered it: after a page switch or a
    collapsed conditional branch, a control that no longer renders still has
    metadata. Validating on metadata alone would accept a value for a control
    that is not on the page, run the script, change nothing, and return 200 --
    the agent would have no way to tell its instruction was ignored.

    Which of the "cannot act on this" codes applies is decided from what the
    snapshot recorded about the element, so a client branching on
    ``disabled_widget`` or ``unsupported_element`` actually sees them. Blaming
    the page for a disabled slider sends the caller looking in the wrong place.
    """
    metadata = session_state._new_widget_state.widget_metadata.get(element_id)
    state = element_states.get(element_id)
    if metadata is None and state is None:
        raise AgentRequestError(
            "unknown_key",
            f"No element with key {key!r} is registered in this session. "
            "Read the keys from the latest snapshot.",
        )
    if state is None:
        raise AgentRequestError(
            "not_on_page",
            f"The element with key {key!r} is not on the current page. It may "
            "have been on a previous page, or it may only appear after another "
            "control changes. Read `actions` from the latest snapshot.",
        )
    # Checked before `disabled`: an element this interface cannot drive at all
    # stays undrivable when the app enables it, so reporting it as disabled
    # would send the caller looking for the control that flips it.
    if state.support is not None:
        raise AgentRequestError(
            "unsupported_element",
            f"The element with key {key!r} is on the page but cannot be driven "
            f"through this interface ({state.support}).",
        )
    if state.disabled:
        raise AgentRequestError(
            "disabled_widget",
            f"The element with key {key!r} is on the page but disabled. "
            "Something else on the page controls that.",
        )
    if not state.actionable or metadata is None:
        raise AgentRequestError(
            "unsupported_element",
            f"The element with key {key!r} is on the page but display-only: it "
            "has no value to set and nothing to fire. Read `actions` from the "
            "latest snapshot.",
        )
    return metadata


def build_widget_states(
    session_state: SessionState,
    *,
    widget_state: dict[str, Any] | None,
    trigger: dict[str, Any] | None,
    element_states: Mapping[str, ElementState],
) -> WidgetStates:
    """Validate the patch and the trigger, then encode both as ``WidgetStates``.

    Only the addressed widgets are included. The runtime merges them into the
    session's current widget state and works out what changed, exactly as it
    does for the browser.

    ``element_states`` comes from the last snapshot's tree, because the
    runtime's widget registry does not record form membership or why an element
    is unusable -- both exist only on the emitted element.
    """
    states = WidgetStates()
    touched_forms: set[str] = set()

    for key, value in (widget_state or {}).items():
        element_id = resolve_element_id(session_state, key, element_states)
        metadata = _metadata(session_state, element_id, key, element_states)

        if metadata.value_type in _TRIGGER_VALUE_TYPES:
            raise AgentRequestError(
                "not_a_value",
                f"The element with key {key!r} is fired with `trigger`, not set "
                "through `widget_state`.",
            )
        if metadata.value_type in _UNSETTABLE_VALUE_TYPES:
            raise AgentRequestError(
                "unsupported_element",
                f"The element with key {key!r} takes binary input, which this "
                "interface cannot supply.",
            )

        state = element_states[element_id]
        _validate_options(
            key,
            metadata,
            value,
            advertised=None if state.options_open else state.options,
        )
        encoded = _encode(
            element_id,
            metadata.value_type,
            _temporal_to_wire(key, metadata, value),
            key,
            # An option's reported value can be a number, such as
            # `st.feedback`'s index; free text cannot.
            option_labels=frozenset(metadata.formatted_options or state.options or ()),
        )
        _check_readable(key, metadata, encoded)
        states.widgets.append(encoded)
        touched_forms.add(_form_of(element_states, element_id))

    submitted_form: str | None = None
    if trigger is not None:
        trigger_key = trigger.get("key")
        if not isinstance(trigger_key, str):
            raise AgentRequestError(
                "invalid_request",
                "`trigger` must be an object with a `key`. To rerun without "
                "changing anything, send no `trigger` at all.",
            )

        element_id = resolve_element_id(session_state, trigger_key, element_states)
        metadata = _metadata(session_state, element_id, trigger_key, element_states)
        if metadata.value_type not in _TRIGGER_VALUE_TYPES:
            raise AgentRequestError(
                "not_a_trigger",
                f"The element with key {trigger_key!r} holds a value; set it "
                "through `widget_state` instead of firing it.",
            )

        states.widgets.append(
            _encode_trigger(
                element_id,
                metadata.value_type,
                trigger.get("value"),
                trigger_key,
                element_states[element_id].options,
            )
        )
        submitted_form = _form_of(element_states, element_id)
        touched_forms.add(submitted_form)

    # An empty string means "not in a form", so a batch that mixes form fields
    # with unrelated controls also lands here.
    if len(touched_forms) > 1:
        raise AgentRequestError(
            "cross_form_batch",
            "One interaction cannot span two forms, or mix form fields with "
            "controls outside the form. Send each form's fields together with "
            "that form's submit trigger.",
        )

    # A form defers its values until submit, so fields sent on their own change
    # nothing the app can see. Accepting them returns a 200 that looks like it
    # worked while the form stays uncommitted.
    form = next(iter(touched_forms), "")
    if form and submitted_form != form:
        raise AgentRequestError(
            "missing_form_submit",
            f"These fields belong to the form {form!r}, which defers its "
            "values until submitted. Send them together with one of that "
            "form's submit triggers.",
        )

    return states


def _form_of(element_states: Mapping[str, ElementState], element_id: str) -> str:
    state = element_states.get(element_id)
    return (state.form_id or "") if state is not None else ""


def resolve_fragment(
    session_state: SessionState,
    element_states: Mapping[str, ElementState],
    *,
    widget_state: dict[str, Any] | None,
    trigger: dict[str, Any] | None,
) -> str:
    """The fragment a request should be scoped to, or "" for a full rerun.

    This mirrors the browser, where a widget carries the fragment id of the
    node it was rendered in and sends it with its update, so only that fragment
    reruns. Scoping is not a nicety: a full rerun does not re-emit an
    `st.dialog`, so driving a dialog at all depends on staying inside its
    fragment.

    The wire carries one fragment id, so a batch spanning several regions
    becomes a full rerun, which runs every fragment. The exception is an open
    dialog: a full rerun closes it without running its contents, so what the
    batch sent to the dialog would be silently discarded. That is rejected.
    """
    targets = list(widget_state or {})
    if trigger is not None and isinstance(trigger.get("key"), str):
        targets.append(trigger["key"])

    fragments = set()
    touches_dialog = False
    for key in targets:
        state = element_states.get(
            resolve_element_id(session_state, key, element_states)
        )
        fragments.add(state.fragment_id if state is not None else None)
        touches_dialog |= state is not None and state.in_dialog

    if len(fragments) <= 1:
        return next(iter(fragments), None) or ""

    if touches_dialog:
        raise AgentRequestError(
            "cross_dialog_batch",
            "The request combined widgets in an open dialog with widgets "
            "outside it. Covering both takes a full rerun, which closes the "
            "dialog and discards what was sent to it. Send the dialog's "
            "widgets on their own first.",
        )
    return ""


def _parse_iso(value: Any) -> datetime.date | datetime.time | None:
    """The date, time, or datetime that ISO text denotes, or None."""
    if not isinstance(value, str):
        return None
    parsers: tuple[Any, ...] = (
        datetime.date.fromisoformat,
        datetime.datetime.fromisoformat,
        datetime.time.fromisoformat,
    )
    for parse in parsers:
        try:
            parsed: datetime.date | datetime.time = parse(value)
            return parsed
        except ValueError:
            continue
    return None


def _validate_options(
    key: str,
    metadata: WidgetMetadata[Any],
    value: Any,
    *,
    advertised: list[Any] | None,
) -> None:
    """Reject values outside a selection widget's declared options.

    The widget registry's list is preferred, and the snapshot's stands in for a
    widget that registers none, such as `st.select_slider`. Neither exists for
    a widget that accepts new options.
    """
    options = (
        metadata.formatted_options
        if metadata.formatted_options is not None
        else advertised
    )
    if options is None:
        return

    candidates = value if isinstance(value, list) else [value]
    for candidate in candidates:
        if candidate is None:
            continue
        if str(candidate) not in options:
            listed = ", ".join(repr(option) for option in options[:_LISTED_OPTIONS])
            more = len(options) - _LISTED_OPTIONS
            raise AgentRequestError(
                "invalid_value",
                f"{candidate!r} is not one of the options for {key!r}: {listed}"
                + (f", and {more} more." if more > 0 else "."),
            )
        if options.count(str(candidate)) > 1:
            # The runtime would resolve a shared label to one of its options
            # without saying which, so the caller could not tell what it set.
            raise AgentRequestError(
                "invalid_value",
                f"Several options for {key!r} display as {candidate!r}, so it "
                "does not identify one.",
            )

    if (
        metadata.max_array_length is not None
        and isinstance(value, list)
        and len(value) > metadata.max_array_length
    ):
        raise AgentRequestError(
            "invalid_value",
            f"{key!r} accepts at most {metadata.max_array_length} selections.",
        )


def _check_readable(
    key: str, metadata: WidgetMetadata[Any], state: WidgetState
) -> None:
    """Reject a value the widget's own deserializer cannot read.

    The deserializer runs when the app reads the widget, so a value it cannot
    read raises inside the run instead of here. It also stays in session state,
    so every later run raises again and the session is stuck. The value is
    unpacked exactly as session state unpacks it.
    """
    field = state.WhichOneof("value")
    if field is None:
        return
    wire = getattr(state, field)
    if is_array_value_field_name(field):
        wire = wire.data
    elif field == "json_value":
        wire = json.loads(wire)
    try:
        metadata.deserializer(wire)
    except Exception as exc:
        raise AgentRequestError(
            "invalid_value", f"The value sent for {key!r} is not one it accepts."
        ) from exc


def _temporal_to_wire(key: str, metadata: WidgetMetadata[Any], value: Any) -> Any:
    """Turn the ISO text a temporal slider reports into what it carries.

    A date, time, or datetime slider is reported in ISO text but sends
    microseconds, and the widget's own serializer is what defines that mapping.
    It takes only ISO text: the microseconds are the wire's encoding, not a
    value a client was shown. Anything else passes through unchanged.
    """
    if (
        metadata.value_type != "double_array_value"
        or value is None
        or not _is_temporal(metadata)
    ):
        return value
    items = value if isinstance(value, list) else [value]
    parsed = [_parse_iso(item) for item in items]
    if any(item is None for item in parsed):
        raise AgentRequestError(
            "invalid_value",
            f"The value for {key!r} must be ISO dates or times, like the "
            "snapshot reports.",
        )
    try:
        return metadata.serializer(parsed if isinstance(value, list) else parsed[0])
    except Exception as exc:
        raise AgentRequestError(
            "invalid_value", f"The value sent for {key!r} is not one it accepts."
        ) from exc


def _is_temporal(metadata: WidgetMetadata[Any]) -> bool:
    """Whether a slider holds dates or times, judged by its default value."""
    try:
        default = metadata.deserializer(None)
    except Exception:
        return False
    if isinstance(default, (list, tuple)):
        default = default[0] if default else None
    return isinstance(default, (datetime.date, datetime.time))


def _encode(
    element_id: str,
    value_type: ValueFieldName,
    value: Any,
    key: str,
    *,
    option_labels: frozenset[str],
) -> WidgetState:
    """Write a JSON value into the ``WidgetState`` arm the widget registered.

    ``key`` is what the client sent and is used in errors, so a message never
    quotes an internal element ID back at a caller that used an authored key.
    Errors name the expected type rather than quote the value, which may be a
    password.

    A single value and a one-item list are interchangeable for a list-valued
    wire type, because single-select button groups and single sliders carry
    one value in a list.
    """
    state = WidgetState()
    state.id = element_id

    if value is None:
        # An explicit null clears the widget. Leaving the value oneof unset is
        # how the runtime represents "cleared".
        return state

    try:
        if value_type == "bool_value":
            state.bool_value = _as_bool(value)
        elif value_type == "double_value":
            state.double_value = _as_number(value)
        elif value_type == "int_value":
            state.int_value = _as_integer(value)
        elif value_type == "string_value":
            state.string_value = _as_string(value, option_labels)
        elif value_type == "json_value":
            state.json_value = json.dumps(value)
        elif is_array_value_field_name(value_type):
            items = value if isinstance(value, list) else [value]
            array = getattr(state, value_type)
            if value_type == "string_array_value":
                array.data.extend(_as_string(item, option_labels) for item in items)
            elif value_type == "double_array_value":
                array.data.extend(_as_number(item) for item in items)
            else:
                array.data.extend(_as_integer(item) for item in items)
        else:  # pragma: no cover - guarded by _UNSETTABLE_VALUE_TYPES
            raise AgentRequestError(
                "unsupported_element",
                f"Values of type {value_type} cannot be set through this interface.",
            )
    except (TypeError, ValueError, OverflowError) as exc:
        # OverflowError: an integer too large to become a float.
        raise AgentRequestError(
            "invalid_value",
            f"The value for {key!r} must be {_EXPECTED.get(value_type, 'JSON')}.",
        ) from exc

    return state


def _encode_trigger(
    element_id: str,
    value_type: ValueFieldName,
    payload: Any,
    key: str,
    options: list[Any] | None,
) -> WidgetState:
    """Encode a fired trigger, with its payload when the widget carries one.

    Every path either produces a ``WidgetState`` or raises an
    ``AgentRequestError``. A payload of the wrong shape has to be a 400, not an
    exception that escapes as a 500: a client probing what a trigger accepts
    would otherwise crash the interaction instead of being told the answer.
    """
    state = WidgetState()
    state.id = element_id

    if value_type == "trigger_value":
        if payload is not None:
            raise AgentRequestError(
                "invalid_value",
                f"The element with key {key!r} takes no trigger payload.",
            )
        state.trigger_value = True
    elif value_type == "string_trigger_value":
        # A trigger that chooses among options (st.menu_button) is validated
        # like a selection widget: firing it with something it never offered is
        # a client mistake, not a no-op rerun.
        if not isinstance(payload, str):
            raise AgentRequestError(
                "invalid_value",
                f"The element with key {key!r} needs a string trigger value"
                + (f", one of {options}." if options else "."),
            )
        if options is not None and payload not in options:
            raise AgentRequestError(
                "invalid_value",
                f"{payload!r} is not one of the options for {key!r}: {options}.",
            )
        state.string_trigger_value.data = payload
    elif value_type == "json_trigger_value":
        try:
            state.json_trigger_value = json.dumps(payload)
        except (TypeError, ValueError) as exc:
            raise AgentRequestError(
                "invalid_value",
                f"The trigger value for {key!r} is not JSON-serializable.",
            ) from exc
    elif value_type == "chat_input_value":
        if not isinstance(payload, str):
            raise AgentRequestError(
                "invalid_value",
                f"The element with key {key!r} needs a string trigger value.",
            )
        state.chat_input_value.data = payload
    else:  # pragma: no cover - guarded by _TRIGGER_VALUE_TYPES
        raise AgentRequestError("not_a_trigger", f"{key!r} is not a trigger.")

    return state


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    raise TypeError(f"{value!r} is not a boolean")


def _as_number(value: Any) -> float:
    """A finite JSON number, refusing what ``float()`` would quietly accept.

    ``true`` would become 1 and a numeric string would parse, and ``NaN``,
    which Python's JSON parser accepts, would reach the app.
    """
    # bool is an int subclass.
    is_number = isinstance(value, (int, float)) and not isinstance(value, bool)
    if not is_number or not math.isfinite(value):
        raise TypeError(f"{value!r} is not a finite number")
    return float(value)


def _as_integer(value: Any) -> int:
    if not float(_as_number(value)).is_integer():
        raise TypeError(f"{value!r} is not a whole number")
    return int(value)


def _as_string(value: Any, option_labels: frozenset[str]) -> str:
    """Coerce a JSON value into the widget's wire string.

    Date and time widgets serialize as ISO 8601, which is also what their
    public API accepts, so an agent can send back what it read. A number is
    accepted only where it names an option.
    """
    if isinstance(value, str):
        return value
    if isinstance(value, (datetime.date, datetime.time, datetime.datetime)):
        return value.isoformat()
    if isinstance(value, bool):
        # Guard against `True` silently becoming the string "True" for a
        # selection widget.
        raise TypeError(f"{value!r} is not a string")
    if isinstance(value, (int, float)) and str(value) in option_labels:
        return str(value)
    raise TypeError(f"{value!r} is not a string")
