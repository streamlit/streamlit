---
author: jrieke
created: 2025-11-22
---

# Control selectable dates in `st.date_input`

## Summary

Add optional `enabled_dates` and `disabled_dates` parameters to `st.date_input` so apps can
allow or block individual dates and weekdays. The feature applies to calendar selection, typed and
pasted values, range endpoints, quick-select presets, Session State, and query-parameter values.

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
DateLike = date | datetime | str
DateFilter = Collection[DateLike] | DateLike


def date_input(
    label: str,
    value: DateValue = "today",
    min_value: date | datetime | str | None = None,
    max_value: date | datetime | str | None = None,
    # Existing parameters...
    *,
    format: str = "YYYY/MM/DD",
    enabled_dates: DateFilter | None = None,
    disabled_dates: DateFilter | None = None,
    disabled: bool = False,
    # Existing parameters...
) -> DateWidgetReturn: ...
```

A bare `date`, `datetime`, ISO string, `"today"`, or weekday name is a one-element collection.
`str` is handled as a scalar first so `enabled_dates="monday"` is not iterated as characters.
Accept list-likes the way widget `options` does (lists, tuples, sets, pandas `Series` and `Index`,
and NumPy arrays), so `df["date"].unique()` works as an allowlist. `DateFilter` above is
simplified; the real annotation also admits these array-likes, following `OptionSequence`.
Materialize once before identity, protobuf, and validation reads. Reject generators, which can be
consumed twice, and DataFrames.

Each entry accepts:

- `datetime.date` and `datetime.datetime` values, including pandas `Timestamp` (`datetime`
  subclass). Time information is ignored, consistent with `value`.
- ISO-formatted date or datetime strings accepted by `value`.
- `"today"`.
- English weekday names: `"monday"` through `"sunday"`. Integer weekday numbers such as
  `date.weekday()` (`0`–`6`) or `date.isoweekday()` (`1`–`7`) are rejected.

Strip surrounding whitespace from every string before parsing. Weekday matching is additionally
case-insensitive. Exact dates and weekdays can be mixed. Convert NumPy `datetime64` entries to
dates during normalization. Other invalid values raise a parameter-specific Streamlit exception
that lists the accepted forms.

### Availability rules

| Configuration | Selectable dates |
|---|---|
| Both parameters are `None` | Existing behavior: every date within `min_value` and `max_value` |
| `enabled_dates` is set | Only matching exact dates and weekdays within the min/max window |
| `disabled_dates` is set | Every date in the min/max window except matching exact dates and weekdays |
| Both parameters are set | Raise an exception, including when either collection is empty |

Additional rules:

- Exact dates and weekdays within one parameter use union semantics. For example,
  `enabled_dates=["monday", date(2026, 8, 27)]` enables every Monday plus August 27.
- Materialize, validate, deduplicate, and sort once before element-ID and protobuf processing.
  Exact filter dates outside the min/max window have no effect on availability, so they are
  dropped from the protobuf but not from the element ID (see widget identity below).
- An empty `enabled_dates` collection makes every date unavailable; use it with `value=None` (or an
  empty range value) when an app temporarily has no available dates. An empty `disabled_dates`
  collection disables nothing.
- The scalar `value="today"` (default or explicit) matches existing min/max handling: it resolves
  to a selectable date in the min/max window instead of raising. Keep today if it is selectable;
  otherwise use the next selectable date, then the previous. If none exists, resolve to `None`
  (single date) or an empty range, so an app whose availability list is empty on some runs does
  not crash. The default overload stays typed `-> date`, so an app whose list can be empty should
  pass `value=None`.
- Every other non-empty explicit value must already be selectable, including both endpoints of a
  complete range, the start of a partial range, and `"today"` as a range tuple entry. Raise at the
  `st.date_input` call if it is not. This deliberately departs from Specs Principle 23 (fail
  fast): `value=date.today()` with weekends disabled raises only on weekends. The error message and
  docstring tell users to pass `value="today"`, which snaps instead of raising.
- Default bounds ignore availability. When `min_value` or `max_value` is `None`, derive it from
  `value` as today; for `value="today"`, use the current date before `"today"` snaps to a
  selectable date.
- Widget identity and resets:
  - Like `min_value` / `max_value`, the normalized availability config is part of the unkeyed
    element ID, so changing availability remounts a keyless widget. With a user `key`, it stays out
    of identity (`key_as_main_identity={"format"}` today).
  - The ID hashes the config before bounds filtering, so a moving `"today"` bound never changes
    it. Only the protobuf drops exact dates outside the min/max window, because they cannot be
    selected.
  - A literal `"today"` entry in `enabled_dates` or `disabled_dates` stays symbolic in the ID, like
    `"today"` in `value`, `min_value`, and `max_value`, so a keyless widget does not reset when the
    day rolls over. The browser receives the date `"today"` resolved to at script run. A session
    left open across midnight keeps the previous day's availability until the next rerun, the same
    as `min_value="today"`.
  - When a keyed widget's availability configuration changes and invalidates its current frontend,
    Session State, or query-parameter value, reset it to the resolved default above. Remove an
    invalid bound query parameter when resetting it. Run this reset even when `min_value` and
    `max_value` are omitted: the existing bounds validation is skipped without explicit bounds, so
    availability needs its own check.
- Weekday names are fixed ISO days (Monday=1 … Sunday=7), independent of the user's locale and of
  the calendar's week start. `"monday"` blocks or allows every Monday whether the calendar shows
  Sunday or Monday first; the week start only changes the column order. There is no `"weekend"`
  shorthand because the weekend differs by locale; apps list the days they mean, for example
  `["saturday", "sunday"]`. Weekday names are English only; localized names are rejected.
- `required=True` follows its existing rules. It does not add a constructor error for
  availability: a required widget whose window has no selectable date (for example,
  `enabled_dates=[]`) renders empty and the existing required behavior applies: a blocked empty
  commit shows the required error, and inside a form the widget blocks submit. A required
  single-date widget returns `None` and a required range returns `()` in that state, as for any
  empty required value. Apps that build the list dynamically should handle the empty case
  themselves, for example by disabling the widget.
- Other widget behavior follows the same validate-and-reset path as Session State and
  query-parameter values:
  - With `on_change="ignore"`, availability is enforced the same way: an unavailable date is
    rejected before it is committed. Only the rerun is skipped.
  - Inside an `st.form`, an unavailable typed or pasted date shows the inline error and is not
    staged, so it cannot reach submit.
  - With `bind="query-params"`, an unavailable URL value is dropped and the default is used,
    as for an out-of-bounds URL value.
  - With `persist_state`, a restored value is validated against the current availability before
    it is used. Reset it to the resolved default if it is no longer selectable.
- A date entered through the segmented field or paste path is validated before commit. An
  unavailable value leaves the last committed widget value unchanged and shows the existing inline
  error treatment with an actionable message such as: `Date is unavailable. Choose an available
  date.`

### Range behavior

Availability applies to range endpoints, not every calendar day between them. A range may cross
unavailable weekends or holidays as long as its selected start and end are available. This matches
the stock-market use case in #1839: a Monday-to-Monday query remains possible even though the
intervening weekend cannot be chosen as an endpoint.

React Aria's `RangeCalendar` supports this with `allowsNonContiguousRanges`. Unavailable interior
dates keep their unavailable visual treatment while `st.date_input` continues to return one
inclusive `(start, end)` tuple; Streamlit does not remove or split interior dates from the value.

The existing range quick-select row matches `maxDate` clamping rather than dropping every preset
that touches an unavailable day. Snap inward so a preset never covers more days than its label:
move an unavailable start forward to the nearest available date at or after it, and an
unavailable end back to the nearest available date at or before it, both within the min/max
window. For example, with weekends disabled, "Past Week" on a Saturday spans a Saturday to a
Saturday, so it snaps to the Monday after the first Saturday through the Friday before the
second. Drop a preset only when no available start, no available end, or the snapped start is
after the snapped end. Keep the preset's label unchanged. If no presets remain, hide the row. The
commit handler still revalidates a selected preset so quick select cannot bypass the rule.

### Design

Unavailable calendar cells must stay visually distinct from fully disabled cells. The current CSS
groups `data-unavailable` with `data-disabled`; change that so unavailable cells use a strike-
through (or equivalent) and text contrast of at least 4.5:1 rather than only the low-contrast
disabled color. Confirm that React Aria does not also set `data-unavailable` on out-of-range
cells, so the new treatment only affects dates blocked by availability. Confirm the visual
treatment with design at implementation; a mockup is not attached here.

Unavailable cells remain keyboard-focusable in React Aria. When a keyboard user lands on one,
announce that the date is unavailable (React Aria typically exposes this via `aria-disabled` on the
cell). The typed/paste path already uses `role="alert"` and `aria-describedby`; the calendar cell
must provide an equivalent accessible signal. Screen readers often announce `aria-disabled` as
just "disabled", so verify what the focused cell says and add an explicit accessible description
if it does not convey that the date is unavailable.

The calendar's week start and month names follow the user's locale, and the unavailable
treatment applies to the same weekdays regardless of which column they fall in. The inline error
text stays English like the existing date-input messages; an announcement React Aria generates
for an unavailable cell may use the user's locale.

### Examples

Disable weekends (default `"today"` stays today on weekdays, or the next weekday):

```python
import streamlit as st

