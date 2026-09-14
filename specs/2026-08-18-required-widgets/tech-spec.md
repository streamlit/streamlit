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
[wave 1](#implementation-order) (typed widgets + `st.selectbox`); radio,
`st.multiselect`, pills/segmented gaps, and file-like widgets are a follow-up.

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

Pass `required` into `compute_and_register_element_id` as a normal kwarg (like
`help` / `type`). Do **not** add it to `key_as_main_identity` (unlike `max_chars`
/ `validate`) and do **not** omit it like `disabled`. No `key`: two calls that
differ only by `required` get distinct IDs and remount if `required` flips. With
a `key`: the stored value is kept — flipping `required` never makes a stored
value illegal (`""` stays valid in session state; `required` only gates later
empty commits). Later wave-1 widgets copy this split. Pills today omit
`required` from the ID; add the split in the pills follow-up.

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
2. **`REQUIRED_FIELD_MESSAGE`** (`"This field is required."`) plus
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
  `displayedError` / `validationError` slot. Selectbox copies the
  text-input icon + `role="alert"` pattern; do not add a shared
  `WidgetValidationError` component.

Do **not** share commit. No `useRequiredCommit`, no `canClearSelection` helper.

### Commit pipeline (typed widgets)

Generalize text-input `validateBeforeCommit` to:

1. If required-empty and `required`: set required error, return `false`.
2. If validate-skip (`""` / `null` only): clear errors, return `true` (today's `validate`
   skip).
3. Otherwise run `validate` regex when present (today's path), including whitespace-only
   when `required=False`.

Typed widgets that skip a second commit when the dirty value equals the last
accepted value must run required / `validate` **before** that short-circuit. An
empty default is the last accepted value, so type-then-clear would otherwise
skip the required error.

Do **not** bypass the `dirty === false` / unchanged-value early return just to
paint on tab-through. Unedited empty blur/Enter (focus then Tab on first render)
does not show the required error. The error appears after the user empties a
previously accepted value, after type-then-clear (gates before the last-accepted
short-circuit), or on form submit.

`live=True` empty debounce is a blocked empty commit (last accepted kept, no
rerun) but does **not** paint the required error while focused. Paint on blur /
Enter / submit. `handleClear` (search X) must call the same `validateBeforeCommit`
path — today's empty skip that commits `""` is the hole.

`on_change="ignore"` composition applies only where that mode already exists
(`st.text_input`, `st.number_input`, `st.selectbox` in wave 1; `st.multiselect`
when it ships). Do not add ignore-mode proto/runtime plumbing on `st.text_area` /
`st.date_input` / `st.time_input` / `st.datetime_input` as part of `required`.

Show `This field is required.` only while `element.required` is true **and** the
current UI value is still required-empty. A keyed widget can toggle `required`
`True → False` without remounting, or a script can write
`st.session_state[key] = "hello"`; do not leave a sticky `hasRequiredError` (or
equivalent) painted. Gate `displayedError` / `aria-invalid` on the current proto
flag **and** current emptiness.

A `true` result still goes through the existing commit path, including
`on_change="ignore"` where that mode exists. A `false` result must **not**
overwrite a held `"ignore"` pending value with empty or invalid: keep the last
accepted pending value and set the error on local UI only.

Outside a form, a `false` result skips `commitWidgetValue` / `setValueWithSource`
(no rerun). Inside a form, blur and Enter-without-submit stage into form pending
state without running the required check — the same as `validate`
(`TextInput.handleBlur` calls `commitWidgetValue()`, and `useOnInputChange`
writes form pending on every keystroke). When `enter_to_submit=True` and an
enabled submit button exists, Enter calls `widgetMgr.submitForm` and **must**
run the required validator. The form-submit validator is what blocks the
backend commit. "Local field only" means "no backend commit," not "no
`WidgetStateManager` write": widgets without a separate `uiValue` lose the
user's edit if the form-pending write is skipped.

When `required=True`, hide the search X and the None-default number/date/time X
(see the product spec). If `handleClear` still runs, do not commit `""`.

Register a form-submit validator when `required || hasValidationConfig`, not only when
a regex is set. The validator calls the same `validateBeforeCommit`. `submitForm`
aborts before clearing form state, so `clear_on_submit` cannot run on a failed submit.
Keep `dirty` set on failure so `useUpdateUiValue` doesn't overwrite the value the user
is still correcting.

Error copy: `"This field is required."` for the required failure; keep the existing
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

File-like widgets are follow-up ([below](#file-like-widgets-follow-up)).

### Metrics

Record `required=True` on widget creation (existing parameter-usage metrics), same
pattern as `validate`.

### Implementation order

The API is specified for all empty-able input widgets. Do not leave a permanently
partial implementation, but **do not block wave 1** on radio, `st.multiselect`,
pills/segmented gaps, or file-like widgets. See the product spec [Rollout](./product-spec.md#rollout).

`(required)` on `WidgetLabel` lands in wave 1 so later widgets only opt in.

**Wave 1 — typed widgets and `st.selectbox`**

Reuse existing invalid-field chrome (`text_input` `validate`, `number_input` /
date-time range errors) and a straightforward empty-commit + form-submit gate.

1. **`st.text_input`** — extend `validateBeforeCommit`, `WidgetLabel` marker,
   `REQUIRED_FIELD_MESSAGE` / `isRequiredEmptyText`, hide the search X when
   `required=True`. Proves composition with `validate`. Later wave-1 widgets reuse
   the label prop and the message constant.
2. **`st.text_area`** — same commit path, no `validate` yet; copy the error chrome
   from text_input.
3. **`st.number_input` / `st.date_input` / `st.time_input` / `st.datetime_input`** —
   empty/`None` commit already exists for clearable instances; add the required gate
   next to range errors. Hide the None-default clear X when `required=True` (keyboard
   emptying while editing stays). For range `st.date_input` (stays in wave 1: same widget):

   - Keep the incomplete range in DateInput local state **when `required=True`**.
     Today's calendar `value` is the committed widget state, so skipping the
     `setValueWithSource` write without a local display snaps back to the last
     committed parent value and the start date is lost. When `required=False`,
     keep today's one-bound commit; do not buffer locally or skip the
     widget-manager write.
   - Skip the widget-manager write until both bounds exist **only when
     `required=True`**.
   - On blur/close **outside** a form, fail required if the range is still
     incomplete (no backend commit).
   - Inside a form, blur/close does not run the required check (same as other
     typed widgets). The form-submit validator must read **currently displayed**
     bounds, not `WidgetStateManager`. Those bounds live in child-local
     `displayStart` / `displayEnd` on `RangeDateInput`; the parent only sees the
     last committed pair. Add an explicit parent-child staging interface (ref
     or callback) so the validator can read the displayed bounds. Submit fails
     required if either bound is missing and must not serialize a previously
     committed `(start, end)` even when the user has not blurred.
4. **`st.selectbox`** — lock last value (hide/disable the clear X), add the same
   error chrome typed widgets already have, form-submit gate when still empty.

Wave 1 unblocks #13497 and most of #7165 (text/select form fields). Wave-1
docstrings match the `st.text_input` `required` contract: submit gate; form vs
outside (outside: clearing does not rerun, last committed value kept; inside:
submit blocked until the field has a value); the widget still returns its default
until the user provides input; empty skips `validate`; browser-bypass note. Do
not expand later widgets with `on_change="ignore"` composition. Widget-specific
extras (last-value lock on selectbox) stay. Do **not** copy the
current `st.pills` docstring (single-select deselect locking; `required=True` +
`selection_mode="multi"` raises). Reuse that wording only as a starting point
for the pills/segmented follow-up, and update those docs when multi-select
`required` becomes legal.

**Follow-up — option groups, `st.multiselect`, and file-like**

5. **`st.radio`** — same selection semantics as pills (no clear X; form gate +
   marker + error if still empty). Does not share text-field error chrome.
6. **`st.multiselect`** — last-chip lock on every remove path (clear-all, chip
   remove, Backspace/Delete, option toggle — separate handlers in
   `Multiselect.tsx`), error chrome, form-submit gate when still empty. Copy
   selectbox chrome. `max_selections=1` + `required=True` ships the documented
   deadlock unless a product call lands first.
7. **`st.pills` / `st.segmented_control`** — form gate, label, error if still empty,
   allow multi-select `required`. Behavior extension of an existing parameter, not
   a new one.
8. **`st.file_uploader` / `st.camera_input` / `st.audio_input`** — form gate, marker,
   last-file lock, camera/audio Clear that does not commit empty.

Follow-up closes #14900, the 1.56 pills form-gating gap, `st.multiselect`, and
file-like empty-commit.

### File-like widgets (follow-up)

Delete file / Clear photo / clear recording **do** commit empty today. Match the
product spec: lock last-file delete; keep camera/audio Clear but do not commit
`None`.

- Camera/audio: Clear is a typed-widget empty edit. Form submit reads **local/staged**
  capture, not `WidgetStateManager`:

  - **Clear outside a form:** blocked empty commit — show the required error, do
    not commit `None`.
  - **Clear inside a form:** local empty edit, no error until submit (same as
    other typed widgets). The form-submit validator reads that local empty and
    fails required; it must not serialize the previous file.
  - **Recapture:** local non-empty; the validator flushes via
    `setFileUploaderStateValue` **before** returning true — the same as `TextInput`
    writing dirty `uiValue` in its form-submit validator — so `submitForm`
    serializes the new file, not the previous one.
  - **Recapture upload:** in-progress from **recording/capture start** (not only
    first paint of the new capture) until a *successful* upload
    (`files[].status.type === "uploaded"`), not merely `status === "ready"`.
    `AudioInput.startRecording` already clears the previous local recording
    (`handleClear({ updateWidgetManager: false })`) before a new capture is
    painted, while widget state still holds the previous file — gating only from
    first paint leaves an Enter/`submitForm` window for stale audio. `CameraInput`
    also returns `"ready"` after a failed upload (`files[].status.type === "error"`),
    and `toWidgetState` then drops those files because it keeps only `"uploaded"`.
    `AudioInput` can still display a local recording when no uploaded-file state
    exists. Disable submit for that window; do not treat the widget as
    required-empty (the new capture is already visible, or recording has started).
    Today's `formsWithUploads` starts too late: only once `uploadFile` /
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

  Today's `setFormsWithUploadsInProgress` **replaces the entire shared set**, so
  independent audio/file-upload writers can clear each other's gate. The central
  gate must be owner-aware or reference-counted (or validator-only coordination)
  so concurrent uploads cannot drop another widget's in-flight flag.

  (`WidgetStateManager` remains the source of truth for `st.file_uploader`, where
  last-file delete is locked so local UI and widget state cannot diverge to empty.)
- File uploader: lock deleting the last committed file when `required=True`; a new drop
  that replaces still commits. A single-file replacement currently deletes the
  committed file before the replacement upload succeeds (`replaceExistingFileIfNeeded`
  → `deleteFile`). `toWidgetState` keeps only `"uploaded"` files, so a failed
  replacement can commit empty. Retain the old committed file/state until the
  replacement succeeds (inside and outside forms). Register a form-submit validator
  that fails when `WidgetStateManager` is empty and `required=True`. Last-file lock
  also avoids the race where local UI is empty but widget state still holds the
  previous file.
- In-progress upload: for `st.file_uploader`, required-empty is
  `WidgetStateManager` empty **and** no in-flight local files. Do not treat
  `status === "updating"` alone as empty (a multi-file widget can be updating
  while already holding committed files). A first-file upload to an empty
  required uploader has empty widget state plus local pending files: that is
  not required-empty, so the required validator must not paint
  `This field is required.` even if a central upload gate also returns false.
  Local pending files stay not-uploaded (do not flush them). Gate every submit
  path as specified above — not only `FormSubmitButton`. Camera/audio Clear is
  a different local state: that staged empty **is** the submit-time source of
  truth, as specified above.

Show the error on the dropzone / control. Use the visually hidden `role="alert"`
pattern from `TextInput`. On widgets whose root role ignores `aria-required`,
include `(required)` in the accessible name.

### Tests

**Wave 1**

- Frontend unit: empty commit blocked / allowed; unedited empty blur/Enter
  (`dirty === false`) does not show the required error; `validate` still skipped for
  `""` / `null` when `required=False`; whitespace-only still runs `validate` when
  `required=False` and is a required error when `required=True`; required error vs
  validate error; form submit runs all validators; `clear_on_submit` not invoked on
  failure; search X and None-default number/date/time X are hidden when required;
  type-then-clear from an empty default still shows the required error (gates run
  before the last-accepted short-circuit); `live=True` + `required=True`: empty live
  debounce is blocked (last accepted kept, no rerun) and does not paint the
  required error while focused; `handleClear` does not bypass `validateBeforeCommit`;
  keyed widget `required` `True → False` or `st.session_state[key] = "hello"`
  after a failed empty commit clears the required error and `aria-invalid`;
  selectbox last value is locked (clear X hidden); range `st.date_input` first bound is visible with no rerun and
  no required error until outside-form blur/close or form submit; re-edit a complete
  required range and submit after only the first bound with **no prior blur** fails
  required and does not send the previous bounds; `required=False` range still
  commits a one-bound value (no local-buffer regression); `on_change="ignore"` +
  `required=True` on widgets that already support ignore: a passing
  unflushed edit, then clear, keeps the pending value (error on local UI) and does
  not flush empty on the next rerun.
- Accessibility: visible `(required)` marker; `aria-required`; accessible-name
  fallback on roles that do not support `aria-required`; `aria-invalid` /
  `aria-describedby` transitions. `role="alert"` alone does not cover the product
  a11y contract.
- Python: proto field set on wave-1 widgets; `required` is in the element ID
  kwargs when there is no `key`, and not in `key_as_main_identity`.
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
  capture blocks submit and does not send the previous file (no required error
  until submit); recapture then
  submit sends the new file (validator flushes local capture before returning
  true); recapture upload in-progress (including from recording start, before
  `uploadFile`) blocks submit without a required-empty error; Enter during active
  recording does not submit stale audio; failed or cancelled recapture stays
  uncommittable and does not restore or submit the prior capture; failed
  file-uploader replacement retains the old committed file (inside and outside
  forms); concurrent audio + file uploads do not clear each other's gate; Enter during a
  replacement upload does not submit the stale committed file (covers
  `submitForm`, not only `FormSubmitButton`); first-file in-flight on an empty
  required `st.file_uploader` blocks submit without a required-empty error;
  empty required radio/pills blocks form submit; multi-select pills `required`
  does not raise and locks the last key; `st.multiselect` last chip is locked on
  every remove path (clear-all, chip remove, Backspace/Delete, option toggle).
- Python: pills multi-select no longer raises; proto field set on remaining widgets.
- Public typing tests for radio, `st.multiselect`, pills / segmented_control overloads (new
  keyword-only arg and newly legal multi-select + `required`), and file-like
  widgets.
- E2E: pills required still cannot deselect; empty required pills blocks form
  submit; empty required `st.multiselect` blocks form submit and last chip cannot
  be removed; file/camera/audio required empty-commit and form-gate cases above.

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
