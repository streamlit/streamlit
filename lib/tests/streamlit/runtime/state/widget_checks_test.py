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

"""Unit tests for the client value checks in widget_checks."""

from __future__ import annotations

import dataclasses
import datetime as dt
import logging
import math
from collections import Counter
from pathlib import Path
from typing import TYPE_CHECKING, Any, Final, get_args
from unittest.mock import MagicMock

import pytest

from streamlit.errors import StreamlitAPIException
from streamlit.proto.Components_pb2 import ArrowTable as ArrowTableProto
from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
from streamlit.runtime.state import widget_checks
from streamlit.runtime.state.common import WidgetMetadata
from streamlit.runtime.state.widget_checks import (
    REFUSAL_LOG_MARKER,
    Violation,
    ViolationKind,
    check_client_value,
    log_violation,
)
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    from collections.abc import Callable, Iterator, Sequence

    from streamlit.runtime.state.common import ValueFieldName, WidgetValidator

_ID = "$$ID-abc-key"


def _metadata(
    value_type: ValueFieldName = "string_value",
    *,
    deserializer: Callable[[Any], Any] | None = None,
    validator: WidgetValidator | None = None,
    accepted_value_fields: frozenset[ValueFieldName] | None = None,
) -> WidgetMetadata[Any]:
    return WidgetMetadata(
        id=_ID,
        deserializer=deserializer or (lambda value: value),
        serializer=lambda value: value,
        value_type=value_type,
        validator=validator,
        accepted_value_fields=accepted_value_fields,
    )


def _state(**field: Any) -> WidgetStateProto:
    """A WidgetState proto with one value field, or none."""
    state = WidgetStateProto(id=_ID)
    for name, value in field.items():
        if name.endswith("_array_value"):
            getattr(state, name).data.extend(value)
        elif isinstance(value, ArrowTableProto):
            state.arrow_value.CopyFrom(value)
        else:
            setattr(state, name, value)
    return state


@pytest.fixture
def records() -> Iterator[list[logging.LogRecord]]:
    """Collect what widget_checks logs, at every level."""
    collected: list[logging.LogRecord] = []

    class _Collector(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            collected.append(record)

    logger = logging.getLogger(widget_checks.__name__)
    handler = _Collector()
    previous_level = logger.level
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)
    try:
        yield collected
    finally:
        logger.removeHandler(handler)
        logger.setLevel(previous_level)


@pytest.mark.parametrize(
    ("value_type", "state", "expected"),
    [
        ("string_value", _state(string_value="a"), "a"),
        ("bool_value", _state(bool_value=True), True),
        ("trigger_value", _state(trigger_value=True), True),
        ("string_array_value", _state(string_array_value=["a", "b"]), ["a", "b"]),
        ("json_value", _state(json_value='{"a": 1}'), {"a": 1}),
        # The cleared form, which the frontend sends for a None value.
        ("string_value", _state(), None),
        ("double_value", _state(), None),
    ],
)
def test_the_registered_field_and_the_cleared_form_are_accepted(
    value_type: ValueFieldName, state: WidgetStateProto, expected: Any
) -> None:
    """A value in the registered field, or with no field set, is read."""
    result = check_client_value(
        state, metadata=_metadata(value_type), previous="old", is_rendered=True
    )

    assert result.violation is None
    assert result.value == expected
    assert result.changed is True


@pytest.mark.parametrize(
    ("value_type", "state"),
    [
        ("trigger_value", _state(string_value="x")),
        ("double_array_value", _state(string_value="x")),
        ("string_value", _state(bool_value=True)),
        ("string_array_value", _state(string_value="a")),
        # Components v2 registers json_value too, and must not accept bytes.
        ("json_value", _state(bytes_value=b"x")),
    ],
)
def test_a_field_the_widget_does_not_read_is_wrong_type(
    value_type: ValueFieldName, state: WidgetStateProto
) -> None:
    """A value in another wire field is refused before the deserializer runs."""
    deserializer = MagicMock()

    result = check_client_value(
        state,
        metadata=_metadata(value_type, deserializer=deserializer),
        previous=None,
        is_rendered=True,
    )

    assert result.violation is not None
    assert result.violation.kind == "wrong_type"
    assert value_type in result.violation.detail["expected"]
    deserializer.assert_not_called()


