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
`NumberInput`, `DateInput`, `TimeInput`, `Selectbox`, `Radio`, `MultiSelect`,
`FileUploader`, `CameraInput`, `AudioInput`). `ButtonGroup.required` already exists
(field 16); update its comment to cover multi-select and form gating.

Do **not** put `required` in the widget identity / element ID (same as `disabled`).
Toggling `required` must not reset state.

Python: keyword-only `required: bool = False`, forwarded onto the proto. Drop the
pills/segmented exception that raises on `required=True` + `selection_mode="multi"`.

### Empty check

Shared frontend helper, per widget family:

| Family | Empty |
| --- | --- |
| Text | `value == null \|\| value.trim() === ""` |
| Number / date / time | `value == null` (range date: missing either bound) |
| Single select / radio / pills | no selection |
| Multi select / multi pills | `length === 0` |
| File / camera / audio | no uploaded/captured value |

Python does not need to re-check on deserialize for MVP (client-side, like `validate`).
Document the bypass. A later callable-`validate` follow-up can add a server path.

### Commit pipeline (typed widgets)

Generalize text-input `validateBeforeCommit` to:

1. If empty and `required`: set required error, return `false`.
2. If empty and not `required`: clear errors, return `true` (today's `validate` skip).
3. If non-empty: run `validate` regex when present (today's path).

Outside a form, a `false` result skips `commitWidgetValue` / `setValueWithSource` — no
rerun. Inside a form, blur/Enter still **stage** the local value (same as `validate`) and
leave gating to the form-submit validator.

`type="search"` `handleClear` currently commits `""` immediately because empty bypasses
`validate`. When `required=True`, clear must only update local UI, set the required
error, and not commit.

Register a form-submit validator when `required || hasValidationConfig`, not only when
a regex is set. The validator calls the same `validateBeforeCommit`. Failed submit
must not clear `dirty` (already the `validate` rule) so `clear_on_submit` cannot run.

Error copy: `"This field is required"` for the required failure; keep the existing
`validate` message for content failures. `aria-required` is independent of error
visibility; `aria-invalid` / `aria-describedby` follow `displayedError`.

### Selection widgets

Keep / extend `disallowEmptySelection` (pills) and hide/disable the clear affordance
(selectbox X, last multiselect chip) once a value exists and `required=True`.

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

No empty-commit path outside a form. Register a form-submit validator that fails when
the current widget state is empty and `required=True`. Show the error on the dropzone /
control. Outside a form, only the label marker and `aria-required` apply.

### Label marker

Small shared suffix in `WidgetLabel` (or a sibling span): muted, caption-sized
`(required)`, `aria-hidden` (the accessible name stays the widget's `aria-label` /
`aria-labelledby`; `aria-required` carries requiredness). Render only when
`required && labelVisibility === visible`.

### Metrics

Record `required=True` on widget creation (existing parameter-usage metrics), same
pattern as `validate`.

### Implementation order

The API is specified for all empty-able input widgets. Land in waves so each wave is
reviewable, without shipping a `required` that only works on one command long-term:

1. **`st.text_input`** — extend `validateBeforeCommit`, form-validator registration,
   search-clear, label marker. Proves composition with `validate`.
2. **`st.text_area`** — same commit path, no `validate` yet.
3. **`st.number_input` / `st.date_input` / `st.time_input`** — empty/`None` commit
   already exists for clearable instances; add the required gate next to range errors.
4. **`st.selectbox` / `st.radio` / `st.multiselect`** — lock last value + form gate.
5. **`st.pills` / `st.segmented_control`** — form gate, label, error if still empty,
   allow multi-select `required`.
6. **`st.file_uploader` / `st.camera_input` / `st.audio_input`** — form gate + marker.

Waves 1–2 are the smallest useful slice and unblock #13497. Wave 5 is a behavior
extension of an existing parameter, not a new one.

### Tests

- Frontend unit: empty commit blocked / allowed; `validate` still skipped for empty
  when `required=False`; required error vs validate error; form submit runs all
  validators; `clear_on_submit` not invoked on failure; search clear does not commit
  when required.
- Python: proto field set; pills multi-select no longer raises; `required` not in
  widget ID.
- E2E: form with two required fields (both errors on submit); outside-form text_input
  does not rerun on empty blur; email `type` + `required` (empty vs invalid vs valid);
  pills required still cannot deselect; empty required pills blocks form submit.

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
