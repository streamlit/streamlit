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

"""Check a widget value a client sent before the session acts on it.

A browser and the agent API both send ``WidgetState`` protos. Each one is
checked once, when it enters the session and before any callback runs, against
the metadata of the run that rendered the widget. ``check_client_value``
reports a violation and never acts on it: a browser session drops the value
(``SessionState``), and the agent API refuses the request.

The checks run in this order, and the first violation wins:

1. The wire field is one the widget accepts (``wrong_type``).
2. The widget's deserializer can read the value (``unreadable``).
3. An unchanged value passes.
4. The widget is not disabled (``disabled``).
5. The widget's own validator, ``WidgetMetadata.validator``.

Validators share small helpers, such as ``one_of`` and ``items_of`` for a
widget with a closed set of options.
"""

from __future__ import annotations

import traceback
from collections import Counter
from types import MappingProxyType
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Literal,
    NamedTuple,
    TypeAlias,
    TypeGuard,
    get_args,
)

from streamlit import config
from streamlit.logger import get_logger
from streamlit.runtime.state.common import ValueFieldName, unpack_widget_state_value

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence

    from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
    from streamlit.runtime.state.common import WidgetMetadata

_LOGGER: Final = get_logger(__name__)

ViolationKind: TypeAlias = Literal[
    # The value arrived in a wire field the widget does not read.
    "wrong_type",
    # Unpacking the value or running the widget's deserializer raised.
    "unreadable",
    # The widget was disabled in the run the client was shown.
    "disabled",
    # The value is not one of the widget's options.
    "not_an_option",
    # The value has more items than the widget allows, such as more than a
    # multiselect's `max_selections`.
    "too_many_items",
    # The value lists an option more often than the widget offers it.
    "duplicate_items",
    # The value is a label that several options show, so it does not say which
    # option it means. A browser sends a shared label as shown, and the widget
    # resolves it, so only the agent API refuses it.
    "ambiguous_option",
]


class Violation(NamedTuple):
    """Why a client value is refused."""

    kind: ViolationKind
    # Facts that explain the refusal, such as the accepted fields or the
    # options. Never the sent value, which may be a password. The default is
    # read-only because every Violation shares it.
    detail: Mapping[str, Any] = MappingProxyType({})


class CheckResult(NamedTuple):
    """What ``check_client_value`` found for one ``WidgetState``."""

    violation: Violation | None
    # The deserialized value, once the deserializer has read it.
    value: Any = None
    # Whether the value differs from the stored one. Always False for a value
    # a browser session drops.
    changed: bool = False


# An int field and a double field accept each other, and so do the two numeric
# array fields. A double holds every integer within ±2**53 exactly.
_NUMERIC_PAIRS: Final[Mapping[ValueFieldName, ValueFieldName]] = {
    "int_value": "double_value",
    "double_value": "int_value",
    "int_array_value": "double_array_value",
    "double_array_value": "int_array_value",
}
_MAX_EXACT_INTEGER: Final = 2**53

# The wire fields each registered value type accepts.
_DEFAULT_FIELDS: Final[Mapping[ValueFieldName, frozenset[ValueFieldName]]] = {
    value_type: frozenset({value_type, _NUMERIC_PAIRS[value_type]})
    if value_type in _NUMERIC_PAIRS
    else frozenset({value_type})
    for value_type in get_args(ValueFieldName)
}

# Kinds a correct browser can cause in a sync race, such as a rerun that
# disables a widget, or changes its options, just before the user's change
# arrives. They are logged at debug level.
_RACE_KINDS: Final[frozenset[ViolationKind]] = frozenset(
    {"disabled", "not_an_option", "too_many_items"}
)

# A single label needs no position, so `one_of`'s reports share one Violation.
_AMBIGUOUS: Final = Violation("ambiguous_option")

# The fixed text that starts every refusal log line. The e2e parity gate looks
# for it in the server output.
REFUSAL_LOG_MARKER: Final = "Refused a client value for widget"

_EXPLANATIONS: Final[Mapping[ViolationKind, str]] = {
    "wrong_type": (
        "It arrived in a wire field this widget does not read. The Streamlit "
        "frontend never sends that, so the message was forged or came from a "
        "different frontend version."
    ),
    "unreadable": (
        "The widget could not read it. The Streamlit frontend never sends "
        "that, so the message was forged or came from a different frontend "
        "version."
    ),
    "disabled": "The widget was disabled when the client sent it.",
    "not_an_option": (
        "It is not one of the widget's options. A rerun can change the options "
        "just before a user's change arrives."
    ),
    "too_many_items": (
        "It has more items than the widget allows. A rerun can change the "
        "widget just before a user's change arrives."
    ),
    "duplicate_items": (
        "It lists an option more often than the widget offers it. The Streamlit "
        "frontend never sends that, so the message was forged or came from a "
        "different frontend version."
    ),
    "ambiguous_option": (
        "Several options show its label, so it does not say which option it means."
    ),
}