@pytest.mark.parametrize(
    ("value_type", "state", "accepted"),
    [
        ("double_value", _state(int_value=2**53), True),
        ("double_value", _state(int_value=-(2**53)), True),
        ("double_value", _state(int_value=2**53 + 1), False),
        ("int_value", _state(double_value=3.0), True),
        ("int_value", _state(double_value=float(2**54)), False),
        ("int_value", _state(double_value=float("nan")), False),
        ("int_value", _state(double_value=float("inf")), False),
        ("double_array_value", _state(int_array_value=[1, 2**53]), True),
        ("double_array_value", _state(int_array_value=[1, 2**53 + 1]), False),
        ("int_array_value", _state(double_array_value=[1.0, 2.0]), True),
        # The registered field itself has no precision limit.
        ("int_value", _state(int_value=2**60), True),
    ],
)
def test_numeric_fields_are_interchangeable_within_double_precision(
    value_type: ValueFieldName, state: WidgetStateProto, accepted: bool
) -> None:
    """An int and a double field accept each other within ±2**53."""
    result = check_client_value(
        state, metadata=_metadata(value_type), previous=None, is_rendered=True
    )

    if accepted:
        assert result.violation is None
    else:
        assert result.violation == Violation("wrong_type", result.violation.detail)


@pytest.mark.parametrize(
    "state",
    [
        _state(json_value='{"a": 1}'),
        _state(bytes_value=b"\x00\x01"),
        _state(arrow_value=ArrowTableProto(data=b"table")),
    ],
)
def test_accepted_value_fields_overrides_the_registered_field(
    state: WidgetStateProto,
) -> None:
    """A Components v1 component accepts JSON, bytes, and Arrow tables."""
    metadata = _metadata(
        "json_value",
        accepted_value_fields=frozenset({"json_value", "bytes_value", "arrow_value"}),
    )

    result = check_client_value(
        state, metadata=metadata, previous=None, is_rendered=True
    )

    assert result.violation is None


def test_json_that_does_not_parse_is_unreadable() -> None:
    """A json_value that fails json.loads is refused, not raised."""
    result = check_client_value(
        _state(json_value="{not json"),
        metadata=_metadata("json_value"),
        previous=None,
        is_rendered=True,
    )

    assert result.violation == Violation("unreadable")


@pytest.mark.parametrize(
    "error",
    [
        ValueError("bad"),
        TypeError("bad"),
        StreamlitAPIException("disallowed file type", error_id="test-error"),
    ],
)
def test_a_deserializer_that_raises_makes_the_value_unreadable(
    error: Exception,
) -> None:
    """Any exception from the deserializer refuses the value."""

    def deserializer(_value: Any) -> Any:
        raise error

    result = check_client_value(
        _state(string_value="a"),
        metadata=_metadata(deserializer=deserializer),
        previous=None,
        is_rendered=True,
    )

    assert result.violation == Violation("unreadable")


def test_an_unchanged_value_passes_without_the_validator() -> None:
    """The validator only sees changes, so an unchanged value never reaches it."""
    validator = MagicMock(side_effect=AssertionError("must not run"))

    result = check_client_value(
        _state(string_value="same"),
        metadata=_metadata(validator=validator),
        previous="same",
        is_rendered=True,
    )

    assert result == (None, "same", False)
    validator.assert_not_called()


