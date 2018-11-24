**Note** This file will be deleted! Reviewers, please ignore! These are just notes fro me as I work on this renaming project.

# NEXT REPLACEMENT

- `One "local" connection to the python libs.` -> `One ClientWebSocket connection to the client python libs.`
- `(local or client)` -> `(client or browser)`
- `local_display_enabled` -> `client_display_enabled`

# PR 3: Waiting for:

- look this up and understand it better `on_browser_waiting_for_proxy_conn`
- `on_browser_waiting_for_proxy_conn(` -> `replace_connection_and_queue(`

- `Called when a client detects it has no corresponding ProxyConnection.` -> `Gets the most recent proxy connection and queue for this report_name. (BrowserWebSocket continuously calls this to in case a new client connection was established in which case we should switch to the new proxy connection and queue.)`

- little cleanup:
  - move `proxy_connection_is_registered` into  `on_browser_waiting_for_proxy_conn`
  - give it a better name in `BrowserWebSocket.do_loop`
  - update doc string: `Gets the most recent proxy connection and queue for this report_name.`
  - commit
