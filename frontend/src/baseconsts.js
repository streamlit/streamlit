/**
 * Port used to connect to the proxy server.
 */
export const PROXY_PORT = 8501;

/**
 * True when in development mode.
 */
export const IS_DEV_ENV = window.location.port != PROXY_PORT;
