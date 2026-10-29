# Widget constraint inventory

This is the research behind the [product spec](product-spec.md): every constraint the
browser enforces, what the server does with a client value that violates it as of
`develop` on 2026-10-28, and the plan item that covers it.

**How it was checked**

- Server behavior was checked by injecting forged `WidgetStates` through
  `AppTest._run(widget_state=...)`, unless a row says *(code)*, meaning it was checked by
  reading the code.
- The browser sends the option **label** (`format_func` output) for every option widget.
  The constraint facts are all on the widget's proto unless a row says otherwise.

**Columns**

- **Server today** says what happens to a forged value:
  - **pass:** accepted unchecked.
  - **late reset:** callbacks see the raw value, which widget code resets after
    registration.
  - **deser:** the deserializer coerces the value before callbacks, without telling the
    browser.
  - **raises:** an exception in the app run; *stuck* means every later run raises too.
- **Item** is the [delivery plan](product-spec.md#ranked-delivery-plan) item, or *out* or
  *done*.

## Every widget

| Constraint | Server today | Item |
| --- | --- | --- |
| Wire field matches the registered type | pass or raises (stuck). `WStates.__getitem__` overwrites `value_type` with whatever arrived. | 1 |
| Deserializer can read the value | raises (stuck): `_compact_state` and `__contains__` only catch `KeyError` | 1 |
| `disabled` | done (#16209), with three holes: a wrong field still crashes, a flip within a run splits the callback from the return value, and a bound widget's URL parameter still sets it *(code)* | 1 |
| Widget registered by the latest run that covered it | pass: metadata is never pruned, so callbacks of hidden, closed-dialog, or other-page widgets fire | 3 |
| Size of the message | done: `server.maxWidgetStateSize`, 25 MB total, no per-widget limit | — |

## Text

| Widget | Constraint | Browser | Server today | Item |
| --- | --- | --- | --- | --- |
| `text_input`, `text_area` | `max_chars` | Refuses the whole change past the limit, counting UTF-16 code units | deser: truncated | 4 |
| `text_input` | `validate` regex, and the defaults of `type="email"`/`"url"` | `RegExp(p, "us").test`; blocks the commit and the form submit | pass | out |
| `text_input`, `text_area` | `required` | Blocks an empty or whitespace-only commit and the form submit | pass | 5, 7 |
| `chat_input` | `max_chars` | Refuses past the limit | deser: truncated | 4 |
| `chat_input` | `accept_file`, `file_type`, `max_upload_size` | Filters files | Files sent when not accepted are ignored. In single mode, N files are all returned. A type violation raises *(code)*. Size is not checked. | 1 (the raise), 11 |
| `chat_input` | `submit_mode` | Blocks new submits while a run is going | pass | out |

## Numbers, dates, colors

| Widget | Constraint | Browser | Server today | Item |
| --- | --- | --- | --- | --- |
| `number_input` | `min_value`, `max_value` | Refuses to commit; never clamps | deser: reset to default, plus a late reset against this run's bounds | 4 |
| `number_input` | Integer type | `parseInt` | deser: truncated; `"42"` accepted; `"abc"` raises | 1, 4 |
| `number_input`, `time_input`, `datetime_input` | `step` | Typed values not snapped; only the arrow keys use it | pass | out |
| `number_input`, date and time inputs | `required` | Blocks an empty commit and the form submit | pass | 5, 7 |
| `slider` | Bounds, item count | Snapped and clamped | deser: reset to default | 4 |
| `slider` | Range order | Thumbs cannot cross | pass: `(80, 20)` returned | 4 |
| `slider` | `step` | Snapped to `min + n·step` or `max` | pass | out |
| `date_input` | `min_value`, `max_value`, ISO text | Refuses out of range | deser: reset to default | 4 |
| `date_input` | Range: at most 2, ordered | Reorders to start ≤ end | pass: a 3-tuple and a reversed range are returned | 4 |
| `datetime_input`, `time_input` | Bounds, ISO layout | Refuses | deser: reset to default | 4 |
| `color_picker` | `#rrggbb` | Hex from the picker | deser: reset, but `"#ffffff\n"` is accepted (`$` matches before a newline) | 4 |
| `pagination` | Integer in `1..num_pages` | Range-checked | deser: reset. `2.5` reaches the callback, then a late reset. A string raises. | 1, 4 |

## Options

| Widget | Constraint | Browser | Server today | Item |
| --- | --- | --- | --- | --- |
| `selectbox`, `radio` | `options` | Closed list | late reset. With int options that changed in the same run, the string `'3'` was returned instead of `3`. | 2 |
| `selectbox`, `multiselect` | `accept_new_options` | Any non-empty text | Any string, by design | 2: non-empty text stays legal |
| `multiselect` | `options` | Closed list | late reset: filtered after the callback | 2 |
| `multiselect` | `max_selections` | Refuses more | raises after the callback, with a message blaming `default` | 2 |
| `multiselect`, multi `pills` | No duplicates | Impossible in the UI | pass | 2 |
| `select_slider` | `options`, range | Index mapped to a label | deser: an unknown label falls back to the default; a reversed range is sorted | 2, 4 |
| `pills`, `segmented_control` | `options` | Closed list | deser in single mode; unknown values dropped in multi mode | 2 |
| `pills`, `segmented_control` | `required` in single mode | Cannot deselect | pass: the callback fires with `None` | 5 |
| `feedback` | Index range, or `""` to clear | Fixed icons; clicking the selected face again sends `""` | deser: reset; a non-numeric value raises | 1, 2 |
| `menu_button` | `options` | Closed list | done: an unknown option is no click | — |
| `tabs` | Tab labels | Closed list | late reset: an unknown label reaches `on_change`, then the widget code replaces it with the default | 2 |
| `checkbox`, `toggle` | Boolean | — | Truthiness of any field: `"false"` becomes `True` | 1 |
| Buttons, `form_submit_button` | Trigger field | — | Any truthy field fires: `string_value "x"` returns `"x"` and runs `on_click` | 1 |

## Forms, fragments, dialogs, navigation

| Constraint | Browser | Server today | Item |
| --- | --- | --- | --- |
| Fields change only with their form's submit | Edits stage in a pending map until submit; `clear_on_submit` defaults stage too | pass: applied at once | 7 |
| Submit blocked by `required`, `validate`, or an invalid number or date | Validators run before anything is sent | pass | 7 (`validate`: out) |
| Disabled submit button | Not clickable | The trigger is dropped, but the form's fields still apply | 7 |
| `clear_on_submit` | Performed by each widget in the browser | Not applied, apart from `AppTest`'s emulation | Agent follow-up #8, using item 7 |
| `fragment_id` of a rerun | Only fragments on the page | Unknown IDs are dropped. A stale fragment left by a run that ended in `st.stop()` or an exception still runs. | 9 |
| Widgets in a dialog a full rerun closed | Unmounted | pass: callbacks fire | 3 |
| Dialog the browser dismissed (`on_dismiss="ignore"`) | Unmounted | The server does not know | out |
| Page excluded from `st.navigation` | Not listed | done: falls back to the default page. `hidden` pages are routable by design. | — |

## Data editor and selections

| Constraint | Browser | Server today | Item |
| --- | --- | --- | --- |
| Whole editor `disabled=True` | Read-only | done (#16209) | — |
| `disabled=[cols]`, auto-disabled columns, hidden columns, types that cannot be edited | Edits dropped | pass | 6 |
| `num_rows` (`fixed`, `dynamic`, `add`, `delete`) | Gates adding and deleting | pass | 6 |
| Row and column existence | — | Negative rows pass; out-of-range rows and unknown columns raise | 6 |
| Edits to a `RangeIndex`; index uniqueness | Not editable; not checked | pass: renames the label, can duplicate the index | 6 |
| Added-row volume | No limit | pass: about 2 ms of script time per row | 6 |
| Column `required` | Null refused; incomplete added rows held back | pass | 10 |
| Number `min_value`, `max_value` | Clamps above `max`, refuses below `min`; `step` not validated | pass | 10 |
| Text and link `max_chars` | Text truncates; link refuses | pass | 10 |
| Text and link `validate` | JS regex | pass | out |
| Selectbox and multiselect column `options` | Refused or dropped | pass | 10 |
| Date and time column bounds | Compared as ISO strings | pass | 10 |
| Value types | Typed cells | pass, coerced: 3.9 becomes 3, `"false"` becomes `True`; huge integers raise | 10 |
| `ButtonColumn` click | Real rows | Shape and `row >= 0` checked; `row < num_rows` not checked | 8 |
| Dataframe `selection_mode`, bounds | Gated by mode | pass: `_validate_selection_state` exists but runs only for programmatic selections | 8 |
| Chart selections (Plotly, Vega-Lite, Deck.gl) | Mode and parameters | pass; bad JSON raises | 12 |

## Uploads

These rows were checked by reading the code. The upload route is
`PUT|DELETE /_stcore/upload_file/{session_id}/{file_id}`.

| Constraint | Browser | Server today | Item |
| --- | --- | --- | --- |
| `type` | MIME type or extension, from the browser's `file.type` | The extension check raises in the app. It is skipped entirely when any entry contains `/`, which includes the `image`, `audio`, `video`, and `text` shortcuts. | 1 (the raise), 11 |
| `server.maxUploadSize` | Checked | done: 413 at three layers | — |
| Per-widget `max_upload_size` | Checked; MB is ×1024 on Windows and ×1000 elsewhere | pass | 11 |
| `accept_multiple_files=False` | Keeps one file | done: the first ID is kept | — |
| File belongs to this session | — | done on read. PUT and DELETE accept any `file_id` and only check XSRF. | 11 |
| Quotas per session | — | None | 11 |
| Camera and audio size or duration | None on the proto either | — | out |

## Custom components

| Constraint | Server today | Item |
| --- | --- | --- |
| v1 values | pass: the deserializer is the identity function. Components declare no constraints. | out |
| v2 state keys | Undeclared keys pass through. Callbacks are limited to registered `on_<name>_change`. | out (possible follow-up) |
