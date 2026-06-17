
# Streamlit input widgets

The right widget for the value you're collecting. This covers value-entry widgets — where the user types or picks a number, date, time, or string. For choosing from a fixed set of options (single/multi-select), see [selection-widgets.md](selection-widgets.md). For buttons and other triggers (action menus, downloads, links), see the trigger-widgets reference.

The core rule: match the widget to the data type. Don't collect numbers, dates, or times through `st.text_input` and parse the string yourself — that crashes on bad input and gives you no bounds or validation. Use a widget that returns the right Python type directly.

## Which widget for which data

| Data type | Widget | Returns |
|-----------|--------|---------|
| Any number | `st.number_input` | `int` / `float` |
| Bounded number where the range matters visually | `st.slider` | number, or `(lo, hi)` tuple |
| Date | `st.date_input` | `date`, or `(start, end)` tuple |
| Time of day | `st.time_input` | `time` |
| Date + time together | `st.datetime_input` | `datetime` |
| Free text | `st.text_input` / `st.text_area` | `str` |
| Secret / password entry | `st.text_input(type="password")` | `str` |

## Numbers: st.number_input

Use it for any numeric entry. Always set `min_value`, `max_value`, and `step` so the value stays in range, and use `format` for currency or percent display.

```python
# BAD: text input parsed to int — crashes on "twenty", no bounds
age = int(st.text_input("Age"))

# GOOD: bounded, typed, can't produce a bad value
age = st.number_input("Age", min_value=0, max_value=120, step=1)
```

`format` is a printf-style string controlling display only (the return value is still a number):

```python
price = st.number_input("Price", min_value=0.0, step=0.50, format="$%.2f")
rate = st.number_input("Rate", min_value=0.0, max_value=100.0, format="%.1f%%")
```

The return type follows `min_value`/`step`: integer args give an `int`, float args give a `float`.

## Bounded ranges: st.slider

Use a slider when the value lives in a known range and seeing the position helps (volume, thresholds, year ranges). Set `min_value`, `max_value`, `step`, and an initial `value`.

```python
threshold = st.slider("Confidence threshold", min_value=0.0, max_value=1.0, value=0.5, step=0.05)
```

Pass a tuple as `value` to get a range slider returning `(low, high)`:

```python
low, high = st.slider("Price range", min_value=0, max_value=1000, value=(200, 800), step=50)
```

`st.slider` also accepts `date`, `time`, and `datetime` bounds when you want a draggable range rather than a calendar.

## Dates and times: st.date_input / st.time_input / st.datetime_input

Never collect a date through a text input — use the typed widget so you get a real `date`/`time`/`datetime` back and the user gets a picker.

```python
# BAD: free text, then parse — locale-fragile, crashes on bad input
start = datetime.strptime(st.text_input("Start date"), "%Y-%m-%d").date()

# GOOD: returns a datetime.date, with a calendar picker
start = st.date_input("Start date")
```

`st.date_input` supports a date range by passing a tuple/list `value`; it then returns a `(start, end)` tuple:

```python
start, end = st.date_input("Reporting period", value=(date(2026, 1, 1), date(2026, 3, 31)))
```

`st.time_input` returns a `datetime.time` (use `step` to set the granularity). `st.datetime_input` (recent — Streamlit 1.57+) collects a date and time together and returns a single `datetime`, replacing the old two-widget pattern.

**Gotcha — `st.datetime_input`'s `format` is DATE-ONLY.** It accepts exactly `"YYYY/MM/DD"` (default), `"DD/MM/YYYY"`, or `"MM/DD/YYYY"`, optionally using `.` or `-` as the separator. It does NOT take a time component: `format="YYYY-MM-DD HH:mm"` raises `StreamlitAPIException` and crashes the app on render. To change the time granularity use `step=` (a `datetime.timedelta` or an int number of seconds, between 60s and 23h), not `format`. If you don't need a custom date display, omit `format` entirely.

## Free text: st.text_input / st.text_area

`st.text_input` for one line, `st.text_area` for multi-line. Use `placeholder` for a hint, `max_chars` to cap length.

```python
name = st.text_input("Full name", placeholder="Jane Doe", max_chars=100)
bio = st.text_area("Bio", placeholder="A few sentences about yourself", max_chars=500)
```

`type="password"` masks the input — useful for collecting an API key or secret the user pastes in:

```python
api_key = st.text_input("API key", type="password")
```

A masked text input is *not* authentication — it only hides characters on screen. For real sign-in (identity, protected pages), use `st.login` / `st.user`; see [multipage-apps.md](multipage-apps.md).

## Actions and triggers

For buttons and button-like trigger widgets — `st.button`, action/toolbar menus (`st.menu_button`), file downloads (`st.download_button`), and URL links (`st.link_button`) — see the trigger-widgets reference. They fire an action on click rather than holding a value, so they live in their own reference.

## Batching inputs

Every widget interaction triggers a full rerun by default. To collect several inputs and rerun only once on submit, wrap them in `st.form` with an `st.form_submit_button` — see [performance.md](performance.md).

## References

- [st.number_input](https://docs.streamlit.io/develop/api-reference/widgets/st.number_input)
- [st.slider](https://docs.streamlit.io/develop/api-reference/widgets/st.slider)
- [st.date_input](https://docs.streamlit.io/develop/api-reference/widgets/st.date_input)
- [st.time_input](https://docs.streamlit.io/develop/api-reference/widgets/st.time_input)
- [st.datetime_input](https://docs.streamlit.io/develop/api-reference/widgets/st.datetime_input)
- [st.text_input](https://docs.streamlit.io/develop/api-reference/widgets/st.text_input)
- [st.text_area](https://docs.streamlit.io/develop/api-reference/widgets/st.text_area)
- [st.form](https://docs.streamlit.io/develop/api-reference/execution-flow/st.form)
