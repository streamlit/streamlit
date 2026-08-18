---
author: lukasmasuch
created: 2026-08-18
---

# `required` parameter — frontend commit gating and form submit

## Summary

Implement `required` as a client-side emptiness check on the same commit and form-submit
path that `st.text_input(..., validate=...)` already uses. See the
[product spec](./product-spec.md) for API, UX, and widget coverage. This spec covers proto
plumbing, how empty is defined, how `required` composes with `validate`, and how that
extends from text inputs to selection and file widgets.

## Problem

Empty commits are currently always allowed. `validate` on `st.text_input` **skips** `""` /
`None` by design (`validateBeforeCommit` in `TextInput.tsx` returns `true` when
`uiValue` is `null` or `""`, and `passesTextInputValidation` does the same). Form
submit already has a generic gate: `WidgetStateManager.addFormSubmitValidator` runs
every registered validator (no short-circuit) and aborts submit if any returns `false`.
Only text inputs with a `validate` regex register today. `required` should use that
mechanism instead of inventing a second form protocol.

Pills/segmented_control already send `required` on the proto and set
`disallowEmptySelection` for single-select. They do **not** register a form-submit
validator, so an empty required pills widget can still submit a form. Multi-select
`required=True` currently raises in Python.

## Proposal

### Proto

Add `bool required = N;` to each affected widget message (`TextInput`, `TextArea`,
`NumberInput`, `DateInput`, `TimeInput`, `DateTimeInput`, `Selectbox`, `Radio`,
`MultiSelect`, `FileUploader`, `CameraInput`, `AudioInput`). `ButtonGroup.required`
already exists (field 16); update its comment to cover multi-select and form gating.

Do **not** put `required` in the widget identity / element ID (same as `disabled`).
Toggling `required` must not reset state.

Python: keyword-only `required: bool = False`, forwarded onto the proto. Drop the
pills/segmented exception that raises on `required=True` + `selection_mode="multi"`.

### Empty check

Shared frontend helper, per widget family. **Required-empty** and **validate-skip**
are not the same predicate for text:

| Family | Required-empty | Validate-skip (today) |
| --- | --- | --- |
| Text | `value == null \|\| value.trim() === ""` | `value == null \|\| value === ""` only |
| Number / date / time / datetime | `value == null` (range date: `()`, missing either bound, or a one-element `tuple[date]`) | n/a |
| Single select / radio / pills | no selection | n/a |
| Multi select / multi pills | `length === 0` | n/a |
| File uploader | no uploaded value in `WidgetStateManager` | n/a |
| Camera / audio | no local/staged capture (Clear is empty even if `WidgetStateManager` still holds the previous file) | n/a |

Do not fold whitespace into the validate-skip path. When `required=False`, `"   "` still
runs the regex.

Python does not need to re-check on deserialize for MVP (client-side, like `validate`).
Document the bypass. A later callable-`validate` follow-up can add a server path.

### Commit pipeline (typed widgets)

Generalize text-input `validateBeforeCommit` to:

1. If required-empty and `required`: set required error, return `false`.
2. If validate-skip (`""` / `null` only): clear errors, return `true` (today's `validate`
   skip).
