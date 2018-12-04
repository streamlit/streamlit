/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

/**
 * When in dev mode, this is the port used to connect to the web server that is
 * serving the current page (i.e. the actual web page server, not the API
 * server, which in dev are actually different servers.)
 */
export const WWW_PORT_DEV = 3000;

/**
 * This is the port used to connect to the proxy web socket when in dev.
 * IMPORTANT: If changed, also change config.py
 */
export const WEBSOCKET_PORT_DEV = 8501;

/**
 * True when in development mode.
 */
export const IS_DEV_ENV = +window.location.port === WWW_PORT_DEV;

/**
 * Parameters for our fetch() requests.
 */
export const FETCH_PARAMS = {
    redirect: 'follow',
    credentials: 'same-origin',
    mode: 'cors',
};
