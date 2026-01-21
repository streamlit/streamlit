/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Diagnostic logging for file uploads, useful for debugging Android picker issues.
 * Enable by setting window.localStorage.setItem('streamlit.fileUploader.debug', 'true')
 */

export interface FileUploadDiagnosticEntry {
  timestamp: string
  userAgent: string
  multipleEnabled: boolean
  filesReceived: number
  files: Array<{
    name: string
    type: string
    size: number
    error?: string
  }>
  uploadResults?: Array<{
    name: string
    success: boolean
    error?: string
  }>
}

export interface FileUploadDiagnosticLog {
  sessionId: string
  entries: FileUploadDiagnosticEntry[]
}

const STORAGE_KEY = "streamlit.fileUploader.debug"
const LOG_STORAGE_KEY = "streamlit.fileUploader.diagnosticLog"
const MAX_LOG_ENTRIES = 50

/**
 * Check if diagnostic logging is enabled via window.localStorage.
 */
export function isDiagnosticLoggingEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

/**
 * Enable diagnostic logging for file uploads.
 */
export function enableDiagnosticLogging(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "true")
    // eslint-disable-next-line no-console
    console.log(
      "[FileUploader] Diagnostic logging enabled. Use getFileUploadDiagnosticLog() to retrieve logs."
    )
  } catch {
    // window.localStorage not available
  }
}

/**
 * Disable diagnostic logging for file uploads.
 */
export function disableDiagnosticLogging(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    // eslint-disable-next-line no-console
    console.log("[FileUploader] Diagnostic logging disabled.")
  } catch {
    // window.localStorage not available
  }
}

/**
 * Get the current diagnostic log.
 */
export function getFileUploadDiagnosticLog(): FileUploadDiagnosticLog | null {
  try {
    const stored = window.localStorage.getItem(LOG_STORAGE_KEY)
    return stored ? (JSON.parse(stored) as FileUploadDiagnosticLog) : null
  } catch {
    return null
  }
}

/**
 * Clear the diagnostic log.
 */
export function clearFileUploadDiagnosticLog(): void {
  try {
    window.localStorage.removeItem(LOG_STORAGE_KEY)
    // eslint-disable-next-line no-console
    console.log("[FileUploader] Diagnostic log cleared.")
  } catch {
    // window.localStorage not available
  }
}

/**
 * Get a formatted diagnostic log suitable for pasting into a GitHub issue.
 */
export function getFormattedDiagnosticLog(): string {
  const log = getFileUploadDiagnosticLog()
  if (!log || log.entries.length === 0) {
    return "No diagnostic entries recorded."
  }

  const lines: string[] = [
    "## File Uploader Diagnostic Log",
    "",
    `Session ID: ${log.sessionId}`,
    `Entries: ${log.entries.length}`,
    "",
    "### Entries",
    "",
  ]

  log.entries.forEach((entry, idx) => {
    lines.push(`#### Entry ${idx + 1} - ${entry.timestamp}`)
    lines.push("")
    lines.push("```json")
    lines.push(JSON.stringify(entry, null, 2))
    lines.push("```")
    lines.push("")
  })

  return lines.join("\n")
}

let sessionId: string | null = null

function getSessionId(): string {
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }
  return sessionId
}

/**
 * Log a file selection event for diagnostics.
 */
export function logFileSelection(
  multipleEnabled: boolean,
  files: File[]
): FileUploadDiagnosticEntry | null {
  if (!isDiagnosticLoggingEnabled()) {
    return null
  }

  const entry: FileUploadDiagnosticEntry = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    multipleEnabled,
    filesReceived: files.length,
    files: files.map(f => ({
      name: f.name,
      type: f.type || "unknown",
      size: f.size,
    })),
  }

  try {
    const log = getFileUploadDiagnosticLog() || {
      sessionId: getSessionId(),
      entries: [],
    }

    log.entries.push(entry)

    // Keep only the most recent entries
    if (log.entries.length > MAX_LOG_ENTRIES) {
      log.entries = log.entries.slice(-MAX_LOG_ENTRIES)
    }

    window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(log))

    // eslint-disable-next-line no-console
    console.log("[FileUploader] Diagnostic entry logged:", entry)
  } catch {
    // window.localStorage not available
  }

  return entry
}

/**
 * Update the most recent diagnostic entry with upload results.
 */
export function logUploadResults(
  results: Array<{ name: string; success: boolean; error?: string }>
): void {
  if (!isDiagnosticLoggingEnabled()) {
    return
  }

  try {
    const log = getFileUploadDiagnosticLog()
    if (log && log.entries.length > 0) {
      log.entries[log.entries.length - 1].uploadResults = results
      window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(log))
      // eslint-disable-next-line no-console
      console.log("[FileUploader] Upload results logged:", results)
    }
  } catch {
    // window.localStorage not available
  }
}

/**
 * Detect if the user agent suggests an Android device.
 */
export function isAndroidDevice(): boolean {
  return /android/i.test(navigator.userAgent)
}

/**
 * Detect if the user agent suggests "Files by Google" or similar problematic pickers.
 * Note: We cannot directly detect the picker app, but we can detect Android.
 */
export function mayHaveAndroidPickerIssues(): boolean {
  return isAndroidDevice()
}

// Expose functions globally for developer console access
if (typeof window !== "undefined") {
  // @ts-expect-error - Adding to window for debug access
  window.streamlitFileUploaderDiagnostics = {
    enable: enableDiagnosticLogging,
    disable: disableDiagnosticLogging,
    getLog: getFileUploadDiagnosticLog,
    getFormattedLog: getFormattedDiagnosticLog,
    clear: clearFileUploadDiagnosticLog,
  }
}
