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

"""Parse and evaluate ``enabled_dates`` / ``disabled_dates`` for ``st.date_input``."""

from __future__ import annotations

import inspect
from collections.abc import Collection
from dataclasses import dataclass, replace
from datetime import date, datetime, timedelta
from typing import Final, Literal, TypeAlias, cast

from streamlit.dataframe_util import (
    DataFormat,
    OptionSequence,
    convert_anything_to_list,
    determine_data_format,
)
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitIncompatibleParametersError,
    StreamlitInvalidParameterTypeError,
)
from streamlit.proto.DateInput_pb2 import DateInput as DateInputProto

# Exact dates, weekdays, or list-likes accepted by enabled_dates / disabled_dates.
DateLike: TypeAlias = date | datetime | str
DateFilter: TypeAlias = OptionSequence[DateLike] | DateLike | Collection[DateLike]

WEEKDAY_NAME_TO_ISO: Final[dict[str, int]] = {
    "monday": 1,
    "tuesday": 2,
    "wednesday": 3,
    "thursday": 4,
    "friday": 5,
    "saturday": 6,
    "sunday": 7,
}
ISO_WEEKDAY_TO_NAME: Final[dict[int, str]] = {
    value: name for name, value in WEEKDAY_NAME_TO_ISO.items()
}
_DATE_FILTER_ACCEPTED_FORMS: Final[list[str]] = [
    "date",
    "datetime",
    "ISO string",
    '"today"',
    'weekday name ("monday"…"sunday")',
    "list-like of these",
]


def _date_to_iso(value: date) -> str:
    """Serialize a date to ISO 8601 with a guaranteed four-digit year."""
    return f"{value.year:04d}-{value.month:02d}-{value.day:02d}"


def _is_rejected_dataframe(obj: object) -> bool:
    """True for 2D dataframe objects that must not be accepted as a date filter."""
    return determine_data_format(obj) in {
        DataFormat.PANDAS_DATAFRAME,
        DataFormat.POLARS_DATAFRAME,
        DataFormat.POLARS_LAZYFRAME,
        DataFormat.MODIN_OBJECT,
        DataFormat.PYSPARK_OBJECT,
        DataFormat.SNOWPARK_OBJECT,
        DataFormat.SNOWPANDAS_OBJECT,
        DataFormat.DASK_OBJECT,
        DataFormat.XARRAY_DATASET,
        DataFormat.XARRAY_DATA_ARRAY,
        DataFormat.PYARROW_TABLE,
        DataFormat.NUMPY_MATRIX,
    }


def _convert_numpy_datetime64_to_date(value: object) -> date | None:
    """Convert a NumPy datetime64-like value to date, or return None if unsupported."""
    type_name = type(value).__name__
    module_name = type(value).__module__
    # pandas Timestamp is a datetime subclass and is handled elsewhere.
    if (
        "datetime64" not in type_name
        and "datetime64" not in module_name
        and not (module_name.startswith("numpy") and type_name.startswith("datetime64"))
    ):
        return None
    try:
        # Prefer pandas when available: handles datetime64[ns] and DatetimeArray entries.
        import pandas as pd

        return pd.Timestamp(value).date()  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    except Exception:
        try:
            text = str(value)
            return date.fromisoformat(text[:10])
        except ValueError:
            return None


def _parse_filter_iso_string(value: str) -> date:
    """Parse an ISO date or datetime string for a filter entry."""
    try:
        return date.fromisoformat(value)
    except ValueError:
        try:
            return datetime.fromisoformat(value).date()
        except ValueError as err:
            raise StreamlitInvalidParameterTypeError(
                "value",
                type(value).__name__,
                _DATE_FILTER_ACCEPTED_FORMS,
            ) from err


def parse_date_filter_entry(
    entry: object,
    param_name: str,
) -> tuple[date | None, int | None, bool]:
    """Parse one filter entry into (exact_date, weekday, is_today_literal).

    Exactly one of exact_date or weekday is set, unless the entry is the
    literal ``"today"``, in which case exact_date is today's date and
    ``is_today_literal`` is True.
    """
    if isinstance(entry, str):
        stripped = entry.strip()
        weekday = WEEKDAY_NAME_TO_ISO.get(stripped.casefold())
        if weekday is not None:
            return None, weekday, False
        if stripped.casefold() == "today":
            return datetime.now().date(), None, True
        try:
            return _parse_filter_iso_string(stripped), None, False
        except StreamlitInvalidParameterTypeError as exc:
            raise StreamlitInvalidParameterTypeError(
                param_name,
                type(entry).__name__,
                _DATE_FILTER_ACCEPTED_FORMS,
            ) from exc

    if isinstance(entry, datetime):
        return entry.date(), None, False
    if isinstance(entry, date):
        return entry, None, False

    converted = _convert_numpy_datetime64_to_date(entry)
    if converted is not None:
        return converted, None, False

    raise StreamlitInvalidParameterTypeError(
        param_name,
        type(entry).__name__,
        _DATE_FILTER_ACCEPTED_FORMS,
    )


