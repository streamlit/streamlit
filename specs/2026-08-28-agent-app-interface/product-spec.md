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

This spec adds an HTTP operation (with CLI and MCP adapters as follow-ups) that lets an
agent run a real Streamlit app without a browser: send JSON widget values, get back the
finished app as a typed tree of containers and elements named after the public `st.*`
API, plus the list of things it can do next. It is a second client of the execution
model Streamlit already has, not a new one.

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
rerun does. A non-executing read arrives with the polling work in follow-up #4.

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

**`page` on a creating call cannot be resolved by lookup, which the obvious implementation
gets wrong.** Mapping a `url_path` to the internal page hash is a post-run fact: an
`st.navigation` app has no page list until it has run once, so a creating call naming a
page has nothing to look up, and a first prototype rejected a page that plainly existed —
the headline parameterization example above. The browser has the same problem on a cold
load and solves it by sending the page *name* and letting the runtime resolve it, which is
what this should do too. The consequence is that an unrecognized page can only be detected
after the run, so that one error arrives late and carries the `session_id` of the session
it already created, rather than leaking it.

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
  "app_title": "Finance",
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
              "complete": false,
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
  ]
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
  interaction. A display element has no `value`; its content stays in `props`, so an
  `st.metric` number is `props.value`.
- **Reported options and values are the form a request may send back.** For a widget with
  a `format_func`, `st.session_state` holds the author's Python option while the accepted
  wire value is the formatted string, and reporting the authored object would make both
  `options` and `value` unusable as input. Full fidelity is not automatically better here:
  the snapshot's job is to report what the *next request* can say. So
  `st.pills(options=[1, 12], format_func=month_name)` reports `"December"`, not `12`, and
  a client that echoes a value back is always making a legal request. Where the authored
  value is the more useful one and cannot be sent back — an `st.metric` number before
  formatting — report both, and name the rendered one `display_*`.
- **Pages are identified by `url_path`.** There is no page ID in the public API, and
  `url_path` is the handle `st.Page` already exposes — it is unique, appears in the URL,
  and is auto-derived from the filename when the author does not set it (`""` for the
  default page). The internal page script hash stays internal.
- **The app's title and the page's title are separate fields.** `page.title` is the
  current page; a top-level `app_title` carries what
  `st.set_page_config(page_title=...)` set for the whole app. Collapsing them makes
  `page.title` answer "which app am I in?" while every caller reads it as "which page am
  I on?", and a client-side trial cited the wrong one in a report before the two were
  split.
- **The `actions` list is an index, not a duplicate.** It lists the key of every element that
  can be set (`value`) or fired (`trigger`) right now, so a model can see the action space
  at a glance; type and constraints are read from the element in the tree. A `disabled`
  widget appears in the tree but not in `actions`. Form membership is visible from
  nesting.
- **Unsupported things stay visible, on the element itself.** An element that is not
  fully supported carries a `support` field with a machine-readable reason —
  `browser_required` for a custom component, for example — and absent means fully
  supported. Keeping it on the node means an agent never has to cross-reference a summary
  list to find out which element a gap belongs to. A container's `support` binds its
  contents: an element inside an undrivable container is not drivable either, and
  repeating the reason onto descendants keeps `actions` from advertising children the
  container itself denies.
