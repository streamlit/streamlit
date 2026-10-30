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

"""Check an agent's widget writes and turn them into the rerun a browser sends.

A request's ``widget_state`` and ``trigger`` pass through here before anything
runs. Nothing from the request reaches a protobuf until it has been checked,
and the whole request is refused if any part of it is not legal. This covers:

- Addressing (``resolve_element_id``): a key is an authored key or an element
  ID the snapshot reported. An element that is gone, disabled, unsupported, or
  display-only is refused with the code that names why, and so is a value sent
  to a trigger, a trigger fired as a value, or one element set twice.
- Values and triggers (``build_widget_states``):

  - Each value must have the JSON type its ``value_schema`` states, and
    ``null`` resets or clears it.
  - Accepted values and the one trigger are encoded in each widget's wire
    type, in snapshot order, as the ``WidgetStates`` a browser would send.
  - Each encoded state then passes the check a browser value passes
    (``widget_checks.check_client_value``): the widget's wire field, its
    deserializer, ``disabled``, and its own validator. The validator decides
    whether a value is one of its options, within its bounds and
    ``max_chars``, in a layout its frontend sends, a range of the right
    length in order, and not empty for a ``required`` widget.
  - Only a value whose wire form equals the stored one skips the validator,
    so a value the widget would convert, such as ``2.5`` for an integer input
    holding ``2``, is refused rather than corrected. The unset form, which
    ``null`` sends unless it clears a widget, reads as the default without a
    conversion, so it is compared after deserializing: ``null`` to an empty
    required widget changes nothing.
  - Unlike a browser session, a request is also refused for a label several
    options share, unless it is unchanged.
  - A value that is unchanged is left out of the ``WidgetStates``, so
    sending back what the snapshot reports changes nothing.

- Forms: a form's fields go with one of its submit triggers, and a request
  cannot span two forms or mix a form with other controls.
- Rerun scope (``resolve_fragment``): writes that share a fragment rerun only
  that fragment, and an open dialog's widgets cannot be mixed with anything
  outside the dialog.

What a request may address, and the JSON type of each value, come from the
last snapshot's ``ElementState``, because the snapshot is the document the
client wrote against. The widget registry supplies the codec, each widget's
wire type, serializer, and deserializer, and the widget's own checks, which
decide which values it accepts. A refusal names the constraint, such as the
options, the bounds, or ``max_chars``. #16203 tracks the constraints still
enforced only in the browser.
"""

from __future__ import annotations

import datetime as dt
import json
import math
from typing import TYPE_CHECKING, Any, Final, NamedTuple

