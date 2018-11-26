/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

/**
 * Port used to connect to the proxy server.
 * TODO: Allow user to change this via config options. Today, the config option
 * exists, but it looks like it's never sent to the web client.
 */
export const PROXY_PORT_PROD = 8501;

/**
 * This is the port used to connect to the web server.
 */
export const PROXY_PORT_DEV = 3000;

/**
 * True when in development mode.
 */
export const IS_DEV_ENV = window.location.port === PROXY_PORT_DEV;

/**
 * Parameters for our fetch() requests.
 */
export const FETCH_PARAMS = {
    redirect: 'follow',
    credentials: 'same-origin',
    mode: 'cors'
};