def test_a_comparison_that_raises_counts_as_a_change() -> None:
    """A value whose comparison raises is treated as changed and validated."""

    class _Incomparable:
        def __ne__(self, other: object) -> bool:
            raise ValueError("ambiguous")

    validator = MagicMock(return_value=None)

    result = check_client_value(
        _state(string_value="a"),
        metadata=_metadata(
            deserializer=lambda _value: _Incomparable(), validator=validator
        ),
        previous="a",
        is_rendered=True,
    )

    assert result.changed is True
    validator.assert_called_once()


def test_the_validator_receives_the_wire_value_previous_and_deserialized() -> None:
    """The validator is called with the unpacked value and both keywords."""
    validator = MagicMock(return_value=None)

    result = check_client_value(
        _state(string_value="3"),
        metadata=_metadata(deserializer=int, validator=validator),
        previous=2,
        is_rendered=True,
    )

    validator.assert_called_once_with("3", previous=2, value=3)
    assert result == (None, 3, True)


def test_a_validator_violation_refuses_the_value() -> None:
    """A violation from the validator is returned, and the value is not changed."""
    violation = Violation("wrong_type")

    result = check_client_value(
        _state(string_value="a"),
        metadata=_metadata(validator=lambda _ui, **_kwargs: violation),
        previous=None,
        is_rendered=True,
    )

    assert result == (violation, "a", False)


def test_the_first_violation_wins() -> None:
    """A wrong wire field is reported before the validator could run."""
    validator = MagicMock(return_value=Violation("unreadable"))

    result = check_client_value(
        _state(bool_value=True),
        metadata=_metadata(validator=validator),
        previous=None,
        is_rendered=True,
    )

    assert result.violation is not None
    assert result.violation.kind == "wrong_type"
    validator.assert_not_called()


@pytest.mark.parametrize(
    ("state", "previous", "expected_kind"),
    [
        # A browser resends every value, also for a widget no longer shown.
        (_state(string_value="same"), "same", None),
        # Refused before `disabled` and the widget's own rules.
        (_state(string_value="new"), "old", "not_rendered"),
        # A wire field the widget never reads is reported first.
        (_state(bool_value=True), "old", "wrong_type"),
    ],
)
def test_a_widget_that_is_not_rendered_takes_no_change(
    state: WidgetStateProto, previous: str, expected_kind: ViolationKind | None
) -> None:
    """Check 4 refuses a change for a widget the latest run did not render."""
    validator = MagicMock(return_value=None)
    metadata = dataclasses.replace(_metadata(validator=validator), disabled=True)

    result = check_client_value(
        state, metadata=metadata, previous=previous, is_rendered=False
    )

    kind = None if result.violation is None else result.violation.kind
    assert kind == expected_kind
    assert result.changed is False
    validator.assert_not_called()


def test_a_validator_that_raises_is_logged_without_the_value(
    records: list[logging.LogRecord],
) -> None:
    """A validator bug refuses the value as unreadable and logs where it raised."""

    def validator(ui_value: Any, **_kwargs: Any) -> Violation | None:
        raise ValueError(f"cannot check {ui_value}")

    result = check_client_value(
        _state(string_value="secret-password"),
        metadata=_metadata(validator=validator),
        previous=None,
        is_rendered=True,
    )

    assert result.violation == Violation("unreadable")
    (record,) = records
    assert record.levelno == logging.WARNING
    assert "ValueError" in record.getMessage()
    assert "secret-password" not in record.getMessage()


@pytest.mark.parametrize(
    ("sent", "stored", "reaches_validator"),
    [
        (_state(string_value="a"), _state(string_value="a"), False),
        (_state(string_value="b"), _state(string_value="a"), True),
        # A form that only converts onto the stored value still reaches it.
        (_state(int_value=2), _state(double_value=2.0), True),
        # A missing field and an empty array both mean empty.
        (_state(), WidgetStateProto(id=_ID, string_array_value={}), False),
        (_state(), _state(), False),
        # No stored wire form: the value counts as changed.
        (_state(string_value="a"), None, True),
    ],
)
def test_wire_comparison(
    sent: WidgetStateProto,
    stored: WidgetStateProto | None,
    reaches_validator: bool,
) -> None:
    """The agent API compares wire values, which is stricter than comparing values."""
    validator = MagicMock(return_value=None)
    metadata = _metadata(
        "double_value" if sent.WhichOneof("value") == "int_value" else "string_value",
        deserializer=lambda _value: "same",
        validator=validator,
    )

    result = check_client_value(
        sent,
        metadata=metadata,
        previous="same",
        compare_wire=True,
        stored_state=stored,
        is_rendered=True,
    )

    assert result.violation is None
    assert validator.called is reaches_validator


