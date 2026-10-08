# Embedding the user's view state for a co-browsing agent

A co-browsing agent reads the page the user is viewing, then answers in a session of its own through the agent API. The page shows what the user sees but not which widget values produced it, so the agent's session would answer about the app's defaults. To close that gap, the frontend keeps the user's current widget values in the page, in the encoding the agent API's `widget_state` request accepts.

## Where it is

```html
<script id="streamlit-agent-view-state" type="application/json">…</script>
```

The script element is a direct child of `<body>`. It exists once the app has rendered, and it updates on every widget change, without waiting for a rerun. Each update reads the render tree as it is at that moment, so a field that has just become a password field is never reported with a stale classification. Find it with `document.getElementById("streamlit-agent-view-state")`, or the selector `script#streamlit-agent-view-state[type="application/json"]`. The `<link rel="service-desc">` in `<head>` points at the agent API's description.

`<`, `>`, `&`, U+2028, and U+2029 are written as `\uXXXX` escapes, so a value cannot end the script element. The body is still plain JSON.

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
  "omitted": { "token": "sensitive" }
}
```

| Field          | Meaning                                                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page`         | The current page's `url_path`, for the request's `page`.                                                                                                                                                                        |
| `query_params` | The address bar's query string, in the request's `query_params` shape.                                                                                                                                                          |
| `widget_state` | Every value outside a form, keyed by the author's `key=` or, for a keyless widget, by its generated element ID. That is the addressing rule `resolve_element_id` applies. Sidebar first, then the main area, top to bottom. |
| `forms`        | One complete request body per form the user has submitted while it has stayed on the page: the form's committed fields, and the trigger for its first enabled submit button.                                                                                  |
| `omitted`      | Values the user holds that are not handed over, by key, with the reason.                                                                                                                                                        |

The frontend's `WidgetStateManager` is the source of truth. The document holds its committed values: what the app last ran with, plus a change still on its way to the server. Values are the wire values, with two exceptions where the agent API reads a value differently:

- A date, time, or datetime slider carries microseconds; the document carries the ISO text the agent API requires (`"2024-01-02"`, `"14:00"`, `"2024-06-02T06:00"`). Sub-second precision is dropped.
- `st.feedback` carries its index as text, with `""` for no selection; the document carries the index or `null`, as the agent API's snapshot reports it.

### What is left out, and why

| Reason             | Applies to                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `sensitive`        | A password `st.text_input`, consistent with the snapshot's redaction. Only the key appears.                                        |
| `binary`           | `st.file_uploader`, `st.camera_input`, `st.audio_input`.                                                                            |
| `unsupported`      | Values the agent API cannot set: `st.data_editor` edits, dataframe and chart selections, custom component values. Also a cleared `st.feedback` that has a default: the agent API can only send `null`, which reads as the default. |
| `disabled`         | A disabled widget or stateful `st.popover`, which the agent API refuses to set.                                                    |
| `in_dialog`        | A widget inside an open `st.dialog`. The agent's session only shows the dialog after it fires whatever opened it.                  |
| `no_submit_button` | A field in a form with no enabled submit button, so there is no trigger to send it with.                                           |
| `too_large`        | A value over 4,096 characters of JSON, or any value once the document's values reach 32,768 characters.                            |

These are left out without an entry:

- Triggers: buttons, `st.chat_input`, and the like. They reset after the run that observed them, so they are not state.
- Fields of a form the user never submitted. The app ran with their defaults, and replaying a submit would show the app's submitted branch, which the user never saw.
- Form edits the user has not submitted. The app has not seen them.

## Reproducing the view

1. Send `{"page": …, "query_params": …}` to start a session on the user's page.
2. Send `{"session_id": …, "widget_state": …}`.
3. For each entry in `forms`, send `{"session_id": …, ...entry}`.

Step 2 works in one request when the values are independent of each other. When one widget's options depend on another's value, the single request is refused and nothing is applied, because the agent API checks each value against the options its session currently offers. In the e2e app, setting region, country, and city together returns:

```
400 invalid_value: 'Texas' is not one of the options for 'country': 'France', 'Germany'.
```

In that case, send the values one at a time in the order given, and retry any that are refused until the others have landed. The order puts the sidebar first because that is where an app usually puts the filters its main area depends on; the retry handles any other order. A keyless dependent widget's generated ID changes with its options, so it only resolves after the value it depends on is set. That is also why it resolves at all: the ID is a hash of the widget's parameters, not of the session. `e2e_playwright/agent_view_state_test.py` has a reference client, `_AgentClient.apply`.

## Known gaps

- `st.session_state` values that no widget holds are not in the document. A widget value set from code is included, because the browser receives it like any other value.
- A form replay fires the submit button, so the agent's session shows the run right after a submit. If the user has since changed something outside the form, the app's `if submitted:` branch differs.
- `clear_on_submit` forms: the document holds the submitted values, which is also what the server holds. The browser shows the cleared fields.
- A widget whose `on_change="ignore"` value has not been sent yet is reported with the value it shows, which the app has not run with.
- Not gated on `server.enableAgentApi`. The frontend is not told whether the API is on, so the element is always present. It only carries values already visible on the page, apart from generated element IDs.
- An HTML-to-text scraper that drops `<script>` content loses the document. The scraper has to keep the element or read it separately.
- On a host page that embeds the app in an iframe, the element is in the iframe's document, not the host's.

## Follow-ups

- Let the agent API apply an ordered `widget_state` with reruns between dependent values, so step 2 is always one request.
- Tell the frontend whether the agent API is enabled, and embed the document only then.
- Record what opened a dialog, so a dialog's values can be handed over too.
- Have the agent API send a `null` value through the widget's serializer, so a cleared `st.feedback` with a default can be handed over.
