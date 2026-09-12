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
widget's value type, disabled state, and legal options; the last snapshot
records what the client was actually shown, including bounds, arity, and a
trigger's options. The snapshot has the final say, because it is the document
the client wrote against.
"""

from __future__ import annotations

import datetime
import json
import operator
from typing import TYPE_CHECKING, Any, Final

from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime.state.common import (
    GENERATED_ELEMENT_ID_PREFIX,
    is_array_value_field_name,
)

if TYPE_CHECKING:
    from collections.abc import Mapping

    from streamlit.runtime.agent.snapshot import ElementState
    from streamlit.runtime.state.common import ValueFieldName, WidgetMetadata
    from streamlit.runtime.state.session_state import SessionState


class AgentRequestError(Exception):
    """A request the interface refuses.

    Usually nothing has executed. The exception is a creating call that could
    only be judged after the app ran -- an unrecognized ``page``, which cannot
    be checked until the page list exists. Those carry ``session_id`` so the
    caller can continue with or close the session that was created, instead of
    leaking it until its TTL expires.
    """

    def __init__(
        self, code: str, message: str, *, session_id: str | None = None
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.session_id = session_id


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


def resolve_element_id(session_state: SessionState, key: str) -> str:
    """Map a snapshot key to the element ID the runtime uses.

    A key is either the author's ``key=`` or, for a keyless element, the
    generated element ID the snapshot reported. This is the same addressing rule
    ``st.session_state`` uses.
    """
    if key.startswith(GENERATED_ELEMENT_ID_PREFIX):
        return key

    element_id = session_state._key_id_mapper.get_id_from_key(key)
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
    if metadata is None:
        raise AgentRequestError(
            "unknown_key",
            f"No element with key {key!r} is registered in this session. "
            "Read the keys from the latest snapshot.",
        )

    state = element_states.get(element_id)
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
    if not state.actionable:
        raise AgentRequestError(
            "not_on_page",
            f"The element with key {key!r} is on the page but is not something "
            "you can set or fire. Read `actions` from the latest snapshot.",
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
        element_id = resolve_element_id(session_state, key)
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

        _validate_options(key, metadata, value)
        _validate_bounded(key, element_states[element_id], value)
        states.widgets.append(_encode(element_id, metadata.value_type, value, key))
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

        element_id = resolve_element_id(session_state, trigger_key)
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

    The wire carries one fragment id, so a request has to name one region. A
    batch spanning two fragments, or mixing a fragment's contents with controls
    outside it, is rejected rather than widened to a full rerun -- widening
    would silently close an open dialog and throw away the rest of the batch's
    effect.
    """
    targets = list(widget_state or {})
    if trigger is not None and isinstance(trigger.get("key"), str):
        targets.append(trigger["key"])

    fragments = set()
    for key in targets:
        state = element_states.get(resolve_element_id(session_state, key))
        fragments.add(state.fragment_id if state is not None else None)

    if len(fragments) > 1:
        named = sorted(f for f in fragments if f is not None)
        raise AgentRequestError(
            "cross_fragment_batch",
            "One interaction cannot span two fragments, or mix a fragment's "
            "contents with controls outside it, because a rerun is scoped to a "
            f"single fragment (here: {named}). Send them as separate "
            "interactions.",
        )

    return next(iter(fragments), None) or ""


def _is_number(value: Any) -> bool:
    # bool is an int subclass, and no bounded widget accepts one.
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _comparable(left: Any, right: Any) -> bool:
    """Whether two advertised values can be ordered against each other.

    Dates, times, and datetimes are reported as ISO strings, which sort in
    chronological order, so bounds on them are ordinary string comparisons.
    """
    if _is_number(left) and _is_number(right):
        return True
    return isinstance(left, str) and isinstance(right, str)


