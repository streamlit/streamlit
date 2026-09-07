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

This spec adds an HTTP operation that lets an agent run a real Streamlit app without
one: send JSON widget values, get back the finished app as a typed tree of containers
and elements named after the public `st.*` API, plus the list of things it can do next.
It is a second client of the execution model Streamlit already has, not a new one.

v1 is deliberately one endpoint, and existing apps work with no code changes. One
representation then serves a range of things that have no shared answer today:
interactive app testing, and semantic snapshots for both `AppTest` and browser e2e tests;
talking to your app, whether from an outside assistant or a chat panel inside the app
itself; treating apps as semantic models over data someone already explained. External
tooling can build on the same observed app state for static HTML export and personalized
email reports.

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

So an agent that generates a Streamlit app has a reason to leave right after the first
draft — to FastAPI when it needs a callable interface, to raw SQL when it needs an
answer, to screenshots when it needs to check its own work. Every one of those exits
takes the app's logic, filters, and access controls with it.

### The app is a semantic view over its data — and that is the differentiator

A good dashboard already answers the questions a data consumer actually has: which
population a filter selects, whether revenue nets out refunds, what units a chart uses,
when the data was last refreshed. That context sits in titles, Markdown, captions,
`label`s, `help` text, and `format` strings — right next to the code that computes the
numbers, written by the person who understands both, and kept current because colleagues
use it daily.

Almost nothing else in a data stack has that property. A warehouse has schemas without
definitions. A BI tool has definitions locked inside a proprietary semantic layer. A
notebook has explanation but no live, trusted surface. A Streamlit app has the data
access, the transformation, the presentation, and the prose in one file.

So if an app explains itself, **the app surface is a semantic view over the underlying
data**, and making that view legible to agents changes what a question costs:

> **"Why did European net revenue fall last quarter?"**
>
> An assistant finds a revenue app, reads that net revenue excludes refunds and is in
> EUR, applies the region and period filters, inspects the breakdown, and answers using
> the app's own calculations — without rediscovering the warehouse schema or re-deriving
> what "net revenue" means in this company. The answer cites the app, page, applied
> filters, and observation time, so it is inspectable rather than merely plausible.

This is a differentiator a lower-level framework cannot copy by adding an endpoint,
because it does not hold the semantics in the first place. And it compounds: agents that
write apps embed definitions and units, which makes those apps better semantic views,
which makes agents consuming them more accurate.

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
   needs nothing beyond v1, since the agent runs server-side and calls loopback. Two
   caveats: it gets its own session, so it reports rather than changing what the human is
   looking at; and it does not inherit the asking user's identity unless the deployment
   maps it, which matters in an app with per-user data access.
6. **Fall back deliberately.** Detect a browser-only element and hand off to browser
   automation instead of silently returning incomplete output.

## Proposal

### v1 is one operation

