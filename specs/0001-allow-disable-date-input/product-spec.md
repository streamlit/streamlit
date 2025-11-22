---
author: @jrieke
created: 2025-11-22
status: Draft
---

# Enable/disable dates in `st.date_input`

## Summary

Add optional `enabled_dates` / `disabled_dates` parameters to `st.date_input`
so apps can whitelist or block specific dates and weekdays.

## Problem

Requests:

- #1839 and #7062 want to block selecting weekends and
  holidays on dashboards, e.g. for stock-market data.
- #8058 wants to allow users to only select dates with data availability.

Note that we didn't want to add this in the past because we were thinking about moving
`st.date_input` away from BaseWeb to support `st.datetime_input` (#6089). But we found
(and merged) a solution that works with BaseWeb, so I think it's safe to do these
additional improvements for `st.date_input` now.

## Proposal

### API

```python
st.date_input(
    ...,
    enabled_dates: Sequence[date | str] | None = None,
    disabled_dates: Sequence[date | str] | None = None,
)
```

- Both parameters should accept a list of dates, which can be either:
  - One of the types accepted by `value` except for `"today"` (e.g. `datetime.date` or
    `"YYYY-MM-DD"` string)
  - A weekday name: `"monday"`, `"tuesday"`, `"wednesday"`, `"thursday"`, `"friday"`,
    `"saturday"`, `"sunday"`. We should trim and lowercase the input strings (so
    "Monday" should be treated as "monday"). Invalid weekday names should raise an exception.
- It should be possible to mix and match (e.g.
  `enabled_dates=[date(2025, 2, 10), "monday"]`).

## Naming

- `enabled_dates` and `disabled_dates`: symmetric, rhymes with `disabled` parameter,
  even though "enabled" doesn't make it very obvious that other dates are disabled
- `allowed_dates` and `disabled_dates`: slightly more explicit, but not very symmetric
- `selectable_dates` and `unselectable_dates`: a bit odd and long
- `include_dates` and `exclude_dates`: sounds good but "include" isn't very intuitive

### Behavior

- If a weekday name is provided in `enabled_dates` or `disabled_dates`, all days of the
  week that match the name should be enabled/disabled.
- Always start from the `min_value`/`max_value` window. If an enabled/disabled date is
  outside this window, ignore it.
- If both `enabled_dates` and `disabled_dates` are provided, raise an exception.
- If only `enabled_dates` is provided, all dates should be disabled except for the ones
  in the list.
- If only `disabled_dates` is provided, all dates should be enabled except for the ones
  in the list.
- If the date for `value` (or both if it's a range) isn't an enabled date, raise an
  exception. This also means that if _no_ dates are enabled, it should raise an
  exception (since we need to at least have one enabled date for `value`).

### Examples

```python
st.date_input(
    "Delivery slot",
    enabled_dates=[
        date(2025, 2, 10),
        date(2025, 2, 12),
        date(2025, 2, 15),
    ],
)

st.date_input(
    "Weekday meeting",
    enabled_dates=["monday", "tuesday", "wednesday", "thursday", "friday"],
)

st.date_input(
    "Visitor center",
    disabled_dates=["saturday", "sunday", date(2025, 5, 9)],
)
```

## Checklist

- [x] Will this work on all deployment platforms (e.g. [Streamlit Community Cloud](https://streamlit.io/cloud), [Streamlit in Snowflake](https://www.snowflake.com/en/product/features/streamlit-in-snowflake/), [Hugging Face Spaces](https://huggingface.co/spaces))?
- [x] No breaking API changes?
- [x] No new dependencies?
- [x] Metrics collected?
- [x] Any security or legal implications?
- [x] Anything to keep in mind for docs?
- [x] Any other risks?
