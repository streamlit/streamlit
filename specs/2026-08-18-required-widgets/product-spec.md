---
author: lukasmasuch
created: 2026-08-18
---

# `required` parameter for input widgets

## Summary

Add a `required: bool = False` parameter to input widgets that can be empty, so a field must
have a value before it is committed or a form is submitted. Empty commits are blocked in the
browser (no rerun), the widget shows the existing validation error state, and form submit is
gated the same way `st.text_input(..., validate=...)` already gates invalid values. This works
inside **and** outside `st.form`.

`required` is emptiness. `validate` is content. They compose: empty values fail `required` and
skip `validate`; non-empty values skip `required` and run `validate`.

## Problem

Streamlit has no built-in way to say "this input must be filled." Developers re-implement
that check after a rerun, which is slow, easy to get wrong, and fights `st.form(clear_on_submit=True)`.

### User requests

- [#7165](https://github.com/streamlit/streamlit/issues/7165) — Form fields required (144 👍).
  Top-tier request. Form submit currently succeeds with empty widgets; `clear_on_submit=True`
  then wipes valid fields even when the developer later rejects the submit.
- [#13497](https://github.com/streamlit/streamlit/issues/13497) — `required` on `st.text_input`.
  Asks for a required marker, no extra rerun, and `aria-required` for screen readers.
- [#9870](https://github.com/streamlit/streamlit/issues/9870) — `required` on `st.pills` /
  `st.segmented_control` (shipped in 1.56 for single-select). Users treat these as tab/radio
  replacements and need "one option always selected."
- [#14900](https://github.com/streamlit/streamlit/issues/14900) — Same `required` for
  multi-select pills ("at least one"). Not shipped; a follow-up PR
  ([#15483](https://github.com/streamlit/streamlit/pull/15483)) was closed.

`st.column_config` already has `required` on editable columns: an edit cannot be committed
while a required cell is empty. Input widgets should match that vocabulary.

### Why workarounds fail

```python
with st.form("signup"):
    name = st.text_input("Name")
    email = st.text_input("Email")
    submitted = st.form_submit_button("Submit")

if submitted:
    if not name.strip() or not email.strip():
        st.error("Name and email are required.")
    else:
        save(name, email)
```

- Validation only runs after a full (or fragment) rerun.
- `clear_on_submit=True` clears the form even when the developer then rejects the submit.
- Error copy lives in a separate `st.error`, not on the field that is wrong.
- The same pattern is worse *outside* a form: every keystroke/blur that empties a field
  reruns the app and tears down downstream UI.

### Use cases

1. **Signup / contact forms** — Name and email must be filled before submit; optional
   message can stay empty.
2. **Filters and tools outside forms** — A search box, SQL editor, or "run model" field
   should not rerun the app when the user clears it and tabs away. That empty-commit
   gate is not a substitute for batching every edit with `on_change="ignore"`.
3. **Pills / segmented control as tabs** — Always keep one option selected
   (`required=True, default="Overview"`). Already shipped; this spec extends the same
   parameter to the rest of the input API.
4. **Optional-empty widgets made mandatory** — `st.selectbox(..., index=None)`,
   `st.number_input(..., value=None)`, `st.file_uploader(...)` start empty. `required=True`
   is how developers opt those empty states into "must be provided."

### Relationship to `validate`

[`specs/2025-12-03-text-input-validation`](../2025-12-03-text-input-validation/product-spec.md)
shipped client-side regex `validate` on `st.text_input` and **explicitly skipped empty
values**:

> If the input is the empty string, validation is skipped. Requiredness is handled
> separately by a future `required` parameter.

`required` is that emptiness check, on the same commit/form-submit pipeline.
`type="email"` / `"url"` still accept a blank field until `required=True`. See
[`required` and `validate`](#required-and-validate).

### Relationship to `on_change="ignore"`

[`specs/2026-04-14-on-change-modes`](../2026-04-14-on-change-modes/product-spec.md)
is a rerun policy, not an emptiness check. `required` only blocks **empty** commits.

They compose: `required` and `validate` run first. A blocked empty value must not
replace an unflushed `"ignore"` pending value (typing `"world"` then clearing keeps
`"world"`). A passing commit follows `on_change` (`"rerun"`, a callable, or
`"ignore"`). `"ignore"` plus a button is not form-submit gating — a never-filled
field still returns the empty default (`if name:`).

## Proposal

### API

```python
st.text_input(..., *, required: bool = False)
```

Keyword-only `required: bool = False` on every input widget that can be empty (see
[Affected widgets](#affected-widgets)). Same name and meaning as
`st.pills(..., required=True)` and `st.column_config.*.required`. Custom message
strings and renaming the parameter to `clearable` are
[rejected](#alternatives-considered).

### Affected widgets

Add `required` everywhere an input can be empty. Widgets that always have a value are
omitted — a no-op `required` is worse than leaving the parameter off.

| Widget | Empty means | `required` already? | Wave |
| --- | --- | --- | --- |
| `st.text_input`, `st.text_area` | `None` or whitespace-only (`str.strip() == ""`) for **required**. `validate` skip remains `""` / `None` only (see [`required` and `validate`](#required-and-validate)). | No | 1 |
| `st.number_input`, `st.date_input`, `st.time_input`, `st.datetime_input` | `None` | No | 1 |
| `st.selectbox` | `None` (`index=None`) | No | 1 |
| `st.multiselect` | `[]` | No | 1 |
| `st.radio` | `None` (`index=None`) | No | Follow-up |
| `st.pills`, `st.segmented_control` | `None` / `[]` | Yes (single-select only) | Follow-up |
| `st.file_uploader`, `st.camera_input`, `st.audio_input` | `None` or `[]` | No | Follow-up |

In range-mode `st.date_input`, a complete `(start, end)` is non-empty. `()`, a missing
bound, and a one-element `tuple[date]` are empty. When `required=False`, today's
partial-range commit is unchanged.

**Not in this spec:** widgets that cannot be empty (`st.slider`, `st.color_picker`,
buttons) and meanings other than emptiness (`st.checkbox` / `st.toggle`,
`st.chat_input`, `st.feedback`, widget-level `st.data_editor` — columns already
have `required`). See [Out of scope](#out-of-scope-future-work).

### Rollout

The table above is the full API. Ship wave 1 first so PRs reuse existing invalid-field
chrome. Follow-up widgets stay in this spec, not "out of scope."

Wave 1 is typed widgets plus clearable selects — unblocks #13497 and most of #7165.
Range `st.date_input` stays in wave 1 (same command as single-date). Follow-up is
option groups (`st.radio`; pills/segmented form gate, `(required)` marker, multi-select
`required`) and file-like widgets. Implementation order is in the
[tech spec](./tech-spec.md).

### Core behavior

`required=True` means: **the widget's committed value must be non-empty.**

This is **not** "the script waits until the field is filled." Commands stay non-blocking
(API principle 32). The first run still returns the empty default; developers still write
`if name:` when downstream code cannot handle empty. What `required` prevents is a
*later* empty commit and an empty form submit.

| Moment | Empty + `required=True` | Result |
| --- | --- | --- |
| Initial render | Yes (default empty) | No error, no blocked script. Return value is the empty default. |
| User tries to commit empty **outside** a form (blur / Enter / change) | Yes | Error state. **No rerun.** Last accepted value is kept (backend, or unflushed frontend state when `on_change="ignore"`). |
| User blurs an empty field **inside** a form | Yes | No error yet — the value stages into form pending state without running the required check (same as `validate`). Gating happens at submit. |
| Form submit with any required field empty | Yes | Submit aborted (no rerun, no `clear_on_submit`). Every failing field shows its error. |
| User commits a non-empty value | No | Normal commit / submit. Then `validate` runs if configured. |

Do **not** disable `st.form_submit_button`. Let the user click, then show field errors.
Do **not** raise if `required=True` is used outside a form.

`required=True` does **not** change defaults. `st.selectbox(options)` still starts on
the first option; `st.number_input()` still starts at `min`. Empty required select:

```python
st.selectbox("Country", countries, index=None, required=True)
```

### `required` and `validate`

One pipeline, two checks, required first. A value that passes both is committed;
whether that commit reruns the app is `on_change`'s job:

| Current value | `required` | `validate` | Commit / form submit |
| --- | --- | --- | --- |
| `""` / `None` | `False` (default) | any | Allowed; `validate` is skipped (today's behavior) |
| Whitespace-only (`"   "`) | `False` (default) | any | `required` passes; `validate` runs on the raw string (today's behavior) |
| `""` / `None` / whitespace-only | `True` | any | **Blocked.** Message: `This field is required`. `validate` does not run |
| Non-empty after strip, invalid | any | regex / tuple | **Blocked.** `validate` message (today's behavior) |
| Non-empty after strip, valid | any | regex / tuple / none | Allowed |

```python
# Optional email: empty is OK, "foo" is not
st.text_input("Email", type="email")

# Required email: empty is not OK, "foo" is not OK, "a@b.co" is
st.text_input("Email", type="email", required=True)

st.text_input(
    "Username",
    required=True,
    validate=(
        r"^[a-z][a-z0-9_]{2,}$",
        "Use lowercase letters, digits, and underscores.",
    ),
)
```

Like `validate`, this is **client-side**. It can be bypassed. It is not a security
boundary; app code that cares must still check the Python value after submit.

### Two enforcement styles

Widgets differ in whether an empty UI is a reasonable in-progress state.

When `required=True`, **hide every explicit empty-commit control**: search X,
None-default number/date/time X, selectbox X, last multiselect/pills chip, last
file-uploader delete. Those buttons exist to commit empty. Keyboard emptying
(backspace, select-all + delete) stays on typed widgets.

**Typed widgets** (`text_input`, `text_area`, `number_input`, `date_input`, `time_input`,
`datetime_input`): empty UI while editing is allowed; empty *commit* is not.
Matches `validate`.

- Outside a form, on blur / Enter / change: if empty, show the error and do not send a
  value. Inside a form, blur/Enter stages into form pending without the required
  check; gating happens at submit.
- Incomplete range `st.date_input` is empty. Keep the incomplete range in local UI
  while the picker is open (no error, no commit). Error timing matches other typed
  widgets (outside-form blur/close vs in-form submit). Re-editing a complete range
  down to one bound must not send the previous `(start, end)`. Implementation is in
  the [tech spec](./tech-spec.md).

**Selection widgets** (`selectbox`, `radio`, `multiselect`, `pills`, `segmented_control`):
empty is "no choice," not an in-progress edit. Once a value is selected,
`required=True` prevents returning to empty.

If the widget still starts empty (`index=None` / `default=None`):
- Inside a form, submit is gated until the user picks something.
- Outside a form, `required` is a label plus "cannot clear after the first choice."
  Downstream code still uses `if country:`.

This is the shipped pills/segmented single-select behavior (`disallowEmptySelection`),
plus form-submit gating, the `(required)` label, and **multi-select** "at least one"
([#14900](https://github.com/streamlit/streamlit/issues/14900)).

**File-like widgets** (`file_uploader`, `camera_input`, `audio_input`): [follow-up](#rollout).
These **do** commit empty today. `required=True` blocks a later empty commit.

- **File uploader:** lock deleting the last file. A new drop still replaces. Form
  submit is gated while empty (`None` / `[]`). An upload in flight is not empty.
- **Camera / audio:** keep Clear — there is no select-all path; Clear is how the
  user recaptures. Clear does not commit `None`; a new capture commits. Recapture
  and upload gating live in the [tech spec](./tech-spec.md).

### Design

Reuse the validation error treatment already used by `st.text_input` / `st.number_input`
(red field, error icon, tooltip) — not a new visual language.

**Required marker** — append `(required)` to the visible label in caption-sized,
muted text. Prefer this over a bare `*` (too implicit). Show it whenever
`required=True` and the label is visible (`label_visibility="visible"`).
Hidden/collapsed labels rely on `aria-required` (or the accessible-name fallback
below) only.

![Required label marker](./required-label.png)

**Error state** — after a failed commit or failed form submit, the widget uses the
existing invalid-input treatment. Tooltip / `aria-describedby` text:
`This field is required`.

![Existing invalid-field chrome (red field, error icon, tooltip) — reference, not the final required copy](./required-error-state.png)

Typed widgets already have this chrome. Selection and file-like widgets should get the
same error icon + tooltip (on the label or control) and a red outline; exact placement
can be finalized in Figma against the [design-system invalid field](https://www.figma.com/design/svukmRMf0N9yQzdv8f7sgO/Streamlit-Open-Source-design-system?node-id=3135-130392).

**Accessibility**

- `aria-required="true"` whenever `required=True` (already done for pills). On
  widgets whose root role does not honor `aria-required` (file-uploader dropzone,
  camera, audio — and pills needed an imperative workaround), also include
  `(required)` in the accessible name via `aria-label` / `aria-labelledby`.
- `aria-invalid="true"` and `aria-describedby` pointing at the error text while the
  error is shown (already done for `validate`).
- Selection and file-like widgets must use the same visually hidden `role="alert"`
  linked by `aria-describedby` that `st.text_input` already uses. Tooltip-only error
  text is not announced on a failed form submit (no rerun, no focus change).

### Pills and segmented_control (existing `required`)

[Follow-up](#rollout). Keep the 1.56 behavior, then close the gaps so `required`
means the same thing everywhere:

| Today (single-select) | This spec |
| --- | --- |
| Cannot deselect once a value is selected | Unchanged |
| May start empty if `default` is unset | Unchanged — do not auto-select the first option |
| No `(required)` label | Add the marker |
| Empty required widget can still submit a form | Gate form submit; show error |
| `required=True` + `selection_mode="multi"` raises | Allow it: at least one selection |

### Examples

**Required fields in a form**

```python
import streamlit as st

with st.form("contact"):
    name = st.text_input("Name", required=True)
    email = st.text_input("Email", type="email", required=True)
    message = st.text_area("Message")
    submitted = st.form_submit_button("Send")

if submitted:
    send_email(name, email, message)
    st.success("Sent")
```

Empty name/email: submit does nothing, both fields show `This field is required`,
`clear_on_submit` does not run. Invalid email format: name can be valid while email
shows the `type="email"` validate message.

**Outside a form**

```python
import streamlit as st

query = st.text_input("SQL", required=True)
if query:
    st.dataframe(run_query(query))
```

Clearing the box and tabbing away does not rerun with `query == ""` (the table stays).
The field shows the required error until the user enters text again. First page load
still has `query == ""` and shows no table — `if query:` remains necessary. Valid
edits still rerun; add `on_change="ignore"` if those should wait for another widget.

**Pills as tabs (already possible)**

```python
page = st.segmented_control(
    "Page",
    ["Overview", "Details", "Logs"],
    default="Overview",
    required=True,
)
```

**Empty-start select, required to proceed**

```python
country = st.selectbox("Country", countries, index=None, required=True)
if country:
    st.write(f"Selected {country}")
```

**File upload in a form** (follow-up)

```python
with st.form("upload"):
    f = st.file_uploader("CSV", type="csv", required=True)
    if st.form_submit_button("Ingest"):
        ingest(f)
```

### Edge cases

- **Return types do not narrow.** `st.selectbox(index=None, required=True)` stays
  `V | None` because the first run can still be empty. Existing pills overloads that
  narrow when `required=True` and `default` is set stay as they are. Multi-select
  `required` still returns `list[V]` with no non-empty guarantee.
- **`disabled=True`.** A disabled empty required field can trap a form. Do not raise
  (disabled is often toggled dynamically); document the footgun.
- **`label_visibility`.** `(required)` is omitted when the label is hidden or
  collapsed; `aria-required` remains.
- **`bind="query-params"`.** Same caveat as `validate`: inside a form, keystrokes may
  still stage into widget/URL state before submit-time gating. Failed submit does not
  apply values on the server. Outside a form, a blocked empty commit must not write
  the empty value into the URL.
- **Fragments and dialogs.** Same commit/submit gating as the page; a fragment rerun
  is the rerun that gets blocked.
- **Programmatic `st.session_state[key] = ""`.** Allowed (like bypassing client
  `validate`). The error appears on the next user commit/submit, not on the
  programmatic write.
- **AppTest / tampered client.** Client-side only; tests can still set empty values.
- **Widget identity.** Changing `required` must not reset the widget (same as
  `disabled`). Do not hash `required` into the element ID.

## Out of Scope (Future Work)

- **Custom required message** (`required="Enter your name"`).
- **Server-side enforcement** / callable `validate`. When callables ship, `required`
  still runs client-side first so empty values never hit the callable.
- **`required` on checkbox/toggle** ("must be checked") — different meaning than
  emptiness.
- **`st.chat_input`** — trigger widget; empty submit is a separate interaction model.
- **`st.feedback`** — empty means no opinion yet, not a missing data field.
- **Widget-level `required` on `st.data_editor`** — columns already have it.
- **Native HTML `required` / browser bubble** — Streamlit forms are not native
  `<form>` submits; `validate` already rejected that path.
- **Auto-selecting a default** when `required=True` and no `default`/`index` is set
  (would make "required but empty until the user picks" impossible).
- **`min_selections` / "at least N"** — `required=True` on multi-select is the
  `min_selections=1` special case. `st.multiselect` already has `max_selections`.

## Alternatives considered

**Restrict `required=True` to forms; raise outside.** Rejected: illegal where pills
already use it, and it blocks the outside-form "don't rerun on clear" use case.
`validate` already shipped the outside-form commit-gate.

**Disable the submit button while required fields are empty.** Rejected: users don't
learn *why* they can't submit. Click-then-error is the standard pattern.

**Asterisk instead of `(required)`.** Common on the web, but easy to miss.
`(required)` is explicit.

**`required: bool | str`** (custom message as the string). Overloads a boolean;
pills already ship `bool`. Defer; `validate=(regex, message)` covers content copy.

**`clearable` instead of `required`.** Describes the X on selectbox/number_input, not
form gating or text inputs. When `required=True`, hide every explicit empty-commit
control; clearable-without-required stays "has an empty default."

**Keep the `type="search"` clear X when `required=True`.** Search is still a text
field. Select-all + delete already empties it. The X's job is to commit `""`.

**Only ship on `st.text_input`.** Too narrow given #7165 and the pills precedent.
Wave 1 is typed widgets + selectbox/multiselect, not text_input alone.

**Skip `required` when `disabled=True` (HTML constraint-validation precedent).**
Rejected for v1: `validate` does not skip disabled widgets either. Document the
disabled-empty-required form trap.

## Checklist

| Item                      | ✅ or comment                                                                 |
| ------------------------- | ----------------------------------------------------------------------------- |
| Works on SiS, Cloud, etc? | ✅ Frontend commit/submit gating; no new backend runtime dependency            |
| No breaking API changes   | ✅ Wave 1 is a new optional param (`False`) only. **Follow-up (pills/segmented):** allowing `required` in multi-select is additive (today it raises). **Intentional behavior fix in that follow-up:** empty shipped `required` pills/segmented widgets will start failing form submit (today those forms still submit). Not a deprecation; changelog should call out closing the 1.56 form-gating gap. |
| No new dependencies       | ✅ Reuses `validate` error UI and `addFormSubmitValidator`                     |
| Metrics collected         | ✅ Track `required=True` usage per widget                                      |
| Any security/legal impact? | Client-side only; document that app code must still check values if it matters |
| Any docs changes needed?  | Yes — `required` on each **shipped** widget (wave 1 first); how it composes with `validate` and `on_change="ignore"`; first-run empty still returned |
