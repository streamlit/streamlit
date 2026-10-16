# Implementation plan: the agent API v1 as stacked PRs

The [product spec](product-spec.md) is on `develop`
([#16843](https://github.com/streamlit/streamlit/pull/16843)). The prototype on
`feature/agent-api-prototype` ([#16930](https://github.com/streamlit/streamlit/pull/16930))
implements it, and its latest QA pass (82 checks) found no deviations. The prototype also
carries the MCP endpoint, which is a follow-up with
[its own spec](../2026-10-15-agent-app-mcp-endpoint/product-spec.md). Without it, v1 is
about 7,700 lines across 80 files, with no tests beyond the description coverage test.

This plan splits v1 into six stacked PRs, each reviewable and testable on its own, and
covers only what the product spec puts in v1. Code sizes are measured from the
prototype's files, split along these boundaries; test sizes are estimates.

## Ground rules

- **Off and hidden until the last PR.** `server.enableAgentApi` keeps its `False` default
  and is `visibility="hidden"` until PR 6, so a release cut between PRs advertises
  nothing. Every PR is a no-op for browser sessions: descriptions are only built for
  sessions the agent API created (`agent_spec.is_recording()`), which PR 1 tests.
- **Description arguments never raise.** They are evaluated in every session, browsers
  included, so PR 1 tests that each command's description accepts every input type the
  command does, and PR 5 holds the data arguments it adds to the same rule. The
  prototype broke `st.radio` in the browser once by truth-testing a pandas Series.
- **The coverage test lands complete in PR 1.** Every command is described there, so
  `agent_spec_coverage_test.py` needs no list of commands still to come. From PR 1 on, a
  new command or parameter fails CI until someone decides what an agent sees.
- **Error codes grow with the code; the protocol description is written once.** Each PR
  adds its error codes, with their HTTP status and a one-line meaning, to the catalog in
  `runtime/agent/errors.py`, which the routes read their status codes from. The
  prototype keeps that catalog in `protocol.py`; PR 3 moves it, so the protocol
  description does not have to arrive early. The OpenAPI document lands whole in PR 6:
  about 900 lines, mostly prose ported from the prototype, with its error list and
  request fields derived from the catalog and the validator so they cannot drift.
  Written against the finished behavior, it needs one product review instead of four,
  and the stack avoids rebasing one shared file through every PR.
- **Nothing heavy on the event loop.** Building a snapshot reads every table's Arrow data
  and runs the app's `format_func`s, so it runs in a worker thread, as in the prototype.
  Encoding the response as JSON moves there too, which the prototype does not yet do.
  Session bookkeeping that can close sessions stays on the loop, and a session stays
  claimed until any worker it started has finished.
- **Public hooks over private internals.** The prototype reaches into `AppSession`,
  `SessionState`, and the session manager. The PR that ports such code adds a small
  public method instead; PRs 3 and 4 list theirs.
- **v1 only.** The MCP endpoint, the per-interaction audit log, and usage metrics stay
  on the prototype branch. See [Leaving the prototype behind](#leaving-the-prototype-behind).

## The stack

| PR | Scope                                                  | Code (approx.)      | Tests (est.) |
| -- | ------------------------------------------------------ | ------------------- | ------------ |
| 1  | Element descriptions                                   | 2,000               | 700          |
| 2  | Snapshot builder                                       | 800                 | 700          |
| 3  | Agent sessions and the `interact` route                | 1,850               | 1,200        |
| 4  | Writes: values, triggers, forms, fragments, and dialogs | 1,100               | 1,300        |
| 5  | Data, charts, and maps                                 | 700                 | 600          |
| 6  | Protocol description, discovery, and launch            | 1,100, mostly prose | 300          |

Each PR's branch starts from the previous one, so the stack is linear and merges in
order. Review can still overlap: element owners can review PR 1 while PR 3 is in
security review, and PR 5 touches none of PR 4's validation code. PR 5 sits after PR 4
rather than beside it because both fill in the snapshot serializer and both edit
`interaction.py`, so two branches off PR 3 would conflict.

Each PR is a reviewer audience as much as a scope:

- **PR 1** is every element file's change, and almost nothing else: one declaration per
  command, reviewed by each element's owners, and the browser-regression review, since
  it is where commands start building descriptions in every session.
- **PR 2** is whether the builder turns a run into the tree the browser would show.
- **PR 3** is the security review, and the first PR an agent can use, read-only.
- **PR 4** is everything a request can change, so the spec's four representative flows
  all complete in it.
- **PR 5** is the data contract and its memory cost.
- **PR 6** is the product review of the text agents read.

### PR 1: Element descriptions

How each command describes itself to an agent, for every command, and the small
framework that records it. Nothing reads the descriptions yet except tests. The only
logic beyond the declarations is the recording gate, dropping unset parameters, and the
spec's JSON encoding of values.

- `ForwardMsgMetadata.agent_props` in `ForwardMsg.proto`, in metadata so it is excluded
  from the message cache hash.
- `elements/lib/agent_spec.py` without its data side: `element`, `block`, the recording
  gate, dropping unset parameters at any depth while keeping content such as an
  `st.json` body whole, `described_column_config`, and the `value_schema` building
  blocks. `runtime/agent/json_encoding.py` with the spec's encoding table, which
  `agent_spec` encodes parameters with.
- Plumbing: `DeltaGenerator._enqueue` and `_block` carry the description, the
  transparent outside wrapper gets one, and cache replay records it and drops it when
  replaying into a session that is not recording.
- A description for every command, each a declaration next to the code that fills its
  proto:
  - **Display:** the text family (`markdown.py`, `heading.py`, `text.py`, `code.py`),
    `st.exception` with `uncaught`, `st.empty`, `st.space`, alerts, `st.metric`,
    `st.progress` rounded to the whole percent the browser shows, `st.toast`,
    `st.balloons`, `st.snow`, `st.help`, `st.json`, images and `st.pyplot`, audio and
    video, `st.html`, iframes, custom components v1 and v2, `st.mermaid_chart`,
    `st.graphviz_chart`, and `st.skeleton`. `support: browser_required` for custom
    components, `components.html`, inline iframe HTML, and `st.html` with scripts
    allowed; `st.pdf` reported as the custom component it renders through.
  - **Containers:** the layouts in `layouts.py`, `st.form`, and `st.status` and
    `st.dialog`, whose descriptions are rebuilt whenever the block is re-sent at the
    same position, the dialog's with `is_open`, `on_dismiss`, and its overlay trigger.
    Stateful tabs, expanders, and popovers declare their `action` and `value_schema`.
  - **Widgets:** each with its `action`, its `value_schema`, its options in the form a
    request sends back, such as `format_func` labels, and `on_change` or `on_click`
    where the browser can defer. Eager `st.download_button` as a trigger and the
    deferred one as `read_only_in_v1`; `st.link_button(on_click=...)`; `st.page_link`;
    uploads and camera and audio input as `read_only_in_v1`; and `st.chat_input`
    reporting `accept_file` and `accept_audio`.
  - **Data elements, by their parameters:** `st.dataframe`, `st.table`,
    `st.data_editor` (`read_only_in_v1`), the Vega charts, Plotly, ECharts, PyDeck, and
    `st.map`, with `column_config` described through `described_column_config`, and
    `read_only_in_v1` where selections or a button column are on. The data they carry
    comes in PR 5.
- The coverage test, complete: every command's description held to its signature in
  both directions, and a `value_schema` on every element that takes a value. The
  description rules go in `lib/streamlit/AGENTS.md` with their generated copies.

**Spec:** the naming, effective-value, presentation, and absent-content rules and the
encoding table in [The snapshot](product-spec.md#the-snapshot); the image, media, HTML,
iframe, and custom component rows of
[Data, charts, and media in v1](product-spec.md#data-charts-and-media-in-v1); and the
description and coverage decisions in
[Key design decisions](product-spec.md#key-design-decisions).

**Observable:** nothing.

**Review focus:** first the browser path, since every command now evaluates its
description arguments in every session: the description stays out of the message cache
hash, cache replay works in both directions, and no argument can raise for any input the
command accepts. Then the rule each call site follows: the public command name as
`type`, parameter names as `props`, unset parameters dropped, effective values for what
changes meaning, presentation left out, and what the browser receives rather than what
the author passed. Element owners review their own commands.

**Tests:** `agent_spec` unit tests; `json_encoding` with a fixture per row of the
encoding table; a normal session never sets `agent_props`; cache replay in both
directions; the coverage test; and the description-arguments check from the ground
rules for each command.

### PR 2: Snapshot builder

How a run's messages become the snapshot: everything a client reads, apart from the
data PR 5 adds. A pure function of recorded messages and session state, with no
consumer outside tests.

- `runtime/agent/snapshot.py`: `merge_deltas` into the four root containers, the way the
  frontend's tree accumulates deltas.
- The serializer: `type`, `key` as the authored key or the element ID, `props`,
  `support` with a container's binding its contents, `value_schema`, `form_id`, `bind`
  read from the widget registry, and `fragment`, with the dialog node carrying its
  opener's and its body the dialog's. Contentless elements left out; transparent and
  single-child containers collapsed. The fallback for undescribed elements, and
  `undescribed_types`.
- Values: each widget's `value` read through its own serializer, so what is reported is
  what a request can send back, including `format_func` labels, typed text in widgets
  that accept new options, and `None` options. Password values are never reported.
- The `actions` index, with each entry's `type` and `label`, leaving out disabled and
  unsupported elements.
- The envelope: `status` from both signals, including the compile error; `page` and
  `pages`; `observed_at`; and `query_params`.
- The serializer gets a separate step for each part a later PR fills in, the data block
  and the element state requests are checked against, so PRs 4 and 5 each fill their
  own function.

**Spec:** [The snapshot](product-spec.md#the-snapshot) and
[When a run fails](product-spec.md#when-a-run-fails).

**Observable:** nothing.

**Review focus:** that the builder merges deltas the way the frontend's tree does, that
`status` reads both signals, and that a reported value is always in the form a request
sends.

**Tests:** builder tests that run commands through `DeltaGeneratorTestCase` with
recording forced on, covering structure, collapsing, the undescribed fallback, and both
`status` signals, including an `st.App(on_script_error=...)` handler that suppresses the
error display; every widget's reported value matching its own `value_schema`;
`format_func` labels and `None` options; password values never reported; and the
`actions` index.

### PR 3: Agent sessions and the `interact` route

The first PR an agent can use, behind the hidden flag: create a session, read any page
with its widgets' values and actions, rerun, navigate, and run a parameterized report in
one call. Nothing can be set yet.

- **Settling on the script runner's shutdown**, not the prototype's 50 ms grace period:
  a public `AppSession` hook reports when the runner has shut down with no rerun queued
  and its last messages have reached the client. This replaces both
  `_RUN_CHAIN_SETTLE_SECONDS` and `_FINISH_GRACE_SECONDS`; see
  [the potential follow-up](potential-follow-ups.md#settle-on-the-script-runners-shutdown-not-a-grace-period)
  for why. It is the PR's first commit, with its own unit test, so the new runtime
  signal is reviewable apart from the security review.
- `AgentSessionClient` in `runtime/agent/interaction.py`: it buffers the page the way
  the browser's tree does, accumulating deltas, rewriting an element in place, and
  pruning when a run finishes, scoped to what that run owned. A fragment run the app
  starts itself, such as `st.rerun(scope="fragment")` from a callback, prunes only its
  own region. It never raises inside the runtime's message loop.
- `AgentSessionRegistry`: the session cap, checked only on creating calls; the idle TTL,
  swept on a timer as well as on each request; identity binding from
  `server.trustedUserHeaders`; opaque handles; and `runOnSave` off for agent sessions.
- `interact` for creating calls and reruns:
  - `page`, resolved by the runtime on a creating call and checked against the page list
    after the run.
  - `query_params`, with the browser's page-change rule and every widget's state listed
    on a page change.
  - `context`, with timezone and locale validated.
  - The run timeout as a `202` with `run_timed_out`. A retry with only `session_id`, or
    the same request again, collects the run; anything else gets `session_busy`. A
    client that disconnects counts as timed out, and its retry waits for a snapshot
    still being built.
  - Text that is not valid Unicode refused up front, and a creating call that fails
    unexpectedly closes the session it made.
  - `widget_state` and `trigger` stay unknown fields until PR 4, so a request carrying
    them is refused rather than run as a rerun that silently ignores them.
- The snapshot built in a worker thread with a stand-in script context carrying session
  state, timezone, and locale, and the response's JSON encoding moved there too.
- `st.context` for agent sessions: unset browser fields read `None` (`context.py`,
  `app_session.py`), and the headers are each request's minus `Cookie`, `Authorization`,
  and `Proxy-Authorization`, set only when a run starts.
- Routes: `POST /_stcore/agent/interact`, with `405` for any other method. The Host
  allow-list, the `Origin` refusal, a body bounded while it streams by
  `server.maxWidgetStateSize`, strict JSON, and no cookie read. Media URLs rewritten
  relative to the request, which also makes them work under `server.baseUrlPath`.
- The error catalog in `errors.py` with the codes so far, and the config options
  `server.enableAgentApi`, `agentRunTimeout`, `agentSessionTTL`, and
  `agentMaxSessions`, hidden, each refusing anything but a whole number greater than
  zero.
- Public hooks replacing the prototype's private access: looking up an agent session's
  `AppSession` on the runtime; on `AppSession`, turning off run-on-save, the current
  page's script hash, the page list, whether a fragment is still held, the
  runner-shutdown signal, and a factory for the stand-in script context.

**Spec:** [v1 is one operation](product-spec.md#v1-is-one-operation),
[Limits and configuration](product-spec.md#limits-and-configuration),
[Security](product-spec.md#security), [Enablement](product-spec.md#enablement), the
outcomes table in [When a run fails](product-spec.md#when-a-run-fails), and relative
URLs in [Discovery and URLs](product-spec.md#discovery-and-urls).

**Observable:** with the hidden flag on, an agent can create a session, read any page as
PRs 1 and 2 describe and build it, rerun, navigate, and run a parameterized report in
one call, seeing bound widgets take their values from `query_params`.

**Review focus:** security and resource limits; the runtime integration: driving
`handle_backmsg`, the settle signal, the timeout and collection states, and keeping a
session claimed across the worker thread.

**Tests:**

- Registry unit tests: the cap, the TTL and the sweep, and a different identity getting
  `unknown_session`. The cap, the TTL, and a timed-out run still going exercised
  together, since a run outlives the request that started it.
- A chain of `st.rerun()` calls under load settling only after its last run.
- `AgentSessionClient` unit tests on recorded message sequences, including a fragment
  run that must leave the rest of the page in place. No request can start a fragment
  run before PR 4, so this is where the prune-when-a-run-finishes rule is tested until
  then.
- Route tests with Starlette's test client for every security rule and error code, and
  concurrent requests on one session, exactly one of which runs.
- A client disconnecting during the wait and during the build.
- A real-protobuf `st.context` test: an explicitly sent `0` or `False` is kept, and an
  unset field reads `None`.
- E2E (`e2e_playwright/agent_api_*`, overriding `app_server_extra_args` with
  `--server.enableAgentApi=true` and calling the API from `app_base_url`): create, read,
  navigate, an unknown page on a creating call, bound widgets set from `query_params`
  on a creating call, a slow app that times out and is collected, and an edit applying
  on the next interaction.
- Marked `@pytest.mark.external_test`: a path-stripping proxy, `server.baseUrlPath`, a
  refused `Origin`, spoofed identity headers, the `st.login` cookie not authenticating a
  call, and a SiS caller's-rights app reading its token from `st.context.headers` on
  every interaction.

### PR 4: Writes: values, triggers, forms, fragments, and dialogs

Driving the app: `widget_state`, `trigger`, forms, and requests scoped the way the
browser scopes them, including dialogs driven across turns. The descriptions this needs
are already in PR 1, so this PR is the request side only. Fragments and dialogs land
here rather than on their own because they are about 200 lines, and without them a
dialog's contents cannot be driven, which one of the spec's four flows needs.

- `runtime/agent/widget_patch.py`:
  - Key resolution, and the checks against the last snapshot: `not_on_page`,
    `unknown_key`, `disabled_widget`, `unsupported_element`, `not_a_value`, and
    `not_a_trigger`.
  - The spec's three value checks: the JSON type, the options and `max_selections`, and
    the widget's own deserializer. Also `maxItems`, ISO temporal text written through
    each widget's serializer with an offset it cannot hold refused, and `null` clearing
    only what a browser user can empty.
  - Triggers with payloads (`st.chat_input`, `st.menu_button`), and the form rules
    (`missing_form_submit`, `cross_form_batch`).
  - Scoping a request to the fragment its keys share (`resolve_fragment`), a full rerun
    for a batch spanning regions or for a fragment the runtime no longer holds, and
    `cross_dialog_batch` for a dialog's widgets mixed with anything outside it.
- `ElementState` per keyed element, recorded by the builder: what each element
  advertised, which is what a request is checked against.
- The `widget_state` and `trigger` request fields, refused on creating calls and beside
  navigation, and setting a bound widget dropping its query parameter.
- Public hooks on `SessionState` for widget metadata by element ID and the key-to-ID
  mapping.

**Spec:** [Actions in v1](product-spec.md#actions-in-v1), including its fragment and
dialog rules.

**Observable:** an agent can operate an app: filters, buttons, forms, chat, and dialogs
across turns, with a widget inside a fragment rerunning only that fragment.

**Review focus:** that every value is refused or accepted before anything runs, that
validation reads the last snapshot rather than live widget metadata, which outlives the
widget, and that a request reruns exactly what the browser would.

**Tests:** encoding and rejection per widget type; every widget's reported value
accepted when sent back; codec fixtures for values a request sends: dates and date
ranges, decimals, large integers, non-finite numbers, nulls, object-valued options, and
options that share a label; a `format_func` round trip; a widget that appears only after
another changes; a callback that calls `st.rerun(scope="fragment")` leaving the rest of
the page in the snapshot; a widget inside a fragment not rerunning the page; a dialog
staying open through its own confirm and closing when dismissed; `cross_dialog_batch`
refused before anything runs; and E2E conformance against an equivalent browser session,
on callback order, resulting values, and output, for all four of the spec's flows: a
filtered dashboard, a form with two submit buttons, a chat flow, and a multi-turn
dialog.

### PR 5: Data, charts, and maps

Complete data for tables and charts, without putting it in the snapshot.

- `elements/lib/data_offload.py`: Arrow registered in media storage during the run,
  bounded by `server.maxMessageSize`, and registered again on cache replay into an agent
  session but not into a browser session, which would never fetch it.
- `agent_spec`'s data side: `element()`'s `data_url` and `data_summary` arguments, and
  the Vega helpers that find a chart's Arrow buffers and tell a specification that loads
  its data from a URL. The data elements from PR 1 pass them: the Arrow copy for tables
  and charts, the built-in charts' named dataset, and `st.map`'s plotted table without
  its index or the generated Deck.gl specification.
- The `data` block in the serializer: `columns`, `row_count`, `column_count`,
  `complete`, a `preview` of values in `columns` order bounded by the hidden
  `server.agentPreviewRows`, `url`, and `unavailable` (`too_large_to_serve`,
  `multiple_datasets`, `external_url`, `lazy_loading`, `undescribed`); a chart's
  specification as `spec`, with Plotly's theme dropped and named in `spec_omitted` and
  its typed arrays expanded.

**Spec:** [Data, charts, and media in v1](product-spec.md#data-charts-and-media-in-v1).

**Observable:** complete answers about filtered tables, through `data.url`.

**Review focus:** that `data.complete` always resolves to complete, a `url`, or an
`unavailable` reason; that nothing reaches an agent the browser does not receive, such
as an index the browser drops; and the memory cost, one extra copy per element per agent
session, bounded by the size limit, the session cap, and the TTL.

**Tests:** `summarize_arrow` edge cases (duplicate column names, non-finite numbers,
index columns); the size ceiling; URL lifetime, served while rendered and collected
after; cache replay in both directions; the description-arguments check for the new data
arguments; E2E that fetches a table's URL and compares its row count with the snapshot;
and the golden test for the spec's worked example, which needs writes and data both.

### PR 6: Protocol description, discovery, and launch

- The OpenAPI document in `runtime/agent/protocol.py`: the envelope, the snapshot, the
  tree node as an open object rather than a `oneOf` of element types, `actions`,
  `value_schema`, the `data` contract, and every error code with its status. Its prose
  is ported from the prototype, which is what the trials' agents learned the protocol
  from, so it is written for a model to read; the error list and the request fields are
  derived from the catalog and the validator. The `servers` entry is relative, with one
  more `..` per segment of `server.baseUrlPath`.
- `GET /_stcore/agent/openapi.json`, registered even with the API off and reporting
  `available` or `disabled`, the disabled document omitting the exact Streamlit version;
  and `Link: <openapi.json>; rel="service-desc"` on every agent response.
- `index.html`: `<link rel="service-desc">` and the `<noscript>` hint, served whether or
  not the API is on. The hint's wording needs product sign-off.
- The flag made visible, and the user-facing docs: the protocol reference and coverage
  matrix, an authoring guide ("write `key=`, explain the app in the app"), verification
  guidance next to `AppTest` and Playwright, and a deployment page that says enabling the
  API means applying the identity-header policy to `/_stcore/agent/` too.

**Spec:** [Discovery and URLs](product-spec.md#discovery-and-urls), and the remaining
[Success criteria](product-spec.md#success-criteria).

**Tests:** the document validates as OpenAPI; every catalog code is documented with its
status; the documented request fields and enumerations match the validator's; the schema
route answers with the API on and off; and, marked `@pytest.mark.external_test`, the app
shell still loads with the new link under a host CSP.

## Meeting the spec's success criteria

| Success criterion                                                          | Where                                                       |
| -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Every command describes itself, held to its signature by the coverage test | PR 1                                                        |
| JSON encodings pinned with codec fixtures                                  | PR 1 for reported values, PR 4 for values a request sends   |
| A reported value can be sent straight back                                 | PR 2 for matching its `value_schema`, PR 4 for being accepted |
| The four flows complete and match a browser session                        | PR 4                                                        |
| Large dataframes give bounded snapshots and a fetchable `data.url`         | PR 5                                                        |
| With the API off, no agent route executes, and the schema route says so    | PR 3, then PR 6 for the schema route                        |

## Leaving the prototype behind

| Stays on the prototype branch | Why | Where it goes |
| ----------------------------- | --- | ------------- |
| The MCP endpoint: `mcp.py`, `data_access.py`, its route, its OpenAPI path, the `unknown_file` and `result_too_large` codes, `media_file_ids` and `AgentSession.media_ids`, and the MCP sentences in `index.html` and the API description | A follow-up with [its own spec](../2026-10-15-agent-app-mcp-endpoint/product-spec.md) | One PR after the stack. It builds on PR 6: its input schema is the OpenAPI request schema, and its `instructions` the document's description |
| The per-interaction audit log (`_log_interaction`) | An operations follow-up in the spec | The spec's smaller follow-ups |
| Usage metrics, which the prototype never collected | Usage stats are reported by the browser, and an agent session has none | The spec's smaller follow-ups |

Already cut from the prototype earlier and recorded as follow-ups: keeping only summaries
in the session buffer, input checks beyond the spec's three, letting a new action
replace a run still going after `run_timed_out`, applying `clear_on_submit`, and
rewriting a bound parameter rather than dropping it.

### Considered and kept

- **Descriptions for rarely used elements.** The fallback would name them by protobuf
  field and break the spec's naming rule for little saving.
- **Fragments and dialogs**, in PR 4. About 200 lines, and leaving them out would be a
  spec change: a dialog's contents could not be driven, which the multi-turn dialog flow
  in the success criteria needs.
- **Serving full data as Arrow.** The trials depended on it for complete answers about
  filtered tables.
- **The OpenAPI prose.** The trials learned the protocol from it alone.
- **The page-change rule and dropping an edited bound parameter.** Both stop the app from
  running with a value the client did not choose.
- **The unknown-page check on creating calls.** Without it, a typo in `page` lands on the
  default page with a `200`, and one-shot creates on a page were the trials' most common
  pattern.
- **The `context` field.** About 50 stateless lines, and it lets an app that formats
  times answer as it would for a person.
- **The idle-session timer.** Reclaiming only on the next request would leave a quiet
  server holding every idle session's memory and media.
- **The security rules.** Each closes a specific hole the reviews found.

## Mechanics

- Build each PR as a fresh branch off the previous one, bringing files over from the
  prototype branch and leaving behind what the table above lists. Keep the prototype
  branch as the reference until PR 6 merges.
- Port the prototype's checks from its 45 `work-tmp/verify_*.py` scripts into the PR
  that introduces each behavior. The topical ones map directly: `settle`, `timeout`,
  `disconnect`, `build_reuse`, `headers`, `params`, `qp_nav`, `run_on_save`,
  `container_rebuild`, and `unversioned_routes` to PR 3; `schema`, `fragments`, and
  `dialog_status` to PR 4; `vega_datasets` to PR 5; `discovery` to PR 6. The mixed ones
  (`naming`, `metric`, `qa_*`, `round*`, `review*`, `r9` to `r12`, `feedback*`,
  `findings`, `grok`, and `sync`) split by the behavior each check covers, and a
  description check becomes a unit test in PR 1 or PR 2 rather than an HTTP call.
  `mcp`, `get_data`, and `title_get_data` stay behind.
- Each PR description links the spec sections it implements and lists the checks it
  ported. Run `make check` on each PR, and the new E2E modules with
  `make run-e2e-test`.
- `potential-follow-ups.md` and this plan can land with PR 1.
- Before PR 6 merges, rerun the prototype's QA plan and an agent trial against the head
  of the stack.
