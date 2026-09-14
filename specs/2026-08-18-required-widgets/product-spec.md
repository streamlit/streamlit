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

`st.column_config` already has `required` on editable columns. Input widgets use
the same name; emptiness is not identical (see [Affected widgets](#affected-widgets)).

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
   should not rerun the app when the user clears it and tabs away. Blocking the empty
   commit is narrower than `on_change="ignore"`, which holds back every edit, not
   just empty ones.
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

They compose on widgets that already accept `on_change="ignore"` (wave 1:
`st.text_input`, `st.number_input`, `st.selectbox`, `st.multiselect`). This spec
does not add `"ignore"` plumbing to `st.text_area`, `st.date_input`,
`st.time_input`, or `st.datetime_input`.

`required` and `validate` run first. A blocked empty value must not replace an
unflushed `"ignore"` pending value (typing `"world"` then clearing keeps
`"world"`). A passing commit follows `on_change` (`"rerun"`, a callable, or
`"ignore"`). `"ignore"` plus a button is not form-submit gating — a never-filled
field still returns the empty default (`if name:`).

### Relationship to `live`

[`specs/2026-08-03-text-input-live-update`](../2026-08-03-text-input-live-update/product-spec.md)
says empty strings still bypass `validate` and commit. `required=True` overrides
that empty bypass. Timing (no error while focused; paint on blur / Enter / submit)
is in [Core behavior](#core-behavior).

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

`st.column_config.TextColumn` treats only `None` / `undefined` as missing (an empty
string is a valid required cell). Widget text is stricter: whitespace-only is
required-empty after `strip()`. Widget commit vs cell editing; this spec does not
change column config.

**Not in this spec:** widgets that cannot be empty (`st.slider`, `st.color_picker`,
buttons) and meanings other than emptiness (`st.checkbox` / `st.toggle`,
`st.chat_input`, `st.feedback`, widget-level `st.data_editor` — columns already
have `required`). See [Out of scope](#out-of-scope-future-work).

### Rollout

The table above is the full API. Ship the Wave 1 column first (typed widgets plus
clearable selects — unblocks #13497 and most of #7165). Follow-up stays in this spec,
not out of scope. Implementation order is in the [tech spec](./tech-spec.md).

### Core behavior

`required=True` means: **the widget's committed value must be non-empty.**

This is **not** "the script waits until the field is filled." Commands stay non-blocking
(API principle 32). The widget still returns the empty default on every rerun until the
user provides input; developers still write `if name:` when downstream code cannot
handle empty. What `required` prevents is a *later* empty commit and an empty form
submit.

| Moment | Empty + `required=True` | Result |
| --- | --- | --- |
| Initial render | Yes (default empty) | No error, no blocked script. Return value is the empty default. |
| Unedited empty blur / Enter **outside** a form (`dirty === false`; focus then Tab) | Yes | No error. Same as initial render: looking at the field is not a failed commit. |
| Empty live debounce (`live=True`) | Yes | Blocked empty commit: last accepted value kept, **no rerun**. Do not paint the required error while focused (mid-backspace). Paint on blur / Enter / form submit. |
| User tries to commit empty **outside** a form after an edit (blur / Enter / change / search-clear) | Yes | Error state. **No rerun.** Last accepted value is kept (backend, or unflushed frontend state when `on_change="ignore"`). The field renders empty with an error; `st.session_state[key]` and the return value still hold the previous non-empty value. A rerun from another widget must **not** snap the field back to that stored value (keep `dirty`). |
| User blurs an empty field **inside** a form (Enter without form submission) | Yes | No error yet — the value stages into form pending state without running the required check (same as `validate`). When `enter_to_submit=True` and Enter submits the form, that is form submit, not this row. Gating happens at submit. |
| Form submit with any required field empty | Yes | Submit aborted (no rerun, no `clear_on_submit`). Every failing field shows its error. |
| User commits a non-empty value | No | Run `validate` if configured; commit or submit only if validation passes. |

Do **not** disable `st.form_submit_button` because a required field is empty.
Let the user click, then show field errors. In-flight upload disable is unchanged.
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
| `""` / `None` / whitespace-only | `True` | any | **Blocked.** Message: `This field is required.` `validate` does not run |
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

### Enforcement styles

Widgets differ in whether an empty UI is a reasonable in-progress state.

When `required=True`, hide the explicit empty-commit controls: search X,
None-default number/date/time X, selectbox X, last multiselect/pills chip, last
file-uploader delete. Those buttons exist to commit empty. Camera/audio Clear is
the exception — it is the recapture path, so it stays but no longer commits
`None` (see File-like widgets). Keyboard emptying (backspace, select-all +
delete) stays on typed widgets.

**Typed widgets** (`text_input`, `text_area`, `number_input`, `date_input`, `time_input`,
`datetime_input`): empty UI while editing is allowed; empty *commit* is not.
Matches `validate`. Commit vs submit timing is in [Core behavior](#core-behavior).

Incomplete range `st.date_input` is empty. Keep the incomplete range in local UI
while the picker is open (no error, no commit). Re-editing a complete range down to
one bound must not send the previous `(start, end)`. Implementation is in the
[tech spec](./tech-spec.md).

**Selection widgets** (`selectbox`, `radio`, `multiselect`, `pills`, `segmented_control`):
empty is "no choice," not an in-progress edit. Once a value is selected,
`required=True` prevents returning to empty.

If the widget still starts empty (`index=None` / `default=None`):
- Inside a form, submit is gated until the user picks something.
- Outside a form, `required` is a label plus "cannot clear after the first choice."
  Downstream code still uses `if country:`.

Shipped vs follow-up pills/segmented gaps are in
[Pills and segmented_control](#pills-and-segmented_control-existing-required).

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
`required=True` and the label is visible (`label_visibility="visible"`), including
when the label string is empty — then `(required)` is the only visible label
content. Hidden/collapsed labels rely on `aria-required` (or the accessible-name
fallback below) only.

![Required label marker](./required-label.png)

**Error state** — after a failed commit or failed form submit, the widget uses the
existing invalid-input treatment. Tooltip / `aria-describedby` text:
`This field is required.` Later widgets copy this constant (including the period).

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
| `required=True` + `selection_mode="multi"` raises | Allow it: at least one selection ([#14900](https://github.com/streamlit/streamlit/issues/14900)) |

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

Empty name/email: submit does nothing, both fields show `This field is required.`,
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
The field shows the required error until the user enters text again. The widget still
returns `""` on every rerun until the user provides input — `if query:` remains
necessary.

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
  `V | None` because the widget can still return empty until the user provides
  input. Existing pills overloads that narrow when `required=True` and `default`
  is set stay as they are. Multi-select `required` still returns `list[V]` with no
  non-empty guarantee.
- **`disabled=True`.** Do not raise (disabled is often toggled dynamically).
- **`st.multiselect(..., max_selections=1, required=True)`.** Last-chip lock plus
  the existing "Remove an option first" cap can deadlock (the user cannot change
  the only selected option). Wave 1 ships this known limitation: the uniform
  last-chip lock applies; no swap/replace hatch and no API reject. Changelog
  should call it out. A later product call can add a swap hatch or reject the
  combo. `st.selectbox(..., required=True)` still allows replacing the selection.
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
- **Widget identity.** Not the same as `disabled` (`disabled` is omitted even
  without a key). Later wave-1 widgets copy this split:

  | | `required` in identity? | Why |
  | --- | --- | --- |
  | No `key` | Yes | Two unkeyed fields that differ only by `required` should be distinct, like other call kwargs |
  | With `key` | No (not on `key_as_main_identity`) | Unlike `max_chars` / `validate`, flipping `required` never makes a **stored** value illegal. `""` is still valid in session state; `required` only gates later empty commits |

  So `st.text_input("Name", required=flag)` **without** a `key` remounts when
  `flag` changes. With a `key`, the value is kept. Shipped pills omit `required`
  from the ID; the pills follow-up should add this split.
- **Required chrome follows `required` and emptiness.** Show
  `This field is required.` only while `required` is true **and** the field is
  still empty. A keyed widget can go `True → False` without remounting, or
  `st.session_state[key] = "hello"` can fill the field; leftover chrome after a
  failed empty commit must clear.

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
- **Developer warning / docs callout** for `disabled=True` + empty + `required=True`
  inside a form. Wave 1 does not raise, warn, or document that trap.
- **Auto-selecting a default** when `required=True` and no `default`/`index` is set
  (would make "required but empty until the user picks" impossible).
- **`min_selections` / "at least N"** — `required=True` on multi-select is the
  `min_selections=1` special case. `st.multiselect` already has `max_selections`.

## Alternatives considered

**Restrict `required=True` to forms; raise outside.** Rejected: illegal where pills
already use it, and it blocks the outside-form "don't rerun on clear" use case.
`validate` already shipped the outside-form commit-gate.

**Disable the submit button while required fields are empty.** Rejected: users don't
learn *why* they can't submit. Click-then-error is the standard pattern. Existing
in-flight-upload disable is a serialization safety gate, not this rule.

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
Rejected for v1: `validate` does not skip disabled widgets either.

## Checklist

| Item                      | ✅ or comment                                                                 |
| ------------------------- | ----------------------------------------------------------------------------- |
| Works on SiS, Cloud, etc? | ✅ Frontend commit/submit gating; no new backend runtime dependency            |
| No breaking API changes   | ⚠️ Wave 1 is a new optional param (`False`) only. Follow-up pills/segmented: additive multi-select `required`, and empty required widgets start failing form submit (see [Pills](#pills-and-segmented_control-existing-required)). Changelog the 1.56 form-gating gap. |
| No new dependencies       | ✅ Reuses `validate` error UI and `addFormSubmitValidator`                     |
| Metrics collected         | ✅ Track `required=True` usage per widget                                      |
| Any security/legal impact? | Client-side only; document that app code must still check values if it matters |
| Any docs changes needed?  | Yes — `required` on each **shipped** widget (wave 1 first). Docstrings match `st.text_input`: submit gate, form vs outside, default until the user provides input, empty skips `validate`, browser-bypass. Not `on_change="ignore"` composition. |
