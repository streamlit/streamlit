---
author: lukasmasuch
created: 2026-08-28
---

# Agent-accessible Streamlit apps

## Summary

Streamlit already models an application as repeated transitions from typed widget state to
a typed output tree. That makes an app an _executable semantic layer_ over its data
rather than merely a UI over Python — and it is essentially the same observe → act →
observe loop an agent runs. Today that loop is only reachable through a browser.

This spec adds an HTTP operation that lets an agent run a real Streamlit app without a
browser: send JSON widget values, get back the finished app as a typed tree of containers
and elements named after the public `st.*` API, plus the list of things it can do next.
It is a second client of the execution model Streamlit already has, not a new one. An MCP
endpoint and a CLI over the same operation are follow-ups.

v1 is deliberately one operation, and existing apps work without code changes once a
deployment turns it on. One representation then serves several things that have no
shared answer today:

- **Testing:** a coding agent checking the app it just wrote, and semantic snapshots for
  `AppTest` and browser e2e tests.
- **Conversation:** asking an app a question, from an outside assistant or from a chat
  panel inside the app itself.
- **Semantics:** treating an app as a model over data its author already explained.

External tooling can build static HTML export and personalized email reports on the same
observed state.

## Problem

### The product loop breaks in the middle

Agents are becoming a second class of user for internal tools and data products, and
Streamlit already occupies the place they want to be: a Python script that turns data
into an explained, interactive view. But the loop an agent needs to complete has two
missing steps:

```
describe a data question
        ↓
generate a Streamlit app          ← we invest here (skills, templates, examples)
        ↓
verify the app actually works     ← Python-only, or a browser
        ↓
deploy it
        ↓
ask the deployed app a question   ← no supported answer at all
```

An agent that just wrote an app has two ways to check it: `AppTest`, which is in-process,
Python-only, and does not model production behavior; or a headless browser, which is slow
and reads charts as pixels. An agent that wants to _use_ a deployed app has only the
browser option, driving a DOM that is explicitly not a compatibility contract. Both steps
are possible today; neither is effective, and neither is something we support.

So agents work around the app rather than through it: they write a FastAPI service next
to it when they need something callable, and query the warehouse directly when they need
an answer. Both bypass what the app already gets right — its calculations, its filters,
and who is allowed to see what — and rebuild it in a second place that drifts from the
first.

### The app is a semantic view over its data — and that is the differentiator

A good dashboard already answers the questions a data consumer actually has: which
population a filter selects, whether revenue nets out refunds, what units a chart uses,
when the data was last refreshed. That context sits in titles, Markdown, captions,
`label`s, `help` text, and `format` strings — right next to the code that computes the
numbers, written by the person who understands both, and kept current because colleagues
use it daily.

Few places in a data stack combine all of that. A Streamlit app has the data access, the
transformation, the presentation, and the prose in one file, maintained by the person who
understands them.

So if an app explains itself, **the app surface is a semantic view over the underlying
data**, and making that view legible to agents changes what a question costs:

> **"Why did European net revenue fall last quarter?"**
>
> An assistant finds a revenue app, reads that net revenue excludes refunds and is in
> EUR, applies the region and period filters, inspects the breakdown, and answers using
> the app's own calculations — without rediscovering the warehouse schema or re-deriving
> what "net revenue" means in this company. The answer cites the app, page, applied
> filters, and observation time, so it is inspectable rather than merely plausible.

The differentiator is that Streamlit already holds most of the semantics and the execution
model this needs, so it can offer this across existing apps with little author effort,
where a lower-level framework would need each author to describe their app. And it
compounds: agents that write apps embed definitions and units, which makes those apps
better semantic views, which makes agents consuming them more accurate.

Two honest limits. The interface surfaces author-provided meaning; it does not invent
it, so an unexplained table stays unexplained. And choosing _which_ app answers a
question is a catalog problem outside this spec.

### Streamlit's execution model is already agent-shaped

An agent loop is observe → choose an action → observe the result. Streamlit's loop is
widget state → script run → element tree. These are the same loop, and the framework
holds a typed description of both halves plus an explicit boundary between them:

| What an agent needs          | Streamlit's starting point                                                                                         | Typical lower-level web app                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| What can I do right now?     | The current widgets _are_ the action space: type, `label`, `help`, `options`, bounds, `disabled`, form membership. | Meaning is split across DOM, client JS, validation, and a separate API.                       |
| When did my action finish?   | Script and fragment completion are explicit events.                                                                | One click may fan out to several requests and local updates with no shared completion signal. |
| What did I get back?         | Python emitted typed elements, container nesting, Arrow tables, and chart specs _before_ they became pixels.       | Meaning must be reconstructed from HTML, the accessibility tree, or a screenshot.             |
| Where is the business logic? | In the script a human already wrote; agent input enters the same callback and rerun path.                          | Usually duplicated into a second service so an agent can call it.                             |

Conditional rendering makes this better still: `if region == "Europe":` means the widgets
that appear after choosing Europe _are_ the next legal moves, and a form _is_ the
declaration that several inputs constitute one operation. An agent infers neither.

Gradio can flip on `mcp_server=True` because a Gradio app _is_ a typed function. Copying
that model would fight Streamlit, whose legal inputs change after every rerun. The right
interface is the rerun loop itself, published as JSON.

This is an architectural head start, not a claim that apps are pure functions. Session
state, caches, external services, time, and side effects all affect results; a rerun can
trigger further reruns; and some semantics live in the browser. A confusing app still
makes a confusing tool.

### Agents already know the vocabulary

There is a third advantage, and it is the one that is hardest for another framework to
copy: **models already know Streamlit's API surface.** Command names and parameter names
are well represented in training data, which is the same reason agents can write a working
Streamlit app from a one-line prompt.

That means a JSON observation named after the public API needs almost no schema learning.
An agent handed `{"type": "selectbox", "props": {"label": "Region", "options": [...],
"help": "..."}}` already knows what a selectbox is, that `options` enumerates the legal
values, that `help` is explanatory rather than instructive, and that setting it will
trigger a rerun. A bespoke agent schema — however well designed — would have to be
learned from documentation on every model that has not been trained on it.