def accepted_value_fields(metadata: WidgetMetadata[Any]) -> frozenset[ValueFieldName]:
    """Return the wire fields a widget accepts from a client.

    These are the fields the frontend sends for the widget, which for most
    widgets is the ``value_type`` it registered. A widget can override them
    with ``WidgetMetadata.accepted_value_fields``.
    """
    if metadata.accepted_value_fields is not None:
        return metadata.accepted_value_fields
    return _DEFAULT_FIELDS.get(metadata.value_type) or frozenset({metadata.value_type})


def browser_refuses(violation: Violation | None) -> TypeGuard[Violation]:
    """Whether a browser session drops a value with ``violation``.

    A browser sends a label that several options share as shown, and the
    widget resolves it, so a browser session accepts ``ambiguous_option``. The
    agent API refuses every violation.
    """
    return violation is not None and violation.kind != "ambiguous_option"


def one_of(
    counts: Mapping[str, int], value: str, *, accept_new: bool = False
) -> Violation | None:
    """Check one label against the labels a widget shows.

    Parameters
    ----------
    counts : Mapping[str, int]
        How many options show each label, such as a ``Counter`` of the
        formatted options.
    value : str
        The label the client sent.
    accept_new : bool
        Whether the widget accepts new options, as ``accept_new_options``
        does. Then any non-empty text is legal, a shared label included.

    Returns
    -------
    Violation or None
        ``not_an_option`` with the ``options``, ``ambiguous_option`` for a
        label several options share, or ``None``.
    """
    offered = counts.get(value, 0)
    if offered == 0:
        if accept_new and value != "":
            return None
        return Violation("not_an_option", MappingProxyType({"options": tuple(counts)}))
    if offered > 1 and not accept_new:
        return _AMBIGUOUS
    return None


def items_of(
    counts: Mapping[str, int],
    values: Sequence[str],
    *,
    max_items: int | None = None,
    unique: bool = True,
    accept_new: bool = False,
) -> Violation | None:
    """Check a list of labels against the labels a widget shows.

    A label that several options share may be listed as often as they share
    it, as a multiselect's "Select all" does. That is ``ambiguous_option``,
    which is reported only when nothing else is wrong.

    Parameters
    ----------
    counts : Mapping[str, int]
        How many options show each label, such as a ``Counter`` of the
        formatted options.
    values : Sequence[str]
        The labels the client sent.
    max_items : int or None
        The most labels the widget takes, or ``None`` for no limit.
    unique : bool
        Whether each option can be listed once. A range, such as a
        ``select_slider``'s, may list one twice.
    accept_new : bool
        Whether the widget accepts new options, as ``accept_new_options``
        does. Then any non-empty text is legal, a shared label included, and a
        new label can be listed once.

    Returns
    -------
    Violation or None
        The first of these, or ``None``: ``too_many_items`` with
        ``max_items``; ``not_an_option`` with the ``options`` and the
        ``positions`` of the labels that are not options; ``duplicate_items``
        with the ``positions`` of the first extra repeat; and
        ``ambiguous_option`` with the ``positions`` of the first shared label.
        A detail never holds a sent label.
    """
    if max_items is not None and len(values) > max_items:
        return Violation("too_many_items", MappingProxyType({"max_items": max_items}))
    missing: list[int] = []
    duplicate: int | None = None
    ambiguous: int | None = None
    listed: Counter[str] = Counter()
    for position, item in enumerate(values):
        offered = counts.get(item, 0)
        if offered == 0 and not (accept_new and item != ""):
            missing.append(position)
            continue
        if unique:
            listed[item] += 1
            # A new label counts as offered once, by the user who typed it.
            if listed[item] > max(offered, 1):
                if duplicate is None:
                    duplicate = position
                continue
        if offered > 1 and not accept_new and ambiguous is None:
            ambiguous = position
    if missing:
        return Violation(
            "not_an_option",
            MappingProxyType({"options": tuple(counts), "positions": tuple(missing)}),
        )
    if duplicate is not None:
        return Violation(
            "duplicate_items", MappingProxyType({"positions": (duplicate,)})
        )
    if ambiguous is not None:
        return Violation(
            "ambiguous_option", MappingProxyType({"positions": (ambiguous,)})
        )
    return None


