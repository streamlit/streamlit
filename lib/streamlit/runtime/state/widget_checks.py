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
4. The latest run that covered the widget rendered it (``not_rendered``).
5. The widget is not disabled (``disabled``).
6. The widget's own validator, ``WidgetMetadata.validator``.

Validators share small helpers, such as ``one_of`` and ``items_of`` for a
widget with a closed set of options, ``within`` for bounds, ``iso_date`` for the
layouts the browser sends, ``text_length`` for ``max_chars``, and ``filled`` for
``required``.
"""

from __future__ import annotations

import datetime as dt
import math
import re
import traceback
from collections import Counter
from collections.abc import Sized
from itertools import pairwise
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
    from collections.abc import Collection, Mapping, Sequence

    from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
    from streamlit.runtime.state.common import WidgetMetadata

_LOGGER: Final = get_logger(__name__)

ViolationKind: TypeAlias = Literal[
    # The value arrived in a wire field the widget does not read.
    "wrong_type",
    # Unpacking the value or running the widget's deserializer raised.
    "unreadable",
    # The latest run that covered the widget did not render it, such as a
    # button behind a condition that is now false, or on another page.
    "not_rendered",
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
    # The value is outside the widget's bounds, such as a number above
    # `max_value` or a date before `min_value`.
    "out_of_range",
    # The value has the wrong number of items, such as one end of a range, or
    # the ends of a range are reversed.
    "bad_shape",
    # The value is not in a form the widget's frontend sends, such as a
    # fraction for a whole number or a date that is not YYYY-MM-DD.
    "malformed",
    # The text is longer than the widget's `max_chars`.
    "too_long",
    # The value empties a `required` widget.
    "empty_required",
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
# arrives. They are logged at debug level. `too_long` is not one of them:
# `max_chars` is part of a keyed widget's identity, so a rerun that changes it
# gives the widget a new ID.
_RACE_KINDS: Final[frozenset[ViolationKind]] = frozenset(
    {
        "not_rendered",
        "disabled",
        "not_an_option",
        "too_many_items",
        "out_of_range",
        "empty_required",
    }
)

# A single label needs no position, so `one_of`'s reports share one Violation.
_AMBIGUOUS: Final = Violation("ambiguous_option")


def _malformed(expected: str) -> Violation:
    return Violation("malformed", MappingProxyType({"expected": expected}))


# Reports that carry no fact about the widget share one Violation each. Their
# `expected` says what the widget takes, never what was sent.
_NOT_FINITE: Final = _malformed("a finite number")
_NOT_WHOLE: Final = _malformed("a whole number")
_NOT_ISO_DATE: Final = _malformed("a date as YYYY-MM-DD")
_NOT_ISO_TIME: Final = _malformed("a time as HH:MM or HH:MM:SS")
_NOT_ISO_DATETIME: Final = _malformed("a date and time as YYYY-MM-DDTHH:MM")
_NOT_HEX_COLOR: Final = _malformed("a hex color as #rgb or #rrggbb")
_UNORDERED: Final = Violation("bad_shape", MappingProxyType({"order": True}))
_EMPTY_REQUIRED: Final = Violation("empty_required")
_UNREADABLE: Final = Violation("unreadable")
_NOT_RENDERED: Final = Violation("not_rendered")
_DISABLED: Final = Violation("disabled")

# The characters JavaScript's `String.prototype.trim()` removes, which is how
# the browser decides that text is empty. Python's `str.strip()` also removes
# U+001C to U+001F and U+0085, which the browser keeps, and keeps U+FEFF, which
# the browser removes, so it would refuse text the browser accepts.
_ECMASCRIPT_WHITESPACE: Final = (
    "\t\n\v\f\r \u00a0\u1680"
    "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a"
    "\u2028\u2029\u202f\u205f\u3000\ufeff"
)

# The layouts the browser sends. `[0-9]` rather than `\d`, which also matches
# the digits of other scripts. Each is matched in full, so a trailing newline
# is refused too.
_ISO_DATE: Final = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
_ISO_TIME: Final = re.compile(r"[0-9]{2}:[0-9]{2}(?::[0-9]{2})?")
_ISO_DATETIME_MINUTES: Final = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}"
)
_HEX_COLOR: Final = re.compile(r"#(?:[0-9a-fA-F]{3}){1,2}")

# The fixed text that starts every refusal log line. The e2e parity gate looks
# for it in the server output.
REFUSAL_LOG_MARKER: Final = "Refused a client value for widget"

# Ends the explanation of a kind that a correct browser never causes.
_NEVER_SENT: Final = (
    "The Streamlit frontend never sends that, so the message was forged or came "
    "from a different frontend version."
)

_EXPLANATIONS: Final[Mapping[ViolationKind, str]] = {
    "wrong_type": (
        f"It arrived in a wire field this widget does not read. {_NEVER_SENT}"
    ),
    "unreadable": f"The widget could not read it. {_NEVER_SENT}",
    "not_rendered": (
        "The latest run that covered the widget did not render it. A rerun can "
        "hide a widget just before a user's change arrives."
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
        f"It lists an option more often than the widget offers it. {_NEVER_SENT}"
    ),
    "ambiguous_option": (
        "Several options show its label, so it does not say which option it means."
    ),
    "out_of_range": (
        "It is outside the widget's bounds. A rerun can change the bounds just "
        "before a user's change arrives."
    ),
    "bad_shape": (
        "It has the wrong number of items, or the ends of its range are "
        f"reversed. {_NEVER_SENT}"
    ),
    "malformed": f"It is not in a form the widget's frontend sends. {_NEVER_SENT}",
    "too_long": (
        "It is longer than the widget's max_chars. The Streamlit frontend stops "
        "input at that length."
    ),
    "empty_required": (
        "It empties a required widget. A rerun can make a widget required just "
        "before a user's change arrives."
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
    held: Mapping[str, int] | None = None,
) -> Violation | None:
    """Check a list of labels against the labels a widget shows.

    A label that several options share may be listed as often as they share
    it, as a multiselect's "Select all" does. That is ``ambiguous_option``,
    which is reported only when nothing else is wrong. A label may also be
    listed as often as the held value lists it.

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
    held : Mapping[str, int] or None
        How often the widget's held value lists each label, for a value that
        repeats one, such as an author's ``default=["a", "a"]``. The browser
        keeps those repeats when the user adds an option, but never adds one.

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
            allowed = max(offered, 1, held.get(item, 0) if held else 0)
            if listed[item] > allowed:
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