trading_day = st.date_input("Trading day", disabled_dates=["saturday", "sunday"])
```

Disable weekends and a holiday in a range:

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
2. Normalize API inputs on the backend into exact ISO dates and ISO-8601 weekday numbers
   (Monday=1 … Sunday=7, matching `date.isoweekday()`). Send one protobuf mode (`NONE`, `ALLOW`, or
   `BLOCK`) plus repeated dates and weekdays. A mode is necessary because protobuf repeated fields
   cannot distinguish `None` from an explicitly empty allowlist.
3. Build frontend sets once and expose a shared `isDateUnavailable(CalendarDate)` predicate. Pass
   it to both `DateField` instances and the single/range calendar. Use
   `allowsNonContiguousRanges` in range mode. The predicate must not depend on locale:
   - Compare exact dates with calendar-aware helpers (`compare` / `isSameDay`) rather than field
     equality, because React Aria passes dates in the calendar system its locale selects (which
     may not be Gregorian).
   - Derive the ISO weekday independently of locale. Locale-relative helpers such as
     `getDayOfWeek(date, locale)` follow the locale's week start.
   - Test with a locale whose week starts on a different day (for example `en-US` and `de-DE`) and
     with a non-Gregorian locale (for example `th-TH` or `ar-SA`).
4. Extend Streamlit's own validation in `DateInput.tsx` and `updateWidgetMgrState`; React Aria alone
   is insufficient because custom paste, quick-select, form-commit, and widget-state paths can
   bypass calendar selection. Callback deserialization runs before the script, so validation is
   two-stage: reject incoming state against the previously rendered availability configuration
   before callbacks, then validate or reset against this run's configuration before the call
   returns.
5. Apply the Design section's unavailable-cell visual and screen-reader treatment.
6. Describe the new parameters for the agent API and AppTest:
   - Agent API: `agent_spec.element("date_input", ...)` reports `enabled_dates` and
     `disabled_dates` as the weekday names plus the exact dates (ISO strings, `"today"` resolved)
     that the browser receives, and omits them when `None`, because they change which values a
     request may send. Dates dropped from the protobuf for being outside the min/max window are
     not reported. The agent API's
     coverage test requires every parameter to be reported or listed as omitted. A request with
     an unavailable date is rejected by the same backend validation as a browser request.
   - AppTest: `DateInput` exposes the availability configuration the way it exposes `min` and
     `max`. `set_value()` with an unavailable date behaves like an out-of-bounds value today: the
     backend rejects it and the widget falls back to its default value.

No new dependency or server round trip is needed. Exact-date lookup is O(1) per rendered calendar
cell after set construction; weekday lookup is constant-size. The payload and the element-ID hash
grow linearly with the number of exact dates (about 2,500 ISO strings, roughly 30 KB, for ten years
of trading days); weekday names add a constant amount. The implementation should add Python
unit tests for parsing/protobuf/state reset, frontend tests for all commit paths and range behavior,
typing tests for the new parameters, AppTest and agent API coverage, and focused E2E coverage for
mouse and keyboard selection. Include these cases: the `"today"` snap, an empty allowlist, both
parameters set, query-parameter removal, and the Saturday quick-select snap.

The range calendar is the riskiest part. `RangeDateInput.tsx` has custom anchor, drag, and
commit logic around React Aria's `RangeCalendar` (the first-click anchor, `commitBehavior="reset"`,
and press-and-drag). Non-contiguous ranges change how those interact, and the same code is
affected by [#2429](https://github.com/streamlit/streamlit/issues/2429) (rerunning after the
first range click). Sequence the two changes deliberately and cover single-click, drag, and
keyboard range selection across unavailable days. The visual treatment of unavailable cells needs
a design mockup at implementation time; the Design section specifies the requirements.

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

**Option 4: Separate weekday parameters such as `disabled_weekdays`**

- Pros: `Literal["monday", ...]` is autocompletable; typos fail at type-check time; leaves a
  clearer slot for future recurrence rules.
- Cons: The common case is weekends plus a few holidays, which then needs two parameters (or four
  if enable/disable are both split). Mixing a small closed set of weekday names with dates in one
  collection keeps the API to two mutually exclusive parameters. Invalid weekday strings still
  fail immediately at the call, same as other `st.date_input` string inputs.

**Option 5: One parameter plus a mode, such as `dates=[...]` with `mode="allow" | "block"`**

- Pros: One name, and the "both set" error cannot happen.
- Cons: The call site no longer shows whether the list is an allowlist or a denylist, and the
  mode argument can silently flip the meaning. Two named parameters keep each call
  self-describing, and the "both set" error is deterministic and raised at the call.

## Out of scope

- Marking or annotating dates without restricting selection (#8058)
- Per-date colors, labels, tooltips, or metadata
- Date ranges as entries inside `enabled_dates` or `disabled_dates`
- Recurrence rules beyond weekdays
- Python availability callbacks or server requests while navigating the calendar
- Date-specific validators or callables, such as the future date-input validation listed in the
  [text-input validation spec](../2025-12-03-text-input-validation/product-spec.md). Availability
  is a declarative constraint, not a validator.
- Applying the parameters to `st.datetime_input`. The date-only proto mode, ISO dates, and weekday
  numbers can be reused later; a time component would need extra validation (whether availability
  is date-level or datetime-level) and is not designed here.

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
| Any docs changes needed? | ✅ Document accepted values, empty collections, range endpoint semantics, `"today"` resolution, locale-independent weekday names, dynamic updates, and examples for allowlists and weekends/holidays |