def check_client_value(
    state: WidgetStateProto,
    *,
    metadata: WidgetMetadata[Any],
    previous: Any,
    compare_wire: bool = False,
    stored_state: WidgetStateProto | None = None,
) -> CheckResult:
    """Check one ``WidgetState`` a client sent against a widget's metadata.

    Never raises. A validator that raises is logged and refuses the value as
    ``unreadable``.

    Parameters
    ----------
    state : WidgetState
        The state the client sent.
    metadata : WidgetMetadata
        The metadata of the run that rendered the widget.
    previous : Any
        The widget's stored value, deserialized.
    compare_wire : bool
        How an unchanged value is recognized. ``False`` compares the
        deserialized value with ``previous``, which a browser session uses.
        ``True`` compares ``state`` with ``stored_state`` on the wire, which is
        stricter: a value the deserializer converts onto the stored one, such
        as ``2.5`` for an integer input holding ``2``, still reaches the
        validator. The agent API uses it.
    stored_state : WidgetState or None
        The stored value in its wire form, for ``compare_wire``. ``None`` means
        there is none, so the value always counts as changed.

    Returns
    -------
    CheckResult
        The first violation, or ``None``, with the deserialized value once the
        deserializer has read it.
    """
    # The wire field. No field at all is the cleared form, which every
    # widget accepts and reads as None.
    field = state.WhichOneof("value")
    if field is not None:
        fields = accepted_value_fields(metadata)
        if field not in fields or (
            field != metadata.value_type
            and field in _NUMERIC_PAIRS
            and not _within_double_precision(state, field)
        ):
            return CheckResult(
                Violation("wrong_type", MappingProxyType({"expected": sorted(fields)}))
            )

    # The deserializer reads the value. Any exception counts, such as
    # a JSON parse error or an upload with a disallowed file name.
    try:
        ui_value = unpack_widget_state_value(state)
        value = metadata.deserializer(ui_value)
    except Exception:
        return CheckResult(Violation("unreadable"))

    # An unchanged value passes. An active trigger always differs,
    # because the stored trigger was reset before the client's states arrived.
    if compare_wire:
        if stored_state is not None and _wire_equal(state, stored_state):
            return CheckResult(None, value)
    elif _unchanged(value, previous):
        return CheckResult(None, value)

    # A disabled widget accepts no client input. The metadata is from the run
    # the client was shown, so a widget that disables itself in the callback
    # its own click runs keeps the click.
    if metadata.disabled:
        return CheckResult(Violation("disabled"), value)

    # The widget's own rules.
    violation: Violation | None = None
    validator = metadata.validator
    if validator is not None:
        try:
            violation = validator(ui_value, previous=previous, value=value)
        except Exception as exc:
            # The message is left out: it may quote the value.
            frame = traceback.extract_tb(exc.__traceback__)[-1]
            _LOGGER.warning(
                "The validator of widget %s raised %s (%s:%s), so its value was "
                "refused. This is a bug in Streamlit; please report it.",
                metadata.id,
                type(exc).__name__,
                frame.filename,
                frame.lineno,
            )
            return CheckResult(Violation("unreadable"), value)
    return CheckResult(violation, value, changed=not browser_refuses(violation))


def log_violation(widget_id: str, violation: Violation, *, warned: set[str]) -> None:
    """Log a value a browser session dropped, without the value itself.

    A kind a correct browser can cause in a sync race is logged at debug level.
    Any other kind is logged at warning level, once per widget in ``warned``,
    which the caller keeps per session. Under ``global.e2eTest`` every refusal
    is logged at warning level and never deduplicated, so the e2e parity gate
    sees each one.

    Parameters
    ----------
    widget_id : str
        The widget the value was sent for.
    violation : Violation
        Why the value was dropped.
    warned : set of str
        The widgets this session already warned about. It is updated in place.
    """
    is_e2e_test = bool(config.get_option("global.e2eTest"))
    if is_e2e_test:
        level = "warning"
    elif violation.kind in _RACE_KINDS:
        level = "debug"
    elif widget_id in warned:
        return
    else:
        warned.add(widget_id)
        level = "warning"
    log = _LOGGER.warning if level == "warning" else _LOGGER.debug
    log(
        "%s %s (%s). %s The value was dropped.",
        REFUSAL_LOG_MARKER,
        widget_id,
        violation.kind,
        _EXPLANATIONS[violation.kind],
    )


def _within_double_precision(state: WidgetStateProto, field: str) -> bool:
    """Whether a numeric field converts to its paired field without loss."""
    value = getattr(state, field)
    items = value.data if field.endswith("_array_value") else (value,)
    # NaN fails every comparison, so it is refused too.
    return all(-_MAX_EXACT_INTEGER <= item <= _MAX_EXACT_INTEGER for item in items)


def _unchanged(value: Any, previous: Any) -> bool:
    """Whether a deserialized value equals the stored one.

    A comparison that raises, such as one between two arrays, counts as a
    change.
    """
    try:
        return not bool(value != previous)
    except Exception:
        return False


def _wire_equal(sent: WidgetStateProto, stored: WidgetStateProto) -> bool:
    """Whether two states carry the same value on the wire.

    A missing value field and an empty array both mean empty, so they are equal.
    """
    sent_field = sent.WhichOneof("value")
    stored_field = stored.WhichOneof("value")
    if _is_empty_wire(sent, sent_field) and _is_empty_wire(stored, stored_field):
        return True
    if sent_field != stored_field or sent_field is None:
        return False
    return bool(getattr(sent, sent_field) == getattr(stored, sent_field))


def _is_empty_wire(state: WidgetStateProto, field: str | None) -> bool:
    if field is None:
        return True
    return field.endswith("_array_value") and not getattr(state, field).data