def within(value: Any, min_value: Any, max_value: Any) -> Violation | None:
    """Check a value against a widget's bounds, which are inclusive.

    Parameters
    ----------
    value : Any
        The value the client sent, such as a number or a date.
    min_value, max_value : Any
        The widget's bounds, or ``None`` for no bound.

    Returns
    -------
    Violation or None
        ``out_of_range`` with the ``min_value`` and ``max_value``, or ``None``.
        A value that compares with nothing, such as NaN, is out of range.
    """
    if (min_value is None or min_value <= value) and (
        max_value is None or value <= max_value
    ):
        return None
    return Violation(
        "out_of_range",
        MappingProxyType({"min_value": min_value, "max_value": max_value}),
    )


def finite(value: float) -> Violation | None:
    """Refuse NaN and infinity as ``malformed``."""
    return None if math.isfinite(value) else _NOT_FINITE


def whole_number(value: float) -> Violation | None:
    """Refuse a number with a fraction, NaN, or infinity as ``malformed``.

    A widget that holds whole numbers can still receive a ``double_value``,
    because the int and double fields accept each other.
    """
    if isinstance(value, int) or float(value).is_integer():
        return None
    return _NOT_WHOLE


def item_count(values: Sized, *, allowed: Collection[int]) -> Violation | None:
    """Check how many items a value has.

    Returns
    -------
    Violation or None
        ``bad_shape`` with the allowed ``item_counts`` in order, or ``None``.
    """
    if len(values) in allowed:
        return None
    return Violation(
        "bad_shape", MappingProxyType({"item_counts": tuple(sorted(allowed))})
    )


def ordered(values: Sequence[Any]) -> Violation | None:
    """Check that a range lists its lower end first.

    Equal ends are ordered, as in an empty range.

    Returns
    -------
    Violation or None
        ``bad_shape`` with ``order`` set, or ``None``.
    """
    if all(low <= high for low, high in pairwise(values)):
        return None
    return _UNORDERED


def iso_date(text: str) -> dt.date | Violation:
    """Read a date in the one layout the browser sends, ``YYYY-MM-DD``.

    Returns
    -------
    date or Violation
        The date, or ``malformed``.
    """
    if _ISO_DATE.fullmatch(text):
        try:
            return dt.date.fromisoformat(text)
        except ValueError:
            pass
    return _NOT_ISO_DATE


def iso_time(text: str) -> dt.time | Violation:
    """Read a time in a layout the browser sends, ``HH:MM`` or ``HH:MM:SS``.

    The browser adds the seconds when ``step`` is not a whole number of
    minutes. Either layout is accepted for any ``step``.

    Returns
    -------
    time or Violation
        The time, or ``malformed``.
    """
    if _ISO_TIME.fullmatch(text):
        try:
            return dt.time.fromisoformat(text)
        except ValueError:
            pass
    return _NOT_ISO_TIME


def iso_datetime_minutes(text: str) -> dt.datetime | Violation:
    """Read a date and time in the layout the browser sends, ``YYYY-MM-DDTHH:MM``.

    Returns
    -------
    datetime or Violation
        The naive datetime, or ``malformed``.
    """
    if _ISO_DATETIME_MINUTES.fullmatch(text):
        try:
            return dt.datetime.fromisoformat(text)
        except ValueError:
            pass
    return _NOT_ISO_DATETIME


def hex_color(text: str) -> Violation | None:
    """Check a hex color, ``#rgb`` or ``#rrggbb`` in either case.

    Returns
    -------
    Violation or None
        ``malformed``, or ``None``.
    """
    return None if _HEX_COLOR.fullmatch(text) else _NOT_HEX_COLOR


