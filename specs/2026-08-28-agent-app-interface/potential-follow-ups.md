# Potential follow-ups

Items considered while building the prototype that are not part of the
[product spec](product-spec.md)'s v1. Each says what it is, why it is not in v1, and
what would make it worth doing.

## Generate descriptions at the public API boundary

**Today:** each command builds its agent description explicitly where it fills its
proto — 59 modules, 84 call sites.

**The alternative:** `gather_metrics` already wraps every public command and inspects
its signature. Binding each call's arguments there would produce the command name and
parameter names by construction, with defaults applied, plus a shared deny-list for
presentation parameters.

**Why not now:** the explicit form is readable, local to the code it describes, and
flexible, and it costs a line or two per command. The parts that need judgment would
still be per-command overrides: formatted options instead of the author's objects,
`data` summaries, `action` and `support`, derived display values such as a metric's
rendered number, and which name wins when one public command calls another
(`st.write` should report `dataframe`; `st.mermaid_chart` should report itself).
Generation would hide those decisions behind a rule.

**The middle ground, in place:** `agent_spec_coverage_test.py` runs every element mock
with recording on and checks each description against its command's signature in both
directions. Every reported name must be a parameter or a listed derived fact, and every
parameter must be reported or listed as omitted with a reason. So the naming rule — a
release gate in the spec — is mechanically enforced, and a new parameter fails the test
until someone decides whether an agent needs it. Descriptions stay explicit.

**Revisit if** coverage sweeps keep finding commands nobody described, or names drift
from signatures despite the test.

## Widget constraint validation (#16203)