def test_the_unset_form_is_compared_after_deserializing() -> None:
    """A state with no field reads as the default, so the wire comparison skips it.

    `null` to an empty required text input is then a no-op, though the stored
    `""` has a field on the wire.
    """
    validator = MagicMock(return_value=None)
    metadata = _metadata(
        deserializer=lambda value: "" if value is None else value,
        validator=validator,
    )

    def check(previous: str) -> None:
        check_client_value(
            _state(),
            metadata=metadata,
            previous=previous,
            compare_wire=True,
            stored_state=_state(string_value=previous),
            is_rendered=True,
        )

    check("")
    validator.assert_not_called()
    check("Ada")
    validator.assert_called_once()


def test_an_unreadable_value_is_logged_once_per_widget_at_warning(
    records: list[logging.LogRecord],
) -> None:
    """A protocol violation is logged once per widget per session, at warning."""
    warned: set[str] = set()

    log_violation(_ID, Violation("wrong_type"), warned=warned)
    log_violation(_ID, Violation("unreadable"), warned=warned)
    log_violation("$$ID-other-None", Violation("wrong_type"), warned=warned)

    assert [r.levelno for r in records] == [logging.WARNING, logging.WARNING]
    assert (
        records[0].getMessage().startswith(f"{REFUSAL_LOG_MARKER} {_ID} (wrong_type).")
    )
    assert "$$ID-other-None (wrong_type)" in records[1].getMessage()
    assert warned == {_ID, "$$ID-other-None"}


@pytest.mark.parametrize("kind", ["not_rendered", "disabled"])
def test_a_race_kind_is_logged_at_debug_and_not_deduplicated(
    records: list[logging.LogRecord], kind: ViolationKind
) -> None:
    """A violation a correct browser can cause is logged at debug level each time."""
    warned: set[str] = set()

    log_violation(_ID, Violation(kind), warned=warned)
    log_violation(_ID, Violation(kind), warned=warned)

    assert [r.levelno for r in records] == [logging.DEBUG, logging.DEBUG]
    assert warned == set()


def test_e2e_tests_log_every_refusal_at_warning(
    records: list[logging.LogRecord],
) -> None:
    """Under global.e2eTest, every refusal is a warning, so the parity gate sees it."""
    warned: set[str] = set()

    with patch_config_options({"global.e2eTest": True}):
        log_violation(_ID, Violation("disabled"), warned=warned)
        log_violation(_ID, Violation("wrong_type"), warned=warned)
        log_violation(_ID, Violation("wrong_type"), warned=warned)

    assert [r.levelno for r in records] == [logging.WARNING] * 3
    assert all(REFUSAL_LOG_MARKER in r.getMessage() for r in records)


@pytest.mark.parametrize(
    ("kind", "level"),
    [
        ("not_an_option", logging.DEBUG),
        ("too_many_items", logging.DEBUG),
        ("duplicate_items", logging.WARNING),
        ("out_of_range", logging.DEBUG),
        ("too_long", logging.DEBUG),
        # A key keeps the ID while `required` turns on.
        ("empty_required", logging.DEBUG),
        ("bad_shape", logging.WARNING),
        ("malformed", logging.WARNING),
    ],
)
def test_option_and_bound_kinds_log_at_their_level(
    records: list[logging.LogRecord], kind: ViolationKind, level: int
) -> None:
    """A sync race can change options, bounds, or max_chars, but not a shape."""
    log_violation(_ID, Violation(kind), warned=set())

    assert [r.levelno for r in records] == [level]


