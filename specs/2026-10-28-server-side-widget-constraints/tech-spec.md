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
   An entry with no metadata, such as one a reconnecting browser resends to a new
   session, reads as unchanged, and no callback runs.
4. The script body runs. `register_widget` (`:1591`) installs this run's metadata and
   resolves the value from the cached `Value`, so the new deserializer is not reapplied.
   An entry that had no metadata is still `Serialized`, so this run's deserializer reads
   it. It discards a value for a widget that is disabled *now*. Widget code then
   reconciles options and bounds (`elements/lib/options_selector_utils.py`, plus
   per-widget checks).
5. `on_script_finished` prunes stale widget *states* (`:1354`), including every entry
   whose widget never registered, but never prunes `widget_metadata`.

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
# SessionState.on_script_will_rerun. Validate fresh browser states, after
# omitting URL-bound values for history navigation. Replayed triggers were
# validated when captured and are overlaid after callbacks.
self.set_widgets_from_proto(fresh_widget_states)
changed, self._rejected_client_values = self._check_incoming_widget_states()
self._call_callbacks(changed, ...)  # reuses the boundary's comparison
```

```python
def _check_incoming_widget_states(self) -> tuple[tuple[str, ...], frozenset[str]]:
    """Return the IDs of accepted changes, in message order, and of rejected values."""
    changed: list[str] = []
    rejected: set[str] = set()
    # After compaction the states hold this message only. set_widgets_from_proto
    # kept the last entry of a repeated ID at the position of its first, so each
    # ID is checked once, on its last entry, and callbacks keep message order.
    for widget_id, wstate in list(self._new_widget_state.states.items()):
        state = wstate.value
        metadata = self._new_widget_state.widget_metadata.get(widget_id)
        if metadata is None:
            # Never registered in this session: a value is checked when its
            # widget registers. A correct browser never resends a trigger.
            if _has_active_trigger_value(state):
                self._new_widget_state.drop(widget_id)
                rejected.add(widget_id)
            else:
                self._unregistered_client_ids.add(widget_id)
            continue
        result = widget_checks.check_client_value(
            state,
            metadata=metadata,
            previous=self._old_state.get(widget_id),
            is_rendered=widget_id in self._new_widget_state.rendered_ids,
        )
        # A browser sends a shared format_func label as is; only the agent API
        # refuses it. browser_refuses says which kinds a browser session drops.
        if not widget_checks.browser_refuses(result.violation):
            # Cache the deserialized value so the run does not deserialize it again.
            self._new_widget_state.cache_value(
                widget_id, result.value, state.WhichOneof("value")
            )
            if result.changed:
                changed.append(widget_id)
            continue
        if result.partial is not None:
            # A data editor keeps its payload minus the violating entries (item 6).
            self._new_widget_state.cache_value(
                widget_id, result.partial, state.WhichOneof("value")
            )
            if result.changed:
                changed.append(widget_id)
        else:
            self._new_widget_state.drop(widget_id)  # previous value stays in _old_state
            rejected.add(widget_id)
            if metadata.value_type not in _TRIGGER_PROTO_FIELDS:
                self._pending_resync.add(widget_id)  # see Browser re-sync
        # Never logs the value. The dedup set holds only IDs with metadata.
        widget_checks.log_violation(
            widget_id, result.violation, warned=self._warned_widget_ids
        )
    return tuple(changed), frozenset(rejected)
