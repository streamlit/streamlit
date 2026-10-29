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

import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any
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
    check_client_value,
    log_violation,
)
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    from collections.abc import Callable, Iterator

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
    result = check_client_value(state, metadata=_metadata(value_type), previous="old")

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
        state, metadata=_metadata(value_type, deserializer=deserializer), previous=None
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
    result = check_client_value(state, metadata=_metadata(value_type), previous=None)

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

    result = check_client_value(state, metadata=metadata, previous=None)

    assert result.violation is None


def test_json_that_does_not_parse_is_unreadable() -> None:
    """A json_value that fails json.loads is refused, not raised."""
    result = check_client_value(
        _state(json_value="{not json"), metadata=_metadata("json_value"), previous=None
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
    )

    assert result.violation == Violation("unreadable")


def test_an_unchanged_value_passes_without_the_validator() -> None:
    """The validator only sees changes, so an unchanged value never reaches it."""
    validator = MagicMock(side_effect=AssertionError("must not run"))

    result = check_client_value(
        _state(string_value="same"),
        metadata=_metadata(validator=validator),
        previous="same",
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
    )

    assert result == (violation, "a", False)


def test_the_first_violation_wins() -> None:
    """A wrong wire field is reported before the validator could run."""
    validator = MagicMock(return_value=Violation("unreadable"))

    result = check_client_value(
        _state(bool_value=True), metadata=_metadata(validator=validator), previous=None
    )

    assert result.violation is not None
    assert result.violation.kind == "wrong_type"
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
    )

    assert result.violation is None
    assert validator.called is reaches_validator


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


def test_a_race_kind_is_logged_at_debug_and_not_deduplicated(
    records: list[logging.LogRecord],
) -> None:
    """A violation a correct browser can cause is logged at debug level each time."""
    warned: set[str] = set()

    log_violation(_ID, Violation("disabled"), warned=warned)
    log_violation(_ID, Violation("disabled"), warned=warned)

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


def test_the_e2e_parity_gate_looks_for_the_refusal_marker() -> None:
    """The e2e conftest fails on, and never reruns, the text log_violation writes."""
    e2e_dir = Path(__file__).parents[5] / "e2e_playwright"
    if not e2e_dir.is_dir():  # pragma: no cover - run outside the repository
        pytest.skip("The e2e tests are not next to these tests.")

    conftest = (e2e_dir / "conftest.py").read_text(encoding="utf-8")
    pytest_ini = (e2e_dir / "pytest.ini").read_text(encoding="utf-8")

    assert f'_REFUSED_WIDGET_VALUE_MARKER: Final = "{REFUSAL_LOG_MARKER}"' in conftest
    assert f'--rerun-except "{REFUSAL_LOG_MARKER}"' in pytest_ini