This turns into a hard design constraint. The representation is only pre-learned if it
stays _rigorously_ aligned with the public namespace: the element `type` is the command
name, `props` keys are the parameter names, and Streamlit's standardized
vocabulary rules apply unchanged — `label` not `title`, `help` not `tooltip`, `key` not
`id`. Every place the interface invents its own name, it spends the
advantage that motivated it. The concrete rules are in [The snapshot](#the-snapshot), and
CI enforcement is a release gate.

### But it is unreachable without a browser

Fetching a Streamlit URL over HTTP returns the app _shell_. All live content and every
interaction travel over `/_stcore/stream` as protobuf `ForwardMsg`/`BackMsg`. There is no
supported structured way to read output or submit input, so an agent has three bad
options:

1. **Drive a browser.** Expensive per turn; dataframes and charts degrade to pixels; it
   depends on Streamlit's private DOM and `st-*` test IDs, which are explicitly not a
   compatibility contract; and it cannot easily complete cookie-based OIDC login.
2. **Reimplement the protocol.** Delta-path merging into four root containers,
   run-scoped stale-node cleanup with fragment ownership, widget codecs across 15
   `WidgetState` value arms, form buffering, navigation, the message hash cache, and
   run-chain synchronization — for something that wanted to set a filter and read a
   number.
3. **Write a second app.** `st.App(routes=...)` supports custom HTTP and MCP endpoints,
   and is the right answer when an author _wants_ a service API. But the agent then talks
   to something the author must write, secure, document, and keep in sync, and the
   thousands of existing dashboards get nothing.

WebSockets are not the problem; the missing piece is a supported semantic contract.
Exposing the raw protobuf protocol would make an internal browser protocol public and
freeze implementation details we need to keep changing.

That contract is already wanted elsewhere. The
[app testing toolkit proposal](https://github.com/streamlit/streamlit/pull/16041) asks
for a compact semantic snapshot and a generated capability registry so `AppTest` stops
falling through to `UnknownElement` — the same representation this interface needs, for
the same reason. Building it once for both is the point.

Long-standing requests confirm the demand:
[#11333](https://github.com/streamlit/streamlit/issues/11333) (MCP server, closed as
"host your own"), [#1135](https://github.com/streamlit/streamlit/issues/1135) (REST
access to a running app), and
[#439](https://github.com/streamlit/streamlit/issues/439) (custom HTTP beside
Streamlit). [VISION.md](https://github.com/streamlit/streamlit/pull/14255) commits to
being agent-native; so far that has meant apps _authored_ by agents. Apps _consumed_ by
agents is the half nobody owns.

### Use cases

1. **Verify an app after editing it.** A coding agent starts the app it just wrote,
   drives the filters, and checks that the metric changed — from any language, against
   the real runtime. This is the use case v1 serves best and the cheapest to ship.
2. **Ask a dashboard a question.** "What was Q3 revenue in Japan?" — set the filters,
   read the metric and table _as data_, using the app's own logic and access controls.
3. **Operate an internal tool.** Fill a Streamlit form (ticket, forecast, SQL runner) on
   a user's behalf, reusing existing callbacks, validation, and auth.
4. **Publish an app as a tool.** Expose a deployed app to an assistant or orchestration
   system without writing a parallel API.
5. **Add a conversational interface to your own app.** An author drops in `st.chat_input`
   and hands the question to an agent that reads the app through this interface, so
   "which region dropped?" is answered from the app's own numbers and definitions. This
   needs nothing beyond v1: the agent runs server-side and calls the app's own endpoint.
   It gets its own session, so it neither sees nor changes what the human is looking
   at, though it can start from the user's filters: the app hands it the user's widget
   values, or the page carries them for assistants that read it
   ([#17394](https://github.com/streamlit/streamlit/pull/17394)), and the agent sends
   them in its first interactions. It does not inherit the asking user's identity
   unless the deployment maps it, which matters in an app with per-user data access.

## Proposal

### v1 is one operation

The whole interface is one executing route, served when `server.enableAgentApi` is on,
plus `GET /_stcore/agent/openapi.json` describing it. See [Enablement](#enablement)
for that setting and where it should end up.

```http
POST /_stcore/agent/interact
Content-Type: application/json
```

Omitting `session_id` creates an isolated session, runs the app, and returns its first
snapshot:

```json
{}
```

Later calls reference keys from the snapshot they just read:

```json
{
  "session_id": "s_7f3a",
  "widget_state": { "region": "Europe" },
  "trigger": { "key": "$$ID-8f2c9a1d4b6e7f30-None" }
}
```

| Field          | Meaning                                                                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session_id`   | Optional opaque handle. Absent means **create**. An unknown or expired handle is an error, never a silent fresh start.                                                                                                  |
| `widget_state` | Optional patch of element keys → JSON values, the same shape as `st.session_state`. Unmentioned widgets keep their current values. This is _not_ arbitrary session state — only currently addressable elements.         |
| `trigger`      | Optional, at most one `{"key": ...}`. Payload-bearing triggers such as `st.chat_input` also carry `"value"`.                                                                                                            |
| `page`         | Optional `url_path` of a page listed in the snapshot's `pages`, resolved by normal navigation. Defaults to the app's default page on creation, the current page otherwise. Never a Python path or internal script hash. |
| `query_params` | Optional replacement mapping of name → list of strings; omission preserves. Parameters bound to a widget follow the rules in [The snapshot](#the-snapshot).                                                            |
| `context`      | Optional `timezone` and `locale`, read by the app as `st.context`. What a browser reports about itself without authentication, so accepting it grants nothing. Held for the session; omission preserves, and a new one replaces it. It never changes how values are encoded. |

**The request blocks until the app settles, and returns its end state.** One interaction
is one client submission, which can cause several script runs through callbacks,
`st.rerun()`, or a page redirect. The response shows the state once they finish, so
output a browser shows only mid-run, such as a spinner or `st.write_stream` arriving
chunk by chunk, never appears, while a toast the run raised does.

**A slow run is collected, not restarted.** If the run outlasts `server.agentWaitTimeout`,
the request returns `202 Accepted` with `wait_timed_out`, and the run keeps going.
Restarting it on retry would be a trap: a script whose uncached first load always
outlasts the timeout could never finish, and a retried click would fire twice. What a
request on that session gets depends on the session's state; other sessions and creating
calls are unaffected:

| Session state                                | A retry: only `session_id`, or the same request again | A different request with the same `session_id` |
| -------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| Idle                                         | Runs                                   | Runs                                        |
| Serving a request                            | `session_busy`                         | `session_busy`                              |
| Running a timed-out interaction              | Waits for it and returns its result    | `session_busy`                              |
| Holding a timed-out interaction's result     | Returns that result at once            | Discards it and runs as a new interaction   |

A result is collected once; after that, the same request is a new interaction. Only
`session_id` is the retry that always works, and the one the timeout message names:
after a creating call, the same request, `{}`, would create another session. A client
that disconnects while waiting, even while its snapshot is being built, is treated as
timed out, so its retry waits for the run and collects it too. A creating call is the
exception: its client left before receiving the `session_id`, so nothing can retry on
that session, and it is closed. Where a browser
interaction would interrupt a running run, v1 answers `session_busy`, because the client
may still come back for the result.

The limits of that guarantee:

- **It covers a run the client stopped waiting for, not a response it lost.** A lost
  final response, or a lost response to a creating call, leaves nothing to collect, so a
  retry is a new interaction. After a lost final response, sending only `session_id`
  reruns the app and re-applies nothing, so a trigger never fires twice. General retry
  idempotency is the `request_id` of follow-up #4.
- **A disconnect only helps if it reaches the server**, and a proxy that keeps the
  upstream connection open hides it. So the wait timeout should stay below the timeouts
  of the clients a deployment expects, such as the 60 seconds MCP clients built on the
  official TypeScript SDK wait by default; then the `202` always arrives first.
- **Collection belongs to the session**: whichever request asks first gets the result. A
  session is meant for one client, and a request never interrupts another that is still
  waiting. Letting a retry take over a wait in flight would cover the proxy case without
  a short timeout, but a second client could then cut off the first, so v1 does not.

**Why `202`, not `504`:** the request was accepted and its run is still going, and
gateways and HTTP client libraries retry 502–504 on their own. A retried creating call
would start another session and another full run, and drop the `session_id` the first
response carried.

**Sessions are reclaimed after `server.agentSessionTTL` of inactivity**, so there is
nothing to close. Inactivity counts from the client's last request or the last run
finishing, whichever is later, so a run that outlasts the timeout gets a full TTL to be
collected. While that run is still going, only requests count: a run that never
finishes, such as one that loops on `st.rerun()`, is reclaimed once its client stops
asking for it, and reclaiming the session stops the run. A client should still reuse
one: every creating call runs the app from the start and holds a session until it idles
out.

**There is no read or delete route.** An `interact` with no changes is an explicit rerun,
apart from collecting a timed-out run. It re-applies nothing, so a trigger never fires
twice, but code that runs on every rerun runs again, as it does for any browser
interaction. Most requests with no changes want exactly that: to re-check an edited
script, close a dialog, or see data that changed outside the app, where a read would
return the old result without saying so. Otherwise nothing changes an agent session
between interactions — `run_every` timers belong to the browser, and no other client
shares the session — so the last snapshot stays current. A client that lost it, such as
a model whose context dropped the result, gets a non-executing read with follow-up #4.

**An agent session is an ordinary Streamlit session with a different client.** The
runtime treats it as one more browser tab, which settles what it shares and what it does
not:

- **Shared with every session in the process:** `st.cache_data`, `st.cache_resource`,
  connections, and module-level state. An agent reads and warms the same caches browser
  users do.
- **Its own:** `st.session_state`, widget values, and the query string, kept across its
  interactions until the session is reclaimed.
- **The script on disk:** an edit takes effect on the session's next interaction, with
  its session state kept, so a coding agent can edit and re-check in one session, or omit
  `session_id` for a clean start. `server.runOnSave` does not apply: an edit never starts
  a run the client did not ask for. As for a browser session, the edit is noticed by the
  file watcher, so with `server.fileWatcherType = "none"` the old script keeps running.
- **From the request:** `st.context.headers` are those of the request that started the
  run, as a browser session's are its WebSocket handshake's, minus `Cookie` and the
  credentials meant for whatever fronts the app (`Authorization`,
  `Proxy-Authorization`). Apps act on headers — identity a proxy set, or the
  short-lived caller's-rights token a Snowflake app connects with — so empty ones would
  make an app behave differently for an agent, or fail. This grants nothing new: any
  client that reaches the WebSocket can send arbitrary handshake headers, so a header
  is only as trustworthy as what the deployment's proxy sets and strips, on both paths.
  `st.user` comes from the trusted identity headers when the deployment maps them, and
  is anonymous otherwise.
- **Absent, because a browser supplies it:** `st.context.cookies` is empty. Cookies are
  the one credential a browser attaches on its own, so reading none keeps a forged
  cross-site request without authority even where `server.corsAllowedOrigins` is
  broad, and agents, being programs, rarely have any. The URL, theme, and embedding
  fields are `None` rather than guessed, and so are timezone and locale unless the
  request states them in `context`, which lets an app that formats times from
  `st.context.timezone` render them as it would for a user.

**Navigation is the one-round-trip parameterization channel.** Widgets
declared with `bind="query-params"` can be set on the creating call, so "run this
parameterized report" is a single request:

```json
{
  "page": "revenue",
  "query_params": { "region": ["Europe"], "quarter": ["2026-Q2"] }
}
```

Neither `widget_state` nor `trigger` is accepted on a creating call, because element keys
only resolve once the app has run. Accepting values that might silently not apply is worse
than requiring a second call.

**A `page` on a creating call is resolved by the runtime, not looked up first.** An
`st.navigation` app has no page list until it has run once, so a lookup would reject a
page that plainly exists, including in the example above. The browser has the same
problem on a cold load and sends the page *name* for the runtime to resolve, and so does
this. The cost is that an unknown page is only detected after the run, so that error
carries the new session's `session_id`. On later calls the page list is known, so an
unknown page is refused before anything runs; a page that exists is never an error, even
when the app then redirects with `st.switch_page`.

### The snapshot

The response is the complete merged tree for the current page plus what is actionable
right now. Naming follows the public API, for the reason above:

- An element's `type` is its **command name** — `selectbox`, `caption`, `expander` — even
  where several commands share one proto and the command has to be recovered. A command
  outside the top-level namespace is spelled by its path from `st`, such as
  `components.v1.html`, and a custom component is typed by the API that declared it
  (`components.v1.declare_component`, `components.v2.component`), with its own name in
  `props.component_name`. The containers `st.columns` and `st.tabs` return are typed
  `column` and `tab`, and a command that only hands its argument to another, such as
  `st.write` or `st.write_stream`, is reported as the command that emitted the element.
- `props` keys are the command's **parameter names**, spelled exactly as a user would
  write them: `label`, `help`, `options`, `format`, `disabled`, `expanded`, `icon`,
  `column_config`. Never a proto field name, never a synonym.
- Anything Streamlit derived rather than the author wrote stays **out of `props`**, so a
  reader never has to guess which keys are real parameters. Tabular and chart elements
  put it in a sibling `data` object — column schema, row and column counts, the
  preview, the artifact URL, a chart's specification as `spec` — named after the `data`
  argument it describes. The exceptions are few, and the coverage test lists each with
  what it is derived from: state a container has no `value` for (a dialog's `is_open`, a
  popover's or tab's `open`), facts read from the object a command was given (an
  exception's `message`, the `doc_string` `st.help` shows), whether an exception went
  uncaught, and the `url` of a media element or an eager download. A parameter Streamlit
  normalized, such as `column_config` with its defaults applied, is still a parameter.
- **Parameter values, read beside the docstring.** A prop is that parameter's value:
  the argument the author passed, or an already processed form of it when that form
  is the clearer description. Dedented and stringified text, and a list materialized
  from an iterable, are processed forms. Which form to use is a case-by-case choice.
  A documented default may be omitted — `unsafe_allow_html` left false, `format=None`,
  `hide_index=None` — because the command's docstring explains the fallback. Include a
  resolved value when leaving it out would hide a choice the docstring does not already
  spell out, such as `disabled`, options, bounds, and `label_visibility`.
- **Omit presentation.** Width, height, gaps, alignment, stretch ratios, padding, border
  or surface styling, a heading's `divider`, a dialog's width, a column's
  share of its row, and a table column's width, pinning, and alignment carry no meaning
  for a non-visual client. Read this strictly. A parameter that changes meaning is
  included, and that rule would otherwise put styling on most nodes of a page. The
  test is whether a property changes what the element *means* or how it can be *used*,
  not whether the author passed it.
- **Omit absent content, at any depth.** Optional content that was never supplied —
  `help`, `icon`, `caption` left as `None` — is left out rather than serialized as null,
  including inside a nested parameter object. That matters most where a helper builds a
  full object per item: an unpruned `column_config` reports `"width": null, "help": null,
  …` for every column. Such a parameter is reported from the mapping Streamlit resolved
  rather than the author's argument, so defaults are applied and the one null that
  *means* something — a `column_config` entry of `None`, which hides that column — has
  already become `{"hidden": true}`. Content may be the processed text, dedented and
  stringified. A null in `st.json`'s body or a custom component's arguments is data
  and stays.
- **An element that would serialize to nothing is left out.** An unfilled `st.empty()`
  placeholder and an `st.space()` say only "there is nothing here", which is what their
  absence says too. A container whose properties were all presentation likewise
  collapses into its child, since the grouping it expressed was visual.

```json
{
  "schema_version": 1,
  "session_id": "s_7f3a",
  "status": "ready",
  "observed_at": "2026-09-06T10:00:00Z",
  "page": {
    "url_path": "",
    "title": "Regional revenue",
    "icon": ":material/payments:"
  },
  "pages": [
    {
      "url_path": "",
      "title": "Regional revenue",
      "icon": ":material/payments:"
    },
    { "url_path": "reports", "title": "Reports" }
  ],
  "query_params": {},
  "tree": {
    "type": "root",
    "children": [
      {
        "type": "main",
        "children": [
          { "type": "title", "props": { "body": "Regional revenue" } },
          {
            "type": "caption",
            "props": {
              "body": "Net revenue excludes refunds. Periods are UTC. Source: finance ledger."
            }
          },
          {
            "type": "selectbox",
            "key": "region",
            "props": {
              "label": "Region",
              "options": ["All", "Europe", "AMER", "APAC"],
              "help": "Customer billing region; All includes every region.",
              "disabled": false,
              "label_visibility": "visible",
              "accept_new_options": false,
              "filter_mode": "fuzzy",
              "required": false,
              "on_change": "rerun"
            },
            "value_schema": { "type": "string" },
            "value": "All"
          },
          {
            "type": "button",
            "key": "$$ID-8f2c9a1d4b6e7f30-None",
            "props": {
              "label": "Refresh data",
              "type": "secondary",
              "disabled": false
            }
          },
          {
            "type": "metric",
            "props": {
              "label": "Net revenue",
              "value": "€1.2M",
              "delta": "+8%",
              "delta_color": "normal",
              "delta_arrow": "auto",
              "label_visibility": "visible"
            }
          },
          {
            "type": "dataframe",
            "props": { "column_config": { "quarter": { "label": "Quarter" } } },
            "data": {
              "columns": [
                { "name": "quarter", "type": "large_string" },
                { "name": "revenue", "type": "int64" }
              ],
              "row_count": 4,
              "column_count": 2,
              "complete": true,
              "preview": {
                "rows": [
                  ["2026-Q1", 284000],
                  ["2026-Q2", 301500],
                  ["2026-Q3", 297250],
                  ["2026-Q4", 318000]
                ]
              },
              "url": "../../media/4f1c8ab27d9e5306"
            }
          },
          {
            "type": "expander",
            "props": {
              "label": "How net revenue is calculated",
              "expanded": false,
              "icon": ":material/info:",
              "type": "default"
            },
            "children": [
              {
                "type": "markdown",
                "props": {
                  "body": "Gross invoiced amounts minus refunds and credit notes, converted to EUR at the invoice-date rate."
                }
              }
            ]
          }
        ]
      },
      { "type": "sidebar", "children": [] },
      { "type": "event", "children": [] },
      { "type": "bottom", "children": [] }
    ]
  },
  "actions": [
    { "key": "region", "kind": "value", "type": "selectbox", "label": "Region" },
    {
      "key": "$$ID-8f2c9a1d4b6e7f30-None",
      "kind": "trigger",
      "type": "button",
      "label": "Refresh data"
    }
  ]
}
```

Three things in that example are worth pointing at: both key forms appear, since `region`
is authored and the button falls back to its element ID; the collapsed expander still
carries its `children`, `label`, and `icon`, which would otherwise be invisible to a
non-browser client; and the dataframe shows the `props`/`data` split, with only
`column_config` above the line. Data representation, including what `data.url` is and is
not, is [its own section](#data-charts-and-media-in-v1), and the selectbox's
`value_schema` is explained in [Actions in v1](#actions-in-v1).

Rules:

- **Structure is preserved.** The four root containers — `main`, `sidebar`, `event`
  (where dialogs open), and `bottom` (a pinned `st.chat_input`) — and every emitted
  container keep their ordered `children`: columns, tabs, expanders, forms, chat
  messages, dialogs. Grouping conveys meaning even without pixel dimensions. Eagerly
  rendered collapsed content is included; hiding it would be a browser fiction. Content
  for a tab that never executed is never invented.
- **Construction versus current state.** `props` is how the element was built; `value` is
  what it holds now. A widget's live value comes from reconciled client state, since
  proto defaults stop being accurate after the first interaction. A parameter that only
  picks the starting value — `index`, a multiselect's `default`, an expander's
  `expanded`, the tab `st.tabs` opens first — is left out wherever the element holds a
  `value`, which says the same thing on the first run. A container without one keeps
  its starting state: a plain expander reports `expanded`, and plain tabs report each
  tab's `open`. Every tab's contents are in the tree regardless of which one a browser
  shows. A display element has no `value`; its content stays in `props`, so an
  `st.metric` number is `props.value`, and `st.json` reports its decoded body rather
  than a JSON string.
- **Reported options and values are the form a request may send back.** For a widget with
  a `format_func`, `st.session_state` holds the author's Python option while the accepted
  wire value is the formatted string, and reporting the authored object would make both
  `options` and `value` unusable as input. Full fidelity is not automatically better here:
  the snapshot's job is to report what the *next request* can say. So
  `st.pills(options=[1, 12], format_func=month_name)` reports `"December"`, not `12`, and
  a client that echoes a value back is always making a legal request, except with a
  label several options share, which identifies none of them. This holds for
  every widget that lists options, `st.select_slider` included. Text typed into a widget
  that accepts new options is reported as typed, since formatting it would change it on
  every round trip. A single-value widget whose selected option is `None` reads back as
  `null`, since the app cannot tell it from an empty widget either; in a list, that
  option keeps its label, as `["None"]`. A display element is never sent back, so it
  reports what the author passed: `st.metric` keeps its number and its `format`, which
  the frontend applies.
- **Pages are identified by `url_path`.** There is no page ID in the public API, and
  `url_path` is the handle `st.Page` already exposes — it is unique, appears in the URL,
  and is auto-derived from the filename when the author does not set it (`""` for the
  default page). The internal page script hash stays internal. A single-page app has one
  page, its script, titled after the file name, so `page` and `pages` are always
  present.
- **There is no app title.** `st.set_page_config(page_title=...)` titles the browser
  tab: the app's name in an app that sets it once, the page's in one that sets it per
  page, and an app that sets none shows `page.title` there. A client could not tell
  which of those it was reading, so v1 reports none; the URL a client called identifies
  the app, and an authored app title is follow-up #2.
- **`query_params` is URL state, reported as the app has it.** The interface holds the
  query string the way a browser holds its address bar: sent with each rerun, and
  replaced when the app changes it. A page change keeps what a browser keeps — embed
  parameters, and a widget-bound one if its widget is on the new page — so a parameter
  one page was opened with, or one the app set through `st.query_params`, does not follow
  the client to the next page. These are URL parameters, not a record of what produced a
  number; widget `value`s are that.

  A widget declared with `bind="query-params"` reports it in `props`, so a client can
  tell which parameter sets it without a trial run. Its parameter follows the runtime's
  rules, as in a browser, with one difference:

  - The widget keeps its value for the session, so `"query_params": {}` clears only
    unbound parameters.
  - A parameter equal to the widget's default is ignored, so `query_params` can move a
    bound widget away from its default but not back; `widget_state` does that.
  - Setting the widget drops its parameter rather than rewriting it, until the app
    writes it back. This is the difference: the runtime reads the address back on every
    rerun, and a stale copy would put the old value back over the edit.
  - A `page` change with `query_params` sets a shared bound widget, such as one in the
    sidebar, to the parameter the request names, as it does without a page change. The
    widget then drops its parameter as a set widget does.
- **A label is not an identifier.** Nothing stops an app from giving two elements the
  same `label` — two `st.metric`s can share one, with one holding a count and the other a
  duration — so a client keying by label silently drops one. Position in the tree, or an
  authored `key` where the element has one, is the identity.
- **The `actions` list is an index that names its entries.** It lists the key of every
  element that can be set (`value`) or fired (`trigger`) right now, with its `type` and
  its `label` when it has one, so a model can see the action space at a glance and tell
  generated keys apart. What to send stays on the element, which a client reads in the
  tree before setting it: `value_schema` for the shape, `props` for the legal values.
  The protocol description says so, since a model that fills a value from the index
  alone guesses its shape. An element without a label, such as `st.feedback` or
  `st.chat_input`, has no `label` in its entry rather than an empty or borrowed one.
  A `disabled` widget, or one with a `support` reason, appears in the tree but not in
  `actions`. Form membership is visible from nesting, and each keyed element in a form
  carries the form's `form_id`.
- **Unsupported things stay visible, on the element itself.** An element that is not
  fully supported carries a `support` field with a machine-readable reason, and absent
  means fully supported. There are two: `browser_required` where what renders may differ
  from what is reported, such as a custom component, and `action_unsupported`
  where a browser user can act on the element and this API only reports that
  action, such as an upload.
  The limit belongs to this API, not to the element, so a later revision can accept the
  action and drop the field. Keeping
  it on the node means an agent never has to cross-reference a summary list to find out
  which element a gap belongs to. A dataframe or chart is fully supported until the app
  enables selections on it or gives a dataframe a button column; then it is
  `action_unsupported`, which marks exactly the element an app's "select a row"
  caption is talking about. Tagging every table would mark gaps a display-only
  element does not have, and teach clients to ignore the field. A container's `support` binds its
  contents: an element inside an undrivable container is not drivable either, and
  repeating the reason onto descendants keeps `actions` from advertising children the
  container itself denies.
- **A described node reports what it is; a gap says so.** An element whose command has no
  description falls back to a node named after its proto field and is listed in a
  response-level `undescribed_types`. That list is what tells a gap from a described
  node, since a proto field can share a command's name, as `dataframe` does. See
  [Key design decisions](#key-design-decisions) for how coverage is checked.
- **It is an observation, not a Python dump.** Callbacks, arbitrary objects, secrets,
  source, caches, and `st.session_state` are absent by construction. A password input's
  value is write-only: it can be set and never comes back, since responses get logged and
  kept in a model's context. Markdown, code, and LaTeX stay source strings.
- **A description publishes nothing the browser does not receive.** A processed
  parameter value is fine. What must not appear is anything the page does not show: a
  secret, a field the proto drops, or the unreduced value behind a rounded one. So
  `st.progress` reports a fraction rounded to the whole percent the browser shows,
  whether the author passed an `int` percent or a `float` fraction.
- **App text is untrusted content.** Labels, help, captions, page titles, and data can
  carry prompt injection. Nearly every string in the document is app-authored, so rather
  than marking them field by field, the protocol description tells clients to treat all
  of it as data, not instructions. Only the envelope — `schema_version`, `session_id`,
  `status`, `observed_at`, and error codes — and the interface's own field names and
  enumerated values, such as `support`, are server-generated.
- **The `status` field reports the run, not the transport.** `ready` means the run chain
  settled, the runtime did not mark the run failed, and the page shows no uncaught
  exception, including one an earlier full run left outside a fragment that reran since.
  Both signals are needed; see [When a run fails](#when-a-run-fails).
- **Versioned, and self-describing.** Additive optional fields are compatible within
  `schema_version: 1`; clients tolerate unknown fields and unknown element types. The
  rest moves with Streamlit: each app serves the OpenAPI document for its own version,
  and the element vocabulary is the API of the Streamlit it runs, so a client that reads
  the description, as a model does on every connection, picks up a change with the
  upgrade. Only a script that hard-codes element types or `props` names relies on the
  additive rule, and authored keys keep its addressing stable. The routes carry no
  version, like Streamlit's other routes: a server speaks the one protocol its
  description documents, and a breaking change would bump `schema_version` and go
  through Streamlit's deprecation cycle rather than a second set of routes. An MCP URL,
  which a person pastes into an AI application once, never has to change.
- **Values are plain JSON, encoded one way everywhere**, as the table below lists. The
  same encoding applies to `value`, `props`, and table rows, and is what a request sends
  back; each element's `value_schema` states its JSON type for that element, with
  `format: date` for dates.

| Python value                        | JSON                                                                                                                       | Example                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `date`                              | ISO 8601 text                                                                                                              | `"2026-10-12"`                                |
| `datetime`, `time`                  | ISO 8601 text, with an offset only when the value has one; a widget's value keeps the widget's precision                  | `"2026-10-12T09:30:00+00:00"`, `"09:30"`      |
| `timedelta`                         | Seconds, which are easier to compute with than ISO durations                                                               | `5400.0`                                      |
| `Decimal`                           | String, to keep its digits                                                                                                 | `"0.10"`                                      |
| NaN, infinity, a missing table cell | `null`                                                                                                                     | `null`                                        |
| `bytes`                             | Its size; the content stays behind `data.url`                                                                              | `{"bytes": 3}`                                |
| `Enum`                              | Its value; as an option, its `format_func` label, like any option object                                                   | `"red"`                                       |
| Set, tuple                          | List                                                                                                                       | `["a", "b"]`                                  |
| Range widget value                  | List, lowest first; a date range may hold fewer than two                                                                   | `[20, 80]`                                    |
| Option object                       | Its `format_func` label                                                                                                    | `"December"`                                  |
| Integer                             | Number, at any size; a JavaScript client rounds one beyond 2^53                                                            | `9223372036854775807`                         |
| Anything else                       | `str(value)`                                                                                                               | `"Point(1, 2)"`                               |

### When a run fails

An uncaught exception is not a transport failure. The script ran, produced output up to
the point it raised, and Streamlit reports the run as _finished successfully_ — the finish
marker describes the runner, not the app. So the response is `200` with `status: "error"`
and a snapshot that is real but incomplete.

Four details matter for an agent reading that snapshot:

- **The tree is truncated at the raise.** Everything below it never executed, and stale
  cleanup removes whatever the previous run had emitted there, so both the tree and
  `actions` shrink. An agent must act on this snapshot rather than reusing the last one.
- **The exception appears in the main container**, not nested where the code happened to
  be running, and its detail follows `client.showErrorDetails` exactly as it would in the
  browser — no more and no less.
- **`status` needs two signals, not one.** Streamlit already tracks whether a run
  completed without errors, but that flag alone is not enough, and neither is looking for
  an error element. An app that installs `st.App(on_script_error=...)` can suppress the
  error display, giving a failed flag and no visible exception; conversely, an exception
  raised inside a fragment-scoped run is rendered into the output while the run still
  reports success. Treat the run as failed when either signal says so.
- **An exception the app displayed on purpose is not a failed run.** `st.exception` is a
  display command, so "is there an exception element?" is the wrong question — an app that
  catches a `ValueError` and renders it deliberately would flip the whole interaction to
  `error`. The two cases are distinguishable because only the runtime's own error
  display applies `client.showErrorDetails` redaction, so the element records whether it
  was uncaught as `props.uncaught`, and only that, of the exception elements, sets
  `status`. A caught-and-displayed
  exception stays in the tree, marked as handled, which is more useful than either
  hiding it or calling the run broken.

Callbacks and external side effects that already ran are not rolled back. The session
stays usable, so an agent can correct its input and interact again.

Every outcome a client has to handle:

| Outcome                                                                              | Response                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid request — an unknown key, a disabled or unsupported element, a value the checks in [Actions in v1](#actions-in-v1) refuse, a missing form submit, a cross-form or cross-dialog batch, fields that cannot go together, such as navigation with widget changes or `widget_state` on a creating call, or text that is not valid Unicode, such as a lone surrogate escape | Error before any execution, naming which of those it was in its `code`; the OpenAPI document lists every code with its HTTP status. Nothing ran and the app is unchanged. |
| Unknown or expired `session_id`, or one created under a different identity           | `unknown_session`; omit `session_id` to start a new one.                                                                                 |
| Refused before the request is read — a disallowed Host or `Origin`, or an oversized body | `host_not_allowed`, `origin_not_allowed`, or `request_too_large`. Nothing ran. |
| A creating call while the server holds `server.agentMaxSessions` sessions | `too_many_sessions`, before anything runs. Checked only when creating a session, so a request on an existing one, including a retry that collects a timed-out run, is never refused for it. |
| Unrecognized `page`                                                                  | On a creating call, an error after the run, carrying the `session_id` of the session it created, which stays usable; on a later call, refused before anything runs. Both list the available `pages` as data. |
| App raised during the run                                                            | `200` with `status: "error"` and the truncated snapshot described above.                                                                 |
| Script failed to compile                                                             | `200` with `status: "error"`, the compile error copied from the page overlay into an uncaught `exception` in `main`, and no actions. `client.showErrorDetails` does not redact it. |
| Another request on the same session is still being served, or a different request arrives while a timed-out run is still going | `session_busy`. One interaction per session at a time, so a client never interrupts its own run by accident. |
| Run outlasted `server.agentWaitTimeout`                                              | `202` with `wait_timed_out`, while the app keeps running; a retry collects the run, as described above.                                   |

### Actions in v1

How elements are addressed:

- **An element's `key` is the author's `key` when set, and otherwise Streamlit's element
  ID.** That is the addressing rule `st.session_state` already uses, so `widget_state`
  reads like session state and introduces no new identity scheme. The two forms cannot
  collide, because keys beginning with the element-ID prefix are reserved. As in
  `st.session_state`, a keyed widget also answers to its element ID, although the
  snapshot reports only the authored key. Every check applies under either name, and
  setting one element under both in a request is refused.
- **A client acts only on keys from the snapshot it just received.** A generated element
  ID is an opaque, session-scoped handle whose format may change, so nothing outside
  Streamlit should construct, parse, or persist one, and since every response is a fresh
  snapshot, a client never needs to. It also changes when the widget's parameters do,
  such as a slider whose bound moved, so a `not_on_page` for a generated key says to
  find the element again in the latest snapshot, by its `label` where that identifies
  one.
- **An authored `key` adds durability for text a human writes.** `{"region": "Europe"}`
  survives runs and releases and reads well in a PR, so authored keys are what make a
  saved request or a verification script survive a redeploy. An agent driving an app
  interactively needs nothing beyond the latest snapshot, and authoring guidance should
  say so in those terms.
- **Identity is not authorization.** Every request is validated so a stale, guessed, or
  forged key cannot set a disabled widget or a control that no longer exists, and an
  invalid request is rejected whole before anything is applied.

**Validation is against the last snapshot, not against live widget state.** The widget
registry is the obvious choice but the wrong one: `WidgetMetadata` survives a page switch
and a collapsed conditional branch, so a validator built on it accepts a key for a control
that is no longer on the page, runs the script, changes nothing, and returns `200`. It
also does not record which `st.form` an element belongs to. The snapshot has both facts,
which is the deeper point: **the snapshot is the contract, so it is what a write is judged
against.** The server keeps, per session, what each element advertised — actionable,
disabled, `support`, form, options, fragment, and whether it is in a dialog — so a
rejection names the actual problem: `disabled_widget` for a disabled control,
`unsupported_element` for one this interface cannot drive, including a keyed display
element, `not_on_page` for an element of this session that is not in the latest
snapshot, or is in it but cannot be used now because its dialog is closed or the page
failed to compile, and `unknown_key` for a key the session never had, such as a typo.
A keyed form, container, or display element registers nothing in the session, so once
it leaves the page its key gets `unknown_key` too. Neither code changes what a client
does next, and such an element cannot be set while it is on the page either.

**Widget constraints are a separate layer, and they belong to the widgets.** Whether a
value is one of a selectbox's `options`, inside a slider's bounds, or a well-formed
`validate` match is not a question about this interface. Today the runtime quietly resets
some violations to the widget's default — an out-of-range number, an unknown option — and
only the frontend checks the rest;
[#16203](https://github.com/streamlit/streamlit/issues/16203) moves them all server-side.
The agent path should call those validators rather than keep its own, provided each
reports the violation and lets the caller decide: the browser path coerces, and the agent
path rejects with `invalid_value`, because a silently reset value reads as success.

**Every element that takes a value carries its JSON Schema, describing shape, not legal
values.** Sending the wrong JSON type is the commonest invalid request, and the element
vocabulary does not say that dates are ISO text or that a range is a two-item list. So
a widget, and a trigger with a payload such as `st.chat_input`, carries a
`value_schema` beside its `value`:

```json
{
  "type": "date_input",
  "key": "period",
  "props": { "label": "Period", "disabled": false },
  "value_schema": {
    "type": "array",
    "items": { "type": "string", "format": "date" },
    "maxItems": 2
  },
  "value": ["2026-01-01", "2026-03-31"]
}
```

- **It describes the form `value` is reported in**, so sending that back always
  matches: option labels as strings, `integer` for a whole-number slider, a format for
  dates, two items for a slider's range, and up to two for a date range, which may be
  empty or hold only its start.
- **It says what to send, not what the server refuses.** The checks below decide what
  is refused; a value they let through that the widget then adjusts shows in the next
  `value`.
- **Legal values stay in `props`.** No `enum` and no bounds: `options`, `min_value`,
  `max_value`, and `max_chars` are already there under the names models know, copying
  an option list would double the largest part of many snapshots, and bounds would make
  the schema stricter than v1, which resets an out-of-range number rather than refusing
  it.
- **`null` is accepted on top of it.** An empty widget reports `null`, and sending
  `null` resets a widget to its default, as the browser does, except where a browser
  user can empty a widget that has one: a single-select `st.segmented_control` or
  `st.pills` that is not `required`, and `st.feedback`, which `null` clears. The
  same flag, `clearable`, is set when the browser can clear back to an empty
  default (`st.selectbox` with `index=None`, and number, date, time, and datetime
  inputs with no initial value). A list-valued widget is cleared with `[]`.
- **Each command declares it, with the rest of its description.** Only the command knows
  for certain whether it holds a range, a whole number, or a date, including while it is
  empty, so an empty `st.feedback` still says `integer`. A few shared building blocks
  keep each declaration to one line, and the coverage test fails for a widget without
  one. A value with a richer shape, such as a dataframe selection once it can be sent,
  is declared the same way.

Until #16203 moves the checks into the widgets, v1 checks three things itself, each
refused with `invalid_value`:

- **The JSON type**, which the element's `value_schema` states:
  - A number is not text except where it names an option, and text is not a number, so
    `st.feedback` takes its index as `1`, not `"1"`; `1.0` counts as `1`.
  - Dates and times are ISO text, even for a slider that carries them as microseconds.
    A date-time or time input and a slider read any ISO 8601 form, a date alone being
    midnight where a date and time is expected. An offset the widget's own values lack
    is refused rather than silently dropped.
  - A list longer than `maxItems`, such as a third date for a range, is refused, since
    the app would get a value it cannot unpack. An element whose `value_schema` is a
    single value reads a one-item list as that value and refuses any other list, which
    it would otherwise read as no value and reset.
- **The options.** A value must be one of the widget's `options`, the most common
  mistake, and the error lists the legal values; a list may hold no more than
  `max_selections`. A widget with `accept_new_options` takes any text instead, as it
  does in the browser, so a number there does not name an option, and a label several
  options share resolves as it does for a browser.
- **That the widget can read it.** Its own deserializer must accept the value, because
  one it cannot read raises in the app's run, and on every later run too.

Everything else shows in the next snapshot's `value`: an out-of-range number, a
malformed `st.date_input` date or color string, or a slider range with too few values
is reset to the default, a fraction sent to an integer `st.number_input` or slider is
truncated, and text past `max_chars` is cut. A reversed slider range is stored as sent,
so a client sends its two values lowest first. A per-key note saying how each value
landed is a potential follow-up.

| Situation                        | v1 behavior                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One widget change                | Set the value, run normal callbacks, rerun.                                                                                                                                                                                                                                                                                                                                                                                   |
| Several widget changes           | One batch, one rerun. A request is one **client-state transition**, not a replay of several human gestures: the patch is validated atomically, merged into the session's current widget state, and handed to the same runtime path the browser uses, which decides what changed and which callbacks run. This skips intermediate observations, so a widget that only appears after its parent changes needs a second request, and one the batch itself removes, such as a field of a mode it switches away from, is gone afterwards along with its value. |
| Form                             | Send that form's fields plus exactly one of its submit triggers. Omitted fields keep current values. Reject fields without a submit, fields from two forms, and unrelated controls in the same call. `clear_on_submit` is not applied; see below.                                                                                                        |
| Trigger                          | At most one per request. Triggers reset and never persist as `true`.                                                                                                                                                                                                                                                                                                                                                          |
| Navigation                       | `page` and `query_params` are a navigation transition and cannot be combined with widget changes.                                                                                                                                                                                                                                                                                                                             |
| Widget inside a fragment         | Interactive, and the rerun is **scoped to that fragment**, as in the browser. A batch spanning regions reruns the whole app, except that an open dialog's widgets are sent on their own. See below.                                                                                                                                                                                                                                                                                                                             |
| Widget with `on_change="ignore"` | Interactive, like any other widget. The mode only tells the browser not to rerun on change; it carries no backend meaning, so the endpoint applies the value and reruns. An agent that wants browser-equivalent deferral batches the value with whatever trigger should cause the rerun.                                                                                                                                      |

**Reruns are scoped the way the browser scopes them:**

- **A widget inside an `st.fragment` reruns that fragment alone.** A dialog body is a
  fragment, which is why a dialog survives interaction inside it and closes on a full
  rerun. So the rule a client learns is the browser's: finish inside a dialog before
  touching anything else.
- **A batch, which a browser never sends, reruns one fragment only if all its keys share
  it**, and requests a normal full rerun otherwise. The exception is an open dialog: a full
  rerun does not call the dialog function, so a `Confirm` click sent together with an
  outside filter would never be read, and the response would look the same whether it ran
  or not. Mixing a dialog's widgets with anything outside it is `cross_dialog_batch`,
  refused before anything runs.
- **The dialog node is the wrapper, not the fragment.** Its own `fragment`, if any, is that
  of the code that opened it; its body, the child container, carries the dialog's. A
  client reads the scope from the node it intends to act on.
- **The overlay is addressable only when `on_dismiss` registered a widget for it**, and
  firing it closes the dialog deliberately. With the default `on_dismiss="ignore"` the
  overlay carries no key, and closing is any full rerun, such as an interaction with no
  changes. The dialog reports `on_dismiss` as `"ignore"` or `"rerun"`, so a client can
  tell which applies.
- **A scoped rerun still returns the whole page, with nothing marked stale.** The rest of
  the tree is as the last run left it, which is where a browser is too: keeping fragments
  coherent is the app's job, and `st.rerun("<key>")` is how one fragment refreshes
  another. Returning only the fragment's subtree would push the delta merge onto every
  client and break `actions`. Nodes carry their `fragment`, so a client knows what a write
  will rerun.

**A headless client inherits the frontend's responsibilities.** Any behavior Streamlit
implements in React rather than in Python is absent for a non-browser client unless the
interface performs it in the browser's place, and v1 does that only where leaving it out
would make the app do something wrong. Two sit on that line today:

- `bind="query-params"`, whose new value the browser writes into its address bar. Left
  alone, the stale address would put the old value back on the next rerun or page, so
  setting a bound widget drops its parameter. Rewriting it the way the browser does would
  make `query_params` complete.
- `clear_on_submit`, whose reset each widget performs in the browser. Fields keep their
  submitted values, which is declared rather than emulated. That can change what a form
  does: a later submit that omits a field resends its old value where a browser would
  send the default, so a client sends every field with each submit.

Doing the rest of either is [follow-up #8](#follow-ups).

**Every action must be treated as consequential.** A selectbox can trigger a database
write just as a button can, so Streamlit does not label any action read-only, idempotent,
or safe, and clients keep their own confirmation policy.

### Data, charts, and media in v1

The goal is a useful observation that does not put a dataset in a model's context window,
without introducing a new authorization surface.

| Output                         | v1 representation                                                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dataframe, table, data editor  | `column_config` in `props`; `data` carries `columns` with their Arrow types, `row_count` and `column_count` when known, `complete`, a bounded typed `preview`, and a `url` serving the full Arrow bytes. Preview rows are values in `columns` order rather than objects, since repeating the column names per row is most of a long preview's size. Values are the data as stored, not as displayed, and an unnamed pandas index stays a column even under `hide_index`, as a column `column_config` hides does. |
| Lazy dataframe                 | The same shape, with the first `server.agentPreviewRows` rows of the chunk already emitted as the preview, `complete: false`, and `unavailable: "lazy_loading"` in place of a `url`: serving the chunk would pass part of the table off as all of it. Fetching row ranges is a follow-up. |
| Chart                          | Public properties in `props`, the native specification inline and whole, with Plotly's theme template dropped and its base64 typed arrays expanded into numbers, and chart data under `data` exactly as a dataframe's. A Vega-Lite chart's data travels as Arrow beside its specification, so it appears once, under `data`. |
| Map                            | The Deck.gl specification the browser renders, under `data` as `spec`, for `st.map` and `st.pydeck_chart` alike. Serving `st.map`'s plotted columns as Arrow, like a dataframe's, is follow-up #9.                                                       |
| Image, audio, video            | Caption, `alt`, the `format` audio and video take, and the media URL the app already exposed to its own client. `st.image` reports them as the author passed the images: single values for one image, parallel lists for several. An `st.pyplot` figure is an image by the time it is emitted and is reported the same way. |
| HTML, iframe, custom component | What the element was given: the `st.html` body, an iframe's `src` (a URL, or inline HTML), the `components.html` markup, a custom component's name and arguments. JavaScript is never executed, so `support: browser_required` marks the elements whose rendering depends on it: custom components, `components.html`, inline iframe HTML, and `st.html` with `unsafe_allow_javascript`. Static HTML is fully readable. A URL iframe reports its `src`; the page it embeds is not observed. `st.pdf` renders through the `streamlit-pdf` custom component and is reported as one. |
| Download                       | Label, `file_name`, `mime` when the author set it, and the existing media URL. `st.download_button` with eager `data` already registers its bytes and carries a `url`, and its click — a rerun or the `on_click` callback — is an ordinary trigger, unless `on_click="ignore"` leaves nothing to fire. Only deferred generation, which carries a file ID instead of a URL, is unsupported. |

**`data.complete` is the field a client branches on, and it always resolves:**

- `complete: true`: the data here is everything.
- `complete: false` with a `url`: the URL serves all of the element's data, never a chunk.
- `complete: false` with `unavailable`: the data could not be served, and why.

It is about row count, not payload size: an eagerly sent 5,000-row table is incomplete
because only its first 100 rows are inlined, so every truncated preview gets a URL, or
an `unavailable` reason saying why it cannot, however small the table is in bytes. The
cap is a row count set high enough that most filtered tables come back complete. **A
preview must never look like the complete answer to an aggregate question**, and nothing
else is truncated either: other large content stays inline in v1, and follow-up #9 moves
it behind a URL.

Charts and maps:

- **A chart given a specification rather than a dataframe is `complete`.**
  `st.plotly_chart` and `st.echarts_chart` carry their values inside the specification,
  so there is no table to serve and a client should stop looking for one. An ECharts
  `dataset.source` dataframe is the exception: it travels as Arrow, so the chart reports
  that table as a Vega-Lite chart over one dataframe does, and several such tables as
  `unavailable: "multiple_datasets"`.
- **Data a Vega-Lite specification loads from a URL is not served.** The browser fetches
  it and this interface does not, so the chart reports `complete: false` with
  `unavailable: "external_url"`, even beside a dataframe, and the URL stays in `spec`.
  Like a chart over several dataframes, it serves none of its data rather than a part
  passed off as the whole.
- **Plotly's theme is dropped, its data is not.** Theme styling is about nine tenths of a
  small figure, so it is dropped and named in `spec_omitted`; content a template adds,
  such as a "DRAFT" annotation, a shape, or an image, is kept, since removing decoration
  must not remove meaning. Title text a template sets for the figure, an axis, or the
  legend is dropped with it in v1; keeping that text is a follow-up. Base64 typed arrays (`bdata`), which a model cannot read, are
  expanded into numbers. Nothing that holds data is dropped at any size: the traces are
  the figure's data. Serving a large specification behind `data.url` is follow-up #9.
- **A map reports the specification its browser renders.** `st.map` compiles the columns
  it plots into a Deck.gl layer, and v1 reports that layer's specification as `spec`, as
  `st.pydeck_chart` does. It carries every plotted point and nothing else from the
  author's table, so the map is `complete`. Serving the plotted columns as Arrow,
  described like a dataframe's, is follow-up #9.

`data.url` and media URLs:

- **They reuse the app's media storage.** Arrow bytes are registered in the existing
  media-file storage and served from the existing `/media/...` endpoint, the
  agent-session half of [#16378](https://github.com/streamlit/streamlit/issues/16378).
  Images, media, and eager downloads already have such a URL, which is forwarded. Every
  one is relative to the request that returned the snapshot, for the reason in
  [Discovery and URLs](#discovery-and-urls).
- **They are fetch-now handles, not durable references.** Media files are
  reference-counted against the sessions that render them and collected once nothing
  does, so a client fetches what it needs while working with the snapshot, and never
  stores, shares, or re-resolves a URL.
- **They are bearer handles, not user authorization**, exactly as every image, video, and
  eager download is today, and a download button already serves arbitrary app data this
  way, so a table behind one is not a new class of exposure. Anyone holding a URL can
  fetch the file while it resolves; a file ID is a content hash, unguessable only to
  someone who does not know the content. Identical bytes share one URL across sessions,
  and in an app with per-user data, a user who learns another user's URL can fetch it
  while it is rendered. Both are how media storage works for every client today, and
  outside this interface.
- **They are bounded by `server.maxMessageSize`** (200 MB by default) per element, the
  bound on the messages the app sends its browser, so an agent is served no more than the
  app could send; anything larger is `unavailable: "too_large_to_serve"` rather than
  registered.
  The session also keeps the page's messages so a fragment rerun can return the whole
  page, which the same limit, the session cap, and the idle TTL bound. Keeping only the
  summaries a snapshot reads is a potential follow-up if profiling asks for it.

### What v1 does not support

This is the complete list; the sections linked from it have the details. Where a gap
belongs to an element, the element declares it, so an agent can explain the gap or fall
back to a browser rather than mistake it for missing content:

| Not in v1                                                                  | Behavior                                                                                                                                                                      |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rendering that depends on JavaScript                                       | Custom components, `components.html`, inline iframe HTML, and `st.html` with scripts allowed report their source or arguments with `support: browser_required`, because what renders may differ from it, and cannot be driven. See [Data, charts, and media](#data-charts-and-media-in-v1). |
| `st.file_uploader`, `st.camera_input`, `st.audio_input`                    | Interactive in the app. `support: action_unsupported`: this API reports the widget and cannot deliver the captured bytes.                                                                |
| `st.chat_input` attachments                                                | Text only. `accept_file` and `accept_audio` are reported, but a request cannot attach files or audio.                                                                         |
| `st.data_editor` edits, dataframe and chart selections, dataframe button columns | `support: action_unsupported`: the app can edit or select, and this API only reports that. On every data editor, and on a dataframe or chart only when the app enabled selections or added a button column. A display-only table or chart has no `support` field. |
| Deferred downloads                                                         | `support: action_unsupported`: the browser generates the file on click, and this API has no URL to report until then. An eager download is fully supported.                       |
| Lazy dataframe continuation                                                | `complete: false` with `unavailable: "lazy_loading"`; the preview is the first `server.agentPreviewRows` rows of the loaded chunk.                                            |
| Data too large to hold a second copy of                                    | Over `server.maxMessageSize` per element, `data.unavailable: too_large_to_serve` instead of a `url`. See [Limits and configuration](#limits-and-configuration).              |
| Chart data that is not one table                                           | A layered or concatenated Altair chart over several dataframes, or a Vega-Lite specification that loads data from a URL, reports its `spec` with `data.unavailable` (`multiple_datasets` or `external_url`) and serves none of the data, rather than part of it claimed as `complete`. |
| Sources Streamlit collects only part of                                    | A table, chart, or map over a Snowpark, PySpark, Dask, or Modin DataFrame, a DuckDB relation, a database cursor, or another unevaluated source gets only its first 10,000 rows, or 100 in `st.table`, in the browser and in `data` alike. `data` reports those rows as the whole source: its `row_count`, `complete`, and `url` cover only them, and the "Showing only … rows" caption, a separate element, is the only sign of the cut. Lazily loading these sources, and reporting the cut where they still get one, are follow-ups. |
| `run_every` fragment refresh                                               | Nothing refreshes until the client interacts again: the clock is the browser's, and background reruns on the server would be worse. The interval is not reported, since it would not change when a caller reruns and mostly invites a polling loop. |
| `clear_on_submit`                                                          | Reported as authored and not applied — the reset is implemented in the browser. Fields keep their submitted values, so empty fields are not a submit signal, and a later submit that omits a field resends its old value: send every field with each submit. Follow-up #8. |
| Validation only the browser performs                                       | `required` and `validate` are reported but not enforced, so an agent can submit an empty required field that a browser would block. A test that relies on them proves less than it appears to. [#16203](https://github.com/streamlit/streamlit/issues/16203) moves them server-side. |
| Options that share a label                                                 | A value whose `format_func` label several options share is refused with `invalid_value` rather than resolved to one of them, so those options cannot be selected. A widget that accepts new options reads it as typed text and resolves it as it does for a browser. |
| `bind="query-params"` write-back                                           | Setting a bound widget drops its parameter from `query_params` instead of rewriting it, until the app writes it back. See [Actions in v1](#actions-in-v1); follow-up #8.      |
| Browser-supplied context (`st.context`, `st.user`)                         | `st.context.headers` are the request's, minus `Cookie`, `Authorization`, and `Proxy-Authorization`; cookies are empty, and the other fields are `None` except the timezone and locale a request states in `context`, and the offset derived from that timezone. `st.user` comes only from trusted identity headers, so an app behind `st.login` shows its signed-out state; see [Enablement](#enablement). |
| Elements replayed from a cache a browser filled                            | An element an `st.cache_data` function emitted is replayed from the cache on later runs. If a browser session filled the entry, no description was recorded, so the element is reported by its proto field and listed in `undescribed_types`, and a table's rows beyond the preview are `unavailable: "undescribed"`. A chart, a map, or a lazily loaded table reports no `data` then, since its command builds that while describing itself. |
| Output shown while a run is in progress                                    | Only the end state is reported: an `st.spinner` never appears, and `st.write_stream` output arrives as the finished text rather than chunk by chunk. A toast the run raised does appear. See [v1 is one operation](#v1-is-one-operation). |
| Reading without running, polling                                           | Every `interact` runs the script, apart from a retry that collects a timed-out run, which returns no partial results; one with no changes is an explicit rerun, and the last snapshot stays current until the client acts. Follow-up #4 adds a read and an operation handle. |

### Limits and configuration

Every bound v1 applies, in one place. All agent API options are public, so operators
can tune them; the defaults are what v1 ships. The wait timeout bounds how long one
request waits, not how long the run may take, so it sits below clients' own timeouts
rather than growing to fit the slowest app. The preview size's default is meant to be
right; the setting is there for operators and tests rather than for tuning per app.

| Limit                                  | Default                                               | Set by                                                                        |
| -------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| Whether the API is served              | Off                                                   | `server.enableAgentApi`                                                       |
| How long one request waits for its run | 30 s, then `wait_timed_out`; a retry keeps waiting; a client that disconnects ends the wait at once | `server.agentWaitTimeout`                         |
| Idle time before a session is reclaimed | 15 min                                                | `server.agentSessionTTL`                                                      |
| Agent sessions held at once            | 100, then `too_many_sessions`                         | `server.agentMaxSessions`                                                     |
| Interactions in flight per session     | 1, then `session_busy`                                | Fixed                                                                         |
| Request body                           | 25 MB, then `request_too_large`; the bound on a message a browser sends | `server.maxWidgetStateSize`                                 |
| Preview rows per table                 | 100                                                   | `server.agentPreviewRows`                                                     |
| Data served behind `data.url`          | 200 MB per element, then `too_large_to_serve`         | `server.maxMessageSize`, shared with the WebSocket                            |
| Chart specification                    | No cap; the theme template is dropped                 | Fixed; follow-up #9 serves large ones behind `data.url`                       |
| Response size                          | No cap                                                | Follow-up #9                                                                  |
| `data.url` lifetime                    | At least while the element that produced it is still rendered | Fixed; a fetch-now handle, never persisted                            |
| Who may call                           | The WebSocket's Host allow-list; no web page unless its origin is listed | `server.allowedHosts`, `server.corsAllowedOrigins`              |
| Who the caller is                      | Anonymous                                             | `server.trustedUserHeaders`                                                   |
| Error detail in a failed run           | As in the browser                                     | `client.showErrorDetails`                                                     |
| Where the routes live                  | `/_stcore/agent/…`                                    | `server.baseUrlPath`                                                          |
| Where a session lives                  | One server process. Behind several replicas, requests need sticky routing, which a load balancer cannot derive from the `session_id` in the JSON body, so without it a later call gets `unknown_session` | The deployment; follow-up #1 |

### Security

This is a new programmatic execution surface and needs an explicit review.

- **Off by default in v1, on by default as the goal.** Upgrading Streamlit should not open
  a new executing route until the concerns in [Enablement](#enablement) are settled;
  after that, the default flips. Either way the route applies the WebSocket's Host allow-list and
  identity mapping, and serves any program that can reach the app; only a web page from
  an origin the operator did not list is refused.
- **Validate semantically, then serialize.** Never accept a raw `BackMsg`, delta path,
  fragment ID, or `WidgetState` protobuf. A generated element ID is accepted only as an
  opaque `key` read from the latest snapshot, and checked against it exactly as an
  authored key is. Reject stale, disabled, removed, wrong-type, cross-form,
  cross-dialog, and oversized requests atomically, before any callback runs — against
  the last snapshot rather than live widget state, for the reasons in
  [Actions in v1](#actions-in-v1). Widget constraints are enforced mostly in
  the browser today ([#16203](https://github.com/streamlit/streamlit/issues/16203)). That
  gap predates this interface and is reachable by anyone scripting the WebSocket, so this
  interface neither creates nor widens it, and the fix belongs in the widgets, where both
  paths share it. Meanwhile the guidance for authors is unchanged: a widget's range or
  option list is a UI affordance, not an access control, so anything that actually
  matters belongs in app code.
- **Preserve the existing output boundary.** Expose only content already emitted to this
  session's client, with the same error redaction. No secrets, session state, Python
  values, local paths, or source.
- **Bound everything.** v1 bounds in-flight interactions per session, sessions, request
  bytes, preview rows, served data, and the wait for a run; see
  [Limits and configuration](#limits-and-configuration). Compact responses (follow-up
  #9) and request rate limits are among the gates on default-on.

The security concerns that stand between opt-in and on-by-default, including why the
route reads no cookie and refuses web pages, are one list, in [Enablement](#enablement),
rather than a second one here.

### Enablement

```toml
# .streamlit/config.toml
[server]
enableAgentApi = true
```

One setting covers both `streamlit run app.py` and `st.App`, and respects
`server.baseUrlPath`. There is no `st.App(agent=...)` object: whether non-browser clients
can reach an app is a deployment property, not app behavior.

**The intended end state is on by default, with a deployment or platform opt-out.** The
governing invariant is that a caller gets **no more authority and no more information than
the equivalent browser client**. Given that, an app whose agent API is off is not
meaningfully more private than one whose agent API is on — it is just harder to use.
Streamlit is open source and the WebSocket protocol is automatable, increasingly so by the
very agents this serves, so neither obscurity nor implementation difficulty is a security
boundary worth defending. Meanwhile, requiring every author to find and flip a flag would
forfeit the installed base of existing apps, which is most of the value here.

**So v1 is opt-in, and once on it is served wherever the app is.** Restricting the route
more than the app would contradict that invariant: anyone who can reach the app's
WebSocket can already drive it. What v1 does instead is close the few ways this route
differs from the WebSocket. What is genuinely new is not capability but _practicality_,
and handling that is what stands between opt-in and on-by-default:

| Concern               | Why it is new                                                                                                                                                                                         | In v1                                                                                                                                                                                                                                                      | Before default-on                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Bulk data access      | A dataframe becomes typed data rather than a scrolled viewport, and its full Arrow bytes are one request away. The same data the app already sent its client, far easier to take.                  | Preview and artifact-size budgets, and URLs protected like all media: a content hash that stops resolving once nothing renders it.                                                                                                                        | Compact responses (follow-up #9), and a per-session budget for data served behind `data.url`, which each session otherwise holds for its TTL. |
| Request volume        | An agent loops faster than a human clicks, and an agent session outlives the request that created it, where a WebSocket session ends with its connection.                                           | `server.agentMaxSessions`, one in-flight interaction per session, and the idle TTL.                                                                                                                                                                        | Request rate limits, and per-caller session quotas, so one anonymous client cannot hold every slot. |
| Cross-origin requests | A page on another site can make a visitor's browser send a request to any app that browser can reach, including, through DNS rebinding, an app on the visitor's own machine. | No cookie is read, and any request carrying an `Origin` not listed in `server.corsAllowedOrigins` is refused. A same-origin rule would not stop rebinding, since a rebound page is same-origin with the `Host` it sends, but browsers send `Origin` on every POST and programmatic clients send none, so this refuses web pages without turning away an agent. No browser caller loses anything: the route sends no CORS headers, so no other origin could read a response. Listing an origin therefore only admits callers that CORS does not restrict, such as a page on the app's own origin or a browser extension; a page on another listed origin is still stopped by the browser, because the route requires a page's request to be JSON, which makes the browser send a preflight the route refuses. | —                                                                                                  |
| Identity              | Nothing changes for a public app, where a browser viewer is equally anonymous. The gap is an authenticated app whose identity mapping is skipped, so per-user branches silently take the anonymous path. | The WebSocket's trusted identity headers (`server.trustedUserHeaders`) map into `st.user`, the request's headers reach `st.context.headers` as the handshake's do, and a session only answers requests carrying the identity that created it: the `st.user` those trusted headers map, never other headers, such as a short-lived caller's-rights token, which are refreshed with each run instead. The `st.login` cookie is not read: the WebSocket honors it only behind an XSRF token. A deployment that enables the API has to apply its header policy to `/_stcore/agent/` too: a proxy that strips client-supplied identity headers only on the WebSocket path lets a caller claim any identity here, in `st.user` and in the headers an app reads. | Agent sign-in for `st.login` apps (follow-up #10). |

That keeps the decision reversible. An app opts in, deployments that authenticate every
path — an auth proxy, a private Community Cloud app, SiS — gate the route exactly as they
gate the app, and flipping the default later is its own reviewed change.

### Discovery and URLs

**Discovery is part of the feature, not documentation around it.** "Point an agent at an
app and ask it a question" only works if fetching the app's URL says the interface exists.
The served `index.html` carries no app content: its only readable text is *"You need to
enable JavaScript to run this app."*, which is all an HTML-to-text extraction keeps. So it
also says that the app can be read and driven as JSON over HTTP, that this is the
recommended way to use it without a browser, and where to start, with a machine-readable
`<link rel="service-desc">` ([RFC 8631](https://www.rfc-editor.org/rfc/rfc8631)).

- **The hint is unconditional, and the endpoint answers.** The HTML stays a plain,
  cacheable file that needs no change when the API is turned on, and the link is never a
  dead end: the schema route is registered even with the API off and reports `available`
  or `disabled`, the disabled document omitting the exact Streamlit version. Without that
  route, the path would fall through to the app's own HTML with a `200`, a failure that
  reads as success.
- **Discovery is not capability.** Most agent harnesses' web tools only send GET requests,
  so an agent can find the protocol and still be unable to `POST` to it. That needs a
  general HTTP tool, or the MCP endpoint in follow-up #6.
- **Discovery is the one part that needs the hosting platform.** On Community Cloud the
  public URL serves the platform's own page, the app's `index.html` sits behind `/~/+/`,
  and the platform strips `Link: rel="service-desc"` headers, which is why the document is
  self-describing rather than relying on the header. Until the platform carries the hint
  or routes the agent paths to the app, discovery there works only for a client told the
  prefix.

**Every URL the API hands out is relative to the request that returned it.** A hosted app
cannot always tell where it is: Community Cloud strips its `/~/+/` prefix and terminates
TLS without saying so, so the app sees `http://example.streamlit.app/_stcore/...` for a
request to `https://example.streamlit.app/~/+/_stcore/...`, and any URL built from that
points at the platform. The URL the client called is the one base that is always right.
So the OpenAPI `servers` entry, resolved against the document's own URL, is `../..`,
with one more `..` per segment of `server.baseUrlPath`, which the documented paths
include. Every `data.url` and media URL is relative to the request, such as
`../../media/<id>`: ordinary URL joining climbs out of `_stcore/agent/` to the app's
root, whatever prefix sits in front. The `index.html` links, and the MCP endpoint
of follow-up #6, use the same form.

## Key design decisions

**JSON, not Markdown.** A Markdown projection reads nicely but loses identity, nesting,
typed values, and constraints — so it needs a JSON sidecar for the action contract
anyway, leaving two long-lived formats and a dialect nobody else renders. JSON is
unambiguous, cheap to validate, and models read it fine. A prose projection can be
derived from the same tree later if measurements justify it.

**One executing operation, not a REST resource model.** Open, set, submit, navigate, and
rerun are all the same thing in Streamlit: send client state, run, observe. Modeling them
as separate verbs adds surface without adding capability.

**Sessions from the first release, with `session_id` merely optional.** Widget identity,
defaults, and constraints only exist after a run, so a stateless "set these widgets in
one shot" call either fails on conditional widgets or secretly performs a warm-up run.
Omitting `session_id` to create one keeps the single-request case simple without
pretending identities exist before execution.

**Reuse existing identities rather than minting new ones.** Author `key`s and element IDs
already address widgets — and are what `st.session_state` is keyed by — while `url_path`
already identifies pages, so the interface exposes those instead of a parallel scheme. A
freshly invented scheme — positional indices, say — would need its own definition and
edge cases (is the counter scoped per page or per container? what happens when a fragment
re-emits?) to buy nothing. Opaque revision-scoped handles sound safer, but safety comes
from server-side validation against the last snapshot, which is required either way.

**No `fragment_id` in the request.** The server derives the scope from the chosen action,
as the browser does — `Delta.fragment_id` already tags every emitted delta with its owning
fragment, and `ClientState.fragment_id` already carries the scope into the rerun — so no
new public or proto field is needed. Letting a client name a scope would only enable
inconsistent requests. The work this implies is recording the id per node and pruning the
merged tree per fragment, not identity plumbing, and a client never has to know what a
fragment is to benefit from one.

**Prune the accumulated tree when a run finishes, not when one starts.** The server's
outgoing queue is cleared at the start of a run, so mirroring that seems right —
but the thing being maintained here is the browser's *element tree*, which accumulates
deltas as they arrive and prunes when a run *finishes*, scoped to what that run owned. The
difference shows up on an interrupted run: a callback that calls `st.rerun(scope="fragment")`
aborts the full run before it emits anything, so clearing at the start throws away the
whole app and leaves a snapshot containing only the fragment.

**No agent-aware app branching.** An `st.context.is_agent` signal invites apps to fork
behavior by audience, which fragments the app and undermines the property that makes this
work: one app, one set of explanations, two clients.

**Each command describes itself where it fills its proto, not in a central serializer.**
The obvious design is one registry that maps each proto variant to a description, and it
cannot work: a proto is a *rendering* contract, so by the time a serializer sees one, the
semantics are already gone. Three examples of what cannot be recovered downstream: a
built-in chart's `x` and `y` survive only as compiled Vega
encodings; a selection widget's `options` are the `format_func`-formatted strings, with
the authored objects no longer present; `st.metric` has formatted its number into a
display string. Several commands also share one proto, so the command name itself has to
be recovered by inspecting fields, which is a heuristic that silently rots when a new
command reuses an existing proto: `st.mermaid_chart` enqueues markdown, so a serializer
reading the proto reports it as `st.markdown`.

Building the description in the element function costs one JSON object per element, built
only for sessions the agent API created, so a browser session builds and sends nothing.
With no agent session connected, deciding that is one empty-set check per element; once
one exists, it is one script-context lookup per element on every session.
It rides to the serializer on the emitted message's metadata, so an element replayed from
an `st.cache_data` result carries the description recorded when the entry was filled —
which also means an entry a browser session filled has none to replay.

The cost is honest: the description lives next to each command instead of in one file, so
adding a command or a parameter means adding a line there. In exchange, the description
reads like the command's own signature and stays next to the code that would change it.

**Coverage is checked by running every command, not by inspecting protos.** A description
exists only along the code path that emits it, so nothing static can see that `st.badge`
and `st.caption` both produce markdown, or that a command wrote the wrong name. A unit test
runs each command's existing element mock with recording on and checks what it reported
against the command's signature in both directions: every `props` key is a parameter or a
documented derived addition, and every parameter is reported or listed as omitted with a
reason. It also requires a `value_schema` on every element that takes a value.
Streamlit already requires a mock for every public command, so a new command or
parameter fails CI until someone decides what an agent sees. The test proves the paths the
mocks exercise, not every branch; `undescribed_types` reports a gap it misses to clients
at runtime. Generating the names from `gather_metrics`, which already wraps every command,
is a potential follow-up if hand-written descriptions drift despite the test.

**These descriptions are the one definition of each element, for other consumers too.**
The [app testing toolkit proposal](https://github.com/streamlit/streamlit/pull/16041)'s
`AppTest.snapshot()`, its capability registry replacing silent `UnknownElement` gaps, and
a semantic facade for browser tests all need the same per-element answers. They should
read these descriptions rather than derive their own, because parallel definitions
disagree within a release.

## Follow-ups

Each of these is additive to the v1 contract. They are numbered for reference rather
than ranked, and say where one builds on another.

1. **On by default.** Agent sign-in for `st.login` apps (follow-up #10), the
   response and rate budgets and per-caller quotas that make bulk access and request
   volume safe, per-platform routing, and session affinity for multi-worker deployments
   — then flip the default for all of Streamlit at once, with `server.enableAgentApi`
   as the opt-out. Brings use cases 2–4 to apps whose authors never opted in.
2. **Authored descriptions** — a standalone project worth doing on its own accessibility
   merits. Element-level alternative text has landed
   ([#8563](https://github.com/streamlit/streamlit/issues/8563)): `alt` exists on
   images, `st.pyplot`, tables, dataframes, the data editor, charts, maps, Mermaid and
   Graphviz diagrams, audio, video, and iframes, and the snapshot reports it as
   `props.alt` — exactly the author-written meaning this interface exists to surface.
   What remains is the app and page level, for the snapshot to report: static
   `app_title`/`app_description` on `st.App`, the one reliable source of an app title;
   `page_description` on `st.set_page_config` and optionally `st.Page`
   ([#16878](https://github.com/streamlit/streamlit/issues/16878)); and `help` on media
   ([#3133](https://github.com/streamlit/streamlit/issues/3133)).
3. **Lazy continuation.** Range reads for lazy dataframes, reusing the existing chunk
   machinery and its limits rather than building a query API.
4. **Long-run handling and recovery.** An operation handle in the `202` a timed-out run
   returns, an opt-in read that returns the session's latest result without executing
   code, and `DELETE` to close early. A request with no changes stays a rerun, since
   most such requests want one. The read matters most for model clients: their context
   management drops or moves older tool results, and without it the only way back to
   the current state is a rerun, which can repeat side effects. Exposed through MCP
   too, it lets `get_data` serve that result's files again. v1 already makes the common
   timeout case safe — a retry after `wait_timed_out` collects the run instead of
   repeating it — so what remains is general: optional `request_id` for retry
   idempotency beyond timeouts, including a lost response to a creating call,
   `expected_revision` to reject actions based on a stale observation, for callers that
   batch or parallelize, and letting a new action replace a run still going after
   `wait_timed_out`, as a browser interaction would.
5. **CLI.** `streamlit agent interact <url> --json @request.json` over the same routes, as
   a debugging and verification convenience. An agent with shell access can already curl
   the endpoint, which is why this is not v1.
6. **MCP endpoint.** One more route on the Streamlit server,
   `/_stcore/agent/mcp`, so an app can be added to an AI application by its URL. One
   fixed `interact` tool, with dynamic actions in its _result_. Per-widget tools are not
   an option: `tools/list` "MUST NOT vary per-connection or as a side effect of other
   requests on the connection"
   ([MCP tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)),
   and the specification's own guidance for this shape is the opaque-handle pattern
   `session_id` already implements. `interact` must never be annotated read-only. A
   second, read-only `get_data` tool serves the files a result references, tables as
   pages of rows, because chat clients cannot resolve or parse a `data.url`. Each tool
   call takes the same path as an `interact` request, so its HTTP request's headers
   supply `st.user` and `st.context.headers` in the same way. It is written by hand
   rather than on the MCP SDK, which keeps it free of new dependencies. It speaks the
   `initialize`-handshake revisions the common clients support, and adds `2026-07-28`,
   whose stateless model `session_id` already follows, once they default to it. MCP is
   how most AI applications connect to tools, so this belongs in the same release cycle
   as v1 if possible, together with #9.
7. **Static app descriptor.** An authenticated route returning app title, description,
   and protocol capabilities _without_ executing app code, so an agent can choose among
   available apps. It depends on the authored `st.App` title/description in follow-up #2
   ([#16878](https://github.com/streamlit/streamlit/issues/16878)). It must never publish
   widget schemas or user-dependent page lists from a shared warm-up run.
8. **Remaining interaction coverage.** Dataframe and chart selections first, because
   "select a row for details" and "click a bar to inspect" are how many dashboards
   drill down, so without them an agent stops short of the detail views.
   Dataframe row and column selection is the smaller, most common case, and its state is
   already a JSON value the runtime validates; chart selections, whose point identity is
   library-specific, follow. Each declares its `value_schema` as every widget does, with
   the object shape its selection has. Then uploads, including
   `st.chat_input` attachments; `st.data_editor` edits; dataframe button columns;
   deferred downloads; and the
   browser's half of forms and bound parameters — applying `clear_on_submit` and
   rewriting a bound parameter when its widget is set.
9. **Compact responses.** Large content moves to media storage, the pattern tables
   already use, instead of staying inline: an oversized figure specification, option
   list, or text body — a long Markdown document, or its raw copy in a collapsed
   expander — is served behind a URL, readable through `get_data`, with the start of
   it, `truncated: true`, and its full length or option count in the snapshot.
   `st.map`'s plotted columns are served as Arrow, as a dataframe's table is. Table
   previews get a byte budget beside the row cap, since a few long strings or nested
   values can make 100 rows enormous, and a request can ask for fewer preview rows; the
   preview then says `complete: false`, as it does past the row cap. Nothing that holds
   data or a legal value is truncated without saying so, and keyed widgets stay inline
   wherever they are. A page of a few Plotly charts can reach a megabyte per response,
   a 10,000-option selectbox adds about 80 KB to every call on its page, and a long
   Markdown document shown twice can pass half a megabyte. Through MCP every one of
   those bytes lands in a model's context, and a response over a client's tool-result
   limit is lost to the model, which makes this, with #6, the first follow-up to take
   after v1. A cheap first step is to leave Plotly's base64 `bdata` arrays unexpanded
   above a size threshold, which keeps every value, though not in a form a model reads.
10. **Agent sign-in for `st.login` apps.** In v1 an app that uses `st.login` shows
    agents its signed-out state: its identity is a signed cookie the browser gets at
    the end of the OAuth/OIDC redirect, which an agent cannot present. Every other
    source of identity already works, including trusted headers from an
    authenticating proxy or platform. The expected default for a tool that needs a
    login is MCP's authorization flow, which ChatGPT and Claude already offer for
    connectors: the server is an OAuth resource server that names an authorization
    server, and the client runs the sign-in once in a browser and sends a bearer
    token with every call. For Streamlit that means accepting a token from the
    provider `st.login` is configured with and mapping its claims into `st.user`
    exactly as `st.login` does, fronting the provider as a thin OAuth proxy where it
    cannot register MCP clients itself. The HTTP API accepts the same token. App-issued
    API keys are what to avoid: they would be a second identity system.

Smaller potential follow-ups and alternatives considered:

- **Values:** a per-key note on how each sent value landed, including a key the batch
  itself removed; refusing values that do not match `value_schema` — a fraction for a
  whole number, a malformed date, a too-short or reversed range — rather than letting
  the widget adjust them; widget constraints checked server-side
  ([#16203](https://github.com/streamlit/streamlit/issues/16203)); the limits a widget
  enforces that cost a few bytes also stated in `value_schema` under the standard
  keywords (`maxLength` from `max_chars`, `minimum` and `maximum` from the bounds,
  `maxItems` from `max_selections`), but never `enum`, which would copy an option list
  `props` already carries, so a client that generates input from the schema stays
  within them, best together with #16203 so the server refuses what the schema rules
  out; and integers beyond
  ±(2^53−1) as decimal strings, which JavaScript clients otherwise round.
- **Data:** running queries over a large table on the server instead of paging it to
  the model; recommending dataframe-backed charts for apps agents read; serving each
  dataset of a layered chart under `data.datasets`, with its own columns, preview, and
  URL, instead of `unavailable: multiple_datasets`; dropping an unnamed pandas index
  under `hide_index`, so `__index_level_0__` is not a meaningless extra column;
  reporting a media element's URL as `data.url`, as a table's is; describing `st.pdf`
  as media rather than as the custom component it renders through; letting `get_data`
  read the files of the last few results rather than only the latest; an HTTP route for
  `get_data`, for HTTP clients without an Arrow reader that need rows beyond the
  preview; keeping only summaries in the session's message buffer; and lazily loading
  unevaluated sources in `st.dataframe` instead of collecting their first 10,000 rows
  ([#17707](https://github.com/streamlit/streamlit/issues/17707)), so `data` reports
  the source's true row count with `unavailable: "lazy_loading"`, as for any lazy table,
  while `st.table`, charts, and `st.map`, which would still cut the source, report the
  cut with a new reason such as `truncated_source`.
- **Sessions:** starting an agent session from a browser session's state, from widget
  values the page carries
  ([#17394](https://github.com/streamlit/streamlit/pull/17394)) or a fork that also
  copies code-only state and uploads
  ([#17401](https://github.com/streamlit/streamlit/pull/17401)); cookies from requests
  without an `Origin` header, which browsers always send on a `POST`, so only a program
  that set them on purpose supplies them; and accepting the `session_id` as a request
  header too, which a load balancer can route on.
- **Implementation:** generating descriptions at the public API boundary instead of per
  command, building the snapshot's values on the script thread, recording descriptions
  when a browser session fills an `st.cache_data` entry while the API is enabled, one
  headless client shared by `AppTest` and this interface, and a browser-versus-agent
  fidelity harness covering every command.
- **Testing:** layout facts such as `st.columns` weights, for a coding agent checking its
  own layout, which an e2e testing API would likely serve better than the snapshot.
- **Operations:** usage metrics, which an agent session cannot report itself because
  Streamlit's usage stats are reported by the browser (proposed in
  [Agent API usage metrics](../2026-10-28-agent-api-usage-metrics/tech-spec.md): the
  server counts agent activity, and browser page profiles carry the counts); and an
  audit log of interactions without content: a digest of the session handle, the
  request fields used, the outcome, and the latency, never the handle, labels, values,
  or data.

## Beyond the app surface

Everything above is bounded by what the app already showed its own client. That boundary
is what makes the interface safe to turn on for existing apps without asking anyone's
permission, and it is also its ceiling: an agent can only answer a question the app was
already built to answer. If a dashboard filters to one region and never explains what
"net revenue" excludes, the interface faithfully reports a number nobody can interpret.

Two different things get conflated when people ask to go further, and only one of them is
actually a new exposure:

- **Transmitted but not displayed.** A column hidden through `column_config`, the rows
  behind a truncated preview, the full Arrow buffer behind a chart — all of this was
  already sent to this client, and the browser could read it. Surfacing it is a
  completeness question inside the existing boundary, not a new decision. v1 already
  serves the full Arrow bytes for exactly this reason, and other cases here are fair game.
- **Never transmitted.** The source table a dataframe was derived from, the rows a filter
  excluded, the columns a query never selected, other entries in a cache. None of this
  reached the client, so exposing it grants an agent access the app's own UI does not
  grant. Whether that is acceptable depends entirely on who is asking and what the
  deployment's data-access rules are — which is a question only the developer can answer,
  never something the framework should infer.

So the second category cannot be automatic. It needs an explicit, opt-in way for an author
to say "this data is available to agents," and a few shapes are worth exploring:

- Marking selected `@st.cache_data` functions as agent-callable, since they are already
  named, typed, and deterministic units of data access.
- An `st.data` command or decorator that publishes a dataset or a semantic view — with its
  definitions and units — independently of whether the app renders it.
- An `st.tool` decorator for domain operations and context that no widget represents.

The honest cost is adoption. Any of these requires a new API, documentation, and authors
choosing to use it, so the payoff arrives over quarters rather than in a release. That is
precisely the argument for not blocking v1 on it: the already-exposed surface works for
every app that exists today, while a declared surface only works for apps that opt in.
Both are worth having, in that order.

One reason to think a declared surface pays for itself twice: a dataset an author marks as
available is exactly what a built-in interactive data explorer in the Streamlit UI would
need. The same declaration could serve agents and give humans a first-class way to browse
and pivot the data behind an app — which is a better justification for the API than
agent access alone.

## Success criteria

v1 ships when:

- Every command that emits an element or container describes itself under its public
  name, and the coverage test holds each description to the command's signature.
- JSON encodings are pinned, each with a codec test fixture, for dates, datetimes,
  decimals, large integers, non-finite numbers, ranges, nulls, and object-valued options,
  including options that share a label.
- Whatever the snapshot reports as the value of an element in `actions` can be sent
  straight back, except a label several options share, and matches its
  `value_schema` unless it is `null`.
- A filtered dashboard, a form with two submit buttons, a chat flow, and a multi-turn
  dialog all complete without a browser, through Streamlit's production execution path,
  and conformance tests show each matches an equivalent browser session on callback
  order, resulting widget values, and emitted output, outside the deviations
  [What v1 does not support](#what-v1-does-not-support) lists.
- Large dataframes produce bounded snapshots and a fetchable `data.url`.
- With `enableAgentApi` unset, no agent route executes anything, and the schema route
  only reports that the API is disabled.

## Out of scope

- A Streamlit-hosted agent, LLM-generated summaries, or a natural-language endpoint.
- A global app catalog or an agent authorization product.
- Access to arbitrary Python callables, source, caches, or `st.session_state`. Exposing
  specific data or functions an author has explicitly marked is a separate, opt-in
  direction — see [Beyond the app surface](#beyond-the-app-surface).
- Attaching to or taking over a human's live browser session.
- A Markdown dialect, standalone semantic renderer, or a second observation format.
- Built-in scheduling, email delivery, report templates, or standalone HTML export.
  External agents can build these on the same snapshot.
- Author-declared domain tools (`@st.tool`) as a *substitute* for driving widgets. A form
  already provides a typed operation boundary, and authors who need a stable service
  contract should keep using `st.App(routes=...)`. Where such a decorator would genuinely
  add something — operations and data no widget represents — is
  [Beyond the app surface](#beyond-the-app-surface).
- Executing custom-component or iframe JavaScript in the backend.
- Replacing visual, keyboard, accessibility, or custom-component browser testing.

## Checklist

| Item                       | ✅ or comment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ⚠️ Opt-in, and served wherever the app is once on, behind the platform's own authentication. An app that reads the platform's request headers, such as a SiS caller's-rights token, gets each request's. An app behind `st.login` is anonymous to agents until agent sign-in lands (follow-up #10). Multi-worker deployments need session affinity, since an agent session lives in one process. Serving behind a hosting prefix that the proxy strips, as Community Cloud does, needs nothing from the platform, because every URL the API hands out is relative to the request. Discovery does: the public URL serves the platform's page rather than the app's, so the platform has to carry the hint. |
| No breaking API changes    | ✅ Additive: `server.enableAgentApi`, off in v1, its budget options, new routes under `/_stcore/agent/`, and the discovery hint in `index.html`. No `st.*` signature changes. One behavior is sharper: an `st.context` field the client never sent reads as `None` rather than an empty default. Browser apps never see it, because the frontend always sends every field, and an explicitly sent `0` or `False` is kept, since the fields track presence. Flipping the default later is itself a reviewed change, not a silent one. |
| No new dependencies        | ✅ Existing Starlette and JSON. The follow-up MCP endpoint needs none either, since it is written by hand rather than on the MCP SDK.                                                                                                                                                                                                                                                                                                                                                                                          |
| Metrics collected          | Not in v1. Streamlit's usage stats are reported by the browser, which an agent session does not have, so agent usage needs a channel of its own; see the operations item in the smaller follow-ups.                                                                                                                                                                                                                                                                                                         |
| Any security/legal impact? | ⚠️ Significant, and the main review risk. New execution surface: off by default in v1 with on-by-default as the goal, open to any program that can reach the app once on but refusing unlisted web origins, every interaction validated server-side, no session-state or secret exposure. The interface is an alternate encoding of what the browser protocol already exposes, so the review question is bulk-access practicality, request volume, and identity mapping — the gates on making it opt-out. App content is untrusted input to the calling agent, so no action may be annotated safe. |
| Any docs changes needed?   | Protocol reference and coverage matrix, an authoring guide ("write `key=`, explain the app in the app"), verification guidance next to `AppTest` and Playwright, and a security/deployment page.                                                                                                                                                                                                                                                                                                              |
| Any other risks?           | The snapshot is a compatibility surface for scripts that hard-code it; it carries `schema_version` and changes additively within it, while clients that read the served description pick up changes with each Streamlit release. Adoption risk: if it stays experimental too long, the ecosystem standardizes on browser automation instead.                                                                                                                                                                                                                                                               |