```

`changed` is ordered because callbacks run in message order, which the agent API relies
on when it sorts its states into snapshot order. Compaction clears every stored entry
before the message arrives, including entries with no metadata that an interrupted run
left behind (`MutableMapping.clear` used to stop at the first of them), so the states
hold exactly this message.

`check_client_value` is a function in a new `runtime/state/widget_checks.py`. It reports
a violation and never acts on it. Its only side effect comes from the chat input
deserializer, which consumes upload records (see below). It applies these checks in order
and returns the first violation, together with the deserialized value once step 2 has
read it:

1. **The wire field is one the widget accepts** (`wrong_type`). Item 1 derives each
   widget's accepted fields from what the frontend actually sends, audited per widget,
   not from the registered `value_type`. `register_widget`'s docstring
   (`runtime/state/widgets.py`) calls that a "best-effort guess" that is "updated to be
   the correct type" once a proto arrives, which is why `WStates.__getitem__` overwrites
   it today. Most widgets turn out to accept the `value_type` they registered.
   - Lossless numeric pairs are interchangeable: `int_value` with `double_value`, and the
     int and double array fields, within ±2^53, where a double holds every integer
     exactly.
   - Components v1, which register `json_value`, also accept `bytes_value` and
     `arrow_value`.
   - `WStates.__getitem__` stops overwriting `metadata.value_type`. The field that
     actually arrived is kept on the cached `Value`, and `get_serialized` reads it from
     there, so a Components v1 value that arrived as `bytes_value` is not passed to
     `json.dumps`.
2. **The deserializer can read it** (`unreadable`). Unpacking (`json.loads` for
   `json_value`) and the shown run's deserializer run in one `try`, as
   `_widget_changed` deserializes today. Any exception counts, including the
   `StreamlitAPIException` that upload deserializers raise for a disallowed file name
   (`enforce_filename_restriction`), so item 1 turns that raise into a drop. The browser
   filters the same extensions, so only a forged upload loses today's error. The result
   is cached as the `Value`, so it is computed once. With check 1, this keeps a
   wrong-type or malformed value for a disabled widget from crashing the session, the
   first hole #16209 left.
3. **Unchanged values pass.** The deserialized value is compared with `_old_state`.
   This is the comparison `_widget_changed` makes today, moved here, so no wire form is
   stored, and `_call_callbacks` takes the changed IDs instead of comparing again. Both
   of its paths iterate those IDs. Its Components v2 path keeps its own per-key diff and
   sees only the changed entries the boundary kept: a dropped value diffed against the
   old map would read as every key changing. So its `disabled` check goes away too. A
   deserializer never replaces a value its validator refuses, apart from the button
   groups' stale-label recovery (see [below](#where-constraints-live-in-each-widgets-serde)),
   so a violation cannot read as unchanged. Only a conversion can map a forged value onto
   the stored one, such as `2.9` onto `2` for an `INT` input, and that changes nothing. Most
   entries end here: the browser resends its whole widget map on every rerun. An active
   trigger always differs, because `_reset_triggers` cleared the stored one first, and an
   inactive one, such as `trigger_value: false`, is unchanged.
   - The agent API compares wire values instead, so even such a value reaches the
     validator. See [Agent API integration](#agent-api-integration).
4. **The widget is rendered** (`not_rendered`). See the
   [rendered-widget gate](#rendered-widget-gate).
5. **It is not disabled** (`disabled`).
6. **The widget's own validator** (`metadata.validator`, the serde's `validate`, see
   below), on the unpacked wire value. This covers the widget's options, bounds, shapes,
   lengths, and whether an empty value is allowed.

`check_client_value` never raises. A validator that raises is logged at warning level
and refuses the value as `unreadable`, so a validator bug cannot stick a session.

Step 2 runs the deserializer before the rendered and `disabled` checks, which is
today's order: `_widget_changed` deserializes every incoming entry before
`_call_callbacks` reads `disabled`. The one deserializer with a side effect is chat
input's, which removes the upload and audio records it reads from
`MemoryUploadedFileManager`, so a refused chat value consumes its records, as a disabled
one does today. Nothing can read them afterwards: a chat value is a trigger the browser
never resends, so keeping them would only hold the files until the session ends.

**Widgets this session never registered.** An entry with no metadata skips the boundary
check. This is what a browser sends when it reconnects to a new session, after a server
restart or an expired `server.disconnectedSessionTTL`: it resends its whole widget map.
When the widget registers, its value runs through checks 1, 2, 3, 5, and 6 against this
run's metadata. Check 3 compares it with the default, so an untouched, empty `required`
widget passes. A violation is handled as at the boundary: `ambiguous_option` is
accepted, and any other violation drops the value as never sent, which in a new session
means the default, and re-syncs the browser. The drop also clears
`incoming_serialized_value(s)`, as the `disabled` discard does today, so option
reconciliation cannot fall back to the refused label. So state restoration keeps
working, and skipping the boundary is safe:

- No callback can fire for the entry, because `_call_callbacks` needs metadata.
- A value whose widget never registers is discarded at the end of the run, because
  `_is_stale_widget` treats missing metadata as stale.

A trigger with no metadata is dropped at the boundary instead. A correct browser sends a
trigger once and never resends it, so such a trigger is forged, or it is a click on a
stale element right after a reconnect, before the new session registered the widget.
Today it makes the widget return `True` without running its callback.

Replayed trigger states (`replay_trigger_states`) are server-held and were checked when
they first arrived, so they skip the check. That holds only if replay capture skips the
rejected entries: it reads the raw message (`_current_interaction_widget_states`), so it
takes the last entry per ID, as the boundary does, and filters out the IDs in
`_rejected_client_values`. Otherwise a rejected trigger sent beside a legal callback that
requests a targeted rerun would come back unchecked in the next run.

### Violations

```python
class Violation(NamedTuple):
    kind: ViolationKind
    # Facts that explain the refusal, such as the options or bounds. Never the
    # sent value, which may be a password. The default is read-only because
    # every Violation shares it.
    detail: Mapping[str, Any] = MappingProxyType({})


class CheckResult(NamedTuple):
    violation: Violation | None
    # The deserialized value, once readable. Cached as the widget's Value.
    value: Any = None
    # A data editor payload without its violating entries (item 6).
    partial: Any = None
    # Whether the value kept, `value` or `partial`, differs from the stored one.
    # Always False for a refused value.
    changed: bool = False