from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime.agent.errors import AgentRequestError
from streamlit.runtime.state import widget_checks
from streamlit.runtime.state.common import (
    is_array_value_field_name,
    is_element_id,
    pack_widget_state_value,
    user_key_from_element_id,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Mapping

    from streamlit.runtime.agent.snapshot import BlockedReason, ElementState
    from streamlit.runtime.state.common import ValueFieldName, WidgetMetadata
    from streamlit.runtime.state.session_state import SessionState
    from streamlit.runtime.state.widget_checks import Violation, ViolationKind


# Value types that carry bytes or uploads, which a JSON request cannot express.
_UNSETTABLE_VALUE_TYPES: Final[frozenset[str]] = frozenset(
    {"bytes_value", "arrow_value", "file_uploader_state_value"}
)

_MAX_LISTED_OPTIONS: Final = 20

# Inputs whose wire form is ISO text in one fixed layout, and the type their
# value parses as.
_ISO_TEXT_INPUTS: Final[dict[str, type[dt.datetime | dt.time]]] = {
    "datetime_input": dt.datetime,
    "time_input": dt.time,
}

# What each wire type takes. Errors name this instead of quoting the value,
# which may be a password. A list wire carrying a single value, such as a
# single-select `st.pills`, takes one item.
_EXPECTED_SINGLE: Final[dict[str, str]] = {
    "bool_value": "true or false",
    "double_value": "a finite number",
    "int_value": "a whole number",
    "string_value": "a string",
    "string_array_value": "a string",
    "double_array_value": "a finite number",
    "int_array_value": "a whole number",
}

# The same for an element whose `value_schema` is an array.
_EXPECTED_LIST: Final[dict[str, str]] = {
    "string_array_value": "a list of strings",
    "double_array_value": "a list of finite numbers",
    "int_array_value": "a list of whole numbers",
}


def resolve_element_id(
    session_state: SessionState,
    key: str,
    element_states: Mapping[str, ElementState],
) -> str:
    """Map a key from the snapshot to the element ID the runtime uses.

    A key is either the author's ``key=`` or, for a keyless element, the
    generated element ID the snapshot reported. This is the addressing rule
    ``st.session_state`` uses. A keyed form, container, or display element
    registers no widget, so its authored key is how the snapshot recorded it.

    Parameters
    ----------
    session_state : SessionState
        The session's state, read for the key-to-ID mapping.
    key : str
        A key as the client sent it.
    element_states : Mapping[str, ElementState]
        The last snapshot's element states, keyed by element ID.

    Returns
    -------
    str
        The element ID, which may be absent from ``element_states`` when the
        widget it names is no longer on the page.

    Raises
    ------
    AgentRequestError
        ``unknown_key`` when nothing in this session ever had ``key``.
    """
    if is_element_id(key):
        return key

    element_id = session_state.get_widget_id_from_key(key)
    if element_id is not None and element_id in element_states:
        return element_id
    # The key map outlives the widget, so a stale widget's entry must not hide
    # a form, container, or display element that uses the same key now.
    if key in element_states:
        return key
    # An element with an element ID that registers no widget, such as a link
    # button without `on_click`, is in no key map. The snapshot reported the
    # key embedded in that ID.
    for shown_id in element_states:
        if is_element_id(shown_id) and user_key_from_element_id(shown_id) == key:
            return shown_id
    if element_id is not None:
        return element_id
    raise _unknown_key(key)


def _unknown_key(key: str) -> AgentRequestError:
    return AgentRequestError(
        "unknown_key",
        f"No element with key {key!r} is registered in this session. Read the "
        "keys from the latest snapshot.",
    )


def _not_accepted(key: str) -> AgentRequestError:
    return AgentRequestError(
        "invalid_value", f"The value sent for {key!r} is not one it accepts."
    )


def _disabled(key: str) -> AgentRequestError:
    return AgentRequestError(
        "disabled_widget",
        f"The element with key {key!r} is on the page but disabled. It "
        "accepts nothing until the app enables it.",
    )


class _Sent(NamedTuple):
    """What a request sent for one widget, which a refusal may draw on."""

    # The key as the client sent it, so a message never quotes an internal
    # element ID back at a caller that used an authored key.
    key: str
    # The JSON value after its type check, or the trigger's payload.
    value: Any
    # Whether the element's options are numbers, such as `st.feedback`'s
    # indexes, which a refusal then lists bare.
    as_numbers: bool


def _refused_value(_violation: Violation, sent: _Sent) -> AgentRequestError:
    return _not_accepted(sent.key)


def _refused_disabled(_violation: Violation, sent: _Sent) -> AgentRequestError:
    return _disabled(sent.key)


def _not_rendered(_violation: Violation, sent: _Sent) -> AgentRequestError:
    # The snapshot check answers first for an element the snapshot does not
    # show, so this is an element the latest run no longer rendered.
    return AgentRequestError(
        "not_on_page",
        f"The element with key {sent.key!r} is not on the page: the latest run "
        "did not render it. Read `actions` from the latest snapshot.",
    )


def _sent_item(violation: Violation, sent: _Sent) -> Any:
    """The item of the sent value that a violation's ``positions`` names."""
    positions = violation.detail.get("positions")
    # A list sent for a list wire is encoded item by item, so its positions
    # match the wire's.
    if positions and isinstance(sent.value, list) and positions[0] < len(sent.value):
        return sent.value[positions[0]]
    return sent.value


def _not_an_option(violation: Violation, sent: _Sent) -> AgentRequestError:
    options = list(violation.detail.get("options", ()))
    return AgentRequestError(
        "invalid_value",
        f"{_sent_item(violation, sent)!r} is not one of the options for "
        f"{sent.key!r}: " + _list_options(options, as_numbers=sent.as_numbers),
    )


def _ambiguous_option(violation: Violation, sent: _Sent) -> AgentRequestError:
    # The widget would resolve a shared label to one of its options without
    # saying which, so the caller could not tell what it set.
    return AgentRequestError(
        "invalid_value",
        f"Several options for {sent.key!r} display as "
        f"{_sent_item(violation, sent)!r}, so it does not identify one.",
    )


def _too_many_items(violation: Violation, sent: _Sent) -> AgentRequestError:
    return AgentRequestError(
        "invalid_value",
        f"{sent.key!r} takes at most {violation.detail.get('max_items')} items, "
        "as its `max_selections` says.",
    )


def _duplicate_items(violation: Violation, sent: _Sent) -> AgentRequestError:
    return AgentRequestError(
        "invalid_value",
        f"{sent.key!r} lists {_sent_item(violation, sent)!r} more than once. List "
        "each option once.",
    )


def _bound_text(bound: Any) -> str:
    """A bound as a request would send it: ISO text for a date or time.

    A time of day is written to the minute unless it has seconds, as
    `st.datetime_input` takes `YYYY-MM-DDTHH:MM`.
    """
    if isinstance(bound, (dt.datetime, dt.time)) and not (
        bound.second or bound.microsecond
    ):
        return bound.isoformat(timespec="minutes")
    if isinstance(bound, (dt.date, dt.time)):
        return bound.isoformat()
    return str(bound)


def _out_of_range(violation: Violation, sent: _Sent) -> AgentRequestError:
    low = violation.detail.get("min_value")
    high = violation.detail.get("max_value")
    if low is not None and high is not None:
        accepted = f"from {_bound_text(low)} to {_bound_text(high)}"
    elif low is not None:
        accepted = f"of at least {_bound_text(low)}"
    else:
        accepted = f"of at most {_bound_text(high)}"
    return AgentRequestError(
        "invalid_value", f"{sent.key!r} takes values {accepted}, inclusive."
    )


def _bad_shape(violation: Violation, sent: _Sent) -> AgentRequestError:
    if violation.detail.get("order"):
        return AgentRequestError(
            "invalid_value",
            f"{sent.key!r} takes the lower end of its range first.",
        )
    counts = list(violation.detail.get("item_counts", ()))
    if len(counts) > 1 and counts[0] == 0:
        accepted = f"at most {counts[-1]}"
    else:
        accepted = " or ".join(str(count) for count in counts)
    noun = "item" if counts[-1:] == [1] else "items"
    return AgentRequestError("invalid_value", f"{sent.key!r} takes {accepted} {noun}.")


def _malformed(violation: Violation, sent: _Sent) -> AgentRequestError:
    expected = violation.detail.get("expected")
    if expected is None:  # pragma: no cover - every helper names the layout
        return _not_accepted(sent.key)
    return AgentRequestError("invalid_value", f"{sent.key!r} takes {expected}.")


def _too_long(violation: Violation, sent: _Sent) -> AgentRequestError:
    return AgentRequestError(
        "invalid_value",
        f"{sent.key!r} takes at most {violation.detail.get('max_chars')} "
        "characters, as its `max_chars` says. A character outside the Basic "
        "Multilingual Plane, such as most emoji, counts as two.",
    )


def _empty_required(_violation: Violation, sent: _Sent) -> AgentRequestError:
    # Say why a value that is not plainly empty counts as empty. Only a text
    # input refuses non-empty text, and only a date range a non-empty list.
    if isinstance(sent.value, str) and sent.value:
        why = " Text of only whitespace is empty."
    elif isinstance(sent.value, list) and sent.value:
        why = " A date range without both ends is empty."
    else:
        why = ""
    return AgentRequestError(
        "invalid_value", f"{sent.key!r} is required and cannot be emptied.{why}"
    )


# How each violation the shared check reports is refused. Only the option
# messages quote what was sent: options are not secrets, and the client holds
# the value. The others name the constraint, never the sent value, which may be
# a password.
_VIOLATION_ERRORS: Final[
    Mapping[ViolationKind, Callable[[Violation, _Sent], AgentRequestError]]
] = {
    "wrong_type": _refused_value,
    "unreadable": _refused_value,
    "not_rendered": _not_rendered,
    "disabled": _refused_disabled,
    "not_an_option": _not_an_option,
    "too_many_items": _too_many_items,
    "duplicate_items": _duplicate_items,
    "ambiguous_option": _ambiguous_option,
    "out_of_range": _out_of_range,
    "bad_shape": _bad_shape,
    "malformed": _malformed,
    "too_long": _too_long,
    "empty_required": _empty_required,
}


def _check_with_widget(
    session_state: SessionState,
    metadata: WidgetMetadata[Any],
    encoded: WidgetState,
    sent: _Sent,
) -> bool:
    """Refuse an encoded state that the widget's own checks refuse.

    This is the check a browser value passes at the boundary, against the
    stored value, so a write the widget would drop is refused before anything
    runs. The comparison is on the wire: a value counts as unchanged only if it
    equals the stored value serialized, so a value the deserializer would
    convert onto the stored one still reaches the widget's validator. Unlike a
    browser session, the agent API also refuses a label several options share.

    Returns
    -------
    bool
        Whether the state changes the widget's value.
    """
    stored_state: WidgetState | None = None
    try:
        stored = session_state.get_widget_value(encoded.id)
    except KeyError:
        stored = None
    else:
        try:
            stored_state = pack_widget_state_value(
                encoded.id, metadata.value_type, metadata.serializer(stored)
            )
        except Exception:
            # With no stored wire form, the value counts as changed.
            stored_state = None
    result = widget_checks.check_client_value(
        encoded,
        metadata=metadata,
        previous=stored,
        is_rendered=session_state.is_widget_rendered(encoded.id),
        compare_wire=True,
        stored_state=stored_state,
    )
    if result.violation is not None:
        raise _VIOLATION_ERRORS[result.violation.kind](result.violation, sent)
    return result.changed


def _require_actionable(
    session_state: SessionState,
    element_id: str,
    key: str,
    element_states: Mapping[str, ElementState],
    *,
    compile_error: bool,
) -> tuple[ElementState, WidgetMetadata[Any]]:
    """Look up a widget, refusing anything the last snapshot did not offer.

    The snapshot is the authority here, not the widget registry. Widget
    metadata outlives the widget that registered it: after a page switch or a
    collapsed conditional branch, a control that no longer renders still has
    metadata. Validating on metadata alone would accept a value for a control
    that is not on the page, run the script, change nothing, and return 200,
    leaving the client no way to tell its instruction was ignored.

    Which of the "cannot act on this" codes applies is decided from what the
    snapshot recorded about the element, so a client branching on
    ``disabled_widget`` or ``unsupported_element`` actually sees them. Blaming
    the page for a disabled slider sends the caller looking in the wrong place.
    """
    metadata = session_state.get_widget_metadata(element_id)
    state = element_states.get(element_id)
    if state is None:
        if metadata is None:
            raise _unknown_key(key)
        if compile_error:
            raise _blocked(key, "compile_error")
        # A generated key encodes the widget's parameters, so the same widget
        # gets a new key when one of them changes, such as a slider's bound.
        regenerated = (
            " A generated key also changes when the widget's parameters do, so "
            "the element may still be on the page under a new key: find it by "
            "its `label` in `actions`."
            if is_element_id(key)
            else ""
        )
        raise AgentRequestError(
            "not_on_page",
            f"The element with key {key!r} is not in the latest snapshot. It may "
            "have been on a previous page, or it may only appear after another "
            f"control changes.{regenerated} Read `actions` from the latest "
            "snapshot.",
        )
    # Checked before `disabled`: an element this interface cannot set or fire
    # stays that way when the app enables it, so reporting it as disabled
    # would send the caller looking for the control that flips it.
    if state.support is not None:
        raise AgentRequestError(
            "unsupported_element",
            f"The element with key {key!r} is on the page, but this interface "
            f"cannot set or fire it ({state.support}).",
        )
    # Checked before `disabled` for the same reason: enabling the element
    # would not make it usable.
    if state.blocked_by is not None and state.action is not None:
        raise _blocked(key, state.blocked_by)
    if state.disabled:
        raise _disabled(key)
    # Some elements with no action still register a widget, such as
    # `st.download_button(on_click="ignore")`, so the description decides.
    if state.action is None or metadata is None:
        raise AgentRequestError(
            "unsupported_element",
            f"The element with key {key!r} is on the page but display-only: it "
            "has no value to set and nothing to fire. Read `actions` from the "
            "latest snapshot.",
        )
    if not state.actionable:  # pragma: no cover - every reason is checked above
        raise AgentRequestError(
            "not_on_page",
            f"The element with key {key!r} is in the latest snapshot but "
            "cannot be used now. Read `actions` from the latest snapshot.",
        )
    return state, metadata


def _blocked(key: str, reason: BlockedReason) -> AgentRequestError:
    """Refuse an element the snapshot shows but does not offer, naming why."""
    if reason == "compile_error":
        return AgentRequestError(
            "not_on_page",
            f"The script failed to compile, so the element with key {key!r} is "
            "left from an earlier run and cannot be used until it compiles. The "
            "latest snapshot reports the error.",
        )
    return AgentRequestError(
        "not_on_page",
        f"The element with key {key!r} is in a closed dialog, so it cannot be "
        "used until the app opens that dialog again. Read `actions` from the "
        "latest snapshot.",
    )


def require_trigger_key(trigger: Mapping[str, Any]) -> str:
    """Return a trigger's ``key``, refusing a trigger without a string one."""
    key = trigger.get("key")
    if not isinstance(key, str):
        raise AgentRequestError(
            "invalid_request",
            "`trigger` must be an object with a string `key`. To rerun "
            "without changing anything, send no `trigger` at all.",
        )
    return key


def build_widget_states(
    session_state: SessionState,
    *,
    widget_state: Mapping[str, Any] | None,
    trigger: Mapping[str, Any] | None,
    element_states: Mapping[str, ElementState],
    compile_error: bool = False,
) -> WidgetStates:
    """Validate a request's widget values and trigger, and encode both.

    Only the addressed widgets whose value changes are included, and the
    trigger. The runtime merges them into the session's current widget state
    and works out what changed, exactly as it does for a browser. A value equal
    to the stored one on the wire is left out: sent, a label that several
    options share would resolve to one of them, which need not be the option
    the widget holds, and flip it.

    Session state is read without the lock ``SafeSessionState`` takes, so call
    this while no run can start. Validation runs each addressed widget's
    deserializer and validator, which are widget code.

    Parameters
    ----------
    session_state : SessionState
        The session's state, read for widget metadata and the key-to-ID map.
    widget_state : Mapping[str, Any] or None
        The request's ``widget_state``: element key to JSON value.
    trigger : Mapping[str, Any] or None
        The request's ``trigger``: a ``key`` and an optional ``value``.
    element_states : Mapping[str, ElementState]
        The last snapshot's element states, keyed by element ID.
    compile_error : bool
        Whether the last snapshot's run failed to compile. A widget missing
        from ``element_states`` is then refused for that reason.

    Returns
    -------
    WidgetStates
        One ``WidgetState`` per addressed widget whose value changes, in the
        order of ``element_states``, with the trigger last.

    Raises
    ------
    AgentRequestError
        For the first key or value the request cannot carry, with the code
        naming why.
    """
    states = WidgetStates()
    addressed: set[str] = set()
    values: dict[str, WidgetState] = {}
    touched_forms: set[str] = set()

    for key, sent in (widget_state or {}).items():
        element_id = resolve_element_id(session_state, key, element_states)
        if element_id in addressed:
            # An authored key and its element ID name the same widget, and
            # which of the two values would win is not something to guess.
            raise AgentRequestError(
                "invalid_request",
                f"`widget_state` sets the element with key {key!r} twice, "
                "under its key and its element ID. Send one value.",
            )
        state, metadata = _require_actionable(
            session_state,
            element_id,
            key,
            element_states,
            compile_error=compile_error,
        )

        if state.action != "value":
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

        checked = _check_json_type(key, state, sent)
        value = _iso_text_to_wire(key, metadata, state.command, checked)
        wire_value = _temporal_to_wire(key, metadata, value)
        encoded = _encode(
            element_id,
            metadata,
            wire_value,
            key,
            # An option's reported value can be a number, such as
            # `st.feedback`'s index; free text cannot.
            closed_options=state.options is not None,
            clearable=state.clearable,
            as_list=state.schema_type == "array",
        )
        addressed.add(element_id)
        touched_forms.add(state.form_id or "")
        # Only a changed value is sent: resent, a label several options share
        # could resolve to another option than the one the widget holds.
        if _check_with_widget(
            session_state,
            metadata,
            encoded,
            _Sent(key, checked, as_numbers=state.schema_type in {"integer", "number"}),
        ):
            values[element_id] = encoded

    # Callbacks run in the order the states arrive, so they follow the order
    # the snapshot recorded the elements in, not the client's JSON key order.
    position = {element_id: index for index, element_id in enumerate(element_states)}
    states.widgets.extend(
        sorted(values.values(), key=lambda encoded: position[encoded.id])
    )

    submitted_form: str | None = None
    if trigger is not None:
        trigger_key = require_trigger_key(trigger)
        element_id = resolve_element_id(session_state, trigger_key, element_states)
        state, metadata = _require_actionable(
            session_state,
            element_id,
            trigger_key,
            element_states,
            compile_error=compile_error,
        )
        if state.action != "trigger":
            raise AgentRequestError(
                "not_a_trigger",
                f"The element with key {trigger_key!r} holds a value; set it "
                "through `widget_state` instead of firing it.",
            )

        payload = trigger.get("value")
        encoded_trigger = _encode_trigger(
            element_id,
            metadata.value_type,
            payload,
            trigger_key,
            options=state.options,
        )
        _check_with_widget(
            session_state,
            metadata,
            encoded_trigger,
            _Sent(trigger_key, payload, as_numbers=False),
        )
        states.widgets.append(encoded_trigger)
        submitted_form = state.form_id or ""
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


def resolve_fragment(
    session_state: SessionState,
    element_states: Mapping[str, ElementState],
    *,
    widget_state: Mapping[str, Any] | None,
    trigger: Mapping[str, Any] | None,
    has_fragment: Callable[[str], bool],
) -> str:
    """Return the fragment a request's rerun is scoped to, or "" for a full rerun.

    This mirrors the browser, where a widget carries the fragment ID of the
    node it was rendered in and sends it with its update, so only that fragment
    reruns. Scoping is not a nicety: a full rerun does not re-emit an
    ``st.dialog``, so driving a dialog at all depends on staying inside its
    fragment.

    The wire carries one fragment ID, so a batch spanning several regions
    becomes a full rerun, which runs every fragment. So does a request for a
    fragment the session no longer holds, which the runtime would ignore,
    dropping the write without a word. The exception is an open dialog: a full
    rerun closes it without running its contents, so what the request sent to
    the dialog would be silently discarded. That is refused.

    Call this after ``build_widget_states`` accepted the same request, so every
    key resolves and form errors take precedence.

    Parameters
    ----------
    session_state : SessionState
        The session's state, read for the key-to-ID mapping.
    element_states : Mapping[str, ElementState]
        The last snapshot's element states, keyed by element ID.
    widget_state : Mapping[str, Any] or None
        The request's ``widget_state``.
    trigger : Mapping[str, Any] or None
        The request's ``trigger``.
    has_fragment : Callable[[str], bool]
        Whether the session still holds a fragment, such as
        ``AppSession.has_fragment``.

    Returns
    -------
    str
        The fragment ID every addressed element shares, or "" for a full
        rerun: several regions, no fragment, or a fragment the session no
        longer holds outside an open dialog.

    Raises
    ------
    AgentRequestError
        ``cross_dialog_batch`` when an open dialog's widgets are mixed with
        anything outside them, and ``not_on_page`` when the session no longer
        holds the fragment of the dialog they are in.
    """
    targets = list(widget_state or {})
    if trigger is not None and isinstance(trigger.get("key"), str):
        targets.append(trigger["key"])

    fragments: set[str | None] = set()
    # The first key inside an open dialog, which a refusal names.
    dialog_key: str | None = None
    for key in targets:
        state = element_states.get(
            resolve_element_id(session_state, key, element_states)
        )
        fragments.add(state.fragment_id if state is not None else None)
        if dialog_key is None and state is not None and state.in_dialog:
            dialog_key = key

    if len(fragments) > 1:
        if dialog_key is not None:
            raise AgentRequestError(
                "cross_dialog_batch",
                "The request spans an open dialog and another region, such as a "
                "widget outside the dialog or in a fragment inside it. Covering "
                "both takes a full rerun, which closes the dialog and discards "
                "what was sent to it. Send each region's widgets on their own.",
            )
        return ""

    fragment_id = next(iter(fragments), None) or ""
    if not fragment_id or has_fragment(fragment_id):
        return fragment_id
    if dialog_key is not None:
        raise AgentRequestError(
            "not_on_page",
            f"The element with key {dialog_key!r} is in a dialog the app no "
            "longer holds, so only a full rerun could apply the request, and "
            "that closes the dialog and discards what was sent to it. Send a "
            "request with only `session_id` to read the current page.",
        )
    return ""


def _check_json_type(key: str, state: ElementState, value: Any) -> Any:
    """Refuse a value of the wrong JSON type for the element's `value_schema`.

    Returns the value in the form the remaining checks expect: a one-item list
    sent to a single-value element is unwrapped, and a whole float sent where
    the schema says integer becomes an int.
    """
    schema_type = state.schema_type
    if schema_type == "array":
        if value is not None and not isinstance(value, list):
            raise AgentRequestError(
                "invalid_value",
                f"{key!r} takes a list, as its `value_schema` says, even for a "
                "single item.",
            )
    elif isinstance(value, list) and schema_type is not None:
        # A widget that takes one value may carry it in a list on the wire,
        # and would read a longer list as no value and reset to its default.
        if len(value) != 1:
            raise AgentRequestError(
                "invalid_value",
                f"{key!r} takes one value, as its `value_schema` says, not a "
                "list. Send `null` to clear or reset it.",
            )
        value = value[0]

    if isinstance(value, list) and any(item is None for item in value):
        raise AgentRequestError(
            "invalid_value",
            f"{key!r} cannot hold null inside its list. Leave the item out instead.",
        )

    if schema_type in {"integer", "number", "string"} and isinstance(value, bool):
        what = "text" if schema_type == "string" else "a number"
        raise AgentRequestError(
            "invalid_value",
            f"{key!r} takes {what}, as its `value_schema` says, not true or false.",
        )
    if schema_type in {"integer", "number"} and isinstance(value, str):
        raise AgentRequestError(
            "invalid_value",
            f"{key!r} takes a number, as its `value_schema` says, not text.",
        )
    if schema_type == "integer" and isinstance(value, float) and value.is_integer():
        # JSON Schema counts 1.0 as an integer, and some JSON writers emit
        # whole numbers that way; `st.feedback` matches its index as text.
        value = int(value)
    return value


def _list_options(options: list[Any], *, as_numbers: bool) -> str:
    """The first options, as a request would send them, for an error message."""
    # Numbers are listed bare, so `st.feedback`'s indexes read as the numbers
    # a request sends rather than as text.
    listed = ", ".join(
        str(option) if as_numbers else repr(option)
        for option in options[:_MAX_LISTED_OPTIONS]
    )
    more = len(options) - _MAX_LISTED_OPTIONS
    return listed + (f", and {more} more." if more > 0 else ".")


def _parse_iso(value: Any) -> dt.date | dt.time | None:
    """The date, time, or datetime that ISO text denotes, or None."""
    if not isinstance(value, str):
        return None
    parsers: tuple[Any, ...] = (
        dt.date.fromisoformat,
        dt.datetime.fromisoformat,
        dt.time.fromisoformat,
    )
    for parse in parsers:
        try:
            parsed: dt.date | dt.time = parse(value)
            return parsed
        except ValueError:
            continue
    return None


def _temporal_to_wire(key: str, metadata: WidgetMetadata[Any], value: Any) -> Any:
    """Convert the ISO text a temporal slider reports into its wire microseconds.

    A date, time, or datetime slider is reported in ISO text but sends
    microseconds, and the widget's own serializer is what defines that mapping.
    It takes only ISO text: the microseconds are the wire's encoding, not a
    value a client was shown. Anything else passes through unchanged.
    """
    if metadata.value_type != "double_array_value" or value is None:
        return value
    # Only a temporal slider has a date, time, or datetime default, so the
    # default tells it apart from a numeric one.
    default = _slider_default(metadata)
    if not isinstance(default, (dt.date, dt.time)):
        return value
    items = value if isinstance(value, list) else [value]
    parsed = [_parse_iso(item) for item in items]
    if any(item is None for item in parsed):
        raise AgentRequestError(
            "invalid_value",
            f"The value for {key!r} must be ISO dates or times, like the "
            "snapshot reports.",
        )
    if isinstance(default, dt.datetime):
        # A date alone means its midnight, as `st.datetime_input` reads it, in
        # the slider's own time zone.
        parsed = [
            dt.datetime.combine(item, dt.time(), tzinfo=default.tzinfo)
            if isinstance(item, dt.date) and not isinstance(item, dt.datetime)
            else item
            for item in parsed
        ]
    elif isinstance(default, dt.date) and any(
        isinstance(item, dt.datetime) or not isinstance(item, dt.date)
        for item in parsed
    ):
        # The serializer keeps only the date of a datetime, so a time of day
        # would be dropped while the request succeeded.
        raise AgentRequestError(
            "invalid_value",
            f"The value for {key!r} must be ISO dates without a time, like the "
            "snapshot reports.",
        )
    _check_slider_offsets(key, parsed, own_tz=getattr(default, "tzinfo", None))
    try:
        return metadata.serializer(parsed if isinstance(value, list) else parsed[0])
    except Exception as exc:
        raise _not_accepted(key) from exc


def _iso_text_to_wire(
    key: str, metadata: WidgetMetadata[Any], command: str, value: Any
) -> Any:
    """Turn any ISO 8601 form into the one layout a date-time or time input reads.

    `st.datetime_input` reads only `YYYY-MM-DDTHH:MM` and `st.time_input` only
    `HH:MM` or `HH:MM:SS`, and each replaces anything else with its default
    without an error. So a value with seconds, a fraction, or a space would
    change nothing while the request succeeded. The widget's own serializer
    writes the layout it reads. These widgets hold no offset, so a value with
    one is refused rather than converted to some time zone.
    """
    kind = _ISO_TEXT_INPUTS.get(command)
    if kind is None or not isinstance(value, str):
        return value
    what = "date and time" if kind is dt.datetime else "time"
    try:
        parsed: dt.datetime | dt.time = kind.fromisoformat(value)
    except ValueError as exc:
        raise AgentRequestError(
            "invalid_value",
            f"The value for {key!r} is not an ISO 8601 {what}, such as the "
            "snapshot reports.",
        ) from exc
    if parsed.tzinfo is not None:
        raise AgentRequestError(
            "invalid_value",
            f"The value for {key!r} has an offset, which this widget cannot "
            f"hold. Send the {what} without one, like the snapshot reports.",
        )
    try:
        return metadata.serializer(parsed)
    except Exception as exc:  # pragma: no cover - defensive
        raise _not_accepted(key) from exc


def _slider_default(metadata: WidgetMetadata[Any]) -> Any:
    """A slider's default value, or its first one for a range."""
    try:
        default = metadata.deserializer(None)
    except Exception:
        return None
    if isinstance(default, (list, tuple)):
        default = default[0] if default else None
    return default


def _check_slider_offsets(
    key: str, items: list[Any], *, own_tz: dt.tzinfo | None
) -> None:
    """Refuse an offset a temporal slider would drop.

    The slider keeps a value's wall time and puts its own time zone on it, so an
    offset it does not have would silently move the value.
    """
    for item in items:
        sent = item.utcoffset() if getattr(item, "tzinfo", None) else None
        if sent is None:
            continue
        if own_tz is None:
            raise AgentRequestError(
                "invalid_value",
                f"The value for {key!r} has an offset, which this widget cannot "
                "hold. Send it without one, like the snapshot reports.",
            )
        if item.replace(tzinfo=own_tz).utcoffset() != sent:
            raise AgentRequestError(
                "invalid_value",
                f"The value for {key!r} has an offset other than its time "
                "zone's. Send it like the snapshot reports.",
            )


def _default_is_empty(metadata: WidgetMetadata[Any]) -> bool:
    """Whether the widget's default, what an unset value reads as, is empty.

    Relies on the serde contract that ``None`` means "use the default". A
    deserializer that cannot read ``None`` is treated as having a value, so
    the empty form the browser sends is encoded and checked instead.
    """
    try:
        default = metadata.deserializer(None)
    except Exception:
        return False
    return default is None or (isinstance(default, (list, tuple)) and not default)


def _encode(
    element_id: str,
    metadata: WidgetMetadata[Any],
    value: Any,
    key: str,
    *,
    closed_options: bool,
    clearable: bool,
    as_list: bool,
) -> WidgetState:
    """Write a JSON value into the ``WidgetState`` arm the widget registered.

    ``key`` is what the client sent and is used in errors, so a message never
    quotes an internal element ID back at a caller that used an authored key.
    Errors name the expected type rather than quote the value, which may be a
    password.

    A list wire carries a single value as a one-item list, as single-select
    button groups and single sliders do. ``closed_options`` says whether the
    element has a closed list of options, whose labels a JSON number can name.
    """
    value_type = metadata.value_type
    state = WidgetState()
    state.id = element_id

    if value is None:
        # An unset value means "use the default" to every widget, which is what
        # `null` does unless a browser user can empty the widget. Then it gets
        # the form that browser sends, unless the default is already empty: an
        # empty string would read back as "" for `st.selectbox(index=None)`.
        if clearable and not _default_is_empty(metadata):
            if is_array_value_field_name(value_type):
                getattr(state, value_type).SetInParent()
            elif value_type == "string_value":
                state.string_value = ""
        return state

    try:
        if value_type == "bool_value":
            state.bool_value = _as_bool(value)
        elif value_type == "double_value":
            state.double_value = _as_number(value)
        elif value_type == "int_value":
            state.int_value = _as_integer(value)
        elif value_type == "string_value":
            state.string_value = _as_string(value, closed_options=closed_options)
        elif value_type == "json_value":
            state.json_value = json.dumps(value)
        elif is_array_value_field_name(value_type):
            items = value if isinstance(value, list) else [value]
            array = getattr(state, value_type)
            if value_type == "string_array_value":
                array.data.extend(
                    _as_string(item, closed_options=closed_options) for item in items
                )
            elif value_type == "double_array_value":
                array.data.extend(_as_number(item) for item in items)
            else:
                array.data.extend(_as_integer(item) for item in items)
        else:  # pragma: no cover - guarded by the action and _UNSETTABLE_VALUE_TYPES
            raise AgentRequestError(
                "unsupported_element",
                f"Values of type {value_type} cannot be set through this interface.",
            )
    except (TypeError, ValueError, OverflowError) as exc:
        # OverflowError: an integer too large to become a float. ValueError:
        # one too large for an int64 field.
        expected = (_EXPECTED_LIST if as_list else _EXPECTED_SINGLE).get(
            value_type, "JSON"
        )
        raise AgentRequestError(
            "invalid_value", f"The value for {key!r} must be {expected}."
        ) from exc

    return state


def _encode_trigger(
    element_id: str,
    value_type: ValueFieldName,
    payload: Any,
    key: str,
    *,
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
                f"The element with key {key!r} takes no trigger `value`.",
            )
        state.trigger_value = True
    elif value_type == "string_trigger_value":
        # A trigger that chooses among options (`st.menu_button`) is checked
        # by the widget's validator, like a selection widget: firing it with
        # something it never offered is a client mistake, not a no-op rerun.
        if not isinstance(payload, str):
            raise AgentRequestError(
                "invalid_value",
                f"The element with key {key!r} is fired with a string `value`"
                + (
                    ", one of its options: " + _list_options(options, as_numbers=False)
                    if options
                    else "."
                ),
            )
        state.string_trigger_value.data = payload
    elif value_type == "json_trigger_value":
        try:
            state.json_trigger_value = json.dumps(payload)
        except (TypeError, ValueError) as exc:  # pragma: no cover - defensive
            raise AgentRequestError(
                "invalid_value",
                f"The trigger `value` for {key!r} is not JSON-serializable.",
            ) from exc
    elif value_type == "chat_input_value":
        if not isinstance(payload, str):
            raise AgentRequestError(
                "invalid_value",
                f"The element with key {key!r} is fired with a string `value`, "
                "the text to submit.",
            )
        # Empty text is accepted although the browser keeps send disabled
        # without it. `st.chat_input` has no `required` to refuse it.
        state.chat_input_value.data = payload
    else:  # pragma: no cover - a trigger's description matches its wire type
        raise AgentRequestError("not_a_trigger", f"{key!r} is not a trigger.")

    return state


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    # The message never quotes the value, which may be a password.
    raise TypeError("not a boolean")


def _as_number(value: Any) -> float:
    """A finite JSON number, refusing what ``float()`` would quietly accept.

    ``true`` would become 1 and a numeric string would parse, and ``NaN``,
    which Python's JSON parser accepts, would reach the app.
    """
    if not _is_json_number(value) or not math.isfinite(value):
        raise TypeError("not a finite number")
    return float(value)


def _as_integer(value: Any) -> int:
    if not float(_as_number(value)).is_integer():
        raise TypeError("not a whole number")
    return int(value)


def _as_string(value: Any, *, closed_options: bool) -> str:
    """Coerce a JSON value into the widget's wire string.

    A number becomes text only for a widget with a closed list of options,
    such as `st.feedback`'s indexes, where the widget's validator decides
    whether it names one. Free text, including a widget that accepts new
    options, takes no number.
    """
    if isinstance(value, str):
        return value
    if _is_json_number(value) and closed_options:
        return str(value)
    raise TypeError("not a string")


def _is_json_number(value: Any) -> bool:
    # bool is an int subclass, but `true` is not a JSON number.
    return isinstance(value, (int, float)) and not isinstance(value, bool)