def _labels(*labels: str) -> Sequence[str]:
    """Labels as a validator receives them: a protobuf array, not a list."""
    return _state(string_array_value=list(labels)).string_array_value.data


_COUNTS: Final = Counter(["a", "b", "X", "X"])


@pytest.mark.parametrize(
    ("value", "accept_new", "expected"),
    [
        ("a", False, None),
        ("c", False, Violation("not_an_option", {"options": ("a", "b", "X")})),
        # A shared format_func label does not say which option it means.
        ("X", False, Violation("ambiguous_option")),
        # Any non-empty text is legal, untrimmed and shared labels included.
        ("new", True, None),
        (" a ", True, None),
        ("X", True, None),
        ("", True, Violation("not_an_option", {"options": ("a", "b", "X")})),
    ],
)
def test_one_of(value: str, accept_new: bool, expected: Violation | None) -> None:
    """One label is an option, a shared label, or not an option."""
    assert widget_checks.one_of(_COUNTS, value, accept_new=accept_new) == expected


@pytest.mark.parametrize(
    ("values", "options", "expected"),
    [
        (("a", "b"), {}, None),
        ((), {"max_items": 0}, None),
        (("a", "b"), {"max_items": 1}, Violation("too_many_items", {"max_items": 1})),
        # The limit is checked first.
        (("c", "d"), {"max_items": 1}, Violation("too_many_items", {"max_items": 1})),
        (
            ("a", "c", "b", "d"),
            {},
            Violation(
                "not_an_option",
                {"options": ("a", "b", "X"), "positions": (1, 3)},
            ),
        ),
        # Options are checked before duplicates and ambiguity.
        (
            ("a", "a", "X", "c"),
            {},
            Violation("not_an_option", {"options": ("a", "b", "X"), "positions": (3,)}),
        ),
        (("a", "b", "a"), {}, Violation("duplicate_items", {"positions": (2,)})),
        # A range may repeat an option.
        (("a", "a"), {"unique": False}, None),
        # "Select all" lists a shared label as often as options share it.
        (("a", "X", "X"), {}, Violation("ambiguous_option", {"positions": (1,)})),
        (("X", "X", "X"), {}, Violation("duplicate_items", {"positions": (2,)})),
        (
            ("X", "X"),
            {"unique": False},
            Violation("ambiguous_option", {"positions": (0,)}),
        ),
        (("a", "new"), {"accept_new": True}, None),
        (("X", "X"), {"accept_new": True}, None),
        (
            ("new", "new"),
            {"accept_new": True},
            Violation("duplicate_items", {"positions": (1,)}),
        ),
        (
            ("", "a"),
            {"accept_new": True},
            Violation("not_an_option", {"options": ("a", "b", "X"), "positions": (0,)}),
        ),
    ],
)
def test_items_of(
    values: tuple[str, ...], options: dict[str, Any], expected: Violation | None
) -> None:
    """A list is checked for its length, then its options, duplicates, and ambiguity."""
    assert widget_checks.items_of(_COUNTS, _labels(*values), **options) == expected


def test_an_ambiguous_label_is_accepted_and_counts_as_a_change() -> None:
    """A browser session keeps a shared label, which the agent API refuses."""
    result = check_client_value(
        _state(string_value="X"),
        metadata=_metadata(
            validator=lambda ui, **_kwargs: widget_checks.one_of(_COUNTS, ui)
        ),
        previous="a",
        is_rendered=True,
    )

    assert result == (Violation("ambiguous_option"), "X", True)
    assert not widget_checks.browser_refuses(result.violation)
    assert widget_checks.browser_refuses(Violation("not_an_option"))


def _out_of_range(min_value: Any, max_value: Any) -> Violation:
    return Violation("out_of_range", {"min_value": min_value, "max_value": max_value})