3. Otherwise run `validate` regex when present (today's path), including whitespace-only
   when `required=False`.

Outside a form, a `false` result skips `commitWidgetValue` / `setValueWithSource`
(no rerun). Inside a form, blur/Enter still updates the local field only — the
same as `validate` — and the form-submit validator is what blocks the backend
commit.

`type="search"` `handleClear` currently commits `""` immediately because empty bypasses
`validate`. When `required=True`, clear must only update local UI, set the required
error, and not commit.

Register a form-submit validator when `required || hasValidationConfig`, not only when
a regex is set. The validator calls the same `validateBeforeCommit`. `submitForm`
aborts before clearing form state, so `clear_on_submit` cannot run on a failed submit.
Keep `dirty` set on failure so `useUpdateUiValue` doesn't overwrite the value the user
is still correcting.

Error copy: `"This field is required"` for the required failure; keep the existing
`validate` message for content failures. `aria-required` is independent of error
visibility; `aria-invalid` / `aria-describedby` follow `displayedError`.

### Selection widgets

Keep / extend `disallowEmptySelection` (pills) and hide/disable the clear affordance
(selectbox X, multiselect clear-all and last remaining chip) once a value exists and
`required=True`.

That prevents the empty *interaction*. Still register a form-submit validator for the
case the widget **starts** empty (`index=None` / `default=None`) and the user hits
submit without choosing. On failure, set the widget error state (red outline + error
icon/tooltip on the label or control).

For multi-select pills, `disallowEmptySelection` on the last remaining key is the
implementation of "at least one." React Aria's `ToggleButtonGroup` already supports
this; the closed PR [#15483](https://github.com/streamlit/streamlit/pull/15483) is the
starting point.

Radio with `index=None` cannot click-deselect today; required adds the form gate +
marker + error if submit happens while still empty.

### File-like widgets

Delete file / Clear photo / clear recording **do** commit empty today. Match the product
spec:

- Camera/audio: Clear updates local UI without committing `None` to the backend, sets
  the required error, then a new capture commits (same pattern as `type="search"`
  clear when `required=True`). The form-submit validator uses the **local/staged**
  capture, like typed widgets' `validateBeforeCommit` reading `uiValue` — not
  `WidgetStateManager`. After Clear, local is empty so submit fails required and does
  not send the previous file. After recapture, if local is non-empty the validator
  must flush that capture into form pending state (`setFileUploaderStateValue`)
  **before** returning true — the same as `TextInput` writing dirty `uiValue` in its
  form-submit validator — so `submitForm` serializes the new file, not the previous
  one. An in-flight recapture already disables submit via `formsWithUploads`.
  (`WidgetStateManager` remains the source of truth for `st.file_uploader`, where
  last-file delete is locked so local UI and widget state cannot diverge to empty.)
- File uploader: lock deleting the last committed file when `required=True`; a new drop
  that replaces still commits. Register a form-submit validator that fails when
  `WidgetStateManager` is empty and `required=True`. Last-file lock also avoids the
  race where local UI is empty but widget state still holds the previous file.
- In-progress upload: for `st.file_uploader`, emptiness is the `WidgetStateManager`
  value, not `status === "updating"` (a multi-file widget can be updating while
  already holding committed files). Form submit is already disabled while
  `formsWithUploads` is set (`FormSubmitButton`); do not add a separate required-error
  path for in-flight uploads. Do not treat FileUploader component-local pending files
  as uploaded. Camera/audio Clear is a different local state: that staged empty **is**
  the submit-time source of truth, as specified above.

Show the error on the dropzone / control. Use the visually hidden `role="alert"` pattern
from `TextInput`. On widgets whose root role ignores `aria-required`, include
`(required)` in the accessible name.

### Label marker

Small shared suffix in `WidgetLabel` (or a sibling span): muted, caption-sized
`(required)`, `aria-hidden` (the accessible name stays the widget's `aria-label` /
`aria-labelledby`; `aria-required` carries requiredness). Render only when
`required && labelVisibility === visible`.

### Metrics

Record `required=True` on widget creation (existing parameter-usage metrics), same
pattern as `validate`.

### Implementation order

The API is specified for all empty-able input widgets. Land the work in reviewable
waves. The API contract covers every listed widget, so do not leave a permanently
partial implementation:

1. **`st.text_input`** — extend `validateBeforeCommit`, form-validator registration,
   search-clear, label marker. Proves composition with `validate`.
2. **`st.text_area`** — same commit path, no `validate` yet.
3. **`st.number_input` / `st.date_input` / `st.time_input` / `st.datetime_input`** —
   empty/`None` commit already exists for clearable instances; add the required gate
   next to range errors.
4. **`st.selectbox` / `st.radio` / `st.multiselect`** — lock last value + form gate.
5. **`st.pills` / `st.segmented_control`** — form gate, label, error if still empty,
   allow multi-select `required`.
6. **`st.file_uploader` / `st.camera_input` / `st.audio_input`** — form gate, marker,
   last-file lock, camera/audio Clear that does not commit empty.

Waves 1–2 are the smallest useful slice and unblock #13497. Wave 5 is a behavior
extension of an existing parameter, not a new one.

### Tests

- Frontend unit: empty commit blocked / allowed; `validate` still skipped for `""` /
  `null` when `required=False`; whitespace-only still runs `validate` when
  `required=False` and is a required error when `required=True`; required error vs
  validate error; form submit runs all validators; `clear_on_submit` not invoked on
  failure; search clear does not commit when required; file/camera/audio clear does
  not commit empty when required; last file-uploader delete is locked; camera/audio
  in a form: Clear after a capture blocks submit and does not send the previous file;
  recapture then submit sends the new file (validator flushes local capture before
  returning true).
- Python: proto field set; pills multi-select no longer raises; `required` not in
  widget ID.
- Public typing tests (`lib/tests/streamlit/typing/`) for every affected widget,
  especially the existing `pills` / `segmented_control` overloads (new keyword-only
  arg and newly legal multi-select + `required`).
- E2E: form with two required fields (both errors on submit); outside-form text_input
  does not rerun on empty blur; email `type` + `required` (empty vs invalid vs valid);
  pills required still cannot deselect; empty required pills blocks form submit;
  range `st.date_input` with `required=True` does not rerun on the first bound;
  failed form submit exposes the required error via the visually hidden `role="alert"`.

## Alternatives considered

**Backend reject of empty widget values.** Stronger, but must still allow the initial
empty default and programmatic `session_state` writes. Easy to get wrong; not needed
for MVP if we match `validate`'s client-side contract.

**Native HTML `required`.** Streamlit forms are not native form submits. The
`validate` spec already rejected React Aria / native constraint validation for this
reason.

**A new form protocol** (e.g. a `required_widget_ids` list on `Form`). Unnecessary —
`addFormSubmitValidator` already does fan-out without short-circuit.

**Raise `StreamlitAPIException` when `required=True` is used outside a form.** Safer
if we only cared about forms; conflicts with shipped pills `required` and with
`validate`'s outside-form gating. Rejected in the product spec.
