**Note** This file will be deleted! Reviewers, please ignore! These are just notes fro me as I work on this renaming project.

## Step 3

- `self._has_local` -> `self._has_client_connection`
- `One "local" connection to the python libs.` -> `One ClientWebSocket connection to the client python libs.`
- `(local or client)` -> `(client or browser)`
- `local_display_enabled` -> `client_display_enabled`
- `__STREAMLIT_LOCAL_ROOT` -> `STREAMLIT_ROOT_DIRECTORY`

## Step 4

- `self._local_id` -> `self._client_id`
- `get_local_id(` -> `get_client_id(`
- `local_id` -> `client_id`
- `LOGGER.info('Local websocket` -> `LOGGER.info('Client websocket`
- `close_local_connection(` -> `close_client_connection(`
- `local_uuid.txt` -> `client_uuid.txt`

---

# PR 3: Fixups

- first big fixup
  - look this up and understand it better `on_browser_waiting_for_proxy_conn`
  - `on_browser_waiting_for_proxy_conn(` -> `replace_connection_and_queue(`

  - `Called when a client detects it has no corresponding ProxyConnection.` -> `Gets the most recent proxy connection and queue for this report_name. (BrowserWebSocket continuously calls this to in case a new client connection was established in which case we should switch to the new proxy connection and queue.)`

  - little cleanup:
    - move `proxy_connection_is_registered` into  `on_browser_waiting_for_proxy_conn`
    - give it a better name in `BrowserWebSocket.do_loop`
    - update doc string: `Gets the most recent proxy connection and queue for this report_name.`
    - commit
- `STREAMLIT_ROOT_DIRECTORY` : make that a direct `util` thing `caching.py`