The whole interface is one route, served when `server.enableAgentApi` is on. See
[Enablement](#enablement) for that setting and where it should end up.

```http
POST /_stcore/agent/v1/interact
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
| `query_params` | Optional replacement mapping of name → list of strings. `{}` clears; omission preserves.                                                                                                                                |

The request blocks until the run chain settles, then returns the snapshot. An accepted
interaction may cause more than one script run through callbacks, `st.rerun()`, or a page
redirect; "one interaction" means one client submission, not one execution. If the run
exceeds `server.agentRunTimeout`, the response is an explicit `run_timed_out` error —
v1 has no partial or streaming result.

Sessions are reclaimed after `server.agentSessionTTL` of inactivity, so there is nothing
to close. There is no separate read or delete route in v1, and no passive way to re-read
the last result: **an `interact` with no changes is an explicit rerun, not a read.** It
executes the script again and can repeat side effects exactly as any other Streamlit
rerun does. A non-executing read arrives with the polling work in follow-up #5.

**Navigation is the one-round-trip parameterization channel.** Widgets
declared with `bind="query-params"` can be set on the creating call, so "run this
parameterized report" is a single request:

```json
{
  "page": "revenue",
  "query_params": { "region": ["Europe"], "quarter": ["2026-Q2"] }
}
```

`widget_state` is not accepted on a creating call, because element keys only resolve once
the app has run. Accepting values that might silently not apply is worse than requiring
a second call.

### The snapshot

The response is the complete merged tree for the current page plus what is actionable
right now. Naming follows the public API, for the reason above:

- An element's `type` is its **command name** — `selectbox`, `caption`, `expander` — even
  where several commands share one proto and the command has to be recovered.
- `props` keys are the command's **parameter names**, spelled exactly as a user would
  write them: `label`, `help`, `options`, `format`, `disabled`, `expanded`, `icon`,
  `column_config`. Never a proto field name, never a synonym.
- Anything Streamlit derived rather than the author wrote stays **out of `props`**, so a
  reader never has to guess which keys are real parameters. Tabular and chart elements
  put it in a sibling `data` object — column schema, row and column counts, the
  preview, the artifact URL — named after the `data` argument it describes.
- **Effective values, not just authored ones.** Include every public property that
  affects an element's meaning or how it can be interacted with, after backend-known
  defaults are resolved — `disabled: false`, `required: false`, `expanded: false`, the
  effective button `type`, `label_visibility`, selection mode, options, bounds, and step. A client should
  not have to know each command's defaults for each Streamlit version to read the
  document, and "absent" should never be ambiguous between false, unsupported, and
  overlooked.
- **Omit geometry and absent content.** Width, height, gaps, alignment, stretch ratios,
  padding, and border or surface styling carry no meaning for a non-visual client.
  Optional content that was never supplied — `help`, `icon`, `caption` left as `None` —
  is omitted rather than serialized as null.

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
            "key": "region",
            "type": "selectbox",
            "props": {
              "label": "Region",
              "options": ["All", "Europe", "AMER", "APAC"],
              "help": "Customer billing region; All includes every region.",
              "disabled": false
            },
            "value": "All"
          },
          {
            "key": "$$ID-8f2c9a1d4b6e7f30-None",
            "type": "button",
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
              "delta": "+8%"
            }
          },
          {
            "type": "dataframe",
            "props": { "column_config": { "month": { "label": "Month" } } },
            "data": {
              "columns": [
                { "name": "month", "type": "string" },
                { "name": "revenue", "type": "number" }
              ],
              "row_count": 24,
              "column_count": 2,
              "preview": {
                "truncated": true,
                "rows": [{ "month": "2026-01", "revenue": 120000 }]
              },
              "url": "/media/4f1c8ab27d9e5306.arrow"
            }
          },
          {
            "type": "expander",
            "props": {
              "label": "How net revenue is calculated",
              "icon": ":material/info:",
              "expanded": false
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
    { "key": "region", "kind": "value" },
    { "key": "$$ID-8f2c9a1d4b6e7f30-None", "kind": "trigger" }
  ],
  "limitations": []
}
```

The two keys show both forms: `region` comes from `key="region"` on the selectbox, while
the keyless button falls back to its element ID. The expander shows a container — its
`children` are present even though it is collapsed, and its `label` and `icon` carry
author-written context that would otherwise be invisible to a non-browser client.

The dataframe shows the split between authored configuration and derived facts: `props`
carries only `column_config`, which the author wrote, while everything Streamlit worked
out about the dataset sits under `data`. That is also the two-tier pattern for data —
enough inline to reason about the table without a second request, plus `data.url` for the
full Arrow bytes when exact values matter. That URL is a fetch-now handle and must not be
persisted; see [Data, charts, and media in v1](#data-charts-and-media-in-v1).

Rules:

- **Structure is preserved.** All four root containers and every emitted container keep
  their ordered `children` — columns, tabs, expanders, forms, chat messages, dialogs —
  because grouping conveys meaning even without pixel dimensions. Blocks that render no
  DOM node are elided, and a layout container with one child and no configured
  properties collapses into it. Eagerly rendered collapsed content is included; hiding it
  would be a browser fiction. Content for a tab that never executed is never invented.
- **Construction versus current state.** `props` is how the element was built; `value` is
  what it holds now. A widget's live value comes from
  reconciled client state, since proto defaults stop being accurate after the first
  interaction.
- **Pages are identified by `url_path`.** There is no page ID in the public API, and
  `url_path` is the handle `st.Page` already exposes — it is unique, appears in the URL,
  and is auto-derived from the filename when the author does not set it (`""` for the
  default page). The internal page script hash stays internal.
- **The `actions` list is an index, not a duplicate.** It lists the key of every element that
  can be set (`value`) or fired (`trigger`) right now, so a model can see the action space
  at a glance; type and constraints are read from the element in the tree. A `disabled`
  widget appears in the tree but not in `actions`. Form membership is visible from
  nesting.
- **Unsupported things stay visible.** Every element declares whether it is inspectable,
  interactive, or browser-required, and unsupported interactions appear in `limitations`
  with a machine-readable reason. CI asserts that every `Element` and `Block` variant has
  a declaration, so nothing silently degrades to a placeholder.
- **It is an observation, not a Python dump.** Callbacks, arbitrary objects, secrets,
  source, caches, and `st.session_state` are absent by construction. Password values are
  write-only. Markdown, code, and LaTeX stay source strings.
- **App text is untrusted content.** Labels, help, captions, and data can carry prompt
  injection. The response marks app-authored content as such; server-generated fields are
  a separate trust domain.
- **The `status` field reports the run, not the transport.** `ready` means the run chain
  settled and the app did not raise. See [When a run fails](#when-a-run-fails).
- **Versioned.** Additive optional fields are compatible within `schema_version: 1`;
  clients tolerate unknown fields and unknown element types.

### When a run fails

An uncaught exception is not a transport failure. The script ran, produced output up to
the point it raised, and Streamlit reports the run as _finished successfully_ — the finish
marker describes the runner, not the app. So the response is `200` with `status: "error"`
and a snapshot that is real but incomplete.

Three details matter for an agent reading that snapshot:

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

Callbacks and external side effects that already ran are not rolled back. The session
stays usable, so an agent can correct its input and interact again.

| Outcome                                                                              | Response                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid request — unknown key, disabled widget, out-of-range value, cross-form batch | Error before any execution. Nothing ran and the app is unchanged.                                                                        |
| App raised during the run                                                            | `200` with `status: "error"` and the truncated snapshot described above.                                                                 |
| Script failed to compile                                                             | `status: "error"` with the compile error and no usable action list.                                                                      |
| Run exceeded `server.agentRunTimeout`                                                | `run_timed_out`. Whether app code is still finishing is not knowable from the response, so the session may stay busy briefly afterwards. |

### Actions in v1

An element's `key` is the author's `key` when one was set, and otherwise Streamlit's
internal element ID. That is deliberately the same addressing rule `st.session_state`
uses, so `widget_state` reads like the session state an agent already knows how to write.
It also introduces no new identity scheme: the element ID is already unique, already registered
during the run, and already the identity on `WidgetState.id`. The two forms cannot
collide, because keys beginning with the element-ID prefix are reserved.

The compatibility contract is deliberately narrow:

- An **authored `key`** is the stable, readable identity. Authors should set it and
  clients should prefer it; it survives runs and releases.
- A **generated element ID** is an opaque, session-scoped handle. Clients read it from
  the latest snapshot and must not construct, parse, interpret, hardcode, or persist it.
- Its string format is **not** a public contract and may change. Nothing outside
  Streamlit should depend on the `$$ID-<hash>-None` shape.

That is workable because every response is a fresh snapshot, so an agent always acts on
keys it just read.

An authored key is worth having anyway: `{"region": "Europe"}` is readable in a
verification script and reviewable in a PR, where
`{"$$ID-8f2c...-None": "Europe"}` is not. Documentation should say plainly that
**setting `key=` is what makes an app a good tool.**

Identity is not authorization. Every request is validated against the current session's
live element state, so a stale, guessed, or forged key cannot set a disabled widget, an
out-of-range value, or a control that no longer exists. Validation rejects the whole
request before anything is applied.

| Situation                        | v1 behavior                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One widget change                | Set the value, run normal callbacks, rerun.                                                                                                                                                                                                                                                                                                                                                                                   |
| Several widget changes           | One batch, one rerun. A request is one **client-state transition**, not a replay of several human gestures: the patch is validated atomically, merged into the session's current widget state, and handed to the same runtime path the browser uses, which decides what changed and which callbacks run. This skips intermediate observations, so a widget that only appears after its parent changes needs a second request. |
| Form                             | Send that form's fields plus exactly one of its submit triggers. Omitted fields keep current values. Reject fields without a submit, fields from two forms, and unrelated controls in the same call. `clear_on_submit` discards the form's mirrored values after submit, so the next snapshot shows declared defaults.                                                                                                        |
| Trigger                          | At most one per request. Triggers reset and never persist as `true`.                                                                                                                                                                                                                                                                                                                                                          |
| Navigation                       | `page` and `query_params` are a navigation transition and cannot be combined with widget changes.                                                                                                                                                                                                                                                                                                                             |
| Widget inside a fragment         | Interactive, but v1 always performs a **full** rerun and reports the widened scope. See below.                                                                                                                                                                                                                                                                                                                                |
| Widget with `on_change="ignore"` | Interactive, like any other widget. The mode only tells the browser not to rerun on change; it carries no backend meaning, so the endpoint applies the value and reruns. An agent that wants browser-equivalent deferral batches the value with whatever trigger should cause the rerun.                                                                                                                                      |

**v1 always reruns the whole script.** A widget inside `st.fragment` is still
interactive, because a full rerun produces a correct app state and this covers apps that
scope work into fragments for performance. It is not identical to a browser session,
though: the outer script re-executes, so any content that exists only because a trigger
fired during the previous run is not re-emitted. The response reports the widened scope
so an agent is never guessing.

**Dialogs are the exception and stay non-interactive in v1.** A dialog block
is only emitted when the code path calls the dialog function, and the canonical pattern
gates that on a button. Since trigger values reset, a full rerun does not re-emit the
dialog and it closes — a broken interaction rather than a slower one. Fragment-scoped
reruns (follow-up #2) make dialogs interactive.

Actions do not carry a JSON Schema in v1. The element's `type` plus its constraint
properties (`options`, `min_value`, `max_value`) already tell a model what to send, and
the server validates regardless.

**Every action must be treated as consequential.** A selectbox can trigger a database
write just as a button can, so Streamlit does not label any action read-only, idempotent,
or safe, and clients keep their own confirmation policy.

### Data, charts, and media in v1

The goal is a useful observation that does not put a dataset in a model's context window,
without introducing a new authorization surface.

| Output                         | v1 representation                                                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dataframe, table, data editor  | `column_config` in `props`; `data` carries `columns` with logical types, `row_count` and `column_count` when known, a bounded typed `preview` marked `truncated`, and a `url` serving the full Arrow bytes.                                                |
| Lazy dataframe                 | The same shape, with the chunk already emitted as the preview and `complete: false`. `data.url` serves that chunk; fetching further ranges is a follow-up.                                                                                                 |
| Chart                          | Public properties in `props`, the native specification inline when it fits the size budget and behind `data.url` otherwise, and chart data under `data` exactly as a dataframe's.                                                                          |
| Image, audio, video, PDF       | Caption, MIME type, and the existing `/media/...` URL the app already exposed to its own client.                                                                                                                                                           |
| HTML, iframe, custom component | Type, safe metadata, and a `browser_required` limitation. Component JavaScript is never executed.                                                                                                                                                          |
| Download                       | Label, file metadata, and the existing media URL. `st.download_button` with eager `data` already registers its bytes and carries a `url`, so it needs nothing new; only deferred generation (which carries a file ID instead of a URL) requires an action. |

Arrow bytes and oversized chart specifications are registered in the existing media-file
storage and served from the existing `/media/...` endpoint, which is the agent-session
half of [#16378](https://github.com/streamlit/streamlit/issues/16378). Images, media, and
eager download buttons already have such a URL because the app registered it for the
browser, so those are simply forwarded.

**Media URLs are fetch-now handles, not durable references.** A client fetches what it
needs while working with the snapshot that produced the URL, and must not store, share, or
re-resolve it later. Two reasons that contract matters:

- **It is what the implementation can actually promise.** Media files are reference-counted
  against active sessions and collected once nothing holds them, so a URL from an earlier
  snapshot may already be gone. v1 pins whatever the returned snapshot references for a
  bounded lease so the response is usable, and nothing beyond that.
- **It keeps remote enablement non-breaking.** Today's file IDs are content hashes, which
  makes a URL an unexpiring bearer token: fine for an image an app chose to display, and a
  poor fit for a full dataset inside a JSON document that gets logged, retained in a model's
  context, and forwarded between tools. Remote enablement replaces these with
  principal-scoped or expiring links. Because clients were never allowed to persist a URL,
  that tightening changes guarantees rather than shape.

Note what content-hash IDs do _not_ imply: an identical URL means identical bytes, so this
is not a confidentiality hole between sessions of one app, and storage belongs to the
server's single runtime instance, so it does not span app processes.

Serving full data has a cost worth bounding, since storage is in memory and the bytes are
retained separately from the emitted message: v1 caps what it will externalize and reports
an oversized artifact as a limitation rather than registering it.

Truncation is always explicit. **A preview must never look like the complete answer to
an aggregate question.** If the structural document itself cannot fit the response
budget, the request fails rather than truncating silently.

### What v1 does not support

Each of these is _declared_ in the snapshot, never silently missing, so an agent can
explain the gap or fall back to a browser:

| Not in v1                                               | Behavior                                                                                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fragment-scoped reruns                                  | Every interaction is a full rerun, with the widened scope reported. Widgets in fragments still work; `st.dialog` contents do not and are declared non-interactive. |
| `st.file_uploader`, `st.camera_input`, `st.audio_input` | Inspectable, not interactive.                                                                                                                                      |
| `st.data_editor` edits, dataframe and chart selections  | Read-only.                                                                                                                                                         |
| Deferred downloads and download callbacks               | Not triggerable. Eager downloads expose their existing URL.                                                                                                        |
| `run_every` fragments                                   | Initial run works; background timers are inactive and reported as a limitation.                                                                                    |
| Long-running interactions                               | No polling or partial results; the request either settles or returns `run_timed_out`.                                                                              |

### Security

This is a new programmatic execution surface and needs an explicit review.

- **Conservatively gated in v1.** Upgrading Streamlit must not open a new API, and the
  first release cannot be reached from another host. See [Enablement](#enablement).
- **Validate semantically, then serialize.** Never accept a raw `BackMsg`, element ID,
  delta path, fragment ID, or `WidgetState` protobuf. Reject stale, disabled, removed,
  out-of-range, cross-form, and oversized requests atomically, before any callback runs.
  Note that this makes the agent path _stricter_ than the WebSocket path, where several
  constraints are still only browser-enforced
  ([#16203](https://github.com/streamlit/streamlit/issues/16203)). That gap is
  pre-existing and already reachable by anyone scripting the WebSocket, so this interface
  neither creates nor widens it, and closing it is not a prerequisite. It is still worth
  investing in: two validation implementations will drift, and the per-element validators
  defined here are the natural foundation for doing it runtime-wide. Meanwhile the
  guidance for authors is unchanged — a widget's range or option list is a UI affordance,
  not an access control, so anything that actually matters belongs in app code.
- **Preserve the existing output boundary.** Expose only content already emitted to this
  session's client, with the same error redaction. No secrets, session state, Python
  values, local paths, or source.
- **Bound everything.** One in-flight interaction per session, plus limits on sessions,
  request bytes, response bytes, preview size, run time, and request rate.
- **Audit without content.** Log session hashes, action kinds, outcomes, latency, and
  sizes — never labels, values, table contents, or queries.

Two things must be built before the interface can be reached remotely, and they are the
reason v1 is loopback-only:

1. **Identity mapping.** Verified deployment identity must be mapped explicitly into
   `st.user`; routing behind middleware does not do that by itself, and identity is never
   accepted from the request body. Without this, an agent session acts with the app's
   privileges and no user identity.
2. **Resource authorization.** The media route is currently a bare content-hash lookup
   with no session check, and identical bytes deduplicate to the same URL across
   sessions. That is acceptable for media an app already chose to display; it is not
   acceptable for newly externalized table and chart data, which is why that
   externalization is a follow-up rather than part of v1.

Cookie-authenticated mutating routes also need Origin and XSRF handling; CORS is not
authentication.

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

What is genuinely new is not capability but _practicality_, and that is what has to be
settled before the default flips:

| Concern           | Why it is new                                                                                                                                                                                    | What resolves it                                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bulk data access  | A dataframe becomes typed data rather than a scrolled viewport, and v1 serves the full Arrow bytes over a link. The same data an app already sent its client, far easier to take in one request. | Response, preview, and artifact-size budgets in v1; principal-scoped or expiring resource links before remote enablement.                                                                                                     |
| Request volume    | An agent loops faster than a human clicks.                                                                                                                                                       | Session caps, one in-flight interaction per session, and request rate limits.                                                                                                                                                 |
| Cross-origin POST | The WebSocket has origin checks; a new cookie-authenticated mutating route needs its own.                                                                                                        | Origin and XSRF handling on the route.                                                                                                                                                                                        |
| Identity          | Without explicit mapping, an agent session acts with the app's privileges and no `st.user`, so an app behind SSO could be reached by something that never authenticated.                         | Identity **parity**: the caller resolves to the same principal, the same `st.user`, and the same access-control branches as an equivalent browser session. This is a hard requirement for default-on, not a later refinement. |

So v1 is **off by default and served only to loopback peers**, matching the existing
conservative gate used for the skills-install backend operation. That makes the first
release useful for local verification and CI while the four rows above are being settled,
and it keeps the decision reversible: turning a flag on later is easy, while walking back
an insecure default is not. Widening to self-hosted deployments, then flipping the
default, are follow-ups with their own gates.

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
already identifies pages, so the interface exposes those instead of a parallel scheme. A freshly invented scheme — positional
indices, say — would need its own definition and edge cases (is the counter scoped per
page or per container? what happens when a fragment re-emits?) to buy nothing. Opaque
revision-scoped handles sound safer, but safety comes from server-side validation against
live state, which is required either way.

**No `fragment_id` in the request, now or later.** v1 always full-reruns, and when
fragment-scoped reruns arrive the server will derive the scope from the chosen action, as
the browser does — `Delta.fragment_id` already tags every emitted delta with its owning
fragment, and `ClientState.fragment_id` already carries the scope into the rerun. So no
new public field or proto field is needed; the follow-up work is fragment-scoped
stale-node cleanup, not identity plumbing. Letting a client name a scope would only
enable inconsistent requests.

**No agent-aware app branching.** An `st.context.is_agent` signal invites apps to fork
behavior by audience, which fragments the app and undermines the property that makes this
work: one app, one set of explanations, two clients.

## Follow-ups

Each of these is additive to the v1 contract and independently shippable. They are
ordered roughly by expected value.

1. **Remote enablement, then on by default.** Identity mapping into `st.user`, Origin
   and XSRF handling, and the response and rate budgets that make bulk access and request
   volume safe — then flip the flag to opt-out. Per-platform
   routing, session affinity for multi-worker deployments, and quotas. Unlocks use cases
   2–4.
2. **Fragment-scoped reruns.** Derive scope from the action instead of always
   full-rerunning, with fragment-scoped stale-node cleanup. This restores browser parity
   for fragment interactions, avoids re-running work the author deliberately scoped away,
   and is what makes `st.dialog` contents interactive.
3. **Authored descriptions** — a standalone project worth doing on its own accessibility
   merits: static `app_title`/`app_description` on `st.App`, `page_description` on
   `st.set_page_config`, author-written alternative text for images, charts, and tabular
   displays ([#8563](https://github.com/streamlit/streamlit/issues/8563)), and `help` on
   media ([#3133](https://github.com/streamlit/streamlit/issues/3133)). No such parameter
   exists today, and `st.image` currently renders its `alt` attribute from an internal
   loop key, so this fixes a real screen-reader defect before it does anything for
   agents. One design question to settle deliberately: a universal `alt=` is attractive
   for vocabulary consistency but collapses genuinely different accessibility semantics
   across images, charts, tables, and audio, so element-appropriate public names
   normalized into a single `description` field in the JSON may be the better shape.
4. **Authorized resource links and lazy continuation.** Replace content-hash media URLs
   with principal-scoped or expiring links, which is a prerequisite for remote enablement
   rather than an addition to the v1 shape. Then add range reads for lazy dataframes,
   reusing the existing chunk machinery and its limits rather than building a query API.
5. **Long-run handling.** `202` with an operation handle,
   `GET /_stcore/agent/v1/sessions/{id}` to poll the committed snapshot without executing
   code, and `DELETE` to close early. Once clients poll rather than resubmit, add
   optional `request_id` (retry idempotency) and `expected_revision` (reject actions based
   on a stale observation) for callers that batch or parallelize.
6. **CLI.** `streamlit agent interact <url> --json @request.json` over the same routes, as
   a debugging and verification convenience. An agent with shell access can already curl
   the endpoint, which is why this is not v1.
7. **MCP adapter.** A small fixed tool set (`interact`, `get_state`, `close_session`)
   over the same controller, behind an optional extra, with dynamic actions in the tool
   _result_. Per-widget tools are not an option: `tools/list` "MUST NOT vary
   per-connection or as a side effect of other requests on the connection"
   ([MCP tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)),
   and the specification's own guidance for this shape is the opaque-handle pattern
   `session_id` already implements. `interact` must never be annotated read-only.
8. **Static app descriptor.** An authenticated route returning app title, description,
   and protocol capabilities _without_ executing app code, so an agent can choose among
   available apps. It must never publish widget schemas or user-dependent page lists from
   a shared warm-up run.
9. **Remaining interaction coverage.** Uploads, `st.data_editor` edits, dataframe and
   chart selections, lazy-data continuation, deferred downloads, `run_every` scheduling,
   and per-action JSON Schema.

## Success criteria

**v1 ships when:** every `Element` and `Block` variant carries a coverage declaration
checked in CI; every serialized element `type` and `props` key either matches a public
command or parameter name or appears on a documented list of derived additions, also
checked in CI; JSON encodings are pinned for dates, datetimes, decimals, large integers,
non-finite numbers, ranges, and object-valued options; every advertised interaction matches an equivalent browser session on
callback order, resulting widget value, and emitted output — with the deliberate
full-rerun widening for fragments as the one declared deviation; a filtered dashboard, a
form with two submit buttons, and a chat flow complete without a browser; large
dataframes produce bounded snapshots and a fetchable `data.url` that survives until the
next interaction; and no route responds with `enableAgentApi` unset.

**One registry, not three.** The canonical element type, its meaningful properties, its
value encoding, its interaction capability, its unsupported reasons, and its coverage
status must have exactly one definition. This interface is not the only consumer: the
[app testing toolkit proposal](https://github.com/streamlit/streamlit/pull/16041) covers
an `AppTest.snapshot()`, a generated element capability registry to replace silent
`UnknownElement` gaps, and a semantic facade for browser tests — all of which need the
same per-element answers this interface needs. Those are proposals rather than shipped
work, so whichever lands first should own the registry and the others should import it.
Maintaining the knowledge in parallel systems guarantees they disagree within a release,
and the CI coverage declaration above is what makes a single definition enforceable.

**Longer term**, the interface is the shared observation layer for a broader goal: build
richer data apps, verify them automatically, and move them from a local script to a
durable deployment without leaving Streamlit.

Track that with a monthly benchmark over at least 20 representative apps spanning
filtered dashboards, forms, chat, multipage flows, fragments, large data, and
browser-only boundaries:

| Measure                  | Method                                                                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verification quality     | Can an agent detect deliberately seeded logic bugs through the interface, and does it recognize when a browser is required? Track false positives.                                           |
| Consumption success      | Did the agent answer the exact data question or complete the workflow? Compare against matched browser automation.                                                                           |
| Build and deploy success | Did generated Streamlit code run, pass independent acceptance tests, and deploy? Record the failure stage.                                                                                   |
| Framework selection      | Given an open-ended brief where several frameworks are viable, which does the agent choose? Recorded with model, prompt, skills, and environment; kept separate from forced-Streamlit tasks. |
| Efficiency               | Tokens, turns, latency, and response bytes — reported only alongside correctness.                                                                                                            |

Task success is the metric Streamlit most directly controls, so it is the primary
outcome. Framework selection is a strategic indicator, not a release gate: it is a
lagging, momentum-amplified signal, and a one-time recommendation snapshot is not
evidence. Keep a stable cohort for trends plus a rotating holdout for new features, run
repeated trials with skills both enabled and disabled, and report sample size and
uncertainty.

Because model knowledge lags releases, a feature is not done when its code merges. Every
new command or significant parameter should ship with complete type annotations and
docstrings, canonical examples that explain the app's _meaning_, updated bundled skills
and templates, `AppTest` capability registration, a coverage declaration and serializer
for this interface, browser E2E coverage where browser behavior matters, defined
accessibility behavior, content-free telemetry, and migration guidance for the CSS or
component workaround it replaces — with an explicit "not applicable" where one does not
apply.

## Out of scope

- A Streamlit-hosted agent, LLM-generated summaries, or a natural-language endpoint.
- A global app catalog or an agent authorization product.
- Access to arbitrary Python callables, source, caches, or `st.session_state`.
- Attaching to or taking over a human's live browser session.
- A Markdown dialect, standalone semantic renderer, or a second observation format.
- Built-in scheduling, email delivery, report templates, or standalone HTML export.
  External agents can build these on the same snapshot.
- Author-declared domain tools (`@st.tool`). A form already provides a typed operation
  boundary, and authors who need a stable service contract should keep using
  `st.App(routes=...)`.
- Executing custom-component or iframe JavaScript in the backend.
- Replacing visual, keyboard, accessibility, or custom-component browser testing.

## Checklist

| Item                       | ✅ or comment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ⚠️ v1 is loopback-only. Self-hosted, Cloud, and SiS each require identity mapping, routing, session affinity, and quota validation first.                                                                                                                                                                                                                                                                                                                                                                     |
| No breaking API changes    | ✅ Additive: one config option, off in v1, and new routes under `/_stcore/agent/`. No `st.*` changes in v1. Flipping the default later is itself a reviewed change, not a silent one.                                                                                                                                                                                                                                                                                                                         |
| No new dependencies        | ✅ Existing Starlette and JSON. The follow-up MCP adapter should use the official SDK behind an optional extra.                                                                                                                                                                                                                                                                                                                                                                                               |
| Metrics collected          | Enablement, session opens, action kinds, outcome classes, latency, response sizes, and unsupported-capability hits. No labels, keys, values, queries, URLs, or data.                                                                                                                                                                                                                                                                                                                                          |
| Any security/legal impact? | ⚠️ Significant, and the main review risk. New execution surface: off and loopback-gated in v1, every interaction validated server-side, no session-state or secret exposure. The interface is an alternate encoding of what the browser protocol already exposes, so the review question is bulk-access practicality, request volume, cross-origin POST, and identity mapping — the four gates on making it opt-out. App content is untrusted input to the calling agent, so no action may be annotated safe. |
| Any docs changes needed?   | Protocol reference and coverage matrix, an authoring guide ("write `key=`, explain the app in the app"), verification guidance next to `AppTest` and Playwright, and a security/deployment page.                                                                                                                                                                                                                                                                                                              |
| Any other risks?           | The snapshot is a long-lived compatibility surface and needs a version field and a written stability policy from the first release. Adoption risk: if it stays experimental too long, the ecosystem standardizes on browser automation instead.                                                                                                                                                                                                                                                               |

## Open questions

1. What has to be true to make the interface opt-out rather than opt-in, and should
   the default flip everywhere at once or per platform? Hosted platforms may want to
   keep their own policy override regardless.
2. Which hosted credential flow can map an agent to the correct `st.user` without
   introducing a second identity system? A browser's signed auth cookie is not a general
   agent credential.
3. Which resource authorization mechanism — principal-scoped references or expiring
   signed capabilities — can reuse media storage across OSS, Cloud, and SiS without
   turning resource URLs into durable bearer tokens?
4. What run timeout, session, preview, and response budgets do prototype measurements
   justify?
5. Which exact JSON encodings should be standardized for dates, datetimes, decimals,
   large integers, non-finite numbers, ranges, and object-valued options? These must be
   settled before v1 ships, with or without per-action schemas.
