---
author: lukasmasuch
created: 2026-10-21
---

# WebMCP tools for Streamlit apps

## Summary

[WebMCP](https://developer.chrome.com/docs/ai/webmcp) is a proposed web standard that lets
a page register tools, each a name, a description, a JSON Schema, and a JavaScript
function, for AI agents running in the user's browser. This spec has Streamlit's frontend
register four fixed tools in apps that opt in, so a browser agent can read what the user is
looking at, read the full data behind it, explore a private copy of the user's session,
and, at the higher level, change the user's view while they watch. The tools speak the
[agent API](../2026-08-28-agent-app-interface/product-spec.md)'s snapshot and request
contract, already served over HTTP and through the
[MCP endpoint](../2026-10-15-agent-app-mcp-endpoint/product-spec.md), and they run over the
page's own WebSocket, so they add no route and no authority the tab does not already have.

## Problem

### Browser agents read a Streamlit app as pixels

More and more agents work inside the user's browser: built-in assistants, extensions, and
desktop apps that drive a browser. On a Streamlit app they fall back to actuation, meaning
screenshots, DOM scraping, and simulated clicks, and Streamlit is a hard case for it:

- `st.dataframe` draws its cells on a canvas, so a DOM scrape sees at most the rows on
  screen, and a screenshot shows a small window of a 5,000-row table.
- Charts arrive as pixels or unlabeled SVG. The numbers behind them are not on the page.
- Choosing an option in a select box takes a click, typing, and a pick from a virtualized
  popover, and every committed change starts a rerun whose end the agent can only guess
  from a spinner.
- The DOM and the `st-*` test IDs are not a compatibility contract, so what an agent
  learns about one release can break in the next.

The agent API solves exactly this for agents outside the browser. A browser agent gets
little from it:

- **It answers in a different session.** A new agent session starts at the app's
  defaults, not at the filters the user set, so "why did this number drop?" gets an answer
  about a different number.
- **Reproducing the user's view is lossy.**
  [#17394](https://github.com/streamlit/streamlit/pull/17394) embeds the user's widget
  values in the page so an agent can replay them into its own session, but dependent
  filters have to be sent one at a time, dialogs cannot be reproduced, state only code set
  is lost, and a form replay shows the branch after a submit.
  [#17401](https://github.com/streamlit/streamlit/pull/17401)'s server-side copy
  reproduces far more, but needs a grant delivered through the page.
- **It cannot act for the user.** Nothing an agent does over HTTP or MCP appears in the
  user's tab. A user who asks "set this to Europe and Q3" has to repeat the agent's steps
  by hand.
- **It does not carry the user's identity.** An `st.login` app is signed out for the agent
  API until its follow-up #10, while the user's tab is signed in.
- **A browser agent rarely knows it exists.** The API is off by default, and a browser
  agent seldom has an app's MCP server configured.

The parent spec left this case out on purpose ("Attaching to or taking over a human's live
browser session"), because a headless interface cannot provide it. WebMCP is the standard
way for a page to provide it.

### What WebMCP offers

A page calls `document.modelContext.registerTool({ name, description, inputSchema,
execute, annotations })`, and agents the browser trusts can list and call those tools
([imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api),
[explainer](https://github.com/webmachinelearning/webmcp)):

- **Tools run in the page's own JavaScript**, so their effects show up in the page. The
  explainer's goals are human-in-the-loop use and adapting a site's UI for agents rather
  than bypassing it, and it lists fully headless use as a non-goal.
- **Annotations** include `readOnlyHint`, `untrustedContentHint` for output that carries
  untrusted content, and `consequentialHint`, which lets a browser require the user's
  confirmation before a call.
- **Exposure** defaults to the page itself, same-origin frames, and the browser's
  built-in agent. Registration is gated by the `tools` Permissions Policy, which defaults
  to `self`.
- **The tool list may change at any time**, unlike MCP's, though the best practices warn
  that dozens of tools degrade an agent, and there is no in-place update of a tool's
  schema.
- **Status:** origin trials in Chrome 149 and Edge 150, support in ChatGPT Desktop, and
  experimental support in Brave's Leo. Firefox and Safari have standards-position threads
  only ([implementation status](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md)).
  The API is still changing: `navigator.modelContext` became `document.modelContext`, and
  Chrome 155 deprecated arguments passed as a JSON string.

### Use cases

1. **Ask about what I am looking at.** "Why did net revenue fall in this chart?" The agent
   reads the user's view, including titles, captions, filter values, and the metric, and
   pages through the table behind the chart, rows the grid does not show included.
2. **Explore without touching my screen.** "What does this look like for APAC?" The agent
   works in a private copy of the user's session, starting from their filters, and
   reports back. The user's view stays as it is.
3. **Do it for me.** "Set the region to Europe, pick Q3, and switch to the reports page."
   The agent changes the user's own session. The user watches the widgets change and keeps
   working from the result.

## Proposal

### Turning it on

```toml
# .streamlit/config.toml
[client]
browserAgentAccess = "read"
```

| Value             | Tools registered                       |
| ----------------- | -------------------------------------- |
| `"off"` (default) | None                                   |
| `"read"`          | `read_view` and `get_data`             |
| `"interact"`      | Also `interact` and `change_view`      |

The setting is independent of `server.enableAgentApi`. That one decides whether programs
outside a browser can reach the app. This one decides what an agent in the user's own
browser may do in the user's tab. See [Its own setting](#its-own-setting).

The frontend registers the tools only where `document.modelContext` exists, so other
browsers see no change. To try it locally:

1. Enable `chrome://flags/#enable-webmcp-testing` and relaunch Chrome.
2. Run the app with `browserAgentAccess = "read"` and open it.
3. Inspect and call the tools with Chrome's
   [Model Context Tool Inspector](https://developer.chrome.com/docs/ai/webmcp#imitate_an_agent_to_test_your_tools)
   extension, or ask a browser agent about the page.

During the origin trial, a deployment that wants its users' Chrome to see the tools
supplies a trial token for its origin. A proxy can send it as an `Origin-Trial` response
header, so Streamlit needs no option for it.

### The tools

The tool set is fixed. Where a tool overlaps with the MCP endpoint, it has the same name
and contract. In this spec, _the tab_ is the browser tab the agent works in, and _the
tab's session_ is the Streamlit session behind it.

| Tool          | Session it works on                     | Runs app code | Changes the user's view |
| ------------- | --------------------------------------- | ------------- | ----------------------- |
| `read_view`   | The tab's                               | No            | No                      |
| `get_data`    | The tab's, or an `interact` session's   | No            | No                      |
| `interact`    | A private copy of the tab's             | Yes           | No                      |
| `change_view` | The tab's                               | Yes           | Yes                     |

Every tool sets `untrustedContentHint: true`. Tool names, descriptions, and schemas are
fixed Streamlit text, as in the MCP endpoint, so app content reaches the agent only inside
results. The descriptions carry the MCP endpoint's model guidance, plus which session each
tool touches and whether the user sees it.

#### `read_view`

Returns the snapshot of the tab's session: the document `interact` returns, with `tree`,
`actions`, `page`, `pages`, `query_params`, `status`, and `observed_at`, for what the user
sees now.

- **No input, and no app code runs:** `readOnlyHint: true`.
- **It reports the last settled run.** If a run is in progress, it waits for it to settle,
  up to `server.agentRunTimeout`, and otherwise returns `run_timed_out`. Calling again
  waits again. `run_every` fragments rerun in the tab as usual, so `read_view` sees their
  latest output, which an agent session never does.
- **Values are what the app last ran with.** Edits the user has not committed, such as
  unsubmitted form fields, text still being typed, or a value held back by
  `on_change="ignore"`, are not in the snapshot, because the app has not seen them.
- **No `session_id`.** The tab's session is not an agent session, and only this tab's
  tools can address it.
- **The snapshot's rules are unchanged.** A password is never included, and the snapshot
  publishes nothing the browser did not receive.

```json
{
  "schema_version": 1,
  "status": "ready",
  "observed_at": "2026-10-21T09:30:00Z",
  "page": { "url_path": "", "title": "Regional revenue" },
  "tree": { "type": "root", "children": ["…"] },
  "actions": [
    { "key": "region", "kind": "value", "type": "selectbox", "label": "Region" }
  ]
}
```

#### `get_data`

The MCP endpoint's `get_data`, with the same paging, page-size budget, size cap, and errors
(`unknown_file`, `result_too_large`, `read_unsupported`). Only its session differs:

```text
get_data(url, session_id=None, offset=0, limit=500)
```

Without `session_id` it reads files the tab's latest result references. With one, it reads
files that `interact` session's latest result references. Every file it can read was
already sent to this browser. `readOnlyHint: true`.

#### `interact`

The agent API's operation, with one difference: a creating call starts from the tab.

- **`{}` copies the tab's session into a new agent session** on the server, including
  session state, widget values, page, query parameters, browser context, and uploads, and
  runs it once without firing callbacks. Nothing passes through the browser or the agent.
  From then on it is an ordinary agent session, with the request, snapshot, validation,
  `run_timed_out` collection, and errors of HTTP and MCP.
- **The tab's view does not change.** The copy belongs to the agent.
- **It is bound to the tab.** It carries the tab user's identity, `st.user` included, so an
  `st.login` app is signed in, which HTTP and MCP cannot offer until agent sign-in. Only
  this tab's tools can address it. It ends when the tab's session ends or after
  `server.agentSessionTTL`. A tab holds at most three copies, and they count toward
  `server.agentMaxSessions`.
- **Annotations:** `readOnlyHint: false` and `consequentialHint: true`. A copy isolates the
  view, not the side effects: callbacks still run, and anything they write is written as
  the user.

#### `change_view`

Changes the tab's session the way the user would.

- **Input:** `widget_state`, `trigger`, `page`, and `query_params` from the agent API
  request, with the same schema and validation, checked against the tab's latest snapshot.
  There is no `session_id`, since the session is the tab's, and no `context`, since the tab
  reports its real one.
- **Values land as the user's would.** They reach the app as if the browser had sent them,
  so callbacks fire in page order and fragment scoping works as in the browser. They are
  then pushed to the tab's widgets the way an `st.session_state` write is, so the tab shows
  them and the user's next interaction keeps them. Widgets without a `key` are included.
- **The user sees it happen and can stop it.** While a call runs, the tab's widgets are
  disabled, so a click cannot resend old values over the agent's, and the app shows that an
  assistant is changing it, with a stop control. Stopping, or the agent aborting the call,
  stops the run as the stop button does.
- **The user's unfinished edits win.** A request that touches a field the user has edited
  and not committed is refused with `pending_user_edit` before anything runs, naming the
  field. The agent can ask the user to submit or discard the edit.
- **Forms need a submit trigger**, as everywhere in the agent API. Filling a form and
  leaving the submit to the user is [out of scope](#out-of-scope).
- **The result** is the snapshot once the run settles. A run past `server.agentRunTimeout`
  returns `run_timed_out` and keeps going in the tab, and `read_view` returns its result
  once it settles. One `change_view` runs per tab at a time; another is `session_busy`.
- **Annotations:** `readOnlyHint: false` and `consequentialHint: true`.

`pending_user_edit` is the only new error code. Every other refusal is the agent API's.

```json
{ "widget_state": { "region": "Europe", "quarter": "2026-Q3" } }
```

### How a tool call runs

**Over the tab's WebSocket.** A tool's `execute` sends the call to the server as a request
and response matched by ID, like the frontend's existing backend operations for deferred
downloads and dataframe chunks, and the server dispatches it to the session behind that
WebSocket. Calls never use the agent API's HTTP routes, which refuse a browser `Origin`
they were not configured for, read no cookie, and cannot reach the tab's session.

**Browser sessions that support WebMCP record descriptions.** A snapshot is built from the
description each command records, and today only sessions the agent API created record
one. A browser session also records when its browser supports WebMCP and
the setting is not `"off"`. The frontend reports in every rerun request whether
`document.modelContext` exists, and the server records from the first run and keeps that
session's merged tree, as it does for an agent session. Browsers without WebMCP, and apps
with the setting off, pay nothing. Recording starts with the session rather than at the
first tool call: a late start would leave the current page undescribed until the next run,
and starting a run just to describe the page would run app code the user did not ask for.

**Only what the browser received.** Descriptions publish nothing the browser does not
receive, and `get_data` reads files this tab already received. The tools give an agent the
tab's content in a form it can read, and nothing more.

### What the user sees

- **For `read_view` and `get_data`, nothing.** They read what the tab already has.
- **For `interact`, a quiet indicator** while a call runs, saying that an assistant is
  working in a copy of the app, since that copy runs code as the user.
- **For `change_view`, the change itself:** disabled widgets while it runs, an indicator
  with a stop control, and then the widgets showing the new values.

The indicator's design is for the design review and the tech spec. It adds no public API.

### Relation to the agent API, the MCP endpoint, and MCP Apps

| Surface                   | Where the agent runs                         | Session                               | Who sees the agent's work |
| ------------------------- | -------------------------------------------- | ------------------------------------- | ------------------------- |
| HTTP agent API            | Anywhere a program can send a `POST`         | A new agent session                   | Nobody                    |
| MCP endpoint              | AI applications that connect by URL          | A new agent session                   | Nobody                    |
| WebMCP (this spec)        | The user's browser, on the app's page        | The tab's, or a private copy of it    | The user, in the tab      |
| MCP Apps (not proposed)   | AI applications that render UI in the chat   | An agent session, shown in the chat   | The user, in the chat     |

The first three share one contract: the same snapshot, request schema, validation, and
error codes. A model that has learned one has learned the others. `interact` and
`get_data` mean the same thing in MCP and WebMCP, except that a new `interact` session
starts from the tab.

**MCP Apps is the mirror image.** [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview)
lets an MCP tool declare an HTML UI, a `ui://` resource named in `_meta.ui.resourceUri`,
which the host renders in a sandboxed iframe in the conversation. That UI calls the
server's tools through the host and can update the model's context with
`ui/update-model-context`
([specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)).
WebMCP brings the agent to the app's page. MCP Apps brings the app's UI into the agent's
chat. For Streamlit it would extend the MCP endpoint, not this spec, and that endpoint
serves tools only: it would have to negotiate the `io.modelcontextprotocol/ui` extension
and serve a `ui://` resource through `resources/read`.

Its hard part is this spec's in reverse: the view in the chat has to show the agent's
session. A renderer of the snapshot is the standalone semantic renderer the parent spec
rules out. The real Streamlit frontend needs the host to allow the app's origin as a nested
frame (`frameDomains`), which hosts may restrict and should warn about, and it needs a
browser attached to an agent session, which is the reverse of `interact`'s copy and pushes
server state into a browser the way `change_view` does. Three things carry over: the
snapshot contract; app-only tools (`visibility: ["app"]`), which would let the view call
`interact` without adding tools to the model's list; and `ui/update-model-context`, the MCP
Apps counterpart to `read_view`, which would tell the model what the user changed in the
view. It deserves its own spec after this one. The pieces this spec builds, namely browser
sessions that record, copying a session, and pushing server-applied values into a browser,
are the ones it would reuse.

### Platforms and embedding

- **A top-level app**, local or self-hosted, works wherever the browser supports WebMCP.
- **Multiple replicas need nothing extra.** Calls ride the tab's WebSocket, which is
  already pinned to its replica, and `interact` copies live in the tab's process. Over
  HTTP and MCP, the same deployment needs session affinity.
- **An app in an iframe**, such as Community Cloud's `/~/+/` frame, `?embed=true` in a
  portal, or SiS in Snowsight, can register tools only when its frame is same-origin with
  the host page or the host grants `allow="tools"`. Community Cloud's frame is same-origin
  with its wrapper, so registration works there. Whether a browser's built-in agent sees tools registered in a
  frame is still open in WebMCP, which is considering hiding them unless the frame opts in.
  Until that settles, an embedded app's tools may be visible only to extensions and
  same-origin page agents.
- **SiS** needs Snowsight to grant `allow="tools"`. An `interact` copy takes the tab's
  WebSocket handshake headers, so a short-lived caller's-rights token ages in the copy as
  it does in the tab, which [#17401](https://github.com/streamlit/streamlit/pull/17401)
  found for copies in general.

### Security

The tools add no authority. A call has exactly the tab's authority, travels over the tab's
WebSocket, and reaches nothing the page's own JavaScript could not. What is new is who
drives it: an agent that reads app content, which can carry prompt injection, and acts with
the signed-in user's identity, where the agent API's sessions are anonymous unless a
deployment maps identity.

- **Opt-in, in levels.** Off by default. `"read"` exposes only what the tab already shows.
  Anything that runs app code needs `"interact"`.
- **Writes are consequential.** `interact` and `change_view` set `consequentialHint`, so a
  browser that confirms consequential tools asks before each call, and neither is
  read-only. As in the MCP endpoint, no action is labeled safe, and the extra confirmations
  are the honest cost.
- **Results are untrusted, and tool metadata is never app-authored.**
- **Exposure stays at WebMCP's default:** the page itself, same-origin frames, and agents
  the browser trusts. This spec exposes nothing to other origins through `exposedTo`.
- **Code already in the page gains nothing.** Custom components, and `st.html` with scripts
  allowed, can call these tools like the page's other code, and they can already read and
  drive the page.
- **The user stays in the loop for changes.** `change_view` shows what it does, disables
  input while it runs, can be stopped, and never overwrites the user's unfinished edits.
- **Copies are bounded and bound.** At most three per tab, under the tab's identity only,
  ending with the tab.

### Rollout

Three steps, each shipping on its own. A level registers only the tools that have shipped.

1. **Read:** `read_view` and `get_data`. Needs the WebSocket operations, recording for
   sessions whose browser supports WebMCP, and the setting with `"off"` and `"read"`.
2. **Explore:** `interact`. Needs the session copy from
   [#17401](https://github.com/streamlit/streamlit/pull/17401) as a supported feature:
   copying on the server, binding to the tab, and the per-tab bound.
3. **Change the view:** `change_view`. Needs agent-applied values pushed to the tab's
   widgets through the existing `set_value` path, widgets without a `key` included, a check
   that stateful containers follow those values, the input lock, indicator, and stop
   control, and detection of uncommitted edits in the frontend.

End-to-end tests inject a stub `document.modelContext` through Playwright, since CI
browsers do not ship WebMCP, and a manual pass uses Chrome with the testing flag and the
Model Context Tool Inspector.

## Key design decisions

### Tool shape: four fixed tools

**Option 1: Four fixed tools, with the action space in each result** ✅ PREFERRED

- Pros: One contract with HTTP and MCP. Four tools sit well inside WebMCP's tool budget,
  and nothing is re-registered when the app reruns.
- Cons: The agent reads `actions` from a result instead of seeing each action as a tool.

**Option 2: One tool per widget or action, re-registered after each run.** WebMCP allows a
changing tool list, unlike MCP.

- Pros: Each action's schema is visible before the call, and a browser could confirm per
  action.
- Cons: A dashboard has dozens of widgets, past the point where WebMCP's best practices say
  agents degrade. Widgets without a `key` would be named after generated IDs. Every rerun
  fires `toolchange` and invalidates schemas the model already read, with no in-place
  update. It is a second contract next to HTTP and MCP.

**Option 3: A tool per `st.form`, in addition.** A form already declares a typed operation,
which is the shape of a WebMCP tool. Worth revisiting together with letting an agent fill a
form for the user to submit.

### Not the declarative API

WebMCP's draft declarative API turns an annotated `<form>` with named controls into a tool.
`st.form` renders a `div`, widgets are not named native controls, their values are not
plain strings, and a submit goes over the WebSocket rather than an HTTP post. The
declarative API is also not yet part of the WebMCP specification.

### Transport: the tab's WebSocket

**Option 1: Requests over the tab's WebSocket** ✅ PREFERRED

- Pros: The tab's session and identity, no new route, and it works wherever the app's
  WebSocket works, behind prefix-stripping hosts included.
- Cons: New operation payloads on the WebSocket protocol.

**Option 2: `fetch` to the agent API's HTTP routes from the page**

- Pros: No WebSocket protocol change.
- Cons: Those routes refuse a browser `Origin` that is not explicitly allowed, which is
  their DNS-rebinding defense. They read no cookie, need `server.enableAgentApi`, and can
  only create sessions, never reach the tab's.

**Option 3: Build the snapshot in the frontend from the protos it already has**

- Pros: No backend work for reads.
- Cons: The parent spec's central decision is that protos have lost the meaning: the
  command's identity, the authored options behind `format_func` labels, and chart
  encodings. It would also duplicate the snapshot builder in TypeScript.

### Applying `change_view` values: on the server, pushed back to the tab

**Option 1: The server applies them as browser input, and the existing `set_value` push
brings them to the widgets** ✅ PREFERRED

- Pros: The frontend already handles `set_value` for every widget that accepts
  `st.session_state` writes. The backend change is to mark agent-applied widget IDs as
  changed where it decides which widgets to push, which also covers widgets without a
  `key`.
- Cons: Stateful `st.tabs`, `st.expander`, and `st.popover` containers do not use
  `set_value`. They send their current state on every run instead, so the tech spec has to
  confirm that the browser shows an agent-applied value for them too.

**Option 2: The frontend writes the values into its widget state**

- Pros: No backend change for applying values.
- Cons: Widget components keep local state and re-read it only on mount or on `set_value`,
  so every widget would need a new update path and its own conversion from JSON to its wire
  value.

**Option 3: A message that overwrites the frontend's whole widget state**

- Pros: General. It becomes worthwhile if handing an `interact` copy back to the tab
  becomes a goal, which MCP Apps would also need.
- Cons: More frontend work than this spec needs.

### `interact` starts from a copy, not a replay

**Option 1: Copy the tab's session on the server** ✅ PREFERRED

- Pros: In [#17401](https://github.com/streamlit/streamlit/pull/17401)'s spike, a copy
  reproduced 5 of 6 state lines in one request, where replay got 3 of 6 in 13 requests. It
  carries state only code set, uploads, and an open dialog, and fires no callbacks.
- Cons: Copying large state blocks the server's event loop (1.26 s for a million dicts in
  the spike), duplicates memory, and couples to session internals.

**Option 2: Replay the tab's widget values into a fresh agent session**, from
[#17394](https://github.com/streamlit/streamlit/pull/17394)'s embedded document

- Pros: No access to session internals.
- Cons: Dependent filters one at a time, dialogs and code-only state lost, and callbacks
  fire again.

### Its own setting

**Option 1: A `client.browserAgentAccess` setting with levels** ✅ PREFERRED

- Pros: It separates two decisions. `server.enableAgentApi` opens an execution surface to
  programs anywhere, in sessions that are anonymous unless identity is mapped. This setting
  lets an agent in the user's own browser act as that user. A deployment may want either
  without the other: a private app behind single sign-on that wants browser agents but no
  HTTP surface, or a public app that serves agents over MCP but does not want them acting
  in visitors' tabs. An enum leaves room for the read and interact levels.
- Cons: One more option to document.

**Option 2: Reuse `server.enableAgentApi`**

- Pros: One switch.
- Cons: The MCP endpoint shares the switch because anyone who can call the HTTP API can
  wrap it in MCP. That argument does not carry over: here the agent gets the user's
  authority, not an anonymous session's.

## Out of scope

- **Filling a form for the user to submit**, WebMCP's flagship pattern. Form values live
  only in the browser until a submit, so it needs the frontend to set widget values itself,
  as in option 2 for applying values. A later spec.
- **Exposing tools to other origins**, such as an embedding platform's own assistant,
  through WebMCP's `exposedTo`. The host-message allow-list, `client.allowedOrigins`, is
  the natural source for that list.
- **Tools declared by authors or components:** a tool per form, actions an author labels
  safe, and a Components v2 API for a component to register its own tools, which could make
  some `browser_required` components drivable.
- **Handing a copy back to the tab**, as in "show me what you found."
- **MCP Apps**, described above.
- **Browsers other than Chromium-based ones**, until they ship WebMCP. Feature detection
  leaves them unaffected.

## Open questions

1. **What does recording cost once WebMCP is everywhere?** Recording is limited to browsers
   with WebMCP in apps that opt in. If Chrome turns WebMCP on by default, every Chrome
   session of an opted-in app records. Measure the per-element and memory cost before
   `"read"` can become a default. The fallback is to start recording at the first tool
   call, at the price of an undescribed page until the next run.
2. **Should `"read"` become the default?** It shows a browser agent only what the tab
   already received.
3. **Should `interact` be consequential?** A browser that confirms consequential tools
   would ask before every step of an exploration, although the user's view never changes.
   But its callbacks write as the user.
4. **Should `client.disableDataExport` turn off `get_data`?** That option hides export
   controls and is documented as not being a security control, and the agent API ignores
   it. An author who set it may still not expect an assistant to page through a table.
5. **How do embedded apps get their tools seen?** That depends on WebMCP's decision about
   frames and built-in agents. Community Cloud and Snowsight may need to opt their app
   frames in.
6. **Is the setting's name right?** `client.browserAgentAccess` names the audience and the
   levels. An alternative is to name the standard, such as `client.webmcp`, which is easier
   to search for but ties the option to a draft's name.

## Checklist

| Item                       | ✅ or comment |
| -------------------------- | ------------- |
| Works on SiS, Cloud, etc?  | ⚠️ A top-level app works in any browser that supports WebMCP. Community Cloud's frame is same-origin with its wrapper, so tools register there, but whether built-in agents see tools in a frame is still open in WebMCP. SiS needs Snowsight to grant `allow="tools"`. Multi-replica deployments need nothing, since calls ride the tab's WebSocket. During the origin trial, each deployment supplies its own token, for example as an `Origin-Trial` header. Browsers without WebMCP are unaffected. |
| No breaking API changes    | ✅ Additive: one config option, new operation payloads on the WebSocket protocol, and a capability flag in rerun requests. No `st.*` changes. Apps with the setting off, and browsers without WebMCP, behave as today. |
| No new dependencies        | ✅ No runtime dependencies. TypeScript types for WebMCP are hand-written or come from `webmcp-types` as a dev dependency. |
| Metrics collected          | Yes, unlike the agent API: these calls happen in a browser, so the frontend's existing usage stats (`browser.gatherUsageStats`) can count calls and outcome classes per tool, and whether the browser supports WebMCP, without any content. |
| Any security/legal impact? | ⚠️ No new authority, since calls have exactly the tab's authority over its own WebSocket. The new risk is an agent acting with the signed-in user's identity after reading untrusted app content. Mitigations: off by default, a read-only level, `consequentialHint` on every tool that runs app code, `untrustedContentHint` on every result, fixed tool metadata, visible and stoppable changes, and copies bound to the tab. |
| Any docs changes needed?   | A guide to browser agents: the levels, testing with Chrome's flag and the Model Context Tool Inspector, and what an agent can do at each level. Author guidance that a widget's range or options are not access control applies here too. Deployment notes on origin-trial tokens and on apps in iframes. The agent API reference gains the four tools. |
| Any other risks?           | WebMCP is a draft that is still changing, and only Chromium-based browsers ship it. Building on its stable core, the imperative `registerTool` with fixed tools, keeps the exposure small. A confusing app is a confusing tool here too. |