```

| `kind` | Reported by | Browser session | Agent API code |
| --- | --- | --- | --- |
| `not_rendered` | gate | drop, debug log | `not_on_page` (the snapshot check usually answers first) |
| `disabled` | gate | drop | `disabled_widget` |
| `wrong_type`, `unreadable` | integrity | drop, warning | `invalid_value` |
| `not_an_option`, `too_many_items`, `duplicate_items` | options | drop | `invalid_value`, with the options listed |
| `ambiguous_option` | options | **accepted**: duplicate `format_func` labels are legal, the browser sends the shared label, and the widget resolves it as today: `st.multiselect` to the first option with that label, the other option widgets to the last (`create_mappings`) | `invalid_value`, as today |
| `out_of_range`, `bad_shape`, `malformed`, `too_long` | bounds, shapes, length | drop | `invalid_value`, with the bound |
| `empty_required` | `required` | drop | `invalid_value` |
| `form_not_submitted`, `form_invalid` | forms (item 7) | drop the form's changes | `missing_form_submit`, `invalid_value` |

A rejection is logged at debug level when a correct browser can cause it in a sync race:
`not_rendered`, `disabled` (a `run_every` rerun disables the widget before the click
lands), `not_an_option`, `too_many_items`, `out_of_range`, `too_long` (a key keeps the
ID while `max_chars` drops), and `empty_required` (`required` is outside keyed
identity). It is logged at warning level otherwise, once per widget per session:
`wrong_type`, `unreadable`, `duplicate_items`, `bad_shape`, and `malformed`, which a
correct browser never sends. Under the hidden `global.e2eTest` option every rejection is
logged at warning level and never deduplicated, for the e2e parity gate. That dedup set only holds
IDs with metadata: an unknown ID is never checked at the boundary, and a trigger dropped
for having none is not logged. So the set is bounded by the widgets this session
registered, not by what a client sends.

### Where constraints live: in each widget's serde

What a widget accepts is defined by the widget, in its own module, beside how it reads
and writes its value. Each serde gets a `validate` method next to `serialize` and
`deserialize`. It is registered through a new `WidgetMetadata` callback, the same way the
other two are:

```python
# runtime/state/common.py
class WidgetValidator(Protocol):
    def __call__(
        self, ui_value: Any, *, previous: Any = None, value: Any = None
    ) -> Violation | None:
        """Return a violation for one changed client value, or None.

        `ui_value` is the unpacked wire value, `value` is that value after
        `deserialize`, and `previous` is the stored value. Only the data editor
        reads the keywords.
        """


class WidgetMetadata(Generic[T]):
    deserializer: WidgetDeserializer[T]
    serializer: WidgetSerializer[T]
    # What a client may send. The boundary calls it with the unpacked wire value
    # of a changed entry, before callbacks run, and URL seeding calls it too.
    # None accepts anything the deserializer reads.
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
    required: bool

    def validate(
        self, ui_value: Number | None, *, previous: Any = None, value: Any = None
    ) -> Violation | None:
        if ui_value is None:
            # An unset value reads as the default, as the browser commits the
            # default when the user empties a field that has one. It is empty
            # only without a default, and then a required widget refuses it.
            if self.value is None and self.required:
                return Violation("empty_required")
            return None
        # Refuse non-finite values for every type: NaN fails every comparison, and
        # check 1 lets an INT input receive a double such as 2.5.
        if not math.isfinite(ui_value):
            return Violation("malformed")
        if self.data_type == NumberInputProto.INT and not float(ui_value).is_integer():
            return Violation("malformed")
        return widget_checks.within(ui_value, self.min_value, self.max_value)

    def deserialize(self, ui_value: Number | None) -> Number | None:
        # Converts but never replaces a value: check 3 compares the result with
        # the stored value, and validate refuses what a client may not send.
        val = ui_value if ui_value is not None else self.value
        is_int = self.data_type == NumberInputProto.INT
        if is_int and val is not None and math.isfinite(val):
            val = int(val)  # a URL value of 2.9 still becomes 2, as today
        return val


