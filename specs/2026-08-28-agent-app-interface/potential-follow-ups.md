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

**A cheap middle ground:** a unit test that checks every description's `props` keys
against the parameters of its command's signature. That keeps descriptions explicit
while making the naming rule — a release gate in the spec — mechanically enforced.

**Revisit if** coverage sweeps keep finding commands nobody described, or names drift
from signatures despite the test.

## One headless client for `AppTest` and the agent API

`AgentSessionClient` drives a real `AppSession` — the runtime's own reruns, callbacks,
fragments, and stale-node cleanup — which is exactly what `AppTest` does not model. A
future `AppTest` built on the same client would get production fidelity and the same
snapshot, so the spec's "one definition, not three" would hold for the client as well as
the representation. This is a large change to `AppTest` and belongs with its own
roadmap, not with v1.

## Browser-versus-agent fidelity harness

The spec's success criteria require every advertised interaction to match an equivalent
browser session on callback order, resulting widget values, and emitted output. Nothing
checks that yet. A harness would drive one app with the same inputs through Playwright
and through `interact`, then compare the two.

It matters because every divergence found so far was found by accident: the
`clear_on_submit` reset, the `bind="query-params"` URL write-back, `run_every`, and
`st.context` reporting empty strings instead of `None`. All four are behaviors the
frontend owns, and the next one will be too.

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