def utf16_length(text: str) -> int:
    """The length of ``text`` as a browser counts it, in UTF-16 code units.

    A character outside the Basic Multilingual Plane, such as most emoji,
    counts as two.
    """
    return len(text.encode("utf-16-le", "surrogatepass")) // 2


def text_length(text: str, max_chars: int | None) -> Violation | None:
    """Check text against a widget's ``max_chars``, counted as a browser counts it.

    Parameters
    ----------
    text : str
        The text the client sent.
    max_chars : int or None
        The most UTF-16 code units the widget takes. ``0`` or ``None`` means
        no limit, as in the browser.

    Returns
    -------
    Violation or None
        ``too_long`` with ``max_chars``, or ``None``.
    """
    # No character takes more than two code units, so short text needs no count.
    if not max_chars or len(text) * 2 <= max_chars:
        return None
    if utf16_length(text) <= max_chars:
        return None
    return Violation("too_long", MappingProxyType({"max_chars": max_chars}))


def truncate_utf16(text: str, max_chars: int) -> str:
    """Cut text to at most ``max_chars`` UTF-16 code units.

    A character is never split, so the result is valid text that
    ``text_length`` accepts.
    """
    units = 0
    for index, char in enumerate(text):
        units += 2 if ord(char) > 0xFFFF else 1
        if units > max_chars:
            return text[:index]
    return text


def browser_trim(text: str) -> str:
    """Remove whitespace from both ends of text, as JavaScript's ``trim()`` does."""
    return text.strip(_ECMASCRIPT_WHITESPACE)


def is_empty(value: Any) -> bool:
    """Whether a value is empty as a ``required`` widget counts it.

    ``None``, an empty list, tuple, or protobuf array, and text of only
    whitespace are empty. Whitespace is what the browser's ``trim()`` removes,
    so text the browser lets a user submit is never empty here.
    """
    if value is None:
        return True
    if isinstance(value, str):
        return not browser_trim(value)
    if isinstance(value, Sized):
        return len(value) == 0
    return False


def filled(value: Any, *, required: bool) -> Violation | None:
    """Refuse an empty value for a required widget.

    A validator sees only changed values, so this refuses a change to empty.
    An untouched required widget keeps its empty default, as in the browser.

    Returns
    -------
    Violation or None
        ``empty_required``, or ``None``.
    """
    return _EMPTY_REQUIRED if required and is_empty(value) else None


def check_client_value(
    state: WidgetStateProto,
    *,
    metadata: WidgetMetadata[Any],
    previous: Any,
    is_rendered: bool,
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
    is_rendered : bool
        Whether the latest run that covered the widget registered it. A widget
        registering in the current run is rendered.
    compare_wire : bool
        How an unchanged value is recognized. ``False`` compares the
        deserialized value with ``previous``, which a browser session uses.
        ``True`` compares ``state`` with ``stored_state`` on the wire, which is
        stricter: a value the deserializer converts onto the stored one, such
        as ``2.5`` for an integer input holding ``2``, still reaches the
        validator. A ``state`` with no value field reads as the default
        without a conversion, so it is compared deserialized either way.
        ``True`` also asks the validator for the author's constraints as
        written (``exact``), without the allowance a browser needs for its
        rounding. The agent API uses it.
    stored_state : WidgetState or None
        The stored value in its wire form, for ``compare_wire``. ``None`` means
        there is none, so a value with a field always counts as changed.

    Returns
    -------
    CheckResult
        The first violation, or ``None``, with the deserialized value once the
        deserializer has read it.
    """
    # The wire field. No field at all is the unset form, which every widget
    # accepts.
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
        return CheckResult(_UNREADABLE)

    # An unchanged value passes. An active trigger always differs,
    # because the stored trigger was reset before the client's states arrived.
    # A state without a value field is the unset form, which reads as the
    # default without a conversion, so the wire comparison does not apply.
    if compare_wire and field is not None:
        if stored_state is not None and _wire_equal(state, stored_state):
            return CheckResult(None, value)
    elif _unchanged(value, previous):
        return CheckResult(None, value)

    # A widget the latest run did not render accepts no change, such as a
    # trigger for a button behind a condition that is now false. Its metadata
    # outlives it, so the metadata alone cannot tell.
    if not is_rendered:
        return CheckResult(_NOT_RENDERED, value)

    # A disabled widget accepts no client input. The metadata is from the run
    # the client was shown, so a widget that disables itself in the callback
    # its own click runs keeps the click.
    if metadata.disabled:
        return CheckResult(_DISABLED, value)

    # The widget's own rules. The agent API, which compares on the wire, gets
    # no allowance for the browser's rounding either, so nothing it sends is
    # corrected silently.
    violation: Violation | None = None
    validator = metadata.validator
    if validator is not None:
        try:
            violation = validator(
                ui_value, previous=previous, value=value, exact=compare_wire
            )
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
            return CheckResult(_UNREADABLE, value)
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
    if config.get_option("global.e2eTest"):
        log = _LOGGER.warning
    elif violation.kind in _RACE_KINDS:
        log = _LOGGER.debug
    elif widget_id in warned:
        return
    else:
        warned.add(widget_id)
        log = _LOGGER.warning
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
