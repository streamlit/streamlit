# Forking the user's session beats JSON replay on fidelity, but cannot fix the token gap

**Author:** Nico Bellante, drafted with Claude · **Date:** 2026-10-09 · **Status:** spike, for review by Lukas Masuch · **Branch:** `spike/agent-session-fork`, based on `feature/agent-api-prototype`

## Decisions I need

- **Land per-request headers for agent sessions now, on their own.** · decider: Lukas · proposal: yes. An agent session reads `st.context.headers` from the request driving each interaction, minus `Cookie` and `Authorization`. That fixes caller's-rights SQL ("Token header not found") without any forking. It is about 30 lines of this branch (`_request_client_context` in `starlette_agent_routes.py`, and `AgentSessionClient.context`).
- **Keep forking out of v1, and consider it as the first follow-up.** · deciders: Lukas and Nico · proposal: yes, on the five conditions under [If we adopt it](#if-we-adopt-it).

## Verdict

**Worth proposing to Lukas as a post-v1 follow-up. Not worth it as the fix for the headers or token gap.**

On the same multi-filter app, a fork reproduced 5 of the 6 things the app prints about its state in about 100 ms with 1 request. JSON replay reproduced 3, one by coincidence, and took 13 requests and about a second. The fork closes the main JSON gaps: state set from code, per-key replay of dependent widgets, uploads, passwords, and dialogs held open by session state. Both miss a dialog opened by a button, and a value the browser has not sent yet.

It does not help the token. A fork copies the browser's WebSocket handshake headers, and SPCS mints the caller's-rights token in those headers once per ingress session. It expires after 120 seconds by default. The fork is a new session, so it rebuilds its session-scoped `snowflake-callers-rights` connection with that copied token, which will usually have expired. On the Cortex path, each `agent:run` gets a fresh ingress token for the same user, so the agent's own request is where the token should come from. I have only read that in the transport code.

## What a fork is

A creating call sends `{"fork_token": "fg_…"}` instead of a page and widget values. The server copies the browser session's server-side state into a new agent session and runs the app once. That state is the session state, uploads, current page, query string, browser context (timezone, locale, theme), and handshake headers. The browser session is only read; the e2e test checks that it neither reruns nor fires a callback.

The browser session mints the grant. It is single-use, lives 120 seconds, and works only for a caller whose trusted identity headers map to the same `st.user` as the browser's.

## Evidence

Measured by `e2e_playwright/agent_session_fork_test.py` against a frontend built from this branch merged with `agent-build-embed-the-user-s`:

| What the app prints | Fork | JSON replay |
|---|---|---|
| Filters, including dependent and keyless selectboxes | Same as browser | Same as browser |
| A value set only from code, a password field's value, an upload | Same as browser | All three lost |
| A widget inside a fragment | Same as browser | Same as browser |
| A dialog the app keeps open through session state | Reopened, with its value | Missing |
| Handshake headers and timezone | The browser's | The agent request's; timezone `None` |
| A sqlite connection, a lock, a generator held in session state | Rebuilt; the generator restarts | Built fresh; matches only by coincidence |
| A session-scoped connection (not counted: a new session always builds its own) | Built with the browser's handshake token | Built with whatever token the agent request sent |
| Requests, wall time | 1, 96 ms | 13, 1,029 ms |

Replay also re-executes the user's callbacks in the agent's session, because setting a value counts as a change: in the test, the price slider's `on_change` ran again. A fork fires none, so a callback that writes somewhere does not write twice.

## What the fork costs

- **A bigger security surface.** The grant gives a copy of everything the session holds. That includes a password the user typed (the snapshot still redacts it, but the app runs with it), the handshake `Cookie` header, and the handshake token. The JSON carries only what is on screen.
- **The grant must reach the agent.** The spike lets the app mint and print it. A real version needs the frontend to fetch it over a new message. Anything in the page is readable by same-origin scripts, including custom components v2, which render in a shadow root of the same document.
- **Identity is only as good as the deployment's.** Without trusted identity headers, every caller's identity is empty, so the grant alone is the credential. That is the default locally and for most self-hosted apps. With `st.login`, the browser's identity comes from a cookie the agent cannot present, so every fork is refused; allowing it would hand the user's OIDC tokens to the agent.
- **The copy blocks the event loop.** It has to be atomic with respect to the browser's runs, so it runs with no `await`. That costs 2 ms for an 80 MB float DataFrame, 112 ms for 100,000 dicts, and 1.26 s for 1,000,000 dicts. Every session on the server waits that long.
- **Memory per fork.** Everything copyable is duplicated: an 80 MB DataFrame costs 80 MB more until the agent session expires.
- **Replica affinity.** The fork request must reach the replica holding the browser session. JSON replay works on any replica.
- **Coupling to runtime internals.** The fork reads `AppSession._session_state`, `_client_state`, `_scriptrunner`, the private fields of `SessionState`, `cache_resource` internals, and `MemoryUploadedFileManager`. The agent API so far drives only public paths.

## If we adopt it

My proposal comes with five conditions:

1. The frontend fetches a grant on demand, only while `server.enableAgentApi` is on. App code never handles it.
2. Refuse forks when the deployment has no trusted identity headers configured.
3. Withhold `Cookie`, `Authorization`, and the caller's-rights token from the copied headers, and use the agent request's own (the first decision above).
4. Cap the copy by size or time, or add a pause on the browser session so the copy can leave the event loop.
5. Route the fork by the browser session's affinity key.

My estimate is 1 to 2 engineer-weeks beyond this spike, mostly items 1 and 4. That excludes a security review, which it needs.

## Open questions

- Does SiS run more than one replica per app, and can a co-browsing client learn the browser session's `X-Snowflake-Affinity-Key`? That is SiS's to answer (`@snowflake-eng/streamlit-object-and-runtime`).
- How often is a real browser session mid-run when a question arrives? A fork then refuses with `source_busy`. Unmeasured; `run_every` fragments make it likelier.

---

# Appendix: full detail

## Where the code is

| File | What it does |
|---|---|
| `lib/streamlit/runtime/agent/fork.py` | Grants (`ForkGrants`), `capture` (refusals, copy, headers, page, context), `install`, `copy_session_state`, the `cache_resource` memo, and upload records |
| `lib/streamlit/runtime/agent/interaction.py` | `fork_token` on a creating call (`_fork`, `_run_fork`); `AgentSessionClient.context`; per-request headers for unforked sessions |
| `lib/streamlit/web/server/starlette/starlette_agent_routes.py` | `_request_client_context`: request headers minus `Cookie` and `Authorization` |
| `lib/streamlit/runtime/agent/protocol.py` | `unknown_fork` (404) and `source_busy` (409) |
| `e2e_playwright/agent_session_fork.py` | Test app: the embedding branch's dashboard plus the cases above, on an `st.navigation` app with two pages |
| `e2e_playwright/agent_session_fork_test.py` | Five scenarios; writes `work-tmp/fork-spike/comparison.json` |
| `lib/tests/streamlit/runtime/agent/fork_test.py` | Twelve unit tests: grant rules, copy semantics, capture refusals |
| `specs/2026-08-28-agent-app-interface/session-fork/bench_copy.py` | Copy cost by session contents |

The OpenAPI document and the MCP tool schema do not describe `fork_token`. It was exercised over the HTTP endpoint only.

## How the copy works

- Every entry of `_old_state`, `_new_session_state`, and unserialized widget values is deep-copied with one shared memo, so two keys that hold one object still hold one object in the fork.
- The memo starts out mapping every global `st.cache_resource` result to itself. Those are shared across sessions by design, so the fork shares them too, even nested inside a copied container. Without this, the test app's cached registry, which holds a lock, would have been dropped.
- An entry `deepcopy` refuses is dropped and reported, never shared, because sharing would put two writers on one object. An app that initializes such a value when missing builds it again; one that assumes it exists raises in the fork.
- Serialized widget values are copied as protos. Widget metadata is immutable and shared; copying it would also deep-copy callback arguments.
- `_key_id_mapper`, `query_params`, the query-bound widget ids, and the persist tracker are copied whole.
- Upload records are immutable and shared by reference, so they cost no memory. Only `MemoryUploadedFileManager` can add a record for another session; with any other manager, the report lists the uploads as dropped.
- The first run sends `get_widget_states()` of the copy, which is what a browser sends with every rerun. The values equal the copied state, so no callback fires.
- The report is returned in the creating call's response as `fork`: entries copied, dropped (by key, with the exception type), shared resources, uploads, header names, and copy time. It names session-state keys, never values.

## What breaks, by category

| Case | Result | Evidence |
|---|---|---|
| sqlite connection, `threading.Lock`, generator | Dropped (`TypeError`), rebuilt by the app; the generator restarts at 0 where the browser's was exhausted | e2e main scenario |
| `st.cache_resource` result in session state | Same object in the fork | e2e and `test_copy_shares_global_cached_resources` |
| Session-scoped `cache_resource` (how `snowflake-callers-rights` is cached) | Not copied: keyed by session id, so the fork builds its own | e2e `RESOURCE` line; `cache_resource_api.py:164-175` |
| Callbacks | None fire, in the fork or in the browser | e2e: `price_changes` stays 1 on both sides |
| Fragments | Reran as part of the fork's full run; fragment widget values carry over | e2e `FRAGMENT` line |
| Dialog opened by `if st.button(...)` | Closed in the fork and its value gone: the press reset when its run finished | `test_fork_cannot_reopen_a_button_opened_dialog` |
| Dialog opened through session state | Reopened with its value | e2e `PINNED` line |
| Non-default page of `st.navigation` | Fork lands on it with its state | `test_fork_follows_the_users_page` |
| Browser mid-run | Refused with `source_busy`; the grant survives for a retry | `test_capture_refuses[mid_run]` |
| A widget with `on_change="ignore"` whose value the browser has not sent | The fork has the last value the server saw; the JSON reports the shown value | Code reading, not tested |
| Form edits the user has not submitted | Missing in both: the server never saw them | Code reading, not tested |
| Value objects whose `__deepcopy__` or `__reduce__` has side effects | Run on the event loop thread during the copy | Not tested |
| Background threads the app starts that write session state | Can race the copy | Not tested |

## Identity and authorization, as built

- A grant is `fg_` plus 32 random URL-safe characters, mapped in process memory to `(session id, user_info, expiry)`. A session holds one live grant; minting another replaces it.
- `check` refuses an unknown or expired grant, and destroys a grant presented under a different identity, so a leaked grant cannot be retried. `consume` spends it only after the copy succeeds, so `source_busy` does not burn it.
- `capture` checks again that the browser session matches the caller's `user_info`, refuses agent sessions (they already have their own handle), and refuses a session whose script runner exists.
- Every refusal reads the same (`unknown_fork`), so a caller learns nothing about which sessions exist or whom they belong to.
- Verified by the e2e grant test: another user's attempt is refused and burns the grant, no identity is refused, a grant works once, an agent session's grant is refused, and a fork combined with `page` is refused.

This is no weaker than the WebSocket reconnect path, which already lets a client that knows a session id and presents the same `user_info` take the session over (`websocket_session_manager.py:143-171`). It is quieter, though: a reconnect disconnects the user's tab, and a fork leaves no trace in it.

## Copy cost

From `bench_copy.py` on an Apple-silicon laptop, median of three runs; memory is the `tracemalloc` peak during the copy:

| Session state holds | Copy time (event loop blocked) | Extra memory |
| --- | ---: | ---: |
| chat history, 200 messages | 0 ms | 0 MB |
| pandas 1M x 10 float64 (80 MB) | 2 ms | 80 MB |
| pandas 1M rows with a str column | 0 ms | 8 MB |
| pyarrow 1M x 10 float64 (80 MB) | 3 ms | 80 MB |
| list of 100k dicts | 112 ms | 28 MB |
| list of 1M dicts | 1262 ms | 275 MB |

- Columnar data copies at memory bandwidth. Python object graphs cost about 1.2 µs per three-field record.
- pandas 3 stores `str` columns as immutable Arrow arrays, and a deep copy shares their buffers: the Arrow memory pool did not grow, and the 8 MB is the int64 column.
- The pyarrow table really is copied: its buffers have new addresses. The copy's memory is visible to `tracemalloc` and not to the Arrow pool, so it appears to go through Python-allocated memory.

## The caller's-rights token

From a read-only research pass over Snowflake docs, GS source (`main` at `1d1891b4ba`), and Jira, on 2026-10-09:

- Lifetime is `SERVICE_CALLER_TOKEN_VALIDITY_SECS`: 120 s by default, up to 7 days, fixed when minted ([docs](https://docs.snowflake.com/en/developer-guide/snowpark-container-services/spcs-execute-sql#configuring-the-login-token-validity); `SnowServicesInternalToken.java:342-363`). It is reusable until then, and a 30-minute-old token fails with 390303 (SNOW-3705875, SNOW-3981886).
- Ingress adds it to every request, but per ingress session, not per request; a browser gets a new one by reloading (SNOW-3705875). The SiS docs say it is "only valid for two minutes and is created at the start of the app session" ([docs](https://docs.snowflake.com/en/developer-guide/streamlit/features/restricted-callers-rights)).
- SiS on the container runtime hard-codes `executeAsCaller: true` (`StreamlitContainerTranspiler.createCapabilities()`).
- On the Cortex orchestrator path, `spcs_transport_factory.go:183-188` exchanges the end user's token for an ingress token on each `agent:run`, so each agent request should carry a fresh token for the end user. This is inferred from code; no end-to-end test was found.
- Inferred: a Snowflake session opened before the token expired keeps working through `client_session_keep_alive`. That is why a browser session's connection survives while a fork's new one would not.

A fork could instead share the browser's open session-scoped connection, which would survive expiry. I do not recommend it: two sessions would then share one Snowflake session, including its `USE ROLE`, `USE WAREHOUSE`, and temp tables, and the browser session's `on_release` would close the connection under the fork.

## Reproduce

```bash
git checkout -b fork-vs-json spike/agent-session-fork
git merge origin/agent-build-embed-the-user-s   # only for the JSON arm
make frontend-fast
git checkout spike/agent-session-fork            # the built frontend stays
make run-e2e-test e2e_playwright/agent_session_fork_test.py
cat work-tmp/fork-spike/comparison.json
uv run pytest lib/tests/streamlit/runtime/agent/fork_test.py
uv run python specs/2026-08-28-agent-app-interface/session-fork/bench_copy.py
```

Without the merge, the e2e suite still passes; it skips the JSON arm and records only the fork.

## Measurement caveats

- In the JSON arm, "built fresh" for the generator matched the browser only by coincidence: thirteen runs exhausted the agent session's own generator too.
- The JSON arm ran with this branch's per-request headers in place, so its session saw the agent request's `User-Agent`. Without them it would see no headers at all.
- The handshake token is a stand-in header set by Playwright; nothing here ran on SPCS.