@pytest.mark.parametrize(
    ("value", "min_value", "max_value", "expected"),
    [
        (5, 0, 10, None),
        # Both bounds are inclusive.
        (0, 0, 10, None),
        (10.0, 0, 10, None),
        (-1, 0, 10, _out_of_range(0, 10)),
        (10.5, 0, 10, _out_of_range(0, 10)),
        (math.nan, 0, 10, _out_of_range(0, 10)),
        (-(10**9), None, 10, None),
        (-(10**9), 0, None, _out_of_range(0, None)),
        (10**9, None, 10, _out_of_range(None, 10)),
        (dt.date(2026, 1, 1), dt.date(2026, 1, 1), dt.date(2026, 12, 31), None),
        (
            dt.date(2025, 12, 31),
            dt.date(2026, 1, 1),
            dt.date(2026, 12, 31),
            _out_of_range(dt.date(2026, 1, 1), dt.date(2026, 12, 31)),
        ),
    ],
)
def test_within(
    value: Any, min_value: Any, max_value: Any, expected: Violation | None
) -> None:
    """A value is within inclusive bounds; the violation names both bounds."""
    assert widget_checks.within(value, min_value, max_value) == expected


@pytest.mark.parametrize(
    ("value", "finite", "whole"),
    [
        (2, True, True),
        (2.0, True, True),
        (-0.0, True, True),
        (2**53, True, True),
        (2.5, True, False),
        (math.nan, False, False),
        (math.inf, False, False),
        (-math.inf, False, False),
    ],
)
def test_finite_and_whole_number(value: float, finite: bool, whole: bool) -> None:
    """NaN and infinity are malformed, and so is a fraction for a whole number."""
    assert (widget_checks.finite(value) is None) is finite
    assert (widget_checks.whole_number(value) is None) is whole
    if not whole:
        assert widget_checks.whole_number(value) == Violation(
            "malformed", {"expected": "a whole number"}
        )


def test_item_count_names_the_allowed_counts() -> None:
    """A wrong item count reports the counts the widget takes, in order."""
    assert widget_checks.item_count(_labels("a", "b"), allowed={2}) is None
    assert widget_checks.item_count(_labels(), allowed={0, 1, 2}) is None
    assert widget_checks.item_count(_labels("a", "b", "c"), allowed={2, 0, 1}) == (
        Violation("bad_shape", {"item_counts": (0, 1, 2)})
    )


