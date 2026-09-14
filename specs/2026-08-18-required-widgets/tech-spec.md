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
extends from text inputs to selection and file widgets. First implementation is
[wave 1](#implementation-order) (typed widgets + selectbox/multiselect); radio,
pills/segmented gaps, and file-like widgets are a follow-up.

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

**Required-empty** and **validate-skip** are not the same predicate for text.
Check empty in the widget (or a text helper — see [Shared logic](#shared-logic));
do not invent a generic `isEmpty(widgetType, value)`.

| Family | Required-empty | Validate-skip (today) |
| --- | --- | --- |
| Text | `value == null \|\| value.trim() === ""` | `value == null \|\| value === ""` only |
| Number / date / time / datetime | `value == null` (range date: `()`, missing either bound, or a one-element `tuple[date]`) | n/a |
| Single select / radio / pills | no selection | n/a |
| Multi select / multi pills | `length === 0` | n/a |
| File uploader | no uploaded value in `WidgetStateManager` **and** no in-flight local files | n/a |
| Camera / audio | no local/staged capture (Clear is empty even if `WidgetStateManager` still holds the previous file) | n/a |

Do not fold whitespace into the validate-skip path. When `required=False`, `"   "` still
runs the regex.

Python does not need to re-check on deserialize for MVP (client-side, like `validate`).
Document the bypass. A later callable-`validate` follow-up can add a server path.

### Shared logic

Only two things are used by enough widgets, in the same way, to extract:

1. **`(required)` on `WidgetLabel`.** Every listed widget already renders
   `WidgetLabel`. Add `required?: boolean` and append muted, caption-sized
   `(required)` (`aria-hidden`) when `required && labelVisibility === visible`.
   `aria-required` stays on the control. Do **not** append the suffix in Python
   label markdown. Wave 1 lands this; later widgets pass `required={element.required}`.
2. **`REQUIRED_FIELD_MESSAGE`** (`"This field is required"`) plus
   **`isRequiredEmptyText`** (`null` / `trim() === ""`). Put them next to
   `TextInput/validation.ts` (or a tiny sibling). Text input and text area share
   the trim-vs-validate-skip distinction; it is easy to get wrong if inlined
   twice. `value == null` / `length === 0` / incomplete range stay inline in
   those widgets — they are not worth a shared taxonomy.

Reuse what already exists; do not wrap it:

- Form submit: `WidgetStateManager.addFormSubmitValidator`. Register from the
  widget when `required || hasValidationConfig`. The callback is per-widget
  (flush dirty `uiValue`, read local date bounds, …). Do not add
  `useFormSubmitValidator` unless the register/unregister effect becomes
  actually painful to copy.
- Typed-widget error chrome: write the required message into the existing
  `displayedError` / `validationError` slot. Do not add a parallel invalid UI
  or a `WidgetValidationError` component. Selectbox/multiselect copy the
  text-input icon + `role="alert"` pattern when they grow an error state;
  their layout is different enough that a shared component does not buy much.
- Proto: `bool required = N` on each widget message, like `disabled`.
- Python: set `proto.required`; omit `required` from element-ID kwargs. Copy
  the `st.pills` docstring. No mixin.

Do **not** share commit. `useBasicWidgetState` / `setValueWithSource` /
`on_change="ignore"` stay in the widget. No `useRequiredCommit`, no native
HTML `required`, no `canClearSelection` helper (`required && hasValue` is
inline).

### Commit pipeline (typed widgets)

Generalize text-input `validateBeforeCommit` to:

1. If required-empty and `required`: set required error, return `false`.
2. If validate-skip (`""` / `null` only): clear errors, return `true` (today's `validate`
   skip).
3. Otherwise run `validate` regex when present (today's path), including whitespace-only
   when `required=False`.

A `true` result still goes through the existing commit path, including
`on_change="ignore"` from
[`specs/2026-04-14-on-change-modes`](../2026-04-14-on-change-modes/product-spec.md)
(frontend holds the value, no rerun). A `false` result must **not** overwrite that
held value with empty or invalid: keep the last accepted pending value and set the
error on local UI only. `required` / `validate` are commit gates; `"ignore"` is only
the rerun policy after a passing commit.

Outside a form, a `false` result skips `commitWidgetValue` / `setValueWithSource`
(no rerun). Inside a form, blur/Enter stages into form pending state without
running the required check — the same as `validate` (`TextInput.handleBlur` calls
`commitWidgetValue()`, and `useOnInputChange` writes form pending on every
keystroke). The form-submit validator is what blocks the backend commit.
"Local field only" means "no backend commit," not "no `WidgetStateManager` write":
widgets without a separate `uiValue` lose the user's edit if the form-pending
write is skipped.

`type="search"` `handleClear` currently commits `""` immediately because empty bypasses
`validate`. When `required=True`, keep the clear X (typed-widget empty-while-editing)
but do not commit `""`. Outside a form, update local UI and set the required error.
Inside a form, stage into form pending with no error until submit (same as
backspace).

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

- Camera/audio: Clear is a typed-widget empty edit. Form submit reads **local/staged**
  capture, not `WidgetStateManager`:

  - **Clear:** local empty, required error, do not commit `None`.
  - **Recapture:** local non-empty; the validator flushes via
    `setFileUploaderStateValue` **before** returning true — the same as `TextInput`
    writing dirty `uiValue` in its form-submit validator — so `submitForm`
    serializes the new file, not the previous one.
  - **Recapture upload:** in-progress from first paint of the new capture until a
    *successful* upload (`files[].status.type === "uploaded"`), not merely
    `status === "ready"`. `CameraInput` also returns `"ready"` after a failed
    upload (`files[].status.type === "error"`), and `toWidgetState` then drops
    those files because it keeps only `"uploaded"`. `AudioInput` can still display
    a local recording when no uploaded-file state exists. Disable submit for that
    window; do not treat the widget as required-empty (the new capture is already
    visible). Today's `formsWithUploads` starts too late: only once `uploadFile` /
    `addFile` runs, after `urltoFile` / `fetchFileURLs`.
  - **After upload succeeds:** enable submit and run the flush above.
  - **Failed/cancelled recapture:** stay uncommittable; do not restore or submit
    the prior capture.

  Extending `formsWithUploads` for that recapture window is not enough:
  `formsWithUploads` only disables `FormSubmitButton` clicks and its shortcut.
  `allowFormEnterToSubmit` checks the submit-button proto `disabled` flag, not
  that set, and `TextInput` Enter calls `widgetMgr.submitForm` directly.
  `submitForm` itself does not consult `formsWithUploads`. Add a central upload
  gate (or an equivalent validator covering every submit path) so a replacement
  in flight cannot submit the stale committed file via Enter.

  (`WidgetStateManager` remains the source of truth for `st.file_uploader`, where
  last-file delete is locked so local UI and widget state cannot diverge to empty.)
- File uploader: lock deleting the last committed file when `required=True`; a new drop
  that replaces still commits. Register a form-submit validator that fails when
  `WidgetStateManager` is empty and `required=True`. Last-file lock also avoids the
  race where local UI is empty but widget state still holds the previous file.
- In-progress upload: for `st.file_uploader`, required-empty is
  `WidgetStateManager` empty **and** no in-flight local files. Do not treat
  `status === "updating"` alone as empty (a multi-file widget can be updating
  while already holding committed files). A first-file upload to an empty
  required uploader has empty widget state plus local pending files: that is
  not required-empty, so the required validator must not paint
  `This field is required` even if a central upload gate also returns false.
  Local pending files stay not-uploaded (do not flush them). Gate every submit
  path as specified above — not only `FormSubmitButton`. Camera/audio Clear is
  a different local state: that staged empty **is** the submit-time source of
  truth, as specified above.

Show the error on the dropzone / control. Use the visually hidden `role="alert"` pattern
from `TextInput`. On widgets whose root role ignores `aria-required`, include
`(required)` in the accessible name.

### Label marker

See [Shared logic](#shared-logic): `WidgetLabel` `required` prop. Muted, caption-sized
`(required)`, `aria-hidden`. Render only when `required && labelVisibility === visible`.

### Metrics

Record `required=True` on widget creation (existing parameter-usage metrics), same
pattern as `validate`.

### Implementation order

The API is specified for all empty-able input widgets. Do not leave a permanently
partial implementation, but **do not block wave 1** on radio, pills/segmented gaps,
or file-like widgets. See the product spec [Rollout](./product-spec.md#rollout).

`(required)` on `WidgetLabel` lands in wave 1 so later widgets only opt in.

**Wave 1 — typed widgets and clearable selects**

Reuse existing invalid-field chrome (`text_input` `validate`, `number_input` /
date-time range errors) and a straightforward empty-commit + form-submit gate.

1. **`st.text_input`** — extend `validateBeforeCommit`, `WidgetLabel` marker,
   `REQUIRED_FIELD_MESSAGE` / `isRequiredEmptyText`, search-clear. Proves
   composition with `validate`. Later wave-1 widgets reuse the label prop and
   the message constant.
2. **`st.text_area`** — same commit path, no `validate` yet; copy the error chrome
   from text_input.
3. **`st.number_input` / `st.date_input` / `st.time_input` / `st.datetime_input`** —
   empty/`None` commit already exists for clearable instances; add the required gate
   next to range errors. For range `st.date_input` (stays in wave 1: same widget):

   - Keep the incomplete range in DateInput local state. Today's calendar `value`
     is the committed widget state, so skipping the `setValueWithSource` write
     without a local display snaps back to the last committed parent value and
     the start date is lost.
   - Skip the widget-manager write until both bounds exist.
   - On blur/close **outside** a form, fail required if the range is still
     incomplete (no backend commit).
   - Inside a form, blur/close does not run the required check (same as other
     typed widgets). The form-submit validator reads **local/staged** bounds, not
     `WidgetStateManager`. Submit fails required if either bound is missing and
     must not serialize a previously committed `(start, end)`.
4. **`st.selectbox` / `st.multiselect`** — lock last value (hide/disable clear X /
   last remaining chip), add the same error chrome typed widgets already have,
   form-submit gate when still empty.

Wave 1 unblocks #13497 and most of #7165 (text/select form fields).

**Follow-up — option groups and file-like**

5. **`st.radio`** — same selection semantics as pills (no clear X; form gate +
   marker + error if still empty). Does not share text-field error chrome.
6. **`st.pills` / `st.segmented_control`** — form gate, label, error if still empty,
   allow multi-select `required`. Behavior extension of an existing parameter, not
   a new one.
7. **`st.file_uploader` / `st.camera_input` / `st.audio_input`** — form gate, marker,
   last-file lock, camera/audio Clear that does not commit empty.

Follow-up closes #14900, the 1.56 pills form-gating gap, and file-like empty-commit.

### Tests

**Wave 1**

- Frontend unit: empty commit blocked / allowed; `validate` still skipped for `""` /
  `null` when `required=False`; whitespace-only still runs `validate` when
  `required=False` and is a required error when `required=True`; required error vs
  validate error; form submit runs all validators; `clear_on_submit` not invoked on
  failure; search clear does not commit when required; selectbox/multiselect last
  value is locked; range `st.date_input` first bound is visible with no rerun and
  no required error until outside-form blur/close or form submit; re-edit a complete
  required range and submit after only the first bound fails required and does not
  send the previous bounds; `on_change="ignore"` + `required=True`: a passing
  unflushed edit, then clear, keeps the pending value (error on local UI) and does
  not flush empty on the next rerun.
- Python: proto field set on wave-1 widgets; `required` not in widget ID.
- Public typing tests (`lib/tests/streamlit/typing/`) for every wave-1 widget.
- E2E: form with two required fields (both errors on submit); outside-form
  text_input does not rerun on empty blur; email `type` + `required` (empty vs
  invalid vs valid); range `st.date_input` with `required=True` does not rerun on
  the first bound and does not show the required error until outside-form
  blur/close or form submit; re-editing a complete required range and submitting
  after only the first bound fails required; failed form submit exposes the
  required error via the visually hidden `role="alert"`.

**Follow-up**

- Frontend unit: file/camera/audio clear does not commit empty when required;
  last file-uploader delete is locked; camera/audio in a form: Clear after a
  capture blocks submit and does not send the previous file; recapture then
  submit sends the new file (validator flushes local capture before returning
  true); recapture upload in-progress (including before `uploadFile`) blocks
  submit without a required-empty error; failed or cancelled recapture stays
  uncommittable and does not restore or submit the prior capture; Enter during a
  replacement upload does not submit the stale committed file (covers
  `submitForm`, not only `FormSubmitButton`); first-file in-flight on an empty
  required `st.file_uploader` blocks submit without a required-empty error;
  empty required radio/pills blocks form submit; multi-select pills `required`
  does not raise and locks the last key.
- Python: pills multi-select no longer raises.
- Public typing tests for radio, pills / segmented_control overloads (new
  keyword-only arg and newly legal multi-select + `required`), and file-like
  widgets.
- E2E: pills required still cannot deselect; empty required pills blocks form
  submit; file/camera/audio required empty-commit and form-gate cases above.

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
