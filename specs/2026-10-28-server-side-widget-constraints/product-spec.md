---
author: lukasmasuch
created: 2026-10-28
---

# Server-side enforcement of widget constraints

## Summary

Most widget constraints are enforced only by the browser: a selectbox's `options`, a
multiselect's `max_selections`, `required`, whether a form was submitted, and which
columns of a data editor can be edited. Any client that speaks the WebSocket protocol can
send values a widget never offered. Those values reach callbacks, `st.session_state`, and
widget return values.

This spec makes Streamlit check every widget value a client sends, once, when the message
enters the session and before any callback runs. The check uses the constraints the
client was shown, and a value that violates them is treated as if it had never been sent.

The agent API runs the same check. It refuses such a request instead of running it, so
its own copy of the rules shrinks, and the gaps it documents today close: `required` not
enforced, and out-of-range values silently reset.

There are two motivations, weighted equally:

- **Security.** A constraint an author declared should hold for every client, not only
  for the one Streamlit ships.
- **Agent API usability.** An agent should get the same rules a browser user does, and
  hear about a violation instead of reading a silent correction as success.

The full per-widget research is in [constraint-inventory.md](constraint-inventory.md). The
mechanism is in [tech-spec.md](tech-spec.md).

## Problem

### Constraints are a browser courtesy

