# Embedding the user's view state for a co-browsing agent

A co-browsing agent reads the page the user is viewing, then answers in a session of its own through the agent API. The page shows what the user sees but not which widget values produced it, so the agent's session would answer about the app's defaults. To close that gap, the frontend hands the user's current widget values to an in-page reader, in the encoding the agent API's `widget_state` request accepts.

## Where it is

Only while `server.enableAgentApi` is on. The server says so in every new session's `Config` (`enable_agent_api`), and the frontend adds or removes both forms below to match. An app that has not turned the API on has neither, so its DOM stays free of anything an agent could come to rely on.

**The function (recommended for a bridge):**

```js
const json = window.streamlitAgentViewState?.({ maxLength: 9500 }) // string or null
```

It builds the document when called, from the render tree and committed values at that moment, and returns at most `maxLength` characters (default 8,192). It returns `null` if not even a document without values fits. It costs nothing until it is called.

**The element:**

```html
<script id="streamlit-agent-view-state" type="application/json">…</script>
```

The script element is the first child of `<body>`, so `document.getElementById("streamlit-agent-view-state")` finds it before any element with the same ID that the app's own HTML renders. It holds the same document as the function with the default budget, and is rewritten on every committed widget change, without waiting for a rerun. The `<link rel="service-desc">` in `<head>` points at the agent API's description.

Both write `<`, `>`, `&`, U+2028, and U+2029 as `\uXXXX` escapes, so a value cannot end a script element. The text is still plain JSON.

The source is `frontend/lib/src/agentViewState/agentViewState.ts`.

## What it contains

```json
{
  "version": 1,
  "page": "sales",
  "query_params": { "year": ["2024"] },
  "widget_state": {
    "region": "US",
    "country": "Texas",
    "$$ID-cddde0dfb4f874161b55f05b0f63c0c5-None": "Dallas",
    "price": [11, 90],
    "since": ["2024-01-02"]
  },
  "forms": [
    {
      "widget_state": { "$$ID-e0d6c5893890220a8fbebf9e2b5ad68c-None": 25 },
      "trigger": { "key": "FormSubmitter:limits-Apply" }
    }
  ],
  "omitted": { "token": "sensitive" },
  "complete": true
}
```

