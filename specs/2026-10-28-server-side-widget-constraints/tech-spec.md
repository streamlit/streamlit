---
author: lukasmasuch
created: 2026-10-28
---

# Server-side enforcement of widget constraints: mechanism

## Summary

This covers how the [product spec](product-spec.md)'s contract is built. One function
checks each client-sent `WidgetState` when it enters the session, before any callback
runs. It checks against the metadata of the run that rendered the widget, and it returns
a structured violation instead of acting on it. `SessionState` drops violating values and
re-syncs the browser. The agent API calls the same function before it queues a run and
refuses the request. What a widget accepts stays inside its own implementation: a
`validate` method on its serde, next to `serialize` and `deserialize`, registered through a
new `WidgetMetadata.validator` callback.

## Problem

### How a client value flows today

1. `AppSession.request_rerun` builds `RerunData` from `ClientState.widget_states`.
   `_coalesce_widget_states` merges queued messages: newer values win, pending triggers
   are kept.
2. `SessionState.on_script_will_rerun` (`runtime/state/session_state.py:880`) does three
   things in order:
   1. Resets triggers and compacts state into `_old_state`.
   2. Stores the incoming protos as `Serialized` (`set_widgets_from_proto`, `:871`). Its
      only check is the total size limit, `server.maxWidgetStateSize`.
   3. Calls `_call_callbacks`.