register_widget(
    ...,
    deserializer=serde.deserialize,
    serializer=serde.serialize,
    validator=serde.validate,
)
```

**`deserialize` converts and never replaces.** It keeps its conversions, such as `int()`
or sorting a reversed range, but it no longer falls back to the default for a value
`validate` refuses. The text serdes drop their `max_chars` slice entirely, since URL
seeding takes over truncation. Check 3 compares its result with the stored
value, so a replaced value would read as unchanged whenever the widget holds its default,
with no log and no re-sync, and a correct browser can send such a value in a sync race.
A conversion can still map a forged value onto the stored one, but a correct browser
never sends that form, so nothing needs a re-sync. A value a deserializer cannot
represent, such as an unknown `select_slider` label, passes through as the label, as
`selectbox` already does. `st.feedback` keeps an index outside its options, and
`st.menu_button` still reads an unknown label as no click: a trigger resets anyway, and
the agent API's wire comparison still reaches its validator.

One deliberate exception stays. A keyed `st.pills` or `st.segmented_control` maps a
label it cannot resolve to the selection it holds in session state. After a relabel, such
as a language switch, a correct browser can echo the old labels until it applies the new
ones, and the recovery reads that echo as unchanged, so it fires no `on_change` and is
not refused. A forged unknown label therefore also reads as unchanged for these two
widgets: no callback runs and the value is kept, but the browser is not re-synced.

URL seeding relies on today's fallback and truncation, so it
takes both over. It calls `validate` itself, on the deserialized value serialized again,
after the array repairs it already makes (`_sanitize_url_array` filters, deduplicates,
and truncates a multiselect's or button group's array until the URL-binding refactor
below), and repairs what today's deserializers repair: text is truncated to `max_chars`,
and an unknown `select_slider` label falls back to that position's default, because a
widget that is never empty keeps its default's shape. Truncation counts
UTF-16 code units, as the check does, and never splits a character, so a repaired value
is valid text that always passes the check, including when a reconnect to a new session
checks it at registration. For text with astral characters, such as emoji, that keeps
fewer characters than today's code-point slicing, which the product spec lists as a
behavior change. `ambiguous_option` is accepted, as at the boundary, and any other
violation clears the parameter. So `?q=abcd` for `max_chars=3` still seeds `"abc"`,
`?n=2.9` still seeds `2`, and an out-of-range value is still cleared. As today, a
repaired value that equals the default clears the parameter instead of seeding it. Each
widget makes this change in the item that gives it a validator (items 2 and 4).

**Why the serde is the right home:**

- **It already holds the facts.** Options, bounds, `max_chars`, and `format_func` are
  already on the serde, captured from the run that rendered the widget, which is exactly
  the contract the client was shown. Metadata keeps that run's serde until the widget
  registers again, so validating against it needs no extra bookkeeping.
- **Each rule lives in one place per widget.** Today the same bounds or options rule is
  written twice: in the deserializer, for URL values, and again in the widget function
  after registration. `validate` replaces the deserializer's copy.
- **A widget is reviewed in one file:** what it renders, what it accepts, and how it reads
  values. A coverage test, like the agent description test, fails for a value widget
  registered without a validator unless an explicit list says any value of the right wire
  type is legal, as for `checkbox`, `toggle`, and buttons.

**What does not belong in the serde.** Rules about the protocol or about containers stay
in `widget_checks.check_client_value`, which calls `metadata.validator` as step 6:

- the wire field
- readability (by running the deserializer)
- unchanged values pass
- the rendered gate
- `disabled`
- form membership (item 7), a property of the form rather than of a value

None of these differs per widget, and putting them in each serde would copy them 20
times.

**Shared helpers** keep serdes from repeating the same comparisons. They are small pure
functions that return a `Violation` with its details:

- `within(value, min, max)`, `one_of(counts, value, accept_new)`,
  `items_of(counts, values, max_items, unique, accept_new)`
- `iso_date`, `iso_time`, `hex_color`
- `text_length(text, max_chars)`, `is_empty(value)`

An options serde builds its label counts (a `Counter`) lazily with a `cached_property`, so
a browser session whose widgets never change pays nothing. Counts rather than a set,
because `ambiguous_option` needs to know when a label is shared, as
`widget_writes._validate_options` does today. `one_of` and `items_of` report
`ambiguous_option` only when the value has no other violation, so a browser session can
accept it. A shared label repeated at most as often as options share it is
`ambiguous_option` too, not `duplicate_items`: the multiselect's "Select all" adds every
option's label. A violation's detail never holds a sent label: `not_an_option` lists the
`options` and the `positions` of the items that failed, and `duplicate_items` the position
of the first extra repeat. With `accept_new`, which `accept_new_options` sets, any
non-empty label is legal, a shared label included, because the browser lets the user type
one. `max_items` and `unique` still apply, and a new label can be listed once.

**The previous value.** Check 3 already passes unchanged values, so a validator sees only
changes and almost never needs the previous value. The data editor is the exception: its
payload is cumulative, so `DataEditorSerde.validate` uses the `previous` keyword to check
only new or changed entries. `previous` is the deserialized `_old_state` value, so
`check_client_value` also passes check 2's deserialized payload as `value`. Both then
have integer row keys, and the JSON is parsed once. Every other serde ignores both
keywords.

URL seeding reuses `validate` as well. See
[Other value sources](#other-value-sources-url-binding-and-session-state).

### Rendered-widget gate

`WStates` gains `rendered_ids`: the widgets registered by the latest run that covered
them. A full run covers every widget, and a fragment run covers its fragment's widgets.

"Registered" is deliberately broader than "displayed". A widget the app removes later in
the same run still counts, for example after `placeholder.empty()` or another element
written to the same placeholder: the app emitted it, and its ID stays in
`widget_ids_this_run`. Tracking replaced delta paths would add cost to every run's hot
path, so the guarantee names registration instead.

The set changes at three points:

- **When a run registers a widget,** the widget is added. A run in progress, including
  one later interrupted, already sent that element to the browser.
- **Where `_remove_stale_widgets` runs,** the set is pruned: it removes the widgets the
  run covered but did not register, and it never adds one. This happens in
  `on_script_finished` with `remove_stale_widgets=True`, and uses the same rule that
  scopes states to `fragment_ids_this_run`. After a fragment run, only that fragment's
  widgets are pruned.
- **When a run ends in `st.stop()` or an uncaught exception,** the set is pruned the
  same way. That path sets `premature_stop`, so `_on_script_finished` skips
  `on_script_finished` and no state is pruned, which keeps widget values as today. The
  browser still removes every element the run did not send. Without this prune, a
  widget hidden behind `if not logged_in: st.stop()` would stay in the set, and a forged
  trigger would still fire its callback.
  - Pruning rather than replacing matters on a page transition. There,
    `script_runner.py` calls `on_script_finished` with IDs taken from the client's
    `rerun_data.widget_states`, before `on_script_will_rerun` runs the check. Replacing
    the set with those IDs would let a forged ID into `rendered_ids` just before the
    check. Only registration adds an ID.
  - The page-change message itself is therefore checked against the previous page's
    widgets: no run has covered them since the browser showed them. A trigger for one of
    them passes, as it would have one message earlier, so a client gains nothing. The
    new page's first completed run prunes them.
  - When a run's widget list is incomplete (`remove_stale_widgets=False`: the body never
    ran, or `st.rerun()` interrupted it), the set is not pruned, exactly as states are
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
registration-time discard of client values goes away, apart from the check of
[widgets this session never registered](#the-boundary-check). This closes the holes
#16209 left:

- A wrong-type or unreadable value for a disabled widget is refused by checks 1 and 2,
  inside their `try`, so it can no longer crash the session.
- A widget that becomes disabled during the run its click caused keeps the click's value.
  Its callback has already fired, so the return value now agrees with it.
- A disabled bound widget ignores its URL parameter (below).

A widget that was disabled when shown and is enabled during the run is still refused.

**A disabled widget accepts no client input from any channel.** The URL parameter of a
disabled bound widget is ignored on initial load and on back/forward navigation, and the
widget keeps its default or previous value. The server rewrites the parameter to the
widget's actual value, or removes it, the way it already corrects an invalid URL value,
so the address bar never claims a value the widget does not hold. Today #16209 exempts
URL seeding: the priority check in `_handle_query_param_binding` lets a disabled widget
seed, and `url_binding_resolved` then skips the disabled discard in `register_widget`.
That leaves two holes:

- With `disabled=not st.user.is_admin` and `bind="query-params"`, a user who cannot
  change the filter in the UI can set it by editing the URL.
- The agent API refuses a disabled widget in `widget_state` with `disabled_widget`, but
  `query_params` on a navigation request still sets it. Blocking makes both paths agree.

Removing the two exemptions would not close these holes. On a clean initial load,
seeding never reaches the priority check, and `_seed_widget_from_url` writes the value
into `_new_session_state`, which wins resolution even after the widget-state entry is
discarded. So `_handle_query_param_binding` returns early for a disabled widget, before
anything is seeded. The correction then needs its own forward message, through
`remove_param` or `set_corrected_value` as `_clear_url_param` does. The regular sync in
`register_widget` would not send one: it drops a parameter at the default only on the
server (`discard_param_no_forward_msg`), and it leaves a parameter that is already present.
The correction is sent only where the URL would have seeded an enabled widget: the
parameter is present and binding's priority rules give the URL the value, which is the
case on initial load, on history navigation, and when a page change brings the widget
back. Elsewhere the browser has already dropped the parameter, and correcting it on every
rerun would rebroadcast `page_info_changed`. Seeding and the correction share one helper
for those priority rules, so they cannot drift apart.

An app that wants a link to preset a filter shown as locked reads `st.query_params` in
app code and passes the value to the widget. App code is trusted, and the author owns
that check. This rule is part of item 1, which moves the `disabled` decision, and not of
the URL-binding refactor, which keeps behavior unchanged.

### Browser re-sync

Each rejected ID in `_rejected_client_values` that is in `rendered_ids` stays pending in
`_pending_resync` until its widget next registers. There, `register_widget` sets
`value_changed` when no programmatic value takes over, and removes the ID. That is the
same condition as `disabled_value_discarded` today, so the widget's proto carries
`set_value` and the browser shows the server's value. A violation found at registration,
for a widget this session never registered, sets it the same way. Once a widget has a
validator, its deserializer no longer corrects a client value (see
[above](#where-constraints-live-in-each-widgets-serde)), so every correction is a refusal
with this re-sync, which closes gap (d).

A fragment run does not register widgets outside the fragment, yet it still receives the
browser's whole widget map. So a value refused for such a widget is corrected at the next
run that covers it, usually the next full run. Until then the browser resends it and the
check refuses it again. Only a benign race needs this, because a correct browser's value
is refused only when a rerun changed the widget first. The pending set is pruned together
with `rendered_ids`, so it is bounded by the rendered widgets.

Trigger widgets need no re-sync: a trigger resets anyway. Some widgets have no
`set_value` channel: `st.data_editor`, `st.tabs` (`TabContainer` has no `set_value`,
and `Tabs.tsx` re-syncs only when `default_tab_index` changes), the open state of
`st.expander` and `st.popover`, `st.file_uploader`, `st.camera_input`, `st.audio_input`,
and dataframe and chart selections (items 8 and 12). `Dataframe.selection_state` does
not qualify: `DataFrame.tsx` skips a value it already applied, so a second correction to
the same value would not show. The browser keeps showing a refused change for them
until they remount or the user changes them again. For `st.data_editor`, item 6
therefore drops only the refused entries. A frontend re-sync for the others, such as a
forced flag on `TabContainer`, is a follow-up.

### Other value sources: URL binding and session state

A widget's value can come from three places. The serde's `validate` is the one definition
of what the widget accepts, and each source applies its own policy to a violation:

| Source | Trusted? | Policy on a violation | In this spec |
| --- | --- | --- | --- |
| Client `WidgetStates` | No | Drop it as never sent; the agent API refuses the request | Yes |
| A bound widget's URL parameter | No: the client sends the query string in `ClientState` | Ignore it for a disabled widget. Otherwise repair it, then validate it, then clear or correct the parameter | The `disabled` rule in item 1, and a refactor onto `validate`, below |
| Programmatic `st.session_state` writes | Yes: it is app code | Mixed today | Follow-up, below |

**URL binding: a behavior-preserving refactor after item 4.** `_seed_widget_from_url`
already validates the query string. Items 2 and 4 have it call `validate` where a
deserializer used to fall back to the default or truncate (see
[above](#where-constraints-live-in-each-widgets-serde)). Its other checks are comparisons
on metadata fields that exist only for this purpose. Once every serde has a validator:

- **Membership and bounds come from `validate`.** The URL path still repairs array
  parameters, but the violation details drive the repair:
  - drop items reported as `not_an_option`
  - deduplicate after `duplicate_items`
  - truncate to the `max_items` that `too_many_items` reports
- **Three metadata fields go away.** `max_array_length`, `allow_url_duplicates`, and
  `formatted_options` leave `WidgetMetadata`, because the serde already holds all three
  facts: `max_selections`, whether a range may repeat a value, and the labels.
  `formatted_options` is read only by the URL membership check in `_seed_widget_from_url`,
  which moves to `validate`. `pills`, `segmented_control`, and `select_slider` already
  send labels over `string_array_value`, and `_auto_correct_url_if_needed` writes a
  corrected value back with `metadata.serializer`, so no other role is left. `st.tabs`
  also passes `formatted_options`, so `_TabsSerde` gains the tab labels and a `validate`
  in item 2.
- **`clearable` stays.** It is not a validation fact. It says what an empty parameter
  means: an empty value, or no value at all.

This is a pure refactor. The query-param unit tests and `st_query_params_test.py` /
`st_query_params_history_test.py` cover it. It should be its own PR, so a regression is
easy to bisect.

**The URL is a second client channel, and it deliberately has fewer rules.** A bound
widget's parameter gets the same *value* rules, through the same serde, and `disabled`
(see [`disabled` consolidation](#disabled-consolidation)). It does not get the form rule,
and that is by design: an author who binds a widget is accepting that a shared link can
set it, so on load a URL can set a form field without a submit.

Binding's priority rules limit when the URL applies at all: on initial load and on
browser back/forward navigation. Otherwise session state and user interaction win. If
the boundary check drops a client value for a bound widget, seeding can run in the same
rerun only under those rules. Its value then passes the same `validate`, and a disabled
widget ignores it, so the URL cannot be used to get around the drop. The security docs
should spell this out.

**Programmatic writes: a follow-up, not part of this spec.** App code is trusted, so a
programmatic value raises no security question. It also does not affect agents: the
browser and the agent API echo it back unchanged, and unchanged values pass check 3. But
today an out-of-constraint write has four different outcomes, depending on the widget:

- **Reset to the default:** an unknown option, or a number or date out of range.
- **A clean error:** more than `max_selections`, or a slider above `max_value`.
- **Accepted unchecked:** text past `max_chars`, a failed `validate`, or the color
  `"red"`. Text past `max_chars` is corrected one rerun later, though: the browser sends
  it back, and the deserializer truncates it, which fires `on_change` although nobody
  changed the widget. Once deserializers stop truncating (item 4), the echo is unchanged
  and the text stays as written. The product spec lists this as a behavior change and
  leaves the alternative open (its [open question 1](product-spec.md#open-questions)).
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
together with the follow-up that makes `AppTest.set_value` raise for an invalid value
(see the product spec's [Out of scope](product-spec.md#out-of-scope)).

### Per-item notes

Items 1–3 are covered above.

**Item 4: bounds, shapes, formats, length.**
- `number_input`: a finite value within `min`/`max`.
- Every integer-valued widget accepts a whole number only: an `INT` `number_input`, an
  `INT` `slider`, and `pagination`. Check 1 lets them receive a `double_value`, which
  their deserializers truncate (`int()`) or, for `pagination`, return unchanged, but the
  browser never sends a fraction.
- `slider`, `select_slider`, `date_input` ranges: the item count is fixed. `date_input`
  allows up to two items, and an empty or start-only range. The values must be ordered,
  which the browser guarantees.
- The layouts the browser sends:
  - `date_input`: `YYYY-MM-DD`.
  - `datetime_input`: `YYYY-MM-DDTHH:MM`, with no seconds (`calendarDateTimeToIso`).
  - `time_input`: `HH:MM`, or `HH:MM:SS` when `step` is not a whole number of minutes
    (`timeToString`). Both are accepted for any `step`.
  - The deserializers also read the legacy `YYYY/MM/DD` and `YYYY/MM/DD, HH:MM`, which
    only URL values use. URL seeding validates them after deserializing, so those links
    keep working.
- `color_picker`: `#rgb` or `#rrggbb` in either case, as `_HEX_COLOR_RE` accepts, checked
  with `fullmatch`, which also fixes `$` matching before a trailing newline.
