# Implementation plan: the agent API as stacked PRs

The prototype on `feature/agent-api-prototype`
([#16930](https://github.com/streamlit/streamlit/pull/16930)) is about 6,500 lines across
77 files, and has almost no tests. This plan splits it into six stacked PRs, each
reviewable and testable on its own, and lists what to leave out of v1 to keep it small.
The prototype already has those cuts applied, except the MCP endpoint, which stays in it
until its own PR. Sizes are estimates measured from the prototype.

## Ground rules

- **Off and hidden until the last PR.** `server.enableAgentApi` keeps its `False` default
  and is `visibility="hidden"` until PR 6, so a release cut between PRs does not advertise
  a half-built API. Every PR is a no-op for browser sessions: descriptions are only built
  for sessions the agent API created (`agent_spec.is_recording()`), which PR 1 tests.
- **Each PR brings its own tests.** The prototype's checks live in `work-tmp/verify_*.py`
  (about 230 of them, against small apps). Port each one into the PR that introduces the
  behavior: unit tests for pure logic, and an e2e module (`e2e_playwright/agent_api_*`)
  that overrides `app_server_extra_args` with `--server.enableAgentApi=true` and drives
  the app over HTTP.
- **The OpenAPI document grows with the code.** Each PR adds the request fields, error
  codes, and schema it implements, so the document never describes something that is not
  there yet.
- **The spec goes first, on its own.** `product-spec.md` and `potential-follow-ups.md`
  land on `develop` in a spec-only PR before PR 1, as the specs process requires.
  `mcp-support.md` waits for the MCP PR. `prototype-feedback.md` and
  `prototype-learnings.md` move to the agent wiki instead of the repository.

## The stack

| PR | Scope                                   | Depends on | Size (approx.)                     |
| -- | --------------------------------------- | ---------- | ---------------------------------- |
| 1  | Command descriptions                    | —          | 1,600 lines, 1,100 of them call sites |
| 2  | Snapshot builder                        | 1          | 750                                |
| 3  | Sessions and the `interact` endpoint    | 2          | 1,200, plus 700 of OpenAPI text    |
| 4  | Acting: widgets, triggers, forms        | 3          | 700                                |
| 5  | Data over HTTP                          | 3          | 750                                |
| 6  | Fragments, dialogs, and launch          | 4          | 350                                |

PRs 4 and 5 are independent of each other and can be reviewed in parallel. A stack that
must stop at five can defer PR 6's fragment half; see there.

### PR 1: Command descriptions

How every `st.*` command describes itself, with no consumer yet.

- `ForwardMsgMetadata.agent_props` in `ForwardMsg.proto`.
- `elements/lib/agent_spec.py` and `runtime/agent/json_encoding.py`: `element`, `block`,
  the recording gate, dropping unset parameters, `described_column_config`.
- `DeltaGenerator._enqueue` and `_block` carry the description, the transparent wrapper
  gets one, and cache replay records it and drops it when replaying into a browser
  session.
- Descriptions for widgets, text and markdown, metrics, headings, alerts, media, HTML,
  iframes, components, layouts, forms, and status containers, including the rarely used
  elements. Charts and data elements wait for PR 5, dialogs for PR 6.

**Observable:** nothing. No session records yet.

**Review focus:** the rule each call site follows: the public command name as `type`,
public parameter names as `props`, unset parameters dropped, and effective values for
parameters that change what the element means. Reviewers of each element only need to
check their own command's call.

**Tests:** `agent_spec` unit tests; `agent_spec_coverage_test.py`, already in the
prototype, which runs every element mock with recording forced on and checks each
description against its command's signature in both directions (the spec's coverage
criterion); a test that a normal session never sets `agent_props`; cache replay in both
directions.

### PR 2: Snapshot builder

`runtime/agent/snapshot.py` as pure functions over recorded `ForwardMsg`s and session
state: no sessions, no HTTP.

- `merge_deltas` into the four root containers, and the serializer: `type`, `key`,
  `props`, `value` through each widget's serializer, `actions`, `support`, and the
  `ElementState` the next request is checked against.
- The fallback for undescribed elements and `undescribed_types`; pages, `app_title`,
  `status` and uncaught exceptions; password values never reported.
- Inline table previews from the Arrow already in the payload (`summarize_arrow`, the
  hidden `server.agentPreviewRows`), and `rebase_media_urls` for relative media URLs.

**Tests:** unit tests that run commands through `DeltaGeneratorTestCase` with recording
forced on and feed the queued messages to `build_snapshot`; a golden test for the spec's
worked example, which `work-tmp/check_example.py` compares today.

### PR 3: Sessions and the `interact` endpoint

The first PR an agent can use, behind the hidden flag: open a session, read any page,
and run a parameterized report in one call.

- `AgentSessionClient`, buffering the latest full run and settling when the script
  runner shuts down rather than after the prototype's 50 ms quiet period;
  `AgentSessionRegistry` with the session cap, idle TTL, and identity binding from
  `server.trustedUserHeaders`.
- `interact` for creating calls and reruns; `page` and `query_params`, including the
  browser's page-change rule, listing widget states with a page change, and the
  unknown-page check after a creating call; the run timeout as a `202` that the same
  request or an empty one collects, with `session_busy` for anything else while the run
  is still going.
- `POST interact` and `GET openapi.json` routes, `405` for other methods, and the security
  rules: Host allow-list, `Origin` refusal, bounded body, strict JSON, no cookies read.
  Also the `Link` header, the debug audit log, `errors.py`, and the config options.
- The `st.context` fix that reports unset browser fields as `None` (`runtime/context.py`,
  `app_session.py`).
- The OpenAPI base document: request envelope, snapshot schema, error catalog so far.

**Review focus:** security and resource limits (this is the PR for the security review),
and the runtime integration: `handle_backmsg`, the session manager, settling a run chain.

**Tests:** registry unit tests (cap, TTL, identity mismatch); the cap, the TTL, and a
timed-out run still going exercised together, since a run outlives the request that
started it; a chain of `st.rerun()` calls under load settling only after its last run;
route tests with Starlette's test client for every security rule and error code;
concurrent requests on one session, exactly one of which runs; a real-protobuf `st.context` test that an
explicitly sent `0` or `False` is kept and an unset field reads as `None`; e2e for
create, read, navigate, and a slow app that times out and is collected. Mark the
routing and identity e2e tests `@pytest.mark.external_test`: a path-stripping proxy,
`server.baseUrlPath`, a refused `Origin`, spoofed identity headers, the `st.login`
cookie not authenticating a call, and the app shell still loading with the new
`index.html` link under a host CSP.

### PR 4: Acting: widgets, triggers, forms

`runtime/agent/widget_patch.py` and the `widget_state` and `trigger` request fields.

- Key resolution, and the checks against the last snapshot: `not_on_page`,
  `disabled_widget`, `unsupported_element`, `not_a_value`, `not_a_trigger`.
- Encoding each value type, including temporal values; triggers with payloads
  (`st.chat_input`, `st.menu_button`); form rules (`missing_form_submit`,
  `cross_form_batch`); the options check, and running the widget's deserializer on the
  encoded value so one it cannot read is refused instead of failing every later run.
- Dropping an edited bound widget's query parameter, so a stale address cannot put the old
  value back.
- The `context` request field (timezone and locale).

**Tests:** unit tests for encoding and rejection per widget type; codec fixtures for
dates and date ranges, decimals, large integers, non-finite numbers, nulls,
object-valued options, and options that share a label; e2e for a form with two submit
buttons, a `format_func` round trip, a chat flow, and a widget that appears only after
another changes.

### PR 5: Data over HTTP

Complete data for tables and charts, without putting it in the snapshot.

- `elements/lib/data_offload.py`: Arrow registered in media storage, the
  `server.maxMessageSize` ceiling, re-registration on cache replay.
- Descriptions for dataframes, tables, the Vega charts, Plotly, ECharts, PyDeck, and maps,
  with `data_url` and the selection `support` tags.
- The `data` contract: `complete`, `url`, `unavailable` (`too_large_to_serve`,
  `multiple_datasets`); lazy dataframes; the map's plotted table; Plotly's theme dropped
  and typed arrays expanded; the built-in charts' zero sizes dropped.

**Tests:** `summarize_arrow` edge cases (duplicate column names, non-finite numbers, index
columns); the size ceiling; URL lifetime (served while rendered, collected after); e2e
that fetches a table's URL and compares the row count with the snapshot.

### PR 6: Fragments, dialogs, and launch

- Keeping the page's messages across fragment runs and pruning stale ones, settling on
  `FINISHED_FRAGMENT_RUN_SUCCESSFULLY`, scoping a request to its fragment, the
  cross-fragment and cross-dialog rules, dialog descriptions (`is_open`, the dismiss
  trigger), and `fragments` in the snapshot.
- Launch: `<link rel="service-desc">` and the `<noscript>` hint in `index.html` (the
  hint's wording needs product sign-off, and it is served whether or not the API is on),
  the flag made visible, and the user-facing docs. Deployment docs say that enabling the
  API means applying the identity-header policy to `/_stcore/agent/` as well.

**Tests:** e2e that a widget inside a fragment does not rerun the page, that a dialog
stays open through its own confirm, and that dismissing it works.

**If the stack has to be shorter:** without the fragment half, a widget inside a fragment
triggers a full rerun — the output is right, it just does more work — and a dialog's
contents have to be reported `read_only_in_v1`, because a full rerun closes the dialog.
The launch half then moves into PR 5.

## What to leave out of v1

Together these remove about 680 lines, and with them the prototype's most fragile parts:
about 400 for the MCP endpoint, which the prototype still carries, and about 280 already
removed from it. None changes whether an app behaves correctly through the API, and the
product spec describes v1 without them.

| Leave out | Saves | Impact if left out | Where it goes instead |
| --------- | ----- | ------------------ | --------------------- |
| The MCP endpoint (`mcp.py`, `data_access.py` for its `get_data` tool, its route, its OpenAPI path) | ~550 lines, plus tracking a fast-moving external protocol | Low. The same `interact` is available over HTTP, and the spec already lists MCP as follow-up #6. | A PR after the stack, with `mcp-support.md` as its design |
| Compacting the message buffer | ~90 lines, and a second code path for every table's and chart's `data`, run inside the runtime's message loop | Memory only: a 50,000-row table holds 1.7 MB per session instead of 38 KB, within `server.maxMessageSize`, the session cap, and the TTL | [Potential follow-up](potential-follow-ups.md#keep-only-summaries-in-the-session-buffer) if profiling asks for it. Keep the small path that lets `st.map` supply its own summary. |
| Input checks beyond options and the widget's own deserializer (bounds, whole numbers, `max_chars`, string formats, range shape and order) | ~170 lines | Low. The runtime already resets an out-of-range, malformed, or wrong-shape value to the widget's default, so the request succeeds and `value` shows the reset; a fraction sent to an integer input is truncated and over-long text is cut. A reversed slider range and a date range of any length are stored as sent, which the OpenAPI text warns about. | [#16203](https://github.com/streamlit/streamlit/issues/16203), in the runtime for every client |
| A new action replacing a run still going after `run_timed_out` | ~25 lines, the `_awaiting_run` gate, and the race where a replaced run's result answers the wrong request — the most stateful code in `interaction.py` | Low. The same request or an empty one still collects the run; anything else gets `session_busy` until it finishes. | Follow-up #4 |
| The idle-reclaim timer | ~30 lines | Low. A session idle past its TTL is reclaimed on the next request instead of on a timer, so an idle server holds it a little longer. | Add back if idle memory matters |

Already deferred, and recorded as follow-up #8: applying `clear_on_submit`, and rewriting
a bound parameter rather than dropping it.

### Considered and kept

- **Descriptions for rarely used elements.** About 120 lines across 13 modules. The
  generic fallback would name those elements by protobuf field and drop their public
  parameter names, which saves little and breaks the spec's naming rule.
- **Fragments and dialogs.** Kept as PR 6, which can be deferred as described above.
- **Serving full data as Arrow.** The trials depended on it for complete answers about
  filtered tables.
- **The OpenAPI text.** The trials learned the protocol from it alone.
- **The page-change rule and dropping an edited bound parameter.** Both prevent the app
  from running with a value the client did not choose.
- **The unknown-page check on creating calls.** Without it, a typo in `page` lands on the
  default page with a `200`, and an agent answers from the wrong page. One-shot creates
  on a page were the most common pattern in the trials.
- **The `context` field.** About 50 stateless lines, and it is what lets an app that
  formats times answer as it would for a person.
- **The `<noscript>` discovery text.** Static HTML with no runtime cost, and the only text
  a plain fetch of the app's URL sees. Its wording still needs product sign-off.
- **The security rules.** Each closes a specific hole the reviews found.

## Mechanics

- Build each PR as a fresh branch off the previous one, bringing files over from the
  prototype branch, which already has every cut applied except the MCP endpoint. Leave
  `mcp.py`, `data_access.py`, its route, its OpenAPI path, the `unknown_file` and
  `result_too_large` error codes, and the MCP sentence in `index.html`'s
  `<noscript>` text behind. Keep the prototype branch as the reference until PR 6
  merges.
- Each PR description links the spec section it implements and lists the verification
  checks it ported.
- `make check` on each PR, and each PR adds the e2e tests for the behavior it introduces.