Widget constraints are enforced mostly in the browser today: the runtime resets an
out-of-range number or an unknown option to the default, and nothing server-side checks
the rest. [#16203](https://github.com/streamlit/streamlit/issues/16203) moves them into the
widgets' server-side deserialize path, and the agent API should rely on that. v1 keeps
one check of its own, that a value is one of the widget's `options`; bounds, whole
numbers, `max_chars`, and date-range shape are left for #16203. The last matters most
for agents: the runtime stores a reversed or three-date range as sent, where it resets
an out-of-range number.

**One requirement on the shape.** #16203 proposes coercing a violation to a valid value,
which suits a browser racing a rerun. An agent needs the opposite, because a silently
reset value reads as success. So each validator should report the violation and leave
the policy to its caller: the browser path coerces, the agent path rejects with
`invalid_value`.

**Ranked by how much apps rely on the constraint as a safeguard:**

1. **`disabled=True`**, on every widget including form submit buttons. A forged message
   still applies the value and runs the callback, and apps use `disabled` to gate actions
   by role or state, such as an "Approve" button only a reviewer can press.
2. **`options` allow-lists**: selectbox, radio, multiselect, pills, segmented control,
   select slider, and `accept_new_options=False`. Apps filter options per user — the
   regions someone may see — so an out-of-list value reaches data the UI never offered.
3. **`st.data_editor` edit rules**: `disabled` columns, `num_rows="fixed"`, and column
   options and validation. Edits to locked columns, or added and deleted rows, write into
   data the app treats as read-only.
4. **Numeric and temporal bounds**: `min_value` and `max_value` on number inputs, sliders,
   and date, time, and datetime inputs. Apps use them to cap cost and scope, such as a
   date window that bounds a query.
5. **Size limits**: `max_selections` on multiselect, and `max_chars` on text inputs, text
   areas, and chat input.
6. **Input format rules**: `required` and `validate` on text inputs, and `required` on
   number inputs. Apps use them to keep malformed input out, such as a badly formed email
   address, though their docs already tell authors to re-check anything security-relevant
   in app code.
7. **Shape consistency**: two-value ranges staying two ordered values, and `step`
   alignment. A violation here usually raises in app code rather than leaking data.

Uploaded file types are already checked server-side, in each upload widget's
deserializer, so they need nothing new.

## Keep only summaries in the session buffer

**Today:** a session keeps the page's last messages between interactions, so a fragment
rerun can return the whole page. That is what the app last sent its client, including
every table's Arrow bytes: a 50,000-row table holds 1.7 MB per session, bounded by
`server.maxMessageSize`, the session cap, and the idle TTL.

**The alternative:** once a run settles, replace each buffered table's or chart's payload
with the summary a snapshot reads — 38 KB instead of 1.7 MB for that table. An earlier
version of the prototype did this in about 90 lines.

**Why not now:** it gives every table's and chart's `data` a second code path, from the
payload or from the summary, and it runs inside the runtime's message loop, where an
exception stops message delivery for every session on the server. Memory is already
bounded.

**What would make it worth doing:** profiling of real agent sessions that shows the
buffer dominating memory. Dropping the buffer entirely on pages without fragments would
go further, but needs the fragment registry: "no fragments" cannot be read from the tree,
because a fragment that rendered nothing leaves no node, and `st.rerun("<key>")` can
still rerun it.

## One headless client for `AppTest` and the agent API

`AgentSessionClient` drives a real `AppSession` — the runtime's own reruns, callbacks,
fragments, and stale-node cleanup — which is exactly what `AppTest` does not model. A
future `AppTest` built on the same client would get production fidelity and the same
snapshot, so the spec's "one definition, not three" would hold for the client as well as
the representation. This is a large change to `AppTest` and belongs with its own
roadmap, not with v1.

## Perform more of the browser's form and URL behavior

**Today:** v1 performs a browser-side behavior only where leaving it out makes the app do
something wrong. Setting a bound widget drops its parameter, so a stale address cannot
put the old value back, and `clear_on_submit` is declared but not applied.

**The fuller version**, both prototyped and verified against a browser:

- **Rewrite a bound parameter** when its widget is set, in the runtime's own URL form,
  and drop it at the widget's default, as the browser does. `query_params` then stays
  complete instead of missing an edited parameter until the app writes it back. About 40
  lines, using the runtime's private URL coercion helper.
- **Emulate `clear_on_submit` the way AppTest does.** A submit marks its form cleared; the
  fields report their defaults, and the form's next submit sends an unset value (the
  widget's default) for every field the request omits. About 50 lines across the request
  validator and the snapshot, plus per-session state that outlives a request.

**Why not now:** neither changes whether the app behaves correctly, only how closely the
snapshot matches what a browser would show. Both reimplement frontend logic that could
drift from React, which the fidelity harness below would have to watch.

**What would make it worth doing:** clients that cite `query_params` or rely on cleared
forms. Trials so far have recovered from both by reading widget values and the app's own
output.

## Browser-versus-agent fidelity harness

The spec's success criteria require every advertised interaction to match an equivalent
browser session on callback order, resulting widget values, and emitted output. Nothing
checks that yet. A harness would drive one app with the same inputs through Playwright
and through `interact`, then compare the two.

It matters because every divergence found so far was found by accident: the
`clear_on_submit` reset, the `bind="query-params"` URL write-back, the widget states a
browser lists with a page change (without them, shared sidebar widgets lost their bound
parameters), `run_every`, and `st.context` reporting empty strings instead of `None`. All
of them are behaviors the frontend owns, and the next one will be too.

## Settle on the script runner's shutdown, not a grace period

One interaction can cause several runs. The response has to wait until no further run
is coming, and today that is a guess: after a run finishes, wait 50 ms and return if no
new run started.

The runtime already makes this decision exactly. When a script completes, the
`ScriptRunner` asks its request queue for more work: if a rerun is queued it starts it,
and otherwise it shuts down. So "settled" is precisely "the runner shut down", an
in-process event the agent layer can wait on without any protocol change.

The guess fails in two directions. Under load, as in CI, the gap between one run
finishing and a queued run starting can exceed 50 ms, so the response describes an
intermediate state while the app keeps running. In the common case it adds 50 ms to
every interaction for no reason.

## Build the snapshot's values on the script thread

The snapshot is assembled on the server's event loop after the run settles. Two parts of
it are more than reading: a widget's `value` goes through `st.session_state`, which
deserializes and caches, and through the widget's serializer, which runs the app's own
`format_func`; and compacting a settled run reads every table's Arrow buffer to build its
preview. A slow `format_func` or a large table therefore stalls every session the
server holds, and a run that starts meanwhile — a rerun on file save, or the run a
timed-out interaction left going — can change the state being read.

Capturing those values on the script thread, at the end of the run that produced them,
would leave the event loop only serializing finished data. The natural place is the same
hook that already decides when a run's stale deltas are dropped.