- `pagination`: an integer in `1..num_pages`.
- `feedback`: `""` or an index in range (`"0"` to `"n-1"`). The browser sends `""` when
  the user clicks the selected face again to clear it, and `FeedbackSerde` reads it as
  `None`.
- `max_chars`: counted in UTF-16 code units (`len(text.encode("utf-16-le")) // 2`), as
  the browser counts them, so an astral character counts as two and nothing a browser
  accepts is refused. `0` means no limit, as in the browser (`maxChars !== 0`). The text
  serdes truncate to `""` today; item 4 drops that slice along with the rest.
- The deserializers stop replacing refused values and keep their conversions, such as
  `int()`, and the text serdes stop slicing to `max_chars`. See
  [above](#where-constraints-live-in-each-widgets-serde).

**Item 5: `required`.** `required` limits what a user can submit, not what the widget
holds, so an untouched required widget legitimately stays empty. The check is therefore a
rule about changes: a required widget may not *change* to empty. An unchanged value
passes check 3, so an empty default is never refused. An agent's `null` sent to an empty
widget is a no-op, and its `null` sent to a filled one with an empty default is
`empty_required`. The stricter form rule, that a submit needs every required field
filled, belongs to item 7.
- Emptiness follows the widget: `None`, `[]`, `()`, or text that is only whitespace. An
  unset value reads as the widget's default, because the browser commits the default
  when the user empties a field that has one, so it is empty only when the default is.
  Two `date_input` cases differ: `[]` is empty even with a default, because
  `DateInputSerde` reads it as `None` (`()` for a range), and a `required` range with
  only a start date is empty, as in the browser's `isRequiredEmptyDateValue`.
- Whitespace uses the ECMAScript `trim()` set, so the server is never stricter than the
  browser. Python's `str.strip()` also strips `U+001C`–`U+001F` and `U+0085`, which the
  browser keeps, and keeps `U+FEFF`, which the browser strips.
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
since, are kept as they are today.

On a violation, only the violating entries are dropped and the rest is accepted:
`validate` lists them in the violation's detail, and `check_client_value` returns the
payload without them as `CheckResult.partial`, which the boundary caches. A dropped entry
keeps its previous accepted value: a refused change to a cell edited earlier keeps the
earlier edit instead of falling back to the source data.

The editor has no `set_value` channel, so refused entries stay visible in the browser
until the editor remounts or the user undoes them. The browser keeps resending them, and
they are refused each time, but nothing locks up: later legal edits still land. The agent
API refuses the request, as for any violation.

Out-of-range or negative row indices and unknown columns become violations instead of
raising. Added rows are applied in one `concat`, not row by row: today about 2 ms per
row, so 10k rows cost about 22 s of script time.

**Item 7: forms.** `WidgetMetadata` gains `form_id` and `is_form_submitter`, which today
exist only on the protos. The check groups a message by form:
- A changed field is accepted only if the same message fires a rendered, enabled submit
  button of that field's form (`form_not_submitted`). Another trigger in the form, such
  as a Components v2 event, is not a submit.
- When a submit fires, every rendered required field of that form must be non-empty after
  the per-field checks: a field whose change one of them dropped counts with its previous
  value. Otherwise the trigger and all of that form's field changes are dropped together
  (`form_invalid`). This is the only atomic rule, because a submit is a transaction.
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
serde's `validate` calls it for client values. A `ButtonColumn` click is checked for
`row < num_rows`.

**Item 9: fragments.** `AppSession.request_rerun` accepts a `fragment_id` only if the
fragment was registered by the last run that covered it. Item 9 also clears stale
fragments when a full-script run ends with `st.stop()` or an exception. Today that path
re-raises before `FragmentStorage.clear()` and skips it (`script_runner.py:925-936`). A
fragment run already prunes its own in `clear_stale_descendants`. Dialog fragments and
`run_every` fragments need tests.

**Items 10–12** need their own designs:
- **Data editor cells (10)** must mirror each column type's browser semantics. Some clamp,
  some reject, and some truncate. The rule is to refuse only what the browser can never
  produce. The browser clamps a `NumberColumn` value above `max_value` and never sends the
  original number, so the server refuses a cell that is still above `max_value`. It does
  not clamp on the server.
- **Uploads (11)** live on the HTTP path. A per-widget `max_upload_size` must use the
  browser's larger unit: it computes MB as ×1024 on Windows and ×1000 elsewhere.
- **Chart selections (12)** are specific to each library.

### Agent API integration

`widget_writes.build_widget_states` already encodes each value into the `WidgetState` the
runtime will see. After encoding, it calls `widget_checks.check_client_value` with the
session's metadata and stored values, maps the `Violation` to its code and message, and
refuses the request. This runs while no run can start, so there is no race.

A request carries only the widgets it addresses, so the agent API can afford the stricter
form of check 3. A written value counts as unchanged only if its wire value equals the
stored value serialized. Otherwise the validator runs, so `2.5` sent to an `INT`
`number_input` that holds `2` is refused with `invalid_value`, instead of being truncated
to `2` and reported as success. A mismatch that only differs in form, such as
`int_value` against `double_value`, just runs the validator, which accepts a legal value.
Empty forms are normalized before the comparison: a missing value field and an empty
array both mean empty. So a `null` sent to an empty widget still matches, even for a
`required` `st.pills` whose stored `None` serializes as `[]`, and item 5's no-op holds.

The snapshot-based addressing checks stay first, so the existing error codes win where
they apply. Each item deletes the agent's own copy of its constraint, as listed in the
[product spec](product-spec.md#agent-interaction-api).

### Performance

This is the rerun hot path (`runtime/state/session_state.py`). The cost per message:

| Case | Cost |
| --- | --- |
| Unchanged entry, which is most of every browser message | One wire-field lookup. The deserialize and the comparison are the ones `_widget_changed` makes today, each run once, because `_call_callbacks` reuses the comparison. |
| Changed scalar | Adds one set lookup and the validator |
| Changed list | Linear in the list |
| Data editor | Linear in the changed entries |

No wire form is stored, so memory does not grow. A browser session's registration path
builds nothing new: the validator is a bound method of the serde each widget already
creates, and option lookups are built lazily. Item 1 adds the first session-state
benchmarks (`lib/tests/streamlit/runtime/state/session_state_perf_test.py`): 1,000
widgets with one change, a 10,000-option selectbox changing its value, and an unchanged
data editor payload of about 20 MB. The budget is no measurable regression in the
unchanged case. Item 1 makes the 1,000-widget case about twice as fast, because reading
a client value no longer rebuilds the widget's metadata.

### Testing

- **Unit tests** for every helper, both accept and refuse, including the edges in the
  [inventory](constraint-inventory.md): astral characters against `max_chars`, the
  whitespace set, partial date ranges, and lossless numeric fields. Also fractions for
  every integer-valued widget, and a `json_value` that fails `json.loads`. Accept cases
  include every sentinel and layout the shipped frontend sends, because the browser
  parity run only catches an over-strict validator when some e2e app happens to send that
  value. Examples are the `st.feedback` clear `""`, a shared `format_func` label, also
  repeated by "Select all", a new option on an `accept_new_options` widget, `max_chars=0`,
  and each date and time layout above.
- **Per widget**, forged `WidgetStates` through `AppTest._run(widget_state=...)`. Assert
  that the callback did not fire, the previous value was kept, and `set_value` was sent,
  also while the widget still holds its default. Also assert that an unchanged default
  passes.
- **Session state**: a widget map sent to a new session keeps its values, including an
  empty `required` default and a shared `format_func` label, and fires no callback. A
  violating entry falls back to the default at registration, and a trigger in that map is
  dropped. A message that repeats an ID is judged on its last entry only, for callbacks
  and for replay capture alike. A value refused for a widget outside a fragment is
  corrected at the next full run. A run that ends in `st.stop()` or an exception before a
  widget registers keeps that widget's value, and a forged trigger for it is then
  refused. A programmatic text value past `max_chars` stays as written and fires no
  `on_change`.
- **Forms**: a submit whose required field gets filler that a per-field check drops, such
  as text past `max_chars`, is refused as a whole. A trigger in the form that is not a
  submit button commits no field changes.
- **Script runner**: a page-change message adds no ID to `rendered_ids`, and the previous
  page's widgets are refused once the new page's run completes. `AppTest` does not
  exercise this ordering.
- **Agent API**: new `invalid_value` cases for each item, and the deleted checks keep
  their behavior. `query_params` on a navigation request cannot set a disabled bound
  widget.
- **URL binding**: a disabled bound widget ignores its parameter on initial load and on
  back/forward navigation, and the parameter is corrected or removed.
- **Browser parity**, a permanent CI gate from item 1 on: run the full e2e suite with
  every rejection logged at warning level, and fail on any. A correct browser must never
  be refused, including after a later frontend change, so this guards against false
  positives, which is the main risk (see the product spec's
  [Rollout](product-spec.md#rollout)). The e2e conftest reads the output of every app
  server it started after each test, and a test fails on any line with the refusal
  marker. Reruns are disabled for that failure, so a flaky retry cannot hide it. A test
  that provokes a sync race on purpose opts out with
  `@pytest.mark.allow_refused_widget_values(reason=...)`, and that list should stay short. Forged values cannot be sent from a browser, so
  the new e2e tests cover only what a correct browser can produce: re-sync, values that
  survive a reconnect to a new session (`websocket_reconnects_test.py` only resumes the
  same session), a self-disabling button that returns `True`, and a link that names a
  disabled bound widget. The `run_every` hide race is timing-dependent, so a
  session-state test replays its message order instead.

## Alternatives considered

- **Validate at registration only, against this run's constraints.** Callbacks have
  already run by then, so it cannot protect them. It would also refuse a legitimate click
  whenever the click itself changes the widget's constraints.
- **Validate inside each deserializer.** A deserializer has no way to report a violation,
  it runs lazily wherever a value is first read, and a value it replaced would read as
  unchanged in check 3.
- **Keep validation in the agent API.** That leaves the browser path open, keeps two
  definitions that disagree within a release, and ties validation to agent descriptions.
- **Only declarative constraint fields interpreted centrally**, extending
  `formatted_options` and friends. Date, range, and data editor semantics would leak into
  the state layer, and a widget's rules would no longer be in the widget.
- **Composing helpers at the `register_widget` call site** instead of a serde method. The
  call site would refuse client values while URL seeding needed a second copy of the same
  rule. A method keeps one definition per widget, beside the facts it needs.
- **Folding validation into `deserialize`**, for example by having it raise or return a
  sentinel. `deserialize` also reads defaults and URL values, and it runs lazily wherever
  a value is first read, so a refusal would surface wherever that happens. A separate
  method keeps the decision at the boundary and both on the serde.
- **Reject the whole message, or close the connection.** See the product spec's options.
  Both are hostile to benign races.
- **An opt-out config, public or hidden.** A public one invites disabling a security fix
  to paper over a race we should fix instead. A hidden kill switch such as
  `server.enforceWidgetConstraints` only helps once someone has noticed a bug, so the
  plan mitigates bugs directly: the e2e parity gate, wire fields taken from what the
  frontend sends, and items 1, 3, and 7 in separate releases. See the product spec's
  [Rollout](product-spec.md#rollout).

## Open questions

1. **Deserializers that replace refused values.** Check 3 compares deserialized values,
   so a deserializer that falls back to the default lets a refused value read as
   unchanged whenever the widget holds its default, with no log and no `set_value`. A
   correct browser can send such a value in a sync race. This spec closes that gap: in
   items 2 and 4, each deserializer stops replacing refused values, and URL seeding takes
   over today's fallback and truncation through `validate` (see
   [Where constraints live](#where-constraints-live-in-each-widgets-serde)).
   The alternatives keep the fallback and add hot-path cost: compare wire values, as the
   agent API does, or run the validator on unchanged entries. Is changing each
   deserializer acceptable?