@dataclass(frozen=True)
class DateAvailability:
    """Normalized availability configuration for ``st.date_input``."""

    mode: DateInputProto.AvailabilityMode.ValueType
    # Resolved exact dates after materialization (including resolved "today").
    exact_dates: frozenset[date]
    weekdays: frozenset[int]
    # Element-ID tokens: exact dates as ISO strings, with "today" kept symbolic.
    id_exact_entries: tuple[str, ...]
    id_weekdays: tuple[int, ...]
    # Parameter that produced this config, for agent reporting and errors.
    param_name: Literal["enabled_dates", "disabled_dates"]

    def is_available(self, value: date) -> bool:
        """Return True when ``value`` is selectable under this configuration."""
        matches = value in self.exact_dates or value.isoweekday() in self.weekdays
        if self.mode == DateInputProto.AvailabilityMode.ALLOW:
            return matches
        if self.mode == DateInputProto.AvailabilityMode.BLOCK:
            return not matches
        return True

    def bounds_filtered(self, min_value: date, max_value: date) -> DateAvailability:
        """Drop exact dates outside the min/max window for protobuf / agent use."""
        filtered = frozenset(d for d in self.exact_dates if min_value <= d <= max_value)
        return replace(self, exact_dates=filtered)

    def agent_report(self) -> list[str]:
        """Weekday names plus ISO dates the browser receives."""
        values = [ISO_WEEKDAY_TO_NAME[day] for day in sorted(self.weekdays)]
        values.extend(_date_to_iso(d) for d in sorted(self.exact_dates))
        return values


def normalize_date_filter(
    raw: DateFilter | None,
    param_name: Literal["enabled_dates", "disabled_dates"],
) -> tuple[frozenset[date], frozenset[int], tuple[str, ...], tuple[int, ...]] | None:
    """Materialize, validate, deduplicate, and sort a date filter parameter."""
    if raw is None:
        return None

    if inspect.isgenerator(raw) or inspect.isgeneratorfunction(raw):
        raise StreamlitAPIException(
            f"The `{param_name}` parameter does not accept generators. "
            "Pass a list, tuple, set, Series, Index, or NumPy array instead.",
            error_id="date-input-filter-generator",
        )

    if _is_rejected_dataframe(raw):
        raise StreamlitAPIException(
            f"The `{param_name}` parameter does not accept DataFrames. "
            "Pass a column as a Series, Index, or NumPy array instead "
            '(for example `df["date"]` or `df["date"].unique()`).',
            error_id="date-input-filter-dataframe",
        )

    if isinstance(raw, (str, date, datetime)):
        entries: list[object] = [raw]
    else:
        entries = cast("list[object]", convert_anything_to_list(raw))

    exact_dates: set[date] = set()
    weekdays: set[int] = set()
    id_exact: set[str] = set()
    for entry in entries:
        exact, weekday, is_today = parse_date_filter_entry(entry, param_name)
        if weekday is not None:
            weekdays.add(weekday)
        elif exact is not None:
            exact_dates.add(exact)
            id_exact.add("today" if is_today else _date_to_iso(exact))

    return (
        frozenset(exact_dates),
        frozenset(weekdays),
        tuple(sorted(id_exact)),
        tuple(sorted(weekdays)),
    )


def parse_date_availability(
    enabled_dates: DateFilter | None,
    disabled_dates: DateFilter | None,
) -> DateAvailability | None:
    """Parse enabled_dates / disabled_dates into a single availability config."""
    if enabled_dates is not None and disabled_dates is not None:
        raise StreamlitIncompatibleParametersError(
            "enabled_dates",
            "disabled_dates",
        )

    if enabled_dates is not None:
        normalized = normalize_date_filter(enabled_dates, "enabled_dates")
        # ``normalize_date_filter`` only returns None when ``raw`` is None; the
        # caller already gated that case.
        if normalized is None:
            raise StreamlitAPIException(
                "Failed to normalize `enabled_dates`.",
                error_id="date-input-filter-normalize",
            )
        exact, weekdays, id_exact, id_weekdays = normalized
        return DateAvailability(
            mode=DateInputProto.AvailabilityMode.ALLOW,
            exact_dates=exact,
            weekdays=weekdays,
            id_exact_entries=id_exact,
            id_weekdays=id_weekdays,
            param_name="enabled_dates",
        )

    if disabled_dates is not None:
        normalized = normalize_date_filter(disabled_dates, "disabled_dates")
        if normalized is None:
            raise StreamlitAPIException(
                "Failed to normalize `disabled_dates`.",
                error_id="date-input-filter-normalize",
            )
        exact, weekdays, id_exact, id_weekdays = normalized
        return DateAvailability(
            mode=DateInputProto.AvailabilityMode.BLOCK,
            exact_dates=exact,
            weekdays=weekdays,
            id_exact_entries=id_exact,
            id_weekdays=id_weekdays,
            param_name="disabled_dates",
        )

    return None


def is_date_selectable(
    value: date,
    min_value: date,
    max_value: date,
    availability: DateAvailability | None,
) -> bool:
    """True when ``value`` is inside bounds and allowed by availability."""
    if value < min_value or value > max_value:
        return False
    if availability is None:
        return True
    return availability.is_available(value)


def resolve_today_to_selectable(
    today: date,
    min_value: date,
    max_value: date,
    availability: DateAvailability | None,
) -> date | None:
    """Snap ``today`` to a selectable date: keep, else next, else previous, else None."""
    if is_date_selectable(today, min_value, max_value, availability):
        return today

    candidate = today + timedelta(days=1)
    while candidate <= max_value:
        if is_date_selectable(candidate, min_value, max_value, availability):
            return candidate
        candidate += timedelta(days=1)

    candidate = today - timedelta(days=1)
    while candidate >= min_value:
        if is_date_selectable(candidate, min_value, max_value, availability):
            return candidate
        candidate -= timedelta(days=1)

    return None


def raise_unavailable_value_error(value: date) -> None:
    """Raise when an explicit ``value`` is blocked by availability."""
    raise StreamlitAPIException(
        f"The `value` {value} is not selectable with the current "
        "`enabled_dates` / `disabled_dates` configuration. "
        'Pass `value="today"` to snap to a selectable date instead of raising.',
        error_id="date-input-value-unavailable",
    )