- **A described node reports what it is; a gap says so.** An element whose command has no
  description falls back to a node named after its proto field and is listed in a
  response-level `undescribed_types`, so a coverage gap is visible to the caller as a gap
  rather than passing as a command name. See
  [Success criteria](#success-criteria) for why this is a runtime property rather than a
  static check.
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
- **An exception the app displayed on purpose is not a failed run.** `st.exception` is a
  display command, so "is there an exception element?" is the wrong question — an app that
  catches a `ValueError` and renders it deliberately would flip the whole interaction to
  `error`, which a client-side trial hit. The two cases are distinguishable because only
  the runtime's own error display applies `client.showErrorDetails` redaction, so the
  element records whether it was uncaught and only that sets `status`. A
  caught-and-displayed exception stays in the tree, marked as handled, which is more
  useful than either hiding it or calling the run broken.

Callbacks and external side effects that already ran are not rolled back. The session
stays usable, so an agent can correct its input and interact again.

| Outcome                                                                              | Response                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid request — unknown key, disabled widget, unsupported element, out-of-range or wrong-shape value, missing form submit, cross-form or cross-fragment batch | Error before any execution, naming which of those it was. Nothing ran and the app is unchanged. |
| Unrecognized `page` on a creating call                                               | Error after the run, because the page list does not exist before it. Carries the `session_id` of the session it created, which stays usable. |
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

Identity is not authorization. Every request is validated so that a stale, guessed, or
forged key cannot set a disabled widget, an out-of-range value, or a control that no
longer exists. Validation rejects the whole request before anything is applied.

**Validate against the last snapshot, not against live widget state.** This is the one
place where the obvious implementation is wrong, and prototyping proved it. `WidgetMetadata`
survives a page switch and a collapsed conditional branch — only the *value* is cleaned
up — so a validator built on the widget registry accepts a key for a control that is no
longer on the page, runs the script, changes nothing, and returns `200`. That is the worst
available failure mode: a silent no-op that reads as success. The registry is also missing
things a client needs checked, because it never had a reason to record them: numeric and
temporal bounds, the arity of a range, the options of a payload-bearing trigger, and which
`st.form` an element belongs to.

All of those are in the document the client was actually given, which is the deeper point:
**the snapshot is the contract, so the snapshot is what a write is judged against.** A spec
that describes validation in terms of runtime state is describing something the caller
cannot see. In practice the server keeps, per session, what each addressable element
advertised — actionable, disabled, `support`, form, options, bounds, and current value —
and checks the next request against that.

The corollary is that rejections can say what is actually wrong instead of collapsing into
one code. A disabled slider reports `disabled_widget`, a file uploader reports
`unsupported_element`, and only a key that genuinely is not on the page reports
`not_on_page`. Getting this wrong sends a client looking in the wrong place, which a
client-side trial did before the distinction existed.

| Situation                        | v1 behavior                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One widget change                | Set the value, run normal callbacks, rerun.                                                                                                                                                                                                                                                                                                                                                                                   |
| Several widget changes           | One batch, one rerun. A request is one **client-state transition**, not a replay of several human gestures: the patch is validated atomically, merged into the session's current widget state, and handed to the same runtime path the browser uses, which decides what changed and which callbacks run. This skips intermediate observations, so a widget that only appears after its parent changes needs a second request. |
| Form                             | Send that form's fields plus exactly one of its submit triggers. Omitted fields keep current values. Reject fields without a submit, fields from two forms, and unrelated controls in the same call. `clear_on_submit` is **not** applied: the reset lives in the browser, so fields keep their submitted values. See below.                                                                                                        |
| Trigger                          | At most one per request. Triggers reset and never persist as `true`.                                                                                                                                                                                                                                                                                                                                                          |
| Navigation                       | `page` and `query_params` are a navigation transition and cannot be combined with widget changes.                                                                                                                                                                                                                                                                                                                             |
| Widget inside a fragment         | Interactive, and the rerun is **scoped to that fragment**, as in the browser. Every key in one request must belong to the same fragment, or to none. See below.                                                                                                                                                                                                                                                                                                                                |
| Widget with `on_change="ignore"` | Interactive, like any other widget. The mode only tells the browser not to rerun on change; it carries no backend meaning, so the endpoint applies the value and reruns. An agent that wants browser-equivalent deferral batches the value with whatever trigger should cause the rerun.                                                                                                                                      |

**Reruns are scoped the way the browser scopes them.** An earlier draft made v1
full-rerun-only and deferred scoping to a follow-up. Prototyping moved it into v1, for two
reasons. The first is cost: everything needed is already on the wire, since
`Delta.fragment_id` tags every emitted delta with its owning fragment and
`ClientState.fragment_id` already carries the scope into a rerun, so the work is recording
the id in the snapshot and using it, not new plumbing. The second is that full-rerun-only
is not merely slower for `st.dialog` — it is broken, and the two cannot be separated:

- **A dialog body is a fragment.** `st.dialog` wraps the decorated function in one, which
  is exactly why a dialog survives interaction inside it and closes on a full rerun. So
  dialog interactivity was never a dialog feature to build; it was a fragment feature that
  was missing.
- **The rule a client has to learn is the browser's rule.** Acting on something inside a
  dialog keeps it open; acting anywhere else is a full rerun, which does not re-emit the
  dialog and therefore closes it. A client must finish inside a dialog before touching
  anything else.

Because the wire carries one fragment id, a request naming two fragments — or mixing a
fragment's contents with controls outside it — is rejected rather than widened to a full
rerun. Widening is the friendlier-looking choice and would silently close an open dialog.

**A scoped rerun makes freshness per-region, which the response has to say.** After a
fragment-scoped interaction most of the tree is carried over from an earlier run, still
current as far as the app is concerned but not freshly computed, so a single
`observed_at` would overstate how current the document is — and the report and export use
cases cite exactly that field as provenance. Two shapes were considered. Returning only
the fragment's subtree makes the timestamp honest by construction and was rejected: it
pushes the delta merge and fragment-scoped staleness rules onto every client, which is the
Streamlit knowledge this interface exists to absorb, and it breaks `actions`, since a
client needs the whole page's action set to choose its next move. So the document stays
complete and declares freshness instead: nodes inside a fragment carry an opaque
`fragment` handle, and a top-level `fragments` list reports which regions this interaction
re-rendered. `observed_at` means when the snapshot was assembled.

That list is also where a `run_every` interval is reported. The refresh clock is the
browser's, so an auto-refreshing fragment never refreshes for a non-browser client;
disclosing the interval and letting the caller decide to poll is honest, while inventing
background reruns server-side is not.

**A headless client inherits the frontend's responsibilities, and `clear_on_submit` is
where that first bites.** `lib/streamlit` only writes the flag onto the proto; all of the
clearing is React, where submitting a form emits a `formCleared` signal and each widget
resets itself, writing defaults back into form-scoped state the server does not see until
the next submit. So no non-browser consumer can observe it — this interface and `AppTest`
diverge from the browser identically. Worth noticing that the browser is already
inconsistent with itself here: right after a submit the server still holds the submitted
values while the UI shows empty fields, so a rerun triggered by anything else renders
values the user believes they cleared. Moving the reset server-side after a submit run,
where form membership is already known from each widget's `form_id`, would fix both at
once — but that is a change to core form semantics and belongs in its own change rather
than inside this interface. Until then v1 declares the gap and tells clients not to treat
empty fields as evidence that a submit landed. **The general rule is worth writing down:
any behavior Streamlit implements in React rather than in Python is absent for every
non-browser client, and this is unlikely to be the only instance.**

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
| HTML, iframe, custom component | Type, safe metadata, and `support: browser_required`. Component JavaScript is never executed.                                                                                                                                                          |
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
retained separately from the emitted message: v1 caps what it will externalize and marks
an oversized artifact unavailable on the node rather than registering it.

Truncation is always explicit. **A preview must never look like the complete answer to
an aggregate question.** If the structural document itself cannot fit the response
budget, the request fails rather than truncating silently.

**`data.complete` is the field a client branches on, and it resolves three ways, never
none.** Either the data here is everything (`complete: true`), or a `url` serves the rest,
or an explicit `unavailable` says the data was too large to hold a second copy of. A first
prototype used one byte threshold for both the preview and the externalization, and a
client trial hit the hole immediately: a 206-row table is about 8 KB, so it was truncated
*and* had no URL, while its own caption told the agent to fetch one. Whether a client
needs a URL is a question about row count, not payload size, so there is no size floor for
externalizing — only a ceiling above which the copy is refused and declared.

Two consequences of that framing are worth stating, because both were mistakes first:

- **A chart that was given a specification rather than a dataframe is `complete`.**
  `st.plotly_chart` and `st.echarts_chart` carry their values inside the specification, so
  there is no table to serve and a client should stop looking for one. This is different
  from having no data contract at all.
- **A rendering specification is not a data contract.** `st.map` compiles its points into
  a Deck.gl layer, and an agent should not be mining coordinates out of layer JSON, so the
  plotted table is externalized like any other dataframe's.

The preview cap is a row count rather than a byte budget, set high enough (100 rows in the
prototype) that most filtered tables come back complete and need no second request.

### What v1 does not support

Each of these is _declared_ in the snapshot, never silently missing, so an agent can
explain the gap or fall back to a browser:

| Not in v1                                               | Behavior                                                                                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `run_every` fragment refresh                            | The interval is reported on the fragment; nothing refreshes until the client interacts again.                                                                       |
| `clear_on_submit`                                       | Reported as authored and not applied — the reset is implemented in the browser. Fields keep their submitted values, so empty fields are not a submit signal.       |
| `st.file_uploader`, `st.camera_input`, `st.audio_input` | Inspectable, not interactive.                                                                                                                                      |
| `st.data_editor` edits, dataframe and chart selections  | Read-only.                                                                                                                                                         |
| Deferred downloads and download callbacks               | Not triggerable. Eager downloads expose their existing URL.                                                                                                        |
| Long-running interactions                               | No polling or partial results; the request either settles or returns `run_timed_out`.                                                                              |

### Security

This is a new programmatic execution surface and needs an explicit review.

- **Conservatively gated in v1.** Upgrading Streamlit must not open a new API, and the
  first release cannot be reached from another host. See [Enablement](#enablement).
- **Validate semantically, then serialize.** Never accept a raw `BackMsg`, element ID,
  delta path, fragment ID, or `WidgetState` protobuf. Reject stale, disabled, removed,
  out-of-range, wrong-shape, cross-form, cross-fragment, and oversized requests
  atomically, before any callback runs — against the last snapshot rather than live widget
  state, for the reasons in [Actions in v1](#actions-in-v1).
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

1. **Authentication and identity parity.** For a public app this changes nothing: an
   agent session is anonymous and runs with the server's credentials, exactly like an
   anonymous browser viewer, and there is no reason to treat the two differently. What
   matters is parity, not extra protection. The route must sit behind the same
   authentication gate as the app, and where a request *is* authenticated, that identity
   must reach `st.user` the way the WebSocket handshake already does — routing behind
   middleware does not do the second half by itself, and identity is never accepted from
   the request body. Skipping it is the real hazard: an app that branches on `st.user`
   for per-user data access would serve an agent as though nobody were signed in.
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

**Discovery is part of the feature, not documentation around it.** The workflow people
ask for is "point an agent at an app and ask it a question", which only works if fetching
the app's URL says the interface exists. It does not today: the served `index.html` is
about 7 KB of module preloads whose only human-readable text is *"You need to enable
JavaScript to run this app."* That one sentence is the entire payload an HTML-to-text
extraction keeps, so it is the only place a naive fetch will look. It should therefore say
that the app can also be read and driven as JSON over HTTP, that this is the recommended
way to use a Streamlit app without a browser, that scraping the page is pointless because
it carries no app content, and where to start. A machine-readable
`<link rel="service-desc">` ([RFC 8631](https://www.rfc-editor.org/rfc/rfc8631)) belongs
alongside it, matching the `Link` header the API returns on its own responses.

**The hint is unconditional and the endpoint answers.** Injecting it only when the API is
enabled would mean rewriting a static file at serve time and would make the HTML's
correctness depend on a runtime setting. Advertising always and answering dynamically is
better on every axis: the HTML stays a plain cacheable file, enabling the API later needs
no HTML change and no cache invalidation, and the link is never a dead end. That requires
the schema route to be registered even when the API is off — otherwise the path falls
through to the single-page-app fallback and returns *the app's own HTML with a `200`*,
which is a failure that reads as success.

Answering well needs three states rather than two, because the remedies differ:
`available`; `disabled`, which tells an operator which setting to change; and
`loopback-only`, which tells a remote caller that the setting is already on and that no
request will get around the peer check. Collapsing the last two sends half of all callers
after the wrong fix. Since this document is then the one response an unauthenticated
caller can reach, it should omit the exact Streamlit version unless the caller can
actually use the API.

What this does *not* solve is worth stating: discovery is not capability. Most agent
harnesses' web tools only issue GET requests, so an agent can find the protocol and still
be unable to `POST` to it. Closing that gap needs a caller with a general HTTP tool, or
the MCP adapter in follow-up #6.

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
| Identity          | Nothing changes for a public app, where a browser viewer is equally anonymous. The gap is an authenticated app whose route or identity mapping is skipped, leaving `st.user` unset so per-user access branches silently take the anonymous path. | **Parity** with the app's existing gate: the same authentication on the route, and an authenticated caller resolving to the same `st.user` and access-control branches as an equivalent browser session. A hard requirement for default-on, not a later refinement. |

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

**No `fragment_id` in the request.** The server derives the scope from the chosen action,
as the browser does — `Delta.fragment_id` already tags every emitted delta with its owning
fragment, and `ClientState.fragment_id` already carries the scope into the rerun — so no
new public or proto field is needed. Letting a client name a scope would only enable
inconsistent requests. Prototyping confirmed this: the work was recording the id per node
and pruning the merged tree per fragment, not identity plumbing, and a client never has to
know what a fragment is to benefit from one.

**Prune the accumulated tree when a run finishes, not when one starts.** A non-obvious
consequence of scoped reruns, and the one thing that looked equivalent and was not. The
server's outgoing queue is cleared at the start of a run, so mirroring that seems right —
but the thing being maintained here is the browser's *element tree*, which accumulates
deltas as they arrive and prunes when a run *finishes*, scoped to what that run owned. The
difference shows up on an interrupted run: a callback that calls `st.rerun(scope="fragment")`
aborts the full run before it emits anything, so clearing at the start throws away the
whole app and leaves a snapshot containing only the fragment.

**No agent-aware app branching.** An `st.context.is_agent` signal invites apps to fork
behavior by audience, which fragments the app and undermines the property that makes this
work: one app, one set of explanations, two clients.

**Each command describes itself where it fills its proto, not in a central serializer.**
This replaces the obvious design — one registry that maps each proto variant to a
description — and the reason is that a proto is a *rendering* contract, so by the time a
serializer sees one, the semantics are already gone. Three examples of what cannot be
recovered downstream: a built-in chart's `x` and `y` survive only as compiled Vega
encodings; a selection widget's `options` are the `format_func`-formatted strings, with
the authored objects no longer present; `st.metric` has formatted its number into a
display string. Several commands also share one proto, so the command name itself has to
be recovered by inspecting fields, which is a heuristic that silently rots when a new
command reuses an existing proto — `st.mermaid_chart`, which enqueues markdown, reported
itself as `st.markdown` until it described itself explicitly.

Building the description in the element function costs one JSON object per element, built
only for sessions the agent API created, so a browser session builds and sends nothing.
It rides to the serializer on the emitted message's metadata, which also means a cached
message replays with the description it was created with.

The cost is honest: the description lives next to each command instead of in one file, so
adding a command means adding a line there, and nothing stops an author from forgetting.
That is what the coverage property in [Success criteria](#success-criteria) is for. In
exchange, the description reads like the command's own signature and stays next to the
code that would change it.

## Follow-ups

Each of these is additive to the v1 contract and independently shippable. They are
ordered roughly by expected value.

1. **Remote enablement, then on by default.** Identity mapping into `st.user`, Origin
   and XSRF handling, and the response and rate budgets that make bulk access and request
   volume safe — then flip the flag to opt-out. Per-platform
   routing, session affinity for multi-worker deployments, and quotas. Unlocks use cases
   2–4.
2. **Authored descriptions** — a standalone project worth doing on its own accessibility
   merits: static `app_title`/`app_description` on `st.App`, `page_description` on
   `st.set_page_config` and optionally `st.Page`
   ([#16878](https://github.com/streamlit/streamlit/issues/16878)), author-written
   alternative text for images, charts, and tabular
   displays ([#8563](https://github.com/streamlit/streamlit/issues/8563)), and `help` on
   media ([#3133](https://github.com/streamlit/streamlit/issues/3133)). No such parameter
   exists today, and `st.image` currently renders its `alt` attribute from an internal
   loop key, so this fixes a real screen-reader defect before it does anything for
   agents. One design question to settle deliberately: a universal `alt=` is attractive
   for vocabulary consistency but collapses genuinely different accessibility semantics
   across images, charts, tables, and audio, so element-appropriate public names
   normalized into a single `description` field in the JSON may be the better shape.
3. **Authorized resource links and lazy continuation.** Replace content-hash media URLs
   with principal-scoped or expiring links, which is a prerequisite for remote enablement
   rather than an addition to the v1 shape. Then add range reads for lazy dataframes,
   reusing the existing chunk machinery and its limits rather than building a query API.
4. **Long-run handling.** `202` with an operation handle,
   `GET /_stcore/agent/v1/sessions/{id}` to poll the committed snapshot without executing
   code, and `DELETE` to close early. Once clients poll rather than resubmit, add
   optional `request_id` (retry idempotency) and `expected_revision` (reject actions based
   on a stale observation) for callers that batch or parallelize.
5. **CLI.** `streamlit agent interact <url> --json @request.json` over the same routes, as
   a debugging and verification convenience. An agent with shell access can already curl
   the endpoint, which is why this is not v1.
6. **MCP adapter.** A small fixed tool set (`interact`, `get_state`, `close_session`)
   over the same controller, behind an optional extra, with dynamic actions in the tool
   _result_. Per-widget tools are not an option: `tools/list` "MUST NOT vary
   per-connection or as a side effect of other requests on the connection"
   ([MCP tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)),
   and the specification's own guidance for this shape is the opaque-handle pattern
   `session_id` already implements. `interact` must never be annotated read-only.
7. **Static app descriptor.** An authenticated route returning app title, description,
   and protocol capabilities _without_ executing app code, so an agent can choose among
   available apps. It depends on the authored `st.App` title/description in follow-up #2
   ([#16878](https://github.com/streamlit/streamlit/issues/16878)). It must never publish
   widget schemas or user-dependent page lists from a shared warm-up run.
8. **Remaining interaction coverage.** Uploads, `st.data_editor` edits, dataframe and
   chart selections, lazy-data continuation, deferred downloads, `run_every` scheduling,
   and per-action JSON Schema.

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

**v1 ships when:** every command that emits an element or container describes itself, with
an empty `undescribed_types` across a kitchen-sink app that exercises the whole display
and widget surface; every serialized element `type` and `props` key either matches a public
command or parameter name or appears on a documented list of derived additions; JSON
encodings are pinned for dates, datetimes, decimals, large integers, non-finite numbers,
ranges, and object-valued options; every advertised interaction matches an equivalent
browser session on callback order, resulting widget value, and emitted output; whatever
the snapshot reports as a value can be sent straight back; a filtered dashboard, a form
with two submit buttons, a chat flow, and a multi-turn dialog complete without a browser;
large dataframes produce bounded snapshots and a fetchable `data.url`; and no route
responds with `enableAgentApi` unset.

**Coverage is a runtime property, not a static check.** The original plan was CI asserting
that every `Element` and `Block` variant has a declaration, which is not checkable once
descriptions are built at fill time: a proto variant no longer maps to one command, and a
command's description exists only along the code path that emits it. Nothing static can
see that `st.badge` and `st.caption` both produce markdown, or that a command wrote the
wrong name. What replaces it is the pair above — `undescribed_types` in every response,
plus a test that sweeps a kitchen-sink app and asserts the list is empty — and the
difference is worth naming honestly: it proves the commands the sweep exercised, not every
variant. A command added without a description and without a sweep entry will be missed by
CI and reported to clients at runtime.

**One definition, not three — at the command, not in a registry.** The canonical element
type, its meaningful properties, its value encoding, its interaction capability, and its
unsupported reasons must have exactly one definition. This interface is not the only
consumer: the [app testing toolkit proposal](https://github.com/streamlit/streamlit/pull/16041)
covers an `AppTest.snapshot()`, a generated element capability registry to replace silent
`UnknownElement` gaps, and a semantic facade for browser tests — all of which need the
same per-element answers this interface needs. Maintaining that knowledge in parallel
systems guarantees they disagree within a release.

What prototyping changed is *where* the single definition lives. A central registry keyed
on proto variants cannot hold it, for the reasons in
[Key design decisions](#key-design-decisions): the semantics are gone by the time a
serializer sees a proto. So the one definition is the description each command builds as
it fills its proto, and other consumers should read *that* rather than re-deriving their
own. An `AppTest.snapshot()` built on the same descriptions gets the same names for free,
which is the actual test of whether this is one definition or two.

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
and templates, `AppTest` capability registration, an agent-API description at its emit
site and an entry in the coverage sweep, browser E2E coverage where browser behavior matters, defined
accessibility behavior, content-free telemetry, and migration guidance for the CSS or
component workaround it replaces — with an explicit "not applicable" where one does not
apply.

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
4. What run timeout, session, preview, and response budgets should ship? A prototype
   settled some of this: a 100-row preview keeps most filtered tables complete, and the
   externalization ceiling only has to prevent holding a second copy of something
   enormous. Two are still open. The response document itself is unbounded, and a page
   with a 3,000-option selectbox ships those options in every snapshot, which is the
   realistic budget problem rather than table data. And "the run chain settled" is
   currently a grace period after the last run finishes — a heuristic that works but
   guesses; doing better needs the runtime to say whether a further run is pending.
5. **How should a client tell how current each part of a snapshot is?** Scoped reruns make
   freshness per-region. v1 reports which fragments re-rendered, which is enough to avoid
   citing a stale number but not enough to say *when* a carried-over region was computed.
   A per-node timestamp is the obvious extension and may be more precision than any
   consumer wants.
6. **Should `clear_on_submit` move server-side?** It is implemented in React today, so no
   headless client can honor it, and the browser is already inconsistent with itself
   immediately after a submit. Fixing it properly is a change to core form semantics and
   affects browser sessions too, so it needs its own decision rather than riding along
   here.
7. Which exact JSON encodings should be standardized for dates, datetimes, decimals,
   large integers, non-finite numbers, ranges, and object-valued options? These must be
   settled before v1 ships, with or without per-action schemas.
