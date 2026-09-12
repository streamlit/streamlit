---
author: lukasmasuch
created: 2026-09-10
---

# Prototype learnings: agent-accessible Streamlit apps

Notes from building a working prototype of the v1 `POST /_stcore/agent/v1/interact`
operation described in [product-spec.md](./product-spec.md). Everything here is either an
observation about the current codebase or a consequence the spec does not yet account
for. It is not a proposal to change the product shape.

The prototype is not production code: no tests, no CI coverage gate, no budgets, no
telemetry, no per-session gating. It exists to find out which parts of the spec are cheap,
which are expensive, and which are stated in a way the implementation cannot satisfy.

## What works

Every command that emits an element or container describes itself: 93 emit sites, and a
kitchen-sink app exercising the whole display and widget surface yields 83 distinct types,
all named after public commands, with an empty coverage gap list.

Three apps were driven end to end through the HTTP API only, with no browser:

- **A multipage revenue dashboard** with cascading drill-down (region → country → city),
  an eight-turn session that answered a real question ("which segment in Germany earns
  the most net revenue per customer, and how does France compare"). Conditional widgets
  behave as the spec predicts: `country` is not addressable until `region` is set, so each
  level costs one turn, and `actions` grows accordingly.
- **A support workbench** covering the interaction shapes the dashboard does not:
  payload-bearing triggers (`st.chat_input`, `st.menu_button`), a form with two submit
  buttons where the agent picks the right one, tabs, and `st.status`.
- **A kitchen sink** used purely for coverage.

Also verified: batches spanning main and sidebar in one request; the one-round-trip
parameterization channel (`{"page": "drill-down", "query_params": {"quarter": ["2026-Q3"]}}`
on a creating call lands on the right page with the bound widget seeded); the error path
(an uncaught exception returns `200` with `status: "error"` and a tree truncated at the
raise, while an exception the app caught and displayed with `st.exception` leaves the
run `ready`); and a served OpenAPI document at `GET /_stcore/agent/v1/openapi.json` that
describes the protocol without describing the element tree (see
[§6](#6-protocol-discovery-what-a-served-openapi-document-is-and-is-not-for)).

Rejections fire before anything executes: an out-of-options value, a number, date, or
range outside the bounds the element advertised, a value of the wrong shape for the
element that reported it, a batch mixing a form field with an outside control, form
fields sent without their submit, `widget_state` or `trigger` on a creating call, a value
sent to a trigger, a trigger fired at a value widget, a payload given to a payload-free
trigger, a payload of the wrong shape, and a key that is not on the current page.

Whatever a snapshot reports as `value` can be sent straight back, including for widgets
with a `format_func`. A container that is itself a widget -- a keyed `st.tabs`,
`st.expander`, or `st.popover` with `on_change="rerun"` -- can be driven, so the views
an app renders lazily behind a closed one are reachable. Every element with a `data`
block resolves to exactly one of: complete inline, a `url` to fetch, or an explicit
`unavailable`.

Fragments rerun on their own, as they do in the browser: an interaction whose keys belong
to one `st.fragment` reruns only that region, and because an `st.dialog` body is a
fragment, a dialog can be driven across several turns and stays open while it is.

## 1. Where the semantic format should be declared

This was the main open design question, and the prototype went through three answers
before landing. Recording all three, because the reasoning matters more than the
conclusion.

**What landed: each command builds its description the same way it builds its proto, in
the same function, from the same arguments.**

```python
selectbox_proto = SelectboxProto()
selectbox_proto.label = label
selectbox_proto.options[:] = formatted_options
...

self.dg._enqueue(
    "selectbox",
    selectbox_proto,
    agent_props=agent_spec.element(
        "selectbox",
        key=element_id,
        action="value",
        label=label,
        options=formatted_options,
        index=index,
        help=help,
        placeholder=placeholder if placeholder != " " else "",
        disabled=disabled,
        label_visibility=label_visibility,
        accept_new_options=accept_new_options,
        filter_mode=filter_mode,
        on_change="ignore" if on_change == "ignore" else "rerun",
    ),
)
```

`agent_spec.element` returns `None` when `server.enableAgentApi` is off, and the caller
passes that straight through, so an ordinary server does one cached config read per
element and nothing else.

### Why not a central registry keyed on proto fields

The first attempt was a declarative registry (`prop("label")`, `derived("delta_color",
...)`) mapping each proto to a spec. It failed on its own terms. Streamlit's protos are a
*rendering* contract and diverge from the public API in every direction a mapper would
have to undo:

| Public API | Proto | Why a proto-driven mapper struggles |
| --- | --- | --- |
| `st.metric(value=...)` | `Metric.body` | Renamed. |
| `st.metric(delta_color=...)` | `Metric.direction` + `Metric.color` | One parameter fans out into two fields, neither named after it, and the authored value has to be reconstructed from the pair. |
| `st.selectbox(index=...)` | `Selectbox.default` | Renamed, and the meaning shifts (an index, not a value). |
| `st.selectbox(placeholder="")` | `Selectbox.placeholder == " "` | Wire hack: an explicit empty placeholder is sent as a single space to distinguish it from `None`. Serialized naively the snapshot reports `" "`. |
| `st.selectbox(on_change="ignore")` | `Selectbox.ignore_rerun` | Renamed and re-polarized. |
| `st.slider(min_value=..., step=...)` | `Slider.min`, `Slider.step` (doubles) | The proto stores every slider's bounds as doubles whatever the authored type; `data_type` has to be consulted to read them back as ints, dates, or times. |
| `st.number_input(min_value=None)` | `NumberInput.min == 0` + `has_min == False` | "No minimum" is only distinguishable via a companion flag. |
| `st.dataframe(column_config=...)` | `Dataframe.columns` (a JSON string) | Renamed, and the value is a nested document inside a string field. |
| `st.line_chart(x=..., y=...)` | nothing | Compiled into the generated Vega-Lite spec and discarded. |

Every one of these needs per-command knowledge, so the mapping is per command wherever it
lives. Given that, it belongs with the command.

### Why not proto-time serialization with a declaration DSL

The second attempt kept per-command declarations but made them pure functions of the
proto, evaluated at snapshot time, on the theory that element creation is a documented hot
path (`lib/streamlit/AGENTS.md`) and should stay free of agent work.

Two things sank it:

- It cannot express what the proto does not carry, which is the whole point for built-in
  charts and `st.pyplot`.
- The shared-proto cases had to allocate a fresh spec object per element per snapshot to
  pick a variant, so it was not actually free either — it moved the cost rather than
  removing it.

The hot-path objection turns out not to bind. `save_for_app_testing` is the existing
precedent: it is called from ~12 widgets right before `_enqueue`, builds a dict eagerly,
and gates on a config read (`global.appTest`). The agent description does exactly the same
thing with the same cost profile. If per-element cost ever matters, the fix is an explicit
`if agent_spec.is_recording():` guard at the call site, not a different architecture.

### The one thing the split does have to respect

Two fields must stay at snapshot time, and the reasons are worth stating because they map
onto distinctions the spec already draws:

- **`value`** — the widget's current value is only settled after the next run's callbacks
  and widget reconciliation, so a command emitting an element cannot know it. This is the
  spec's own `props` (how it was built) versus `value` (what it holds now).
- **`data`** — schema, row and column counts, and bounded previews are derived facts, and
  how much to include is a response-budget decision only the serializer knows. This is
  the spec's `props` versus `data` split, and it falls out of the architecture rather than
  being a convention to enforce.

So the final shape is: **props at fill time, from the command's arguments; value and data
at response time, from state and from the payload.**

### Consequence: coverage becomes a runtime property, not a static one

A static registry could be checked at import: "every `Element` variant has a
declaration." A fill-time description cannot, because it lives inside a function body.

The prototype compensates by reporting the gap in the response: an element with no
description is serialized under its proto field name with its scalar fields, and the
snapshot carries an `undescribed_types` list. That keeps a gap visible to the caller
instead of letting it masquerade as a command name, and it gives CI something to assert
against — a test that exercises every command and fails if `undescribed_types` is
non-empty. Worth deciding deliberately, since the spec's success criteria assume a
static check.

## 2. Transport: how the description reaches the response

The description is built on the script thread during a run and read on the event loop
after it. The prototype adds `ForwardMsgMetadata.agent_props` (a JSON string) and
populates it in `_enqueue` and `_enqueue_add_block`.

Metadata rather than the element itself, because metadata is stripped before the
ForwardMsg cache hash is computed, so descriptions do not perturb caching.

Three consequences:

- **Cache replay has to carry it too.** `replay_cached_messages` re-enqueues saved protos
  for elements emitted inside `@st.cache_data`. Without threading the description through
  `ElementMsgData`, every element inside a cached function would be reported as an
  undescribed proto. The prototype threads it. Note the residue: a cache entry populated
  before the agent API was enabled replays without a description, so the first agent run
  against a warm cache can show gaps that a later run does not. A proto-only serializer
  would not have this failure mode; it is a real cost of fill-time construction.
- **The gate has to be per session, and can be.** A first attempt gated on
  `server.enableAgentApi` alone, which meant a browser session sharing an agent-enabled
  server built a description for every element and shipped it over the WebSocket.
  Stripping the field in the WebSocket client fixes the transmission but not the
  construction, and it puts the guarantee in one client rather than at the source —
  another host's `SessionClient` would still receive it, as would anything registering
  `ForwardMsgQueue.on_before_enqueue_msg`, which fires at enqueue time.

  The fix is cheap because the script thread already knows its session id:
  `AgentSessionRegistry` records the sessions it creates, and `is_recording()` checks the
  running session against that set. Nothing is built for a browser session, so nothing
  has to be stripped, and the proto field's "never reaches a browser" property becomes
  structural rather than conventional. Two ordered checks — a cached config read, then a
  set membership test — so a server with the API off pays what it did before.

  One case the per-session gate does *not* cover by itself: cache replay. A
  `@st.cache_data` entry is filled by whichever session ran the function first, so an
  agent session's recorded description could replay into a browser session (and a
  browser-filled entry has no description for an agent session to read). Replay has to
  re-check `is_recording()` rather than trust what it stored.
- **Caching is unaffected, structurally.** Because the hash is computed with metadata
  cleared, `agent_props` never influenced it, so neither adding nor clearing the field
  can produce a cache miss or mismatch. `create_reference_msg` copies the new message's
  metadata onto the reference, so a description would survive a cached-message reference
  correctly — inert today, since the agent client never advertises cached hashes, but it
  means the caching optimization stays available to the agent path later.
- **A JSON string in a proto field is not a schema.** Fine for a prototype; a real
  implementation should decide whether this stays opaque (it is internal transport, never
  a public contract) or becomes a typed message.

## 3. There is no server-side element tree

Worth stating plainly because it sets the size of the work. `delta_path` has exactly one
consumer that does anything structural with it: `lib/streamlit/testing/v1/element_tree.py`.
Everywhere else it is written, coalesced by path (`ForwardMsgQueue`), or forwarded. The
runtime never materializes a tree; the browser owns that.

- **The snapshot needs a merger the runtime does not have.** The prototype adds one
  (~60 lines). Small, but it is the piece that has to stay bit-compatible with frontend
  behavior forever, which is the strongest argument for the spec's "one registry, not
  three" criterion: this merger and `AppTest`'s should be the same code.
- **`ForwardMsgQueue` is not a usable accumulation point.** The runtime's flush loop
  drains it on a timer, so its contents at any moment are "what has not been sent yet",
  not "this run's output". `AppTest` reads `_queue` directly only because
  `LocalScriptRunner` never flushes. A real session has to accumulate client-side, which
  is what the prototype's `SessionClient` does — mirroring the frontend's rules: a
  `new_session` without `fragment_ids_this_run` starts a fresh buffer.
- **`AppTest`'s merger is missing the `bottom` root container.** `parse_tree_from_messages`
  seeds only `main`, `sidebar`, and `event`, so `st.bottom` content and a bottom-position
  `st.chat_input` land under an untyped placeholder block. The spec's four-container model
  is right and `AppTest` is the one that is incomplete — relevant if the shared registry
  lands on the `AppTest` side first.
- **Cached-message references would silently truncate.** `ScriptRunContext.enqueue`
  replaces a message with a payload-free `ref_hash` reference when its hash is in
  `cached_message_hashes`. An agent client must either resolve those or never advertise
  cached hashes. The prototype does the latter. Worth a sentence in the spec, because
  missing it produces a snapshot with holes rather than an error.

## 4. Run-chain completion

The spec is right that `status` needs two signals, and the prototype confirms the shape of
the settling problem.

`ForwardMsg.script_finished` distinguishes `FINISHED_SUCCESSFULLY` from
`FINISHED_EARLY_FOR_RERUN`, and `ForwardMsgQueue.clear()` *retroactively rewrites* a
queued finish message to `FINISHED_EARLY_FOR_RERUN` when a run is superseded. So an
implementation that returns on the first finish message it sees will hand back a
half-built tree. The prototype waits for a terminal status and then waits a short grace
period to see whether a callback or `st.rerun()` starts another run.

That grace period is the weak point: it is a heuristic where the browser needs none,
because the browser renders continuously and never has to decide that a chain is over. It
works, but "how do you know the run chain settled" deserves to be a named design question
in the spec rather than an implementation detail.

## 5. Findings that change specific spec claims

**`options` must be the wire form, not the authored objects.** Fill-time construction
tempts you to report the author's Python options (enum members, dates, dataclasses),
which look richer. That would be wrong: the strings a client has to send back are the
`format_func`-formatted ones, so those are the actionable form and the only ones the
server will accept. Full fidelity is not automatically better — the snapshot's job is to
report what the *next request* can say. The prototype reports formatted options
throughout.

**Widget metadata outlives the widget, so it cannot answer "does this control exist".**
This is the most important correctness finding, because it breaks a specific spec
guarantee: *"a stale, guessed, or forged key cannot set a disabled widget, an
out-of-range value, or a control that no longer exists."*

`WidgetMetadata` survives a page switch and a collapsed conditional branch — only the
*value* is cleaned up. So a validator built on the widget registry alone will accept a
key that is not on the page, as long as the value is legal for the widget that used to be
there. Measured before the fix: on the dashboard's Overview page, setting `region` (a
drill-down key) returned `200`, ran the script, changed nothing, and gave the agent no
signal that its instruction had been ignored. That is the worst possible failure mode for
an agent — a silent no-op that looks like success.

The fix is to validate against the **last snapshot**, not live metadata. The prototype
carries what each addressable node advertised on the session between requests and returns
a distinct `not_on_page` error, which also covers the "only appears after another control
changes" case that conditional widgets create. Worth stating in the spec as an explicit
requirement, because the natural implementation gets it wrong.

**The widget registry covers less of validation than it looks.** `WidgetMetadata` records
`value_type`, `disabled`, `formatted_options`, `max_array_length`, and the serializer.
That is enough to reject a disabled widget, an out-of-options selection, or an over-long
multiselect — the same data the runtime-wide validation in
[#16203](https://github.com/streamlit/streamlit/issues/16203) would need — but it stops
short in three places that each produced a silent no-op: it has no numeric bounds, no
options for a trigger that has them (`st.menu_button`), and no owning form, since form
membership exists only on the emitted element (`<widget>.form_id`).

All three are in the snapshot, so the prototype validates against that instead. The
session carries an `ElementState` per addressable element — actionable, disabled,
`support`, `form_id`, `options`, `min_value`, `max_value` — which is also what lets the
"cannot act" errors say *why* rather than defaulting to `not_on_page`. §7b has the
reasoning; the short version is that the client writes against the document it was
given, so the document is what a write has to be checked against.

**`page` cannot be resolved by `url_path` on a creating call.** The spec promises
navigation as "the one-round-trip parameterization channel" and says `page` is "never a
Python path or internal script hash". Both are right, but the mapping from `url_path` to
the internal page hash is a *post-run* fact: an `st.navigation` app has no page list until
it has run once, so a creating call naming a page has nothing to look up. The prototype
initially returned `unknown_page` for a page that plainly exists.

The browser has the same problem on a cold load and solves it with
`ClientState.page_name`, which the runtime resolves itself. Doing the same fixes it, and
the round trip then works exactly as specified. Worth a sentence in the spec, since the
obvious implementation (resolve, then error) makes the headline example fail.

**A framework-generated key is a third identity shape.** The spec describes authored keys
and opaque `$$ID-<hash>-None` element IDs. Form submit buttons sit between the two:
Streamlit generates a *user key* of the form `FormSubmitter:<form_id>-<label>`, so
`user_key_from_element_id` returns it and it surfaces as a readable key an agent can send
back — which works well in practice (`{"key": "FormSubmitter:triage-form-Send reply"}`
picked the right one of two submit buttons). But it is neither authored nor opaque, so the
spec's two-category compatibility contract does not say whether a client may rely on it.
Name it.

**pandas index columns leak into the data description.** A dataframe with a non-trivial
index (anything that has been sorted or grouped) serializes that index into the Arrow
buffer as `__index_level_0__`, and `hide_index=True` is render-only, so it does not
suppress it. The first drill-down snapshots reported a `__index_level_0__` column with
integer values in every preview row: a column the app never displayed and no author
named. The prototype filters these out. Any implementation reading Arrow buffers directly
will hit this.

**`on_change="ignore"` is not universal.** The spec's interaction table has a row for it
as though every widget supports it. Only some do: `Checkbox`, `MultiSelect`, and
`TextArea` have no `ignore_rerun` field, while `Selectbox`, `TextInput`, `NumberInput`,
`Slider`, and others do. The prototype reports the parameter only where it exists. Worth
saying which widgets the row applies to.

**Built-in chart data lives in a named dataset.** `st.line_chart` and friends put their
Arrow bytes in `VegaLiteChart.datasets[0]`, not `data`, so a serializer that only reads
`data` reports a chart with a spec and no data. Small, but exactly the kind of thing the
"one registry" criterion is meant to stop each consumer rediscovering.

## 5b. Spec predictions the prototype confirmed

Recording these because they were assumptions worth checking, and they held:

- **Eagerly rendered collapsed content is present.** An unselected `st.tabs` tab emits
  its children, so the workbench's Detail tab was fully readable — and its `selectbox`
  addressable — while Triage was the selected tab. Same for a collapsed `st.expander`.
  The spec's "hiding it would be a browser fiction" is the right call and needs no
  special handling.
- **Trigger-only content does disappear on the next plain rerun.** After firing the menu
  button and the chat input, both the resulting `st.status` and `st.chat_message` were
  gone from the next snapshot, because a full rerun does not re-fire the triggers. The
  spec calls this out as the declared deviation from a browser session, and it behaves
  exactly as described. Usefully, anything the app wrote to `st.session_state` during
  the trigger run *does* survive, so an app that logs its actions stays legible across
  turns — worth mentioning to authors, since it is the cheap workaround.
- **Conditional widgets force multi-turn interaction, and that reads naturally.** The
  spec's "a widget that only appears after its parent changes needs a second request" is
  not a limitation an agent has to reason about: the `actions` list simply grows, so the
  next legal move is always visible without guessing.
- **`bind="query-params"` plus a creating call is genuinely one round trip**, once the
  `page_name` fix above is in place.

## 5c. Serving Arrow data over HTTP, and where the spec contradicts itself

`data.url` is implemented: a dataframe, table, data editor, or Vega chart whose Arrow
buffer exceeds a size threshold registers it in the existing media-file storage and
reports a `/media/...` URL alongside the schema, counts, and preview. Measured on a
50,000-row dataframe: a 10-row preview inline, then 1.8 MB fetched over HTTP as
`application/vnd.apache.arrow.stream` and parsed back to exactly 50,000 rows, so an agent
can compute an aggregate the preview cannot support.

**Registration has to happen during the run, not at response time.** The spec argues the
externalization decision belongs at response time because only that knows the response
budget. But `MediaFileManager.add` resolves the owning session through
`get_script_run_ctx()`, which returns the literal `"dontcare"` outside a run, and the
file lifecycle is anchored to run boundaries: `clear_session_refs` at the start of each
full run, `remove_orphaned_files` at the end. Registering from the snapshot serializer
would file the data under a bogus session and leak it. Registering at the emit site
instead means the existing lifecycle applies unchanged.

**Correction to an earlier claim here: that lifecycle does *not* make the "fetch-now
handle" contract mechanical.** An initial measurement (one session, data changed between
runs) showed a stale URL returning 404 and I wrote that the contract was enforced by
mechanism. A client-side trial saw a stale URL still returning 200, and isolating it
explains both results. Media files are content-addressed and reference counted across
*all* sessions, so:

| Situation | Stale URL |
| --- | --- |
| One session, navigates away | 404 |
| Two sessions holding identical bytes, one navigates away | **200** |
| Both navigate away | 404 |

Deduplication means another session's reference keeps the bytes alive for a URL handed to
a different session, and an idle agent session pins whatever it last rendered until its
TTL expires. The spec already notes the dedup property, but frames it as a
*confidentiality* question ("an identical URL means identical bytes, so this is not a
confidentiality hole"). The freshness consequence is the one that bites: a stale URL can
keep working and silently serve an outdated slice. So the contract has to stay a written
rule — always take the URL from the latest snapshot — and cannot be presented as
something the server enforces.

**Completeness, not bytes, is the right trigger.** A first pass used a byte threshold
(32 KB) to decide when to offload, which left a hole a client trial hit immediately: a
206-row table is only about 8 KB, so it was truncated *and* had no URL, while its caption
told the client to fetch one. Whether a client needs a URL is a question about row count,
not payload size. So there is no size floor: an agent session offloads whenever it has
Arrow data, the preview cap is 100 rows so most filtered tables come back complete
anyway, and the invariant a client can rely on is `data.complete` being true, **or** a
`data.url` being present, **or** an explicit `data.unavailable` — never none of the three.

A byte threshold does have a place, just not this one. Sending Arrow over HTTP so browser
requests parallelize instead of queueing behind one WebSocket is a standing request
([#16378](https://github.com/streamlit/streamlit/issues/16378)), and *there* the whole
point is payload size. An earlier revision anticipated it with a config option and a
32 KB floor for the browser path. Both were removed: the frontend cannot fetch Arrow yet,
so the option gated nothing, and a public config option that does nothing is worse than
no option — it is surface someone will find and file a bug against. What remains is the
shape that matters: `elements/lib/data_offload.py` takes bytes and coordinates, knows
nothing about agents beyond one gate call, and is the function the frontend work should
call. The interesting half of #16378 is dropping the inline copy from the message, which
only a fetching frontend makes safe; until then offloading *adds* a copy rather than
moving one.

**And the spec contradicts itself on whether any of this is in v1.** Three places say yes:
the v1 data table (line 553) has `data` carrying "a `url` serving the full Arrow bytes";
the success criteria (line 843) require "a fetchable `data.url` that survives until the
next interaction". One says no: the security section (line 649) says content-hash media
URLs are "not acceptable for newly externalized table and chart data, which is why that
externalization is a follow-up rather than part of v1". That bullet sits under "Two things
must be built before the interface can be reached **remotely**", so the intent is probably
that authorized links gate *remote* enablement rather than v1 — and since v1 is
loopback-only, the existing content-hash route is defensible for it. Line 649 looks like
the one to fix, but it should be settled explicitly rather than left to the reader.

## 6. Protocol discovery: what a served OpenAPI document is and is not for

The spec's follow-ups cover a CLI, an MCP adapter, and a static app descriptor, but
nothing that tells a caller *how to call the endpoint*. The prototype adds
`GET /_stcore/agent/v1/openapi.json`, and building it clarified that "discoverability" is
three separate questions with three different answers.

| Question | Answer | Where it lives |
| --- | --- | --- |
| How do I call this? | Five request fields, ten response fields, fifteen error codes. Static and finite. | The OpenAPI document |
| What does `{"type": "selectbox", "props": {"options": [...]}}` mean? | The public Streamlit API. | The existing API reference, by rule not by copy |
| What can I do in *this* app right now? | Not answerable statically. | `actions` in every response |

**The middle row is the one to get right, and the answer is to write a rule, not a
schema.** The spec's whole premise is that the vocabulary needs no schema because models
already know the `st.*` namespace. Enumerating 90 commands in OpenAPI would spend real
effort re-teaching that, duplicate knowledge that now lives with each command, drift
within a release, and quietly concede the naming bet did not pay off. So the document
states the rule once — an element's `type` is a public command name, each `props` key is
that command's parameter name, look the command up in the API reference — and types the
tree node as an open recursive object. That is the single most important constraint on
anyone implementing this: **do not `oneOf` the element tree.**

The result is about 15 KB and seven schemas (`InteractRequest`, `Trigger`, `Snapshot`,
`Node`, `Action`, `Page`, `Error`), which is small enough that the descriptions can carry
the design rationale rather than restating field names.

Three implementation notes:

- **Generate it, do not check it in.** The prototype builds the document from the same
  constants the route uses, so the error-code enum and `schema_version` cannot disagree
  with the implementation, and the paths are self-locating (verified under
  `server.baseUrlPath`). A hand-written YAML file would be a third definition of things
  the code already knows.
- **Serve it, and link to it.** A file in the repo does not help an agent that found the
  endpoint. Interact responses carry `Link: <...openapi.json>; rel="service-desc"`, so
  the protocol is reachable from any response rather than needing to be handed over out
  of band.
- **Errors are part of the discovery surface.** In practice the messages taught the
  protocol better than the document did, because they arrive exactly when a caller got
  something wrong: `not_on_page` says to read `actions`, and the creating-call rejection
  explains *why* `widget_state` cannot be sent yet. Worth treating deliberately, not as
  incidental strings — the catalog in the prototype pairs every code with a written
  meaning, and the document is generated from it.

**Where MCP fits.** It solves the same problem as a served OpenAPI document — tool
discovery without a human wiring it — for hosts that speak MCP. It does not describe the
tree or the action space any better, because the tool result carries the identical
snapshot and `tools/list` cannot vary per connection. So it is packaging of the same
contract, not an alternative to it, and the useful consequence is that the MCP tool
descriptions should be *derived* from the OpenAPI operation descriptions rather than
written independently. Two prose descriptions of one endpoint will disagree.

**The bundled skill is for authors, not consumers.** "Set `key=`, explain the app inside
the app, here is why that makes it a good tool" is authoring guidance and belongs in the
skill. A consuming agent should not need a skill to learn the protocol; that is what the
served document is for.

**One wrinkle the spec should decide.** A success criterion says "no route responds with
`enableAgentApi` unset". That holds literally — neither route is registered — but the
observable behavior is not a 404: Streamlit's SPA catch-all `Mount` answers
`GET /_stcore/agent/v1/openapi.json` with `200 text/html`. So a probing client cannot
tell "API disabled" from "API available" by status code and has to check the content type.
Either accept that and say so, or register the routes always and return a JSON
`not_available` (which reveals nothing the HTML page does not already imply).

## 7. What the prototype does not do

Deliberate omissions, so nobody reads more into the working demo than is there:

- No response or rate budgets. Previews are capped at 100 rows and externalized Arrow at
  a 200 MB ceiling, but the response document itself is unbounded — a page with a
  3,000-option selectbox ships those options in every snapshot.
- Media URLs the app already registered (`st.image`, `st.audio`, eager downloads) are
  passed through as-is. Externalized Arrow gets the lifecycle described in §5c; nothing
  is pinned beyond it.
- No `st.data_editor` edits, uploads, dataframe or chart selections, or deferred
  downloads. These are declared through `support` on the element, which the spec's
  approach handles cleanly.
- A `run_every` fragment never refreshes on its own, because the refresh clock is the
  browser's. The interval is reported so a client can poll deliberately (§7c).
- The `undescribed_types` fallback is implemented but no longer triggers for any
  first-party command; it exists for future commands whose author forgets a description.

## 7b. What a client-side trial changed

[prototype-feedback.md](./prototype-feedback.md) records five agents driving two apps
through the API alone, without app source. Most of what it found was not visible from
the inside, and the pattern is worth naming: **every defect was a case where the snapshot
told a client something that was not true.** A caption promising a `data.url` that was
absent; `page.title` answering "which app" when it reads as "which page"; a 200 on a
mistyped page; `not_on_page` blaming the page for a disabled slider. None were crashes,
and none were visible to someone who could read the app source and knew what to expect.

Fixed as a result: the data hole above; error codes classified from what the snapshot
recorded, so `disabled_widget` and `unsupported_element` actually fire; `app_title`
separated from `page.title`; an unknown page on a creating call rejected after the run
rather than silently landing on the default; empty `trigger: {}` rejected instead of
being falsy and silently becoming a plain rerun; container `support` propagated to
descendants, so a non-interactive dialog stops advertising its buttons in `actions`; and
the `Link: rel="service-desc"` header added to errors, which is where a confused caller
most needs it.

Two of those deserve a spec sentence of their own. **A container's `support` has to bind
its contents** — otherwise the tree declares a dialog non-interactive while `actions`
offers its confirm button, and the contract contradicts itself. And **a block re-sent at
the same delta path must carry its description again**: `st.dialog` and `st.status`
update themselves by re-emitting the block proto, the queue coalesces by delta path, and
the second message silently replaced a described node with an undescribed one. Any
fill-time description scheme has this failure mode wherever an element mutates itself.

A second client trial (same apps, after the patches above) confirmed those fixes from
the outside: filtered catalogs and charts expose `data.url` and Arrow `row_count`
matches; `disabled_widget` / `unsupported_element` / never-rendered `unknown_key` fire;
`app_title` ≠ `page.title`; unknown page on create is 404; empty `trigger: {}` is 400;
dialogs are described and their buttons are not in `actions`; errors carry `Link`.
Unique media hashes 404 once nothing renders them; concurrent sessions that still
render the same content-hash keep the file at 200. A third trial on a fresh
process confirmed the same; it also saw that a `page` navigation can write bound
widget values into `query_params` even though a `widget_state` patch does not,
after which the two can diverge.

### The snapshot is also the validator

The trial's remaining findings were one bug wearing four hats: **a write was checked
against the runtime's widget registry, but the client wrote against the snapshot.** The
registry knows a widget's value type and its options; it does not know a number's bounds,
a trigger's options, or which form an element sits in. So everything the registry could
not see fell through to the runtime, which discards what it cannot use — quietly, and
with a 200. A slider set past its maximum came back reset to its default; `st.menu_button`
fired with an option it never offered was a no-op, and with an object payload a 500,
because a `TypeError` in the encoder had no handler; form fields applied without their
submit, which is a literal reading of "unmentioned widgets keep their values" but not
what an `st.form` means.

The fix is one idea applied four times: `ElementState` now carries the `options`,
`min_value`, and `max_value` the snapshot advertised, and writes are validated against
*that*. **The document the client was given is the contract, so it has to be the thing
the next request is judged by** — a spec that describes validation in terms of runtime
state is describing something the client cannot see. Concretely: out-of-range numbers and
reversed ranges are `invalid_value`; a trigger with options validates like a selection
widget; every encoder path either produces a `WidgetState` or raises `AgentRequestError`,
so probing what a trigger accepts can no longer 500; and form fields without a submit are
`missing_form_submit` rather than a 200 over an uncommitted form.

Also fixed: a creating call now rejects `trigger` up front, since element keys cannot
exist before the first run, and a creating call that fails *after* the session exists
(only `unknown_page`, which cannot be judged until the app has run) returns `session_id`
in the error body so the caller can continue or close it instead of leaking it until TTL.
The OpenAPI document now says outright that `actions` is the addressable set and a `key`
elsewhere in the tree is an identity, not an invitation — a trial agent reasonably read a
key on a `support`-marked element as permission to use it.

### Round 4: `value` has to be input, not just output

A fourth trial added four apps covering dates, pills, maps, fragments, `st.status`, and
lazy `st.tabs`. The acting-edge fixes held, and the new findings sharpened the same rule
one more time: **a snapshot field that a client can send back is an input field, and it
has to be in the space the input is validated against.**

`st.pills(options=[1, 12], format_func=month_name)` reported `value: 12` and accepted
only `"December"`. Echoing the value back was `invalid_value`. The cause is that
`st.session_state` holds the author's Python option while the wire form is the formatted
string, and the snapshot was reading one and validating the other. Every selection widget
with a `format_func` had this, not just pills; the trial only caught it where an app used
one. The fix reads the value through the widget's own serializer, which is the mapping
the runtime applies in reverse, so read and write are the same space by construction.
Single-select widgets that serialize to a one-item list are unwrapped, so a single choice
still reads as a single choice.

The other half was shape. Bounds validation landed in round 3, but a value of the wrong
*shape* still fell through to the runtime and reset the widget silently: `null` for a
number, a bare int for a range, `[]`, three items, one date for a date range. Arity is
stated in exactly one place -- the value the snapshot reported -- so that is what the
check compares against. Dates and times come along for free, because they are reported as
ISO strings and ISO strings sort chronologically: `st.date_input` now gets the same
reversed-range and out-of-bounds errors `st.slider` does.

Three more were the same "the snapshot said something untrue" family:

- **`st.status` reported `running` after it completed.** `update()` re-sends the block
  proto at the same delta path and was replaying the description built at creation. The
  round-2 fix for the dialog established that a re-sent block must carry its description
  again; this is the follow-on rule, that it must carry a *current* one. Both containers
  now rebuild it, and the dialog reports `is_open` while it is at it.
- **`st.map` had no data path.** Its points exist only inside the generated Deck.gl spec,
  so a client had to mine coordinates out of layer JSON. It now offloads the plotted
  table as Arrow like the charts do. Reading geometry out of a rendering spec is not a
  data contract.
- **A metric's number was only a display string.** `st.metric` now reports `value` and
  `delta` as authored, with `display_value` and `display_delta` for a caller quoting the
  app. A briefing wants the string; an export wants the number.

**Lazy tabs were the one that hid data, and the fix was in the wrong layer's shape.**
With `on_change="rerun"`, `st.tabs` registers a real widget whose value is the open tab's
label, and an app that guards work with `if tab.open:` never emits the closed tabs'
children. The snapshot showed the keyed tab container but left it out of `actions`, and a
write to it returned `not_on_page` -- so the views behind the other tabs were
unreachable, permanently. The cause was structural: the snapshot recorded addressability
for elements only, and a tab container is a *block*. Blocks can be widgets. That is now
shared between the two paths, tab children report `open`, and switching tabs reaches what
was hidden.

Also fixed: an element that is both unsupported and disabled now reports
`unsupported_element`. Disabled was checked first, so a read-only `st.data_editor` that
happened to pass `disabled=True` sent the caller hunting for the control that would
enable it, when enabling it would change nothing.

### Round 5: the gaps are now per-command, not structural

A fifth trial swept an element gallery across roughly sixty commands and confirmed the
round-4 fixes from the outside. What it found next was no longer a wrong rule applied
everywhere; it was individual commands not yet obeying rules the prototype had already
established. That is a meaningful change in kind, and it is the argument for the
per-command approach in §1: the remaining work is mechanical rather than a redesign.

**A rule applied to one command has to be applied to its siblings.** `st.tabs` became
addressable in round 4, and the trial immediately found that `st.expander` and
`st.popover` -- same `on_change="rerun"` pattern, same `optional string id` on the block,
same lazy-content trap -- were still keyed in the tree and missing from `actions`. Fixed
the same way. The lesson for the spec is that "a container can be a widget" is a
category, not three special cases, and a v1 checklist should enumerate it.

**`st.exception` is a display command, not a failed run.** An app that caught a
`ValueError` and rendered it deliberately flipped the whole interaction to
`status: "error"`, because the snapshot inferred failure from the presence of an
exception element. The runtime's own error display is distinguishable -- it is the only
caller that passes `apply_show_error_details=True` -- so the description now records
whether an exception was uncaught, and only that sets `status`. A caught-and-displayed
exception stays in the tree marked `uncaught: false`, which is more useful than either
hiding it or calling the run broken.

**"No data path" and "the data is the spec" are different answers.** `st.echarts_chart`
and `st.plotly_chart` take an option object or a figure, not a dataframe, so there is no
table to offload -- unlike `st.map`, whose points come from a dataframe that round 4
started serving. Reporting `data.complete: true` for spec-carrying charts says the client
already has everything and should stop looking for a `url`, which keeps the
complete-or-URL-or-unavailable invariant true for every element that has a `data` block.
Maps also report `row_count` now, counted from the layers, so a client does not have to
walk Deck.gl JSON to learn how much it is looking at.

**A command that renders as something else still has to describe itself.**
`st.mermaid_chart` wraps its body in a markdown fence and enqueues markdown, so the
snapshot called it `markdown` and reported the fenced text. It now names itself and
reports the author's diagram definition. This is the shared-proto problem from §1 in its
sharpest form: the proto field is not just ambiguous, it belongs to a different command.

**Redundant fields are a cost, not a courtesy.** `display_value` on `st.metric` was
emitted even when the author passed a string, so it repeated `value` verbatim. It now
appears only when Streamlit formatted something, which is the only case where it adds
information.

### Still open, and why

- **`props.index` stays at the authored default while `value` moves.** Correct per the
  `props`/`value` split -- `props` is what the author wrote -- and still a footgun.
- **No structured `applied_filters`.** A report citing "the filters that produced this
  number" has to walk the widget tree itself, and cannot carry that across a page switch.
- **`query_params` and widget `value` can diverge.** A `page` navigation materializes
  URL-bound values; a `widget_state` patch does not.
- **`clear_on_submit` is not honored**, and this one wants a decision rather than a
  patch. `lib/streamlit` only writes the flag onto the proto; all the clearing lives in
  the browser, where `WidgetStateManager.submitForm` emits `formCleared` and each React
  widget resets itself, writing the defaults back into form-scoped state that the server
  does not see until the next submit. So no headless consumer can observe it, and the
  agent API and `AppTest` diverge from the browser identically.

  Worth noticing that the browser is already inconsistent with itself here: right after a
  submit the server still holds the submitted values while the UI shows empty fields, so
  a rerun triggered by anything else renders from values the user believes they cleared.
  Moving the reset server-side after a submit run -- form membership is already known
  from each widget's `form_id` -- would fix the divergence and that inconsistency
  together, and would reproduce the browser's own end state. That is a change to core
  form semantics, so it belongs in its own change rather than inside the agent API. Until
  then the OpenAPI says outright that fields keep their submitted values and that empty
  fields are not a submit signal.

  The general form of this is worth a spec sentence: **a headless client inherits the
  frontend's responsibilities.** Any behavior Streamlit implements in React rather than
  in Python is absent for every non-browser consumer, and `clear_on_submit` is unlikely
  to be the only one.

A fifth client trial (element gallery plus climate / airport / longevity / studio)
confirmed those honesty patches from the outside: pills echo formatted labels;
reversed dates and wrong-shape numbers are `invalid_value`; map Arrow fetches;
status is `complete`; lazy tabs switch and reveal hidden dataframes. What it found next
was the same pattern one command at a time rather than a wrong rule applied everywhere,
which is the subject of the round-5 section above. `clear_on_submit` remains the one
finding that is a decision rather than a defect, for the reasons given here.

A sixth client trial pointed at the fragment and dialog contract OpenAPI now
states. Isolation held: a widget inside one `@st.fragment` reran only that
region (a page-body counter did not move; sibling fragments stayed
`rendered: false`); mixing two fragments or a fragment with an outside
control was `cross_fragment_batch` and left the previous snapshot current.
Dialogs are no longer `not_interactive_in_v1`. Opening is a full run; acting
on inner keys keeps the overlay open; a same-fragment batch of note + confirm
is legal; mixing an inner key with an outside trigger is refused rather than
silently closing the dialog; a full rerun closes it. Two gotchas the
implementation already knew and the trial hit from the outside: the `dialog`
node itself is not fragment-tagged (the body is), and the overlay's generated
identity is not a registered widget (`unknown_key` if you fire it). There is
no dismiss action; `dismissible` is a prop, and closing is a full rerun. Lazy
`st.expander` with `on_change="rerun"` is now addressable, which closes the
round-5 leftover that tabs had already escaped.

## 7c. Fragment reruns, and why dialogs came free with them

The prototype originally did full reruns only, which made `st.dialog` undrivable: a full
rerun does not re-emit a dialog, so the round-2 patch marked dialogs
`not_interactive_in_v1` and hid their contents from `actions`. That was the right call
for a full-rerun-only interface and the wrong long-term answer, because **an
`st.dialog` body is literally an `st.fragment`** -- the decorator wraps the user's
function in the internal `_fragment()` and calls it inside `with dialog:`. Dialog
interactivity was never a dialog feature to add; it was a fragment feature that was
missing.

Adding it took less than expected, because everything needed was already on the wire.
A fragment-scoped rerun is the same `rerun_script` message with `ClientState.fragment_id`
set, and the server already stamps `Delta.fragment_id` on every delta written inside a
fragment. Nothing needed a new proto field. Four things had to change:

1. **Settle on `FINISHED_FRAGMENT_RUN_SUCCESSFULLY`.** This was a live bug, not just a
   missing feature: an app calling `st.rerun(scope="fragment")` from a callback produced
   a run the interface never recognized as finished, so the request returned
   `run_timed_out` after the full timeout *even though the state change had landed*. Any
   app using fragment-scoped reruns was unusable, and the failure lost the response while
   keeping the effect.
2. **Prune on finish, not on start.** The message buffer plays the part of the browser's
   element tree, not the part of the server's outgoing queue, and the difference matters
   exactly here. Clearing the buffer when a full run *starts* looks equivalent and breaks
   on an interrupted run: a callback that calls `st.rerun(scope="fragment")` aborts the
   full run before it emits anything, so the buffer was wiped and the following fragment
   run produced a snapshot containing nothing but the fragment. The frontend's rule is to
   accumulate deltas as they arrive and prune when a run *finishes*, scoped to what that
   run owned -- a full run owns the tree, a fragment run owns its own region -- which is
   what the buffer does now.
3. **Carry the fragment id from the tree into the next request.** Recorded per node in
   the merge, then used to scope the rerun, which is exactly the browser's path from
   `node.fragmentId` to the outgoing message.
4. **Refuse what the wire cannot express.** One `BackMsg` carries one fragment id, so a
   batch spanning two fragments, or mixing a fragment's contents with controls outside
   it, is `cross_fragment_batch`. Widening it to a full rerun would have been the
   friendlier-looking choice and would silently close an open dialog.

Dialog support then fell out of (1)-(4) with one deletion: dropping the `support` flag.
Acting on a dialog's contents scopes to its fragment, which re-renders the body without
re-emitting the block, so it stays open; anything else is a full rerun, which closes it.
That is the browser's rule, not an interface quirk, and it is worth stating in the spec
because it constrains client strategy: finish inside a dialog before touching anything
else.

**The part worth a spec decision is what a partial rerun does to `observed_at`.** A
fragment rerun leaves most of the tree standing, so a single observation timestamp
overstates how current some of the document is -- and the spec's own email and
HTML-export examples cite `observed_at` as the provenance of their numbers. Two options
were on the table. Returning only the fragment's subtree makes the timestamp honest by
construction, and was rejected: it would push the delta merge and fragment-scoped
staleness rules onto every client, which is precisely the Streamlit knowledge the
snapshot exists to absorb, and it would break `actions`, since a client needs the whole
page's action set to choose its next move. The document therefore stays complete and
declares freshness instead: a `fragment` id on nodes that have one, and a `fragments`
list saying which regions this interaction re-rendered. Measured on a small app, a
fragment-only response would have been about a third the size of the full one -- real,
but not worth a stateful client.

`fragments` is also where `run_every` is disclosed. That interval is a browser-side
`setInterval`; the server only announces it. A headless client has no clock, so an
auto-refreshing fragment simply never refreshes -- another instance of the rule in the
`clear_on_submit` note below, that a headless client inherits the frontend's
responsibilities. Reporting the interval and letting the caller decide to poll is the
honest version; inventing background reruns on the server would not be.

Worth noting for the AppTest queue: `AppTest.run()` is always a full rerun and has no
fragment-scoped entry point, so this makes the agent API the first headless consumer that
can drive a fragment, and the same scoping is what AppTest would need.

The sixth trial is the outside confirmation of this section. One extra client
constraint it makes concrete: **finish the dialog before touching anything
else**, including an empty interact. The OpenAPI already says so; a caller that
treats `{}` as GET will close the overlay. An app that calls `st.rerun()`
(default app scope) from a dialog button does the same thing to itself, which
is browser-equivalent and not an interface bug.

## 7d. Discovery: how an agent finds the API from the app's URL

The spec assumes a caller already knows the endpoint. The workflow people actually want
is "point an agent at an app and ask it a question", which makes discovery part of the
feature rather than documentation around it.

What a fetch of an app URL returns today is the answer to where discovery has to live:
the shipped `index.html` is about 7 KB of module preloads whose only human-readable text
is *"You need to enable JavaScript to run this app."* That one sentence is the entire
payload an HTML-to-text extraction keeps, so it is the only place a naive fetch will
look. The `<noscript>` block now also says that the app can be read and driven as JSON
over HTTP, that the interface exists for agents, that it is preferred over browser
automation, that scraping the page is pointless because it carries no app content, and
where to start. A machine-readable `<link rel="service-desc">` (RFC 8631) sits alongside
it, matching the `Link` header the API already returns on every response.

**The important design decision was to keep the hint unconditional and let the endpoint
answer.** The alternative -- injecting the hint only when the API is enabled -- means
rewriting a static file at serve time and makes the HTML's correctness depend on a
runtime config. Advertising unconditionally and answering dynamically is better on every
axis: `index.html` stays a plain cacheable `FileResponse`, enabling the API later needs
no HTML change and no cache invalidation, and the link is never a dead end.

It also fixed a trap. The schema route used to be registered only when the API was
enabled, and its path is not in the static handler's reserved list, so with the API off
that URL fell through to the single-page-app fallback and returned **the app's HTML with
a 200**. A link into that would have handed an agent an HTML shell where it expected a
protocol description -- a failure that looks like success. The routes are now always
registered.

Answering well turned out to need three states, not two. A caller that cannot use the
API needs to know *why*, because the remedies differ: `disabled` tells the operator which
option to set, while `loopback-only` tells a remote caller that the setting is already on
and no request will get around the peer check. Collapsing those into one "not available"
notice sends half the callers after the wrong fix. The document reports which in
`info.x-streamlit-agent-api`, and omits the exact Streamlit version unless the caller can
actually use the API -- this is the one agent API response an unauthenticated caller can
reach, and a precise version is worth more to someone matching advisories than to a
client that cannot call anything.

**What this still does not solve is worth stating plainly.** Discovery is not capability:
most agent harnesses' web tools only do GET, so an agent can now find the protocol and
still be unable to `POST` to it. Closing that gap needs either a caller with a generic
HTTP tool or an MCP endpoint in front of the same interface, which is a product decision
rather than a prototype detail. Other conventions worth considering as complements are a
`/llms.txt`, which is the natural place for the observe-act-observe strategy in prose
rather than schema, and a skill for agents that can be equipped in advance.

## 8. Open questions the prototype surfaced

1. **How is "the run chain settled" defined?** The prototype's grace period is a
   heuristic. Anything better probably needs the runtime to expose whether a further run
   is pending, rather than inferring it from message order.
2. **Should coverage be enforced statically or at runtime?** Fill-time construction makes
   the spec's static CI gate impossible as written; `undescribed_types` plus a
   command-sweep test over a kitchen-sink app is the natural replacement (that is how the
   prototype's coverage was verified), but it is a different guarantee: it proves the
   commands the sweep exercised, not every variant.
3. **Is offloading unconditionally acceptable?** The spec wants the decision made against
   the response budget, which only the serializer knows, but the media-file lifecycle
   forces registration during the run (§5c). The prototype registers whenever an agent
   session has Arrow data, capped at 200 MB. That guarantees a truncated preview always
   has somewhere to fetch from, at the cost of a redundant media file for a small table
   whose preview was already complete. Worth confirming the redundancy is fine, or
   passing the row count to the emit site so only incomplete data is registered.
4. **Does the cache-replay gap matter?** A cache populated before the agent API was
   enabled replays without descriptions. Options: accept it, include the description in
   the cache key, or fall back to a proto-derived description on replay.
5. **Should `props` report authored or effective values where they differ?** The
   prototype leans authored (`min_value=None` stays absent rather than becoming the
   resolved default), except where the resolved value is what a client must act on
   (`options`, and date bounds, which Streamlit always resolves). That split works but is
   a judgement call per parameter, and the spec's "effective values, not just authored
   ones" rule reads as though it were uniform.
6. **How should an agent discover a control it cannot reach yet?** The `not_on_page`
   rejection tells an agent a key is unreachable but not what would make it reachable.
   For a three-level drill-down that is fine, because the tree shows the parent. For a
   deeply conditional app it may not be, and the answer is probably "nothing" — the app
   is the schema — but it is worth being deliberate about.
7. **Should the snapshot carry structured `applied_filters`?** Both downstream consumers
   the spec names — email reports and static HTML — have to cite "the filters that
   produced this number", and today that means walking the widget tree per page and
   losing it across navigation. It is the one thing the trial's exporters had to invent
   that looks like a missing field rather than a missing feature.
8. **Should bounds validation reuse the last snapshot's props?** Rejecting an
   out-of-range number the way an out-of-options selectbox is rejected needs min/max at
   validation time, and `WidgetMetadata` does not carry them. The snapshot does, and the
   session already keeps per-element state from it, so this is a small extension rather
   than new plumbing — but it makes the snapshot load-bearing for validation, which is
   worth deciding deliberately.
