---
Author(s): @jrieke
Status: Draft
---

# Allow/disable dates in `st.date_input`

## Summary

Add optional `allowed_dates` / `disabled_dates` parameters to `st.date_input`
so apps can whitelist or block specific dates and weekdays.

## Problem

Requests:

- (27 :thumbsup:) #1839 and (16 :thumbsup:) #7062 want to block selecting weekends and holidays on dashboards, e.g. for
  stock-market data.
- (12 :thumbsup:) #8058 wants to allow users to only select dates with data availability.

## Proposal

### API

```python
st.date_input(
    ...,
    allowed_dates: Collection[date | str] | None = None,
    disabled_dates: Collection[date | str] | None = None,
)
```

- Both parameters should accept a list of dates, which can be either:
  - One of the types accepted by `value` (e.g. `datetime.date` or ISO `YYYY-MM-DD`
    strings).
  - A weekday name: `"monday"`, `"tuesday"`, `"wednesday"`, `"thursday"`, `"friday"`,
    `"saturday"`, `"sunday"`. We should trim and lowercase the input strings (so
    "Monday" should be treated as "monday"). All days of the week that match the name
    should be allowed/disabled.
- It should be possible to mix and match (e.g.
  `allowed_dates=[date(2025, 2, 10), "monday"]`).

### Behavior

- Always start from the `min_value`/`max_value` window. If an allowed/disabled date is
  outside this window, ignore it.
- If both `allowed_dates` and `disabled_dates` are provided, raise an exception.
- If only `allowed_dates` is provided, all dates should be disabled except for the ones
  in the list.
- If only `disabled_dates` is provided, all dates should be enabled except for the ones
  in the list.
- If the date for `value` (or both if it's a range) isn't an allowed date, raise an
  exception.

### Examples

```python
st.date_input(
    "Delivery slot",
    allowed_dates=[
        date(2025, 2, 10),
        date(2025, 2, 12),
        date(2025, 2, 15),
    ],
)

st.date_input(
    "Weekday meeting",
    allowed_dates=["monday", "tuesday", "wednesday", "thursday", "friday"],
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