| Field          | Meaning                                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `page`         | The current page's `url_path`, for the request's `page`.                                                                                                                                                                 |
| `query_params` | The address bar's query string, in the request's `query_params` shape.                                                                                                                                                   |
| `widget_state` | Every value outside a form, keyed by the author's `key=` or, for a keyless widget, by its generated element ID. That is the addressing rule `resolve_element_id` applies. Sidebar first, then the main area, top to bottom. |
| `forms`        | One complete request body per form the user has submitted while it has stayed on the page: the form's committed fields, and the trigger for the submit button the user used.                                              |
| `omitted`      | Values the user holds that are not handed over, by key, with the reason.                                                                                                                                                 |
| `complete`     | `false` when the document ran out of room. See [Length](#length).                                                                                                                                                        |

The frontend's `WidgetStateManager` is the source of truth. The document holds its committed values: what the app last ran with, plus a change still on its way to the server. Values are the wire values, with two exceptions where the agent API reads a value differently:

- A date, time, or datetime slider carries microseconds; the document carries the ISO text the agent API requires (`"2024-01-02"`, `"14:00"`, `"2024-06-02T06:00"`). Sub-second precision is dropped.
- `st.feedback` carries its index as text, with `""` for no selection; the document carries the index or `null`, as the agent API's snapshot reports it.

### What is left out, and why

| Reason             | Applies to                                                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sensitive`        | A password `st.text_input`, consistent with the snapshot's redaction. Only the key appears.                                                                                                                                       |
| `binary`           | `st.file_uploader`, `st.camera_input`, `st.audio_input`.                                                                                                                                                                           |
| `unsupported`      | Values the agent API cannot set: `st.data_editor` edits, dataframe and chart selections, custom component values. Also a cleared `st.feedback` that has a default: the agent API can only send `null`, which reads as the default. |
| `disabled`         | A disabled widget or stateful `st.popover`, which the agent API refuses to set.                                                                                                                                                   |
| `in_dialog`        | A widget inside an open `st.dialog`. The agent's session only shows the dialog after it fires whatever opened it.                                                                                                                 |
| `no_submit_button` | A field of a submitted form whose submit button the user used is no longer enabled. Firing a different button could run a different branch of the app.                                                                           |
| `too_large`        | A value longer than 4,096 characters as written.                                                                                                                                                                                   |

These are left out without an entry:

- Triggers: buttons, `st.chat_input`, and the like. They reset after the run that observed them, so they are not state.
- Fields of a form the user never submitted. The app ran with their defaults, and replaying a submit would show the app's submitted branch, which the user never saw.
- Form edits the user has not submitted. The app has not seen them.

### Length

The whole document, as written, is at most the budget: 8,192 characters for the element, or the caller's `maxLength` for the function. Keys, escapes, and `omitted` entries all count. The 8,192 default fits the smallest field a page-context reader is known to give it (10,000 characters), so a reader that keeps the document whole never has to cut it, and a cut document is not JSON.

Widgets are added in document order. At the first one whose entry does not fit, the document stops and sets `complete: false`: it holds a prefix, and every widget after the last key it lists is missing. A prefix keeps each value's parents, which a value picked to fill the remaining space could lack. If the query parameters alone do not fit, they are dropped as well, again with `complete: false`.

## Reproducing the view

1. Send `{"page": …, "query_params": …}` to start a session on the user's page.
2. Send `widget_state` in batches, one per level of dependency (below).
3. For each entry in `forms`, send `{"session_id": …, ...entry}`.

The agent API checks each value against the options its session offers now, and refuses a request whole if any value fails. So when one widget's options depend on another's value, the two cannot share a request. In the e2e app, sending region, country, and city together returns:

```
400 invalid_value: 'Texas' is not one of the options for 'country': 'France', 'Germany'.
```

A keyless dependent widget cannot share its parent's request even in principle: its generated ID is a hash of its parameters, options included, so the ID in the document only exists in the agent's session once the parent's value has landed. That is also why it resolves at all: the hash does not depend on the session.

Batch by what the latest snapshot accepts:

1. Pick every pending value whose key is in the snapshot's `actions` with kind `value` and, if the element lists `props.options` and does not accept new options, whose value is among them.
2. Send those in one request. On a 200, take its snapshot and repeat.
3. If the request is refused anyway, send its values one at a time, so one bad value cannot hold back the rest.
4. Stop when nothing pending is accepted. What is left is a value the agent's session never offered.

This takes one request per level of dependency instead of one per value. In the e2e app, 24 values take 5 requests in all (create, three levels, the form), where sending one value per request takes 27. `e2e_playwright/agent_view_state_test.py` has a reference client, `_AgentClient.apply`.

## Known gaps

- **Replaying a form repeats the user's submit.** The agent's session runs the app's submit branch again. For a filter form that is what the user saw. For a form that writes somewhere (an order, a database row), the replay writes again. A client must decide per form whether a replay is safe; the document cannot tell the two apart.
- **Callbacks run in a different order.** A batch changes several values in one rerun, while the user changed them one at a time. An `on_change` that resets a dependent widget, run in the same rerun as that widget's new value, can overwrite it. Sending the values one per request avoids this at the cost of more requests.
- `st.session_state` values that no widget holds are not in the document. A widget value set from code is included once the widget has rendered in the browser. A widget the browser has never mounted, such as one inside a popover the user has not opened, has no committed value there, so a value set for it from code is missing.
- `clear_on_submit` forms: the document holds the submitted values, which is also what the server holds. The browser shows the cleared fields.
- A widget whose `on_change="ignore"` value has not been sent yet is reported with the value it shows, which the app has not run with.
- A plain `st.text_input` or `st.text_area` that holds a secret is handed over like any other text. Only password fields are recognized.
- JavaScript orders object keys that look like whole numbers (`key="2024"`) before all others, so such keys do not follow document order.
- The element is found by ID before any element the app's HTML renders, but script running in the page (a custom component, `st.html` with JavaScript) can still replace either form. Only the function is computed when read.
- An HTML-to-text scraper that drops `<script>` content loses the element. A server-side fetch of the page never has either form, because the frontend creates them.
- On a host page that embeds the app in an iframe, both are in the iframe's document, not the host's.

## Follow-ups

- Remove the element once the in-page bridge calls the function, which is fresher and costs nothing until read. The element is rewritten whenever a widget value changes, re-indexing the tree each time it has changed: 0.2 to 3.9 ms on trees of 1,000 to 20,000 nodes (vitest, Node 24).
- Let the agent API apply an ordered `widget_state` with reruns between dependent values, so step 2 is always one request.
- Record what opened a dialog, so a dialog's values can be handed over too.
- Have the agent API send a `null` value through the widget's serializer, so a cleared `st.feedback` with a default can be handed over.
