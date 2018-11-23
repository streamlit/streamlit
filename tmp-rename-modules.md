**Note** This file will be deleted! Reviewers, please ignore! These are just notes fro me as I work on this renaming project.

# More specific Renamings

### Step 2

- `Markdown on the client before display.` -> `Markdown in the browser before display.`
- `on_client_opened` -> `on_browser_connection_opened`
- `on_client_closed` -> `on_browser_connection_closed`
- `New Client Connection` -> `New browser connection`
- `New Client Connection` -> `New browser connection`
- `Set of clients who` -> `Set of browsers which`
- `A proxy server between the Streamlit libs and web client.` -> `A proxy server between the Streamlit client and web browser.`
- `Zero or more "client" connections to the web client.` -> `Zero or more BrowserWebSocket connections to a web browser.`

### Step 3

- `seen any client connections` -> `seen any browser connections`
- `_received_client_connection` -> `_received_browser_connection`
- `So that client connections can` -> `So that browser connections can`
- `and launch a web client if` -> `and launch a browser if`
- `_launch_web_client` -> `_launch_web_browser`
- `Called when a client connection is opened.` -> `Called when a browser connection is opened.`
- `Called when a client connection is closed.` -> `Called when a browser connection is closed.`
- `The name of the report the client connection is for.` -> `The name of the report the browser connection is for.`
- `_add_client(` -> `_register_browser(`
- `The connection object for the client that just got closed.` -> `The ProxyConnection for the browser connection that just closed.`
- `The queue for the closed client.` -> `The queue for the closed browser connection.`

### Step 4

- `_remove_client(` -> `_deregister_browser(`
- `The name of the report the client connection is for.` -> `The name of the report the browser connection is for.`
- `add_client_queue(` -> `add_browser_queue(`
- `remove_client_queue(` -> `remove_browser_queue(`
- `self._client_queues` -> `self._browser_queues`

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