def _validate_bounded(key: str, state: ElementState, value: Any) -> None:
    """Check a write against the shape and bounds the element advertised.

    This covers every widget that reports a `min_value` or a `max_value`:
    numbers, sliders, and the date and time widgets, whose bounds are ISO
    strings. Without it the runtime silently discards what it cannot use and
    the widget falls back to its default, so the response is a 200 whose
    `value` is neither what was sent nor what was there before -- detectable
    only by diffing every field after every write.

    The shape check is against the value the snapshot reported, which is the
    only place the arity is stated: a date range renders as a two-item list,
    and sending one date, three, or `null` leaves the app on its default with
    no indication anything was rejected.
    """
    if state.min_value is None and state.max_value is None:
        return

    expected = state.value
    if isinstance(expected, list):
        if not isinstance(value, list) or len(value) != len(expected):
            raise AgentRequestError(
                "invalid_value",
                f"{key!r} takes a list of {len(expected)} values, like "
                f"{expected!r}; got {value!r}.",
            )
    elif isinstance(value, list):
        raise AgentRequestError(
            "invalid_value",
            f"{key!r} takes a single value, like {expected!r}; got {value!r}.",
        )
    elif value is None and expected is not None:
        # Only meaningful for a widget that reported `null` itself, such as
        # `st.number_input(value=None)`.
        raise AgentRequestError(
            "invalid_value",
            f"{key!r} cannot be cleared; it always holds a value.",
        )

    for item in value if isinstance(value, list) else [value]:
        for bound, comparison, label in (
            (state.min_value, operator.lt, "below the minimum"),
            (state.max_value, operator.gt, "above the maximum"),
        ):
            if bound is None:
                continue
            if not _comparable(item, bound):
                raise AgentRequestError(
                    "invalid_value",
                    f"{item!r} is not a value {key!r} accepts; its range is "
                    f"{state.min_value!r} to {state.max_value!r}.",
                )
            if comparison(item, bound):
                raise AgentRequestError(
                    "invalid_value",
                    f"{item!r} is {label} for {key!r} ({bound!r}).",
                )

    # A reversed range is stored as sent and quietly selects nothing, so the
    # app renders an empty result rather than reporting a bad request.
    if isinstance(value, list) and len(value) == 2:
        low, high = value
        if _comparable(low, high) and low > high:
            raise AgentRequestError(
                "invalid_value",
                f"The range for {key!r} is reversed: {low!r} is greater than {high!r}.",
            )


def _validate_options(key: str, metadata: WidgetMetadata[Any], value: Any) -> None:
    """Reject values outside a selection widget's declared options."""
    options = metadata.formatted_options
    if options is None:
        return

    candidates = value if isinstance(value, list) else [value]
    for candidate in candidates:
        if candidate is None:
            continue
        if str(candidate) not in options:
            raise AgentRequestError(
                "invalid_value",
                f"{candidate!r} is not one of the options for {key!r}.",
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


def _encode(
    element_id: str, value_type: ValueFieldName, value: Any, key: str
) -> WidgetState:
    """Write a JSON value into the ``WidgetState`` arm the widget registered.

    ``key`` is what the client sent and is used in errors, so a message never
    quotes an internal element ID back at a caller that used an authored key.
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
            state.double_value = float(value)
        elif value_type == "int_value":
            state.int_value = int(value)
        elif value_type == "string_value":
            state.string_value = _as_string(value)
        elif value_type == "json_value":
            state.json_value = json.dumps(value)
        elif is_array_value_field_name(value_type):
            items = value if isinstance(value, list) else [value]
            array = getattr(state, value_type)
            if value_type == "string_array_value":
                array.data.extend(_as_string(item) for item in items)
            elif value_type == "double_array_value":
                array.data.extend(float(item) for item in items)
            else:
                array.data.extend(int(item) for item in items)
        else:  # pragma: no cover - guarded by _UNSETTABLE_VALUE_TYPES
            raise AgentRequestError(
                "unsupported_element",
                f"Values of type {value_type} cannot be set through this interface.",
            )
    except (TypeError, ValueError) as exc:
        raise AgentRequestError(
            "invalid_value",
            f"{value!r} is not a valid value for {key!r}.",
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


def _as_string(value: Any) -> str:
    """Coerce a JSON value into the widget's wire string.

    Date and time widgets serialize as ISO 8601, which is also what their
    public API accepts, so an agent can send back what it read.
    """
    if isinstance(value, str):
        return value
    if isinstance(value, (datetime.date, datetime.time, datetime.datetime)):
        return value.isoformat()
    if isinstance(value, bool):
        # Guard against `True` silently becoming the string "True" for a
        # selection widget.
        raise TypeError(f"{value!r} is not a string")
    if isinstance(value, (int, float)):
        return str(value)
    raise TypeError(f"{value!r} is not a string")