@pytest.mark.parametrize(
    ("values", "is_ordered"),
    [
        ((), True),
        ((1.0,), True),
        ((20.0, 80.0), True),
        # An empty range has equal ends.
        ((5.0, 5.0), True),
        ((80.0, 20.0), False),
        ((math.nan, 1.0), False),
    ],
)
def test_ordered(values: tuple[float, ...], is_ordered: bool) -> None:
    """A range lists its lower end first; a protobuf array works as a list does."""
    array = _state(double_array_value=list(values)).double_array_value.data
    result = widget_checks.ordered(array)
    assert result == (None if is_ordered else Violation("bad_shape", {"order": True}))


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("2026-10-29", dt.date(2026, 10, 29)),
        ("0001-01-01", dt.date(1, 1, 1)),
        # The legacy URL layout is read by the deserializer, never sent.
        ("2026/10/29", None),
        ("2026-1-5", None),
        ("20261029", None),
        ("2026-02-30", None),
        ("2026-10-29\n", None),
        ("2026-10-29T00:00", None),
        # Arabic-Indic digits, which `\d` would match.
        (
            "2026-10-29".translate({ord("0") + d: 0x0660 + d for d in range(10)}),
            None,
        ),
    ],
)
def test_iso_date(text: str, expected: dt.date | None) -> None:
    """Only the YYYY-MM-DD layout the browser sends is read."""
    result = widget_checks.iso_date(text)
    if expected is None:
        assert result == Violation("malformed", {"expected": "a date as YYYY-MM-DD"})
    else:
        assert result == expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("10:00", dt.time(10, 0)),
        # Seconds are accepted for any step, such as step=60.
        ("10:00:00", dt.time(10, 0)),
        ("23:59:59", dt.time(23, 59, 59)),
        ("24:00", None),
        ("10:60", None),
        ("10:00:60", None),
        ("1:00", None),
        ("10:00:00.5", None),
        ("10:00\n", None),
        ("10:00+01:00", None),
    ],
)
def test_iso_time(text: str, expected: dt.time | None) -> None:
    """HH:MM and HH:MM:SS are read; nothing else is."""
    result = widget_checks.iso_time(text)
    if expected is None:
        assert isinstance(result, Violation)
        assert result.kind == "malformed"
    else:
        assert result == expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("2026-10-29T10:15", dt.datetime(2026, 10, 29, 10, 15)),
        ("2026-10-29T10:15:00", None),
        ("2026-10-29 10:15", None),
        ("2026/10/29, 10:15", None),
        ("2026-10-29", None),
        ("2026-10-29T10:15+01:00", None),
        ("2026-10-29T25:00", None),
    ],
)
def test_iso_datetime_minutes(text: str, expected: dt.datetime | None) -> None:
    """Only the YYYY-MM-DDTHH:MM layout the browser sends is read."""
    result = widget_checks.iso_datetime_minutes(text)
    if expected is None:
        assert isinstance(result, Violation)
        assert result.kind == "malformed"
    else:
        assert result == expected


@pytest.mark.parametrize(
    ("text", "is_color"),
    [
        ("#fff", True),
        ("#FFF", True),
        ("#a1B2c3", True),
        ("#ffffff\n", False),
        ("red", False),
        ("ffffff", False),
        ("#ffff", False),
        ("##fff", False),
        ("", False),
    ],
)
def test_hex_color(text: str, is_color: bool) -> None:
    """#rgb and #rrggbb in either case, matched in full."""
    assert (widget_checks.hex_color(text) is None) is is_color


@pytest.mark.parametrize(
    ("text", "max_chars", "fits"),
    [
        ("abc", 3, True),
        ("abcd", 3, False),
        # An emoji is two UTF-16 code units, as the browser counts it.
        ("😀", 1, False),
        ("😀", 2, True),
        ("😀😀", 3, False),
        ("é", 1, True),
        # 0 and None mean no limit, as in the browser.
        ("x" * 100, 0, True),
        ("x" * 100, None, True),
        ("", 1, True),
    ],
)
def test_text_length(text: str, max_chars: int | None, fits: bool) -> None:
    """max_chars counts UTF-16 code units."""
    result = widget_checks.text_length(text, max_chars)
    if fits:
        assert result is None
    else:
        assert result == Violation("too_long", {"max_chars": max_chars})


def test_utf16_length_counts_astral_characters_twice() -> None:
    """A character outside the Basic Multilingual Plane counts as two units."""
    assert widget_checks.utf16_length("a😀é") == 4
    assert widget_checks.utf16_length("") == 0


@pytest.mark.parametrize(
    ("text", "max_chars", "expected"),
    [
        ("abcd", 3, "abc"),
        ("abc", 3, "abc"),
        ("abc", 0, ""),
        # The emoji does not fit in what is left, so it is left out whole.
        ("a😀b", 2, "a"),
        ("a😀b", 3, "a😀"),
        ("😀😀", 3, "😀"),
    ],
)
def test_truncate_utf16_never_splits_a_character(
    text: str, max_chars: int, expected: str
) -> None:
    """Truncated text is valid text within max_chars."""
    truncated = widget_checks.truncate_utf16(text, max_chars)

    assert truncated == expected
    assert widget_checks.utf16_length(truncated) <= max_chars