Feature request [#16203](https://github.com/streamlit/streamlit/issues/16203) puts it
plainly: developers reasonably assume `st.selectbox(options=[...])` can only return one
of its options, or that `disabled=True` blocks a callback. That only holds in the browser.

Every outcome below was reproduced, either by injecting forged `WidgetStates` through
`AppTest`, which uses the same session-state path as a browser, or by calling the data
editor's edit code directly:

| What the author relied on | What a forged message does today |
| --- | --- |
| `options` on `st.selectbox`, `st.radio`, `st.multiselect` | The `on_change` callback, and `st.session_state[key]` inside it, see a value that is not an option. The return value is reset only afterwards. |
| Conditional rendering: `if is_admin: st.button("Delete all", on_click=delete_all)` | A trigger for a button rendered in an *earlier* run still fires `delete_all` after the branch is hidden, the dialog has closed, or the page has changed. |
| `st.data_editor(disabled=["price"], num_rows="fixed")` | Edits to `price`, added rows, and deleted rows all land in the returned dataframe. A negative row index edits a row counted from the end. An unknown column raises in the app. |
| `required=True` | An empty value is accepted, and the callback fires. |
| `st.form` | A field's value changes without a submit. A form whose submit button is disabled still applies its field values. |
| `max_selections` | `StreamlitSelectionCountExceedsMaxError` is raised *after* the callback fired, and the message blames the author's `default`. |
| The wire type of a value | `string_value: "x"` sent to `st.button` returns `"x"` and fires `on_click`. Sent to `st.slider`, it raises on this run and every later one, so the session is stuck. |
| `disabled=True` (enforced since [#16209](https://github.com/streamlit/streamlit/pull/16209)) | A wrong-type value for a disabled widget still crashes the session. A button that disables itself in its own `on_click` fires the callback, but returns `False`. |

The threat model is not exotic. It needs no XSS. Anyone who can reach an app's WebSocket
can script it: a signed-in user of an internal tool, a browser extension, or an agent
driving the protocol directly. Our docstrings tell authors to re-check `required` in app
code. The `number_input` docstring, for example, says: "If requiredness is
security-relevant, you must also check the value on the server (in your app code) after
it is submitted." But nobody re-checks `options`, and nobody can easily re-check
conditional rendering.

### What the server already checks is incomplete and too late

Some constraints are re-checked today, mostly because `bind="query-params"` needed URL
values validated (bounds reset inside deserializers, options reset after registration).
The result has four problems:

1. **Too late.** Callbacks run before the script re-registers its widgets, so they see
   the raw value. Resets happen afterwards.
2. **Silent.** A deserializer that corrects a value does not tell the browser, which keeps
   showing the value the server rejected.
3. **Inconsistent.** The same kind of violation is reset to the default by one widget,
   truncated by another, filtered out by a third, and raised as an exception by a fourth.
4. **Incomplete.** Nothing checks `required`, forms, data editor policies, whether a
   widget is still rendered, or the wire type.

### The agent API carries its own copy

The [agent API](../2026-08-28-agent-app-interface/product-spec.md) validates writes before
anything runs. It checks options, list lengths, and whether the widget can read the
value. It leaves bounds and `max_chars` to the widgets, which reset or truncate silently.
Its spec calls this out: "a silently reset value reads as success". Its unsupported list
also records that `required` and `validate` "are reported but not enforced, so an agent
can submit an empty required field that a browser would block".

The facts it validates against come from the agent description, which is built only for
agent sessions. So a mistake in a command's description becomes a validation bug:
`lib/streamlit/AGENTS.md` warns that "a wrong field refuses a legal value". The agent spec
already states the fix: the agent path "should call those validators rather than keep its
own, provided each reports the violation and lets the caller decide."

## Proposal

### The contract

1. **One check, at the boundary, against what the client was shown.**
   - Every value or trigger a client sends is checked once, when the message enters the
     session and before any callback runs.
   - The check uses the widget as the client last saw it: the constraints of the run that
     rendered it.
   - If the current run later changes those constraints (new options, new bounds), the
     value is reconciled the way it is today.
   - This is the rule the agent API already follows: the snapshot is the contract.
2. **A rejected value is treated as never sent.**
   - The widget keeps its previous value, or its default if it never had one.
   - Its callback does not run, and the value does not count as changed for this run.
   - The browser is told which value the server holds.
   - Nothing raises in the app. This generalizes what [#16209](https://github.com/streamlit/streamlit/pull/16209)
     does for `disabled`, and it is what the browser itself does when it blocks a commit:
     it sends nothing.
3. **One rule set, defined by each widget, with each caller deciding what a violation
   means.** Each widget states what it accepts inside its own implementation, beside how
   it reads its value (see the [tech spec](tech-spec.md#where-constraints-live-in-each-widgets-serde)).
   The check reports a violation; it does not act on it.
   - A browser session drops the value, as in (2).
   - The agent API refuses the whole request with `invalid_value` before anything runs,
     naming the constraint.
   - `AppTest` could raise at `set_value` time; that is a follow-up.
4. **Only client input is refused.** A bound widget's URL parameter is client input too.
   It already gets value checks, and those move onto the same per-widget definition. It
   keeps its own repair-and-correct policy, and it deliberately skips the structural rules,
   because an author who binds a widget accepts that a link can set it. Programmatic
   `st.session_state` writes and widget defaults keep their current rules. Making
   programmatic writes consistent is a follow-up (see [Out of scope](#out-of-scope)).

There is no new parameter and no config option. The check refuses only what the shipped
frontend never sends, so a correct client never notices it.

#### How to handle a violation in a browser session

**Option 1: Drop the value, keep the previous one** ✅ PREFERRED

- Pros: it mirrors the browser, where a blocked commit sends nothing. It is one rule for
  every widget, it is already the behavior for `disabled`, and it never invents a value.
- Cons: in a sync race, a user's change to a widget whose constraints just changed is
  ignored rather than adapted. See [Behavior changes](#behavior-changes).

**Option 2: Coerce: clamp, reset to the default, or truncate** (the issue's proposal)

- Pros: closest to some widgets' behavior today.
- Cons: it invents values nobody chose and fires callbacks with them. A clamped forged
  value is still the attacker's choice of the boundary. The rule differs per widget, and
  it cannot express `required` or forms.

**Option 3: Reject the whole message**

- Pros: atomic, like the agent API.
- Cons: the browser sends its whole widget map on every rerun. One stale widget would
  discard the user's legitimate change to another, and the browser has no channel to
  explain why. Forms are the exception: a submit is atomic, so item 7 rejects a form's
  submit as a whole.

**Option 4: Raise in the app, or close the connection** (as for a malformed `BackMsg`,
[#16392](https://github.com/streamlit/streamlit/pull/16392))

- Cons: the attacker controls when the error appears. Benign sync races would show users
  errors or disconnect them.

### What Streamlit guarantees

After v1, a value that reaches a callback, `st.session_state`, or a widget's return value
from a client satisfies all of the following:

- It has the wire type the widget registered, and the widget can read it.
- It comes from a widget that is rendered right now and not `disabled`.
- It is one of the widget's options, within `max_selections` and with no duplicates,
  unless the widget accepts new options.
- It is within `min_value`/`max_value` and `max_chars`, and is a well-formed date, time,
  color, or range.
- It does not empty a `required` widget. `required` limits what a user can submit, not
  what the widget holds: an untouched required widget still reads as empty (`None`, `""`,
  or `[]`), exactly as in the browser, so an app still has to handle that case. Outside a
  form, a client can never clear it. Inside a form, item 7 adds the browser's stricter
  rule: a submit is refused while any rendered required field of that form is empty,
  touched or not.

Later items add form submission, data editor policies, selections, and fragments (see
the plan below).

Streamlit never guarantees:

- **Authorization.** An options list the app showed to a user is legal for that user's
  session. Deciding who may act stays in app code.
- **`validate` regex matches.** These are out of v1; see [Out of scope](#out-of-scope).
- **What an uploaded file contains.**
- **That a value is right for the business.**

The security docs should list these guarantees explicitly, so "re-check everything" can
become "re-check what Streamlit does not".

### Ranked delivery plan

Items are ranked by four criteria, in this order:

1. Prerequisites come first.
2. Security value.
3. Value for the agent API.
4. Cost and risk, last.

Each item is meant to be one reviewable PR. Each item also switches the agent API to the
shared check for its constraint and deletes the agent's copy, so agent adoption is spread
across the plan rather than saved for a final PR.

| # | Scope | Security | Agent API | Cost | Risk |
| --- | --- | --- | --- | --- | --- |
| **v1** | | | | | |
| 1 | **Boundary check and protocol integrity.** Check at the boundary; refuse a wrong wire type or a value the widget cannot read; move the `disabled` decision there. | High: crashes, stuck sessions, both `disabled` holes, a button returning a string | High: replaces `_check_readable`; the shared check exists | M | Low–Med |
| 2 | **Closed option sets.** `selectbox`, `radio`, `multiselect`, `select_slider`, `pills`, `segmented_control`, `feedback`; `max_selections`; duplicates | High: the most-assumed constraint | Med: deletes `_validate_options` and `max_items`; `max_selections` refused instead of raised | S | Low |
| 3 | **Rendered-widget gate.** Values and triggers only for widgets the page renders now | High: hidden admin callbacks fire today | Low: the agent already refuses these from its snapshot; this adds defense in depth | M | Med: sync races |
| 4 | **Bounds, shapes, formats, length.** `number_input`, `slider`, `select_slider` and `date_input` ranges, `datetime_input`, `time_input`, `color_picker`, `pagination`, `max_chars` on text and chat inputs | Low–Med: mostly coerced today; reversed and over-long ranges pass | High: silent reset or truncation becomes `invalid_value` naming the bound | S | Low |
| 5 | **`required`, per field.** A required widget cannot change to empty | Med | High: closes "required not enforced" | S | Low |
| **v1.x** | | | | | |
| 6 | **Data editor edit policy.** `num_rows`, editable columns, row and column existence, index rules, cost of added rows | High: editors feed database write-back | High: a prerequisite for agent edits | M–L | Med |
| 7 | **Form submit integrity.** Fields change only with their own form's submit; a submit is refused as a whole if a rendered required field is empty or its button is disabled | Med | Med–High: replaces `missing_form_submit` logic; allows `clear_on_submit` on the server for agents | M–L | Med |
| 8 | **Dataframe selections.** `selection_mode` and bounds; `ButtonColumn` row bound | Med | High: a prerequisite for agent selections, the agent spec's first interaction follow-up | S–M | Low |
| 9 | **Fragment gate.** A rerun request names only a fragment on the page; stale fragments are cleared on every run end | Med | Low | M | Med |
| **Later** | | | | | |
| 10 | **Data editor cell constraints.** Column `options`, `min_value`/`max_value`, `required`, `max_chars`, strict types | Med | Med | L | Med |
| 11 | **Upload hardening** (its own track). Per-widget `max_upload_size`, single-file mode, type checks that drop instead of raise, uploads bound to issued file IDs, session quotas | Med | Low: agents cannot upload yet | M | Med |
| 12 | **Chart selections.** Plotly, Vega-Lite, and Deck.gl selection modes and shapes | Low | Med: with agent chart selections | M | Med |

Why this order:

- **Item 1 comes first** because every other item plugs into it. It also fixes the bugs
  that hurt today regardless of attackers: a single malformed value sticks a session, and
  a self-disabling button is inconsistent.
- **Item 2 next** because options are the constraint authors assume most and it is cheap.
  `WidgetMetadata` already carries `formatted_options` and `max_array_length` for URL
  binding.
- **Item 3 is the most serious finding**, but it is ranked third because it changes
  behavior in a real race. When a server-initiated rerun hides a widget, a click the user
  made just before is now ignored. The [tech spec](tech-spec.md#rendered-widget-gate)
  walks through the races.
- **Items 4 and 5 add little security on their own,** since most of item 4 is already
  coerced. Their value is the agent half: no silent corrections, `required` enforced, and
  a `value_schema` that can finally state `minimum`, `maximum`, and `maxLength` truthfully.
- **Item 6 leads v1.x** because it is the largest security gap left after v1: data
  editors feed database write-back, and a disabled column or a fixed row count protects
  nothing today. It is also a prerequisite for agent edits. It sits outside v1 only
  because it needs its own policy design (see the [tech spec](tech-spec.md#per-item-notes)).
- **Item 7 completes `required` inside forms.** A field-level rule cannot catch a submit
  with a required field that was never filled, because that field never changes.
- **Item 8 unblocks agent selections** and is small.
- **Item 9 is cheap in code but subtle,** because of the fragment lifecycle.
- **Items 10–12 are large or belong to other tracks.**
- **A URL-binding refactor follows item 4,** as its own behavior-preserving PR. The query
  parameter path then reuses each widget's validator, and two metadata fields that exist
  only for it go away (see the
  [tech spec](tech-spec.md#other-value-sources-url-binding-and-session-state)). It does
  not change what a URL can set.

### Agent interaction API

The agent API is the second caller of the same check. It is also the clearest picture of
what this spec builds: it validates each request against the snapshot the client was
shown, refuses it atomically, and names the problem. This spec applies that rule to every
client and moves it into the runtime.

**What moves to the shared check** (`lib/streamlit/runtime/agent/widget_writes.py`):

| Agent code today | After |
| --- | --- |
| `_validate_options` and `ElementState.options` (options taken from the agent description) | The widget serde's own `validate`, reached through `WidgetMetadata.validator` (item 2). The agent never needs to know a widget's rules, and the agent description stays a description instead of doubling as a validation list. |
| `ElementState.max_items` for `max_selections` and ranges | The shared check (items 2 and 4). |
| `_check_readable`, which runs the deserializer to avoid a stuck session | The shared readability check (item 1). |
| The docstring rule that "constraints a widget owns are left to the widget, which resets, truncates, or trims" | The widget reports the violation; the agent refuses with `invalid_value`. |
| Form rules `missing_form_submit` and the cross-form part of `cross_form_batch` | Shared form kinds (item 7). The agent keeps its codes and its stricter rule against mixing a form with unrelated controls, which exists for rerun scoping. |

**What stays agent-specific:**

- Turning JSON into the wire value: `value_schema` type checks, ISO text normalization,
  and option labels as strings.
- Addressing by key.
- The reasons the snapshot alone knows: `support`, closed dialogs, compile errors, and the
  ordering of error codes.
- Fragment and dialog scoping.

The agent still validates against its snapshot for these. Item 3 gives the runtime its
own "is rendered" fact, which the agent's `not_on_page` can sit on top of.

**What agents gain:**

- **Fewer silent outcomes.** An out-of-range number, an over-long string, a reversed or
  too-short range, and a malformed date or color are refused with `invalid_value`, and
  the error names the bound. The agent spec's "Everything else shows in the next
  snapshot's `value`" paragraph shrinks to the one legitimate case: the app changing a
  widget's constraints in the run the request caused. The planned per-key "how each value
  landed" note becomes mostly unnecessary.
- **Browser parity on `required`, and later on forms.** That removes a row from "What v1
  does not support" and makes conformance tests against a browser session meaningful.
- **A truthful schema.** The agent spec's follow-up of stating `minimum`, `maximum`,
  `maxLength`, and `maxItems` in `value_schema` was deferred until "the server refuses
  what the schema rules out". After items 2 and 4 it does.
- **A foundation for new interactions.** Data editor edits and dataframe selections (agent
  follow-up #8) need validation on the server before an agent may send them. Items 6 and
  8 provide it, so those features do not each grow their own validator.
- **Defense in depth.** Agent sessions are ordinary sessions, so the boundary check runs
  on their reruns too. A bug in the agent's own validation can no longer let an invalid
  value through.

The agent spec needs these edits once the relevant items land:

- The "Widget constraints are a separate layer" paragraph and "Until #16203 moves the
  checks into the widgets…" in [Actions in v1](../2026-08-28-agent-app-interface/product-spec.md#actions-in-v1).
- The "Validation only the browser performs" row in
  [What v1 does not support](../2026-08-28-agent-app-interface/product-spec.md#what-v1-does-not-support).
- The "Values" item in its smaller follow-ups.

### Behavior changes

Each change follows from the contract. None affects a correct browser outside the races
noted below.

- **Callbacks no longer fire for rejected values:** forged, stale, hidden, or disabled.
  This is the point of the spec.
- **A rejected client value keeps the previous value.** Today some widgets reset it to the
  default. This differs only when the previous value was not the default.
- **`st.multiselect` no longer raises** `StreamlitSelectionCountExceedsMaxError` for client
  values. It still raises for an author's `default` or for session state.
- **A self-disabling button returns `True`** in the run its click caused, because the
  click was legal when it was made. Today it returns `False` after firing `on_click`.
- **`AppTest` follows the same rules,** because it sends widget states through the same
  path. A test that sets an out-of-constraint value, such as `set_value` beyond
  `max_value` or `""` on a `required` field, now sees it dropped instead of coerced. This
  is fidelity with the browser, and it is called out in the changelog. `AppTest` already
  stages form values until submit, so item 7 does not change form tests.
- **Sync races.** A user's change can be dropped where it is accepted today. This happens
  when a server-initiated rerun (`run_every`, `st.rerun` from another fragment, a file
  change) removed the widget, or changed its options or bounds, after the browser
  rendered it and before the user's message arrived. In both cases the browser was about
  to remove or reset that widget anyway. Rejections a correct browser can cause are logged
  at debug level; the rest are logged at warning level, without the value, which may be
  a password.

## Out of scope

- **`validate` regex on the server.** The patterns are JavaScript regular expressions run
  with the `us` flags as a search. Python's `re` differs: `$` before a trailing newline,
  ASCII versus Unicode `\w`, and syntax that only one side accepts. Worse, running an
  author's pattern against attacker-controlled text on the server invites catastrophic
  backtracking on the script thread, and Python's `re` has no timeout. The right tool for
  security-relevant validation is the server-side callable `validate` deferred in
  [the validation spec](../2025-12-03-text-input-validation/product-spec.md). This also
  covers the default email and URL patterns of `type=`.
- **`step`.** The browser does not snap a typed `number_input`, `time_input`, or
  `datetime_input` value to `step`, so there is no browser constraint to mirror. The
  slider does snap, but checking float multiples needs a tolerance and protects nothing.
- **Custom components.** They declare no constraints. Filtering components v2 state to
  its declared keys is a possible follow-up.
- **Upload content and MIME verification.** Both the MIME type and the filename are
  chosen by the client. Item 11 hardens what can be checked.
- **`st.chat_input` `submit_mode`, and dialogs the browser dismissed** with
  `on_dismiss="ignore"`. These are browser state the server does not know.
- **Consistent handling of programmatic `st.session_state` writes.** App code is trusted,
  so this is not a security fix. It does not affect agents either, because an echoed value
  is unchanged and passes. But an out-of-constraint write has four outcomes today,
  depending on the widget: it is reset, it raises a clean error, it is accepted unchecked,
  or it raises a raw `TypeError`. The per-widget validators make one rule possible.
  Turning the raw `TypeError`s into clear errors is a safe papercut. Deciding whether an
  explicit invalid write should raise or reset changes API behavior, so it needs its own
  spec (see the [tech spec](tech-spec.md#other-value-sources-url-binding-and-session-state)).
- **Request rate limits.** See the agent spec's default-on gates.

## Checklist

| Item | ✅ or comment |
| --- | --- |
| Works on SiS, Cloud, etc? | ✅ Server-side only. No frontend or platform change, apart from the browser re-syncing to values it already accepts through `set_value`. |
| No breaking API changes | ⚠️ No API change. The behavior changes for rejected client values are listed above. The ones a correct browser can see are limited to the sync races described there. `AppTest` values that violate constraints are now dropped. |
| No new dependencies | ✅ |
| Metrics collected | No. Rejections are logged. A rejection counter belongs with the agent spec's operations follow-up. |
| Any security/legal impact? | ✅ Positive: declared constraints hold for every client. Authorization stays the app's job, and the docs must say exactly what is and is not guaranteed. |
| Any docs changes needed? | A security page listing the guarantees. Update the docstrings that call `required` "client-side only" when item 5 or 7 lands, and the `disabled` notes. Add a changelog entry for each behavior change. |