3. `_call_callbacks` calls `_widget_changed` for every incoming widget. That
   deserializes the value through `WStates.__getitem__` (`:170`), using the **previous
   run's** deserializer, and **overwrites `metadata.value_type` with whichever wire field
   arrived**. Callbacks then run. The disabled check (#16209) skips callbacks whose
   previous-run metadata says `disabled`, but only *after* the deserializer has run.
4. The script body runs. `register_widget` (`:1591`) installs this run's metadata and
   resolves the value from the cached `Value`, so the new deserializer is not reapplied.
   It discards a value for a widget that is disabled *now*. Widget code then reconciles
   options and bounds (`elements/lib/options_selector_utils.py`, plus per-widget checks).
5. `on_script_finished` prunes stale widget *states* (`:1354`) but never prunes
   `widget_metadata`.

### Consequences

| # | Gap | Effect |
| --- | --- | --- |
| a | Constraints are checked after callbacks | Callbacks see unknown options, out-of-range pages, and over-limit selections. |
| b | The wire field is trusted | A wrong field raises in the deserializer, and because the value stays stored, every later run raises too. `_compact_state` and `__contains__` only catch `KeyError`. |
| c | Metadata is never pruned | A trigger or value for a widget an earlier run rendered still fires its callback. |
| d | Deserializer corrections don't set `value_changed` | The browser keeps showing a value the server replaced. |
| e | `disabled` is decided twice, against two metadata generations | When `disabled` flips during the run, the callback and the return value disagree. |

The agent API avoids (a), (b), and (c) for its own requests by validating against its last
snapshot (`runtime/agent/widget_writes.py`). That validation exists only for agent
requests, and its constraint facts come from agent descriptions.

## Proposal

### The boundary check

The check sits between storing the incoming states and running callbacks:

```python
# SessionState.on_script_will_rerun
self.set_widgets_from_proto(fresh_widget_states)
self._rejected_client_values = self._drop_invalid_client_values(fresh_widget_states)
self._call_callbacks(...)
```

```python
def _drop_invalid_client_values(self, states: WidgetStatesProto) -> frozenset[str]:
    rejected: set[str] = set()
    for state in states.widgets:
        violation = widget_checks.check_client_value(
            state,
            metadata=self._new_widget_state.widget_metadata.get(state.id),
            previous=self._old_state_serialized(state.id),
            is_rendered=state.id in self._new_widget_state.rendered_ids,
        )
        if violation is not None:
            self._new_widget_state.drop(state.id)  # previous value stays in _old_state
            rejected.add(state.id)
            _log_violation(state.id, violation)  # never logs the value
    return frozenset(rejected)
```

`check_client_value` is a pure function in a new `runtime/state/widget_checks.py`. It
applies these checks in order and returns the first violation:

1. **Unchanged values pass.** A value equal to the stored one was already accepted or was
   set by the server. This matters for cost: the browser resends its whole widget map on
   every rerun, so most entries are unchanged. A trigger is always a change.
   - The stored value is compared in wire form, which `register_widget` already computes
     to capture the wire label.
2. **The widget exists and is rendered** (`not_rendered`). See the
   [rendered-widget gate](#rendered-widget-gate).
3. **It is not disabled** (`disabled`).
4. **The wire field is one the widget accepts** (`wrong_type`). Most widgets accept the
   `value_type` they registered.
   - Lossless numeric pairs are interchangeable: `int_value` with `double_value`, and the
     int and double array fields.
   - Components v1, which register `json_value`, also accept `bytes_value` and
     `arrow_value`.
   - `WStates.__getitem__` stops overwriting `metadata.value_type`. The field that
     actually arrived is recorded on the `Serialized` entry instead.
5. **The widget's own validator** (`metadata.validator`, the serde's `validate`, see
   below). This covers the widget's
   options, bounds, shapes, lengths, and whether an empty value is allowed.
6. **The deserializer can read it** (`unreadable`). Run in a `try`, once. The result is
   cached as the `Value` that `_widget_changed` would otherwise compute, so the value is
   not deserialized twice.

Replayed trigger states (`replay_trigger_states`) are server-held and were checked when
they first arrived, so they skip the check.

### Violations

```python
class Violation(NamedTuple):
    kind: ViolationKind
    # Facts a caller can explain the refusal with, such as the options or the
    # bounds. Never the value that was sent, which may be a password.
    detail: Mapping[str, Any] = {}
```

| `kind` | Raised by | Browser session | Agent API code |
| --- | --- | --- | --- |
| `not_rendered` | gate | drop, debug log | `not_on_page` (the snapshot check usually answers first) |
| `disabled` | gate | drop | `disabled_widget` |
| `wrong_type`, `unreadable` | integrity | drop, warning | `invalid_value` |
| `not_an_option`, `too_many_items`, `duplicate_items` | options | drop | `invalid_value`, with the options listed |
| `ambiguous_option` | options | **accepted**: the browser resolves a shared label itself | `invalid_value`, as today |
| `out_of_range`, `bad_shape`, `malformed`, `too_long` | bounds, shapes, length | drop | `invalid_value`, with the bound |
| `empty_required` | `required` | drop | `invalid_value` |
| `form_not_submitted`, `form_invalid` | forms (item 7) | drop the form's changes | `missing_form_submit`, `invalid_value` |

A rejection is logged at debug level when a correct browser can cause it
(`not_rendered`, and option or bound violations, which a sync race can produce). It is
logged at warning level otherwise, once per widget per session.

### Where constraints live: in each widget's serde

What a widget accepts is defined by the widget, in its own module, beside how it reads
and writes its value. Each serde gets a `validate` method next to `serialize` and
`deserialize`. It is registered through a new `WidgetMetadata` callback, the same way the
other two are:

```python
# runtime/state/common.py
WidgetValidator: TypeAlias = Callable[..., "Violation | None"]


class WidgetMetadata(Generic[T]):
    deserializer: WidgetDeserializer[T]
    serializer: WidgetSerializer[T]
    # What a client may send. Called with the unpacked wire value of a changed
    # entry, before callbacks run. None accepts anything the deserializer reads.
    validator: WidgetValidator | None = None
```

```python
# number_input.py
@dataclass
class NumberInputSerde:
    value: Number | None
    data_type: int
    min_value: Number
    max_value: Number

    def validate(
        self, ui_value: Number | None, *, previous: Any = None
    ) -> Violation | None:
        if ui_value is None:
            return None
        if self.data_type == NumberInputProto.FLOAT and not math.isfinite(ui_value):
            return Violation("malformed")
        return widget_checks.within(ui_value, self.min_value, self.max_value)

    def deserialize(self, ui_value: Number | None) -> Number | None:
        val = ui_value if ui_value is not None else self.value
        ...
        # URL and programmatic values are coerced rather than refused.
        return self.value if self.validate(val) is not None else val


register_widget(
    ...,
    deserializer=serde.deserialize,
    serializer=serde.serialize,
    validator=serde.validate,
)
```

**Why the serde is the right home:**

- **It already holds the facts.** Options, bounds, `max_chars`, and `format_func` are
  already on the serde, captured from the run that rendered the widget, which is exactly
  the contract the client was shown. Metadata keeps that run's serde until the widget
  registers again, so validating against it needs no extra bookkeeping.
- **Each rule lives in one place per widget.** `deserialize` keeps coercing URL and
  programmatic values by calling `validate`. Today the same bounds or options rule is
  written twice: once in the deserializer and again in the widget function after
  registration.
- **A widget is reviewed in one file:** what it renders, what it accepts, and how it reads
  values. A coverage test, like the agent description test, fails for a value widget
  registered without a validator unless an explicit list says any value of the right wire
  type is legal, as for `checkbox`, `toggle`, and buttons.

**What does not belong in the serde.** Rules about the protocol or about containers stay
in `widget_checks.check_client_value`, which calls `metadata.validator` as step 5:

- unchanged values pass
- the rendered gate
- `disabled`
- the wire field
- readability (by running the deserializer)
- form membership (item 7), a property of the form rather than of a value

None of these differs per widget, and putting them in each serde would copy them 20
times.

**Shared helpers** keep serdes from repeating the same comparisons. They are small pure
functions that return a `Violation` with its details:

- `within(value, min, max)`, `one_of(labels, value)`, `items_of(labels, values, max_items, unique)`
- `iso_date`, `iso_time`, `hex_color`
- `text_length(text, max_chars)`, `is_empty(value)`

An options serde builds its label `frozenset` lazily with a `cached_property`, so a
browser session whose widgets never change pays nothing.

**The previous value.** Check 1 already passes unchanged values, so a validator sees only
changes and almost never needs the previous value. The data editor is the exception: its
payload is cumulative, so `DataEditorSerde.validate` uses the `previous` keyword to check
only new or changed entries. Every other serde ignores it.

URL seeding reuses `validate` as well. See
[Other value sources](#other-value-sources-url-binding-and-session-state).

### Rendered-widget gate

`WStates` gains `rendered_ids`: the widgets the browser can show right now. It changes at
two points:

- **When a run registers a widget,** the widget is added. A run in progress, including
  one later interrupted, already sent that element to the browser.
- **Where `_remove_stale_widgets` runs,** the set is replaced. This happens in
  `on_script_finished` with `remove_stale_widgets=True`, and uses the same rule that
  scopes states to `fragment_ids_this_run`. After a fragment run, only that fragment's
  widgets are replaced.
  - When a run's widget list is incomplete (`remove_stale_widgets=False`: the body never
    ran, or `st.rerun()` interrupted it), the set is not replaced, exactly as states are
    not pruned.

Metadata itself stays, because `persist_state` and page-scoped values need it.

A dialog closed by a full rerun stops rendering its widgets, so they leave the set at
the next cleanup. A dialog the browser dismissed with `on_dismiss="ignore"` is unknown to
the server and stays out of scope.

The gate creates one new race. Here is how each race plays out:

| Race | Today | After |
| --- | --- | --- |
| A server-initiated rerun (`run_every`, `st.rerun` from another fragment, a file change) hides widget W. The user clicks W before the browser applies that run. | W's callback fires on a page that no longer has W. | Dropped. The browser was about to remove W. |
| A run is interrupted after registering W with new options. The browser still shows W's old options, and the user picks an old option. | The value is reset to the default after registration. | Checked against the newer options and dropped. The previous value stays instead of the default. |
| W's options or bounds change in the run the click causes. | Reconciled after registration. | Unchanged: the click is checked against what the user saw, then reconciled. |

### `disabled` consolidation

The `disabled` decision moves to the boundary, against the metadata the client saw. The
registration-time discard of client values goes away; URL seeding of disabled widgets
keeps working as it does now. This closes both holes #16209 left:

- A wrong-type value for a disabled widget no longer runs the deserializer, so it can no
  longer crash the session.
- A widget that becomes disabled during the run its click caused keeps the click's value.
  Its callback has already fired, so the return value now agrees with it.

A widget that was disabled when shown and is enabled during the run is still refused.

### Browser re-sync

`register_widget` sets `value_changed` for a widget in `_rejected_client_values` when no
programmatic value takes over. That is the same condition as `disabled_value_discarded`
today, so the widget's proto carries `set_value` and the browser shows the server's
value. Item 4 also sets it when a deserializer coerces a client value, which closes gap
(d).

Trigger widgets need no re-sync: a trigger resets anyway. `st.data_editor` has no channel
to re-sync edits (see [Open questions](#open-questions)).

### Other value sources: URL binding and session state

A widget's value can come from three places. The serde's `validate` is the one definition
of what the widget accepts, and each source applies its own policy to a violation:

| Source | Trusted? | Policy on a violation | In this spec |
| --- | --- | --- | --- |
| Client `WidgetStates` | No | Drop it as never sent; the agent API refuses the request | Yes |
| A bound widget's URL parameter | No: the client sends the query string in `ClientState` | Repair it, then validate it, then clear or correct the parameter | A refactor onto `validate`, below |
| Programmatic `st.session_state` writes | Yes: it is app code | Mixed today | Follow-up, below |

**URL binding: a behavior-preserving refactor after item 4.** `_seed_widget_from_url`
already validates the query string. It does so with comparisons on metadata fields that
exist only for this purpose. Once every serde has a validator:

- **Membership and bounds come from `validate`.** The URL path still repairs array
  parameters, but the violation details drive the repair:
  - drop items reported as `not_an_option`
  - deduplicate after `duplicate_items`
  - truncate to the `max_items` that `too_many_items` reports
- **Two metadata fields go away.** `max_array_length` and `allow_url_duplicates` leave
  `WidgetMetadata`, because the serde already holds both facts: `max_selections`, and
  whether a range may repeat a value.
- **`formatted_options` keeps one role.** Its membership role moves to `validate`. Its
  other role remains: writing a corrected value of an index-based widget (`pills`,
  `segmented_control`, `select_slider`) back to the URL as a label. `register_widget`
  already marks it temporary until those serdes use string wire values.
- **`clearable` stays.** It is not a validation fact. It says what an empty parameter
  means: an empty value, or no value at all.

This is a pure refactor. The query-param unit tests and `st_query_params_test.py` /
`st_query_params_history_test.py` cover it. It should be its own PR, so a regression is
easy to bisect.

**The URL is a second client channel, and it deliberately has fewer rules.** A bound
widget's parameter gets the same *value* rules, through the same serde. It does not get
the *structural* rules, and that is by design: an author who binds a widget is accepting
that a shared link can set it. Concretely:

- URL seeding still applies to a `disabled` bound widget. #16209 exempted this on
  purpose.
- On load, a URL can set a form field without a submit.

Binding's priority rules limit when the URL applies at all: on initial load and on
browser back/forward navigation. Otherwise session state and user interaction win. If
the boundary check drops a client value for a bound widget, seeding can run in the same
rerun only under those rules. Its value then passes the same `validate`, so the URL
cannot be used to get around the drop. The security docs should spell this out; whether
`disabled` should also block seeding is open question 5.

**Programmatic writes: a follow-up, not part of this spec.** App code is trusted, so a
programmatic value raises no security question. It also does not affect agents: the
browser and the agent API echo it back unchanged, and unchanged values pass check 1. But
today an out-of-constraint write has four different outcomes, depending on the widget:

- **Reset to the default:** an unknown option, or a number or date out of range.
- **A clean error:** more than `max_selections`, or a slider above `max_value`.
- **Accepted unchecked:** text past `max_chars`, a failed `validate`, or the color
  `"red"`.
- **A raw `TypeError`:** `"abc"` for a number input, `123` for a text input, or `"yes"`
  for a checkbox.

With `validate` on every serde, registration can decide all four in one place. The
follow-up should:

- Turn each raw `TypeError` into a `streamlit.errors` exception that names the widget and
  the expected type. This is a pure improvement.
- Keep resetting values made stale by options or bounds that changed since an earlier
  run. That is reconciliation, not an author mistake.
- Decide whether an explicit write that violates a constraint raises, following the "fail
  fast" API principle, or resets. Apps may rely on today's resets, such as
  `st.session_state.choice = None` to reset a selectbox, so raising needs a deprecation
  path.

That last decision changes API behavior, so it belongs in its own spec or papercut,
together with open question 3 on `AppTest.set_value`.

### Per-item notes

Items 1–3 are covered above.

**Item 4: bounds, shapes, formats, length.**
- `number_input`: a finite value within `min`/`max`. An `INT` input accepts a whole
  number only; the browser's `parseInt` never sends a fraction.
- `slider`, `select_slider`, `date_input` ranges: the item count is fixed. `date_input`
  allows up to two items, and an empty or start-only range. The values must be ordered,
  which the browser guarantees.
- `datetime_input` and `time_input`: the exact ISO layout the browser sends.
- `color_picker`: `#rgb` or `#rrggbb` checked with `fullmatch`, which also fixes `$`
  matching before a trailing newline.
- `pagination`: an integer in `1..num_pages`.
- `feedback`: an index in range.
- `max_chars`: compared as `len(text)` in code points. The browser counts UTF-16 code
  units, and that count is never smaller, so nothing a browser accepts is refused.
- The deserializers keep coercing, for URL and programmatic values.

**Item 5: `required`.** `required` limits what a user can submit, not what the widget
holds, so an untouched required widget legitimately stays empty. The check is therefore a
rule about changes: a required widget may not *change* to empty. An unchanged value
passes check 1, so an empty default is never refused. An agent's `null` sent to an empty
widget is a no-op, and its `null` sent to a filled one is `empty_required`. The stricter
form rule, that a submit needs every required field filled, belongs to item 7.
- Emptiness follows the widget: `None`, `[]`, or text that is only whitespace.
- Whitespace uses the ECMAScript `trim()` set, so the server is never stricter than the
  browser. Python's `str.strip()` strips a slightly different set.
- `required` stays out of keyed identity, per the
  [required spec](../2026-08-18-required-widgets/product-spec.md). So a key whose
  `required` flips from false to true keeps its empty value until the user changes it.

**Item 6: data editor.** `DataEditorSerde` gains an edit policy, captured at registration,
and its `validate` checks the payload against it:
- `editing_mode`
- the row count
- the editable columns: not disabled, not auto-disabled for Arrow incompatibility, not
  hidden, and not a type that cannot be edited
- whether the index can be edited (never for a `RangeIndex`)

Positional keys (`_pos:N`, or integer column keys) are resolved to the names the payload
uses. The payload is cumulative, so only entries that are **new or changed** relative to
the stored payload are checked. Edits accepted earlier, for example to a column disabled
since, are kept as they are today, so the editor never locks up.

On a violation, the previous edit state is kept. Out-of-range or negative row indices and
unknown columns become violations instead of raising. Added rows are applied in one
`concat`, not row by row: today about 2 ms per row, so 10k rows cost about 22 s of
script time.

**Item 7: forms.** `WidgetMetadata` gains `form_id`, which today exists only on the proto.
The check groups a message by form:
- A changed field is accepted only if the same message fires a rendered, enabled submit
  button of that field's form (`form_not_submitted`).
- When a submit fires, every rendered required field of that form must be non-empty after
  the message is applied. Otherwise the trigger and all of that form's field changes are
  dropped together (`form_invalid`). This is the only atomic rule, because a submit is a
  transaction.
- A disabled submit drops the form's field changes too. Today the fields still apply.
- Changes outside the form in the same message are judged on their own. The browser can
  legitimately send them, for example values buffered by `on_change="ignore"`.

This matches the browser: edits stage in the form's pending map, and so do the defaults
that `clear_on_submit` restores, because that handler writes with `fromUser: true`. It
also matches `AppTest`, which stages form values until submit.

With form membership on the server, the agent API can apply `clear_on_submit` itself for
agent sessions, which the agent spec lists as follow-up #8.

**Item 8: selections.** `_validate_selection_state` (`elements/arrow.py:463`) already
checks mode and bounds, but only for programmatic selections. The dataframe selection
serde's `validate` calls it for client values. A `ButtonColumn` click is checked for `row < num_rows`.

**Item 9: fragments.** `AppSession.request_rerun` accepts a `fragment_id` only if the
fragment was registered by the last run that covered it. Stale fragments are also cleared
when a run ends with `st.stop()` or an exception (`script_runner.py:925-936`). Dialog
fragments and `run_every` fragments need tests.

**Items 10–12** need their own designs:
- **Data editor cells (10)** must mirror each column type's browser semantics. Some clamp,
  some reject, and some truncate. The rule is to refuse only what the browser can never
  produce. A `NumberColumn` above `max_value` is clamped in the browser, so the server
  refuses it.
- **Uploads (11)** live on the HTTP path. A per-widget `max_upload_size` must use the
  browser's larger unit: it computes MB as ×1024 on Windows and ×1000 elsewhere.
- **Chart selections (12)** are specific to each library.

### Agent API integration

`widget_writes.build_widget_states` already encodes each value into the `WidgetState` the
runtime will see. After encoding, it calls `widget_checks.check_client_value` with the
session's metadata and stored values, maps the `Violation` to its code and message, and
refuses the request. This runs while no run can start, so there is no race.

The snapshot-based addressing checks stay first, so the existing error codes win where
they apply. Each item deletes the agent's own copy of its constraint, as listed in the
[product spec](product-spec.md#agent-interaction-api).

### Performance

This is the rerun hot path (`runtime/state/session_state.py`). The cost per message:

| Case | Cost |
| --- | --- |
| Unchanged entry, which is most of every browser message | One proto equality |
| Changed scalar | One set lookup and one deserialize, which already happens today |
| Changed list | Linear in the list |
| Data editor | Linear in the changed entries |

A browser session's registration path builds nothing new: the validator is a bound method
of the serde each widget already creates, and option lookups are built lazily. Add a benchmark next to the existing session-state ones: 1,000 widgets with one
change, and a 10,000-option selectbox changing its value. The budget is no measurable
regression in the unchanged case.

### Testing

- **Unit tests** for every helper, both accept and refuse, including the edges the
  [inventory](constraint-inventory.md) lists: UTF-16 against code points, the whitespace
  set, partial date ranges, and lossless numeric fields.
- **Per widget**, forged `WidgetStates` through `AppTest._run(widget_state=...)`. Assert
  that the callback did not fire, the previous value was kept, and `set_value` was sent.
  Also assert that an unchanged default passes.
- **Agent API**: new `invalid_value` cases for each item, and the deleted checks keep
  their behavior.
- **Browser parity**: run the e2e suite with rejections logged at warning level and fail on
  any. A correct browser must never be refused, so this guards against false positives,
  which is the main risk. Forged values cannot be sent from a browser, so no new e2e tests
  are needed beyond re-sync.

## Alternatives considered

- **Validate at registration only, against this run's constraints.** Callbacks have
  already run by then, so it cannot protect them. It would also refuse a legitimate click
  whenever the click itself changes the widget's constraints.
- **Validate inside each deserializer.** Deserializers also serve URL and programmatic
  values, where coercion is correct. They have no way to report a violation, and they run
  lazily wherever a value is first read.
- **Keep validation in the agent API.** That leaves the browser path open, keeps two
  definitions that disagree within a release, and ties validation to agent descriptions.
- **Only declarative constraint fields interpreted centrally**, extending
  `formatted_options` and friends. Date, range, and data editor semantics would leak into
  the state layer, and a widget's rules would no longer be in the widget.
- **Composing helpers at the `register_widget` call site** instead of a serde method. The
  call site would refuse values while the serde, which coerces URL values, held a second
  copy of the same rule. A method keeps one definition per widget, beside the facts it
  needs.
- **Folding validation into `deserialize`**, for example by having it raise or return a
  sentinel. A deserializer must coerce URL and programmatic values and must always return
  a value, so it cannot also report a refusal without a second return channel. A separate
  method that `deserialize` calls gives that channel and keeps both on the serde.
- **Reject the whole message, or close the connection.** See the product spec's options.
  Both are hostile to benign races.
- **A public opt-out config.** It invites disabling a security fix to paper over a race we
  should fix instead. See open question 1.

## Open questions

1. Should items 3 and 7, the ones with race risk, ship behind a hidden
   `server.enforceWidgetConstraints` kill switch for one release?
2. `st.data_editor` has no `set_value` channel for edit state. Is it enough that a correct
   browser cannot hit an edit refusal, apart from a cumulative edit to a column disabled
   since, which is accepted? Or should an editor whose edits were refused be remounted?
3. Should `AppTest.set_value` raise for a violating value, reporting through the same check
   the way the agent API does, instead of letting the run drop it silently?
4. Should a rejection count be surfaced anywhere beyond logs, for operators watching for
   forged traffic?
5. Should `disabled` also block URL seeding of a bound widget? Today #16209 exempts it on
   purpose, so a shared link can set a filter the app shows as disabled. Blocking it would
   make `disabled` absolute, at the cost of links that set such filters.
