---
author: jrieke
created: 2025-11-22
---

# Control selectable dates in `st.date_input`

## Summary

Add optional `enabled_dates` and `disabled_dates` parameters to `st.date_input` so apps can
allow or block individual dates and weekdays. The feature applies to calendar selection, typed and
pasted values, range endpoints, quick-select presets, Session State, and query-parameter values.

The current React Aria implementation supports this without a new frontend dependency. Its date
field and calendar primitives expose date-availability validation directly; Streamlit must connect
that validation to every custom commit path and define range behavior explicitly.

## Problem

`min_value` and `max_value` only define one continuous window. Apps cannot express common gaps
within that window:

- [#1839](https://github.com/streamlit/streamlit/issues/1839) asks to prevent weekend endpoints in
  stock-market date ranges.
- [#7062](https://github.com/streamlit/streamlit/issues/7062) asks for an explicit allowlist that
  can represent exchange-specific trading days and holidays.

Today, apps must use another widget such as `st.selectbox`, accept an invalid date and show an error
after the rerun, or maintain custom frontend code. These workarounds lose the date input's calendar
and range-selection UX or let users submit values that the app already knows it cannot use.

[#8058](https://github.com/streamlit/streamlit/issues/8058) is related but distinct: it asks to
visually mark dates while leaving them selectable. This proposal controls selection and does not
add arbitrary date annotations.

## Proposal

### API

Add two keyword-only parameters after `format`:

```python
def date_input(
    label: str,
    value: DateValue = "today",
    min_value: date | datetime | str | None = None,
    max_value: date | datetime | str | None = None,
    # Existing parameters...
    *,
    format: str = "YYYY/MM/DD",
    enabled_dates: Iterable[date | datetime | str] | None = None,
    disabled_dates: Iterable[date | datetime | str] | None = None,
    disabled: bool = False,
    # Existing parameters...
) -> DateWidgetReturn: ...
```

Each iterable accepts:

- `datetime.date` and `datetime.datetime` values. Time information is ignored, consistent with
  `value`.
- ISO-formatted date or datetime strings accepted by `value`.
- `"today"`.
- English weekday names: `"monday"` through `"sunday"`. Weekday matching is case-insensitive and
  ignores surrounding whitespace.

Exact dates and weekdays can be mixed. Invalid values raise a parameter-specific Streamlit
exception that lists the accepted forms.

### Availability rules

| Configuration | Selectable dates |
|---|---|
| Both parameters are `None` | Existing behavior: every date within `min_value` and `max_value` |
| `enabled_dates` is set | Only matching exact dates and weekdays within the min/max window |
| `disabled_dates` is set | Every date in the min/max window except matching exact dates and weekdays |
| Both parameters are set | Raise an exception, including when either iterable is empty |

Additional rules:

- Exact dates and weekdays within one parameter use union semantics. For example,
  `enabled_dates=["monday", date(2026, 8, 27)]` enables every Monday plus August 27.
- Bounds are applied first. Exact filter dates outside the min/max window and duplicate entries
  have no effect.
- An empty `enabled_dates` iterable makes every date unavailable; use it with `value=None` (or an
  empty range value) when an app temporarily has no available dates. An empty `disabled_dates`
  iterable disables nothing.
- Every non-empty initial value must be selectable. This includes both endpoints of a complete
  range and the start of a partial range. Raise at the `st.date_input` call if it is not.
- When a keyed widget's availability configuration changes and invalidates its current frontend,
  Session State, or query-parameter value, reset it to its declared default, matching dynamic
  min/max behavior. The declared default must itself satisfy the new configuration. Remove an
  invalid bound query parameter when resetting it.
- A date entered through the segmented field or paste path is validated before commit. An
  unavailable value leaves the last committed widget value unchanged and shows the existing inline
  error treatment with an actionable message such as: `Date is unavailable. Choose an enabled
  date.`

### Range behavior

Availability applies to range endpoints, not every calendar day between them. A range may cross
unavailable weekends or holidays as long as its selected start and end are available. This matches
the stock-market use case in #1839: a Monday-to-Monday query remains possible even though the
intervening weekend cannot be chosen as an endpoint.

React Aria's `RangeCalendar` supports this with `allowsNonContiguousRanges`. Unavailable interior
dates keep their unavailable visual treatment while `st.date_input` continues to return one
inclusive `(start, end)` tuple; Streamlit does not remove or split interior dates from the value.

The existing range quick-select row only shows presets whose start and end satisfy the configured
availability. The commit handler still revalidates a selected preset so quick select cannot bypass
the rule.

### Examples

Disable weekends and a holiday:

```python
from datetime import date

import streamlit as st

reporting_period = st.date_input(
    "Reporting period",
    value=(date(2026, 8, 24), date(2026, 8, 28)),
    disabled_dates=["saturday", "sunday", date(2026, 9, 7)],
)
```

Allow only dates for which data exists:

```python
from datetime import date

import streamlit as st

available_dates = [
    date(2026, 8, 24),
    date(2026, 8, 25),
    date(2026, 8, 27),
]

selected_date = st.date_input(
    "Data snapshot",
    value=available_dates[-1],
    enabled_dates=available_dates,
)
```

Render an empty input when no appointments are available:

```python
selected_date = st.date_input(
    "Appointment",
    value=None,
    enabled_dates=[],
)
```

### Technical feasibility

This feature is feasible with moderate, contained changes across the existing date-input stack:

1. `st.date_input` was migrated from BaseWeb to React Aria in
   [#16460](https://github.com/streamlit/streamlit/pull/16460). The installed `DateField`,
   `Calendar`, and `RangeCalendar` types all expose `isDateUnavailable`. React Aria documents the
   same unavailable-date behavior for
   [DateField](https://react-spectrum.adobe.com/v3/DateField.html),
   [Calendar](https://react-spectrum.adobe.com/v3/Calendar.html), and
   [non-contiguous ranges](https://react-spectrum.adobe.com/v3/RangeCalendar.html#non-contiguous-ranges).
2. Normalize API inputs on the backend into exact ISO dates and ISO weekday numbers. Send one
   protobuf mode (`NONE`, `ALLOW`, or `BLOCK`) plus repeated dates and weekdays. A mode is necessary
   because protobuf repeated fields cannot distinguish `None` from an explicitly empty allowlist.
3. Build frontend sets once and expose a shared `isDateUnavailable(CalendarDate)` predicate. Pass
   it to both `DateField` instances and the single/range calendar. Use
   `allowsNonContiguousRanges` in range mode.
4. Extend Streamlit's own validation in `DateInput.tsx` and `updateWidgetMgrState`; React Aria alone
   is insufficient because custom paste, quick-select, form-commit, and widget-state paths can
   bypass calendar selection. The backend deserializer must also reject forged or stale frontend
   values before callbacks and return values use them.
5. `CalendarCell` already emits `data-unavailable`, but the current CSS groups it with disabled
   cells. Unavailable cells remain keyboard-focusable in React Aria, so give them a distinct visual
   affordance (for example, a strike-through) and text contrast of at least 4.5:1 rather than only
   using the low-contrast disabled color.

No new dependency or server round trip is needed. Exact-date lookup is O(1) per rendered calendar
cell after set construction; weekday lookup is constant-size. The implementation should add Python
unit tests for parsing/protobuf/state reset, frontend tests for all commit paths and range behavior,
typing tests for the new parameters, and focused E2E coverage for mouse and keyboard selection.

### Alternatives considered

**Option 1: `enabled_dates` and `disabled_dates`** ✅ Preferred

- Pros: Symmetric; `disabled_dates` follows the existing `disabled` vocabulary; supports concise
  allowlists and denylists without generating a complement.
- Cons: Two mutually exclusive parameters; `enabled_dates` requires documentation that all
  non-matching dates become unavailable.

**Option 2: `selectable_dates` and `unavailable_dates`**

- Pros: More explicit and matches React Aria's internal vocabulary.
- Cons: Long and asymmetric; introduces `unavailable` where Streamlit APIs normally use
  `disabled`.

**Option 3: A Python predicate such as `date_filter: Callable[[date], bool]`**

- Pros: Can express holidays, ranges, and arbitrary business rules without enumerating dates.
- Cons: The browser cannot execute an app's Python callable. Supporting it would require
  precomputing an entire bounded calendar or adding server round trips during navigation, making
  latency, serialization, reruns, and offline keyboard navigation substantially more complex.

## Out of scope

- Marking or annotating dates without restricting selection (#8058)
- Per-date colors, labels, tooltips, or metadata
- Date ranges as entries inside `enabled_dates` or `disabled_dates`
- Recurrence rules beyond weekdays
- Python availability callbacks or server requests while navigating the calendar
- Applying the parameters to `st.datetime_input`

## Checklist

<!--
Check the boxes or add a comment with the reason it cannot be checked.
-->

| Item | ✅ or comment |
|---|---|
| Works on SiS, Cloud, etc? | ✅ Uses the existing protobuf widget path and browser-local React Aria evaluation; no platform-specific behavior |
| No breaking API changes | ✅ Additive keyword-only parameters; existing behavior is unchanged when both are `None` |
| No new dependencies | ✅ Uses the installed React Aria and `@internationalized/date` packages |
| Metrics collected | ✅ Track whether `enabled_dates` or `disabled_dates` is configured through existing `st.date_input` parameter metrics; do not collect date values |
| Any security/legal impact? | No legal impact. Revalidate incoming values on the backend, but document that availability is a UI/business-rule constraint rather than an authorization boundary |
| Any docs changes needed? | ✅ Document accepted values, empty iterables, range endpoint semantics, dynamic updates, and examples for allowlists and weekends/holidays |
