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
 * Streamlit's version. This gets initialized when a report is first created.
 * Not really a "constant", but once intiailized it never changes.
 */
export let STREAMLIT_VERSION = null;

/**
 * The WAN-facing IP address of the machine this browser is in.
 */
export const BROWSER_IP_ADDRESS = window.BROWSER_IP_ADDRESS;

/**
 * Parameters for our fetch() requests.
 */
export const FETCH_PARAMS = {
  redirect: 'follow',
  credentials: 'same-origin',
  mode: 'cors',
};

/**
 * Region of our AWS S3 bucket.
 */
export const AWS_REGION = 'us-west-2';

/**
 * Pool ID for Cognito credentials.
 */
export const COGNITO_IDENTITY_POOL_ID =
    'us-west-2:9f2fd5d3-79e5-44be-830a-137fef3c2a06';


export function setStreamlitVersion(version) {
  if (STREAMLIT_VERSION != null) {
    throw new Error('Streamlit version is already set');
  }

  STREAMLIT_VERSION = version;
  console.log('Streamlit version: ', STREAMLIT_VERSION);
}
