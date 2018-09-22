/**
 * Port used to connect to the prod proxy server.
 */
export const PROXY_PORT_PROD = 8501;

/**
 * Port used to connect to the dev proxy server.
 * If changing this, also change lib/streamlit/proxy/Proxy.py
 */
export const PROXY_PORT_DEV = 3000;

/**
 * True when in development mode.
 */
export const IS_DEV_ENV = window.location.port === PROXY_PORT_DEV;
