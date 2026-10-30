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
| `disabled=True` (enforced since [#16209](https://github.com/streamlit/streamlit/pull/16209)) | A wrong-type value for a disabled widget still crashes the session. A button that disables itself in its own `on_click` fires the callback, but returns `False`. A bound widget's URL parameter still sets a disabled widget. |

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
   - The check uses the constraints from the latest run that rendered the widget. That
     is usually what the client saw; in a sync race it can be one run newer (see
     [Behavior changes](#behavior-changes)).
   - Rendered means registered by that run, not visible: a widget the app replaced
     later in the same run, for example with `st.empty()`, still counts.
   - If the current run later changes those constraints (new options, new bounds), the
     value is reconciled the way it is today.
   - This is the rule the agent API already follows: the snapshot is the contract.
2. **A rejected value is treated as never sent.**
   - The widget keeps its previous value, or its default if it never had one.
   - Its callback does not run, and the value does not count as changed for this run.
   - The browser is told which value the server holds. Widgets with no channel for
     that are the exception: `st.data_editor`, `st.tabs`, the open state of
     `st.expander` and `st.popover`, the file, camera, and audio inputs, and dataframe
     and chart selections. A refused change stays visible in them until they remount or
     the user changes them again (see the [tech spec](tech-spec.md#browser-re-sync)).
   - Nothing raises in the app. This generalizes what [#16209](https://github.com/streamlit/streamlit/pull/16209)
     does for `disabled`, and it is what the browser itself does when it blocks a commit:
     it sends nothing.
3. **One rule set, defined by each widget, with each caller deciding what a violation
   means.** Each widget states what it accepts inside its own implementation, beside how
   it reads its value. That place is the widget's serde: the per-widget object, such as
   `NumberInputSerde`, that already holds `serialize` and `deserialize` (see the
   [tech spec](tech-spec.md#where-constraints-live-in-each-widgets-serde)).
   The check reports a violation; it does not act on it.
   - A browser session drops the value, as in (2).
   - The agent API refuses the whole request with `invalid_value` before anything runs,
     naming the constraint.
   - `AppTest` drops the value, exactly as a browser session does. A follow-up makes
     `set_value` raise instead (see [Out of scope](#out-of-scope)).
4. **Only client input is refused.** A bound widget's URL parameter is client input too.
   It already gets value checks, and those move onto the same per-widget definition. It
   keeps its own repair-and-correct policy. Of the structural rules it gets only
   `disabled`: a disabled widget accepts no client input from any channel, so it ignores
   its URL parameter. A URL can still set a form field without a submit, because an
   author who binds a widget accepts that a link can set it. Programmatic
   `st.session_state` writes and widget defaults keep their current rules, apart from
   one side effect listed in [Behavior changes](#behavior-changes). Making programmatic
   writes consistent is a follow-up (see [Out of scope](#out-of-scope)).

There is no new parameter and no config option, not even a hidden kill switch (see
[Rollout](#rollout)). The check refuses only what the shipped frontend never sends, so a
correct client never notices it, apart from the cases in
[Behavior changes](#behavior-changes).

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
  explain why. Forms are the exception: a submit is atomic, so the form-submit rule (item
  7 in the [plan](#ranked-delivery-plan)) rejects a form's submit as a whole.

**Option 4: Raise in the app, or close the connection** (as for a malformed `BackMsg`,
[#16392](https://github.com/streamlit/streamlit/pull/16392))

- Pros: loud. A forged message never passes unnoticed.
- Cons: the attacker controls when the error appears. Benign sync races would show users
  errors or disconnect them.

### What Streamlit guarantees

After Phase 1, a value that reaches a callback, `st.session_state`, or a widget's return
value from a client satisfies all of the following:

- It arrived in a wire field the widget's frontend sends, and the widget can read it.
- It comes from a widget that the latest run covering it registered, and that was not
  `disabled` in that run. This includes a widget the app removed later in that run, for example with
  `placeholder.empty()`, because the app emitted it.
- It is one of the widget's options, or any non-empty text for a widget that accepts new
  options. It is within `max_selections` and lists no option twice. A label several
  options share may appear as often as they share it, as the multiselect's "Select all"
  sends it, and it resolves as before: to the first such option in `st.multiselect`, and
  to the last elsewhere. A multiselect may also repeat an option as often as the value it
  holds does, such as an author's `default=["a", "a"]`, which the browser keeps when the
  user adds options.
- It is within `min_value`/`max_value` and `max_chars`, and is a well-formed date, time,
  color, or range. The author's own default passes as written, even text past
  `max_chars` or a color with a trailing newline, because the browser shows it and
  sends it back. A float `st.slider` also accepts a bound as the browser rounds it to
  the step's precision (`min_value=0.123` with `step=0.1` sends `0.12`), and reads it as
  the bound, so the app never sees a value past `min_value` or `max_value`. The agent
  API gets no such allowance, so it never moves a request's value: `0.12` is refused
  there.
- It does not empty a `required` widget. `required` limits what a user can submit, not
  what the widget holds: an untouched required widget still reads as empty (`None`, `""`,
  or `[]`), exactly as in the browser, so an app still has to handle that case. Neither
  a client nor a link can clear it, with one exception: inside a form, a required
  `st.pills` or `st.segmented_control` without a default can return to that empty
  default, because a form with `clear_on_submit` restores it and the browser does not
  block the submit. The form-submit rule (item 7 in the [plan](#ranked-delivery-plan),
  Phase 2) adds the browser's stricter rule: a submit is refused while any rendered
  required field of that form is empty, touched or not. For `st.pills` and
  `st.segmented_control`, it needs the browser to block that submit first.

Later items add form submission, data editor policies, selections, and fragments (see
the plan below).

Streamlit never guarantees:

- **Authorization.** An options list the app showed to a user is legal for that user's
  session. Deciding who may act stays in app code.
- **`validate` regex matches.** See [Out of scope](#out-of-scope).
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
across the plan rather than saved for a final PR. Cost is the estimated PR size: S
(small), M (medium), or L (large).

| # | Scope | Security | Agent API | Cost | Risk |
| --- | --- | --- | --- | --- | --- |
| **Phase 1** | | | | | |
| 1 | **Boundary check and protocol integrity.** Check at the boundary; refuse a wrong wire type or a value the widget cannot read; move the `disabled` decision there; a disabled bound widget ignores its URL parameter. | High: crashes, stuck sessions, the `disabled` holes, a button returning a string | High: replaces `_check_readable`; the shared check exists | M | Low–Med |
| 2 | **Closed option sets.** `selectbox`, `radio`, `multiselect`, `select_slider`, `pills`, `segmented_control`, `feedback`, `tabs`; `max_selections`; duplicates. With `accept_new_options`, any non-empty text stays legal. | High: the most-assumed constraint | Med: deletes `_validate_options` and `max_items`; `max_selections` refused instead of raised | S | Low |
| 3 | **Rendered-widget gate.** Values and triggers only for widgets registered by the latest run that covered them, including one the app replaced later in that run | High: hidden admin callbacks fire today | Low: the agent already refuses these from its snapshot; this adds defense in depth | M | Med: sync races |
| 4 | **Bounds, shapes, formats, length.** `number_input`, `slider`, `select_slider` and `date_input` ranges, `datetime_input`, `time_input`, `color_picker`, `pagination`, `max_chars` on text and chat inputs | Low–Med: mostly coerced today; reversed and over-long ranges pass | High: silent reset or truncation becomes `invalid_value` naming the bound | S | Low |
| 5 | **`required`, per field.** A required widget cannot change to empty: text, number, date, time, and datetime inputs, `selectbox`, and single-select `pills` and `segmented_control` | Med | High: closes "required not enforced" | S | Low |
| **Phase 2** | | | | | |
| 6 | **Data editor edit policy.** `num_rows`, editable columns, row and column existence, index rules, cost of added rows | High: editors feed database write-back | High: a prerequisite for agent edits | M–L | Med |
| 7 | **Form submit integrity.** Fields change only with their own form's submit; a submit is refused as a whole if a rendered required field is empty or its button is disabled | Med | Med–High: replaces `missing_form_submit` logic; allows `clear_on_submit` on the server for agents | M–L | Med |
| 8 | **Dataframe selections.** `selection_mode` and bounds; `ButtonColumn` row bound | Med | High: a prerequisite for agent selections, the agent spec's first interaction follow-up | S–M | Low |
| 9 | **Fragment gate.** A rerun request names only a fragment on the page; stale fragments are cleared on every run end | Med | Low | M | Med |
| **Later** | | | | | |
| 10 | **Data editor cell constraints.** Column `options`, `min_value`/`max_value`, `required`, `max_chars`, strict types | Med | Med | L | Med |
| 11 | **Upload hardening** (its own track). Per-widget `max_upload_size`, single-file mode, uploads bound to issued file IDs, session quotas. Item 1 already turns a type check's raise into a drop. | Med | Low: agents cannot upload yet | M | Med |
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
- **Item 6 leads Phase 2** because it is the largest security gap left after Phase 1:
  data editors feed database write-back, and a disabled column or a fixed row count
  protects nothing today. It is also a prerequisite for agent edits. It sits outside
  Phase 1 only because it needs its own policy design (see the [tech spec](tech-spec.md#per-item-notes)).
- **Item 7 completes `required` inside forms.** A field-level rule cannot catch a submit
  with a required field that was never filled, because that field never changes.
- **Item 8 unblocks agent selections** and is small.
- **Item 9 is cheap in code but subtle,** because of the fragment lifecycle.
- **Items 10–12 are large or belong to other tracks.**
- **A URL-binding refactor follows item 4,** as its own behavior-preserving PR. Items 2
  and 4 already have the query parameter path call each widget's validator. The refactor
  moves its remaining checks there, and three metadata fields that exist only for them go
  away (see the
  [tech spec](tech-spec.md#other-value-sources-url-binding-and-session-state)). It does
  not change what a URL can set.

### Rollout

There is no kill switch, public or hidden, such as a `server.enforceWidgetConstraints`
option:

- A correct client never sends a violating value.
- In the sync races, the outcome is no worse than today: the widget was about to be
  removed or reset anyway.
- The real risk is an implementation bug that silently drops legitimate input. A switch
  can only be flipped once someone has noticed the bug, so the plan mitigates the bug
  directly:
  - **E2E parity gate.** From item 1 on, the full e2e suite runs in CI with every
    rejection logged at warning level, and any rejection fails the run. A correct browser
    must never be refused, including after a later frontend change. A test that provokes
    a sync race on purpose opts out with the `allow_refused_widget_values` marker and a
    reason.
  - **Accepted wire fields.** Item 1 derives each widget's accepted wire fields from what
    the frontend actually sends, audited per widget, not from the registered
    `value_type` (see the [tech spec](tech-spec.md#the-boundary-check)).
  - **Separate releases.** Items 1, 3, and 7 land in different releases, so a regression
    bisects to one item, and a patch release can revert it. Platforms that pin a
    version, such as SiS, get that revert later.

### Agent interaction API

The agent API is the second caller of the same check. It is also the clearest picture of
what this spec builds: it validates each request against the snapshot the client was
shown, refuses it atomically, and names the problem. This spec applies that rule to every
client and moves it into the runtime.

**What moves to the shared check** (`lib/streamlit/runtime/agent/widget_writes.py`):

| Agent code today | After |
| --- | --- |
| `_validate_options` (options taken from the agent description) | The widget serde's own `validate`, reached through `WidgetMetadata.validator` (item 2). The agent never needs to know a widget's rules, and the agent description stays a description instead of doubling as a validation list. `ElementState.options` stays, only to send a JSON number as an option's label and to list the options in an error. |
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
  the error names the bound or the layout. Date text the widget cannot read at all,
  such as `"tomorrow"`, gets the generic `invalid_value` message. The agent spec's
  "Everything else shows in the next snapshot's `value`" paragraph shrinks to the one
  legitimate case: the app changing a widget's constraints in the run the request
  caused. The planned per-key "how each value landed" note becomes mostly unnecessary.
- **Browser parity on `required`, and later on forms.** That narrows a row of "What v1
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
- **`disabled` holds for navigation too.** `widget_state` already refuses a disabled
  widget with `disabled_widget`, but `query_params` on a navigation request can still set
  a disabled bound widget today. After item 1 it cannot, so both paths agree.

The agent spec needs these edits once the relevant items land:

- The "Widget constraints are a separate layer" paragraph and "Until #16203 moves the
  checks into the widgets…" in [Actions in v1](../2026-08-28-agent-app-interface/product-spec.md#actions-in-v1).
- The "Validation only the browser performs" row in
  [What v1 does not support](../2026-08-28-agent-app-interface/product-spec.md#what-v1-does-not-support).
- The "Values" item in its smaller follow-ups.

### Behavior changes

Each change follows from the contract. A correct browser sees only nine of them, all
listed below: the self-disabling button, the URL parameter of a disabled bound widget,
values from app code or a link that break a constraint, chat input text from app code
past `max_chars`, a float slider's click at a bound, a form's staged values when it
remounts, a color picker's typed `transparent`, a pill whose label has an icon and edge
whitespace, and the sync races. App code also sees one: the Components v2 trigger key. A browser that reconnects to a new
session, after a server restart or an expired `server.disconnectedSessionTTL`, keeps
its values as today, apart from text past `max_chars`, or an empty value for a required
widget whose default is not empty, that app code wrote. Its first interaction counts as
today too, even when it is a click, a form submit, or a chat message: the widget
returns it. No callback fires for these values and triggers, also as today, and each
is checked when its widget registers. The other changes affect only forged values,
`AppTest`, and the agent API.

- **Callbacks no longer fire for rejected values:** forged, stale, hidden, or disabled.
  This is the point of the spec.
- **A widget the app no longer renders accepts nothing.** A click or change for a widget
  the latest run did not render, such as a button behind a condition that is now false,
  in a dialog that closed, after `st.stop()`, or on another page, is ignored and runs no
  callback.
- **A rejected client value keeps the previous value.** Today some widgets reset it to the
  default. This differs only when the previous value was not the default.
- **`st.multiselect` no longer raises** `StreamlitSelectionCountExceedsMaxError` for client
  values. It still raises for an author's `default` or for session state.
- **A self-disabling button returns `True`** in the run its click caused, because the
  click was legal when it was made. Today it returns `False` after firing `on_click`.
- **A disabled bound widget ignores its URL parameter.** Today a link can set a widget
  the app shows as disabled, because #16209 exempted URL seeding. The widget now keeps
  its default or previous value, on the first load, on back and forward, and after a
  page change that brings it back, and the server corrects or removes the parameter. This
  needs a changelog entry, but it is rare, because `bind="query-params"` is new. A link
  that presets a filter shown as locked still works if the app reads `st.query_params`
  and passes the value to the widget itself.
- **Text past `max_chars` from app code or a link.** Today
  `st.session_state["name"] = "abcd"` for a `max_chars=3` text input is accepted, then
  truncated to `"abc"` when the browser sends it back. That fires `on_change` although
  nobody changed the widget, and the browser keeps showing `"abcd"`. Because
  deserializers stop truncating (item 4), the text now stays as written on both sides
  until the programmatic-writes follow-up settles one rule. After a reconnect to a new
  session, the check at registration refuses it, and the widget falls back to its
  default. The alternative is [open question 1](#open-questions). A link is still
  truncated, but in UTF-16 code units, as the browser counts, so text with astral
  characters such as emoji keeps fewer characters than today. Both need a changelog
  entry.
- **Chat input text from app code is cut to `max_chars` before the browser shows it.**
  A chat input does not echo its text: the browser writes the text into the field
  without its `max_chars` check, and Enter sends it as a new message. So with
  `st.session_state.chat = "abcdefgh"` for a `max_chars=5` chat input, the field now
  shows `"abcde"`, the message that lands, as it landed before. Today the field shows
  all eight characters and the server cuts the message. The cut counts UTF-16 code
  units, as the browser does.
- **Other links that break a constraint** are repaired or cleared by the widget's own
  rules. A reversed range is now sorted (`st.slider`, `st.date_input`). A three-date
  range, a color with a trailing newline, an empty parameter for a required widget, and
  a start-only range for a required range now clear the parameter.
- **A float `st.slider` click at a bound selects the bound.** For some bounds and steps,
  the browser commits a value just past a bound, because it rounds to the step's
  precision. Today the server silently resets the slider to its default. It now reads
  the value as the bound.
- **A form keeps its staged values when it remounts.** Today, when an element appears
  above a form, the browser sends the form's staged values with the next rerun, without
  a submit. A frontend fix keeps them staged until the submit.
- **A color picker keeps its color when the user types `transparent`.** The picker's
  hex field accepts the word, and today the widget returns `"transparent"`, although
  `st.color_picker` returns a hex color. A frontend fix keeps the previous color, and
  the server refuses the word from any other client.
- **Keyed `st.pills` and `st.segmented_control` still read a label they cannot resolve
  as their held selection.** A forged label therefore counts as unchanged: no callback
  runs, and the browser is not re-synced.
- **A `st.pills` or `st.segmented_control` option whose label has an icon and edge
  whitespace,** such as `"🔥 Fire "`, can be selected. The browser trims the label it
  sends, so today the click changes nothing. Links and the agent API use the trimmed
  label too.
- **The agent API accepts a shared label that is unchanged on the wire,** such as the
  reported value sent back, and it changes nothing: the widget keeps the option it
  holds, and no `on_change` runs. Any other label several options share is still
  refused.
- **A Components v2 component's trigger key** (`"<key>__events"`) can no longer be
  assigned in `st.session_state` after the component renders. Like any widget key, it
  raises `StreamlitWidgetAlreadyInstantiatedError`.
- **`AppTest` follows the same rules,** because it sends widget states through the same
  path. A test that sets an out-of-constraint value, such as `set_value` beyond
  `max_value`, `""` or `None` on a filled `required` field, or `set_range` with reversed
  ends, now sees it dropped instead of coerced, exactly as in the browser. This is called
  out in the changelog. A follow-up makes `set_value` raise instead (see
  [Out of scope](#out-of-scope)). `AppTest` already stages form values until submit, so
  item 7 does not change form tests.
- **Sync races.** A user's change can be dropped where it is accepted today. This happens
  when a server-initiated rerun (`run_every`, `st.rerun` from another fragment, a file
  change) removed the widget, or changed its options or bounds, after the browser
  rendered it and before the user's message arrived. In both cases the browser was about
  to remove or reset that widget anyway. The same holds for a user's own rerun: a second
  click on a button in a dialog its first click closed is dropped. The message that
  changes the page is still checked against the previous page, so a change it carries
  for that page's widgets still lands. Rejections a correct browser can cause are logged
  at debug level; the rest are logged at warning level, without the value, which may be
  a password.

## Open questions

1. **Programmatic text past `max_chars`.** Once deserializers stop truncating, an
   over-long value written to `st.session_state` is no longer corrected when the
   browser sends it back (see [Behavior changes](#behavior-changes)). The options are
   to keep it as written until the programmatic-writes follow-up, which this spec
   proposes, or to truncate it at registration in item 4. Truncating keeps today's end
   value, one run earlier, removes the spurious `on_change`, and avoids the fallback to
   the default after a reconnect to a new session. This concerns text inputs and text
   areas, which echo their value unchanged. A chat input sends its text as a new message
   instead, so it is already cut when it reaches the browser (see
   [Behavior changes](#behavior-changes)).

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
- **Custom components.** They declare no value constraints, so only items 1 and 3 apply
  to them. Filtering components v2 state to its declared keys is a possible follow-up.
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
- **`AppTest.set_value` raising for an invalid value.** Phase 1 keeps the logic simple:
  `AppTest` drops an invalid value, exactly as the browser path does. A follow-up makes
  `set_value` raise through the same check the agent API uses, because a test that sets
  an invalid value is itself wrong and should fail.
- **A rejection counter.** Phase 1 only logs rejections. A counter for operators is a
  possible follow-up, alongside the agent spec's operations follow-up.
- **Request rate limits.** See the agent spec's default-on gates.

## Checklist

| Item | ✅ or comment |
| --- | --- |
| Works on SiS, Cloud, etc? | ✅ Server-side, apart from two frontend fixes (a form keeps its staged values when it remounts, and a color picker keeps its color when the user types `transparent`) and the browser re-syncing to values it already accepts through `set_value`. No platform change. Widgets with no such channel keep showing a refused change (see [The contract](#the-contract)); a frontend re-sync for them is a follow-up. A browser that reconnects to a new session, after a restart or a move to another replica, keeps its values as today, apart from text past `max_chars`, or an empty value for a required widget whose default is not empty, that app code wrote, and its first click still counts. |
| No breaking API changes | ⚠️ No API change. The behavior changes for rejected client values are listed above. The ones a correct browser can see are limited to the self-disabling button, the URL parameter of a disabled bound widget, values from app code or a link that break a constraint, chat input text from app code past `max_chars`, a float slider's click at a bound, a form's staged values when it remounts, a color picker's typed `transparent`, a pill whose label has an icon and edge whitespace, and the sync races described there. App code can no longer assign a Components v2 trigger key after the component renders. `AppTest` values that violate constraints are now dropped. |
| No new dependencies | ✅ |
| Metrics collected | No. Phase 1 only logs rejections. A rejection counter is a possible follow-up, alongside the agent spec's operations follow-up (see [Out of scope](#out-of-scope)). |
| Any security/legal impact? | ✅ Positive: declared constraints hold for every client. Authorization stays the app's job, and the docs must say exactly what is and is not guaranteed. |
| Any docs changes needed? | A security page listing the guarantees. Update the docstrings that call `required` "client-side only" when item 5 or 7 lands, and the `disabled` notes. Add a changelog entry for each behavior change. |
