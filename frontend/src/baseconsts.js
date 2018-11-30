/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

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