# The characters JavaScript's `trim()` removes, from Node: every code point `c`
# with `String.fromCodePoint(c).trim() === ""`.
_BROWSER_WHITESPACE: Final = [
    0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0xA0, 0x1680, *range(0x2000, 0x200B),
    0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF,
]  # fmt: skip


@pytest.mark.parametrize(
    ("value", "empty"),
    [
        (None, True),
        ("", True),
        (" ", True),
        (" \t\n ", True),
        ("".join(map(chr, _BROWSER_WHITESPACE)), True),
        # Python's `strip()` removes these, but the browser keeps them.
        (chr(0x1C), False),
        (chr(0x1F), False),
        (chr(0x85), False),
        # The byte order mark, which the browser removes and `strip()` keeps.
        (chr(0xFEFF), True),
        (" a ", False),
        ([], True),
        ((), True),
        (["2026-01-01"], False),
        (0, False),
        (0.0, False),
        (dt.date(2026, 1, 1), False),
    ],
)
def test_is_empty(value: Any, empty: bool) -> None:
    """Emptiness follows the browser: None, no items, or whitespace it trims."""
    assert widget_checks.is_empty(value) is empty


def test_is_empty_reads_a_protobuf_array() -> None:
    """A wire array is empty without items, as a list is."""
    empty = _state(string_array_value=[]).string_array_value.data
    filled = _state(string_array_value=["a"]).string_array_value.data

    assert widget_checks.is_empty(empty) is True
    assert widget_checks.is_empty(filled) is False


def test_whitespace_matches_the_browser_trim() -> None:
    """The whitespace set is exactly what the browser's `trim()` removes."""
    assert sorted(map(ord, widget_checks._ECMASCRIPT_WHITESPACE)) == sorted(
        _BROWSER_WHITESPACE
    )


@pytest.mark.parametrize(
    ("value", "required", "expected"),
    [
        ("   ", True, Violation("empty_required")),
        (None, True, Violation("empty_required")),
        ([], True, Violation("empty_required")),
        ("a", True, None),
        # An optional widget can be emptied.
        ("", False, None),
        (None, False, None),
    ],
)
def test_filled(value: Any, required: bool, expected: Violation | None) -> None:
    """Only a required widget refuses an empty value."""
    assert widget_checks.filled(value, required=required) == expected


def test_an_empty_required_value_is_refused_only_when_changed() -> None:
    """An unchanged empty value passes before the validator runs."""
    metadata = _metadata(
        validator=lambda ui_value, **_kwargs: widget_checks.filled(
            ui_value, required=True
        )
    )

    unchanged = check_client_value(
        _state(string_value=""), metadata=metadata, previous="", is_rendered=True
    )
    emptied = check_client_value(
        _state(string_value=" "), metadata=metadata, previous="Ada", is_rendered=True
    )

    assert unchanged.violation is None
    assert emptied.violation == Violation("empty_required")
    assert emptied.changed is False


def test_every_violation_kind_has_a_log_explanation() -> None:
    """log_violation can explain every kind, so logging a refusal never raises."""
    assert set(widget_checks._EXPLANATIONS) == set(get_args(ViolationKind))
    assert set(get_args(ViolationKind)) >= widget_checks._RACE_KINDS


def test_the_e2e_parity_gate_looks_for_the_refusal_marker() -> None:
    """The e2e conftest fails on, and never reruns, the text log_violation writes."""
    e2e_dir = Path(__file__).parents[5] / "e2e_playwright"
    if not e2e_dir.is_dir():  # pragma: no cover - run outside the repository
        pytest.skip("The e2e tests are not next to these tests.")

    conftest = (e2e_dir / "conftest.py").read_text(encoding="utf-8")
    pytest_ini = (e2e_dir / "pytest.ini").read_text(encoding="utf-8")

    assert f'_REFUSED_WIDGET_VALUE_MARKER: Final = "{REFUSAL_LOG_MARKER}"' in conftest
    assert f'--rerun-except "{REFUSAL_LOG_MARKER}"' in pytest_ini
