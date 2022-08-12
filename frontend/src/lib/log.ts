import { IS_DEV_ENV } from "./baseconsts"

/* eslint-disable no-console */

/**
 * Log a message to the console, but only if in dev mode.
 */
export function logMessage(...args: any[]): void {
  if (IS_DEV_ENV) {
    console.log(...args)
  }
}

/**
 * Log an warning to the console, but only if in dev mode.
 * USE ONLY FOR WARNINGS: Meaning, only things that have a small impact on the
 * user experience, if any.
 */
export function logWarning(...args: any[]): void {
  if (IS_DEV_ENV) {
    console.warn(...args)
  }
}

/**
 * Log an error to the console. ALWAYS does this, even if in prod mode, because
 * errors are _that_ important.
 * USE ONLY FOR ERRORS: Meaning, only things that somehow "break" the user
 * experience.
 */
export function logError(...args: any[]): void {
  console.error(...args)
  // TODO: Send error report to our servers when there's an error.
}

/**
 * Log a message to the console. ALWAYS does this, even if in prod mode.
 * USE SPARINGLY!
 */
export function logAlways(...args: any[]): void {
  console.log(...args)
}
