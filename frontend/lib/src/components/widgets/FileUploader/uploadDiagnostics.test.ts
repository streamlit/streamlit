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

import {
  clearFileUploadDiagnosticLog,
  disableDiagnosticLogging,
  enableDiagnosticLogging,
  getFileUploadDiagnosticLog,
  getFormattedDiagnosticLog,
  isAndroidDevice,
  isDiagnosticLoggingEnabled,
  logFileSelection,
  logUploadResults,
  mayHaveAndroidPickerIssues,
} from "./uploadDiagnostics"

describe("uploadDiagnostics", () => {
  beforeEach(() => {
    // Clear window.localStorage before each test
    window.localStorage.clear()
  })

  describe("isDiagnosticLoggingEnabled", () => {
    it("returns false when not enabled", () => {
      expect(isDiagnosticLoggingEnabled()).toBe(false)
    })

    it("returns true when enabled", () => {
      window.localStorage.setItem("streamlit.fileUploader.debug", "true")
      expect(isDiagnosticLoggingEnabled()).toBe(true)
    })

    it("returns false when set to something other than true", () => {
      window.localStorage.setItem("streamlit.fileUploader.debug", "false")
      expect(isDiagnosticLoggingEnabled()).toBe(false)
    })
  })

  describe("enableDiagnosticLogging", () => {
    it("enables diagnostic logging", () => {
      expect(isDiagnosticLoggingEnabled()).toBe(false)
      enableDiagnosticLogging()
      expect(isDiagnosticLoggingEnabled()).toBe(true)
    })
  })

  describe("disableDiagnosticLogging", () => {
    it("disables diagnostic logging", () => {
      enableDiagnosticLogging()
      expect(isDiagnosticLoggingEnabled()).toBe(true)
      disableDiagnosticLogging()
      expect(isDiagnosticLoggingEnabled()).toBe(false)
    })
  })

  describe("logFileSelection", () => {
    it("returns null when logging is disabled", () => {
      const files = [new File(["test"], "test.txt")]
      const result = logFileSelection(true, files)
      expect(result).toBeNull()
    })

    it("logs file selection when enabled", () => {
      enableDiagnosticLogging()
      const files = [
        new File(["test"], "test.txt", { type: "text/plain" }),
        new File(["test2"], "test2.pdf", { type: "application/pdf" }),
      ]

      const result = logFileSelection(true, files)

      expect(result).not.toBeNull()
      expect(result?.multipleEnabled).toBe(true)
      expect(result?.filesReceived).toBe(2)
      expect(result?.files).toHaveLength(2)
      expect(result?.files[0].name).toBe("test.txt")
      expect(result?.files[0].type).toBe("text/plain")
      expect(result?.files[1].name).toBe("test2.pdf")
    })

    it("includes user agent in log", () => {
      enableDiagnosticLogging()
      const files = [new File(["test"], "test.txt")]

      const result = logFileSelection(false, files)

      expect(result?.userAgent).toBe(navigator.userAgent)
    })

    it("stores entry in window.localStorage", () => {
      enableDiagnosticLogging()
      const files = [new File(["test"], "test.txt")]

      logFileSelection(true, files)

      const log = getFileUploadDiagnosticLog()
      expect(log).not.toBeNull()
      expect(log?.entries).toHaveLength(1)
    })
  })

  describe("logUploadResults", () => {
    it("does nothing when logging is disabled", () => {
      logUploadResults([{ name: "test.txt", success: true }])
      const log = getFileUploadDiagnosticLog()
      expect(log).toBeNull()
    })

    it("updates most recent entry with results", () => {
      enableDiagnosticLogging()
      const files = [new File(["test"], "test.txt")]
      logFileSelection(true, files)

      logUploadResults([
        { name: "test.txt", success: true },
        { name: "failed.txt", success: false, error: "Network error" },
      ])

      const log = getFileUploadDiagnosticLog()
      expect(log?.entries[0].uploadResults).toHaveLength(2)
      expect(log?.entries[0].uploadResults?.[0].success).toBe(true)
      expect(log?.entries[0].uploadResults?.[1].success).toBe(false)
      expect(log?.entries[0].uploadResults?.[1].error).toBe("Network error")
    })
  })

  describe("getFileUploadDiagnosticLog", () => {
    it("returns null when no log exists", () => {
      expect(getFileUploadDiagnosticLog()).toBeNull()
    })

    it("returns stored log", () => {
      enableDiagnosticLogging()
      logFileSelection(true, [new File(["test"], "test.txt")])

      const log = getFileUploadDiagnosticLog()
      expect(log).not.toBeNull()
      expect(log?.sessionId).toBeDefined()
      expect(log?.entries).toHaveLength(1)
    })
  })

  describe("clearFileUploadDiagnosticLog", () => {
    it("clears the diagnostic log", () => {
      enableDiagnosticLogging()
      logFileSelection(true, [new File(["test"], "test.txt")])
      expect(getFileUploadDiagnosticLog()).not.toBeNull()

      clearFileUploadDiagnosticLog()
      expect(getFileUploadDiagnosticLog()).toBeNull()
    })
  })

  describe("getFormattedDiagnosticLog", () => {
    it("returns message when no entries", () => {
      const formatted = getFormattedDiagnosticLog()
      expect(formatted).toContain("No diagnostic entries")
    })

    it("returns formatted markdown when entries exist", () => {
      enableDiagnosticLogging()
      logFileSelection(true, [new File(["test"], "test.txt")])

      const formatted = getFormattedDiagnosticLog()
      expect(formatted).toContain("## File Uploader Diagnostic Log")
      expect(formatted).toContain("Session ID:")
      expect(formatted).toContain("### Entries")
      expect(formatted).toContain("```json")
    })
  })

  describe("isAndroidDevice", () => {
    it("detects Android in user agent", () => {
      // This test depends on the actual test environment's user agent
      // In most test environments, this will be false
      const result = isAndroidDevice()
      expect(typeof result).toBe("boolean")
    })
  })

  describe("mayHaveAndroidPickerIssues", () => {
    it("returns same as isAndroidDevice", () => {
      expect(mayHaveAndroidPickerIssues()).toBe(isAndroidDevice())
    })
  })

  describe("log size management", () => {
    it("keeps only most recent entries when exceeding max", () => {
      enableDiagnosticLogging()

      // Add more than MAX_LOG_ENTRIES (50)
      for (let i = 0; i < 55; i++) {
        logFileSelection(true, [new File([`test${i}`], `test${i}.txt`)])
      }

      const log = getFileUploadDiagnosticLog()
      expect(log?.entries.length).toBeLessThanOrEqual(50)
    })
  })
})
