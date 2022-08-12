/**
 * When in dev mode, this is the port used to connect to the web server that is
 * serving the current page (i.e. the actual web page server, not the API
 * server, which in dev are actually different servers.)
 */
export const WWW_PORT_DEV = 3000

/**
 * This is the port used to connect to the server web socket when in dev.
 * IMPORTANT: If changed, also change config.py
 */
export const WEBSOCKET_PORT_DEV = 8501

/**
 * True when in development mode.
 */
export const IS_DEV_ENV = +window.location.port === WWW_PORT_DEV

/**
 * Parameters for our fetch() requests.
 */
export const FETCH_PARAMS: RequestInit = {
  redirect: "follow",
  credentials: "same-origin",
  mode: "cors",
}

/**
 * Feature flag for https://github.com/streamlit/streamlit/issues/678.
 * If this is true, we show a modal dialog to prompt the user to rerun
 * when their script changes. If false, we show a less intrusive UI in
 * StatusWidget.
 */
export const RERUN_PROMPT_MODAL_DIALOG = false
